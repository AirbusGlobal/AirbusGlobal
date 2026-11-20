import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';

export interface InfiniteFeedProps {
  children: React.ReactNode;
  hasMore: boolean;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  onLoadMore: () => void | Promise<void>;
  maxAutoPages?: number;
  loadMoreLabel?: string;
  footerHref?: string;
  showJumpToFooter?: boolean;
  jumpToFooterClassName?: string;
  className?: string;
  skeleton?: React.ReactNode;
}

export const InfiniteFeed: React.FC<InfiniteFeedProps> = ({
  children,
  hasMore,
  isLoading = false,
  isLoadingMore = false,
  onLoadMore,
  maxAutoPages = 5,
  loadMoreLabel = 'Load more',
  footerHref = '#app-footer',
  showJumpToFooter = true,
  jumpToFooterClassName = '',
  className = 'space-y-8',
  skeleton,
}) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [autoPagesLoaded, setAutoPagesLoaded] = useState(0);
  const inFlightRef = useRef(false);

  const canAutoLoad = hasMore && autoPagesLoaded < maxAutoPages;

  useEffect(() => {
    if (!isLoadingMore) {
      inFlightRef.current = false;
    }
  }, [isLoadingMore]);

  useEffect(() => {
    if (!canAutoLoad || isLoading || isLoadingMore) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry && entry.isIntersecting && !inFlightRef.current) {
          inFlightRef.current = true;
          setAutoPagesLoaded(prev => prev + 1);
          Promise.resolve(onLoadMore()).finally(() => {
            inFlightRef.current = false;
          });
        }
      },
      { rootMargin: '320px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [canAutoLoad, isLoading, isLoadingMore, onLoadMore]);

  const handleManualLoadMore = () => {
    if (isLoadingMore || !hasMore) return;
    inFlightRef.current = true;
    Promise.resolve(onLoadMore()).finally(() => {
      inFlightRef.current = false;
    });
  };

  return (
    <div className="w-full">
      {showJumpToFooter && (
        <div className="flex justify-end mb-3">
          <a
            href={footerHref}
            className={
              jumpToFooterClassName ||
              'inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white underline-offset-4 hover:underline transition'
            }
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Jump to footer</span>
          </a>
        </div>
      )}

      <div className={className}>{children}</div>

      {isLoadingMore && (
        <div className="mt-6">
          {skeleton || (
            <div className="space-y-4">
              {[0, 1].map(i => (
                <div
                  key={i}
                  className="h-44 rounded-3xl bg-stone-200/70 dark:bg-neutral-900/70 border border-stone-200 dark:border-neutral-800 animate-pulse"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="pt-8 pb-4 flex flex-col items-center justify-center gap-2">
          {autoPagesLoaded >= maxAutoPages || !isLoadingMore ? (
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={handleManualLoadMore}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-stone-900 text-white hover:bg-stone-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 border border-stone-700/60 dark:border-neutral-700 shadow-md transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isLoadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isLoadingMore ? 'Loading...' : loadMoreLabel}</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 text-xs text-stone-500 dark:text-neutral-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading more...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
