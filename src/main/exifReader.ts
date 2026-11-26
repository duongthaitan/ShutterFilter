import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import exifr from 'exifr';
import { toLocalFileUrl } from '../shared/imageExtensions';

const MAX_DATE_CACHE_SIZE = 20000;
const MAX_PREVIEW_CACHE_SIZE = 32;

const dateTakenCache = new Map<string, string | null>();
const rawPreviewCache = new Map<string, string>();
const createdTempFiles = new Set<string>();

export async function getPhotoDateTaken(
  filePath: string,
  fallbackMtime?: Date
): Promise<string | null> {
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
  } catch {
    // Suppress exifr errors for unsupported or non-image files, fallback to mtime
  }

  if (fallbackMtime && !isNaN(fallbackMtime.getTime())) {
    return formatDate(fallbackMtime);
  }

  try {
    const stat = await fs.promises.stat(filePath);
    return formatDate(stat.mtime);
  } catch {
    return null;
  }
}

export async function getPhotoDateTakenCached(
  filePath: string,
  stat: fs.Stats
): Promise<string | null> {
  const cacheKey = `${filePath}|${stat.mtimeMs}|${stat.size}`;
  if (dateTakenCache.has(cacheKey)) {
    return dateTakenCache.get(cacheKey) ?? null;
  }

  const dateStr = await getPhotoDateTaken(filePath, stat.mtime);

  if (dateTakenCache.size >= MAX_DATE_CACHE_SIZE) {
    const oldestKey = dateTakenCache.keys().next().value;
    if (oldestKey !== undefined) {
      dateTakenCache.delete(oldestKey);
    }
  }
  dateTakenCache.set(cacheKey, dateStr);
  return dateStr;
}

export async function extractRawThumbnail(filePath: string): Promise<string | null> {
  try {
    const stat = await fs.promises.stat(filePath);
    const cacheKey = `${filePath}|${stat.mtimeMs}|${stat.size}`;

    const cached = rawPreviewCache.get(cacheKey);
    if (cached) {
      // Refresh LRU position
      rawPreviewCache.delete(cacheKey);
      rawPreviewCache.set(cacheKey, cached);
      return cached;
    }

    const jpegBuffer = await extractEmbeddedJpegBinary(filePath, stat.size);
    if (jpegBuffer && jpegBuffer.length > 0) {
      let resultUrl: string;

      // If JPEG preview is <= 4MB, return base64 data URL for instant zero-disk rendering
      if (jpegBuffer.length <= 4 * 1024 * 1024) {
        const base64 = jpegBuffer.toString('base64');
        resultUrl = `data:image/jpeg;base64,${base64}`;
      } else {
        // If JPEG preview > 4MB (full resolution RAW preview), write uniquely hashed temp file
        const tempDir = os.tmpdir();
        const pathHash = crypto
          .createHash('sha1')
          .update(cacheKey)
          .digest('hex')
          .slice(0, 12);
        const safeName = path
          .basename(filePath, path.extname(filePath))
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .slice(0, 40);
        const tempPath = path.join(tempDir, `shutterfilter_raw_${safeName}_${pathHash}.jpg`);
        await fs.promises.writeFile(tempPath, jpegBuffer);
        createdTempFiles.add(tempPath);
        resultUrl = toLocalFileUrl(tempPath);
      }

      if (rawPreviewCache.size >= MAX_PREVIEW_CACHE_SIZE) {
        const oldestKey = rawPreviewCache.keys().next().value;
        if (oldestKey !== undefined) {
          rawPreviewCache.delete(oldestKey);
        }
      }
      rawPreviewCache.set(cacheKey, resultUrl);
      return resultUrl;
    }
  } catch (err) {
    console.error('RAW extraction error:', err);
  }

  return null;
}

export function cleanupTempPreviews(): void {
  for (const tempPath of createdTempFiles) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors on exit
    }
  }
  createdTempFiles.clear();
  rawPreviewCache.clear();
}

/**
 * Scans binary data of any camera RAW file (.CR2, .CR3, .ARW, .NEF, .DNG, .RAF, .ORF, .PEF, .RW2, ...)
 * parses JPEG segment structures and returns the highest resolution preview JPEG found.
 */
