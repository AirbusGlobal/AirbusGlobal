import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export interface ScrollToTopProps {
  threshold?: number;
  footerSelector?: string;
}

export const ScrollToTop: React.FC<ScrollToTopProps> = ({
  threshold = 600,
  footerSelector = '#app-footer',
}) => {
  const [visible, setVisible] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(24);

  useEffect(() => {
    const updatePosition = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      setVisible(y > threshold);

      const footer = document.querySelector(footerSelector);
      if (footer) {
        const rect = footer.getBoundingClientRect();
        const overlap = window.innerHeight - rect.top;
        if (overlap > 0) {
          setBottomOffset(Math.min(window.innerHeight - 80, overlap + 20));
          return;
        }
      }
      setBottomOffset(24);
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });
    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [threshold, footerSelector]);

  if (!visible) return null;

  const handleScrollTop = () => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  };

  return (
    <button
      type="button"
      onClick={handleScrollTop}
      aria-label="Scroll to top"
      title="Back to top"
      style={{ bottom: `${bottomOffset}px` }}
      className="fixed right-5 z-40 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-stone-900/90 hover:bg-stone-800 dark:bg-white/95 dark:hover:bg-white text-white dark:text-stone-950 border border-white/15 dark:border-stone-300 shadow-xl backdrop-blur-md text-xs font-bold transition-all cursor-pointer active:scale-95"
    >
      <ArrowUp className="w-4 h-4" />
      <span className="hidden sm:inline">Top</span>
    </button>
  );
};
