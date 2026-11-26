import React, { useMemo, useState } from 'react';
import {
  Filter,
  CheckSquare,
  Square,
  FolderSearch,
  Sparkles,
  Trash2,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { FilterConfig, DetectedExtension, MatchType } from '../../shared/types';
import { normalizeExtension } from '../../shared/imageExtensions';

interface FilterCriteriaProps {
  config: FilterConfig;
  onChange: (updates: Partial<FilterConfig>) => void;
  detectedExtensions?: DetectedExtension[];
  unmatchedKeywords?: string[];
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const KNOWN_EXT_REGEX =
  /\.(jpe?g|png|webp|heic|heif|tiff?|bmp|gif|psd|arw|cr2|cr3|nef|dng|raf|orf|rw2|pef|srw|x3f|erf|mrw)$/i;

export const FilterCriteria: React.FC<FilterCriteriaProps> = ({
  config,
  onChange,
  detectedExtensions = [],
  unmatchedKeywords = [],
  onNotify,
}) => {
  const [showUnmatchedList, setShowUnmatchedList] = useState(false);
  const [showExcludeInput, setShowExcludeInput] = useState(
    () => (config.keywords_exclude || []).some((k) => k.trim().length > 0)
  );
  const [copiedMissing, setCopiedMissing] = useState(false);

  const activeKeywordCount = useMemo(() => {
    const seen = new Set<string>();
    for (const raw of config.keywords_include) {
      const t = raw.trim();
      if (t) seen.add(t.toLowerCase());
    }
    return seen.size;
  }, [config.keywords_include]);

  const handleIncludeChange = (text: string) => {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    onChange({ keywords_include: lines });
  };

  /**
   * Smart list cleaner: splits comma/semicolon/tab separated lists, removes bullet/number prefixes,
   * strips file extensions (so DSC001.jpg matches both JPG & RAW), and deduplicates.
   */
  const handleNormalizeList = () => {
    const rawText = config.keywords_include.join('\n');
    const tokens = rawText
      .split(/[\n,;|\t]+/)
      .map((item) =>
        item
          .trim()
          .replace(/^[-*•]+\s*/, '')
          .replace(/^\d+[.)]\s+/, '')
          .replace(KNOWN_EXT_REGEX, '')
          .trim()
      )
      .filter((item) => item.length > 0);

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const token of tokens) {
      const key = token.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(token);
      }
    }

    onChange({ keywords_include: unique });
    onNotify?.(`Đã chuẩn hóa còn ${unique.length} tên ảnh duy nhất.`, 'success');
  };

  const handleClearKeywords = () => {
    onChange({ keywords_include: [] });
    setShowUnmatchedList(false);
  };

  const handleCopyUnmatched = async () => {
    if (unmatchedKeywords.length === 0) return;
    try {
      await navigator.clipboard.writeText(unmatchedKeywords.join('\n'));
      setCopiedMissing(true);
      onNotify?.(`Đã sao chép ${unmatchedKeywords.length} tên ảnh không tìm thấy.`, 'info');
      setTimeout(() => setCopiedMissing(false), 1800);
    } catch {
      onNotify?.('Không thể sao chép vào clipboard.', 'error');
    }
  };

  const toggleExtension = (ext: string) => {
    const current = config.extensions || [];
    const cleanExt = normalizeExtension(ext);
    if (current.some((e) => normalizeExtension(e) === cleanExt)) {
      onChange({
        extensions: current.filter((e) => normalizeExtension(e) !== cleanExt),
      });
    } else {
      onChange({ extensions: [...current, cleanExt] });
    }
  };

  const isExtSelected = (ext: string) => {
    const cleanExt = normalizeExtension(ext);
    return (config.extensions || []).some((e) => normalizeExtension(e) === cleanExt);
  };

  const matchModes: { value: MatchType; label: string; hint: string }[] = [
    { value: 'contains', label: 'Chứa', hint: 'Khớp nếu tên file chứa từ khóa' },
    { value: 'starts_with', label: 'Bắt đầu', hint: 'Khớp nếu tên file bắt đầu bằng từ khóa' },
    { value: 'exact', label: 'Chính xác', hint: 'Khớp đúng toàn bộ tên file (không tính đuôi)' },
  ];

  const placeholderText = `Dán danh sách tên ảnh (mỗi dòng 1 tên, hoặc cách nhau bởi dấu phẩy)

Ví dụ:
DTT00970
DTT00971
DTT00972`;

  return (
    <div className="panel-pro p-3.5 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
            Điều kiện lọc
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          {activeKeywordCount > 0 && (
            <>
              <span className="badge-pro badge-amber">{activeKeywordCount} tên</span>
              <button
                type="button"
                onClick={handleNormalizeList}
                className="px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[var(--bg-card-inset)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Tách dấu phẩy, bỏ đuôi file (.jpg/.arw) và xóa dòng trùng lặp"
              >
                <Sparkles className="w-3 h-3 text-[var(--accent)] shrink-0" />
                <span>Chuẩn hóa</span>
              </button>
              <button
                type="button"
                onClick={handleClearKeywords}
                className="p-1 rounded-[4px] text-[var(--text-dim)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] transition-colors cursor-pointer"
                title="Xóa toàn bộ danh sách tên ảnh"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Keywords Textarea */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="keywords-include-input"
            className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide"
          >
            Danh sách tên file
          </label>

          {/* Compact Match Mode Selector */}
          <div className="inline-flex items-center bg-[var(--bg-card-inset)] p-0.5 rounded-[4px] border border-[var(--border-subtle)] shrink-0">
            {matchModes.map((mode) => {
              const active =
                config.match_type === mode.value ||
                (mode.value === 'starts_with' && config.match_type === 'prefix');
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => onChange({ match_type: mode.value })}
                  title={mode.hint}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-[3px] transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[var(--bg-card)] text-[var(--accent-strong)] shadow-xs border border-[var(--border-focus)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] border border-transparent'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          id="keywords-include-input"
          rows={6}
          value={config.keywords_include.join('\n')}
          onChange={(e) => handleIncludeChange(e.target.value)}
          placeholder={placeholderText}
          spellCheck={false}
          className="input-pro font-mono text-xs resize-y min-h-[116px] max-h-[260px] leading-relaxed"
        />

        {/* Unmatched Keywords Alert */}
        {unmatchedKeywords.length > 0 && (
          <div className="rounded-[4px] bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setShowUnmatchedList((v) => !v)}
                className="flex items-center gap-1.5 font-semibold text-[var(--status-warning)] cursor-pointer text-left"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{unmatchedKeywords.length} tên chưa tìm thấy trong thư mục</span>
                {showUnmatchedList ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyUnmatched}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-focus)] flex items-center gap-1 cursor-pointer shrink-0"
                title="Sao chép danh sách tên không tìm thấy"
              >
                {copiedMissing ? (
                  <Check className="w-3 h-3 text-[var(--status-success)]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedMissing ? 'Đã chép' : 'Sao chép'}</span>
              </button>
            </div>

            {showUnmatchedList && (
              <div className="max-h-24 overflow-y-auto font-mono text-[11px] text-[var(--text-main)] bg-[var(--bg-card)] rounded-[3px] p-1.5 border border-[var(--border-subtle)] flex flex-wrap gap-1 select-text">
                {unmatchedKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-1.5 py-0.5 rounded bg-[var(--bg-card-inset)] border border-[var(--border-subtle)] text-[10px]"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsible Exclude Keywords */}
        <div>
          <button
            type="button"
            onClick={() => setShowExcludeInput((v) => !v)}
            className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1 cursor-pointer transition-colors"
          >
            {showExcludeInput ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            <span>
              Từ khóa loại trừ
              {config.keywords_exclude.filter((k) => k.trim()).length > 0 &&
                ` (${config.keywords_exclude.filter((k) => k.trim()).length})`}
            </span>
          </button>

          {showExcludeInput && (
            <div className="mt-1.5">
              <input
                type="text"
                value={config.keywords_exclude.join(', ')}
                onChange={(e) => {
                  const items = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0);
                  onChange({ keywords_exclude: items });
                }}
                placeholder="VD: _WA, _edit, draft (cách nhau bởi dấu phẩy)"
                className="input-pro font-mono text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Extension Selection - Default OFF / Unchecked */}
      <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
            Định dạng ảnh
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--accent-strong)] font-medium">
              {!config.extensions || config.extensions.length === 0
                ? 'Tất cả định dạng'
                : `${config.extensions.length} định dạng chọn`}
            </span>
            {config.extensions && config.extensions.length > 0 && (
              <button
                type="button"
                onClick={() => onChange({ extensions: [] })}
                className="text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] underline cursor-pointer"
              >
                Đặt lại
              </button>
            )}
          </div>
        </div>

        {detectedExtensions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {detectedExtensions.map((item) => {
              const extClean = normalizeExtension(item.ext);
              const selected = isExtSelected(extClean);

              return (
                <button
                  key={extClean}
                  type="button"
                  onClick={() => toggleExtension(extClean)}
                  className={`px-2.5 py-1 rounded-[4px] text-xs font-mono transition-colors duration-150 flex items-center gap-1.5 border cursor-pointer active:scale-[0.97] ${
                    selected
                      ? 'bg-[var(--accent-bg-alpha)] text-[var(--accent-strong)] border-[var(--accent-border-alpha)] font-bold'
                      : 'bg-[var(--bg-card-inset)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border-focus)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {selected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[var(--accent)]" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-[var(--text-dim)]" />
                  )}
                  <span>.{extClean.toUpperCase()}</span>
                  <span className="text-[10px] opacity-75">
                    ({item.count.toLocaleString('vi-VN')})
                  </span>
                  {item.isRaw && (
                    <span className="text-[9px] px-1 py-px bg-[var(--bg-card)] text-[var(--accent-strong)] border border-[var(--accent-border-alpha)] rounded-[3px] font-semibold">
                      RAW
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-2.5 bg-[var(--bg-card-inset)] border border-[var(--border-subtle)] rounded-[4px] text-xs text-[var(--text-muted)] flex items-center gap-2">
            <FolderSearch className="w-4 h-4 text-[var(--text-dim)] shrink-0" />
            <span>Chọn thư mục nguồn để tự động nhận diện định dạng ảnh.</span>
          </div>
        )}
      </div>
    </div>
  );
};
