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
  try {
    // exifr.thumbnailUrl extracts the embedded JPEG preview from RAW files
    const thumbBuffer = await exifr.thumbnail(filePath);
    if (thumbBuffer && thumbBuffer.byteLength > 0) {
      const base64 = Buffer.from(thumbBuffer).toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    }
  } catch (err) {
    // File doesn't contain an embedded thumbnail, or exifr can't read it
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
