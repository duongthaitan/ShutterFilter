import React, { useState, useEffect } from 'react';
import { Bookmark, Plus, Trash2, Check, DownloadCloud, FileCode } from 'lucide-react';
import { FilterConfig, Preset } from '../../shared/types';

interface PresetManagerProps {
  currentConfig: FilterConfig;
  onApplyPreset: (preset: Preset) => void;
}

export const PresetManager: React.FC<PresetManagerProps> = ({
  currentConfig,
  onApplyPreset,
}) => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [activeTab, setActiveTab] = useState<'saved' | 'new'>('saved');

  useEffect(() => {
    loadPresetsList();
  }, []);

  const loadPresetsList = async () => {
    try {
      const list = await window.electronAPI.listPresets();
      setPresets(list);
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;

    try {
      await window.electronAPI.savePreset({
        name: presetName.trim(),
        keywords_include: currentConfig.keywords_include,
        keywords_exclude: currentConfig.keywords_exclude,
        match_type: currentConfig.match_type,
        extensions: currentConfig.extensions,
        mode: currentConfig.mode,
        duplicate_policy: currentConfig.duplicate_policy,
      });

      setPresetName('');
      await loadPresetsList();
      setActiveTab('saved');
    } catch (err) {
      console.error('Failed to save preset:', err);
    }
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.electronAPI.deletePreset(id);
      await loadPresetsList();
    } catch (err) {
      console.error('Failed to delete preset:', err);
    }
  };

  return (
    <div className="panel-pro p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#28282d]">
        <div className="flex items-center gap-2.5">
          <Bookmark className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Bộ Lọc Đã Lưu (Presets)</h2>
            <p className="text-xs text-zinc-400">Lưu nhanh cấu hình lọc cho các máy ảnh hoặc dự án khác nhau.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`btn-secondary-pro text-xs ${activeTab === 'saved' ? 'border-amber-500/50 text-amber-300' : ''}`}
          >
            Danh sách ({presets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className="btn-accent text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Lưu bộ lọc hiện tại</span>
          </button>
        </div>
      </div>

      {activeTab === 'new' ? (
        <form onSubmit={handleSavePreset} className="max-w-xl bg-[#121215] p-4 rounded-lg border border-[#28282d] space-y-3">
          <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-amber-400" />
            <span>Tạo Preset Mới từ cấu hình đang chọn</span>
          </h3>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">
              Tên Preset
            </label>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="VD: Sony A7R RAW + JPEG, iPhone Export..."
              className="input-pro text-xs"
              autoFocus
              required
            />
          </div>

          <div className="bg-[#0d0d0f] p-3 rounded border border-[#28282d] text-xs font-mono text-zinc-400 space-y-1">
            <div><strong>Mode:</strong> {currentConfig.mode.toUpperCase()}</div>
            <div><strong>Kiểu khớp:</strong> {currentConfig.match_type}</div>
            <div><strong>Keywords:</strong> {currentConfig.keywords_include.filter(k=>k.trim()).join(', ') || 'Không chọn'}</div>
            <div><strong>Extensions:</strong> {currentConfig.extensions.join(', ') || 'Không chọn'}</div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setActiveTab('saved')} className="btn-secondary-pro text-xs">
              Hủy
            </button>
            <button type="submit" className="btn-accent text-xs">
              <Check className="w-4 h-4" />
              <span>Lưu Preset</span>
            </button>
          </div>
        </form>
      ) : presets.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2 border border-dashed border-[#28282d] rounded-lg">
          <Bookmark className="w-6 h-6 text-zinc-600" />
          <p className="text-xs">Chưa có Preset nào được lưu.</p>
          <button type="button" onClick={() => setActiveTab('new')} className="btn-secondary-pro text-xs mt-2">
            + Lưu bộ lọc hiện tại thành Preset đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="card-pro p-4 flex flex-col justify-between space-y-3 group hover:border-[#383842] transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-bold text-zinc-100 text-xs group-hover:text-amber-400 transition-colors">
                    {preset.name}
                  </h4>
                  <button
                    type="button"
                    onClick={(e) => handleDeletePreset(preset.id, e)}
                    className="text-zinc-600 hover:text-rose-400 p-1 rounded transition-colors"
                    title="Xóa preset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-zinc-400 font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="badge-pro badge-amber">{preset.mode.toUpperCase()}</span>
                    <span className="badge-pro badge-neutral">{preset.duplicate_policy}</span>
                  </div>
                  <div className="truncate text-[11px]">
                    Include: <span className="text-zinc-200">{preset.keywords_include.filter(k=>k.trim()).join(', ') || '(Tất cả)'}</span>
                  </div>
                  <div className="truncate text-[11px]">
                    Định dạng: <span className="text-amber-300">{preset.extensions.join(', ') || '(Tất cả)'}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onApplyPreset(preset)}
                className="btn-secondary-pro w-full justify-center text-xs text-amber-400 hover:border-amber-500/50"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Nạp Preset này</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
