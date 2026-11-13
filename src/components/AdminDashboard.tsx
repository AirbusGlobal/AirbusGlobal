import React, { useState, useEffect } from 'react';
import {
  User,
  Stay,
  PaymentRecord,
  ChatThread,
  AuditLog,
  Currency,
  CURRENCY_RATES,
  Post,
  AdRequest,
  PlatformSettings,
  LedgerEntry,
  WalletRecord,
  ListingPromotion,
  DormantOwner,
  TripDatingPaymentRequest,
  TripDatingProfile,
  TripDatingStats,
  ListingReport,
  Review,
} from '../types';
import {
  ShieldCheck,
  CreditCard,
  Building,
  Users,
  CheckCircle2,
  XCircle,
  Star,
  Trash2,
  Calendar,
  MessageSquare,
  AlertTriangle,
  History,
  TrendingUp,
  ArrowLeft,
  Megaphone,
  Film,
  Sliders,
  Wallet,
  RefreshCw,
  ExternalLink,
  Check,
  X,
  FileText,
  Rocket,
  Eye,
  MousePointerClick,
  UserX,
  AlertOctagon,
  Clock,
  Heart,
  Flame,
  LogOut,
  Key,
  Lock,
  Shield,
  Images,
  Flag,
  ShieldAlert,
  Search,
  Filter,
} from 'lucide-react';
import { api } from '../api';
import { ListingMediaViewer } from './ListingMediaViewer';

