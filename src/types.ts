export type UserRole = 'guest' | 'owner' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash?: string;
  phone?: string;
  location?: string;
  bio?: string;
  languages?: string;
  photos?: string[];
  videos?: string[];
  idVerified: boolean;
  isVVVIP?: boolean;
  isSuspended?: boolean;
  suspendedReason?: string;
  createdAt: number;
}

export type StayCategory = 'Silver' | 'Diamond' | 'Gold';
export type ListingStatus = 'live' | 'review' | 'paused' | 'expired' | 'delisted';

export interface BlockedDateRange {
  from: string;
  to: string;
  reason?: string;
}

export interface VideoCommentReply {
  id: string;
  commentId: string;
  userEmail: string;
  userName: string;
  userRole: UserRole;
  isHost?: boolean;
  text: string;
  createdAt: number;
}

export interface VideoComment {
  id: string;
  stayId: string;
  userEmail: string;
  userName: string;
  userRole: UserRole;
  isHost?: boolean;
  text: string;
  likes: number;
  likedByUserEmails?: string[];
  replies?: VideoCommentReply[];
  createdAt: number;
}

export interface ListingPhoto {
  url: string;
  order: number;
  isCover: boolean;
  thumbnail?: string;
  size?: number;
  caption?: string;
}

export interface ListingVideo {
  url: string;
  thumbnail?: string;
  duration?: number;
  size?: number;
}

export interface ListingMedia {
  video: ListingVideo | null;
  photos: ListingPhoto[];
}

export interface Stay {
  id: string;
  title: string;
  location: string;
  lat: number;
  lng: number;
  price: number;
  currency: string;
  rating: number;
  reviewsCount: number;
  type: string;
  guests: number;
  beds: number;
  area: number;
  category: StayCategory;
  status: ListingStatus;
  features: string[];
  highlights?: string[];
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
  images?: string[];
  media?: ListingMedia;
  hasVideo?: boolean;
  hasPhotos?: boolean;
  moderationStatus?: 'approved' | 'pending' | 'rejected' | 'suspended';
  moderationReason?: string;
  mediaModerationStatus?: 'approved' | 'flagged' | 'clean';
  source: string;
  instantBook: boolean;
  isFeatured: boolean;
  isApprovedByAdmin: boolean;
  ownerEmail?: string;
  owner?: string;
  hostName?: string;
  hostPhone?: string;
  whatsapp?: string;
  affiliateLink?: string;
  minNights: number;
  nights?: number;
  views: number;
  likesCount?: number;
  likedByUserEmails?: string[];
  commentsCount?: number;
  comments?: VideoComment[];
  youtubeUrl?: string;
  youtubeVideoId?: string;
  hostFollowerCount?: number;
  hostFollowedByUserEmails?: string[];
  blockedDates?: BlockedDateRange[];
  welcomeGifts?: string[];
  hostMessage?: string;
  isPromoted?: boolean;
  promotedUntil?: number;
  promotionImpressions?: number;
  promotionClicks?: number;
  gradientHue: [number, number];
  createdAt: number;

  // Instalments (Mdogo Mdogo) & Deposit Models
  instalmentsAccepted?: boolean;
  depositRequired?: boolean;
  depositAmount?: number;
  depositReason?: string;
  depositRefundTerms?: string;
  isDelisted?: boolean;
  delistedAt?: number;
  ownerSubscriptionExpired?: boolean;

  // AirBus Verified Flag
  isVerified?: boolean;

  // AirBus Collections Fields
  // 1. Black Friday (Quarterly up to 50% off)
  blackFridayOptIn?: boolean;
  blackFridayDiscountPercent?: number;

  // 2. AirBus Work (Monthly stays, corporate housing)
  isAirbusWork?: boolean;
  monthlyPrice?: number;
  wifiSpeedMbps?: number;
  hasDedicatedWorkspace?: boolean;
  corporateInvoicingAvailable?: boolean;

