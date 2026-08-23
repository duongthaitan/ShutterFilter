import fs from 'fs';
import path from 'path';
import { FilterConfig, FileEntry, PreviewResult } from '../shared/types';
import { isMatch, findMatchedKeyword } from './filterEngine';
import { getPhotoDateTaken } from './exifReader';
import { isImageExtension } from '../shared/imageExtensions';

export async function detectExtensionsInFolder(
  sourceFolder: string
): Promise<{ ext: string; count: number; isRaw: boolean }[]> {
  if (!sourceFolder) return [];
  const absSource = path.resolve(sourceFolder);
  if (!fs.existsSync(absSource)) return [];

  const extMap: Record<string, number> = {};
  const rawExtsClean = ['arw', 'cr2', 'cr3', 'nef', 'dng', 'raf', 'orf', 'rw2'];

  async function scan(dir: string) {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          const extClean = path.extname(entry.name).toLowerCase().replace(/^\./, '');
          // Strictly accept photos only; ignore all video files
          if (extClean && isImageExtension(extClean)) {
            extMap[extClean] = (extMap[extClean] || 0) + 1;
          }
        }
      }
    } catch {}
  }

  await scan(absSource);

  return Object.keys(extMap).map((ext) => ({
    ext,
    count: extMap[ext],
    isRaw: rawExtsClean.includes(ext),
  }));
}

export async function scanAndPreview(config: FilterConfig): Promise<PreviewResult> {
  const rawSource = config.sourceFolder || config.source_folder || '';
  if (!rawSource) {
    throw new Error('Thư mục nguồn chưa được chọn.');
  }

  const absSource = path.resolve(rawSource);
  if (!fs.existsSync(absSource)) {
    throw new Error(`Thư mục nguồn không tồn tại: ${absSource}`);
  }

  const results: FileEntry[] = [];
  let totalSizeBytes = 0;

  async function scanDirectory(currentDir: string, relativeDir: string = '') {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.join(relativeDir, entry.name);

      if (entry.isDirectory()) {
        if (config.recursive) {
          await scanDirectory(fullPath, relPath);
        }
      } else if (entry.isFile()) {
        if (isMatch(entry.name, config)) {
          let stat: fs.Stats;
          try {
            stat = await fs.promises.stat(fullPath);
          } catch (err) {
            continue; // Skip inaccessible files during scan
          }

          const matchedKw = findMatchedKeyword(entry.name, config);
          const dateTaken = await getPhotoDateTaken(fullPath);
          const ext = path.extname(entry.name).toLowerCase();

          const fileEntry: FileEntry = {
            id: `${relPath}-${stat.mtimeMs}`,
            filename: entry.name,
            name: entry.name,
            relativePath: relPath,
            sourcePath: fullPath,
            path: fullPath,
            sizeBytes: stat.size,
            size: stat.size,
            extension: ext,
            dateTaken,
            mtime: stat.mtime.toISOString(),
            matchedKeyword: matchedKw,
            selected: true,
          };

          results.push(fileEntry);
          totalSizeBytes += stat.size;
        }
      }
    }
  }

  await scanDirectory(absSource);

  return {
    files: results,
    matched_files: results,
    totalCount: results.length,
    total_matched: results.length,
    totalSizeBytes,
    total_size: totalSizeBytes,
  };
}
