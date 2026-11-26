import fs from 'fs';
import path from 'path';
import {
  FilterConfig,
  FileEntry,
  PreviewResult,
  DetectedExtension,
} from '../shared/types';
import {
  isMatch,
  findMatchedKeyword,
  normalizeKeywords,
  doesKeywordMatchFile,
} from './filterEngine';
import { getPhotoDateTakenCached } from './exifReader';
import {
  isImageExtension,
  isRawExtension,
  normalizeExtension,
} from '../shared/imageExtensions';

const STAT_CONCURRENCY = 16;

export function normalizePathForCompare(targetPath: string): string {
  const resolved = path.resolve(targetPath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function isSameOrSubdirectory(candidateDir: string, rootDir: string): boolean {
  const normCandidate = normalizePathForCompare(candidateDir);
  const normRoot = normalizePathForCompare(rootDir);
  if (normCandidate === normRoot) return true;
  const prefix = normRoot.endsWith(path.sep) ? normRoot : `${normRoot}${path.sep}`;
  return normCandidate.startsWith(prefix);
}

function resolveExcludedDestDir(rawSource: string, rawDest?: string): string | null {
  if (!rawDest || !rawDest.trim()) return null;
  const absSource = path.resolve(rawSource);
  const absDest = path.isAbsolute(rawDest)
    ? path.resolve(rawDest)
    : path.resolve(absSource, rawDest);

  // Only exclude if destination is strictly inside source folder
  if (
    normalizePathForCompare(absDest) !== normalizePathForCompare(absSource) &&
    isSameOrSubdirectory(absDest, absSource)
  ) {
    return normalizePathForCompare(absDest);
  }
  return null;
}

export async function detectExtensionsInFolder(
  sourceFolder: string,
  recursive: boolean = true,
  excludeFolder?: string
): Promise<DetectedExtension[]> {
  if (!sourceFolder || !sourceFolder.trim()) return [];
  const absSource = path.resolve(sourceFolder);
  if (!fs.existsSync(absSource)) return [];

  const excludedDir = resolveExcludedDestDir(absSource, excludeFolder);
  const extMap: Record<string, number> = {};

  async function scan(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!recursive) continue;
        if (excludedDir && normalizePathForCompare(fullPath) === excludedDir) {
          continue;
        }
        await scan(fullPath);
      } else if (entry.isFile()) {
        const extClean = normalizeExtension(path.extname(entry.name));
        if (extClean && isImageExtension(extClean)) {
          extMap[extClean] = (extMap[extClean] || 0) + 1;
        }
      }
    }
  }

  await scan(absSource);

  return Object.keys(extMap)
    .map((ext) => ({
      ext,
      count: extMap[ext],
      isRaw: isRawExtension(ext),
    }))
    .sort((a, b) => b.count - a.count || a.ext.localeCompare(b.ext));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R | null>
): Promise<R[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx]);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, Math.max(1, items.length)) },
    () => runWorker()
  );
  await Promise.all(workers);

  return results.filter((item): item is R => item !== null);
}

export async function scanAndPreview(config: FilterConfig): Promise<PreviewResult> {
  const scanStart = Date.now();
  const rawSource = (config.sourceFolder || config.source_folder || '').trim();
  if (!rawSource) {
    throw new Error('Thư mục nguồn chưa được chọn.');
  }

  const absSource = path.resolve(rawSource);
  if (!fs.existsSync(absSource)) {
    throw new Error(`Thư mục nguồn không tồn tại: ${absSource}`);
  }

  const statSource = await fs.promises.stat(absSource);
  if (!statSource.isDirectory()) {
    throw new Error(`Đường dẫn nguồn không phải là thư mục: ${absSource}`);
  }

  const rawDest = (config.destFolder || config.destination_folder || '').trim();
  const excludedDir = resolveExcludedDestDir(absSource, rawDest);

  const includeKws = normalizeKeywords(config.keywords_include);
  const matchType = config.match_type || 'contains';
  const matchedKeywordsLower = new Set<string>();

  const matchedCandidates: {
    filename: string;
    fullPath: string;
    relPath: string;
  }[] = [];

  let totalFolderImages = 0;

  async function scanDirectory(currentDir: string, relativeDir: string = '') {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      return; // Skip unreadable/protected subdirectories gracefully
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.join(relativeDir, entry.name);

      if (entry.isDirectory()) {
        if (!config.recursive) continue;
        if (excludedDir && normalizePathForCompare(fullPath) === excludedDir) {
          continue;
        }
        await scanDirectory(fullPath, relPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!isImageExtension(ext)) continue;

        totalFolderImages++;

        if (isMatch(entry.name, config)) {
          matchedCandidates.push({
            filename: entry.name,
            fullPath,
            relPath,
          });

          // Mark every include keyword that matched this file
          for (const kw of includeKws) {
            const kwKey = kw.toLowerCase();
            if (!matchedKeywordsLower.has(kwKey)) {
              if (doesKeywordMatchFile(entry.name, kw, matchType)) {
                matchedKeywordsLower.add(kwKey);
              }
            }
          }
        }
      }
    }
  }

  await scanDirectory(absSource);

  const results = await mapWithConcurrency(
    matchedCandidates,
    STAT_CONCURRENCY,
    async (candidate): Promise<FileEntry | null> => {
      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(candidate.fullPath);
      } catch {
        return null;
      }

      const matchedKw = findMatchedKeyword(candidate.filename, config);
      const dateTaken = await getPhotoDateTakenCached(candidate.fullPath, stat);
      const ext = path.extname(candidate.filename).toLowerCase();

      return {
        id: `${candidate.relPath}-${stat.mtimeMs}`,
        filename: candidate.filename,
        name: candidate.filename,
        relativePath: candidate.relPath,
        sourcePath: candidate.fullPath,
        path: candidate.fullPath,
        sizeBytes: stat.size,
        size: stat.size,
        extension: ext,
        dateTaken,
        mtime: stat.mtime.toISOString(),
        matchedKeyword: matchedKw,
        selected: true,
      };
    }
  );

  const totalSizeBytes = results.reduce((sum, f) => sum + f.sizeBytes, 0);
  const unmatchedKeywords = includeKws.filter(
    (kw) => !matchedKeywordsLower.has(kw.toLowerCase())
  );

  return {
    files: results,
    matched_files: results,
    totalCount: results.length,
    total_matched: results.length,
    totalSizeBytes,
    total_size: totalSizeBytes,
    scan_duration_ms: Date.now() - scanStart,
    unmatchedKeywords,
    totalFolderImages,
  };
}
