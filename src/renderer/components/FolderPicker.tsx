import React, { useRef, useState } from 'react';
import {
  Folder,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  FolderPlus,
  ExternalLink,
} from 'lucide-react';
import { FilterConfig, FileEntry } from '../../shared/types';
import { isImageExtension } from '../../shared/imageExtensions';

interface FolderPickerProps {
  config: FilterConfig;
  onChange: (updates: Partial<FilterConfig>) => void;
  onRefreshSource?: () => void;
  isScanning: boolean;
  hasPathConflict?: boolean;
}

export const FolderPicker: React.FC<FolderPickerProps> = ({
  config,
  onChange,
  onRefreshSource,
  isScanning,
  hasPathConflict = false,
}) => {
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const [dragTarget, setDragTarget] = useState<'source' | 'dest' | null>(null);

  const getExt = (filename: string) => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  };

  const currentSource = config.sourceFolder || config.source_folder || '';
  const currentDest = config.destFolder || config.destination_folder || '';

  const handleSelectSource = async () => {
    try {
      if (window.electronAPI && !(window.electronAPI as any).isMock) {
        const selected = await window.electronAPI.selectFolder({
          defaultPath: currentSource || undefined,
          title: 'Chọn thư mục nguồn (Ảnh gốc)',
        });
        if (selected) {
          onChange({ sourceFolder: selected, source_folder: selected });
        }
        return;
      }

      if (window.electronAPI && (window.electronAPI as any).isMock) {
        const selected = await window.electronAPI.selectFolder({
          title: 'Chọn thư mục nguồn',
        });
        if (selected) {
          onChange({ sourceFolder: selected, source_folder: selected });
        }
        return;
      }

      sourceInputRef.current?.click();
    } catch (err) {
      console.error('Folder picker error:', err);
    }
  };

  const handleSourceFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const firstFile = files[0];
    const relativePath = firstFile.webkitRelativePath || firstFile.name;
    const folderName = relativePath.split('/')[0] || 'Selected_Folder';

    const realFiles: FileEntry[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = getExt(file.name);
      if (!ext || !isImageExtension(ext)) continue;
      const fullPath = file.webkitRelativePath || file.name;
      realFiles.push({
        id: fullPath,
        filename: file.name,
        name: file.name,
        relativePath: fullPath,
        sourcePath: fullPath,
        path: fullPath,
        extension: `.${ext.toLowerCase()}`,
        sizeBytes: file.size,
        size: file.size,
        dateTaken: new Date(file.lastModified).toISOString(),
        mtime: new Date(file.lastModified).toISOString(),
        selected: true,
      });
    }

    (window as any).mockBrowserFiles = realFiles;
    onChange({ sourceFolder: folderName, source_folder: folderName });
  };

  const handleSelectDestination = async () => {
    try {
      if (window.electronAPI && !(window.electronAPI as any).isMock) {
        const selected = await window.electronAPI.selectFolder({
          defaultPath: currentDest || currentSource || undefined,
          title: 'Chọn thư mục đích (Nơi lưu ảnh đã lọc)',
        });
        if (selected) {
          onChange({ destFolder: selected, destination_folder: selected });
        }
        return;
      }

      if (window.electronAPI && (window.electronAPI as any).isMock) {
        const selected = await window.electronAPI.selectFolder({
          title: 'Chọn thư mục đích',
        });
        if (selected) {
          onChange({ destFolder: selected, destination_folder: selected });
        }
        return;
      }

      destInputRef.current?.click();
    } catch (err) {
      console.error('Destination picker error:', err);
    }
  };

  const handleDestFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const firstFile = files[0];
    const relativePath = firstFile.webkitRelativePath || firstFile.name;
    const folderName = relativePath.split('/')[0] || 'Selected_Destination';
    onChange({ destFolder: folderName, destination_folder: folderName });
  };

  const handleQuickSubfolderDest = () => {
    if (!currentSource.trim()) return;
    const trimmed = currentSource.trim().replace(/[\\/]+$/, '');
    const sep = trimmed.includes('\\') ? '\\' : '/';
    const quickPath = `${trimmed}${sep}Da_Loc`;
    onChange({ destFolder: quickPath, destination_folder: quickPath });
  };

  const handleDropFolder = (
    e: React.DragEvent<HTMLDivElement>,
    target: 'source' | 'dest'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(null);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const resolvedPath = window.electronAPI?.getPathForFile
      ? window.electronAPI.getPathForFile(file)
      : (file as File & { path?: string }).path || '';

    if (!resolvedPath) return;

    if (target === 'source') {
      onChange({ sourceFolder: resolvedPath, source_folder: resolvedPath });
    } else {
      onChange({ destFolder: resolvedPath, destination_folder: resolvedPath });
    }
  };

  return (
    <section className="px-4 py-3.5 space-y-2.5">
      <input
        ref={sourceInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={handleSourceFilesSelected}
      />
      <input
        ref={destInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={handleDestFilesSelected}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--text-main)]">
            Thư mục làm việc
          </h2>
        </div>

        {currentSource && onRefreshSource && (
          <button
            type="button"
            onClick={onRefreshSource}
            disabled={isScanning}
            className="btn-ghost-pro text-[11px] px-2 py-1"
            title="Quét lại thư mục nguồn để cập nhật file mới"
          >
            <RefreshCw
              className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
            <span>Quét lại</span>
          </button>
        )}
      </div>

      {/* Source Folder Input with Drag & Drop */}
      <div
        className="space-y-1.5"
        onDragOver={(e) => {
          e.preventDefault();
          setDragTarget('source');
        }}
        onDragLeave={() => setDragTarget(null)}
        onDrop={(e) => handleDropFolder(e, 'source')}
      >
        <div className="flex items-center justify-between">
          <label
            htmlFor="source-folder-input"
            className="block text-xs font-medium text-[var(--text-muted)]"
          >
            Thư mục nguồn
          </label>
          {currentSource && (
            <button
              type="button"
              onClick={() => window.electronAPI?.openFolder(currentSource)}
              className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-main)] flex items-center gap-1 cursor-pointer transition-colors"
              title="Mở thư mục nguồn trong Explorer"
            >
              <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
              <span>Mở</span>
            </button>
          )}
        </div>
        <div className="relative flex items-center">
          <input
            id="source-folder-input"
            type="text"
            value={currentSource}
            onChange={(e) =>
              onChange({ sourceFolder: e.target.value, source_folder: e.target.value })
            }
            placeholder="Chọn hoặc kéo thả thư mục ảnh gốc..."
            className={`input-pro pr-20 font-mono text-xs ${
              dragTarget === 'source' ? 'dropzone-active' : ''
            }`}
          />
          <button
            type="button"
            onClick={handleSelectSource}
            className="absolute right-1.5 px-2.5 py-1 text-xs font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] active:scale-[0.97] text-[var(--text-main)] rounded-[5px] border border-[var(--border-subtle)] transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
            <span>Duyệt</span>
          </button>
        </div>
      </div>

      {/* Destination Folder Input with Drag & Drop */}
      <div
        className="space-y-1.5"
        onDragOver={(e) => {
          e.preventDefault();
          setDragTarget('dest');
        }}
        onDragLeave={() => setDragTarget(null)}
        onDrop={(e) => handleDropFolder(e, 'dest')}
      >
        <div className="flex items-center justify-between">
          <label
            htmlFor="dest-folder-input"
            className="block text-xs font-medium text-[var(--text-muted)]"
          >
            Thư mục đích
          </label>
          {currentSource && !currentDest && (
            <button
              type="button"
              onClick={handleQuickSubfolderDest}
              className="text-[11px] font-medium text-[var(--accent-strong)] hover:underline flex items-center gap-1 cursor-pointer"
              title="Tự động tạo thư mục con Da_Loc bên trong thư mục nguồn"
            >
              <FolderPlus className="w-3 h-3" strokeWidth={1.75} />
              <span>Tạo nhanh /Da_Loc</span>
            </button>
          )}
          {currentDest && (
            <button
              type="button"
              onClick={() => window.electronAPI?.openFolder(currentDest)}
              className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-main)] flex items-center gap-1 cursor-pointer transition-colors"
              title="Mở thư mục đích trong Explorer"
            >
              <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
              <span>Mở</span>
            </button>
          )}
        </div>
        <div className="relative flex items-center">
          <input
            id="dest-folder-input"
            type="text"
            value={currentDest}
            onChange={(e) =>
              onChange({ destFolder: e.target.value, destination_folder: e.target.value })
            }
            placeholder="Chọn hoặc kéo thả nơi lưu ảnh đã lọc..."
            className={`input-pro pr-20 font-mono text-xs ${
              dragTarget === 'dest' ? 'dropzone-active' : ''
            } ${hasPathConflict ? 'border-[var(--status-danger)]' : ''}`}
          />
          <button
            type="button"
            onClick={handleSelectDestination}
            className="absolute right-1.5 px-2.5 py-1 text-xs font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] active:scale-[0.97] text-[var(--text-main)] rounded-[5px] border border-[var(--border-subtle)] transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
            <span>Duyệt</span>
          </button>
        </div>
      </div>

      {/* Inline validation alert when source === dest */}
      {hasPathConflict && (
        <div className="flex items-start gap-2 p-2.5 rounded-[6px] bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-xs text-[var(--status-danger)]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
          <span>Thư mục nguồn và thư mục đích không được trùng nhau.</span>
        </div>
      )}
    </section>
  );
};
