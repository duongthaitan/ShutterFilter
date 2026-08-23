import React, { useState, useEffect } from 'react';
import { Camera, Filter, History, Info, Sun, Moon } from 'lucide-react';
import {
  FilterConfig,
  PreviewResult,
  ProgressUpdate,
  RunResult,
} from '../shared/types';
import { FolderPicker } from './components/FolderPicker';
import { FilterCriteria } from './components/FilterCriteria';
import { ModeAndPolicy } from './components/ModeAndPolicy';
import { PreviewTable } from './components/PreviewTable';
import { HistoryView } from './components/HistoryView';
import { ExecutionModal } from './components/ExecutionModal';

interface DetectedExt {
  ext: string;
  count: number;
  isRaw: boolean;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'filter' | 'history'>('filter');

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('shutter_theme') as 'dark' | 'light') || 'dark';
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
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const [showExecutionModal, setShowExecutionModal] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [progressUpdate, setProgressUpdate] = useState<ProgressUpdate | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [detectedExtensions, setDetectedExtensions] = useState<DetectedExt[]>([]);

  const currentSource = config.sourceFolder || config.source_folder || '';
  const currentDest = config.destFolder || config.destination_folder || '';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Set document title & theme class
  useEffect(() => {
    document.title = 'ShutterFilter by Tandev.foto';
  }, []);

  useEffect(() => {
    localStorage.setItem('shutter_theme', theme);
    if (theme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
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

  // Real-time auto preview & auto detect extensions whenever config changes
  useEffect(() => {
    if (!currentSource) {
      setPreviewResult(null);
      setDetectedExtensions([]);
      return;
    }

    const timer = setTimeout(() => {
      runAutoPreview(config);
    }, 150);

    return () => clearTimeout(timer);
  }, [
    config.sourceFolder,
    config.source_folder,
    config.keywords_include,
    config.keywords_exclude,
    config.extensions,
    config.match_type,
    config.recursive,
  ]);

  const runAutoPreview = async (currentConfig: FilterConfig) => {
    const rawSource = currentConfig.sourceFolder || currentConfig.source_folder || '';
    if (!rawSource) return;

    try {
      const result = await window.electronAPI.previewFilter(currentConfig);
      setPreviewResult(result);
    } catch (err) {
      console.error('Auto preview error:', err);
    }
  };

  // Config Update Handler: Always force extensions to [] when sourceFolder changes
  const handleConfigChange = (updates: Partial<FilterConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };

      const oldSource = prev.sourceFolder || prev.source_folder || '';
      const newSource = next.sourceFolder || next.source_folder || '';

      if (oldSource !== newSource) {
        // Force extensions to remain UNCHECKED / OFF by default when source folder is selected
        next.extensions = [];
        if (newSource.trim()) {
          autoDetectExtensions(next);
        } else {
          setDetectedExtensions([]);
        }
      }
      return next;
    });
  };

  // Auto detect extensions in source folder (Default OFF / UNCHECKED as requested)
  const autoDetectExtensions = async (currentConfig: FilterConfig) => {
    const rawSource = currentConfig.sourceFolder || currentConfig.source_folder || '';
    if (!rawSource) {
      setDetectedExtensions([]);
      return;
    }

    setIsScanning(true);
    try {
      let detectedList: DetectedExt[] = [];

      if (window.electronAPI?.detectExtensions) {
        detectedList = await window.electronAPI.detectExtensions(rawSource);
      } else {
        const scanConfig: FilterConfig = { ...currentConfig, extensions: [] };
        const res = await window.electronAPI.previewFilter(scanConfig);
        const files = res.matched_files || res.files || [];

        const extMap: { [ext: string]: number } = {};
        files.forEach((f) => {
          const extClean = (f.extension || '').toLowerCase().replace(/^\./, '');
          if (extClean) {
            extMap[extClean] = (extMap[extClean] || 0) + 1;
          }
        });

        const rawExtsClean = ['arw', 'cr2', 'cr3', 'nef', 'dng', 'raf', 'orf', 'rw2'];

        detectedList = Object.keys(extMap).map((ext) => ({
          ext,
          count: extMap[ext],
          isRaw: rawExtsClean.includes(ext),
        }));
      }

      setDetectedExtensions(detectedList);

      // Explicitly keep extensions UNCHECKED / OFF by default
      setConfig((prev) => ({
        ...prev,
        extensions: [],
      }));

      if (detectedList.length > 0) {
        showToast(`Tự động nhận diện ${detectedList.length} loại định dạng ảnh trong folder nguồn!`);
      } else {
        showToast('Thư mục nguồn không chứa định dạng ảnh hợp lệ.');
      }
    } catch (err) {
      console.error('Failed to auto detect extensions:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Run File Filter Copy/Move Execution
  const handleExecuteRun = async () => {
    if (!currentSource || !currentDest) {
      showToast('Vui lòng chọn Thư mục nguồn và Thư mục đích!');
      return;
    }

    const filesToRun = previewResult?.matched_files || previewResult?.files || [];

    if (filesToRun.length === 0) {
      showToast('Không tìm thấy ảnh nào phù hợp với từ khoá và định dạng đã chọn!');
      return;
    }

    setIsExecuting(true);
    setShowExecutionModal(true);
    setProgressUpdate({
      runId: `run-${Date.now()}`,
      processedCount: 0,
      totalCount: filesToRun.length,
      currentFilename: 'Đang khởi tạo...',
      status: 'processing',
    });
    setRunResult(null);

    try {
      const result = await window.electronAPI.executeFilter(config, filesToRun);
      setRunResult(result);
      showToast(
        `Hoàn tất! Đã xử lý ${result.processed} file (${result.skipped} bỏ qua, ${result.errors} lỗi).`
      );
    } catch (err) {
      console.error('Execution error:', err);
      showToast('Có lỗi xảy ra trong quá trình lọc!');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancelExecution = async () => {
    try {
      await window.electronAPI.cancelRun();
      showToast('Đã gửi yêu cầu hủy tiến trình.');
    } catch (err) {
      console.error('Cancel error:', err);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-main)] font-sans overflow-hidden transition-colors duration-200">
      {/* App Top Menu Header (44px Height) */}
      <header className="h-11 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] px-4 flex items-center justify-between shrink-0 select-none z-20 transition-colors duration-200">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-[3px] bg-amber-500 flex items-center justify-center text-black font-bold">
            <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <span className="text-sm font-bold text-[var(--text-main)] tracking-tight">
            ShutterFilter by Tandev.foto
          </span>
        </div>

        {/* Navigation Tabs - Segmented Switcher */}
        <nav className="segmented-control">
          <button
            type="button"
            onClick={() => setActiveTab('filter')}
            className={`segmented-item ${activeTab === 'filter' ? 'active' : ''} flex items-center gap-1.5`}
          >
            <Filter className="w-3.5 h-3.5 text-amber-500" />
            <span>Lọc & Sắp Xếp</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`segmented-item ${activeTab === 'history' ? 'active' : ''} flex items-center gap-1.5`}
          >
            <History className="w-3.5 h-3.5 text-amber-500" />
            <span>Lịch Sử & Undo</span>
          </button>
        </nav>

        {/* Dark / Light Mode Toggle Button (Positioned at Top-Right Red Box Area) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-3 py-1 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-xs font-mono text-[var(--text-main)] border border-[var(--border-subtle)] transition-all duration-150 cursor-pointer active:scale-95 shadow-sm"
          title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng (Light Mode)' : 'Chuyển sang Giao diện Tối (Dark Mode)'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 font-semibold">Giao diện Sáng</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-zinc-700 font-semibold">Giao diện Tối</span>
            </>
          )}
        </button>
      </header>

      {/* Main App Workspace */}
      <main className="flex-1 overflow-hidden p-3 bg-[var(--bg-main)]">
        {activeTab === 'filter' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* Left Control Sidebar (4/12 width = ~380px) */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col space-y-3 overflow-y-auto pr-1">
              <FolderPicker
                config={config}
                onChange={handleConfigChange}
                isScanning={isScanning}
              />

              <FilterCriteria
                config={config}
                onChange={handleConfigChange}
                detectedExtensions={detectedExtensions}
              />

              <ModeAndPolicy
                config={config}
                onChange={handleConfigChange}
              />
            </div>

            {/* Right Preview Workstation Hub (7-8/12 width) */}
            <div className="lg:col-span-7 xl:col-span-8 h-full overflow-hidden">
              <PreviewTable
                config={config}
                previewResult={previewResult}
                onExecute={handleExecuteRun}
                isLoading={isScanning || isExecuting}
              />
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="h-full overflow-y-auto max-w-6xl mx-auto">
            <HistoryView />
          </div>
        )}
      </main>

      {/* Realtime Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
          <div className="bg-[var(--bg-card)] text-[var(--text-main)] text-xs px-4 py-2.5 rounded-lg border border-[var(--border-subtle)] shadow-2xl flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
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
        />
      )}
    </div>
  );
};
