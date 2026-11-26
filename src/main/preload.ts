import { contextBridge, ipcRenderer, webUtils } from 'electron';
import {
  FilterConfig,
  FileEntry,
  Preset,
  ProgressUpdate,
  RunResult,
  RunLog,
  UndoResult,
  PreviewResult,
  DetectedExtension,
  SelectFolderOptions,
  OpenPhotoshopResult,
} from '../shared/types';

export const electronAPI = {
  selectFolder: (options?: SelectFolderOptions): Promise<string | null> =>
    ipcRenderer.invoke('dialog:selectFolder', options),

  previewFilter: (config: FilterConfig): Promise<PreviewResult> =>
    ipcRenderer.invoke('filter:preview', config),

  detectExtensions: (
    folderPath: string,
    recursive: boolean = true,
    excludeFolder?: string
  ): Promise<DetectedExtension[]> =>
    ipcRenderer.invoke('folder:detectExtensions', {
      folderPath,
      recursive,
      excludeFolder,
    }),

  executeFilter: (
    config: FilterConfig,
    filesToProcess?: FileEntry[],
    presetName?: string
  ): Promise<RunResult> =>
    ipcRenderer.invoke('filter:run', {
      config,
      filesToProcess: filesToProcess || [],
      presetName,
    }),

  cancelRun: (runId?: string): Promise<boolean> =>
    ipcRenderer.invoke('filter:cancel', runId),

  openFolder: (folderPath: string): Promise<boolean> =>
    ipcRenderer.invoke('shell:openFolder', folderPath),

  revealInFolder: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('shell:revealInFolder', filePath),

  openPhotoshop: (payload: {
    folderPath: string;
    filePaths?: string[];
  }): Promise<OpenPhotoshopResult> =>
    ipcRenderer.invoke('shell:openPhotoshop', payload),

  onProgressUpdate: (callback: (progress: ProgressUpdate) => void) => {
    const handler = (_: Electron.IpcRendererEvent, progress: ProgressUpdate) =>
      callback(progress);
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

  deleteHistoryEntry: (runId: string): Promise<boolean> =>
    ipcRenderer.invoke('history:delete', runId),

  getRawThumbnail: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('file:rawThumbnail', filePath),

  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file) || '';
    } catch {
      return (file as File & { path?: string }).path || '';
    }
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
