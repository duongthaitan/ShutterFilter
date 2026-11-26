import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ExecutionModal: React.FC<ExecutionModalProps> = ({
  progress,
  result,
  config,
  onCancel,
  onClose,
  onNotify,
}) => {
  const isError = progress?.status === 'error';
  const isCancelled = Boolean(result?.cancelled) || progress?.status === 'cancelled';
  const isCompleted =
    !isError && !isCancelled && (progress?.status === 'completed' || result !== null);
  const isRunning = !isCompleted && !isCancelled && !isError;

  const totalCount = result ? result.total_matched : progress?.totalCount || 1;
  const handledCount = result
    ? result.processed + result.skipped + result.errors
    : progress?.processedCount || 0;
  const percent = isCompleted
    ? 100
    : Math.min(100, Math.round((handledCount / Math.max(1, totalCount)) * 100));

  const targetFolder =
    result?.destination_folder ||
    config?.destFolder ||
    config?.destination_folder ||
    '';

  useEffect(() => {
    if (isRunning) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isRunning, onClose]);

  const handleOpenFolder = async () => {
    if (!targetFolder) return;
    if (window.electronAPI?.openFolder) {
      const ok = await window.electronAPI.openFolder(targetFolder);
      if (!ok) {
        onNotify?.('Không thể mở thư mục đích.', 'error');
      }
    }
  };

  const handleImportPhotoshop = async () => {
    const successFiles =
      result?.file_map
        ?.filter((f) => f.status === 'success')
        .map((f) => f.destination) || [];
    if (window.electronAPI?.openPhotoshop) {
      const res = await window.electronAPI.openPhotoshop({
        folderPath: targetFolder,
        filePaths: successFiles,
      });
      if (res?.message) {
        onNotify?.(res.message, res.fallback ? 'warning' : 'success');
      }
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tiến trình lọc ảnh"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in"
      onClick={() => {
        if (!isRunning) onClose();
      }}
    >
      <div
        className="panel-pro max-w-xl w-full p-5 space-y-4 relative animate-modal-pop"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Close Button (locked while actively running) */}
        {!isRunning && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-[var(--status-danger-bg)] hover:opacity-90 text-[var(--status-danger)] border border-[var(--status-danger-border)] flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Đóng cửa sổ (Esc)"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] pr-10">
          <div className="flex items-center gap-2.5">
            {isError ? (
              <XCircle className="w-5 h-5 text-[var(--status-danger)] shrink-0" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-[var(--status-success)] shrink-0" />
            ) : isCancelled ? (
              <AlertTriangle className="w-5 h-5 text-[var(--status-warning)] shrink-0" />
            ) : (
              <FileCheck className="w-5 h-5 text-[var(--accent)] animate-pulse shrink-0" />
            )}
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              {isError
                ? 'Không thể thực thi lọc ảnh'
                : isCompleted
                ? 'Tiến trình lọc hoàn tất'
                : isCancelled
                ? 'Đã hủy bỏ tiến trình'
                : 'Đang xử lý ảnh...'}
            </h3>
          </div>

          {isRunning && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary-pro text-xs text-[var(--status-danger)] border-[var(--status-danger-border)]"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>Hủy tiến trình</span>
            </button>
          )}
        </div>

        {/* Error Message Block */}
        {isError ? (
          <div className="p-3.5 rounded-[4px] bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-xs text-[var(--status-danger)] space-y-1">
            <div className="font-bold">Chi tiết lỗi</div>
            <p className="font-mono leading-relaxed break-words">
              {progress?.errorMsg || 'Đã xảy ra lỗi không xác định trong quá trình xử lý.'}
            </p>
          </div>
        ) : (
          /* Progress Bar + Stats */
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-[var(--text-main)]">
                <span>
                  Tiến độ: <strong>{handledCount.toLocaleString('vi-VN')}</strong> /{' '}
                  {totalCount.toLocaleString('vi-VN')} file
                </span>
                <span className="text-[var(--accent-strong)] font-bold">{percent}%</span>
              </div>

              <div className="w-full bg-[var(--bg-card-inset)] rounded-[3px] h-2 overflow-hidden border border-[var(--border-subtle)]">
                <div
                  className={`h-full transition-all duration-200 ease-out ${
                    isCompleted
                      ? 'bg-[var(--status-success)]'
                      : isCancelled
                      ? 'bg-[var(--status-warning)]'
                      : 'bg-[var(--accent)]'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              {isRunning && (
                <p className="text-xs font-mono text-[var(--text-muted)] truncate">
                  Đang xử lý: {progress?.currentFilename || 'Khởi tạo...'}
                </p>
              )}
            </div>

            {result && (
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="p-2.5 rounded-[4px] bg-[var(--status-success-bg)] border border-[var(--status-success-border)]">
                  <div className="text-[10px] uppercase text-[var(--text-muted)]">Thành công</div>
                  <div className="text-base font-bold text-[var(--status-success)]">
                    {result.processed.toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="p-2.5 rounded-[4px] bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)]">
                  <div className="text-[10px] uppercase text-[var(--text-muted)]">Bỏ qua</div>
                  <div className="text-base font-bold text-[var(--status-warning)]">
                    {result.skipped.toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="p-2.5 rounded-[4px] bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)]">
                  <div className="text-[10px] uppercase text-[var(--text-muted)]">Lỗi</div>
                  <div className="text-base font-bold text-[var(--status-danger)]">
                    {result.errors.toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Details List if any */}
        {result && result.errorList.length > 0 && (
          <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-[4px] p-3 max-h-32 overflow-y-auto space-y-1.5">
            <div className="text-xs font-bold text-[var(--status-danger)] flex items-center gap-1.5">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>Danh sách file gặp lỗi ({result.errorList.length})</span>
            </div>
            <ul className="text-xs font-mono text-[var(--status-danger)] space-y-1">
              {result.errorList.map((err, idx) => (
                <li key={idx}>
                  <strong>{err.filename}</strong>: {err.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer Action Buttons */}
        {!isRunning && (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
            {isError ? (
              <button type="button" onClick={onClose} className="btn-accent text-xs px-4">
                Đóng
              </button>
            ) : (
              <>
                {targetFolder && (
                  <button
                    type="button"
                    onClick={handleOpenFolder}
                    className="btn-secondary-pro text-xs text-[var(--accent-strong)]"
                  >
                    <FolderOpen className="w-4 h-4 text-[var(--accent)]" />
                    <span>Mở thư mục đích</span>
                  </button>
                )}

                {result && result.processed > 0 && (
                  <button
                    type="button"
                    onClick={handleImportPhotoshop}
                    className="btn-accent text-xs px-4"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Mở bằng Photoshop</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