  // 3. AirBus Escapes (Weekend & vacation rental special offers)
  isEscapeOffer?: boolean;
  escapeOfferTitle?: string;
  escapeOriginalPrice?: number;
  escapeOfferPrice?: number;
  escapeDiscountPercent?: number;
  escapeValidFrom?: string;
  escapeValidTo?: string;

  // 4. AirBus Plus (VVVIP-only verified homes with hotel-style services)
  isPlusVVVIP?: boolean;
  plusServices?: string[]; // Concierge, daily cleaning, private chef, airport transfer, etc.

  // 5. AirBus Local (Local market stays & guide experiences)
  isLocalGuideExperience?: boolean;
  localMarketNear?: string;

  // 6. AirBus World Wide (International vacation homes)
  isWorldWide?: boolean;
  country?: string;
  countryCode?: string;
  region?: string;
  localCurrency?: string;
  localCurrencyPrice?: number;

  // Gold-Only Listing Audio (optional music +/or voice-over on listing page)
  listingAudio?: ListingAudioConfig | null;
  listingAudioLocked?: boolean;
  ownerTier?: StayCategory;
}

export interface LocalGuideProfile {
  id: string;
  name: string;
  avatar: string;
  areaCovered: string;
  languages: string[];
  rating: number;
  reviewsCount: number;
  hourlyRateKes: number;
  specialty: string;
  bio: string;
  phone: string;
  whatsapp?: string;
}

export interface NeighborhoodArticle {
  id: string;
  title: string;
  area: string;
  readTime: string;
  heroImage: string;
  excerpt: string;
  content: string;
  hostRecommendations: {
    spot: string;
    category: string;
    tip: string;
  }[];
}

export interface BlackFridaySubscriber {
  id: string;
  email: string;
  createdAt: number;
}

export interface BookingInstalment {
  number: number;
  amount: number;
  dueDate: string;
  label: string;
  isPaid?: boolean;
}

export interface Booking {
  id: string;
  reference: string;
  stayId: string;
  guestEmail: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
  subtotal: number;
  cleaningFee: number;
  serviceFee: number;
  currency: string;
  status: 'requested' | 'confirmed' | 'cancelled' | 'declined';
  note?: string;
  createdAt: number;

  // Instalment & Deposit fields
  paymentType?: 'full' | 'instalments';
  instalmentCount?: 2 | 3;
  instalmentSurcharge?: number;
  instalments?: BookingInstalment[];
  depositAcknowledged?: boolean;
  depositAmount?: number;
  selectedGifts?: string[];
}

export interface Review {
  id: string;
  stayId: string;
  guestEmail: string;
  guestName: string;
  userName?: string;
  rating: number;
  comment: string;
  status?: 'approved' | 'hidden' | 'flagged';
  moderatedBy?: string;
  moderatedAt?: number;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  from: 'guest' | 'host' | 'system';
  type: 'text' | 'offer' | 'counter' | 'accept' | 'decline';
  text?: string;
  amount?: number;
  status?: 'pending' | 'countered' | 'accepted' | 'declined';
  createdAt: number;
}

export interface ChatThread {
  id: string;
  stayId: string;
  guestEmail: string;
  hostEmail: string;
  messages: ChatMessage[];
  unreadGuest: boolean;
  unreadHost: boolean;
  updatedAt: number;
}

export interface HostPlanStatus {
  tier: StayCategory;
  status: 'active' | 'expired' | 'pending';
  expiresAt: number;
  graceExpiresAt?: number;
  hasPaidSubscription?: boolean;
  period?: 'monthly' | 'annual';
  isDormant?: boolean;
  delisted?: boolean;
  scheduledTier?: StayCategory;
  scheduledStartsAt?: number;
  scheduledPeriod?: 'monthly' | 'annual';
}

export type PaymentRecordType = 'boost' | 'advert' | 'subscription' | 'booking_fee' | 'wallet_topup' | 'wallet' | 'deposit' | 'mpesa_deposit' | 'trip_dating';
export type PaymentRecordMethod = 'wallet' | 'mpesa' | 'mpesa_manual' | 'other';
export type PaymentRecordStatus = 'pending' | 'approved' | 'rejected' | 'refunded';

