import React, { useRef } from 'react';
import { Folder, FolderOpen } from 'lucide-react';
import { FilterConfig, FileEntry } from '../../shared/types';
import { isImageExtension } from '../../shared/imageExtensions';

interface FolderPickerProps {
  config: FilterConfig;
  onChange: (updates: Partial<FilterConfig>) => void;
  onRefreshSource?: () => void;
  isScanning: boolean;
}

export const FolderPicker: React.FC<FolderPickerProps> = ({
  config,
  onChange,
}) => {
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  const getExt = (filename: string) => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  };

  const currentSource = config.sourceFolder || config.source_folder || '';
  const currentDest = config.destFolder || config.destination_folder || '';

  const handleSelectSource = async () => {
    try {
      if (window.electronAPI && !(window.electronAPI as any).isMock) {
        const selected = await window.electronAPI.selectFolder('Select Source Folder');
        if (selected) {
          onChange({ sourceFolder: selected, source_folder: selected });
        }
        return;
      }

      if ('showDirectoryPicker' in window) {
        try {
          const handle = await (window as any).showDirectoryPicker();
          if (handle) {
            const folderName = handle.name;
            const realFiles: FileEntry[] = [];

            const scanHandle = async (dirHandle: any, currentPath: string) => {
              for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') {
                  const file = await entry.getFile();
                  const ext = getExt(file.name);
                  if (ext && isImageExtension(ext)) {
                    const fullPath = `${currentPath}/${file.name}`;
                    realFiles.push({
                      id: fullPath,
                      filename: file.name,
                      name: file.name,
                      relativePath: file.name,
                      sourcePath: fullPath,
                      path: fullPath,
                      extension: ext.toLowerCase(),
                      sizeBytes: file.size,
                      size: file.size,
                      dateTaken: new Date(file.lastModified).toISOString(),
                      mtime: new Date(file.lastModified).toISOString(),
                      selected: true,
                    });
                  }
                } else if (entry.kind === 'directory') {
                  await scanHandle(entry, `${currentPath}/${entry.name}`);
                }
              }
            };

            await scanHandle(handle, folderName);
            (window as any).mockBrowserFiles = realFiles;
            onChange({ sourceFolder: folderName, source_folder: folderName });
            return;
          }
        } catch (err: any) {
          if (err.name === 'AbortError') return;
        }
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
      const fullPath = file.webkitRelativePath || file.name;
      realFiles.push({
        id: fullPath,
        filename: file.name,
        name: file.name,
        relativePath: fullPath,
        sourcePath: fullPath,
        path: fullPath,
        extension: ext.toLowerCase(),
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
        const selected = await window.electronAPI.selectFolder('Select Destination Folder');
        if (selected) {
          onChange({ destFolder: selected, destination_folder: selected });
        }
        return;
      }

      if ('showDirectoryPicker' in window) {
        try {
          const handle = await (window as any).showDirectoryPicker();
          if (handle) {
            onChange({ destFolder: handle.name, destination_folder: handle.name });
            return;
          }
        } catch (err: any) {
          if (err.name === 'AbortError') return;
        }
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

  return (
    <div className="panel-pro p-4 space-y-3 animate-fade-in">
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

      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
            Thư mục ảnh
          </h3>
        </div>
      </div>

      {/* Source Folder Input */}
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
          Thư mục Nguồn (Ảnh gốc)
        </label>
        <div className="relative flex items-center">
          <input
            type="text"
            value={currentSource}
            onChange={(e) => onChange({ sourceFolder: e.target.value, source_folder: e.target.value })}
            placeholder="Chọn vị trí thư mục ảnh gốc"
            className="input-pro pr-20 font-mono text-xs"
          />
          <button
            type="button"
            onClick={handleSelectSource}
            className="absolute right-1 px-2.5 py-1 text-xs font-medium bg-[var(--bg-card-inset)] hover:bg-[var(--bg-card-hover)] active:scale-[0.97] text-[var(--text-main)] rounded-[3px] border border-[var(--border-subtle)] transition-all duration-150 flex items-center gap-1 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Duyệt</span>
          </button>
        </div>
      </div>

      {/* Destination Folder Input */}
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
          Thư mục Đích (Nơi lưu kết quả)
        </label>
        <div className="relative flex items-center">
          <input
            type="text"
            value={currentDest}
            onChange={(e) => onChange({ destFolder: e.target.value, destination_folder: e.target.value })}
            placeholder="Chọn vị trí thư mục ảnh đã lọc"
            className="input-pro pr-20 font-mono text-xs"
          />
          <button
            type="button"
            onClick={handleSelectDestination}
            className="absolute right-1 px-2.5 py-1 text-xs font-medium bg-[var(--bg-card-inset)] hover:bg-[var(--bg-card-hover)] active:scale-[0.97] text-[var(--text-main)] rounded-[3px] border border-[var(--border-subtle)] transition-all duration-150 flex items-center gap-1 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Duyệt</span>
          </button>
        </div>
      </div>
    </div>
  );
};
