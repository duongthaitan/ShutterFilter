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
import { scanAndPreview } from './fileScanner';
import { resolveDestPath } from './conflictResolver';
import { saveRunLog } from './store';

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
  const rawSource = config.sourceFolder || config.source_folder || '';
  const rawDest = config.destFolder || config.destination_folder || '';

  if (!rawSource) {
    throw new Error('Chưa chọn thư mục nguồn!');
  }

  const absSource = path.resolve(rawSource);
  let absDest = path.resolve(rawDest);

  // If destination folder is relative (e.g. "đã lọc"), resolve it relative to source folder (e.g. "D:\JPG\đã lọc")
  if (!path.isAbsolute(rawDest) && absSource) {
    absDest = path.resolve(absSource, rawDest);
  }

  // Validation check: source and destination cannot be identical
  if (absSource === absDest) {
    throw new Error('Thư mục nguồn và thư mục đích không được trùng nhau!');
  }

  // Ensure destination folder exists
  if (!fs.existsSync(absDest)) {
    await fs.promises.mkdir(absDest, { recursive: true });
  }

  // Fallback: If no files were passed from renderer, run scanAndPreview directly in main process!
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

  const fileMap: FileMapEntry[] = [];
  const errorList: { filename: string; reason: string }[] = [];

  for (let i = 0; i < targetFiles.length; i++) {
    const runState = activeRuns.get(runId);
    if (runState?.cancelled) {
      if (onProgress) {
        onProgress({
          runId,
          processedCount,
          totalCount: totalMatched,
          currentFilename: 'Đã hủy tác vụ',
          status: 'cancelled',
        });
      }
      break;
    }

    const file = targetFiles[i];
    const fileName = file.filename || file.name || path.basename(file.sourcePath || file.path || '');
    
    // Resolve absolute source path of the file
    let srcPath = file.sourcePath || file.path || '';
    if (!srcPath || !path.isAbsolute(srcPath)) {
      srcPath = path.resolve(absSource, fileName);
    }

    const shouldReport = i === 0 || i === totalMatched - 1 || i % 25 === 0;
    if (onProgress && shouldReport) {
      onProgress({
        runId,
        processedCount: i + 1,
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
    }

    if (!fs.existsSync(targetDir)) {
      try {
        await fs.promises.mkdir(targetDir, { recursive: true });
      } catch (err: any) {
        errorCount++;
        errorList.push({ filename: fileName, reason: `Không thể tạo thư mục subfolder: ${err.message}` });
        fileMap.push({
          source: srcPath,
          destination: '',
          filename: fileName,
          status: 'error',
          errorReason: `Không thể tạo subfolder: ${err.message}`,
        });
        continue;
      }
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
        destination: path.join(targetDir, fileName),
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
        // Move mode
        await fs.promises.rename(srcPath, resolvedDestPath);
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
      errorList.push({
        filename: fileName,
        reason: err.message || 'Lỗi không xác định khi xử lý file',
      });
      fileMap.push({
        source: srcPath,
        destination: resolvedDestPath,
        filename: fileName,
        status: 'error',
        errorReason: err.message,
      });
    }
  }

  activeRuns.delete(runId);

  // Save execution log to store
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
    file_map: fileMap,
    schema_version: 1,
  };

  saveRunLog(runLog);

  if (onProgress) {
    onProgress({
      runId,
      processedCount,
      totalCount: totalMatched,
      currentFilename: 'Hoàn tất!',
      status: 'completed',
    });
  }

  return {
    run_id: runId,
    total_matched: totalMatched,
    processed: processedCount,
    skipped: skippedCount,
    errors: errorCount,
    file_map: fileMap,
    errorList,
  };
}

function sanitizeDirName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}
