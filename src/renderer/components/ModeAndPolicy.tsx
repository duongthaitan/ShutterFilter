import React from 'react';
import { Copy, Move, Settings2 } from 'lucide-react';
import { FilterConfig } from '../../shared/types';

interface ModeAndPolicyProps {
  config: FilterConfig;
  onChange: (updates: Partial<FilterConfig>) => void;
}

export const ModeAndPolicy: React.FC<ModeAndPolicyProps> = ({
  config,
  onChange,
}) => {
  return (
    <div className="panel-pro p-4 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
            Chế độ thực thi
          </h3>
        </div>
      </div>

      {/* Mode Selector - Segmented Amber Toggle with 4px Corners */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange({ mode: 'copy' })}
          className={`p-2.5 rounded-[4px] border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
            config.mode === 'copy'
              ? 'bg-[var(--accent-bg-alpha)] border-[var(--accent-border-alpha)] text-amber-500 font-semibold shadow-sm'
              : 'bg-[var(--bg-card-inset)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-focus)]'
          }`}
        >
          <Copy className={`w-4 h-4 ${config.mode === 'copy' ? 'text-amber-500' : 'text-[var(--text-dim)]'}`} />
          <div>
            <div className="text-xs font-bold">Copy (Sao chép)</div>
            <div className="text-[10px] text-[var(--text-muted)]">An toàn, giữ nguyên gốc</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange({ mode: 'move' })}
          className={`p-2.5 rounded-[4px] border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
            config.mode === 'move'
              ? 'bg-[var(--accent-bg-alpha)] border-[var(--accent-border-alpha)] text-amber-500 font-semibold shadow-sm'
              : 'bg-[var(--bg-card-inset)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-focus)]'
          }`}
        >
          <Move className={`w-4 h-4 ${config.mode === 'move' ? 'text-amber-500' : 'text-[var(--text-dim)]'}`} />
          <div>
            <div className="text-xs font-bold">Move (Di chuyển)</div>
            <div className="text-[10px] text-[var(--text-muted)]">Chuyển sang thư mục đích</div>
          </div>
        </button>
      </div>
    </div>
  );
};
