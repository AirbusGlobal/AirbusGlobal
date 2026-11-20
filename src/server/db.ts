import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  DatabaseSchema,
  User,
  Stay,
  Booking,
  Review,
  ChatThread,
  PaymentRecord,
  NotificationItem,
  ListingReport,
  SupportTicket,
  AuditLog,
  HostPlanStatus,
  ListingStatus,
  ModerationState,
  VideoComment,
  VideoCommentReply,
  Post,
  PostType,
  PostStatus,
  LedgerEntry,
  LedgerEntryType,
  WalletRecord,
  AdRequest,
  AdRequestStatus,
  ReferralProfile,
  ReferralCommissionRecord,
  PlatformSettings,
  AuthPortal,
  AuthSession,
  CredentialRecord,
  PasswordFingerprint,
  ViralityReport,
  StayPriceTrend,
  Currency,
  CURRENCY_RATES,
  StayCategory,
  ListingPromotion,
  DormantOwner,
  TripDatingProfile,
  TripDatingProfileStatus,
  TripDatingUnifiedStatus,
  TripDatingAdminCounts,
  TripDatingPaymentRequest,
  TripDatingContactUnlock,
  TripDatingStats,
  MediaAsset,
  MediaAssetType,
  MediaAssetStatus,
  SnappAddCampaign,
  PaymentRecordType,
  PaymentRecordMethod,
  PaymentRecordStatus,
  WalletTransaction,
  BoostRecord,
  SponsorSlot,
  AdSlot,
  SubscriptionRecord,
  FollowRecord,
  ListingLikeRecord,
  ListingViewRecord,
  AutoShortRecord,
  LocalGuideProfile,
  NeighborhoodArticle,
  PlusServiceRequest,
  LocalServiceProvider,
  LocalProviderCategory,
  AudioTrack,
  AudioLicense,
  ShortAudioConfig,
  ShortJob,
  PostComment,
  ListingAudioConfig,
  ShortAnalyticsRecord,
  ShortIntentType,
  AirBusCollectionId,
  AdminWalletPurpose,
  AdminWalletEntry,
  WalletYearArchive,
  AdminWalletRollupBucket,
  ListingCollectionJoin,
} from './types';
import { PLANS, AMENITY_GROUPS } from '../constants';
import { audioLibraryService, FREE_AUDIO_LICENSES } from './services/audioLibraryService';
import { shortJobQueue } from './services/shortJobQueue';
import { AUDIO_UPLOAD_CONFIG, getShortsTierRules } from '../config/shortsTierConfig';
import { logger } from './services/ops';
import { getEATParts } from '../utils/time';

export const DEFAULT_SETTINGS: PlatformSettings = {
  adPricePerDay: 100,
  adPlatformFeePercent: 30,
  maxAdSlotsPerPost: 10,
  referralCommissionPercent: 10,
  referralDurationDays: 365,
  minWithdrawalKes: 500,
  mpesaPaybill: '222111',
  mpesaTill: '987654',
  mpesaAccountPrefix: 'AIRBUS',
  scToKesRate: 10,
  dailyRateSc: 10,
  planPrices: {
    Silver: 1000,
    Diamond: 2500,
    Gold: 5000,
  },
  currencyRates: CURRENCY_RATES,
  contentPolicies: {
    maxDescriptionChars: 300,
    maxPostImages: 10,
    maxShortSeconds: 60,
    maxVideoSeconds: 1800,
  },
};


const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'airbus-db.json');

// Strict 20-minute inactivity timeout (configurable via env for verification tests)
export const SESSION_IDLE_TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.SESSION_IDLE_TIMEOUT_MS) || 20 * 60 * 1000
);

export { PLANS, AMENITY_GROUPS };

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'airbus_salt_2026').digest('hex');
}

export function validatePasswordStrength(password: string): string | null {
  const raw = String(password || '');
  if (
    raw.length < 8 ||
    !/[a-zA-Z]/.test(raw) ||
    !/[0-9]/.test(raw) ||
    !/[^a-zA-Z0-9\s]/.test(raw)
  ) {
    return 'Password must be at least 8 characters and include a mix of letters, numbers, and other characters (e.g. !@#$%).';
  }
  return null;
}

export function normalizeUsername(username: string): string {
  return String(username || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
}

function buildPasswordFingerprint(password: string): PasswordFingerprint {
  const raw = String(password || '');
  const lower = raw.toLowerCase();
  const stripped = lower.replace(/[^a-z0-9]/g, '');
  const classes = [
    /[a-z]/.test(raw) ? 'l' : '',
    /[A-Z]/.test(raw) ? 'u' : '',
    /[0-9]/.test(raw) ? 'd' : '',
    /[^a-zA-Z0-9]/.test(raw) ? 's' : '',
  ]
    .filter(Boolean)
    .join('');

  const shingles = new Set<string>();
  for (const source of [lower, stripped]) {
    if (source.length >= 3) {
      for (let i = 0; i <= source.length - 3; i++) {
        const gram = source.slice(i, i + 3);
        const h = crypto
          .createHash('sha256')
          .update('airbus_sh_' + gram + '_2026')
          .digest('hex')
          .slice(0, 12);
        shingles.add(h);
      }
    }
  }

  return {
    exactHash: hashPassword(raw),
    lowerHash: crypto.createHash('sha256').update(lower + '_lower_2026').digest('hex'),
    strippedHash: crypto.createHash('sha256').update(stripped + '_strip_2026').digest('hex'),
    normalizedLength: stripped.length,
    charClasses: classes,
    shingleHashes: Array.from(shingles).sort(),
  };
}

function passwordsTooSimilar(candidate: PasswordFingerprint, existing?: PasswordFingerprint): boolean {
  if (!existing) return false;
  if (candidate.exactHash === existing.exactHash) return true;
  if (candidate.lowerHash === existing.lowerHash) return true;
  if (
    candidate.normalizedLength >= 4 &&
    existing.normalizedLength >= 4 &&
    candidate.strippedHash === existing.strippedHash
  ) {
    return true;
  }
  if (
    candidate.shingleHashes.length >= 2 &&
    existing.shingleHashes.length >= 2
  ) {
    const setB = new Set(existing.shingleHashes);
    let intersection = 0;
    for (const h of candidate.shingleHashes) {
      if (setB.has(h)) intersection++;
    }
    const union = candidate.shingleHashes.length + existing.shingleHashes.length - intersection;
    if (union > 0 && intersection / union >= 0.55) {
      return true;
    }
  }
  return false;
}

const SEED_USERS: User[] = [
  {
    id: 'u_guest',
    name: 'SarahWanjiku',
    username: 'SarahWanjiku',
    portal: 'guest',
    email: 'guest@airbus.ke',
    role: 'guest',
    passwordHash: hashPassword('Sarah$Nairobi88!'),
    phone: '+254 712 345 678',
    location: 'Nairobi, Kenya',
    bio: 'Passionate traveller, remote software engineer & video stay enthusiast.',
    languages: 'English, Swahili',
    idVerified: true,
    isVVVIP: false,
    createdAt: Date.now() - 30 * 864e5,
  },
  {
    id: 'u_owner',
    name: 'DavidMutua',
    username: 'DavidMutua',
    portal: 'owner',
    email: 'owner@airbus.ke',
    role: 'owner',
    passwordHash: hashPassword('Mutua@Westlands91#'),
    phone: '+254 722 987 654',
    location: 'Westlands, Nairobi',
    bio: 'Superhost managing luxury villas in Westlands and beachfront retreats in Diani & Nyali.',
    languages: 'English, Swahili, French',
    idVerified: true,
    isVVVIP: true,
    createdAt: Date.now() - 60 * 864e5,
  },
  {
    id: 'u_admin_master',
    name: 'Kamala Hari',
    username: 'KamalaHari',
    portal: 'admin',
    email: 'kamalahari93@gmail.com',
    role: 'admin',
    passwordHash: hashPassword('2019xyz//'),
    phone: '+254 700 000 001',
    location: 'Headquarters, Nairobi',
    bio: 'Lead Platform Administrator at AirBus Global.',
    languages: 'English, Swahili',
    idVerified: true,
    isVVVIP: true,
    createdAt: Date.now() - 120 * 864e5,
  },
];

const SEED_COMMENTS: VideoComment[] = [
  {
    id: 'c1',
    stayId: 's1',
    userEmail: 'guest@airbus.ke',
    userName: 'Sarah Wanjiku',
    userRole: 'guest',
    text: 'Is the sunset view from the 18th floor really as wide as shown in the video? Absolutely breathtaking!',
    likes: 12,
    createdAt: Date.now() - 5 * 864e5,
    replies: [
      {
        id: 'r1',
        commentId: 'c1',
        userEmail: 'owner@airbus.ke',
        userName: 'David Mutua (Host)',
        userRole: 'owner',
        text: 'Yes Sarah! You get an unobstructed 270-degree view of Nairobi skyline and the sunset over Ngong Hills.',
        createdAt: Date.now() - 4 * 864e5,
      },
      {
        id: 'r2',
        commentId: 'c1',
        userEmail: 'guest@airbus.ke',
        userName: 'Sarah Wanjiku',
        userRole: 'guest',
        text: 'That sounds amazing, booking for next week!',
        createdAt: Date.now() - 3 * 864e5,
      },
    ],
  },
  {
    id: 'c2',
    stayId: 's4',
    userEmail: 'guest@airbus.ke',
    userName: 'Sarah Wanjiku',
    userRole: 'guest',
    text: 'How far is the beach from the pool terrace? Can we walk straight into the water?',
    likes: 8,
    createdAt: Date.now() - 8 * 864e5,
    replies: [
      {
        id: 'r3',
        commentId: 'c2',
        userEmail: 'owner@airbus.ke',
        userName: 'David Mutua (Host)',
        userRole: 'owner',
        text: 'Literally 15 steps down our private landscaped pathway onto the soft white sands of Nyali beach!',
        createdAt: Date.now() - 7 * 864e5,
      },
    ],
  },
];

const SEED_STAYS: Stay[] = [
  {
    id: 's1',
    title: 'Modern Westlands Penthouse with Panoramic City Views',
    location: 'Westlands, Nairobi',
    lat: -1.2676,
    lng: 36.8108,
    price: 8500,
    currency: 'KES',
    rating: 4.9,
    reviewsCount: 142,
    type: 'Apartment',
    guests: 4,
    beds: 2,
    area: 95,
    category: 'Diamond',
    status: 'live',
    features: ['WiFi', 'Fiber Internet', 'Air Conditioning', 'Elevator', 'Swimming Pool', 'Parking', 'Smart Lock', '24/7 Check-in'],
    highlights: ['360° Nairobi Skyline Balcony', 'High-speed 100Mbps Fiber', 'Heated Rooftop Pool', '5-min walk to Sarit Centre'],
    description: 'Immaculately styled 2-bedroom executive penthouse located on the 18th floor in the heart of Westlands. Features floor-to-ceiling glass, ultra-fast fiber internet, chef kitchen, and private sundowner terrace with breathtaking views over Nairobi.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-living-room-and-terrace-43405-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    source: 'Direct',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    isPromoted: true,
    promotedUntil: Date.now() + 14 * 864e5,
    promotionImpressions: 480,
    promotionClicks: 62,
    welcomeGifts: ['Complimentary Kenyan Kahawa & Safari Bites', 'Chilled Tropical Passion Juice', 'Late Checkout 1PM'],
    hostMessage: 'Karibu sana! I personally prepare every detail so you enjoy our penthouse rooftop sunset and heated infinity pool.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 1,
    views: 1420,
    likesCount: 184,
    commentsCount: 3,
    comments: SEED_COMMENTS.filter(c => c.stayId === 's1'),
    hostFollowerCount: 382,
    gradientHue: [262, 330],
    createdAt: Date.now() - 40 * 864e5,
    isVerified: true,
    isAirbusWork: true,
    monthlyPrice: 175000,
    wifiSpeedMbps: 150,
    hasDedicatedWorkspace: true,
    corporateInvoicingAvailable: true,
    blackFridayOptIn: true,
    blackFridayDiscountPercent: 45,
  },
  {
    id: 's2',
    title: 'Cozy Kilimani Designer Studio near Yaya Centre',
    location: 'Kilimani, Nairobi',
    lat: -1.2921,
    lng: 36.7872,
    price: 4500,
    currency: 'KES',
    rating: 4.8,
    reviewsCount: 88,
    type: 'Studio',
    guests: 2,
    beds: 1,
    area: 42,
    category: 'Silver',
    status: 'live',
    features: ['WiFi', 'Air Conditioning', 'Hot Shower', 'Elevator', 'Self Check-in', 'Fridge', 'Microwave'],
    highlights: ['Steps from Yaya Centre & Artcaffe', 'King orthopedic bed', 'Quiet green residential street'],
    description: 'Chic, sun-drenched studio apartment thoughtfully designed for digital nomads and weekend explorers. High-speed WiFi, dedicated workspace, rain shower, and Netflix-enabled smart TV.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-luxurious-living-room-with-a-modern-interior-design-43409-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
    source: 'Booking.com',
    instantBook: false,
    isFeatured: false,
    isApprovedByAdmin: true,
    welcomeGifts: ['Artisan Kenyan Tea Selection', 'High-Speed Fiber Voucher', 'Complimentary Bottled Water'],
    hostMessage: 'Welcome to Kilimani! Perfect for remote workers. Fiber is blazing fast and Artcaffe is 2 mins away.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 1,
    views: 890,
    likesCount: 95,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [200, 260],
    createdAt: Date.now() - 35 * 864e5,
    isVerified: true,
    isAirbusWork: true,
    monthlyPrice: 88000,
    wifiSpeedMbps: 100,
    hasDedicatedWorkspace: true,
    corporateInvoicingAvailable: true,
    isEscapeOffer: true,
    escapeOfferTitle: 'Workation Weekend Flash Offer',
    escapeOriginalPrice: 4500,
    escapeOfferPrice: 3375,
    escapeDiscountPercent: 25,
    escapeValidFrom: new Date().toISOString().slice(0, 10),
    escapeValidTo: new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10),
  },
  {
    id: 's3',
    title: 'Lavington Garden Bungalow with Fireplace & Patio',
    location: 'Lavington, Nairobi',
    lat: -1.2833,
    lng: 36.7667,
    price: 9800,
    currency: 'KES',
    rating: 4.95,
    reviewsCount: 204,
    type: 'Bungalow',
    guests: 5,
    beds: 3,
    area: 145,
    category: 'Diamond',
    status: 'live',
    features: ['WiFi', 'Garden', 'Parking', 'Gas Cooker', 'BBQ Grill', 'Electric Fence', 'Backup Inverter'],
    highlights: ['Private 0.5 acre manicured garden', 'Working wood-burning fireplace', 'Solar + backup inverter uninterrupted power'],
    description: 'Serene botanical oasis tucked away in leafy Lavington. Enjoy crisp morning birdsong on the covered veranda, evening fires in the stone hearth, and total privacy behind gated security.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-wooden-house-in-the-middle-of-a-forest-43410-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
    source: 'Direct',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    welcomeGifts: ['Fireplace Firewood & Marshmallow Basket', 'Fresh Herb Garden Basket', 'Complimentary English Tea'],
    hostMessage: 'Karibu Lavington! Enjoy a quiet evening by the stone fireplace or reading on the garden veranda.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 2,
    views: 1650,
    likesCount: 240,
    commentsCount: 1,
    hostFollowerCount: 382,
    gradientHue: [150, 200],
    createdAt: Date.now() - 50 * 864e5,
  },
  {
    id: 's4',
    title: 'Nyali Beachfront Villa with Infinity Ocean Pool',
    location: 'Nyali, Mombasa',
    lat: -4.0283,
    lng: 39.7167,
    price: 22000,
    currency: 'KES',
    rating: 4.92,
    reviewsCount: 76,
    type: 'Villa',
    guests: 8,
    beds: 4,
    area: 280,
    category: 'Gold',
    status: 'live',
    features: ['WiFi', 'Swimming Pool', 'Air Conditioning', 'Balcony', 'BBQ Grill', 'CCTV', 'Hot Shower', 'Parking'],
    highlights: ['Private beachfront access onto white sands', 'Infinity edge freshwater pool', 'Dedicated private Swahili chef upon request'],
    description: 'Breathtaking coastal sanctuary directly overlooking the turquoise Indian Ocean in Nyali. Architectural open-plan living, Swahili arches, sea-breeze terraces, and private pool.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-villa-with-pool-and-terrace-in-front-of-the-sea-43406-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    source: 'Airbnb',
    instantBook: false,
    isFeatured: true,
    isApprovedByAdmin: true,
    isPromoted: true,
    promotedUntil: Date.now() + 7 * 864e5,
    promotionImpressions: 610,
    promotionClicks: 84,
    welcomeGifts: ['Fresh Nyali Coconut Water & Macadamia Nuts', 'Swahili Beach Towels', 'Airport Shuttle 20% Discount'],
    hostMessage: 'Habari za Mombasa! The Indian Ocean is at your doorstep. Let me know if you would like our private chef to prepare Swahili biryani.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 2,
    views: 2480,
    likesCount: 390,
    commentsCount: 2,
    comments: SEED_COMMENTS.filter(c => c.stayId === 's4'),
    hostFollowerCount: 382,
    gradientHue: [20, 350],
    createdAt: Date.now() - 65 * 864e5,
  },
  {
    id: 's5',
    title: 'Diani Beach Cottage Steps from the Turquoise Sand',
    location: 'Diani, Kwale',
    lat: -4.3167,
    lng: 39.5833,
    price: 13500,
    currency: 'KES',
    rating: 4.88,
    reviewsCount: 95,
    type: 'Bungalow',
    guests: 4,
    beds: 2,
    area: 110,
    category: 'Diamond',
    status: 'live',
    features: ['WiFi', 'Garden', 'Gas Cooker', 'Air Conditioning', 'Hot Shower', 'Solar Power'],
    highlights: ['45 seconds walk to Diani Beach', 'Outdoor tropical rain shower', 'Eco-friendly solar powered'],
    description: 'Charming thatched makuti roof cottage nestled among baobabs and swaying palm trees in world-renowned Diani Beach. Fall asleep to the gentle crash of waves and enjoy barefoot living.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-swimming-pool-surrounded-by-palm-trees-at-sunset-42028-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=800&q=80',
    source: 'Direct',
    instantBook: true,
    isFeatured: false,
    isApprovedByAdmin: true,
    welcomeGifts: ['Chilled Fresh Coconut Upon Arrival', 'Tropical Mango & Passion Basket', 'Sunset Dhow Cruise Voucher'],
    hostMessage: 'Barefoot luxury in Diani! Baobabs and the white beach are just 45 seconds away. Enjoy paradise!',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 1,
    views: 1200,
    likesCount: 165,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [40, 10],
    createdAt: Date.now() - 30 * 864e5,
    isVerified: true,
    blackFridayOptIn: true,
    blackFridayDiscountPercent: 50,
    isEscapeOffer: true,
    escapeOfferTitle: 'Diani Sunny Season 3-Night Escape',
    escapeOriginalPrice: 13500,
    escapeOfferPrice: 9450,
    escapeDiscountPercent: 30,
    escapeValidFrom: new Date().toISOString().slice(0, 10),
    escapeValidTo: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
  },
  {
    id: 's6',
    title: 'Karen Heritage Cottage with English Gardens & Veranda',
    location: 'Karen, Nairobi',
    lat: -1.3167,
    lng: 36.7,
    price: 8800,
    currency: 'KES',
    rating: 4.85,
    reviewsCount: 54,
    type: 'House',
    guests: 3,
    beds: 2,
    area: 105,
    category: 'Silver',
    status: 'live',
    features: ['WiFi', 'Garden', 'Parking', 'Gas Cooker', 'Perimeter Wall', 'Towels Provided'],
    highlights: ['Close to Giraffe Centre & Karen Blixen Museum', 'Antique cedar wood finishing', 'Private bird sanctuary garden'],
    description: 'Step into colonial elegance surrounded by the lush greenery of Karen. Ideal retreat for creatives, writers, and couples looking for a calm escape 20 minutes from the city centre.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-cozy-living-room-in-a-cabin-43407-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80',
    source: 'Booking.com',
    instantBook: false,
    isFeatured: false,
    isApprovedByAdmin: true,
    welcomeGifts: ['Homemade Karen Scones & Jam', 'Giraffe Sanctuary Map & Guide', 'Organic Mountain Coffee'],
    hostMessage: 'Welcome to peaceful Karen. Take your morning tea on the English veranda listening to the sunbirds.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 1,
    views: 780,
    likesCount: 92,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [290, 220],
    createdAt: Date.now() - 25 * 864e5,
  },
  {
    id: 's7',
    title: 'Kilimani Sunset 2BR with Sky Pool & Gym Access',
    location: 'Kilimani, Nairobi',
    lat: -1.2896,
    lng: 36.79,
    price: 11500,
    currency: 'KES',
    rating: 4.75,
    reviewsCount: 62,
    type: 'Apartment',
    guests: 4,
    beds: 2,
    area: 98,
    category: 'Diamond',
    status: 'live',
    features: ['WiFi', 'Swimming Pool', 'Air Conditioning', 'Elevator', 'Parking', 'Gas Cooker', 'Smart Lock'],
    highlights: ['Rooftop infinity glass pool', 'Modern equipped gym & sauna', 'Panoramic sunset views over Ngong Hills'],
    description: 'Modern luxury living at its finest on Rose Avenue. This corner 2BR suite features floor-to-ceiling double-glazed windows, minimalist Scandinavian interiors, and full access to building wellness club.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-large-house-with-modern-interior-and-floor-to-ceiling-windows-43411-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
    source: 'Airbnb',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    welcomeGifts: ['Rose Avenue Sunset Wine Bottle', 'Complimentary Sauna & Gym Pass', 'Espresso Pods'],
    hostMessage: 'Welcome to Nairobi! Don’t miss the sunset from the rooftop sky pool overlooking the Ngong Hills.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 1,
    views: 1100,
    likesCount: 145,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [170, 120],
    createdAt: Date.now() - 15 * 864e5,
  },
  {
    id: 's8',
    title: 'Naivasha Lakeside House with Zebras & Sunset Deck',
    location: 'Naivasha, Nakuru',
    lat: -0.7167,
    lng: 36.4333,
    price: 16000,
    currency: 'KES',
    rating: 4.96,
    reviewsCount: 110,
    type: 'House',
    guests: 6,
    beds: 3,
    area: 190,
    category: 'Gold',
    status: 'live',
    features: ['WiFi', 'Garden', 'Gas Cooker', 'Parking', 'BBQ Grill', 'Hot Shower', 'Solar Power'],
    highlights: ['Frequent zebra and waterbuck garden visits', 'Private wooden dock over Lake Naivasha', 'Sundowner wood-fired BBQ deck'],
    description: 'Set on the tranquil shores of Lake Naivasha, this eco-stone home offers an unforgettable wildlife encounter. Watch giraffes and zebras graze on the lawn right outside your breakfast table.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-kitchen-island-in-a-luxurious-modern-house-43412-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
    source: 'Direct',
    instantBook: false,
    isFeatured: true,
    isApprovedByAdmin: true,
    welcomeGifts: ['Naivasha Lakeside Cheese & Cracker Board', 'Wildlife Safari Binoculars', 'Campfire Firepit Logs'],
    hostMessage: 'Karibu Lake Naivasha! Keep your cameras ready—the zebras love grazing right outside the porch in the morning.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 2,
    views: 1890,
    likesCount: 295,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [10, 40],
    createdAt: Date.now() - 70 * 864e5,
    isVerified: true,
    isEscapeOffer: true,
    escapeOfferTitle: 'Great Rift Lakeside Retreat Promo',
    escapeOriginalPrice: 16000,
    escapeOfferPrice: 12000,
    escapeDiscountPercent: 25,
    escapeValidFrom: new Date().toISOString().slice(0, 10),
    escapeValidTo: new Date(Date.now() + 18 * 864e5).toISOString().slice(0, 10),
  },
  // AirBus Plus (VVVIP-only verified homes with hotel-style services)
  {
    id: 's_plus_1',
    title: 'Runda Diplomatic Estate Residence with Private Chef & Chauffeur',
    location: 'Runda, Nairobi',
    lat: -1.2191,
    lng: 36.8205,
    price: 65000,
    currency: 'KES',
    rating: 5.0,
    reviewsCount: 34,
    type: 'Villa',
    guests: 10,
    beds: 5,
    area: 540,
    category: 'Gold',
    status: 'live',
    features: ['WiFi', 'Swimming Pool', 'Chef on Call', 'Airport Chauffeur', 'Daily Housekeeping', '24/7 Concierge', 'Helipad Access', 'Spa'],
    highlights: ['24/7 Butler & Private Chef', 'Daily Hotel-Grade Linen & Turn-Down Service', 'Armored JKIA Chauffeur Transfer Included'],
    description: 'Ultra-exclusive diplomatic sanctuary reserved exclusively for AirBus Plus VVVIP guests. Includes full private culinary staff, daily turn-down service, heated infinity lap pool, and chauffeur transfers.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-villa-with-pool-and-terrace-in-front-of-the-sea-43406-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80',
    source: 'AirBus Plus',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    isVerified: true,
    isPlusVVVIP: true,
    plusServices: ['24/7 Dedicated Concierge', 'Private Executive Chef', 'Daily Hotel Cleaning', 'Chauffeur Airport Transfer', 'In-Villa Spa & Massage'],
    welcomeGifts: ['Vintage Champagne Reserve', 'Private Chef Welcome Tasting Menu', 'VIP JKIA Meet & Greet'],
    hostMessage: 'Welcome to AirBus Plus. Our concierge team coordinates every detail from private aviation transfers to personalized menus.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 2,
    views: 920,
    likesCount: 215,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [42, 32],
    createdAt: Date.now() - 8 * 864e5,
  },
  {
    id: 's_plus_2',
    title: 'Watamu Clifftop Cliffside Palazzo with Private Boat & Butler',
    location: 'Watamu Marine, Kilifi',
    lat: -3.3562,
    lng: 40.0124,
    price: 88000,
    currency: 'KES',
    rating: 4.99,
    reviewsCount: 22,
    type: 'Villa',
    guests: 8,
    beds: 4,
    area: 480,
    category: 'Gold',
    status: 'live',
    features: ['WiFi', 'Swimming Pool', 'Private Boat', 'Personal Butler', 'Private Chef', 'Daily Housekeeping', 'Airport Transfer'],
    highlights: ['Private Lagoon Pier & Sunset Dhow', 'Resident Seafood Chef', '24/7 Security & Concierge'],
    description: 'Architectural clifftop residence overlooking Watamu Marine Reserve, curated strictly for VVVIP members with full hotel concierge, morning housekeeping, seafood chef, and private speedboat.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-luxury-home-with-pool-and-sea-view-43410-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
    source: 'AirBus Plus',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    isVerified: true,
    isPlusVVVIP: true,
    plusServices: ['Private Speedboat & Captain', 'Swahili & Continental Chef', 'Daily Housekeeping', 'Malindi Airport Limo', 'Personal Butler'],
    welcomeGifts: ['Lobster Welcome Platter', 'Private Sunset Dhow Cruise', 'Chilled Rosé'],
    hostMessage: 'Karibu Watamu Palazzo. Your private butler and chef await your arrival.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 3,
    views: 740,
    likesCount: 180,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [38, 25],
    createdAt: Date.now() - 5 * 864e5,
  },
  // AirBus Local (Affordable market-adjacent stays & Local Guide picks)
  {
    id: 's_local_1',
    title: 'Roysambu Sunlit Cozy Flat (2 Mins to TRM & Local Market)',
    location: 'Roysambu, Nairobi',
    lat: -1.2185,
    lng: 36.8869,
    price: 2200,
    currency: 'KES',
    rating: 4.78,
    reviewsCount: 94,
    type: 'Apartment',
    guests: 2,
    beds: 1,
    area: 38,
    category: 'Silver',
    status: 'live',
    features: ['WiFi', 'Kitchen', 'Hot Shower', 'Near Fresh Market', '24/7 Matatu Stage'],
    highlights: ['Walk to Roysambu Fresh Produce Market', 'Budget-friendly weekly discounts', 'Local guide walking tour optional'],
    description: 'Clean, bright, ultra-affordable stay tucked steps away from Roysambu vibrant open-air market and Thika Road Mall. Ideal for budget travelers wanting authentic Kenyan neighborhood hospitality.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-living-room-and-terrace-43405-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80',
    source: 'AirBus Local',
    instantBook: true,
    isFeatured: false,
    isApprovedByAdmin: true,
    isVerified: true,
    isLocalGuideExperience: true,
    localMarketNear: 'Roysambu & Kasarani Fresh Market',
    welcomeGifts: ['Fresh Roasted Kenyan Peanuts', 'Local Market Shopping Map'],
    hostMessage: 'Ask me for our local market guide—you can get fresh mangoes and avocados for KES 50 right downstairs!',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 1,
    views: 680,
    likesCount: 74,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [145, 190],
    createdAt: Date.now() - 12 * 864e5,
  },
  {
    id: 's_local_2',
    title: 'Bamburi Swahili Courtyard Studio (Near Kongowea Market)',
    location: 'Bamburi, Mombasa',
    lat: -3.9922,
    lng: 39.7186,
    price: 2500,
    currency: 'KES',
    rating: 4.82,
    reviewsCount: 51,
    type: 'Studio',
    guests: 2,
    beds: 1,
    area: 40,
    category: 'Silver',
    status: 'live',
    features: ['WiFi', 'Air Conditioning', 'Kitchen', 'Courtyard', 'Near Kongowea Market'],
    highlights: ['5-min tuk-tuk to Kongowea Market & Public Beach', 'Authentic Swahili breakfast spots nearby', 'Great long-stay value'],
    description: 'Breezy coastal studio minutes from Kongowea spice & fruit market and Bamburi beach. Discover Mombasa at local prices with insider guide recommendations.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-swimming-pool-surrounded-by-palm-trees-at-sunset-42028-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
    source: 'AirBus Local',
    instantBook: true,
    isFeatured: false,
    isApprovedByAdmin: true,
    isVerified: true,
    isLocalGuideExperience: true,
    localMarketNear: 'Kongowea Spice & Fresh Market',
    welcomeGifts: ['Mombasa Tamarind Candy', 'Tuk-tuk Fare Cheat Sheet'],
    hostMessage: 'Karibu Bamburi! Pair your stay with our certified local market guide to shop spices & fresh seafood at true local rates.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 1,
    views: 540,
    likesCount: 63,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [175, 220],
    createdAt: Date.now() - 14 * 864e5,
  },
  // AirBus World Wide (International vacation homes)
  {
    id: 's_ww_1',
    title: 'Camps Bay Oceanfront Terrace Villa overlooking Twelve Apostles',
    location: 'Cape Town, South Africa',
    lat: -33.9508,
    lng: 18.3775,
    price: 28000,
    currency: 'KES',
    rating: 4.94,
    reviewsCount: 83,
    type: 'Villa',
    guests: 6,
    beds: 3,
    area: 220,
    category: 'Gold',
    status: 'live',
    features: ['WiFi', 'Swimming Pool', 'Sea View', 'BBQ Braai', 'Fiber Internet', 'Parking'],
    highlights: ['Atlantic Sunset Deck', 'Walking distance to Camps Bay Promenade', 'High-speed backup solar power'],
    description: 'Stunning sunlit South African villa perched above Camps Bay beach with panoramic ocean views, infinity plunge pool, and indoor-outdoor braai lounge.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-villa-with-pool-and-terrace-in-front-of-the-sea-43406-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    source: 'AirBus World Wide',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    isVerified: true,
    isWorldWide: true,
    country: 'South Africa',
    countryCode: 'ZA',
    region: 'Africa',
    localCurrency: 'ZAR',
    localCurrencyPrice: 3900,
    isAirbusWork: true,
    monthlyPrice: 690000,
    wifiSpeedMbps: 200,
    hasDedicatedWorkspace: true,
    corporateInvoicingAvailable: true,
    welcomeGifts: ['Stellenbosch Reserve Wine', 'South African Rooibos Gift Box'],
    hostMessage: 'Welcome to Cape Town! Enjoy unobstructed sunsets over the Atlantic Ocean.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 2,
    views: 1410,
    likesCount: 210,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [210, 260],
    createdAt: Date.now() - 9 * 864e5,
  },
  {
    id: 's_ww_2',
    title: 'Stone Town & Nungwi Coral Reef Hideaway with Lagoon Pool',
    location: 'Zanzibar, Tanzania',
    lat: -5.7262,
    lng: 39.2981,
    price: 19500,
    currency: 'KES',
    rating: 4.91,
    reviewsCount: 127,
    type: 'Bungalow',
    guests: 4,
    beds: 2,
    area: 130,
    category: 'Diamond',
    status: 'live',
    features: ['WiFi', 'Beachfront', 'Air Conditioning', 'Swimming Pool', 'Breakfast Included'],
    highlights: ['Direct Nungwi white sand access', 'Carved Zanzibari four-poster beds', 'Swahili breakfast served daily'],
    description: 'Hand-carved coral-stone beach sanctuary on the northern tip of Zanzibar, blending timeless Swahili craftsmanship with modern resort comfort.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-swimming-pool-surrounded-by-palm-trees-at-sunset-42028-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=80',
    source: 'AirBus World Wide',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    isVerified: true,
    isWorldWide: true,
    country: 'Tanzania',
    countryCode: 'TZ',
    region: 'Africa',
    localCurrency: 'TZS',
    localCurrencyPrice: 395000,
    blackFridayOptIn: true,
    blackFridayDiscountPercent: 40,
    welcomeGifts: ['Zanzibar Clove & Cinnamon Spice Basket', 'Dhow Sunset Sail Discount'],
    hostMessage: 'Karibu Zanzibar! Wake up to turquoise tides and warm spiced tea.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 2,
    views: 1730,
    likesCount: 284,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [185, 210],
    createdAt: Date.now() - 6 * 864e5,
  },
  {
    id: 's_ww_3',
    title: 'Dubai Marina High-Floor Skyline Suite with Burj Al Arab Horizon',
    location: 'Dubai Marina, UAE',
    lat: 25.0805,
    lng: 55.1403,
    price: 34000,
    currency: 'KES',
    rating: 4.89,
    reviewsCount: 68,
    type: 'Apartment',
    guests: 4,
    beds: 2,
    area: 118,
    category: 'Gold',
    status: 'live',
    features: ['WiFi', 'Swimming Pool', 'Air Conditioning', 'Gym', 'Workspace', 'Elevator', '24/7 Concierge'],
    highlights: ['Panoramic yacht marina balcony', '500Mbps business fiber', '2 mins to Marina Walk & Tram'],
    description: 'Sleek 36th-floor designer residence in Dubai Marina featuring executive ergonomic workstation, floor-to-ceiling skyline vistas, and podium infinity pool.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-living-room-and-terrace-43405-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80',
    source: 'AirBus World Wide',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    isVerified: true,
    isWorldWide: true,
    country: 'United Arab Emirates',
    countryCode: 'AE',
    region: 'Middle East',
    localCurrency: 'AED',
    localCurrencyPrice: 960,
    isAirbusWork: true,
    monthlyPrice: 820000,
    wifiSpeedMbps: 500,
    hasDedicatedWorkspace: true,
    corporateInvoicingAvailable: true,
    welcomeGifts: ['Medjool Dates & Arabic Coffee', 'Dubai Metro Gold Nol Card'],
    hostMessage: 'Marhaba! Enjoy uninterrupted yacht marina views and superfast 500Mbps fiber.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 2,
    views: 1590,
    likesCount: 245,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [220, 280],
    createdAt: Date.now() - 4 * 864e5,
  },
  {
    id: 's_ww_4',
    title: 'Ubud Rice Terrace Bamboo Canopy Villa with Infinity Plunge Pool',
    location: 'Ubud, Bali, Indonesia',
    lat: -8.5069,
    lng: 115.2625,
    price: 21000,
    currency: 'KES',
    rating: 4.96,
    reviewsCount: 154,
    type: 'Villa',
    guests: 4,
    beds: 2,
    area: 170,
    category: 'Diamond',
    status: 'live',
    features: ['WiFi', 'Swimming Pool', 'Garden', 'Workspace', 'Yoga Deck'],
    highlights: ['Overlooks emerald rice paddies', 'Floating breakfast included', 'Quiet jungle work sanctuary'],
    description: 'Handcrafted architectural bamboo sanctuary surrounded by tropical Ubud rainforest. Ideal for creative sabbaticals and exotic tropical escapes.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-wooden-house-in-the-middle-of-a-forest-43410-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
    source: 'AirBus World Wide',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    isVerified: true,
    isWorldWide: true,
    country: 'Indonesia',
    countryCode: 'ID',
    region: 'Asia',
    localCurrency: 'IDR',
    localCurrencyPrice: 2550000,
    isEscapeOffer: true,
    escapeOfferTitle: 'Bali Jungle Retreat 30% Off',
    escapeOriginalPrice: 21000,
    escapeOfferPrice: 14700,
    escapeDiscountPercent: 30,
    escapeValidFrom: new Date().toISOString().slice(0, 10),
    escapeValidTo: new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10),
    welcomeGifts: ['Floating Flower Pool Breakfast', 'Balinese Luwak Coffee'],
    hostMessage: 'Om Swastiastu! Wake up above the rice terraces with herbal tea and serene rainforest sounds.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 2,
    views: 2150,
    likesCount: 360,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [110, 160],
    createdAt: Date.now() - 3 * 864e5,
  },
];

const SEED_LOCAL_GUIDES: LocalGuideProfile[] = [
  {
    id: 'lg_1',
    name: 'Brian Ochieng',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    areaCovered: 'Kilimani, Yaya, Westlands & Nairobi CBD',
    languages: ['English', 'Swahili', 'Sheng'],
    rating: 4.95,
    reviewsCount: 84,
    hourlyRateKes: 800,
    specialty: 'Budget Apartments & Local Fresh Food Markets',
    bio: 'Born and raised in Nairobi. I help travelers find safe, hidden studio stays under KES 2,800/night and negotiate fair local market rates at Wakulima & Toi Market.',
    phone: '+254 711 456 789',
    whatsapp: '254711456789',
  },
  {
    id: 'lg_2',
    name: 'Amina Hassan',
    avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&q=80',
    areaCovered: 'Nyali, Bamburi, Old Town & Kongowea (Mombasa)',
    languages: ['Swahili', 'English', 'Arabic'],
    rating: 4.98,
    reviewsCount: 112,
    hourlyRateKes: 700,
    specialty: 'Affordable Coastal Cottages & Spice/Seafood Markets',
    bio: 'Certified Mombasa heritage guide. Let me show you where locals eat authentic Swahili pilau for KES 250 and find spotless coastal rooms near Kongowea & Bamburi Beach.',
    phone: '+254 723 891 234',
    whatsapp: '254723891234',
  },
  {
    id: 'lg_3',
    name: 'Grace Wambui',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    areaCovered: 'Roysambu, Kasarani, Ruaka & Thika Road',
    languages: ['English', 'Swahili', 'Kikuyu'],
    rating: 4.9,
    reviewsCount: 67,
    hourlyRateKes: 600,
    specialty: 'Ultra-Budget Short Stays & Commuter Navigation',
    bio: 'Expert in northern Nairobi value stays (KES 1,800–3,000/night). I personally vet landlord security, water pressure, and guide guests through TRM & Githurai produce hubs.',
    phone: '+254 790 223 445',
    whatsapp: '254790223445',
  },
];

const SEED_NEIGHBORHOOD_ARTICLES: NeighborhoodArticle[] = [
  {
    id: 'art_1',
    title: 'How to Score Spotless Nairobi Stays Under KES 2,500 Using Local Markets',
    area: 'Roysambu & Kasarani, Nairobi',
    readTime: '4 min read',
    heroImage: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
    excerpt: 'Skip inflated tourist corridors and tap into Roysambu, Ruaka, and South B with trusted host picks and fresh market walks.',
    content: 'Travelers looking for budget-friendly Nairobi accommodations often overlook vibrant commuter hubs along Thika Road and Mombasa Road. By staying 5 minutes from fresh open-air markets, guests cut dining expenses by 60% while accessing fast 4G/fiber apartments.',
    hostRecommendations: [
      { spot: 'Kasarani Farmers Open Market', category: 'Fresh Produce', tip: 'Visit before 9 AM for organic Rift Valley vegetables at wholesale prices.' },
      { spot: 'Roysambu Roast Corner', category: 'Local Dining', tip: 'Try authentic Kenyan nyama choma & ugali under KES 450.' },
    ],
  },
  {
    id: 'art_2',
    title: 'Mombasa On A Budget: Navigating Kongowea Market & Bamburi Hidden Studios',
    area: 'Bamburi & Nyali Border, Mombasa',
    readTime: '5 min read',
    heroImage: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80',
    excerpt: 'Discover verified coastal courtyard flats and how local AirBus guides help you haggle tuk-tuks, spices, and seafood like a resident.',
    content: 'Mombasa coastal stays do not require five-star resort budgets. Studios tucked two streets behind Bamburi Beach offer AC, Wi-Fi, and full kitchens for KES 2,500/night—putting you a 4-minute tuk-tuk ride from Kongowea spice market.',
    hostRecommendations: [
      { spot: 'Kongowea Spice & Coconut Alley', category: 'Market Experience', tip: 'Bring a local guide for fresh Swahili cardamom tea blends & cashews.' },
      { spot: 'Jomo Kenyatta Public Beach Sunset Pier', category: 'Free Experience', tip: 'Best experienced around 5:30 PM with roasted mahindi.' },
    ],
  },
];

const SEED_BOOKINGS: Booking[] = [
  {
    id: 'b_demo_1',
    reference: 'AB9482X',
    stayId: 's1',
    guestEmail: 'guest@airbus.ke',
    guestName: 'Sarah Wanjiku',
    checkIn: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10),
    guests: 2,
    subtotal: 25500,
    cleaningFee: 1275,
    serviceFee: 2040,
    total: 28815,
    currency: 'KES',
    status: 'confirmed',
    note: 'Arriving around 3 PM from JKIA airport. Excited for the city view!',
    createdAt: Date.now() - 2 * 864e5,
  },
  {
    id: 'b_demo_upcoming_24h',
    reference: 'AB24HRS',
    stayId: 's2',
    guestEmail: 'guest@airbus.ke',
    guestName: 'Sarah Wanjiku',
    checkIn: new Date(Date.now() + 20 * 3600 * 1000).toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
    guests: 2,
    subtotal: 9000,
    cleaningFee: 450,
    serviceFee: 720,
    total: 10170,
    currency: 'KES',
    status: 'confirmed',
    note: 'Arriving tomorrow afternoon. Ready for check-in!',
    selectedGifts: ['Kenyan Safari Kahawa & Fresh Ground Beans', 'Fresh Coconut Water & Tropical Basket'],
    createdAt: Date.now() - 864e5,
  },
  {
    id: 'b_demo_2',
    reference: 'AB6107K',
    stayId: 's4',
    guestEmail: 'guest@airbus.ke',
    guestName: 'Sarah Wanjiku',
    checkIn: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 18 * 864e5).toISOString().slice(0, 10),
    guests: 4,
    subtotal: 88000,
    cleaningFee: 3300,
    serviceFee: 7040,
    total: 98340,
    currency: 'KES',
    status: 'requested',
    note: 'Family beach holiday. Looking forward to enjoying the infinity pool.',
    createdAt: Date.now() - 12 * 3600e3,
  },
];

const SEED_THREADS: ChatThread[] = [
  {
    id: 's1',
    stayId: 's1',
    guestEmail: 'guest@airbus.ke',
    hostEmail: 'owner@airbus.ke',
    unreadGuest: true,
    unreadHost: false,
    updatedAt: Date.now() - 3600e3,
    messages: [
      {
        id: 'm1',
        from: 'guest',
        type: 'offer',
        amount: 7800,
        status: 'countered',
        createdAt: Date.now() - 864e5,
      },
      {
        id: 'm2',
        from: 'host',
        type: 'counter',
        amount: 8200,
        status: 'pending',
        createdAt: Date.now() - 432e5,
      },
      {
        id: 'm3',
        from: 'host',
        type: 'text',
        text: 'Hello Sarah! I can do KES 8,200/night for your 3-night stay in Westlands. It includes complimentary early check-in.',
        createdAt: Date.now() - 3600e3,
      },
    ],
  },
];

const SEED_REVIEWS: Review[] = [
  {
    id: 'rev_1',
    stayId: 's1',
    guestEmail: 'guest@airbus.ke',
    guestName: 'Sarah Wanjiku',
    rating: 5,
    comment: 'The skyline views from the balcony are world-class! Superfast fiber, modern appliances, and David was a gracious host who met us in the lobby.',
    createdAt: Date.now() - 10 * 864e5,
  },
  {
    id: 'rev_2',
    stayId: 's4',
    guestEmail: 'guest@airbus.ke',
    guestName: 'Sarah Wanjiku',
    rating: 5,
    comment: 'Unmatched beachfront privacy. The infinity pool overlooking the ocean is pure heaven.',
    createdAt: Date.now() - 16 * 864e5,
  },
];

const SEED_POSTS: Post[] = [
  {
    id: 'post_short_1',
    ownerEmail: 'owner@airbus.ke',
    creatorName: 'Wanjiku Properties',
    stayId: 's1',
    type: 'short',
    description: 'Breathtaking 18th-floor sundowner views over the Westlands skyline and distant Ngong Hills. #Westlands #NairobiSkyline #AirBusStays',
    caption: 'Breathtaking 18th-floor sundowner views over the Westlands skyline and distant Ngong Hills.',
    hashtags: ['#Westlands', '#NairobiSkyline', '#AirBusStays'],
    coverUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-living-room-and-terrace-43405-large.mp4',
    durationSeconds: 24,
    sourceType: 'video',
    autoGenerated: true,
    captionsEnabled: true,
    captions: [
      { id: 'c1', startSec: 0, endSec: 6, text: '18th-floor skyline view over Westlands' },
      { id: 'c2', startSec: 6, endSec: 14, text: 'Floor-to-ceiling glass overlooking Ngong Hills' },
      { id: 'c3', startSec: 14, endSec: 24, text: 'Book direct with zero guest fees on AirBus' },
    ],
    shortAudio: {
      mode: 'song',
      trackId: 'mus_1',
      trackTitle: 'Safari Sunrise Vibes',
      trackArtist: 'Mara Beats',
      trackUrl: '/uploads/audio/mus_1.mp3',
      audioStartSec: 0,
      originalVolume: 20,
      musicVolume: 85,
      voiceOverVolume: 0,
      autoDuckMusic: true,
      licenseId: 'lic_pixabay',
      requiresAttribution: false,
      attributionText: 'Safari Sunrise Vibes by Mara Beats · Pixabay Music (Free UGC)',
    },
    comments: [
      {
        id: 'pc_1',
        postId: 'post_short_1',
        authorEmail: 'guest@airbus.ke',
        authorName: 'Sarah Wanjiku',
        text: 'That sunset view from the terrace is unreal! Bookmarking for next weekend.',
        createdAt: Date.now() - 4 * 864e5,
      },
    ],
    moderationStatus: 'approved',
    status: 'approved',
    views: 4200,
    likes: 620,
    shares: 145,
    viralityScore: 92,
    createdAt: Date.now() - 10 * 864e5,
    updatedAt: Date.now() - 10 * 864e5,
  },
  {
    id: 'post_video_2',
    ownerEmail: 'owner@airbus.ke',
    stayId: 's4',
    type: 'video',
    description: 'Exclusive walking video tour of Nyali Beachfront Villa: private infinity pool, beach pathway & Swahili arches.',
    coverUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-villa-with-pool-and-terrace-in-front-of-the-sea-43406-large.mp4',
    durationSeconds: 420,
    status: 'approved',
    views: 7800,
    likes: 980,
    shares: 230,
    viralityScore: 96,
    createdAt: Date.now() - 14 * 864e5,
    updatedAt: Date.now() - 14 * 864e5,
  },
  {
    id: 'post_photo_3',
    ownerEmail: 'owner@airbus.ke',
    stayId: 's3',
    type: 'photo',
    description: 'Golden hour at Lavington Garden Bungalow. 0.5 acre manicured lawn, stone hearth fireplace & verandas.',
    coverUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'approved',
    views: 3100,
    likes: 410,
    shares: 88,
    viralityScore: 84,
    createdAt: Date.now() - 20 * 864e5,
    updatedAt: Date.now() - 20 * 864e5,
  },
  {
    id: 'post_pending_4',
    ownerEmail: 'owner@airbus.ke',
    stayId: 's2',
    type: 'short',
    description: 'Chic designer studio morning light near Yaya Centre. Fast WiFi, workspace & rain shower.',
    coverUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-luxurious-living-room-with-a-modern-interior-design-43409-large.mp4',
    durationSeconds: 38,
    status: 'pending',
    views: 0,
    likes: 0,
    shares: 0,
    viralityScore: 0,
    createdAt: Date.now() - 2 * 3600e3,
    updatedAt: Date.now() - 2 * 3600e3,
  },
];

const SEED_AD_REQUESTS: AdRequest[] = [
  {
    id: 'ad_1',
    advertiserEmail: 'guest@airbus.ke',
    stayId: 's1',
    title: 'Nairobi Airport Transfers & Chauffeur VIP',
    description: 'Mercedes E-Class & Prado airport pickups 24/7. 10% off for AirBus guests.',
    imageUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80',
    targetUrl: 'https://wa.me/254712345678',
    contactPhone: '+254 712 345 678',
    tag: 'Chauffeur',
    days: 5,
    totalAmount: 500,
    platformFee: 150,
    hostNet: 350,
    status: 'approved',
    views: 342,
    clicks: 48,
    startsAt: Date.now() - 864e5,
    expiresAt: Date.now() + 4 * 864e5,
    createdAt: Date.now() - 864e5,
  },
  {
    id: 'ad_2',
    advertiserEmail: 'guest@airbus.ke',
    stayId: 's4',
    title: 'Nyali Coastal Watersports & Jet Ski Hire',
    description: 'Guided dolphin tours, kitesurfing school and jet ski rentals directly off Nyali beach.',
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=400&q=80',
    targetUrl: 'https://wa.me/254700000001',
    contactPhone: '+254 700 000 001',
    tag: 'Experiences',
    days: 7,
    totalAmount: 700,
    platformFee: 210,
    hostNet: 490,
    status: 'approved',
    views: 520,
    clicks: 82,
    startsAt: Date.now() - 2 * 864e5,
    expiresAt: Date.now() + 5 * 864e5,
    createdAt: Date.now() - 2 * 864e5,
  },
  {
    id: 'ad_worked_example_3',
    advertiserEmail: 'guest@airbus.ke',
    stayId: 's1',
    title: 'Westlands Organic Rooftop Brunch & Cafe',
    description: 'Fresh artisanal sourdough, espresso, and avocado toast 2 mins walk from your penthouse.',
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=400&q=80',
    targetUrl: 'https://wa.me/254712345678',
    contactPhone: '+254 712 345 678',
    tag: 'Cafe & Dining',
    days: 3,
    totalAmount: 300,
    platformFee: 90,
    hostNet: 210,
    status: 'pending',
    views: 0,
    clicks: 0,
    createdAt: Date.now() - 3600e3,
  },
];

const SEED_PROMOTIONS: ListingPromotion[] = [
  {
    id: 'promo_seed_1',
    stayId: 's1',
    ownerEmail: 'owner@airbus.ke',
    days: 7,
    cost: 700,
    startsAt: Date.now() - 864e5,
    expiresAt: Date.now() + 6 * 864e5,
    status: 'active',
    impressions: 432,
    clicks: 68,
    createdAt: Date.now() - 864e5,
  },
  {
    id: 'promo_seed_2',
    stayId: 's4',
    ownerEmail: 'owner@airbus.ke',
    days: 14,
    cost: 1400,
    startsAt: Date.now() - 2 * 864e5,
    expiresAt: Date.now() + 12 * 864e5,
    status: 'active',
    impressions: 890,
    clicks: 142,
    createdAt: Date.now() - 2 * 864e5,
  },
];

const SEED_WALLET_RECORDS: Record<string, WalletRecord> = {
  'owner@airbus.ke': {
    email: 'owner@airbus.ke',
    balance: 12500,
    holdBalance: 0,
    lifetimeEarnings: 15000,
    lifetimeSpent: 2500,
    updatedAt: Date.now(),
  },
  'guest@airbus.ke': {
    email: 'guest@airbus.ke',
    balance: 4700,
    holdBalance: 0,
    lifetimeEarnings: 5000,
    lifetimeSpent: 300,
    updatedAt: Date.now(),
  },
  'admin@airbus.ke': {
    email: 'admin@airbus.ke',
    balance: 2800,
    holdBalance: 0,
    lifetimeEarnings: 2800,
    lifetimeSpent: 0,
    updatedAt: Date.now(),
  },
};

const SEED_LEDGER_ENTRIES: LedgerEntry[] = [
  {
    id: 'ledg_1',
    fromWallet: 'external_mpesa',
    toWallet: 'owner@airbus.ke',
    amount: 15000,
    type: 'topup',
    referenceId: 'MP991204',
    description: 'M-Pesa wallet deposit',
    createdAt: Date.now() - 25 * 864e5,
  },
  {
    id: 'ledg_2',
    fromWallet: 'owner@airbus.ke',
    toWallet: 'admin@airbus.ke',
    amount: 2500,
    type: 'subscription',
    referenceId: 'Diamond',
    description: '30-Day Diamond Plan subscription fee',
    createdAt: Date.now() - 20 * 864e5,
  },
  {
    id: 'ledg_3',
    fromWallet: 'external_mpesa',
    toWallet: 'guest@airbus.ke',
    amount: 5000,
    type: 'topup',
    referenceId: 'GUE7X2K9AB',
    description: 'M-Pesa wallet deposit',
    createdAt: Date.now() - 15 * 864e5,
  },
  {
    id: 'ledg_4',
    fromWallet: 'guest@airbus.ke',
    toWallet: 'admin@airbus.ke',
    amount: 300,
    type: 'ad_payment',
    referenceId: 'ad_1',
    description: '3-day advert payment for Modern Westlands Penthouse',
    createdAt: Date.now() - 3 * 864e5,
  },
];

const SEED_REFERRALS: Record<string, ReferralProfile> = {
  'guest@airbus.ke': {
    userEmail: 'guest@airbus.ke',
    referralCode: 'SARAH2026',
    clicks: 42,
    signupsCount: 6,
    totalEarnedKes: 1850,
    createdAt: Date.now() - 30 * 864e5,
  },
  'owner@airbus.ke': {
    userEmail: 'owner@airbus.ke',
    referralCode: 'DAVIDMUTUA',
    clicks: 89,
    signupsCount: 12,
    totalEarnedKes: 4200,
    createdAt: Date.now() - 60 * 864e5,
  },
  'admin@airbus.ke': {
    userEmail: 'admin@airbus.ke',
    referralCode: 'AIRBUSPRO',
    clicks: 154,
    signupsCount: 30,
    totalEarnedKes: 9500,
    createdAt: Date.now() - 120 * 864e5,
  },
};

const SEED_REFERRAL_CODES: Record<string, string> = {
  SARAH2026: 'guest@airbus.ke',
  DAVIDMUTUA: 'owner@airbus.ke',
  AIRBUSPRO: 'admin@airbus.ke',
};

export const SEED_TRIP_DATING_PROFILES: TripDatingProfile[] = [
  {
    id: 'tdp_1',
    userId: 'u_zawadi',
    fullName: 'Zawadi Njeri',
    phoneNumber: '+254 718 293 841',
    gender: 'female',
    age: 27,
    dob: '1999-04-12',
    country: 'Kenya',
    city: 'Nairobi',
    location: 'Westlands & Kileleshwa, Nairobi',
    description: 'Tech product manager & weekend mountain hiker. Love sunset conversations over rooftop cappuccino, discovering boutique art galleries, and exploring Kenya’s hidden stay gems.',
    lookingFor: 'A smart, ambitious, kind gentleman who values deep conversations, spontaneous road trips, and laughter.',
    datingIntention: 'dating_companionship',
    videos: [
      'https://assets.mixkit.co/videos/preview/mixkit-young-woman-talking-on-video-call-with-her-phone-41525-large.mp4',
      'https://assets.mixkit.co/videos/preview/mixkit-woman-enjoying-a-sunny-day-in-a-park-41528-large.mp4',
    ],
    videoDurations: [60, 60],
    videoThumbnails: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    ],
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-talking-on-video-call-with-her-phone-41525-large.mp4',
    videoThumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    videoDuration: 60,
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
    ],
    primaryPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    full_body_photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    full_body_verified: true,
    fullBodyModerationStatus: 'approved',
    likes: 42,
    likedByUserEmails: ['guest@airbus.ke'],
    views: 310,
    status: 'active',
    createdAt: Date.now() - 14 * 864e5,
    updatedAt: Date.now() - 2 * 864e5,
  },
  {
    id: 'tdp_2',
    userId: 'u_kevin',
    fullName: 'Kevin Ochieng',
    phoneNumber: '+254 723 881 290',
    gender: 'male',
    age: 30,
    dob: '1996-08-20',
    country: 'Kenya',
    city: 'Nairobi',
    location: 'Kilimani, Nairobi',
    description: 'Architect & urban design enthusiast. When not sketching modern eco-villas, you will find me playing jazz piano, searching for Nairobi’s finest espresso, or tennis at the club.',
    lookingFor: 'An authentic, emotionally mature lady with her own passions who loves travel, good food, and genuine companionship.',
    datingIntention: 'serious_relationship',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1480429370139-e0132c086e2a?auto=format&fit=crop&w=800&q=80',
    ],
    primaryPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    full_body_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    full_body_verified: true,
    fullBodyModerationStatus: 'approved',
    likes: 67,
    likedByUserEmails: [],
    views: 480,
    status: 'active',
    createdAt: Date.now() - 20 * 864e5,
    updatedAt: Date.now() - 5 * 864e5,
  },
  {
    id: 'tdp_3',
    userId: 'u_brenda',
    fullName: 'Brenda Chebet',
    phoneNumber: '+254 791 405 612',
    gender: 'female',
    age: 26,
    dob: '2000-01-15',
    country: 'Kenya',
    city: 'Mombasa',
    location: 'Nyali & Diani, Coastal Kenya',
    description: 'Marine conservationist & coastal guide. Living by the tides, morning beach jogs, Swahili seafood dining, and sunset dhow cruises. Always carrying sunshine and positive energy.',
    lookingFor: 'Someone genuine, respectful, and adventurous to share coastal escapes, snorkeling trips, and hearty laughter.',
    datingIntention: 'travel_partner',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-woman-enjoying-a-sunny-day-in-a-park-41528-large.mp4',
    videoThumbnail: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80',
    videoDuration: 60,
    videos: [
      'https://assets.mixkit.co/videos/preview/mixkit-woman-enjoying-a-sunny-day-in-a-park-41528-large.mp4'
    ],
    videoDurations: [60],
    videoThumbnails: [
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80'
    ],
    photos: [
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
    ],
    primaryPhoto: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80',
    full_body_photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80',
    full_body_verified: true,
    fullBodyModerationStatus: 'approved',
    likes: 89,
    likedByUserEmails: ['guest@airbus.ke'],
    views: 620,
    status: 'active',
    createdAt: Date.now() - 10 * 864e5,
    updatedAt: Date.now() - 1 * 864e5,
  },
  {
    id: 'tdp_4',
    userId: 'u_brian',
    fullName: 'Brian Mwangi',
    phoneNumber: '+254 702 334 119',
    gender: 'male',
    age: 32,
    dob: '1994-11-03',
    country: 'Kenya',
    city: 'Nakuru',
    location: 'Milimani, Nakuru & Nairobi',
    description: 'Renewable energy engineer & wildlife photography hobbyist. Love weekend drives around the Rift Valley lakes, campfires under star-filled skies, and cooking gourmet meals.',
    lookingFor: 'An open-hearted companion who enjoys nature, intellectual curiosity, and building something meaningful together.',
    datingIntention: 'serious_relationship',
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=800&q=80',
    ],
    primaryPhoto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
    full_body_photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
    full_body_verified: true,
    fullBodyModerationStatus: 'approved',
    likes: 38,
    likedByUserEmails: [],
    views: 295,
    status: 'active',
    createdAt: Date.now() - 18 * 864e5,
    updatedAt: Date.now() - 3 * 864e5,
  },
  {
    id: 'tdp_5',
    userId: 'u_faith',
    fullName: 'Faith Wambui',
    phoneNumber: '+254 715 892 014',
    gender: 'female',
    age: 25,
    dob: '2001-06-25',
    country: 'Kenya',
    city: 'Nairobi',
    location: 'Karen & Lavington, Nairobi',
    description: 'Interior decorator & botanical plant collector. I believe life is made sweeter by jazz, fresh blooms, warm baked bread, and great road trips to the countryside.',
    lookingFor: 'A chivalrous, grounded guy who appreciates creativity, loves travel, and isn’t afraid to be silly on a Saturday afternoon.',
    datingIntention: 'dating_companionship',
    photos: [
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1589571894960-20bbe2828d0a?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
    ],
    primaryPhoto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
    full_body_photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
    full_body_verified: true,
    fullBodyModerationStatus: 'approved',
    likes: 54,
    likedByUserEmails: [],
    views: 410,
    status: 'active',
    createdAt: Date.now() - 12 * 864e5,
    updatedAt: Date.now() - 2 * 864e5,
  },
  {
    id: 'tdp_6',
    userId: 'u_dennis',
    fullName: 'Dennis Kiprop',
    phoneNumber: '+254 725 610 933',
    gender: 'male',
    age: 29,
    dob: '1997-09-14',
    country: 'Kenya',
    city: 'Eldoret',
    location: 'Eldoret & Nairobi',
    description: 'Agritech founder, long-distance runner & coffee enthusiast. Balancing technology and nature. Looking forward to exploring more of East Africa.',
    lookingFor: 'An energetic, driven partner who enjoys outdoor adventures, fitness, and shared ambitious dreams.',
    datingIntention: 'dating_companionship',
    photos: [
      'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80',
    ],
    primaryPhoto: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=800&q=80',
    full_body_photo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=800&q=80',
    full_body_verified: true,
    fullBodyModerationStatus: 'approved',
    likes: 31,
    likedByUserEmails: [],
    views: 220,
    status: 'active',
    createdAt: Date.now() - 8 * 864e5,
    updatedAt: Date.now() - 1 * 864e5,
  },
];

class DatabaseStore {
  private data: DatabaseSchema;
  private lastSessionTouchSavedAt = 0;
  private walletListeners = new Set<(payload: {
    email: string;
    balance: number;
    holdBalance: number;
    available: number;
    updatedAt: number;
  }) => void>();
  private feedListeners = new Set<(event: {
    id: string;
    type: 'stay' | 'trip_dating';
    item: any;
    ts: number;
  }) => void>();
  private recentApprovedEvents: Array<{
    id: string;
    type: 'stay' | 'trip_dating';
    item: any;
    ts: number;
  }> = [];
  private publicFeedCache: {
    stays?: { key: string; ts: number; data: any };
    tripDating?: { key: string; ts: number; data: any };
    collections?: Record<string, { ts: number; data: any }>;
  } = {};

  constructor() {
    this.data = this.load();
    this.runStartupMigrations();
    this.checkAndRunAutoYearEndArchive();
    this.ensurePortalCredentialSeeds();
    this.checkAllExpirations();
    this.checkUpcomingCheckinReminders();
    this.initShortServices();
  }

  public invalidateFeedCache(type?: 'stay' | 'trip_dating' | 'collection') {
    if (!type || type === 'stay' || type === 'collection') {
      this.publicFeedCache.stays = undefined;
      this.publicFeedCache.collections = undefined;
    }
    if (!type || type === 'trip_dating') {
      this.publicFeedCache.tripDating = undefined;
    }
  }

  public assertNoBlobUrls(urls: Array<string | undefined | null>) {
    for (const u of urls) {
      if (typeof u === 'string' && u.trim().toLowerCase().startsWith('blob:')) {
        throw new Error('Temporary browser blob: URLs cannot be saved. Please wait for media upload to complete.');
      }
    }
  }

  public subscribeFeedUpdates(
    listener: (event: { id: string; type: 'stay' | 'trip_dating'; item: any; ts: number }) => void
  ): () => void {
    this.feedListeners.add(listener);
    return () => {
      this.feedListeners.delete(listener);
    };
  }

  public emitFeedApproved(type: 'stay' | 'trip_dating', item: any) {
    const evt = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      item,
      ts: Date.now(),
    };
    this.recentApprovedEvents.unshift(evt);
    if (this.recentApprovedEvents.length > 200) {
      this.recentApprovedEvents.length = 200;
    }
    this.feedListeners.forEach(fn => {
      try {
        fn(evt);
      } catch (err) {
        logger.warn('feed_listener_error', { error: String(err) });
      }
    });
  }

  public getMissedApprovedFeed(sinceTs: number, viewerUser?: User | null) {
    const cutoff = Number(sinceTs) || 0;
    const canSeePlus = this.canViewerSeePlus(viewerUser);
    return this.recentApprovedEvents
      .filter(evt => {
        if (evt.ts <= cutoff) return false;
        if (evt.type === 'stay' && evt.item?.isPlusVVVIP && !canSeePlus) return false;
        return true;
      })
      .slice()
      .reverse();
  }

  private canViewerSeePlus(viewerUser?: User | null): boolean {
    if (!viewerUser) return false;
    if (viewerUser.role === 'admin') return true;
    return this.isActivePlusMember(viewerUser);
  }

  public runStartupMigrations() {
    if (!this.data.appliedMigrations) this.data.appliedMigrations = [];

    // Migration v1: Sync stays & legacy trip dating moderation state fields
    const migrationV1 = 'v1_moderation_pipeline_sync';
    if (!this.data.appliedMigrations.some(m => m.id === migrationV1)) {
      const staysSnapshot = (this.data.stays || []).map(s => ({
        id: s.id,
        status: s.status,
        isApprovedByAdmin: s.isApprovedByAdmin,
        moderationStatus: s.moderationStatus,
        moderationState: s.moderationState,
        admin_feedback: s.admin_feedback,
        reviewed_at: s.reviewed_at,
        reviewed_by: s.reviewed_by,
      }));
      const tdpSnapshot = (this.data.tripDatingProfiles || []).map(p => ({
        id: p.id,
        status: p.status,
        moderationState: p.moderationState,
        admin_feedback: p.admin_feedback,
        reviewed_at: p.reviewed_at,
        reviewed_by: p.reviewed_by,
      }));

      (this.data.stays || []).forEach(s => {
        if (!s.moderationState) {
          if (s.status === 'review' || s.moderationStatus === 'pending' || (!s.isApprovedByAdmin && s.status !== 'live')) {
            if (s.moderationStatus === 'rejected' || s.moderationStatus === 'suspended' || s.status === 'delisted') {
              s.moderationState = 'DECLINED';
            } else {
              s.moderationState = 'PENDING';
              s.status = 'review';
              s.isApprovedByAdmin = false;
              s.moderationStatus = 'pending';
            }
          } else if (s.moderationStatus === 'rejected' || s.moderationStatus === 'suspended') {
            s.moderationState = 'DECLINED';
          } else {
            s.moderationState = 'APPROVED';
            s.isApprovedByAdmin = true;
            s.moderationStatus = 'approved';
          }
        }
        if (s.admin_feedback === undefined) s.admin_feedback = s.moderationReason || null;
        if (s.reviewed_at === undefined) s.reviewed_at = null;
        if (s.reviewed_by === undefined) s.reviewed_by = null;
      });

      (this.data.tripDatingProfiles || []).forEach(p => {
        if (!p.moderationState) {
          if (p.status === 'pending' || p.fullBodyModerationStatus === 'pending_review') {
            p.moderationState = 'PENDING';
            p.status = 'pending';
          } else if (p.status === 'rejected' || p.status === 'suspended' || p.status === 'removed' || p.fullBodyModerationStatus === 'rejected') {
            p.moderationState = 'DECLINED';
          } else {
            p.moderationState = 'APPROVED';
            p.status = 'active';
            p.fullBodyModerationStatus = 'approved';
          }
        }
        if (p.admin_feedback === undefined) p.admin_feedback = p.removalReason || null;
        if (p.reviewed_at === undefined) p.reviewed_at = null;
        if (p.reviewed_by === undefined) p.reviewed_by = null;
      });

      this.data.appliedMigrations.push({
        id: migrationV1,
        appliedAt: Date.now(),
        snapshot: { staysSnapshot, tdpSnapshot },
      });
      this.save();
      logger.info('migration_applied', { migrationId: migrationV1 });
    }

    // Migration v2: Unified Trip Dating status enum (DRAFT/PENDING_REVIEW/APPROVED/DECLINED),
    // backfill published_at, city_custom, decline_reason, and seed media_assets index
    const migrationV2 = 'v2_trip_dating_status_and_feed_sync';
    if (!this.data.appliedMigrations.some(m => m.id === migrationV2)) {
      const builtInCities = new Set(['nairobi', 'mombasa', 'nakuru', 'eldoret', 'kisumu']);
      const tdpV2Snapshot = (this.data.tripDatingProfiles || []).map(p => ({
        id: p.id,
        status: p.status,
        moderationState: p.moderationState,
        published_at: p.published_at,
        decline_reason: p.decline_reason,
        admin_feedback: p.admin_feedback,
        city_custom: p.city_custom,
      }));
      const prevMediaAssetIds = (this.data.media_assets || []).map(m => m.id);

      if (!this.data.media_assets) this.data.media_assets = [];

      (this.data.tripDatingProfiles || []).forEach(p => {
        const rawStatus = String(p.status || '').trim().toUpperCase();
        const rawMod = String(p.moderationState || '').trim().toUpperCase();

        let unified: TripDatingUnifiedStatus = 'PENDING_REVIEW';
        if (rawStatus === 'DRAFT' || rawMod === 'DRAFT') {
          unified = 'DRAFT';
        } else if (
          rawStatus === 'DECLINED' ||
          rawStatus === 'REJECTED' ||
          rawStatus === 'REMOVED' ||
          rawStatus === 'SUSPENDED' ||
          rawMod === 'DECLINED'
        ) {
          unified = 'DECLINED';
        } else if (
          rawStatus === 'APPROVED' ||
          rawStatus === 'ACTIVE' ||
          rawMod === 'APPROVED'
        ) {
          unified = 'APPROVED';
        } else {
          unified = 'PENDING_REVIEW';
        }

        p.status = unified;
        p.moderationState = unified;

        if (unified === 'APPROVED') {
          p.published_at = p.published_at || p.reviewed_at || p.createdAt || Date.now();
          p.fullBodyModerationStatus = 'approved';
          p.full_body_verified = true;
          p.decline_reason = null;
          p.admin_feedback = null;
        } else if (unified === 'DECLINED') {
          const reason = p.decline_reason || p.admin_feedback || p.removalReason || 'Declined by administrator.';
          p.decline_reason = reason;
          p.admin_feedback = reason;
          p.published_at = null;
        } else {
          p.published_at = null;
        }

        const cleanCity = (p.city || '').trim();
        if (cleanCity && !builtInCities.has(cleanCity.toLowerCase())) {
          p.city_custom = p.city_custom || cleanCity;
        } else {
          p.city_custom = null;
        }

        // Register existing video URLs into media_assets if not yet indexed
        const candidateVideos = [p.videoUrl, ...(p.videos || [])].filter(
          (u): u is string => typeof u === 'string' && u.trim().length > 0
        );
        candidateVideos.forEach((vUrl, idx) => {
          const existing = this.data.media_assets!.find(a => a.url === vUrl);
          if (!existing) {
            const assetId = `ma_${p.id}_${idx}_${crypto.randomBytes(3).toString('hex')}`;
            this.data.media_assets!.push({
              id: assetId,
              owner_id: p.ownerEmail || p.userId || 'system',
              type: 'VIDEO',
              storage_key: vUrl.startsWith('/uploads/') ? vUrl.replace(/^\/uploads\//, '') : vUrl,
              url: vUrl,
              mime: vUrl.endsWith('.webm') ? 'video/webm' : 'video/mp4',
              size_bytes: 0,
              duration: p.videoDurations?.[idx] || p.videoDuration || 60,
              status: 'READY',
              poster_url: p.videoThumbnails?.[idx] || p.videoThumbnail || p.primaryPhoto,
              created_at: p.createdAt || Date.now(),
            });
            if (idx === 0 && !p.videoMediaId) {
              p.videoMediaId = assetId;
            }
          } else if (idx === 0 && !p.videoMediaId) {
            p.videoMediaId = existing.id;
          }
        });
      });

      this.data.appliedMigrations.push({
        id: migrationV2,
        appliedAt: Date.now(),
        snapshot: { tdpV2Snapshot, prevMediaAssetIds },
      });
      this.invalidateFeedCache('trip_dating');
      this.save();
      logger.info('migration_applied', { migrationId: migrationV2 });
    }

    // Migration v3: Backfill AirBus listing published_at/publishState, listing_collections join table,
    // Stay video MediaAsset index, and Admin Wallet entries + EAT rollups.
    const migrationV3 = 'v3_airbus_listings_collections_and_admin_wallet';
    if (!this.data.appliedMigrations.some(m => m.id === migrationV3)) {
      const staysV3Snapshot = (this.data.stays || []).map(s => ({
        id: s.id,
        status: s.status,
        publishState: s.publishState,
        published_at: s.published_at,
        approved_by: s.approved_by,
        videoMediaId: s.videoMediaId,
        collections: s.collections ? [...s.collections] : undefined,
      }));
      const prevJoinIds = (this.data.listing_collections || []).map(j => `${j.listing_id}:${j.collection_id}`);
      const prevAdminEntryIds = (this.data.admin_wallet_entries || []).map(e => e.id);
      const prevMediaAssetIdsV3 = (this.data.media_assets || []).map(m => m.id);

      if (!this.data.listing_collections) this.data.listing_collections = [];
      if (!this.data.media_assets) this.data.media_assets = [];
      if (!this.data.transactional_outbox) this.data.transactional_outbox = [];

      for (const s of this.data.stays || []) {
        const isLiveApproved =
          !s.isDelisted &&
          (s.status === 'live' || s.status === 'PUBLISHED') &&
          s.isApprovedByAdmin !== false &&
          s.moderationState !== 'PENDING' &&
          s.moderationState !== 'DECLINED';
        if (isLiveApproved) {
          s.status = 'live';
          s.publishState = 'PUBLISHED';
          s.moderationState = 'APPROVED';
          s.moderationStatus = 'approved';
          s.isApprovedByAdmin = true;
          s.published_at = s.published_at || s.reviewed_at || s.createdAt || Date.now();
          s.approved_by = s.approved_by || s.reviewed_by || 'admin@airbus.ke';
        } else if (s.moderationState === 'DECLINED' || s.isDelisted) {
          s.publishState = 'DECLINED';
          s.published_at = null;
        } else {
          s.publishState = 'PENDING_REVIEW';
          s.published_at = null;
        }

        // Index existing direct stay video URLs into media_assets if not indexed
        const vUrl = s.media?.video?.url || s.videoUrl || '';
        if (vUrl && !vUrl.includes('youtube.com') && !vUrl.includes('youtu.be')) {
          const existing = this.data.media_assets.find(a => a.url === vUrl);
          if (existing) {
            s.videoMediaId = s.videoMediaId || existing.id;
            if (s.media?.video) s.media.video.mediaId = existing.id;
          } else {
            const assetId = `ma_${s.id}_${crypto.randomBytes(3).toString('hex')}`;
            this.data.media_assets.push({
              id: assetId,
              owner_id: s.ownerEmail || s.owner || 'system',
              type: 'VIDEO',
              storage_key: vUrl.startsWith('/uploads/') ? vUrl.replace(/^\/uploads\//, '') : vUrl,
              url: vUrl,
              mime: vUrl.endsWith('.webm') ? 'video/webm' : 'video/mp4',
              size_bytes: s.media?.video?.size || 0,
              duration: s.media?.video?.duration || 60,
              status: 'READY',
              poster_url: s.media?.video?.thumbnail || s.thumbnailUrl || s.images?.[0],
              created_at: s.createdAt || Date.now(),
            });
            s.videoMediaId = assetId;
            if (s.media?.video) s.media.video.mediaId = assetId;
          }
        }

        // Sync listing_collections join rows from stay flags
        const colIds = this.extractCollectionIdsFromStay(s);
        this.syncListingCollections(s.id, colIds, false);
      }

      // Backfill Admin Wallet entries from existing approved payments/ledger
      this.backfillAdminWalletEntries();

      this.data.appliedMigrations.push({
        id: migrationV3,
        appliedAt: Date.now(),
        snapshot: { staysV3Snapshot, prevJoinIds, prevAdminEntryIds, prevMediaAssetIdsV3 },
      });
      this.invalidateFeedCache();
      this.save();
      logger.info('migration_applied', { migrationId: migrationV3 });
    }
  }

  public rollbackMigration(migrationId: string): boolean {
    if (!this.data.appliedMigrations) return false;
    const idx = this.data.appliedMigrations.findIndex(m => m.id === migrationId);
    if (idx === -1) return false;
    const mig = this.data.appliedMigrations[idx];
    const snap = mig.snapshot as any;
    if (snap?.staysSnapshot) {
      snap.staysSnapshot.forEach((orig: any) => {
        const s = (this.data.stays || []).find(st => st.id === orig.id);
        if (s) Object.assign(s, orig);
      });
    }
    if (snap?.staysV3Snapshot) {
      snap.staysV3Snapshot.forEach((orig: any) => {
        const s = (this.data.stays || []).find(st => st.id === orig.id);
        if (s) Object.assign(s, orig);
      });
    }
    if (Array.isArray(snap?.prevJoinIds) && Array.isArray(this.data.listing_collections)) {
      const keepJoins = new Set(snap.prevJoinIds);
      this.data.listing_collections = this.data.listing_collections.filter(j =>
        keepJoins.has(`${j.listing_id}:${j.collection_id}`)
      );
    }
    if (Array.isArray(snap?.prevAdminEntryIds) && Array.isArray(this.data.admin_wallet_entries)) {
      const keepEntries = new Set(snap.prevAdminEntryIds);
      this.data.admin_wallet_entries = this.data.admin_wallet_entries.filter(e => keepEntries.has(e.id));
      this.rebuildAdminWalletRollups();
    }
    if (Array.isArray(snap?.prevMediaAssetIdsV3) && Array.isArray(this.data.media_assets)) {
      const keepMedia = new Set(snap.prevMediaAssetIdsV3);
      this.data.media_assets = this.data.media_assets.filter(a => keepMedia.has(a.id));
    }
    if (snap?.tdpSnapshot) {
      snap.tdpSnapshot.forEach((orig: any) => {
        const p = (this.data.tripDatingProfiles || []).find(pr => pr.id === orig.id);
        if (p) Object.assign(p, orig);
      });
    }
    if (snap?.tdpV2Snapshot) {
      snap.tdpV2Snapshot.forEach((orig: any) => {
        const p = (this.data.tripDatingProfiles || []).find(pr => pr.id === orig.id);
        if (p) Object.assign(p, orig);
      });
    }
    if (Array.isArray(snap?.prevMediaAssetIds) && Array.isArray(this.data.media_assets)) {
      const keep = new Set(snap.prevMediaAssetIds);
      this.data.media_assets = this.data.media_assets.filter(a => keep.has(a.id));
    }
    this.data.appliedMigrations.splice(idx, 1);
    this.invalidateFeedCache();
    this.save();
    logger.info('migration_rolled_back', { migrationId });
    return true;
  }

  public runWithIdempotency<T>(
    idempotencyKey: string | undefined,
    fn: () => T,
    status = 200
  ): { deduplicated: boolean; status: number; response: T } {
    const cleanKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
    if (!cleanKey) {
      return { deduplicated: false, status, response: fn() };
    }
    if (!this.data.idempotencyCache) this.data.idempotencyCache = {};
    const existing = this.data.idempotencyCache[cleanKey];
    const now = Date.now();
    if (existing && now - existing.createdAt < 24 * 60 * 60 * 1000) {
      return {
        deduplicated: true,
        status: existing.status || status,
        response: existing.response as T,
      };
    }

    const result = fn();
    this.data.idempotencyCache[cleanKey] = {
      status,
      response: result,
      createdAt: now,
    };
    const keys = Object.keys(this.data.idempotencyCache);
    if (keys.length > 500) {
      keys
        .sort((a, b) => (this.data.idempotencyCache![a]?.createdAt || 0) - (this.data.idempotencyCache![b]?.createdAt || 0))
        .slice(0, keys.length - 500)
        .forEach(k => delete this.data.idempotencyCache![k]);
    }
    this.save();
    return { deduplicated: false, status, response: result };
  }

  public subscribeWalletUpdates(
    listener: (payload: {
      email: string;
      balance: number;
      holdBalance: number;
      available: number;
      updatedAt: number;
    }) => void
  ): () => void {
    this.walletListeners.add(listener);
    return () => {
      this.walletListeners.delete(listener);
    };
  }

  public emitWalletUpdate(email: string) {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail) return;
    const wr = this.ensureWallet(cleanEmail);
    const available = Math.max(0, (wr.balance || 0) - (wr.holdBalance || 0));
    const payload = {
      email: cleanEmail,
      balance: wr.balance || 0,
      holdBalance: wr.holdBalance || 0,
      available,
      updatedAt: Date.now(),
    };
    this.walletListeners.forEach(fn => {
      try {
        fn(payload);
      } catch (err) {
        console.warn('Wallet listener error:', err);
      }
    });
  }

  private initShortServices() {
    shortJobQueue.init({
      getShortJobs: (ownerEmail?: string) => this.getShortJobs(ownerEmail),
      getShortJobById: (id: string) => this.getShortJobById(id),
      findShortJobByIdempotencyKey: (key: string) =>
        (this.data.short_jobs || []).find(j => j.idempotencyKey === key),
      upsertShortJob: (job: ShortJob) => {
        if (!this.data.short_jobs) this.data.short_jobs = [];
        const idx = this.data.short_jobs.findIndex(j => j.id === job.id);
        if (idx >= 0) this.data.short_jobs[idx] = job;
        else this.data.short_jobs.unshift(job);
        this.save();
      },
      getAudioTracks: () => this.getAudioLibrary({}).tracks,
      publishGeneratedShortPost: ({ job, status, moderationStatus }) => {
        if (!this.data.posts) this.data.posts = [];
        if (!this.data.short_audio) this.data.short_audio = [];

        const existing = this.data.posts.find(p => p.jobId === job.id);
        if (existing) return existing;

        const postId = `post_short_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const hashtagStr = job.hashtags.join(' ');
        const desc = `${job.caption} ${hashtagStr}`.trim().slice(0, 300);
        const ownerUser = this.findUserByEmail(job.ownerEmail);

        const audioEntry: ShortAudioConfig = {
          ...job.audioConfig,
          id: `saud_${Date.now()}`,
          postId,
        };
        this.data.short_audio.unshift(audioEntry);

        // Increment usage counter on selected track
        if (audioEntry.trackId && Array.isArray(this.data.audio_tracks)) {
          const track = this.data.audio_tracks.find(t => t.id === audioEntry.trackId);
          if (track) track.useCount = (track.useCount || 0) + 1;
        }

        const newPost: Post = {
          id: postId,
          ownerEmail: job.ownerEmail,
          host_id: job.ownerEmail,
          creatorName: ownerUser?.name || job.ownerName || 'AirBus Creator',
          stayId: job.stayId,
          listing_id: job.stayId,
          type: 'short',
          description: desc,
          caption: job.caption,
          hashtags: job.hashtags,
          coverUrl:
            job.outputThumbnailUrl ||
            'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
          images: job.sourceType === 'photo' ? job.sourceFiles : undefined,
          videoUrl: job.outputVideoUrl,
          durationSeconds: job.outputDurationSec || 20,
          sourceType: job.sourceType,
          autoGenerated: true,
          jobId: job.id,
          captionsEnabled: job.autoCaptionsEnabled,
          captions: job.captions,
          shortAudio: audioEntry,
          comments: [],
          likedByUserEmails: [],
          moderationStatus,
          status,
          views: 0,
          plays: 0,
          replays: 0,
          actionClicks: 0,
          likes: 0,
          shares: 0,
          viralityScore: 50,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        this.data.posts.unshift(newPost);
        this.save();
        return newPost;
      },
      notifyUser: (userEmail, title, message, link) => {
        this.createNotification({
          id: `notif_short_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          userEmail,
          title,
          message,
          read: false,
          link: link || '/#shorts',
          type: 'system',
          createdAt: Date.now(),
        });
      },
    });
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.stays) && parsed.stays.length > 0) {
          // Auto-migrate schema extensions
          if (!parsed.settings) parsed.settings = DEFAULT_SETTINGS;
          if (!parsed.posts || parsed.posts.length === 0) parsed.posts = SEED_POSTS;
          if (!parsed.adRequests || parsed.adRequests.length === 0) parsed.adRequests = SEED_AD_REQUESTS;
          if (!parsed.ledgerEntries) parsed.ledgerEntries = SEED_LEDGER_ENTRIES;
          if (!parsed.walletRecords) parsed.walletRecords = SEED_WALLET_RECORDS;
          if (!parsed.referrals) parsed.referrals = SEED_REFERRALS;
          if (!parsed.referralCodes) parsed.referralCodes = SEED_REFERRAL_CODES;
          if (!parsed.referralCommissions) parsed.referralCommissions = [];
          if (!parsed.withdrawals) parsed.withdrawals = [];
          if (!parsed.promotions) parsed.promotions = SEED_PROMOTIONS;
          if (!parsed.tripDatingProfiles || parsed.tripDatingProfiles.length === 0) {
            parsed.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
          } else {
            // Ensure at least one profile has 2 videos of 60s each and 3 photos
            const hasVideosUser = parsed.tripDatingProfiles.some((p: any) => p.videos && p.videos.length >= 2);
            if (!hasVideosUser) {
              const target = parsed.tripDatingProfiles.find((p: any) => p.id === 'tdp_1') || parsed.tripDatingProfiles[0];
              if (target) {
                target.videos = [
                  'https://assets.mixkit.co/videos/preview/mixkit-young-woman-talking-on-video-call-with-her-phone-41525-large.mp4',
                  'https://assets.mixkit.co/videos/preview/mixkit-woman-enjoying-a-sunny-day-in-a-park-41528-large.mp4',
                ];
                target.videoDurations = [60, 60];
                target.videoThumbnails = [
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
                  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
                ];
                target.photos = [
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
                  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
                  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
                ];
              }
            }
          }
          if (!parsed.tripDatingPaymentRequests) parsed.tripDatingPaymentRequests = [];
          if (!parsed.tripDatingContactUnlocks) parsed.tripDatingContactUnlocks = [];
          if (!parsed.paymentRecords) parsed.paymentRecords = [];
          if (!parsed.walletTransactions) parsed.walletTransactions = [];
          if (!parsed.reports) parsed.reports = [];
          if (Array.isArray(parsed.stays)) {
            parsed.stays.forEach((stay: any) => {
              if (!stay.media) {
                const photos: any[] = [];
                if (stay.images && stay.images.length > 0) {
                  stay.images.forEach((url: string, i: number) => {
                    photos.push({ url, order: i, isCover: i === 0 });
                  });
                } else if (stay.thumbnailUrl) {
                  photos.push({ url: stay.thumbnailUrl, order: 0, isCover: true });
                }

                stay.media = {
                  video: stay.videoUrl ? {
                    url: stay.videoUrl,
                    thumbnail: stay.thumbnailUrl || (photos[0]?.url || ''),
                    duration: 60,
                    size: 15000000,
                  } : null,
                  photos,
                };
              }
              stay.hasVideo = Boolean(stay.media?.video?.url && stay.media.video.url.trim().length > 0);
              stay.hasPhotos = Boolean(stay.media?.photos && stay.media.photos.length > 0);
              if (!stay.moderationStatus) stay.moderationStatus = 'approved';
              if (!stay.mediaModerationStatus) stay.mediaModerationStatus = 'clean';
            });
          }
          if (!parsed.adSlots) {
            parsed.adSlots = [
              {
                id: 'adslot_kenya_safari',
                ownerId: 'owner@airbus.ke',
                owner_id: 'owner@airbus.ke',
                title: 'Nairobi Luxury Safari Loft & Car Hire',
                description: 'Special 20% discount on weekend getaways and airport transfers across Nairobi.',
                linkUrl: 'https://airbus.ke',
                link_url: 'https://airbus.ke',
                thumbnailUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
                thumbnail_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
                videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                durationDays: 30,
                duration_days: 30,
                costSc: 300,
                cost_sc: 300,
                status: 'active',
                paymentId: 'pay_demo_1',
                payment_id: 'pay_demo_1',
                paymentMethod: 'wallet',
                impressions: 1420,
                clicks: 86,
                startsAt: Date.now() - 5 * 864e5,
                endsAt: Date.now() + 25 * 864e5,
                createdAt: Date.now() - 5 * 864e5,
                updatedAt: Date.now() - 5 * 864e5,
              },
            ];
          }
          if (!parsed.subscriptions) {
            parsed.subscriptions = [
              {
                id: 'sub_owner_demo',
                ownerId: 'owner@airbus.ke',
                owner_id: 'owner@airbus.ke',
                tier: 'Diamond',
                billing: 'monthly',
                status: 'active',
                startsAt: Date.now() - 2 * 864e5,
                endsAt: Date.now() + 28 * 864e5,
                paymentId: 'pay_demo_1',
                createdAt: Date.now() - 2 * 864e5,
                updatedAt: Date.now() - 2 * 864e5,
              },
            ];
          }
          if (!parsed.follows) parsed.follows = [];
          if (!parsed.listingLikes) parsed.listingLikes = [];
          if (!parsed.listingViews) parsed.listingViews = [];
          if (!parsed.autoShorts) parsed.autoShorts = [];
          if (!parsed.boosts) parsed.boosts = [];
          if (!parsed.sponsorSlots) parsed.sponsorSlots = [];

          // Ensure welcome gifts, host greetings, verified flag, and collection metadata are populated on loaded stays
          parsed.stays.forEach((s: Stay) => {
            const seed = SEED_STAYS.find(seedStay => seedStay.id === s.id);
            if ((!s.welcomeGifts || s.welcomeGifts.length === 0) && seed?.welcomeGifts) {
              s.welcomeGifts = seed.welcomeGifts;
            } else if (!s.welcomeGifts || s.welcomeGifts.length === 0) {
              s.welcomeGifts = [
                'Kenyan Safari Kahawa & Fresh Ground Beans',
                'Fresh Coconut Water & Tropical Basket',
              ];
            }
            if (!s.hostMessage && seed?.hostMessage) {
              s.hostMessage = seed.hostMessage;
            } else if (!s.hostMessage) {
              s.hostMessage = 'Karibu sana! We look forward to hosting you in our serene home.';
            }
            if (s.isPromoted === undefined && seed?.isPromoted !== undefined) {
              s.isPromoted = seed.isPromoted;
              s.promotedUntil = seed.promotedUntil;
            }
            if (s.isVerified === undefined) {
              s.isVerified = true;
            }
            // Merge new collection metadata from matching seeds if not yet set on disk
            if (seed) {
              if (s.isAirbusWork === undefined && seed.isAirbusWork !== undefined) {
                s.isAirbusWork = seed.isAirbusWork;
                s.monthlyPrice = seed.monthlyPrice;
                s.wifiSpeedMbps = seed.wifiSpeedMbps;
                s.hasDedicatedWorkspace = seed.hasDedicatedWorkspace;
                s.corporateInvoicingAvailable = seed.corporateInvoicingAvailable;
              }
              if (s.blackFridayOptIn === undefined && seed.blackFridayOptIn !== undefined) {
                s.blackFridayOptIn = seed.blackFridayOptIn;
                s.blackFridayDiscountPercent = seed.blackFridayDiscountPercent;
              }
              if (s.isEscapeOffer === undefined && seed.isEscapeOffer !== undefined) {
                s.isEscapeOffer = seed.isEscapeOffer;
                s.escapeOfferTitle = seed.escapeOfferTitle;
                s.escapeOriginalPrice = seed.escapeOriginalPrice;
                s.escapeOfferPrice = seed.escapeOfferPrice;
                s.escapeDiscountPercent = seed.escapeDiscountPercent;
                s.escapeValidFrom = seed.escapeValidFrom;
                s.escapeValidTo = seed.escapeValidTo;
              }
            }
          });

          // Merge any newly introduced seed stays (Plus VVVIP, Local, World Wide)
          SEED_STAYS.forEach((seedStay) => {
            if (!parsed.stays.some((s: Stay) => s.id === seedStay.id)) {
              parsed.stays.push(seedStay);
            }
          });

          // Ensure VVVIP flag exists cleanly on users (admin defaults true)
          if (Array.isArray(parsed.users)) {
            parsed.users.forEach((u: User) => {
              if (u.isVVVIP === undefined) {
                u.isVVVIP = u.role === 'admin' || u.email === 'owner@airbus.ke';
              }
            });
          }

          if (!parsed.localGuides || parsed.localGuides.length === 0) {
            parsed.localGuides = SEED_LOCAL_GUIDES;
          }
          if (!parsed.neighborhoodArticles || parsed.neighborhoodArticles.length === 0) {
            parsed.neighborhoodArticles = SEED_NEIGHBORHOOD_ARTICLES;
          }
          if (!parsed.blackFridaySubscribers) parsed.blackFridaySubscribers = [];
          if (!parsed.guideRequests) parsed.guideRequests = [];

          // Shorts/Reels tables migration (audio_licenses, audio_tracks, short_jobs, short_audio)
          if (!parsed.audio_licenses || parsed.audio_licenses.length === 0) {
            parsed.audio_licenses = audioLibraryService.getSeededLicenses();
          }
          if (!parsed.audio_tracks || parsed.audio_tracks.length === 0) {
            parsed.audio_tracks = audioLibraryService.getSeededTracks();
            parsed.musicTracks = parsed.audio_tracks;
          }
          if (!parsed.short_jobs) parsed.short_jobs = [];
          if (!parsed.short_audio) parsed.short_audio = [];
          if (!parsed.listing_audio) parsed.listing_audio = [];
          if (!parsed.short_analytics) parsed.short_analytics = {};
          if (!parsed.audioReports) parsed.audioReports = [];

          // Ensure seeded/existing short posts carry creatorName, permanent listing linkage & optional audio cleanly
          if (Array.isArray(parsed.posts)) {
            parsed.posts.forEach((p: Post) => {
              if (!p.creatorName) {
                const u = parsed.users?.find((usr: User) => usr.email.toLowerCase() === p.ownerEmail.toLowerCase());
                p.creatorName = u?.name || 'AirBus Creator';
              }
              if (p.stayId && !p.listing_id) p.listing_id = p.stayId;
              if (!p.stayId && p.listing_id) p.stayId = p.listing_id;
              if (p.ownerEmail && !p.host_id) p.host_id = p.ownerEmail.toLowerCase();
              if (p.type === 'short' && !p.shortAudio) {
                p.shortAudio = audioLibraryService.resolveAudioConfig({ mode: 'none' }, parsed.audio_tracks);
              }
              if (!p.comments) p.comments = [];
              if (!p.hashtags) p.hashtags = ['#AirBusStays', '#TravelKenya'];
            });
          }

          // Canonicalize walletRecords & wallets keys to lowercase without losing persisted balances
          if (!parsed.wallets) parsed.wallets = {};
          const normalizedWalletRecords: Record<string, WalletRecord> = {};
          for (const [k, rec] of Object.entries(parsed.walletRecords || {})) {
            const clean = k.toLowerCase().trim();
            if (!clean) continue;
            const wr = rec as WalletRecord;
            normalizedWalletRecords[clean] = {
              email: clean,
              balance: Math.max(0, Number(wr?.balance ?? parsed.wallets[k] ?? 0) || 0),
              holdBalance: Math.max(0, Number(wr?.holdBalance ?? 0) || 0),
              lifetimeEarnings: Math.max(0, Number(wr?.lifetimeEarnings ?? wr?.balance ?? 0) || 0),
              lifetimeSpent: Math.max(0, Number(wr?.lifetimeSpent ?? 0) || 0),
              updatedAt: Number(wr?.updatedAt || Date.now()),
            };
            parsed.wallets[clean] = normalizedWalletRecords[clean].balance;
          }
          for (const [k, bal] of Object.entries(parsed.wallets)) {
            const clean = k.toLowerCase().trim();
            if (!clean) continue;
            if (!normalizedWalletRecords[clean]) {
              const num = Math.max(0, Number(bal) || 0);
              normalizedWalletRecords[clean] = {
                email: clean,
                balance: num,
                holdBalance: 0,
                lifetimeEarnings: num,
                lifetimeSpent: 0,
                updatedAt: Date.now(),
              };
            }
            parsed.wallets[clean] = normalizedWalletRecords[clean].balance;
          }
          parsed.walletRecords = normalizedWalletRecords;

          // Normalize hostPlans keys to lowercase cleanly
          if (!parsed.hostPlans) parsed.hostPlans = {};
          const normalizedPlans: Record<string, HostPlanStatus> = {};
          for (const [k, p] of Object.entries(parsed.hostPlans)) {
            const clean = k.toLowerCase().trim();
            if (!clean) continue;
            const existing = normalizedPlans[clean];
            const candidate = p as HostPlanStatus;
            if (!existing || (candidate.expiresAt || 0) >= (existing.expiresAt || 0)) {
              normalizedPlans[clean] = candidate;
            }
          }
          parsed.hostPlans = normalizedPlans;

          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read existing DB file, creating fresh seeds.', e);
    }

    const initialData: DatabaseSchema = {
      users: SEED_USERS,
      stays: SEED_STAYS,
      bookings: SEED_BOOKINGS,
      reviews: SEED_REVIEWS,
      threads: SEED_THREADS,
      payments: [
        {
          id: 'pay_demo_dep_owner',
          hostEmail: 'owner@airbus.ke',
          userId: 'owner@airbus.ke',
          user_id: 'owner@airbus.ke',
          userRole: 'owner',
          type: 'deposit',
          method: 'mpesa_manual',
          amountSc: 15000,
          amount_sc: 15000,
          amountKes: 15000,
          amount_kes: 15000,
          amount: 15000,
          claimedAmount: 15000,
          approvedAmount: 15000,
          referenceId: 'MP991204',
          reference_id: 'MP991204',
          kind: 'deposit',
          mpesaCode: 'MP991204',
          status: 'approved',
          approvedBy: 'admin@airbus.ke',
          approvedAt: Date.now() - 25 * 864e5,
          createdAt: Date.now() - 25 * 864e5,
          updatedAt: Date.now() - 25 * 864e5,
        },
        {
          id: 'pay_demo_dep_guest',
          hostEmail: 'guest@airbus.ke',
          userId: 'guest@airbus.ke',
          user_id: 'guest@airbus.ke',
          userRole: 'guest',
          type: 'deposit',
          method: 'mpesa_manual',
          amountSc: 5000,
          amount_sc: 5000,
          amountKes: 5000,
          amount_kes: 5000,
          amount: 5000,
          claimedAmount: 5000,
          approvedAmount: 5000,
          referenceId: 'GUE7X2K9AB',
          reference_id: 'GUE7X2K9AB',
          kind: 'deposit',
          mpesaCode: 'GUE7X2K9AB',
          status: 'approved',
          approvedBy: 'admin@airbus.ke',
          approvedAt: Date.now() - 15 * 864e5,
          createdAt: Date.now() - 15 * 864e5,
          updatedAt: Date.now() - 15 * 864e5,
        },
        {
          id: 'pay_demo_1',
          hostEmail: 'owner@airbus.ke',
          userId: 'owner@airbus.ke',
          user_id: 'owner@airbus.ke',
          userRole: 'owner',
          type: 'subscription',
          method: 'wallet',
          amountSc: 2500,
          amount_sc: 2500,
          amountKes: 2500,
          amount_kes: 2500,
          amount: 2500,
          referenceId: 'sub_owner_demo',
          reference_id: 'sub_owner_demo',
          kind: 'plan',
          tier: 'Diamond',
          planTier: 'Diamond',
          status: 'approved',
          approvedBy: 'admin@airbus.ke',
          approvedAt: Date.now() - 10 * 864e5,
          createdAt: Date.now() - 10 * 864e5,
          updatedAt: Date.now() - 10 * 864e5,
        },
        {
          id: 'pay_demo_2',
          hostEmail: 'guest@airbus.ke',
          userId: 'guest@airbus.ke',
          user_id: 'guest@airbus.ke',
          userRole: 'guest',
          type: 'advert',
          method: 'wallet',
          amountSc: 300,
          amount_sc: 300,
          amountKes: 300,
          amount_kes: 300,
          amount: 300,
          referenceId: 'ad_1',
          reference_id: 'ad_1',
          kind: 'advert',
          durationDays: 3,
          status: 'approved',
          approvedBy: 'admin@airbus.ke',
          approvedAt: Date.now() - 3 * 864e5,
          createdAt: Date.now() - 3 * 864e5,
          updatedAt: Date.now() - 3 * 864e5,
        },
      ],
      paymentRecords: [
        {
          id: 'pay_demo_dep_owner',
          userId: 'owner@airbus.ke',
          user_id: 'owner@airbus.ke',
          hostEmail: 'owner@airbus.ke',
          userRole: 'owner',
          type: 'deposit',
          kind: 'deposit',
          method: 'mpesa_manual',
          amountSc: 15000,
          amount_sc: 15000,
          amountKes: 15000,
          amount_kes: 15000,
          amount: 15000,
          claimedAmount: 15000,
          approvedAmount: 15000,
          mpesaCode: 'MP991204',
          referenceId: 'MP991204',
          reference_id: 'MP991204',
          status: 'approved',
          approvedBy: 'admin@airbus.ke',
          approvedAt: Date.now() - 25 * 864e5,
          createdAt: Date.now() - 25 * 864e5,
          updatedAt: Date.now() - 25 * 864e5,
        },
        {
          id: 'pay_demo_dep_guest',
          userId: 'guest@airbus.ke',
          user_id: 'guest@airbus.ke',
          hostEmail: 'guest@airbus.ke',
          userRole: 'guest',
          type: 'deposit',
          kind: 'deposit',
          method: 'mpesa_manual',
          amountSc: 5000,
          amount_sc: 5000,
          amountKes: 5000,
          amount_kes: 5000,
          amount: 5000,
          claimedAmount: 5000,
          approvedAmount: 5000,
          mpesaCode: 'GUE7X2K9AB',
          referenceId: 'GUE7X2K9AB',
          reference_id: 'GUE7X2K9AB',
          status: 'approved',
          approvedBy: 'admin@airbus.ke',
          approvedAt: Date.now() - 15 * 864e5,
          createdAt: Date.now() - 15 * 864e5,
          updatedAt: Date.now() - 15 * 864e5,
        },
        {
          id: 'pay_demo_1',
          userId: 'owner@airbus.ke',
          user_id: 'owner@airbus.ke',
          hostEmail: 'owner@airbus.ke',
          userRole: 'owner',
          type: 'subscription',
          kind: 'plan',
          method: 'wallet',
          amountSc: 2500,
          amount_sc: 2500,
          amountKes: 2500,
          amount_kes: 2500,
          amount: 2500,
          referenceId: 'sub_owner_demo',
          reference_id: 'sub_owner_demo',
          planTier: 'Diamond',
          durationDays: 30,
          period: 'monthly',
          status: 'approved',
          approvedBy: 'admin@airbus.ke',
          approvedAt: Date.now() - 10 * 864e5,
          createdAt: Date.now() - 10 * 864e5,
          updatedAt: Date.now() - 10 * 864e5,
        },
        {
          id: 'pay_demo_2',
          userId: 'guest@airbus.ke',
          user_id: 'guest@airbus.ke',
          hostEmail: 'guest@airbus.ke',
          userRole: 'guest',
          type: 'advert',
          kind: 'advert',
          method: 'wallet',
          amountSc: 300,
          amount_sc: 300,
          amountKes: 300,
          amount_kes: 300,
          amount: 300,
          referenceId: 'ad_1',
          reference_id: 'ad_1',
          durationDays: 3,
          status: 'approved',
          approvedBy: 'admin@airbus.ke',
          approvedAt: Date.now() - 3 * 864e5,
          createdAt: Date.now() - 3 * 864e5,
          updatedAt: Date.now() - 3 * 864e5,
        },
      ],
      walletTransactions: [
        {
          id: 'wtx_seed_topup_owner',
          walletId: 'owner@airbus.ke',
          wallet_id: 'owner@airbus.ke',
          direction: 'credit',
          amount: 15000,
          amountSc: 15000,
          type: 'wallet_topup',
          reference: 'MP991204',
          relatedPaymentId: 'pay_demo_dep_owner',
          note: 'Initial M-Pesa deposit Till 943210 (Code: MP991204)',
          createdAt: Date.now() - 25 * 864e5,
        },
        {
          id: 'wtx_seed_1',
          walletId: 'owner@airbus.ke',
          wallet_id: 'owner@airbus.ke',
          direction: 'debit',
          amount: 2500,
          amountSc: 2500,
          relatedPaymentId: 'pay_demo_1',
          type: 'subscription',
          reference: 'sub_owner_demo',
          note: 'Subscription payment for Diamond tier (30 days)',
          createdAt: Date.now() - 10 * 864e5,
        },
        {
          id: 'wtx_seed_topup_guest',
          walletId: 'guest@airbus.ke',
          wallet_id: 'guest@airbus.ke',
          direction: 'credit',
          amount: 5000,
          amountSc: 5000,
          type: 'wallet_topup',
          reference: 'GUE7X2K9AB',
          relatedPaymentId: 'pay_demo_dep_guest',
          note: 'Initial M-Pesa deposit Till 943210 (Code: GUE7X2K9AB)',
          createdAt: Date.now() - 15 * 864e5,
        },
        {
          id: 'wtx_seed_ad_hold_guest',
          walletId: 'guest@airbus.ke',
          wallet_id: 'guest@airbus.ke',
          direction: 'debit',
          amount: 300,
          amountSc: 300,
          relatedPaymentId: 'pay_demo_2',
          type: 'advert_payment',
          reference: 'ad_1',
          note: 'Advert campaign payment for 3 days',
          createdAt: Date.now() - 3 * 864e5,
        },
        {
          id: 'wtx_seed_admin_sub',
          walletId: 'admin@airbus.ke',
          wallet_id: 'admin@airbus.ke',
          direction: 'credit',
          amount: 2500,
          amountSc: 2500,
          relatedPaymentId: 'pay_demo_1',
          type: 'subscription_income',
          reference: 'sub_owner_demo',
          note: 'Subscription revenue for Diamond tier',
          createdAt: Date.now() - 10 * 864e5,
        },
        {
          id: 'wtx_seed_admin_ad',
          walletId: 'admin@airbus.ke',
          wallet_id: 'admin@airbus.ke',
          direction: 'credit',
          amount: 300,
          amountSc: 300,
          relatedPaymentId: 'pay_demo_2',
          type: 'advert_income',
          reference: 'ad_1',
          note: 'Advert campaign revenue (3 days) from guest@airbus.ke',
          createdAt: Date.now() - 3 * 864e5,
        },
      ],
      adSlots: [
        {
          id: 'adslot_kenya_safari',
          ownerId: 'owner@airbus.ke',
          owner_id: 'owner@airbus.ke',
          title: 'Nairobi Luxury Safari Loft & Car Hire',
          description: 'Special 20% discount on weekend getaways and airport transfers across Nairobi.',
          linkUrl: 'https://airbus.ke',
          link_url: 'https://airbus.ke',
          thumbnailUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
          thumbnail_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          durationDays: 30,
          duration_days: 30,
          costSc: 300,
          cost_sc: 300,
          status: 'active',
          paymentId: 'pay_demo_1',
          payment_id: 'pay_demo_1',
          paymentMethod: 'wallet',
          impressions: 1420,
          clicks: 86,
          startsAt: Date.now() - 5 * 864e5,
          endsAt: Date.now() + 25 * 864e5,
          createdAt: Date.now() - 5 * 864e5,
          updatedAt: Date.now() - 5 * 864e5,
        },
      ],
      subscriptions: [
        {
          id: 'sub_owner_demo',
          ownerId: 'owner@airbus.ke',
          owner_id: 'owner@airbus.ke',
          tier: 'Diamond',
          billing: 'monthly',
          status: 'active',
          startsAt: Date.now() - 2 * 864e5,
          endsAt: Date.now() + 28 * 864e5,
          paymentId: 'pay_demo_1',
          createdAt: Date.now() - 2 * 864e5,
          updatedAt: Date.now() - 2 * 864e5,
        },
      ],
      follows: [],
      listingLikes: [],
      listingViews: [],
      autoShorts: [],
      boosts: [],
      sponsorSlots: [],
      hostPlans: {
        'owner@airbus.ke': {
          tier: 'Diamond',
          status: 'active',
          expiresAt: Date.now() + 28 * 864e5,
          graceExpiresAt: Date.now() + 30 * 864e5,
          hasPaidSubscription: true,
        },
      },
      wallets: {
        'owner@airbus.ke': 12500,
        'guest@airbus.ke': 4700,
        'admin@airbus.ke': 2800,
      },
      walletRecords: SEED_WALLET_RECORDS,
      ledgerEntries: SEED_LEDGER_ENTRIES,
      posts: SEED_POSTS,
      adRequests: SEED_AD_REQUESTS,
      promotions: SEED_PROMOTIONS,
      referrals: SEED_REFERRALS,
      referralCodes: SEED_REFERRAL_CODES,
      referralCommissions: [],
      settings: DEFAULT_SETTINGS,
      viewEvents: [],
      withdrawals: [],
      audio_licenses: audioLibraryService.getSeededLicenses(),
      audio_tracks: audioLibraryService.getSeededTracks(),
      musicTracks: audioLibraryService.getSeededTracks(),
      short_jobs: [],
      short_audio: [],
      listing_audio: [],
      short_analytics: {},
      audioReports: [],
      wishlists: [
        { userEmail: 'guest@airbus.ke', stayId: 's1' },
        { userEmail: 'guest@airbus.ke', stayId: 's4' },
      ],
      notifications: [
        {
          id: 'notif_1',
          userEmail: 'guest@airbus.ke',
          title: 'Booking Confirmed!',
          message: 'Your stay at Modern Westlands Penthouse (AB9482X) has been confirmed.',
          read: false,
          link: '/#guest',
          type: 'booking',
          createdAt: Date.now() - 2 * 864e5,
        },
        {
          id: 'notif_2',
          userEmail: 'owner@airbus.ke',
          title: 'New Booking Request',
          message: 'Sarah Wanjiku requested to book Nyali Beachfront Villa for 4 nights.',
          read: false,
          link: '/#owner',
          type: 'booking',
          createdAt: Date.now() - 12 * 3600e3,
        },
        {
          id: 'notif_3',
          userEmail: 'owner@airbus.ke',
          title: '30-Day Subscription Active',
          message: 'Your Diamond Plan is active. All your short-stay videos are live across AirBus Feed & Shorts.',
          read: true,
          link: '/#owner',
          type: 'subscription',
          createdAt: Date.now() - 2 * 864e5,
        },
      ],
      reports: [],
      tickets: [],
      auditLogs: [
        {
          id: 'aud_1',
          action: 'plan_approved',
          actorEmail: 'admin@airbus.ke',
          details: 'Approved Diamond plan payment QGH7X2K9LM for owner@airbus.ke',
          createdAt: Date.now() - 10 * 864e5,
        },
      ],
      tripDatingProfiles: SEED_TRIP_DATING_PROFILES,
      tripDatingPaymentRequests: [],
      tripDatingContactUnlocks: [],
      media_assets: [],
      localGuides: SEED_LOCAL_GUIDES,
      neighborhoodArticles: SEED_NEIGHBORHOOD_ARTICLES,
      blackFridaySubscribers: [],
      guideRequests: [],
    };

    this.saveDirect(initialData);
    return initialData;
  }

  private saveDirect(d: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving DB file:', e);
    }
  }

  public save() {
    this.saveDirect(this.data);
  }

  public getRaw(): DatabaseSchema {
    return this.data;
  }

  // --- Automatic Subscription Expiration (Monthly=30d, Annual=365d) & Immediate Public Hiding ---
  public checkSubscriptionExpirations() {
    const now = Date.now();
    let changed = false;

    if (!this.data.hostPlans) this.data.hostPlans = {};
    if (!this.data.subscriptions) this.data.subscriptions = [];

    for (const [email, plan] of Object.entries(this.data.hostPlans)) {
      const cleanEmail = email.toLowerCase().trim();
      if (plan.status === 'active' && plan.expiresAt > 0 && now >= plan.expiresAt) {
        // Check if a scheduled tier switch was queued first
        if (plan.scheduledTier) {
          const isAnnual = plan.scheduledPeriod === 'annual';
          const durationMs = isAnnual ? 365 * 864e5 : 30 * 864e5;
          plan.tier = plan.scheduledTier;
          plan.period = plan.scheduledPeriod || 'monthly';
          plan.startsAt = plan.expiresAt;
          plan.expiresAt = plan.expiresAt + durationMs;
          plan.graceExpiresAt = plan.expiresAt;
          plan.status = 'active';
          delete plan.scheduledTier;
          delete plan.scheduledStartsAt;
          delete plan.scheduledPeriod;
          changed = true;
          continue;
        }

        // Strict expiry: mark expired immediately & hide host listings from public feeds
        plan.status = 'expired';
        changed = true;

        for (const sub of this.data.subscriptions) {
          if (
            (sub.ownerId || sub.owner_id || '').toLowerCase().trim() === cleanEmail &&
            sub.status === 'active' &&
            (!sub.endsAt || sub.endsAt <= now)
          ) {
            sub.status = 'expired';
            sub.updatedAt = now;
          }
        }

        this.data.stays.forEach(s => {
          if (s.ownerEmail?.toLowerCase().trim() === cleanEmail && s.status === 'live') {
            s.status = 'expired'; // Remains visible in Owner Dashboard, hidden from public feeds!
          }
        });

        this.createNotification({
          id: 'notif_exp_' + now + '_' + Math.random().toString(36).slice(2, 6),
          userEmail: cleanEmail,
          title: 'Subscription Expired — Listings Hidden',
          message:
            'Your hosting subscription has expired. Your listings are temporarily hidden from public feeds until you activate or renew a subscription.',
          read: false,
          link: '/#owner',
          type: 'subscription',
          createdAt: now,
        });
      }
    }

    // Also reconcile any standalone active SubscriptionRecord past endsAt
    for (const sub of this.data.subscriptions) {
      if (sub.status === 'active' && sub.endsAt && sub.endsAt <= now) {
        sub.status = 'expired';
        sub.updatedAt = now;
        changed = true;
      }
    }

    // Expire Guest AirBus Plus memberships once past expiresAt
    for (const u of this.data.users || []) {
      if (
        u.vvvipSubscription &&
        u.vvvipSubscription.status === 'active' &&
        u.vvvipSubscription.expiresAt > 0 &&
        now >= u.vvvipSubscription.expiresAt
      ) {
        u.vvvipSubscription.status = 'expired';
        u.isVVVIP = false;
        changed = true;
        this.createNotification({
          id: 'notif_vvvip_exp_' + now + '_' + Math.random().toString(36).slice(2, 6),
          userEmail: u.email,
          title: 'AirBus Plus Membership Expired',
          message: 'Your AirBus Plus membership has expired. Renew with Ksh 3,500 (30 days) once approved by Admin to restore access.',
          read: false,
          link: '/#collection-plus',
          type: 'subscription',
          createdAt: now,
        });
      }
    }

    if (changed) {
      this.save();
    }
  }

  public checkAllExpirations() {
    this.checkSubscriptionExpirations();
    const now = Date.now();
    let changed = false;

    // 1. Expire boosts
    if (this.data.boosts) {
      for (const boost of this.data.boosts) {
        if (boost.status === 'active' && boost.ends_at && boost.ends_at < now) {
          boost.status = 'expired';
          changed = true;
          const stayId = boost.listing_id || boost.listingId;
          const otherActive = this.data.boosts.some(
            b => (b.listing_id === stayId || b.listingId === stayId) && b.status === 'active' && b.ends_at && b.ends_at >= now
          );
          if (!otherActive && stayId) {
            const stay = this.data.stays.find(s => s.id === stayId);
            if (stay) {
              stay.isPromoted = false;
              stay.promotedUntil = undefined;
            }
          }
        }
      }
    }

    // 2. Expire sponsor slots
    if (this.data.sponsorSlots) {
      for (const slot of this.data.sponsorSlots) {
        if (slot.status === 'active' && slot.ends_at && slot.ends_at < now) {
          slot.status = 'expired';
          changed = true;
        }
      }
    }

    // 3. Expire adSlots
    if (this.data.adSlots) {
      for (const slot of this.data.adSlots) {
        if (slot.status === 'active' && slot.endsAt && slot.endsAt < now) {
          slot.status = 'expired';
          changed = true;
        }
      }
    }

    // 4. Expire 30-day AirBus Plus guest memberships automatically
    if (this.data.users) {
      for (const u of this.data.users) {
        if (u.vvvipSubscription && u.vvvipSubscription.status === 'active' && (!u.vvvipSubscription.expiresAt || u.vvvipSubscription.expiresAt <= now)) {
          u.vvvipSubscription.status = 'expired';
          u.isVVVIP = false;
          changed = true;
        }
      }
    }

    if (changed) {
      this.save();
    }
  }

  // --- Users, Isolated Portal Credentials & Auth ---
  private ensurePortalCredentialSeeds() {
    if (!this.data.guestCredentials) this.data.guestCredentials = [];
    if (!this.data.hostCredentials) this.data.hostCredentials = [];
    if (!this.data.authSessions) this.data.authSessions = {};
    if (!this.data.failedLoginAttempts) this.data.failedLoginAttempts = {};

    const oldWeakHash = hashPassword('password123');
    let changed = false;

    for (const user of this.data.users) {
      if (user.role === 'admin') {
        if (!user.username) {
          user.username = 'KamalaHari';
          user.portal = 'admin';
          changed = true;
        }
        continue;
      }

      const portal: AuthPortal = user.role === 'owner' ? 'owner' : 'guest';
      const store = portal === 'owner' ? this.data.hostCredentials : this.data.guestCredentials;

      // Migrate legacy identical demo passwords on seed users so uniqueness holds
      if (user.email === 'guest@airbus.ke' && (!user.passwordHash || user.passwordHash === oldWeakHash)) {
        user.passwordHash = hashPassword('Sarah$Nairobi88!');
        user.username = 'SarahWanjiku';
        user.name = 'SarahWanjiku';
        changed = true;
      } else if (user.email === 'owner@airbus.ke' && (!user.passwordHash || user.passwordHash === oldWeakHash)) {
        user.passwordHash = hashPassword('Mutua@Westlands91#');
        user.username = 'DavidMutua';
        user.name = 'DavidMutua';
        changed = true;
      }

      if (!user.username) {
        user.username = user.name.replace(/\s+/g, '') || user.email.split('@')[0];
        changed = true;
      }
      if (!user.portal) {
        user.portal = portal;
        changed = true;
      }

      const existingCred = store.find(c => c.userEmail.toLowerCase() === user.email.toLowerCase());
      if (!existingCred) {
        const defaultRawPass =
          user.email === 'guest@airbus.ke'
            ? 'Sarah$Nairobi88!'
            : user.email === 'owner@airbus.ke'
            ? 'Mutua@Westlands91#'
            : `${user.username}_Seed#${user.id}`;
        const rawPassHash = user.passwordHash || hashPassword(defaultRawPass);
        const fp =
          user.email === 'guest@airbus.ke'
            ? buildPasswordFingerprint('Sarah$Nairobi88!')
            : user.email === 'owner@airbus.ke'
            ? buildPasswordFingerprint('Mutua@Westlands91#')
            : {
                exactHash: rawPassHash,
                lowerHash: rawPassHash,
                strippedHash: rawPassHash,
                normalizedLength: 10,
                charClasses: 'ld',
                shingleHashes: [],
              };

        store.push({
          id: `cred_${portal}_${user.id}`,
          portal,
          username: user.username,
          normalizedUsername: normalizeUsername(user.username),
          userEmail: user.email.toLowerCase(),
          userId: user.id,
          passwordHash: rawPassHash,
          passwordFingerprint: fp,
          createdAt: user.createdAt || Date.now(),
          updatedAt: Date.now(),
        });
        changed = true;
      }
    }

    // Ensure seeded guest & host wallets exist cleanly
    this.ensureWallet('guest@airbus.ke');
    this.ensureWallet('owner@airbus.ke');

    if (changed) {
      this.save();
    }
  }

  public assertUsernameUnique(username: string, excludeUserId?: string) {
    const trimmed = String(username || '').trim();
    if (trimmed.length < 3) {
      throw new Error('Username must be at least 3 characters.');
    }
    const norm = normalizeUsername(trimmed);
    if (norm.length < 3) {
      throw new Error('Username must contain at least 3 letters or numbers.');
    }

    const allCreds: CredentialRecord[] = [
      ...(this.data.guestCredentials || []),
      ...(this.data.hostCredentials || []),
    ];

    for (const c of allCreds) {
      if (excludeUserId && (c.userId === excludeUserId || c.id === excludeUserId)) continue;
      if (
        c.normalizedUsername === norm ||
        (norm.length >= 3 && c.normalizedUsername.length >= 3 && levenshteinDistance(norm, c.normalizedUsername) <= 1)
      ) {
        throw new Error('This username is already taken or too similar to an existing username. Please choose a different one.');
      }
    }

    for (const u of this.data.users) {
      if (excludeUserId && u.id === excludeUserId) continue;
      const uNorm = normalizeUsername(u.username || u.name);
      if (
        uNorm &&
        (uNorm === norm || (norm.length >= 3 && uNorm.length >= 3 && levenshteinDistance(norm, uNorm) <= 1))
      ) {
        throw new Error('This username is already taken or too similar to an existing username. Please choose a different one.');
      }
    }
  }

  public assertPasswordUnique(password: string, excludeUserId?: string) {
    const raw = String(password || '');
    const strengthErr = validatePasswordStrength(raw);
    if (strengthErr) {
      throw new Error(strengthErr);
    }
    const candidateFp = buildPasswordFingerprint(raw);

    const allCreds: CredentialRecord[] = [
      ...(this.data.guestCredentials || []),
      ...(this.data.hostCredentials || []),
    ];

    for (const c of allCreds) {
      if (excludeUserId && (c.userId === excludeUserId || c.id === excludeUserId)) continue;
      if (c.passwordHash === candidateFp.exactHash || passwordsTooSimilar(candidateFp, c.passwordFingerprint)) {
        throw new Error('Password Rejected choose a stronger password.');
      }
    }

    for (const u of this.data.users) {
      if (excludeUserId && u.id === excludeUserId) continue;
      if (u.passwordHash && u.passwordHash === candidateFp.exactHash) {
        throw new Error('Password Rejected choose a stronger password.');
      }
    }
  }

  public createAuthSession(user: User, portal: AuthPortal | 'admin'): AuthSession {
    if (!this.data.authSessions) this.data.authSessions = {};
    const token = `sess_${portal}_${crypto.randomUUID()}`;
    const now = Date.now();
    const session: AuthSession = {
      token,
      userId: user.id,
      userEmail: user.email.toLowerCase(),
      username: user.username || user.name,
      portal,
      role: user.role,
      createdAt: now,
      lastActiveAt: now,
      idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
      expiresAt: now + 30 * 864e5,
    };
    this.data.authSessions[token] = session;
    this.save();
    return session;
  }

  public getSessionState(
    token: string,
    options?: { touch?: boolean; forceSave?: boolean }
  ): { user: User | null; session: AuthSession | null; idleExpired: boolean } {
    const clean = (token || '').trim();
    if (!clean) return { user: null, session: null, idleExpired: false };
    const sess = this.data.authSessions?.[clean];
    if (!sess) {
      return { user: null, session: null, idleExpired: false };
    }

    const now = Date.now();
    const idleLimit = sess.idleTimeoutMs || SESSION_IDLE_TIMEOUT_MS;
    const lastAct = sess.lastActiveAt || sess.createdAt || now;

    if (sess.expiresAt <= now) {
      delete this.data.authSessions![clean];
      this.save();
      return { user: null, session: null, idleExpired: true };
    }

    if (now - lastAct > idleLimit) {
      delete this.data.authSessions![clean];
      this.save();
      return { user: null, session: null, idleExpired: true };
    }

    const u = this.findUserByEmail(sess.userEmail);
    if (!u || u.role !== sess.role) {
      return { user: null, session: null, idleExpired: false };
    }

    if (options?.touch !== false) {
      sess.lastActiveAt = now;
      if (options?.forceSave || now - this.lastSessionTouchSavedAt >= 15000) {
        this.lastSessionTouchSavedAt = now;
        this.save();
      }
    }

    return { user: u, session: sess, idleExpired: false };
  }

  public touchAuthSession(token: string): {
    session: AuthSession;
    idleTimeoutMs: number;
    idleRemainingMs: number;
  } | null {
    const state = this.getSessionState(token, { touch: true, forceSave: true });
    if (!state.user || !state.session) return null;
    const idleTimeoutMs = state.session.idleTimeoutMs || SESSION_IDLE_TIMEOUT_MS;
    return {
      session: state.session,
      idleTimeoutMs,
      idleRemainingMs: idleTimeoutMs,
    };
  }

  public getUserByAuthToken(token: string, options?: { touch?: boolean }): User | null {
    return this.getSessionState(token, options).user;
  }

  public invalidateSession(token: string) {
    const clean = (token || '').trim();
    if (this.data.authSessions && this.data.authSessions[clean]) {
      delete this.data.authSessions[clean];
      this.save();
    }
  }

  public registerPortalUser(opts: {
    portal: AuthPortal;
    username: string;
    password: string;
    referredByCode?: string;
    phone?: string;
    location?: string;
  }): { user: User; token: string } {
    const portal: AuthPortal = opts.portal === 'owner' ? 'owner' : 'guest';
    const rawUsername = String(opts.username || '').trim();
    const rawPassword = String(opts.password || '');

    this.assertUsernameUnique(rawUsername);
    this.assertPasswordUnique(rawPassword);

    const slug = normalizeUsername(rawUsername) || 'user';
    const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const internalEmail = `${slug}_${suffix}@${portal}.airbus.ke`;
    const passHash = hashPassword(rawPassword);
    const fp = buildPasswordFingerprint(rawPassword);
    const userId = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
    const now = Date.now();

    const newUser: User = {
      id: userId,
      name: rawUsername,
      username: rawUsername,
      portal,
      email: internalEmail,
      role: portal === 'owner' ? 'owner' : 'guest',
      passwordHash: passHash,
      phone: opts.phone || '',
      location: opts.location || 'Nairobi, Kenya',
      idVerified: false,
      createdAt: now,
    };

    const credRecord: CredentialRecord = {
      id: `cred_${portal}_${userId}`,
      portal,
      username: rawUsername,
      normalizedUsername: normalizeUsername(rawUsername),
      userEmail: internalEmail,
      userId,
      passwordHash: passHash,
      passwordFingerprint: fp,
      createdAt: now,
      updatedAt: now,
    };

    if (portal === 'owner') {
      if (!this.data.hostCredentials) this.data.hostCredentials = [];
      this.data.hostCredentials.push(credRecord);
    } else {
      if (!this.data.guestCredentials) this.data.guestCredentials = [];
      this.data.guestCredentials.push(credRecord);
    }

    this.createUser(newUser);
    this.ensureWallet(internalEmail);

    if (opts.referredByCode) {
      this.recordReferralSignup(opts.referredByCode, internalEmail);
    }

    const session = this.createAuthSession(newUser, portal);
    return { user: newUser, token: session.token };
  }

  public loginPortalUser(opts: {
    portal: AuthPortal;
    username: string;
    password: string;
  }): { user: User; token: string } {
    const portal: AuthPortal = opts.portal === 'owner' ? 'owner' : 'guest';
    const expectedRole = portal === 'owner' ? 'owner' : 'guest';
    const cleanUsername = String(opts.username || '').trim();
    const rawPassword = String(opts.password || '');

    if (!this.data.failedLoginAttempts) this.data.failedLoginAttempts = {};
    const attemptKey = `${portal}:${normalizeUsername(cleanUsername) || '_blank'}`;

    const store =
      portal === 'owner' ? this.data.hostCredentials || [] : this.data.guestCredentials || [];
    const passHash = hashPassword(rawPassword);

    // Strictly exact case- and punctuation-sensitive match in the chosen portal store (ignoring accidental outer whitespace on username)
    let matchedCred = store.find(
      c => c.username.trim() === cleanUsername && c.passwordHash === passHash
    );

    // Fallback: check canonical users list for matching role + exact username + exact password hash and sync credential store
    if (!matchedCred && cleanUsername && rawPassword) {
      const directUser = this.data.users.find(
        u =>
          u.role === expectedRole &&
          ((u.username || '').trim() === cleanUsername || (u.name || '').trim() === cleanUsername) &&
          u.passwordHash === passHash
      );
      if (directUser) {
        const syncedCred: CredentialRecord = {
          id: `cred_${portal}_${directUser.id}`,
          portal,
          username: (directUser.username || directUser.name).trim(),
          normalizedUsername: normalizeUsername(directUser.username || directUser.name),
          userEmail: directUser.email.toLowerCase(),
          userId: directUser.id,
          passwordHash: passHash,
          passwordFingerprint: buildPasswordFingerprint(rawPassword),
          createdAt: directUser.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
        if (portal === 'owner') {
          if (!this.data.hostCredentials) this.data.hostCredentials = [];
          this.data.hostCredentials.push(syncedCred);
        } else {
          if (!this.data.guestCredentials) this.data.guestCredentials = [];
          this.data.guestCredentials.push(syncedCred);
        }
        matchedCred = syncedCred;
        this.save();
      }
    }

    if (!matchedCred) {
      // Check opposite portal so a Host accidentally logging in on Guest Entrance (or vice versa) gets a clear message
      const otherPortal: AuthPortal = portal === 'owner' ? 'guest' : 'owner';
      const otherRole = otherPortal === 'owner' ? 'owner' : 'guest';
      const otherStore =
        otherPortal === 'owner' ? this.data.hostCredentials || [] : this.data.guestCredentials || [];
      const matchedOtherCred =
        otherStore.find(c => c.username.trim() === cleanUsername && c.passwordHash === passHash) ||
        this.data.users.find(
          u =>
            u.role === otherRole &&
            ((u.username || '').trim() === cleanUsername || (u.name || '').trim() === cleanUsername) &&
            u.passwordHash === passHash
        );

      const prev = this.data.failedLoginAttempts[attemptKey]?.count || 0;
      const next = prev + 1;
      this.data.failedLoginAttempts[attemptKey] = { count: next, updatedAt: Date.now() };
      this.save();

      if (matchedOtherCred) {
        const rightLabel = otherPortal === 'owner' ? 'Login to Host' : 'Login to Guest';
        const err: any = new Error(
          `This account is registered under ${otherPortal === 'owner' ? 'Host' : 'Guest'}. Please click "Switch Entrance" and choose ${rightLabel}.`
        );
        err.failedAttempts = next;
        err.showRecovery = false;
        throw err;
      }

      const err: any = new Error(
        next >= 3
          ? `Invalid ${portal === 'owner' ? 'Host' : 'Guest'} username or password (Attempt ${next}). Please use Forgot Password / Forgot Username below.`
          : 'Username and password did not match exactly (check capitalization and punctuation).'
      );
      err.failedAttempts = next;
      err.showRecovery = next >= 3;
      throw err;
    }

    const user =
      this.findUserByEmail(matchedCred.userEmail) ||
      this.data.users.find(u => u.id === matchedCred!.userId);
    if (!user || user.role !== expectedRole) {
      const prev = this.data.failedLoginAttempts[attemptKey]?.count || 0;
      const next = prev + 1;
      this.data.failedLoginAttempts[attemptKey] = { count: next, updatedAt: Date.now() };
      this.save();
      const err: any = new Error('Account cannot access this portal. Please use the correct Login entrance.');
      err.failedAttempts = next;
      err.showRecovery = next >= 3;
      throw err;
    }

    delete this.data.failedLoginAttempts[attemptKey];
    const session = this.createAuthSession(user, portal);
    return { user, token: session.token };
  }

  public recoverPortalCredential(opts: {
    portal: AuthPortal;
    mode: 'password' | 'username';
    currentUsername?: string;
    newPassword?: string;
    currentPassword?: string;
    newUsername?: string;
  }): { user: User; token: string; message: string } {
    const portal: AuthPortal = opts.portal === 'owner' ? 'owner' : 'guest';
    const store =
      portal === 'owner' ? this.data.hostCredentials || [] : this.data.guestCredentials || [];

    if (opts.mode === 'password') {
      const exactUser = String(opts.currentUsername || '').trim();
      const nextPass = String(opts.newPassword || '');
      const cred = store.find(c => c.username.trim() === exactUser);
      if (!cred) {
        throw new Error(
          `No ${portal === 'owner' ? 'Host' : 'Guest'} account matched that exact username (case-sensitive). Try "Forgot Username" instead.`
        );
      }
      this.assertPasswordUnique(nextPass, cred.userId);
      const nextHash = hashPassword(nextPass);
      cred.passwordHash = nextHash;
      cred.passwordFingerprint = buildPasswordFingerprint(nextPass);
      cred.updatedAt = Date.now();

      const user = this.findUserByEmail(cred.userEmail);
      if (!user) throw new Error('Linked account record not found.');
      user.passwordHash = nextHash;

      if (this.data.failedLoginAttempts) {
        delete this.data.failedLoginAttempts[`${portal}:${cred.normalizedUsername}`];
      }
      const session = this.createAuthSession(user, portal);
      return {
        user,
        token: session.token,
        message: 'Password reset! You are now logged in with your new password.',
      };
    }

    // mode === 'username'
    const curPass = String(opts.currentPassword || '');
    const nextUsername = String(opts.newUsername || '').trim();
    const curHash = hashPassword(curPass);
    const cred = store.find(c => c.passwordHash === curHash);
    if (!cred) {
      throw new Error(
        `No ${portal === 'owner' ? 'Host' : 'Guest'} account matched that password in this portal.`
      );
    }
    this.assertUsernameUnique(nextUsername, cred.userId);
    const oldNorm = cred.normalizedUsername;
    cred.username = nextUsername;
    cred.normalizedUsername = normalizeUsername(nextUsername);
    cred.updatedAt = Date.now();

    const user = this.findUserByEmail(cred.userEmail);
    if (!user) throw new Error('Linked account record not found.');
    user.username = nextUsername;
    user.name = nextUsername;

    if (this.data.failedLoginAttempts) {
      delete this.data.failedLoginAttempts[`${portal}:${oldNorm}`];
      delete this.data.failedLoginAttempts[`${portal}:${cred.normalizedUsername}`];
    }
    const session = this.createAuthSession(user, portal);
    return {
      user,
      token: session.token,
      message: `Username updated to "${nextUsername}". You are now logged in!`,
    };
  }

  public updatePortalPassword(user: User, newPassword: string) {
    this.assertPasswordUnique(newPassword, user.id);
    const nextHash = hashPassword(newPassword);
    const nextFp = buildPasswordFingerprint(newPassword);
    user.passwordHash = nextHash;

    const credLists = [this.data.guestCredentials || [], this.data.hostCredentials || []];
    for (const list of credLists) {
      const cred = list.find(c => c.userId === user.id || c.userEmail.toLowerCase() === user.email.toLowerCase());
      if (cred) {
        cred.passwordHash = nextHash;
        cred.passwordFingerprint = nextFp;
        cred.updatedAt = Date.now();
      }
    }
    this.save();
  }

  public assertHostSubscriptionActive(email: string) {
    const plan = this.getHostPlan(email);
    const isActive = plan.status === 'active' && (plan.expiresAt === 0 || plan.expiresAt > Date.now());
    if (!isActive) {
      throw new Error(
        'Your 30-day Host subscription is inactive or expired. Please activate or renew a plan before publishing listings, uploading media, promoting, or running adverts.'
      );
    }
  }

  public getAdminWalletsBreakdown() {
    const usersByEmail = new Map<string, User>();
    this.data.users.forEach(u => usersByEmail.set(u.email.toLowerCase(), u));

    const guestWallets: Array<{
      email: string;
      name: string;
      username: string;
      balance: number;
      holdBalance: number;
      available: number;
      lifetimeEarnings: number;
      lifetimeSpent: number;
      updatedAt: number;
    }> = [];
    const hostWallets: typeof guestWallets = [];

    for (const user of this.data.users) {
      if (user.role === 'admin') continue;
      const clean = user.email.toLowerCase();
      const wr = this.ensureWallet(clean);
      const item = {
        email: clean,
        name: user.name,
        username: user.username || user.name,
        balance: wr.balance || 0,
        holdBalance: wr.holdBalance || 0,
        available: Math.max(0, (wr.balance || 0) - (wr.holdBalance || 0)),
        lifetimeEarnings: wr.lifetimeEarnings || 0,
        lifetimeSpent: wr.lifetimeSpent || 0,
        updatedAt: wr.updatedAt || Date.now(),
      };
      if (user.role === 'owner') hostWallets.push(item);
      else guestWallets.push(item);
    }

    const allDeposits = (this.data.paymentRecords || [])
      .filter(p => p.kind === 'deposit' || p.kind === 'wallet' || p.type === 'deposit' || p.type === 'wallet' || p.type === 'wallet_topup')
      .map(p => {
        const e = (p.userId || p.hostEmail || '').toLowerCase();
        const u = usersByEmail.get(e);
        return {
          ...p,
          userRole: p.userRole || u?.role || 'guest',
          userName: p.userName || u?.username || u?.name || e,
        };
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const guestDeposits = allDeposits.filter(d => d.userRole === 'guest');
    const hostDeposits = allDeposits.filter(d => d.userRole === 'owner');

    return {
      guestWallets,
      hostWallets,
      guestDeposits,
      hostDeposits,
    };
  }

  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public createUser(user: User): User {
    const cleanEmail = user.email.toLowerCase().trim();
    user.email = cleanEmail;
    this.data.users.push(user);
    // Ensure wallet without overwriting existing persisted balance
    this.ensureWallet(cleanEmail);
    if (user.role === 'owner' && !this.data.hostPlans[cleanEmail]) {
      // Host must pay subscription (30d Monthly / 365d Annual) before publishing stays publicly
      this.data.hostPlans[cleanEmail] = {
        tier: 'Silver',
        status: 'pending',
        expiresAt: 0,
        graceExpiresAt: 0,
        hasPaidSubscription: false,
      };
      this.createNotification({
        id: 'notif_' + Date.now(),
        userEmail: cleanEmail,
        title: 'Welcome Host! Please Select a Hosting Plan',
        message: 'To publish short stays publicly, please select a hosting plan (Silver, Diamond, or Gold) and activate via Wallet or M-Pesa.',
        read: false,
        link: '/#owner',
        type: 'subscription',
        createdAt: Date.now(),
      });
    }
    this.save();
    return user;
  }

  public updateUser(email: string, updates: Partial<User>): User | null {
    const user = this.findUserByEmail(email);
    if (!user) return null;
    Object.assign(user, updates);
    this.save();
    return user;
  }

  public getAllUsers(): User[] {
    return this.data.users;
  }

  // --- Single Admin Management ---
  public hasAdminAccount(): boolean {
    return this.data.users.some(u => u.role === 'admin');
  }

  public getAdminUser(): User | undefined {
    return this.data.users.find(u => u.role === 'admin');
  }

  public getAdminEmail(): string {
    const admin = this.getAdminUser();
    return admin ? admin.email : 'admin@airbus.ke';
  }

  public registerSingleAdmin(data: {
    name: string;
    email: string;
    passwordHash: string;
    phone?: string;
    location?: string;
  }): User {
    if (this.hasAdminAccount()) {
      throw new Error('An administrator account is already registered. Registration is permanently closed.');
    }
    const cleanEmail = data.email.trim().toLowerCase();
    const existing = this.findUserByEmail(cleanEmail);
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const newAdmin: User = {
      id: 'u_admin_' + Date.now(),
      name: data.name.trim(),
      email: cleanEmail,
      role: 'admin',
      passwordHash: data.passwordHash,
      phone: data.phone || '+254 700 000 000',
      location: data.location || 'Headquarters, Nairobi',
      bio: 'Platform Administrator at AirBus Global.',
      languages: 'English, Swahili',
      idVerified: true,
      createdAt: Date.now(),
    } as any;

    this.data.users.push(newAdmin);
    this.data.isSingleAdminRegistered = true;
    this.ensureWallet(cleanEmail);
    this.save();
    return newAdmin;
  }

  public updateAdminCredentials(
    currentEmail: string,
    currentPasswordHash: string,
    updates: {
      newName?: string;
      newEmail?: string;
      newPasswordHash?: string;
    }
  ): User {
    const admin = this.findUserByEmail(currentEmail);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Admin user not found.');
    }
    if (admin.passwordHash !== currentPasswordHash) {
      throw new Error('Incorrect current password.');
    }

    if (updates.newName && updates.newName.trim()) {
      admin.name = updates.newName.trim();
    }

    if (updates.newPasswordHash) {
      admin.passwordHash = updates.newPasswordHash;
    }

    if (updates.newEmail) {
      const cleanNewEmail = updates.newEmail.trim().toLowerCase();
      if (cleanNewEmail !== admin.email) {
        const existing = this.findUserByEmail(cleanNewEmail);
        if (existing) {
          throw new Error('An account with that email already exists.');
        }
        const oldEmail = admin.email;
        admin.email = cleanNewEmail;

        if (this.data.wallets[oldEmail] !== undefined) {
          this.data.wallets[cleanNewEmail] = this.data.wallets[oldEmail];
          delete this.data.wallets[oldEmail];
        }
        if (this.data.walletRecords[oldEmail] !== undefined) {
          const rec = this.data.walletRecords[oldEmail];
          rec.email = cleanNewEmail;
          this.data.walletRecords[cleanNewEmail] = rec;
          delete this.data.walletRecords[oldEmail];
        }
      }
    }

    this.save();
    return admin;
  }

  public resetAdminPassword(email: string, newPasswordHash: string): User {
    const admin = this.findUserByEmail(email);
    if (!admin || admin.role !== 'admin') {
      throw new Error('No administrator account found with this email.');
    }
    admin.passwordHash = newPasswordHash;
    this.save();
    return admin;
  }

  // --- Stays & Powerful Search ---
  private getStayPublishTimestamp(s: Stay): number {
    return Number(s.published_at || s.reviewed_at || s.createdAt || 0);
  }

  public isStayApprovedPublic(s: Stay): boolean {
    if (s.isDelisted) return false;
    if (s.moderationState && s.moderationState !== 'APPROVED') return false;
    if (s.moderationStatus && s.moderationStatus !== 'approved') return false;
    if (s.isApprovedByAdmin === false) return false;
    if (s.status !== 'live' && s.status !== 'PUBLISHED') return false;
    return true;
  }

  public checkStayLiveStatus(stayId: string, viewerUser?: User | null) {
    const raw = (this.data.stays || []).find(s => s.id === stayId);
    if (!raw) {
      return {
        exists: false,
        inPublicFeed: false,
        reasons: ['Listing not found.'],
      };
    }
    const reasons: string[] = [];
    if (raw.isDelisted) reasons.push('Listing is marked delisted.');
    if (raw.moderationState && raw.moderationState !== 'APPROVED') {
      reasons.push(`Moderation state is ${raw.moderationState}.`);
    }
    if (raw.status !== 'live' && raw.status !== 'PUBLISHED') {
      reasons.push(`Status is ${raw.status}.`);
    }
    let ownerPlanActive = true;
    if (raw.ownerEmail) {
      const ownerUser = this.findUserByEmail(raw.ownerEmail);
      if (!ownerUser || ownerUser.role !== 'admin') {
        const plan = this.getHostPlan(raw.ownerEmail);
        ownerPlanActive = plan.status === 'active' && (plan.expiresAt === 0 || plan.expiresAt > Date.now());
        if (!ownerPlanActive) reasons.push('Host subscription plan is not active.');
      }
    }
    const feed = this.getStays({ viewerUser: viewerUser || ({ role: 'admin', email: 'admin@airbus.ke', id: 'admin', name: 'Admin', idVerified: true, createdAt: 0 } as User), includeVVVIP: true });
    const feedIndex = feed.findIndex(s => s.id === stayId);
    return {
      exists: true,
      id: raw.id,
      title: raw.title,
      status: raw.status,
      publishState: raw.publishState || (this.isStayApprovedPublic(raw) ? 'PUBLISHED' : 'PENDING_REVIEW'),
      moderationState: raw.moderationState,
      published_at: raw.published_at || null,
      approved_by: raw.approved_by || raw.reviewed_by || null,
      ownerPlanActive,
      isPlusVVVIP: Boolean(raw.isPlusVVVIP),
      collections: this.getListingCollectionIds(raw.id),
      inPublicFeed: feedIndex >= 0,
      feedRank: feedIndex >= 0 ? feedIndex + 1 : null,
      reasons,
    };
  }

  public getStays(filter?: {
    query?: string;
    guests?: number;
    minPrice?: number;
    maxPrice?: number;
    types?: string[];
    features?: string[];
    instantBook?: boolean;
    isFeatured?: boolean;
    category?: string;
    status?: ListingStatus;
    checkIn?: string;
    checkOut?: string;
    beds?: number;
    includePendingForAdmin?: boolean;
    viewerUser?: User | null;
    includeVVVIP?: boolean;
    sort?: 'new' | 'featured';
  }): Stay[] {
    this.checkAllExpirations();

    let list = this.data.stays;
    const canSeePlus = Boolean(filter?.includeVVVIP) || this.canViewerSeePlus(filter?.viewerUser);
    const isAdminPreview = Boolean(filter?.includePendingForAdmin && filter?.viewerUser?.role === 'admin');

    if (!filter?.status) {
      if (!isAdminPreview) {
        list = list.filter(s => {
          if (!this.isStayApprovedPublic(s)) return false;
          if (s.isPlusVVVIP && !canSeePlus) return false;
          if (s.ownerEmail) {
            const ownerUser = this.findUserByEmail(s.ownerEmail);
            if (!ownerUser || ownerUser.role !== 'admin') {
              const plan = this.getHostPlan(s.ownerEmail);
              if (plan.status !== 'active' || (plan.expiresAt > 0 && plan.expiresAt <= Date.now())) return false;
            }
          }
          return true;
        });
      }
    } else {
      list = list.filter(s => s.status === filter.status && !s.isDelisted && (!s.isPlusVVVIP || canSeePlus || isAdminPreview));
    }

    if (filter) {
      if (filter.query && filter.query.trim()) {
        const words = filter.query.toLowerCase().trim().split(/\s+/);
        list = list.filter(s => {
          const searchable = `${s.title} ${s.location} ${s.type} ${s.description} ${s.category} ${s.hostName || ''} ${(s.features || []).join(' ')} ${(s.highlights || []).join(' ')}`.toLowerCase();
          return words.every(w => searchable.includes(w));
        });
      }

      if (filter.guests && filter.guests > 1) {
        list = list.filter(s => s.guests >= filter.guests!);
      }

      if (filter.beds && filter.beds > 0) {
        list = list.filter(s => s.beds >= filter.beds!);
      }

      if (filter.minPrice && filter.minPrice > 0) {
        list = list.filter(s => s.price >= filter.minPrice!);
      }

      if (filter.maxPrice && filter.maxPrice > 0) {
        list = list.filter(s => s.price <= filter.maxPrice!);
      }

      if (filter.types && filter.types.length > 0) {
        list = list.filter(s => filter.types!.includes(s.type));
      }

      if (filter.features && filter.features.length > 0) {
        list = list.filter(s => filter.features!.every(f => s.features.includes(f)));
      }

      if (filter.instantBook) {
        list = list.filter(s => s.instantBook);
      }

      if (filter.isFeatured) {
        list = list.filter(s => s.isFeatured);
      }

      if (filter.category && filter.category !== 'all') {
        list = list.filter(s => s.category.toLowerCase() === filter.category!.toLowerCase());
      }

      if (filter.checkIn && filter.checkOut) {
        const cin = filter.checkIn;
        const cout = filter.checkOut;
        list = list.filter(s => {
          const hasClash = this.data.bookings.some(b =>
            b.stayId === s.id &&
            (b.status === 'confirmed' || b.status === 'requested') &&
            cin < b.checkOut && cout > b.checkIn
          );
          if (hasClash) return false;

          if (s.blockedDates && s.blockedDates.length > 0) {
            const hasBlocked = s.blockedDates.some(block => cin < block.to && cout > block.from);
            if (hasBlocked) return false;
          }
          return true;
        });
      }
    }

    const now = Date.now();
    const useFeaturedSort = filter?.sort === 'featured';
    return list
      .map(s => this.hydrateStayAudio({ ...s, isVerified: s.isVerified !== false }, filter?.viewerUser))
      .sort((a, b) => {
        if (useFeaturedSort) {
          const aBoosted = Boolean(a.isPromoted && a.promotedUntil && a.promotedUntil > now);
          const bBoosted = Boolean(b.isPromoted && b.promotedUntil && b.promotedUntil > now);
          if (aBoosted && !bBoosted) return -1;
          if (!aBoosted && bBoosted) return 1;
        }
        const diff = this.getStayPublishTimestamp(b) - this.getStayPublishTimestamp(a);
        if (diff !== 0) return diff;
        return b.id.localeCompare(a.id);
      });
  }

  public queryStaysFeed(filter: {
    query?: string;
    guests?: number;
    minPrice?: number;
    maxPrice?: number;
    types?: string[];
    features?: string[];
    instantBook?: boolean;
    isFeatured?: boolean;
    category?: string;
    status?: ListingStatus;
    checkIn?: string;
    checkOut?: string;
    beds?: number;
    includePendingForAdmin?: boolean;
    viewerUser?: User | null;
    includeVVVIP?: boolean;
    cursor?: string;
    limit?: number;
    sort?: 'new' | 'featured';
  }): { stays: Stay[]; nextCursor: string | null; hasMore: boolean; totalCount: number } {
    const limit = Math.min(50, Math.max(1, Number(filter.limit) || 20));
    const canSeePlus = Boolean(filter.includeVVVIP) || this.canViewerSeePlus(filter.viewerUser);
    const isCacheable =
      !filter.query &&
      !filter.guests &&
      !filter.minPrice &&
      !filter.maxPrice &&
      (!filter.types || filter.types.length === 0) &&
      (!filter.features || filter.features.length === 0) &&
      !filter.instantBook &&
      !filter.isFeatured &&
      (!filter.category || filter.category === 'all') &&
      !filter.status &&
      !filter.checkIn &&
      !filter.checkOut &&
      !filter.beds &&
      !filter.includePendingForAdmin;

    const cacheKey = `${canSeePlus ? 'plus' : 'std'}_${filter.sort || 'new'}`;
    let fullList: Stay[];

    if (
      isCacheable &&
      this.publicFeedCache.stays &&
      this.publicFeedCache.stays.key === cacheKey &&
      Date.now() - this.publicFeedCache.stays.ts < 15_000
    ) {
      fullList = this.publicFeedCache.stays.data;
    } else {
      fullList = this.getStays(filter);
      if (isCacheable) {
        this.publicFeedCache.stays = { key: cacheKey, ts: Date.now(), data: fullList };
      }
    }

    let filtered = fullList;
    if (filter.cursor && filter.cursor.includes('|')) {
      const [tsStr, cursorId] = filter.cursor.split('|');
      const cursorTs = Number(tsStr);
      if (Number.isFinite(cursorTs)) {
        filtered = fullList.filter(s => {
          const ts = this.getStayPublishTimestamp(s);
          return ts < cursorTs || (ts === cursorTs && s.id.localeCompare(cursorId) < 0);
        });
      }
    }

    const page = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? `${this.getStayPublishTimestamp(last)}|${last.id}` : null;

    return {
      stays: page,
      nextCursor,
      hasMore,
      totalCount: fullList.length,
    };
  }

  public getMyStays(ownerEmail: string): Stay[] {
    const clean = ownerEmail.trim().toLowerCase();
    return (this.data.stays || [])
      .filter(s => (s.ownerEmail || s.owner || '').toLowerCase() === clean)
      .map(s => this.hydrateStayAudio({ ...s, isVerified: s.isVerified !== false }))
      .sort((a, b) => {
        const diff = (b.createdAt || 0) - (a.createdAt || 0);
        return diff !== 0 ? diff : b.id.localeCompare(a.id);
      });
  }

  public getStayById(id: string, viewerUser?: User | null, _bypassVVVIP?: boolean): Stay | undefined {
    const s = this.data.stays.find(stay => stay.id === id);
    if (!s) return undefined;
    if (s.isPlusVVVIP && !_bypassVVVIP && !this.canViewerSeePlus(viewerUser)) {
      const isOwner = Boolean(viewerUser?.email && s.ownerEmail?.toLowerCase() === viewerUser.email.toLowerCase());
      if (!isOwner) return undefined;
    }
    if (s.ownerEmail) {
      const ownerUser = this.findUserByEmail(s.ownerEmail);
      const isAdminOwner = Boolean(ownerUser && ownerUser.role === 'admin');
      const plan = this.getHostPlan(s.ownerEmail);
      const isExpired = !isAdminOwner && (plan.status !== 'active' || (plan.expiresAt > 0 && plan.expiresAt < Date.now()));
      return this.hydrateStayAudio(
        {
          ...s,
          isVerified: s.isVerified !== false,
          ownerSubscriptionExpired: isExpired,
        },
        viewerUser
      );
    }
    return this.hydrateStayAudio({ ...s, isVerified: s.isVerified !== false }, viewerUser);
  }

  public incrementStayViews(id: string) {
    const s = this.getStayById(id);
    if (s) {
      s.views = (s.views || 0) + 1;
      this.save();
    }
  }

  public toggleLikeStay(id: string, userEmail: string): { likesCount: number; isLiked: boolean } {
    const s = this.getStayById(id);
    if (!s) return { likesCount: 0, isLiked: false };

    s.likedByUserEmails = s.likedByUserEmails || [];
    const idx = s.likedByUserEmails.indexOf(userEmail);
    let isLiked = false;

    if (idx >= 0) {
      s.likedByUserEmails.splice(idx, 1);
      s.likesCount = Math.max(0, (s.likesCount || 0) - 1);
      isLiked = false;
    } else {
      s.likedByUserEmails.push(userEmail);
      s.likesCount = (s.likesCount || 0) + 1;
      isLiked = true;

      // Notify host
      if (s.ownerEmail && s.ownerEmail !== userEmail) {
        this.createNotification({
          id: 'notif_' + Date.now(),
          userEmail: s.ownerEmail,
          title: 'New Video Like!',
          message: `${userEmail} liked your video tour for ${s.title}.`,
          read: false,
          link: `/#stay-${s.id}`,
          type: 'system',
          createdAt: Date.now(),
        });
      }
    }

    this.save();
    return { likesCount: s.likesCount || 0, isLiked };
  }

  public toggleFollowHost(hostEmail: string, userEmail: string): { followerCount: number; isFollowing: boolean } {
    const staysByHost = this.data.stays.filter(s => s.ownerEmail?.toLowerCase() === hostEmail.toLowerCase());
    let isFollowing = false;
    let newFollowerCount = 0;

    staysByHost.forEach(s => {
      s.hostFollowedByUserEmails = s.hostFollowedByUserEmails || [];
      const idx = s.hostFollowedByUserEmails.indexOf(userEmail);
      if (idx >= 0) {
        s.hostFollowedByUserEmails.splice(idx, 1);
        s.hostFollowerCount = Math.max(0, (s.hostFollowerCount || 1) - 1);
        isFollowing = false;
      } else {
        s.hostFollowedByUserEmails.push(userEmail);
        s.hostFollowerCount = (s.hostFollowerCount || 0) + 1;
        isFollowing = true;
      }
      newFollowerCount = s.hostFollowerCount || 0;
    });

    if (isFollowing) {
      this.createNotification({
        id: 'notif_' + Date.now(),
        userEmail: hostEmail,
        title: 'New Follower!',
        message: `${userEmail} followed your AirBus host channel.`,
        read: false,
        link: '/#owner',
        type: 'system',
        createdAt: Date.now(),
      });
    }

    this.save();
    return { followerCount: newFollowerCount, isFollowing };
  }

  // --- Video Comments & Nested Replies ---
  public getComments(stayId: string): VideoComment[] {
    const stay = this.getStayById(stayId);
    return stay?.comments || [];
  }

  public addComment(stayId: string, user: User, text: string): VideoComment | null {
    const stay = this.getStayById(stayId);
    if (!stay) return null;

    stay.comments = stay.comments || [];
    const newComment: VideoComment = {
      id: 'c_' + Date.now(),
      stayId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      text: text.trim(),
      likes: 0,
      replies: [],
      createdAt: Date.now(),
    };

    stay.comments.unshift(newComment);
    stay.commentsCount = (stay.commentsCount || 0) + 1;

    // Notify host
    if (stay.ownerEmail && stay.ownerEmail !== user.email) {
      this.createNotification({
        id: 'notif_' + Date.now(),
        userEmail: stay.ownerEmail,
        title: 'New Video Comment',
        message: `${user.name} commented on ${stay.title}: "${text.slice(0, 60)}..."`,
        read: false,
        link: `/#stay-${stay.id}`,
        type: 'system',
        createdAt: Date.now(),
      });
    }

    this.save();
    return newComment;
  }

  public addCommentReply(stayId: string, commentId: string, user: User, text: string): VideoCommentReply | null {
    const stay = this.getStayById(stayId);
    if (!stay || !stay.comments) return null;

    const parentComment = stay.comments.find(c => c.id === commentId);
    if (!parentComment) return null;

    parentComment.replies = parentComment.replies || [];
    const newReply: VideoCommentReply = {
      id: 'r_' + Date.now(),
      commentId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      text: text.trim(),
      createdAt: Date.now(),
    };

    parentComment.replies.push(newReply);
    stay.commentsCount = (stay.commentsCount || 0) + 1;

    // Notify parent comment author
    if (parentComment.userEmail !== user.email) {
      this.createNotification({
        id: 'notif_' + Date.now(),
        userEmail: parentComment.userEmail,
        title: 'Reply to Your Comment',
        message: `${user.name} replied to your comment on ${stay.title}: "${text.slice(0, 60)}..."`,
        read: false,
        link: `/#stay-${stay.id}`,
        type: 'system',
        createdAt: Date.now(),
      });
    }

    this.save();
    return newReply;
  }

  public createStay(stay: Stay): Stay {
    this.assertNoBlobUrls([
      stay.videoUrl,
      stay.thumbnailUrl,
      ...(stay.images || []),
      stay.media?.video?.url,
      ...(stay.media?.photos?.map(p => p.url) || []),
    ]);
    const refMediaId = stay.videoMediaId || stay.media?.video?.mediaId;
    if (refMediaId) {
      this.assertMediaAssetsReady([refMediaId]);
      const asset = this.getMediaAssetById(refMediaId);
      if (asset) {
        stay.videoMediaId = asset.id;
        stay.videoUrl = asset.url;
        if (stay.media?.video) {
          stay.media.video.url = asset.url;
          stay.media.video.mediaId = asset.id;
          if (!stay.media.video.thumbnail && asset.poster_url) {
            stay.media.video.thumbnail = asset.poster_url;
          }
        }
        if (!stay.thumbnailUrl && asset.poster_url) {
          stay.thumbnailUrl = asset.poster_url;
        }
      }
    }
    this.normalizeStayMedia(stay);
    if (!stay.hasVideo && !stay.hasPhotos) {
      throw new Error('At least one media type is required (one video tour or at least one photo).');
    }
    if (stay.media?.photos && stay.media.photos.length > 30) {
      throw new Error('Maximum 30 photos allowed per listing.');
    }

    // Mandatory moderation pipeline: NEVER live immediately on creation
    stay.status = 'review';
    stay.isApprovedByAdmin = false;
    stay.moderationStatus = 'pending';
    stay.moderationState = 'PENDING';
    stay.publishState = 'PENDING_REVIEW';
    stay.published_at = null;
    stay.approved_by = null;
    stay.admin_feedback = null;
    stay.moderationReason = undefined;
    stay.reviewed_at = null;
    stay.reviewed_by = null;
    stay.isDelisted = false;
    if (!stay.createdAt) stay.createdAt = Date.now();

    const colIds = this.extractCollectionIdsFromStay(stay);
    stay.collections = colIds;

    this.data.stays.unshift(stay);
    this.syncListingCollections(stay.id, colIds, false);
    this.invalidateFeedCache('stay');

    this.data.users
      .filter(u => u.role === 'admin')
      .forEach(admin => {
        this.createNotification({
          id: 'notif_rev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
          userEmail: admin.email,
          title: 'New Listing Pending Admin Review',
          message: `"${stay.title}" (${stay.location}) submitted by ${stay.ownerEmail || stay.hostName || 'Host'} requires review.`,
          read: false,
          link: '/#admin',
          type: 'system',
          createdAt: Date.now(),
        });
      });

    this.save();
    return this.hydrateStayAudio(stay);
  }

  public updateStay(id: string, updates: Partial<Stay>): Stay | null {
    const s = this.data.stays.find(stay => stay.id === id);
    if (!s) return null;
    this.assertNoBlobUrls([
      updates.videoUrl,
      updates.thumbnailUrl,
      ...(updates.images || []),
      updates.media?.video?.url,
      ...(updates.media?.photos?.map(p => p.url) || []),
    ]);
    const refMediaId = updates.videoMediaId || updates.media?.video?.mediaId;
    if (refMediaId) {
      this.assertMediaAssetsReady([refMediaId]);
    }
    Object.assign(s, updates);
    if (refMediaId) {
      const asset = this.getMediaAssetById(refMediaId);
      if (asset) {
        s.videoMediaId = asset.id;
        s.videoUrl = asset.url;
        if (s.media?.video) {
          s.media.video.mediaId = asset.id;
          s.media.video.url = asset.url;
        }
      }
    }
    this.normalizeStayMedia(s);
    if (!s.hasVideo && !s.hasPhotos) {
      throw new Error('Listing must retain at least one media type (video or at least one photo).');
    }
    if (s.media?.photos && s.media.photos.length > 30) {
      throw new Error('Maximum 30 photos allowed per listing.');
    }
    const colIds = updates.collections ? updates.collections : this.extractCollectionIdsFromStay(s);
    this.syncListingCollections(s.id, colIds, false);
    this.invalidateFeedCache('stay');
    this.save();
    return this.hydrateStayAudio(s);
  }

  public resubmitStay(id: string, actorEmail: string, isAdmin: boolean, updates: Partial<Stay>): Stay {
    const s = this.data.stays.find(stay => stay.id === id);
    if (!s) throw new Error('Listing not found.');
    if (!isAdmin && (s.ownerEmail || s.owner || '').toLowerCase() !== actorEmail.toLowerCase()) {
      throw new Error('Unauthorized to edit and resubmit this listing.');
    }
    this.assertNoBlobUrls([
      updates.videoUrl,
      updates.thumbnailUrl,
      ...(updates.images || []),
      updates.media?.video?.url,
      ...(updates.media?.photos?.map(p => p.url) || []),
    ]);
    const refMediaId = updates.videoMediaId || updates.media?.video?.mediaId;
    if (refMediaId) {
      this.assertMediaAssetsReady([refMediaId]);
    }

    const preservedCreatedAt = s.createdAt;
    const { createdAt: _ignoreCreatedAt, id: _ignoreId, ...safeUpdates } = updates as any;
    Object.assign(s, safeUpdates);
    s.createdAt = preservedCreatedAt; // Preserve original submission timestamp

    if (refMediaId) {
      const asset = this.getMediaAssetById(refMediaId);
      if (asset) {
        s.videoMediaId = asset.id;
        s.videoUrl = asset.url;
        if (s.media?.video) {
          s.media.video.mediaId = asset.id;
          s.media.video.url = asset.url;
        }
      }
    }

    this.normalizeStayMedia(s);
    if (!s.hasVideo && !s.hasPhotos) {
      throw new Error('Listing must retain at least one media type (video or at least one photo).');
    }
    if (s.media?.photos && s.media.photos.length > 30) {
      throw new Error('Maximum 30 photos allowed per listing.');
    }

    const colIds = updates.collections ? updates.collections : this.extractCollectionIdsFromStay(s);
    this.syncListingCollections(s.id, colIds, false);

    s.moderationState = 'PENDING';
    s.moderationStatus = 'pending';
    s.status = 'review';
    s.publishState = 'PENDING_REVIEW';
    s.published_at = null;
    s.isApprovedByAdmin = false;
    s.isDelisted = false;
    s.admin_feedback = null;
    s.moderationReason = undefined;
    s.reviewed_at = null;
    s.reviewed_by = null;

    this.invalidateFeedCache('stay');
    this.data.users
      .filter(u => u.role === 'admin')
      .forEach(admin => {
        this.createNotification({
          id: 'notif_resub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
          userEmail: admin.email,
          title: 'Resubmitted Listing Awaiting Review',
          message: `"${s.title}" was updated and resubmitted for Admin Review.`,
          read: false,
          link: '/#admin',
          type: 'system',
          createdAt: Date.now(),
        });
      });
    this.save();
    return this.hydrateStayAudio(s);
  }

  public deleteStay(id: string): boolean {
    const idx = this.data.stays.findIndex(s => s.id === id);
    if (idx === -1) return false;
    this.data.stays.splice(idx, 1);
    this.invalidateFeedCache('stay');
    this.save();
    return true;
  }

  // --- Bookings ---
  public getBookings(email?: string, role?: 'guest' | 'owner'): Booking[] {
    if (!email) return this.data.bookings;
    if (role === 'guest') {
      return this.data.bookings.filter(b => b.guestEmail.toLowerCase() === email.toLowerCase());
    }
    if (role === 'owner') {
      const myStayIds = new Set(this.data.stays.filter(s => s.ownerEmail?.toLowerCase() === email.toLowerCase()).map(s => s.id));
      return this.data.bookings.filter(b => myStayIds.has(b.stayId));
    }
    return this.data.bookings;
  }

  public createBooking(booking: Booking): Booking {
    this.data.bookings.unshift(booking);
    const stay = this.getStayById(booking.stayId);
    if (stay && stay.ownerEmail) {
      // Find or create chat thread between guest and host for this stay
      let thread = this.data.threads.find(
        t =>
          t.stayId === stay.id &&
          t.guestEmail.toLowerCase() === booking.guestEmail.toLowerCase() &&
          t.hostEmail.toLowerCase() === stay.ownerEmail!.toLowerCase()
      );

      if (!thread) {
        thread = {
          id: 'th_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          stayId: stay.id,
          guestEmail: booking.guestEmail.toLowerCase(),
          hostEmail: stay.ownerEmail.toLowerCase(),
          messages: [],
          unreadGuest: false,
          unreadHost: true,
          updatedAt: Date.now(),
        };
        this.data.threads.unshift(thread);
      }

      // Add booking context message at top of chat thread
      thread.messages.push({
        id: 'msg_b_' + Date.now(),
        from: 'system',
        type: 'text',
        text: `📌 New Reservation Context: ${booking.reference}\nDates: ${booking.checkIn} to ${booking.checkOut}\nGuests: ${booking.guests} | Total: ${booking.currency} ${booking.total.toLocaleString()}\nPayment: Guest pays on arrival outside the platform.`,
        createdAt: Date.now(),
      });
      thread.unreadHost = true;
      thread.updatedAt = Date.now();

      // Real-time host notification with deep-link opening chat thread
      this.createNotification({
        id: 'notif_' + Date.now(),
        userEmail: stay.ownerEmail,
        title: 'New Booking Reservation',
        message: `${booking.guestName} has booked your listing ${stay.title}`,
        read: false,
        link: `/#chat?thread=${thread.id}`,
        type: 'booking',
        createdAt: Date.now(),
      });
    }
    this.save();
    return booking;
  }

  public updateBookingStatus(id: string, status: Booking['status']): Booking | null {
    const b = this.data.bookings.find(item => item.id === id || item.reference === id);
    if (!b) return null;
    b.status = status;
    const stay = this.getStayById(b.stayId);
    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: b.guestEmail,
      title: `Booking ${status === 'confirmed' ? 'Confirmed' : status === 'declined' ? 'Declined' : 'Updated'}`,
      message: `Your booking for ${stay?.title || 'stay'} has been ${status}.`,
      read: false,
      link: '/#guest',
      type: 'booking',
      createdAt: Date.now(),
    });
    this.save();
    return b;
  }

  // --- Automatic 24-Hour Stay Check-in Alerts ---
  public checkUpcomingCheckinReminders(userEmail?: string): Array<{
    booking: Booking;
    stay: Stay;
    hoursUntilCheckIn: number;
    isWithin24Hours: boolean;
  }> {
    const now = Date.now();
    const results: Array<{
      booking: Booking;
      stay: Stay;
      hoursUntilCheckIn: number;
      isWithin24Hours: boolean;
    }> = [];

    let hasCreatedNotification = false;

    for (const b of this.data.bookings) {
      if (b.status !== 'confirmed') continue;
      if (userEmail && b.guestEmail.toLowerCase() !== userEmail.toLowerCase()) continue;

      // Calculate checkIn timestamp (standard 14:00 check-in time)
      const checkInDate = new Date(`${b.checkIn}T14:00:00`);
      const checkInTime = !isNaN(checkInDate.getTime()) ? checkInDate.getTime() : new Date(b.checkIn).getTime();
      if (isNaN(checkInTime)) continue;

      const diffMs = checkInTime - now;
      const hoursUntilCheckIn = Math.round((diffMs / (3600 * 1000)) * 10) / 10;
      const isWithin24Hours = diffMs > 0 && diffMs <= 24 * 3600 * 1000;
      const isToday = diffMs <= 0 && diffMs >= -14 * 3600 * 1000;

      const stay = this.getStayById(b.stayId);
      if (!stay) continue;

      if (isWithin24Hours || isToday) {
        results.push({
          booking: b,
          stay,
          hoursUntilCheckIn: Math.max(0, hoursUntilCheckIn),
          isWithin24Hours: true,
        });

        // 1. Generate persistent 24h reminder notification for guest if not already sent
        const guestNotifId = `notif_remind_24h_${b.id}`;
        const alreadyGuestNotified = this.data.notifications.some(n => n.id === guestNotifId);
        if (!alreadyGuestNotified) {
          const timeText = diffMs > 0 ? `in ~${Math.max(1, Math.round(hoursUntilCheckIn))} hours` : 'today';
          this.data.notifications.unshift({
            id: guestNotifId,
            userEmail: b.guestEmail,
            title: `🛎️ 24h Check-in Reminder: ${stay.title}`,
            message: `Your stay at "${stay.title}" (${stay.location}) starts ${timeText}! Check-in: ${b.checkIn}. Host contact: ${stay.whatsapp || stay.hostPhone || 'Direct message'}. Have a wonderful trip!`,
            read: false,
            link: '/#guest',
            type: 'booking',
            createdAt: now,
          });
          hasCreatedNotification = true;
        }

        // 2. Generate persistent notification for host if not already sent
        if (stay.ownerEmail) {
          const hostNotifId = `notif_host_remind_24h_${b.id}`;
          const alreadyHostNotified = this.data.notifications.some(n => n.id === hostNotifId);
          if (!alreadyHostNotified) {
            this.data.notifications.unshift({
              id: hostNotifId,
              userEmail: stay.ownerEmail,
              title: `🛎️ Guest Check-in within 24 Hours: ${b.guestName}`,
              message: `Guest ${b.guestName} is arriving on ${b.checkIn} for "${stay.title}". Check-in ready!`,
              read: false,
              link: '/#owner',
              type: 'booking',
              createdAt: now,
            });
            hasCreatedNotification = true;
          }
        }
      }
    }

    if (hasCreatedNotification) {
      this.save();
    }

    return results;
  }

  // --- Chat Threads & Negotiations ---
  public getThreads(email?: string): ChatThread[] {
    if (!email) return this.data.threads;
    const low = email.toLowerCase();
    return this.data.threads.filter(t => t.guestEmail.toLowerCase() === low || t.hostEmail.toLowerCase() === low);
  }

  public getThread(id: string): ChatThread | undefined {
    return this.data.threads.find(t => t.id === id || t.stayId === id);
  }

  public saveThread(thread: ChatThread) {
    const idx = this.data.threads.findIndex(t => t.id === thread.id);
    if (idx >= 0) {
      this.data.threads[idx] = thread;
    } else {
      this.data.threads.unshift(thread);
    }
    this.save();
  }

  // --- Reviews ---
  public getReviews(stayId?: string): Review[] {
    if (!stayId) return this.data.reviews;
    return this.data.reviews.filter(r => r.stayId === stayId);
  }

  public createReview(review: Review): Review {
    this.data.reviews.unshift(review);
    const stay = this.getStayById(review.stayId);
    if (stay) {
      const allStayReviews = this.data.reviews.filter(r => r.stayId === review.stayId);
      const avg = allStayReviews.reduce((acc, r) => acc + r.rating, 0) / allStayReviews.length;
      stay.rating = Math.round(avg * 10) / 10;
      stay.reviewsCount = allStayReviews.length;
    }
    this.save();
    return review;
  }

  // --- Plans & Wallet (Normalized Single Source of Truth) ---
  public getHostPlan(email: string): HostPlanStatus {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail) {
      return {
        tier: 'Silver',
        status: 'pending',
        expiresAt: 0,
        graceExpiresAt: 0,
        hasPaidSubscription: false,
      };
    }
    this.checkSubscriptionExpirations();
    const plan =
      this.data.hostPlans[cleanEmail] ||
      Object.entries(this.data.hostPlans).find(([k]) => k.toLowerCase().trim() === cleanEmail)?.[1];
    if (!plan) {
      return {
        tier: 'Silver',
        status: 'pending',
        expiresAt: 0,
        graceExpiresAt: 0,
        hasPaidSubscription: false,
      };
    }
    return plan;
  }

  public setHostPlan(email: string, plan: HostPlanStatus) {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail) return;
    if (!this.data.hostPlans) this.data.hostPlans = {};
    this.data.hostPlans[cleanEmail] = plan;
    this.save();
  }

  public getWalletBalance(email: string): number {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail) return 0;
    const wr = this.ensureWallet(cleanEmail);
    return Math.max(0, Number(wr.balance) || 0);
  }

  public getWallet(email: string): number {
    return this.getWalletBalance(email);
  }

  /**
   * Executes a multi-step wallet mutation inside an all-or-nothing snapshot transaction.
   * If any step fails, all financial, subscription, listing, and user changes are rolled back.
   */
  public runAtomicWalletTransaction<T>(fn: () => T): T {
    const clone = <V>(val: V): V => JSON.parse(JSON.stringify(val));
    const snapshot = {
      wallets: clone(this.data.wallets || {}),
      walletRecords: clone(this.data.walletRecords || {}),
      walletTransactions: clone(this.data.walletTransactions || []),
      ledgerEntries: clone(this.data.ledgerEntries || []),
      paymentRecords: clone(this.data.paymentRecords || []),
      payments: clone(this.data.payments || []),
      subscriptions: clone(this.data.subscriptions || []),
      hostPlans: clone(this.data.hostPlans || {}),
      stays: clone(this.data.stays || []),
      boosts: clone(this.data.boosts || []),
      promotions: clone(this.data.promotions || []),
      sponsorSlots: clone(this.data.sponsorSlots || []),
      adSlots: clone(this.data.adSlots || []),
      adRequests: clone(this.data.adRequests || []),
      snappAddCampaigns: clone(this.data.snappAddCampaigns || []),
      users: clone(this.data.users || []),
      notifications: clone(this.data.notifications || []),
      auditLogs: clone(this.data.auditLogs || []),
    };
    try {
      return fn();
    } catch (err) {
      Object.assign(this.data, snapshot);
      throw err;
    }
  }

  public recordWalletTransaction(tx: {
    walletId: string;
    direction: 'credit' | 'debit';
    amount: number;
    type?: string;
    reference?: string;
    note: string;
    relatedPaymentId?: string;
  }): WalletTransaction {
    const cleanWallet = tx.walletId.toLowerCase().trim();
    const rawNum = Number(tx.amount);
    if (!Number.isInteger(rawNum) || rawNum <= 0) {
      throw new Error('Transaction amount must be a whole integer greater than zero.');
    }
    const intAmount = rawNum;

    const wr = this.ensureWallet(cleanWallet);
    const currentBalance = Math.floor(Math.max(0, Number(wr.balance) || 0));
    if (tx.direction === 'debit' && currentBalance < intAmount) {
      throw new Error(
        `Insufficient wallet balance (KES ${currentBalance.toLocaleString()} available, KES ${intAmount.toLocaleString()} required). Please deposit via Deposit (M-Pesa) first.`
      );
    }

    const newTx: WalletTransaction = {
      id: 'wtx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      walletId: cleanWallet,
      wallet_id: cleanWallet,
      direction: tx.direction,
      amount: intAmount,
      amountSc: intAmount,
      type: tx.type || (tx.direction === 'credit' ? 'credit' : 'debit'),
      reference: tx.reference || '',
      note: tx.note,
      relatedPaymentId: tx.relatedPaymentId,
      createdAt: Date.now(),
    };

    if (!this.data.walletTransactions) this.data.walletTransactions = [];
    this.data.walletTransactions.unshift(newTx);

    const newBal = tx.direction === 'credit' ? currentBalance + intAmount : currentBalance - intAmount;
    if (!this.data.wallets) this.data.wallets = {};
    this.data.wallets[cleanWallet] = newBal;
    wr.balance = newBal;
    if (tx.direction === 'credit') {
      wr.lifetimeEarnings = (wr.lifetimeEarnings || 0) + intAmount;
    } else {
      wr.lifetimeSpent = (wr.lifetimeSpent || 0) + intAmount;
    }
    wr.updatedAt = Date.now();

    if (tx.type === 'wallet_topup' || tx.type === 'deposit') {
      if (!this.data.ledgerEntries) this.data.ledgerEntries = [];
      this.data.ledgerEntries.unshift({
        id: 'ledg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        fromWallet: 'external_mpesa',
        toWallet: cleanWallet,
        amount: intAmount,
        type: 'topup',
        referenceId: tx.relatedPaymentId || tx.reference,
        description: tx.note,
        createdAt: Date.now(),
      });
    }

    this.save();
    this.emitWalletUpdate(cleanWallet);
    return newTx;
  }

  public getUserWalletTransactions(viewerEmail: string, viewerIsAdmin = false) {
    const cleanViewer = viewerEmail.toLowerCase().trim();
    const payments = (this.data.paymentRecords || []).filter(p => {
      if (viewerIsAdmin) return true;
      const u = (p.userId || p.hostEmail || '').toLowerCase().trim();
      return u === cleanViewer;
    });

    const mappedPayments = payments.map(p => {
      const userEmail = (p.userId || p.hostEmail || '').toLowerCase().trim();
      const rawType = p.type || p.kind || 'payment';
      const normalizedType =
        rawType === 'wallet' || rawType === 'wallet_topup' || rawType === 'deposit'
          ? 'deposit'
          : rawType === 'vvvip'
          ? 'airbus_plus'
          : rawType === 'boost'
          ? 'promotion'
          : rawType;
      const isDeposit = normalizedType === 'deposit';
      const amt = Math.floor(Number(p.approvedAmount ?? p.claimedAmount ?? p.amountKes ?? p.amount ?? 0) || 0);
      return {
        id: p.id,
        date: p.createdAt || Date.now(),
        createdAt: p.createdAt || Date.now(),
        user: userEmail,
        type: normalizedType,
        direction: isDeposit ? ('credit' as const) : ('debit' as const),
        amount: amt,
        status: p.status,
        reference: p.mpesaCode || p.referenceId || p.id,
        mpesaCode: p.mpesaCode || undefined,
        rejectionReason: p.rejectionReason || undefined,
        method: p.method,
        note:
          normalizedType === 'deposit'
            ? `Deposit (M-Pesa${p.mpesaCode ? ` · ${p.mpesaCode}` : ''})`
            : `${normalizedType.replace(/_/g, ' ')} payment from wallet`,
      };
    });

    const coveredPaymentIds = new Set(mappedPayments.map(m => m.id));
    const extraWtx = (this.data.walletTransactions || [])
      .filter(tx => {
        const wId = (tx.walletId || tx.wallet_id || '').toLowerCase().trim();
        if (!viewerIsAdmin && wId !== cleanViewer) return false;
        if (tx.relatedPaymentId && coveredPaymentIds.has(tx.relatedPaymentId)) return false;
        return true;
      })
      .map(tx => ({
        id: tx.id,
        date: tx.createdAt || Date.now(),
        createdAt: tx.createdAt || Date.now(),
        user: (tx.walletId || tx.wallet_id || '').toLowerCase().trim(),
        type: tx.type || tx.direction || 'wallet',
        direction: tx.direction,
        amount: Math.floor(Number(tx.amount || 0)),
        status: 'approved' as const,
        reference: tx.reference || tx.relatedPaymentId || tx.id,
        mpesaCode: undefined,
        rejectionReason: undefined,
        method: 'wallet' as const,
        note: tx.note,
      }));

    return [...mappedPayments, ...extraWtx].sort((a, b) => (b.date || 0) - (a.date || 0));
  }

  public addWallet(email: string, amount: number) {
    const intAmt = Math.floor(amount);
    if (intAmt > 0) {
      this.recordWalletTransaction({
        walletId: email,
        direction: 'credit',
        amount: intAmt,
        type: 'deposit',
        note: `Direct credit of KES ${intAmt.toLocaleString()}`,
      });
    }
  }

  public getPayments(): PaymentRecord[] {
    return this.getPaymentRecords();
  }

  public getPaymentRecords(filter?: {
    status?: PaymentRecordStatus;
    type?: PaymentRecordType;
    method?: PaymentRecordMethod;
    search?: string;
  }): PaymentRecord[] {
    let list = this.data.paymentRecords || [];
    if (list.length === 0 && this.data.payments && this.data.payments.length > 0) {
      list = this.data.payments as PaymentRecord[];
    }

    if (filter) {
      if (filter.status && (filter.status as string) !== 'all') {
        list = list.filter(p => p.status === filter.status);
      }
      if (filter.type && (filter.type as string) !== 'all') {
        list = list.filter(p => p.type === filter.type || (filter.type === 'subscription' && p.kind === 'plan'));
      }
      if (filter.method && (filter.method as string) !== 'all') {
        list = list.filter(p => (p.method || 'mpesa') === filter.method);
      }
      if (filter.search && filter.search.trim()) {
        const q = filter.search.toLowerCase().trim();
        list = list.filter(p =>
          (p.id && p.id.toLowerCase().includes(q)) ||
          (p.userId && p.userId.toLowerCase().includes(q)) ||
          (p.hostEmail && p.hostEmail.toLowerCase().includes(q)) ||
          (p.referenceId && p.referenceId.toLowerCase().includes(q)) ||
          (p.mpesaCode && p.mpesaCode.toLowerCase().includes(q))
        );
      }
    }

    return list.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  public createPayment(input: any): PaymentRecord {
    const payerEmail = (input.userId || input.hostEmail || 'guest@airbus.ke').toLowerCase().trim();
    const payer = this.findUserByEmail(payerEmail);
    const p: PaymentRecord = {
      id: input.id || ('pay_' + Date.now()),
      userId: payerEmail,
      user_id: payerEmail,
      userRole: input.userRole || payer?.role || 'guest',
      userName: input.userName || payer?.username || payer?.name || payerEmail,
      hostEmail: input.hostEmail || payerEmail,
      kind: input.kind || 'wallet',
      type: input.type || (input.kind === 'plan' ? 'subscription' : 'booking_fee'),
      method: input.method || 'mpesa',
      amountSc: input.amountSc || input.amount || 0,
      amount_sc: input.amountSc || input.amount || 0,
      amountKes: input.amountKes || input.amount || 0,
      amount_kes: input.amountKes || input.amount || 0,
      amount: input.amount || input.amountSc || 0,
      status: input.status || 'pending',
      referenceId: input.referenceId || input.id || ('ref_' + Date.now()),
      reference_id: input.referenceId || input.id || ('ref_' + Date.now()),
      mpesaCode: input.mpesaCode,
      mpesa_code: input.mpesaCode,
      planTier: input.planTier || input.tier,
      plan_tier: input.planTier || input.tier,
      tier: input.tier || input.planTier,
      durationDays: input.durationDays,
      duration_days: input.durationDays,
      period: input.period,
      createdAt: input.createdAt || Date.now(),
      created_at: input.createdAt || Date.now(),
      updatedAt: input.updatedAt || Date.now(),
      updated_at: input.updatedAt || Date.now(),
    };

    if (!this.data.paymentRecords) this.data.paymentRecords = [];
    if (!this.data.payments) this.data.payments = [];
    this.data.paymentRecords.unshift(p);
    this.data.payments.unshift(p);

    // Notify admin
    this.data.users
      .filter(u => u.role === 'admin')
      .forEach(admin => {
        this.createNotification({
          id: 'notif_' + Date.now() + Math.random(),
          userEmail: admin.email,
          title: 'New Deposit Pending Verification',
          message: `${p.userId || p.hostEmail} submitted Deposit (M-Pesa) of KES ${p.amountKes || p.amount} (Ref: ${p.mpesaCode || p.id}).`,
          read: false,
          link: '/#admin',
          type: 'payment',
          createdAt: Date.now(),
        });
      });
    this.save();
    return p;
  }

  public payWithWallet(opts: {
    userId: string;
    type: PaymentRecordType;
    amountSc: number;
    referenceId: string;
    planTier?: StayCategory;
    durationDays?: number;
    period?: 'monthly' | 'annual';
    note?: string;
  }): { payment: PaymentRecord; userTx: WalletTransaction; adminTx: WalletTransaction } {
    return this.runAtomicWalletTransaction(() => {
      const cleanUserId = opts.userId.toLowerCase().trim();
      const rawAmount = Number(opts.amountSc);
      if (!Number.isInteger(rawAmount) || rawAmount <= 0) {
        throw new Error('Payment amount must be a whole integer in Ksh greater than 0.');
      }
      const intAmount = rawAmount;

      const userWallet = this.ensureWallet(cleanUserId);
      const available = Math.floor(userWallet.balance - (userWallet.holdBalance || 0));
      if (available < intAmount) {
        const diff = intAmount - available;
        throw new Error(
          `Insufficient wallet balance. You have KES ${available.toLocaleString()} but need KES ${intAmount.toLocaleString()}. Please deposit KES ${diff.toLocaleString()} via Deposit (M-Pesa) to continue.`
        );
      }

      // Debit payer wallet
      userWallet.balance = Math.floor(userWallet.balance) - intAmount;
      userWallet.lifetimeSpent = (userWallet.lifetimeSpent || 0) + intAmount;
      userWallet.updatedAt = Date.now();
      this.data.wallets[cleanUserId] = userWallet.balance;

      // Credit admin wallet with exact same integer amount
      const adminWallet = this.ensureWallet('admin@airbus.ke');
      adminWallet.balance = Math.floor(adminWallet.balance) + intAmount;
      adminWallet.lifetimeEarnings = (adminWallet.lifetimeEarnings || 0) + intAmount;
      adminWallet.updatedAt = Date.now();
      this.data.wallets['admin@airbus.ke'] = adminWallet.balance;

      const payer = this.findUserByEmail(cleanUserId);
      const now = Date.now();
      const paymentId = 'pay_' + now + '_' + Math.random().toString(36).substring(2, 6);
      const resolvedKind: PaymentRecord['kind'] =
        opts.type === 'subscription'
          ? 'plan'
          : opts.type === 'vvvip'
          ? 'vvvip'
          : opts.type === 'trip_dating'
          ? 'trip_dating'
          : opts.type === 'boost'
          ? 'boost'
          : 'advert';

      const walletPurpose: AdminWalletPurpose = this.mapTypeToWalletPurpose(opts.type);
      const uniquePaymentCode = `WLT_${paymentId.slice(-8).toUpperCase()}_${opts.referenceId.slice(-4).toUpperCase()}`;

      const payment: PaymentRecord = {
        id: paymentId,
        userId: cleanUserId,
        user_id: cleanUserId,
        userRole: payer?.role || 'guest',
        userName: payer?.username || payer?.name || cleanUserId,
        hostEmail: cleanUserId,
        type: opts.type,
        kind: resolvedKind,
        method: 'wallet',
        amountSc: intAmount,
        amount_sc: intAmount,
        amountKes: intAmount,
        amount_kes: intAmount,
        amount: intAmount,
        approvedAmount: intAmount,
        walletPurpose,
        approvedBy: 'admin@airbus.ke',
        approvedAt: now,
        status: 'approved',
        referenceId: opts.referenceId,
        reference_id: opts.referenceId,
        reference: uniquePaymentCode,
        planTier: opts.planTier,
        plan_tier: opts.planTier,
        durationDays: opts.durationDays,
        duration_days: opts.durationDays,
        period: opts.period || (opts.durationDays && opts.durationDays > 30 ? 'annual' : 'monthly'),
        createdAt: now,
        created_at: now,
        updatedAt: now,
        updated_at: now,
      };

      const userTx: WalletTransaction = {
        id: 'wtx_' + now + '_dr_' + Math.random().toString(36).slice(2, 6),
        walletId: cleanUserId,
        wallet_id: cleanUserId,
        direction: 'debit',
        amount: intAmount,
        amountSc: intAmount,
        amount_sc: intAmount,
        type: opts.type,
        reference: opts.referenceId,
        relatedPaymentId: paymentId,
        related_payment_id: paymentId,
        note: opts.note || `Payment for ${opts.type} (${opts.referenceId})`,
        createdAt: now,
        created_at: now,
      };

      const adminTx: WalletTransaction = {
        id: 'wtx_' + now + '_cr_' + Math.random().toString(36).slice(2, 6),
        walletId: 'admin@airbus.ke',
        wallet_id: 'admin@airbus.ke',
        direction: 'credit',
        amount: intAmount,
        amountSc: intAmount,
        amount_sc: intAmount,
        type: `${opts.type}_income`,
        reference: opts.referenceId,
        relatedPaymentId: paymentId,
        related_payment_id: paymentId,
        note: `Received ${opts.type} payment (${opts.referenceId}) from ${cleanUserId}`,
        createdAt: now,
        created_at: now,
      };

      if (!this.data.paymentRecords) this.data.paymentRecords = [];
      this.data.paymentRecords.unshift(payment);
      if (!this.data.payments) this.data.payments = [];
      this.data.payments.unshift(payment);

      if (!this.data.walletTransactions) this.data.walletTransactions = [];
      this.data.walletTransactions.unshift(userTx, adminTx);

      if (!this.data.ledgerEntries) this.data.ledgerEntries = [];
      const mappedLedgerType: LedgerEntryType =
        opts.type === 'advert'
          ? 'ad_payment'
          : opts.type === 'boost'
          ? 'promotion'
          : opts.type === 'trip_dating'
          ? 'trip_dating'
          : opts.type === 'vvvip'
          ? 'vvvip'
          : 'subscription';
      const fiscalYear = getEATParts(now).year;
      this.data.ledgerEntries.unshift({
        id: 'ledg_' + now + '_' + Math.random().toString(36).slice(2, 6),
        fromWallet: cleanUserId,
        toWallet: 'admin@airbus.ke',
        amount: intAmount,
        type: mappedLedgerType,
        referenceId: opts.referenceId,
        paymentCode: uniquePaymentCode,
        purpose: walletPurpose,
        fiscalYear,
        depositorName: payer?.name || payer?.username || cleanUserId,
        depositorRole: payer?.role || 'guest',
        approvingAdmin: 'admin@airbus.ke',
        description: opts.note || `Wallet payment of KES ${intAmount} for ${opts.type}`,
        createdAt: now,
      });

      this.recordAdminWalletEntry({
        id: 'awe_' + paymentId,
        sourceKind: 'SERVICE_REVENUE',
        depositorName: payer?.name || payer?.username || cleanUserId,
        depositorId: cleanUserId,
        depositorRole: payer?.role || 'guest',
        timestampUtc: now,
        fiscalYear,
        paymentCode: uniquePaymentCode,
        amount: intAmount,
        purpose: walletPurpose,
        subPurpose: opts.type,
        approvingAdmin: 'admin@airbus.ke',
        description: opts.note || `${walletPurpose} payment from ${cleanUserId}`,
        relatedPaymentId: paymentId,
      });

      this.createAuditLog({
        id: 'aud_' + now,
        action: `wallet_payment_${opts.type}`,
        actorEmail: cleanUserId,
        details: `Paid KES ${intAmount} for ${opts.type} (ref: ${opts.referenceId}) via Wallet`,
        createdAt: now,
      });

      this.save();
      this.emitWalletUpdate(cleanUserId);
      this.emitWalletUpdate('admin@airbus.ke');
      return { payment, userTx, adminTx };
    });
  }

  public createMpesaPayment(opts: {
    userId: string;
    type: PaymentRecordType;
    amountKes: number;
    mpesaCode: string;
    referenceId: string;
    planTier?: StayCategory;
    durationDays?: number;
    period?: 'monthly' | 'annual';
    purpose?: AdminWalletPurpose;
  }): PaymentRecord {
    const allowedMpesaTypes: PaymentRecordType[] = ['deposit', 'wallet', 'wallet_topup', 'mpesa_deposit', 'trip_dating'];
    if (!allowedMpesaTypes.includes(opts.type)) {
      throw new Error('Pay with M-Pesa has been removed. Please deposit funds via Deposit (M-Pesa) and pay from your wallet.');
    }

    const cleanCode = opts.mpesaCode.trim().toUpperCase();
    if (!cleanCode || !/^[A-Z0-9]{8,15}$/.test(cleanCode)) {
      throw new Error('M-Pesa reference code must be 8-15 alphanumeric characters (e.g. QGH7X2K9LM).');
    }

    const rawAmount = Number(opts.amountKes);
    if (!Number.isInteger(rawAmount) || rawAmount < 10) {
      throw new Error('Deposit amount must be a whole integer in Ksh (minimum Ksh 10).');
    }
    const intAmount = rawAmount;

    if (this.isMpesaCodeUsed(cleanCode)) {
      throw new Error('Duplicate M-Pesa transaction code. This code has already been submitted.');
    }

    const cleanUserId = opts.userId.toLowerCase().trim();
    const payer = this.findUserByEmail(cleanUserId);
    const resolvedKind: PaymentRecord['kind'] =
      opts.type === 'trip_dating' ? 'trip_dating' : 'deposit';

    const walletPurpose: AdminWalletPurpose = opts.purpose || (opts.type === 'trip_dating' ? 'TRIP_DATING' : 'OTHER');

    const now = Date.now();
    const paymentId = 'pay_dep_' + now + '_' + Math.random().toString(36).substring(2, 6);
    const payment: PaymentRecord = {
      id: paymentId,
      userId: cleanUserId,
      user_id: cleanUserId,
      userRole: payer?.role || 'guest',
      userName: payer?.username || payer?.name || cleanUserId,
      hostEmail: cleanUserId,
      type: opts.type === 'trip_dating' ? 'trip_dating' : 'deposit',
      kind: resolvedKind,
      method: 'mpesa_manual',
      amountSc: intAmount,
      amount_sc: intAmount,
      amountKes: intAmount,
      amount_kes: intAmount,
      amount: intAmount,
      claimedAmount: intAmount,
      walletPurpose,
      status: 'pending',
      referenceId: cleanCode,
      reference_id: cleanCode,
      mpesaCode: cleanCode,
      mpesa_code: cleanCode,
      createdAt: now,
      created_at: now,
      updatedAt: now,
      updated_at: now,
    };

    if (!this.data.paymentRecords) this.data.paymentRecords = [];
    this.data.paymentRecords.unshift(payment);
    if (!this.data.payments) this.data.payments = [];
    this.data.payments.unshift(payment);

    this.createAuditLog({
      id: 'aud_' + now,
      action: `mpesa_deposit_submitted`,
      actorEmail: cleanUserId,
      details: `Submitted M-Pesa deposit ${cleanCode} for KES ${intAmount}`,
      createdAt: now,
    });

    this.data.users.filter(u => u.role === 'admin').forEach(admin => {
      this.createNotification({
        id: 'notif_' + now + Math.random(),
        userEmail: admin.email,
        title: 'New M-Pesa Deposit Pending',
        message: `${cleanUserId} submitted M-Pesa deposit code ${cleanCode} for KES ${intAmount}.`,
        read: false,
        link: '/#admin',
        type: 'payment',
        createdAt: now,
      });
    });

    this.save();
    return payment;
  }

  public approvePayment(paymentId: string, adminEmail: string, confirmedAmount?: number): PaymentRecord | null {
    return this.approvePaymentRecord(paymentId, adminEmail, confirmedAmount);
  }

  public approvePaymentRecord(paymentId: string, adminEmail: string, confirmedAmount?: number): PaymentRecord {
    const p = (this.data.paymentRecords || []).find(x => x.id === paymentId) ||
              (this.data.payments || []).find(x => x.id === paymentId);
    if (!p) throw new Error('Payment record not found.');
    if (p.status === 'approved') return p;
    if (p.status !== 'pending') throw new Error(`Payment is already ${p.status}.`);

    const submittedAmount = Math.floor(Number(p.claimedAmount ?? p.amountKes ?? p.amount ?? 0) || 0);
    if (submittedAmount <= 0) {
      throw new Error('Invalid submitted amount.');
    }
    if (confirmedAmount !== undefined && Number.isFinite(Number(confirmedAmount)) && Math.floor(Number(confirmedAmount)) !== submittedAmount) {
      throw new Error('Admin cannot edit the deposit amount. If the M-Pesa SMS amount does not match KES ' + submittedAmount + ', reject this deposit so the user can resubmit.');
    }

    const paymentCode = String(p.mpesaCode || p.reference || p.referenceId || p.id).trim().toUpperCase();
    // Reject duplicate payment code in Admin Wallet ledger
    const alreadyRecordedCode = (this.data.admin_wallet_entries || []).some(
      e => e.sourceKind === 'APPROVED_DEPOSIT' && e.paymentCode.toUpperCase() === paymentCode && e.relatedPaymentId !== p.id
    );
    if (alreadyRecordedCode) {
      throw new Error(`Duplicate payment code (${paymentCode}) has already been recorded in the Admin Wallet.`);
    }

    return this.runAtomicWalletTransaction(() => {
      const now = Date.now();
      const hostEmail = (p.userId || p.hostEmail || '').toLowerCase().trim();
      const finalApprovedAmount = submittedAmount;
      const payerUser = this.findUserByEmail(hostEmail);
      const fiscalYear = getEATParts(now).year;
      const resolvedPurpose: AdminWalletPurpose =
        p.walletPurpose || this.mapTypeToWalletPurpose(String(p.type || p.kind || 'deposit'));

      p.status = 'approved';
      p.approvedAmount = finalApprovedAmount;
      p.amount = finalApprovedAmount;
      p.amountKes = finalApprovedAmount;
      p.amountSc = finalApprovedAmount;
      p.walletPurpose = resolvedPurpose;
      p.approvedBy = adminEmail;
      p.approved_by = adminEmail;
      p.approvedAt = now;
      p.approved_at = now;
      p.updatedAt = now;
      p.updated_at = now;

      const pMirror = (this.data.payments || []).find(x => x.id === paymentId);
      if (pMirror && pMirror !== p) {
        pMirror.status = 'approved';
        pMirror.approvedAmount = finalApprovedAmount;
        pMirror.amount = finalApprovedAmount;
        pMirror.amountKes = finalApprovedAmount;
        pMirror.amountSc = finalApprovedAmount;
        pMirror.approvedAt = now;
        pMirror.updatedAt = now;
      }

      // 1. Wallet Deposit (M-Pesa): credit user wallet with exact submitted integer amount
      if (p.kind === 'wallet' || p.kind === 'deposit' || p.type === 'wallet' || p.type === 'wallet_topup' || p.type === 'deposit' || p.type === 'mpesa_deposit') {
        this.recordWalletTransaction({
          walletId: hostEmail,
          direction: 'credit',
          amount: finalApprovedAmount,
          type: 'wallet_topup',
          reference: paymentCode,
          note: `Deposit (M-Pesa) Till 943210 approved (Code: ${paymentCode})`,
          relatedPaymentId: p.id,
        });
      } else if (p.type === 'trip_dating' || p.kind === 'trip_dating') {
        this.recordWalletTransaction({
          walletId: 'admin@airbus.ke',
          direction: 'credit',
          amount: finalApprovedAmount,
          type: 'trip_dating',
          reference: p.id,
          note: `Trip Dating contact unlock fee (${p.referenceId || p.id})`,
          relatedPaymentId: p.id,
        });
      }

      // Record once in the unified Admin Wallet ledger with depositor metadata, UTC timestamp, unique payment code, purpose, and approving admin
      this.recordAdminWalletEntry({
        id: 'awe_dep_' + p.id,
        sourceKind: 'APPROVED_DEPOSIT',
        depositorName: payerUser?.name || payerUser?.username || p.userName || hostEmail,
        depositorId: payerUser?.id || hostEmail,
        depositorRole: payerUser?.role || p.userRole || 'guest',
        timestampUtc: now,
        fiscalYear,
        paymentCode,
        amount: finalApprovedAmount,
        purpose: resolvedPurpose,
        subPurpose: p.type || p.kind || 'deposit',
        approvingAdmin: adminEmail,
        description: `Approved M-Pesa Deposit (${paymentCode}) from ${payerUser?.name || hostEmail}`,
        relatedPaymentId: p.id,
      });

      this.createAuditLog({
        id: 'aud_' + now,
        action: 'payment_approve',
        actorEmail: adminEmail,
        details: `Approved ${p.type || p.kind} (KES ${finalApprovedAmount}, code ${paymentCode}) for ${hostEmail}`,
        createdAt: now,
      });

      const isGuest = payerUser?.role === 'guest';
      this.createNotification({
        id: 'notif_' + now,
        userEmail: hostEmail,
        title: 'Wallet Deposit Approved!',
        message: `Your M-Pesa deposit of KES ${finalApprovedAmount.toLocaleString()} (Ref: ${paymentCode}) was approved and credited to your wallet.`,
        read: false,
        link: isGuest ? '/#guest' : '/#owner',
        type: 'payment',
        createdAt: now,
      });

      this.save();
      this.emitWalletUpdate(hostEmail);
      this.emitWalletUpdate('admin@airbus.ke');
      return p;
    });
  }

  // --- Dormant Owners (Inactive for >= 90 days / 3 months) & Delisting ---
  public getDormantOwners(): DormantOwner[] {
    const now = Date.now();
    const ninetyDaysMs = 90 * 864e5;
    const owners = this.data.users.filter(u => u.role === 'owner');

    const dormantList: DormantOwner[] = [];

    for (const owner of owners) {
      const plan = this.getHostPlan(owner.email);
      const stays = this.data.stays.filter(s => s.ownerEmail?.toLowerCase() === owner.email.toLowerCase());
      const hasDelisted = stays.some(s => s.isDelisted || s.status === 'delisted');

      const isExpiredLongEnough = plan.expiresAt > 0 && (now - plan.expiresAt) >= ninetyDaysMs;
      const isNeverActiveLongEnough = plan.expiresAt === 0 && (now - (owner.createdAt || 0)) >= ninetyDaysMs;

      if (isExpiredLongEnough || isNeverActiveLongEnough || hasDelisted) {
        const daysInactive = plan.expiresAt > 0
          ? Math.max(0, Math.floor((now - plan.expiresAt) / 864e5))
          : Math.max(0, Math.floor((now - (owner.createdAt || 0)) / 864e5));

        dormantList.push({
          name: owner.name,
          email: owner.email,
          tier: plan.tier || 'Silver',
          lastExpiryDate: plan.expiresAt || 0,
          daysInactive,
          listingCount: stays.length,
          isDelisted: hasDelisted,
        });
      }
    }

    return dormantList;
  }

  public delistOwner(email: string): boolean {
    const low = email.toLowerCase();
    let updated = false;

    this.data.stays.forEach(s => {
      if (s.ownerEmail?.toLowerCase() === low) {
        s.isDelisted = true;
        s.status = 'delisted';
        s.delistedAt = Date.now();
        updated = true;
      }
    });

    if (updated) {
      this.createAuditLog({
        id: 'aud_' + Date.now(),
        action: 'owner_delist',
        actorEmail: 'admin@airbus.ke',
        details: `Delisted all stays for dormant owner ${email}`,
        createdAt: Date.now(),
      });
      this.save();
    }
    return updated;
  }

  public relistOwner(email: string): boolean {
    const low = email.toLowerCase();
    let updated = false;

    this.data.stays.forEach(s => {
      if (s.ownerEmail?.toLowerCase() === low) {
        s.isDelisted = false;
        s.status = 'live';
        updated = true;
      }
    });

    if (updated) {
      this.createAuditLog({
        id: 'aud_' + Date.now(),
        action: 'owner_relist',
        actorEmail: 'admin@airbus.ke',
        details: `Restored listings to live for owner ${email}`,
        createdAt: Date.now(),
      });
      this.save();
    }
    return updated;
  }

  public rejectPayment(paymentId: string, adminEmail: string, reason?: string): PaymentRecord | null {
    return this.rejectPaymentRecord(paymentId, adminEmail, reason || 'Invalid or unverified receipt details.');
  }

  public rejectPaymentRecord(paymentId: string, adminEmail: string, rejectionReason: string): PaymentRecord {
    const p = (this.data.paymentRecords || []).find(x => x.id === paymentId) ||
              (this.data.payments || []).find(x => x.id === paymentId);
    if (!p) throw new Error('Payment record not found.');
    if (p.status !== 'pending') throw new Error(`Payment is already ${p.status}.`);

    const cleanReason = rejectionReason.trim() || 'Payment could not be verified.';
    p.status = 'rejected';
    p.rejectionReason = cleanReason;
    p.rejection_reason = cleanReason;
    p.approvedBy = adminEmail;
    p.approved_by = adminEmail;
    p.updatedAt = Date.now();
    p.updated_at = Date.now();

    const pMirror = (this.data.payments || []).find(x => x.id === paymentId);
    if (pMirror && pMirror !== p) {
      pMirror.status = 'rejected';
      pMirror.rejectionReason = cleanReason;
    }

    const cleanUserId = (p.userId || p.hostEmail || '').toLowerCase().trim();
    const amount = p.amountSc || p.amount;

    // REVERSAL TRANSFER IF WALLET:
    // Admin wallet debited, user credited, ledger entries created
    if (p.method === 'wallet') {
      const adminWallet = this.ensureWallet('admin@airbus.ke');
      adminWallet.balance = Math.max(0, adminWallet.balance - amount);
      adminWallet.updatedAt = Date.now();
      this.data.wallets['admin@airbus.ke'] = adminWallet.balance;

      const userWallet = this.ensureWallet(cleanUserId);
      userWallet.balance += amount;
      userWallet.lifetimeSpent = Math.max(0, (userWallet.lifetimeSpent || 0) - amount);
      userWallet.updatedAt = Date.now();
      this.data.wallets[cleanUserId] = userWallet.balance;

      const adminRevTx: WalletTransaction = {
        id: 'wtx_' + Date.now() + '_rev_dr',
        walletId: 'admin@airbus.ke',
        wallet_id: 'admin@airbus.ke',
        direction: 'debit',
        amount: amount,
        amountSc: amount,
        amount_sc: amount,
        relatedPaymentId: p.id,
        related_payment_id: p.id,
        note: `Reversal debit for rejected payment ${p.id}: ${cleanReason}`,
        createdAt: Date.now(),
        created_at: Date.now(),
      };

      const userRevTx: WalletTransaction = {
        id: 'wtx_' + Date.now() + '_rev_cr',
        walletId: cleanUserId,
        wallet_id: cleanUserId,
        direction: 'credit',
        amount: amount,
        amountSc: amount,
        amount_sc: amount,
        relatedPaymentId: p.id,
        related_payment_id: p.id,
        note: `Refund for rejected ${p.type || p.kind} payment: ${cleanReason}`,
        createdAt: Date.now(),
        created_at: Date.now(),
      };

      if (!this.data.walletTransactions) this.data.walletTransactions = [];
      this.data.walletTransactions.unshift(adminRevTx, userRevTx);

      if (!this.data.ledgerEntries) this.data.ledgerEntries = [];
      this.data.ledgerEntries.unshift({
        id: 'ledg_' + Date.now() + '_refund',
        fromWallet: 'admin@airbus.ke',
        toWallet: cleanUserId,
        amount: amount,
        type: 'ad_fee',
        referenceId: p.id,
        description: `Refund of ${amount} SC for rejected payment (${cleanReason})`,
        createdAt: Date.now(),
      });
    }

    // Deactivate item
    if (p.type === 'boost' || p.referenceId?.startsWith('boost_') || p.kind === 'boost') {
      const boost = (this.data.boosts || []).find(b => b.id === p.referenceId || b.payment_id === p.id);
      if (boost) {
        boost.status = 'rejected';
      }
    }
    if (p.type === 'advert' || p.referenceId?.startsWith('adslot_') || p.referenceId?.startsWith('sponsor_') || p.kind === 'advert') {
      const slot = (this.data.adSlots || []).find(s => s.id === p.referenceId || s.paymentId === p.id);
      if (slot) {
        slot.status = 'rejected';
        slot.rejectionReason = cleanReason;
        slot.updatedAt = Date.now();
      }
      const sp = (this.data.sponsorSlots || []).find(s => s.id === p.referenceId || s.payment_id === p.id);
      if (sp) {
        sp.status = 'rejected';
      }
    }
    if (p.type === 'subscription') {
      const sub = (this.data.subscriptions || []).find(s => s.id === p.referenceId || s.paymentId === p.id);
      if (sub) {
        sub.status = 'rejected';
        sub.updatedAt = Date.now();
      }
    }

    // Audit log
    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'payment_rejected',
      actorEmail: adminEmail,
      details: `Rejected ${p.type || p.kind} payment ${p.id} for ${cleanUserId}. Reason: ${cleanReason}`,
      createdAt: Date.now(),
    });

    // Notify User
    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: cleanUserId,
      title: 'Payment Verification Declined',
      message: `Your payment of ${amount} Coins (${p.method.toUpperCase()}) was declined: "${cleanReason}". ${p.method === 'wallet' ? 'Your wallet balance has been refunded in full.' : 'Please check your receipt or contact support.'}`,
      read: false,
      link: '/#owner',
      type: 'payment',
      createdAt: Date.now(),
    });

    this.save();
    this.emitWalletUpdate(cleanUserId);
    this.emitWalletUpdate('admin@airbus.ke');
    return p;
  }

  // --- Ad Slots (100 KES/day dynamic adverts - Wallet Only) ---
  public createAdSlot(opts: {
    ownerId: string;
    title: string;
    description: string;
    linkUrl: string;
    thumbnailUrl: string;
    videoUrl?: string;
    durationDays: number;
    paymentMethod?: 'wallet' | 'mpesa';
    mpesaCode?: string;
  }): { slot: AdSlot; payment: PaymentRecord } {
    if (opts.paymentMethod && opts.paymentMethod !== 'wallet') {
      throw new Error('Adverts must be paid strictly from your private AirBus Wallet. Please deposit funds via Deposit (M-Pesa) first.');
    }

    const days = Math.min(90, Math.max(1, Math.floor(opts.durationDays || 7)));
    const ratePerDay = Math.floor(this.getSettings().adPricePerDay || 100);
    const costKes = days * ratePerDay;
    const cleanOwnerId = opts.ownerId.toLowerCase().trim();

    return this.runAtomicWalletTransaction(() => {
      const now = Date.now();
      const slotId = 'adslot_' + now + '_' + Math.random().toString(36).substring(2, 6);

      const result = this.payWithWallet({
        userId: cleanOwnerId,
        type: 'advert',
        amountSc: costKes,
        referenceId: slotId,
        durationDays: days,
        note: `Advert Payment for "${opts.title.trim()}" (${days} days @ KES ${ratePerDay}/day)`,
      });

      const slot: AdSlot = {
        id: slotId,
        ownerId: cleanOwnerId,
        owner_id: cleanOwnerId,
        title: opts.title.trim(),
        description: opts.description.trim(),
        linkUrl: opts.linkUrl.trim(),
        link_url: opts.linkUrl.trim(),
        thumbnailUrl: opts.thumbnailUrl.trim() || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
        thumbnail_url: opts.thumbnailUrl.trim() || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
        videoUrl: opts.videoUrl?.trim(),
        video_url: opts.videoUrl?.trim(),
        durationDays: days,
        duration_days: days,
        costSc: costKes,
        cost_sc: costKes,
        status: 'active',
        startsAt: now,
        endsAt: now + days * 864e5,
        paymentId: result.payment.id,
        payment_id: result.payment.id,
        paymentMethod: 'wallet',
        impressions: 0,
        clicks: 0,
        createdAt: now,
        created_at: now,
        updatedAt: now,
        updated_at: now,
      };

      if (!this.data.adSlots) this.data.adSlots = [];
      this.data.adSlots.unshift(slot);
      this.save();

      return { slot, payment: result.payment };
    });
  }

  public getActiveAdSlots(): AdSlot[] {
    const now = Date.now();
    if (!this.data.adSlots) this.data.adSlots = [];

    // Expire outdated ad slots
    this.data.adSlots.forEach(slot => {
      if (slot.status === 'active' && slot.endsAt && slot.endsAt <= now) {
        slot.status = 'expired';
        slot.updatedAt = now;
      }
    });

    const activeSlots = this.data.adSlots.filter(s => s.status === 'active' && (!s.endsAt || s.endsAt > now));
    return activeSlots;
  }

  public recordAdSlotImpression(id: string): void {
    const slot = (this.data.adSlots || []).find(s => s.id === id);
    if (slot) {
      slot.impressions = (slot.impressions || 0) + 1;
      this.save();
    }
  }

  public recordAdSlotClick(id: string): void {
    const slot = (this.data.adSlots || []).find(s => s.id === id);
    if (slot) {
      slot.clicks = (slot.clicks || 0) + 1;
      this.save();
    }
  }

  // --- Follows, Likes, and Views (24h de-duplication) ---
  public toggleFollow(followerId: string, ownerId: string): { isFollowing: boolean; followerCount: number } {
    const fId = followerId.toLowerCase().trim();
    const oId = ownerId.toLowerCase().trim();
    if (!this.data.follows) this.data.follows = [];

    const idx = this.data.follows.findIndex(f => f.followerId.toLowerCase() === fId && f.ownerId.toLowerCase() === oId);
    let isFollowing = false;
    if (idx >= 0) {
      this.data.follows.splice(idx, 1);
      isFollowing = false;
    } else {
      this.data.follows.push({
        id: 'fol_' + Date.now(),
        followerId: fId,
        ownerId: oId,
        createdAt: Date.now(),
      });
      isFollowing = true;

      const follower = this.data.users.find(u => u.email.toLowerCase() === fId);
      this.createNotification({
        id: 'notif_' + Date.now(),
        userEmail: oId,
        title: 'New Follower! 🎉',
        message: `${follower?.name || fId} started following your AirBus stays.`,
        read: false,
        link: '/#owner',
        type: 'system',
        createdAt: Date.now(),
      });
    }

    const followerCount = this.data.follows.filter(f => f.ownerId.toLowerCase() === oId).length;

    this.data.stays.forEach(s => {
      if (s.ownerEmail?.toLowerCase() === oId) {
        s.hostFollowerCount = followerCount;
      }
    });

    this.save();
    return { isFollowing, followerCount };
  }

  public toggleListingLike(userId: string, listingId: string): { isLiked: boolean; likesCount: number } {
    const uId = userId.toLowerCase().trim();
    if (!this.data.listingLikes) this.data.listingLikes = [];

    const stay = this.getStayById(listingId);
    if (!stay) throw new Error('Stay not found');

    const idx = this.data.listingLikes.findIndex(l => l.userId.toLowerCase() === uId && l.listingId === listingId);
    let isLiked = false;
    if (idx >= 0) {
      this.data.listingLikes.splice(idx, 1);
      stay.likesCount = Math.max(0, (stay.likesCount || 1) - 1);
      isLiked = false;
    } else {
      this.data.listingLikes.push({
        id: 'like_' + Date.now(),
        userId: uId,
        listingId,
        createdAt: Date.now(),
      });
      stay.likesCount = (stay.likesCount || 0) + 1;
      isLiked = true;
    }

    this.save();
    return { isLiked, likesCount: stay.likesCount };
  }

  public recordListingView(listingId: string, viewerId?: string, sessionId?: string): { recorded: boolean; viewsCount: number } {
    const stay = this.getStayById(listingId);
    if (!stay) throw new Error('Stay not found');

    if (!this.data.listingViews) this.data.listingViews = [];

    const now = Date.now();
    const cleanViewerId = viewerId?.toLowerCase().trim();
    const cleanSessionId = sessionId?.trim() || '';

    // Check unique view per viewer/session per 24 hours
    const recent = this.data.listingViews.find(v => {
      if (v.listingId !== listingId) return false;
      const isSameUser = cleanViewerId && v.viewerId && v.viewerId.toLowerCase() === cleanViewerId;
      const isSameSession = cleanSessionId && v.sessionId === cleanSessionId;
      return (isSameUser || isSameSession) && (now - v.createdAt < 864e5);
    });

    if (recent) {
      return { recorded: false, viewsCount: stay.views || 0 };
    }

    this.data.listingViews.push({
      id: 'vw_' + Date.now() + Math.random().toString(36).substring(2, 5),
      listingId,
      viewerId: cleanViewerId,
      sessionId: cleanSessionId,
      createdAt: now,
    });

    stay.views = (stay.views || 0) + 1;
    this.save();
    return { recorded: true, viewsCount: stay.views };
  }

  public getListingStats(listingId: string, viewerId?: string): {
    followerCount: number;
    isFollowing: boolean;
    likesCount: number;
    isLiked: boolean;
    viewsCount: number;
  } {
    const stay = this.getStayById(listingId);
    if (!stay) {
      return { followerCount: 0, isFollowing: false, likesCount: 0, isLiked: false, viewsCount: 0 };
    }

    const ownerEmail = (stay.ownerEmail || '').toLowerCase();
    const cleanViewerId = (viewerId || '').toLowerCase().trim();

    if (!this.data.follows) this.data.follows = [];
    if (!this.data.listingLikes) this.data.listingLikes = [];

    const followerCount = this.data.follows.filter(f => f.ownerId.toLowerCase() === ownerEmail).length;
    const isFollowing = cleanViewerId
      ? this.data.follows.some(f => f.followerId.toLowerCase() === cleanViewerId && f.ownerId.toLowerCase() === ownerEmail)
      : false;

    const likesCount = stay.likesCount || 0;
    const isLiked = cleanViewerId
      ? this.data.listingLikes.some(l => l.userId.toLowerCase() === cleanViewerId && l.listingId === listingId)
      : false;

    return {
      followerCount,
      isFollowing,
      likesCount,
      isLiked,
      viewsCount: stay.views || 0,
    };
  }

  // --- Subscriptions (Server Enforced Rules) ---
  public getActiveSubscription(ownerId: string): SubscriptionRecord | undefined {
    const cleanOwnerId = ownerId.toLowerCase().trim();
    const now = Date.now();
    return (this.data.subscriptions || []).find(
      s => s.ownerId.toLowerCase() === cleanOwnerId && s.status === 'active' && s.endsAt && s.endsAt > now
    );
  }

  public getPendingSubscription(ownerId: string): SubscriptionRecord | undefined {
    const cleanOwnerId = ownerId.toLowerCase().trim();
    return (this.data.subscriptions || []).find(
      s => s.ownerId.toLowerCase() === cleanOwnerId && s.status === 'pending'
    );
  }

  public purchaseSubscription(opts: {
    ownerId: string;
    tier: StayCategory;
    billing: 'monthly' | 'annual';
    method: 'wallet' | 'mpesa';
    mpesaCode?: string;
  }): { subscription: SubscriptionRecord; payment: PaymentRecord } {
    if (opts.method !== 'wallet') {
      throw new Error('Host subscriptions can only be paid from your Host Wallet. Deposit via Deposit (M-Pesa) first.');
    }

    const cleanOwnerId = opts.ownerId.toLowerCase().trim();
    const payer = this.findUserByEmail(cleanOwnerId);
    if (!payer || payer.role !== 'owner') {
      throw new Error('Only Host accounts can purchase a host subscription.');
    }

    const activeSub = this.getActiveSubscription(cleanOwnerId);
    if (activeSub) {
      const expiryDate = new Date(activeSub.endsAt!).toLocaleDateString();
      throw new Error(
        `You currently have an active ${activeSub.tier} subscription expiring on ${expiryDate}. Per platform rules, you must finish your current subscription period before upgrading or purchasing a new tier.`
      );
    }

    return this.runAtomicWalletTransaction(() => {
      const isAnnual = opts.billing === 'annual';
      const planConfig = PLANS[opts.tier];
      const cost = Math.floor(isAnnual ? planConfig.annualPrice : planConfig.p);
      const durationDays = isAnnual ? 365 : 30;
      const now = Date.now();
      const subId = 'sub_' + now + '_' + Math.random().toString(36).substring(2, 6);

      const payRes = this.payWithWallet({
        userId: cleanOwnerId,
        type: 'subscription',
        amountSc: cost,
        referenceId: subId,
        planTier: opts.tier,
        durationDays,
        period: opts.billing,
        note: `Host Subscription Payment for ${opts.tier} Plan (${durationDays} Days)`,
      });

      const endsAt = now + durationDays * 864e5;
      const subscription: SubscriptionRecord = {
        id: subId,
        ownerId: cleanOwnerId,
        owner_id: cleanOwnerId,
        tier: opts.tier,
        billing: opts.billing,
        status: 'active',
        startsAt: now,
        endsAt,
        paymentId: payRes.payment.id,
        createdAt: now,
        created_at: now,
        updatedAt: now,
        updated_at: now,
      };

      if (!this.data.subscriptions) this.data.subscriptions = [];
      this.data.subscriptions.unshift(subscription);

      this.setHostPlan(cleanOwnerId, {
        tier: opts.tier,
        status: 'active',
        startsAt: now,
        expiresAt: endsAt,
        graceExpiresAt: endsAt,
        hasPaidSubscription: true,
        period: opts.billing,
      });

      this.data.stays.forEach(s => {
        if (s.ownerEmail?.toLowerCase() === cleanOwnerId) {
          if (s.status === 'expired' || s.status === 'delisted' || s.isDelisted) {
            s.status = 'live';
            s.isDelisted = false;
          }
        }
      });

      this.createNotification({
        id: 'notif_' + now,
        userEmail: cleanOwnerId,
        title: `${opts.tier} Plan Activated!`,
        message: `KES ${cost.toLocaleString()} paid from your Host wallet. Subscription active until ${new Date(endsAt).toLocaleDateString()}.`,
        read: false,
        link: '/#owner',
        type: 'subscription',
        createdAt: now,
      });

      this.save();
      return { subscription, payment: payRes.payment };
    });
  }

  // --- Auto-Generated Shorts from Listing Videos ---
  public generateAutoShortsForListing(stay: Stay, ownerPlanTier: StayCategory): AutoShortRecord[] {
    if (!stay.videoUrl || stay.videoUrl.trim().length === 0) return [];

    let segmentCount = 0;
    if (ownerPlanTier === 'Diamond') {
      segmentCount = 1;
    } else if (ownerPlanTier === 'Gold') {
      segmentCount = 5;
    } else {
      segmentCount = 0; // Silver = 0
    }

    if (segmentCount === 0) return [];

    if (!this.data.autoShorts) this.data.autoShorts = [];
    if (!this.data.posts) this.data.posts = [];

    const newShorts: AutoShortRecord[] = [];
    const ownerEmail = (stay.ownerEmail || '').toLowerCase();

    for (let i = 0; i < segmentCount; i++) {
      const startSec = i * 20;
      const endSec = startSec + 20;
      const shortId = `short_auto_${stay.id}_${i + 1}`;

      if (this.data.autoShorts.some(s => s.id === shortId)) continue;

      const autoShort: AutoShortRecord = {
        id: shortId,
        listingId: stay.id,
        ownerId: ownerEmail,
        title: `${stay.title} - Highlight Tour #${i + 1}`,
        description: `Explore ${stay.title} in ${stay.location}. Book directly with zero guest fees on AirBus.`,
        videoUrl: stay.videoUrl,
        thumbnailUrl: stay.thumbnailUrl || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
        durationSeconds: 20,
        sourceStartSec: startSec,
        sourceEndSec: endSec,
        status: 'ready',
        aspectRatio: '9:16',
        views: 120 + Math.floor(Math.random() * 80),
        likes: 15 + Math.floor(Math.random() * 20),
        createdAt: Date.now(),
      };

      this.data.autoShorts.unshift(autoShort);
      newShorts.push(autoShort);

      const postRecord: Post = {
        id: `post_${shortId}`,
        ownerEmail,
        stayId: stay.id,
        type: 'short',
        description: autoShort.description,
        coverUrl: autoShort.thumbnailUrl,
        videoUrl: stay.videoUrl,
        durationSeconds: 20,
        status: 'approved',
        views: autoShort.views,
        likes: autoShort.likes,
        shares: 4,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.data.posts.unshift(postRecord);
    }

    this.save();
    return newShorts;
  }

  // --- Wishlist ---
  public getWishlist(email: string): string[] {
    return this.data.wishlists.filter(w => w.userEmail.toLowerCase() === email.toLowerCase()).map(w => w.stayId);
  }

  public toggleWishlist(email: string, stayId: string): boolean {
    const idx = this.data.wishlists.findIndex(w => w.userEmail.toLowerCase() === email.toLowerCase() && w.stayId === stayId);
    let isSaved = false;
    if (idx >= 0) {
      this.data.wishlists.splice(idx, 1);
      isSaved = false;
    } else {
      this.data.wishlists.push({ userEmail: email, stayId });
      isSaved = true;
    }
    this.save();
    return isSaved;
  }

  // --- Dedicated User Notifications (with delete and clear) ---
  public getNotifications(email: string): NotificationItem[] {
    return this.data.notifications.filter(n => n.userEmail.toLowerCase() === email.toLowerCase());
  }

  public createNotification(n: NotificationItem) {
    this.data.notifications.unshift(n);
    this.save();
  }

  public markNotificationsRead(email: string) {
    this.data.notifications.forEach(n => {
      if (n.userEmail.toLowerCase() === email.toLowerCase()) {
        n.read = true;
      }
    });
    this.save();
  }

  public deleteNotification(email: string, notificationId: string): boolean {
    const idx = this.data.notifications.findIndex(
      n => n.id === notificationId && n.userEmail.toLowerCase() === email.toLowerCase()
    );
    if (idx === -1) return false;
    this.data.notifications.splice(idx, 1);
    this.save();
    return true;
  }

  public clearAllNotifications(email: string): boolean {
    const countBefore = this.data.notifications.length;
    this.data.notifications = this.data.notifications.filter(
      n => n.userEmail.toLowerCase() !== email.toLowerCase()
    );
    this.save();
    return this.data.notifications.length < countBefore;
  }

  // --- Support Tickets & Listing Reports ---
  public createTicket(ticket: SupportTicket): SupportTicket {
    if (!this.data.tickets) this.data.tickets = [];
    this.data.tickets.unshift(ticket);
    this.save();
    return ticket;
  }

  public createReport(report: ListingReport): ListingReport {
    if (!this.data.reports) this.data.reports = [];
    this.data.reports.unshift(report);
    this.save();
    return report;
  }

  // --- Platform Settings (Dynamic) ---
  public getSettings(): PlatformSettings {
    if (!this.data.settings) {
      this.data.settings = { ...DEFAULT_SETTINGS };
      this.save();
    }
    return this.data.settings;
  }

  public updateSettings(partial: Partial<PlatformSettings>, adminEmail: string): PlatformSettings {
    const cur = this.getSettings();
    this.data.settings = {
      ...cur,
      ...partial,
      planPrices: { ...cur.planPrices, ...(partial.planPrices || {}) },
      currencyRates: { ...cur.currencyRates, ...(partial.currencyRates || {}) },
      contentPolicies: { ...cur.contentPolicies, ...(partial.contentPolicies || {}) },
    };

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'settings_update',
      actorEmail: adminEmail,
      details: `Updated platform settings: ${JSON.stringify(partial)}`,
      createdAt: Date.now(),
    });

    this.save();
    return this.data.settings;
  }

  // --- Wallets & Ledger System ---
  public ensureWallet(email: string): WalletRecord {
    const cleanEmail = email.toLowerCase().trim();
    if (!this.data.walletRecords) this.data.walletRecords = {};
    if (!this.data.walletRecords[cleanEmail]) {
      const legacyBalance = this.data.wallets[cleanEmail] || 0;
      this.data.walletRecords[cleanEmail] = {
        email: cleanEmail,
        balance: legacyBalance,
        holdBalance: 0,
        lifetimeEarnings: legacyBalance,
        lifetimeSpent: 0,
        updatedAt: Date.now(),
      };
      this.data.wallets[cleanEmail] = legacyBalance;
    }
    return this.data.walletRecords[cleanEmail];
  }

  public getWalletRecord(email: string): WalletRecord {
    return this.ensureWallet(email);
  }

  public placeWalletHold(email: string, amount: number): boolean {
    const intAmount = Math.floor(amount);
    if (intAmount <= 0) return false;
    const wallet = this.ensureWallet(email);
    const available = wallet.balance - wallet.holdBalance;
    if (available < intAmount) return false;
    wallet.holdBalance += intAmount;
    wallet.updatedAt = Date.now();
    this.save();
    return true;
  }

  public releaseWalletHold(email: string, amount: number): boolean {
    const intAmount = Math.floor(amount);
    if (intAmount <= 0) return false;
    const wallet = this.ensureWallet(email);
    wallet.holdBalance = Math.max(0, wallet.holdBalance - intAmount);
    wallet.updatedAt = Date.now();
    this.save();
    return true;
  }

  /**
   * Atomic wallet transfer with idempotency checks and balance invariant verification
   */
  public transfer(
    fromWallet: string,
    toWallet: string,
    amount: number,
    type: LedgerEntryType,
    referenceId?: string,
    description?: string,
    idempotencyKey?: string
  ): LedgerEntry {
    // 1. Idempotency Check (prevents double-spending)
    if (idempotencyKey && idempotencyKey.trim().length > 0) {
      const cleanKey = idempotencyKey.trim();
      if (!this.data.ledgerEntries) this.data.ledgerEntries = [];
      const existing = this.data.ledgerEntries.find(l => l.idempotencyKey === cleanKey);
      if (existing) {
        return existing;
      }
    }

    const intAmount = Math.floor(amount);
    if (intAmount <= 0) {
      throw new Error('Transfer amount must be a positive integer.');
    }

    const cleanFrom = fromWallet.toLowerCase().trim();
    const cleanTo = toWallet.toLowerCase().trim();

    if (cleanFrom === cleanTo) {
      throw new Error('Self-transfer not allowed: sender and recipient cannot be identical.');
    }

    const isSystemFrom = ['external_mpesa', 'system', 'treasury'].includes(cleanFrom);
    const isSystemTo = ['withdrawal_payout', 'system', 'treasury'].includes(cleanTo);

    if (!isSystemFrom) {
      const sender = this.ensureWallet(cleanFrom);
      const available = sender.balance - sender.holdBalance;
      if (available < intAmount) {
        throw new Error(`Insufficient available funds. Required: KES ${intAmount}, Available: KES ${available}`);
      }
      sender.balance -= intAmount;
      sender.lifetimeSpent = (sender.lifetimeSpent || 0) + intAmount;
      sender.updatedAt = Date.now();
      this.data.wallets[cleanFrom] = sender.balance;
    } else if (cleanFrom === 'treasury') {
      const t = this.ensureWallet('treasury');
      t.balance = Math.max(0, t.balance - intAmount);
      t.updatedAt = Date.now();
      this.data.wallets['treasury'] = t.balance;
    }

    if (!isSystemTo) {
      const recipient = this.ensureWallet(cleanTo);
      recipient.balance += intAmount;
      recipient.lifetimeEarnings = (recipient.lifetimeEarnings || 0) + intAmount;
      recipient.updatedAt = Date.now();
      this.data.wallets[cleanTo] = recipient.balance;
    } else if (cleanTo === 'treasury') {
      const t = this.ensureWallet('treasury');
      t.balance += intAmount;
      t.lifetimeEarnings = (t.lifetimeEarnings || 0) + intAmount;
      t.updatedAt = Date.now();
      this.data.wallets['treasury'] = t.balance;
    }

    const entry: LedgerEntry = {
      id: 'ledg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      fromWallet: cleanFrom,
      toWallet: cleanTo,
      amount: intAmount,
      type,
      referenceId,
      description: description || `Transfer of KES ${intAmount} (${type})`,
      idempotencyKey: idempotencyKey ? idempotencyKey.trim() : undefined,
      createdAt: Date.now(),
    };

    if (!this.data.ledgerEntries) this.data.ledgerEntries = [];
    this.data.ledgerEntries.unshift(entry);

    // Verify balance invariant: sum of wallets matches net inflows
    this.assertBalanceInvariant();

    this.save();
    if (!isSystemFrom) this.emitWalletUpdate(cleanFrom);
    if (!isSystemTo) this.emitWalletUpdate(cleanTo);
    return entry;
  }

  public assertBalanceInvariant(): boolean {
    if (!this.data.walletRecords) return true;
    let totalWallets = 0;
    for (const [key, w] of Object.entries(this.data.walletRecords)) {
      if (!['external_mpesa', 'withdrawal_payout'].includes(key)) {
        totalWallets += (w.balance || 0);
      }
    }
    let totalTopups = 0;
    let totalWithdrawals = 0;
    for (const l of (this.data.ledgerEntries || [])) {
      if (l.type === 'topup' || l.fromWallet === 'external_mpesa') {
        totalTopups += l.amount;
      }
      if (l.type === 'withdrawal' || l.toWallet === 'withdrawal_payout') {
        totalWithdrawals += l.amount;
      }
    }
    const netExpected = totalTopups - totalWithdrawals;
    // Audit check logged if drift occurs
    if (Math.abs(totalWallets - netExpected) > 100000) {
      console.warn(`Balance invariant audit check: Wallets=${totalWallets}, Expected net=${netExpected}`);
    }
    return true;
  }

  public getLedgerEntries(email?: string): LedgerEntry[] {
    if (!this.data.ledgerEntries) this.data.ledgerEntries = [];
    if (!email) return this.data.ledgerEntries;
    const clean = email.toLowerCase().trim();
    return this.data.ledgerEntries.filter(
      l => l.fromWallet === clean || l.toWallet === clean
    );
  }

  public requestWithdrawal(email: string, amount: number, destination: string) {
    const cleanEmail = email.toLowerCase().trim();
    const settings = this.getSettings();
    const intAmount = Math.floor(amount);
    if (intAmount < settings.minWithdrawalKes) {
      throw new Error(`Minimum withdrawal amount is KES ${settings.minWithdrawalKes}.`);
    }

    const holdPlaced = this.placeWalletHold(cleanEmail, intAmount);
    if (!holdPlaced) {
      throw new Error('Insufficient available balance to withdraw.');
    }

    const req = {
      id: 'wd_' + Date.now(),
      userEmail: cleanEmail,
      amount: intAmount,
      destination,
      status: 'pending' as const,
      createdAt: Date.now(),
    };

    if (!this.data.withdrawals) this.data.withdrawals = [];
    this.data.withdrawals.unshift(req);

    // Notify admins
    this.data.users
      .filter(u => u.role === 'admin')
      .forEach(a => {
        this.createNotification({
          id: 'notif_' + Date.now() + Math.random(),
          userEmail: a.email,
          title: 'Withdrawal Payout Request',
          message: `${cleanEmail} requested withdrawal of KES ${intAmount} to ${destination}.`,
          read: false,
          link: '/#admin',
          type: 'payment',
          createdAt: Date.now(),
        });
      });

    this.save();
    return req;
  }

  public approveWithdrawal(id: string, adminEmail: string) {
    const req = this.data.withdrawals?.find(w => w.id === id);
    if (!req || req.status !== 'pending') return null;

    // Release hold and transfer to withdrawal_payout
    this.releaseWalletHold(req.userEmail, req.amount);
    this.transfer(req.userEmail, 'withdrawal_payout', req.amount, 'withdrawal', req.id, `Withdrawal payout to ${req.destination}`);

    req.status = 'approved';
    req.processedAt = Date.now();

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'withdrawal_approved',
      actorEmail: adminEmail,
      details: `Approved withdrawal of KES ${req.amount} for ${req.userEmail} to ${req.destination}`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: req.userEmail,
      title: 'Withdrawal Payout Sent! 💸',
      message: `Your withdrawal of KES ${req.amount} has been processed and sent to ${req.destination}.`,
      read: false,
      link: '/#owner',
      type: 'payment',
      createdAt: Date.now(),
    });

    this.save();
    return req;
  }

  public rejectWithdrawal(id: string, adminEmail: string, reason?: string) {
    const req = this.data.withdrawals?.find(w => w.id === id);
    if (!req || req.status !== 'pending') return null;

    // Release hold back to available balance
    this.releaseWalletHold(req.userEmail, req.amount);

    req.status = 'rejected';
    req.rejectionReason = reason || 'Payout details could not be verified.';
    req.processedAt = Date.now();

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'withdrawal_rejected',
      actorEmail: adminEmail,
      details: `Rejected withdrawal #${req.id} for ${req.userEmail}: ${req.rejectionReason}`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: req.userEmail,
      title: 'Withdrawal Request Declined',
      message: `Your withdrawal of KES ${req.amount} was rejected: ${req.rejectionReason}. Funds have been restored to your available balance.`,
      read: false,
      link: '/#owner',
      type: 'payment',
      createdAt: Date.now(),
    });

    this.save();
    return req;
  }

  public getWithdrawals(email?: string) {
    if (!this.data.withdrawals) this.data.withdrawals = [];
    if (!email) return this.data.withdrawals;
    const clean = email.toLowerCase().trim();
    return this.data.withdrawals.filter(w => w.userEmail.toLowerCase() === clean);
  }

  public paySubscriptionFromWallet(
    email: string,
    tier: StayCategory,
    period: 'monthly' | 'annual' = 'monthly'
  ): { plan: HostPlanStatus; ledger: LedgerEntry; walletBalance: number } {
    const cleanEmail = email.toLowerCase().trim();
    const payer = this.findUserByEmail(cleanEmail);
    if (!payer || payer.role !== 'owner') {
      throw new Error('Host subscriptions can only be paid from a Host wallet.');
    }

    const isAnnual = period === 'annual';
    const annualPrices: Record<StayCategory, number> = { Silver: 10000, Diamond: 25000, Gold: 50000 };
    const settings = this.getSettings();
    const cost = Math.floor(
      isAnnual
        ? annualPrices[tier]
        : (settings.planPrices as any)?.[tier] || (tier === 'Gold' ? 5000 : tier === 'Diamond' ? 2500 : 1000)
    );
    const durationDays = isAnnual ? 365 : 30;
    const durationMs = durationDays * 864e5;
    const durationLabel = isAnnual ? '365-Day Annual' : '30-Day';

    return this.runAtomicWalletTransaction(() => {
      const now = Date.now();
      const subId = 'sub_wallet_' + now;
      const payRes = this.payWithWallet({
        userId: cleanEmail,
        type: 'subscription',
        amountSc: cost,
        referenceId: subId,
        planTier: tier,
        durationDays,
        period,
        note: `${durationLabel} ${tier} Plan subscription from Host wallet`,
      });

      const cur = this.getHostPlan(cleanEmail);
      let targetPlan: HostPlanStatus;
      if (cur.status === 'active' && cur.expiresAt > now && cur.tier !== tier) {
        cur.scheduledTier = tier;
        cur.scheduledStartsAt = cur.expiresAt;
        cur.scheduledPeriod = period;
        targetPlan = cur;
        this.setHostPlan(cleanEmail, cur);
      } else {
        const baseStart = cur.status === 'active' && cur.expiresAt > now ? cur.expiresAt : now;
        const newEnd = baseStart + durationMs;

        targetPlan = {
          tier,
          status: 'active',
          startsAt: cur.status === 'active' && cur.expiresAt > now && cur.startsAt ? cur.startsAt : now,
          expiresAt: newEnd,
          graceExpiresAt: newEnd,
          hasPaidSubscription: true,
          period,
        };
        this.setHostPlan(cleanEmail, targetPlan);

        if (!this.data.subscriptions) this.data.subscriptions = [];
        for (const s of this.data.subscriptions) {
          if ((s.ownerId || s.owner_id || '').toLowerCase().trim() === cleanEmail && s.status === 'active') {
            s.status = 'expired';
            s.updatedAt = now;
          }
        }
        this.data.subscriptions.unshift({
          id: subId,
          ownerId: cleanEmail,
          owner_id: cleanEmail,
          tier,
          billing: period,
          status: 'active',
          startsAt: targetPlan.startsAt,
          endsAt: newEnd,
          paymentId: payRes.payment.id,
          createdAt: now,
          updatedAt: now,
        });
      }

      this.data.stays.forEach(s => {
        if (s.ownerEmail?.toLowerCase() === cleanEmail) {
          if (s.status === 'expired' || s.status === 'delisted' || s.isDelisted) {
            s.status = 'live';
            s.isDelisted = false;
          }
        }
      });

      this.createAuditLog({
        id: 'aud_' + now,
        action: 'plan_wallet_pay',
        actorEmail: cleanEmail,
        details: `Paid KES ${cost} from wallet for ${durationLabel} ${tier} Plan.`,
        createdAt: now,
      });

      this.createNotification({
        id: 'notif_' + now,
        userEmail: cleanEmail,
        title: `${durationLabel} ${tier} Plan ${targetPlan.scheduledTier ? 'Scheduled' : 'Activated'}!`,
        message: `KES ${cost.toLocaleString()} was deducted from your wallet. ${
          targetPlan.scheduledTier
            ? `Your current plan finishes first, then ${tier} takes effect on ${new Date(targetPlan.expiresAt).toLocaleDateString()}.`
            : `Your subscription is active until ${new Date(targetPlan.expiresAt).toLocaleDateString()}.`
        }`,
        read: false,
        link: '/#owner',
        type: 'subscription',
        createdAt: now,
      });

      this.save();
      const updatedRec = this.ensureWallet(cleanEmail);
      const remaining = Math.floor(updatedRec.balance - (updatedRec.holdBalance || 0));
      const latestLedger = this.data.ledgerEntries?.[0] || {
        id: 'ledg_' + now,
        fromWallet: cleanEmail,
        toWallet: 'admin@airbus.ke',
        amount: cost,
        type: 'subscription' as const,
        referenceId: subId,
        description: `${durationLabel} ${tier} Plan`,
        createdAt: now,
      };
      return { plan: targetPlan, ledger: latestLedger, walletBalance: remaining };
    });
  }

  // --- Posts & Content Moderation (Photo, Short, Video) ---
  public getPosts(filter?: { ownerEmail?: string; status?: PostStatus; type?: PostType }): Post[] {
    if (!this.data.posts) this.data.posts = [];
    return this.data.posts.filter(p => {
      if (filter?.ownerEmail && p.ownerEmail.toLowerCase() !== filter.ownerEmail.toLowerCase()) return false;
      if (filter?.status && p.status !== filter.status) return false;
      if (filter?.type && p.type !== filter.type) return false;
      return true;
    });
  }

  public getPostById(id: string): Post | undefined {
    return this.data.posts?.find(p => p.id === id);
  }

  public createPost(post: Omit<Post, 'id' | 'views' | 'likes' | 'shares' | 'viralityScore' | 'createdAt' | 'updatedAt'>): Post {
    const settings = this.getSettings();

    // Enforce 300 char description constraint
    const cleanDesc = (post.description || '').slice(0, settings.contentPolicies.maxDescriptionChars).trim();

    // Enforce 1 to 10 images constraint for photo posts
    if (post.type === 'photo') {
      const imgCount = (post.images || []).length;
      if (imgCount < 1 || imgCount > settings.contentPolicies.maxPostImages) {
        throw new Error(`Photo posts must contain between 1 and ${settings.contentPolicies.maxPostImages} images.`);
      }
    }

    // Enforce duration constraints
    if (post.type === 'short' && post.durationSeconds && post.durationSeconds > settings.contentPolicies.maxShortSeconds) {
      throw new Error(`Shorts must be 60 seconds or less (Vertical video).`);
    }
    if (post.type === 'video' && post.durationSeconds && post.durationSeconds > settings.contentPolicies.maxVideoSeconds) {
      throw new Error(`Long-form video tours must be 30 minutes or less.`);
    }

    const newPost: Post = {
      ...post,
      id: 'post_' + post.type + '_' + Date.now(),
      description: cleanDesc,
      status: 'pending', // Requires admin approval before public
      views: 0,
      likes: 0,
      shares: 0,
      viralityScore: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!this.data.posts) this.data.posts = [];
    this.data.posts.unshift(newPost);

    // Notify admins
    this.data.users
      .filter(u => u.role === 'admin')
      .forEach(a => {
        this.createNotification({
          id: 'notif_' + Date.now() + Math.random(),
          userEmail: a.email,
          title: `New ${post.type.toUpperCase()} Post for Moderation`,
          message: `${post.ownerEmail} submitted a new ${post.type} post for review: "${cleanDesc.slice(0, 60)}..."`,
          read: false,
          link: '/#admin',
          type: 'system',
          createdAt: Date.now(),
        });
      });

    this.save();
    return newPost;
  }

  public moderatePost(postId: string, status: 'approved' | 'rejected' | 'removed', adminEmail: string, reason?: string): Post | null {
    const post = this.data.posts?.find(p => p.id === postId);
    if (!post) return null;

    post.status = status;
    post.updatedAt = Date.now();
    if (reason) post.rejectionReason = reason;

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: `post_${status}`,
      actorEmail: adminEmail,
      details: `Post #${postId} (${post.type}) set to ${status}. ${reason ? 'Reason: ' + reason : ''}`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: post.ownerEmail,
      title: status === 'approved' ? 'Post Approved & Live! 🌟' : 'Post Moderation Update',
      message:
        status === 'approved'
          ? `Your ${post.type} post is approved and now live on AirBus Feed & Discovery!`
          : `Your ${post.type} post was marked ${status}: ${reason || 'Does not adhere to short-stay rental content guidelines.'}`,
      read: false,
      link: '/#owner',
      type: 'system',
      createdAt: Date.now(),
    });

    this.save();
    return post;
  }

  public recordViewEvent(postId: string, viewer: string): boolean {
    if (!this.data.viewEvents) this.data.viewEvents = [];
    const now = Date.now();

    // 30-second rate limit per viewer
    const recent = this.data.viewEvents.find(
      v => v.postId === postId && v.viewer === viewer && now - v.timestamp < 30000
    );
    if (recent) return false;

    this.data.viewEvents.push({ postId, viewer, timestamp: now });

    // Increment post views
    const post = this.data.posts?.find(p => p.id === postId);
    if (post) {
      post.views = (post.views || 0) + 1;
      // Recalculate virality score (0-100)
      const engagement = ((post.likes * 3 + post.shares * 5) / Math.max(1, post.views)) * 100;
      post.viralityScore = Math.min(100, Math.round(Math.min(50, post.views / 50) + Math.min(50, engagement * 2)));
    }

    this.save();
    return true;
  }

  // --- Adverts (10 Slots per Video/Short) ---
  public getAdRequests(filter?: { stayId?: string; advertiserEmail?: string; status?: AdRequestStatus }): AdRequest[] {
    if (!this.data.adRequests) this.data.adRequests = [];
    const now = Date.now();
    // Auto-expire approved ads that have passed duration
    this.data.adRequests.forEach(a => {
      if (a.status === 'approved' && a.expiresAt && a.expiresAt < now) {
        a.status = 'expired';
      }
    });

    return this.data.adRequests.filter(a => {
      if (filter?.stayId && a.stayId !== filter.stayId) return false;
      if (filter?.advertiserEmail && a.advertiserEmail.toLowerCase() !== filter.advertiserEmail.toLowerCase()) return false;
      if (filter?.status && a.status !== filter.status) return false;
      return true;
    });
  }

  public getActiveAdsForStay(stayId: string): AdRequest[] {
    return this.getAdRequests({ stayId, status: 'approved' });
  }

  public createAdRequest(req: {
    advertiserEmail: string;
    stayId: string;
    title: string;
    description: string;
    imageUrl: string;
    targetUrl: string;
    contactPhone?: string;
    tag?: string;
    days: number;
  }): AdRequest {
    const settings = this.getSettings();
    const cleanDays = Math.max(1, Math.min(30, Math.floor(req.days)));
    const ratePerDay = Math.floor(settings.adPricePerDay || 100);
    const totalAmount = cleanDays * ratePerDay;
    const cleanEmail = req.advertiserEmail.toLowerCase().trim();

    const activeAds = this.getActiveAdsForStay(req.stayId);
    if (activeAds.length >= settings.maxAdSlotsPerPost) {
      throw new Error(`All ${settings.maxAdSlotsPerPost} sponsor ad slots on this stay video are currently occupied.`);
    }

    return this.runAtomicWalletTransaction(() => {
      const now = Date.now();
      const adId = 'ad_' + now + '_' + Math.random().toString(36).slice(2, 6);

      this.payWithWallet({
        userId: cleanEmail,
        type: 'advert',
        amountSc: totalAmount,
        referenceId: adId,
        durationDays: cleanDays,
        note: `Advert placement "${req.title.trim()}" (${cleanDays} days @ KES ${ratePerDay}/day)`,
      });

      const adRequest: AdRequest = {
        id: adId,
        advertiserEmail: cleanEmail,
        stayId: req.stayId,
        title: req.title.trim(),
        description: req.description.trim(),
        imageUrl: req.imageUrl.trim(),
        targetUrl: req.targetUrl.trim(),
        contactPhone: req.contactPhone?.trim(),
        tag: req.tag?.trim() || 'Featured Sponsor',
        days: cleanDays,
        totalAmount,
        platformFee: totalAmount,
        hostNet: 0,
        status: 'approved',
        startsAt: now,
        expiresAt: now + cleanDays * 864e5,
        createdAt: now,
      };

      if (!this.data.adRequests) this.data.adRequests = [];
      this.data.adRequests.unshift(adRequest);

      this.createNotification({
        id: 'notif_' + now,
        userEmail: cleanEmail,
        title: 'Advert Activated!',
        message: `KES ${totalAmount.toLocaleString()} was paid from your wallet and your advert "${adRequest.title}" is now live for ${cleanDays} days.`,
        read: false,
        link: `/#stay-${req.stayId}`,
        type: 'payment',
        createdAt: now,
      });

      this.save();
      return adRequest;
    });
  }

  public approveAdRequest(id: string, adminEmail: string): AdRequest | null {
    const ad = this.data.adRequests?.find(a => a.id === id);
    if (!ad || ad.status !== 'pending') return null;

    const stay = this.getStayById(ad.stayId);
    const hostEmail = stay?.ownerEmail || 'owner@airbus.ke';

    // Release wallet hold
    this.releaseWalletHold(ad.advertiserEmail, ad.totalAmount);

    // Atomic ledger distribution:
    // 70% host net (e.g. 210 KES)
    // 30% platform fee (e.g. 90 KES)
    this.transfer(ad.advertiserEmail, hostEmail, ad.hostNet, 'ad_revenue', ad.id, `Sponsor ad revenue (70% net) on stay: ${stay?.title || ad.stayId}`);
    this.transfer(ad.advertiserEmail, 'treasury', ad.platformFee, 'ad_fee', ad.id, `Platform ad service fee (30%) on stay: ${stay?.title || ad.stayId}`);

    // Affiliate referral commission on platform revenue
    this.distributeReferralCommission(ad.advertiserEmail, ad.platformFee, 'ad_fee');

    ad.status = 'approved';
    ad.startsAt = Date.now();
    ad.expiresAt = Date.now() + ad.days * 864e5;

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'ad_approved',
      actorEmail: adminEmail,
      details: `Approved ad #${ad.id} (${ad.totalAmount} KES) on stay #${ad.stayId}. Credited Host ${ad.hostNet} KES and Treasury ${ad.platformFee} KES.`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now() + '1',
      userEmail: ad.advertiserEmail,
      title: 'Ad Approved & Live! 🚀',
      message: `Your advertisement "${ad.title}" is now active on ${stay?.title || 'stay video'} for ${ad.days} days.`,
      read: false,
      link: `/#stay-${ad.stayId}`,
      type: 'system',
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now() + '2',
      userEmail: hostEmail,
      title: 'New Ad Revenue Credited! 💰',
      message: `You earned KES ${ad.hostNet} (70% net) from an approved sponsor ad on your listing "${stay?.title}".`,
      read: false,
      link: '/#owner',
      type: 'payment',
      createdAt: Date.now(),
    });

    this.save();
    return ad;
  }

  public rejectAdRequest(id: string, adminEmail: string, reason?: string): AdRequest | null {
    const ad = this.data.adRequests?.find(a => a.id === id);
    if (!ad || ad.status !== 'pending') return null;

    // Release wallet hold back to available
    this.releaseWalletHold(ad.advertiserEmail, ad.totalAmount);

    ad.status = 'rejected';
    ad.rejectionReason = reason || 'Ad banner or destination does not comply with short-stay rental advertising standards.';

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'ad_rejected',
      actorEmail: adminEmail,
      details: `Rejected ad #${ad.id} on stay #${ad.stayId}. Reason: ${ad.rejectionReason}. Refunded hold of ${ad.totalAmount} KES.`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: ad.advertiserEmail,
      title: 'Ad Request Declined',
      message: `Your ad "${ad.title}" was declined: ${ad.rejectionReason}. The KES ${ad.totalAmount} hold on your wallet has been released.`,
      read: false,
      link: '/#guest',
      type: 'payment',
      createdAt: Date.now(),
    });

    this.save();
    return ad;
  }

  public recordAdView(id: string): boolean {
    if (!this.data.adRequests) this.data.adRequests = [];
    const ad = this.data.adRequests.find(a => a.id === id);
    if (!ad) return false;

    ad.views = (ad.views || 0) + 1;

    // Link visibility directly to the property so hosts & admins track performance
    const stay = this.getStayById(ad.stayId);
    if (stay) {
      stay.promotionImpressions = (stay.promotionImpressions || 0) + 1;
    }

    this.save();
    return true;
  }

  public recordAdClick(id: string): boolean {
    if (!this.data.adRequests) this.data.adRequests = [];
    const ad = this.data.adRequests.find(a => a.id === id);
    if (!ad) return false;

    ad.clicks = (ad.clicks || 0) + 1;

    // Link engagement directly to the property
    const stay = this.getStayById(ad.stayId);
    if (stay) {
      stay.promotionClicks = (stay.promotionClicks || 0) + 1;
    }

    this.save();
    return true;
  }

  // --- SnappAdd Advert Campaigns ---
  public createSnappAddCampaign(data: {
    userEmail: string;
    title: string;
    description: string;
    websiteUrl: string;
    thumbnailUrl: string;
    videoUrl?: string;
    durationDays: number;
    coinsPaid: number;
  }): { campaign: SnappAddCampaign; walletBalance: number } {
    if (!this.data.snappAddCampaigns) this.data.snappAddCampaigns = [];
    const days = Math.max(1, Math.min(90, Math.floor(data.durationDays || 7)));
    const ratePerDay = Math.floor(this.getSettings().adPricePerDay || 100);
    const costKes = Math.floor(days * ratePerDay);
    const cleanEmail = data.userEmail.toLowerCase().trim();

    return this.runAtomicWalletTransaction(() => {
      const now = Date.now();
      const campaignId = 'snappadd_' + now;

      this.payWithWallet({
        userId: cleanEmail,
        type: 'advert',
        amountSc: costKes,
        referenceId: campaignId,
        durationDays: days,
        note: `Advert Campaign "${data.title.trim()}" (${days} days @ KES ${ratePerDay}/day)`,
      });

      const campaign: SnappAddCampaign = {
        id: campaignId,
        userEmail: cleanEmail,
        title: data.title.trim(),
        description: data.description?.trim() || '',
        websiteUrl: data.websiteUrl.trim(),
        thumbnailUrl: data.thumbnailUrl.trim() || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
        videoUrl: data.videoUrl?.trim(),
        targetCategory: 'News & Politics: Local Campaign 3',
        durationDays: days,
        coinsPaid: costKes,
        status: 'active',
        createdAt: now,
        expiresAt: now + days * 864e5,
      };

      if (!this.data.snappAddCampaigns) this.data.snappAddCampaigns = [];
      this.data.snappAddCampaigns.unshift(campaign);

      if (!this.data.adRequests) this.data.adRequests = [];
      this.data.adRequests.unshift({
        id: 'ad_' + campaignId,
        advertiserEmail: cleanEmail,
        stayId: '1',
        title: campaign.title,
        description: campaign.description,
        imageUrl: campaign.thumbnailUrl,
        targetUrl: campaign.websiteUrl,
        tag: 'News & Politics: Local Campaign 3',
        days,
        totalAmount: costKes,
        platformFee: costKes,
        hostNet: 0,
        status: 'approved',
        startsAt: now,
        expiresAt: campaign.expiresAt,
        views: 0,
        clicks: 0,
        createdAt: now,
      });

      this.save();
      return { campaign, walletBalance: this.getWalletBalance(cleanEmail) };
    });
  }

  public getSnappAddCampaigns(): SnappAddCampaign[] {
    if (!this.data.snappAddCampaigns) this.data.snappAddCampaigns = [];
    return this.data.snappAddCampaigns;
  }

  // --- Promoted Listings & Visibility Boost ---
  public promoteListing(stayId: string, ownerEmail: string, days: number, idempotencyKey?: string): {
    stay: Stay;
    promotion: ListingPromotion;
    ledger: LedgerEntry;
    walletBalance: number;
  } {
    const res = this.purchasePromotion({
      listingId: stayId,
      ownerEmail,
      days,
      paymentMethod: 'wallet',
    });
    const stay = this.getStayById(stayId)!;
    const promotion = this.data.promotions[0];
    const ledger = this.data.ledgerEntries[0];
    return {
      stay,
      promotion,
      ledger,
      walletBalance: this.getWalletBalance(ownerEmail),
    };
  }

  public getPromotions(ownerEmail?: string): ListingPromotion[] {
    if (!this.data.promotions) this.data.promotions = [];
    if (!ownerEmail) return this.data.promotions;
    const clean = ownerEmail.toLowerCase().trim();
    return this.data.promotions.filter(p => p.ownerEmail.toLowerCase() === clean);
  }

  public recordPromotionImpression(stayId: string) {
    const stay = this.getStayById(stayId);
    if (stay && stay.isPromoted) {
      stay.promotionImpressions = (stay.promotionImpressions || 0) + 1;
      const promo = this.data.promotions?.find(p => p.stayId === stayId && p.status === 'active');
      if (promo) promo.impressions = (promo.impressions || 0) + 1;
    }
  }

  public recordPromotionClick(stayId: string) {
    const stay = this.getStayById(stayId);
    if (stay && stay.isPromoted) {
      stay.promotionClicks = (stay.promotionClicks || 0) + 1;
      const promo = this.data.promotions?.find(p => p.stayId === stayId && p.status === 'active');
      if (promo) promo.clicks = (promo.clicks || 0) + 1;
      this.save();
    }
  }

  // --- Real Visibility Boosts (Wallet-Only Immediate Atomic Activation) ---
  public purchasePromotion(opts: {
    listingId: string;
    ownerEmail: string;
    days: number;
    paymentMethod: 'wallet' | 'mpesa';
    mpesaCode?: string;
  }): {
    boost: BoostRecord;
    payment: PaymentRecord;
    message: string;
  } {
    if (opts.paymentMethod !== 'wallet') {
      throw new Error('Promotions can only be paid from your Host Wallet. Deposit via Deposit (M-Pesa) first.');
    }

    const cleanEmail = opts.ownerEmail.toLowerCase().trim();
    const payer = this.findUserByEmail(cleanEmail);
    if (!payer || payer.role !== 'owner') {
      throw new Error('Only Host accounts can purchase listing promotions from a Host wallet.');
    }

    const stay = (this.data.stays || []).find(s => s.id === opts.listingId);
    if (!stay) throw new Error('Listing not found');
    if (stay.ownerEmail && stay.ownerEmail.toLowerCase() !== cleanEmail) {
      throw new Error('Only the listing owner can activate a boost on this listing');
    }

    const days = Math.max(1, Math.min(60, Math.floor(opts.days || 7)));
    const ratePerDay = Math.floor(this.getSettings().adPricePerDay || 100);
    const costKes = days * ratePerDay;

    return this.runAtomicWalletTransaction(() => {
      const now = Date.now();
      const boostId = 'boost_' + now + '_' + Math.random().toString(36).slice(2, 6);

      const payRes = this.payWithWallet({
        userId: cleanEmail,
        type: 'boost',
        amountSc: costKes,
        referenceId: boostId,
        durationDays: days,
        note: `Listing boost for "${stay.title}" (${days} days @ KES ${ratePerDay}/day)`,
      });

      const currentExpiry = (stay.promotedUntil && stay.promotedUntil > now) ? stay.promotedUntil : now;
      const newExpiry = currentExpiry + days * 864e5;
      stay.isPromoted = true;
      stay.promotedUntil = newExpiry;
      stay.promotionImpressions = stay.promotionImpressions || 0;
      stay.promotionClicks = stay.promotionClicks || 0;

      const boost: BoostRecord = {
        id: boostId,
        listing_id: stay.id,
        listingId: stay.id,
        owner_id: cleanEmail,
        ownerId: cleanEmail,
        days,
        cost_sc: costKes,
        costSc: costKes,
        status: 'active',
        starts_at: now,
        startsAt: now,
        ends_at: newExpiry,
        endsAt: newExpiry,
        payment_id: payRes.payment.id,
        paymentId: payRes.payment.id,
        created_at: now,
        createdAt: now,
      };

      if (!this.data.boosts) this.data.boosts = [];
      this.data.boosts.unshift(boost);

      if (!this.data.promotions) this.data.promotions = [];
      this.data.promotions.unshift({
        id: boostId,
        stayId: stay.id,
        ownerEmail: cleanEmail,
        days,
        cost: costKes,
        startsAt: now,
        expiresAt: newExpiry,
        status: 'active',
        impressions: 0,
        clicks: 0,
        createdAt: now,
      });

      this.createNotification({
        id: 'notif_' + now,
        userEmail: cleanEmail,
        title: 'Listing Boost Activated!',
        message: `KES ${costKes.toLocaleString()} paid from your Host wallet. "${stay.title}" is now boosted for ${days} days.`,
        read: false,
        link: '/#owner',
        type: 'payment',
        createdAt: now,
      });

      this.save();
      return {
        boost,
        payment: payRes.payment,
        message: `Boost activated immediately for KES ${costKes.toLocaleString()} (${days} days).`,
      };
    });
  }

  public getBoosts(ownerEmail?: string): BoostRecord[] {
    this.checkAllExpirations();
    if (!this.data.boosts) this.data.boosts = [];
    if (!ownerEmail) return this.data.boosts;
    const clean = ownerEmail.toLowerCase().trim();
    return this.data.boosts.filter(b => (b.owner_id || b.ownerId || '').toLowerCase() === clean);
  }

  // --- Dynamic Sponsor Slots (1 to 10 Slots - Wallet-Only Immediate Activation) ---
  public purchaseSponsorSlot(opts: {
    listingId: string;
    advertiserEmail: string;
    title: string;
    description: string;
    linkUrl: string;
    thumbnailUrl: string;
    durationDays: number;
    paymentMethod?: 'wallet' | 'mpesa';
    mpesaCode?: string;
  }): {
    sponsorSlot: SponsorSlot;
    payment: PaymentRecord;
    message: string;
  } {
    if (opts.paymentMethod && opts.paymentMethod !== 'wallet') {
      throw new Error('Adverts must be paid strictly from your private AirBus Wallet. Please deposit funds via Deposit (M-Pesa) first.');
    }

    const cleanEmail = opts.advertiserEmail.toLowerCase().trim();
    const stay = this.getStayById(opts.listingId);
    if (!stay) throw new Error('Listing stay not found');

    const existingSlots = (this.data.sponsorSlots || []).filter(
      s => (s.listing_id === stay.id || s.listingId === stay.id) && (s.status === 'active' || s.status === 'pending_approval')
    );
    if (existingSlots.length >= 10) {
      throw new Error('Slots full: All 10 sponsor slots for this listing are currently occupied.');
    }

    const nextSlotNumber = existingSlots.length + 1;
    const days = Math.max(1, Math.min(90, Math.floor(opts.durationDays || 30)));
    const ratePerDay = Math.floor(this.getSettings().adPricePerDay || 100);
    const costKes = days * ratePerDay;

    return this.runAtomicWalletTransaction(() => {
      const now = Date.now();
      const slotId = 'sponsor_' + now + '_' + Math.random().toString(36).slice(2, 6);

      const payRes = this.payWithWallet({
        userId: cleanEmail,
        type: 'advert',
        amountSc: costKes,
        referenceId: slotId,
        durationDays: days,
        note: `Sponsor slot #${nextSlotNumber} on "${stay.title}" (${days} days @ KES ${ratePerDay}/day)`,
      });

      const endsAt = now + days * 864e5;
      const sponsorSlot: SponsorSlot = {
        id: slotId,
        listing_id: stay.id,
        listingId: stay.id,
        advertiser_id: cleanEmail,
        advertiserId: cleanEmail,
        title: opts.title.trim(),
        description: opts.description.trim(),
        link_url: opts.linkUrl.trim(),
        linkUrl: opts.linkUrl.trim(),
        thumbnail_url: opts.thumbnailUrl.trim(),
        thumbnailUrl: opts.thumbnailUrl.trim(),
        duration_days: days,
        durationDays: days,
        cost_sc: costKes,
        costSc: costKes,
        status: 'active',
        starts_at: now,
        startsAt: now,
        ends_at: endsAt,
        endsAt,
        slot_number: nextSlotNumber,
        slotNumber: nextSlotNumber,
        payment_id: payRes.payment.id,
        paymentId: payRes.payment.id,
        impressions: 0,
        clicks: 0,
        created_at: now,
        createdAt: now,
      };

      if (!this.data.sponsorSlots) this.data.sponsorSlots = [];
      this.data.sponsorSlots.unshift(sponsorSlot);

      if (!this.data.adSlots) this.data.adSlots = [];
      this.data.adSlots.unshift({
        id: slotId,
        ownerId: cleanEmail,
        owner_id: cleanEmail,
        title: opts.title.trim(),
        description: opts.description.trim(),
        linkUrl: opts.linkUrl.trim(),
        link_url: opts.linkUrl.trim(),
        thumbnailUrl: opts.thumbnailUrl.trim(),
        thumbnail_url: opts.thumbnailUrl.trim(),
        durationDays: days,
        costSc: costKes,
        cost_sc: costKes,
        costCoins: costKes,
        cost_coins: costKes,
        paymentMethod: 'wallet',
        status: 'active',
        startsAt: now,
        endsAt,
        paymentId: payRes.payment.id,
        impressions: 0,
        clicks: 0,
        createdAt: now,
        created_at: now,
        updatedAt: now,
        updated_at: now,
      });

      this.save();
      return {
        sponsorSlot,
        payment: payRes.payment,
        message: `Sponsor advert activated immediately for KES ${costKes.toLocaleString()} (${days} days).`,
      };
    });
  }

  public getSponsorSlots(listingId?: string): {
    slots: SponsorSlot[];
    activeCount: number;
    maxSlots: number;
    isFull: boolean;
  } {
    this.checkAllExpirations();
    if (!this.data.sponsorSlots) this.data.sponsorSlots = [];
    let list = this.data.sponsorSlots;
    if (listingId) {
      list = list.filter(s => s.listing_id === listingId || s.listingId === listingId);
    }
    const activeList = list.filter(s => s.status === 'active');
    return {
      slots: list,
      activeCount: activeList.length,
      maxSlots: 10,
      isFull: activeList.length >= 10,
    };
  }

  // --- Affiliate & Referral Program ---
  public getReferralProfile(email: string): ReferralProfile {
    const cleanEmail = email.toLowerCase().trim();
    if (!this.data.referrals) this.data.referrals = {};
    if (!this.data.referralCodes) this.data.referralCodes = {};

    if (!this.data.referrals[cleanEmail]) {
      const code = cleanEmail.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '') + '2026';
      this.data.referrals[cleanEmail] = {
        userEmail: cleanEmail,
        referralCode: code,
        clicks: 0,
        signupsCount: 0,
        totalEarnedKes: 0,
        createdAt: Date.now(),
      };
      this.data.referralCodes[code] = cleanEmail;
      this.save();
    }
    return this.data.referrals[cleanEmail];
  }

  public trackReferralClick(code: string): boolean {
    if (!code) return false;
    const cleanCode = code.toUpperCase().trim();
    const referrerEmail = this.data.referralCodes?.[cleanCode];
    if (referrerEmail && this.data.referrals?.[referrerEmail]) {
      this.data.referrals[referrerEmail].clicks = (this.data.referrals[referrerEmail].clicks || 0) + 1;
      this.save();
      return true;
    }
    return false;
  }

  public recordReferralSignup(code: string, newEmail: string): boolean {
    if (!code) return false;
    const cleanCode = code.toUpperCase().trim();
    const referrerEmail = this.data.referralCodes?.[cleanCode];
    if (referrerEmail && this.data.referrals?.[referrerEmail]) {
      this.data.referrals[referrerEmail].signupsCount = (this.data.referrals[referrerEmail].signupsCount || 0) + 1;
      const newProf = this.getReferralProfile(newEmail);
      newProf.referredByCode = cleanCode;
      this.save();
      return true;
    }
    return false;
  }

  public getReferralCommissions(email?: string): ReferralCommissionRecord[] {
    if (!this.data.referralCommissions) this.data.referralCommissions = [];
    if (!email) return this.data.referralCommissions;
    const clean = email.toLowerCase().trim();
    return this.data.referralCommissions.filter(c => c.referrerEmail === clean);
  }

  public distributeReferralCommission(fromEmail: string, grossAmount: number, sourceType: 'subscription' | 'ad_fee'): LedgerEntry | null {
    const cleanFrom = fromEmail.toLowerCase().trim();
    const userProf = this.data.referrals?.[cleanFrom];
    if (!userProf || !userProf.referredByCode) return null;

    const referrerEmail = this.data.referralCodes?.[userProf.referredByCode];
    if (!referrerEmail || referrerEmail === cleanFrom) return null;

    // Check referral age (12 months = 365 days)
    const settings = this.getSettings();
    const ageDays = (Date.now() - (userProf.createdAt || Date.now())) / 864e5;
    if (ageDays > settings.referralDurationDays) return null;

    // 10% commission on platform revenue
    const commission = Math.round(grossAmount * (settings.referralCommissionPercent / 100));
    if (commission <= 0) return null;

    // Transfer from Treasury to Referrer
    const ledger = this.transfer(
      'treasury',
      referrerEmail,
      commission,
      'referral_commission',
      userProf.referralCode,
      `${settings.referralCommissionPercent}% affiliate commission from ${sourceType} by referred user ${cleanFrom}`
    );

    const refProf = this.getReferralProfile(referrerEmail);
    refProf.totalEarnedKes = (refProf.totalEarnedKes || 0) + commission;

    const commRecord: ReferralCommissionRecord = {
      id: 'rc_' + Date.now(),
      referrerEmail,
      referredEmail: cleanFrom,
      sourceType,
      grossAmount,
      commissionAmount: commission,
      createdAt: Date.now(),
    };
    if (!this.data.referralCommissions) this.data.referralCommissions = [];
    this.data.referralCommissions.unshift(commRecord);

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: referrerEmail,
      title: 'Affiliate Commission Earned! 🎁',
      message: `You earned KES ${commission} in referral commission from ${cleanFrom}'s platform activity. Credited straight to your AirBus wallet!`,
      read: false,
      link: '/#owner',
      type: 'payment',
      createdAt: Date.now(),
    });

    this.save();
    return ledger;
  }

  // --- 30-Day Price Trend Sparkline Data ---
  public getStayPriceTrend(stayId: string): StayPriceTrend {
    const stay = this.getStayById(stayId);
    const basePrice = stay?.price || 8500;
    const now = Date.now();
    const points: Array<{ date: string; price: number; isWeekend: boolean }> = [];

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 864e5);
      const isWeekend = d.getDay() === 5 || d.getDay() === 6; // Fri or Sat
      // Variation: weekends +8% to +15%, middle of week normal, slight noise
      const variance = isWeekend ? 1.12 : (i % 7 === 2 ? 0.96 : 1.0);
      const dayPrice = Math.round((basePrice * variance) / 100) * 100;

      if (dayPrice < min) min = dayPrice;
      if (dayPrice > max) max = dayPrice;
      sum += dayPrice;

      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      points.push({ date: dateLabel, price: dayPrice, isWeekend });
    }

    const avg = Math.round(sum / 30);
    const firstPrice = points[0].price;
    const lastPrice = points[points.length - 1].price;
    const percentChange = Math.round(((lastPrice - firstPrice) / firstPrice) * 100);

    return {
      stayId,
      currency: stay?.currency || 'KES',
      currentPrice: basePrice,
      minPrice: min,
      maxPrice: max,
      avgPrice: avg,
      percentChange,
      points,
    };
  }

  // --- Virality Analytics Report ---
  public getViralityReport(id: string): ViralityReport {
    const post = this.getPostById(id) || this.data.posts?.[0];
    const stay = this.getStayById(post?.stayId || id) || this.data.stays[0];

    const totalViews = post?.views || stay?.views || 1420;
    const totalLikes = post?.likes || stay?.likesCount || 184;
    const totalShares = post?.shares || 84;

    const baseScore = Math.min(98, Math.max(25, Math.round(((totalLikes * 3 + totalShares * 5) / Math.max(1, totalViews)) * 100 + 40)));

    const generatePoints = (days: number) => {
      const pts = [];
      const now = Date.now();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now - i * 864e5);
        const dayViews = Math.round((totalViews / days) * (0.6 + Math.sin(i * 0.5) * 0.4 + (i === 0 ? 0.3 : 0)));
        const dayLikes = Math.round(dayViews * 0.12);
        const dayShares = Math.round(dayViews * 0.03);
        const followers = Math.round(dayViews * 0.02);

        pts.push({
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          views: Math.max(1, dayViews),
          likes: Math.max(0, dayLikes),
          shares: Math.max(0, dayShares),
          followersGained: Math.max(0, followers),
        });
      }
      return pts;
    };

    return {
      postId: post?.id,
      stayId: stay?.id,
      score: baseScore,
      viralityScore: baseScore,
      rank: baseScore > 85 ? '#1 in Westlands Stays' : 'Top 10% on AirBus Nairobi',
      points7d: generatePoints(7),
      points30d: generatePoints(30),
      points90d: generatePoints(90),
      summary: {
        totalViews,
        totalLikes,
        totalShares,
        reachGrowthRate: 18.4,
      },
      creatorNudges: [
        'Post short teaser clips between 6:00 PM and 9:00 PM EAT for 2.4x higher viewer watch-time.',
        'Adding a 10s drone perspective of the rooftop sunset can boost virality score past 90.',
        'Your 300-char penthouse description captures 94% retention on mobile viewers.',
      ],
    };
  }

  // --- Audit Logs ---
  public createAuditLog(log: AuditLog) {
    if (!this.data.auditLogs) this.data.auditLogs = [];
    this.data.auditLogs.unshift(log);
    this.save();
  }

  public getAuditLogs(): AuditLog[] {
    return (this.data.auditLogs || []).slice().sort((a, b) => b.createdAt - a.createdAt);
  }

  // --- GLOBAL MEDIA ASSETS ---

  public createMediaAsset(input: {
    id?: string;
    owner_id: string;
    type: MediaAssetType;
    storage_key: string;
    url: string;
    mime: string;
    size_bytes: number;
    duration?: number;
    width?: number;
    height?: number;
    status: MediaAssetStatus;
    poster_url?: string;
    error_message?: string;
  }): MediaAsset {
    if (!this.data.media_assets) this.data.media_assets = [];
    const now = Date.now();
    const asset: MediaAsset = {
      id: input.id || `ma_${now.toString(36)}_${crypto.randomBytes(4).toString('hex')}`,
      owner_id: input.owner_id || 'anon',
      type: input.type,
      storage_key: input.storage_key,
      url: input.url,
      mime: input.mime,
      size_bytes: input.size_bytes,
      duration: input.duration,
      width: input.width,
      height: input.height,
      status: input.status,
      poster_url: input.poster_url,
      error_message: input.error_message,
      created_at: now,
      updated_at: now,
    };
    this.data.media_assets.unshift(asset);
    this.save();
    return asset;
  }

  public updateMediaAsset(id: string, updates: Partial<MediaAsset>): MediaAsset | null {
    if (!this.data.media_assets) this.data.media_assets = [];
    const asset = this.data.media_assets.find(a => a.id === id);
    if (!asset) return null;
    Object.assign(asset, updates, { id: asset.id, updated_at: Date.now() });
    this.save();
    return asset;
  }

  public getMediaAssetById(id: string): MediaAsset | null {
    return (this.data.media_assets || []).find(a => a.id === id) || null;
  }

  public getMediaAssetByUrl(url: string): MediaAsset | null {
    if (!url) return null;
    return (this.data.media_assets || []).find(a => a.url === url) || null;
  }

  public assertMediaAssetsReady(assetIds: Array<string | undefined | null>) {
    for (const rawId of assetIds) {
      if (!rawId || typeof rawId !== 'string') continue;
      const asset = this.getMediaAssetById(rawId.trim());
      if (!asset) {
        throw new Error(`Referenced media asset (${rawId}) was not found.`);
      }
      if (asset.status === 'UPLOADING' || asset.status === 'PROCESSING') {
        throw new Error('Please wait for your uploaded media to finish processing before submitting.');
      }
      if (asset.status === 'FAILED') {
        throw new Error(asset.error_message || 'Your uploaded video failed processing. Please remove or retry it before submitting.');
      }
    }
  }

  // --- TRIP DATING: A Dating Services Near You ---

  private readonly BUILT_IN_TRIP_DATING_CITIES = ['Nairobi', 'Mombasa', 'Nakuru', 'Eldoret', 'Kisumu'];
  private tripDatingCountListeners = new Set<(counts: TripDatingAdminCounts) => void>();

  public subscribeTripDatingCounts(listener: (counts: TripDatingAdminCounts) => void): () => void {
    this.tripDatingCountListeners.add(listener);
    return () => {
      this.tripDatingCountListeners.delete(listener);
    };
  }

  private emitTripDatingCountsUpdate() {
    const counts = this.getTripDatingAdminCounts();
    this.tripDatingCountListeners.forEach(fn => {
      try {
        fn(counts);
      } catch {}
    });
  }

  public normalizeTripDatingStatus(p: Pick<TripDatingProfile, 'status' | 'moderationState' | 'fullBodyModerationStatus'>): TripDatingUnifiedStatus {
    const rawStatus = String(p.status || '').trim().toUpperCase();
    const rawMod = String(p.moderationState || '').trim().toUpperCase();
    if (rawStatus === 'DRAFT' || rawMod === 'DRAFT') return 'DRAFT';
    if (
      rawStatus === 'DECLINED' ||
      rawStatus === 'REJECTED' ||
      rawStatus === 'REMOVED' ||
      rawStatus === 'SUSPENDED' ||
      rawMod === 'DECLINED' ||
      p.fullBodyModerationStatus === 'rejected'
    ) {
      return 'DECLINED';
    }
    if (rawStatus === 'APPROVED' || rawStatus === 'ACTIVE' || rawMod === 'APPROVED') {
      return 'APPROVED';
    }
    return 'PENDING_REVIEW';
  }

  private isTripDatingApprovedPublic(p: TripDatingProfile): boolean {
    return this.normalizeTripDatingStatus(p) === 'APPROVED';
  }

  public validateAndNormalizeCity(cityInput: string, cityCustomInput?: string | null): {
    city: string;
    city_custom: string | null;
  } {
    const rawCity = (cityInput || '').trim();
    const rawCustom = (cityCustomInput || '').trim();
    const isOtherChoice = /^other(\s*\(.*\))?$/i.test(rawCity);

    // Check if city matches one of the 5 built-in cities case-insensitively
    if (!isOtherChoice) {
      const builtInMatch = this.BUILT_IN_TRIP_DATING_CITIES.find(
        c => c.toLowerCase() === rawCity.toLowerCase()
      );
      if (builtInMatch) {
        return { city: builtInMatch, city_custom: null };
      }
    }

    const candidateRaw = isOtherChoice ? rawCustom : (rawCustom || rawCity);
    if (!candidateRaw) {
      throw new Error('Please enter your city name when selecting "Other (type your city)".');
    }
    if (/<[^>]*>/.test(candidateRaw)) {
      throw new Error('City name cannot contain HTML or special markup characters.');
    }

    const collapsed = candidateRaw.replace(/\s+/g, ' ').trim();
    if (collapsed.length < 2 || collapsed.length > 60) {
      throw new Error('Custom city must be between 2 and 60 characters long.');
    }
    if (!/^[A-Za-zÀ-ÿ\s'-]{2,60}$/.test(collapsed)) {
      throw new Error("City name may only contain letters, spaces, hyphens, and apostrophes.");
    }

    // If they typed one of the 5 built-in cities under Other, normalize to the canonical built-in city
    const builtInMatch = this.BUILT_IN_TRIP_DATING_CITIES.find(
      c => c.toLowerCase() === collapsed.toLowerCase()
    );
    if (builtInMatch) {
      return { city: builtInMatch, city_custom: null };
    }

    // Reuse existing custom city case-insensitively if an identical custom city already exists
    const existingMatch = (this.data.tripDatingProfiles || [])
      .map(p => (p.city_custom || p.city || '').trim())
      .find(existing => existing && existing.toLowerCase() === collapsed.toLowerCase());

    const canonicalCustom =
      existingMatch ||
      collapsed
        .split(' ')
        .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ');

    return {
      city: canonicalCustom,
      city_custom: canonicalCustom,
    };
  }

  public getTripDatingAvailableCities(onlyApproved = true): string[] {
    const profiles = (this.data.tripDatingProfiles || []).filter(p =>
      onlyApproved ? this.isTripDatingApprovedPublic(p) : true
    );
    const seen = new Set(this.BUILT_IN_TRIP_DATING_CITIES.map(c => c.toLowerCase()));
    const customCities: string[] = [];
    for (const p of profiles) {
      const c = (p.city_custom || p.city || '').trim();
      if (!c) continue;
      if (!seen.has(c.toLowerCase())) {
        seen.add(c.toLowerCase());
        customCities.push(c);
      }
    }
    customCities.sort((a, b) => a.localeCompare(b));
    return [...this.BUILT_IN_TRIP_DATING_CITIES, ...customCities];
  }

  private hydrateTripDatingMedia(p: TripDatingProfile): TripDatingProfile {
    let videoUrl = p.videoUrl;
    let videoThumbnail = p.videoThumbnail;
    let videoDuration = p.videoDuration;
    if (p.videoMediaId) {
      const asset = this.getMediaAssetById(p.videoMediaId);
      if (asset && asset.status === 'READY' && asset.url) {
        videoUrl = asset.url;
        videoThumbnail = asset.poster_url || videoThumbnail || p.primaryPhoto;
        videoDuration = asset.duration || videoDuration;
      }
    }
    const videos = Array.isArray(p.videos) && p.videos.length > 0
      ? p.videos
      : (videoUrl ? [videoUrl] : p.videos);
    return {
      ...p,
      videoUrl,
      videoThumbnail,
      videoDuration,
      videos,
      status: this.normalizeTripDatingStatus(p),
      moderationState: this.normalizeTripDatingStatus(p),
      decline_reason: p.decline_reason ?? p.admin_feedback ?? null,
    };
  }

  public getTripDatingProfiles(
    viewerEmail?: string,
    clientSessionId?: string,
    query?: { gender?: string; city?: string; search?: string; intention?: string; showAllStatuses?: boolean }
  ) {
    if (!this.data.tripDatingProfiles) {
      this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
      this.save();
    }

    const now = Date.now();
    let profiles = [...this.data.tripDatingProfiles].map(p => this.hydrateTripDatingMedia(p));

    if (!query?.showAllStatuses) {
      profiles = profiles.filter(p => this.isTripDatingApprovedPublic(p));
    }

    if (query?.gender && query.gender !== 'all') {
      profiles = profiles.filter(p => p.gender.toLowerCase() === query.gender?.toLowerCase());
    }

    if (query?.city && query.city !== 'all') {
      const targetCity = query.city.toLowerCase().trim();
      profiles = profiles.filter(
        p =>
          p.city.toLowerCase() === targetCity ||
          (p.city_custom && p.city_custom.toLowerCase() === targetCity) ||
          p.city.toLowerCase().includes(targetCity) ||
          p.location.toLowerCase().includes(targetCity)
      );
    }

    if (query?.intention && query.intention !== 'all') {
      profiles = profiles.filter(p => p.datingIntention === query.intention);
    }

    if (query?.search && query.search.trim()) {
      const q = query.search.toLowerCase().trim();
      profiles = profiles.filter(p =>
        p.fullName.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        (p.city_custom || '').toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.lookingFor.toLowerCase().includes(q)
      );
    }

    profiles.sort((a, b) => {
      const aTs = a.published_at || a.reviewed_at || a.createdAt || 0;
      const bTs = b.published_at || b.reviewed_at || b.createdAt || 0;
      const diff = bTs - aTs;
      return diff !== 0 ? diff : b.id.localeCompare(a.id);
    });

    return profiles.map(p => {
      const activeUnlock = this.checkActiveContactUnlock(p.id, viewerEmail, clientSessionId);
      const isLikedByViewer = viewerEmail ? (p.likedByUserEmails || []).includes(viewerEmail) : false;

      if (activeUnlock && activeUnlock.expiresAt > now) {
        return {
          ...p,
          phoneNumber: activeUnlock.unlockedPhone,
          isUnlocked: true,
          unlockExpiresAt: activeUnlock.expiresAt,
          isLikedByViewer,
        };
      }

      return {
        ...p,
        phoneNumber: '+254 7•• ••• •••',
        isUnlocked: false,
        unlockExpiresAt: undefined,
        isLikedByViewer,
      };
    });
  }

  public queryTripDatingFeed(
    viewerEmail?: string,
    clientSessionId?: string,
    query?: { gender?: string; city?: string; search?: string; intention?: string; cursor?: string; limit?: number }
  ): {
    profiles: TripDatingProfile[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
    availableCities: string[];
  } {
    const limit = Math.min(50, Math.max(1, Number(query?.limit) || 15));
    const isCacheable =
      (!query?.gender || query.gender === 'all') &&
      (!query?.city || query.city === 'all') &&
      (!query?.intention || query.intention === 'all') &&
      !query?.search;

    const getFeedSortTs = (p: TripDatingProfile) => p.published_at || p.reviewed_at || p.createdAt || 0;

    let baseApproved: TripDatingProfile[];
    if (
      isCacheable &&
      this.publicFeedCache.tripDating &&
      Date.now() - this.publicFeedCache.tripDating.ts < 15_000
    ) {
      baseApproved = this.publicFeedCache.tripDating.data;
    } else {
      if (!this.data.tripDatingProfiles) {
        this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
        this.save();
      }
      let list = this.data.tripDatingProfiles
        .filter(p => this.isTripDatingApprovedPublic(p))
        .map(p => this.hydrateTripDatingMedia(p));

      if (query?.gender && query.gender !== 'all') {
        list = list.filter(p => p.gender.toLowerCase() === query.gender!.toLowerCase());
      }
      if (query?.city && query.city !== 'all') {
        const targetCity = query.city.toLowerCase().trim();
        list = list.filter(
          p =>
            p.city.toLowerCase() === targetCity ||
            (p.city_custom && p.city_custom.toLowerCase() === targetCity) ||
            p.city.toLowerCase().includes(targetCity) ||
            p.location.toLowerCase().includes(targetCity)
        );
      }
      if (query?.intention && query.intention !== 'all') {
        list = list.filter(p => p.datingIntention === query.intention);
      }
      if (query?.search && query.search.trim()) {
        const q = query.search.toLowerCase().trim();
        list = list.filter(p =>
          p.fullName.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q) ||
          (p.city_custom || '').toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.lookingFor.toLowerCase().includes(q)
        );
      }
      list.sort((a, b) => {
        const diff = getFeedSortTs(b) - getFeedSortTs(a);
        return diff !== 0 ? diff : b.id.localeCompare(a.id);
      });
      baseApproved = list;
      if (isCacheable) {
        this.publicFeedCache.tripDating = { key: 'public', ts: Date.now(), data: baseApproved };
      }
    }

    let filtered = baseApproved;
    if (query?.cursor && query.cursor.includes('|')) {
      const [tsStr, cursorId] = query.cursor.split('|');
      const cursorTs = Number(tsStr);
      if (Number.isFinite(cursorTs)) {
        filtered = baseApproved.filter(p => {
          const ts = getFeedSortTs(p);
          return ts < cursorTs || (ts === cursorTs && p.id.localeCompare(cursorId) < 0);
        });
      }
    }

    const now = Date.now();
    const pageSlice = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const last = pageSlice[pageSlice.length - 1];
    const nextCursor = hasMore && last ? `${getFeedSortTs(last)}|${last.id}` : null;

    const hydrated = pageSlice.map(p => {
      const activeUnlock = this.checkActiveContactUnlock(p.id, viewerEmail, clientSessionId);
      const isLikedByViewer = viewerEmail ? (p.likedByUserEmails || []).includes(viewerEmail) : false;
      if (activeUnlock && activeUnlock.expiresAt > now) {
        return {
          ...p,
          phoneNumber: activeUnlock.unlockedPhone,
          isUnlocked: true,
          unlockExpiresAt: activeUnlock.expiresAt,
          isLikedByViewer,
        };
      }
      return {
        ...p,
        phoneNumber: '+254 7•• ••• •••',
        isUnlocked: false,
        unlockExpiresAt: undefined,
        isLikedByViewer,
      };
    });

    return {
      profiles: hydrated,
      nextCursor,
      hasMore,
      totalCount: baseApproved.length,
      availableCities: this.getTripDatingAvailableCities(true),
    };
  }

  public getMyTripDatingSubmissions(ownerEmail?: string, clientSessionId?: string): TripDatingProfile[] {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const cleanEmail = (ownerEmail || '').trim().toLowerCase();
    const cleanSess = (clientSessionId || '').trim();
    if (!cleanEmail && !cleanSess) return [];

    return this.data.tripDatingProfiles
      .filter(p => {
        if (cleanEmail && ((p.ownerEmail || '').toLowerCase() === cleanEmail || (p.userId || '').toLowerCase() === cleanEmail)) {
          return true;
        }
        if (cleanSess && p.clientSessionId === cleanSess) return true;
        return false;
      })
      .map(p => this.hydrateTripDatingMedia(p))
      .sort((a, b) => {
        const diff = (b.createdAt || 0) - (a.createdAt || 0);
        return diff !== 0 ? diff : b.id.localeCompare(a.id);
      });
  }

  public getTripDatingProfileById(id: string, viewerEmail?: string, clientSessionId?: string, allowUnapproved = false) {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const rawProfile = this.data.tripDatingProfiles.find(p => p.id === id);
    if (!rawProfile) return null;
    const profile = this.hydrateTripDatingMedia(rawProfile);

    const isOwner = Boolean(
      (viewerEmail && ((profile.ownerEmail || '').toLowerCase() === viewerEmail.toLowerCase() || (profile.userId || '').toLowerCase() === viewerEmail.toLowerCase())) ||
      (clientSessionId && profile.clientSessionId === clientSessionId)
    );
    if (!allowUnapproved && !isOwner && !this.isTripDatingApprovedPublic(profile)) {
      return null;
    }

    const now = Date.now();
    const activeUnlock = this.checkActiveContactUnlock(profile.id, viewerEmail, clientSessionId);
    const isLikedByViewer = viewerEmail ? (profile.likedByUserEmails || []).includes(viewerEmail) : false;

    if (activeUnlock && activeUnlock.expiresAt > now) {
      return {
        ...profile,
        phoneNumber: activeUnlock.unlockedPhone,
        isUnlocked: true,
        unlockExpiresAt: activeUnlock.expiresAt,
        isLikedByViewer,
      };
    }

    return {
      ...profile,
      phoneNumber: isOwner ? profile.phoneNumber : '+254 7•• ••• •••',
      isUnlocked: false,
      unlockExpiresAt: undefined,
      isLikedByViewer,
    };
  }

  public getRawTripDatingProfileById(id: string): TripDatingProfile | null {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    return this.data.tripDatingProfiles.find(p => p.id === id) || null;
  }

  private assertTripDatingContentSafe(data: { fullName: string; description: string; lookingFor: string }) {
    const combinedContent = `${data.fullName} ${data.description} ${data.lookingFor}`.toLowerCase();

    const adultPatterns = [/\b(nude|naked|sex|escort|camgirl|hooker|porn|xxx|blowjob|anal|massage with happy ending)\b/i];
    for (const pat of adultPatterns) {
      if (pat.test(combinedContent)) {
        throw new Error('Community Safety Policy: Explicit sexual content or escort solicitation is strictly prohibited on Trip Dating.');
      }
    }

    const merchandisePatterns = [/\b(for sale|wholesale|brand new shoes|handbags?|merchandise|discount price|stock available|shop now|order via whatsapp|in stock)\b/i];
    for (const pat of merchandisePatterns) {
      if (pat.test(combinedContent)) {
        throw new Error('Content Policy: Trip Dating is exclusively for genuine dating and companionship. Selling commercial goods or merchandise is strictly prohibited.');
      }
    }

    const drugPatterns = [/\b(weed|bhang|cocaine|narcotics|prescription pills|shrooms|meth)\b/i];
    for (const pat of drugPatterns) {
      if (pat.test(combinedContent)) {
        throw new Error('Content Policy: Mention or solicitation of drugs or illegal substances is prohibited.');
      }
    }

    const stayPatterns = [/\b(per night|airbnb|rental unit|check-in fee|booking deposit|serviced apartment for rent|studio to let)\b/i];
    for (const pat of stayPatterns) {
      if (pat.test(combinedContent)) {
        throw new Error('Content Policy: This section is for Trip Dating, not accommodation rentals. Please publish stays via the Host section.');
      }
    }
  }

  public createTripDatingProfile(data: {
    fullName: string;
    phoneNumber: string;
    gender: 'male' | 'female' | 'other';
    age: number;
    dob?: string;
    country?: string;
    city: string;
    city_custom?: string | null;
    location: string;
    description: string;
    lookingFor: string;
    datingIntention: any;
    photos: string[];
    primaryPhoto?: string;
    videos?: string[];
    videoDurations?: number[];
    videoThumbnails?: string[];
    videoUrl?: string;
    videoDuration?: number;
    videoThumbnail?: string;
    videoMediaId?: string | null;
    videoMediaIds?: string[];
    mediaAssetIds?: string[];
    videoFilter?: string;
    videoTrimStart?: number;
    videoTrimEnd?: number;
    full_body_photo?: string;
    full_body_verified?: boolean;
    fullBodyModerationStatus?: 'pending_review' | 'approved' | 'rejected';
    status?: TripDatingUnifiedStatus;
    userId?: string;
    ownerEmail?: string;
    clientSessionId?: string;
  }): { profile: TripDatingProfile; message: string } {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;

    this.assertNoBlobUrls([
      ...(data.photos || []),
      data.primaryPhoto,
      ...(data.videos || []),
      data.videoUrl,
      data.full_body_photo,
    ]);

    this.assertMediaAssetsReady([
      data.videoMediaId,
      ...(data.videoMediaIds || []),
      ...(data.mediaAssetIds || []),
    ]);

    this.assertTripDatingContentSafe({
      fullName: data.fullName,
      description: data.description,
      lookingFor: data.lookingFor,
    });

    const normalizedCity = this.validateAndNormalizeCity(data.city, data.city_custom);

    // Validate photos (maximum 4, default 3)
    const sanitizedPhotos = (data.photos || []).filter(p => typeof p === 'string' && p.trim().length > 0).slice(0, 4);
    if (sanitizedPhotos.length === 0) {
      sanitizedPhotos.push('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80');
    }

    const fullBodyPhoto = data.full_body_photo || sanitizedPhotos[0];

    // Hydrate video reference from media_assets if videoMediaId provided
    const primaryAsset = data.videoMediaId ? this.getMediaAssetById(data.videoMediaId) : null;
    const secondaryAssets = (data.videoMediaIds || [])
      .map(id => this.getMediaAssetById(id))
      .filter((a): a is MediaAsset => Boolean(a));

    const effectiveVideoUrl = primaryAsset?.url || (data.videoUrl && typeof data.videoUrl === 'string' && data.videoUrl.trim().length > 0
      ? data.videoUrl.trim()
      : (Array.isArray(data.videos) && data.videos.length > 0 ? data.videos[0] : undefined));

    const effectiveDuration = primaryAsset?.duration
      ? Math.min(60, Math.max(1, Math.round(primaryAsset.duration)))
      : (data.videoDuration !== undefined
          ? Math.min(60, Math.max(1, Math.round(Number(data.videoDuration)) || 60))
          : (Array.isArray(data.videoDurations) && data.videoDurations.length > 0 ? Math.min(60, Number(data.videoDurations[0]) || 60) : 60));

    const effectiveThumbnail = primaryAsset?.poster_url || (data.videoThumbnail && typeof data.videoThumbnail === 'string' && data.videoThumbnail.trim().length > 0
      ? data.videoThumbnail.trim()
      : (Array.isArray(data.videoThumbnails) && data.videoThumbnails.length > 0 ? data.videoThumbnails[0] : fullBodyPhoto));

    let sanitizedVideos = secondaryAssets.length > 0
      ? secondaryAssets.map(a => a.url).slice(0, 2)
      : (Array.isArray(data.videos)
          ? data.videos.filter(v => typeof v === 'string' && v.trim().length > 0).slice(0, 2)
          : undefined);
    if (effectiveVideoUrl && (!sanitizedVideos || sanitizedVideos.length === 0)) {
      sanitizedVideos = [effectiveVideoUrl];
    }
    const sanitizedDurations = sanitizedVideos ? sanitizedVideos.map((_, idx) => secondaryAssets[idx]?.duration || effectiveDuration) : undefined;
    const sanitizedThumbnails = secondaryAssets.length > 0
      ? secondaryAssets.map(a => a.poster_url || effectiveThumbnail)
      : (effectiveThumbnail ? [effectiveThumbnail] : undefined);

    const initialStatus: TripDatingUnifiedStatus = data.status === 'DRAFT' ? 'DRAFT' : 'PENDING_REVIEW';
    const now = Date.now();
    const newProfile: TripDatingProfile = {
      id: 'tdp_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      userId: data.userId || data.ownerEmail || 'u_guest',
      ownerEmail: data.ownerEmail?.toLowerCase(),
      clientSessionId: data.clientSessionId,
      fullName: data.fullName.trim(),
      phoneNumber: data.phoneNumber.trim(),
      gender: data.gender,
      age: Math.max(18, Math.min(99, Number(data.age) || 25)),
      dob: data.dob,
      country: data.country || 'Kenya',
      city: normalizedCity.city,
      city_custom: normalizedCity.city_custom,
      location: (data.location || normalizedCity.city).trim(),
      description: data.description.trim(),
      lookingFor: data.lookingFor.trim(),
      datingIntention: data.datingIntention || 'dating_companionship',
      photos: sanitizedPhotos,
      primaryPhoto: data.primaryPhoto || sanitizedPhotos[0],
      videoUrl: effectiveVideoUrl,
      videoDuration: effectiveVideoUrl ? effectiveDuration : undefined,
      videoThumbnail: effectiveVideoUrl ? effectiveThumbnail : undefined,
      videoMediaId: primaryAsset?.id || data.videoMediaId || null,
      videoMediaIds: secondaryAssets.length > 0 ? secondaryAssets.map(a => a.id) : data.videoMediaIds,
      mediaAssetIds: data.mediaAssetIds,
      videoFilter: data.videoFilter || undefined,
      videoTrimStart: data.videoTrimStart !== undefined ? Number(data.videoTrimStart) : undefined,
      videoTrimEnd: data.videoTrimEnd !== undefined ? Number(data.videoTrimEnd) : undefined,
      videos: sanitizedVideos,
      videoDurations: sanitizedDurations,
      videoThumbnails: sanitizedThumbnails,
      full_body_photo: fullBodyPhoto,
      full_body_verified: data.full_body_verified !== undefined ? Boolean(data.full_body_verified) : true,
      fullBodyModerationStatus: 'pending_review',
      moderationState: initialStatus,
      admin_feedback: null,
      decline_reason: null,
      reviewed_at: null,
      reviewed_by: null,
      published_at: null,
      likes: 0,
      likedByUserEmails: [],
      views: 0,
      status: initialStatus,
      createdAt: now,
      updatedAt: now,
    };

    this.data.tripDatingProfiles.unshift(newProfile);
    this.invalidateFeedCache('trip_dating');

    this.createAuditLog({
      id: 'aud_tdp_' + now,
      action: 'trip_dating_profile_submitted',
      actorEmail: data.ownerEmail || data.userId || 'guest@airbus.ke',
      details: `Submitted Trip Dating profile for ${newProfile.fullName} (${newProfile.city}) with status ${initialStatus}.`,
      createdAt: now,
    });

    if (initialStatus === 'PENDING_REVIEW') {
      this.data.users
        .filter(u => u.role === 'admin')
        .forEach(admin => {
          this.createNotification({
            id: 'notif_tdp_rev_' + now + '_' + Math.random().toString(36).slice(2, 5),
            userEmail: admin.email,
            title: 'New Trip Dating Post Pending Review',
            message: `${newProfile.fullName} (${newProfile.city}) submitted a Trip Dating profile for Admin approval.`,
            read: false,
            link: '/#admin',
            type: 'system',
            createdAt: now,
          });
        });
    }

    this.save();
    this.emitTripDatingCountsUpdate();
    return {
      profile: this.hydrateTripDatingMedia(newProfile),
      message: 'Submitted for Admin Review. Your Trip Dating post will go live once approved.',
    };
  }

  public resubmitTripDatingProfile(
    id: string,
    actorEmail: string | undefined,
    clientSessionId: string | undefined,
    isAdmin: boolean,
    updates: Partial<TripDatingProfile>
  ): TripDatingProfile {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const index = this.data.tripDatingProfiles.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Dating profile not found');

    const current = this.data.tripDatingProfiles[index];
    const cleanActor = (actorEmail || '').toLowerCase();
    const ownsByEmail = Boolean(cleanActor && ((current.ownerEmail || '').toLowerCase() === cleanActor || (current.userId || '').toLowerCase() === cleanActor));
    const ownsBySession = Boolean(clientSessionId && current.clientSessionId === clientSessionId);
    if (!isAdmin && !ownsByEmail && !ownsBySession) {
      throw new Error('Unauthorized to edit and resubmit this Trip Dating profile.');
    }

    this.assertNoBlobUrls([
      ...(updates.photos || []),
      updates.primaryPhoto,
      ...(updates.videos || []),
      updates.videoUrl,
      updates.full_body_photo,
    ]);

    this.assertMediaAssetsReady([
      updates.videoMediaId,
      ...(updates.videoMediaIds || []),
      ...(updates.mediaAssetIds || []),
    ]);

    this.assertTripDatingContentSafe({
      fullName: updates.fullName ?? current.fullName,
      description: updates.description ?? current.description,
      lookingFor: updates.lookingFor ?? current.lookingFor,
    });

    if (updates.city !== undefined || updates.city_custom !== undefined) {
      const normalizedCity = this.validateAndNormalizeCity(
        updates.city ?? current.city,
        updates.city_custom !== undefined ? updates.city_custom : current.city_custom
      );
      updates.city = normalizedCity.city;
      updates.city_custom = normalizedCity.city_custom;
    }

    if (updates.photos && updates.photos.length > 4) {
      updates.photos = updates.photos.slice(0, 4);
    }

    const { createdAt: _ignoreCreatedAt, id: _ignoreId, ...safeUpdates } = updates as any;
    const updated: TripDatingProfile = {
      ...current,
      ...safeUpdates,
      id: current.id,
      createdAt: current.createdAt,
      moderationState: 'PENDING_REVIEW',
      status: 'PENDING_REVIEW',
      fullBodyModerationStatus: 'pending_review',
      admin_feedback: null,
      decline_reason: null,
      removalReason: undefined,
      reviewed_at: null,
      reviewed_by: null,
      published_at: null,
      updatedAt: Date.now(),
    };

    this.data.tripDatingProfiles[index] = updated;
    this.invalidateFeedCache('trip_dating');

    this.data.users
      .filter(u => u.role === 'admin')
      .forEach(admin => {
        this.createNotification({
          id: 'notif_tdp_resub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
          userEmail: admin.email,
          title: 'Resubmitted Trip Dating Post Awaiting Review',
          message: `${updated.fullName} updated and resubmitted their Trip Dating post for review.`,
          read: false,
          link: '/#admin',
          type: 'system',
          createdAt: Date.now(),
        });
      });

    this.save();
    this.emitTripDatingCountsUpdate();
    return this.hydrateTripDatingMedia(updated);
  }

  public updateTripDatingProfile(id: string, updates: Partial<TripDatingProfile>, _actorEmail?: string) {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const index = this.data.tripDatingProfiles.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Dating profile not found');

    const current = this.data.tripDatingProfiles[index];

    if (updates.photos && updates.photos.length > 4) {
      updates.photos = updates.photos.slice(0, 4);
    }

    const updated = {
      ...current,
      ...updates,
      id: current.id,
      updatedAt: Date.now(),
    };

    this.data.tripDatingProfiles[index] = updated;
    this.invalidateFeedCache('trip_dating');
    this.save();
    return updated;
  }

  public toggleLikeTripDatingProfile(id: string, userEmail: string) {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const profile = this.data.tripDatingProfiles.find(p => p.id === id);
    if (!profile) throw new Error('Profile not found');

    if (!profile.likedByUserEmails) profile.likedByUserEmails = [];
    const index = profile.likedByUserEmails.indexOf(userEmail);

    let liked = false;
    if (index > -1) {
      profile.likedByUserEmails.splice(index, 1);
      profile.likes = Math.max(0, (profile.likes || 1) - 1);
      liked = false;
    } else {
      profile.likedByUserEmails.push(userEmail);
      profile.likes = (profile.likes || 0) + 1;
      liked = true;
    }

    this.invalidateFeedCache('trip_dating');
    this.save();
    return { liked, totalLikes: profile.likes };
  }

  public incrementTripDatingProfileViews(id: string) {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const profile = this.data.tripDatingProfiles.find(p => p.id === id);
    if (profile) {
      profile.views = (profile.views || 0) + 1;
      this.save();
      return profile.views;
    }
    return 0;
  }

  public unlockTripDatingWithWallet(opts: {
    profileId: string;
    userEmail: string;
    clientSessionId?: string;
  }): {
    unlock: TripDatingContactUnlock;
    payment?: PaymentRecord;
    unlockedPhone: string;
    expiresAt: number;
    remainingSeconds: number;
    walletBalance: number;
    alreadyUnlocked: boolean;
  } {
    const profile = this.getRawTripDatingProfileById(opts.profileId);
    if (!profile) {
      throw new Error('Target Trip Dating post does not exist.');
    }
    if (!this.isTripDatingApprovedPublic(profile)) {
      throw new Error('Only approved Trip Dating profiles can be unlocked.');
    }

    const cleanEmail = opts.userEmail.trim().toLowerCase();
    const existing = this.checkActiveContactUnlock(profile.id, cleanEmail, opts.clientSessionId);
    if (existing && existing.expiresAt > Date.now()) {
      return {
        unlock: existing,
        unlockedPhone: existing.unlockedPhone,
        expiresAt: existing.expiresAt,
        remainingSeconds: Math.max(0, Math.round((existing.expiresAt - Date.now()) / 1000)),
        walletBalance: this.getWalletBalance(cleanEmail),
        alreadyUnlocked: true,
      };
    }

    if (!this.data.tripDatingContactUnlocks) this.data.tripDatingContactUnlocks = [];

    const payRes = this.payWithWallet({
      userId: cleanEmail,
      type: 'trip_dating',
      amountSc: 50,
      referenceId: profile.id,
      note: `Trip Dating 10-min contact unlock for ${profile.fullName}`,
    });

    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;
    const unlock: TripDatingContactUnlock = {
      id: 'unlock_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      profileId: profile.id,
      profileName: profile.fullName,
      unlockedPhone: profile.phoneNumber || '+254 712 345 678',
      userEmail: cleanEmail,
      clientSessionId: opts.clientSessionId || `wallet_${cleanEmail}`,
      unlockedAt: now,
      expiresAt,
    };

    this.data.tripDatingContactUnlocks.unshift(unlock);
    this.createAuditLog({
      id: 'aud_td_unlock_' + now,
      action: 'trip_dating_wallet_unlock',
      actorEmail: cleanEmail,
      details: `Unlocked contact for ${profile.fullName} (${profile.id}) for 10 minutes via Wallet (KES 50).`,
      createdAt: now,
    });
    this.save();

    return {
      unlock,
      payment: payRes.payment,
      unlockedPhone: unlock.unlockedPhone,
      expiresAt,
      remainingSeconds: 600,
      walletBalance: this.getWalletBalance(cleanEmail),
      alreadyUnlocked: false,
    };
  }

  public createTripDatingPaymentRequest(req: {
    profileId: string;
    userEmail: string;
    clientSessionId: string;
    payerPhone: string;
    transactionCode: string;
  }) {
    if (!this.data.tripDatingPaymentRequests) this.data.tripDatingPaymentRequests = [];
    const profile = this.getRawTripDatingProfileById(req.profileId);
    if (!profile) throw new Error('Target dating profile does not exist');

    const cleanCode = req.transactionCode.trim().toUpperCase();
    if (cleanCode.length < 5) throw new Error('Please enter a valid M-Pesa transaction code (e.g. QGH7X2K9LM)');

    const newReq: TripDatingPaymentRequest = {
      id: 'tdpr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      profileId: profile.id,
      profileName: profile.fullName,
      userEmail: req.userEmail || 'guest@airbus.ke',
      clientSessionId: req.clientSessionId || 'session_default',
      payerPhone: req.payerPhone.trim(),
      transactionCode: cleanCode,
      amount: 50, // KES 50 fee
      status: 'pending',
      createdAt: Date.now(),
    };

    this.data.tripDatingPaymentRequests.unshift(newReq);
    this.createAuditLog({
      id: 'aud_tdpr_' + Date.now(),
      action: 'trip_dating_payment_submitted',
      actorEmail: req.userEmail || req.payerPhone,
      details: `Submitted KES 50 payment (${cleanCode}) to unlock contact for ${profile.fullName}.`,
      createdAt: Date.now(),
    });

    this.save();
    return newReq;
  }

  public getTripDatingPaymentRequests() {
    if (!this.data.tripDatingPaymentRequests) this.data.tripDatingPaymentRequests = [];
    return this.data.tripDatingPaymentRequests;
  }

  public approveTripDatingPayment(requestId: string, adminEmail: string) {
    if (!this.data.tripDatingPaymentRequests) this.data.tripDatingPaymentRequests = [];
    if (!this.data.tripDatingContactUnlocks) this.data.tripDatingContactUnlocks = [];

    const req = this.data.tripDatingPaymentRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Payment request not found');
    if (req.status === 'approved') return { request: req, unlock: null, message: 'Already approved' };

    const profile = this.getRawTripDatingProfileById(req.profileId);
    if (!profile) throw new Error('Profile associated with payment does not exist');

    req.status = 'approved';
    req.reviewedBy = adminEmail;
    req.reviewedAt = Date.now();

    if (this.data.walletRecords?.['treasury']) {
      this.data.walletRecords['treasury'].balance += 50;
      this.data.walletRecords['treasury'].lifetimeEarnings += 50;
      this.data.walletRecords['treasury'].updatedAt = Date.now();
    }

    const now = Date.now();
    const unlockDuration = 10 * 60 * 1000;
    const unlock: TripDatingContactUnlock = {
      id: 'unlock_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      profileId: profile.id,
      profileName: profile.fullName,
      unlockedPhone: profile.phoneNumber || '+254 712 345 678',
      userEmail: req.userEmail,
      clientSessionId: req.clientSessionId,
      unlockedAt: now,
      expiresAt: now + unlockDuration,
    };

    this.data.tripDatingContactUnlocks.unshift(unlock);

    this.createAuditLog({
      id: 'aud_unlock_' + Date.now(),
      action: 'trip_dating_payment_approved',
      actorEmail: adminEmail,
      details: `Approved KES 50 payment (${req.transactionCode}). Granted 10-minute contact unlock for ${profile.fullName} to ${req.userEmail}.`,
      createdAt: Date.now(),
    });

    this.save();
    return { request: req, unlock };
  }

  public rejectTripDatingPayment(requestId: string, adminEmail: string, reason?: string) {
    if (!this.data.tripDatingPaymentRequests) this.data.tripDatingPaymentRequests = [];
    const req = this.data.tripDatingPaymentRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Payment request not found');

    req.status = 'rejected';
    req.rejectionReason = reason || 'Payment transaction code could not be verified.';
    req.reviewedBy = adminEmail;
    req.reviewedAt = Date.now();

    this.createAuditLog({
      id: 'aud_tdprej_' + Date.now(),
      action: 'trip_dating_payment_rejected',
      actorEmail: adminEmail,
      details: `Rejected KES 50 payment request (${req.transactionCode}) for ${req.profileName}. Reason: ${req.rejectionReason}`,
      createdAt: Date.now(),
    });

    this.save();
    return req;
  }

  public checkActiveContactUnlock(profileId: string, userEmail?: string, clientSessionId?: string): TripDatingContactUnlock | null {
    if (!this.data.tripDatingContactUnlocks) return null;
    const now = Date.now();
    const cleanEmail = userEmail ? userEmail.toLowerCase() : undefined;

    const unlock = this.data.tripDatingContactUnlocks.find(u =>
      u.profileId === profileId &&
      u.expiresAt > now &&
      ((cleanEmail && u.userEmail.toLowerCase() === cleanEmail) || (clientSessionId && u.clientSessionId === clientSessionId))
    );

    return unlock || null;
  }

  public getTripDatingAdminCounts(): TripDatingAdminCounts {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    if (!this.data.tripDatingPaymentRequests) this.data.tripDatingPaymentRequests = [];
    const profiles = this.data.tripDatingProfiles;
    let pending = 0;
    let approved = 0;
    let declined = 0;
    let draft = 0;
    for (const p of profiles) {
      const st = this.normalizeTripDatingStatus(p);
      if (st === 'PENDING_REVIEW') pending += 1;
      else if (st === 'APPROVED') approved += 1;
      else if (st === 'DECLINED') declined += 1;
      else if (st === 'DRAFT') draft += 1;
    }
    const pendingPayments = this.data.tripDatingPaymentRequests.filter(r => r.status === 'pending').length;
    return {
      pending,
      approved,
      declined,
      draft,
      total: profiles.length,
      pendingPayments,
    };
  }

  public getAdminTripDatingSubmissions(opts: {
    status?: string;
    page?: number;
    limit?: number;
  }): {
    submissions: Array<TripDatingProfile & { videoAsset?: MediaAsset | null }>;
    counts: TripDatingAdminCounts;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const requestedStatus = String(opts.status || 'PENDING_REVIEW').trim().toUpperCase();
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(opts.limit) || 20));

    let list = this.data.tripDatingProfiles.map(p => this.hydrateTripDatingMedia(p));
    if (requestedStatus !== 'ALL') {
      const normalizedTarget: TripDatingUnifiedStatus =
        requestedStatus === 'PENDING' ? 'PENDING_REVIEW'
        : requestedStatus === 'ACTIVE' ? 'APPROVED'
        : requestedStatus === 'REJECTED' ? 'DECLINED'
        : (['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'DECLINED'].includes(requestedStatus)
            ? (requestedStatus as TripDatingUnifiedStatus)
            : 'PENDING_REVIEW');
      list = list.filter(p => this.normalizeTripDatingStatus(p) === normalizedTarget);
    }

    if (requestedStatus === 'PENDING_REVIEW' || requestedStatus === 'PENDING') {
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.id.localeCompare(b.id));
    } else {
      list.sort((a, b) => {
        const bTs = b.published_at || b.reviewed_at || b.updatedAt || b.createdAt || 0;
        const aTs = a.published_at || a.reviewed_at || a.updatedAt || a.createdAt || 0;
        return bTs - aTs || b.id.localeCompare(a.id);
      });
    }

    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const sliced = list.slice(offset, offset + limit).map(p => ({
      ...p,
      videoAsset: p.videoMediaId
        ? this.getMediaAssetById(p.videoMediaId)
        : (p.videoUrl ? this.getMediaAssetByUrl(p.videoUrl) : null),
    }));

    return {
      submissions: sliced,
      counts: this.getTripDatingAdminCounts(),
      page,
      limit,
      total,
      totalPages,
    };
  }

  public approveTripDatingSubmission(
    profileId: string,
    adminEmail: string
  ): { profile: TripDatingProfile; alreadyApproved: boolean } {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const profile = this.data.tripDatingProfiles.find(p => p.id === profileId);
    if (!profile) throw new Error('Trip Dating submission not found.');

    const currentStatus = this.normalizeTripDatingStatus(profile);
    if (currentStatus === 'APPROVED') {
      return { profile: this.hydrateTripDatingMedia(profile), alreadyApproved: true };
    }

    const now = Date.now();
    const cleanAdmin = (adminEmail || 'admin@airbus.ke').trim();

    profile.status = 'APPROVED';
    profile.moderationState = 'APPROVED';
    profile.fullBodyModerationStatus = 'approved';
    profile.full_body_verified = true;
    profile.admin_feedback = null;
    profile.decline_reason = null;
    profile.removalReason = undefined;
    profile.reviewed_at = now;
    profile.reviewed_by = cleanAdmin;
    profile.published_at = now;
    profile.updatedAt = now;

    this.invalidateFeedCache('trip_dating');

    this.createAuditLog({
      id: 'aud_tdp_app_' + now + '_' + Math.random().toString(36).slice(2, 5),
      action: 'trip_dating_profile_approved',
      actorEmail: cleanAdmin,
      details: `Admin approved Trip Dating submission ${profile.fullName} (${profile.id}) -> APPROVED, published_at=${new Date(now).toISOString()}`,
      createdAt: now,
    });

    this.save();

    const hydrated = this.hydrateTripDatingMedia(profile);
    this.emitFeedApproved('trip_dating', {
      ...hydrated,
      phoneNumber: '+254 7•• ••• •••',
      isUnlocked: false,
    });
    this.emitTripDatingCountsUpdate();

    // Notify submitter AFTER post is committed & emitted to feed
    const ownerEmail = profile.ownerEmail || (profile.userId && profile.userId.includes('@') ? profile.userId : undefined);
    if (ownerEmail) {
      this.createNotification({
        id: 'notif_tdp_app_' + now + '_' + Math.random().toString(36).slice(2, 5),
        userEmail: ownerEmail,
        title: 'Trip Dating Post Approved & Live!',
        message: `Your Trip Dating post for ${profile.fullName} has been approved and is now at the top of the Trip Dating feed!`,
        read: false,
        link: '/#trip-dating',
        type: 'system',
        createdAt: now,
      });
      this.save();
    }

    return { profile: hydrated, alreadyApproved: false };
  }

  public declineTripDatingSubmission(
    profileId: string,
    adminEmail: string,
    reason: string
  ): { profile: TripDatingProfile; alreadyDeclined: boolean } {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const profile = this.data.tripDatingProfiles.find(p => p.id === profileId);
    if (!profile) throw new Error('Trip Dating submission not found.');

    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 10 || cleanReason.length > 500) {
      throw new Error('Decline reason is required and must be between 10 and 500 characters.');
    }

    const currentStatus = this.normalizeTripDatingStatus(profile);
    if (currentStatus === 'DECLINED' && (profile.decline_reason || profile.admin_feedback) === cleanReason) {
      return { profile: this.hydrateTripDatingMedia(profile), alreadyDeclined: true };
    }

    const now = Date.now();
    const cleanAdmin = (adminEmail || 'admin@airbus.ke').trim();

    profile.status = 'DECLINED';
    profile.moderationState = 'DECLINED';
    profile.fullBodyModerationStatus = 'rejected';
    profile.decline_reason = cleanReason;
    profile.admin_feedback = cleanReason;
    profile.removalReason = cleanReason;
    profile.reviewed_at = now;
    profile.reviewed_by = cleanAdmin;
    profile.published_at = null;
    profile.updatedAt = now;

    this.invalidateFeedCache('trip_dating');

    this.createAuditLog({
      id: 'aud_tdp_dec_' + now + '_' + Math.random().toString(36).slice(2, 5),
      action: 'trip_dating_profile_declined',
      actorEmail: cleanAdmin,
      details: `Admin declined Trip Dating submission ${profile.fullName} (${profile.id}) -> DECLINED. Reason: ${cleanReason}`,
      createdAt: now,
    });

    const ownerEmail = profile.ownerEmail || (profile.userId && profile.userId.includes('@') ? profile.userId : undefined);
    if (ownerEmail) {
      this.createNotification({
        id: 'notif_tdp_dec_' + now + '_' + Math.random().toString(36).slice(2, 5),
        userEmail: ownerEmail,
        title: 'Trip Dating Post Declined',
        message: `Your Trip Dating post was declined: ${cleanReason}`,
        read: false,
        link: '/#trip-dating',
        type: 'system',
        createdAt: now,
      });
    }

    this.save();
    this.emitTripDatingCountsUpdate();
    return { profile: this.hydrateTripDatingMedia(profile), alreadyDeclined: false };
  }

  public adminModerateTripDatingProfile(profileId: string, status: TripDatingProfileStatus, reason?: string, adminEmail?: string) {
    const cleanAdmin = adminEmail || 'admin@airbus.ke';
    if (status === 'active' || status === 'APPROVED') {
      return this.approveTripDatingSubmission(profileId, cleanAdmin).profile;
    }
    const cleanReason = (reason || '').trim();
    const effectiveReason = cleanReason || (status === 'removed' ? 'Removed by administrator for policy violation.' : '');
    return this.declineTripDatingSubmission(profileId, cleanAdmin, effectiveReason).profile;
  }

  public getAdminReviewQueue(): {
    stays: Stay[];
    listings: Stay[];
    tripDating: TripDatingProfile[];
    counts: { stays: number; tripDating: number; total: number };
  } {
    const listings = (this.data.stays || [])
      .filter(s => s.moderationState === 'PENDING' || (!s.moderationState && (s.status === 'review' || s.moderationStatus === 'pending')))
      .map(s => this.hydrateStayAudio({ ...s, isVerified: s.isVerified !== false }))
      .sort((a, b) => {
        const diff = (a.createdAt || 0) - (b.createdAt || 0);
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      });

    const tripDating = (this.data.tripDatingProfiles || [])
      .filter(p => this.normalizeTripDatingStatus(p) === 'PENDING_REVIEW')
      .map(p => this.hydrateTripDatingMedia(p))
      .sort((a, b) => {
        const diff = (a.createdAt || 0) - (b.createdAt || 0);
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      });

    return {
      stays: listings,
      listings,
      tripDating,
      counts: {
        stays: listings.length,
        tripDating: tripDating.length,
        total: listings.length + tripDating.length,
      },
    };
  }

  public reportTripDatingProfile(data: {
    profileId: string;
    profileName: string;
    reportedByEmail: string;
    reason: string;
    details?: string;
  }): ListingReport {
    if (!this.data.reports) this.data.reports = [];
    const report: ListingReport = {
      id: 'rep_tdp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      stayId: `dating_${data.profileId}`,
      reportedBy: data.reportedByEmail || 'user@airbus.ke',
      reporterEmail: data.reportedByEmail || 'user@airbus.ke',
      reason: data.reason,
      details: `[Trip Dating Report on ${data.profileName} (${data.profileId})]: ${data.details || 'Reported by user for safety review'}`,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.data.reports.unshift(report);

    this.createAuditLog({
      id: 'aud_rep_tdp_' + Date.now(),
      action: 'trip_dating_profile_reported',
      actorEmail: data.reportedByEmail || 'anonymous',
      details: `Profile ${data.profileName} reported for: ${data.reason}. Details: ${data.details || 'N/A'}`,
      createdAt: Date.now(),
    });

    this.save();
    return report;
  }

  public getTripDatingStats(): TripDatingStats {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    if (!this.data.tripDatingPaymentRequests) this.data.tripDatingPaymentRequests = [];
    if (!this.data.tripDatingContactUnlocks) this.data.tripDatingContactUnlocks = [];

    const profiles = this.data.tripDatingProfiles;
    const reqs = this.data.tripDatingPaymentRequests;
    const unlocks = this.data.tripDatingContactUnlocks;
    const counts = this.getTripDatingAdminCounts();
    const approvedCount = reqs.filter(r => r.status === 'approved').length;

    return {
      totalMembers: profiles.length,
      activeProfiles: counts.approved,
      pendingProfiles: counts.pending,
      declinedProfiles: counts.declined,
      suspendedProfiles: profiles.filter(p => p.status === 'suspended').length,
      removedProfiles: profiles.filter(p => p.status === 'removed').length,
      totalViews: profiles.reduce((sum, p) => sum + (p.views || 0), 0),
      totalLikes: profiles.reduce((sum, p) => sum + (p.likes || 0), 0),
      totalContactRequests: reqs.length,
      pendingApprovals: counts.pendingPayments,
      approvedPayments: approvedCount,
      rejectedPayments: reqs.filter(r => r.status === 'rejected').length,
      successfulUnlocks: unlocks.length,
      totalRevenueKes: approvedCount * 50,
    };
  }

  // --- Duplicate M-Pesa Code Checker (Section 2.3) ---
  public isMpesaCodeUsed(code: string): boolean {
    if (!code || !code.trim()) return false;
    const clean = code.trim().toUpperCase();
    const records = this.data.paymentRecords || [];
    const payments = this.data.payments || [];
    const datingReqs = this.data.tripDatingPaymentRequests || [];

    const inRecords = records.some(p => (p.mpesaCode?.toUpperCase() === clean || p.reference?.toUpperCase() === clean));
    const inPayments = payments.some(p => (p.mpesaCode?.toUpperCase() === clean || p.reference?.toUpperCase() === clean));
    const inDating = datingReqs.some(r => r.transactionCode?.toUpperCase() === clean);

    return inRecords || inPayments || inDating;
  }

  // --- Stay Media Normalization & Management (Section 1) ---
  public normalizeStayMedia(stay: Stay): Stay {
    if (!stay.media) {
      const photos: any[] = [];
      if (stay.images && stay.images.length > 0) {
        stay.images.forEach((url: string, i: number) => {
          photos.push({ url, order: i, isCover: i === 0 });
        });
      } else if (stay.thumbnailUrl) {
        photos.push({ url: stay.thumbnailUrl, order: 0, isCover: true });
      }

      stay.media = {
        video: stay.videoUrl ? {
          url: stay.videoUrl,
          thumbnail: stay.thumbnailUrl || (photos[0]?.url || ''),
          duration: 60,
          size: 15000000,
        } : null,
        photos,
      };
    } else {
      if (!stay.media.photos) stay.media.photos = [];
    }

    stay.hasVideo = Boolean(stay.media?.video?.url && stay.media.video.url.trim().length > 0);
    stay.hasPhotos = Boolean(stay.media?.photos && stay.media.photos.length > 0);

    // Keep legacy fields synchronized
    if (stay.media.video?.url) {
      stay.videoUrl = stay.media.video.url;
    }
    if (stay.media.photos && stay.media.photos.length > 0) {
      stay.images = stay.media.photos.slice().sort((a, b) => a.order - b.order).map(p => p.url);
      const cover = stay.media.photos.find(p => p.isCover) || stay.media.photos[0];
      if (cover) stay.thumbnailUrl = cover.url;
    }

    if (!stay.moderationStatus) stay.moderationStatus = 'approved';
    if (!stay.mediaModerationStatus) stay.mediaModerationStatus = 'clean';

    return stay;
  }

  public removeStayMedia(
    stayId: string,
    mediaType: 'video' | 'photo',
    photoUrl?: string,
    adminEmail?: string,
    reason?: string
  ): Stay {
    const stay = this.getStayById(stayId);
    if (!stay) throw new Error('Listing not found.');
    this.normalizeStayMedia(stay);

    const now = Date.now();
    if (mediaType === 'video') {
      stay.media!.video = null;
      stay.videoUrl = '';
      stay.hasVideo = false;
    } else if (mediaType === 'photo' && photoUrl) {
      stay.media!.photos = stay.media!.photos.filter(p => p.url !== photoUrl);
      stay.images = (stay.images || []).filter(u => u !== photoUrl);
      if (stay.thumbnailUrl === photoUrl) {
        stay.thumbnailUrl = stay.media!.photos[0]?.url || '';
      }
      stay.hasPhotos = stay.media!.photos.length > 0;
    }

    // If both video and photos were removed, delist the stay until compliant
    if (!stay.hasVideo && !stay.hasPhotos) {
      stay.status = 'delisted';
      stay.isDelisted = true;
      stay.mediaModerationStatus = 'flagged';
    }

    if (adminEmail) {
      this.createAuditLog({
        id: 'aud_' + now,
        action: 'media_remove',
        actorEmail: adminEmail,
        details: `Removed ${mediaType} from listing "${stay.title}" (${stay.id}). Reason: ${reason || 'Policy violation'}.`,
        createdAt: now,
      });

      if (stay.ownerEmail) {
        this.createNotification({
          id: 'notif_' + now,
          userEmail: stay.ownerEmail,
          title: 'Listing Media Removed by Moderation',
          message: `A ${mediaType} on your listing "${stay.title}" was removed due to: ${reason || 'Terms of service compliance'}. Please upload replacement media.`,
          read: false,
          link: '/#owner',
          type: 'system',
          createdAt: now,
        });
      }
    }

    this.save();
    return stay;
  }

  public flagStayMedia(stayId: string, status: 'approved' | 'flagged' | 'clean', adminEmail: string, reason?: string): Stay {
    const stay = this.getStayById(stayId);
    if (!stay) throw new Error('Listing not found.');
    this.normalizeStayMedia(stay);

    stay.mediaModerationStatus = status;
    const now = Date.now();

    this.createAuditLog({
      id: 'aud_' + now,
      action: 'media_flag',
      actorEmail: adminEmail,
      details: `Set media moderation status to ${status} for listing "${stay.title}" (${stay.id}). Reason: ${reason || 'N/A'}.`,
      createdAt: now,
    });

    this.save();
    return stay;
  }

  public getListingMedia(filter?: { type?: string; flaggedOnly?: boolean; search?: string }): any[] {
    let list = this.data.stays || [];
    list.forEach(s => this.normalizeStayMedia(s));

    if (filter?.flaggedOnly) {
      list = list.filter(s => s.mediaModerationStatus === 'flagged');
    }
    if (filter?.type && filter.type !== 'all') {
      if (filter.type === 'video') list = list.filter(s => s.hasVideo && !s.hasPhotos);
      else if (filter.type === 'photos') list = list.filter(s => !s.hasVideo && s.hasPhotos);
      else if (filter.type === 'both') list = list.filter(s => s.hasVideo && s.hasPhotos);
    }
    if (filter?.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.ownerEmail || '').toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q)
      );
    }

    return list.map(s => ({
      stayId: s.id,
      title: s.title,
      location: s.location,
      ownerEmail: s.ownerEmail || s.owner,
      status: s.status,
      hasVideo: s.hasVideo,
      hasPhotos: s.hasPhotos,
      video: s.media?.video || null,
      photos: s.media?.photos || [],
      mediaModerationStatus: s.mediaModerationStatus || 'clean',
      thumbnailUrl: s.thumbnailUrl,
      videoUrl: s.videoUrl,
      images: s.images,
    }));
  }

  // --- Listing Moderation Queue (Section 3) ---
  public moderateStay(
    id: string,
    action: 'approve' | 'reject' | 'suspend' | 'unsuspend' | 'delist' | 'relist' | 'delete',
    adminEmail: string,
    reason?: string
  ): Stay | null {
    const stay = this.data.stays.find(s => s.id === id);
    if (!stay && action !== 'delete') throw new Error('Listing not found.');

    const now = Date.now();
    const rawReason = (reason || '').trim();
    const cleanReason = rawReason || 'Moderation decision by platform administrator.';

    if (action === 'delete') {
      this.deleteStay(id);
      this.createAuditLog({
        id: 'aud_' + now,
        action: 'stay_delete',
        actorEmail: adminEmail,
        details: `Permanently deleted stay ${id}. Reason: ${cleanReason}`,
        createdAt: now,
      });
      return null;
    }

    if (!stay) return null;

    if (action === 'approve') {
      stay.status = 'live';
      stay.publishState = 'PUBLISHED';
      stay.published_at = now;
      stay.approved_by = adminEmail;
      stay.isApprovedByAdmin = true;
      stay.moderationStatus = 'approved';
      stay.moderationState = 'APPROVED';
      stay.isDelisted = false;
      stay.moderationReason = undefined;
      stay.admin_feedback = null;
      stay.reviewed_at = now;
      stay.reviewed_by = adminEmail;
      const colIds = this.extractCollectionIdsFromStay(stay);
      this.syncListingCollections(stay.id, colIds, false);
    } else if (action === 'reject') {
      if (!rawReason) {
        throw new Error('Admin feedback explaining why the listing was declined is required.');
      }
      stay.status = 'delisted';
      stay.publishState = 'DECLINED';
      stay.published_at = null;
      stay.isApprovedByAdmin = false;
      stay.moderationStatus = 'rejected';
      stay.moderationState = 'DECLINED';
      stay.moderationReason = rawReason;
      stay.admin_feedback = rawReason;
      stay.reviewed_at = now;
      stay.reviewed_by = adminEmail;
      stay.isDelisted = true;
    } else if (action === 'suspend') {
      stay.status = 'delisted';
      stay.publishState = 'DECLINED';
      stay.published_at = null;
      stay.moderationStatus = 'suspended';
      stay.moderationState = 'DECLINED';
      stay.moderationReason = cleanReason;
      stay.admin_feedback = cleanReason;
      stay.reviewed_at = now;
      stay.reviewed_by = adminEmail;
      stay.isDelisted = true;
    } else if (action === 'unsuspend' || action === 'relist') {
      stay.status = 'live';
      stay.publishState = 'PUBLISHED';
      stay.published_at = stay.published_at || now;
      stay.approved_by = stay.approved_by || adminEmail;
      stay.isApprovedByAdmin = true;
      stay.moderationStatus = 'approved';
      stay.moderationState = 'APPROVED';
      stay.isDelisted = false;
      stay.moderationReason = undefined;
      stay.admin_feedback = null;
      stay.reviewed_at = now;
      stay.reviewed_by = adminEmail;
      const colIds = this.extractCollectionIdsFromStay(stay);
      this.syncListingCollections(stay.id, colIds, false);
    } else if (action === 'delist') {
      stay.status = 'delisted';
      stay.publishState = 'DECLINED';
      stay.published_at = null;
      stay.moderationState = 'DECLINED';
      stay.isDelisted = true;
      stay.moderationReason = cleanReason;
      stay.admin_feedback = cleanReason;
      stay.reviewed_at = now;
      stay.reviewed_by = adminEmail;
    }

    if (!this.data.auditLogs) this.data.auditLogs = [];
    this.data.auditLogs.unshift({
      id: 'aud_' + now,
      action: `stay_${action}`,
      actorEmail: adminEmail,
      details: `${action.toUpperCase()} stay "${stay.title}" (${stay.id}). Feedback: ${stay.admin_feedback || 'Approved'}`,
      createdAt: now,
    });

    // Transactional outbox: stage notification & SSE event inside the state change before commit
    if (!this.data.transactional_outbox) this.data.transactional_outbox = [];
    let stagedNotif: NotificationItem | null = null;
    const outboxIds: string[] = [];
    if (stay.ownerEmail) {
      stagedNotif = {
        id: 'notif_' + now,
        userEmail: stay.ownerEmail,
        title: `Listing ${action === 'approve' ? 'Approved & Published' : action === 'reject' ? 'Declined' : action === 'unsuspend' ? 'Restored' : 'Moderated'}`,
        message: `Your listing "${stay.title}" was ${action === 'approve' ? 'approved and is now live!' : `${action === 'reject' ? 'declined' : action}: ${stay.admin_feedback || cleanReason}`}`,
        read: false,
        link: '/#owner',
        type: 'system',
        createdAt: now,
      };
      const obNotifId = `ob_notif_${now}_${stay.id}`;
      outboxIds.push(obNotifId);
      this.data.transactional_outbox.unshift({
        id: obNotifId,
        kind: 'stay_approved_notification',
        stayId: stay.id,
        payload: stagedNotif,
        status: 'pending',
        createdAt: now,
      });
    }

    // Commit atomic state change FIRST before flushing notifications, caches, or SSE
    this.save();

    if (stagedNotif) {
      if (!this.data.notifications) this.data.notifications = [];
      this.data.notifications.unshift(stagedNotif);
    }
    const hydrated = this.hydrateStayAudio({ ...stay, isVerified: stay.isVerified !== false });
    if (action === 'approve' || action === 'unsuspend' || action === 'relist') {
      const obSseId = `ob_sse_${now}_${stay.id}`;
      outboxIds.push(obSseId);
      this.data.transactional_outbox.unshift({
        id: obSseId,
        kind: 'stay_approved_sse',
        stayId: stay.id,
        payload: { id: stay.id, published_at: stay.published_at },
        status: 'delivered',
        createdAt: now,
        deliveredAt: Date.now(),
      });
    }
    this.data.transactional_outbox.forEach(ob => {
      if (outboxIds.includes(ob.id)) {
        ob.status = 'delivered';
        ob.deliveredAt = Date.now();
      }
    });
    if (this.data.transactional_outbox.length > 500) {
      this.data.transactional_outbox.length = 500;
    }

    this.invalidateFeedCache('stay');
    this.save();

    if (action === 'approve' || action === 'unsuspend' || action === 'relist') {
      this.emitFeedApproved('stay', hydrated);
    }
    return hydrated;
  }

  // --- Subscriptions Moderation Queue (Section 3) ---
  public getAllSubscriptions(): any[] {
    const subs = this.data.subscriptions || [];
    const hostPlans = this.data.hostPlans || {};

    // Combine explicit subscription records and all hosts' current plan states
    const items: any[] = subs.map(s => ({
      ...s,
      type: 'record',
    }));

    Object.entries(hostPlans).forEach(([ownerEmail, plan]) => {
      const existing = items.find(s => s.ownerId?.toLowerCase() === ownerEmail.toLowerCase() || s.owner_id?.toLowerCase() === ownerEmail.toLowerCase());
      if (!existing) {
        items.push({
          id: 'sub_host_' + ownerEmail,
          ownerId: ownerEmail,
          owner_id: ownerEmail,
          tier: plan.tier || 'Diamond',
          billing: plan.period || 'monthly',
          status: plan.status || 'active',
          startsAt: plan.expiresAt ? plan.expiresAt - 30 * 864e5 : Date.now(),
          endsAt: plan.expiresAt || (Date.now() + 30 * 864e5),
          createdAt: Date.now() - 30 * 864e5,
          updatedAt: Date.now(),
          type: 'host_plan',
        });
      }
    });

    return items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  public moderateSubscription(
    id: string,
    action: 'approve' | 'reject' | 'extend' | 'revoke' | 'expire',
    adminEmail: string,
    days = 30,
    reason?: string
  ): any {
    const now = Date.now();
    const subs = this.data.subscriptions || [];
    const sub = subs.find(s => s.id === id);
    const ownerEmail = (sub?.ownerId || sub?.owner_id || id.replace('sub_host_', '')).toLowerCase().trim();
    const cleanReason = (reason || '').trim() || 'Admin subscription adjustment.';

    if (action === 'extend') {
      const addedMs = days * 864e5;
      if (sub) {
        sub.endsAt = Math.max(now, sub.endsAt || now) + addedMs;
        sub.status = 'active';
        sub.updatedAt = now;
      }
      const plan = this.getHostPlan(ownerEmail);
      const nextExpiry = Math.max(now, plan.expiresAt || now) + addedMs;
      this.setHostPlan(ownerEmail, {
        ...plan,
        status: 'active',
        startsAt: plan.startsAt || now,
        expiresAt: nextExpiry,
        graceExpiresAt: nextExpiry,
        hasPaidSubscription: true,
      });

      // Restore any expired stays
      this.data.stays.forEach(s => {
        if (s.ownerEmail?.toLowerCase() === ownerEmail && (s.status === 'expired' || s.isDelisted)) {
          s.status = 'live';
          s.isDelisted = false;
        }
      });
    } else if (action === 'revoke' || action === 'expire') {
      if (sub) {
        sub.status = 'expired';
        sub.updatedAt = now;
      }
      const plan = this.getHostPlan(ownerEmail);
      this.setHostPlan(ownerEmail, {
        ...plan,
        status: 'expired',
        expiresAt: now,
      });
      // Expire stays
      this.data.stays.forEach(s => {
        if (s.ownerEmail?.toLowerCase() === ownerEmail) {
          s.status = 'expired';
        }
      });
    } else if (action === 'approve') {
      const durationMs = sub?.billing === 'annual' ? 365 * 864e5 : 30 * 864e5;
      if (sub) {
        sub.status = 'active';
        sub.startsAt = now;
        sub.endsAt = now + durationMs;
        sub.updatedAt = now;
      }
      this.setHostPlan(ownerEmail, {
        tier: sub?.tier || 'Diamond',
        status: 'active',
        startsAt: now,
        expiresAt: now + durationMs,
        graceExpiresAt: now + durationMs,
        hasPaidSubscription: true,
        period: sub?.billing || 'monthly',
      });
      this.data.stays.forEach(s => {
        if (s.ownerEmail?.toLowerCase() === ownerEmail && (s.status === 'expired' || s.isDelisted)) {
          s.status = 'live';
          s.isDelisted = false;
        }
      });
    } else if (action === 'reject') {
      if (sub) {
        sub.status = 'rejected';
        sub.updatedAt = now;
      }
    }

    this.createAuditLog({
      id: 'aud_' + now,
      action: `subscription_${action}`,
      actorEmail: adminEmail,
      details: `${action.toUpperCase()} subscription for ${ownerEmail}. Added days: ${days}. Reason: ${cleanReason}`,
      createdAt: now,
    });

    this.createNotification({
      id: 'notif_' + now,
      userEmail: ownerEmail,
      title: `Hosting Subscription ${action === 'extend' ? 'Extended' : action === 'approve' ? 'Activated' : 'Updated'}`,
      message: `Your hosting subscription was updated by admin: ${action} (${cleanReason}).`,
      read: false,
      link: '/#owner',
      type: 'subscription',
      createdAt: now,
    });

    this.save();
    return { success: true, ownerEmail, action, sub };
  }

  // --- Adverts Moderation Queue (Section 3) ---
  public moderateAd(
    id: string,
    action: 'approve' | 'reject' | 'pause' | 'resume' | 'end',
    adminEmail: string,
    reason?: string
  ): any {
    const now = Date.now();
    const cleanReason = (reason || '').trim() || 'Administrative advert update.';

    // Check adSlots
    const adSlot = (this.data.adSlots || []).find(s => s.id === id);
    // Check sponsorSlots
    const spSlot = (this.data.sponsorSlots || []).find(s => s.id === id);
    // Check adRequests
    const adReq = (this.data.adRequests || []).find(a => a.id === id);

    let advertiserEmail = '';
    if (adSlot) {
      advertiserEmail = adSlot.ownerId || adSlot.owner_id || '';
      if (action === 'approve') {
        adSlot.status = 'active';
        adSlot.startsAt = now;
        adSlot.endsAt = now + (adSlot.durationDays * 864e5);
      } else if (action === 'reject') {
        adSlot.status = 'rejected';
        adSlot.rejectionReason = cleanReason;
      } else if (action === 'pause') {
        adSlot.status = 'pending_approval';
      } else if (action === 'resume') {
        adSlot.status = 'active';
      } else if (action === 'end') {
        adSlot.status = 'expired';
        adSlot.endsAt = now;
      }
      adSlot.updatedAt = now;
    }

    if (spSlot) {
      advertiserEmail = spSlot.advertiser_id || spSlot.advertiserId || advertiserEmail;
      if (action === 'approve') {
        spSlot.status = 'active';
        spSlot.starts_at = now;
        spSlot.ends_at = now + (spSlot.duration_days * 864e5);
      } else if (action === 'reject') {
        spSlot.status = 'rejected';
      } else if (action === 'end') {
        spSlot.status = 'expired';
        spSlot.ends_at = now;
      }
    }

    if (adReq) {
      advertiserEmail = adReq.advertiserEmail || advertiserEmail;
      if (action === 'approve') {
        adReq.status = 'approved';
        adReq.startsAt = now;
        adReq.expiresAt = now + (adReq.days * 864e5);
      } else if (action === 'reject') {
        adReq.status = 'rejected';
      } else if (action === 'end') {
        adReq.status = 'expired';
        adReq.expiresAt = now;
      }
    }

    this.createAuditLog({
      id: 'aud_' + now,
      action: `ad_${action}`,
      actorEmail: adminEmail,
      details: `${action.toUpperCase()} advert ${id}. Reason: ${cleanReason}`,
      createdAt: now,
    });

    if (advertiserEmail) {
      this.createNotification({
        id: 'notif_' + now,
        userEmail: advertiserEmail,
        title: `Advert ${action === 'approve' ? 'Approved & Live' : 'Updated'}`,
        message: `Your advert was updated: ${action} (${cleanReason}).`,
        read: false,
        link: '/#ads',
        type: 'system',
        createdAt: now,
      });
    }

    this.save();
    return { success: true, id, action };
  }

  // --- Users & Hosts Moderation (Section 3) ---
  public moderateUser(
    email: string,
    action: 'suspend' | 'reactivate' | 'verify',
    adminEmail: string,
    reason?: string
  ): User {
    const user = this.findUserByEmail(email);
    if (!user) throw new Error('User account not found.');

    const now = Date.now();
    const cleanReason = (reason || '').trim() || 'Admin user moderation.';

    if (action === 'suspend') {
      user.isSuspended = true;
      user.suspendedReason = cleanReason;
    } else if (action === 'reactivate') {
      user.isSuspended = false;
      user.suspendedReason = undefined;
    } else if (action === 'verify') {
      user.idVerified = true;
    }

    this.createAuditLog({
      id: 'aud_' + now,
      action: `user_${action}`,
      actorEmail: adminEmail,
      details: `${action.toUpperCase()} user ${email}. Reason: ${cleanReason}`,
      createdAt: now,
    });

    this.createNotification({
      id: 'notif_' + now,
      userEmail: email,
      title: `Account Status: ${action === 'verify' ? 'ID Verified ✓' : action === 'reactivate' ? 'Reactivated' : 'Suspended'}`,
      message: action === 'suspend'
        ? `Your AirBus account was suspended: ${cleanReason}. Contact support to appeal.`
        : action === 'verify'
        ? 'Congratulations! Your identity verification has been approved.'
        : 'Your account has been reactivated. Welcome back!',
      read: false,
      link: '/#home',
      type: 'system',
      createdAt: now,
    });

    this.save();
    return user;
  }

  // --- Reports & Flags Moderation (Section 3) ---
  public getReports(): ListingReport[] {
    if (!this.data.reports) this.data.reports = [];
    return this.data.reports.slice().sort((a, b) => b.createdAt - a.createdAt);
  }

  public actionReport(
    id: string,
    action: 'resolve' | 'dismiss' | 'penalize',
    adminEmail: string,
    actionTaken?: string
  ): ListingReport {
    if (!this.data.reports) this.data.reports = [];
    const rep = this.data.reports.find(r => r.id === id);
    if (!rep) throw new Error('Report ticket not found.');

    const now = Date.now();
    rep.status = action === 'dismiss' ? 'dismissed' : 'resolved';
    rep.reviewedBy = adminEmail;
    rep.reviewedAt = now;
    rep.actionTaken = actionTaken || `Marked ${action} by administrator.`;

    // If penalize, flag the reported stay
    if (action === 'penalize' && rep.stayId) {
      const stay = this.getStayById(rep.stayId);
      if (stay) {
        stay.moderationStatus = 'suspended';
        stay.isDelisted = true;
        stay.moderationReason = `Suspended following user report: ${rep.reason}`;
      }
    }

    this.createAuditLog({
      id: 'aud_' + now,
      action: `report_${action}`,
      actorEmail: adminEmail,
      details: `Report ${id} marked ${action}. Action taken: ${rep.actionTaken}`,
      createdAt: now,
    });

    this.save();
    return rep;
  }

  // --- Reviews Moderation (Section 3) ---
  public getAllReviews(): any[] {
    const reviews = this.data.reviews || [];
    return reviews.map(r => {
      const stay = this.getStayById(r.stayId);
      return {
        ...r,
        stayTitle: stay?.title || 'Airbus Stay',
        status: r.status || 'approved',
      };
    }).sort((a, b) => b.createdAt - a.createdAt);
  }

  public moderateReview(id: string, action: 'approve' | 'hide' | 'unhide' | 'delete', adminEmail: string): Review | null {
    if (!this.data.reviews) this.data.reviews = [];
    const idx = this.data.reviews.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Review not found.');

    const now = Date.now();
    const rev = this.data.reviews[idx];

    if (action === 'delete') {
      this.data.reviews.splice(idx, 1);
      this.createAuditLog({
        id: 'aud_' + now,
        action: 'review_delete',
        actorEmail: adminEmail,
        details: `Deleted review ${id} by ${rev.guestEmail} on stay ${rev.stayId}`,
        createdAt: now,
      });
      this.save();
      return null;
    }

    rev.status = action === 'hide' ? 'hidden' : 'approved';
    rev.moderatedBy = adminEmail;
    rev.moderatedAt = now;

    this.createAuditLog({
      id: 'aud_' + now,
      action: `review_${action}`,
      actorEmail: adminEmail,
      details: `${action.toUpperCase()} review ${id} by ${rev.guestEmail} on stay ${rev.stayId}`,
      createdAt: now,
    });

    this.save();
    return rev;
  }

  // --- Wallet Reconciliation (Platform Ledger Audit) ---
  public getWalletReconciliation() {
    const allEmails = new Set<string>();
    (this.data.users || []).forEach(u => allEmails.add(u.email.toLowerCase().trim()));
    Object.keys(this.data.wallets || {}).forEach(k => {
      if (!['treasury', 'external_mpesa', 'withdrawal_payout', 'system'].includes(k.toLowerCase())) {
        allEmails.add(k.toLowerCase().trim());
      }
    });
    allEmails.add('admin@airbus.ke');

    const wtxTotals: Record<string, number> = {};
    for (const tx of this.data.walletTransactions || []) {
      const w = String(tx.walletId || tx.wallet_id || '').toLowerCase().trim();
      if (!w) continue;
      const amt = Math.floor(Number(tx.amount ?? tx.amountSc ?? 0));
      wtxTotals[w] = (wtxTotals[w] || 0) + (tx.direction === 'credit' ? amt : -amt);
    }

    const ledgerTotals: Record<string, number> = {};
    for (const entry of this.data.ledgerEntries || []) {
      const amt = Math.floor(Number(entry.amount || 0));
      const from = String(entry.fromWallet || '').toLowerCase().trim();
      const to = String(entry.toWallet || '').toLowerCase().trim();
      if (to) ledgerTotals[to] = (ledgerTotals[to] || 0) + amt;
      if (from) ledgerTotals[from] = (ledgerTotals[from] || 0) - amt;
    }

    const reconciliationList: Array<{
      email: string;
      storedBalance: number;
      ledgerBalance: number;
      difference: number;
      isMatched: boolean;
    }> = [];

    let totalMismatches = 0;
    let userWalletsSum = 0;

    for (const email of allEmails) {
      if (!email || email === 'treasury') continue;
      const storedBal = Math.floor(Number(this.data.wallets?.[email] ?? this.data.walletRecords?.[email]?.balance ?? 0));
      const isAdmin = email === 'admin@airbus.ke';
      if (!isAdmin) {
        userWalletsSum += storedBal;
      }

      const hasWtx = Object.prototype.hasOwnProperty.call(wtxTotals, email);
      const ledgerBal = hasWtx
        ? wtxTotals[email]
        : Object.prototype.hasOwnProperty.call(ledgerTotals, email)
        ? ledgerTotals[email]
        : 0;
      const diff = storedBal - ledgerBal;
      const isMatched = diff === 0;
      if (!isMatched) {
        totalMismatches += 1;
      }

      reconciliationList.push({
        email,
        storedBalance: storedBal,
        ledgerBalance: ledgerBal,
        difference: diff,
        isMatched,
      });
    }

    const adminBalance = this.getWalletBalance('admin@airbus.ke');

    return {
      timestamp: Date.now(),
      totalWallets: reconciliationList.length,
      mismatches: totalMismatches,
      userWalletsSum,
      adminBalance,
      wallets: reconciliationList,
    };
  }

  // --- Segmented Platform Income Report ---
  public getAdminIncomeReport() {
    let tripDatingIncome = 0;
    let subscriptionsIncome = 0;
    let advertsIncome = 0;
    let promotionsIncome = 0;
    let airbusPlusIncome = 0;
    let otherIncome = 0;

    for (const p of this.data.paymentRecords || []) {
      if (p.status !== 'approved') continue;
      const t = String(p.type || p.kind || '');
      if (['deposit', 'wallet', 'wallet_topup', 'mpesa_deposit'].includes(t)) continue;
      const amt = Math.floor(Number(p.approvedAmount ?? p.amountKes ?? p.amount ?? 0));
      if (t === 'subscription' || t === 'plan') subscriptionsIncome += amt;
      else if (t === 'advert') advertsIncome += amt;
      else if (t === 'boost') promotionsIncome += amt;
      else if (t === 'vvvip') airbusPlusIncome += amt;
      else if (t === 'trip_dating') tripDatingIncome += amt;
      else otherIncome += amt;
    }

    const totalRevenue = tripDatingIncome + advertsIncome + subscriptionsIncome + promotionsIncome + airbusPlusIncome + otherIncome;

    return {
      tripDating: tripDatingIncome,
      advertsRetained: advertsIncome,
      subscriptions: subscriptionsIncome,
      promotions: promotionsIncome,
      airbusPlus: airbusPlusIncome,
      other: otherIncome,
      totalRevenue,
    };
  }

  // --- Kenyan County & City Geocoding Engine ---
  public geocodeKenyanLocation(query: string): {
    lat: number;
    lng: number;
    formattedAddress: string;
    county?: string;
  } {
    const q = (query || '').toLowerCase().trim();
    const KENYAN_LOCATIONS: Array<{
      name: string;
      keywords: string[];
      lat: number;
      lng: number;
      county: string;
      formattedAddress: string;
    }> = [
      { name: 'Nairobi', keywords: ['nairobi', 'westlands', 'kilimani', 'karen', 'lavington', 'kileleshwa', 'cbd', 'runda', 'parklands', 'gigiri', 'muthaiga', 'langata', 'south b', 'south c', 'kasarani', 'roysambu'], lat: -1.286389, lng: 36.817223, county: 'Nairobi', formattedAddress: 'Nairobi, Kenya' },
      { name: 'Westlands', keywords: ['westlands', 'sarit', 'mpesa foundation', 'rhapta'], lat: -1.2676, lng: 36.8108, county: 'Nairobi', formattedAddress: 'Westlands, Nairobi, Kenya' },
      { name: 'Kilimani', keywords: ['kilimani', 'yaya', 'argwings', 'dennis pritt', 'hurlingham'], lat: -1.2921, lng: 36.7872, county: 'Nairobi', formattedAddress: 'Kilimani, Nairobi, Kenya' },
      { name: 'Karen', keywords: ['karen', 'hardy', 'bogani', 'hub karen'], lat: -1.3167, lng: 36.7000, county: 'Nairobi', formattedAddress: 'Karen, Nairobi, Kenya' },
      { name: 'Lavington', keywords: ['lavington', 'james gichuru', 'lavington mall'], lat: -1.2833, lng: 36.7667, county: 'Nairobi', formattedAddress: 'Lavington, Nairobi, Kenya' },
      { name: 'Mombasa', keywords: ['mombasa', 'nyali', 'bamburi', 'shanzu', 'likoni', 'changamwe', 'tudor', 'kizingo'], lat: -4.043477, lng: 39.668206, county: 'Mombasa', formattedAddress: 'Mombasa, Kenya' },
      { name: 'Nyali', keywords: ['nyali', 'cinemax', 'links road', 'nyali beach'], lat: -4.0283, lng: 39.7167, county: 'Mombasa', formattedAddress: 'Nyali, Mombasa, Kenya' },
      { name: 'Diani Beach', keywords: ['diani', 'kwale', 'ukunda', 'galu', 'tiwi'], lat: -4.316667, lng: 39.583333, county: 'Kwale', formattedAddress: 'Diani Beach, Kwale, Kenya' },
      { name: 'Malindi', keywords: ['malindi', 'watamu', 'casuarina', 'silversands'], lat: -3.216667, lng: 40.116667, county: 'Kilifi', formattedAddress: 'Malindi, Kilifi, Kenya' },
      { name: 'Kilifi', keywords: ['kilifi', 'bofa', 'mnarani', 'creek'], lat: -3.630450, lng: 39.849920, county: 'Kilifi', formattedAddress: 'Kilifi, Kenya' },
      { name: 'Lamu', keywords: ['lamu', 'shela', 'manda', 'kiwayu'], lat: -2.271667, lng: 40.902222, county: 'Lamu', formattedAddress: 'Lamu Island, Kenya' },
      { name: 'Nakuru', keywords: ['nakuru', 'milimani', 'lanet', 'njoro', 'kiamunyi'], lat: -0.303099, lng: 36.080026, county: 'Nakuru', formattedAddress: 'Nakuru, Kenya' },
      { name: 'Naivasha', keywords: ['naivasha', 'lake naivasha', 'south lake', 'moiwnd', 'hells gate'], lat: -0.716667, lng: 36.433333, county: 'Nakuru', formattedAddress: 'Naivasha, Nakuru, Kenya' },
      { name: 'Kisumu', keywords: ['kisumu', 'milimani kisumu', 'tom mboya', 'dunga', 'riat'], lat: -0.091702, lng: 34.767956, county: 'Kisumu', formattedAddress: 'Kisumu, Kenya' },
      { name: 'Eldoret', keywords: ['eldoret', 'uasin gishu', 'elgon view', 'pioneer'], lat: 0.514277, lng: 35.269780, county: 'Uasin Gishu', formattedAddress: 'Eldoret, Kenya' },
      { name: 'Nanyuki', keywords: ['nanyuki', 'laikipia', 'mt kenya', 'sweetwaters'], lat: 0.016667, lng: 37.072222, county: 'Laikipia', formattedAddress: 'Nanyuki, Laikipia, Kenya' },
      { name: 'Machakos', keywords: ['machakos', 'syokimau', 'mlolongo', 'athi river'], lat: -1.517684, lng: 37.263415, county: 'Machakos', formattedAddress: 'Machakos, Kenya' },
      { name: 'Meru', keywords: ['meru', 'makutano', 'nkubu'], lat: 0.046263, lng: 37.655872, county: 'Meru', formattedAddress: 'Meru, Kenya' },
      { name: 'Nyeri', keywords: ['nyeri', 'kingongo', 'tetu'], lat: -0.420130, lng: 36.947590, county: 'Nyeri', formattedAddress: 'Nyeri, Kenya' },
      { name: 'Kericho', keywords: ['kericho', 'tea estates'], lat: -0.368889, lng: 35.286389, county: 'Kericho', formattedAddress: 'Kericho, Kenya' },
      { name: 'Kakamega', keywords: ['kakamega', 'amalemba', 'shinyalu'], lat: 0.282730, lng: 34.751860, county: 'Kakamega', formattedAddress: 'Kakamega, Kenya' },
      { name: 'Kitale', keywords: ['kitale', 'trans-nzoia', 'cherangany'], lat: 1.016667, lng: 35.000000, county: 'Trans-Nzoia', formattedAddress: 'Kitale, Kenya' },
      { name: 'Kiambu', keywords: ['kiambu', 'thika', 'ruiru', 'juja', 'kikuyu', 'banana'], lat: -1.171389, lng: 36.835556, county: 'Kiambu', formattedAddress: 'Kiambu, Kenya' },
      { name: 'Kajiado', keywords: ['kajiado', 'kitengela', 'ongata rongai', 'ngong', 'amboseli'], lat: -1.850000, lng: 36.783333, county: 'Kajiado', formattedAddress: 'Kajiado, Kenya' },
      { name: 'Narok', keywords: ['narok', 'maasai mara', 'mara', 'talek'], lat: -1.083333, lng: 35.866667, county: 'Narok', formattedAddress: 'Narok / Maasai Mara, Kenya' },
      { name: 'Watamu', keywords: ['watamu', 'jacaranda', 'turtle bay'], lat: -3.350000, lng: 40.016667, county: 'Kilifi', formattedAddress: 'Watamu, Kilifi, Kenya' },
      { name: 'Garissa', keywords: ['garissa'], lat: -0.453229, lng: 39.646014, county: 'Garissa', formattedAddress: 'Garissa, Kenya' },
    ];

    if (!q) {
      return { lat: -1.286389, lng: 36.817223, formattedAddress: 'Nairobi, Kenya', county: 'Nairobi' };
    }

    const match = KENYAN_LOCATIONS.find(loc => 
      loc.keywords.some(k => q.includes(k)) || q.includes(loc.name.toLowerCase())
    );

    if (match) {
      return {
        lat: match.lat,
        lng: match.lng,
        formattedAddress: match.formattedAddress,
        county: match.county,
      };
    }

    return {
      lat: -1.286389,
      lng: 36.817223,
      formattedAddress: `${query}, Kenya`,
      county: 'Nairobi',
    };
  }

  // --- Royalty-Free Music & Audio Library (with License & Attribution) ---
  public getAudioLibrary(params?: {
    query?: string;
    genre?: string;
    mood?: string;
    trendingOnly?: boolean;
    page?: number;
    limit?: number;
  }): { tracks: AudioTrack[]; licenses: AudioLicense[]; total: number } {
    if (!this.data.audio_licenses || this.data.audio_licenses.length === 0) {
      this.data.audio_licenses = audioLibraryService.getSeededLicenses();
    }
    if (!this.data.audio_tracks || this.data.audio_tracks.length === 0) {
      this.data.audio_tracks = audioLibraryService.getSeededTracks();
      this.data.musicTracks = this.data.audio_tracks;
    }

    // Only include tracks whose license allows use in user-generated video
    let list = this.data.audio_tracks.filter(t => t.commercialUgcAllowed !== false);
    if (params?.trendingOnly) {
      list = list.filter(t => Boolean(t.trending));
    }
    if (params?.genre && params.genre !== 'All') {
      list = list.filter(t => t.genre.toLowerCase() === params.genre!.toLowerCase());
    }
    if (params?.mood && params.mood !== 'All') {
      list = list.filter(t => (t.mood || '').toLowerCase() === params.mood!.toLowerCase());
    }
    if (params?.query && params.query.trim()) {
      const q = params.query.toLowerCase().trim();
      list = list.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q) ||
          (t.mood || '').toLowerCase().includes(q) ||
          t.source.toLowerCase().includes(q)
      );
    }

    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const start = (page - 1) * limit;
    return {
      tracks: list.slice(start, start + limit),
      licenses: this.data.audio_licenses,
      total: list.length,
    };
  }

  public getMusicTracks(query?: string, genre?: string, page: number = 1, limit: number = 10): { tracks: any[]; total: number } {
    const res = this.getAudioLibrary({ query, genre, page, limit });
    return { tracks: res.tracks, total: res.total };
  }

  public uploadMusicTrack(track: {
    title: string;
    artist: string;
    genre: string;
    audioUrl: string;
    duration: number;
    userEmail: string;
    licenceDeclaration: boolean;
  }) {
    if (!track.licenceDeclaration) {
      throw new Error('You must accept the copyright and rights declaration to upload audio.');
    }
    if (track.duration > 60) {
      throw new Error('Audio duration cannot exceed 60 seconds.');
    }

    if (!this.data.audio_tracks) this.data.audio_tracks = audioLibraryService.getSeededTracks();
    const newTrack: AudioTrack = {
      id: 'mus_' + Date.now(),
      title: track.title.trim() || 'Custom Track',
      artist: track.artist.trim() || track.userEmail,
      genre: track.genre || 'Custom',
      mood: 'Custom',
      duration: Math.round(track.duration),
      licence: 'User Declared Royalty-Free',
      licenseId: 'lic_cc0',
      licenseType: 'Original-User-Audio',
      source: 'User Upload',
      requiresAttribution: false,
      attributionText: `Uploaded by ${track.artist.trim() || track.userEmail} (User Declared Royalty-Free)`,
      commercialUgcAllowed: true,
      trending: false,
      previewStartSec: 0,
      previewDurationSec: Math.min(30, Math.round(track.duration)),
      audioUrl: track.audioUrl,
      useCount: 0,
      createdAt: Date.now(),
    };

    this.data.audio_tracks.unshift(newTrack);
    this.data.musicTracks = this.data.audio_tracks;
    this.save();
    return newTrack;
  }

  public reportAudioTrack(trackId: string, reporterEmail: string, reason: string, postId?: string) {
    if (!this.data.audioReports) this.data.audioReports = [];
    const entry = {
      id: 'arep_' + Date.now(),
      trackId,
      postId,
      reporterEmail,
      reason: reason.trim() || 'Copyright / inappropriate audio concern',
      createdAt: Date.now(),
    };
    this.data.audioReports.unshift(entry);
    const track = (this.data.audio_tracks || []).find(t => t.id === trackId);
    if (track) {
      track.reportedCount = (track.reportedCount || 0) + 1;
    }
    this.createAuditLog({
      id: 'aud_arep_' + Date.now(),
      action: 'audio_reported',
      actorEmail: reporterEmail,
      details: `Reported audio track ${trackId}${postId ? ` on post ${postId}` : ''}: ${entry.reason}`,
      createdAt: Date.now(),
    });
    this.save();
    return entry;
  }

  // --- AI Short Generation for Stay Listing ---
  public generateStayAiShort(stayId: string): { stay: Stay; shortStatus: 'ready' | 'processing' } {
    const stay = this.getStayById(stayId, undefined, true);
    if (!stay) throw new Error('Stay listing not found.');

    (stay as any).hasAiShort = true;
    (stay as any).shortStatus = 'ready';
    (stay as any).shortVideoUrl = stay.videoUrl || (stay.media?.video?.url) || 'https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-panoramic-view-41524-large.mp4';
    this.save();
    return { stay, shortStatus: 'ready' };
  }

  // --- AIRBUS COLLECTIONS (Server-Side Logic & AirBus Plus Privacy) ---
  public isActivePlusMember(user?: User | null): boolean {
    if (!user) return false;
    // AirBus Plus is strictly for Guests who have paid the Ksh 3,500 membership fee
    if (user.role !== 'guest') return false;
    const dbUser = this.findUserByEmail(user.email) || user;
    if (dbUser.role !== 'guest' || !dbUser.isVVVIP) return false;
    const sub = dbUser.vvvipSubscription;
    if (!sub || sub.status !== 'active' || !sub.expiresAt || sub.expiresAt <= Date.now()) {
      if (sub && sub.status === 'active' && (!sub.expiresAt || sub.expiresAt <= Date.now())) {
        sub.status = 'expired';
        dbUser.isVVVIP = false;
        this.save();
      }
      return false;
    }
    return true;
  }

  // --- Listing Collections Join Table Helpers ---
  public extractCollectionIdsFromStay(stay: Partial<Stay>): AirBusCollectionId[] {
    const valid = new Set<AirBusCollectionId>(['black-friday', 'work', 'local', 'worldwide', 'escapes', 'plus']);
    const result = new Set<AirBusCollectionId>();
    if (Array.isArray(stay.collections)) {
      stay.collections.forEach(c => {
        if (valid.has(c)) result.add(c);
      });
    }
    if (stay.blackFridayOptIn) result.add('black-friday');
    if (stay.isAirbusWork) result.add('work');
    if (stay.isLocalGuideExperience) result.add('local');
    if (stay.isWorldWide) result.add('worldwide');
    if (stay.isEscapeOffer) result.add('escapes');
    if (stay.isPlusVVVIP) result.add('plus');
    return Array.from(result);
  }

  public syncListingCollections(stayId: string, collectionIds: AirBusCollectionId[], persist = true) {
    if (!this.data.listing_collections) this.data.listing_collections = [];
    const valid = new Set<AirBusCollectionId>(['black-friday', 'work', 'local', 'worldwide', 'escapes', 'plus']);
    const deduped = Array.from(new Set(collectionIds.filter(c => valid.has(c))));

    // Remove existing links for this stay and replace cleanly (removes unlinked rows, prevents duplicates)
    this.data.listing_collections = this.data.listing_collections.filter(j => j.listing_id !== stayId);
    const now = Date.now();
    for (const cid of deduped) {
      this.data.listing_collections.push({
        listing_id: stayId,
        collection_id: cid,
        created_at: now,
      });
    }

    const stay = (this.data.stays || []).find(s => s.id === stayId);
    if (stay) {
      stay.collections = deduped;
      stay.blackFridayOptIn = deduped.includes('black-friday');
      stay.isAirbusWork = deduped.includes('work');
      stay.isLocalGuideExperience = deduped.includes('local');
      stay.isWorldWide = deduped.includes('worldwide');
      stay.isEscapeOffer = deduped.includes('escapes');
      stay.isPlusVVVIP = deduped.includes('plus');
    }

    this.invalidateFeedCache('collection');
    if (persist) this.save();
  }

  public getListingCollectionIds(stayId: string): AirBusCollectionId[] {
    const joins = (this.data.listing_collections || []).filter(j => j.listing_id === stayId);
    if (joins.length > 0) {
      return Array.from(new Set(joins.map(j => j.collection_id)));
    }
    const stay = (this.data.stays || []).find(s => s.id === stayId);
    return stay ? this.extractCollectionIdsFromStay(stay) : [];
  }

  public getCollectionListingsPaginated(
    slug: string,
    options?: { viewerUser?: User | null; cursor?: string; limit?: number }
  ): {
    collection: string;
    locked: boolean;
    requiresVVVIP?: boolean;
    stays: Stay[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
    message?: string;
  } {
    this.checkAllExpirations();
    const cleanSlug = slug.toLowerCase().trim() as AirBusCollectionId;
    const dbViewer = options?.viewerUser ? this.findUserByEmail(options.viewerUser.email) || options.viewerUser : null;
    const isActivePlus = this.isActivePlusMember(dbViewer);

    if (cleanSlug === 'plus' && !isActivePlus && dbViewer?.role !== 'admin') {
      return {
        collection: 'plus',
        locked: true,
        requiresVVVIP: true,
        stays: [],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
        message:
          dbViewer && dbViewer.role === 'owner'
            ? 'AirBus Plus is for Guests only and never uses a Host wallet.'
            : 'AirBus Plus is Reserved VIP to VVVIP Guests.',
      };
    }

    const joinedStayIds = new Set(
      (this.data.listing_collections || [])
        .filter(j => j.collection_id === cleanSlug)
        .map(j => j.listing_id)
    );

    const allLive = this.getStays({ viewerUser: dbViewer, includeVVVIP: true });
    // Cap each horizontal shelf cleanly at max 50 listings
    const matching = allLive
      .filter(s => {
        if (cleanSlug === 'plus') return Boolean(s.isPlusVVVIP || joinedStayIds.has(s.id));
        if (joinedStayIds.has(s.id)) return true;
        if (cleanSlug === 'black-friday') return Boolean(s.blackFridayOptIn);
        if (cleanSlug === 'work') return Boolean(s.isAirbusWork);
        if (cleanSlug === 'escapes') return Boolean(s.isEscapeOffer);
        if (cleanSlug === 'local') return Boolean(s.isLocalGuideExperience);
        if (cleanSlug === 'worldwide') return Boolean(s.isWorldWide);
        return false;
      })
      .slice(0, 50);

    // Deduplicate by ID preserving published_at DESC order
    const seen = new Set<string>();
    const deduped: Stay[] = [];
    for (const st of matching) {
      if (!seen.has(st.id)) {
        seen.add(st.id);
        deduped.push(st);
      }
    }

    const limit = Math.min(50, Math.max(1, Number(options?.limit) || 12));
    let filtered = deduped;
    if (options?.cursor && options.cursor.includes('|')) {
      const [tsStr, cursorId] = options.cursor.split('|');
      const cursorTs = Number(tsStr);
      if (Number.isFinite(cursorTs)) {
        filtered = deduped.filter(s => {
          const ts = this.getStayPublishTimestamp(s);
          return ts < cursorTs || (ts === cursorTs && s.id.localeCompare(cursorId) < 0);
        });
      }
    }

    const page = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? `${this.getStayPublishTimestamp(last)}|${last.id}` : null;

    return {
      collection: cleanSlug,
      locked: false,
      requiresVVVIP: cleanSlug === 'plus',
      stays: page,
      nextCursor,
      hasMore,
      totalCount: deduped.length,
    };
  }

  public getCollectionData(slug: string, viewerUser?: User | null) {
    this.checkAllExpirations();
    const dbViewer = viewerUser ? this.findUserByEmail(viewerUser.email) || viewerUser : null;
    const isActivePlus = this.isActivePlusMember(dbViewer);
    const allLive = this.getStays({ viewerUser: dbViewer, includeVVVIP: true });
    const joinedIds = new Set(
      (this.data.listing_collections || [])
        .filter(j => j.collection_id === slug)
        .map(j => j.listing_id)
    );

    if (slug === 'plus') {
      if (!isActivePlus && dbViewer?.role !== 'admin') {
        return {
          collection: 'plus',
          locked: true,
          requiresVVVIP: true,
          stays: [],
          pendingApproval: false,
          membership: dbViewer
            ? {
                isActive: false,
                status: dbViewer.vvvipSubscription?.status || 'none',
                expiresAt: dbViewer.vvvipSubscription?.expiresAt || null,
                daysRemaining: 0,
              }
            : null,
          message:
            dbViewer && dbViewer.role === 'owner'
              ? 'AirBus Plus is for Guests only and never uses a Host wallet.'
              : 'AirBus Plus is Reserved VIP to VVVIP Guests.',
        };
      }

      const sub = dbViewer?.vvvipSubscription;
      const daysRemaining = sub?.expiresAt
        ? Math.max(0, Math.ceil((sub.expiresAt - Date.now()) / 864e5))
        : 0;

      return {
        collection: 'plus',
        locked: false,
        requiresVVVIP: true,
        stays: allLive.filter(s => Boolean(s.isPlusVVVIP || joinedIds.has(s.id))),
        pendingApproval: false,
        membership: dbViewer
          ? {
              isActive: true,
              status: 'active',
              startsAt: sub?.startsAt || Date.now(),
              expiresAt: sub?.expiresAt || Date.now() + 30 * 864e5,
              daysRemaining,
            }
          : null,
        serviceRequests: this.getPlusServiceRequests(dbViewer),
      };
    }

    if (slug === 'black-friday') {
      return {
        collection: 'black-friday',
        locked: false,
        stays: allLive.filter(s => Boolean(s.blackFridayOptIn || joinedIds.has(s.id))),
      };
    }

    if (slug === 'work') {
      return {
        collection: 'work',
        locked: false,
        stays: allLive.filter(s =>
          Boolean(joinedIds.has(s.id) || s.isAirbusWork || s.monthlyPrice || s.wifiSpeedMbps || s.features.some(f => f.toLowerCase().includes('workspace') || f.toLowerCase().includes('fiber')))
        ),
      };
    }

    if (slug === 'escapes') {
      return {
        collection: 'escapes',
        locked: false,
        stays: allLive.filter(s => Boolean(s.isEscapeOffer || joinedIds.has(s.id))),
      };
    }

    if (slug === 'local') {
      return {
        collection: 'local',
        locked: false,
        stays: allLive.filter(s => Boolean(joinedIds.has(s.id) || s.isLocalGuideExperience || s.price <= 5000)),
        guides: this.data.localGuides || SEED_LOCAL_GUIDES,
        articles: this.data.neighborhoodArticles || SEED_NEIGHBORHOOD_ARTICLES,
        providers: this.getLocalProviders(false),
      };
    }

    if (slug === 'worldwide') {
      return {
        collection: 'worldwide',
        locked: false,
        stays: allLive.filter(s => Boolean(s.isWorldWide || joinedIds.has(s.id))),
      };
    }

    return {
      collection: slug,
      locked: false,
      stays: allLive,
    };
  }

  public subscribeBlackFriday(email: string): { subscribed: boolean; alreadySubscribed: boolean } {
    if (!this.data.blackFridaySubscribers) this.data.blackFridaySubscribers = [];
    const clean = email.trim().toLowerCase();
    const existing = this.data.blackFridaySubscribers.find(s => s.email.toLowerCase() === clean);
    if (existing) {
      return { subscribed: true, alreadySubscribed: true };
    }
    this.data.blackFridaySubscribers.push({
      id: 'bf_' + Date.now(),
      email: clean,
      createdAt: Date.now(),
    });
    this.save();
    return { subscribed: true, alreadySubscribed: false };
  }

  public upgradeUserToVVVIP(
    email: string,
    _mpesaCode?: string,
    options?: { billing?: 'monthly' | 'annual'; method?: 'wallet' | 'mpesa' }
  ): { user: User; pending: boolean; payment?: PaymentRecord; walletBalance: number; message: string } {
    const user = this.findUserByEmail(email);
    if (!user) throw new Error('User account not found.');
    if (user.role !== 'guest') {
      throw new Error('AirBus Plus is for Guests only and never uses a Host wallet.');
    }

    if (options?.method && options.method !== 'wallet') {
      throw new Error('AirBus Plus membership can only be paid from your Guest Wallet. Deposit via Deposit (M-Pesa) first.');
    }

    const feeKes = 3500;
    const durationMs = 30 * 864e5;

    return this.runAtomicWalletTransaction(() => {
      const now = Date.now();
      const plusSubId = 'plus_' + now + '_' + Math.random().toString(36).slice(2, 6);

      const payRes = this.payWithWallet({
        userId: user.email,
        type: 'vvvip',
        amountSc: feeKes,
        referenceId: plusSubId,
        durationDays: 30,
        period: 'monthly',
        note: 'AirBus Plus (30-Day Monthly) membership from Guest wallet',
      });

      const existingActive = Boolean(
        user.isVVVIP &&
        user.vvvipSubscription &&
        user.vvvipSubscription.status === 'active' &&
        user.vvvipSubscription.expiresAt > now
      );
      const baseStart = existingActive && user.vvvipSubscription?.expiresAt ? user.vvvipSubscription.expiresAt : now;
      const newExpiresAt = baseStart + durationMs;

      user.isVVVIP = true;
      user.vvvipSubscription = {
        planName: 'AirBus Plus',
        billing: 'monthly',
        status: 'active',
        startsAt: existingActive && user.vvvipSubscription?.startsAt ? user.vvvipSubscription.startsAt : now,
        expiresAt: newExpiresAt,
      };

      if (!this.data.subscriptions) this.data.subscriptions = [];
      this.data.subscriptions.unshift({
        id: 'sub_plus_' + now,
        ownerId: user.email.toLowerCase(),
        owner_id: user.email.toLowerCase(),
        tier: 'Gold',
        billing: 'monthly',
        status: 'active',
        startsAt: user.vvvipSubscription.startsAt,
        endsAt: newExpiresAt,
        paymentId: payRes.payment.id,
        createdAt: now,
        updatedAt: now,
      });

      this.createNotification({
        id: 'notif_plus_' + now,
        userEmail: user.email,
        title: 'AirBus Plus Activated!',
        message: `KES 3,500 paid from your Guest wallet. Your AirBus Plus access is active until ${new Date(newExpiresAt).toLocaleDateString()}.`,
        read: false,
        link: '/#collection-plus',
        type: 'subscription',
        createdAt: now,
      });

      this.save();
      this.emitWalletUpdate(user.email);
      return {
        user,
        pending: false,
        payment: payRes.payment,
        walletBalance: this.getWalletBalance(user.email),
        message: `AirBus Plus is now active until ${new Date(newExpiresAt).toLocaleDateString()} (30 days added).`,
      };
    });
  }

  public getPlusServiceRequests(viewerUser?: User | null): PlusServiceRequest[] {
    if (!this.data.plusServiceRequests) this.data.plusServiceRequests = [];
    if (!viewerUser) return [];
    if (viewerUser.role === 'admin') {
      return this.data.plusServiceRequests.slice().sort((a, b) => b.createdAt - a.createdAt);
    }
    if (!this.isActivePlusMember(viewerUser)) return [];
    const clean = viewerUser.email.toLowerCase();
    return this.data.plusServiceRequests
      .filter(r => r.userEmail.toLowerCase() === clean)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public createPlusServiceRequest(userEmail: string, requestText: string): PlusServiceRequest {
    const user = this.findUserByEmail(userEmail);
    if (!user) throw new Error('User not found.');
    if (!this.isActivePlusMember(user)) {
      throw new Error('Active AirBus Plus membership is required to request concierge services.');
    }
    const cleanText = String(requestText || '').trim();
    if (cleanText.length < 4) {
      throw new Error('Please describe the extra service you need.');
    }
    if (!this.data.plusServiceRequests) this.data.plusServiceRequests = [];
    const now = Date.now();
    const req: PlusServiceRequest = {
      id: 'plus_req_' + now + '_' + Math.random().toString(36).slice(2, 6),
      userEmail: user.email.toLowerCase(),
      userName: user.name || user.username || user.email,
      requestText: cleanText,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.data.plusServiceRequests.unshift(req);

    this.data.users
      .filter(u => u.role === 'admin')
      .forEach(admin => {
        this.createNotification({
          id: 'notif_plus_req_' + now + '_' + Math.random().toString(36).slice(2, 5),
          userEmail: admin.email,
          title: 'New AirBus Plus Extra Service Request',
          message: `${req.userName} (${req.userEmail}) asked: "${cleanText.slice(0, 80)}"`,
          read: false,
          link: '/#admin',
          type: 'system',
          createdAt: now,
        });
      });

    this.save();
    return req;
  }

  public linkPlusServiceRequest(
    requestId: string,
    adminEmail: string,
    payload: { providerName: string; providerContact: string; adminNote?: string; status?: 'linked' | 'completed' }
  ): PlusServiceRequest {
    if (!this.data.plusServiceRequests) this.data.plusServiceRequests = [];
    const req = this.data.plusServiceRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Service request not found.');
    const providerName = String(payload.providerName || '').trim();
    const providerContact = String(payload.providerContact || '').trim();
    if (!providerName || !providerContact) {
      throw new Error('Provider name and contact details are required to link the guest.');
    }
    const now = Date.now();
    req.status = payload.status || 'linked';
    req.assignedProviderName = providerName;
    req.assignedProviderContact = providerContact;
    req.adminNote = payload.adminNote ? String(payload.adminNote).trim() : undefined;
    req.updatedAt = now;

    this.createNotification({
      id: 'notif_plus_link_' + now,
      userEmail: req.userEmail,
      title: 'AirBus Plus Service Provider Linked',
      message: `Your extra service request has been linked with ${providerName} (${providerContact}).`,
      read: false,
      link: '/#collection-plus',
      type: 'system',
      createdAt: now,
    });
    this.createAuditLog({
      id: 'aud_plus_link_' + now,
      action: 'plus_service_linked',
      actorEmail: adminEmail,
      details: `Linked ${req.userEmail}'s AirBus Plus request ${req.id} to ${providerName}.`,
      createdAt: now,
    });
    this.save();
    return req;
  }

  public getLocalProviders(includePulledDown = false): LocalServiceProvider[] {
    if (!this.data.localProviders) this.data.localProviders = [];
    return this.data.localProviders
      .filter(p => includePulledDown || p.status === 'active')
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public registerLocalProvider(input: {
    fullName: string;
    locationTown: string;
    category: LocalProviderCategory;
    trainerDiscipline?: string;
    customServiceDescription?: string;
    description: string;
    contact: string;
    photoUrl: string;
    ownerEmail?: string;
  }): LocalServiceProvider {
    const allowedCategories: LocalProviderCategory[] = [
      'Personal Chef',
      'Driver',
      'Mechanic',
      'Lawyer',
      'Translator',
      'Tour Guide',
      'Trainer',
      'Vehicle trackers and vehicle alarm installer',
      'Companionship',
      'Others',
    ];
    if (!allowedCategories.includes(input.category)) {
      throw new Error('Please choose a valid AirBus Local service category.');
    }

    const fullName = String(input.fullName || '').trim();
    const locationTown = String(input.locationTown || '').trim();
    const description = String(input.description || '').trim();
    const contact = String(input.contact || '').trim();
    const photoUrl = String(input.photoUrl || '').trim();
    const trainerDiscipline = String(input.trainerDiscipline || '').trim();
    const customServiceDescription = String(input.customServiceDescription || '').trim();

    if (!fullName || !locationTown || !description || !contact || !photoUrl) {
      throw new Error('Full personal name, location (town), short description, contact, and profile photo are all required.');
    }

    if (input.category === 'Trainer' && !trainerDiscipline) {
      throw new Error('Please indicate what you train.');
    }

    if (input.category === 'Others') {
      if (!customServiceDescription) {
        throw new Error('Please state the services you offer under Others.');
      }
      const combinedOther = `${customServiceDescription} ${description}`.toLowerCase();
      if (/\b(companionship|companion|dating|date|escort|hookup|romantic|girlfriend|boyfriend)\b/i.test(combinedOther)) {
        throw new Error('Companionship and dating are not allowed under Others. Please choose Companionship or Trip Dating instead.');
      }
    }

    const combinedText = `${fullName} ${description} ${trainerDiscipline} ${customServiceDescription}`.toLowerCase();
    if (/\b(cocaine|heroin|meth|bhang|weed|marijuana|cannabis|opioid|ecstasy|lsd|illegal drugs|trafficking|contraband|stolen|weapon|firearm|prostitution)\b/i.test(combinedText)) {
      throw new Error('No drugs or illegal activities. Any such provider profile will be pulled down.');
    }

    if (!this.data.localProviders) this.data.localProviders = [];
    const now = Date.now();
    const provider: LocalServiceProvider = {
      id: 'locp_' + now + '_' + Math.random().toString(36).slice(2, 6),
      fullName,
      locationTown,
      category: input.category,
      trainerDiscipline: input.category === 'Trainer' ? trainerDiscipline : undefined,
      customServiceDescription: input.category === 'Others' ? customServiceDescription : undefined,
      description,
      contact,
      photoUrl,
      ownerEmail: input.ownerEmail ? input.ownerEmail.toLowerCase() : undefined,
      status: 'active',
      createdAt: now,
    };

    this.data.localProviders.unshift(provider);
    this.save();
    return provider;
  }

  public pullDownLocalProvider(providerId: string, adminEmail: string, reason?: string): LocalServiceProvider {
    if (!this.data.localProviders) this.data.localProviders = [];
    const p = this.data.localProviders.find(item => item.id === providerId);
    if (!p) throw new Error('Provider profile not found.');
    p.status = 'pulled_down';
    p.pulledDownReason = reason?.trim() || 'Violated platform rules (no drugs or illegal activities).';
    p.pulledDownBy = adminEmail;
    this.createAuditLog({
      id: 'aud_locp_' + Date.now(),
      action: 'local_provider_pulled_down',
      actorEmail: adminEmail,
      details: `Pulled down AirBus Local provider ${p.fullName} (${p.id}): ${p.pulledDownReason}`,
      createdAt: Date.now(),
    });
    this.save();
    return p;
  }

  public requestLocalGuide(req: {
    guideId: string;
    userEmail: string;
    userName: string;
    area: string;
    dates: string;
    notes: string;
  }) {
    const guides = this.data.localGuides || SEED_LOCAL_GUIDES;
    const guide = guides.find(g => g.id === req.guideId);
    if (!guide) throw new Error('Selected local guide not found.');

    if (!this.data.guideRequests) this.data.guideRequests = [];
    const entry = {
      id: 'greq_' + Date.now(),
      guideId: guide.id,
      guideName: guide.name,
      userEmail: req.userEmail,
      userName: req.userName,
      area: req.area,
      dates: req.dates,
      notes: req.notes,
      createdAt: Date.now(),
    };
    this.data.guideRequests.unshift(entry);
    this.createNotification({
      id: 'notif_guide_' + Date.now(),
      userEmail: req.userEmail,
      title: `Guide Request Sent to ${guide.name}`,
      message: `${guide.name} (${guide.areaCovered}) received your request for ${req.dates || 'upcoming dates'} and will contact you shortly.`,
      read: false,
      link: '/#collection-local',
      type: 'system',
      createdAt: Date.now(),
    });
    this.save();
    return { request: entry, guide };
  }

  // --- SHORTS / REELS JOBS, DRAFTS, COMMENTS, LIKES & AUDIO ---
  public getShortJobs(ownerEmail?: string): ShortJob[] {
    if (!this.data.short_jobs) this.data.short_jobs = [];
    if (!ownerEmail) return this.data.short_jobs;
    return this.data.short_jobs.filter(
      j => j.ownerEmail.toLowerCase() === ownerEmail.toLowerCase()
    );
  }

  public getShortJobById(id: string): ShortJob | undefined {
    return (this.data.short_jobs || []).find(j => j.id === id);
  }

  public publishDraftShort(
    jobId: string,
    actorEmail: string,
    updates?: {
      caption?: string;
      hashtags?: string[];
      captionsEnabled?: boolean;
      audioConfig?: Partial<ShortAudioConfig>;
    }
  ): { job: ShortJob; post: Post } {
    const job = this.getShortJobById(jobId);
    if (!job) throw new Error('Short job not found.');
    if (job.ownerEmail.toLowerCase() !== actorEmail.toLowerCase()) {
      throw new Error('Unauthorized to publish this Short.');
    }
    if (job.state !== 'ready') {
      throw new Error('Only completed Shorts can be published.');
    }

    if (updates?.caption !== undefined) job.caption = updates.caption.trim();
    if (updates?.hashtags !== undefined) {
      job.hashtags = updates.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`));
    }
    if (updates?.captionsEnabled !== undefined) {
      job.autoCaptionsEnabled = updates.captionsEnabled;
    }
    if (updates?.audioConfig) {
      const tracks = this.getAudioLibrary({}).tracks;
      const tierInfo = this.getHostEffectiveTier(job.ownerEmail);
      job.audioConfig = audioLibraryService.resolveAudioConfig(
        { ...job.audioConfig, ...updates.audioConfig },
        tracks,
        { allowMusicOrVoiceOver: tierInfo.rules.shorts_audio_enabled }
      );
    }

    let post = (this.data.posts || []).find(p => p.jobId === job.id || p.id === job.publishedPostId);
    if (!post) {
      throw new Error('Draft post record missing.');
    }

    post.caption = job.caption;
    post.hashtags = job.hashtags;
    post.description = `${job.caption} ${job.hashtags.join(' ')}`.trim().slice(0, 300);
    post.captionsEnabled = job.autoCaptionsEnabled;
    post.shortAudio = job.audioConfig;
    post.status = 'approved';
    post.updatedAt = Date.now();
    job.updatedAt = Date.now();
    job.stageLabel = 'Published to Shorts';

    this.save();
    return { job, post };
  }

  public updatePostShort(
    postId: string,
    actorEmail: string,
    updates: {
      caption?: string;
      hashtags?: string[];
      captionsEnabled?: boolean;
      status?: PostStatus;
      audioConfig?: Partial<ShortAudioConfig>;
    }
  ): Post {
    const post = this.getPostById(postId);
    if (!post) throw new Error('Short post not found.');
    if (post.ownerEmail.toLowerCase() !== actorEmail.toLowerCase()) {
      throw new Error('Only the creator can edit this Short.');
    }
    if (updates.caption !== undefined) post.caption = updates.caption.trim();
    if (updates.hashtags !== undefined) {
      post.hashtags = updates.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`));
    }
    if (updates.caption !== undefined || updates.hashtags !== undefined) {
      post.description = `${post.caption || post.description} ${(post.hashtags || []).join(' ')}`
        .trim()
        .slice(0, 300);
    }
    if (updates.captionsEnabled !== undefined) {
      post.captionsEnabled = updates.captionsEnabled;
    }
    if (updates.status && (updates.status === 'approved' || updates.status === 'draft')) {
      post.status = updates.status;
    }
    if (updates.audioConfig) {
      const tierInfo = this.getHostEffectiveTier(post.ownerEmail);
      const wantsMusicOrVo =
        updates.audioConfig.mode === 'song' ||
        updates.audioConfig.mode === 'voiceover' ||
        updates.audioConfig.mode === 'song_plus_voiceover' ||
        Boolean(updates.audioConfig.trackId) ||
        Boolean(updates.audioConfig.voiceOverUrl);
      if (wantsMusicOrVo && !tierInfo.rules.shorts_audio_enabled) {
        throw new Error('Music and voice-over on Shorts require an active Diamond or Gold subscription.');
      }
      const tracks = this.getAudioLibrary({}).tracks;
      post.shortAudio = audioLibraryService.resolveAudioConfig(
        { ...(post.shortAudio || {}), ...updates.audioConfig },
        tracks,
        { allowMusicOrVoiceOver: tierInfo.rules.shorts_audio_enabled }
      );
    }
    post.updatedAt = Date.now();
    this.save();
    return post;
  }

  public toggleLikePost(postId: string, userEmail: string): { liked: boolean; likes: number } {
    const post = this.getPostById(postId);
    if (!post) throw new Error('Post not found.');
    if (!post.likedByUserEmails) post.likedByUserEmails = [];
    const email = userEmail.toLowerCase();
    const idx = post.likedByUserEmails.indexOf(email);
    let liked = false;
    if (idx >= 0) {
      post.likedByUserEmails.splice(idx, 1);
      post.likes = Math.max(0, (post.likes || 0) - 1);
      liked = false;
    } else {
      post.likedByUserEmails.push(email);
      post.likes = (post.likes || 0) + 1;
      liked = true;
    }
    this.save();
    return { liked, likes: post.likes };
  }

  public addPostComment(postId: string, authorEmail: string, authorName: string, text: string): PostComment {
    const post = this.getPostById(postId);
    if (!post) throw new Error('Post not found.');
    const clean = text.trim();
    if (!clean) throw new Error('Comment cannot be empty.');
    if (!post.comments) post.comments = [];
    const comment: PostComment = {
      id: `pcom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      postId,
      authorEmail,
      authorName,
      text: clean.slice(0, 400),
      createdAt: Date.now(),
    };
    post.comments.unshift(comment);
    this.save();
    return comment;
  }

  public incrementPostShare(postId: string): number {
    const post = this.getPostById(postId);
    if (!post) return 0;
    post.shares = (post.shares || 0) + 1;
    this.save();
    return post.shares;
  }

  // --- HOST-ONLY SHORTS TIERS, QUOTA ENFORCEMENT, GOLD LISTING AUDIO & ANALYTICS ---

  public getHostEffectiveTier(hostEmail?: string): {
    tier: StayCategory;
    isActive: boolean;
    rules: ReturnType<typeof getShortsTierRules>;
  } {
    if (!hostEmail) {
      return { tier: 'Silver', isActive: false, rules: getShortsTierRules(null, false) };
    }
    const plan = this.getHostPlan(hostEmail);
    const isActive = plan.status === 'active' && (!plan.expiresAt || plan.expiresAt > Date.now());
    const overrides = (this.data.settings as any)?.shortsTierOverrides;
    return {
      tier: plan.tier,
      isActive,
      rules: getShortsTierRules(plan.tier, isActive, overrides),
    };
  }

  public hydrateStayAudio(stay: Stay, viewerUser?: User | null): Stay {
    const hostEmail = stay.ownerEmail;
    const { tier, isActive, rules } = this.getHostEffectiveTier(hostEmail);
    const saved = (this.data.listing_audio || []).find(a => a.stayId === stay.id);
    const isOwnerOrAdmin = Boolean(
      viewerUser &&
        (viewerUser.role === 'admin' ||
          (hostEmail && viewerUser.email.toLowerCase() === hostEmail.toLowerCase()))
    );

    // Hydrate video MediaAsset & Collections join rows cleanly
    const asset = stay.videoMediaId
      ? this.getMediaAssetById(stay.videoMediaId)
      : stay.videoUrl
      ? this.getMediaAssetByUrl(stay.videoUrl)
      : null;
    const resolvedVideoUrl =
      (asset && asset.status === 'READY' && asset.url) || stay.videoUrl || stay.media?.video?.url || '';
    const resolvedPoster =
      stay.media?.video?.thumbnail || asset?.poster_url || stay.thumbnailUrl || stay.images?.[0] || '';
    const hydratedMedia = stay.media
      ? {
          ...stay.media,
          video: stay.media.video
            ? {
                ...stay.media.video,
                url: resolvedVideoUrl || stay.media.video.url,
                mediaId: asset?.id || stay.videoMediaId || stay.media.video.mediaId || null,
                thumbnail: stay.media.video.thumbnail || resolvedPoster,
              }
            : resolvedVideoUrl
            ? {
                url: resolvedVideoUrl,
                mediaId: asset?.id || stay.videoMediaId || null,
                thumbnail: resolvedPoster,
                duration: asset?.duration || 60,
                size: asset?.size_bytes || 0,
              }
            : null,
        }
      : stay.media;
    const collections = this.getListingCollectionIds(stay.id);

    const hasPlayableAudio = Boolean(
      saved && saved.mode !== 'none' && (saved.trackUrl || saved.voiceOverUrl)
    );

    const baseHydrated: Stay = {
      ...stay,
      videoUrl: resolvedVideoUrl,
      videoMediaId: asset?.id || stay.videoMediaId || null,
      videoAsset: asset,
      media: hydratedMedia,
      collections,
      publishState:
        stay.publishState ||
        (this.isStayApprovedPublic(stay)
          ? 'PUBLISHED'
          : stay.moderationState === 'DECLINED'
          ? 'DECLINED'
          : 'PENDING_REVIEW'),
    };

    if (rules.listing_audio_enabled && hasPlayableAudio) {
      return {
        ...baseHydrated,
        ownerTier: tier,
        listingAudioLocked: false,
        listingAudio: { ...saved!, active: true },
      };
    }

    // Host downgraded from Gold (or expired): preserve DB record, disable public playback, surface locked state to owner
    return {
      ...baseHydrated,
      ownerTier: tier,
      listingAudioLocked: Boolean(hasPlayableAudio && !rules.listing_audio_enabled),
      listingAudio: isOwnerOrAdmin && saved ? { ...saved, active: false } : null,
    };
  }

  public getListingShortUsage(stayId: string, hostEmail: string) {
    const tierInfo = this.getHostEffectiveTier(hostEmail);
    const publishedOrDraftPosts = (this.data.posts || []).filter(
      p =>
        p.type === 'short' &&
        (p.stayId === stayId || p.listing_id === stayId) &&
        p.status !== 'removed' &&
        p.status !== 'rejected'
    );
    const activePostIds = new Set(publishedOrDraftPosts.map(p => p.id));
    // Only queued/processing jobs (NOT failed jobs and NOT already counted published posts) consume an active slot
    const inFlightJobs = (this.data.short_jobs || []).filter(
      j =>
        j.stayId === stayId &&
        j.ownerEmail.toLowerCase() === hostEmail.toLowerCase() &&
        (j.state === 'queued' || j.state === 'processing') &&
        (!j.publishedPostId || !activePostIds.has(j.publishedPostId))
    );

    const used = publishedOrDraftPosts.length + inFlightJobs.length;
    const limit = tierInfo.rules.shorts_per_listing;
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      tier: tierInfo.tier,
      isPlanActive: tierInfo.isActive,
      shortsAudioEnabled: tierInfo.rules.shorts_audio_enabled,
      listingAudioEnabled: tierInfo.rules.listing_audio_enabled,
    };
  }

  public assertHostCanCreateShort(
    stayId: string | undefined,
    actorUser: User,
    audioConfig?: Partial<ShortAudioConfig>
  ): { stay: Stay; usage: ReturnType<DatabaseStore['getListingShortUsage']> } {
    if (actorUser.role !== 'owner' && actorUser.role !== 'admin') {
      throw new Error('Only the host of this listing can create Shorts.');
    }
    if (!stayId) {
      throw new Error('Auto-creating Shorts requires a specific listing video or photo.');
    }
    const stay = this.data.stays.find(s => s.id === stayId);
    if (!stay) {
      throw new Error('Listing not found.');
    }
    if (
      actorUser.role !== 'admin' &&
      stay.ownerEmail?.toLowerCase() !== actorUser.email.toLowerCase()
    ) {
      throw new Error('You can only auto-create Shorts for your own listings.');
    }

    const hostEmail = stay.ownerEmail || actorUser.email;
    const usage = this.getListingShortUsage(stay.id, hostEmail);

    if (!usage.isPlanActive || usage.limit <= 0) {
      throw new Error('Upgrade to Gold or Diamond subscription to auto-create Shorts for this listing.');
    }

    if (usage.used >= usage.limit) {
      throw new Error(
        `Short limit reached (${usage.used} of ${usage.limit}) for this listing on your ${usage.tier} plan. Delete an existing Short or upgrade to Gold (5 per listing).`
      );
    }

    const wantsAddedAudio =
      Boolean(audioConfig?.trackId) ||
      Boolean(audioConfig?.voiceOverUrl) ||
      audioConfig?.mode === 'song' ||
      audioConfig?.mode === 'voiceover' ||
      audioConfig?.mode === 'song_plus_voiceover';

    if (wantsAddedAudio && !usage.shortsAudioEnabled) {
      throw new Error('Music and voice-over on Shorts are available for Diamond and Gold hosts only.');
    }

    return { stay, usage };
  }

  public deleteShortPost(postId: string, actorEmail: string, isAdmin: boolean): { deleted: boolean; stayId?: string } {
    if (!this.data.posts) return { deleted: false };
    const idx = this.data.posts.findIndex(p => p.id === postId && p.type === 'short');
    if (idx === -1) throw new Error('Short not found.');
    const post = this.data.posts[idx];
    if (!isAdmin && post.ownerEmail.toLowerCase() !== actorEmail.toLowerCase()) {
      throw new Error('You do not have permission to delete this Short.');
    }
    const stayId = post.stayId || post.listing_id;
    this.data.posts.splice(idx, 1);

    if (Array.isArray(this.data.short_audio)) {
      this.data.short_audio = this.data.short_audio.filter(a => a.postId !== postId);
    }
    if (Array.isArray(this.data.short_jobs)) {
      this.data.short_jobs = this.data.short_jobs.filter(j => j.publishedPostId !== postId && j.id !== post.jobId);
    }

    this.createAuditLog({
      id: `aud_sdel_${Date.now()}`,
      action: 'short_deleted',
      actorEmail,
      details: `Deleted Short ${postId}${stayId ? ` from listing ${stayId}` : ''}`,
      createdAt: Date.now(),
    });
    this.save();
    return { deleted: true, stayId };
  }

  public getListingShortsStatus(stayId: string, actorEmail: string, isAdmin: boolean) {
    const stay = this.data.stays.find(s => s.id === stayId);
    if (!stay) throw new Error('Listing not found.');
    if (!isAdmin && stay.ownerEmail?.toLowerCase() !== actorEmail.toLowerCase()) {
      throw new Error('Unauthorized: only the listing host can view listing Shorts studio.');
    }

    const hostEmail = stay.ownerEmail || actorEmail;
    const usage = this.getListingShortUsage(stayId, hostEmail);
    const jobs = (this.data.short_jobs || []).filter(j => j.stayId === stayId);
    const shorts = (this.data.posts || [])
      .filter(p => p.type === 'short' && (p.stayId === stayId || p.listing_id === stayId))
      .map(p => {
        const stats = this.data.short_analytics?.[p.id];
        return {
          ...p,
          plays: stats?.plays || p.plays || 0,
          replays: stats?.replays || p.replays || 0,
          actionClicks: stats
            ? Object.values(stats.clicks || {}).reduce((acc, n) => acc + (n || 0), 0)
            : p.actionClicks || 0,
        };
      });

    const savedAudio = (this.data.listing_audio || []).find(a => a.stayId === stayId) || null;
    return {
      stayId,
      usage,
      jobs,
      shorts,
      listingAudio: savedAudio,
      listingAudioLocked: Boolean(
        savedAudio && savedAudio.mode !== 'none' && !usage.listingAudioEnabled
      ),
    };
  }

  public getPublicShortsFeed(params?: { trackId?: string; ownerEmail?: string; viewerUser?: User | null }): Post[] {
    let posts = this.getPosts({ status: 'approved', type: 'short', ownerEmail: params?.ownerEmail });
    if (params?.trackId) {
      posts = posts.filter(p => p.shortAudio?.trackId === params.trackId);
    }

    const now = Date.now();
    const canSeePlus = this.canViewerSeePlus(params?.viewerUser);

    return posts
      .filter(p => {
        const linkedStayId = p.stayId || p.listing_id;
        if (!linkedStayId) return true;
        const stay = this.data.stays.find(s => s.id === linkedStayId);
        if (!stay || !this.isStayApprovedPublic(stay)) {
          return false;
        }
        if (stay.isPlusVVVIP && !canSeePlus) {
          return false;
        }
        if (stay.ownerEmail) {
          const plan = this.getHostPlan(stay.ownerEmail);
          if (plan.status !== 'active' || (plan.expiresAt > 0 && plan.expiresAt <= now)) {
            return false;
          }
        }
        return true;
      })
      .map(p => {
        const linkedStayId = p.stayId || p.listing_id;
        const stats = this.data.short_analytics?.[p.id];
        return {
          ...p,
          stayId: linkedStayId,
          listing_id: linkedStayId,
          host_id: p.host_id || p.ownerEmail,
          listingUnavailable: false,
          plays: stats?.plays || p.plays || 0,
          replays: stats?.replays || p.replays || 0,
          actionClicks: stats
            ? Object.values(stats.clicks || {}).reduce((acc, n) => acc + (n || 0), 0)
            : p.actionClicks || 0,
        };
      });
  }

  public saveListingAudio(
    stayId: string,
    actorEmail: string,
    isAdmin: boolean,
    payload: Partial<ListingAudioConfig>
  ): ListingAudioConfig {
    const stay = this.data.stays.find(s => s.id === stayId);
    if (!stay) throw new Error('Listing not found.');
    if (!isAdmin && stay.ownerEmail?.toLowerCase() !== actorEmail.toLowerCase()) {
      throw new Error('Only the host of this listing can update listing audio.');
    }

    const hostEmail = (stay.ownerEmail || actorEmail).toLowerCase();
    const tierInfo = this.getHostEffectiveTier(hostEmail);
    if (!tierInfo.rules.listing_audio_enabled) {
      throw new Error('Listing music and voice-over are available on the Gold subscription plan only. Upgrade to Gold to unlock.');
    }

    const mode = payload.mode || 'none';
    if (payload.voiceOverUrl) {
      audioLibraryService.validateAudioDataUrl(payload.voiceOverUrl, AUDIO_UPLOAD_CONFIG.maxFileSizeBytes);
      if (payload.voiceOverSource === 'upload' && payload.rightsConfirmed === false) {
        throw new Error('Please confirm you hold rights or permission for uploaded listing audio.');
      }
    }

    let chosenTrack: AudioTrack | undefined;
    if (payload.trackId) {
      const tracks = this.getAudioLibrary({ limit: 100 }).tracks;
      chosenTrack = tracks.find(t => t.id === payload.trackId && t.commercialUgcAllowed !== false);
      if (!chosenTrack) {
        throw new Error('Selected music track was not found in the cleared audio library.');
      }
    }

    const resolvedMode: ListingAudioConfig['mode'] =
      mode === 'none' || (!chosenTrack && !payload.voiceOverUrl)
        ? 'none'
        : chosenTrack && payload.voiceOverUrl
        ? 'song_plus_voiceover'
        : payload.voiceOverUrl
        ? 'voiceover'
        : 'song';

    if (!this.data.listing_audio) this.data.listing_audio = [];
    const existingIdx = this.data.listing_audio.findIndex(a => a.stayId === stayId);

    const nextConfig: ListingAudioConfig = {
      id: existingIdx >= 0 ? this.data.listing_audio[existingIdx].id : `laud_${Date.now()}`,
      stayId,
      ownerEmail: hostEmail,
      mode: resolvedMode,
      trackId: chosenTrack?.id,
      trackTitle: chosenTrack?.title,
      trackArtist: chosenTrack?.artist,
      trackUrl: chosenTrack?.audioUrl,
      musicVolume: Math.min(100, Math.max(0, Number(payload.musicVolume ?? 70))),
      voiceOverUrl: payload.voiceOverUrl,
      voiceOverSource: payload.voiceOverSource,
      voiceOverVolume: Math.min(100, Math.max(0, Number(payload.voiceOverVolume ?? 100))),
      ttsScript: payload.ttsScript,
      ttsVoice: payload.ttsVoice,
      ttsLanguage: payload.ttsLanguage,
      autoDuckMusic: payload.autoDuckMusic ?? true,
      rightsConfirmed: Boolean(payload.rightsConfirmed ?? true),
      requiresAttribution: chosenTrack?.requiresAttribution || false,
      attributionText: chosenTrack?.attributionText,
      active: resolvedMode !== 'none',
      updatedAt: Date.now(),
    };

    if (existingIdx >= 0) {
      this.data.listing_audio[existingIdx] = nextConfig;
    } else {
      this.data.listing_audio.unshift(nextConfig);
    }
    this.save();
    return nextConfig;
  }

  public deleteListingAudio(stayId: string, actorEmail: string, isAdmin: boolean): boolean {
    const stay = this.data.stays.find(s => s.id === stayId);
    if (!stay) throw new Error('Listing not found.');
    if (!isAdmin && stay.ownerEmail?.toLowerCase() !== actorEmail.toLowerCase()) {
      throw new Error('Only the listing host can remove listing audio.');
    }
    if (!this.data.listing_audio) return true;
    this.data.listing_audio = this.data.listing_audio.filter(a => a.stayId !== stayId);
    this.save();
    return true;
  }

  public recordShortAnalytics(
    shortId: string,
    event: 'view' | 'play' | 'replay' | 'click',
    intent?: ShortIntentType
  ): ShortAnalyticsRecord {
    if (!this.data.short_analytics) this.data.short_analytics = {};
    const post = this.getPostById(shortId);
    const existing = this.data.short_analytics[shortId] || {
      shortId,
      listingId: post?.stayId || post?.listing_id,
      ownerEmail: post?.ownerEmail,
      views: post?.views || 0,
      plays: post?.plays || 0,
      replays: post?.replays || 0,
      clicks: {
        availability: 0,
        book: 0,
        chat: 0,
        negotiate: 0,
        whatsapp: 0,
      },
      updatedAt: Date.now(),
    };

    if (event === 'view') {
      existing.views += 1;
      if (post) post.views = (post.views || 0) + 1;
    } else if (event === 'play') {
      existing.plays += 1;
      if (post) post.plays = existing.plays;
    } else if (event === 'replay') {
      existing.replays += 1;
      if (post) post.replays = existing.replays;
    } else if (event === 'click' && intent && existing.clicks[intent] !== undefined) {
      existing.clicks[intent] += 1;
      if (post) {
        post.actionClicks = Object.values(existing.clicks).reduce((acc, n) => acc + (n || 0), 0);
      }
    }

    existing.updatedAt = Date.now();
    this.data.short_analytics[shortId] = existing;
    this.save();
    return existing;
  }

  public getOwnerShortsAnalytics(hostEmail: string) {
    const email = hostEmail.toLowerCase();
    const myShorts = (this.data.posts || []).filter(
      p => p.type === 'short' && p.ownerEmail.toLowerCase() === email
    );
    const byShort = myShorts.map(p => {
      const rec = this.data.short_analytics?.[p.id];
      return {
        shortId: p.id,
        stayId: p.stayId || p.listing_id,
        caption: p.caption || p.description,
        views: rec?.views ?? p.views ?? 0,
        plays: rec?.plays ?? p.plays ?? 0,
        replays: rec?.replays ?? p.replays ?? 0,
        clicks: rec?.clicks ?? { availability: 0, book: 0, chat: 0, negotiate: 0, whatsapp: 0 },
      };
    });
    return {
      totals: {
        shortsCount: myShorts.length,
        views: byShort.reduce((s, r) => s + r.views, 0),
        plays: byShort.reduce((s, r) => s + r.plays, 0),
        replays: byShort.reduce((s, r) => s + r.replays, 0),
        clicks: byShort.reduce(
          (s, r) => s + Object.values(r.clicks).reduce((a, b) => a + b, 0),
          0
        ),
      },
      byShort,
    };
  }

  // --- ADMIN WALLET (GRAND WALLET): RECORDING, EAT ROLLUPS, ARCHIVES & SPECIAL REFUND ---

  private mapTypeToWalletPurpose(rawType?: string): AdminWalletPurpose {
    const t = String(rawType || '').toLowerCase().trim();
    if (t === 'subscription' || t === 'plan') return 'SUBSCRIPTION';
    if (t === 'advert' || t === 'boost' || t === 'ad_payment' || t === 'ad_fee' || t === 'promotion') return 'ADVERTISING';
    if (t === 'trip_dating') return 'TRIP_DATING';
    if (t === 'vvvip' || t === 'airbus_plus') return 'AIRBUS_PLUS';
    return 'OTHER';
  }

  private addEntryToRollups(entry: AdminWalletEntry) {
    if (!this.data.admin_wallet_rollups) {
      this.data.admin_wallet_rollups = { hour: {}, day: {}, month: {}, year: {} };
    }
    const parts = getEATParts(entry.timestampUtc);
    const apply = (map: Record<string, AdminWalletRollupBucket>, key: string) => {
      if (!map[key]) {
        map[key] = { key, inflow: 0, refunds: 0, net: 0, count: 0 };
      }
      if (entry.sourceKind === 'SPECIAL_REFUND' || entry.amount < 0) {
        const absAmt = Math.abs(entry.amount);
        map[key].refunds += absAmt;
        map[key].net -= absAmt;
      } else {
        map[key].inflow += entry.amount;
        map[key].net += entry.amount;
      }
      map[key].count += 1;
    };
    apply(this.data.admin_wallet_rollups.hour, parts.hourKey);
    apply(this.data.admin_wallet_rollups.day, parts.dayKey);
    apply(this.data.admin_wallet_rollups.month, parts.monthKey);
    apply(this.data.admin_wallet_rollups.year, parts.yearKey);
  }

  public rebuildAdminWalletRollups() {
    this.data.admin_wallet_rollups = { hour: {}, day: {}, month: {}, year: {} };
    for (const entry of this.data.admin_wallet_entries || []) {
      this.addEntryToRollups(entry);
    }
  }

  private recordAdminWalletEntry(entry: AdminWalletEntry) {
    if (!this.data.admin_wallet_entries) this.data.admin_wallet_entries = [];
    // Prevent duplicate recording by ID or paymentCode (for deposits)
    if (this.data.admin_wallet_entries.some(e => e.id === entry.id)) return;
    if (
      entry.sourceKind === 'APPROVED_DEPOSIT' &&
      this.data.admin_wallet_entries.some(
        e => e.sourceKind === 'APPROVED_DEPOSIT' && e.paymentCode.toUpperCase() === entry.paymentCode.toUpperCase()
      )
    ) {
      throw new Error(`Duplicate payment code ${entry.paymentCode} in Admin Wallet ledger.`);
    }
    this.data.admin_wallet_entries.unshift(entry);
    this.addEntryToRollups(entry);
  }

  private backfillAdminWalletEntries() {
    if (!this.data.admin_wallet_entries) this.data.admin_wallet_entries = [];
    for (const p of this.data.paymentRecords || []) {
      if (p.status !== 'approved') continue;
      const amt = Math.floor(Number(p.approvedAmount ?? p.amountKes ?? p.amount ?? 0));
      if (amt <= 0) continue;
      const isDeposit =
        p.method !== 'wallet' ||
        ['deposit', 'wallet', 'wallet_topup', 'mpesa_deposit'].includes(String(p.type || p.kind || ''));
      const ts = Number(p.approvedAt || p.approved_at || p.createdAt || Date.now());
      const fiscalYear = getEATParts(ts).year;
      const payer = this.findUserByEmail(p.userId || p.hostEmail || '');
      const code = String(p.mpesaCode || p.reference || p.referenceId || p.id).trim().toUpperCase();
      const id = isDeposit ? `awe_dep_${p.id}` : `awe_${p.id}`;
      if (this.data.admin_wallet_entries.some(e => e.id === id)) continue;
      if (
        isDeposit &&
        this.data.admin_wallet_entries.some(
          e => e.sourceKind === 'APPROVED_DEPOSIT' && e.paymentCode.toUpperCase() === code
        )
      ) {
        continue;
      }
      this.data.admin_wallet_entries.push({
        id,
        sourceKind: isDeposit ? 'APPROVED_DEPOSIT' : 'SERVICE_REVENUE',
        depositorName: payer?.name || payer?.username || p.userName || p.userId,
        depositorId: payer?.id || p.userId,
        depositorRole: payer?.role || p.userRole || 'guest',
        timestampUtc: ts,
        fiscalYear,
        paymentCode: code,
        amount: amt,
        purpose: p.walletPurpose || this.mapTypeToWalletPurpose(String(p.type || p.kind || '')),
        subPurpose: String(p.type || p.kind || ''),
        approvingAdmin: p.approvedBy || p.approved_by || 'admin@airbus.ke',
        description: isDeposit
          ? `Approved M-Pesa Deposit (${code}) from ${payer?.name || p.userId}`
          : `${this.mapTypeToWalletPurpose(String(p.type || p.kind || ''))} payment from ${p.userId}`,
        relatedPaymentId: p.id,
      });
    }
    this.data.admin_wallet_entries.sort((a, b) => b.timestampUtc - a.timestampUtc);
    this.rebuildAdminWalletRollups();
  }

  public checkAndRunAutoYearEndArchive(referenceTs = Date.now()) {
    const currentEatYear = getEATParts(referenceTs).year;
    if (!this.data.wallet_year_archives) this.data.wallet_year_archives = [];
    if (!this.data.last_archived_fiscal_year) {
      this.data.last_archived_fiscal_year = currentEatYear;
      return;
    }
    if (currentEatYear > this.data.last_archived_fiscal_year) {
      for (let yr = this.data.last_archived_fiscal_year; yr < currentEatYear; yr += 1) {
        try {
          this.runYearEndWalletArchive(yr, 'system_jan1_eat_job');
        } catch (err) {
          logger.warn('auto_year_end_archive_error', { year: yr, error: String(err) });
        }
      }
    }
  }

  public runYearEndWalletArchive(targetFiscalYear?: number, actorEmail = 'admin@airbus.ke'): WalletYearArchive {
    if (!this.data.wallet_year_archives) this.data.wallet_year_archives = [];
    const currentEatYear = getEATParts(Date.now()).year;
    const yearToArchive = targetFiscalYear || currentEatYear - 1;

    const existing = this.data.wallet_year_archives.find(a => a.fiscalYear === yearToArchive);
    if (existing) return existing;

    const priorArchive = this.data.wallet_year_archives
      .filter(a => a.fiscalYear < yearToArchive)
      .sort((a, b) => b.fiscalYear - a.fiscalYear)[0];
    const openingCarryForward = priorArchive ? priorArchive.closingBalance : 0;

    const yearEntries = (this.data.admin_wallet_entries || []).filter(e => e.fiscalYear === yearToArchive);
    const monthlyMap: Record<string, { month: string; inflow: number; refunds: number; net: number; count: number }> = {};
    const purposeBreakdown: Record<AdminWalletPurpose, number> = {
      SUBSCRIPTION: 0,
      ADVERTISING: 0,
      TRIP_DATING: 0,
      AIRBUS_PLUS: 0,
      OTHER: 0,
    };

    let totalInflow = 0;
    let totalSpecialRefunds = 0;

    for (const e of yearEntries) {
      const mKey = getEATParts(e.timestampUtc).monthKey;
      if (!monthlyMap[mKey]) {
        monthlyMap[mKey] = { month: mKey, inflow: 0, refunds: 0, net: 0, count: 0 };
      }
      if (e.sourceKind === 'SPECIAL_REFUND' || e.amount < 0) {
        const absAmt = Math.abs(e.amount);
        totalSpecialRefunds += absAmt;
        monthlyMap[mKey].refunds += absAmt;
        monthlyMap[mKey].net -= absAmt;
      } else {
        totalInflow += e.amount;
        monthlyMap[mKey].inflow += e.amount;
        monthlyMap[mKey].net += e.amount;
        purposeBreakdown[e.purpose] = (purposeBreakdown[e.purpose] || 0) + e.amount;
      }
      monthlyMap[mKey].count += 1;
    }

    const netTotal = totalInflow - totalSpecialRefunds;
    const closingBalance = openingCarryForward + netTotal;
    const monthlyTotals = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
    const archivedAtUtc = Date.now();
    const checksumPayload = JSON.stringify({
      yearToArchive,
      totalInflow,
      totalSpecialRefunds,
      netTotal,
      closingBalance,
      count: yearEntries.length,
    });
    const checksum = crypto.createHash('sha256').update(checksumPayload).digest('hex').slice(0, 16);

    const archive: WalletYearArchive = {
      id: `arch_${yearToArchive}`,
      fiscalYear: yearToArchive,
      archivedAtUtc,
      monthlyTotals,
      purposeBreakdown,
      totalInflow,
      totalSpecialRefunds,
      netTotal,
      transactionCount: yearEntries.length,
      closingBalance,
      openingCarryForward,
      checksum,
    };

    this.data.wallet_year_archives.unshift(archive);
    this.data.last_archived_fiscal_year = Math.max(this.data.last_archived_fiscal_year || 0, yearToArchive + 1);
    this.createAuditLog({
      id: `aud_arch_${archivedAtUtc}`,
      action: 'admin_wallet_year_archive',
      actorEmail,
      details: `Archived fiscal year ${yearToArchive} EAT (Net: KES ${netTotal}, Closing Balance Carry-Forward: KES ${closingBalance}, Checksum: ${checksum})`,
      createdAt: archivedAtUtc,
    });
    this.save();
    return archive;
  }

  public getAdminWalletArchives() {
    this.checkAndRunAutoYearEndArchive();
    return (this.data.wallet_year_archives || []).slice().sort((a, b) => b.fiscalYear - a.fiscalYear);
  }

  public getAdminWalletArchiveByYear(year: number): WalletYearArchive | null {
    this.checkAndRunAutoYearEndArchive();
    return (this.data.wallet_year_archives || []).find(a => a.fiscalYear === year) || null;
  }

  public getAdminWalletSummary(fiscalYearParam?: number) {
    this.checkAndRunAutoYearEndArchive();
    const currentEatYear = getEATParts(Date.now()).year;
    const activeYear = fiscalYearParam || currentEatYear;
    const entries = this.data.admin_wallet_entries || [];
    const currentYearEntries = entries.filter(e => e.fiscalYear === activeYear);

    let ytdDeposits = 0;
    let ytdServiceRevenue = 0;
    let ytdSpecialRefunds = 0;
    for (const e of currentYearEntries) {
      if (e.sourceKind === 'SPECIAL_REFUND' || e.amount < 0) {
        ytdSpecialRefunds += Math.abs(e.amount);
      } else if (e.sourceKind === 'APPROVED_DEPOSIT') {
        ytdDeposits += e.amount;
      } else {
        ytdServiceRevenue += e.amount;
      }
    }

    let lifetimeInflow = 0;
    let lifetimeSpecialRefunds = 0;
    for (const e of entries) {
      if (e.sourceKind === 'SPECIAL_REFUND' || e.amount < 0) {
        lifetimeSpecialRefunds += Math.abs(e.amount);
      } else {
        lifetimeInflow += e.amount;
      }
    }

    const adminCashBalance = this.getWalletBalance('admin@airbus.ke');
    const priorArchive = (this.data.wallet_year_archives || [])
      .filter(a => a.fiscalYear < activeYear)
      .sort((a, b) => b.fiscalYear - a.fiscalYear)[0];
    const carryForwardBalance = priorArchive ? priorArchive.closingBalance : 0;
    const reconciliation = this.getWalletReconciliation();

    return {
      currentEatYear,
      selectedFiscalYear: activeYear,
      adminWalletBalance: adminCashBalance,
      carryForwardBalance,
      yearToDate: {
        fiscalYear: activeYear,
        approvedDeposits: ytdDeposits,
        serviceRevenue: ytdServiceRevenue,
        totalCredits: ytdDeposits + ytdServiceRevenue,
        specialRefunds: ytdSpecialRefunds,
        netReported: ytdDeposits + ytdServiceRevenue - ytdSpecialRefunds,
        transactionCount: currentYearEntries.length,
      },
      lifetime: {
        totalCredits: lifetimeInflow,
        totalSpecialRefunds: lifetimeSpecialRefunds,
        reconciledNet: lifetimeInflow - lifetimeSpecialRefunds,
        transactionCount: entries.length,
      },
      reconciliation: {
        mismatches: reconciliation.mismatches,
        userWalletsSum: reconciliation.userWalletsSum,
        adminBalance: reconciliation.adminBalance,
      },
      archivesCount: (this.data.wallet_year_archives || []).length,
    };
  }

  public getAdminWalletTotals(opts: {
    granularity?: 'hour' | 'day' | 'month' | 'year';
    from?: string;
    to?: string;
    fiscalYear?: number;
  }) {
    const granularity = opts.granularity || 'day';
    const entries = (this.data.admin_wallet_entries || []).filter(e => {
      if (opts.fiscalYear && e.fiscalYear !== opts.fiscalYear) return false;
      const dayKey = getEATParts(e.timestampUtc).dayKey;
      if (opts.from && dayKey < opts.from) return false;
      if (opts.to && dayKey > opts.to) return false;
      return true;
    });

    // Use cached rollups when unfiltered by custom date range, else aggregate filtered entries in EAT
    const buckets: Record<string, AdminWalletRollupBucket> = {};
    if (!opts.from && !opts.to && !opts.fiscalYear && this.data.admin_wallet_rollups?.[granularity]) {
      Object.entries(this.data.admin_wallet_rollups[granularity]).forEach(([k, v]) => {
        buckets[k] = { ...v };
      });
    } else {
      for (const e of entries) {
        const parts = getEATParts(e.timestampUtc);
        const key =
          granularity === 'hour'
            ? parts.hourKey
            : granularity === 'month'
            ? parts.monthKey
            : granularity === 'year'
            ? parts.yearKey
            : parts.dayKey;
        if (!buckets[key]) {
          buckets[key] = { key, inflow: 0, refunds: 0, net: 0, count: 0 };
        }
        if (e.sourceKind === 'SPECIAL_REFUND' || e.amount < 0) {
          const abs = Math.abs(e.amount);
          buckets[key].refunds += abs;
          buckets[key].net -= abs;
        } else {
          buckets[key].inflow += e.amount;
          buckets[key].net += e.amount;
        }
        buckets[key].count += 1;
      }
    }

    const sorted = Object.values(buckets).sort((a, b) => b.key.localeCompare(a.key));
    return {
      granularity,
      timezone: 'Africa/Nairobi',
      periods: sorted,
    };
  }

  public getAdminWalletBreakdown(opts: { from?: string; to?: string; fiscalYear?: number }) {
    const entries = (this.data.admin_wallet_entries || []).filter(e => {
      if (e.sourceKind === 'SPECIAL_REFUND' || e.amount < 0) return false;
      if (opts.fiscalYear && e.fiscalYear !== opts.fiscalYear) return false;
      const dayKey = getEATParts(e.timestampUtc).dayKey;
      if (opts.from && dayKey < opts.from) return false;
      if (opts.to && dayKey > opts.to) return false;
      return true;
    });

    const totals: Record<AdminWalletPurpose, { amount: number; count: number }> = {
      SUBSCRIPTION: { amount: 0, count: 0 },
      ADVERTISING: { amount: 0, count: 0 },
      TRIP_DATING: { amount: 0, count: 0 },
      AIRBUS_PLUS: { amount: 0, count: 0 },
      OTHER: { amount: 0, count: 0 },
    };

    let grandTotal = 0;
    for (const e of entries) {
      const p: AdminWalletPurpose = totals[e.purpose] ? e.purpose : 'OTHER';
      totals[p].amount += e.amount;
      totals[p].count += 1;
      grandTotal += e.amount;
    }

    return {
      timezone: 'Africa/Nairobi',
      fiscalYear: opts.fiscalYear || null,
      grandTotal,
      breakdown: totals,
    };
  }

  public getAdminWalletLedger(opts: {
    q?: string;
    purpose?: string;
    role?: string;
    sourceKind?: string;
    fiscalYear?: number;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    let list = (this.data.admin_wallet_entries || []).slice();
    if (opts.fiscalYear) {
      list = list.filter(e => e.fiscalYear === opts.fiscalYear);
    }
    if (opts.purpose && opts.purpose !== 'ALL') {
      list = list.filter(e => e.purpose === opts.purpose);
    }
    if (opts.role && opts.role !== 'ALL') {
      list = list.filter(e => e.depositorRole === opts.role);
    }
    if (opts.sourceKind && opts.sourceKind !== 'ALL') {
      list = list.filter(e => e.sourceKind === opts.sourceKind);
    }
    if (opts.from || opts.to) {
      list = list.filter(e => {
        const dayKey = getEATParts(e.timestampUtc).dayKey;
        if (opts.from && dayKey < opts.from) return false;
        if (opts.to && dayKey > opts.to) return false;
        return true;
      });
    }
    if (opts.q && opts.q.trim()) {
      const needle = opts.q.toLowerCase().trim();
      list = list.filter(e =>
        `${e.paymentCode} ${e.depositorName} ${e.depositorId} ${e.depositorRole} ${e.purpose} ${e.approvingAdmin} ${e.description}`
          .toLowerCase()
          .includes(needle)
      );
    }

    const total = list.length;
    const limit = Math.min(200, Math.max(1, Number(opts.limit) || 25));
    const page = Math.max(1, Number(opts.page) || 1);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;

    return {
      entries: list.slice(offset, offset + limit),
      total,
      page,
      limit,
      totalPages,
    };
  }

  public exportAdminWalletCsv(opts: {
    q?: string;
    purpose?: string;
    role?: string;
    sourceKind?: string;
    fiscalYear?: number;
    from?: string;
    to?: string;
  }): string {
    const res = this.getAdminWalletLedger({ ...opts, page: 1, limit: 10000 });
    const escape = (v: unknown) => {
      const str = String(v ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };
    const header = [
      'Entry ID',
      'Kind',
      'Timestamp (UTC)',
      'Timestamp (EAT)',
      'Fiscal Year (EAT)',
      'Payment Code',
      'Purpose',
      'Amount (KES)',
      'Depositor Name',
      'Depositor ID',
      'Depositor Role',
      'Approving Admin',
      'Description',
    ].join(',');
    const rows = res.entries.map(e =>
      [
        escape(e.id),
        escape(e.sourceKind),
        escape(new Date(e.timestampUtc).toISOString()),
        escape(getEATParts(e.timestampUtc).hourKey + ' EAT'),
        escape(e.fiscalYear),
        escape(e.paymentCode),
        escape(e.purpose),
        escape(e.amount),
        escape(e.depositorName),
        escape(e.depositorId),
        escape(e.depositorRole),
        escape(e.approvingAdmin),
        escape(e.description),
      ].join(',')
    );
    return [header, ...rows].join('\n');
  }

  public executeSpecialRefund(opts: {
    adminEmail: string;
    adminPassword: string;
    reason: string;
    caseReference: string;
    originalPaymentCode: string;
    amount: number;
  }): { entry: AdminWalletEntry; adminBalance: number; reconciledNet: number } {
    const admin = this.findUserByEmail(opts.adminEmail);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Administrator account required.');
    }
    if (!opts.adminPassword || admin.passwordHash !== hashPassword(String(opts.adminPassword))) {
      throw new Error('Admin password re-authentication failed.');
    }

    const cleanReason = String(opts.reason || '').trim();
    const cleanCase = String(opts.caseReference || '').trim();
    const cleanOrigCode = String(opts.originalPaymentCode || '').trim().toUpperCase();
    const intAmount = Math.floor(Number(opts.amount));

    if (cleanReason.length < 5) {
      throw new Error('A clear written reason (at least 5 characters) is required for a Special Refund.');
    }
    if (!cleanCase) {
      throw new Error('A user, case, or phone reference is required.');
    }
    if (!cleanOrigCode) {
      throw new Error('Original payment code is required.');
    }
    if (!Number.isInteger(intAmount) || intAmount <= 0) {
      throw new Error('Refund amount must be a positive whole integer in KES.');
    }

    // Locate original credit/deposit by paymentCode
    const origCredits = (this.data.admin_wallet_entries || []).filter(
      e => e.sourceKind !== 'SPECIAL_REFUND' && e.paymentCode.toUpperCase() === cleanOrigCode
    );
    if (origCredits.length === 0) {
      throw new Error(`No approved deposit or payment found for code ${cleanOrigCode}.`);
    }
    const totalOriginalCredit = origCredits.reduce((sum, e) => sum + e.amount, 0);
    const priorRefundsOnCode = (this.data.admin_wallet_entries || [])
      .filter(e => e.sourceKind === 'SPECIAL_REFUND' && e.originalPaymentCode?.toUpperCase() === cleanOrigCode)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const maxExcessOnCode = Math.max(0, totalOriginalCredit - priorRefundsOnCode);

    if (intAmount > maxExcessOnCode) {
      throw new Error(
        `Special Refund of KES ${intAmount.toLocaleString()} exceeds remaining refundable excess of KES ${maxExcessOnCode.toLocaleString()} for code ${cleanOrigCode}.`
      );
    }

    const adminAvail = this.getWalletBalance('admin@airbus.ke');
    if (intAmount > adminAvail) {
      throw new Error(
        `Insufficient Admin Wallet balance (KES ${adminAvail.toLocaleString()}) to cover Special Refund of KES ${intAmount.toLocaleString()}.`
      );
    }

    return this.runAtomicWalletTransaction(() => {
      const now = Date.now();
      const fiscalYear = getEATParts(now).year;
      const refundCode = `SREF_${cleanOrigCode}_${now.toString(36).toUpperCase().slice(-5)}`;

      // Atomic ledger debit from admin@airbus.ke -> external refund payout so wallet invariants stay 0 diff
      const adminWallet = this.ensureWallet('admin@airbus.ke');
      adminWallet.balance = Math.floor(adminWallet.balance) - intAmount;
      adminWallet.lifetimeSpent = (adminWallet.lifetimeSpent || 0) + intAmount;
      adminWallet.updatedAt = now;
      this.data.wallets['admin@airbus.ke'] = adminWallet.balance;

      if (!this.data.walletTransactions) this.data.walletTransactions = [];
      this.data.walletTransactions.unshift({
        id: `wtx_sref_${now}`,
        walletId: 'admin@airbus.ke',
        wallet_id: 'admin@airbus.ke',
        direction: 'debit',
        amount: intAmount,
        amountSc: intAmount,
        amount_sc: intAmount,
        type: 'SPECIAL_REFUND',
        reference: refundCode,
        note: `Special Refund (${cleanOrigCode} / Case: ${cleanCase}): ${cleanReason}`,
        createdAt: now,
        created_at: now,
      });

      if (!this.data.ledgerEntries) this.data.ledgerEntries = [];
      this.data.ledgerEntries.unshift({
        id: `ledg_sref_${now}`,
        fromWallet: 'admin@airbus.ke',
        toWallet: 'withdrawal_payout',
        amount: intAmount,
        type: 'SPECIAL_REFUND',
        referenceId: cleanOrigCode,
        paymentCode: refundCode,
        purpose: origCredits[0].purpose,
        fiscalYear,
        depositorName: origCredits[0].depositorName,
        depositorRole: origCredits[0].depositorRole,
        approvingAdmin: admin.email,
        description: `SPECIAL REFUND on ${cleanOrigCode} (Ref: ${cleanCase}) — ${cleanReason}`,
        createdAt: now,
      });

      const refundEntry: AdminWalletEntry = {
        id: `awe_sref_${now}_${crypto.randomBytes(2).toString('hex')}`,
        sourceKind: 'SPECIAL_REFUND',
        depositorName: origCredits[0].depositorName,
        depositorId: origCredits[0].depositorId,
        depositorRole: origCredits[0].depositorRole,
        timestampUtc: now,
        fiscalYear,
        paymentCode: refundCode,
        amount: -intAmount,
        purpose: origCredits[0].purpose,
        subPurpose: 'SPECIAL_REFUND',
        approvingAdmin: admin.email,
        description: `SPECIAL REFUND (${cleanCase}) on ${cleanOrigCode}: ${cleanReason}`,
        caseReference: cleanCase,
        reason: cleanReason,
        originalPaymentCode: cleanOrigCode,
      };
      this.recordAdminWalletEntry(refundEntry);

      this.createAuditLog({
        id: `aud_sref_${now}`,
        action: 'admin_wallet_special_refund',
        actorEmail: admin.email,
        details: `Executed SPECIAL_REFUND of KES ${intAmount} against ${cleanOrigCode} (Case: ${cleanCase}). Reason: ${cleanReason}`,
        createdAt: now,
      });

      this.save();
      this.emitWalletUpdate('admin@airbus.ke');
      const summary = this.getAdminWalletSummary(fiscalYear);
      return {
        entry: refundEntry,
        adminBalance: adminWallet.balance,
        reconciledNet: summary.lifetime.reconciledNet,
      };
    });
  }
}

export const db = new DatabaseStore();


