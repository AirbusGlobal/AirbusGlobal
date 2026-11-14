import { StayCategory } from '../types';

export interface TierShortsRule {
  shorts_per_listing: number;
  shorts_audio_enabled: boolean;
  listing_audio_enabled: boolean;
}

export const SHORTS_TIER_CONFIG: Record<StayCategory | 'none', TierShortsRule> = {
  Silver: {
    shorts_per_listing: 0,
    shorts_audio_enabled: false,
    listing_audio_enabled: false,
  },
  Diamond: {
    shorts_per_listing: 1,
    shorts_audio_enabled: true,
    listing_audio_enabled: false,
  },
  Gold: {
    shorts_per_listing: 5,
    shorts_audio_enabled: true,
    listing_audio_enabled: true,
  },
  none: {
    shorts_per_listing: 0,
    shorts_audio_enabled: false,
    listing_audio_enabled: false,
  },
};

export const AUDIO_UPLOAD_CONFIG = {
  allowedExtensions: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm'],
  allowedMimeTypes: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/webm',
  ],
  maxFileSizeBytes: 15 * 1024 * 1024, // 15 MB
  maxShortDurationSec: 60,
  maxListingDurationSec: 180,
} as const;

export function getShortsTierRules(
  tier?: StayCategory | null,
  isActive: boolean = false,
  overrides?: Partial<Record<StayCategory, Partial<TierShortsRule>>>
): TierShortsRule {
  if (!isActive || !tier || !(tier in SHORTS_TIER_CONFIG)) {
    return { ...SHORTS_TIER_CONFIG.none };
  }
  const base = SHORTS_TIER_CONFIG[tier] || SHORTS_TIER_CONFIG.none;
  const override = overrides?.[tier];
  if (!override) return { ...base };
  return {
    shorts_per_listing:
      typeof override.shorts_per_listing === 'number'
        ? override.shorts_per_listing
        : base.shorts_per_listing,
    shorts_audio_enabled:
      typeof override.shorts_audio_enabled === 'boolean'
        ? override.shorts_audio_enabled
        : base.shorts_audio_enabled,
    listing_audio_enabled:
      typeof override.listing_audio_enabled === 'boolean'
        ? override.listing_audio_enabled
        : base.listing_audio_enabled,
  };
}
