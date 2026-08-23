import path from 'path';
import { FilterConfig } from '../shared/types';
import { isImageExtension } from '../shared/imageExtensions';

export function splitFilename(filename: string): { name: string; ext: string } {
  const ext = path.extname(filename).toLowerCase();
  const name = path.basename(filename, ext);
  return { name, ext };
}

export function isMatch(filename: string, config: FilterConfig): boolean {
  const { name, ext } = splitFilename(filename);

  // Strict Photo Constraint: Reject videos and non-image files
  if (!isImageExtension(ext)) {
    return false;
  }

  // Include keywords check (line-by-line photo names or keywords)
  const includeKws = (config.keywords_include || [])
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  // If user has not typed/pasted any photo names, no photos match (0 matched)
  if (includeKws.length === 0) {
    return false;
  }

  const filenameLower = filename.toLowerCase();
  const nameLower = name.toLowerCase();

  const includeMatch = includeKws.some((kw) => {
    const kwLower = kw.toLowerCase();
    if (config.match_type === 'starts_with') {
      return nameLower.startsWith(kwLower);
    }
    return filenameLower.includes(kwLower) || nameLower === kwLower;
  });

  if (!includeMatch) {
    return false;
  }

  // Extension check:
  // If user has explicitly checked specific extension buttons (e.g. ['.jpg']), only allow those extensions.
  // If user has NOT checked any extension (extensions is []), accept ALL valid photo extensions for the matched filenames!
  if (config.extensions && config.extensions.length > 0) {
    const normalizedExts = config.extensions.map((e) =>
      e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`
    );
    if (!normalizedExts.includes(ext)) {
      return false;
    }
  }

  // Exclude keywords check
  const excludeKws = (config.keywords_exclude || [])
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (excludeKws.length > 0) {
    const hasExcludedKw = excludeKws.some((kw) =>
      filenameLower.includes(kw.toLowerCase())
    );
    if (hasExcludedKw) {
      return false;
    }
  }

  return true;
}

export function findMatchedKeyword(
  filename: string,
  config: FilterConfig
): string | undefined {
  const includeKws = (config.keywords_include || [])
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (includeKws.length === 0) return undefined;

  const filenameLower = filename.toLowerCase();
  const nameLower = splitFilename(filename).name.toLowerCase();

  return includeKws.find((kw) => {
    const kwLower = kw.toLowerCase();
    if (config.match_type === 'starts_with') {
      return nameLower.startsWith(kwLower);
    }
    return filenameLower.includes(kwLower) || nameLower === kwLower;
  });
}
