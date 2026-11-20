import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface SharedVideoPlayerProps {
  src?: string | null;
  poster?: string;
  className?: string;
  videoClassName?: string;
  style?: React.CSSProperties;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  trimStart?: number;
  trimEnd?: number;
  externalRef?: React.RefObject<HTMLVideoElement | null>;
  compact?: boolean;
  ariaLabel?: string;
  onClick?: (e: React.MouseEvent<HTMLVideoElement>) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onLoadedMetadata?: (duration: number, width: number, height: number) => void;
  onLoadedData?: () => void;
  onError?: () => void;
}

export const SharedVideoPlayer: React.FC<SharedVideoPlayerProps> = ({
  src,
  poster,
  className = '',
  videoClassName = 'w-full h-full object-cover',
  style,
  controls = true,
  autoPlay = false,
  muted = false,
  loop = false,
  playsInline = true,
  preload = 'metadata',
  trimStart,
  trimEnd,
  externalRef,
  compact = false,
  ariaLabel = 'Video player',
  onClick,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  onLoadedMetadata,
  onLoadedData,
  onError,
}) => {
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = externalRef || internalRef;

  const [isLoading, setIsLoading] = useState<boolean>(Boolean(src));
  const [hasError, setHasError] = useState<boolean>(false);
  const [retrySeed, setRetrySeed] = useState<number>(0);

  const effectiveSrc = React.useMemo(() => {
    if (!src) return '';
    if (retrySeed === 0 || src.startsWith('blob:') || src.startsWith('data:')) return src;
    const sep = src.includes('?') ? '&' : '?';
    return `${src}${sep}_retry=${retrySeed}`;
  }, [src, retrySeed]);

  useEffect(() => {
    setHasError(false);
    setIsLoading(Boolean(src) && !compact);
  }, [src, compact]);

  // Never keep spinner stuck indefinitely if browser defers preload='metadata'
  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setTimeout(() => {
      setIsLoading(false);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [isLoading, effectiveSrc]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasError(false);
    setIsLoading(true);
    setRetrySeed(s => s + 1);
    window.setTimeout(() => {
      try {
        videoRef.current?.load();
      } catch {}
    }, 30);
  };

  if (!src) {
    return null;
  }

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      {!compact && isLoading && !hasError && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/45 text-stone-200">
          <div className="w-7 h-7 border-2 border-white/80 border-t-transparent rounded-full animate-spin mb-1.5" />
          <span className="text-[10px] font-semibold tracking-wide uppercase text-stone-200">
            Loading video...
          </span>
        </div>
      )}

      {hasError && !compact ? (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center bg-neutral-950/95 text-stone-300"
          onClick={e => e.stopPropagation()}
        >
          <AlertCircle className="w-7 h-7 text-amber-400 mb-2" />
          <p className="text-xs font-bold text-white mb-1">Video playback unavailable</p>
          <p className="text-[11px] text-stone-400 mb-3 max-w-xs">
            Could not stream this video right now. Check your connection and retry.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Video</span>
          </button>
        </div>
      ) : (
        <video
          ref={videoRef}
          key={effectiveSrc}
          src={effectiveSrc}
          poster={poster}
          controls={controls}
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          playsInline={playsInline}
          preload={preload}
          aria-label={ariaLabel}
          style={style}
          className={videoClassName}
          onClick={onClick}
          onLoadedMetadata={() => {
            setIsLoading(false);
            setHasError(false);
            const el = videoRef.current;
            if (el) {
              if (typeof trimStart === 'number' && trimStart > 0 && el.currentTime < trimStart) {
                try {
                  el.currentTime = trimStart;
                } catch {}
              }
              onLoadedMetadata?.(el.duration || 0, el.videoWidth || 0, el.videoHeight || 0);
            }
          }}
          onLoadedData={() => {
            setIsLoading(false);
            setHasError(false);
            onLoadedData?.();
          }}
          onCanPlay={() => {
            setIsLoading(false);
            setHasError(false);
          }}
          onPlay={() => {
            setIsLoading(false);
            onPlay?.();
          }}
          onPause={onPause}
          onEnded={onEnded}
          onTimeUpdate={() => {
            const el = videoRef.current;
            if (!el) return;
            const cur = el.currentTime || 0;
            const dur = el.duration || 0;
            if (
              typeof trimEnd === 'number' &&
              trimEnd > (trimStart || 0) &&
              cur >= trimEnd
            ) {
              try {
                el.currentTime = trimStart || 0;
              } catch {}
            }
            onTimeUpdate?.(cur, dur);
          }}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
            onError?.();
          }}
        />
      )}
    </div>
  );
};
