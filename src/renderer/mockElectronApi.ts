import {
  FilterConfig,
  FileEntry,
  Preset,
  ProgressUpdate,
  RunResult,
  RunLog,
  PreviewResult,
  DetectedExtension,
  SelectFolderOptions,
  OpenPhotoshopResult,
} from '../shared/types';
import { isImageExtension, isRawExtension, normalizeExtension } from '../shared/imageExtensions';

function makeSampleSvgDataUri(title: string, subtitle: string, accent: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg}" />
        <stop offset="100%" stop-color="#111116" />
      </linearGradient>
    </defs>
    <rect width="960" height="640" fill="url(#g)" />
    <circle cx="720" cy="180" r="140" fill="${accent}" fill-opacity="0.16" />
    <rect x="72" y="450" width="816" height="118" rx="10" fill="#09090c" fill-opacity="0.72" />
    <text x="104" y="502" fill="#f4f4f6" font-family="Segoe UI, sans-serif" font-size="30" font-weight="700">${title}</text>
    <text x="104" y="540" fill="${accent}" font-family="Consolas, monospace" font-size="18">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const SAMPLE_CATALOG: (FileEntry & { previewUrl: string })[] = [
  {
    id: 'sample-1',
    filename: 'DTT00970.JPG',
    name: 'DTT00970.JPG',
    relativePath: 'DTT00970.JPG',
    sourcePath: 'D:/Studio_Wedding_2026/DTT00970.JPG',
    path: 'D:/Studio_Wedding_2026/DTT00970.JPG',
    extension: '.jpg',
    sizeBytes: 8420100,
    size: 8420100,
    dateTaken: '2026-10-18 16:42:11',
    mtime: '2026-10-18T09:42:11.000Z',
    selected: true,
    previewUrl: makeSampleSvgDataUri('DTT00970.JPG', 'Sony A7R V - 85mm f/1.4 - ISO 200', '#f59e0b', '#272017'),
  },
  {
    id: 'sample-2',
    filename: 'DTT00970.ARW',
    name: 'DTT00970.ARW',
    relativePath: 'RAW/DTT00970.ARW',
    sourcePath: 'D:/Studio_Wedding_2026/RAW/DTT00970.ARW',
    path: 'D:/Studio_Wedding_2026/RAW/DTT00970.ARW',
    extension: '.arw',
    sizeBytes: 64120000,
    size: 64120000,
    dateTaken: '2026-10-18 16:42:11',
    mtime: '2026-10-18T09:42:11.000Z',
    selected: true,
    previewUrl: makeSampleSvgDataUri('DTT00970.ARW (RAW High-Res)', '61MP Uncompressed RAW - 5760x3840 Preview', '#f59e0b', '#1b1926'),
  },
  {
    id: 'sample-3',
    filename: 'DTT00971.JPG',
    name: 'DTT00971.JPG',
    relativePath: 'DTT00971.JPG',
    sourcePath: 'D:/Studio_Wedding_2026/DTT00971.JPG',
    path: 'D:/Studio_Wedding_2026/DTT00971.JPG',
    extension: '.jpg',
    sizeBytes: 9150400,
    size: 9150400,
    dateTaken: '2026-10-18 16:43:04',
    mtime: '2026-10-18T09:43:04.000Z',
    selected: true,
    previewUrl: makeSampleSvgDataUri('DTT00971.JPG', 'Sony A7R V - 50mm f/1.2 - ISO 400', '#10b981', '#142420'),
  },
  {
    id: 'sample-4',
    filename: 'DTT00971.CR3',
    name: 'DTT00971.CR3',
    relativePath: 'RAW/DTT00971.CR3',
    sourcePath: 'D:/Studio_Wedding_2026/RAW/DTT00971.CR3',
    path: 'D:/Studio_Wedding_2026/RAW/DTT00971.CR3',
    extension: '.cr3',
    sizeBytes: 48200500,
    size: 48200500,
    dateTaken: '2026-10-18 16:43:04',
    mtime: '2026-10-18T09:43:04.000Z',
    selected: true,
    previewUrl: makeSampleSvgDataUri('DTT00971.CR3 (RAW High-Res)', 'Canon EOS R5 - 45MP RAW Preview', '#f59e0b', '#241a1a'),
  },
  {
    id: 'sample-5',
    filename: 'DTT00972.JPG',
    name: 'DTT00972.JPG',
    relativePath: 'DTT00972.JPG',
    sourcePath: 'D:/Studio_Wedding_2026/DTT00972.JPG',
    path: 'D:/Studio_Wedding_2026/DTT00972.JPG',
    extension: '.jpg',
    sizeBytes: 7630200,
    size: 7630200,
    dateTaken: '2026-10-18 16:45:22',
    mtime: '2026-10-18T09:45:22.000Z',
    selected: true,
    previewUrl: makeSampleSvgDataUri('DTT00972.JPG', 'Sony A7R V - 35mm f/1.4 - ISO 160', '#38bdf8', '#142029'),
  },
  {
    id: 'sample-6',
    filename: 'DTT00972_WA.JPG',
    name: 'DTT00972_WA.JPG',
    relativePath: 'DTT00972_WA.JPG',
    sourcePath: 'D:/Studio_Wedding_2026/DTT00972_WA.JPG',
    path: 'D:/Studio_Wedding_2026/DTT00972_WA.JPG',
    extension: '.jpg',
    sizeBytes: 1240000,
    size: 1240000,
    dateTaken: '2026-10-18 16:46:10',
    mtime: '2026-10-18T09:46:10.000Z',
    selected: true,
    previewUrl: makeSampleSvgDataUri('DTT00972_WA.JPG', 'Compressed Copy', '#94a3b8', '#1b1d22'),
  },
];

