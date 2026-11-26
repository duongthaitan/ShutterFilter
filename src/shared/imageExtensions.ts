export const STANDARD_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'tif',
  'tiff',
  'bmp',
  'gif',
  'psd',
]);

export const RAW_IMAGE_EXTENSIONS = new Set([
  'arw',
  'cr2',
  'cr3',
  'nef',
  'dng',
  'raf',
  'orf',
  'rw2',
  'pef',
  'srw',
  'x3f',
  'erf',
  'mrw',
]);

export const PHOTO_IMAGE_EXTENSIONS = new Set([
  ...STANDARD_IMAGE_EXTENSIONS,
  ...RAW_IMAGE_EXTENSIONS,
]);

export const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'mov',
  'avi',
  'mkv',
  'flv',
  'wmv',
  'webm',
  'm4v',
  '3gp',
  'mpeg',
  'mpg',
  'm2ts',
  'mts',
  'vob',
  'ogv',
  'ts',
  'rm',
  'rmvb',
  'asf',
  'divx',
  'mp2',
  'mpv',
  'mod',
]);

export function normalizeExtension(ext: string): string {
  if (!ext) return '';
  return ext.trim().toLowerCase().replace(/^\./, '');
}

export function isImageExtension(ext: string): boolean {
  const cleanExt = normalizeExtension(ext);
  if (!cleanExt || VIDEO_EXTENSIONS.has(cleanExt)) return false;
  return PHOTO_IMAGE_EXTENSIONS.has(cleanExt);
}

export function isRawExtension(ext: string): boolean {
  const cleanExt = normalizeExtension(ext);
  return cleanExt.length > 0 && RAW_IMAGE_EXTENSIONS.has(cleanExt);
}

export function isVideoExtension(ext: string): boolean {
  const cleanExt = normalizeExtension(ext);
  return cleanExt.length > 0 && VIDEO_EXTENSIONS.has(cleanExt);
}

/**
 * Safely converts an OS file path into a properly encoded file:// URL.
 * Handles Windows drive letters, UNC paths, spaces, Unicode, #, %, ?, and +.
 */
export function toLocalFileUrl(filePath: string): string {
  if (!filePath) return '';
  if (/^(file|blob|data|https?):/i.test(filePath)) {
    return filePath;
  }

  const normalized = filePath.replace(/\\/g, '/');

  // Windows UNC path: //server/share/file.jpg -> file://server/share/file.jpg
  if (normalized.startsWith('//')) {
    const parts = normalized
      .slice(2)
      .split('/')
      .map((seg, idx) => (idx === 0 ? seg : encodeURIComponent(seg)));
    return `file://${parts.join('/')}`;
  }

  const encoded = normalized
    .split('/')
    .map((seg, idx) => {
      if (idx === 0 && /^[A-Za-z]:$/.test(seg)) return seg;
      return encodeURIComponent(seg);
    })
    .join('/');

  return encoded.startsWith('/') ? `file://${encoded}` : `file:///${encoded}`;
}
