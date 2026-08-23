export const PHOTO_IMAGE_EXTENSIONS = new Set([
  // Standard photo formats
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
  // Camera RAW photo formats
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

export function isImageExtension(ext: string): boolean {
  if (!ext) return false;
  const cleanExt = ext.toLowerCase().replace(/^\./, '');
  if (VIDEO_EXTENSIONS.has(cleanExt)) return false;
  return PHOTO_IMAGE_EXTENSIONS.has(cleanExt);
}

export function isVideoExtension(ext: string): boolean {
  if (!ext) return false;
  const cleanExt = ext.toLowerCase().replace(/^\./, '');
  return VIDEO_EXTENSIONS.has(cleanExt);
}
