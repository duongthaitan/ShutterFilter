import React from 'react';
import { Filter, CheckSquare, Square, FolderSearch } from 'lucide-react';
import { FilterConfig } from '../../shared/types';

interface DetectedExt {
  ext: string;
  count: number;
  isRaw: boolean;
}

interface FilterCriteriaProps {
  config: FilterConfig;
  onChange: (updates: Partial<FilterConfig>) => void;
  detectedExtensions?: DetectedExt[];
}

export const FilterCriteria: React.FC<FilterCriteriaProps> = ({
  config,
  onChange,
  detectedExtensions = [],
}) => {
  const handleIncludeChange = (text: string) => {
    const lines = text.split('\n');
    onChange({ keywords_include: lines });
  };

  const toggleExtension = (ext: string) => {
    const current = config.extensions || [];
    const cleanExt = ext.toLowerCase().replace(/^\./, '');
    if (current.includes(cleanExt) || current.includes(`.${cleanExt}`)) {
      onChange({
        extensions: current.filter(
          (e) => e !== cleanExt && e !== `.${cleanExt}`
        ),
      });
    } else {
      onChange({ extensions: [...current, cleanExt] });
    }
  };

  const isExtSelected = (ext: string) => {
    const cleanExt = ext.toLowerCase().replace(/^\./, '');
    const current = config.extensions || [];
    return (
      current.includes(cleanExt) ||
      current.includes(`.${cleanExt}`)
    );
  };

  const placeholderText = `Nhập hoặc dán danh sách tên file (Mỗi dòng 1 tên)

Ví dụ:
Tenanh1
Tenanh2
Tenanh3
Tenanh4
Tenanh5`;

  return (
    <div className="panel-pro p-4 space-y-3.5 animate-fade-in">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
            Điều kiện lọc
          </h3>
        </div>
      </div>

      {/* Keywords Input */}
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
          Danh sách tên file (Mỗi dòng 1 tên)
        </label>
        <textarea
          rows={7}
          value={config.keywords_include.join('\n')}
          onChange={(e) => handleIncludeChange(e.target.value)}
          placeholder={placeholderText}
          className="input-pro font-mono text-xs resize-none transition-all duration-200"
        />
      </div>

      {/* Dynamic Extension Selection - Default OFF / Unchecked */}
      <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
            Định dạng ảnh
          </span>
          <span className="text-[10px] text-amber-500 font-medium">
            {(!config.extensions || config.extensions.length === 0)
              ? '(Mặc định: Tắt / Lọc tất cả định dạng)'
              : `(${config.extensions.length} định dạng được chọn)`}
          </span>
        </div>

        {/* Dynamic Chips Grid for Extensions Found in Source Folder with 60fps Micro-Animations */}
        {detectedExtensions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {detectedExtensions.map((item) => {
              const extClean = item.ext.toLowerCase().replace(/^\./, '');
              const selected = isExtSelected(extClean);

              return (
                <button
                  key={extClean}
                  type="button"
                  onClick={() => toggleExtension(extClean)}
                  className={`px-3 py-1.5 rounded-[4px] text-xs font-mono transition-all duration-150 ease-out flex items-center gap-1.5 border cursor-pointer active:scale-95 ${
                    selected
                      ? 'bg-[var(--accent-bg-alpha)] text-amber-500 border-[var(--accent-border-alpha)] font-bold shadow-sm scale-[1.02]'
                      : 'bg-[var(--bg-card-inset)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border-focus)] opacity-80 hover:opacity-100'
                  }`}
                >
                  {selected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-amber-500 transition-transform duration-150 scale-110" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-[var(--text-dim)] transition-transform duration-150" />
                  )}
                  <span>.{extClean.toUpperCase()}</span>
                  {item.isRaw && (
                    <span className="text-[9px] px-1 bg-[var(--bg-card-hover)] text-amber-500 rounded-[2px] font-normal">
                      RAW
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-3 bg-[var(--bg-card-inset)] border border-[var(--border-subtle)] rounded-[4px] text-xs text-[var(--text-muted)] flex items-center gap-2">
            <FolderSearch className="w-4 h-4 text-[var(--text-dim)] shrink-0" />
            <span>Vui lòng chọn Thư mục nguồn để nhận diện định dạng ảnh thực tế.</span>
          </div>
        )}
      </div>
    </div>
  );
};
