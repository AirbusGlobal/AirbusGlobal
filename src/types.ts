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
  idVerified: boolean;
  createdAt: number;
}

export type StayCategory = 'Silver' | 'Diamond' | 'Gold';
export type ListingStatus = 'live' | 'review' | 'paused' | 'expired';

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
  gradientHue: [number, number];
  createdAt: number;
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
}

export interface Review {
  id: string;
  stayId: string;
  guestEmail: string;
  guestName: string;
  userName?: string;
  rating: number;
  comment: string;
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
}

export interface PaymentRecord {
  id: string;
  hostEmail: string;
  kind: 'plan' | 'wallet';
  tier?: StayCategory;
  amount: number;
  mpesaCode: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: number;
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
  reason: string;
  details: string;
  createdAt: number;
}

export type Currency = 'KES' | 'USD' | 'EUR';

export const CURRENCY_RATES: Record<Currency, number> = {
  KES: 1,
  USD: 0.0077,
  EUR: 0.0071,
};

// --- Posts & Media ---
export type PostType = 'photo' | 'short' | 'video';
export type PostStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'removed';

export interface Post {
  id: string;
  ownerEmail: string;
  stayId?: string;
  type: PostType;
  description: string; // Max 300 characters
  coverUrl: string;
  images?: string[]; // 1 to 10 images
  videoUrl?: string;
  videoAssetId?: string;
  durationSeconds?: number; // Short <= 60s, Video <= 1800s (30m)
  status: PostStatus;
  rejectionReason?: string;
  views: number;
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

