import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye,
  Play,
  Search,
  FileImage,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ZoomIn,
  ZoomOut,
  FolderOpen,
  CheckSquare,
  Square,
  AlertCircle,
  Camera,
  LayoutGrid,
  List,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { FilterConfig, FileEntry, PreviewResult } from '../../shared/types';
import {
  isRawExtension,
  normalizeExtension,
  toLocalFileUrl,
} from '../../shared/imageExtensions';

interface PreviewTableProps {
  config: FilterConfig;
  previewResult: PreviewResult | null;
  onExecute: (selectedFiles: FileEntry[]) => void;
  isLoading: boolean;
  scanError?: string | null;
  hasPathConflict?: boolean;
}

type SortField = 'filename' | 'extension' | 'sizeBytes' | 'dateTaken';
type SortDirection = 'asc' | 'desc';

export const PreviewTable: React.FC<PreviewTableProps> = ({
  config,
  previewResult,
  onExecute,
  isLoading,
  scanError = null,
  hasPathConflict = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());

  const [sortField, setSortField] = useState<SortField>('filename');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    try {
      return (localStorage.getItem('shutter_view_mode') as 'list' | 'grid') || 'list';
    } catch {
      return 'list';
    }
  });

  const handleViewModeChange = (nextMode: 'list' | 'grid') => {
    setViewMode(nextMode);
    try {
      localStorage.setItem('shutter_view_mode', nextMode);
    } catch {
      // Ignore storage error
    }
  };

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [rawThumbnailUrl, setRawThumbnailUrl] = useState<string | null>(null);
  const [isLoadingRaw, setIsLoadingRaw] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const rawPreviewCacheRef = useRef<Map<string, string>>(new Map());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const matchedList: FileEntry[] = useMemo(() => {
    if (!previewResult) return [];
    return previewResult.matched_files || previewResult.files || [];
  }, [previewResult]);

  // Reset failures & selection when preview result refreshes
  useEffect(() => {
    setFailedImages({});
    setDeselectedIds(new Set());
    setLightboxIndex(null);
  }, [previewResult]);

  const filteredAndSortedMatches = useMemo(() => {
    let list = matchedList;
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter((f) =>
        (f.filename || f.name || '').toLowerCase().includes(term)
      );
    }

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'filename') {
        cmp = (a.filename || '').localeCompare(b.filename || '', undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      } else if (sortField === 'extension') {
        cmp = normalizeExtension(a.extension).localeCompare(
          normalizeExtension(b.extension)
        );
      } else if (sortField === 'sizeBytes') {
        cmp = (a.sizeBytes ?? a.size ?? 0) - (b.sizeBytes ?? b.size ?? 0);
      } else if (sortField === 'dateTaken') {
        cmp = (a.dateTaken || a.mtime || '').localeCompare(
          b.dateTaken || b.mtime || ''
        );
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [matchedList, searchTerm, sortField, sortDir]);

  const selectedFiles = useMemo(() => {
    if (deselectedIds.size === 0) return matchedList;
    return matchedList.filter((f) => {
      const id = f.id || f.sourcePath || f.filename;
      return !deselectedIds.has(id);
    });
  }, [matchedList, deselectedIds]);

  const selectedSizeBytes = useMemo(
    () => selectedFiles.reduce((acc, f) => acc + (f.sizeBytes ?? f.size ?? 0), 0),
    [selectedFiles]
  );

  // Reset to page 1 on search, sort, or result changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, previewResult, sortField, sortDir]);

  const previewImageModalFile =
    lightboxIndex !== null ? filteredAndSortedMatches[lightboxIndex] ?? null : null;

  const navigateLightbox = useCallback(
    (delta: number) => {
      setLightboxIndex((prev) => {
        if (prev === null || filteredAndSortedMatches.length === 0) return null;
        const next =
          (prev + delta + filteredAndSortedMatches.length) %
          filteredAndSortedMatches.length;
        return next;
      });
      setIsZoomed(false);
    },
    [filteredAndSortedMatches.length]
  );

  // Keyboard shortcuts for Lightbox and Confirm Modal
  useEffect(() => {
    if (lightboxIndex === null && !confirmModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxIndex !== null) {
          setLightboxIndex(null);
          setIsZoomed(false);
        } else if (confirmModalOpen) {
          setConfirmModalOpen(false);
        }
      } else if (lightboxIndex !== null && e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateLightbox(-1);
      } else if (lightboxIndex !== null && e.key === 'ArrowRight') {
        e.preventDefault();
        navigateLightbox(1);
      } else if (lightboxIndex !== null && (e.key === ' ' || e.key === 'z')) {
        e.preventDefault();
        setIsZoomed((z) => !z);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, confirmModalOpen, navigateLightbox]);

  // Race-condition-safe RAW preview loading with in-memory LRU cache
  useEffect(() => {
    if (!previewImageModalFile) {
      setRawThumbnailUrl(null);
      setIsLoadingRaw(false);
      return;
    }

    const ext = normalizeExtension(previewImageModalFile.extension);
    const filePath = previewImageModalFile.sourcePath || previewImageModalFile.path || '';

    if (!isRawExtension(ext) || !filePath || !window.electronAPI?.getRawThumbnail) {
      setRawThumbnailUrl(null);
      setIsLoadingRaw(false);
      return;
    }

    const cached = rawPreviewCacheRef.current.get(filePath);
    if (cached) {
      setRawThumbnailUrl(cached);
      setIsLoadingRaw(false);
      return;
    }

    let isActive = true;
    setIsLoadingRaw(true);
    setRawThumbnailUrl(null);

    window.electronAPI
      .getRawThumbnail(filePath)
      .then((url) => {
        if (!isActive) return;
        if (url) {
          if (rawPreviewCacheRef.current.size >= 30) {
            const firstKey = rawPreviewCacheRef.current.keys().next().value;
            if (firstKey) rawPreviewCacheRef.current.delete(firstKey);
          }
          rawPreviewCacheRef.current.set(filePath, url);
        }
        setRawThumbnailUrl(url);
      })
      .catch(() => {
        if (isActive) setRawThumbnailUrl(null);
      })
      .finally(() => {
        if (isActive) setIsLoadingRaw(false);
      });

    return () => {
      isActive = false;
    };
  }, [previewImageModalFile]);

  const totalPages = Math.ceil(filteredAndSortedMatches.length / pageSize) || 1;

  const paginatedMatches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedMatches.slice(start, start + pageSize);
  }, [filteredAndSortedMatches, currentPage, pageSize]);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileThumbnailUrl = (file: FileEntry): string => {
    const mockUrl = (file as FileEntry & { previewUrl?: string }).previewUrl;
    if (mockUrl) return mockUrl;
    const rawPath = file.sourcePath || file.path || '';
    return toLocalFileUrl(rawPath);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[var(--accent)]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[var(--accent)]" />
    );
  };

  const toggleSelectFile = (fileId: string) => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const allFilteredSelected =
    filteredAndSortedMatches.length > 0 &&
    filteredAndSortedMatches.every(
      (f) => !deselectedIds.has(f.id || f.sourcePath || f.filename)
    );

  const toggleSelectAllFiltered = () => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredAndSortedMatches.forEach((f) =>
          next.add(f.id || f.sourcePath || f.filename)
        );
      } else {
        filteredAndSortedMatches.forEach((f) =>
          next.delete(f.id || f.sourcePath || f.filename)
        );
      }
      return next;
    });
  };

  const sourcePath = (config.sourceFolder || config.source_folder || '').trim();
  const destPath = (config.destFolder || config.destination_folder || '').trim();
  const hasKeywords = config.keywords_include.some((k) => k.trim().length > 0);
  const needsConfirmation =
    config.mode === 'move' || config.duplicate_policy === 'overwrite';

  const canExecute =
    !isLoading &&
    !scanError &&
    !hasPathConflict &&
    selectedFiles.length > 0 &&
    Boolean(destPath);

  const runDisabledReason = !sourcePath
    ? 'Hãy chọn thư mục nguồn trước'
    : !destPath
    ? 'Hãy chọn thư mục đích trước'
    : hasPathConflict
    ? 'Thư mục nguồn và đích không được trùng nhau'
    : selectedFiles.length === 0
    ? 'Chưa có ảnh nào được chọn để lọc'
    : '';

  const startRange =
    filteredAndSortedMatches.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRange = Math.min(currentPage * pageSize, filteredAndSortedMatches.length);

  const actionVerb = config.mode === 'move' ? 'Di chuyển' : 'Sao chép';

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg-canvas)]">
      {/* Studio Light-Table Top Toolbar */}
      <div className="px-4 sm:px-5 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)] flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Live Selection Metrics (Unboxed, clean tabular typography) */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-sm font-semibold text-[var(--text-main)]">
              {selectedFiles.length.toLocaleString('vi-VN')}
              {selectedFiles.length !== matchedList.length && (
                <span className="text-[var(--text-dim)] font-normal">
                  {' '}
                  / {matchedList.length.toLocaleString('vi-VN')}
                </span>
              )}{' '}
              ảnh
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {formatFileSize(selectedSizeBytes)}
            </span>
            {previewResult?.scan_duration_ms !== undefined && matchedList.length > 0 && (
              <span className="text-[11px] text-[var(--text-dim)] hidden xl:inline">
                {previewResult.scan_duration_ms}ms
              </span>
            )}
          </div>

          {config.mode === 'move' && (
            <span className="badge-pro badge-rose">
              <AlertTriangle className="w-3 h-3 shrink-0" strokeWidth={1.75} />
              <span>Di chuyển</span>
            </span>
          )}
        </div>

        {/* View Switcher + Singular Primary CTA */}
        <div className="flex items-center gap-2.5">
          {matchedList.length > 0 && (
            <div
              className="inline-flex items-center bg-[var(--bg-card-inset)] p-0.5 rounded-[6px] border border-[var(--border-hairline)]"
              role="group"
              aria-label="Chế độ hiển thị"
            >
              <button
                type="button"
                onClick={() => handleViewModeChange('list')}
                className={`px-2 py-1 rounded-[4px] text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[var(--bg-card)] text-[var(--text-main)] font-medium border border-[var(--border-subtle)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] border border-transparent'
                }`}
                title="Chế độ danh sách chi tiết"
              >
                <List className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span className="hidden lg:inline">Danh sách</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('grid')}
                className={`px-2 py-1 rounded-[4px] text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[var(--bg-card)] text-[var(--text-main)] font-medium border border-[var(--border-subtle)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] border border-transparent'
                }`}
                title="Chế độ lưới ảnh Contact Sheet"
              >
                <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span className="hidden lg:inline">Lưới ảnh</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (needsConfirmation) {
                setConfirmModalOpen(true);
              } else {
                onExecute(selectedFiles);
              }
            }}
            disabled={!canExecute}
            title={runDisabledReason || 'Bắt đầu lọc ảnh sang thư mục đích'}
            className="btn-accent text-xs px-4 py-2"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="tabular-nums">
              {actionVerb} {selectedFiles.length.toLocaleString('vi-VN')} ảnh
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {scanError ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-3">
          <div className="w-11 h-11 rounded-[8px] bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-[var(--status-danger)]" strokeWidth={1.75} />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-sm font-semibold text-[var(--text-main)]">
              Không thể quét thư mục nguồn
            </h3>
            <p className="text-xs text-[var(--status-danger)] font-mono break-all">
              {scanError}
            </p>
          </div>
        </div>
      ) : isLoading && !previewResult ? (
        /* Skeleton Loader Rows */
        <div className="flex-1 p-5 space-y-3 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="skeleton-bar h-8 w-60" />
            <div className="skeleton-bar h-4 w-36" />
          </div>
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3.5 py-2.5 border-b border-[var(--table-divide)]"
            >
              <div className="skeleton-bar w-9 h-9 shrink-0" />
              <div className="skeleton-bar h-4 flex-1 max-w-[220px]" />
              <div className="skeleton-bar h-5 w-14" />
              <div className="skeleton-bar h-4 w-16 ml-auto" />
              <div className="skeleton-bar h-4 w-28 hidden sm:block" />
            </div>
          ))}
        </div>
      ) : !sourcePath || !hasKeywords ? (
        /* Editorial Live-Checklist Empty State */
        <div className="flex-1 flex items-center justify-center p-8 sm:p-12 overflow-y-auto">
          <div className="max-w-md w-full space-y-6 animate-fade-in">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-[8px] bg-[var(--accent-bg-alpha)] border border-[var(--accent-border-alpha)] flex items-center justify-center text-[var(--accent)] mb-4">
                <Camera className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-main)]">
                {!sourcePath
                  ? 'Bắt đầu lọc ảnh cho phiên làm việc'
                  : 'Đã sẵn sàng đối chiếu danh sách ảnh'}
              </h3>
              <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                {!sourcePath
                  ? 'Chọn hoặc kéo thả thư mục ảnh gốc vào thanh điều khiển bên trái, sau đó dán danh sách tên file khách hàng đã chọn.'
                  : previewResult?.totalFolderImages !== undefined
                  ? `Đã tìm thấy ${previewResult.totalFolderImages.toLocaleString('vi-VN')} ảnh hợp lệ trong thư mục nguồn. Dán danh sách tên file ở cột trái để xem kết quả ngay.`
                  : 'Dán danh sách tên file vào ô bên trái để tự động đối chiếu theo thời gian thực.'}
              </p>
            </div>

            {/* Live Studio Workflow Steps (hairline divided, zero box clutter) */}
            <div className="border-t border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)]">
              <div className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  {sourcePath ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--status-success)] shrink-0" strokeWidth={1.85} />
                  ) : (
                    <Circle className="w-4 h-4 text-[var(--accent)] shrink-0" strokeWidth={1.75} />
                  )}
                  <span
                    className={
                      sourcePath
                        ? 'text-[var(--text-muted)] line-through'
                        : 'text-[var(--text-main)] font-medium'
                    }
                  >
                    Chọn thư mục nguồn chứa ảnh gốc
                  </span>
                </div>
                {sourcePath && (
                  <span className="text-[11px] font-mono text-[var(--status-success)]">
                    Xong
                  </span>
                )}
              </div>

              <div className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  {hasKeywords ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--status-success)] shrink-0" strokeWidth={1.85} />
                  ) : (
                    <Circle
                      className={`w-4 h-4 shrink-0 ${
                        sourcePath ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
                      }`}
                      strokeWidth={1.75}
                    />
                  )}
                  <span
                    className={
                      hasKeywords
                        ? 'text-[var(--text-muted)] line-through'
                        : sourcePath
                        ? 'text-[var(--text-main)] font-medium'
                        : 'text-[var(--text-muted)]'
                    }
                  >
                    Dán danh sách tên ảnh cần tách
                  </span>
                </div>
                {hasKeywords && (
                  <span className="text-[11px] font-mono text-[var(--status-success)]">
                    Xong
                  </span>
                )}
              </div>

              <div className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  {destPath ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--status-success)] shrink-0" strokeWidth={1.85} />
                  ) : (
                    <Circle className="w-4 h-4 text-[var(--text-dim)] shrink-0" strokeWidth={1.75} />
                  )}
                  <span
                    className={
                      destPath
                        ? 'text-[var(--text-muted)] line-through'
                        : 'text-[var(--text-muted)]'
                    }
                  >
                    Chỉ định thư mục đích lưu kết quả
                  </span>
                </div>
                {destPath && (
                  <span className="text-[11px] font-mono text-[var(--status-success)]">
                    Xong
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Sub-bar: Search + Range + Select All in Grid mode */}
          <div className="px-4 sm:px-5 py-2.5 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 bg-[var(--bg-canvas)]">
            <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
              <div className="relative flex-1 max-w-xs flex items-center">
                <Search
                  className="w-3.5 h-3.5 absolute left-2.5 text-[var(--text-dim)] pointer-events-none"
                  strokeWidth={1.75}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm tên file trong kết quả..."
                  style={{
                    paddingLeft: '32px',
                    paddingRight: searchTerm ? '28px' : undefined,
                  }}
                  className="input-pro py-1.5 text-xs font-mono"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 text-[var(--text-dim)] hover:text-[var(--text-main)] cursor-pointer"
                    title="Xóa từ khóa tìm kiếm"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                )}
              </div>

              {viewMode === 'grid' && filteredAndSortedMatches.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="btn-ghost-pro text-xs"
                >
                  {allFilteredSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={1.85} />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-[var(--text-dim)]" strokeWidth={1.75} />
                  )}
                  <span>{allFilteredSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-mono tabular-nums">
              {isLoading && (
                <span className="text-[var(--accent-strong)] text-[11px] animate-pulse">
                  Đang cập nhật...
                </span>
              )}
              <span>
                {startRange.toLocaleString('vi-VN')}-{endRange.toLocaleString('vi-VN')} /{' '}
                {filteredAndSortedMatches.length.toLocaleString('vi-VN')} ảnh
              </span>
            </div>
          </div>

          {/* Results Surface: List Table OR Contact Sheet Grid */}
          <div className="flex-1 overflow-auto bg-[var(--bg-canvas)]">
            {filteredAndSortedMatches.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)] space-y-2 animate-fade-in">
                <FileImage className="w-8 h-8 text-[var(--text-dim)]" strokeWidth={1.5} />
                <p className="text-xs font-semibold text-[var(--text-main)]">
                  {searchTerm.trim()
                    ? 'Không tìm thấy ảnh khớp với từ khóa tìm nhanh.'
                    : 'Không tìm thấy ảnh nào khớp điều kiện lọc.'}
                </p>
                {!searchTerm.trim() && (
                  <p className="text-xs text-[var(--text-muted)] max-w-sm">
                    Hãy thử bấm <strong className="text-[var(--text-main)]">Chuẩn hóa</strong> danh sách tên file, kiểm tra kiểu đối chiếu hoặc đặt lại bộ lọc định dạng.
                  </p>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              /* Studio Contact Sheet Grid (No overlay pills on images - captions cleanly below) */
              <div className="p-4 sm:p-5 grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {paginatedMatches.map((file, rowIdx) => {
                  const fileName = file.filename || file.name || '';
                  const filePath = file.sourcePath || file.path || '';
                  const fileSize = file.sizeBytes ?? file.size ?? 0;
                  const fileId = file.id || filePath || fileName;
                  const extClean = normalizeExtension(file.extension);
                  const isRaw = isRawExtension(extClean);
                  const isSelected = !deselectedIds.has(fileId);
                  const globalIdx = (currentPage - 1) * pageSize + rowIdx;

                  const imgUrl = getFileThumbnailUrl(file);
                  const hasMockPreview = Boolean(
                    (file as FileEntry & { previewUrl?: string }).previewUrl
                  );
                  const canRenderDirectThumb =
                    Boolean(imgUrl) &&
                    !failedImages[fileId] &&
                    (!isRaw || hasMockPreview);

                  return (
                    <article
                      key={fileId}
                      className={`group rounded-[8px] border overflow-hidden bg-[var(--bg-card)] transition-all duration-150 flex flex-col ${
                        isSelected
                          ? 'border-[var(--border-subtle)] hover:border-[var(--border-focus)]'
                          : 'border-[var(--border-hairline)] opacity-50'
                      }`}
                    >
                      {/* Clean Photographic Frame (Zero overlaid badges) */}
                      <button
                        type="button"
                        onClick={() => {
                          setLightboxIndex(globalIdx);
                          setIsZoomed(false);
                        }}
                        className="aspect-[4/3] w-full bg-[#0e0e12] flex items-center justify-center overflow-hidden cursor-pointer relative"
                        title="Bấm để mở khung xem ảnh phóng to"
                      >
                        {canRenderDirectThumb ? (
                          <img
                            src={imgUrl}
                            alt={fileName}
                            onError={() =>
                              setFailedImages((prev) => ({ ...prev, [fileId]: true }))
                            }
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300 ease-out"
                            loading="lazy"
                          />
                        ) : isRaw ? (
                          <div className="flex flex-col items-center justify-center gap-1.5 text-zinc-400">
                            <Camera className="w-7 h-7 text-amber-400" strokeWidth={1.5} />
                            <span className="text-[11px] font-mono tracking-wider text-amber-400">
                              .{extClean.toUpperCase()} RAW
                            </span>
                          </div>
                        ) : (
                          <FileImage className="w-8 h-8 text-zinc-500" strokeWidth={1.5} />
                        )}
                      </button>

                      {/* Clean Caption & Selection Footer Below Frame */}
                      <div className="p-2.5 flex items-start justify-between gap-2 border-t border-[var(--border-hairline)]">
                        <button
                          type="button"
                          onClick={() => toggleSelectFile(fileId)}
                          className="mt-0.5 text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer shrink-0"
                          title={isSelected ? 'Bỏ chọn ảnh này' : 'Chọn ảnh này'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.9} />
                          ) : (
                            <Square className="w-4 h-4" strokeWidth={1.75} />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => {
                              setLightboxIndex(globalIdx);
                              setIsZoomed(false);
                            }}
                            className="block w-full text-left font-mono text-xs font-semibold text-[var(--text-main)] hover:text-[var(--accent-strong)] truncate cursor-pointer transition-colors"
                            title={fileName}
                          >
                            {fileName}
                          </button>
                          <div className="flex items-center justify-between gap-2 mt-1 text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                            <span
                              className={`badge-pro ${
                                isRaw ? 'badge-amber' : 'badge-neutral'
                              }`}
                            >
                              .{extClean}
                            </span>
                            <span>{formatFileSize(fileSize)}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              /* Precision Studio Table View */
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="bg-[var(--table-header-bg)] sticky top-0 z-10 border-b border-[var(--border-hairline)] text-[var(--text-muted)] text-[11px] font-sans font-medium">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAllFiltered}
                        className="inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer"
                        title={
                          allFilteredSelected
                            ? 'Bỏ chọn tất cả kết quả đang hiển thị'
                            : 'Chọn tất cả kết quả đang hiển thị'
                        }
                      >
                        {allFilteredSelected ? (
                          <CheckSquare className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.9} />
                        ) : (
                          <Square className="w-4 h-4" strokeWidth={1.75} />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-2 w-14 text-center whitespace-nowrap">Ảnh</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSort('filename')}
                        className="inline-flex items-center gap-1 hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap"
                      >
                        <span>Tên file</span>
                        {renderSortIcon('filename')}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSort('extension')}
                        className="inline-flex items-center gap-1 hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap"
                      >
                        <span>Định dạng</span>
                        {renderSortIcon('extension')}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSort('sizeBytes')}
                        className="inline-flex items-center gap-1 hover:text-[var(--text-main)] cursor-pointer ml-auto whitespace-nowrap"
                      >
                        <span>Dung lượng</span>
                        {renderSortIcon('sizeBytes')}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSort('dateTaken')}
                        className="inline-flex items-center gap-1 hover:text-[var(--text-main)] cursor-pointer whitespace-nowrap"
                      >
                        <span>Ngày chụp</span>
                        {renderSortIcon('dateTaken')}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 hidden xl:table-cell whitespace-nowrap">
                      Đường dẫn nguồn
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--table-divide)]">
                  {paginatedMatches.map((file, rowIdx) => {
                    const fileName = file.filename || file.name || '';
                    const filePath = file.sourcePath || file.path || '';
                    const fileSize = file.sizeBytes ?? file.size ?? 0;
                    const fileId = file.id || filePath || fileName;
                    const extClean = normalizeExtension(file.extension);
                    const isRaw = isRawExtension(extClean);
                    const isSelected = !deselectedIds.has(fileId);
                    const globalIdx = (currentPage - 1) * pageSize + rowIdx;

                    const imgUrl = getFileThumbnailUrl(file);
                    const hasMockPreview = Boolean(
                      (file as FileEntry & { previewUrl?: string }).previewUrl
                    );
                    const canRenderDirectThumb =
                      Boolean(imgUrl) &&
                      !failedImages[fileId] &&
                      (!isRaw || hasMockPreview);

                    return (
                      <tr
                        key={fileId}
                        onDoubleClick={() => {
                          setLightboxIndex(globalIdx);
                          setIsZoomed(false);
                        }}
                        className={`hover:bg-[var(--table-row-hover)] transition-colors duration-150 group ${
                          !isSelected ? 'opacity-45' : ''
                        }`}
                      >
                        {/* Row Checkbox */}
                        <td className="py-2 px-3 w-10 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => toggleSelectFile(fileId)}
                            className="inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer"
                            title={isSelected ? 'Bỏ chọn ảnh này' : 'Chọn ảnh này'}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.9} />
                            ) : (
                              <Square className="w-4 h-4" strokeWidth={1.75} />
                            )}
                          </button>
                        </td>

                        {/* Thumbnail */}
                        <td className="py-2 px-2 w-14 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => {
                              setLightboxIndex(globalIdx);
                              setIsZoomed(false);
                            }}
                            className="w-10 h-10 rounded-[5px] bg-[var(--bg-card-inset)] border border-[var(--border-subtle)] group-hover:border-[var(--accent)] overflow-hidden flex items-center justify-center mx-auto shrink-0 cursor-pointer transition-colors relative active:scale-95"
                            title="Bấm để xem ảnh phóng to"
                          >
                            {canRenderDirectThumb ? (
                              <img
                                src={imgUrl}
                                alt={fileName}
                                onError={() =>
                                  setFailedImages((prev) => ({ ...prev, [fileId]: true }))
                                }
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                loading="lazy"
                              />
                            ) : isRaw ? (
                              <div className="flex flex-col items-center justify-center text-[var(--accent-strong)]">
                                <Camera className="w-4 h-4" strokeWidth={1.75} />
                                <span className="text-[8px] font-bold leading-none mt-0.5">
                                  RAW
                                </span>
                              </div>
                            ) : (
                              <FileImage className="w-5 h-5 text-[var(--text-dim)]" strokeWidth={1.5} />
                            )}
                            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                              <Eye className="w-4 h-4 text-amber-300" strokeWidth={1.75} />
                            </div>
                          </button>
                        </td>

                        {/* File Name */}
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-main)] align-middle">
                          <button
                            type="button"
                            onClick={() => {
                              setLightboxIndex(globalIdx);
                              setIsZoomed(false);
                            }}
                            className="text-left hover:text-[var(--accent-strong)] transition-colors cursor-pointer"
                            title="Bấm để xem nhanh ảnh"
                          >
                            {fileName}
                          </button>
                        </td>

                        {/* Format Badge */}
                        <td className="py-2.5 px-3 align-middle">
                          <span
                            className={`badge-pro ${
                              isRaw ? 'badge-amber' : 'badge-neutral'
                            }`}
                          >
                            .{extClean}
                          </span>
                        </td>

                        {/* File Size */}
                        <td className="py-2.5 px-3 text-right text-[var(--text-muted)] tabular-nums align-middle whitespace-nowrap">
                          {formatFileSize(fileSize)}
                        </td>

                        {/* Date */}
                        <td className="py-2.5 px-3 text-[var(--text-dim)] text-[11px] tabular-nums align-middle whitespace-nowrap">
                          {file.dateTaken ||
                            (file.mtime
                              ? new Date(file.mtime).toLocaleDateString('vi-VN')
                              : '-')}
                        </td>

                        {/* Source Path */}
                        <td
                          className="py-2.5 px-3 text-[var(--text-dim)] truncate max-w-[220px] text-[11px] align-middle hidden xl:table-cell"
                          title={filePath}
                        >
                          {filePath}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Hairline Pagination Footer */}
          {filteredAndSortedMatches.length > 0 && (
            <div className="px-4 sm:px-5 py-2.5 bg-[var(--bg-canvas)] border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums shrink-0">
              <div className="flex items-center gap-3 text-[var(--text-muted)]">
                <span>
                  Trang <strong className="text-[var(--text-main)]">{currentPage}</strong> /{' '}
                  {totalPages}
                </span>

                <div className="flex items-center gap-1.5 text-[var(--text-dim)] pl-3 border-l border-[var(--border-hairline)]">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    aria-label="Số dòng mỗi trang"
                    className="bg-[var(--bg-card-inset)] border border-[var(--border-subtle)] text-[var(--text-main)] rounded-[5px] px-2 py-0.5 text-xs focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option value={50}>50 / trang</option>
                    <option value={100}>100 / trang</option>
                    <option value={250}>250 / trang</option>
                    <option value={500}>500 / trang</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="btn-secondary-pro px-2 py-1 text-xs"
                  title="Trang đầu"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary-pro px-2.5 py-1 text-xs"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Trước</span>
                </button>

                <span className="px-2.5 py-1 text-[var(--text-main)] font-semibold">
                  {currentPage}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="btn-secondary-pro px-2.5 py-1 text-xs"
                  title="Trang sau"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="btn-secondary-pro px-2 py-1 text-xs"
                  title="Trang cuối"
                >
                  <ChevronsRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Execution Modal (Portal to body for guaranteed full-viewport overlay) */}
      {confirmModalOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Xác nhận thực thi"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in"
            onClick={() => setConfirmModalOpen(false)}
          >
            <div
              className="panel-pro max-w-md w-full p-5 space-y-4 animate-modal-pop"
              style={{ boxShadow: 'var(--shadow-modal)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 text-[var(--status-danger)]">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold text-[var(--text-main)]">
                  Xác nhận {config.mode === 'move' ? 'Di chuyển ảnh' : 'Ghi đè ảnh'}
                </h3>
              </div>

              <p className="text-xs text-[var(--text-main)] leading-relaxed">
                Bạn chuẩn bị thực hiện{' '}
                <strong className="text-[var(--accent-strong)]">
                  {config.mode === 'move' ? 'DI CHUYỂN (MOVE)' : 'SAO CHÉP (COPY)'}
                </strong>{' '}
                <strong>{selectedFiles.length.toLocaleString('vi-VN')}</strong> ảnh (
                {formatFileSize(selectedSizeBytes)}) sang thư mục đích.
              </p>

              <div className="p-2.5 rounded-[4px] bg-[var(--bg-card-inset)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-muted)] space-y-1">
                <div className="truncate" title={sourcePath}>
                  Nguồn: <span className="text-[var(--text-main)]">{sourcePath}</span>
                </div>
                <div className="truncate" title={destPath}>
                  Đích: <span className="text-[var(--text-main)]">{destPath}</span>
                </div>
              </div>

              {config.mode === 'move' && (
                <div className="p-2.5 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-[4px] text-xs text-[var(--status-danger)] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Thao tác Move sẽ di chuyển file khỏi thư mục nguồn. Bạn vẫn có thể khôi phục qua mục Lịch Sử &amp; Undo.
                  </span>
                </div>
              )}

              {config.duplicate_policy === 'overwrite' && (
                <div className="p-2.5 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-[4px] text-xs text-[var(--status-warning)] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Chính sách Ghi đè đang bật: file trùng tên ở đích sẽ bị thay thế trực tiếp.
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(false)}
                  className="btn-secondary-pro text-xs"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmModalOpen(false);
                    onExecute(selectedFiles);
                  }}
                  className="btn-accent text-xs px-4"
                >
                  Xác nhận chạy ngay
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Full-Viewport Studio Lightbox via Portal (never clipped by panel layout) */}
      {previewImageModalFile &&
        lightboxIndex !== null &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Xem trước ảnh ${previewImageModalFile.filename || previewImageModalFile.name}`}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-6 animate-fade-in cursor-pointer"
            onClick={() => {
              setLightboxIndex(null);
              setIsZoomed(false);
            }}
          >
            {/* Prev Button */}
            {filteredAndSortedMatches.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox(-1);
                }}
                className="fixed left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 flex items-center justify-center transition-colors cursor-pointer active:scale-95 shadow-lg"
                title="Ảnh trước (Phím mũi tên trái)"
                aria-label="Ảnh trước"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* Next Button */}
            {filteredAndSortedMatches.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox(1);
                }}
                className="fixed right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 flex items-center justify-center transition-colors cursor-pointer active:scale-95 shadow-lg"
                title="Ảnh tiếp theo (Phím mũi tên phải)"
                aria-label="Ảnh tiếp theo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            <div
              className="relative w-full max-w-[min(88vw,1160px)] max-h-[90vh] flex flex-col p-3.5 bg-[#111114] text-zinc-100 border border-zinc-800 rounded-[8px] shadow-2xl overflow-hidden cursor-default animate-modal-pop"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top-Right Controls */}
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsZoomed((z) => !z)}
                  className="w-8 h-8 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
                  title={
                    isZoomed
                      ? 'Thu nhỏ vừa khung (Phím Space)'
                      : 'Phóng to chi tiết (Phím Space)'
                  }
                  aria-label={isZoomed ? 'Thu nhỏ ảnh' : 'Phóng to ảnh'}
                >
                  {isZoomed ? (
                    <ZoomOut className="w-4 h-4" />
                  ) : (
                    <ZoomIn className="w-4 h-4" />
                  )}
                </button>

                {previewImageModalFile.sourcePath && (
                  <button
                    type="button"
                    onClick={() =>
                      window.electronAPI?.revealInFolder?.(
                        previewImageModalFile.sourcePath
                      )
                    }
                    className="w-8 h-8 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
                    title="Hiển thị vị trí file trong Explorer"
                    aria-label="Mở vị trí file"
                  >
                    <FolderOpen className="w-4 h-4 text-amber-400" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setLightboxIndex(null);
                    setIsZoomed(false);
                  }}
                  className="w-8 h-8 rounded-full bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 border border-rose-500/50 flex items-center justify-center transition-colors cursor-pointer"
                  title="Đóng xem ảnh (Esc)"
                  aria-label="Đóng xem ảnh"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Large Image Canvas */}
              <div
                className={`w-full flex-1 min-h-[280px] max-h-[75vh] flex items-center justify-center rounded-[6px] bg-[#09090b] border border-zinc-800/80 p-2 ${
                  isZoomed ? 'overflow-auto' : 'overflow-hidden'
                }`}
              >
                {isLoadingRaw ? (
                  <div className="p-12 flex flex-col items-center justify-center space-y-3 text-zinc-400">
                    <div className="w-9 h-9 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-mono">
                      Đang trích xuất ảnh xem trước độ phân giải cao từ tệp RAW...
                    </p>
                  </div>
                ) : rawThumbnailUrl ? (
                  <img
                    src={rawThumbnailUrl}
                    alt={previewImageModalFile.filename || previewImageModalFile.name}
                    onClick={() => setIsZoomed((z) => !z)}
                    className={`rounded-[4px] transition-transform duration-200 ${
                      isZoomed
                        ? 'max-w-none max-h-none w-auto h-auto scale-125 cursor-zoom-out'
                        : 'max-w-full max-h-[71vh] w-auto h-auto object-contain cursor-zoom-in'
                    }`}
                  />
                ) : isRawExtension(previewImageModalFile.extension) ? (
                  <div className="p-12 flex flex-col items-center justify-center space-y-3 text-zinc-400">
                    <FileImage className="w-14 h-14 text-amber-500" />
                    <p className="text-xs font-mono">
                      Không thể trích xuất ảnh xem trước từ tệp RAW này
                    </p>
                  </div>
                ) : getFileThumbnailUrl(previewImageModalFile) &&
                  !failedImages[
                    previewImageModalFile.id || previewImageModalFile.sourcePath || ''
                  ] ? (
                  <img
                    src={getFileThumbnailUrl(previewImageModalFile)}
                    alt={previewImageModalFile.filename || previewImageModalFile.name}
                    onClick={() => setIsZoomed((z) => !z)}
                    className={`rounded-[4px] transition-transform duration-200 ${
                      isZoomed
                        ? 'max-w-none max-h-none w-auto h-auto scale-125 cursor-zoom-out'
                        : 'max-w-full max-h-[71vh] w-auto h-auto object-contain cursor-zoom-in'
                    }`}
                  />
                ) : (
                  <div className="p-12 flex flex-col items-center justify-center space-y-3 text-zinc-400">
                    <FileImage className="w-14 h-14 text-amber-500" />
                    <p className="text-xs font-mono">
                      Không hỗ trợ xem trực tiếp định dạng tệp này
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Info Toolbar */}
              <div className="w-full pt-3 px-1 flex flex-wrap items-center justify-between gap-2 text-xs font-mono border-t border-zinc-800/80 mt-2.5 shrink-0">
                <div className="flex items-center gap-2 text-zinc-200 font-semibold min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] shrink-0 whitespace-nowrap">
                    {lightboxIndex + 1} / {filteredAndSortedMatches.length}
                  </span>
                  <span className="text-amber-400 font-bold truncate">
                    {previewImageModalFile.filename || previewImageModalFile.name}
                  </span>
                  <span className="badge-pro badge-amber shrink-0">
                    .{normalizeExtension(previewImageModalFile.extension).toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-zinc-400 text-[11px] min-w-0">
                  <span className="whitespace-nowrap shrink-0">
                    {formatFileSize(
                      previewImageModalFile.sizeBytes ??
                        previewImageModalFile.size ??
                        0
                    )}
                  </span>
                  {previewImageModalFile.dateTaken && (
                    <>
                      <span className="shrink-0">|</span>
                      <span className="whitespace-nowrap shrink-0">
                        {previewImageModalFile.dateTaken}
                      </span>
                    </>
                  )}
                  <span className="shrink-0 hidden md:inline">|</span>
                  <span
                    className="truncate max-w-[260px] text-zinc-400 hidden md:inline"
                    title={
                      previewImageModalFile.sourcePath ||
                      previewImageModalFile.path
                    }
                  >
                    {previewImageModalFile.sourcePath ||
                      previewImageModalFile.path}
                  </span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
