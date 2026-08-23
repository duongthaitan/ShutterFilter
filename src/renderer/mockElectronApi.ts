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

export function setupMockElectronApi() {
  if (typeof window === 'undefined' || window.electronAPI) {
    return;
  }

  console.warn('[Browser Preview] Enabling browser mock electronAPI.');

  let mockPresets: Preset[] = [
    {
      id: 'preset-sony-a7r',
      name: 'Sony A7R RAW + JPEG',
      keywords_include: ['DSC', 'A7R'],
      keywords_exclude: [],
      match_type: 'contains',
      extensions: ['jpg', 'arw'],
      mode: 'copy',
      duplicate_policy: 'auto_rename',
      created_at: new Date().toISOString(),
      schema_version: 1,
    },
  ];

  let mockHistory: RunLog[] = [
    {
      run_id: 'run-20260823-1001',
      timestamp: new Date().toISOString(),
      source_folder: 'C:/Users/Photographer/Pictures/Raw_Import_2026',
      destination_folder: 'D:/Photos/Sorted/Sony_A7R',
      preset_name: 'Sony A7R RAW + JPEG',
      mode: 'copy',
      duplicate_policy: 'auto_rename',
      total_matched: 48,
      processed: 48,
      skipped_duplicate: 0,
      errors: 0,
      undone: false,
      file_map: [],
      schema_version: 1,
    },
  ];

  const mockApi = {
    isMock: true,

    selectFolder: async (defaultPath?: string) => {
      if ('showDirectoryPicker' in window) {
        try {
          const handle = await (window as any).showDirectoryPicker();
          if (handle) {
            const folderName = handle.name;
            const realFiles: FileEntry[] = [];

            const scanHandle = async (dirHandle: any, currentPath: string) => {
              for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') {
                  const file = await entry.getFile();
                  const ext = (file.name.split('.').pop() || '').toLowerCase();
                  const fullPath = `${currentPath}/${file.name}`;
                  realFiles.push({
                    id: fullPath,
                    filename: file.name,
                    name: file.name,
                    relativePath: file.name,
                    sourcePath: fullPath,
                    path: fullPath,
                    extension: ext,
                    sizeBytes: file.size,
                    size: file.size,
                    dateTaken: new Date(file.lastModified).toISOString(),
                    mtime: new Date(file.lastModified).toISOString(),
                    selected: true,
                  });
                } else if (entry.kind === 'directory') {
                  await scanHandle(entry, `${currentPath}/${entry.name}`);
                }
              }
            };

            await scanHandle(handle, folderName);
            (window as any).mockBrowserFiles = realFiles;
            return folderName;
          }
        } catch (err: any) {
          if (err.name === 'AbortError') return null;
        }
      }

      return defaultPath?.includes('Source')
        ? 'C:/Users/Photographer/Pictures/Source_Import'
        : 'D:/Photos/Sorted_Output';
    },

    previewFilter: async (config: FilterConfig): Promise<PreviewResult> => {
      const browserFiles: FileEntry[] = (window as any).mockBrowserFiles;

      const includeKws = (config.keywords_include || [])
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      // If user has not typed/pasted any photo names, return 0 matched
      if (includeKws.length === 0) {
        return {
          files: [],
          matched_files: [],
          totalCount: 0,
          total_matched: 0,
          totalSizeBytes: 0,
          total_size: 0,
          scan_duration_ms: 5,
        };
      }

      let allFiles: FileEntry[] = [];

      if (browserFiles && browserFiles.length > 0) {
        allFiles = browserFiles;
      } else {
        const folder = config.sourceFolder || config.source_folder || 'C:/Photos/Source';

        allFiles = includeKws.map((kw, idx) => ({
          id: `${folder}/${kw}.JPG`,
          filename: `${kw}.JPG`,
          name: `${kw}.JPG`,
          relativePath: `${kw}.JPG`,
          sourcePath: `${folder}/${kw}.JPG`,
          path: `${folder}/${kw}.JPG`,
          extension: 'jpg',
          sizeBytes: (idx + 1) * 12500000,
          size: (idx + 1) * 12500000,
          dateTaken: new Date().toISOString(),
          mtime: new Date().toISOString(),
          selected: true,
        }));
      }

      let matched = allFiles.filter((f) => {
        const fn = (f.filename || f.name || '').toLowerCase();
        const baseName = fn.split('.')[0];
        return includeKws.some((kw) => {
          const kwLower = kw.toLowerCase();
          return fn.includes(kwLower) || baseName === kwLower;
        });
      });

      if (config.extensions && config.extensions.length > 0) {
        const extsClean = config.extensions.map((e) => e.toLowerCase().replace(/^\./, ''));
        matched = matched.filter((f) => extsClean.includes((f.extension || '').toLowerCase().replace(/^\./, '')));
      }

      const totalSize = matched.reduce((acc, f) => acc + (f.sizeBytes || f.size || 0), 0);

      return {
        files: matched,
        matched_files: matched,
        totalCount: matched.length,
        total_matched: matched.length,
        totalSizeBytes: totalSize,
        total_size: totalSize,
        scan_duration_ms: 45,
      };
    },

    executeFilter: async (config: FilterConfig, filesToProcess?: FileEntry[]): Promise<RunResult> => {
      let targetFiles: FileEntry[] = [];

      if (filesToProcess && filesToProcess.length > 0) {
        targetFiles = filesToProcess;
      } else {
        const previewRes = await mockApi.previewFilter(config);
        targetFiles = previewRes.matched_files || previewRes.files || [];
      }

      const count = targetFiles.length;
      const destFolder = config.destFolder || config.destination_folder || 'D:/Sorted';

      return {
        run_id: `run-${Date.now()}`,
        total_matched: count,
        processed: count,
        skipped: 0,
        errors: 0,
        file_map: targetFiles.map((f) => {
          const fn = f.filename || f.name || 'file.jpg';
          const src = f.sourcePath || f.path || `${destFolder}/${fn}`;
          return {
            source: src,
            destination: `${destFolder}/${fn}`,
            filename: fn,
            status: 'success',
          };
        }),
        errorList: [],
      };
    },

    detectExtensions: async (folderPath: string) => {
      if (!folderPath) return [];
      const res = await mockApi.previewFilter({ sourceFolder: folderPath, keywords_include: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], extensions: [] } as any);
      const files = res.matched_files || res.files || [];
      const extMap: Record<string, number> = {};
      const rawExtsClean = ['arw', 'cr2', 'cr3', 'nef', 'dng', 'raf', 'orf', 'rw2'];
      files.forEach((f) => {
        const extClean = (f.extension || '').toLowerCase().replace(/^\./, '');
        if (extClean) {
          extMap[extClean] = (extMap[extClean] || 0) + 1;
        }
      });
      return Object.keys(extMap).map((ext) => ({
        ext,
        count: extMap[ext],
        isRaw: rawExtsClean.includes(ext),
      }));
    },

    openFolder: async (folderPath: string) => {
      alert(`[Browser Preview] Mở thư mục: ${folderPath}`);
      return true;
    },

    openPhotoshop: async (payload: { folderPath: string; filePaths?: string[] }) => {
      alert(`[Browser Preview] Import vào Photoshop: ${payload.filePaths?.length || 0} ảnh`);
      return true;
    },

    onProgressUpdate: (callback: (update: ProgressUpdate) => void) => {
      return () => {};
    },

    listPresets: async () => [...mockPresets],

    savePreset: async (preset: any) => {
      const newPreset: Preset = {
        ...preset,
        id: preset.id || `preset-${Date.now()}`,
        created_at: new Date().toISOString(),
        schema_version: 1,
      };
      mockPresets.push(newPreset);
      return newPreset;
    },

    deletePreset: async (id: string) => {
      mockPresets = mockPresets.filter((p) => p.id !== id);
      return true;
    },

    listHistory: async () => [...mockHistory],

    getHistoryEntry: async (id: string) => mockHistory.find((h) => h.run_id === id),

    undoRun: async (runId: string) => {
      const idx = mockHistory.findIndex((h) => h.run_id === runId);
      if (idx !== -1) {
        mockHistory[idx].undone = true;
      }
      return {
        success: true,
        runId,
        restoredCount: 2,
        deletedCount: 2,
        errorCount: 0,
        errors: [],
      };
    },
  };

  window.electronAPI = mockApi as any;
}
