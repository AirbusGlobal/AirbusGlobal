import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Video,
  Images,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Film,
} from 'lucide-react';
import { ListingMedia } from '../types';

export interface ListingMediaViewerProps {
  media?: ListingMedia;
  videoUrl?: string;
  thumbnailUrl?: string;
  images?: string[];
  title?: string;
  className?: string;
  aspectRatio?: 'video' | 'square' | 'wide' | 'auto';
  autoPlay?: boolean;
  initialMode?: 'video' | 'photos';
  showBadge?: boolean;
  badgeText?: string;
  onMediaModeChange?: (mode: 'video' | 'photos') => void;
  // Optional moderation or owner action
  onRemoveMedia?: (type: 'video' | 'photo', url: string) => void;
  canManageMedia?: boolean;
}

export const ListingMediaViewer: React.FC<ListingMediaViewerProps> = ({
  media,
  videoUrl,
  thumbnailUrl,
  images = [],
  title = 'Listing Media',
  className = '',
  aspectRatio = 'video',
  autoPlay = false,
  initialMode = 'video',
  showBadge = true,
  badgeText,
  onMediaModeChange,
  onRemoveMedia,
  canManageMedia = false,
}) => {
  // 1. Normalize media sources (supports both new media schema and legacy videoUrl/images)
  const effectiveVideoUrl = media?.video?.url || videoUrl || '';
  const effectiveVideoPoster = media?.video?.thumbnail || thumbnailUrl || (images && images[0]) || '';

  const photosList: string[] = React.useMemo(() => {
    if (media?.photos && media.photos.length > 0) {
      return media.photos.slice().sort((a, b) => a.order - b.order).map(p => p.url);
    }
    if (images && images.length > 0) {
      return images;
    }
    if (thumbnailUrl) {
      return [thumbnailUrl];
    }
    return [];
  }, [media?.photos, images, thumbnailUrl]);

  const hasVideo = Boolean(effectiveVideoUrl.trim());
  const hasPhotos = photosList.length > 0;

  // Determine initial active mode based on available media
  const defaultMode: 'video' | 'photos' = hasVideo ? 'video' : 'photos';
  const [activeMode, setActiveMode] = useState<'video' | 'photos'>(
    hasVideo && hasPhotos ? initialMode : defaultMode
  );

  // Keep active mode in sync if media changes
  useEffect(() => {
    if (!hasVideo && hasPhotos) {
      setActiveMode('photos');
    } else if (hasVideo && !hasPhotos) {
      setActiveMode('video');
    }
  }, [hasVideo, hasPhotos]);

  // Container ref for fullscreen and intersection observing
  const containerRef = useRef<HTMLDivElement>(null);

  // Video playback states
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [videoLoading, setVideoLoading] = useState<boolean>(true);
  const [videoError, setVideoError] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Auto-pause video when scrolled out of view or when switching browser tabs (Requirement 1.2)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !hasVideo) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting && videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.25 }
    );
    observer.observe(el);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [hasVideo]);

  // Photo gallery states
  const [photoIndex, setPhotoIndex] = useState<number>(0);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [photoLoading, setPhotoLoading] = useState<boolean>(false);
  const [failedPhotos, setFailedPhotos] = useState<Record<number, boolean>>({});

  // Pause video whenever switching to photos
  const handleSwitchMode = (newMode: 'video' | 'photos') => {
    if (newMode === activeMode) return;
    if (newMode === 'photos' && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    setActiveMode(newMode);
    onMediaModeChange?.(newMode);
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pos * duration;
    setCurrentTime(pos * duration);
  };

  const handleToggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Gallery navigation
  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPhotoIndex(prev => (prev > 0 ? prev - 1 : photosList.length - 1));
  };

  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPhotoIndex(prev => (prev < photosList.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation for photo gallery and lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeMode === 'photos' || lightboxOpen) {
        if (e.key === 'ArrowLeft') {
          handlePrevPhoto();
        } else if (e.key === 'ArrowRight') {
          handleNextPhoto();
        } else if (e.key === 'Escape' && lightboxOpen) {
          setLightboxOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMode, lightboxOpen, photosList.length]);

  // Aspect ratio class mapper
  const ratioClasses = {
    video: 'aspect-video',
    square: 'aspect-square',
    wide: 'aspect-[21/9]',
    auto: 'h-[360px] sm:h-[480px] lg:h-[540px]',
  }[aspectRatio];

  // If no media is provided at all, show empty fallback
  if (!hasVideo && !hasPhotos) {
    return (
      <div className={`relative w-full ${ratioClasses} bg-stone-900 border border-stone-800 rounded-3xl flex flex-col items-center justify-center p-6 text-center text-stone-400 ${className}`}>
        <Film className="w-12 h-12 text-stone-600 mb-2 stroke-[1.5]" />
        <p className="text-sm font-semibold text-stone-300">No media uploaded yet</p>
        <p className="text-xs text-stone-500 max-w-xs mt-1">
          This listing has not uploaded a video tour or photos yet.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-3xl overflow-hidden bg-black select-none shadow-2xl ${className}`}
    >
      {/* Top Overlay: Media Mode Toggle (Visible ONLY when BOTH Video and Photos exist) */}
      {hasVideo && hasPhotos && (
        <div className="absolute top-4 left-4 z-30 flex items-center bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/15 shadow-xl">
          <button
            type="button"
            onClick={() => handleSwitchMode('video')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer ${
              activeMode === 'video'
                ? 'bg-gradient-to-r from-[#e4002b] to-[#ff2e93] text-white shadow-lg shadow-[#ff2e93]/30 scale-100'
                : 'text-stone-300 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Switch to Video Tour"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video Tour</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('photos')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer ${
              activeMode === 'photos'
                ? 'bg-gradient-to-r from-[#e4002b] to-[#ff2e93] text-white shadow-lg shadow-[#ff2e93]/30 scale-100'
                : 'text-stone-300 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Switch to Watch Photos"
          >
            <Images className="w-3.5 h-3.5" />
            <span>Watch Photos ({photosList.length})</span>
          </button>
        </div>
      )}

      {/* Top Right Badges & Controls */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        {showBadge && (
          <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-bold text-white border border-white/10 shadow-sm">
            <Sparkles className="w-3 h-3 text-[#ff2e93]" />
            {badgeText || (activeMode === 'video' ? 'Full Video Tour' : `Gallery (${photoIndex + 1}/${photosList.length})`)}
          </span>
        )}

        {/* Fullscreen Lightbox trigger for photos */}
        {activeMode === 'photos' && photosList.length > 0 && (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="p-2.5 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/90 text-white border border-white/15 transition-transform active:scale-95 cursor-pointer shadow-lg"
            title="Expand Fullscreen Lightbox"
            aria-label="Expand Fullscreen Lightbox"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}

        {/* Video mute/unmute button */}
        {activeMode === 'video' && hasVideo && !videoError && (
          <button
            type="button"
            onClick={handleToggleMute}
            className="p-2.5 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/90 text-white border border-white/15 transition-transform active:scale-95 cursor-pointer shadow-lg"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#22d3ee]" />}
          </button>
        )}
      </div>

      {/* Main View Area */}
      <div className={`relative w-full ${ratioClasses} bg-stone-950 flex items-center justify-center overflow-hidden`}>
        {/* ======================= VIDEO VIEW ======================= */}
        {activeMode === 'video' && hasVideo ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black group">
            {videoLoading && !videoError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-stone-300">
                <div className="w-10 h-10 border-4 border-[#ff2e93] border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs font-semibold tracking-wider uppercase text-stone-400">Loading Video Tour...</span>
              </div>
            )}

            {videoError ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-stone-400 max-w-md">
                <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
                <p className="text-sm font-bold text-white mb-1">Video Tour could not be loaded</p>
                <p className="text-xs text-stone-400 mb-4">
                  The video format or network connection could not stream this stay video.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoError(false);
                      setVideoLoading(true);
                      if (videoRef.current) {
                        videoRef.current.load();
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Video</span>
                  </button>
                  {hasPhotos && (
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('photos')}
                      className="px-4 py-2 rounded-xl bg-[#e4002b] hover:bg-[#ff2e93] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Images className="w-3.5 h-3.5" />
                      <span>View Photos Instead</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  src={effectiveVideoUrl}
                  poster={effectiveVideoPoster}
                  autoPlay={autoPlay}
                  muted={isMuted}
                  loop
                  playsInline
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setDuration(videoRef.current.duration || 0);
                    }
                  }}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setCurrentTime(videoRef.current.currentTime || 0);
                    }
                  }}
                  onLoadedData={() => {
                    setVideoLoading(false);
                    setVideoError(false);
                  }}
                  onError={() => {
                    setVideoLoading(false);
                    setVideoError(true);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={handleTogglePlay}
                />

                {/* Center Play/Pause Overlay indicator on hover or pause */}
                <div
                  onClick={handleTogglePlay}
                  className={`absolute inset-0 flex items-center justify-center cursor-pointer transition-opacity duration-200 ${
                    !isPlaying ? 'bg-black/35 opacity-100' : 'opacity-0 group-hover:opacity-100 bg-black/20'
                  }`}
                >
                  <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl transition-transform transform group-hover:scale-110 active:scale-95">
                    {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 translate-x-0.5 text-white" />}
                  </div>
                </div>

                {/* Bottom Video Progress Bar & Custom Controls Overlay */}
                <div className="absolute bottom-0 inset-x-0 z-20 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-2 transition-opacity duration-200 opacity-90 group-hover:opacity-100">
                  {/* Interactive Seek Bar */}
                  <div
                    onClick={handleSeek}
                    className="w-full h-1.5 hover:h-2.5 bg-white/20 rounded-full overflow-hidden cursor-pointer transition-all relative"
                    title="Seek video"
                  >
                    <div
                      className="h-full bg-gradient-to-r from-[#e4002b] to-[#ff2e93] rounded-full transition-all"
                      style={{
                        width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                      }}
                    />
                  </div>

                  {/* Controls Row */}
                  <div className="flex items-center justify-between text-xs text-stone-300">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTogglePlay}
                        className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleMute}
                        className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
                        title={isMuted ? 'Unmute' : 'Mute'}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4 text-stone-400" /> : <Volume2 className="w-4 h-4 text-[#22d3ee]" />}
                      </button>

                      <span className="font-mono text-[11px] text-stone-300">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasPhotos && (
                        <button
                          type="button"
                          onClick={() => handleSwitchMode('photos')}
                          className="bg-black/60 hover:bg-black/90 backdrop-blur-md px-3 py-1 rounded-full font-medium text-[11px] border border-white/10 text-white flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Photos ({photosList.length})</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleToggleFullscreen}
                        className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                      >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* ======================= PHOTO GALLERY VIEW ======================= */
          <div className="relative w-full h-full bg-stone-900 group">
            {photosList.length > 0 ? (
              <>
                <img
                  src={photosList[photoIndex]}
                  alt={`${title} - Photo ${photoIndex + 1}`}
                  loading="lazy"
                  onError={() => {
                    setFailedPhotos(prev => ({ ...prev, [photoIndex]: true }));
                  }}
                  className="w-full h-full object-cover transition-opacity duration-300"
                />

                {/* Left / Right Carousel Navigation (If multiple photos) */}
                {photosList.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevPhoto}
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/90 text-white border border-white/20 flex items-center justify-center shadow-xl opacity-90 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      aria-label="Previous Photo"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextPhoto}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/90 text-white border border-white/20 flex items-center justify-center shadow-xl opacity-90 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      aria-label="Next Photo"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}

                {/* Bottom Gallery Thumbnail Dots / Counter */}
                <div className="absolute bottom-3 inset-x-0 z-20 flex items-center justify-center gap-1.5 px-4 pointer-events-none">
                  <div className="bg-black/70 backdrop-blur-md px-3.5 py-1 rounded-full text-white font-mono text-[11px] border border-white/10 shadow-lg pointer-events-auto flex items-center gap-2">
                    <span>
                      {photoIndex + 1} / {photosList.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="text-stone-400 hover:text-white cursor-pointer ml-1 pl-1.5 border-l border-white/20 flex items-center gap-1"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Grid View</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-stone-500">
                <Images className="w-10 h-10 mb-2 stroke-[1.5]" />
                <p className="text-xs">No photos available</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================= FULLSCREEN LIGHTBOX MODAL ======================= */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200">
          {/* Lightbox Header */}
          <div className="w-full flex items-center justify-between z-10 pb-4 border-b border-stone-800">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-base font-heading">{title}</span>
              <span className="text-stone-400 text-xs font-mono">
                ({photoIndex + 1} of {photosList.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-white transition-colors cursor-pointer"
              aria-label="Close Lightbox"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Lightbox Main Image & Navigation */}
          <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden my-4">
            {photosList.length > 1 && (
              <button
                type="button"
                onClick={handlePrevPhoto}
                className="absolute left-2 sm:left-4 z-20 p-3 rounded-full bg-stone-900/80 hover:bg-stone-800 text-white border border-stone-700 transition-colors cursor-pointer"
                aria-label="Previous"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={photosList[photoIndex]}
              alt={`${title} - Lightbox ${photoIndex + 1}`}
              className="max-h-[75vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl transition-all"
            />

            {photosList.length > 1 && (
              <button
                type="button"
                onClick={handleNextPhoto}
                className="absolute right-2 sm:right-4 z-20 p-3 rounded-full bg-stone-900/80 hover:bg-stone-800 text-white border border-stone-700 transition-colors cursor-pointer"
                aria-label="Next"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Lightbox Thumbnail Strip */}
          <div className="w-full max-w-4xl flex items-center gap-2 overflow-x-auto py-2 px-1 scrollbar-thin">
            {photosList.map((photo, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPhotoIndex(idx)}
                className={`relative shrink-0 w-16 h-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  photoIndex === idx
                    ? 'border-[#ff2e93] scale-105 shadow-md shadow-[#ff2e93]/30'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={photo} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
