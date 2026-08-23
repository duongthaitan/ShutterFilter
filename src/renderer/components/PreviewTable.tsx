import React, { useState, useMemo, useEffect } from 'react';
import {
  Eye,
  Play,
  Search,
  FileImage,
  AlertTriangle,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { FilterConfig, FileEntry, PreviewResult } from '../../shared/types';

interface PreviewTableProps {
  config: FilterConfig;
  previewResult: PreviewResult | null;
  onRunPreview?: () => void;
  onExecute: () => void;
  isLoading: boolean;
}

export const PreviewTable: React.FC<PreviewTableProps> = ({
  config,
  previewResult,
  onExecute,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [previewImageModalFile, setPreviewImageModalFile] = useState<FileEntry | null>(null);
  const [rawThumbnailUrl, setRawThumbnailUrl] = useState<string | null>(null);
  const [isLoadingRaw, setIsLoadingRaw] = useState(false);

  // Pagination states for 10,000+ images high performance
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const matchedList: FileEntry[] = useMemo(() => {
    if (!previewResult) return [];
    return previewResult.matched_files || previewResult.files || [];
  }, [previewResult]);

  const filteredMatches = useMemo(() => {
    if (!matchedList.length) return [];
    if (!searchTerm.trim()) return matchedList;

    const term = searchTerm.toLowerCase();
    return matchedList.filter((f) =>
      (f.filename || f.name || '').toLowerCase().includes(term)
    );
  }, [matchedList, searchTerm]);

  // Reset to page 1 on search or result changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, previewResult]);

  // Auto-load RAW thumbnail when lightbox opens for a RAW file
  const RAW_EXTENSIONS = ['arw', 'cr2', 'cr3', 'nef', 'dng', 'raf', 'orf', 'rw2'];
  useEffect(() => {
    if (!previewImageModalFile) {
      setRawThumbnailUrl(null);
      setIsLoadingRaw(false);
      return;
    }
    const ext = (previewImageModalFile.extension || '').toLowerCase().replace(/^\./, '');
    const filePath = previewImageModalFile.sourcePath || previewImageModalFile.path || '';
    if (RAW_EXTENSIONS.includes(ext) && filePath && window.electronAPI?.getRawThumbnail) {
      setIsLoadingRaw(true);
      setRawThumbnailUrl(null);
      window.electronAPI.getRawThumbnail(filePath)
        .then((url) => {
          setRawThumbnailUrl(url);
        })
        .catch(() => {
          setRawThumbnailUrl(null);
        })
        .finally(() => {
          setIsLoadingRaw(false);
        });
    }
  }, [previewImageModalFile]);

  const totalPages = Math.ceil(filteredMatches.length / pageSize) || 1;

  const paginatedMatches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMatches.slice(start, start + pageSize);
  }, [filteredMatches, currentPage, pageSize]);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const totalCount = previewResult?.total_matched ?? previewResult?.totalCount ?? matchedList.length;

  const totalSizeBytes = useMemo(() => {
    if (previewResult?.total_size !== undefined) return previewResult.total_size;
    if (previewResult?.totalSizeBytes !== undefined) return previewResult.totalSizeBytes;
    return matchedList.reduce((acc, f) => acc + (f.sizeBytes || f.size || 0), 0);
  }, [previewResult, matchedList]);

  const destPath = config.destFolder || config.destination_folder || '';

  const getFileThumbnailUrl = (file: FileEntry): string => {
    const rawPath = file.sourcePath || file.path || '';
    if (!rawPath) return '';
    if (rawPath.startsWith('file://') || rawPath.startsWith('blob:') || rawPath.startsWith('data:')) {
      return rawPath;
    }
    return `file:///${rawPath.replace(/\\/g, '/')}`;
  };

  const handleImageError = (id: string) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  const startRange = filteredMatches.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRange = Math.min(currentPage * pageSize, filteredMatches.length);

  return (
    <div className="panel-pro h-full flex flex-col overflow-hidden animate-fade-in">
      {/* Workstation Header Toolbar */}
      <div className="p-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-[var(--text-main)] flex items-center gap-2 bg-[var(--bg-card-inset)] px-3 py-1.5 rounded-[4px] border border-[var(--border-subtle)] transition-all duration-200">
            <span className="text-amber-500 font-bold">
              {totalCount.toLocaleString('vi-VN')} ảnh khớp
            </span>
            <span className="text-[var(--text-dim)]">•</span>
            <span>{formatFileSize(totalSizeBytes)}</span>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2">
          {config.mode === 'move' && (
            <span className="text-[11px] font-mono text-amber-500 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-[4px] border border-amber-500/30">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span>Chế độ Di Chuyển</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              if (!config.extensions || config.extensions.length === 0) {
                onExecute();
              } else {
                setConfirmModalOpen(true);
              }
            }}
            disabled={
              isLoading ||
              !previewResult ||
              totalCount === 0 ||
              !destPath
            }
            className="btn-accent text-xs px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-none"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>
              Chạy Lọc Ảnh ({totalCount.toLocaleString('vi-VN')} ảnh)
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {previewResult ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter Sub-bar */}
          <div className="px-3.5 py-2 bg-[var(--bg-card-inset)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="relative flex-1 max-w-xs flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-[var(--text-dim)] pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Lọc tên file trong kết quả..."
                style={{ paddingLeft: '30px' }}
                className="input-pro py-1.5 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-mono">
              <span>Hiển thị {startRange.toLocaleString('vi-VN')} - {endRange.toLocaleString('vi-VN')} / {filteredMatches.length.toLocaleString('vi-VN')} ảnh</span>
            </div>
          </div>

          {/* Table Container - Ultra Fast Rendered Pages with Smooth 60fps Micro-Interactions */}
          <div className="flex-1 overflow-auto bg-[var(--bg-main)]">
            {filteredMatches.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)] space-y-2 animate-fade-in">
                <FileImage className="w-8 h-8 text-[var(--text-dim)]" />
                <p className="text-xs">Không tìm thấy ảnh khớp với từ khoá tìm kiếm.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="bg-[var(--table-header-bg)] sticky top-0 z-10 border-b border-[var(--border-subtle)] text-[var(--text-muted)] uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-2.5 w-14 text-center">Ảnh</th>
                    <th className="p-2.5">Tên file</th>
                    <th className="p-2.5 w-24">Định dạng</th>
                    <th className="p-2.5 w-24 text-right">Dung lượng</th>
                    <th className="p-2.5 w-36">Ngày chụp / sửa</th>
                    <th className="p-2.5">Đường dẫn nguồn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--table-divide)]">
                  {paginatedMatches.map((file) => {
                    const fileName = file.filename || file.name || '';
                    const filePath = file.sourcePath || file.path || '';
                    const fileSize = file.sizeBytes ?? file.size ?? 0;
                    const fileId = file.id || filePath || fileName;
                    const extUpper = (file.extension || '').toUpperCase().replace(/^\./, '');
                    const isRaw = [
                      'ARW',
                      'CR2',
                      'CR3',
                      'NEF',
                      'DNG',
                      'RAF',
                      'ORF',
                      'RW2',
                    ].includes(extUpper);

                    const imgUrl = getFileThumbnailUrl(file);
                    const hasFailedImg = failedImages[fileId];

                    return (
                      <tr
                        key={fileId}
                        className="hover:bg-[var(--table-row-hover)] transition-colors duration-150 group"
                      >
                        {/* Thumbnail Column with Interactive Click to Open Lightbox Preview */}
                        <td className="p-2 w-14 text-center align-middle">
                          <div
                            onClick={() => setPreviewImageModalFile(file)}
                            className="w-10 h-10 rounded-[4px] bg-[var(--bg-card-inset)] border border-[var(--border-subtle)] group-hover:border-amber-500 overflow-hidden flex items-center justify-center mx-auto shrink-0 cursor-pointer transition-all duration-200 relative shadow-sm active:scale-95"
                            title="Bấm vào đây để xem ảnh phóng to"
                          >
                            {imgUrl && !hasFailedImg ? (
                              <img
                                src={imgUrl}
                                alt={fileName}
                                onError={() => handleImageError(fileId)}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200 ease-out"
                                loading="lazy"
                              />
                            ) : (
                              <FileImage className="w-5 h-5 text-amber-500 stroke-[1.5]" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                              <Eye className="w-4 h-4 text-amber-300 drop-shadow scale-90 group-hover:scale-100 transition-transform duration-150" />
                            </div>
                          </div>
                        </td>

                        {/* File Name Column */}
                        <td className="p-2.5 font-semibold text-[var(--text-main)] align-middle">
                          <div className="flex items-center gap-2">
                            <span className="group-hover:text-amber-500 transition-colors duration-150">{fileName}</span>
                          </div>
                        </td>

                        {/* Format Badge Column */}
                        <td className="p-2.5 align-middle">
                          <span
                            className={`badge-pro ${
                              isRaw ? 'badge-amber' : 'badge-neutral'
                            }`}
                          >
                            .{extUpper.toLowerCase()}
                          </span>
                        </td>

                        {/* File Size Column */}
                        <td className="p-2.5 text-right text-[var(--text-muted)] font-mono align-middle">
                          {formatFileSize(fileSize)}
                        </td>

                        {/* Date Column */}
                        <td className="p-2.5 text-[var(--text-dim)] text-[11px] align-middle">
                          {file.dateTaken || (file.mtime ? new Date(file.mtime).toLocaleDateString('vi-VN') : '—')}
                        </td>

                        {/* Source Path Column */}
                        <td className="p-2.5 text-[var(--text-dim)] truncate max-w-xs text-[11px] align-middle" title={filePath}>
                          {filePath}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* High-Performance Pagination Bar */}
          {filteredMatches.length > 0 && (
            <div className="p-2.5 bg-[var(--bg-panel)] border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs font-mono shrink-0">
              <div className="flex items-center gap-3 text-[var(--text-muted)]">
                <span>
                  Trang <strong className="text-amber-500">{currentPage}</strong> / {totalPages}
                </span>

                <div className="flex items-center gap-1.5 text-[var(--text-dim)] pl-2 border-l border-[var(--border-subtle)]">
                  <span>Hiển thị</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-[var(--bg-card-inset)] border border-[var(--border-subtle)] text-[var(--text-main)] rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    <option value={50}>50 dòng/trang</option>
                    <option value={100}>100 dòng/trang</option>
                    <option value={250}>250 dòng/trang</option>
                    <option value={500}>500 dòng/trang</option>
                  </select>
                </div>
              </div>

              {/* Navigation Page Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 bg-[var(--bg-card-inset)] hover:bg-[var(--bg-card-hover)] active:scale-95 disabled:opacity-30 text-[var(--text-main)] rounded border border-[var(--border-subtle)] transition-all duration-150 flex items-center gap-0.5 cursor-pointer"
                  title="Trang đầu"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Đầu</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 bg-[var(--bg-card-inset)] hover:bg-[var(--bg-card-hover)] active:scale-95 disabled:opacity-30 text-[var(--text-main)] rounded border border-[var(--border-subtle)] transition-all duration-150 flex items-center gap-0.5 cursor-pointer"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Trước</span>
                </button>

                <span className="px-3 py-1 bg-[var(--bg-card-inset)] border border-[var(--border-subtle)] rounded text-amber-500 font-bold">
                  {currentPage}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 bg-[var(--bg-card-inset)] hover:bg-[var(--bg-card-hover)] active:scale-95 disabled:opacity-30 text-[var(--text-main)] rounded border border-[var(--border-subtle)] transition-all duration-150 flex items-center gap-0.5 cursor-pointer"
                  title="Trang sau"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 bg-[var(--bg-card-inset)] hover:bg-[var(--bg-card-hover)] active:scale-95 disabled:opacity-30 text-[var(--text-main)] rounded border border-[var(--border-subtle)] transition-all duration-150 flex items-center gap-0.5 cursor-pointer"
                  title="Trang cuối"
                >
                  <span className="hidden sm:inline">Cuối</span>
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty Preview State */
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-[var(--text-muted)] space-y-3 animate-fade-in bg-[var(--bg-panel)]">
          <div className="w-12 h-12 rounded-full bg-[var(--bg-card-inset)] border border-[var(--border-subtle)] flex items-center justify-center shadow-lg">
            <Info className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--text-main)]">Chưa có dữ liệu danh sách ảnh</h4>
            <p className="text-xs text-[var(--text-muted)] max-w-md mt-1">
              Vui lòng dán danh sách tên file vào ô <strong className="text-[var(--text-main)]">"DANH SÁCH TÊN FILE"</strong> bên trái để tự động hiển thị danh sách ảnh khớp.
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Execution Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="panel-pro max-w-md w-full p-5 space-y-4 bg-[var(--bg-panel)] border-[var(--border-subtle)] rounded-[4px] animate-modal-pop shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-[var(--text-main)]">
                Xác nhận thực thi {config.mode === 'copy' ? 'Sao chép' : 'Di chuyển'}
              </h3>
            </div>

            <p className="text-xs text-[var(--text-main)] leading-relaxed">
              Bạn có chắc chắn muốn tiến hành{' '}
              <strong className="text-amber-500">{config.mode.toUpperCase()}</strong>{' '}
              <strong>{totalCount.toLocaleString('vi-VN')}</strong> ảnh khớp từ thư mục nguồn sang thư mục đích?
            </p>

            {config.mode === 'move' && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-[4px] text-xs text-amber-600">
                ⚠️ Thao tác Di Chuyển (Move) sẽ xóa file khỏi thư mục nguồn sau khi chuyển sang thư mục đích.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="btn-secondary-pro text-xs active:scale-95"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmModalOpen(false);
                  onExecute();
                }}
                className="btn-accent text-xs px-4 active:scale-95"
              >
                Xác nhận chạy ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Size Image Lightbox Modal with Backdrop Dimming & 4px Minimal Corners */}
      {previewImageModalFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in cursor-pointer"
          onClick={() => setPreviewImageModalFile(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center p-3 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-[6px] shadow-2xl overflow-hidden cursor-default animate-modal-pop"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top-Right Red Close X Button */}
            <button
              type="button"
              onClick={() => setPreviewImageModalFile(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-rose-500/20 hover:bg-rose-500/40 text-rose-500 border border-rose-500/50 flex items-center justify-center transition-all duration-150 cursor-pointer shadow-lg active:scale-90"
              title="Đóng xem ảnh (hoặc bấm ra ngoài vùng mờ đen)"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Large Image View — supports RAW thumbnail extraction */}
            <div className="max-h-[75vh] w-full flex items-center justify-center overflow-hidden rounded-[4px] bg-[var(--bg-card-inset)]">
              {isLoadingRaw ? (
                <div className="p-12 flex flex-col items-center justify-center space-y-3 text-[var(--text-muted)]">
                  <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-mono">Đang trích xuất ảnh xem trước từ tệp RAW...</p>
                </div>
              ) : rawThumbnailUrl ? (
                <img
                  src={rawThumbnailUrl}
                  alt={previewImageModalFile.filename || previewImageModalFile.name}
                  className="max-h-[75vh] max-w-full object-contain rounded-[4px] shadow-2xl transition-transform duration-200"
                />
              ) : getFileThumbnailUrl(previewImageModalFile) && !failedImages[previewImageModalFile.id || previewImageModalFile.sourcePath || ''] ? (
                <img
                  src={getFileThumbnailUrl(previewImageModalFile)}
                  alt={previewImageModalFile.filename || previewImageModalFile.name}
                  className="max-h-[75vh] max-w-full object-contain rounded-[4px] shadow-2xl transition-transform duration-200"
                />
              ) : (
                <div className="p-12 flex flex-col items-center justify-center space-y-3 text-[var(--text-muted)]">
                  <FileImage className="w-16 h-16 text-amber-500" />
                  <p className="text-xs font-mono">Không thể trích xuất ảnh xem trước từ tệp này</p>
                </div>
              )}
            </div>

            {/* Bottom Info Toolbar */}
            <div className="w-full pt-3 px-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono border-t border-[var(--border-subtle)] mt-2">
              <div className="flex items-center gap-2 text-[var(--text-main)] font-semibold truncate">
                <span className="text-amber-500 font-bold">{previewImageModalFile.filename || previewImageModalFile.name}</span>
                <span className="badge-pro badge-amber">.{(previewImageModalFile.extension || '').toUpperCase().replace(/^\./, '')}</span>
              </div>

              <div className="flex items-center gap-3 text-[var(--text-muted)] text-[11px]">
                <span>Dung lượng: {formatFileSize(previewImageModalFile.sizeBytes ?? previewImageModalFile.size ?? 0)}</span>
                <span>•</span>
                <span className="truncate max-w-xs" title={previewImageModalFile.sourcePath || previewImageModalFile.path}>{previewImageModalFile.sourcePath || previewImageModalFile.path}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
