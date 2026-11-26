import path from 'path';
import { FilterConfig, MatchType } from '../shared/types';
import { isImageExtension, normalizeExtension } from '../shared/imageExtensions';

export function splitFilename(filename: string): { name: string; ext: string } {
  const base = path.basename(filename);
  const rawExt = path.extname(base);
  const name = rawExt ? base.slice(0, -rawExt.length) : base;
  return { name, ext: rawExt.toLowerCase() };
}

export function normalizeKeywords(keywords?: string[]): string[] {
  if (!keywords || keywords.length === 0) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of keywords) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}

export function doesKeywordMatchFile(
  filename: string,
  keyword: string,
  matchType: MatchType = 'contains'
): boolean {
  const { name } = splitFilename(filename);
  const filenameLower = filename.toLowerCase();
  const nameLower = name.toLowerCase();
  const kwLower = keyword.trim().toLowerCase();
  if (!kwLower) return false;

  switch (matchType) {
    case 'starts_with':
    case 'prefix':
      return nameLower.startsWith(kwLower);
    case 'exact':
      return nameLower === kwLower || filenameLower === kwLower;
    case 'contains':
    default:
      return filenameLower.includes(kwLower) || nameLower === kwLower;
  }
}

export function isMatch(filename: string, config: FilterConfig): boolean {
  const { ext } = splitFilename(filename);

  // Strict Photo Constraint: Reject videos and non-image files
  if (!isImageExtension(ext)) {
    return false;
  }

  // Include keywords check (line-by-line photo names or keywords)
  const includeKws = normalizeKeywords(config.keywords_include);

  // If user has not typed/pasted any photo names, no photos match (0 matched)
  if (includeKws.length === 0) {
    return false;
  }

  const matchType = config.match_type || 'contains';
  const includeMatch = includeKws.some((kw) =>
    doesKeywordMatchFile(filename, kw, matchType)
  );

  if (!includeMatch) {
    return false;
  }

  // Extension check:
  // If user has explicitly checked specific extension buttons (e.g. ['.jpg']), only allow those extensions.
  // If user has NOT checked any extension (extensions is []), accept ALL valid photo extensions for the matched filenames.
  if (config.extensions && config.extensions.length > 0) {
    const extClean = normalizeExtension(ext);
    const normalizedExts = config.extensions.map((e) => normalizeExtension(e));
    if (!normalizedExts.includes(extClean)) {
      return false;
    }
  }

  // Exclude keywords check
  const excludeKws = normalizeKeywords(config.keywords_exclude);
  if (excludeKws.length > 0) {
    const filenameLower = filename.toLowerCase();
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
  const includeKws = normalizeKeywords(config.keywords_include);
  if (includeKws.length === 0) return undefined;

  const matchType = config.match_type || 'contains';
  return includeKws.find((kw) => doesKeywordMatchFile(filename, kw, matchType));
}
