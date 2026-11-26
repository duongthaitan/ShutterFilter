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
    <section className="px-4 py-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--text-main)]">
            Danh sách ảnh chọn
          </h2>
        </div>

        <div className="flex items-center gap-1">
          {activeKeywordCount > 0 && (
            <>
              <span className="badge-pro badge-amber tabular-nums">
                {activeKeywordCount} tên
              </span>
              <button
                type="button"
                onClick={handleNormalizeList}
                className="btn-ghost-pro text-[11px] px-2 py-1"
                title="Tách dấu phẩy, bỏ đuôi file (.jpg/.arw) và xóa dòng trùng lặp"
              >
                <Sparkles className="w-3 h-3 text-[var(--accent)] shrink-0" strokeWidth={1.75} />
                <span>Chuẩn hóa</span>
              </button>
              <button
                type="button"
                onClick={handleClearKeywords}
                className="p-1.5 rounded-[6px] text-[var(--text-dim)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] transition-colors cursor-pointer"
                title="Xóa toàn bộ danh sách tên ảnh"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Keywords Textarea + Match Mode */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="keywords-include-input"
            className="block text-xs font-medium text-[var(--text-muted)]"
          >
            Kiểu đối chiếu
          </label>

          <div className="inline-flex items-center bg-[var(--bg-card-inset)] p-0.5 rounded-[6px] border border-[var(--border-hairline)] shrink-0">
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
                  className={`px-2.5 py-0.5 text-[11px] font-medium rounded-[4px] transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[var(--bg-card)] text-[var(--text-main)] font-semibold border border-[var(--border-subtle)] shadow-2xs'
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
          rows={4}
          value={config.keywords_include.join('\n')}
          onChange={(e) => handleIncludeChange(e.target.value)}
          placeholder={placeholderText}
          spellCheck={false}
          className="input-pro font-mono text-xs resize-y min-h-[92px] max-h-[240px] leading-relaxed p-2.5"
        />

        {/* Unmatched Keywords Alert */}
        {unmatchedKeywords.length > 0 && (
          <div className="rounded-[6px] bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowUnmatchedList((v) => !v)}
                className="flex items-center gap-1.5 font-medium text-[var(--status-warning)] cursor-pointer text-left"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                <span className="tabular-nums">
                  {unmatchedKeywords.length} tên chưa tìm thấy
                </span>
                {showUnmatchedList ? (
                  <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.75} />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyUnmatched}
                className="text-[11px] font-medium px-2 py-0.5 rounded-[5px] bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-focus)] flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                title="Sao chép danh sách tên không tìm thấy"
              >
                {copiedMissing ? (
                  <Check className="w-3 h-3 text-[var(--status-success)]" strokeWidth={2} />
                ) : (
                  <Copy className="w-3 h-3 text-[var(--text-muted)]" strokeWidth={1.75} />
                )}
                <span>{copiedMissing ? 'Đã chép' : 'Sao chép'}</span>
              </button>
            </div>

            {showUnmatchedList && (
              <div className="max-h-24 overflow-y-auto font-mono text-[11px] text-[var(--text-main)] bg-[var(--bg-card)] rounded-[5px] p-2 border border-[var(--border-subtle)] flex flex-wrap gap-1.5 select-text">
                {unmatchedKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-1.5 py-0.5 rounded-[4px] bg-[var(--bg-card-inset)] border border-[var(--border-subtle)] text-[11px]"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsible Exclude Keywords */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowExcludeInput((v) => !v)}
            className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1 cursor-pointer transition-colors"
          >
            {showExcludeInput ? (
              <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.75} />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
            <span>
              Loại trừ từ khóa
              {config.keywords_exclude.filter((k) => k.trim()).length > 0 &&
                ` (${config.keywords_exclude.filter((k) => k.trim()).length})`}
            </span>
          </button>

          {showExcludeInput && (
            <div className="mt-2">
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

      {/* Dynamic Extension Selection */}
      <div className="space-y-2.5 pt-3 border-t border-[var(--border-hairline)]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--text-muted)]">
            Định dạng ảnh
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[var(--text-dim)]">
              {!config.extensions || config.extensions.length === 0
                ? 'Tất cả định dạng'
                : `Đang lọc ${config.extensions.length}`}
            </span>
            {config.extensions && config.extensions.length > 0 && (
              <button
                type="button"
                onClick={() => onChange({ extensions: [] })}
                className="text-[11px] font-medium text-[var(--accent-strong)] hover:underline cursor-pointer"
              >
                Đặt lại
              </button>
            )}
          </div>
        </div>

        {detectedExtensions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {detectedExtensions.map((item) => {
              const extClean = normalizeExtension(item.ext);
              const selected = isExtSelected(extClean);

              return (
                <button
                  key={extClean}
                  type="button"
                  onClick={() => toggleExtension(extClean)}
                  className={`px-2.5 py-1.5 rounded-[6px] text-xs font-mono transition-colors duration-150 flex items-center gap-1.5 border cursor-pointer active:scale-[0.97] ${
                    selected
                      ? 'bg-[var(--accent-bg-alpha)] text-[var(--accent-strong)] border-[var(--accent-border-alpha)] font-semibold'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-focus)]'
                  }`}
                >
                  {selected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={1.9} />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-[var(--text-dim)]" strokeWidth={1.75} />
                  )}
                  <span>.{extClean.toUpperCase()}</span>
                  <span className="text-[11px] text-[var(--text-dim)] tabular-nums">
                    {item.count.toLocaleString('vi-VN')}
                  </span>
                  {item.isRaw && (
                    <span className="text-[9px] px-1 py-px bg-[var(--accent-bg-alpha)] text-[var(--accent-strong)] rounded-[3px] font-semibold">
                      RAW
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-2.5 px-3 bg-[var(--bg-card-inset)] border border-[var(--border-hairline)] rounded-[6px] text-xs text-[var(--text-dim)] flex items-center gap-2">
            <FolderSearch className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>Chọn thư mục nguồn để tự động nhận diện định dạng.</span>
          </div>
        )}
      </div>
    </section>
  );
};
