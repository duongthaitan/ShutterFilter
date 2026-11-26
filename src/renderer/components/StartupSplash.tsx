import React, { useEffect, useState, useCallback } from 'react';
import { Camera } from 'lucide-react';

interface StartupSplashProps {
  onComplete: () => void;
}

const STATUS_STEPS = [
  'Khởi tạo bộ lọc ảnh RAW...',
  'Nạp cấu hình Studio...',
  'Sẵn sàng làm việc',
];

export const StartupSplash: React.FC<StartupSplashProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'focusing' | 'locked' | 'exiting'>('focusing');
  const [statusIdx, setStatusIdx] = useState(0);

  const finishSplash = useCallback(() => {
    setPhase('exiting');
  }, []);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      const quickTimer = window.setTimeout(() => {
        onComplete();
      }, 220);
      return () => window.clearTimeout(quickTimer);
    }

    const t1 = window.setTimeout(() => setStatusIdx(1), 420);
    const t2 = window.setTimeout(() => {
      setStatusIdx(2);
      setPhase('locked');
    }, 880);
    const t3 = window.setTimeout(() => {
      setPhase('exiting');
    }, 1150);
    const t4 = window.setTimeout(() => {
      onComplete();
    }, 1520);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [onComplete]);

  useEffect(() => {
    if (phase !== 'exiting') return;
    const t = window.setTimeout(() => {
      onComplete();
    }, 360);
    return () => window.clearTimeout(t);
  }, [phase, onComplete]);

  useEffect(() => {
    const handleSkipKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        finishSplash();
      }
    };
    window.addEventListener('keydown', handleSkipKey);
    return () => window.removeEventListener('keydown', handleSkipKey);
  }, [finishSplash]);

  const isLocked = phase === 'locked' || phase === 'exiting';
  const isExiting = phase === 'exiting';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Đang khởi động ShutterFilter"
      onClick={finishSplash}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg-main)] select-none cursor-pointer overflow-hidden splash-backdrop ${
        isExiting ? 'splash-exit' : ''
      }`}
    >
      {/* Subtle Studio Radial Ambient Glow */}
      <div
        className="pointer-events-none absolute w-[420px] h-[420px] rounded-full opacity-90"
        style={{
          background:
            'radial-gradient(circle, var(--accent-bg-alpha) 0%, transparent 66%)',
        }}
      />

      {/* Camera Viewfinder Frame */}
      <div
        className={`relative w-[330px] sm:w-[370px] px-8 py-9 flex flex-col items-center text-center splash-frame ${
          isLocked ? 'splash-frame-locked' : ''
        }`}
      >
        {/* 4 Precision Viewfinder Corner Brackets */}
        <span
          className={`absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 rounded-tl-[2px] transition-colors duration-200 ${
            isLocked ? 'border-[var(--status-success)]' : 'border-[var(--accent)]'
          }`}
        />
        <span
          className={`absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 rounded-tr-[2px] transition-colors duration-200 ${
            isLocked ? 'border-[var(--status-success)]' : 'border-[var(--accent)]'
          }`}
        />
        <span
          className={`absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 rounded-bl-[2px] transition-colors duration-200 ${
            isLocked ? 'border-[var(--status-success)]' : 'border-[var(--accent)]'
          }`}
        />
        <span
          className={`absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 rounded-br-[2px] transition-colors duration-200 ${
            isLocked ? 'border-[var(--status-success)]' : 'border-[var(--accent)]'
          }`}
        />

        {/* Viewfinder Top HUD Strip */}
        <div className="w-full flex items-center justify-between text-[10px] font-mono tracking-wider text-[var(--text-dim)] mb-5">
          <span>RAW ENGINE</span>
          <span
            className={`font-semibold transition-colors duration-200 ${
              isLocked ? 'text-[var(--status-success)]' : 'text-[var(--accent-strong)]'
            }`}
          >
            {isLocked ? 'AF-LOCK' : 'FOCUSING'}
          </span>
        </div>

        {/* Animated Camera Aperture & Lens Core */}
        <div className="relative w-24 h-24 flex items-center justify-center mb-5">
          {/* Outer Rotating Precision Dial */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full splash-dial-spin"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="var(--border-focus)"
              strokeWidth="1"
              strokeDasharray="3 5"
            />
            <circle
              cx="50"
              cy="50"
              r="39"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeDasharray="48 198"
              strokeLinecap="round"
            />
          </svg>

          {/* Geometric 6-Blade Shutter Ring */}
          <svg
            viewBox="0 0 100 100"
            className={`absolute inset-0 w-full h-full splash-shutter-blades ${
              isLocked ? 'splash-blades-open' : ''
            }`}
            aria-hidden="true"
          >
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <path
                key={deg}
                d="M50 16 L66 36 L50 32 Z"
                fill="var(--accent)"
                fillOpacity="0.22"
                stroke="var(--accent)"
                strokeOpacity="0.55"
                strokeWidth="0.9"
                transform={`rotate(${deg} 50 50)`}
              />
            ))}
          </svg>

          {/* Center Lens Core with Shimmer Sweep */}
          <div className="relative w-12 h-12 rounded-[10px] bg-[var(--accent)] text-[var(--accent-text)] flex items-center justify-center shadow-lg overflow-hidden splash-core-pop">
            <Camera className="w-6 h-6 stroke-[2.2]" />
            <div className="splash-glint pointer-events-none absolute inset-y-0 -left-full w-full" />
          </div>
        </div>

        {/* Brand Wordmark */}
        <div className="space-y-1 splash-text-rise">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)]">
            ShutterFilter
          </h1>
          <p className="text-xs font-mono text-[var(--accent-strong)] tracking-wider">
            by Tandev.foto
          </p>
        </div>

        {/* GPU-Accelerated Progress Rail (scaleX only) */}
        <div className="w-full mt-6 space-y-2">
          <div className="w-full h-1 rounded-full bg-[var(--bg-card-inset)] border border-[var(--border-subtle)] overflow-hidden">
            <div
              className={`h-full w-full rounded-full origin-left splash-progress-fill ${
                isLocked ? 'bg-[var(--status-success)]' : 'bg-[var(--accent)]'
              }`}
            />
          </div>
          <div className="flex items-center justify-center text-[11px] font-mono text-[var(--text-muted)]">
            <span>{STATUS_STEPS[statusIdx]}</span>
          </div>
        </div>
      </div>

      {/* Subtle Skip Hint */}
      <div className="absolute bottom-5 text-[11px] font-mono text-[var(--text-dim)] opacity-75">
        Nhấn bất kỳ để vào nhanh
      </div>
    </div>
  );
};
