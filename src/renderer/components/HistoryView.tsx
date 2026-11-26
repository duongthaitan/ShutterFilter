import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  History,
  Undo2,
  Calendar,
  FileText,
  RefreshCw,
  FolderOpen,
  Trash2,
  Search,
  AlertTriangle,
  X,
} from 'lucide-react';
import { RunLog, UndoResult } from '../../shared/types';

interface HistoryViewProps {
  onUndoComplete?: () => void;
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  onUndoComplete,
  onNotify,
}) => {
  const [historyLogs, setHistoryLogs] = useState<RunLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRun, setSelectedRun] = useState<RunLog | null>(null);
  const [detailStatusFilter, setDetailStatusFilter] = useState<
    'all' | 'success' | 'skipped' | 'error'
  >('all');
  const [pendingUndoRun, setPendingUndoRun] = useState<RunLog | null>(null);
  const [undoStatus, setUndoStatus] = useState<{
    loading: boolean;
    result: UndoResult | null;
  }>({
    loading: false,
    result: null,
  });

  useEffect(() => {
    loadHistoryList();
  }, []);

  useEffect(() => {
    if (!selectedRun && !pendingUndoRun) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingUndoRun) setPendingUndoRun(null);
        else if (selectedRun) setSelectedRun(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedRun, pendingUndoRun]);

  const loadHistoryList = async () => {
    setIsLoading(true);
    try {
      const logs = await window.electronAPI.listHistory();
      setHistoryLogs(logs);
    } catch (err) {
      console.error('Failed to load run history:', err);
      onNotify?.('Không thể tải lịch sử lọc ảnh.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmAndExecuteUndo = async () => {
    if (!pendingUndoRun) return;
    const targetRunId = pendingUndoRun.run_id;
    setPendingUndoRun(null);
    setUndoStatus({ loading: true, result: null });

    try {
      const res = await window.electronAPI.undoRun(targetRunId);
      setUndoStatus({ loading: false, result: res });
      await loadHistoryList();
      if (selectedRun && selectedRun.run_id === targetRunId && (res.success || res.deletedCount > 0 || res.restoredCount > 0)) {
        setSelectedRun({ ...selectedRun, undone: true });
      }
      onUndoComplete?.();
      onNotify?.(
        res.success
          ? 'Hoàn tác thành công.'
          : 'Hoàn tác xong với một số cảnh báo.',
        res.success ? 'success' : 'warning'
      );
    } catch (err) {
      console.error('Failed to undo run:', err);
      setUndoStatus({ loading: false, result: null });
      onNotify?.('Có lỗi xảy ra khi hoàn tác.', 'error');
    }
  };

  const handleDeleteLog = async (runId: string) => {
    try {
      const ok = await window.electronAPI.deleteHistoryEntry?.(runId);
      if (ok) {
        setHistoryLogs((prev) => prev.filter((item) => item.run_id !== runId));
        if (selectedRun?.run_id === runId) setSelectedRun(null);
        onNotify?.('Đã xóa bản ghi khỏi lịch sử.', 'info');
      }
    } catch {
      onNotify?.('Không thể xóa bản ghi lịch sử.', 'error');
    }
  };

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return historyLogs;
    const q = searchTerm.trim().toLowerCase();
    return historyLogs.filter(
      (log) =>
        log.run_id.toLowerCase().includes(q) ||
        log.source_folder.toLowerCase().includes(q) ||
        log.destination_folder.toLowerCase().includes(q) ||
        (log.preset_name || '').toLowerCase().includes(q)
    );
  }, [historyLogs, searchTerm]);

  const filteredFileMap = useMemo(() => {
    if (!selectedRun) return [];
    if (detailStatusFilter === 'all') return selectedRun.file_map;
    return selectedRun.file_map.filter((f) => f.status === detailStatusFilter);
  }, [selectedRun, detailStatusFilter]);

  return (
    <div className="panel-pro p-5 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-[var(--accent)]" />
          <div>
            <h2 className="text-sm font-bold text-[var(--text-main)]">
              Lịch Sử Các Lần Lọc (Run Log)
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Tra cứu chi tiết và hoàn tác (Undo) các đợt lọc ảnh đã thực thi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-[var(--text-dim)] pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm mã lượt, thư mục..."
              style={{ paddingLeft: '30px' }}
              className="input-pro py-1.5 text-xs font-mono w-52"
            />
          </div>
          <button
            type="button"
            onClick={loadHistoryList}
            disabled={isLoading}
            className="btn-secondary-pro text-xs"
            title="Làm mới danh sách lịch sử"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Undo Result Banner */}
      {undoStatus.result && (
        <div
          className={`p-3.5 rounded-[4px] border text-xs relative ${
            undoStatus.result.success
              ? 'bg-[var(--status-success-bg)] border-[var(--status-success-border)] text-[var(--status-success)]'
              : 'bg-[var(--status-warning-bg)] border-[var(--status-warning-border)] text-[var(--status-warning)]'
          }`}
        >
          <button
            type="button"
            onClick={() => setUndoStatus({ loading: false, result: null })}
            className="absolute top-2.5 right-2.5 opacity-70 hover:opacity-100 cursor-pointer"
            title="Ẩn thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="font-bold mb-1">
            {undoStatus.result.success
              ? 'Hoàn tác thành công'
              : 'Hoàn tác hoàn thành với một số cảnh báo'}
          </div>
          <div className="text-[var(--text-main)]">
            Đã xóa ở đích: <strong>{undoStatus.result.deletedCount}</strong> file | Đã
            khôi phục về nguồn: <strong>{undoStatus.result.restoredCount}</strong> file
          </div>
          {undoStatus.result.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5 font-mono text-[var(--status-danger)]">
              {undoStatus.result.errors.map((e, idx) => (
                <li key={idx}>- {e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* History List */}
      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-bar h-20 w-full" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-12 text-center text-[var(--text-muted)] flex flex-col items-center justify-center gap-2 border border-dashed border-[var(--border-subtle)] rounded-[6px]">
          <History className="w-6 h-6 text-[var(--text-dim)]" />
          <p className="text-xs">
            {searchTerm.trim()
              ? 'Không tìm thấy lượt lọc phù hợp với từ khóa.'
              : 'Chưa có lịch sử lần lọc nào được ghi nhận.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div
              key={log.run_id}
              className={`card-pro p-3.5 flex flex-wrap items-center justify-between gap-4 border-l-3 ${
                log.undone
                  ? 'border-l-[var(--text-dim)] opacity-70'
                  : log.errors > 0 || log.cancelled
                  ? 'border-l-[var(--status-warning)]'
                  : 'border-l-[var(--status-success)]'
              }`}
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--text-main)]">
                    {log.run_id}
                  </span>
                  <span className="badge-pro badge-amber">
                    {log.mode.toUpperCase()}
                  </span>
                  {log.cancelled && (
                    <span className="badge-pro badge-neutral">ĐÃ HỦY GIỮA CHỪNG</span>
                  )}
                  {log.undone ? (
                    <span className="badge-pro badge-rose">ĐÃ HOÀN TÁC</span>
                  ) : (
                    <span className="badge-pro badge-emerald">HOẠT ĐỘNG</span>
                  )}
                  {log.preset_name && (
                    <span className="badge-pro badge-neutral">{log.preset_name}</span>
                  )}
                </div>

                <div className="text-[11px] text-[var(--text-muted)] flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                  <span className="flex items-center gap-1 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-[var(--text-dim)]" />
                    {new Date(log.timestamp).toLocaleString('vi-VN')}
                  </span>
                  <span className="truncate max-w-sm" title={log.source_folder}>
                    Nguồn: {log.source_folder}
                  </span>
                  <span className="truncate max-w-sm" title={log.destination_folder}>
                    Đích: {log.destination_folder}
                  </span>
                </div>
              </div>

              {/* Stats & Actions */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="text-right text-xs font-mono">
                  <div className="text-[var(--text-main)]">
                    Xử lý:{' '}
                    <strong className="text-[var(--accent-strong)]">
                      {log.processed}
                    </strong>{' '}
                    / {log.total_matched} file
                  </div>
                  <div className="text-[var(--text-dim)] text-[11px]">
                    Bỏ qua: {log.skipped_duplicate} | Lỗi: {log.errors}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      window.electronAPI?.openFolder(log.destination_folder)
                    }
                    className="btn-secondary-pro text-xs px-2.5"
                    title="Mở thư mục đích của lần chạy này"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-[var(--accent)]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDetailStatusFilter('all');
                      setSelectedRun(log);
                    }}
                    className="btn-secondary-pro text-xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>Chi tiết</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPendingUndoRun(log)}
                    disabled={log.undone || undoStatus.loading || log.processed === 0}
                    className="btn-secondary-pro text-xs text-[var(--status-danger)] hover:border-[var(--status-danger-border)]"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>{log.undone ? 'Đã Undo' : 'Undo'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteLog(log.run_id)}
                    className="p-1.5 rounded-[4px] text-[var(--text-dim)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] transition-colors cursor-pointer"
                    title="Xóa bản ghi nhật ký này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Styled Undo Confirmation Modal via Portal */}
      {pendingUndoRun &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Xác nhận Hoàn tác"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in"
            onClick={() => setPendingUndoRun(null)}
          >
            <div
              className="panel-pro max-w-md w-full p-5 space-y-4 animate-modal-pop"
              style={{ boxShadow: 'var(--shadow-modal)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 text-[var(--status-danger)]">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold text-[var(--text-main)]">
                  Xác nhận Hoàn tác (Undo)
                </h3>
              </div>

              <p className="text-xs text-[var(--text-main)] leading-relaxed">
                {pendingUndoRun.mode === 'copy' ? (
                  <>
                    Hệ thống sẽ <strong>xóa {pendingUndoRun.processed} file đã sao chép</strong>{' '}
                    trong thư mục đích (ảnh gốc tại nguồn vẫn nguyên vẹn).
                  </>
                ) : (
                  <>
                    Hệ thống sẽ <strong>di chuyển ngược {pendingUndoRun.processed} file</strong>{' '}
                    từ thư mục đích trở lại đúng vị trí ban đầu tại thư mục nguồn.
                  </>
                )}
              </p>

              <div className="p-2.5 rounded-[4px] bg-[var(--bg-card-inset)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-muted)]">
                Mã lượt: <strong className="text-[var(--text-main)]">{pendingUndoRun.run_id}</strong>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setPendingUndoRun(null)}
                  className="btn-secondary-pro text-xs"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={confirmAndExecuteUndo}
                  className="btn-accent text-xs px-4"
                >
                  Xác nhận Hoàn tác
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Details File Map Modal via Portal */}
      {selectedRun &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết lượt chạy"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in"
            onClick={() => setSelectedRun(null)}
          >
            <div
              className="panel-pro max-w-4xl w-full p-5 max-h-[85vh] flex flex-col animate-modal-pop"
              style={{ boxShadow: 'var(--shadow-modal)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-main)]">
                    Chi tiết lượt chạy: {selectedRun.run_id}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] font-mono">
                    {new Date(selectedRun.timestamp).toLocaleString('vi-VN')} |{' '}
                    {selectedRun.mode.toUpperCase()}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {(['all', 'success', 'skipped', 'error'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setDetailStatusFilter(st)}
                      className={`px-2 py-1 rounded-[4px] text-[11px] font-medium border cursor-pointer transition-colors ${
                        detailStatusFilter === st
                          ? 'bg-[var(--accent-bg-alpha)] border-[var(--accent-border-alpha)] text-[var(--accent-strong)] font-semibold'
                          : 'bg-[var(--bg-card-inset)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      {st === 'all'
                        ? `Tất cả (${selectedRun.file_map.length})`
                        : st === 'success'
                        ? `Thành công (${selectedRun.processed})`
                        : st === 'skipped'
                        ? `Bỏ qua (${selectedRun.skipped_duplicate})`
                        : `Lỗi (${selectedRun.errors})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* File Map Table */}
              <div className="overflow-y-auto flex-1 rounded-[4px] border border-[var(--border-subtle)] my-3">
                <table className="w-full text-left text-xs font-mono text-[var(--text-main)]">
                  <thead className="bg-[var(--table-header-bg)] sticky top-0 border-b border-[var(--border-subtle)] text-[var(--text-muted)] uppercase text-[10px]">
                    <tr>
                      <th className="p-2">File</th>
                      <th className="p-2">Trạng thái</th>
                      <th className="p-2">Nguồn</th>
                      <th className="p-2">Đích</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--table-divide)]">
                    {filteredFileMap.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-6 text-center text-[var(--text-muted)]"
                        >
                          Không có file nào ở trạng thái này.
                        </td>
                      </tr>
                    ) : (
                      filteredFileMap.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-[var(--table-row-hover)]">
                          <td className="p-2 font-semibold text-[var(--text-main)]">
                            {entry.filename}
                          </td>
                          <td className="p-2">
                            {entry.status === 'success' ? (
                              <span className="badge-pro badge-emerald">THÀNH CÔNG</span>
                            ) : entry.status === 'skipped' ? (
                              <span
                                className="badge-pro badge-amber"
                                title={entry.errorReason}
                              >
                                BỎ QUA
                              </span>
                            ) : (
                              <span
                                className="badge-pro badge-rose"
                                title={entry.errorReason}
                              >
                                LỖI
                              </span>
                            )}
                          </td>
                          <td
                            className="p-2 text-[var(--text-muted)] truncate max-w-xs"
                            title={entry.source}
                          >
                            {entry.source}
                          </td>
                          <td
                            className="p-2 text-[var(--text-muted)] truncate max-w-xs"
                            title={entry.destination}
                          >
                            {entry.destination || entry.errorReason || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setPendingUndoRun(selectedRun)}
                  disabled={
                    selectedRun.undone ||
                    undoStatus.loading ||
                    selectedRun.processed === 0
                  }
                  className="btn-secondary-pro text-xs text-[var(--status-danger)]"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>
                    {selectedRun.undone
                      ? 'Đã được Hoàn tác'
                      : 'Hoàn tác lần chạy này'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRun(null)}
                  className="btn-accent text-xs px-4"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
