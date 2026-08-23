import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  StopCircle,
  FileCheck,
  FolderOpen,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { ProgressUpdate, RunResult, FilterConfig } from '../../shared/types';

interface ExecutionModalProps {
  progress: ProgressUpdate | null;
  result: RunResult | null;
  config?: FilterConfig;
  onCancel: () => void;
  onClose: () => void;
}

export const ExecutionModal: React.FC<ExecutionModalProps> = ({
  progress,
  result,
  config,
  onCancel,
  onClose,
}) => {
  const isCompleted = progress?.status === 'completed' || result !== null;
  const isCancelled = progress?.status === 'cancelled';

  const processedCount = result ? result.processed : progress?.processedCount || 0;
  const totalCount = result ? result.total_matched : progress?.totalCount || 1;
  const percent = Math.min(100, Math.round((processedCount / Math.max(1, totalCount)) * 100));

  const targetFolder = config?.destFolder || config?.destination_folder || result?.file_map?.[0]?.destination || '';

  const handleOpenFolder = async () => {
    if (!targetFolder) return;
    if (window.electronAPI?.openFolder) {
      await window.electronAPI.openFolder(targetFolder);
    }
  };

  const handleImportPhotoshop = async () => {
    const successFiles = result?.file_map?.filter((f) => f.status === 'success').map((f) => f.destination) || [];
    if (window.electronAPI?.openPhotoshop) {
      await window.electronAPI.openPhotoshop({
        folderPath: targetFolder,
        filePaths: successFiles,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="panel-pro max-w-xl w-full p-6 space-y-4 bg-[var(--bg-panel)] border-[var(--border-subtle)] rounded-[4px] relative shadow-2xl animate-modal-pop">
        {/* Top-Right Red Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-rose-500/20 hover:bg-rose-500/35 text-rose-500 border border-rose-500/40 flex items-center justify-center transition-all duration-150 cursor-pointer shadow-md active:scale-90"
          title="Đóng cửa sổ"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] pr-10">
          <div className="flex items-center gap-2.5">
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : isCancelled ? (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            ) : (
              <FileCheck className="w-5 h-5 text-amber-500 animate-pulse" />
            )}
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              {isCompleted
                ? 'Tiến trình lọc hoàn tất!'
                : isCancelled
                ? 'Đã hủy bỏ tiến trình'
                : 'Đang xử lý ảnh...'}
            </h3>
          </div>

          {!isCompleted && !isCancelled && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary-pro text-xs text-rose-500 hover:border-rose-400 active:scale-95"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>Hủy tiến trình</span>
            </button>
          )}
        </div>

        {/* Realtime Amber Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-main)]">
            <span>
              Đã xử lý: <strong>{processedCount}</strong> / {totalCount} file
            </span>
            <span className="text-amber-500 font-bold">{percent}%</span>
          </div>

          <div className="w-full bg-[var(--bg-card-inset)] rounded-[3px] h-2 overflow-hidden border border-[var(--border-subtle)]">
            <div
              className={`h-full transition-all duration-200 ease-out ${
                isCompleted
                  ? 'bg-emerald-500'
                  : isCancelled
                  ? 'bg-amber-600'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          {!isCompleted && (
            <p className="text-xs font-mono text-[var(--text-muted)] truncate">
              Đang xử lý: {progress?.currentFilename || 'Khởi tạo...'}
            </p>
          )}
        </div>

        {/* Error Details List if any */}
        {result && result.errorList.length > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-[4px] p-3 max-h-32 overflow-y-auto space-y-1">
            <div className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-500" />
              <span>Danh sách file gặp lỗi ({result.errorList.length})</span>
            </div>
            <ul className="text-xs font-mono text-rose-600/90 space-y-1">
              {result.errorList.map((err, idx) => (
                <li key={idx}>
                  <strong>{err.filename}</strong>: {err.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
          {(isCompleted || isCancelled) && (
            <>
              {/* Button 1: Open Destination Folder */}
              <button
                type="button"
                onClick={handleOpenFolder}
                className="px-3.5 py-2 rounded-[4px] text-xs font-semibold bg-[var(--bg-card-inset)] hover:bg-[var(--bg-card-hover)] text-amber-500 border border-[var(--border-subtle)] transition-all duration-150 flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
              >
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <span>Mở thư mục ảnh đã lọc</span>
              </button>

              {/* Button 2: Import into Photoshop */}
              <button
                type="button"
                onClick={handleImportPhotoshop}
                className="btn-accent text-xs px-4 py-2 flex items-center gap-2 active:scale-95"
              >
                <ImageIcon className="w-4 h-4 fill-current" />
                <span>Import vào Photoshop</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