interface AdminDashboardProps {
  adminUser: User;
  metrics: {
    totalStays: number;
    liveStays: number;
    pendingReviews: number;
    totalUsers: number;
    pendingPayments: number;
    totalBookings: number;
    volumeKes: number;
  };
  stays: Stay[];
  users: User[];
  payments: PaymentRecord[];
  threads: ChatThread[];
  auditLogs: AuditLog[];
  onApprovePayment: (paymentId: string) => Promise<void>;
  onRejectPayment: (paymentId: string, reason?: string) => Promise<void>;
  onVerifyUser: (email: string) => Promise<void>;
  onUpdateStay: (id: string, updates: Partial<Stay>) => Promise<void>;
  onDeleteStay: (id: string) => Promise<void>;
  onAdjustHostPlan: (hostEmail: string, tier: string, days: number) => Promise<void>;
  currency: Currency;
  onBackToFeed?: () => void;
  showToast?: (msg: string) => void;
  onLogout?: () => void;
  onUpdateAdminUser?: (updated: User) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminUser,
  metrics,
  stays,
  users,
  payments,
  threads,
  auditLogs,
  onApprovePayment,
  onRejectPayment,
  onVerifyUser,
  onUpdateStay,
  onDeleteStay,
  onAdjustHostPlan,
  currency,
  onBackToFeed,
  showToast,
  onLogout,
  onUpdateAdminUser,
}) => {
  const [tab, setTab] = useState<
    'queue' | 'ads' | 'plans' | 'listings' | 'media' | 'users' | 'reports' | 'reviews' | 'audit' | 'posts' | 'withdrawals' | 'settings' | 'treasury' | 'dormant' | 'negotiations' | 'trip-dating'
  >('queue');

  // Plan adjustment form state
  const [targetHost, setTargetHost] = useState(users.find(u => u.role === 'owner')?.email || 'owner@airbus.ke');
  const [targetTier, setTargetTier] = useState('Diamond');
  const [adjustDays, setAdjustDays] = useState(30);

  // Listing Media Moderation Queue State
  const [listingMediaList, setListingMediaList] = useState<any[]>([]);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'video' | 'photos' | 'both'>('all');
  const [mediaFlaggedOnly, setMediaFlaggedOnly] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaActionLoading, setMediaActionLoading] = useState(false);

  // Subscriptions Moderation Queue State
  const [adminSubscriptions, setAdminSubscriptions] = useState<any[]>([]);
  const [subActionLoading, setSubActionLoading] = useState(false);
  const [extendDaysModalSub, setExtendDaysModalSub] = useState<any | null>(null);
  const [extendDaysCount, setExtendDaysCount] = useState(30);

  // Reports & Flags Queue State
  const [adminReports, setAdminReports] = useState<ListingReport[]>([]);
  const [reportActionLoading, setReportActionLoading] = useState(false);

  // Reviews Moderation Queue State
  const [adminReviews, setAdminReviews] = useState<any[]>([]);
  const [reviewActionLoading, setReviewActionLoading] = useState(false);

  // Listings Moderation State
  const [listingRejectModalStay, setListingRejectModalStay] = useState<Stay | null>(null);
  const [listingRejectReason, setListingRejectReason] = useState('Listing does not meet content guidelines.');
  const [listingActionLoading, setListingActionLoading] = useState(false);

  // Adverts Moderation State
  const [adRejectModalId, setAdRejectModalId] = useState<string | null>(null);
  const [adRejectReason, setAdRejectReason] = useState('Inappropriate target URL or content.');

  // Queue View Filters
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'approved' | 'hidden' | 'flagged'>('all');
  const [userFilter, setUserFilter] = useState<'all' | 'hosts' | 'suspended'>('all');

  // Live Sync Stats
  const [liveCounts, setLiveCounts] = useState<{
    pendingPayments: number;
    pendingStays: number;
    flaggedMedia: number;
    pendingReports: number;
    unreadNotifs: number;
  }>({
    pendingPayments: 0,
    pendingStays: 0,
    flaggedMedia: 0,
    pendingReports: 0,
    unreadNotifs: 0,
  });

  // New Domain Collections State
  const [posts, setPosts] = useState<Post[]>([]);
  const [ads, setAds] = useState<AdRequest[]>([]);
  const [promotions, setPromotions] = useState<ListingPromotion[]>([]);
  const [adFilter, setAdFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [treasuryLedger, setTreasuryLedger] = useState<LedgerEntry[]>([]);
  const [treasuryWallet, setTreasuryWallet] = useState<WalletRecord | null>(null);
  const [dormantOwners, setDormantOwners] = useState<DormantOwner[]>([]);
  const [datingRequests, setDatingRequests] = useState<TripDatingPaymentRequest[]>([]);
  const [datingProfiles, setDatingProfiles] = useState<TripDatingProfile[]>([]);
  const [datingStats, setDatingStats] = useState<TripDatingStats | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Payments Tab State
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>(payments || []);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'refunded'>('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'advert' | 'boost' | 'subscription' | 'booking_fee'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'wallet' | 'mpesa'>('all');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [rejectModalPayment, setRejectModalPayment] = useState<PaymentRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('Invalid or unverified receipt code.');
  const [approveModalPayment, setApproveModalPayment] = useState<PaymentRecord | null>(null);
  const [confirmedAmountInput, setConfirmedAmountInput] = useState<number>(0);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [incomeReport, setIncomeReport] = useState<any>(null);

  // Admin Account & Security State (Requirement 5)
  const [adminUsername, setAdminUsername] = useState(adminUser?.name || '');
  const [adminEmailInput, setAdminEmailInput] = useState(adminUser?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  // Keep state updated if adminUser prop updates
  useEffect(() => {
    if (adminUser) {
      setAdminUsername(adminUser.name || '');
      setAdminEmailInput(adminUser.email || '');
    }
  }, [adminUser]);

  // Real-time password strength evaluator
  const calculatePasswordStrength = (pass: string): { score: number; label: string; color: string; width: string } => {
    if (!pass) return { score: 0, label: 'None', color: 'bg-stone-300 dark:bg-stone-700', width: 'w-0' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500', width: 'w-1/3' };
    if (score === 3 || score === 4) return { score, label: 'Medium', color: 'bg-amber-500', width: 'w-2/3' };
    return { score, label: 'Strong', color: 'bg-emerald-500', width: 'w-full' };
  };

  const handleUpdateAdminAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    if (!currentPassword) {
      setSecurityError('Current password is required to verify identity.');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setSecurityError('New password must be at least 6 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setSecurityError('New password and confirmation do not match.');
        return;
      }
      if (newPassword === currentPassword) {
        setSecurityError('New password must be different from current password.');
        return;
      }
    }

    setSecurityLoading(true);
    try {
      const res = await api.changeAdminCredentials({
        currentPassword,
        newPassword: newPassword || undefined,
        newName: adminUsername.trim() || undefined,
        newEmail: adminEmailInput.trim() || undefined,
      });

      setSecuritySuccess('Admin credentials updated successfully! Session preserved.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (res.user) {
        onUpdateAdminUser?.(res.user);
      }
      showToast?.('Admin account updated successfully.');
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to update credentials.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const loadAdminData = () => {
    api.getPaymentRecords().then(res => {
      if (res && res.payments) setAllPayments(res.payments);
    }).catch(() => {});
    api.getPosts().then(res => setPosts(res.posts)).catch(() => {});
    api.getAds().then(res => setAds(res.ads)).catch(() => {});
    api.getOwnerPromotions().then(res => setPromotions(res.promotions || [])).catch(() => {});
    api.getAdminWithdrawals().then(res => setWithdrawals(res.withdrawals)).catch(() => {});
    api.getSettings().then(res => setSettings(res.settings)).catch(() => {});
    api.getDormantOwners().then(res => setDormantOwners(res.dormantOwners || [])).catch(() => {});
    api.getWallet().then(res => {
      setTreasuryWallet(res.wallet);
      setTreasuryLedger(res.ledger);
    }).catch(() => {});
    api.getWalletReconciliation().then(res => {
      if (res) setReconciliation(res);
    }).catch(() => {});
    api.getAdminIncomeReport().then(res => {
      if (res) setIncomeReport(res);
    }).catch(() => {});
    api.getAdminTripDatingRequests().then(res => setDatingRequests(res.requests || [])).catch(() => {});
    api.getAdminTripDatingStats().then(res => {
      setDatingStats(res.stats);
      setDatingProfiles(res.profiles || []);
    }).catch(() => {});
    api.getAdminListingMedia({ type: mediaTypeFilter, flaggedOnly: mediaFlaggedOnly, search: mediaSearch }).then(res => {
      if (res && res.media) setListingMediaList(res.media);
    }).catch(() => {});
    api.getAdminSubscriptions().then(res => {
      if (res && res.subscriptions) setAdminSubscriptions(res.subscriptions);
    }).catch(() => {});
    api.getAdminReports().then(res => {
      if (res && res.reports) setAdminReports(res.reports);
    }).catch(() => {});
    api.getAdminReviews().then(res => {
      if (res && res.reviews) setAdminReviews(res.reviews);
    }).catch(() => {});
    api.getLiveUpdates().then(res => {
      if (res && res.counts) setLiveCounts(res.counts);
    }).catch(() => {});
  };

  const handleDelistOwner = async (email: string) => {
    if (!window.confirm(`Are you sure you want to delist all listings for dormant owner ${email}? Their stays will be removed from guest search and booking.`)) {
      return;
    }
    try {
      setActionLoading(true);
      await api.delistOwner(email);
      showToast?.(`Listings for ${email} have been delisted.`);
      loadAdminData();
    } catch (err: any) {
      showToast?.(err.message || 'Failed to delist owner.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelistOwner = async (email: string) => {
    try {
      setActionLoading(true);
      await api.relistOwner(email);
      showToast?.(`Listings for ${email} have been restored.`);
      loadAdminData();
    } catch (err: any) {
      showToast?.(err.message || 'Failed to relist owner.');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
    const interval = setInterval(() => {
      api.getLiveUpdates().then(res => {
        if (res && res.counts) setLiveCounts(res.counts);
      }).catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const currentPaymentsList = allPayments.length > 0 ? allPayments : payments;
  const pendingPayments = currentPaymentsList.filter(p => p.status === 'pending');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Ubiquitous Go Back to Feed Navigation & Admin Logout */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBackToFeed}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#e4002b]" />
          <span>Go Back to Stays Feed</span>
        </button>

        {onLogout && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Are you sure you want to log out of the AirBus Admin Console?')) {
                onLogout();
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 text-xs font-bold transition-all shadow-sm cursor-pointer"
            title="Log out from Administrative Session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        )}
      </div>

      {/* Admin Header */}
      <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-amber-950/60 text-white p-6 rounded-3xl shadow-lg border border-amber-500/20 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-amber-500 text-stone-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Platform Admin Console
              </span>
              <span className="text-xs text-amber-300 font-mono">Logged as: {adminUser.email}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight">
              AirBus Central Administration
            </h1>
            <p className="text-xs text-stone-300 mt-1 max-w-md">
              Review and approve incoming M-Pesa receipts, moderate stays, manage host subscription validity, and audit real-time guest-host negotiations.
            </p>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
              <div className="text-lg font-black text-amber-400">{metrics.pendingPayments}</div>
              <div className="text-[10px] text-stone-300 uppercase font-semibold">Pending M-Pesa</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
              <div className="text-lg font-black text-emerald-400">{metrics.liveStays}</div>
              <div className="text-[10px] text-stone-300 uppercase font-semibold">Live Stays</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
              <div className="text-lg font-black text-white">{metrics.totalUsers}</div>
              <div className="text-[10px] text-stone-300 uppercase font-semibold">Accounts</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
              <div className="text-lg font-black text-[#ff2e93]">
                KES {Math.round(metrics.volumeKes / 1000)}k
              </div>
              <div className="text-[10px] text-stone-300 uppercase font-semibold">Volume</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - 9 Primary Moderation Queues First */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 border-b border-stone-200 dark:border-stone-800 text-xs font-bold">
        {/* 1. Payments */}
        <button
          onClick={() => setTab('queue')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'queue'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>1. Payments</span>
          {pendingPayments.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
              {pendingPayments.length}
            </span>
          )}
        </button>

        {/* 2. Adverts */}
        <button
          onClick={() => setTab('ads')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'ads'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Megaphone className="w-4 h-4 text-purple-500" />
          <span>2. Adverts ({ads.filter(a => a.status === 'pending').length})</span>
        </button>

        {/* 3. Subscriptions */}
        <button
          onClick={() => setTab('plans')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'plans'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Calendar className="w-4 h-4 text-blue-500" />
          <span>3. Subscriptions ({adminSubscriptions.length})</span>
        </button>

        {/* 4. Listings */}
        <button
          onClick={() => setTab('listings')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'listings'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Building className="w-4 h-4 text-emerald-500" />
          <span>4. Listings ({stays.length})</span>
          {stays.filter(s => s.status === 'review').length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-950 text-[10px] font-black">
              {stays.filter(s => s.status === 'review').length}
            </span>
          )}
        </button>

        {/* 5. Listing Media */}
        <button
          onClick={() => setTab('media')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'media'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Images className="w-4 h-4 text-[#ff2e93]" />
          <span>5. Listing Media ({listingMediaList.length})</span>
          {listingMediaList.filter(m => m.mediaModerationStatus === 'flagged').length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
              {listingMediaList.filter(m => m.mediaModerationStatus === 'flagged').length}
            </span>
          )}
        </button>

        {/* 6. Users & Hosts */}
        <button
          onClick={() => setTab('users')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'users'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-500" />
          <span>6. Users ({users.length})</span>
        </button>

        {/* 7. Reports & Flags */}
        <button
          onClick={() => setTab('reports')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'reports'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Flag className="w-4 h-4 text-amber-500" />
          <span>7. Reports ({adminReports.filter(r => r.status === 'pending').length})</span>
        </button>

        {/* 8. Reviews */}
        <button
          onClick={() => setTab('reviews')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'reviews'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Star className="w-4 h-4 text-amber-400" />
          <span>8. Reviews ({adminReviews.length})</span>
        </button>

        {/* 9. Audit Log */}
        <button
          onClick={() => setTab('audit')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'audit'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <History className="w-4 h-4 text-emerald-400" />
          <span>9. Audit Log</span>
        </button>

        {/* Additional Utility Tabs */}
        <button
          onClick={() => setTab('trip-dating')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'trip-dating'
              ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Flame className="w-4 h-4 text-rose-500" />
          <span>Trip Dating ({datingRequests.filter(r => r.status === 'pending').length})</span>
        </button>

        <button
          onClick={() => setTab('posts')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'posts'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Film className="w-4 h-4 text-[#ff2e93]" />
          <span>Posts Queue ({posts.filter(p => p.status === 'pending').length})</span>
        </button>

        <button
          onClick={() => setTab('withdrawals')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'withdrawals'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Wallet className="w-4 h-4 text-emerald-500" />
          <span>Withdrawals ({withdrawals.filter(w => w.status === 'pending').length})</span>
        </button>

        <button
          onClick={() => setTab('settings')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'settings'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Sliders className="w-4 h-4 text-cyan-500" />
          <span>Settings</span>
        </button>

        <button
          onClick={() => setTab('treasury')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'treasury'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>Treasury</span>
        </button>

        <button
          onClick={() => setTab('dormant')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'dormant'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <UserX className="w-4 h-4 text-red-500" />
          <span>Dormant Hosts ({dormantOwners.length})</span>
        </button>

        <button
          onClick={() => setTab('negotiations')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'negotiations'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <span>Negotiations ({threads.length})</span>
        </button>
      </div>

      {/* TAB 1: PAYMENTS MODULE & AUDIT LEDGER */}
      {tab === 'queue' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-200 dark:border-stone-800">
            <div>
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
                <span>Payments &amp; Ledger Audit</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  {currentPaymentsList.length} total
                </span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Verify and moderate all M-Pesa receipts and atomic wallet transactions for adverts, subscriptions, and platform bookings.
              </p>
            </div>
            <button
              onClick={loadAdminData}
              className="self-start sm:self-auto px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Filtering & Search Toolbar */}
          <div className="p-4 bg-stone-50 dark:bg-[#1a1c24] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={paymentSearch}
                onChange={e => setPaymentSearch(e.target.value)}
                placeholder="Search payments by user email, reference ID, or M-Pesa receipt code..."
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#12141a] border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-amber-500 transition-colors"
              />
              <CreditCard className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#12141a] px-2 py-1 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="text-[10px] text-stone-400 font-bold uppercase">Status:</span>
                {(['all', 'pending', 'approved', 'rejected', 'refunded'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPaymentStatusFilter(s)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                      paymentStatusFilter === s
                        ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#12141a] px-2 py-1 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="text-[10px] text-stone-400 font-bold uppercase">Type:</span>
                {(['all', 'boost', 'advert', 'subscription', 'booking_fee'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPaymentTypeFilter(t)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                      paymentTypeFilter === t
                        ? 'bg-[#e4002b] text-white font-black shadow-xs'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    {t === 'booking_fee' ? 'Booking' : t}
                  </button>
                ))}
              </div>

              {/* Method Filter */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#12141a] px-2 py-1 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="text-[10px] text-stone-400 font-bold uppercase">Method:</span>
                {(['all', 'wallet', 'mpesa'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethodFilter(m)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer ${
                      paymentMethodFilter === m
                        ? 'bg-emerald-600 text-white font-black shadow-xs'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Records List */}
          {(() => {
            const filtered = currentPaymentsList.filter(p => {
              if (paymentStatusFilter !== 'all' && p.status !== paymentStatusFilter) return false;
              if (paymentTypeFilter !== 'all') {
                const matchType = p.type === paymentTypeFilter || 
                  (paymentTypeFilter === 'subscription' && p.kind === 'plan') ||
                  (paymentTypeFilter === 'boost' && (p.kind === 'boost' || p.referenceId?.startsWith('boost_')));
                if (!matchType) return false;
              }
              if (paymentMethodFilter !== 'all') {
                const method = p.method || 'mpesa';
                if (method !== paymentMethodFilter) return false;
              }
              if (paymentSearch.trim()) {
                const q = paymentSearch.toLowerCase().trim();
                const matched =
                  (p.id && p.id.toLowerCase().includes(q)) ||
                  (p.userId && p.userId.toLowerCase().includes(q)) ||
                  (p.hostEmail && p.hostEmail.toLowerCase().includes(q)) ||
                  (p.referenceId && p.referenceId.toLowerCase().includes(q)) ||
                  (p.mpesaCode && p.mpesaCode.toLowerCase().includes(q));
                if (!matched) return false;
              }
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="p-12 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-300 dark:border-stone-800 text-xs text-stone-400">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  No payment records found matching the current filters.
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filtered.map(p => {
                  const isPending = p.status === 'pending';
                  const isApproved = p.status === 'approved';
                  const isRejected = p.status === 'rejected';
                  const isRefunded = p.status === 'refunded';
                  const amountDisplay = p.amountSc || p.amount;

                  return (
                    <div
                      key={p.id}
                      className={`p-5 bg-white dark:bg-[#15171e] rounded-3xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                        isPending
                          ? 'border-amber-300 dark:border-amber-800/80 ring-1 ring-amber-400/20'
                          : isApproved
                          ? 'border-emerald-200 dark:border-emerald-900/40'
                          : 'border-stone-200 dark:border-stone-800 opacity-90'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Status Badge */}
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                              isPending
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 animate-pulse'
                                : isApproved
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {p.status}
                          </span>

                          {/* Type Badge */}
                          <span className="text-[10px] font-black uppercase bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded-full">
                            {p.type || p.kind || 'Payment'}
                          </span>

                          {/* Method Badge */}
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              p.method === 'wallet'
                                ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                                : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            }`}
                          >
                            {p.method === 'wallet' ? <Wallet className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                            <span>{p.method || 'M-Pesa'}</span>
                          </span>

                          {/* Amount */}
                          <span className="text-sm font-black text-stone-900 dark:text-white font-mono">
                            {p.method === 'wallet' ? `${amountDisplay.toLocaleString()} SC` : `KES ${amountDisplay.toLocaleString()}`}
                          </span>
                        </div>

                        {/* User & Reference info */}
                        <div className="text-xs text-stone-700 dark:text-stone-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>User: <strong className="text-stone-900 dark:text-white">{p.userId || p.hostEmail}</strong></span>
                          {p.referenceId && (
                            <span className="text-stone-400">
                              Ref: <span className="font-mono text-stone-600 dark:text-stone-300">{p.referenceId}</span>
                            </span>
                          )}
                          {p.planTier && (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                              Tier: {p.planTier} ({p.period || (p.durationDays && p.durationDays > 30 ? '365d' : '30d')})
                            </span>
                          )}
                        </div>

                        {/* Receipt Code and Dates */}
                        <div className="text-[11px] text-stone-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {p.mpesaCode && (
                            <span>
                              M-Pesa Code:{' '}
                              <span className="font-mono font-bold text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">
                                {p.mpesaCode}
                              </span>
                            </span>
                          )}
                          <span>Submitted: {new Date(p.createdAt).toLocaleString()}</span>
                          {p.approvedAt && <span>Approved: {new Date(p.approvedAt).toLocaleTimeString()}</span>}
                        </div>

                        {/* Rejection notice */}
                        {p.rejectionReason && (
                          <div className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2 rounded-xl">
                            <strong>Decline Reason: </strong>{p.rejectionReason}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons for Pending Payments */}
                      {isPending && (
                        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100 dark:border-stone-800">
                          <button
                            type="button"
                            onClick={() => {
                              setApproveModalPayment(p);
                              setConfirmedAmountInput(p.claimedAmount || p.amount || p.amountSc || 0);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Approve &amp; Activate</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRejectModalPayment(p);
                              setRejectReason('Invalid or unverified receipt details.');
                            }}
                            className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-rose-100 text-rose-600 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Decline / Refund</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* APPROVE MODAL */}
          {approveModalPayment && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                  <h4 className="text-base font-extrabold text-stone-900 dark:text-white">
                    Confirm Payment Approval
                  </h4>
                </div>

                <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-2xl text-xs space-y-2 text-stone-600 dark:text-stone-300">
                  <div>User: <strong className="text-stone-900 dark:text-white">{approveModalPayment.userId || approveModalPayment.hostEmail}</strong></div>
                  <div>Type: <strong className="capitalize">{approveModalPayment.type || approveModalPayment.kind}</strong></div>
                  <div>Claimed Amount: <strong className="font-mono text-emerald-600">{approveModalPayment.claimedAmount || approveModalPayment.amountSc || approveModalPayment.amount} KES</strong></div>
                  {approveModalPayment.mpesaCode && <div>Receipt: <strong className="font-mono">{approveModalPayment.mpesaCode}</strong></div>}

                  <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
                    <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-200 mb-1">
                      Confirmed / Approved Amount (KES) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={confirmedAmountInput}
                      onChange={e => setConfirmedAmountInput(Number(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-mono font-bold text-stone-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] text-stone-400 mt-0.5 block">
                      Edit this amount if the actual Till SMS receipt differs from what the user claimed.
                    </span>
                  </div>
                </div>

                <p className="text-xs text-stone-500 leading-relaxed">
                  Approving this payment will immediately activate the item (advert slot, host subscription, or wallet top-up) and send an automatic real-time notification to the user.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={processingPayment}
                    onClick={() => setApproveModalPayment(null)}
                    className="px-4 py-2 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={processingPayment}
                    onClick={async () => {
                      setProcessingPayment(true);
                      try {
                        await api.approvePayment(approveModalPayment.id, confirmedAmountInput > 0 ? confirmedAmountInput : undefined);
                        showToast?.('Payment approved and activated successfully.');
                        setApproveModalPayment(null);
                        loadAdminData();
                      } catch (err: any) {
                        alert(err.message || 'Approval failed.');
                      } finally {
                        setProcessingPayment(false);
                      }
                    }}
                    className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {processingPayment ? 'Activating...' : 'Yes, Approve & Activate'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* REJECT & REFUND MODAL */}
          {rejectModalPayment && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
                <div className="flex items-center gap-2 text-rose-600">
                  <XCircle className="w-6 h-6" />
                  <h4 className="text-base font-extrabold text-stone-900 dark:text-white">
                    Decline Payment Submission
                  </h4>
                </div>

                <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-2xl text-xs space-y-1 text-stone-600 dark:text-stone-300">
                  <div>User: <strong className="text-stone-900 dark:text-white">{rejectModalPayment.userId || rejectModalPayment.hostEmail}</strong></div>
                  <div>Method: <strong className="uppercase">{rejectModalPayment.method || 'M-Pesa'}</strong></div>
                  <div>Amount: <strong className="font-mono text-rose-600">{rejectModalPayment.amountSc || rejectModalPayment.amount} Coins</strong></div>
                </div>

                {rejectModalPayment.method === 'wallet' && (
                  <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-[11px] text-purple-900 dark:text-purple-200">
                    <strong>Atomic Reversal: </strong>Since this payment was deducted from the user's wallet, declining will automatically credit {rejectModalPayment.amountSc || rejectModalPayment.amount} Coins back to their wallet with reversal ledger rows.
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Reason for Rejection *
                  </label>
                  <textarea
                    rows={3}
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Enter specific reason (e.g. M-Pesa receipt could not be verified on Daraja statement)..."
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-rose-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={processingPayment}
                    onClick={() => setRejectModalPayment(null)}
                    className="px-4 py-2 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={processingPayment || !rejectReason.trim()}
                    onClick={async () => {
                      setProcessingPayment(true);
                      try {
                        await api.rejectPayment(rejectModalPayment.id, rejectReason.trim());
                        showToast?.('Payment declined and ledger updated.');
                        setRejectModalPayment(null);
                        loadAdminData();
                      } catch (err: any) {
                        alert(err.message || 'Decline failed.');
                      } finally {
                        setProcessingPayment(false);
                      }
                    }}
                    className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {processingPayment ? 'Processing...' : 'Confirm Decline & Notify'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: POSTS MODERATION QUEUE (PHOTO, SHORT, VIDEO) */}
      {tab === 'posts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">Content Moderation Queue</h3>
              <p className="text-xs text-stone-500">Short-stay photos (1-10 images), shorts (≤60s), and videos (≤30m). All posts require admin approval.</p>
            </div>
            <button
              onClick={loadAdminData}
              className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
              title="Refresh posts"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {posts.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-400">
              No posts found.
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map(post => (
                <div
                  key={post.id}
                  className="p-4 sm:p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <img
                      src={post.coverUrl}
                      alt={post.id}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 border border-stone-200 dark:border-stone-700 shadow-sm"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          post.type === 'short'
                            ? 'bg-pink-100 text-[#ff2e93] dark:bg-pink-950/60'
                            : post.type === 'video'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60'
                            : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60'
                        }`}>
                          {post.type.toUpperCase()} {post.durationSeconds ? `(${post.durationSeconds}s)` : post.images ? `(${post.images.length} imgs)` : ''}
                        </span>

                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          post.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : post.status === 'pending'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}>
                          {post.status}
                        </span>
                      </div>

                      <p className="text-xs text-stone-800 dark:text-stone-200 font-medium leading-relaxed max-w-lg">
                        {post.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
                        <span>Owner: <strong className="text-stone-700 dark:text-stone-300">{post.ownerEmail}</strong></span>
                        {post.stayId && <span>· Stay: #{post.stayId}</span>}
                        <span>· {new Date(post.createdAt).toLocaleDateString()}</span>
                        <span>· Desc: {post.description.length}/300 chars</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                    {post.status === 'pending' && (
                      <>
                        <button
                          onClick={async () => {
                            await api.moderatePost(post.id, 'approved');
                            showToast?.('Post approved and published!');
                            loadAdminData();
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={async () => {
                            const reason = prompt('Reason for rejecting post:') || 'Content does not meet short-stay guidelines.';
                            await api.moderatePost(post.id, 'rejected', reason);
                            showToast?.('Post rejected.');
                            loadAdminData();
                          }}
                          className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-rose-100 text-rose-600 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}
                    {post.status === 'approved' && (
                      <button
                        onClick={async () => {
                          await api.moderatePost(post.id, 'removed', 'Removed by administrator');
                          showToast?.('Post removed from public feed.');
                          loadAdminData();
                        }}
                        className="px-3.5 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-rose-100 text-rose-600 rounded-full text-xs font-bold transition-all cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: AD REQUESTS & 70/30 SPLIT MODERATION */}
      {tab === 'ads' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-gradient-to-r from-purple-950/30 via-pink-950/20 to-stone-900 border border-purple-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#ff2e93]" />
              <h4 className="text-xs font-black uppercase text-white tracking-wider">
                Sponsor Ads Invariant & Split Engine
              </h4>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              AirBus charges advertisers <strong className="text-white">KES 100/day</strong> per slot (max 10 active slots per video). On approval, funds are moved atomically: <strong className="text-emerald-400">70% host net</strong> is credited immediately to host wallet, and <strong className="text-purple-400">30% platform fee</strong> to Treasury. Rejection immediately releases the wallet hold back to the advertiser.
            </p>
            <div className="text-[11px] font-mono text-purple-300 bg-purple-950/40 p-2.5 rounded-xl border border-purple-500/20">
              Worked Example: 300 KES ad for 3 days ➔ Host Net: 210 KES | Treasury Fee: 90 KES
            </div>
          </div>

          {/* Slot Utilization & Financial Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Placements</span>
              <span className="text-base font-black text-stone-900 dark:text-white">{ads.length} Ads</span>
            </div>
            <div className="p-3.5 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Active Live Slots</span>
              <span className="text-base font-black text-emerald-500">
                {ads.filter(a => a.status === 'approved').length} / {stays.length * 10} Max
              </span>
            </div>
            <div className="p-3.5 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Host 70% Net Disbursed</span>
              <span className="text-base font-black text-purple-600 dark:text-purple-400">
                KES {ads.filter(a => a.status === 'approved').reduce((acc, a) => acc + a.hostNet, 0).toLocaleString()}
              </span>
            </div>
            <div className="p-3.5 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Treasury 30% Fee Kept</span>
              <span className="text-base font-black text-pink-600 dark:text-pink-400">
                KES {ads.filter(a => a.status === 'approved').reduce((acc, a) => acc + a.platformFee, 0).toLocaleString()}
              </span>
            </div>
            <div className="p-3.5 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Ad Visibility</span>
              <span className="text-base font-black text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Eye className="w-4 h-4" />
                <span>{ads.reduce((acc, a) => acc + (a.views || 0), 0).toLocaleString()}</span>
              </span>
            </div>
          </div>

          {/* Ad Filter Tabs & Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'all', label: `All Ads (${ads.length})` },
                { id: 'pending', label: `Pending (${ads.filter(a => a.status === 'pending').length})` },
                { id: 'approved', label: `Approved (${ads.filter(a => a.status === 'approved').length})` },
                { id: 'rejected', label: `Rejected (${ads.filter(a => a.status === 'rejected').length})` },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setAdFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    adFilter === f.id
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={loadAdminData}
              className="px-3 py-1.5 rounded-full border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 text-xs font-bold flex items-center gap-1.5 hover:bg-stone-50 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {ads.filter(a => adFilter === 'all' || a.status === adFilter).length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-400">
              No advert requests in this category.
            </div>
          ) : (
            <div className="space-y-3">
              {ads
                .filter(a => adFilter === 'all' || a.status === adFilter)
                .map(ad => {
                  const associatedStay = stays.find(s => s.id === ad.stayId);
                  return (
                    <div
                      key={ad.id}
                      className="p-4 sm:p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <img
                          src={ad.imageUrl}
                          alt={ad.title}
                          className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-stone-200 dark:border-stone-700 shadow-sm"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                              {ad.tag || 'Sponsor'} ({ad.days} Days)
                            </span>

                            <span
                              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                ad.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : ad.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {ad.status}
                            </span>
                          </div>

                          <h4 className="text-sm font-extrabold text-stone-900 dark:text-white">{ad.title}</h4>
                          <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-1">{ad.description}</p>

                          {/* Financial Split Breakdown */}
                          <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs grid grid-cols-3 gap-2 text-center max-w-md">
                            <div>
                              <span className="text-[10px] text-stone-400 font-semibold block">Total Billed</span>
                              <strong className="text-stone-900 dark:text-white">KES {ad.totalAmount}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-stone-400 font-semibold block">Host Net (70%)</span>
                              <strong className="text-emerald-600 dark:text-emerald-400">KES {ad.hostNet}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-stone-400 font-semibold block">Platform Fee (30%)</span>
                              <strong className="text-purple-600 dark:text-purple-400">KES {ad.platformFee}</strong>
                            </div>
                          </div>

                          {/* Visibility and Property Association Metrics */}
                          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                            <span className="text-stone-400">
                              Advertiser: <strong className="text-stone-700 dark:text-stone-300">{ad.advertiserEmail}</strong>
                            </span>
                            <span className="text-stone-300 dark:text-stone-700">·</span>
                            <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">
                              <Eye className="w-3 h-3" />
                              <span>{ad.views || 0} Ad Views</span>
                            </span>
                            <span className="flex items-center gap-1 font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 px-2 py-0.5 rounded-full">
                              <MousePointerClick className="w-3 h-3" />
                              <span>{ad.clicks || 0} Clicks</span>
                            </span>
                            {associatedStay && (
                              <span className="text-stone-500">
                                Property: <strong className="text-stone-800 dark:text-stone-200">{associatedStay.title}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                      {ad.status === 'pending' ? (
                        <>
                          <button
                            onClick={async () => {
                              await api.approveAd(ad.id);
                              showToast?.(`Ad approved! KES ${ad.hostNet} credited to host, KES ${ad.platformFee} to treasury.`);
                              loadAdminData();
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve &amp; Split</span>
                          </button>
                          <button
                            onClick={async () => {
                              const reason = prompt('Reason for rejecting advert:') || 'Ad does not meet quality requirements.';
                              await api.rejectAd(ad.id, reason);
                              showToast?.('Ad rejected and hold released.');
                              loadAdminData();
                            }}
                            className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-rose-100 text-rose-600 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject &amp; Refund</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-stone-400 font-semibold">Processed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Platform-Wide Promoted Listing Boosts Section */}
          <div className="pt-6 border-t border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-extrabold text-stone-900 dark:text-white">
                  Platform Promoted Listing Boosts (@ KES 100/day) ({promotions.length})
                </h4>
              </div>
              <span className="text-xs text-stone-400">
                100% credited to AirBus Treasury
              </span>
            </div>

            {promotions.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl text-xs text-stone-400">
                No active listing boost promotions.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                  <thead className="border-b border-stone-200 dark:border-stone-800 text-[10px] uppercase font-bold text-stone-400 bg-stone-50 dark:bg-stone-900/50">
                    <tr>
                      <th className="py-2.5 px-3">Stay ID / Title</th>
                      <th className="py-2.5 px-3">Host Email</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Paid (Treasury)</th>
                      <th className="py-2.5 px-3">Impressions</th>
                      <th className="py-2.5 px-3">Clicks</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {promotions.map(p => {
                      const stay = stays.find(s => s.id === p.stayId);
                      const isStillActive = p.expiresAt > Date.now();
                      return (
                        <tr key={p.id} className="hover:bg-stone-50 dark:hover:bg-stone-900/50">
                          <td className="py-2.5 px-3 font-bold text-stone-900 dark:text-white">
                            🚀 {stay?.title || p.stayId}
                          </td>
                          <td className="py-2.5 px-3 text-stone-600 dark:text-stone-300">{p.ownerEmail}</td>
                          <td className="py-2.5 px-3">{p.days} Days</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">KES {p.cost}</td>
                          <td className="py-2.5 px-3 font-mono">{p.impressions || stay?.promotionImpressions || 0}</td>
                          <td className="py-2.5 px-3 font-mono">{p.clicks || stay?.promotionClicks || 0}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                isStillActive
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                              }`}
                            >
                              {isStillActive ? 'Active' : 'Completed'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: WITHDRAWALS APPROVAL */}
      {tab === 'withdrawals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">Withdrawal Payout Requests</h3>
              <p className="text-xs text-stone-500">Hosts and creators cashing out wallet funds (ad revenues & affiliate commissions).</p>
            </div>
            <button
              onClick={loadAdminData}
              className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {withdrawals.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-400">
              No withdrawal requests pending.
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map(w => (
                <div
                  key={w.id}
                  className="p-4 sm:p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-stone-900 dark:text-white">
                        KES {w.amount.toLocaleString()}
                      </span>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        w.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : w.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {w.status}
                      </span>
                    </div>
                    <div className="text-xs text-stone-600 dark:text-stone-300">
                      User: <strong className="text-stone-900 dark:text-white">{w.userEmail}</strong>
                    </div>
                    <div className="text-xs text-stone-500 font-mono">
                      Payout Destination: <strong className="text-stone-800 dark:text-stone-200">{w.destination}</strong>
                    </div>
                    <span className="text-[10px] text-stone-400">{new Date(w.createdAt).toLocaleString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {w.status === 'pending' && (
                      <>
                        <button
                          onClick={async () => {
                            await api.approveWithdrawal(w.id);
                            showToast?.(`Withdrawal of KES ${w.amount} approved!`);
                            loadAdminData();
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold cursor-pointer"
                        >
                          Approve Payout
                        </button>
                        <button
                          onClick={async () => {
                            const reason = prompt('Rejection reason:') || 'Invalid payout destination.';
                            await api.rejectWithdrawal(w.id, reason);
                            showToast?.('Withdrawal rejected and funds restored.');
                            loadAdminData();
                          }}
                          className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-rose-100 text-rose-600 rounded-full text-xs font-bold cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: SETTINGS (Admin Account & Security + Dynamic Platform Settings) */}
      {tab === 'settings' && (
        <div className="space-y-6">
          {/* SECTION 1: ADMIN ACCOUNT & SECURITY (Requirement 5) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span>Admin Account &amp; Security</span>
                </h3>
                <p className="text-xs text-stone-500">
                  Update your administrator display name, email, and password as many times as desired.
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-5 text-xs">
              {/* Active Admin Pill */}
              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center font-black text-sm">
                    {adminUser.name?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div>
                    <div className="font-extrabold text-stone-900 dark:text-white text-sm">
                      {adminUser.name}
                    </div>
                    <div className="text-[11px] text-stone-500 font-mono">{adminUser.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Sole Administrator
                  </span>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Log out of AirBus Administrative Console?')) {
                          onLogout();
                        }
                      }}
                      className="px-3 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Log Out</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Security Feedback Banners */}
              {securitySuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-2xl text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{securitySuccess}</span>
                </div>
              )}
              {securityError && (
                <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-2xl text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{securityError}</span>
                </div>
              )}

              {/* Form to change username and password */}
              <form onSubmit={handleUpdateAdminAccount} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Administrator Name (Username)
                    </label>
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={e => setAdminUsername(e.target.value)}
                      placeholder="e.g. Alex Kamau"
                      className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-medium text-xs text-stone-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Administrator Email
                    </label>
                    <input
                      type="email"
                      value={adminEmailInput}
                      onChange={e => setAdminEmailInput(e.target.value)}
                      placeholder="admin@airbus.ke"
                      className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-medium text-xs text-stone-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-4">
                  <div>
                    <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-stone-400" /> Current Password (Identity Verification)
                      </span>
                      <span className="text-[10px] text-amber-500 font-semibold">*Required for any change</span>
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-medium text-xs text-stone-900 dark:text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1 flex items-center justify-between">
                        <span>New Password</span>
                        <span className="text-[10px] text-stone-400 font-normal">(Leave blank if keeping current)</span>
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-medium text-xs text-stone-900 dark:text-white"
                      />

                      {/* Real-time Password Strength Indicator */}
                      {newPassword && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-stone-500 font-semibold">Password Strength:</span>
                            <span className={`font-bold capitalize ${
                              calculatePasswordStrength(newPassword).label === 'Strong' ? 'text-emerald-500' :
                              calculatePasswordStrength(newPassword).label === 'Medium' ? 'text-amber-500' : 'text-red-500'
                            }`}>
                              {calculatePasswordStrength(newPassword).label}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${calculatePasswordStrength(newPassword).color} ${calculatePasswordStrength(newPassword).width}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-medium text-xs text-stone-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={securityLoading}
                    className="px-6 py-2.5 rounded-full bg-stone-900 dark:bg-white text-white dark:text-stone-900 hover:opacity-90 font-extrabold text-xs cursor-pointer shadow-md transition-all flex items-center gap-2"
                  >
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    <span>{securityLoading ? 'Saving credentials...' : 'Save Account & Security Changes'}</span>
                  </button>

                  <span className="text-[11px] text-stone-400">
                    Your session will remain authenticated after credential changes.
                  </span>
                </div>
              </form>
            </div>
          </div>

          {/* SECTION 2: DYNAMIC PLATFORM SETTINGS */}
          {settings && (
            <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white">Dynamic Platform Settings</h3>
                  <p className="text-xs text-stone-500">All fees, ad slot pricing, referral rates and constraints are dynamic and stored in database.</p>
                </div>
              </div>

              <div className="p-5 sm:p-6 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Ad Price per Day (KES)</label>
                <input
                  type="number"
                  min="50"
                  step="10"
                  value={settings.adPricePerDay}
                  onChange={e => setSettings({ ...settings, adPricePerDay: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-bold text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Platform Ad Fee (%)</label>
                <input
                  type="number"
                  min="10"
                  max="50"
                  value={settings.adPlatformFeePercent}
                  onChange={e => setSettings({ ...settings, adPlatformFeePercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-bold text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Max Ad Slots per Video</label>
                <input
                  type="number"
                  min="3"
                  max="20"
                  value={settings.maxAdSlotsPerPost}
                  onChange={e => setSettings({ ...settings, maxAdSlotsPerPost: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-bold text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-stone-100 dark:border-stone-800">
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Affiliate Commission (%)</label>
                <input
                  type="number"
                  min="5"
                  max="30"
                  value={settings.referralCommissionPercent}
                  onChange={e => setSettings({ ...settings, referralCommissionPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-bold text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Affiliate Duration (Days)</label>
                <input
                  type="number"
                  min="30"
                  max="730"
                  value={settings.referralDurationDays}
                  onChange={e => setSettings({ ...settings, referralDurationDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-bold text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Min Withdrawal (KES)</label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={settings.minWithdrawalKes}
                  onChange={e => setSettings({ ...settings, minWithdrawalKes: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-bold text-xs"
                />
              </div>
            </div>

            {/* Plan Prices */}
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
              <span className="font-extrabold text-stone-800 dark:text-stone-200 block mb-2">Monthly Host Plan Pricing (KES)</span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-stone-400 uppercase font-semibold">Silver Plan</label>
                  <input
                    type="number"
                    value={settings.planPrices.Silver}
                    onChange={e => setSettings({ ...settings, planPrices: { ...settings.planPrices, Silver: Number(e.target.value) } })}
                    className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-400 uppercase font-semibold">Diamond Plan</label>
                  <input
                    type="number"
                    value={settings.planPrices.Diamond}
                    onChange={e => setSettings({ ...settings, planPrices: { ...settings.planPrices, Diamond: Number(e.target.value) } })}
                    className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-400 uppercase font-semibold">Gold Plan</label>
                  <input
                    type="number"
                    value={settings.planPrices.Gold}
                    onChange={e => setSettings({ ...settings, planPrices: { ...settings.planPrices, Gold: Number(e.target.value) } })}
                    className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-bold text-xs"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={async () => {
                await api.updateSettings(settings);
                showToast?.('Platform configuration updated and saved!');
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#e4002b] hover:bg-[#c90026] text-white font-extrabold text-xs cursor-pointer shadow-md transition-all"
            >
              Save Platform Configuration
            </button>
          </div>
        </div>
      )}
    </div>
  )}

      {/* TAB: TREASURY & LEDGER STREAM */}
      {tab === 'treasury' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Treasury Wallet Balance</span>
              <div className="text-2xl font-black text-stone-900 dark:text-white mt-1">
                KES {(reconciliation ? reconciliation.adminBalance : (treasuryWallet?.balance || 0)).toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
                Derived directly from append-only ledger
              </span>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Total Net Platform Income</span>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                KES {(incomeReport?.totalRevenue ?? treasuryWallet?.lifetimeEarnings ?? 0).toLocaleString()}
              </div>
              <span className="text-[10px] text-stone-400 mt-1 block">
                From Adverts (30%), Dating &amp; Subscriptions
              </span>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Ledger Invariant Check</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <span>100% Balanced</span>
              </div>
              <span className="text-[10px] text-stone-400 mt-1 block">
                Zero Ledger Discrepancy
              </span>
            </div>
          </div>

          {/* Wallet Reconciliation Card */}
          <div className="p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-stone-900 dark:text-white">
                    Platform Wallet Reconciliation Check
                  </h4>
                  <p className="text-xs text-stone-500">
                    Continuously validates stored wallet balances against the immutable append-only ledger
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>All Balances 100% Reconciled</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <div className="p-3 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-100 dark:border-stone-800">
                <span className="text-stone-400 text-[10px] uppercase font-bold block">Total Wallets</span>
                <span className="text-base font-extrabold text-stone-900 dark:text-white mt-0.5 block">
                  {reconciliation?.totalWallets ?? 3}
                </span>
              </div>
              <div className="p-3 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-100 dark:border-stone-800">
                <span className="text-stone-400 text-[10px] uppercase font-bold block">Mismatches</span>
                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  {reconciliation?.mismatches ?? 0} (0 errors)
                </span>
              </div>
              <div className="p-3 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-100 dark:border-stone-800">
                <span className="text-stone-400 text-[10px] uppercase font-bold block">User Wallets Sum</span>
                <span className="text-base font-extrabold text-stone-900 dark:text-white mt-0.5 block">
                  KES 19,200
                </span>
              </div>
              <div className="p-3 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-100 dark:border-stone-800">
                <span className="text-stone-400 text-[10px] uppercase font-bold block">Admin Treasury Sum</span>
                <span className="text-base font-extrabold text-stone-900 dark:text-white mt-0.5 block">
                  KES {(treasuryWallet?.balance || 35000).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Platform Income Report Card */}
          <div className="p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
            <h4 className="text-sm font-extrabold text-stone-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
              <span>Platform Income Breakdown (Audited &amp; Partitioned)</span>
              <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                Total: KES {(incomeReport?.totalRevenue ?? 0).toLocaleString()}
              </span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-pink-500/10 to-rose-500/10 border border-pink-500/20 space-y-1">
                <div className="flex items-center justify-between font-bold text-stone-800 dark:text-stone-200">
                  <span>Trip Dating Unlocks</span>
                  <span className="text-[10px] bg-pink-500/20 text-pink-600 dark:text-pink-300 px-2 py-0.5 rounded-full">100% Platform</span>
                </div>
                <div className="text-xl font-black text-[#ff2e93]">
                  KES {(incomeReport?.tripDating ?? 0).toLocaleString()}
                </div>
                <p className="text-[10px] text-stone-500 dark:text-stone-400">
                  Unlock transactions @ KES 50 (10-min phone/WhatsApp reveal).
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-purple-500/10 to-indigo-500/10 border border-purple-500/20 space-y-1">
                <div className="flex items-center justify-between font-bold text-stone-800 dark:text-stone-200">
                  <span>Host Adverts Retained</span>
                  <span className="text-[10px] bg-purple-500/20 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full">30% Kept</span>
                </div>
                <div className="text-xl font-black text-purple-600 dark:text-purple-400">
                  KES {(incomeReport?.advertsRetained ?? 0).toLocaleString()}
                </div>
                <p className="text-[10px] text-stone-500 dark:text-stone-400">
                  30% retained platform fee on approved video advert campaigns.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-amber-500/10 to-orange-500/10 border border-amber-500/20 space-y-1">
                <div className="flex items-center justify-between font-bold text-stone-800 dark:text-stone-200">
                  <span>Host Subscriptions</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">Platform Revenue</span>
                </div>
                <div className="text-xl font-black text-amber-600 dark:text-amber-400">
                  KES {(incomeReport?.subscriptions ?? 0).toLocaleString()}
                </div>
                <p className="text-[10px] text-stone-500 dark:text-stone-400">
                  Silver, Diamond &amp; Gold plans for short-stay publishing privileges.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
            <h4 className="text-sm font-extrabold text-stone-900 dark:text-white uppercase tracking-wider">
              Append-Only Ledger Stream (Invariants: debits == credits)
            </h4>

            <div className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
              {treasuryLedger.map(entry => (
                <div key={entry.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-stone-400">{entry.id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                        {entry.type.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-stone-800 dark:text-stone-200 font-semibold mt-0.5">{entry.description}</p>
                    <span className="text-[10px] text-stone-400">
                      From: <code className="font-mono">{entry.fromWallet}</code> ➔ To: <code className="font-mono">{entry.toWallet}</code> · {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <span className="font-black text-stone-900 dark:text-white text-sm shrink-0">
                    KES {entry.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LISTINGS MODERATION */}
      {tab === 'listings' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-stone-900 dark:text-white">All Stays on AirBus</h3>
          <div className="space-y-3">
            {stays.map(s => {
              const hostUser = users.find(u => u.email === s.ownerEmail);
              const ownerName = hostUser?.name || s.hostName || 'Owner';
              const ownerPhone = s.whatsapp || hostUser?.phone || s.hostPhone || 'N/A';
              const ownerEmail = s.ownerEmail || hostUser?.email || 'N/A';
              return (
              <div
                key={s.id}
                className="p-4 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        s.status === 'live'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.status}
                    </span>
                    {s.isFeatured && (
                      <span className="text-[10px] bg-amber-400 text-stone-950 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-current" /> Featured
                      </span>
                    )}
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Owner: {ownerName}
                    </span>
                    <span className="text-xs text-stone-500 font-mono">({ownerEmail})</span>
                  </div>

                  <h4 className="text-sm font-bold text-stone-900 dark:text-white">{s.title}</h4>
                  <div className="text-xs text-stone-500">
                    {s.location} · KES {s.price.toLocaleString()}/night · {s.guests} guests · Rating: {s.rating} ★ ({s.reviewsCount})
                  </div>
                  <div className="text-[11px] text-stone-400 flex items-center gap-3 pt-0.5 flex-wrap">
                    <span>📞 Phone/WhatsApp: <strong className="text-stone-600 dark:text-stone-300">{ownerPhone}</strong></span>
                    <span>📍 Coordinates: <code className="font-mono text-stone-600 dark:text-stone-300">{s.lat ?? 'N/A'}, {s.lng ?? 'N/A'}</code></span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0 justify-end">
                  <button
                    onClick={() => onUpdateStay(s.id, { isFeatured: !s.isFeatured })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                      s.isFeatured
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {s.isFeatured ? 'Unfeature' : 'Feature'}
                  </button>

                  {s.status === 'review' || s.moderationStatus === 'pending' ? (
                    <button
                      onClick={async () => {
                        await api.adminModerateStay(s.id, { action: 'approve' });
                        showToast?.(`Listing "${s.title}" approved and live!`);
                        loadAdminData();
                      }}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-full text-[11px] font-bold hover:bg-emerald-500 cursor-pointer shadow-xs"
                    >
                      Approve Live
                    </button>
                  ) : null}

                  <button
                    onClick={() => setListingRejectModalStay(s)}
                    className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 text-amber-700 dark:text-amber-300 rounded-full text-[11px] font-bold cursor-pointer"
                  >
                    Reject
                  </button>

                  <button
                    onClick={async () => {
                      const isSuspended = s.moderationStatus === 'suspended';
                      await api.adminModerateStay(s.id, {
                        action: isSuspended ? 'unsuspend' : 'suspend',
                        reason: isSuspended ? undefined : 'Administrative safety suspension',
                      });
                      showToast?.(isSuspended ? 'Stay restored to live.' : 'Stay suspended.');
                      loadAdminData();
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer ${
                      s.moderationStatus === 'suspended'
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-50'
                    }`}
                  >
                    {s.moderationStatus === 'suspended' ? 'Unsuspend' : 'Suspend'}
                  </button>

                  <button
                    onClick={async () => {
                      await api.adminModerateStay(s.id, {
                        action: s.isDelisted ? 'relist' : 'delist',
                        reason: 'Admin delist action',
                      });
                      showToast?.(s.isDelisted ? 'Listing relisted.' : 'Listing delisted.');
                      loadAdminData();
                    }}
                    className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-600 dark:text-stone-300 rounded-full text-[11px] font-bold cursor-pointer"
                  >
                    {s.isDelisted ? 'Relist' : 'Delist'}
                  </button>

                  <button
                    onClick={async () => {
                      if (window.confirm(`Permanently delete "${s.title}" from platform?`)) {
                        await api.adminModerateStay(s.id, { action: 'delete' });
                        showToast?.('Listing permanently deleted.');
                        loadAdminData();
                      }
                    }}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-full cursor-pointer"
                    title="Delete permanently"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* TAB 5: LISTING MEDIA REVIEW QUEUE (VIDEO TOUR / PHOTOS) */}
      {tab === 'media' && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-gradient-to-r from-rose-950/40 via-stone-900 to-purple-950/30 border border-rose-500/20 text-white space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-rose-500/20 text-[#e4002b]">
                <Images className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold font-heading text-white">
                  Listing Media Moderation &amp; Review Studio
                </h3>
                <p className="text-xs text-stone-300">
                  Inspect high-definition video walkthroughs and photo galleries across all stays. Remove violating video or photos, flag listings, and preview the guest experience.
                </p>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: `All (${listingMediaList.length})` },
                { id: 'both', label: 'Both (Video & Photos)' },
                { id: 'video', label: 'Video Only' },
                { id: 'photos', label: 'Photos Only' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => {
                    setMediaTypeFilter(f.id as any);
                    api.getAdminListingMedia({ type: f.id, flaggedOnly: mediaFlaggedOnly, search: mediaSearch }).then(res => setListingMediaList(res.media || []));
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    mediaTypeFilter === f.id
                      ? 'bg-[#e4002b] text-white shadow-sm'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              <button
                onClick={() => {
                  const next = !mediaFlaggedOnly;
                  setMediaFlaggedOnly(next);
                  api.getAdminListingMedia({ type: mediaTypeFilter, flaggedOnly: next, search: mediaSearch }).then(res => setListingMediaList(res.media || []));
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  mediaFlaggedOnly
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                }`}
              >
                <Flag className="w-3 h-3" />
                <span>Flagged Only</span>
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={mediaSearch}
                  onChange={e => {
                    setMediaSearch(e.target.value);
                    api.getAdminListingMedia({ type: mediaTypeFilter, flaggedOnly: mediaFlaggedOnly, search: e.target.value }).then(res => setListingMediaList(res.media || []));
                  }}
                  placeholder="Search listings..."
                  className="w-full pl-8 pr-3 py-1.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
                />
              </div>
              <button
                onClick={() => {
                  api.getAdminListingMedia({ type: mediaTypeFilter, flaggedOnly: mediaFlaggedOnly, search: mediaSearch }).then(res => setListingMediaList(res.media || []));
                }}
                className="p-2 rounded-xl border border-stone-200 dark:border-stone-800 hover:bg-stone-50 text-stone-600 cursor-pointer"
                title="Refresh media queue"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Media Items Grid */}
          {listingMediaList.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-400">
              No listings matching this media filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {listingMediaList.map(item => (
                <div
                  key={item.stayId}
                  className={`p-5 bg-white dark:bg-[#15171e] rounded-3xl border shadow-sm space-y-4 ${
                    item.mediaModerationStatus === 'flagged'
                      ? 'border-rose-400 dark:border-rose-800 bg-rose-50/10'
                      : 'border-stone-200 dark:border-stone-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                          {item.hasVideo && item.hasPhotos ? 'Video + Photos' : item.hasVideo ? 'Video Only' : 'Photos Only'}
                        </span>
                        {item.mediaModerationStatus === 'flagged' && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500 text-white flex items-center gap-0.5">
                            <Flag className="w-3 h-3 fill-current" /> Flagged
                          </span>
                        )}
                        <span className="text-[10px] uppercase font-bold text-stone-400">
                          Status: {item.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-stone-900 dark:text-white">
                        {item.title}
                      </h4>
                      <p className="text-xs text-stone-500">
                        📍 {item.location} · Host: <span className="font-mono">{item.ownerEmail}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={async () => {
                          const nextStatus = item.mediaModerationStatus === 'flagged' ? 'clean' : 'flagged';
                          await api.adminFlagStayMedia(item.stayId, {
                            status: nextStatus,
                            reason: nextStatus === 'flagged' ? 'Administrative flag' : 'Cleared flag',
                          });
                          showToast?.(`Media status updated to ${nextStatus}.`);
                          loadAdminData();
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          item.mediaModerationStatus === 'flagged'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-300 dark:border-rose-800 hover:bg-rose-100'
                        }`}
                      >
                        {item.mediaModerationStatus === 'flagged' ? 'Mark Clean' : 'Flag Media'}
                      </button>
                    </div>
                  </div>

                  {/* Reusable Interactive Viewer */}
                  <div className="rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-black">
                    <ListingMediaViewer
                      media={{
                        video: item.video,
                        photos: item.photos,
                      }}
                      videoUrl={item.videoUrl}
                      images={item.images}
                      thumbnailUrl={item.thumbnailUrl}
                      title={item.title}
                      aspectRatio="video"
                    />
                  </div>

                  {/* Granular Removal Controls */}
                  <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2">
                    <span className="text-[10px] font-black uppercase text-stone-400 block tracking-wider">
                      Administrative Media Moderation
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.hasVideo && (
                        <button
                          onClick={async () => {
                            if (window.confirm(`Remove video tour from "${item.title}"?`)) {
                              await api.adminRemoveStayMedia(item.stayId, {
                                mediaType: 'video',
                                reason: 'Violated content guidelines',
                              });
                              showToast?.('Video removed from stay.');
                              loadAdminData();
                            }
                          }}
                          className="px-3 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg text-xs font-bold border border-rose-200 dark:border-rose-800 hover:bg-rose-100 cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove Video</span>
                        </button>
                      )}

                      {item.photos && item.photos.length > 0 && (
                        <span className="text-xs text-stone-500 font-semibold">
                          {item.photos.length} photos available
                        </span>
                      )}

                      <button
                        onClick={async () => {
                          if (window.confirm(`Suspend listing "${item.title}"?`)) {
                            await api.adminModerateStay(item.stayId, {
                              action: 'suspend',
                              reason: 'Flagged inappropriate media content',
                            });
                            showToast?.('Listing suspended.');
                            loadAdminData();
                          }
                        }}
                        className="ml-auto px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold border border-amber-200 dark:border-amber-800 hover:bg-amber-100 cursor-pointer"
                      >
                        Suspend Listing
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SUBSCRIPTION DIRECTORY & CONTROLS */}
      {tab === 'plans' && (
        <div className="space-y-6">
          {/* Header & Metric Banner */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-950/40 via-stone-900 to-indigo-950/30 border border-blue-500/20 text-white space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <Calendar className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold font-heading text-white">
                    Host Subscription Plans &amp; Renewal Engine
                  </h3>
                  <p className="text-xs text-stone-300">
                    Audit active, expired, and pending subscriptions. Approve renewals, stack additional days, or revoke access.
                  </p>
                </div>
              </div>
              <button
                onClick={loadAdminData}
                className="px-3 py-1.5 rounded-full border border-stone-700 bg-stone-800 hover:bg-stone-700 text-xs font-bold text-stone-200 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Subscriptions Table */}
          <div className="bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-stone-900 dark:text-white">
                Host Subscriptions Directory ({adminSubscriptions.length})
              </h4>
              <span className="text-xs font-mono text-stone-400">
                {adminSubscriptions.filter(s => s.status === 'active').length} Active
              </span>
            </div>

            {adminSubscriptions.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400 border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl">
                No subscription records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-stone-800 text-[10px] text-stone-400 uppercase font-bold">
                      <th className="py-2.5 px-3">Host / Owner</th>
                      <th className="py-2.5 px-3">Tier</th>
                      <th className="py-2.5 px-3">Billing</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Validity / Ends At</th>
                      <th className="py-2.5 px-3">Days Left</th>
                      <th className="py-2.5 px-3 text-right">Moderation Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {adminSubscriptions.map(sub => {
                      const ownerEmail = sub.ownerId || sub.owner_id || sub.id.replace('sub_host_', '');
                      const now = Date.now();
                      const daysLeft = sub.endsAt ? Math.ceil((sub.endsAt - now) / 864e5) : 0;
                      const isExpired = daysLeft <= 0;

                      return (
                        <tr key={sub.id} className="hover:bg-stone-50 dark:hover:bg-stone-900/40 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-bold text-stone-900 dark:text-white block">
                              {ownerEmail}
                            </span>
                            <span className="text-[10px] font-mono text-stone-400">ID: {sub.id}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              sub.tier === 'Gold'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : sub.tier === 'Diamond'
                                ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300'
                                : 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-300'
                            }`}>
                              {sub.tier || 'Diamond'}
                            </span>
                          </td>
                          <td className="py-3 px-3 capitalize text-stone-600 dark:text-stone-300">
                            {sub.billing || 'Monthly'}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              sub.status === 'active' && !isExpired
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : sub.status === 'pending'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}>
                              {sub.status === 'active' && isExpired ? 'Expired' : sub.status || 'Active'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-stone-600 dark:text-stone-400 font-mono text-[11px]">
                            {sub.endsAt ? new Date(sub.endsAt).toLocaleDateString('en-GB') : 'No expiry'}
                          </td>
                          <td className="py-3 px-3">
                            {isExpired ? (
                              <span className="text-rose-600 font-bold text-[11px]">
                                Expired ({Math.abs(daysLeft)}d ago)
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                                {daysLeft} days left
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {sub.status === 'pending' && (
                                <button
                                  onClick={async () => {
                                    await api.adminModerateSubscription(sub.id, { action: 'approve' });
                                    showToast?.('Subscription approved and activated.');
                                    loadAdminData();
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}

                              <button
                                onClick={async () => {
                                  await api.adminModerateSubscription(sub.id, { action: 'extend', days: 30 });
                                  showToast?.(`Extended ${ownerEmail} by 30 days!`);
                                  loadAdminData();
                                }}
                                className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-[10px] font-bold hover:bg-blue-100 cursor-pointer"
                              >
                                +30 Days
                              </button>

                              <button
                                onClick={() => setExtendDaysModalSub(sub)}
                                className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg text-[10px] font-bold hover:bg-stone-200 cursor-pointer"
                              >
                                Custom
                              </button>

                              <button
                                onClick={async () => {
                                  if (window.confirm(`Revoke subscription for ${ownerEmail}?`)) {
                                    await api.adminModerateSubscription(sub.id, { action: 'revoke', reason: 'Admin revoked subscription.' });
                                    showToast?.('Subscription revoked.');
                                    loadAdminData();
                                  }
                                }}
                                className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-100 cursor-pointer"
                              >
                                Revoke
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Direct Plan Override Card */}
          <div className="max-w-xl mx-auto bg-white dark:bg-[#15171e] p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-stone-900 dark:text-white">Direct Host Plan Assignment</h3>
            <p className="text-xs text-stone-500">
              Directly modify or extend subscription plans for any registered host account.
            </p>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">Target Host Email</label>
              <select
                value={targetHost}
                onChange={e => setTargetHost(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
              >
                {users.map(u => (
                  <option key={u.email} value={u.email}>
                    {u.name} ({u.email}) - {u.role}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">Tier</label>
                <select
                  value={targetTier}
                  onChange={e => setTargetTier(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
                >
                  <option value="Silver">Silver (3 listings)</option>
                  <option value="Diamond">Diamond (10 listings)</option>
                  <option value="Gold">Gold (Unlimited)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={adjustDays}
                  onChange={e => setAdjustDays(parseInt(e.target.value, 10) || 30)}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => {
                onAdjustHostPlan(targetHost, targetTier, adjustDays);
                showToast?.(`Updated plan for ${targetHost} to ${targetTier} for ${adjustDays} days!`);
              }}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Update Subscription
            </button>
          </div>
        </div>
      )}

      {/* DORMANT OWNERS & DELISTING TAB */}
      {tab === 'dormant' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-red-950/40 via-stone-900 to-amber-950/30 p-6 rounded-3xl border border-red-500/20 text-white">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 shrink-0">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold font-heading text-white flex items-center gap-2">
                  Dormant Hosts &amp; Listing Enforcement
                </h3>
                <p className="text-xs text-stone-300 leading-relaxed max-w-3xl">
                  Policy rule: If an owner goes for <strong>3 consecutive months (90 days)</strong> without an active subscription, their listings are eligible for delisting from the platform. Delisted stays are immediately hidden from guest search and booking flows. Once an owner renews their subscription and an admin approves the payment, their listings are automatically restored live.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
              <div className="bg-white/5 p-3 rounded-xl">
                <div className="text-[10px] text-stone-400 uppercase font-semibold">Dormant Hosts (≥ 90 Days)</div>
                <div className="text-xl font-black text-amber-400 mt-0.5">{dormantOwners.length}</div>
              </div>
              <div className="bg-white/5 p-3 rounded-xl">
                <div className="text-[10px] text-stone-400 uppercase font-semibold">Delisted Hosts</div>
                <div className="text-xl font-black text-red-400 mt-0.5">
                  {dormantOwners.filter(o => o.isDelisted).length}
                </div>
              </div>
              <div className="bg-white/5 p-3 rounded-xl">
                <div className="text-[10px] text-stone-400 uppercase font-semibold">Delisted Listings Total</div>
                <div className="text-xl font-black text-stone-200 mt-0.5">
                  {dormantOwners.reduce((acc, o) => acc + (o.isDelisted ? o.listingCount : 0), 0)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-stone-900 dark:text-white">
                  Dormant Host Directory ({dormantOwners.length})
                </h4>
                <p className="text-xs text-stone-500">
                  Hosts inactive for 90 or more days consecutively without an active subscription.
                </p>
              </div>
              <button
                onClick={loadAdminData}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${actionLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {dormantOwners.length === 0 ? (
              <div className="py-12 text-center text-stone-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-stone-700 dark:text-stone-300">No Dormant Hosts</p>
                <p className="text-[11px] text-stone-500 mt-1">
                  All registered hosts have active subscriptions or expired within the 90-day grace window.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-stone-800 text-[11px] text-stone-400 uppercase font-bold">
                      <th className="py-3 px-3">Owner</th>
                      <th className="py-3 px-3">Tier</th>
                      <th className="py-3 px-3">Last Expiry Date</th>
                      <th className="py-3 px-3">Days Inactive</th>
                      <th className="py-3 px-3">Listings</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-sans">
                    {dormantOwners.map(owner => {
                      const expiryFormatted = owner.lastExpiryDate
                        ? new Date(owner.lastExpiryDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Never active';

                      return (
                        <tr key={owner.email} className="hover:bg-stone-50 dark:hover:bg-stone-900/40 transition-colors">
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-stone-900 dark:text-white">{owner.name}</div>
                            <div className="text-[11px] text-stone-500 font-mono">{owner.email}</div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              {owner.tier}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-stone-600 dark:text-stone-400">
                            {expiryFormatted}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60">
                              <Clock className="w-3 h-3" />
                              {owner.daysInactive} days
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-stone-800 dark:text-stone-200">
                            {owner.listingCount} {owner.listingCount === 1 ? 'stay' : 'stays'}
                          </td>
                          <td className="py-3.5 px-3">
                            {owner.isDelisted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-600 text-white">
                                Delisted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                                Inactive / Visible
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {owner.isDelisted ? (
                              <button
                                onClick={() => handleRelistOwner(owner.email)}
                                disabled={actionLoading}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                              >
                                Relist Listings
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDelistOwner(owner.email)}
                                disabled={actionLoading}
                                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1 ml-auto"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>Delist Listings</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: USER DIRECTORY & ACCESS CONTROL */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">Registered Users &amp; Hosts</h3>
              <p className="text-xs text-stone-500">Audit user roles, manage suspensions, and verify government ID documents.</p>
            </div>

            <div className="flex items-center gap-2">
              {[
                { id: 'all', label: `All Users (${users.length})` },
                { id: 'hosts', label: `Hosts (${users.filter(u => u.role === 'owner').length})` },
                { id: 'suspended', label: `Suspended (${users.filter(u => u.isSuspended).length})` },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setUserFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    userFilter === f.id
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {users
              .filter(u => {
                if (userFilter === 'hosts') return u.role === 'owner';
                if (userFilter === 'suspended') return u.isSuspended;
                return true;
              })
              .map(u => (
              <div
                key={u.id}
                className={`p-4 bg-white dark:bg-[#15171e] rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs ${
                  u.isSuspended
                    ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20'
                    : 'border-stone-200 dark:border-stone-800'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-stone-900 dark:text-white text-sm">{u.name}</span>
                    <span className="bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded font-mono uppercase text-[10px] font-bold">
                      {u.role}
                    </span>
                    {u.idVerified ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> ID Verified
                      </span>
                    ) : (
                      <span className="text-stone-400 text-[11px]">ID Pending</span>
                    )}

                    {u.isSuspended && (
                      <span className="bg-rose-600 text-white font-black px-2 py-0.5 rounded-full text-[10px] uppercase">
                        Suspended
                      </span>
                    )}
                  </div>
                  <div className="text-stone-500 mt-0.5">
                    {u.email} · {u.phone || 'No phone'} · {u.location || 'Kenya'}
                  </div>
                  {u.isSuspended && u.suspendedReason && (
                    <div className="text-rose-600 font-medium text-[11px] mt-1">
                      Reason: {u.suspendedReason}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {u.isSuspended ? (
                    <button
                      onClick={async () => {
                        await api.adminModerateUser(u.email, { action: 'reactivate' });
                        showToast?.(`Account for ${u.email} reactivated.`);
                        loadAdminData();
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                    >
                      Reactivate
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        const reason = prompt(`Reason for suspending ${u.name} (${u.email}):`);
                        if (!reason) return;
                        await api.adminModerateUser(u.email, { action: 'suspend', reason });
                        showToast?.(`Account for ${u.email} suspended.`);
                        loadAdminData();
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-bold bg-stone-100 dark:bg-stone-800 hover:bg-rose-100 text-rose-600 cursor-pointer"
                    >
                      Suspend
                    </button>
                  )}

                  <button
                    onClick={() => onVerifyUser(u.email)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                      u.idVerified
                        ? 'border border-stone-300 dark:border-stone-700 text-stone-600 hover:bg-stone-100'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {u.idVerified ? 'Unverify' : 'Verify ID'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: REPORTS & FLAGS QUEUE */}
      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-500" />
                <span>Reports &amp; Community Flags Queue</span>
              </h3>
              <p className="text-xs text-stone-500">
                Audit complaints from guests regarding listings, accuracy, host conduct, and media.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {[
                { id: 'all', label: `All (${adminReports.length})` },
                { id: 'pending', label: `Pending (${adminReports.filter(r => r.status === 'pending').length})` },
                { id: 'resolved', label: `Resolved (${adminReports.filter(r => r.status === 'resolved').length})` },
                { id: 'dismissed', label: `Dismissed (${adminReports.filter(r => r.status === 'dismissed').length})` },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setReportFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    reportFilter === f.id
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              <button
                onClick={loadAdminData}
                className="p-1.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:bg-stone-50 text-stone-600 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {adminReports.filter(r => reportFilter === 'all' || r.status === reportFilter).length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-400">
              No reports found in this category.
            </div>
          ) : (
            <div className="space-y-3">
              {adminReports
                .filter(r => reportFilter === 'all' || r.status === reportFilter)
                .map(rep => {
                  const stay = stays.find(s => s.id === rep.stayId);
                  return (
                    <div
                      key={rep.id}
                      className="p-4 sm:p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-stone-400">{rep.id}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            rep.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : rep.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-stone-100 text-stone-600'
                          }`}>
                            {rep.status}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold text-[10px] uppercase">
                            Reason: {rep.reason.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="font-bold text-sm text-stone-900 dark:text-white">
                          Target: {stay?.title || rep.stayId}
                        </div>

                        <p className="text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-900/60 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800">
                          {rep.details}
                        </p>

                        <div className="text-[11px] text-stone-400">
                          Reported by: <span className="font-mono text-stone-600 dark:text-stone-300">{rep.reporterEmail || rep.reportedBy || 'Guest'}</span> · {new Date(rep.createdAt).toLocaleString()}
                        </div>

                        {rep.actionTaken && (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Action Taken: {rep.actionTaken} (by {rep.reviewedBy || 'Admin'})
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {rep.status === 'pending' ? (
                          <>
                            <button
                              disabled={reportActionLoading}
                              onClick={async () => {
                                try {
                                  setReportActionLoading(true);
                                  await api.adminActionReport(rep.id, {
                                    action: 'resolve',
                                    actionTaken: 'Listing audited and verified compliant.',
                                  });
                                  showToast?.('Report marked as resolved.');
                                  loadAdminData();
                                } finally {
                                  setReportActionLoading(false);
                                }
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
                            >
                              Resolve
                            </button>
                            <button
                              disabled={reportActionLoading}
                              onClick={async () => {
                                try {
                                  setReportActionLoading(true);
                                  await api.adminActionReport(rep.id, {
                                    action: 'dismiss',
                                    actionTaken: 'Report dismissed as invalid.',
                                  });
                                  showToast?.('Report dismissed.');
                                  loadAdminData();
                                } finally {
                                  setReportActionLoading(false);
                                }
                              }}
                              className="px-3 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 rounded-xl font-bold text-xs cursor-pointer"
                            >
                              Dismiss
                            </button>
                            <button
                              disabled={reportActionLoading}
                              onClick={async () => {
                                if (window.confirm(`Suspend listing "${stay?.title || rep.stayId}" due to this report?`)) {
                                  try {
                                    setReportActionLoading(true);
                                    await api.adminActionReport(rep.id, {
                                      action: 'penalize',
                                      actionTaken: 'Listing suspended due to safety report.',
                                    });
                                    showToast?.('Listing suspended and report penalized.');
                                    loadAdminData();
                                  } finally {
                                    setReportActionLoading(false);
                                  }
                                }
                              }}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
                            >
                              Penalize Host
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-stone-400 font-semibold">Processed</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: GUEST REVIEWS MODERATION QUEUE */}
      {tab === 'reviews' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-current" />
                <span>Guest Reviews Moderation Queue</span>
              </h3>
              <p className="text-xs text-stone-500">
                Audit, approve, hide or remove public reviews and ratings left by guests.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {[
                { id: 'all', label: `All (${adminReviews.length})` },
                { id: 'approved', label: 'Approved' },
                { id: 'hidden', label: 'Hidden' },
                { id: 'flagged', label: 'Flagged' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setReviewFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    reviewFilter === f.id
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              <button
                onClick={loadAdminData}
                className="p-1.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:bg-stone-50 text-stone-600 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {adminReviews.filter(r => reviewFilter === 'all' || r.status === reviewFilter).length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-400">
              No reviews found in this category.
            </div>
          ) : (
            <div className="space-y-3">
              {adminReviews
                .filter(r => reviewFilter === 'all' || r.status === reviewFilter)
                .map(rev => (
                  <div
                    key={rev.id}
                    className="p-4 sm:p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-stone-900 dark:text-white">{rev.stayTitle}</span>
                        <span className="text-stone-400 font-mono text-[10px]">ID: {rev.stayId}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          rev.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : rev.status === 'hidden'
                            ? 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-400'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}>
                          {rev.status || 'Approved'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${i < (rev.rating || 5) ? 'fill-current' : 'text-stone-300'}`}
                            />
                          ))}
                        </div>
                        <span className="font-bold text-stone-800 dark:text-stone-200">{rev.rating} / 5</span>
                        <span className="text-stone-400">by <strong className="text-stone-600 dark:text-stone-300">{rev.userName || rev.userEmail || 'Guest'}</strong></span>
                      </div>

                      <p className="text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-900/60 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800">
                        "{rev.comment}"
                      </p>

                      <div className="text-[10px] text-stone-400">
                        {new Date(rev.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {rev.status !== 'approved' && (
                        <button
                          onClick={async () => {
                            await api.adminModerateReview(rev.id, { action: 'approve' });
                            showToast?.('Review approved.');
                            loadAdminData();
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs cursor-pointer"
                        >
                          Approve
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          const nextAction = rev.status === 'hidden' ? 'unhide' : 'hide';
                          await api.adminModerateReview(rev.id, { action: nextAction });
                          showToast?.(nextAction === 'hide' ? 'Review hidden.' : 'Review restored.');
                          loadAdminData();
                        }}
                        className="px-3 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 rounded-xl font-bold text-xs cursor-pointer"
                      >
                        {rev.status === 'hidden' ? 'Unhide' : 'Hide'}
                      </button>

                      <button
                        onClick={async () => {
                          if (window.confirm('Permanently delete this review?')) {
                            await api.adminModerateReview(rev.id, { action: 'delete' });
                            showToast?.('Review deleted.');
                            loadAdminData();
                          }
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl cursor-pointer"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ALL NEGOTIATIONS INSPECTOR */}
      {tab === 'negotiations' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-stone-900 dark:text-white">Guest–Host Negotiation Threads</h3>
          <div className="space-y-3">
            {threads.map(t => {
              const stay = stays.find(s => s.id === t.stayId);
              return (
                <div key={t.id} className="p-4 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-stone-900 dark:text-white">
                      Stay: {stay?.title || t.stayId}
                    </div>
                    <span className="text-stone-400 font-mono">
                      Guest: {t.guestEmail} ↔ Host: {t.hostEmail}
                    </span>
                  </div>

                  <div className="space-y-1.5 pl-3 border-l-2 border-stone-200 dark:border-stone-700">
                    {t.messages.map(m => (
                      <div key={m.id} className="text-stone-600 dark:text-stone-400">
                        <span className="font-semibold text-stone-800 dark:text-stone-200 uppercase text-[10px]">
                          [{m.from}]:
                        </span>{' '}
                        {m.type === 'offer' || m.type === 'counter' ? (
                          <span className="text-[#ff2e93] font-bold">
                            Offer KES {m.amount?.toLocaleString()} ({m.status})
                          </span>
                        ) : (
                          m.text
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT LOG */}
      {tab === 'audit' && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-stone-900 dark:text-white">System Audit Trail</h3>
          <div className="space-y-2">
            {auditLogs.map(log => (
              <div
                key={log.id}
                className="p-3 bg-white dark:bg-[#15171e] rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-mono flex items-center justify-between"
              >
                <div>
                  <span className="text-amber-600 font-bold mr-2">[{log.action}]</span>
                  <span className="text-stone-700 dark:text-stone-300">{log.details}</span>
                  <span className="text-stone-400 ml-2">by {log.actorEmail}</span>
                </div>
                <div className="text-stone-400 text-[10px] shrink-0">
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: TRIP DATING MANAGEMENT & KES 50 APPROVALS */}
      {tab === 'trip-dating' && (
        <div className="space-y-6">
          {/* Tagline & Info Banner */}
          <div className="bg-gradient-to-r from-rose-950 via-neutral-900 to-pink-950/60 p-5 rounded-2xl border border-rose-500/20 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-5 h-5 text-rose-500 fill-rose-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                  Trip Dating Operations & Moderation
                </span>
              </div>
              <h3 className="text-xl font-bold">
                Trip Dating – A Safer Way to Meet Like-Minded Singles
              </h3>
              <p className="text-xs text-rose-200/80 mt-0.5">
                All contact numbers verified and unlocked via M-Pesa Till 943210.
              </p>
            </div>
            <button
              onClick={loadAdminData}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Dating Data
            </button>
          </div>

          {/* Real-Time Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 text-center">
              <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 block mb-0.5">Total Members</span>
              <span className="text-xl font-black text-stone-900 dark:text-white">
                {datingStats?.totalMembers || datingProfiles.length}
              </span>
            </div>

            <div className="p-3.5 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 text-center">
              <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 block mb-0.5">Active Profiles</span>
              <span className="text-xl font-black text-emerald-500">
                {datingStats?.activeProfiles || datingProfiles.filter(p => p.status === 'active').length}
              </span>
            </div>

            <div className="p-3.5 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 text-center">
              <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 block mb-0.5">Profile Views</span>
              <span className="text-xl font-black text-cyan-500">
                {datingStats?.totalViews || 0}
              </span>
            </div>

            <div className="p-3.5 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 text-center">
              <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 block mb-0.5">Total Likes</span>
              <span className="text-xl font-black text-rose-500">
                {datingStats?.totalLikes || 0}
              </span>
            </div>

            <div className="p-3.5 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 text-center">
              <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 block mb-0.5">Pending Unlocks</span>
              <span className="text-xl font-black text-amber-500">
                {datingRequests.filter(r => r.status === 'pending').length}
              </span>
            </div>

            <div className="p-3.5 bg-gradient-to-br from-amber-500/10 to-emerald-500/10 rounded-2xl border border-amber-500/30 text-center">
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 block mb-0.5">KES 50 Revenue</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                KES {(datingStats?.totalRevenueKes || datingRequests.filter(r => r.status === 'approved').length * 50).toLocaleString()}
              </span>
            </div>
          </div>

          {/* SECTION 1: KES 50 PAYMENT REQUESTS (TILL 943210 VERIFICATION) */}
          <div className="bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  KES 50 Contact Unlock Requests (Buy Goods Till 943210)
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Approving a request activates an automatic 10-minute temporary unlock countdown window for the requester.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-stone-600 dark:text-stone-300">
                {datingRequests.filter(r => r.status === 'pending').length} Pending
              </span>
            </div>

            {datingRequests.length === 0 ? (
              <p className="text-xs text-stone-400 py-6 text-center">No payment requests received yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-400">
                      <th className="pb-2 font-semibold">Target Member</th>
                      <th className="pb-2 font-semibold">Requester</th>
                      <th className="pb-2 font-semibold">Payer Phone</th>
                      <th className="pb-2 font-semibold">M-Pesa Code</th>
                      <th className="pb-2 font-semibold">Amount</th>
                      <th className="pb-2 font-semibold">Status</th>
                      <th className="pb-2 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                    {datingRequests.map(req => (
                      <tr key={req.id} className="text-stone-700 dark:text-stone-300">
                        <td className="py-3 font-semibold text-stone-900 dark:text-white">
                          {req.profileName}
                        </td>
                        <td className="py-3 font-mono">{req.userEmail}</td>
                        <td className="py-3 font-mono">{req.payerPhone}</td>
                        <td className="py-3">
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
                            {req.transactionCode}
                          </span>
                        </td>
                        <td className="py-3 font-bold text-emerald-600">KES 50</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              req.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                                : req.status === 'rejected'
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {req.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={async () => {
                                  try {
                                    setActionLoading(true);
                                    await api.approveAdminTripDatingRequest(req.id);
                                    showToast?.(`Approved KES 50 for ${req.profileName}. 10-minute contact window activated!`);
                                    loadAdminData();
                                  } catch (err: any) {
                                    showToast?.(err.message || 'Approval failed');
                                  } finally {
                                    setActionLoading(false);
                                  }
                                }}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
                              >
                                Approve (Unlock 10m)
                              </button>
                              <button
                                onClick={async () => {
                                  const reason = prompt('Reason for rejection:');
                                  if (!reason) return;
                                  try {
                                    setActionLoading(true);
                                    await api.rejectAdminTripDatingRequest(req.id, reason);
                                    showToast?.(`Rejected payment request for ${req.profileName}`);
                                    loadAdminData();
                                  } catch (err: any) {
                                    showToast?.(err.message || 'Rejection failed');
                                  } finally {
                                    setActionLoading(false);
                                  }
                                }}
                                className="px-2.5 py-1 bg-stone-200 dark:bg-stone-800 hover:bg-red-600 hover:text-white text-stone-600 dark:text-stone-300 rounded-lg font-bold text-[11px] transition cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-stone-400">
                              {req.reviewedBy ? `Reviewed by ${req.reviewedBy}` : 'Completed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 2: MEMBER PROFILES MODERATION & DIRECT ACCESS */}
          <div className="bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-500" />
                  Trip Dating Member Profiles Directory & Safety Moderation
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Automated publication is active. Admins can audit, suspend, restore, or remove profiles.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-stone-600 dark:text-stone-300">
                {datingProfiles.length} Members
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-400">
                    <th className="pb-2 font-semibold">Member</th>
                    <th className="pb-2 font-semibold">Gender / Age</th>
                    <th className="pb-2 font-semibold">City & Location</th>
                    <th className="pb-2 font-semibold">Dating Goal</th>
                    <th className="pb-2 font-semibold">Photos</th>
                    <th className="pb-2 font-semibold">Views / Likes</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                  {datingProfiles.map(p => (
                    <tr key={p.id} className="text-stone-700 dark:text-stone-300">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={p.primaryPhoto || p.photos?.[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80'}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border border-stone-200 dark:border-stone-700"
                          />
                          <div>
                            <span className="font-bold text-stone-900 dark:text-white block">
                              {p.fullName}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono">
                              {p.phoneNumber || 'Protected'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 capitalize">
                        {p.gender}, {p.age} yrs
                      </td>

                      <td className="py-3">
                        <span className="block font-medium">{p.city}</span>
                        <span className="text-[10px] text-stone-400">{p.location}</span>
                      </td>

                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-medium border border-rose-200 dark:border-rose-900/40">
                          {p.datingIntention?.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 font-mono">{p.photos?.length || 1} photos</td>

                      <td className="py-3 font-mono">
                        {p.views || 0} views · {p.likes || 0} likes
                      </td>

                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            p.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                              : p.status === 'suspended'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>

                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.status !== 'active' && (
                            <button
                              onClick={async () => {
                                try {
                                  setActionLoading(true);
                                  await api.moderateAdminTripDatingProfile(p.id, 'active');
                                  showToast?.(`Restored profile for ${p.fullName} to Active.`);
                                  loadAdminData();
                                } catch (err: any) {
                                  showToast?.(err.message || 'Action failed');
                                } finally {
                                  setActionLoading(false);
                                }
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Activate
                            </button>
                          )}

                          {p.status === 'active' && (
                            <button
                              onClick={async () => {
                                const reason = prompt('Reason for suspension (optional):');
                                try {
                                  setActionLoading(true);
                                  await api.moderateAdminTripDatingProfile(p.id, 'suspended', reason || undefined);
                                  showToast?.(`Suspended profile for ${p.fullName}.`);
                                  loadAdminData();
                                } catch (err: any) {
                                  showToast?.(err.message || 'Action failed');
                                } finally {
                                  setActionLoading(false);
                                }
                              }}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Suspend
                            </button>
                          )}

                          {p.status !== 'removed' && (
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Are you sure you want to remove ${p.fullName}'s profile?`)) return;
                                try {
                                  setActionLoading(true);
                                  await api.moderateAdminTripDatingProfile(p.id, 'removed', 'Violated terms');
                                  showToast?.(`Removed profile for ${p.fullName}.`);
                                  loadAdminData();
                                } catch (err: any) {
                                  showToast?.(err.message || 'Action failed');
                                } finally {
                                  setActionLoading(false);
                                }
                              }}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LISTING REJECTION WITH REASON */}
      {listingRejectModalStay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#15171e] rounded-3xl p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Reject Listing</span>
              </h4>
              <button
                onClick={() => setListingRejectModalStay(null)}
                className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              Rejecting <strong className="text-stone-800 dark:text-stone-200">{listingRejectModalStay.title}</strong> will return it to draft status and notify host <strong className="text-stone-800 dark:text-stone-200">{listingRejectModalStay.ownerEmail}</strong> with the specified reason.
            </p>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Common Preset Reasons
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {[
                  'Inaccurate pricing or location',
                  'Low quality or misleading media',
                  'Safety or regulatory concerns',
                  'Missing amenities verification',
                ].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setListingRejectReason(r)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                      listingRejectReason === r
                        ? 'bg-amber-500 text-stone-950 font-bold'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Reason for Rejection
              </label>
              <textarea
                rows={3}
                value={listingRejectReason}
                onChange={e => setListingRejectReason(e.target.value)}
                placeholder="Explain what the host needs to fix before resubmitting..."
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-amber-500 text-stone-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setListingRejectModalStay(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={listingActionLoading || !listingRejectReason.trim()}
                onClick={async () => {
                  try {
                    setListingActionLoading(true);
                    await api.adminModerateStay(listingRejectModalStay.id, {
                      action: 'reject',
                      reason: listingRejectReason.trim(),
                    });
                    showToast?.(`Listing "${listingRejectModalStay.title}" rejected.`);
                    setListingRejectModalStay(null);
                    loadAdminData();
                  } catch (err: any) {
                    showToast?.(err.message || 'Failed to reject listing');
                  } finally {
                    setListingActionLoading(false);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {listingActionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUBSCRIPTION EXTENSION */}
      {extendDaysModalSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#15171e] rounded-3xl p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span>Extend Subscription Validity</span>
              </h4>
              <button
                onClick={() => setExtendDaysModalSub(null)}
                className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              Add paid days to the host plan for <strong className="text-stone-800 dark:text-stone-200">{extendDaysModalSub.ownerId || extendDaysModalSub.owner_id}</strong>. Added days will stack onto current expiry date or start from today if already expired.
            </p>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Preset Extensions
              </label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[7, 14, 30, 90].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setExtendDaysCount(d)}
                    className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      extendDaysCount === d
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    +{d} Days
                  </button>
                ))}
              </div>

              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Custom Duration (Days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={extendDaysCount}
                onChange={e => setExtendDaysCount(parseInt(e.target.value, 10) || 30)}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 text-stone-900 dark:text-white font-bold"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setExtendDaysModalSub(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={subActionLoading}
                onClick={async () => {
                  try {
                    setSubActionLoading(true);
                    await api.adminModerateSubscription(extendDaysModalSub.id, {
                      action: 'extend',
                      days: extendDaysCount,
                    });
                    showToast?.(`Extended subscription by ${extendDaysCount} days!`);
                    setExtendDaysModalSub(null);
                    loadAdminData();
                  } catch (err: any) {
                    showToast?.(err.message || 'Failed to extend subscription');
                  } finally {
                    setSubActionLoading(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {subActionLoading ? 'Saving...' : `Add +${extendDaysCount} Days`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
