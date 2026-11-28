export * from '../types';

export interface DatabaseSchema {
  users: import('../types').User[];
  guestCredentials?: import('../types').CredentialRecord[];
  hostCredentials?: import('../types').CredentialRecord[];
  authSessions?: Record<string, import('../types').AuthSession>;
  failedLoginAttempts?: Record<string, { count: number; updatedAt: number }>;
  stays: import('../types').Stay[];
  bookings: import('../types').Booking[];
  reviews: import('../types').Review[];
  threads: import('../types').ChatThread[];
  payments: import('../types').PaymentRecord[];
  paymentRecords: import('../types').PaymentRecord[];
  walletTransactions: import('../types').WalletTransaction[];
  boosts: import('../types').BoostRecord[];
  sponsorSlots: import('../types').SponsorSlot[];
  adSlots: import('../types').AdSlot[];
  subscriptions: import('../types').SubscriptionRecord[];
  follows: import('../types').FollowRecord[];
  listingLikes: import('../types').ListingLikeRecord[];
  listingViews: import('../types').ListingViewRecord[];
  autoShorts: import('../types').AutoShortRecord[];
  hostPlans: Record<string, import('../types').HostPlanStatus>;
  wallets: Record<string, number>;
  walletRecords: Record<string, import('../types').WalletRecord>;
  ledgerEntries: import('../types').LedgerEntry[];
  posts: import('../types').Post[];
  adRequests: import('../types').AdRequest[];
  referrals: Record<string, import('../types').ReferralProfile>;
  referralCodes: Record<string, string>; // referralCode -> userEmail
  referralCommissions: import('../types').ReferralCommissionRecord[];
  settings: import('../types').PlatformSettings;
  promotions: import('../types').ListingPromotion[];
  viewEvents: Array<{ postId: string; viewer: string; timestamp: number }>;
  withdrawals: Array<{
    id: string;
    userEmail: string;
    amount: number;
    destination: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: number;
    processedAt?: number;
    rejectionReason?: string;
  }>;
  wishlists: Array<{ userEmail: string; stayId: string }>;
  notifications: import('../types').NotificationItem[];
  reports: import('../types').ListingReport[];
  tickets: import('../types').SupportTicket[];
  auditLogs: import('../types').AuditLog[];
  tripDatingProfiles: import('../types').TripDatingProfile[];
  tripDatingPaymentRequests: import('../types').TripDatingPaymentRequest[];
  tripDatingContactUnlocks: import('../types').TripDatingContactUnlock[];
  snappAddCampaigns?: import('../types').SnappAddCampaign[];
  musicTracks?: import('../types').AudioTrack[];
  audio_tracks?: import('../types').AudioTrack[];
  audio_licenses?: import('../types').AudioLicense[];
  short_jobs?: import('../types').ShortJob[];
  short_audio?: import('../types').ShortAudioConfig[];
  listing_audio?: import('../types').ListingAudioConfig[];
  short_analytics?: Record<string, import('../types').ShortAnalyticsRecord>;
  audioReports?: Array<{
    id: string;
    trackId: string;
    postId?: string;
    reporterEmail: string;
    reason: string;
    createdAt: number;
  }>;
  localGuides?: import('../types').LocalGuideProfile[];
  neighborhoodArticles?: import('../types').NeighborhoodArticle[];
  blackFridaySubscribers?: import('../types').BlackFridaySubscriber[];
  plusServiceRequests?: import('../types').PlusServiceRequest[];
  localProviders?: import('../types').LocalServiceProvider[];
  guideRequests?: Array<{
    id: string;
    guideId: string;
    guideName: string;
    userEmail: string;
    userName: string;
    area: string;
    dates: string;
    notes: string;
    createdAt: number;
  }>;
  isSingleAdminRegistered?: boolean;
  media_assets?: import('../types').MediaAsset[];
  listing_collections?: import('../types').ListingCollectionJoin[];
  transactional_outbox?: Array<{
    id: string;
    kind:
      | 'stay_approved_notification'
      | 'stay_approved_sse'
      | 'payment.submitted'
      | 'payment.approved'
      | 'payment.declined'
      | 'payment.refunded';
    stayId?: string;
    paymentId?: string;
    payload: unknown;
    status: 'pending' | 'delivered' | 'failed';
    attempts?: number;
    nextRetryAt?: number;
    lastError?: string;
    createdAt: number;
    deliveredAt?: number;
  }>;
  admin_wallet_entries?: import('../types').AdminWalletEntry[];
  wallet_year_archives?: import('../types').WalletYearArchive[];
  admin_wallet_rollups?: {
    hour: Record<string, import('../types').AdminWalletRollupBucket>;
    day: Record<string, import('../types').AdminWalletRollupBucket>;
    month: Record<string, import('../types').AdminWalletRollupBucket>;
    year: Record<string, import('../types').AdminWalletRollupBucket>;
  };
  last_archived_fiscal_year?: number;
  appliedMigrations?: Array<{ id: string; appliedAt: number; snapshot?: unknown }>;
  idempotencyCache?: Record<string, { status: number; response: unknown; createdAt: number }>;
  listingTranslations?: Record<string, {
    value: string | string[];
    sourceHash: string;
    language: string;
    stayId: string;
    field: string;
    updatedAt: number;
  }>;
  subscriptionNotificationKeys?: string[];
}
