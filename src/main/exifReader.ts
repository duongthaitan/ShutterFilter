import fs from 'fs';
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

  // Engine 2: Deep Binary JPEG Scanner for RAW formats (.CR2, .CR3, .ARW, .NEF, .DNG, .RAF, .ORF, .PEF, .RW2)
  try {
    const jpegBuffer = await extractEmbeddedJpegBinary(filePath);
    if (jpegBuffer && jpegBuffer.length > 0) {
      const base64 = jpegBuffer.toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    }
  } catch (err) {
    console.error('Engine 2 RAW extraction error:', err);
  }

  return null;
}

/**
 * Scans binary data of a camera RAW file to locate and extract embedded JPEG preview streams.
 */
async function extractEmbeddedJpegBinary(filePath: string): Promise<Buffer | null> {
  let handle: fs.promises.FileHandle | null = null;
  try {
    handle = await fs.promises.open(filePath, 'r');
    const stat = await handle.stat();
    const fileSize = stat.size;

    if (fileSize < 100 * 1024) return null; // File too small to be a RAW

    // Read up to first 32MB where embedded JPEG previews are located
    const readSize = Math.min(fileSize, 32 * 1024 * 1024);
    const buffer = Buffer.alloc(readSize);
    await handle.read(buffer, 0, readSize, 0);
    await handle.close();
    handle = null;

    const jpegs: { start: number; end: number; size: number }[] = [];
    let pos = 0;

    while (pos < buffer.length - 4) {
      // Look for JPEG SOI marker: 0xFF 0xD8 0xFF
      if (buffer[pos] === 0xFF && buffer[pos + 1] === 0xD8 && buffer[pos + 2] === 0xFF) {
        const start = pos;
        let end = -1;

        // Look for JPEG EOI marker: 0xFF 0xD9
        for (let i = start + 3; i < buffer.length - 1; i++) {
          if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) {
            end = i + 2;
            const size = end - start;
            // Only keep previews larger than 15KB (filters out tiny EXIF thumbnails)
            if (size > 15 * 1024) {
              jpegs.push({ start, end, size });
            }
            break;
          }
        }
        if (end !== -1) {
          pos = end;
          continue;
        }
      }
      pos++;
    }

    if (jpegs.length > 0) {
      // Return the largest extracted JPEG preview (highest resolution)
      jpegs.sort((a, b) => b.size - a.size);
      const largest = jpegs[0];
      return buffer.subarray(largest.start, largest.end);
    }
  } catch (err) {
    if (handle) {
      try { await handle.close(); } catch (_) {}
    }
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
