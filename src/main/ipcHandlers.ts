import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import { exec } from 'child_process';
import { FilterConfig, FileEntry, Preset } from '../shared/types';
import { scanAndPreview } from './fileScanner';
import { executeFilter, cancelRun } from './fileOperator';
import {
  listPresets,
  savePreset,
  deletePreset,
  listHistory,
  getHistoryEntry,
  undoRun,
} from './store';

export function setupIpcHandlers() {
  // Select Folder Dialog
  ipcMain.handle('dialog:selectFolder', async (event, defaultPath?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = {
      properties: ['openDirectory' as const],
      defaultPath,
    };
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Filter Preview
  ipcMain.handle('filter:preview', async (_, config: FilterConfig) => {
    return await scanAndPreview(config);
  });

  // Folder extension detection
  ipcMain.handle('folder:detectExtensions', async (_, folderPath: string) => {
    const { detectExtensionsInFolder } = await import('./fileScanner');
    return await detectExtensionsInFolder(folderPath);
  });

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
      console.log('[IPC filter:run] Received execution request');
      console.log('[IPC filter:run] config.sourceFolder:', payload.config.sourceFolder);
      console.log('[IPC filter:run] config.destFolder:', payload.config.destFolder);
      console.log('[IPC filter:run] filesToProcess count:', payload.filesToProcess?.length ?? 0);
      return await executeFilter(
        payload.config,
        payload.filesToProcess,
        payload.presetName,
        (progress) => {
          event.sender.send('filter:progress', progress);
        }
      );
    }
  );

  // Filter Cancel
  ipcMain.handle('filter:cancel', async (_, runId: string) => {
    return cancelRun(runId);
  });

  // Open Folder Handler
  ipcMain.handle('shell:openFolder', async (_, folderPath: string) => {
    if (folderPath) {
      await shell.openPath(folderPath);
      return true;
    }
    return false;
  });

  // Import to Photoshop Handler
  ipcMain.handle(
    'shell:openPhotoshop',
    async (_, payload: { folderPath: string; filePaths?: string[] }) => {
      try {
        const { folderPath, filePaths } = payload || {};
        if (filePaths && filePaths.length > 0) {
          // Open target image files in Photoshop
          for (const fp of filePaths.slice(0, 10)) {
            const quoted = `"${fp.replace(/"/g, '\\"')}"`;
            exec(`start "" photoshop ${quoted}`, (err) => {
              if (err) {
                shell.openPath(fp);
              }
            });
          }
          return true;
        }
        if (folderPath) {
          await shell.openPath(folderPath);
          return true;
        }
      } catch (err) {
        console.error('Photoshop launch error:', err);
        if (payload?.folderPath) {
          await shell.openPath(payload.folderPath);
        }
      }
      return false;
    }
  );

  // Preset Handlers
  ipcMain.handle('preset:list', async () => {
    return listPresets();
  });

  ipcMain.handle(
    'preset:save',
    async (
      _,
      preset: Omit<Preset, 'id' | 'created_at' | 'schema_version'> & { id?: string }
    ) => {
      return savePreset(preset);
    }
  );

  ipcMain.handle('preset:delete', async (_, id: string) => {
    return deletePreset(id);
  });

  // History Handlers
  ipcMain.handle('history:list', async () => {
    return listHistory();
  });

  ipcMain.handle('history:get', async (_, runId: string) => {
    return getHistoryEntry(runId);
  });

  ipcMain.handle('history:undo', async (_, runId: string) => {
    return await undoRun(runId);
  });

  // RAW thumbnail extraction
  ipcMain.handle('file:rawThumbnail', async (_, filePath: string) => {
    const { extractRawThumbnail } = await import('./exifReader');
    return await extractRawThumbnail(filePath);
  });
}
