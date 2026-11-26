import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Camera,
  Filter,
  History,
  Bookmark,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import {
  FilterConfig,
  FileEntry,
  PreviewResult,
  ProgressUpdate,
  RunResult,
  Preset,
  DetectedExtension,
} from '../shared/types';
import { FolderPicker } from './components/FolderPicker';
import { FilterCriteria } from './components/FilterCriteria';
import { ModeAndPolicy } from './components/ModeAndPolicy';
import { PreviewTable } from './components/PreviewTable';
import { HistoryView } from './components/HistoryView';
import { PresetManager } from './components/PresetManager';
import { ExecutionModal } from './components/ExecutionModal';
import { StartupSplash } from './components/StartupSplash';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastState {
  message: string;
  type: ToastType;
}

function cleanErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'Lỗi không xác định');
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();
}

function normalizePathClient(p: string): string {
  return p.trim().replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase();
}

export const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'filter' | 'presets' | 'history'>('filter');
  const [activePresetName, setActivePresetName] = useState<string | undefined>(undefined);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('shutter_theme') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const [config, setConfig] = useState<FilterConfig>({
    sourceFolder: '',
    destFolder: '',
    recursive: true,
    keywords_include: [],
    keywords_exclude: [],
    match_type: 'contains',
    extensions: [],
    mode: 'copy',
    duplicate_policy: 'auto_rename',
    allow_overwrite: false,
    auto_subfolder: 'none',
  });

  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isDetectingExts, setIsDetectingExts] = useState<boolean>(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

  const [showExecutionModal, setShowExecutionModal] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [progressUpdate, setProgressUpdate] = useState<ProgressUpdate | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [detectedExtensions, setDetectedExtensions] = useState<DetectedExtension[]>([]);

  const toastTimerRef = useRef<number | null>(null);
  const previewSeqRef = useRef<number>(0);
  const detectSeqRef = useRef<number>(0);

  const currentSource = (config.sourceFolder || config.source_folder || '').trim();
  const currentDest = (config.destFolder || config.destination_folder || '').trim();

  const hasPathConflict = useMemo(() => {
    if (!currentSource || !currentDest) return false;
    return normalizePathClient(currentSource) === normalizePathClient(currentDest);
  }, [currentSource, currentDest]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Document title & Theme class sync (both html and body to eliminate FOUC)
  useEffect(() => {
    document.title = 'ShutterFilter by Tandev.foto';
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('shutter_theme', theme);
    } catch {
      // Ignore storage errors
    }
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
      document.body.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
      document.body.classList.remove('theme-light');
    }
  }, [theme]);

  const toggleTheme = () => {
    document.documentElement.classList.add('theme-switching');
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.documentElement.classList.remove('theme-switching');
      });
    });
  };

  // Realtime progress listener via IPC
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const unsubscribe = window.electronAPI.onProgressUpdate((progress) => {
        setProgressUpdate(progress);
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, []);

  // Race-condition-safe preview scan
  const runAutoPreview = useCallback(async (currentConfig: FilterConfig) => {
    const rawSource = (
      currentConfig.sourceFolder ||
      currentConfig.source_folder ||
      ''
    ).trim();
    if (!rawSource) {
      setPreviewResult(null);
      setScanError(null);
      setIsPreviewLoading(false);
      return;
    }

    const requestId = ++previewSeqRef.current;
    setIsPreviewLoading(true);
    setScanError(null);

    try {
      const result = await window.electronAPI.previewFilter(currentConfig);
      if (requestId !== previewSeqRef.current) return;
      setPreviewResult(result);
    } catch (err) {
      if (requestId !== previewSeqRef.current) return;
      setPreviewResult(null);
      setScanError(cleanErrorMessage(err));
    } finally {
      if (requestId === previewSeqRef.current) {
        setIsPreviewLoading(false);
      }
    }
  }, []);

  // Race-condition-safe extension detection
  const autoDetectExtensions = useCallback(
    async (
      sourceFolder: string,
      recursive: boolean,
      destFolder?: string,
      silent: boolean = false
    ) => {
      const trimmed = sourceFolder.trim();
      if (!trimmed) {
        setDetectedExtensions([]);
        return;
      }

      const detectId = ++detectSeqRef.current;
      setIsDetectingExts(true);
      try {
        const detectedList = window.electronAPI?.detectExtensions
          ? await window.electronAPI.detectExtensions(trimmed, recursive, destFolder)
          : [];

        if (detectId !== detectSeqRef.current) return;
        setDetectedExtensions(detectedList);

        if (!silent) {
          if (detectedList.length > 0) {
            const totalCount = detectedList.reduce((acc, item) => acc + item.count, 0);
            showToast(
              `Nhận diện ${totalCount.toLocaleString('vi-VN')} ảnh thuộc ${detectedList.length} định dạng trong thư mục nguồn.`,
              'success'
            );
          } else {
            showToast('Thư mục nguồn không chứa định dạng ảnh hợp lệ.', 'warning');
          }
        }
      } catch (err) {
        if (detectId !== detectSeqRef.current) return;
        console.error('Failed to auto detect extensions:', err);
      } finally {
        if (detectId === detectSeqRef.current) {
          setIsDetectingExts(false);
        }
      }
    },
    [showToast]
  );

  // Real-time debounced auto-preview whenever filter criteria change
  useEffect(() => {
    if (!currentSource) {
      previewSeqRef.current++;
      setPreviewResult(null);
      setScanError(null);
      setDetectedExtensions([]);
      setIsPreviewLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      runAutoPreview(config);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [
    currentSource,
    currentDest,
    config.keywords_include,
    config.keywords_exclude,
    config.extensions,
    config.match_type,
    config.recursive,
    runAutoPreview,
  ]);

  // Re-detect extensions when source folder, recursive mode, or destination folder changes
  const prevSourceRef = useRef<string>('');
  useEffect(() => {
    if (!currentSource) {
      prevSourceRef.current = '';
      setDetectedExtensions([]);
      return;
    }

    const sourceChanged = prevSourceRef.current !== currentSource;
    prevSourceRef.current = currentSource;

    const timer = window.setTimeout(() => {
      autoDetectExtensions(currentSource, config.recursive, currentDest, !sourceChanged);
    }, sourceChanged ? 120 : 250);

    return () => window.clearTimeout(timer);
  }, [currentSource, config.recursive, currentDest, autoDetectExtensions]);

  const handleConfigChange = (updates: Partial<FilterConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      const oldSource = (prev.sourceFolder || prev.source_folder || '').trim();
      const newSource = (next.sourceFolder || next.source_folder || '').trim();

      if (oldSource !== newSource) {
        next.extensions = [];
      }
      return next;
    });
  };

  const handleRefreshSource = () => {
    if (!currentSource) return;
    autoDetectExtensions(currentSource, config.recursive, currentDest, false);
    runAutoPreview(config);
  };

  // Run File Filter Copy/Move Execution
  const handleExecuteRun = async (selectedFiles: FileEntry[]) => {
    if (!currentSource || !currentDest) {
      showToast('Vui lòng chọn Thư mục nguồn và Thư mục đích.', 'warning');
      return;
    }

    if (hasPathConflict) {
      showToast('Thư mục nguồn và thư mục đích không được trùng nhau.', 'error');
      return;
    }

    if (!selectedFiles || selectedFiles.length === 0) {
      showToast('Chưa có ảnh nào được chọn để thực thi lọc.', 'warning');
      return;
    }

    setIsExecuting(true);
    setShowExecutionModal(true);
    setProgressUpdate({
      runId: `run-${Date.now()}`,
      processedCount: 0,
      totalCount: selectedFiles.length,
      currentFilename: 'Đang khởi tạo...',
      status: 'processing',
    });
    setRunResult(null);

    try {
      const result = await window.electronAPI.executeFilter(
        config,
        selectedFiles,
        activePresetName
      );
      setRunResult(result);

      if (result.cancelled) {
        showToast(
          `Đã hủy tiến trình. Đã xử lý ${result.processed} file trước khi dừng.`,
          'warning'
        );
      } else if (result.errors > 0) {
        showToast(
          `Hoàn tất: ${result.processed} thành công, ${result.skipped} bỏ qua, ${result.errors} lỗi.`,
          'warning'
        );
      } else {
        showToast(
          `Hoàn tất! Đã xử lý ${result.processed} file (${result.skipped} bỏ qua).`,
          'success'
        );
      }

      // Refresh preview & extensions after move or any execution so table reflects disk reality
      if (config.mode === 'move') {
        autoDetectExtensions(currentSource, config.recursive, currentDest, true);
        runAutoPreview(config);
      }
    } catch (err) {
      const errMsg = cleanErrorMessage(err);
      setProgressUpdate({
        runId: `run-err-${Date.now()}`,
        processedCount: 0,
        totalCount: selectedFiles.length,
        currentFilename: '',
        status: 'error',
        errorMsg: errMsg,
      });
      showToast(errMsg, 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancelExecution = async () => {
    try {
      await window.electronAPI.cancelRun();
      showToast('Đang dừng tiến trình lọc...', 'warning');
    } catch (err) {
      console.error('Cancel error:', err);
    }
  };

  const handleApplyPreset = (preset: Preset) => {
    setActivePresetName(preset.name);
    setConfig((prev) => ({
      ...prev,
      keywords_include: [...preset.keywords_include],
      keywords_exclude: [...preset.keywords_exclude],
      match_type: preset.match_type || 'contains',
      extensions: [...preset.extensions],
      mode: preset.mode || 'copy',
      duplicate_policy: preset.duplicate_policy || 'auto_rename',
      allow_overwrite: preset.duplicate_policy === 'overwrite',
    }));
    setActiveTab('filter');
    showToast(`Đã áp dụng bộ lọc mẫu "${preset.name}".`, 'success');
  };

  const handleUndoComplete = () => {
    if (currentSource) {
      autoDetectExtensions(currentSource, config.recursive, currentDest, true);
      runAutoPreview(config);
    }
  };

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--bg-canvas)] text-[var(--text-main)] font-sans overflow-hidden">
      {/* Studio Aperture Startup Loading Animation */}
      {showSplash && <StartupSplash onComplete={handleSplashComplete} />}

      {/* Precision Studio Top Chrome (52px, single-line hairline bar) */}
      <header className="h-[52px] bg-[var(--bg-chrome)] backdrop-blur-md border-b border-[var(--border-hairline)] px-4 sm:px-5 flex items-center justify-between gap-3 shrink-0 select-none z-20">
        {/* Brand Lockup */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-[6px] bg-[var(--accent)] flex items-center justify-center text-[var(--accent-text)] shrink-0 shadow-xs">
            <Camera className="w-4 h-4" strokeWidth={2.1} />
          </div>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[14px] font-semibold text-[var(--text-main)] tracking-[-0.02em] truncate">
              ShutterFilter
            </span>
            <span className="text-[11px] font-mono text-[var(--text-dim)] hidden sm:inline truncate">
              Tandev.foto
            </span>
          </div>
        </div>

        {/* Navigation Switcher */}
        <nav className="segmented-control shrink-0" aria-label="Điều hướng chính">
          <button
            type="button"
            onClick={() => setActiveTab('filter')}
            className={`segmented-item ${
              activeTab === 'filter' ? 'active' : ''
            } flex items-center gap-1.5`}
          >
            <Filter
              className={`w-3.5 h-3.5 ${
                activeTab === 'filter'
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-dim)]'
              }`}
              strokeWidth={1.75}
            />
            <span>Lọc ảnh</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`segmented-item ${
              activeTab === 'presets' ? 'active' : ''
            } flex items-center gap-1.5`}
          >
            <Bookmark
              className={`w-3.5 h-3.5 ${
                activeTab === 'presets'
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-dim)]'
              }`}
              strokeWidth={1.75}
            />
            <span>Bộ lọc mẫu</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`segmented-item ${
              activeTab === 'history' ? 'active' : ''
            } flex items-center gap-1.5`}
          >
            <History
              className={`w-3.5 h-3.5 ${
                activeTab === 'history'
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-dim)]'
              }`}
              strokeWidth={1.75}
            />
            <span>Lịch sử</span>
          </button>
        </nav>

        {/* Quiet Theme Switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-secondary-pro py-1.5 px-2.5 text-xs shrink-0"
          title={
            theme === 'dark'
              ? 'Chuyển sang Giao diện Sáng'
              : 'Chuyển sang Giao diện Tối'
          }
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={1.75} />
              <span className="hidden sm:inline text-[var(--text-secondary)]">Sáng</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
              <span className="hidden sm:inline text-[var(--text-secondary)]">Tối</span>
            </>
          )}
        </button>
      </header>

      {/* Main Full-Bleed Architectural Workspace */}
      <main className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden bg-[var(--bg-canvas)]">
        {activeTab === 'filter' && (
          <div className="h-full flex flex-col md:flex-row min-h-0">
            {/* Left Studio Inspector Rail (hairline-divided, zero nested card boxes) */}
            <aside className="w-full md:w-[352px] lg:w-[376px] xl:w-[396px] shrink-0 bg-[var(--bg-rail)] border-b md:border-b-0 md:border-r border-[var(--border-hairline)] md:overflow-y-auto divide-y divide-[var(--border-hairline)] min-h-0">
              <FolderPicker
                config={config}
                onChange={handleConfigChange}
                onRefreshSource={handleRefreshSource}
                isScanning={isDetectingExts || isPreviewLoading}
                hasPathConflict={hasPathConflict}
              />

              <FilterCriteria
                config={config}
                onChange={handleConfigChange}
                detectedExtensions={detectedExtensions}
                unmatchedKeywords={previewResult?.unmatchedKeywords || []}
                onNotify={showToast}
              />

              <ModeAndPolicy config={config} onChange={handleConfigChange} />
            </aside>

            {/* Right Light-Table Canvas */}
            <section className="flex-1 min-w-0 min-h-[440px] md:min-h-0 h-full overflow-hidden bg-[var(--bg-canvas)]">
              <PreviewTable
                config={config}
                previewResult={previewResult}
                onExecute={handleExecuteRun}
                isLoading={isDetectingExts || isPreviewLoading || isExecuting}
                scanError={scanError}
                hasPathConflict={hasPathConflict}
              />
            </section>
          </div>
        )}

        {activeTab === 'presets' && (
          <div className="h-full overflow-y-auto px-5 py-6">
            <div className="max-w-5xl mx-auto">
              <PresetManager
                currentConfig={config}
                onApplyPreset={handleApplyPreset}
                onNotify={showToast}
              />
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="h-full overflow-y-auto px-5 py-6">
            <div className="max-w-5xl mx-auto">
              <HistoryView
                onUndoComplete={handleUndoComplete}
                onNotify={showToast}
              />
            </div>
          </div>
        )}
      </main>

      {/* Typed Dismissible Toast Notification (Centered above footer so neither top CTA nor pagination is occluded) */}
      {toast && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 animate-fade-in max-w-md w-max">
          <div
            className={`bg-[var(--bg-card)] text-[var(--text-main)] text-xs px-3.5 py-2.5 rounded-[8px] border flex items-center gap-2.5 ${
              toast.type === 'success'
                ? 'border-[var(--status-success-border)]'
                : toast.type === 'error'
                ? 'border-[var(--status-danger-border)]'
                : toast.type === 'warning'
                ? 'border-[var(--status-warning-border)]'
                : 'border-[var(--border-subtle)]'
            }`}
            style={{ boxShadow: 'var(--shadow-elevated)' }}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[var(--status-success)] shrink-0" strokeWidth={1.75} />
            ) : toast.type === 'error' ? (
              <XCircle className="w-4 h-4 text-[var(--status-danger)] shrink-0" strokeWidth={1.75} />
            ) : toast.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-[var(--status-warning)] shrink-0" strokeWidth={1.75} />
            ) : (
              <Info className="w-4 h-4 text-[var(--accent)] shrink-0" strokeWidth={1.75} />
            )}
            <span className="leading-snug">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-[var(--text-dim)] hover:text-[var(--text-main)] cursor-pointer ml-1 shrink-0"
              title="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}

      {/* Realtime Execution Progress Modal */}
      {showExecutionModal && (
        <ExecutionModal
          progress={progressUpdate}
          result={runResult}
          config={config}
          onCancel={handleCancelExecution}
          onClose={() => setShowExecutionModal(false)}
          onNotify={showToast}
        />
      )}
    </div>
  );
};
