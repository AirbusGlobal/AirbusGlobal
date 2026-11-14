/**
 * Centralized Shorts / Reels Layout Configuration
 * Single source of truth for UI zones, spacing, touch targets, safe areas, and stacking order.
 * Stacking order strictly follows:
 *   video < captions < info/actionRail < overlays/sheets < modals/toasts
 */

export const SHORTS_Z_INDEX = {
  video: 10,
  verifiedBadge: 15,
  captions: 20,
  infoAndActionRail: 30,
  topBar: 35,
  progressBar: 36,
  sheetBackdrop: 40,
  bottomSheet: 45,
  modal: 55,
  toast: 60,
} as const;

export const SHORTS_TOUCH_TARGET = {
  minPx: 44,
  actionButtonClass: 'min-w-[44px] min-h-[44px] w-11 h-11',
} as const;

export const SHORTS_ZONES = {
  // 9:16 dynamic viewport container with safe areas (uses 100dvh, never 100vh)
  stageContainerClass:
    'relative w-full h-[100dvh] md:h-[calc(100dvh-76px)] md:max-h-[880px] flex items-center justify-center bg-black md:bg-transparent overflow-hidden select-none',
  // Centered 9:16 column on desktop; full-bleed 100dvh on mobile portrait without clipping
  phoneFrameClass:
    'relative w-full h-full md:aspect-[9/16] md:w-auto md:max-w-[430px] md:h-full bg-black md:rounded-3xl overflow-hidden shadow-2xl md:border md:border-stone-800 flex flex-col justify-between',

  // Zone 1: Top bar (Back, Tabs/Title, Create Camera Button)
  topBarStyle: {
    paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
    paddingLeft: 'max(0.875rem, env(safe-area-inset-left))',
    paddingRight: 'max(4.25rem, calc(env(safe-area-inset-right) + 3.75rem))', // Keeps clear of upper-right VerifiedBadge
    zIndex: SHORTS_Z_INDEX.topBar,
  },

  // Zone 2: Right vertical action rail (positioned comfortably above bottom action bar & home indicator)
  actionRailBottomOffset: 'calc(max(1.25rem, env(safe-area-inset-bottom)) + 4.75rem)',
  actionRailRightOffset: 'max(0.625rem, env(safe-area-inset-right))',

  // Zone 3: Bottom-left info block (never overlaps right action rail or bottom listing action bar)
  infoBlockPaddingBottom: 'calc(max(0.75rem, env(safe-area-inset-bottom)) + 4.85rem)',
  infoBlockPaddingRight: '5.25rem', // >= 20% clearance on 360px+ screens for right action rail

  // Zone 3B: Dedicated 5 Listing Action Buttons row (Availability, Book now, Chat host, Negotiate, Book direct on WhatsApp)
  listingActionsBottomOffset: 'calc(max(0.5rem, env(safe-area-inset-bottom)) + 0.45rem)',

  // Zone 4: Captions (subtitles) - middle-lower safe area, never behind rail, info block, or action bar
  captionsBottomOffset: 'clamp(12.25rem, 29dvh, 16rem)',
  captionsRightPadding: '22%', // Reserves >=20% horizontal clearance on right for action rail

  // Zone 5: Bottom progress bar above home indicator
  progressBarBottomOffset: 'max(0.15rem, env(safe-area-inset-bottom))',

  // Bottom sheets: cover at most 70% of viewport height so video stays visible above
  bottomSheetMaxHeight: '70dvh',
} as const;

export const SHORTS_MEDIA_LIMITS = {
  minVideoSeconds: 15,
  maxVideoSeconds: 60,
  photoSlideSeconds: 3.5,
  targetWidth: 1080,
  targetHeight: 1920,
} as const;
