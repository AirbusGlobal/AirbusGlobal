import React, { useState, useEffect, useRef } from 'react';
import { AdRequest } from '../types';
import { api } from '../api';
import { ExternalLink, X, Pause, Play, Megaphone, Home } from 'lucide-react';

interface AdvertisementManagerProps {
  onSelectStay?: (stayId: string) => void;
}

export const AdvertisementManager: React.FC<AdvertisementManagerProps> = ({ onSelectStay }) => {
  const [ads, setAds] = useState<AdRequest[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load active approved ads
  useEffect(() => {
    let isMounted = true;
    const fetchApprovedAds = async () => {
      try {
        const res = await api.getAds({ status: 'approved' });
        if (isMounted && res.ads && res.ads.length > 0) {
          const approved = res.ads.filter(a => a.status === 'approved');
          if (approved.length > 0) {
            setAds(approved);
          }
        }
      } catch (err) {
        console.warn('Could not load approved ads, fallback active:', err);
      }
    };

    fetchApprovedAds();
    return () => {
      isMounted = false;
    };
  }, []);

  const currentAd = ads[currentIndex];

  // Track and record 'view' event whenever an ad is displayed to the user
  useEffect(() => {
    if (!currentAd || isDismissed) return;

    // Record view in backend database for administrators visibility analytics
    api.recordAdView(currentAd.id).catch(err => {
      console.warn('Could not record ad view event:', err);
    });
  }, [currentAd?.id, isDismissed]);

  // 3-second rotation timer with smooth fade-out and fade-in
  useEffect(() => {
    if (ads.length <= 1 || isPaused || isDismissed) return;

    timerRef.current = setTimeout(() => {
      setIsFading(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % ads.length);
        setIsFading(false);
      }, 300); // 300ms fade transition
    }, 3000); // Display for 3 seconds each

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [ads.length, currentIndex, isPaused, isDismissed]);

  if (ads.length === 0 || isDismissed || !currentAd) {
    return null;
  }

  // Redirect to stay detail view & record interaction
  const handlePropertyInteraction = (e?: React.MouseEvent) => {
    if (e) {
      // Don't intercept if clicking close, pause or external link
      const target = e.target as HTMLElement;
      if (target.closest('button[data-action="control"]') || target.closest('a[data-action="external"]')) {
        return;
      }
    }

    // Record click event in database
    api.recordAdClick(currentAd.id).catch(err => {
      console.warn('Could not record ad click event:', err);
    });

    // Navigate to stay detail view
    if (onSelectStay && currentAd.stayId) {
      onSelectStay(currentAd.stayId);
    } else if (currentAd.stayId) {
      window.location.hash = `stay-${currentAd.stayId}`;
    }
  };

  const handleExternalClick = () => {
    // Record click event in database
    api.recordAdClick(currentAd.id).catch(() => {});
  };

  return (
    <div
      className="fixed bottom-5 right-5 z-40 w-[calc(100vw-36px)] sm:w-80 select-none animate-in fade-in slide-in-from-bottom-4 duration-300"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="complementary"
      aria-label="Sponsored Advertisement"
    >
      <div
        onClick={handlePropertyInteraction}
        className="relative bg-stone-900/95 dark:bg-black/95 backdrop-blur-xl rounded-2xl p-3 border border-stone-800 hover:border-purple-500/60 shadow-[0_12px_40px_rgba(0,0,0,0.55)] text-white overflow-hidden transition-all duration-300 cursor-pointer group"
      >
        {/* Glow accent bar at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ff2e93] via-[#8b5cf6] to-[#e4002b]" />

        {/* Header row: Sponsored badge, rotating counter, pause & close */}
        <div className="flex items-center justify-between gap-2 mb-2 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="bg-gradient-to-r from-[#ff2e93] to-[#e4002b] text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-white flex items-center gap-1 shadow-sm">
              <Megaphone className="w-2.5 h-2.5" />
              <span>Ad · KES 100/day</span>
            </span>
            <span className="text-[10px] text-stone-400 font-mono">
              {currentIndex + 1}/{ads.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              data-action="control"
              onClick={e => {
                e.stopPropagation();
                setIsPaused(!isPaused);
              }}
              className="p-1 text-stone-400 hover:text-white rounded-md hover:bg-stone-800 transition-colors cursor-pointer"
              title={isPaused ? 'Resume auto-rotation' : 'Pause rotation'}
            >
              {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3" />}
            </button>
            <button
              data-action="control"
              onClick={e => {
                e.stopPropagation();
                setIsDismissed(true);
              }}
              className="p-1 text-stone-400 hover:text-white rounded-md hover:bg-stone-800 transition-colors cursor-pointer"
              title="Close advert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content with 300ms fade transition */}
        <div
          className={`flex gap-3 items-center transition-opacity duration-300 ${
            isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          {/* Ad thumbnail */}
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-stone-800 border border-stone-700 relative group-hover:scale-105 transition-transform">
            <img
              src={currentAd.imageUrl}
              alt={currentAd.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {currentAd.tag && (
              <span className="absolute bottom-0 left-0 right-0 bg-black/80 text-[8px] font-bold text-center py-0.2 truncate px-1 text-amber-300">
                {currentAd.tag}
              </span>
            )}
          </div>

          {/* Ad details */}
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white line-clamp-1 leading-tight group-hover:text-amber-300 transition-colors">
              {currentAd.title}
            </h4>
            <p className="text-[11px] text-stone-300 line-clamp-2 mt-0.5 leading-snug">
              {currentAd.description}
            </p>

            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 group-hover:underline">
                <Home className="w-2.5 h-2.5" />
                <span>View Stay #{currentAd.stayId}</span>
              </span>

              {currentAd.targetUrl && (
                <a
                  data-action="external"
                  href={currentAd.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => {
                    e.stopPropagation();
                    handleExternalClick();
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#ff2e93] hover:text-[#ff5caa] transition-colors"
                  title="Open advertiser link"
                >
                  <span>Sponsor</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Progress indicator bar for 3 seconds */}
        {!isPaused && (
          <div className="mt-2.5 w-full bg-stone-800 h-0.5 rounded-full overflow-hidden">
            <div
              key={currentIndex}
              className="h-full bg-gradient-to-r from-[#ff2e93] to-[#e4002b]"
              style={{
                width: '100%',
                animation: 'advertProgress 3s linear infinite',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
