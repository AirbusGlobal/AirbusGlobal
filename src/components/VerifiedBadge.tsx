import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Check } from 'lucide-react';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isAbsolute?: boolean; // defaults to true (absolute upper-right corner with 8-12px inset)
}

const STEPS = [
  {
    text: 'Welcome',
    color: '#FF1744', // Neon Red
    glowColor: 'rgba(255, 23, 68, 0.85)',
    shadowRgba: 'rgba(255, 23, 68, 0.45)',
    borderColor: 'rgba(255, 23, 68, 0.9)',
  },
  {
    text: 'AirBus',
    color: '#00B0FF', // Neon Blue
    glowColor: 'rgba(0, 176, 255, 0.85)',
    shadowRgba: 'rgba(0, 176, 255, 0.45)',
    borderColor: 'rgba(0, 176, 255, 0.9)',
  },
  {
    text: 'Verified',
    color: '#D500F9', // Neon Purple
    glowColor: 'rgba(213, 0, 249, 0.85)',
    shadowRgba: 'rgba(213, 0, 249, 0.45)',
    borderColor: 'rgba(213, 0, 249, 0.9)',
  },
];

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  size = 'md',
  className = '',
  isAbsolute = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // IntersectionObserver to pause animation for off-screen cards
  useEffect(() => {
    if (!containerRef.current || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 3-step state machine with ~3.2s per full 360-degree rotation.
  // The text swaps at the 180° / 270° edge-on point (1.6s into the 3.2s cycle)
  // so the switch is completely seamless and invisible to viewers.
  useEffect(() => {
    if (prefersReducedMotion || !isVisible) return;

    const ROTATION_DURATION = 3200; // 3.2s per full 360° rotation
    const interval = setInterval(() => {
      // Step to next text: Welcome -> AirBus -> Verified -> Welcome
      setStepIndex((prev) => (prev + 1) % STEPS.length);
    }, ROTATION_DURATION);

    return () => clearInterval(interval);
  }, [isVisible, prefersReducedMotion]);

  const current = STEPS[stepIndex];

  // Responsive dimension classes
  // Desktop: 44-56px (w-12 h-12 / w-14 h-14)
  // Mobile: 36-44px (w-9 h-9 / w-10 h-10)
  const sizeClasses = {
    sm: 'w-8 h-8 md:w-9 md:h-9 text-[8px]',
    md: 'w-10 h-10 md:w-12 md:h-12 text-[9px] md:text-[10px]',
    lg: 'w-12 h-12 md:w-14 md:h-14 text-[10px] md:text-[11px]',
  }[size];

  return (
    <div
      ref={containerRef}
      className={`${
        isAbsolute ? 'absolute top-2.5 right-2.5 z-20' : 'relative'
      } pointer-events-none select-none ${className}`}
      aria-label="AirBus Verified listing"
      role="status"
    >
      {/* Screen-reader only permanent text */}
      <span className="sr-only">AirBus Verified listing</span>

      {/* Reduced-Motion Static Display */}
      {prefersReducedMotion ? (
        <div
          className={`${sizeClasses} rounded-full bg-black/75 backdrop-blur-md flex flex-col items-center justify-center border text-center font-black uppercase tracking-wider shadow-lg`}
          style={{
            borderColor: '#D500F9',
            boxShadow: '0 0 12px rgba(213, 0, 249, 0.6), inset 0 0 6px rgba(213, 0, 249, 0.4)',
            color: '#D500F9',
          }}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#D500F9] mb-0.5" />
          <span className="leading-none text-[8px] font-extrabold tracking-tighter">Verified</span>
        </div>
      ) : (
        /* Smooth 3D Spinning Coin Animated Badge */
        <div
          className="relative perspective-[600px]"
          style={{ willChange: 'transform' }}
        >
          <div
            className={`${sizeClasses} rounded-full bg-black/70 backdrop-blur-md flex flex-col items-center justify-center text-center font-black uppercase tracking-wider border transition-colors duration-700 shadow-2xl relative overflow-hidden`}
            style={{
              borderColor: current.borderColor,
              boxShadow: `0 0 10px ${current.glowColor}, 0 0 20px ${current.shadowRgba}, inset 0 0 8px ${current.shadowRgba}`,
              animation: isVisible
                ? 'airbusCoinSpin 3.2s ease-in-out infinite, airbusPulseGlow 2s ease-in-out infinite alternate'
                : 'none',
              transformStyle: 'preserve-3d',
              backfaceVisibility: 'hidden',
              willChange: 'transform',
            }}
          >
            {/* Subtle Neon Radial Accent Highlight */}
            <div
              className="absolute inset-0 rounded-full opacity-20 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 50% 30%, ${current.color}, transparent 70%)`,
              }}
            />

            {/* Glowing Icon & Text */}
            <div
              className="flex flex-col items-center justify-center z-10 scale-95 transition-all duration-300"
              style={{
                color: current.color,
                textShadow: `0 0 6px ${current.glowColor}, 0 0 14px ${current.shadowRgba}`,
              }}
            >
              <div className="flex items-center justify-center">
                <ShieldCheck
                  className="w-3.5 h-3.5 md:w-4 md:h-4 transition-colors duration-500"
                  style={{
                    filter: `drop-shadow(0 0 4px ${current.glowColor})`,
                  }}
                />
              </div>

              <span
                className="font-extrabold tracking-tight leading-none mt-0.5 text-[8.5px] md:text-[9.5px] whitespace-nowrap"
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {current.text}
              </span>
            </div>

            {/* Glowing Thin Outer Ring */}
            <div
              className="absolute inset-[1px] rounded-full border border-white/25 pointer-events-none opacity-80"
              style={{
                boxShadow: `0 0 4px ${current.glowColor}`,
              }}
            />
          </div>
        </div>
      )}

      {/* Embedded 3D Keyframes for Smooth Coin Rotation */}
      <style>{`
        @keyframes airbusCoinSpin {
          0% {
            transform: rotateY(0deg) scale(1);
          }
          25% {
            transform: rotateY(90deg) scale(0.96);
          }
          50% {
            transform: rotateY(180deg) scale(1);
          }
          75% {
            transform: rotateY(270deg) scale(0.96);
          }
          100% {
            transform: rotateY(360deg) scale(1);
          }
        }
        @keyframes airbusPulseGlow {
          0% {
            filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.4));
          }
          100% {
            filter: drop-shadow(0 0 7px rgba(255, 255, 255, 0.8));
          }
        }
      `}</style>
    </div>
  );
};