export interface BoostRecord {
  id: string;
  listing_id: string;
  listingId?: string;
  owner_id: string;
  ownerId?: string;
  days: number;
  cost_sc: number;
  costSc?: number;
  status: 'pending' | 'pending_approval' | 'active' | 'expired' | 'rejected';
  starts_at?: number;
  startsAt?: number;
  ends_at?: number;
  endsAt?: number;
  payment_id: string;
  paymentId?: string;
  impressions?: number;
  clicks?: number;
  created_at: number;
  createdAt?: number;
}

export interface SponsorSlot {
  id: string;
  listing_id: string;
  listingId?: string;
  advertiser_id: string;
  advertiserId?: string;
  title: string;
  description: string;
  link_url: string;
  linkUrl?: string;
  thumbnail_url: string;
  thumbnailUrl?: string;
  duration_days: number;
  durationDays?: number;
  cost_sc: number;
  costSc?: number;
  status: 'pending' | 'pending_payment' | 'pending_approval' | 'active' | 'expired' | 'rejected';
  slot_number: number;
  slotNumber?: number;
  starts_at?: number;
  startsAt?: number;
  ends_at?: number;
  endsAt?: number;
  payment_id: string;
  paymentId?: string;
  impressions: number;
  clicks: number;
  created_at: number;
  createdAt?: number;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  user_id?: string;
  hostEmail?: string;
  kind?: 'plan' | 'wallet' | 'advert' | 'boost' | 'deposit' | 'trip_dating';
  type: PaymentRecordType;
  method: PaymentRecordMethod;
  amountSc: number;
  amount_sc?: number;
  amountKes?: number;
  amount_kes?: number;
  amount: number; // Compatibility
  claimedAmount?: number;
  approvedAmount?: number;
  purpose?: 'subscription' | 'wallet_topup' | 'advert' | 'trip_dating';
  currency?: string;
  status: PaymentRecordStatus;
  referenceId: string; // advert_id, boost_id or subscription_id
  reference_id?: string;
  reference?: string; // Unified M-Pesa code or transaction reference
  proofUrl?: string; // Optional payment screenshot
  phoneNumber?: string; // M-Pesa phone number
  phone_number?: string;
  relatedId?: string; // subscription ID, advert ID, or listing ID
  related_id?: string;
  mpesaCode?: string;
  mpesa_code?: string;
  planTier?: StayCategory | string;
  plan_tier?: string;
  tier?: StayCategory | string;
  durationDays?: number;
  duration_days?: number;
  period?: 'monthly' | 'annual';
  approvedBy?: string;
  approved_by?: string;
  reviewedBy?: string;
  approvedAt?: number;
  approved_at?: number;
  reviewedAt?: number;
  rejectionReason?: string;
  rejection_reason?: string;
  createdAt: number;
  created_at?: number;
  updatedAt: number;
  updated_at?: number;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  wallet_id?: string;
  user_id?: string;
  direction: 'debit' | 'credit';
  amount?: number; // in KES
  amountSc?: number;
  amount_sc?: number;
  type?: string;
  reference?: string;
  status?: string;
  relatedPaymentId?: string;
  related_payment_id?: string;
  note: string;
  createdAt: number;
  created_at?: number;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: number;
  licence: string;
  audioUrl: string;
}

export interface AdSlot {
  id: string;
  ownerId: string;
  owner_id?: string;
  title: string;
  description: string;
  linkUrl: string;
  link_url?: string;
  thumbnailUrl: string;
  thumbnail_url?: string;
  videoUrl?: string;
  video_url?: string;
  durationDays: number;
  duration_days?: number;
  costSc: number;
  cost_sc?: number;
  costCoins?: number;
  cost_coins?: number;
  status: 'pending' | 'pending_approval' | 'active' | 'rejected' | 'expired';
  paymentId: string;
  payment_id?: string;
  paymentMethod: 'wallet' | 'mpesa';
  mpesaCode?: string;
  impressions: number;
  clicks: number;
  startsAt?: number;
  endsAt?: number;
  rejectionReason?: string;
  createdAt: number;
  created_at?: number;
  updatedAt: number;
  updated_at?: number;
}

