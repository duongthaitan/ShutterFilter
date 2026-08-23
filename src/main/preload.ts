import { contextBridge, ipcRenderer } from 'electron';
import {
  FilterConfig,
  FileEntry,
  Preset,
  ProgressUpdate,
  RunResult,
  RunLog,
  UndoResult,
  PreviewResult,
} from '../shared/types';

export const electronAPI = {
  selectFolder: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:selectFolder', defaultPath),

  previewFilter: (config: FilterConfig): Promise<PreviewResult> =>
    ipcRenderer.invoke('filter:preview', config),

  detectExtensions: (folderPath: string): Promise<any[]> =>
    ipcRenderer.invoke('folder:detectExtensions', folderPath),

  executeFilter: (config: FilterConfig, filesToProcess?: FileEntry[]): Promise<RunResult> =>
    ipcRenderer.invoke('filter:run', { config, filesToProcess: filesToProcess || [] }),

  cancelRun: (runId?: string): Promise<boolean> =>
    ipcRenderer.invoke('filter:cancel', runId),

  openFolder: (folderPath: string): Promise<boolean> =>
    ipcRenderer.invoke('shell:openFolder', folderPath),

  openPhotoshop: (payload: { folderPath: string; filePaths?: string[] }): Promise<boolean> =>
    ipcRenderer.invoke('shell:openPhotoshop', payload),

  onProgressUpdate: (callback: (progress: ProgressUpdate) => void) => {
    const handler = (_: any, progress: ProgressUpdate) => callback(progress);
    ipcRenderer.on('filter:progress', handler);
    return () => {
      ipcRenderer.removeListener('filter:progress', handler);
    };
  },

  listPresets: (): Promise<Preset[]> => ipcRenderer.invoke('preset:list'),

  savePreset: (
    preset: Omit<Preset, 'id' | 'created_at' | 'schema_version'> & { id?: string }
  ): Promise<Preset> => ipcRenderer.invoke('preset:save', preset),

  deletePreset: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('preset:delete', id),

  listHistory: (): Promise<RunLog[]> => ipcRenderer.invoke('history:list'),

  getHistoryEntry: (runId: string): Promise<RunLog | undefined> =>
    ipcRenderer.invoke('history:get', runId),

  undoRun: (runId: string): Promise<UndoResult> =>
    ipcRenderer.invoke('history:undo', runId),

  getRawThumbnail: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('file:rawThumbnail', filePath),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