function matchKeyword(filename: string, keyword: string, matchType: string): boolean {
  const fnLower = filename.toLowerCase();
  const dotIdx = fnLower.lastIndexOf('.');
  const baseLower = dotIdx > 0 ? fnLower.slice(0, dotIdx) : fnLower;
  const kwLower = keyword.trim().toLowerCase();
  if (!kwLower) return false;
  if (matchType === 'starts_with' || matchType === 'prefix') return baseLower.startsWith(kwLower);
  if (matchType === 'exact') return baseLower === kwLower || fnLower === kwLower;
  return fnLower.includes(kwLower) || baseLower === kwLower;
}

export function setupMockElectronApi() {
  if (typeof window === 'undefined' || window.electronAPI) {
    return;
  }

  console.warn('[Browser Preview] Enabling browser mock electronAPI.');

  const progressListeners = new Set<(update: ProgressUpdate) => void>();

  let mockPresets: Preset[] = [
    {
      id: 'preset-sony-a7r',
      name: 'Sony A7R RAW + JPEG',
      keywords_include: ['DTT00970', 'DTT00971', 'DTT00972'],
      keywords_exclude: ['_WA'],
      match_type: 'contains',
      extensions: ['jpg', 'arw'],
      mode: 'copy',
      duplicate_policy: 'auto_rename',
      created_at: new Date().toISOString(),
      schema_version: 1,
    },
    {
      id: 'preset-canon-raw',
      name: 'Canon R5 RAW Only',
      keywords_include: ['DTT00971'],
      keywords_exclude: [],
      match_type: 'exact',
      extensions: ['cr3'],
      mode: 'copy',
      duplicate_policy: 'skip',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      schema_version: 1,
    },
  ];

  let mockHistory: RunLog[] = [
    {
      run_id: 'run-20261018-1645',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      source_folder: 'D:/Studio_Wedding_2026',
      destination_folder: 'D:/Studio_Wedding_2026/Da_Loc_Khach',
      preset_name: 'Sony A7R RAW + JPEG',
      mode: 'copy',
      duplicate_policy: 'auto_rename',
      total_matched: 4,
      processed: 4,
      skipped_duplicate: 0,
      errors: 0,
      undone: false,
      file_map: SAMPLE_CATALOG.slice(0, 4).map((f) => ({
        source: f.sourcePath,
        destination: `D:/Studio_Wedding_2026/Da_Loc_Khach/${f.filename}`,
        filename: f.filename,
        status: 'success' as const,
      })),
      schema_version: 1,
    },
  ];

  const getAllMockFiles = (): FileEntry[] => {
    const browserFiles: FileEntry[] | undefined = (window as any).mockBrowserFiles;
    if (browserFiles && browserFiles.length > 0) return browserFiles;
    return SAMPLE_CATALOG.map((item) => ({
      ...item,
      path: item.sourcePath,
    }));
  };

  const mockApi = {
    isMock: true,

    selectFolder: async (options?: SelectFolderOptions): Promise<string | null> => {
      const title = typeof options === 'string' ? options : options?.title || '';
      if (title.toLowerCase().includes('đích') || title.toLowerCase().includes('destination')) {
        return 'D:/Studio_Wedding_2026/Da_Loc_Khach';
      }
      return 'D:/Studio_Wedding_2026';
    },

    previewFilter: async (config: FilterConfig): Promise<PreviewResult> => {
      const allFiles = getAllMockFiles().filter((f) => isImageExtension(f.extension));
      const includeKws = Array.from(
        new Set(
          (config.keywords_include || [])
            .map((k) => k.trim())
            .filter(Boolean)
        )
      );
      const excludeKws = (config.keywords_exclude || [])
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
      const matchType = config.match_type || 'contains';

      if (includeKws.length === 0) {
        return {
          files: [],
          matched_files: [],
          totalCount: 0,
          total_matched: 0,
          totalSizeBytes: 0,
          total_size: 0,
          scan_duration_ms: 4,
          unmatchedKeywords: [],
          totalFolderImages: allFiles.length,
        };
      }

      const matchedKwSet = new Set<string>();
      let matched = allFiles.filter((f) => {
        const fn = f.filename || f.name || '';
        const inc = includeKws.some((kw) => {
          const ok = matchKeyword(fn, kw, matchType);
          if (ok) matchedKwSet.add(kw.toLowerCase());
          return ok;
        });
        if (!inc) return false;
        if (excludeKws.length > 0 && excludeKws.some((ex) => fn.toLowerCase().includes(ex))) {
          return false;
        }
        return true;
      });

      if (config.extensions && config.extensions.length > 0) {
        const extsClean = config.extensions.map((e) => normalizeExtension(e));
        matched = matched.filter((f) =>
          extsClean.includes(normalizeExtension(f.extension))
        );
      }

      const totalSize = matched.reduce((acc, f) => acc + (f.sizeBytes || f.size || 0), 0);
      const unmatchedKeywords = includeKws.filter(
        (kw) => !matchedKwSet.has(kw.toLowerCase())
      );

      return {
        files: matched,
        matched_files: matched,
        totalCount: matched.length,
        total_matched: matched.length,
        totalSizeBytes: totalSize,
        total_size: totalSize,
        scan_duration_ms: 18,
        unmatchedKeywords,
        totalFolderImages: allFiles.length,
      };
    },

    executeFilter: async (
      config: FilterConfig,
      filesToProcess?: FileEntry[],
      presetName?: string
    ): Promise<RunResult> => {
      const targetFiles =
        filesToProcess && filesToProcess.length > 0
          ? filesToProcess
          : (await mockApi.previewFilter(config)).files;

      const runId = `run-${Date.now()}`;
      const destFolder = config.destFolder || config.destination_folder || 'D:/Sorted';

      for (let i = 0; i < targetFiles.length; i++) {
        const f = targetFiles[i];
        progressListeners.forEach((cb) =>
          cb({
            runId,
            processedCount: i + 1,
            totalCount: targetFiles.length,
            currentFilename: f.filename,
            status: 'processing',
          })
        );
        await new Promise((r) => setTimeout(r, 45));
      }

      const fileMap = targetFiles.map((f) => ({
        source: f.sourcePath,
        destination: `${destFolder}/${f.filename}`,
        filename: f.filename,
        status: 'success' as const,
      }));

      mockHistory.unshift({
        run_id: runId,
        timestamp: new Date().toISOString(),
        source_folder: config.sourceFolder || 'D:/Studio_Wedding_2026',
        destination_folder: destFolder,
        preset_name: presetName,
        mode: config.mode,
        duplicate_policy: config.duplicate_policy || 'auto_rename',
        total_matched: targetFiles.length,
        processed: targetFiles.length,
        skipped_duplicate: 0,
        errors: 0,
        undone: false,
        file_map: fileMap,
        schema_version: 1,
      });

      progressListeners.forEach((cb) =>
        cb({
          runId,
          processedCount: targetFiles.length,
          totalCount: targetFiles.length,
          currentFilename: 'Hoàn tất',
          status: 'completed',
        })
      );

      return {
        run_id: runId,
        total_matched: targetFiles.length,
        processed: targetFiles.length,
        skipped: 0,
        errors: 0,
        cancelled: false,
        destination_folder: destFolder,
        file_map: fileMap,
        errorList: [],
      };
    },

    cancelRun: async () => true,

    detectExtensions: async (folderPath: string): Promise<DetectedExtension[]> => {
      if (!folderPath) return [];
      const files = getAllMockFiles();
      const extMap: Record<string, number> = {};
      files.forEach((f) => {
        const extClean = normalizeExtension(f.extension);
        if (extClean && isImageExtension(extClean)) {
          extMap[extClean] = (extMap[extClean] || 0) + 1;
        }
      });
      return Object.keys(extMap)
        .map((ext) => ({
          ext,
          count: extMap[ext],
          isRaw: isRawExtension(ext),
        }))
        .sort((a, b) => b.count - a.count || a.ext.localeCompare(b.ext));
    },

    openFolder: async () => true,
    revealInFolder: async () => true,

    openPhotoshop: async (payload: {
      folderPath: string;
      filePaths?: string[];
    }): Promise<OpenPhotoshopResult> => ({
      success: true,
      message: `[Xem trước trình duyệt] Đã gửi ${payload.filePaths?.length || 0} ảnh tới Photoshop.`,
    }),

    onProgressUpdate: (callback: (update: ProgressUpdate) => void) => {
      progressListeners.add(callback);
      return () => {
        progressListeners.delete(callback);
      };
    },

    listPresets: async () => [...mockPresets],

    savePreset: async (preset: any) => {
      const newPreset: Preset = {
        ...preset,
        id: preset.id || `preset-${Date.now()}`,
        created_at: new Date().toISOString(),
        schema_version: 1,
      };
      mockPresets = [newPreset, ...mockPresets.filter((p) => p.id !== newPreset.id)];
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
        mockHistory[idx] = { ...mockHistory[idx], undone: true };
      }
      return {
        success: true,
        runId,
        restoredCount: mockHistory[idx]?.mode === 'move' ? mockHistory[idx].processed : 0,
        deletedCount: mockHistory[idx]?.mode === 'copy' ? mockHistory[idx].processed : 0,
        errorCount: 0,
        errors: [],
      };
    },

    deleteHistoryEntry: async (runId: string) => {
      mockHistory = mockHistory.filter((h) => h.run_id !== runId);
      return true;
    },

    getRawThumbnail: async (filePath: string): Promise<string | null> => {
      const found = SAMPLE_CATALOG.find((item) => item.sourcePath === filePath);
      return found?.previewUrl || makeSampleSvgDataUri('RAW Preview', filePath, '#f59e0b', '#1a1a22');
    },

    getPathForFile: (file: File) => (file as File & { path?: string }).path || file.name,
  };

  window.electronAPI = mockApi as any;
}