export interface SubscriptionRecord {
  id: string;
  ownerId: string;
  owner_id?: string;
  tier: StayCategory;
  billing: 'monthly' | 'annual';
  status: 'pending' | 'active' | 'expired' | 'rejected';
  startsAt?: number;
  endsAt?: number;
  paymentId?: string;
  createdAt: number;
  created_at?: number;
  updatedAt: number;
  updated_at?: number;
}

export interface FollowRecord {
  id: string;
  followerId: string;
  ownerId: string;
  createdAt: number;
}

export interface ListingLikeRecord {
  id: string;
  userId: string;
  listingId: string;
  createdAt: number;
}

export interface ListingViewRecord {
  id: string;
  listingId: string;
  viewerId?: string;
  sessionId: string;
  createdAt: number;
}

export interface AutoShortRecord {
  id: string;
  listingId: string;
  ownerId: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  sourceStartSec: number;
  sourceEndSec: number;
  status: 'ready' | 'processing';
  aspectRatio: '9:16';
  views: number;
  likes: number;
  createdAt: number;
}

export interface DormantOwner {
  name: string;
  email: string;
  tier: StayCategory;
  lastExpiryDate: number;
  daysInactive: number;
  listingCount: number;
  isDelisted: boolean;
}

export interface NotificationItem {
  id: string;
  userEmail: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  type?: 'booking' | 'payment' | 'subscription' | 'offer' | 'ai' | 'system';
  createdAt: number;
}

export interface AuditLog {
  id: string;
  action: string;
  actorEmail: string;
  details: string;
  createdAt: number;
}

export interface SupportTicket {
  id: string;
  email: string;
  subject?: string;
  message: string;
  createdAt: number;
}

export interface ListingReport {
  id: string;
  stayId: string;
  reportedBy: string;
  reporterEmail?: string;
  reason: string;
  details: string;
  status?: 'pending' | 'resolved' | 'dismissed';
  actionTaken?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
}

export type Currency = 'KES' | 'USD' | 'EUR';

export const CURRENCY_RATES: Record<Currency, number> = {
  KES: 1,
  USD: 0.0077,
  EUR: 0.0071,
};

// --- Posts & Media + Shorts Auto-Creation & Audio ---
export type PostType = 'photo' | 'short' | 'video';
export type PostStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'removed';

export type AudioLicenseType =
  | 'CC0'
  | 'Royalty-Free'
  | 'CC-BY-4.0'
  | 'Pixabay-License'
  | 'YouTube-Audio-Library'
  | 'Jamendo-Royalty-Free'
  | 'Original-User-Audio';

export interface AudioLicense {
  id: string;
  licenseType: AudioLicenseType;
  source: 'Pixabay Music' | 'YouTube Audio Library' | 'Free Music Archive' | 'Jamendo' | 'AirBus Free Studio' | 'User Upload';
  requiresAttribution: boolean;
  attributionText: string;
  commercialUgcAllowed: boolean;
  licenseUrl?: string;
  createdAt: number;
}

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  mood?: string;
  duration: number;
  licence: string;
  licenseId?: string;
  licenseType: AudioLicenseType;
  source: AudioLicense['source'];
  requiresAttribution: boolean;
  attributionText: string;
  commercialUgcAllowed: boolean;
  trending?: boolean;
  previewStartSec?: number;
  previewDurationSec?: number;
  audioUrl: string;
  coverUrl?: string;
  useCount?: number;
  reportedCount?: number;
  createdAt?: number;
}

export type ShortAudioMode = 'none' | 'song' | 'voiceover' | 'original' | 'song_plus_voiceover';

export type ShortIntentType = 'availability' | 'book' | 'chat' | 'negotiate' | 'whatsapp';

