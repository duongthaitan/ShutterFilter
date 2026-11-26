import React, { useState } from 'react';
import {
  Copy,
  Move,
  Settings2,
  ChevronDown,
  ChevronUp,
  FolderTree,
  ShieldAlert,
} from 'lucide-react';
import {
  FilterConfig,
  DuplicatePolicy,
  AutoSubfolderMode,
} from '../../shared/types';

interface ModeAndPolicyProps {
  config: FilterConfig;
  onChange: (updates: Partial<FilterConfig>) => void;
}

export const ModeAndPolicy: React.FC<ModeAndPolicyProps> = ({
  config,
  onChange,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const customAdvancedCount =
    (config.duplicate_policy !== 'auto_rename' && config.duplicate_policy !== 'rename' ? 1 : 0) +
    (config.auto_subfolder !== 'none' ? 1 : 0) +
    (!config.recursive ? 1 : 0);

  const handleDuplicatePolicyChange = (policy: DuplicatePolicy) => {
    onChange({
      duplicate_policy: policy,
      allow_overwrite: policy === 'overwrite',
    });
  };

  return (
    <div className="panel-pro p-3.5 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
            Chế độ thực thi
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>Tùy chọn nâng cao</span>
          {customAdvancedCount > 0 && (
            <span className="badge-pro badge-amber">{customAdvancedCount}</span>
          )}
          {showAdvanced ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange({ mode: 'copy' })}
          className={`p-2.5 rounded-[4px] border text-left transition-colors flex items-center gap-2.5 cursor-pointer active:scale-[0.98] ${
            config.mode === 'copy'
              ? 'bg-[var(--accent-bg-alpha)] border-[var(--accent-border-alpha)] text-[var(--accent-strong)] font-semibold'
              : 'bg-[var(--bg-card-inset)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text-main)]'
          }`}
        >
          <Copy
            className={`w-4 h-4 shrink-0 ${
              config.mode === 'copy' ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
            }`}
          />
          <div className="min-w-0">
            <div className="text-xs font-bold whitespace-nowrap">Copy</div>
            <div className="text-[10px] text-[var(--text-muted)] truncate">
              Sao chép, giữ ảnh gốc
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange({ mode: 'move' })}
          className={`p-2.5 rounded-[4px] border text-left transition-colors flex items-center gap-2.5 cursor-pointer active:scale-[0.98] ${
            config.mode === 'move'
              ? 'bg-[var(--status-danger-bg)] border-[var(--status-danger-border)] text-[var(--status-danger)] font-semibold'
              : 'bg-[var(--bg-card-inset)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text-main)]'
          }`}
        >
          <Move
            className={`w-4 h-4 shrink-0 ${
              config.mode === 'move'
                ? 'text-[var(--status-danger)]'
                : 'text-[var(--text-dim)]'
            }`}
          />
          <div className="min-w-0">
            <div className="text-xs font-bold whitespace-nowrap">Move</div>
            <div className="text-[10px] text-[var(--text-muted)] truncate">
              Di chuyển sang đích
            </div>
          </div>
        </button>
      </div>

      {/* Collapsible Advanced Options */}
      {showAdvanced && (
        <div className="pt-2.5 border-t border-[var(--border-subtle)] space-y-3 animate-fade-in">
          {/* Duplicate File Policy */}
          <div className="space-y-1">
            <label
              htmlFor="duplicate-policy-select"
              className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide"
            >
              Khi trùng tên ở đích
            </label>
            <select
              id="duplicate-policy-select"
              value={config.duplicate_policy === 'rename' ? 'auto_rename' : config.duplicate_policy}
              onChange={(e) =>
                handleDuplicatePolicyChange(e.target.value as DuplicatePolicy)
              }
              className="input-pro text-xs cursor-pointer"
            >
              <option value="auto_rename">Tự động đổi tên (_1, _2...)</option>
              <option value="skip">Bỏ qua file đã tồn tại</option>
              <option value="overwrite">Ghi đè lên file cũ ở đích</option>
            </select>
            {config.duplicate_policy === 'overwrite' && (
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--status-danger)] pt-0.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>File trùng tên tại thư mục đích sẽ bị ghi đè trực tiếp.</span>
              </div>
            )}
          </div>

          {/* Auto Subfolder Grouping */}
          <div className="space-y-1">
            <label
              htmlFor="auto-subfolder-select"
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide"
            >
              <FolderTree className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Tự động phân thư mục con</span>
            </label>
            <select
              id="auto-subfolder-select"
              value={config.auto_subfolder}
              onChange={(e) =>
                onChange({ auto_subfolder: e.target.value as AutoSubfolderMode })
              }
              className="input-pro text-xs cursor-pointer"
            >
              <option value="none">Không chia thư mục con (lưu chung)</option>
              <option value="by_extension">Chia theo định dạng (JPG, ARW, CR3...)</option>
              <option value="by_date">Chia theo ngày chụp (YYYY-MM-DD)</option>
              <option value="by_keyword">Chia theo từ khóa khớp</option>
            </select>
          </div>

          {/* Recursive Scan Toggle */}
          <label className="flex items-center justify-between gap-2 pt-1 cursor-pointer">
            <div>
              <div className="text-xs font-medium text-[var(--text-main)]">
                Quét cả thư mục con
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                Tự động tìm ảnh trong tất cả thư mục con bên trong nguồn
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.recursive}
              onChange={(e) => onChange({ recursive: e.target.checked })}
              className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
            />
          </label>
        </div>
      )}
    </div>
  );
};
