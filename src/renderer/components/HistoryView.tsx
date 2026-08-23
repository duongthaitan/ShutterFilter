import React, { useState, useEffect } from 'react';
import { History, Undo2, Calendar, FileText } from 'lucide-react';
import { RunLog, UndoResult } from '../../shared/types';

export const HistoryView: React.FC = () => {
  const [historyLogs, setHistoryLogs] = useState<RunLog[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunLog | null>(null);
  const [undoStatus, setUndoStatus] = useState<{ loading: boolean; result: UndoResult | null }>({
    loading: false,
    result: null,
  });

  useEffect(() => {
    loadHistoryList();
  }, []);

  const loadHistoryList = async () => {
    try {
      const logs = await window.electronAPI.listHistory();
      setHistoryLogs(logs);
    } catch (err) {
      console.error('Failed to load run history:', err);
    }
  };

  const handleUndoRun = async (runId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn HOÀN TÁC (Undo) lần lọc này? Các thao tác copy/move sẽ được khôi phục ngược lại.')) {
      return;
    }

    setUndoStatus({ loading: true, result: null });
    try {
      const res = await window.electronAPI.undoRun(runId);
      setUndoStatus({ loading: false, result: res });
      await loadHistoryList();
      if (selectedRun && selectedRun.run_id === runId) {
        setSelectedRun({ ...selectedRun, undone: true });
      }
    } catch (err) {
      console.error('Failed to undo run:', err);
      setUndoStatus({ loading: false, result: null });
    }
  };

  return (
    <div className="panel-pro p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-sm font-bold text-[var(--text-main)]">Lịch Sử Các Lần Lọc (Run Log)</h2>
            <p className="text-xs text-[var(--text-muted)]">Tra cứu chi tiết và hoàn tác (Undo) các đợt lọc ảnh đã thực thi.</p>
          </div>
        </div>
      </div>

      {/* Undo Notification banner */}
      {undoStatus.result && (
        <div
          className={`p-3.5 rounded-[4px] border text-xs ${
            undoStatus.result.success
              ? 'bg-[var(--bg-card-inset)] border-emerald-500/40 text-emerald-500'
              : 'bg-[var(--bg-card-inset)] border-amber-500/40 text-amber-500'
          }`}
        >
          <div className="font-bold mb-1">
            {undoStatus.result.success
              ? 'Hoàn tác thành công!'
              : 'Hoàn tác hoàn thành có một số cảnh báo:'}
          </div>
          <div>
            Đã xóa ở đích: <strong>{undoStatus.result.deletedCount}</strong> file · Đã di chuyển lại nguồn: <strong>{undoStatus.result.restoredCount}</strong> file
          </div>
          {undoStatus.result.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5 font-mono text-rose-500">
              {undoStatus.result.errors.map((e, idx) => (
                <li key={idx}>• {e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {historyLogs.length === 0 ? (
        <div className="py-12 text-center text-[var(--text-muted)] flex flex-col items-center justify-center gap-2 border border-dashed border-[var(--border-subtle)] rounded-[4px]">
          <History className="w-6 h-6 text-[var(--text-dim)]" />
          <p className="text-xs">Chưa có lịch sử lần lọc nào được ghi nhận.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {historyLogs.map((log) => (
            <div
              key={log.run_id}
              className={`card-pro p-3.5 flex flex-wrap items-center justify-between gap-4 border-l-2 transition-all rounded-[4px] ${
                log.undone
                  ? 'border-l-zinc-500 opacity-60'
                  : log.errors > 0
                  ? 'border-l-amber-500'
                  : 'border-l-emerald-500'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--text-main)]">
                    {log.run_id}
                  </span>
                  <span className="badge-pro badge-amber">{log.mode.toUpperCase()}</span>
                  {log.undone ? (
                    <span className="badge-pro badge-rose">UNDONE</span>
                  ) : (
                    <span className="badge-pro badge-emerald">ACTIVE</span>
                  )}
                </div>

                <div className="text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-3 font-mono text-[11px]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[var(--text-dim)]" />
                    {new Date(log.timestamp).toLocaleString('vi-VN')}
                  </span>
                  <span>Nguồn: {log.source_folder}</span>
                  <span>Đích: {log.destination_folder}</span>
                </div>
              </div>

              {/* Stats & Actions */}
              <div className="flex items-center gap-4">
                <div className="text-right text-xs font-mono">
                  <div className="text-[var(--text-main)]">
                    Xử lý: <strong className="text-amber-500">{log.processed}</strong> / {log.total_matched} file
                  </div>
                  <div className="text-[var(--text-dim)] text-[11px]">
                    Trùng: {log.skipped_duplicate} · Lỗi: {log.errors}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRun(log)}
                    className="btn-secondary-pro text-xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-[var(--text-dim)]" />
                    <span>Chi tiết</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUndoRun(log.run_id)}
                    disabled={log.undone || undoStatus.loading}
                    className="btn-secondary-pro text-xs text-rose-500 hover:border-rose-400 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>{log.undone ? 'Đã Undo' : 'Undo'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details File Map Modal */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="panel-pro max-w-3xl w-full p-5 max-h-[85vh] flex flex-col bg-[var(--bg-panel)] border-[var(--border-subtle)] rounded-[4px] animate-modal-pop shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <h3 className="text-xs font-bold text-[var(--text-main)]">Chi tiết lượt chạy: {selectedRun.run_id}</h3>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {new Date(selectedRun.timestamp).toLocaleString('vi-VN')} · {selectedRun.mode.toUpperCase()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="btn-secondary-pro text-xs"
              >
                Đóng
              </button>
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
                  {selectedRun.file_map.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-[var(--table-row-hover)]">
                      <td className="p-2 font-semibold text-[var(--text-main)]">{entry.filename}</td>
                      <td className="p-2">
                        {entry.status === 'success' ? (
                          <span className="badge-pro badge-emerald">THÀNH CÔNG</span>
                        ) : entry.status === 'skipped' ? (
                          <span className="badge-pro badge-amber">BỎ QUA</span>
                        ) : (
                          <span className="badge-pro badge-rose" title={entry.errorReason}>LỖI</span>
                        )}
                      </td>
                      <td className="p-2 text-[var(--text-muted)] truncate max-w-xs">{entry.source}</td>
                      <td className="p-2 text-[var(--text-muted)] truncate max-w-xs">{entry.destination}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => handleUndoRun(selectedRun.run_id)}
                disabled={selectedRun.undone || undoStatus.loading}
                className="btn-secondary-pro text-xs text-rose-500"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>{selectedRun.undone ? 'Đã được Hoàn tác' : 'Hoàn tác ngay lần chạy này'}</span>
              </button>

              <button type="button" onClick={() => setSelectedRun(null)} className="btn-accent text-xs">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
