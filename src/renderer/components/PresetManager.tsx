import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Plus,
  Trash2,
  Check,
  DownloadCloud,
  FileCode,
} from 'lucide-react';
import { FilterConfig, Preset } from '../../shared/types';

interface PresetManagerProps {
  currentConfig: FilterConfig;
  onApplyPreset: (preset: Preset) => void;
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const PresetManager: React.FC<PresetManagerProps> = ({
  currentConfig,
  onApplyPreset,
  onNotify,
}) => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [presetName, setPresetName] = useState('');
  const [activeTab, setActiveTab] = useState<'saved' | 'new'>('saved');

  useEffect(() => {
    loadPresetsList();
  }, []);

  const loadPresetsList = async () => {
    setIsLoading(true);
    try {
      const list = await window.electronAPI.listPresets();
      setPresets(list);
    } catch (err) {
      console.error('Failed to load presets:', err);
      onNotify?.('Không thể tải danh sách bộ lọc mẫu.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;

    try {
      await window.electronAPI.savePreset({
        name: presetName.trim(),
        keywords_include: currentConfig.keywords_include.filter((k) => k.trim()),
        keywords_exclude: currentConfig.keywords_exclude.filter((k) => k.trim()),
        match_type: currentConfig.match_type,
        extensions: currentConfig.extensions,
        mode: currentConfig.mode,
        duplicate_policy: currentConfig.duplicate_policy,
      });

      onNotify?.(`Đã lưu bộ lọc mẫu "${presetName.trim()}".`, 'success');
      setPresetName('');
      await loadPresetsList();
      setActiveTab('saved');
    } catch (err) {
      console.error('Failed to save preset:', err);
      onNotify?.('Không thể lưu bộ lọc mẫu.', 'error');
    }
  };

  const handleDeletePreset = async (preset: Preset, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.electronAPI.deletePreset(preset.id);
      setPresets((prev) => prev.filter((p) => p.id !== preset.id));
      onNotify?.(`Đã xóa bộ lọc mẫu "${preset.name}".`, 'info');
    } catch (err) {
      console.error('Failed to delete preset:', err);
      onNotify?.('Không thể xóa bộ lọc mẫu.', 'error');
    }
  };

  return (
    <div className="panel-pro p-5 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5">
          <Bookmark className="w-5 h-5 text-[var(--accent)]" />
          <div>
            <h2 className="text-sm font-bold text-[var(--text-main)]">
              Bộ Lọc Đã Lưu (Presets)
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Lưu nhanh cấu hình lọc định dạng, từ khóa và chế độ cho từng máy ảnh hoặc dự án.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`btn-secondary-pro text-xs ${
              activeTab === 'saved'
                ? 'border-[var(--accent-border-alpha)] text-[var(--accent-strong)]'
                : ''
            }`}
          >
            Danh sách ({presets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className="btn-accent text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Lưu cấu hình hiện tại</span>
          </button>
        </div>
      </div>

      {activeTab === 'new' ? (
        <form
          onSubmit={handleSavePreset}
          className="max-w-xl bg-[var(--bg-card)] p-4 rounded-[6px] border border-[var(--border-subtle)] space-y-3 animate-fade-in"
        >
          <h3 className="text-xs font-bold text-[var(--text-main)] flex items-center gap-2">
            <FileCode className="w-4 h-4 text-[var(--accent)]" />
            <span>Tạo bộ lọc mẫu từ cấu hình đang chọn</span>
          </h3>

          <div className="space-y-1">
            <label
              htmlFor="preset-name-input"
              className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide"
            >
              Tên bộ lọc mẫu
            </label>
            <input
              id="preset-name-input"
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="VD: Sony A7R RAW + JPEG, Tách ảnh cưới Canon..."
              className="input-pro text-xs"
              autoFocus
              required
            />
          </div>

          <div className="bg-[var(--bg-card-inset)] p-3 rounded-[4px] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] space-y-1">
            <div>
              <strong className="text-[var(--text-main)]">Chế độ:</strong>{' '}
              {currentConfig.mode.toUpperCase()}
            </div>
            <div>
              <strong className="text-[var(--text-main)]">Kiểu khớp:</strong>{' '}
              {currentConfig.match_type}
            </div>
            <div>
              <strong className="text-[var(--text-main)]">Từ khóa:</strong>{' '}
              {currentConfig.keywords_include.filter((k) => k.trim()).length > 0
                ? `${currentConfig.keywords_include.filter((k) => k.trim()).length} mục`
                : 'Trống'}
            </div>
            <div>
              <strong className="text-[var(--text-main)]">Định dạng:</strong>{' '}
              {currentConfig.extensions.length > 0
                ? currentConfig.extensions.map((e) => `.${e.replace(/^\./, '').toUpperCase()}`).join(', ')
                : 'Tất cả định dạng'}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className="btn-secondary-pro text-xs"
            >
              Hủy
            </button>
            <button type="submit" className="btn-accent text-xs">
              <Check className="w-4 h-4" />
              <span>Lưu mẫu</span>
            </button>
          </div>
        </form>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-bar h-36 w-full" />
          ))}
        </div>
      ) : presets.length === 0 ? (
        <div className="py-12 text-center text-[var(--text-muted)] flex flex-col items-center justify-center gap-2 border border-dashed border-[var(--border-subtle)] rounded-[6px]">
          <Bookmark className="w-6 h-6 text-[var(--text-dim)]" />
          <p className="text-xs">Chưa có bộ lọc mẫu nào được lưu.</p>
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className="btn-secondary-pro text-xs mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Lưu cấu hình hiện tại làm mẫu đầu tiên</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="card-pro p-4 flex flex-col justify-between space-y-3 group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-bold text-[var(--text-main)] text-xs group-hover:text-[var(--accent-strong)] transition-colors">
                    {preset.name}
                  </h4>
                  <button
                    type="button"
                    onClick={(e) => handleDeletePreset(preset, e)}
                    className="text-[var(--text-dim)] hover:text-[var(--status-danger)] p-1 rounded transition-colors cursor-pointer"
                    title="Xóa bộ lọc mẫu"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-[var(--text-muted)] font-mono">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="badge-pro badge-amber">
                      {preset.mode.toUpperCase()}
                    </span>
                    <span className="badge-pro badge-neutral">
                      {preset.match_type}
                    </span>
                    <span className="badge-pro badge-neutral">
                      {preset.duplicate_policy}
                    </span>
                  </div>
                  <div className="truncate text-[11px]">
                    Tên file:{' '}
                    <span className="text-[var(--text-main)]">
                      {preset.keywords_include.filter((k) => k.trim()).join(', ') ||
                        '(Trống)'}
                    </span>
                  </div>
                  <div className="truncate text-[11px]">
                    Định dạng:{' '}
                    <span className="text-[var(--accent-strong)]">
                      {preset.extensions.length > 0
                        ? preset.extensions
                            .map((e) => `.${e.replace(/^\./, '').toUpperCase()}`)
                            .join(', ')
                        : '(Tất cả)'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onApplyPreset(preset)}
                className="btn-secondary-pro w-full justify-center text-xs text-[var(--accent-strong)] hover:border-[var(--accent-border-alpha)]"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Áp dụng mẫu này</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
