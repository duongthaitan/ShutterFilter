import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  FilterConfig,
  FileEntry,
  Preset,
  SelectFolderOptions,
  OpenPhotoshopResult,
} from '../shared/types';
import { scanAndPreview, detectExtensionsInFolder } from './fileScanner';
import { executeFilter, cancelRun } from './fileOperator';
import { extractRawThumbnail } from './exifReader';
import {
  listPresets,
  savePreset,
  deletePreset,
  listHistory,
  getHistoryEntry,
  undoRun,
  deleteHistoryEntry,
} from './store';

let handlersRegistered = false;

function findWindowsPhotoshopExe(): string | null {
  const roots = [
    process.env.ProgramFiles || 'C:\\Program Files',
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  ];

  const candidates: string[] = [];
  for (const root of roots) {
    const adobeDir = path.join(root, 'Adobe');
    if (!fs.existsSync(adobeDir)) continue;
    try {
      const dirs = fs.readdirSync(adobeDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory() && /^Adobe Photoshop/i.test(d.name)) {
          const exePath = path.join(adobeDir, d.name, 'Photoshop.exe');
          if (fs.existsSync(exePath)) {
            candidates.push(exePath);
          }
        }
      }
    } catch {
      // Ignore permission errors scanning Adobe dir
    }
  }

  if (candidates.length === 0) return null;
  // Sort descending so newest year (e.g. Adobe Photoshop 2026) is chosen first
  candidates.sort((a, b) => b.localeCompare(a));
  return candidates[0];
}

export function setupIpcHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  // Select Folder Dialog
  ipcMain.handle(
    'dialog:selectFolder',
    async (event, rawOptions?: SelectFolderOptions) => {
      const window = BrowserWindow.fromWebContents(event.sender);

      let defaultPath: string | undefined;
      let title: string | undefined;

      if (typeof rawOptions === 'string') {
        if (fs.existsSync(rawOptions)) {
          defaultPath = rawOptions;
        } else {
          title = rawOptions;
        }
      } else if (rawOptions && typeof rawOptions === 'object') {
        if (rawOptions.defaultPath && fs.existsSync(rawOptions.defaultPath)) {
          defaultPath = rawOptions.defaultPath;
        }
        title = rawOptions.title;
      }

      const options: Electron.OpenDialogOptions = {
        properties: ['openDirectory'],
        ...(defaultPath ? { defaultPath } : {}),
        ...(title ? { title } : {}),
      };

      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options);

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    }
  );

  // Filter Preview
  ipcMain.handle('filter:preview', async (_, config: FilterConfig) => {
    return await scanAndPreview(config);
  });

  // Folder extension detection
  ipcMain.handle(
    'folder:detectExtensions',
    async (
      _,
      payload:
        | string
        | { folderPath: string; recursive?: boolean; excludeFolder?: string }
    ) => {
      if (typeof payload === 'string') {
        return await detectExtensionsInFolder(payload, true);
      }
      return await detectExtensionsInFolder(
        payload.folderPath,
        payload.recursive ?? true,
        payload.excludeFolder
      );
    }
  );

  // Filter Execution
  ipcMain.handle(
    'filter:run',
    async (
      event,
      payload: {
        config: FilterConfig;
        filesToProcess: FileEntry[];
        presetName?: string;
      }
    ) => {
      return await executeFilter(
        payload.config,
        payload.filesToProcess,
        payload.presetName,
        (progress) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('filter:progress', progress);
          }
        }
      );
    }
  );

  // Filter Cancel
  ipcMain.handle('filter:cancel', async (_, runId?: string) => {
    return cancelRun(runId);
  });

  // Open Folder Handler
  ipcMain.handle('shell:openFolder', async (_, folderPath: string) => {
    if (!folderPath) return false;
    const err = await shell.openPath(folderPath);
    return err === '';
  });

  // Reveal single file in OS file manager (Explorer / Finder)
  ipcMain.handle('shell:revealInFolder', async (_, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) return false;
    shell.showItemInFolder(filePath);
    return true;
  });

  // Import to Photoshop Handler (safe spawn, no shell injection)
  ipcMain.handle(
    'shell:openPhotoshop',
    async (
      _,
      payload: { folderPath: string; filePaths?: string[] }
    ): Promise<OpenPhotoshopResult> => {
      const { folderPath, filePaths } = payload || {};
      const validFiles = (filePaths || [])
        .filter((fp) => fp && fs.existsSync(fp))
        .slice(0, 15);

      try {
        if (validFiles.length > 0) {
          if (process.platform === 'win32') {
            const psExe = findWindowsPhotoshopExe();
            if (psExe) {
              const child = spawn(psExe, validFiles, {
                detached: true,
                stdio: 'ignore',
              });
              child.unref();
              return {
                success: true,
                message: `Đang mở ${validFiles.length} ảnh trong Adobe Photoshop.`,
              };
            }
          } else if (process.platform === 'darwin') {
            const child = spawn('open', ['-a', 'Adobe Photoshop', ...validFiles], {
              detached: true,
              stdio: 'ignore',
            });
            child.unref();
            return {
              success: true,
              message: `Đang mở ${validFiles.length} ảnh trong Adobe Photoshop.`,
            };
          }
        }

        // Fallback: open destination folder if Photoshop executable wasn't found
        if (folderPath && fs.existsSync(folderPath)) {
          await shell.openPath(folderPath);
          return {
            success: true,
            fallback: true,
            message:
              'Không tìm thấy Adobe Photoshop trên máy. Đã mở thư mục chứa ảnh đã lọc.',
          };
        }
      } catch (err: any) {
        if (folderPath && fs.existsSync(folderPath)) {
          await shell.openPath(folderPath);
        }
        return {
          success: false,
          fallback: true,
          message: err?.message || 'Không thể khởi chạy Adobe Photoshop.',
        };
      }

      return {
        success: false,
        message: 'Không tìm thấy ảnh hoặc thư mục đích để mở.',
      };
    }
  );

  // Preset Handlers
  ipcMain.handle('preset:list', async () => listPresets());

  ipcMain.handle(
    'preset:save',
    async (
      _,
      preset: Omit<Preset, 'id' | 'created_at' | 'schema_version'> & { id?: string }
    ) => savePreset(preset)
  );

  ipcMain.handle('preset:delete', async (_, id: string) => deletePreset(id));

  // History Handlers
  ipcMain.handle('history:list', async () => listHistory());

  ipcMain.handle('history:get', async (_, runId: string) => getHistoryEntry(runId));

  ipcMain.handle('history:undo', async (_, runId: string) => await undoRun(runId));

  ipcMain.handle('history:delete', async (_, runId: string) =>
    deleteHistoryEntry(runId)
  );

  // RAW thumbnail extraction
  ipcMain.handle('file:rawThumbnail', async (_, filePath: string) => {
    return await extractRawThumbnail(filePath);
  });
}