async function extractEmbeddedJpegBinary(
  filePath: string,
  fileSize?: number
): Promise<Buffer | null> {
  try {
    const size = fileSize ?? (await fs.promises.stat(filePath)).size;
    if (size < 32 * 1024) return null; // Too small to contain a meaningful RAW preview

    const buffer = await fs.promises.readFile(filePath);
    const jpegs: { pos: number; len: number; area: number }[] = [];
    let pos = 0;

    while (pos < buffer.length - 4) {
      // Look for JPEG SOI marker followed by a valid marker prefix: 0xFF 0xD8 0xFF
      if (buffer[pos] === 0xff && buffer[pos + 1] === 0xd8 && buffer[pos + 2] === 0xff) {
        const len = parseJpegLength(buffer, pos);
        if (len && len > 10 * 1024) {
          const sub = buffer.subarray(pos, pos + len);
          const dim = getJpegDimensions(sub);
          // Only keep previews with dimension >= 400px (ignores 160x120 EXIF thumbnails)
          if (dim.w >= 400 || dim.h >= 400) {
            jpegs.push({ pos, len, area: dim.w * dim.h });
          }
          pos += len;
          continue;
        }
      }
      pos++;
    }

    if (jpegs.length > 0) {
      // Sort by pixel area descending, then by byte length descending
      jpegs.sort((a, b) => b.area - a.area || b.len - a.len);
      const best = jpegs[0];
      return buffer.subarray(best.pos, best.pos + best.len);
    }
  } catch {
    // Gracefully return null on unreadable files
  }
  return null;
}

/**
 * Extracts width and height by walking JPEG segment headers properly.
 * Prevents false matches inside EXIF metadata or compressed entropy data.
 */
export function getJpegDimensions(buf: Buffer): { w: number; h: number } {
  if (buf.length < 12 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return { w: 0, h: 0 };
  }

  let offset = 2;
  while (offset < buf.length - 4) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }

    while (offset < buf.length - 1 && buf[offset + 1] === 0xff) {
      offset++;
    }
    if (offset + 1 >= buf.length) break;

    const marker = buf[offset + 1];

    // Stop at SOS (start of image scan) or EOI
    if (marker === 0xda || marker === 0xd9) {
      break;
    }

    // Standalone markers without length
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    if (offset + 4 > buf.length) break;
    const segLen = buf.readUInt16BE(offset + 2);
    if (segLen < 2) break;

    // SOF0 (Baseline), SOF1 (Extended Sequential), SOF2 (Progressive), SOF3 (Lossless)
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3) {
      if (offset + 9 <= buf.length) {
        const h = buf.readUInt16BE(offset + 5);
        const w = buf.readUInt16BE(offset + 7);
        return { w, h };
      }
      break;
    }

    offset += 2 + segLen;
  }

  return { w: 0, h: 0 };
}

/**
 * Parses a JPEG stream starting from offset using ISO/IEC 10918-1 JPEG segment structure.
 * Properly handles baseline and multi-scan progressive JPEGs.
 * Returns the exact byte length of the JPEG stream, or null if invalid.
 */
export function parseJpegLength(buffer: Buffer, startOffset: number): number | null {
  if (startOffset + 4 > buffer.length) return null;
  if (buffer[startOffset] !== 0xff || buffer[startOffset + 1] !== 0xd8) return null;

  let offset = startOffset + 2;

  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) {
      return null;
    }

    while (offset < buffer.length - 1 && buffer[offset + 1] === 0xff) {
      offset++;
    }
    if (offset + 1 >= buffer.length) return null;

    const marker = buffer[offset + 1];

    // EOI (End of Image)
    if (marker === 0xd9) {
      return offset + 2 - startOffset;
    }

    // Standalone markers: SOI (D8), TEM (01), RST0-RST7 (D0-D7)
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    // SOS (Start of Scan) - Entropy coded image data follows header
    if (marker === 0xda) {
      if (offset + 4 > buffer.length) return null;
      const headerLen = buffer.readUInt16BE(offset + 2);
      if (headerLen < 2) return null;
      offset += 2 + headerLen;

      let foundNextMarker = false;
      while (offset < buffer.length - 1) {
        if (buffer[offset] === 0xff) {
          let nextIdx = offset + 1;
          while (nextIdx < buffer.length && buffer[nextIdx] === 0xff) {
            nextIdx++;
          }
          if (nextIdx >= buffer.length) return null;

          const next = buffer[nextIdx];
          if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
            // Byte-stuffed 0xFF00 or restart marker inside entropy stream
            offset = nextIdx + 1;
            continue;
          }
          if (next === 0xd9) {
            return nextIdx + 1 - startOffset;
          }
          // Another segment marker (e.g. DHT/SOS in progressive JPEG): resume outer segment loop
          offset = nextIdx - 1;
          foundNextMarker = true;
          break;
        }
        offset++;
      }

      if (!foundNextMarker) {
        return null;
      }
      continue;
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
