export * from '../types';

export interface DatabaseSchema {
  users: import('../types').User[];
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
  isSingleAdminRegistered?: boolean;
}
