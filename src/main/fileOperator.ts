import fs from 'fs';
import path from 'path';
import {
  FilterConfig,
  FileEntry,
  FileMapEntry,
  RunLog,
  RunResult,
  ProgressUpdate,
} from '../shared/types';
import { scanAndPreview, normalizePathForCompare } from './fileScanner';
import { resolveDestPath } from './conflictResolver';
import { saveRunLog } from './store';
import { moveFileSafe } from './fsUtils';

export { moveFileSafe };

const activeRuns = new Map<string, { cancelled: boolean }>();

export function cancelRun(runId?: string): boolean {
  if (!runId) {
    activeRuns.forEach((state) => {
      state.cancelled = true;
    });
    return true;
  }
  const state = activeRuns.get(runId);
  if (state) {
    state.cancelled = true;
    return true;
  }
  return false;
}

export async function executeFilter(
  config: FilterConfig,
  filesToProcess?: FileEntry[],
  presetName?: string,
  onProgress?: (progress: ProgressUpdate) => void
): Promise<RunResult> {
  const rawSource = (config.sourceFolder || config.source_folder || '').trim();
  const rawDest = (config.destFolder || config.destination_folder || '').trim();

  if (!rawSource) {
    throw new Error('Chưa chọn thư mục nguồn.');
  }

  if (!rawDest) {
    throw new Error('Chưa chọn thư mục đích.');
  }

  const absSource = path.resolve(rawSource);
  if (!fs.existsSync(absSource)) {
    throw new Error(`Thư mục nguồn không tồn tại: ${absSource}`);
  }

  // If destination folder is relative (e.g. "đã lọc"), resolve it relative to source folder
  const absDest = path.isAbsolute(rawDest)
    ? path.resolve(rawDest)
    : path.resolve(absSource, rawDest);

  // Validation check: source and destination cannot be identical (case-insensitive on Windows)
  if (normalizePathForCompare(absSource) === normalizePathForCompare(absDest)) {
    throw new Error('Thư mục nguồn và thư mục đích không được trùng nhau.');
  }

  // Ensure destination folder exists
  if (!fs.existsSync(absDest)) {
    await fs.promises.mkdir(absDest, { recursive: true });
  }

  // Fallback: If no files were passed from renderer, run scanAndPreview directly in main process
  let targetFiles: FileEntry[] = filesToProcess || [];
  if (!targetFiles || targetFiles.length === 0) {
    const previewRes = await scanAndPreview({
      ...config,
      sourceFolder: absSource,
      source_folder: absSource,
      destFolder: absDest,
      destination_folder: absDest,
    });
    targetFiles = previewRes.matched_files || previewRes.files || [];
  }

  const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  activeRuns.set(runId, { cancelled: false });

  const totalMatched = targetFiles.length;
  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let wasCancelled = false;
  let lastProgressAt = 0;

  const fileMap: FileMapEntry[] = [];
  const errorList: { filename: string; reason: string }[] = [];

  for (let i = 0; i < targetFiles.length; i++) {
    const runState = activeRuns.get(runId);
    if (runState?.cancelled) {
      wasCancelled = true;
      if (onProgress) {
        onProgress({
          runId,
          processedCount: processedCount + skippedCount + errorCount,
          totalCount: totalMatched,
          currentFilename: 'Đã hủy tác vụ',
          status: 'cancelled',
        });
      }
      break;
    }

    const file = targetFiles[i];
    const fileName =
      file.filename || file.name || path.basename(file.sourcePath || file.path || '');

    // Resolve absolute source path of the file
    let srcPath = file.sourcePath || file.path || '';
    if (!srcPath || !path.isAbsolute(srcPath)) {
      srcPath = path.resolve(absSource, fileName);
    }

    const now = Date.now();
    const shouldReport =
      i === 0 || i === totalMatched - 1 || now - lastProgressAt >= 60;
    if (onProgress && shouldReport) {
      lastProgressAt = now;
      onProgress({
        runId,
        processedCount: i,
        totalCount: totalMatched,
        currentFilename: fileName,
        status: 'processing',
      });
    }

    // Determine target folder layout (subfolders if enabled)
    let targetDir = absDest;
    if (config.auto_subfolder === 'by_keyword' && file.matchedKeyword) {
      targetDir = path.join(absDest, sanitizeDirName(file.matchedKeyword));
    } else if (config.auto_subfolder === 'by_date' && file.dateTaken) {
      const datePart = file.dateTaken.split(' ')[0] || 'Unknown-Date';
      targetDir = path.join(absDest, sanitizeDirName(datePart));
    } else if (config.auto_subfolder === 'by_extension') {
      const extLabel =
        (file.extension || path.extname(fileName))
          .replace(/^\./, '')
          .toUpperCase() || 'OTHER';
      targetDir = path.join(absDest, sanitizeDirName(extLabel));
    }

    if (!fs.existsSync(targetDir)) {
      try {
        await fs.promises.mkdir(targetDir, { recursive: true });
      } catch (err: any) {
        errorCount++;
        const reason = `Không thể tạo thư mục con: ${err.message}`;
        errorList.push({ filename: fileName, reason });
        fileMap.push({
          source: srcPath,
          destination: '',
          filename: fileName,
          status: 'error',
          errorReason: reason,
        });
        continue;
      }
    }

    // Guard against copying/moving a file onto itself
    const directDest = path.join(targetDir, fileName);
    if (normalizePathForCompare(srcPath) === normalizePathForCompare(directDest)) {
      skippedCount++;
      fileMap.push({
        source: srcPath,
        destination: directDest,
        filename: fileName,
        status: 'skipped',
        errorReason: 'Tập tin nguồn và đích trùng vị trí',
      });
      continue;
    }

    const resolvedDestPath = resolveDestPath(
      targetDir,
      fileName,
      config.duplicate_policy || 'auto_rename',
      config.allow_overwrite || false
    );

    if (resolvedDestPath === null) {
      skippedCount++;
      fileMap.push({
        source: srcPath,
        destination: directDest,
        filename: fileName,
        status: 'skipped',
        errorReason: 'Tập tin trùng tên - Bỏ qua theo cấu hình',
      });
      continue;
    }

    try {
      if (config.mode === 'copy') {
        await fs.promises.copyFile(srcPath, resolvedDestPath);
      } else {
        await moveFileSafe(srcPath, resolvedDestPath);
      }

      processedCount++;
      fileMap.push({
        source: srcPath,
        destination: resolvedDestPath,
        filename: fileName,
        status: 'success',
      });
    } catch (err: any) {
      errorCount++;
      const reason = err?.message || 'Lỗi không xác định khi xử lý file';
      errorList.push({ filename: fileName, reason });
      fileMap.push({
        source: srcPath,
        destination: resolvedDestPath,
        filename: fileName,
        status: 'error',
        errorReason: reason,
      });
    }
  }

  activeRuns.delete(runId);

  // Save execution log to store when at least one file was attempted or processed
  if (fileMap.length > 0) {
    const runLog: RunLog = {
      run_id: runId,
      timestamp: new Date().toISOString(),
      source_folder: absSource,
      destination_folder: absDest,
      preset_name: presetName,
      mode: config.mode,
      duplicate_policy: config.duplicate_policy || 'auto_rename',
      total_matched: totalMatched,
      processed: processedCount,
      skipped_duplicate: skippedCount,
      errors: errorCount,
      undone: false,
      cancelled: wasCancelled,
      file_map: fileMap,
      schema_version: 1,
    };

    saveRunLog(runLog);
  }

  if (onProgress && !wasCancelled) {
    onProgress({
      runId,
      processedCount: processedCount + skippedCount + errorCount,
      totalCount: totalMatched,
      currentFilename: 'Hoàn tất',
      status: 'completed',
    });
  }

  return {
    run_id: runId,
    total_matched: totalMatched,
    processed: processedCount,
    skipped: skippedCount,
    errors: errorCount,
    cancelled: wasCancelled,
    destination_folder: absDest,
    file_map: fileMap,
    errorList,
  };
}

function sanitizeDirName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned || 'Khac';
}