export interface ListingAudioConfig {
  id: string;
  stayId: string;
  ownerEmail: string;
  mode: 'none' | 'song' | 'voiceover' | 'song_plus_voiceover';
  trackId?: string;
  trackTitle?: string;
  trackArtist?: string;
  trackUrl?: string;
  musicVolume: number; // 0..100
  voiceOverUrl?: string;
  voiceOverSource?: 'mic' | 'upload' | 'tts';
  voiceOverVolume: number; // 0..100
  ttsScript?: string;
  ttsVoice?: string;
  ttsLanguage?: string;
  autoDuckMusic?: boolean;
  rightsConfirmed?: boolean;
  requiresAttribution?: boolean;
  attributionText?: string;
  active?: boolean;
  updatedAt: number;
}

export interface ShortAnalyticsRecord {
  shortId: string;
  listingId?: string;
  ownerEmail?: string;
  views: number;
  plays: number;
  replays: number;
  clicks: Record<ShortIntentType, number>;
  updatedAt: number;
}

export interface ShortAudioConfig {
  id?: string;
  postId?: string;
  mode: ShortAudioMode;
  trackId?: string;
  trackTitle?: string;
  trackArtist?: string;
  trackUrl?: string;
  audioStartSec?: number; // Trim/choose-start-point inside song
  originalVolume: number; // 0..100
  musicVolume: number; // 0..100
  voiceOverVolume: number; // 0..100
  autoDuckMusic: boolean; // Lower music while voice-over plays
  voiceOverUrl?: string;
  voiceOverSource?: 'mic' | 'upload' | 'tts';
  ttsScript?: string;
  ttsVoice?: string;
  ttsLanguage?: string;
  licenseId?: string;
  requiresAttribution?: boolean;
  attributionText?: string;
  isDefaultAssigned?: boolean;
  rightsConfirmed?: boolean;
}

export interface CaptionSegment {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorEmail: string;
  authorName: string;
  text: string;
  createdAt: number;
}

export type ShortJobState = 'queued' | 'processing' | 'ready' | 'failed';

