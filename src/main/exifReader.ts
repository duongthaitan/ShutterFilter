import fs from 'fs';
import path from 'path';
import os from 'os';
import exifr from 'exifr';

export async function getPhotoDateTaken(filePath: string): Promise<string | null> {
  try {
    const exifData = await exifr.parse(filePath, [
      'DateTimeOriginal',
      'CreateDate',
      'ModifyDate',
    ]);

    if (exifData) {
      const rawDate =
        exifData.DateTimeOriginal || exifData.CreateDate || exifData.ModifyDate;
      if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
        return formatDate(rawDate);
      }
      if (typeof rawDate === 'string') {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          return formatDate(d);
        }
      }
    }
  } catch (err) {
    // Suppress exifr errors for unsupported or non-image files, fallback to mtime
  }

  // Fallback to file mtime
  try {
    const stat = await fs.promises.stat(filePath);
    return formatDate(stat.mtime);
  } catch (err) {
    return null;
  }
}

export async function extractRawThumbnail(filePath: string): Promise<string | null> {
  // Engine 1: Try exifr.thumbnail
  try {
    const thumbBuffer = await exifr.thumbnail(filePath);
    if (thumbBuffer && thumbBuffer.byteLength > 0) {
      const base64 = Buffer.from(thumbBuffer).toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    }
  } catch (err) {
    // Engine 1 failed or unsupported format in exifr
  }

  // Engine 2: Deep Binary JPEG Segment Parser for RAW formats (.CR2, .CR3, .ARW, .NEF, .DNG, .RAF, .ORF, .PEF, .RW2)
  try {
    const jpegBuffer = await extractEmbeddedJpegBinary(filePath);
    if (jpegBuffer && jpegBuffer.length > 0) {
      // If JPEG preview is <= 4MB, return base64 data URL for instant zero-disk rendering
      if (jpegBuffer.length <= 4 * 1024 * 1024) {
        const base64 = jpegBuffer.toString('base64');
        return `data:image/jpeg;base64,${base64}`;
      }

      // If JPEG preview > 4MB (full resolution RAW preview), write to TEMP folder and return file:// URL
      // so Chromium can render large JPEGs without data-URI size limits
      const tempDir = os.tmpdir();
      const safeName = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');
      const tempPath = path.join(tempDir, `shutterfilter_raw_${safeName}.jpg`);
      await fs.promises.writeFile(tempPath, jpegBuffer);
      return `file:///${tempPath.replace(/\\/g, '/')}`;
    }
  } catch (err) {
    console.error('Engine 2 RAW extraction error:', err);
  }

  return null;
}

/**
 * Scans binary data of a camera RAW file using deterministic JPEG segment parsing
 * to locate and extract embedded JPEG preview streams.
 */
async function extractEmbeddedJpegBinary(filePath: string): Promise<Buffer | null> {
  let handle: fs.promises.FileHandle | null = null;
  try {
    handle = await fs.promises.open(filePath, 'r');
    const stat = await handle.stat();
    const fileSize = stat.size;

    if (fileSize < 50 * 1024) return null; // File too small to be a RAW

    // Read full file buffer for scanner
    const buffer = Buffer.alloc(fileSize);
    await handle.read(buffer, 0, fileSize, 0);
    await handle.close();
    handle = null;

    const jpegs: { start: number; length: number }[] = [];
    let pos = 0;

    while (pos < buffer.length - 4) {
      // Look for JPEG SOI marker: 0xFF 0xD8 0xFF
      if (buffer[pos] === 0xFF && buffer[pos + 1] === 0xD8 && buffer[pos + 2] === 0xFF) {
        const length = parseJpegLength(buffer, pos);
        if (length && length > 15 * 1024) {
          jpegs.push({ start: pos, length });
          pos += length;
          continue;
        }
      }
      pos++;
    }

    if (jpegs.length > 0) {
      // Prioritize crisp medium previews (100KB to 5MB) for fast URI rendering in Electron
      const idealCandidates = jpegs.filter(j => j.length >= 100 * 1024 && j.length <= 5 * 1024 * 1024);
      if (idealCandidates.length > 0) {
        idealCandidates.sort((a, b) => b.length - a.length);
        const best = idealCandidates[0];
        return buffer.subarray(best.start, best.start + best.length);
      }

      // Fallback to largest preview overall
      jpegs.sort((a, b) => b.length - a.length);
      const largest = jpegs[0];
      return buffer.subarray(largest.start, largest.start + largest.length);
    }
  } catch (err) {
    if (handle) {
      try { await handle.close(); } catch (_) {}
    }
  }
  return null;
}

/**
 * Parses a JPEG stream starting from offset using proper JPEG segment structure.
 * Returns the exact length of the JPEG image stream, or null if invalid.
 */
function parseJpegLength(buffer: Buffer, startOffset: number): number | null {
  if (startOffset + 2 > buffer.length) return null;
  if (buffer[startOffset] !== 0xFF || buffer[startOffset + 1] !== 0xD8) return null;

  let offset = startOffset + 2;

  while (offset < buffer.length - 2) {
    if (buffer[offset] !== 0xFF) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];

    if (marker === 0xFF) {
      offset++;
      continue;
    }

    // EOI (End of Image)
    if (marker === 0xD9) {
      return offset + 2 - startOffset;
    }

    // Standalone markers: SOI (D8), TEM (01), RST0-RST7 (D0-D7)
    if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
      offset += 2;
      continue;
    }

    // SOS (Start of Scan) - Entropy coded image data follows header
    if (marker === 0xDA) {
      if (offset + 4 > buffer.length) return null;
      const headerLen = buffer.readUInt16BE(offset + 2);
      offset += 2 + headerLen;

      while (offset < buffer.length - 1) {
        if (buffer[offset] === 0xFF) {
          const next = buffer[offset + 1];
          if (next === 0xD9) {
            return offset + 2 - startOffset;
          }
          if (next === 0x00 || (next >= 0xD0 && next <= 0xD7)) {
            offset += 2;
            continue;
          }
          if (next >= 0xC0 && next <= 0xFE) {
            return offset - startOffset;
          }
        }
        offset++;
      }
      return null;
    }

    // Regular segment with 2-byte length
    if (offset + 4 > buffer.length) return null;
    const segLen = buffer.readUInt16BE(offset + 2);
    if (segLen < 2) return null;
    offset += 2 + segLen;
  }

  return null;
}

function formatDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