export interface ShortJob {
  id: string;
  idempotencyKey: string;
  ownerEmail: string;
  ownerName: string;
  stayId?: string;
  sourceType: 'video' | 'photo';
  sourceFiles: string[];
  autoCreateEnabled: boolean;
  autoPublish: boolean; // Default true; false when "Review before posting" is on
  reviewBeforePosting: boolean;
  autoCaptionsEnabled: boolean;
  aspectCropMode: 'smart_center' | 'blur_fill';
  trimStartSec: number;
  trimEndSec: number;
  caption: string;
  hashtags: string[];
  captions: CaptionSegment[];
  audioConfig: ShortAudioConfig;
  state: ShortJobState;
  progress: number; // 0..100
  stageLabel: string;
  outputVideoUrl?: string;
  outputThumbnailUrl?: string;
  outputDurationSec?: number;
  publishedPostId?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Post {
  id: string;
  ownerEmail: string;
  host_id?: string;
  creatorName?: string;
  stayId?: string;
  listing_id?: string;
  listingUnavailable?: boolean;
  type: PostType;
  description: string; // Max 300 characters / caption
  caption?: string;
  hashtags?: string[];
  coverUrl: string;
  images?: string[]; // 1 to 10 images
  videoUrl?: string;
  videoAssetId?: string;
  durationSeconds?: number; // Short <= 60s, Video <= 1800s (30m)
  sourceType?: 'video' | 'photo';
  autoGenerated?: boolean;
  jobId?: string;
  captionsEnabled?: boolean;
  captions?: CaptionSegment[];
  shortAudio?: ShortAudioConfig;
  comments?: PostComment[];
  likedByUserEmails?: string[];
  moderationStatus?: 'approved' | 'flagged' | 'pending';
  status: PostStatus;
  rejectionReason?: string;
  views: number;
  plays?: number;
  replays?: number;
  actionClicks?: number;
  likes: number;
  shares: number;
  viralityScore?: number;
  createdAt: number;
  updatedAt: number;
}

// --- Wallets & Ledger ---
export type LedgerEntryType =
  | 'topup'
  | 'withdrawal'
  | 'subscription'
  | 'ad_payment'
  | 'ad_revenue'
  | 'ad_fee'
  | 'referral_commission'
  | 'promotion'
  | 'promote_listing'
  | 'hold'
  | 'release';

export interface LedgerEntry {
  id: string;
  fromWallet: string; // email or 'treasury' | 'external_mpesa'
  toWallet: string; // email or 'treasury' | 'withdrawal_payout'
  amount: number; // Integer KES
  type: LedgerEntryType;
  referenceId?: string;
  description: string;
  idempotencyKey?: string;
  createdAt: number;
}

export interface ListingPromotion {
  id: string;
  stayId: string;
  ownerEmail: string;
  days: number;
  cost: number;
  startsAt: number;
  expiresAt: number;
  status: 'active' | 'expired';
  impressions: number;
  clicks: number;
  createdAt: number;
}

export interface WalletRecord {
  email: string;
  balance: number; // Available KES
  holdBalance: number; // Pending hold KES
  lifetimeEarnings: number;
  lifetimeSpent: number;
  updatedAt: number;
}

// --- Adverts (10 Slots per Video/Short) ---
export type AdRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface AdRequest {
  id: string;
  advertiserEmail: string;
  stayId: string;
  title: string;
  description: string;
  imageUrl: string;
  targetUrl: string;
  contactPhone?: string;
  tag?: string;
  days: number;
  totalAmount: number; // e.g. 300 KES
  platformFee: number; // 30% e.g. 90 KES
  hostNet: number; // 70% e.g. 210 KES
  status: AdRequestStatus;
  views?: number;
  clicks?: number;
  startsAt?: number;
  expiresAt?: number;
  rejectionReason?: string;
  createdAt: number;
}

// --- Affiliate & Referral Program ---
export interface ReferralProfile {
  userEmail: string;
  referralCode: string;
  referredByCode?: string;
  clicks: number;
  signupsCount: number;
  totalEarnedKes: number;
  createdAt: number;
}

export interface ReferralCommissionRecord {
  id: string;
  referrerEmail: string;
  referredEmail: string;
  sourceType: 'subscription' | 'ad_fee';
  grossAmount: number;
  commissionAmount: number; // 10%
  createdAt: number;
}

// --- Dynamic Settings ---
export interface PlatformSettings {
  adPricePerDay: number; // Default: 100 KES
  adPlatformFeePercent: number; // Default: 30%
  maxAdSlotsPerPost: number; // Default: 10
  referralCommissionPercent: number; // Default: 10%
  referralDurationDays: number; // Default: 365
  minWithdrawalKes: number; // Default: 500
  mpesaPaybill?: string; // Default: '222111'
  mpesaTill?: string; // Default: '987654'
  mpesaAccountPrefix?: string; // Default: 'AIRBUS'
  scToKesRate?: number; // 1 SC = 10 KES
  dailyRateSc?: number; // 10 SC / day
  planPrices: {
    Silver: number; // 1000 KES
    Diamond: number; // 2500 KES
    Gold: number; // 5000 KES
  };
  currencyRates: Record<Currency, number>;
  contentPolicies: {
    maxDescriptionChars: number; // 300
    maxPostImages: number; // 10
    maxShortSeconds: number; // 60
    maxVideoSeconds: number; // 1800
  };
}

// --- Virality & Price Trend Analytics ---
export interface ViralityStatPoint {
  date: string;
  views: number;
  likes: number;
  shares: number;
  followersGained: number;
}

export interface ViralityReport {
  postId?: string;
  stayId?: string;
  score: number; // 0 - 100
  viralityScore?: number; // alias for score
  rank: string; // e.g. "#2 in Westlands", "Top 5% AirBus"
  points7d: ViralityStatPoint[];
  points30d: ViralityStatPoint[];
  points90d: ViralityStatPoint[];
  summary: {
    totalViews: number;
    totalLikes: number;
    totalShares: number;
    reachGrowthRate: number;
  };
  creatorNudges: string[];
}

export interface PriceTrendPoint {
  date: string;
  price: number;
  isWeekend: boolean;
}

export interface StayPriceTrend {
  stayId: string;
  currency: string;
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  percentChange: number;
  points: PriceTrendPoint[];
}

// --- Weather Intelligence ---
export interface WeatherForecastDay {
  date: string;
  day: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  condition: string;
}

export interface StayWeatherInfo {
  temperature: number;
  apparentTemp: number;
  condition: string;
  weatherCode: number;
  humidity: number;
  windSpeed: number;
  isDay: boolean;
  forecast: WeatherForecastDay[];
}

// --- TRIP DATING: A Dating Services Near You ---
export type TripDatingGender = 'male' | 'female' | 'other';
export type TripDatingIntention = 'serious_relationship' | 'dating_companionship' | 'travel_partner' | 'friendship';
export type TripDatingProfileStatus = 'active' | 'suspended' | 'removed';

export interface TripDatingProfile {
  id: string;
  userId?: string;
  fullName: string;
  phoneNumber?: string; // Hidden in public queries
  gender: TripDatingGender;
  age: number;
  dob?: string;
  country: string;
  city: string;
  location: string;
  description: string;
  lookingFor: string;
  datingIntention: TripDatingIntention;
  photos: string[]; // Up to 3-4 photos
  primaryPhoto: string;
  videos?: string[]; // Optional up to 2 videos (60s max each)
  videoDurations?: number[]; // Duration in seconds (e.g. [60, 60])
  videoThumbnails?: string[];
  videoUrl?: string; // 9:16 vertical video walkthrough / intro (max 60 seconds)
  videoThumbnail?: string;
  videoDuration?: number;
  videoFilter?: string; // Aesthetic filter name e.g. 'Warm Sunset', 'Neon Night', 'Vintage Grain'
  videoTrimStart?: number; // Trim segment start time in seconds
  videoTrimEnd?: number; // Trim segment end time in seconds
  full_body_photo?: string; // Optional/verified full-body photo
  full_body_verified: boolean;
  fullBodyModerationStatus?: 'pending_review' | 'approved' | 'rejected';
  likes: number;
  likedByUserEmails?: string[];
  views: number;
  status: TripDatingProfileStatus;
  removalReason?: string;
  isUnlocked?: boolean;
  unlockExpiresAt?: number;
  isLikedByViewer?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TripDatingPaymentRequest {
  id: string;
  profileId: string;
  profileName: string;
  userEmail: string;
  clientSessionId: string;
  payerPhone: string;
  transactionCode: string;
  amount: number; // KES 50
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
}

export interface TripDatingContactUnlock {
  id: string;
  profileId: string;
  profileName: string;
  unlockedPhone: string;
  userEmail: string;
  clientSessionId: string;
  unlockedAt: number;
  expiresAt: number; // exactly 10 minutes from approval
}

export interface TripDatingStats {
  totalMembers: number;
  activeProfiles: number;
  suspendedProfiles: number;
  removedProfiles: number;
  totalViews: number;
  totalLikes: number;
  totalContactRequests: number;
  pendingApprovals: number;
  approvedPayments: number;
  rejectedPayments: number;
  successfulUnlocks: number;
  totalRevenueKes: number; // KES 50 * approved
}

export interface SnappAddCampaign {
  id: string;
  userEmail: string;
  title: string;
  description: string;
  websiteUrl: string;
  thumbnailUrl: string;
  videoUrl?: string;
  targetCategory: string; // e.g. "News & Politics: Local Campaign 3"
  durationDays: number;
  coinsPaid: number; // In SnappCoins (1 SC = 1 KES)
  status: 'active' | 'completed';
  createdAt: number;
  expiresAt: number;
}



