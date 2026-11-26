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
  PlusServiceRequest,
  LocalServiceProvider,
  TripDatingAdminCounts,
  AdminWalletEntry,
  WalletYearArchive,
  AdminWalletRollupBucket,
  AdminWalletPurpose,
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
  Crown,
  MapPin,
  Download,
  BarChart3,
  Archive,
  Video,
  Maximize2,
  Loader2,
} from 'lucide-react';
import { api } from '../api';
import { ListingMediaViewer } from './ListingMediaViewer';
import { SharedVideoPlayer } from './shared/SharedVideoPlayer';
import { formatEATDateTime } from '../utils/time';
import { MPESA_CONFIG, PaymentStatus, isDepositRecord } from '../shared/paymentConstants';

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
  onPaymentModerated?: () => Promise<void> | void;
  initialTab?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminUser,
  metrics = {
    totalStays: 0,
    liveStays: 0,
    pendingReviews: 0,
    totalUsers: 0,
    pendingPayments: 0,
    totalBookings: 0,
    volumeKes: 0,
  },
  stays = [],
  users = [],
  payments = [],
  threads = [],
  auditLogs = [],
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
  onPaymentModerated,
  initialTab,
}) => {
  const [tab, setTab] = useState<
    'queue' | 'review-queue' | 'wallets' | 'ads' | 'plans' | 'listings' | 'media' | 'users' | 'reports' | 'reviews' | 'audit' | 'posts' | 'withdrawals' | 'settings' | 'treasury' | 'dormant' | 'negotiations' | 'trip-dating' | 'plus-local'
  >(initialTab === 'treasury' ? 'treasury' : initialTab === 'review-queue' ? 'review-queue' : 'queue');

  useEffect(() => {
    if (initialTab === 'treasury') setTab('treasury');
    else if (initialTab === 'review-queue') setTab('review-queue');
  }, [initialTab]);

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

  // Dedicated Admin Review Queue State (Listings & Trip Dating oldest pending first)
  const [reviewQueue, setReviewQueue] = useState<{
    stays: Stay[];
    tripDating: TripDatingProfile[];
    counts: { stays: number; tripDating: number; total: number };
  }>({ stays: [], tripDating: [], counts: { stays: 0, tripDating: 0, total: 0 } });
  const [reviewSubTab, setReviewSubTab] = useState<'stays' | 'trip-dating'>('stays');
  const [reviewDeclineTarget, setReviewDeclineTarget] = useState<{
    kind: 'stay' | 'trip_dating';
    id: string;
    title: string;
  } | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewFeedbackError, setReviewFeedbackError] = useState<string | null>(null);
  const [reviewActionBusy, setReviewActionBusy] = useState(false);
  const [reviewQueueLoading, setReviewQueueLoading] = useState(false);
  const [reviewQueueError, setReviewQueueError] = useState<string | null>(null);
  const [reviewVideoModal, setReviewVideoModal] = useState<{
    title: string;
    videoUrl: string;
    poster?: string;
  } | null>(null);
  const [reviewPhotoLightbox, setReviewPhotoLightbox] = useState<{
    title: string;
    photos: string[];
    idx: number;
  } | null>(null);
  const [datingModalPrompt, setDatingModalPrompt] = useState<{
    kind: 'reject_request' | 'suspend_profile';
    id: string;
    label: string;
  } | null>(null);
  const [datingModalReason, setDatingModalReason] = useState('');

  // Adverts Moderation State
  const [adRejectModalId, setAdRejectModalId] = useState<string | null>(null);
  const [adRejectReason, setAdRejectReason] = useState('Inappropriate target URL or content.');

  // Queue View Filters
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'approved' | 'hidden' | 'flagged'>('all');
  const [userFilter, setUserFilter] = useState<'all' | 'guests' | 'hosts' | 'suspended'>('all');
  const [adminUsersList, setAdminUsersList] = useState<User[]>(users);
  const [adminUsersCounts, setAdminUsersCounts] = useState<{
    total: number;
    guests: number;
    hosts: number;
    suspended: number;
  }>({
    total: users.length,
    guests: users.filter(u => u.role === 'guest').length,
    hosts: users.filter(u => u.role === 'owner').length,
    suspended: users.filter(u => Boolean(u.isSuspended)).length,
  });
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userTotalMatched, setUserTotalMatched] = useState(users.length);
  const [usersLoading, setUsersLoading] = useState(false);

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
  const [tripDatingCounts, setTripDatingCounts] = useState<TripDatingAdminCounts>({
    pending: 0,
    approved: 0,
    declined: 0,
    draft: 0,
    total: 0,
    pendingPayments: 0,
  });
  const [tdStatusTab, setTdStatusTab] = useState<'PENDING_REVIEW' | 'APPROVED' | 'DECLINED' | 'ALL'>('PENDING_REVIEW');
  const [tdPage, setTdPage] = useState(1);
  const [tdSubmissions, setTdSubmissions] = useState<TripDatingProfile[]>([]);
  const [tdTotalPages, setTdTotalPages] = useState(1);
  const [tdLoading, setTdLoading] = useState(false);
  const [tdActionBusyId, setTdActionBusyId] = useState<string | null>(null);
  const [tdDeclineTarget, setTdDeclineTarget] = useState<{ id: string; fullName: string } | null>(null);
  const [tdDeclineReason, setTdDeclineReason] = useState('');
  const [tdDeclineError, setTdDeclineError] = useState<string | null>(null);
  const [plusRequests, setPlusRequests] = useState<PlusServiceRequest[]>([]);
  const [plusLinkInputs, setPlusLinkInputs] = useState<Record<string, { providerName: string; providerContact: string; adminNote: string }>>({});
  const [localProvidersAdmin, setLocalProvidersAdmin] = useState<LocalServiceProvider[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Payments Tab State
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>(payments || []);
  const [adminPaymentsRows, setAdminPaymentsRows] = useState<PaymentRecord[]>([]);
  const [paymentCounts, setPaymentCounts] = useState<{
    total: number;
    pending: number;
    approved: number;
    declined: number;
    rejected: number;
    refunded: number;
    pendingDeposits: number;
    pendingTotalKes: number;
    approvedTotalKes: number;
  }>({
    total: 0,
    pending: 0,
    approved: 0,
    declined: 0,
    rejected: 0,
    refunded: 0,
    pendingDeposits: 0,
    pendingTotalKes: 0,
    approvedTotalKes: 0,
  });
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'refunded'>('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'deposit' | 'advert' | 'boost' | 'subscription' | 'vvvip' | 'booking_fee'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'wallet' | 'mpesa'>('all');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentDateFrom, setPaymentDateFrom] = useState('');
  const [paymentDateTo, setPaymentDateTo] = useState('');
  const [paymentMinAmount, setPaymentMinAmount] = useState('');
  const [paymentMaxAmount, setPaymentMaxAmount] = useState('');
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentTotalPages, setPaymentTotalPages] = useState(1);
  const [paymentTotalCount, setPaymentTotalCount] = useState(0);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsLoadError, setPaymentsLoadError] = useState<string | null>(null);
  const [rejectModalPayment, setRejectModalPayment] = useState<PaymentRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('Invalid or unverified M-Pesa receipt code.');
  const [approveModalPayment, setApproveModalPayment] = useState<PaymentRecord | null>(null);
  const [refundModalPayment, setRefundModalPayment] = useState<PaymentRecord | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundAdminPassword, setRefundAdminPassword] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [approvingPaymentId, setApprovingPaymentId] = useState<string | null>(null);
  const [paymentModalError, setPaymentModalError] = useState<string | null>(null);
  const [lastApprovedBanner, setLastApprovedBanner] = useState<{
    id: string;
    userName: string;
    email: string;
    amount: number;
    mpesaCode: string;
    adminWalletBalance?: number;
    userWalletBalance?: number;
    timestamp: number;
  } | null>(null);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [repairingReconciliation, setRepairingReconciliation] = useState(false);
  const [showLedgerAuditPanel, setShowLedgerAuditPanel] = useState(false);
  const [ledgerAuditEntries, setLedgerAuditEntries] = useState<any[]>([]);
  const [ledgerAuditTotal, setLedgerAuditTotal] = useState(0);
  const [ledgerAuditPage, setLedgerAuditPage] = useState(1);
  const [ledgerAuditTotalPages, setLedgerAuditTotalPages] = useState(1);
  const [ledgerAuditLoading, setLedgerAuditLoading] = useState(false);
  const [incomeReport, setIncomeReport] = useState<any>(null);

  // Admin Wallet (Grand Wallet) EAT Analytics, Ledger, Archives & Special Refund State
  const [awSummary, setAwSummary] = useState<Awaited<ReturnType<typeof api.getAdminWalletSummary>> | null>(null);
  const [awTotals, setAwTotals] = useState<AdminWalletRollupBucket[]>([]);
  const [awBreakdown, setAwBreakdown] = useState<{
    grandTotal: number;
    breakdown: Record<AdminWalletPurpose, { amount: number; count: number }>;
  } | null>(null);
  const [awLedger, setAwLedger] = useState<{
    entries: AdminWalletEntry[];
    total: number;
    page: number;
    totalPages: number;
  }>({ entries: [], total: 0, page: 1, totalPages: 1 });
  const [awArchives, setAwArchives] = useState<WalletYearArchive[]>([]);
  const [awGranularity, setAwGranularity] = useState<'hour' | 'day' | 'month' | 'year'>('day');
  const [awFiscalYear, setAwFiscalYear] = useState<number | ''>('');
  const [awFrom, setAwFrom] = useState<string>('');
  const [awTo, setAwTo] = useState<string>('');
  const [awPurpose, setAwPurpose] = useState<string>('ALL');
  const [awRole, setAwRole] = useState<string>('ALL');
  const [awKind, setAwKind] = useState<string>('ALL');
  const [awSearch, setAwSearch] = useState<string>('');
  const [awPage, setAwPage] = useState<number>(1);
  const [awLoading, setAwLoading] = useState<boolean>(false);
  const [awArchiveRunning, setAwArchiveRunning] = useState<boolean>(false);
  const [specialRefundOpen, setSpecialRefundOpen] = useState<boolean>(false);
  const [specialRefundForm, setSpecialRefundForm] = useState({
    reason: '',
    caseReference: '',
    originalPaymentCode: '',
    amount: '',
    adminPassword: '',
  });
  const [specialRefundBusy, setSpecialRefundBusy] = useState<boolean>(false);
  const [specialRefundError, setSpecialRefundError] = useState<string | null>(null);
  const [adminWalletsData, setAdminWalletsData] = useState<{
    guestWallets: Array<{
      email: string;
      name: string;
      username: string;
      balance: number;
      holdBalance: number;
      available: number;
      lifetimeEarnings: number;
      lifetimeSpent: number;
      updatedAt: number;
    }>;
    hostWallets: Array<{
      email: string;
      name: string;
      username: string;
      balance: number;
      holdBalance: number;
      available: number;
      lifetimeEarnings: number;
      lifetimeSpent: number;
      updatedAt: number;
    }>;
    guestDeposits: PaymentRecord[];
    hostDeposits: PaymentRecord[];
  }>({ guestWallets: [], hostWallets: [], guestDeposits: [], hostDeposits: [] });

  // Admin Account & Security State (Requirement 5)
  const [adminUsername, setAdminUsername] = useState(adminUser?.name || '');
  const [adminEmailInput, setAdminEmailInput] = useState(adminUser?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  // Admin Factory Reset State
  const [factoryResetScope, setFactoryResetScope] = useState<'admin_only' | 'full_factory'>('full_factory');
  const [factoryResetPassword, setFactoryResetPassword] = useState('');
  const [factoryResetConfirmed, setFactoryResetConfirmed] = useState(false);
  const [factoryResetLoading, setFactoryResetLoading] = useState(false);
  const [factoryResetSuccess, setFactoryResetSuccess] = useState<string | null>(null);
  const [factoryResetError, setFactoryResetError] = useState<string | null>(null);

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
      if (
        newPassword.length < 8 ||
        !/[a-zA-Z]/.test(newPassword) ||
        !/[0-9]/.test(newPassword) ||
        !/[^a-zA-Z0-9\s]/.test(newPassword)
      ) {
        setSecurityError('Password must be at least 8 characters and include a mix of letters, numbers, and other characters (e.g. !@#$%).');
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

  const handleRestoreAdminFactorySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFactoryResetError(null);
    setFactoryResetSuccess(null);

    if (!factoryResetConfirmed) {
      setFactoryResetError('Please tick the confirmation box before restoring factory settings.');
      return;
    }
    if (!factoryResetPassword.trim()) {
      setFactoryResetError('Current administrator password is required.');
      return;
    }

    setFactoryResetLoading(true);
    try {
      const res = await api.restoreAdminFactorySettings({
        adminPassword: factoryResetPassword,
        scope: factoryResetScope,
      });
      if (res.user) {
        onUpdateAdminUser?.(res.user);
        setAdminUsername(res.user.name || '');
        setAdminEmailInput(res.user.email || '');
      }
      if (res.settings) {
        setSettings(res.settings);
      }
      if (res.counts) {
        setPaymentCounts(res.counts);
      }
      if (res.reconciliation) {
        setReconciliation(res.reconciliation);
      }
      setFactoryResetPassword('');
      setFactoryResetConfirmed(false);
      setFactoryResetSuccess(res.message || 'Admin restored to factory settings.');
      showToast?.(res.message || 'Admin restored to factory settings.');
      loadAdminData();
      if (onPaymentModerated) {
        await Promise.resolve(onPaymentModerated()).catch(() => {});
      }
    } catch (err: any) {
      setFactoryResetError(err?.message || 'Failed to restore admin factory settings.');
    } finally {
      setFactoryResetLoading(false);
    }
  };

  const normalizeReviewQueue = (res: any) => {
    const qStays: Stay[] = Array.isArray(res?.stays)
      ? res.stays
      : Array.isArray(res?.listings)
      ? res.listings
      : [];
    const qTripDating: TripDatingProfile[] = Array.isArray(res?.tripDating) ? res.tripDating : [];
    return {
      stays: qStays,
      tripDating: qTripDating,
      counts: {
        stays: typeof res?.counts?.stays === 'number' ? res.counts.stays : qStays.length,
        tripDating: typeof res?.counts?.tripDating === 'number' ? res.counts.tripDating : qTripDating.length,
        total: typeof res?.counts?.total === 'number' ? res.counts.total : qStays.length + qTripDating.length,
      },
    };
  };

  const refreshReviewQueue = async () => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    setReviewQueueLoading(true);
    setReviewQueueError(null);
    try {
      const res = await api.getAdminReviewQueue();
      if (res) {
        setReviewQueue(normalizeReviewQueue(res));
      }
    } catch (err: any) {
      setReviewQueueError(err?.message || 'Failed to refresh review queue.');
    } finally {
      setReviewQueueLoading(false);
    }
  };

  const loadAdminUsers = async (overridePage?: number) => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    setUsersLoading(true);
    try {
      const res = await api.getAdminUsers({
        role: userFilter,
        q: userSearch.trim() || undefined,
        page: overridePage ?? userPage,
        limit: 20,
      });
      if (Array.isArray(res?.users)) setAdminUsersList(res.users);
      if (res?.counts) setAdminUsersCounts(res.counts);
      if (typeof res?.totalPages === 'number') setUserTotalPages(Math.max(1, res.totalPages));
      if (typeof res?.total === 'number') setUserTotalMatched(res.total);
    } catch {
      // keep prior state on transient error
    } finally {
      setUsersLoading(false);
    }
  };

  const loadTripDatingSubmissions = (
    status: 'PENDING_REVIEW' | 'APPROVED' | 'DECLINED' | 'ALL' = tdStatusTab,
    page = tdPage
  ) => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    setTdLoading(true);
    api
      .getAdminTripDatingSubmissions({ status, page, limit: 10 })
      .then(res => {
        if (Array.isArray(res?.submissions)) setTdSubmissions(res.submissions);
        if (res?.counts) setTripDatingCounts(res.counts);
        if (typeof res?.totalPages === 'number') setTdTotalPages(Math.max(1, res.totalPages));
      })
      .catch(() => {})
      .finally(() => setTdLoading(false));
  };

  const loadAdminWalletAnalytics = async () => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    setAwLoading(true);
    try {
      const fyNum = awFiscalYear ? Number(awFiscalYear) : undefined;
      const [sumRes, totRes, brkRes, ledRes, archRes] = await Promise.all([
        api.getAdminWalletSummary(fyNum),
        api.getAdminWalletTotals({
          granularity: awGranularity,
          from: awFrom || undefined,
          to: awTo || undefined,
          fiscalYear: fyNum,
        }),
        api.getAdminWalletBreakdown({
          from: awFrom || undefined,
          to: awTo || undefined,
          fiscalYear: fyNum,
        }),
        api.getAdminWalletLedger({
          q: awSearch || undefined,
          purpose: awPurpose,
          role: awRole,
          sourceKind: awKind,
          fiscalYear: fyNum,
          from: awFrom || undefined,
          to: awTo || undefined,
          page: awPage,
          limit: 15,
        }),
        api.getAdminWalletArchives(),
      ]);
      setAwSummary(sumRes);
      setAwTotals(Array.isArray(totRes?.periods) ? totRes.periods : []);
      if (brkRes) {
        setAwBreakdown({ grandTotal: brkRes.grandTotal || 0, breakdown: brkRes.breakdown });
      }
      if (ledRes) {
        setAwLedger({
          entries: ledRes.entries || [],
          total: ledRes.total || 0,
          page: ledRes.page || 1,
          totalPages: ledRes.totalPages || 1,
        });
      }
      setAwArchives(Array.isArray(archRes?.archives) ? archRes.archives : []);
    } catch {
      // keep prior state on transient error
    } finally {
      setAwLoading(false);
    }
  };

  useEffect(() => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    if (tab === 'treasury') {
      loadAdminWalletAnalytics();
    }
  }, [tab, awGranularity, awFiscalYear, awFrom, awTo, awPurpose, awRole, awKind, awSearch, awPage, adminUser?.role]);

  const loadAdminPayments = async (overridePage?: number) => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    const targetPage = overridePage ?? paymentPage;
    setPaymentsLoading(true);
    setPaymentsLoadError(null);
    try {
      const res = await api.getAdminPayments({
        status: paymentStatusFilter,
        type: paymentTypeFilter,
        method: paymentMethodFilter,
        search: paymentSearch.trim() || undefined,
        dateFrom: paymentDateFrom || undefined,
        dateTo: paymentDateTo || undefined,
        minAmount: paymentMinAmount ? Number(paymentMinAmount) : undefined,
        maxAmount: paymentMaxAmount ? Number(paymentMaxAmount) : undefined,
        page: targetPage,
        limit: 25,
      });
      setAdminPaymentsRows(Array.isArray(res?.payments) ? res.payments : []);
      setPaymentTotalCount(typeof res?.total === 'number' ? res.total : 0);
      setPaymentTotalPages(Math.max(1, res?.totalPages || 1));
      if (res?.counts) setPaymentCounts(res.counts);
    } catch (err: any) {
      setPaymentsLoadError(err?.message || 'Failed to load payments queue.');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const loadPaymentsAudit = async (pageOverride?: number) => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    setLedgerAuditLoading(true);
    try {
      const res = await api.getAdminPaymentsAudit({
        q: paymentSearch.trim() || undefined,
        from: paymentDateFrom || undefined,
        to: paymentDateTo || undefined,
        page: pageOverride ?? ledgerAuditPage,
        limit: 20,
      });
      setLedgerAuditEntries(Array.isArray(res?.entries) ? res.entries : []);
      setLedgerAuditTotal(res?.total || 0);
      setLedgerAuditTotalPages(Math.max(1, res?.totalPages || 1));
      if (res?.reconciliation) setReconciliation(res.reconciliation);
    } catch {
      // keep existing audit rows on transient error
    } finally {
      setLedgerAuditLoading(false);
    }
  };

  useEffect(() => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    loadAdminPayments();
    if (showLedgerAuditPanel) {
      loadPaymentsAudit();
    }
  }, [
    tab,
    paymentStatusFilter,
    paymentTypeFilter,
    paymentMethodFilter,
    paymentSearch,
    paymentDateFrom,
    paymentDateTo,
    paymentMinAmount,
    paymentMaxAmount,
    paymentPage,
    showLedgerAuditPanel,
    ledgerAuditPage,
    adminUser?.role,
  ]);

  const loadAdminData = () => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    api.getPaymentRecords(undefined, 'admin').then(res => {
      if (Array.isArray(res?.payments)) setAllPayments(res.payments);
    }).catch(() => {});
    api.getAdminPaymentCounts().then(cnt => {
      if (cnt) setPaymentCounts(cnt);
    }).catch(() => {});
    loadAdminPayments();
    api.getPosts(undefined, 'admin').then(res => setPosts(Array.isArray(res?.posts) ? res.posts : [])).catch(() => {});
    api.getAds(undefined, 'admin').then(res => setAds(Array.isArray(res?.ads) ? res.ads : [])).catch(() => {});
    api.getOwnerPromotions('admin').then(res => setPromotions(Array.isArray(res?.promotions) ? res.promotions : [])).catch(() => {});
    api.getAdminWithdrawals().then(res => setWithdrawals(Array.isArray(res?.withdrawals) ? res.withdrawals : [])).catch(() => {});
    api.getSettings('admin').then(res => {
      if (res?.settings) setSettings(res.settings);
    }).catch(() => {});
    api.getDormantOwners().then(res => setDormantOwners(Array.isArray(res?.dormantOwners) ? res.dormantOwners : [])).catch(() => {});
    api.getWallet('admin').then(res => {
      if (res?.wallet) setTreasuryWallet(res.wallet);
      setTreasuryLedger(Array.isArray(res?.ledger) ? res.ledger : []);
    }).catch(() => {});
    api.getAdminPaymentReconciliation().then(res => {
      if (res) setReconciliation(res);
    }).catch(() => {});
    api.getAdminIncomeReport().then(res => {
      if (res) setIncomeReport(res);
    }).catch(() => {});
    loadAdminWalletAnalytics();
    api.getAdminTripDatingRequests().then(res => setDatingRequests(Array.isArray(res?.requests) ? res.requests : [])).catch(() => {});
    api.getAdminTripDatingStats().then(res => {
      if (res?.stats) setDatingStats(res.stats);
      setDatingProfiles(Array.isArray(res?.profiles) ? res.profiles : []);
    }).catch(() => {});
    api.getAdminTripDatingCounts().then(res => {
      if (res?.counts) setTripDatingCounts(res.counts);
    }).catch(() => {});
    loadTripDatingSubmissions(tdStatusTab, tdPage);
    api.getAdminListingMedia({ type: mediaTypeFilter, flaggedOnly: mediaFlaggedOnly, search: mediaSearch }, 'admin').then(res => {
      if (Array.isArray(res?.media)) setListingMediaList(res.media);
    }).catch(() => {});
    api.getAdminSubscriptions().then(res => {
      if (Array.isArray(res?.subscriptions)) setAdminSubscriptions(res.subscriptions);
    }).catch(() => {});
    api.getAdminReports().then(res => {
      if (Array.isArray(res?.reports)) setAdminReports(res.reports);
    }).catch(() => {});
    api.getAdminReviews().then(res => {
      if (Array.isArray(res?.reviews)) setAdminReviews(res.reviews);
    }).catch(() => {});
    api.getLiveUpdates('admin').then(res => {
      if (res?.counts) setLiveCounts(res.counts);
    }).catch(() => {});
    api.getAdminWallets().then(res => {
      if (res) {
        setAdminWalletsData({
          guestWallets: Array.isArray(res.guestWallets) ? res.guestWallets : [],
          hostWallets: Array.isArray(res.hostWallets) ? res.hostWallets : [],
          guestDeposits: Array.isArray(res.guestDeposits) ? res.guestDeposits : [],
          hostDeposits: Array.isArray(res.hostDeposits) ? res.hostDeposits : [],
        });
      }
    }).catch(() => {});
    api.getPlusServiceRequests('admin').then(res => {
      if (Array.isArray(res?.requests)) setPlusRequests(res.requests);
    }).catch(() => {});
    api.getAdminLocalProviders().then(res => {
      if (Array.isArray(res?.providers)) setLocalProvidersAdmin(res.providers);
    }).catch(() => {});
    api.getAdminReviewQueue().then(res => {
      if (res) {
        setReviewQueue(normalizeReviewQueue(res));
        setReviewQueueError(null);
      }
    }).catch(() => {});
    loadAdminUsers();
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
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) {
      return;
    }
    let stopped = false;
    const stopOnAuthError = (err: any) => {
      if (err?.status === 401 || err?.status === 403) {
        stopped = true;
      }
    };
    loadAdminData();
    const interval = setInterval(() => {
      if (stopped || !api.getToken('admin') || adminUser?.role !== 'admin') {
        clearInterval(interval);
        return;
      }
      api.getLiveUpdates('admin').then(res => {
        if (res?.counts) setLiveCounts(res.counts);
      }).catch(() => {});
      api.getPaymentRecords(undefined, 'admin').then(res => {
        if (Array.isArray(res?.payments)) setAllPayments(res.payments);
      }).catch(stopOnAuthError);
      api.getAdminPaymentCounts().then(cnt => {
        if (cnt) setPaymentCounts(cnt);
      }).catch(stopOnAuthError);
      if (tab === 'queue') {
        loadAdminPayments();
      }
      api.getAdminWallets().then(res => {
        if (res) {
          setAdminWalletsData({
            guestWallets: Array.isArray(res.guestWallets) ? res.guestWallets : [],
            hostWallets: Array.isArray(res.hostWallets) ? res.hostWallets : [],
            guestDeposits: Array.isArray(res.guestDeposits) ? res.guestDeposits : [],
            hostDeposits: Array.isArray(res.hostDeposits) ? res.hostDeposits : [],
          });
        }
      }).catch(stopOnAuthError);
      api.getAdminReviewQueue().then(res => {
        if (res) setReviewQueue(normalizeReviewQueue(res));
      }).catch(stopOnAuthError);
      api.getAdminTripDatingCounts().then(res => {
        if (res?.counts) setTripDatingCounts(res.counts);
      }).catch(stopOnAuthError);
    }, MPESA_CONFIG.POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [adminUser?.email, adminUser?.role, tab]);

  useEffect(() => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    if (tab === 'queue' || tab === 'wallets' || tab === 'treasury') {
      api.getPaymentRecords(undefined, 'admin').then(res => {
        if (Array.isArray(res?.payments)) setAllPayments(res.payments);
      }).catch(() => {});
      api.getAdminPaymentCounts().then(cnt => {
        if (cnt) setPaymentCounts(cnt);
      }).catch(() => {});
      api.getAdminPaymentReconciliation().then(res => {
        if (res) setReconciliation(res);
      }).catch(() => {});
      api.getAdminWallets().then(res => {
        if (res) {
          setAdminWalletsData({
            guestWallets: Array.isArray(res.guestWallets) ? res.guestWallets : [],
            hostWallets: Array.isArray(res.hostWallets) ? res.hostWallets : [],
            guestDeposits: Array.isArray(res.guestDeposits) ? res.guestDeposits : [],
            hostDeposits: Array.isArray(res.hostDeposits) ? res.hostDeposits : [],
          });
        }
      }).catch(() => {});
    }
    if (tab === 'review-queue') {
      refreshReviewQueue();
    }
    if (tab === 'users') {
      loadAdminUsers();
    }
  }, [tab, adminUser?.role]);

  useEffect(() => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    if (tab === 'users') {
      loadAdminUsers();
    }
  }, [userFilter, userSearch, userPage]);

  useEffect(() => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    if (tab !== 'users') return;
    const timer = window.setInterval(() => {
      loadAdminUsers();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [tab, userFilter, userSearch, userPage, adminUser?.role]);

  useEffect(() => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    loadTripDatingSubmissions(tdStatusTab, tdPage);
  }, [tdStatusTab, tdPage, adminUser?.role]);

  useEffect(() => {
    const onTdCounts = (e: Event) => {
      if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
      const evt = e as CustomEvent<TripDatingAdminCounts>;
      if (evt.detail) {
        setTripDatingCounts(evt.detail);
        if (tab === 'trip-dating') {
          loadTripDatingSubmissions(tdStatusTab, tdPage);
        }
      }
    };
    window.addEventListener('airbus:trip-dating-counts', onTdCounts as EventListener);
    return () => window.removeEventListener('airbus:trip-dating-counts', onTdCounts as EventListener);
  }, [tab, tdStatusTab, tdPage, adminUser?.role]);

  useEffect(() => {
    const onPaymentUpdate = (e: Event) => {
      if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
      const detail = (e as CustomEvent<any>).detail;
      const incomingPay: PaymentRecord | undefined = detail?.payment;
      if (incomingPay && incomingPay.id) {
        setAllPayments(prev => {
          const base = prev.length > 0 ? prev : payments;
          const idx = base.findIndex(item => item.id === incomingPay.id);
          if (idx >= 0) {
            return base.map(item => (item.id === incomingPay.id ? { ...item, ...incomingPay } : item));
          }
          return [incomingPay, ...base];
        });
      }
      if (typeof detail?.adminWalletBalance === 'number') {
        setAwSummary(prev =>
          prev ? { ...prev, adminWalletBalance: detail.adminWalletBalance } : prev
        );
      }
      api.getPaymentRecords(undefined, 'admin').then(res => {
        if (Array.isArray(res?.payments)) setAllPayments(res.payments);
      }).catch(() => {});
      api.getAdminWallets().then(res => {
        if (res) {
          setAdminWalletsData({
            guestWallets: Array.isArray(res.guestWallets) ? res.guestWallets : [],
            hostWallets: Array.isArray(res.hostWallets) ? res.hostWallets : [],
            guestDeposits: Array.isArray(res.guestDeposits) ? res.guestDeposits : [],
            hostDeposits: Array.isArray(res.hostDeposits) ? res.hostDeposits : [],
          });
        }
      }).catch(() => {});
      if (tab === 'queue') {
        loadAdminPayments();
      }
      if (tab === 'treasury') {
        loadAdminWalletAnalytics();
      }
      api.getAdminPaymentCounts().then(cnt => {
        if (cnt) setPaymentCounts(cnt);
      }).catch(() => {});
    };
    window.addEventListener('airbus:payment-update', onPaymentUpdate as EventListener);
    return () => window.removeEventListener('airbus:payment-update', onPaymentUpdate as EventListener);
  }, [adminUser?.role, tab, payments]);

  const handleApprovePaymentRecord = async (payment: PaymentRecord) => {
    if (!adminUser || adminUser.role !== 'admin' || !api.getToken('admin')) return;
    setProcessingPayment(true);
    setApprovingPaymentId(payment.id);
    setPaymentModalError(null);
    try {
      const idemKey = `approve_${payment.id}`;
      const res = await api.approvePayment(payment.id, idemKey);
      const approvedPay = res?.payment || payment;
      if (res?.counts) setPaymentCounts(res.counts);
      const approvedAmount = Number(
        approvedPay.approvedAmount ??
          approvedPay.claimedAmount ??
          approvedPay.amountKes ??
          approvedPay.amountSc ??
          approvedPay.amount ??
          0
      );
      const email = (approvedPay.userId || approvedPay.hostEmail || payment.userId || payment.hostEmail || '').toLowerCase();
      const mpesaCode = String(approvedPay.mpesaCode || payment.mpesaCode || payment.referenceId || payment.id);
      const userName = approvedPay.userName || payment.userName || email;

      setAllPayments(prev => {
        const base = prev.length > 0 ? prev : payments;
        const exists = base.some(item => item.id === payment.id);
        if (!exists) return [{ ...approvedPay, status: 'approved', canonicalStatus: PaymentStatus.APPROVED }, ...base];
        return base.map(item =>
          item.id === payment.id
            ? {
                ...item,
                ...approvedPay,
                status: 'approved',
                canonicalStatus: PaymentStatus.APPROVED,
                approvedAmount,
                approvedAt: approvedPay.approvedAt || Date.now(),
              }
            : item
        );
      });

      setAdminWalletsData(prev => ({
        ...prev,
        hostDeposits: prev.hostDeposits.map(d =>
          d.id === payment.id ? { ...d, ...approvedPay, status: 'approved', canonicalStatus: PaymentStatus.APPROVED, approvedAmount } : d
        ),
        guestDeposits: prev.guestDeposits.map(d =>
          d.id === payment.id ? { ...d, ...approvedPay, status: 'approved', canonicalStatus: PaymentStatus.APPROVED, approvedAmount } : d
        ),
        hostWallets:
          typeof res?.userWalletBalance === 'number'
            ? prev.hostWallets.map(w =>
                w.email.toLowerCase() === email ? { ...w, balance: res.userWalletBalance! } : w
              )
            : prev.hostWallets,
        guestWallets:
          typeof res?.userWalletBalance === 'number'
            ? prev.guestWallets.map(w =>
                w.email.toLowerCase() === email ? { ...w, balance: res.userWalletBalance! } : w
              )
            : prev.guestWallets,
      }));

      if (typeof res?.adminWalletBalance === 'number') {
        setAwSummary(prev => (prev ? { ...prev, adminWalletBalance: res.adminWalletBalance! } : prev));
        setTreasuryWallet(prev => (prev ? { ...prev, balance: res.adminWalletBalance! } : prev));
      }

      setLastApprovedBanner({
        id: payment.id,
        userName,
        email,
        amount: approvedAmount,
        mpesaCode,
        adminWalletBalance: res?.adminWalletBalance,
        userWalletBalance: res?.userWalletBalance,
        timestamp: Date.now(),
      });

      showToast?.(
        `Approved KES ${approvedAmount.toLocaleString()} (${mpesaCode})! Wallet credited automatically.`
      );
      setApproveModalPayment(null);
      loadAdminData();
      if (onPaymentModerated) {
        await Promise.resolve(onPaymentModerated()).catch(() => {});
      }
    } catch (err: any) {
      const msg = err?.message || 'Approval failed.';
      setPaymentModalError(msg);
      showToast?.(msg);
    } finally {
      setProcessingPayment(false);
      setApprovingPaymentId(null);
    }
  };

  const currentPaymentsList = allPayments.length > 0 ? allPayments : payments;
  const pendingPayments = currentPaymentsList.filter(p => p.status === 'pending' || p.canonicalStatus === PaymentStatus.PENDING);
  const syncedPendingCount =
    paymentCounts.total > 0 || adminPaymentsRows.length > 0
      ? paymentCounts.pending
      : allPayments.length > 0
      ? pendingPayments.length
      : (metrics?.pendingPayments ?? 0);

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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('treasury')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-extrabold transition-all shadow-sm cursor-pointer border ${
              tab === 'treasury'
                ? 'bg-amber-500 text-stone-950 border-amber-400'
                : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border-amber-500/30'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>My Admin Wallet</span>
            <span className="font-mono">
              (KES {(awSummary?.adminWalletBalance ?? reconciliation?.adminBalance ?? treasuryWallet?.balance ?? 0).toLocaleString()})
            </span>
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
      </div>

      {/* Admin Header */}
      <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-amber-950/60 text-white p-6 rounded-3xl shadow-lg border border-amber-500/20 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-amber-500 text-stone-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Platform Admin Console
              </span>
              <span className="text-xs text-amber-300 font-mono">Logged as: {adminUser?.email}</span>
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
              <div className="text-lg font-black text-amber-400">
                {syncedPendingCount}
              </div>
              <div className="text-[10px] text-stone-300 uppercase font-semibold">Pending M-Pesa</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
              <div className="text-lg font-black text-emerald-400">{metrics?.liveStays ?? 0}</div>
              <div className="text-[10px] text-stone-300 uppercase font-semibold">Live Stays</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
              <div className="text-lg font-black text-white">{metrics?.totalUsers ?? 0}</div>
              <div className="text-[10px] text-stone-300 uppercase font-semibold">Accounts</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center">
              <div className="text-lg font-black text-[#ff2e93]">
                KES {Math.round((metrics?.volumeKes || 0) / 1000)}k
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
          {syncedPendingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
              {syncedPendingCount}
            </span>
          )}
        </button>

        {/* Dedicated Review Queue (Airbus Listings & Trip Dating) */}
        <button
          onClick={() => setTab('review-queue')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'review-queue'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Review Queue</span>
          {reviewQueue.counts.total > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
              {reviewQueue.counts.total}
            </span>
          )}
        </button>

        {/* Guest & Host Wallets */}
        <button
          onClick={() => setTab('wallets')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'wallets'
              ? 'bg-emerald-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Wallet className="w-4 h-4 text-emerald-500" />
          <span>Guest &amp; Host Wallets</span>
          {(adminWalletsData.guestDeposits.filter(d => d.status === 'pending').length +
            adminWalletsData.hostDeposits.filter(d => d.status === 'pending').length) > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
              {adminWalletsData.guestDeposits.filter(d => d.status === 'pending').length +
                adminWalletsData.hostDeposits.filter(d => d.status === 'pending').length}
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
          <span>Trip Dating ({tripDatingCounts.pending})</span>
        </button>

        <button
          onClick={() => setTab('plus-local')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'plus-local'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Crown className="w-4 h-4 text-amber-500" />
          <span>AirBus Plus &amp; Local ({plusRequests.filter(r => r.status === 'pending').length})</span>
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
          <Wallet className="w-4 h-4 text-emerald-500" />
          <span>Admin Wallet</span>
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

      {/* DEDICATED REVIEW QUEUE TAB (Oldest Pending First) */}
      {tab === 'review-queue' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
            <div>
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white flex items-center gap-2 flex-wrap">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span>Admin Review Queue (Oldest Pending First)</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  {reviewQueue.counts.total} pending
                </span>
                <span className="text-[11px] font-semibold text-stone-500">
                  (AirBus Listings: {reviewQueue.counts.stays} · Trip Dating Posts: {reviewQueue.counts.tripDating})
                </span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Inspect full video and full-resolution photos before approving or declining with required creator feedback.
              </p>
            </div>
            <button
              type="button"
              onClick={refreshReviewQueue}
              disabled={reviewQueueLoading}
              className="self-start sm:self-auto px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-stone-400 ${reviewQueueLoading ? 'animate-spin' : ''}`} />
              <span>{reviewQueueLoading ? 'Refreshing...' : 'Refresh Queue'}</span>
            </button>
          </div>

          {reviewQueueError && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center justify-between gap-2">
              <span>{reviewQueueError}</span>
              <button
                type="button"
                onClick={refreshReviewQueue}
                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Two Sub-Tabs: Airbus Listings & Trip Dating Posts */}
          <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
            <button
              type="button"
              onClick={() => setReviewSubTab('stays')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-2 ${
                reviewSubTab === 'stays'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>AirBus Listings ({reviewQueue.counts.stays})</span>
            </button>
            <button
              type="button"
              onClick={() => setReviewSubTab('trip-dating')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-2 ${
                reviewSubTab === 'trip-dating'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Trip Dating Posts ({reviewQueue.counts.tripDating})</span>
            </button>
          </div>

          {/* Sub-Tab 1: Airbus Listings */}
          {reviewSubTab === 'stays' && (
            <div className="space-y-4">
              {reviewQueue.stays.length === 0 ? (
                <div className="p-10 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 text-xs text-stone-500">
                  No AirBus Listings pending review.
                </div>
              ) : (
                reviewQueue.stays.map((stay, idx) => {
                  const stayPhotos: string[] = Array.from(
                    new Set(
                      [
                        ...(stay.media?.photos?.map(p => p.url) || []),
                        ...(stay.images || []),
                        stay.thumbnailUrl || '',
                      ].filter(Boolean)
                    )
                  );
                  const fullStayVideoUrl = stay.media?.video?.url || stay.videoUrl || stay.youtubeUrl || '';
                  return (
                    <div
                      key={stay.id}
                      className="p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                              Queue #{idx + 1} · Submitted {new Date(stay.createdAt).toLocaleString()}
                            </span>
                            {stay.isPlusVVVIP && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                                AirBus Plus VVVIP
                              </span>
                            )}
                            {stay.blackFridayOptIn && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                                Black Friday
                              </span>
                            )}
                            {stay.isAirbusWork && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                                AirBus Work
                              </span>
                            )}
                            {stay.isLocalGuideExperience && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                                AirBus Local
                              </span>
                            )}
                            {stay.isWorldWide && (
                              <span className="px-2 py-0.5 rounded-full bg-cyan-600 text-white text-[10px] font-bold">
                                World Wide {stay.country ? `(${stay.country})` : ''}
                              </span>
                            )}
                            {stay.isEscapeOffer && (
                              <span className="px-2 py-0.5 rounded-full bg-orange-600 text-white text-[10px] font-bold">
                                AirBus Escapes
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-extrabold text-stone-900 dark:text-white">{stay.title}</h4>
                          <p className="text-xs text-stone-500">
                            {stay.location} · KES {stay.price.toLocaleString()}/night · Host: {stay.hostName || stay.owner || stay.ownerEmail} ({stay.ownerEmail})
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={reviewActionBusy}
                            onClick={async () => {
                              setReviewActionBusy(true);
                              try {
                                await api.moderateReviewQueueStay(stay.id, 'approve');
                                showToast?.(`Approved listing "${stay.title}". It is now live at the top of the feed!`);
                                await refreshReviewQueue();
                                loadAdminData();
                              } catch (err: any) {
                                showToast?.(err.message || 'Approval failed');
                              } finally {
                                setReviewActionBusy(false);
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Approve</span>
                          </button>

                          <button
                            type="button"
                            disabled={reviewActionBusy}
                            onClick={() => {
                              setReviewDeclineTarget({ kind: 'stay', id: stay.id, title: stay.title });
                              setReviewFeedback('');
                              setReviewFeedbackError(null);
                            }}
                            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Decline</span>
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-900 p-3 rounded-2xl border border-stone-200 dark:border-stone-800">
                        {stay.description}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Live Guest Preview (Video Tour + Photo Switcher) */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-stone-500 uppercase">
                              Full Video Tour &amp; Guest Preview
                            </span>
                            {fullStayVideoUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewVideoModal({
                                    title: stay.title,
                                    videoUrl: fullStayVideoUrl,
                                    poster: stay.thumbnailUrl || stay.media?.video?.thumbnail,
                                  })
                                }
                                className="px-2 py-0.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Maximize2 className="w-3 h-3" />
                                <span>Inspect Full Video</span>
                              </button>
                            )}
                          </div>
                          <ListingMediaViewer
                            media={stay.media}
                            videoUrl={stay.videoUrl || stay.youtubeUrl}
                            thumbnailUrl={stay.thumbnailUrl}
                            images={stayPhotos}
                            title={stay.title}
                            aspectRatio="video"
                          />
                        </div>

                        {/* Full-Resolution Photo Thumbnails */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-stone-500 uppercase">
                              Photos ({stayPhotos.length}) — Click to inspect full resolution
                            </span>
                            {stayPhotos.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewPhotoLightbox({
                                    title: stay.title,
                                    photos: stayPhotos,
                                    idx: 0,
                                  })
                                }
                                className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Maximize2 className="w-3 h-3" />
                                <span>Full-Res Viewer</span>
                              </button>
                            )}
                          </div>
                          {stayPhotos.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                              {stayPhotos.map((pUrl: string, pIdx: number) => (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() =>
                                    setReviewPhotoLightbox({
                                      title: stay.title,
                                      photos: stayPhotos,
                                      idx: pIdx,
                                    })
                                  }
                                  className="aspect-[4/3] rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 hover:ring-2 hover:ring-amber-500 cursor-pointer"
                                >
                                  <img src={pUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="h-36 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 flex items-center justify-center text-xs text-stone-400">
                              No photos uploaded
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Sub-Tab 2: Trip Dating Posts */}
          {reviewSubTab === 'trip-dating' && (
            <div className="space-y-4">
              {reviewQueue.tripDating.length === 0 ? (
                <div className="p-10 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 text-xs text-stone-500">
                  No Trip Dating posts pending review.
                </div>
              ) : (
                reviewQueue.tripDating.map((profile, idx) => {
                  const profilePhotos = Array.from(
                    new Set(
                      [profile.full_body_photo, profile.primaryPhoto, ...(profile.photos || [])].filter(
                        Boolean
                      ) as string[]
                    )
                  );
                  const profileVideo = profile.videoUrl || profile.videos?.[0];
                  return (
                    <div
                      key={profile.id}
                      className="p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[10px] font-bold">
                              Queue #{idx + 1} · Submitted {new Date(profile.createdAt).toLocaleString()}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[10px] font-bold capitalize">
                              {profile.gender}, {profile.age} yrs · {profile.city}
                            </span>
                          </div>
                          <h4 className="text-base font-extrabold text-stone-900 dark:text-white">
                            {profile.fullName}
                          </h4>
                          <p className="text-xs text-stone-500">
                            Intention: {profile.datingIntention?.replace(/_/g, ' ')} · Location: {profile.location} · Contact: {profile.phoneNumber}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={reviewActionBusy}
                            onClick={async () => {
                              setReviewActionBusy(true);
                              try {
                                await api.moderateReviewQueueTripDating(profile.id, 'approve');
                                showToast?.(`Approved ${profile.fullName}. Profile is now live!`);
                                await refreshReviewQueue();
                                loadAdminData();
                              } catch (err: any) {
                                showToast?.(err.message || 'Approval failed');
                              } finally {
                                setReviewActionBusy(false);
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Approve</span>
                          </button>

                          <button
                            type="button"
                            disabled={reviewActionBusy}
                            onClick={() => {
                              setReviewDeclineTarget({
                                kind: 'trip_dating',
                                id: profile.id,
                                title: profile.fullName,
                              });
                              setReviewFeedback('');
                              setReviewFeedbackError(null);
                            }}
                            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Decline</span>
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-900 p-3 rounded-2xl border border-stone-200 dark:border-stone-800">
                        {profile.description}
                        {profile.lookingFor ? ` — Looking for: ${profile.lookingFor}` : ''}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-stone-500 uppercase">Full 9:16 Video</span>
                            {profileVideo && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewVideoModal({
                                    title: profile.fullName,
                                    videoUrl: profileVideo,
                                    poster: profile.videoThumbnail || profile.primaryPhoto,
                                  })
                                }
                                className="px-2 py-0.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Maximize2 className="w-3 h-3" />
                                <span>Inspect Full Video</span>
                              </button>
                            )}
                          </div>
                          {profileVideo ? (
                            <SharedVideoPlayer
                              src={profileVideo}
                              poster={profile.videoThumbnail || profile.primaryPhoto}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full h-72 rounded-2xl border border-stone-200 dark:border-stone-800"
                              videoClassName="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="h-36 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 flex items-center justify-center text-xs text-stone-400">
                              No video uploaded
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold text-stone-500 uppercase">
                            Photos ({profilePhotos.length}) — Click to inspect full resolution
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {profilePhotos.map((pUrl, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() =>
                                  setReviewPhotoLightbox({
                                    title: profile.fullName,
                                    photos: profilePhotos,
                                    idx: pIdx,
                                  })
                                }
                                className="aspect-[3/4] rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 hover:ring-2 hover:ring-rose-500 cursor-pointer"
                              >
                                <img src={pUrl} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: PAYMENTS MODULE & AUDIT LEDGER */}
      {tab === 'queue' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-200 dark:border-stone-800">
            <div>
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white flex flex-wrap items-center gap-2">
                <span>Payments &amp; Ledger Audit</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  {paymentCounts.total || paymentTotalCount || currentPaymentsList.length} total · {syncedPendingCount} pending
                </span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Verify and moderate all M-Pesa deposits and atomic AirBus wallet transactions (Africa/Nairobi EAT).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setShowLedgerAuditPanel(v => !v)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  showLedgerAuditPanel
                    ? 'bg-amber-500 text-stone-950 border-amber-400'
                    : 'border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{showLedgerAuditPanel ? 'Hide Ledger Audit' : 'Ledger Audit'}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    const csv = await api.exportAdminPaymentsAuditCsv({
                      q: paymentSearch.trim() || undefined,
                      from: paymentDateFrom || undefined,
                      to: paymentDateTo || undefined,
                    });
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `airbus-payments-ledger-audit.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast?.('Payments & Ledger Audit CSV exported.');
                  } catch (err: any) {
                    showToast?.(err?.message || 'CSV export failed.');
                  }
                }}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={loadAdminData}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-stone-400 ${paymentsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Reconciliation Health & Repair Status Strip */}
          {reconciliation && (
            <div
              className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                (reconciliation.totalAnomalies ?? reconciliation.mismatches ?? 0) === 0
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-extrabold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  {(reconciliation.totalAnomalies ?? reconciliation.mismatches ?? 0) === 0
                    ? 'Wallet & Ledger Reconciled (0 Anomalies)'
                    : `Reconciliation Alert: ${reconciliation.totalAnomalies} Anomalies Detected`}
                </span>
                <span className="text-[11px] opacity-85 font-mono">
                  Drift: {reconciliation.mismatches ?? 0} · Missing Deposit Ledger: {reconciliation.missingDepositLedgerCount ?? 0} · Orphan Ledger: {reconciliation.orphanDepositLedgerCount ?? 0} · Outbox Queue: {reconciliation.outboxPendingCount ?? 0}
                </span>
              </div>
              {(reconciliation.totalAnomalies ?? reconciliation.mismatches ?? 0) > 0 && (
                <button
                  type="button"
                  disabled={repairingReconciliation}
                  onClick={async () => {
                    setRepairingReconciliation(true);
                    try {
                      const res = await api.repairAdminPaymentReconciliation();
                      if (res?.reconciliation) setReconciliation(res.reconciliation);
                      showToast?.(`Reconciliation repaired (${res?.repairedCount || 0} fixes applied).`);
                      loadAdminData();
                    } catch (err: any) {
                      showToast?.(err?.message || 'Reconciliation repair failed.');
                    } finally {
                      setRepairingReconciliation(false);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {repairingReconciliation ? 'Repairing...' : 'Repair Anomalies'}
                </button>
              )}
            </div>
          )}

          {lastApprovedBanner && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 flex items-start justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-sm">
                    Approval Successful · KES {lastApprovedBanner.amount.toLocaleString()} Credited Automatically
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-200 mt-0.5">
                    M-Pesa Code <strong className="font-mono">{lastApprovedBanner.mpesaCode}</strong> for{' '}
                    <strong>{lastApprovedBanner.userName}</strong> ({lastApprovedBanner.email}) is approved.
                    {typeof lastApprovedBanner.userWalletBalance === 'number' && (
                      <span> Host/User wallet: <strong className="font-mono">KES {lastApprovedBanner.userWalletBalance.toLocaleString()}</strong>.</span>
                    )}
                    {typeof lastApprovedBanner.adminWalletBalance === 'number' && (
                      <span> Admin Wallet: <strong className="font-mono">KES {lastApprovedBanner.adminWalletBalance.toLocaleString()}</strong>.</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLastApprovedBanner(null)}
                className="p-1 rounded-full hover:bg-emerald-200/50 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                aria-label="Dismiss approval confirmation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {paymentsLoadError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{paymentsLoadError}</span>
              </div>
              <button
                type="button"
                onClick={() => loadAdminPayments()}
                className="px-3 py-1 rounded-full bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-500 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Filtering & Search Toolbar */}
          <div className="p-4 bg-stone-50 dark:bg-[#1a1c24] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
            {/* Search & EAT Date/Amount Filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <div className="relative md:col-span-2">
                <input
                  type="text"
                  value={paymentSearch}
                  onChange={e => {
                    setPaymentSearch(e.target.value);
                    setPaymentPage(1);
                  }}
                  placeholder="Search user email, name, M-Pesa code, phone..."
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#12141a] border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-amber-500 transition-colors"
                />
                <CreditCard className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              </div>

              <input
                type="date"
                value={paymentDateFrom}
                onChange={e => {
                  setPaymentDateFrom(e.target.value);
                  setPaymentPage(1);
                }}
                aria-label="Filter from EAT date"
                className="px-3 py-2 bg-white dark:bg-[#12141a] border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-amber-500"
              />
              <input
                type="date"
                value={paymentDateTo}
                onChange={e => {
                  setPaymentDateTo(e.target.value);
                  setPaymentPage(1);
                }}
                aria-label="Filter to EAT date"
                className="px-3 py-2 bg-white dark:bg-[#12141a] border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-amber-500"
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={paymentMinAmount}
                  onChange={e => {
                    setPaymentMinAmount(e.target.value.replace(/[^0-9]/g, ''));
                    setPaymentPage(1);
                  }}
                  placeholder="Min KES"
                  className="w-full px-2.5 py-2 bg-white dark:bg-[#12141a] border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-mono outline-none focus:border-amber-500"
                />
                <input
                  type="number"
                  min={0}
                  value={paymentMaxAmount}
                  onChange={e => {
                    setPaymentMaxAmount(e.target.value.replace(/[^0-9]/g, ''));
                    setPaymentPage(1);
                  }}
                  placeholder="Max KES"
                  className="w-full px-2.5 py-2 bg-white dark:bg-[#12141a] border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-mono outline-none focus:border-amber-500"
                />
              </div>
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
                    onClick={() => {
                      setPaymentStatusFilter(s);
                      setPaymentPage(1);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                      paymentStatusFilter === s
                        ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    {s === 'rejected' ? 'Declined' : s}
                    {s === 'pending' && syncedPendingCount > 0 ? ` (${syncedPendingCount})` : ''}
                  </button>
                ))}
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#12141a] px-2 py-1 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="text-[10px] text-stone-400 font-bold uppercase">Type:</span>
                {(['all', 'deposit', 'boost', 'advert', 'subscription', 'vvvip', 'booking_fee'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setPaymentTypeFilter(t);
                      setPaymentPage(1);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                      paymentTypeFilter === t
                        ? 'bg-[#e4002b] text-white font-black shadow-xs'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    {t === 'booking_fee' ? 'Booking' : t === 'vvvip' ? 'AirBus Plus' : t === 'deposit' ? 'Deposits' : t}
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
                    onClick={() => {
                      setPaymentMethodFilter(m);
                      setPaymentPage(1);
                    }}
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

          {/* Collapsible Payments & Ledger Audit Panel */}
          {showLedgerAuditPanel && (
            <div className="p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-stone-900 dark:text-white">
                    Payments &amp; Ledger Audit ({ledgerAuditTotal} entries)
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    Double-entry wallet ledger synced with M-Pesa deposits, subscriptions, adverts, and refunds (UTC &amp; EAT).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadPaymentsAudit()}
                  className="px-3 py-1 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-bold cursor-pointer"
                >
                  {ledgerAuditLoading ? 'Loading...' : 'Refresh Audit'}
                </button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead className="bg-stone-50 dark:bg-stone-900 text-stone-500 uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Timestamp (EAT / UTC)</th>
                      <th className="px-3 py-2">Type / Purpose</th>
                      <th className="px-3 py-2">From → To Wallet</th>
                      <th className="px-3 py-2">Code / Payment</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {ledgerAuditEntries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-stone-400">
                          No ledger audit entries match the current filters.
                        </td>
                      </tr>
                    ) : (
                      ledgerAuditEntries.map(row => (
                        <tr key={row.id} className="hover:bg-stone-50 dark:hover:bg-stone-900/40">
                          <td className="px-3 py-2 whitespace-nowrap text-stone-600 dark:text-stone-300">
                            <div className="font-semibold">{row.timestampEat}</div>
                            <div className="text-[10px] font-mono text-stone-400">{row.timestampUtcIso}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-bold uppercase text-stone-900 dark:text-white">{row.type}</span>
                            <div className="text-[10px] text-stone-500">{row.purposeLabel}</div>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-stone-700 dark:text-stone-300">
                            {row.fromWallet} → {row.toWallet}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px]">
                            <div className="font-bold text-stone-900 dark:text-white">{row.paymentCode}</div>
                            <div className="text-[10px] text-stone-400">{row.relatedPaymentId || row.id}</div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            KES {Number(row.amount || 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-stone-500">
                            {row.approvingAdmin}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {ledgerAuditTotalPages > 1 && (
                <div className="flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    disabled={ledgerAuditPage <= 1}
                    onClick={() => setLedgerAuditPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-700 disabled:opacity-40 cursor-pointer"
                  >
                    Prev
                  </button>
                  <span className="text-stone-500">Page {ledgerAuditPage} of {ledgerAuditTotalPages}</span>
                  <button
                    type="button"
                    disabled={ledgerAuditPage >= ledgerAuditTotalPages}
                    onClick={() => setLedgerAuditPage(p => Math.min(ledgerAuditTotalPages, p + 1))}
                    className="px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-700 disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Payment Records List (Server-Side Filtered & Paginated) */}
          {(() => {
            const rowsToRender = adminPaymentsRows;

            if (paymentsLoading && rowsToRender.length === 0) {
              return (
                <div className="p-10 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 text-xs text-stone-400">
                  Loading payments queue...
                </div>
              );
            }

            if (rowsToRender.length === 0) {
              return (
                <div className="p-12 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-300 dark:border-stone-800 text-xs text-stone-400">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  No payment records found matching the current filters.
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {rowsToRender.map(p => {
                  const canon =
                    p.canonicalStatus ||
                    (p.status === 'approved'
                      ? PaymentStatus.APPROVED
                      : p.status === 'rejected'
                      ? PaymentStatus.DECLINED
                      : p.status === 'refunded'
                      ? PaymentStatus.REFUNDED
                      : PaymentStatus.PENDING);
                  const isPending = canon === PaymentStatus.PENDING || p.status === 'pending';
                  const isApproved = canon === PaymentStatus.APPROVED || p.status === 'approved';
                  const amountDisplay = Number(p.claimedAmount ?? p.amountKes ?? p.amountSc ?? p.amount ?? 0);
                  const isHostPayment = p.userRole === 'owner' || (p.userRole as string) === 'host';
                  const isRowBusy = approvingPaymentId === p.id;
                  const alreadyRefunded = Number(p.refundAmount || 0);
                  const remainingRefundable = Math.max(0, amountDisplay - alreadyRefunded);

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
                          {/* Canonical Status Badge */}
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                              isPending
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 animate-pulse'
                                : isApproved
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : canon === PaymentStatus.REFUNDED
                                ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300'
                                : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {canon}
                          </span>

                          {/* Role Badge */}
                          {p.userRole && (
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isHostPayment
                                  ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                                  : 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300'
                              }`}
                            >
                              {isHostPayment ? 'Host' : p.userRole}
                            </span>
                          )}

                          {/* Type Badge */}
                          <span className="text-[10px] font-black uppercase bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded-full">
                            {isDepositRecord(p) ? 'M-Pesa Deposit' : (p.type || p.kind || 'Payment')}
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
                            <span>{p.method === 'mpesa_manual' ? 'M-Pesa' : (p.method || 'M-Pesa')}</span>
                          </span>

                          {/* Amount */}
                          <span className="text-sm font-black text-stone-900 dark:text-white font-mono">
                            KES {amountDisplay.toLocaleString()}
                          </span>
                        </div>

                        {/* User & Reference info */}
                        <div className="text-xs text-stone-700 dark:text-stone-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            {isHostPayment ? 'Merchant/Host' : 'User'}:{' '}
                            <strong className="text-stone-900 dark:text-white">
                              {p.userName ? `${p.userName} (${p.userId || p.hostEmail})` : (p.userId || p.hostEmail)}
                            </strong>
                          </span>
                          {(p.phone || p.phoneNumber) && (
                            <span className="text-stone-500">
                              Phone: <strong className="font-mono text-stone-700 dark:text-stone-200">{p.phone || p.phoneNumber}</strong>
                            </span>
                          )}
                          {p.purposeLabel && (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              Purpose: {p.purposeLabel}
                            </span>
                          )}
                          {p.planTier && (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                              Tier: {p.planTier} ({p.period || (p.durationDays && p.durationDays > 30 ? '365d' : '30d')})
                            </span>
                          )}
                        </div>

                        {/* Receipt Code, Ledger Link and EAT Dates */}
                        <div className="text-[11px] text-stone-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {p.mpesaCode && (
                            <span>
                              M-Pesa Code:{' '}
                              <span className="font-mono font-bold text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">
                                {p.mpesaCode}
                              </span>
                            </span>
                          )}
                          <span>Submitted: {formatEATDateTime(p.submittedAt || p.createdAt)}</span>
                          {p.approvedAt && <span>Approved: {formatEATDateTime(p.approvedAt)}</span>}
                          {(p.creditLedgerId || p.credit_ledger_id) && (
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">
                              Ledger: {p.creditLedgerId || p.credit_ledger_id}
                            </span>
                          )}
                          {(p.refundReference || p.refundLedgerId) && (
                            <span className="font-mono text-sky-600 dark:text-sky-400">
                              Refund Ref: {p.refundReference || p.refundLedgerId}
                            </span>
                          )}
                        </div>

                        {/* Decline or Refund notice */}
                        {(p.declineReason || p.rejectionReason) && (
                          <div className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2 rounded-xl">
                            <strong>Decline Reason: </strong>{p.declineReason || p.rejectionReason}
                          </div>
                        )}
                        {p.refundReason && (
                          <div className="text-[11px] text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 p-2 rounded-xl">
                            <strong>Refunded KES {alreadyRefunded.toLocaleString()}: </strong>{p.refundReason}
                          </div>
                        )}
                      </div>

                      {/* Context-Aware Action Buttons */}
                      {isPending && (
                        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100 dark:border-stone-800">
                          <button
                            type="button"
                            disabled={processingPayment || isRowBusy}
                            onClick={() => {
                              setPaymentModalError(null);
                              setApproveModalPayment(p);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{isRowBusy ? 'Approving...' : 'Approve & Activate'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={processingPayment || isRowBusy}
                            onClick={() => {
                              setPaymentModalError(null);
                              setRejectModalPayment(p);
                              setRejectReason('Unverified M-Pesa confirmation receipt details.');
                            }}
                            className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-rose-100 text-rose-600 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Decline</span>
                          </button>
                        </div>
                      )}

                      {isApproved && remainingRefundable > 0 && (
                        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100 dark:border-stone-800">
                          <button
                            type="button"
                            onClick={() => {
                              setRefundError(null);
                              setRefundModalPayment(p);
                              setRefundAmountInput(String(remainingRefundable));
                              setRefundReason('');
                              setRefundAdminPassword('');
                            }}
                            className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-sky-100 dark:hover:bg-sky-950/60 text-sky-700 dark:text-sky-300 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Refund</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {paymentTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2 text-xs text-stone-500">
                    <span>
                      Showing page {paymentPage} of {paymentTotalPages} ({paymentTotalCount} matching records)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={paymentPage <= 1}
                        onClick={() => setPaymentPage(p => Math.max(1, p - 1))}
                        className="px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 font-bold disabled:opacity-40 cursor-pointer"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={paymentPage >= paymentTotalPages}
                        onClick={() => setPaymentPage(p => Math.min(paymentTotalPages, p + 1))}
                        className="px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 font-bold disabled:opacity-40 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      )}

      {/* TAB: GUEST WALLET & HOST WALLET MANAGEMENT */}
      {tab === 'wallets' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-200 dark:border-stone-800">
            <div>
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-500" />
                <span>Guest Wallet &amp; Host Wallet Control</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Inspect private Guest and Host wallets and approve or decline M-Pesa Till 943210 deposit claims in real time.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAdminData}
              className="self-start sm:self-auto px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
              <span>Refresh Wallets</span>
            </button>
          </div>

          {/* Summary KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800">
              <div className="text-[10px] font-bold uppercase text-stone-400">Guest Wallets Total</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                KES {adminWalletsData.guestWallets.reduce((s, w) => s + w.balance, 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-stone-500">{adminWalletsData.guestWallets.length} guest accounts</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800">
              <div className="text-[10px] font-bold uppercase text-stone-400">Pending Guest Deposits</div>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {adminWalletsData.guestDeposits.filter(d => d.status === 'pending').length}
              </div>
              <div className="text-[11px] text-stone-500">Till 943210 claims</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800">
              <div className="text-[10px] font-bold uppercase text-stone-400">Host Wallets Total</div>
              <div className="text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">
                KES {adminWalletsData.hostWallets.reduce((s, w) => s + w.balance, 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-stone-500">{adminWalletsData.hostWallets.length} host accounts</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800">
              <div className="text-[10px] font-bold uppercase text-stone-400">Pending Host Deposits</div>
              <div className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {adminWalletsData.hostDeposits.filter(d => d.status === 'pending').length}
              </div>
              <div className="text-[11px] text-stone-500">Till 943210 claims</div>
            </div>
          </div>

          {/* SECTION 1: GUEST WALLET & DEPOSITS */}
          <div className="p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase">
                  Guest Wallet
                </span>
                <span>Guest Till 943210 Deposits &amp; Balances</span>
              </h4>
            </div>

            {adminWalletsData.guestDeposits.length === 0 ? (
              <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-400 text-center">
                No Guest wallet deposits recorded yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {adminWalletsData.guestDeposits.map(dep => (
                  <div
                    key={dep.id}
                    className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      dep.status === 'pending'
                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/70'
                        : 'bg-stone-50 dark:bg-stone-900/60 border-stone-200 dark:border-stone-800'
                    }`}
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            dep.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : dep.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {dep.status}
                        </span>
                        <span className="font-black text-stone-900 dark:text-white font-mono">
                          KES {(dep.claimedAmount || dep.amount).toLocaleString()}
                        </span>
                        {dep.mpesaCode && (
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200">
                            Till Receipt: {dep.mpesaCode}
                          </span>
                        )}
                      </div>
                      <div className="text-stone-600 dark:text-stone-300">
                        Guest: <strong className="text-stone-900 dark:text-white">{dep.userName || dep.userId || dep.hostEmail}</strong>{' '}
                        <span className="text-stone-400 font-mono">({dep.userId || dep.hostEmail})</span>
                      </div>
                      <div className="text-[11px] text-stone-400">
                        Submitted: {new Date(dep.createdAt).toLocaleString()}
                      </div>
                    </div>

                    {dep.status === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModalError(null);
                            setApproveModalPayment(dep);
                          }}
                          className="px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve &amp; Credit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModalError(null);
                            setRejectModalPayment(dep);
                            setRejectReason('Unverified M-Pesa Till 943210 deposit code.');
                          }}
                          className="px-3.5 py-2 rounded-full bg-stone-200 dark:bg-stone-800 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {adminWalletsData.guestWallets.length > 0 && (
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-xs min-w-[540px]">
                  <thead className="border-b border-stone-200 dark:border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                    <tr>
                      <th className="py-2 px-3">Guest Account</th>
                      <th className="py-2 px-3">Username</th>
                      <th className="py-2 px-3">Balance</th>
                      <th className="py-2 px-3">On Hold</th>
                      <th className="py-2 px-3">Available</th>
                      <th className="py-2 px-3">Lifetime Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {adminWalletsData.guestWallets.map(w => (
                      <tr key={w.email}>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-stone-900 dark:text-white">{w.name}</div>
                          <div className="text-[11px] text-stone-400 font-mono">{w.email}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-stone-600 dark:text-stone-300">{w.username}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          KES {Number(w.balance ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-amber-600">KES {Number(w.holdBalance ?? 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-stone-900 dark:text-white">
                          KES {Number(w.available ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-stone-500">KES {Number(w.lifetimeSpent ?? 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 2: HOST WALLET & DEPOSITS */}
          <div className="p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase">
                  Host Wallet
                </span>
                <span>Host Till 943210 Deposits &amp; Balances</span>
              </h4>
            </div>

            {adminWalletsData.hostDeposits.length === 0 ? (
              <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-400 text-center">
                No Host wallet deposits recorded yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {adminWalletsData.hostDeposits.map(dep => (
                  <div
                    key={dep.id}
                    className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      dep.status === 'pending'
                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/70'
                        : 'bg-stone-50 dark:bg-stone-900/60 border-stone-200 dark:border-stone-800'
                    }`}
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            dep.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : dep.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {dep.status}
                        </span>
                        <span className="font-black text-stone-900 dark:text-white font-mono">
                          KES {(dep.claimedAmount || dep.amount).toLocaleString()}
                        </span>
                        {dep.mpesaCode && (
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200">
                            Till Receipt: {dep.mpesaCode}
                          </span>
                        )}
                      </div>
                      <div className="text-stone-600 dark:text-stone-300">
                        Host: <strong className="text-stone-900 dark:text-white">{dep.userName || dep.userId || dep.hostEmail}</strong>{' '}
                        <span className="text-stone-400 font-mono">({dep.userId || dep.hostEmail})</span>
                      </div>
                      <div className="text-[11px] text-stone-400">
                        Submitted: {new Date(dep.createdAt).toLocaleString()}
                      </div>
                    </div>

                    {dep.status === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModalError(null);
                            setApproveModalPayment(dep);
                          }}
                          className="px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve &amp; Credit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModalError(null);
                            setRejectModalPayment(dep);
                            setRejectReason('Unverified M-Pesa Till 943210 deposit code.');
                          }}
                          className="px-3.5 py-2 rounded-full bg-stone-200 dark:bg-stone-800 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {adminWalletsData.hostWallets.length > 0 && (
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-xs min-w-[540px]">
                  <thead className="border-b border-stone-200 dark:border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                    <tr>
                      <th className="py-2 px-3">Host Account</th>
                      <th className="py-2 px-3">Username</th>
                      <th className="py-2 px-3">Balance</th>
                      <th className="py-2 px-3">On Hold</th>
                      <th className="py-2 px-3">Available</th>
                      <th className="py-2 px-3">Lifetime Earnings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {adminWalletsData.hostWallets.map(w => (
                      <tr key={w.email}>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-stone-900 dark:text-white">{w.name}</div>
                          <div className="text-[11px] text-stone-400 font-mono">{w.email}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-stone-600 dark:text-stone-300">{w.username}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                          KES {Number(w.balance ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-amber-600">KES {Number(w.holdBalance ?? 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-stone-900 dark:text-white">
                          KES {Number(w.available ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-stone-500">KES {Number(w.lifetimeEarnings ?? 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
                    value={settings.planPrices?.Silver ?? 1000}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        planPrices: {
                          ...(settings.planPrices || { Silver: 1000, Diamond: 2500, Gold: 5000 }),
                          Silver: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-400 uppercase font-semibold">Diamond Plan</label>
                  <input
                    type="number"
                    value={settings.planPrices?.Diamond ?? 2500}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        planPrices: {
                          ...(settings.planPrices || { Silver: 1000, Diamond: 2500, Gold: 5000 }),
                          Diamond: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-400 uppercase font-semibold">Gold Plan</label>
                  <input
                    type="number"
                    value={settings.planPrices?.Gold ?? 5000}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        planPrices: {
                          ...(settings.planPrices || { Silver: 1000, Diamond: 2500, Gold: 5000 }),
                          Gold: Number(e.target.value),
                        },
                      })
                    }
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

          {/* SECTION 3: RESTORE ADMIN TO FACTORY SETTINGS */}
          <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
            <div>
              <h3 className="text-base font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                <span>Restore Admin to Factory Settings</span>
              </h3>
              <p className="text-xs text-stone-500">
                Reset Administrator account credentials, Platform Settings, and Admin Wallet (or full seeded baseline) back to original factory status.
              </p>
            </div>

            <form
              onSubmit={handleRestoreAdminFactorySettings}
              className="p-5 sm:p-6 bg-rose-50/40 dark:bg-rose-950/15 rounded-3xl border border-rose-200 dark:border-rose-900/50 shadow-sm space-y-4 text-xs"
            >
              {factoryResetSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-2xl text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{factoryResetSuccess}</span>
                </div>
              )}
              {factoryResetError && (
                <div className="p-3 bg-rose-100 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 rounded-2xl text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{factoryResetError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                    factoryResetScope === 'full_factory'
                      ? 'bg-white dark:bg-stone-900 border-rose-500 shadow-sm'
                      : 'bg-white/60 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="factoryScope"
                    checked={factoryResetScope === 'full_factory'}
                    onChange={() => setFactoryResetScope('full_factory')}
                    className="mt-0.5 accent-rose-600"
                  />
                  <div>
                    <div className="font-extrabold text-stone-900 dark:text-white">Full Factory Baseline</div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      Restores Admin credentials, Platform Settings, Admin Wallet (KES 2,800), and resets all queues/ledgers to original seed data.
                    </div>
                  </div>
                </label>

                <label
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                    factoryResetScope === 'admin_only'
                      ? 'bg-white dark:bg-stone-900 border-rose-500 shadow-sm'
                      : 'bg-white/60 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="factoryScope"
                    checked={factoryResetScope === 'admin_only'}
                    onChange={() => setFactoryResetScope('admin_only')}
                    className="mt-0.5 accent-rose-600"
                  />
                  <div>
                    <div className="font-extrabold text-stone-900 dark:text-white">Admin Only (Keep Listings &amp; Users)</div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      Restores master Admin account, Platform Settings, and Admin Wallet (KES 2,800) while preserving existing hosts, guests, and stays.
                    </div>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Confirm Current Administrator Password
                  </label>
                  <input
                    type="password"
                    value={factoryResetPassword}
                    onChange={e => setFactoryResetPassword(e.target.value)}
                    placeholder="Enter current admin password"
                    className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-medium text-xs text-stone-900 dark:text-white"
                    required
                  />
                </div>

                <label className="flex items-center gap-2 text-stone-700 dark:text-stone-300 font-semibold cursor-pointer py-2">
                  <input
                    type="checkbox"
                    checked={factoryResetConfirmed}
                    onChange={e => setFactoryResetConfirmed(e.target.checked)}
                    className="rounded accent-rose-600"
                  />
                  <span>I confirm restoring Admin to original factory settings</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={factoryResetLoading}
                className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${factoryResetLoading ? 'animate-spin' : ''}`} />
                <span>{factoryResetLoading ? 'Restoring Factory Settings...' : 'Restore Admin to Factory Settings'}</span>
              </button>
            </form>
          </div>
    </div>
  )}

      {/* TAB: ADMIN WALLET (GRAND WALLET · EAT Africa/Nairobi Reporting) */}
      {tab === 'treasury' && (
        <div className="space-y-5">
          {/* Header Banner & Action Bar (NO default withdraw or refund buttons — only gated Special Refund) */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-stone-950 via-stone-900 to-emerald-950/70 text-white border border-emerald-500/30 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  Grand Wallet · Africa/Nairobi (EAT)
                </span>
                <span className="text-[11px] text-stone-400 font-mono">
                  Account: admin@airbus.ke
                </span>
              </div>
              <h3 className="text-xl font-extrabold font-heading">Admin Wallet &amp; Fiscal Ledger</h3>
              <p className="text-xs text-stone-300 mt-0.5">
                Single atomic source of truth for all approved deposits, subscriptions, adverts, AirBus Plus, and Trip Dating unlocks.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const csv = await api.exportAdminWalletCsv({
                      q: awSearch || undefined,
                      purpose: awPurpose,
                      role: awRole,
                      sourceKind: awKind,
                      fiscalYear: awFiscalYear ? Number(awFiscalYear) : undefined,
                      from: awFrom || undefined,
                      to: awTo || undefined,
                    });
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `airbus-admin-wallet-${awFiscalYear || 'all'}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast?.('Admin Wallet CSV exported.');
                  } catch (err: any) {
                    showToast?.(err.message || 'Export failed');
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSpecialRefundError(null);
                  setSpecialRefundOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 border border-rose-400/40 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Special Refund (Gated)</span>
              </button>
            </div>
          </div>

          {/* Core Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Admin Wallet Cash Balance</span>
              <div className="text-2xl font-black text-stone-900 dark:text-white mt-1">
                KES {(awSummary?.adminWalletBalance ?? reconciliation?.adminBalance ?? treasuryWallet?.balance ?? 0).toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
                {awSummary?.reconciliation?.mismatches === 0 || (reconciliation?.mismatches ?? 0) === 0
                  ? '0 reconciliation drift'
                  : `${awSummary?.reconciliation?.mismatches ?? reconciliation?.mismatches} drift warning`}
              </span>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">
                YTD Approved Deposits ({awSummary?.selectedFiscalYear ?? new Date().getUTCFullYear()} EAT)
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                KES {(awSummary?.yearToDate?.approvedDeposits ?? 0).toLocaleString()}
              </div>
              <span className="text-[10px] text-stone-400 mt-1 block">
                Approved user wallet top-ups
              </span>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">
                YTD Service Revenue (EAT)
              </span>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                KES {(awSummary?.yearToDate?.serviceRevenue ?? incomeReport?.totalRevenue ?? 0).toLocaleString()}
              </div>
              <span className="text-[10px] text-stone-400 mt-1 block">
                Subs, Ads, Plus &amp; Dating Unlocks
              </span>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Carry-Forward Opening</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                KES {(awSummary?.carryForwardBalance ?? 0).toLocaleString()}
              </div>
              <span className="text-[10px] text-stone-400 mt-1 block">
                From prior closed EAT fiscal year
              </span>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Special Refunds (YTD)</span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                KES {(awSummary?.yearToDate?.specialRefunds ?? 0).toLocaleString()}
              </div>
              <span className="text-[10px] text-stone-400 mt-1 block">
                Excess-only gated refunds
              </span>
            </div>
          </div>

          {lastApprovedBanner && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 flex items-start justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-sm">
                    Approval Successful · KES {lastApprovedBanner.amount.toLocaleString()} Credited Automatically
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-200 mt-0.5">
                    M-Pesa Code <strong className="font-mono">{lastApprovedBanner.mpesaCode}</strong> for{' '}
                    <strong>{lastApprovedBanner.userName}</strong> ({lastApprovedBanner.email}) has been approved.
                    {typeof lastApprovedBanner.userWalletBalance === 'number' && (
                      <span> User/Host Wallet now: <strong className="font-mono">KES {lastApprovedBanner.userWalletBalance.toLocaleString()}</strong>.</span>
                    )}
                    {typeof lastApprovedBanner.adminWalletBalance === 'number' && (
                      <span> Admin Wallet Cash Balance: <strong className="font-mono">KES {lastApprovedBanner.adminWalletBalance.toLocaleString()}</strong>.</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLastApprovedBanner(null)}
                className="p-1 rounded-full hover:bg-emerald-200/50 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                aria-label="Dismiss approval notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* PAYMENTS SECTION: PENDING PAYMENTS TABLE (Live M-Pesa Deposit Approval Queue inside Admin Wallet) */}
          <div className="p-5 sm:p-6 bg-white dark:bg-[#15171e] rounded-3xl border border-amber-300/70 dark:border-amber-800/60 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-500" />
                  <h4 className="text-sm font-extrabold text-stone-900 dark:text-white uppercase tracking-wider">
                    Payments — Pending Payments ({pendingPayments.length})
                  </h4>
                  {pendingPayments.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase">
                      Awaiting Approval
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Review submitted M-Pesa deposit codes and exact integer KES amounts. Approving credits the Host or Guest wallet automatically in real time and records the entry in the Admin Wallet ledger.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={loadAdminData}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-bold flex items-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
                  <span>Sync Pending</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('queue')}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-bold text-stone-700 dark:text-stone-200 cursor-pointer"
                >
                  Full Payments Audit
                </button>
              </div>
            </div>

            {pendingPayments.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-500">
                No pending M-Pesa deposits or payments waiting right now. New submissions appear here automatically.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800">
                <table className="w-full text-left text-xs min-w-[740px]">
                  <thead className="bg-stone-50 dark:bg-stone-900 text-stone-500 uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2.5">Submitted (EAT)</th>
                      <th className="px-3 py-2.5">User / Host</th>
                      <th className="px-3 py-2.5">Type / Method</th>
                      <th className="px-3 py-2.5">M-Pesa Code</th>
                      <th className="px-3 py-2.5 text-right">Amount (KES)</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {pendingPayments.map(p => {
                      const amountDisplay = Number(p.claimedAmount ?? p.amountKes ?? p.amountSc ?? p.amount ?? 0);
                      const isHostPayment = p.userRole === 'owner' || (p.userRole as string) === 'host';
                      const isRowBusy = approvingPaymentId === p.id;
                      return (
                        <tr key={p.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/10">
                          <td className="px-3 py-3 whitespace-nowrap text-stone-600 dark:text-stone-300">
                            <div className="font-semibold">{formatEATDateTime(p.createdAt)} EAT</div>
                            <div className="text-[10px] font-mono text-stone-400">{p.id}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                              <span>{p.userName || p.userId || p.hostEmail}</span>
                              {p.userRole && (
                                <span
                                  className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                    isHostPayment
                                      ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                                      : 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300'
                                  }`}
                                >
                                  {isHostPayment ? 'Host' : p.userRole}
                                </span>
                              )}
                            </div>
                              <div className="text-[11px] font-mono text-stone-500">
                                {p.userId || p.hostEmail}
                                {(p.phone || p.phoneNumber) ? ` · ${p.phone || p.phoneNumber}` : ''}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200">
                                {isDepositRecord(p) ? 'M-Pesa Deposit' : (p.type || p.kind || 'deposit')}
                              </span>
                              <div className="text-[10px] text-stone-500 mt-0.5">
                                {p.purposeLabel || (p.method === 'mpesa_manual' ? 'M-Pesa' : p.method || 'M-Pesa')}
                              </div>
                            </td>
                            <td className="px-3 py-3 font-mono font-black text-stone-900 dark:text-white tracking-wider">
                              {p.mpesaCode || p.referenceId || p.reference || '—'}
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              KES {amountDisplay.toLocaleString()}
                            </td>
                            <td className="px-3 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                                {p.canonicalStatus || p.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={processingPayment || isRowBusy}
                                  onClick={() => handleApprovePaymentRecord(p)}
                                  className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold shadow-xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{isRowBusy ? 'Approving...' : 'Approve'}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={processingPayment || isRowBusy}
                                  onClick={() => {
                                    setPaymentModalError(null);
                                    setRejectModalPayment(p);
                                    setRejectReason('Unverified M-Pesa confirmation receipt details.');
                                  }}
                                  className="px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-rose-100 text-rose-600 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                >
                                  Decline
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

          {/* EAT Granularity Controls & Date Range Filter */}
          <div className="p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                <h4 className="text-sm font-extrabold text-stone-900 dark:text-white">
                  Totals Over Time (Africa/Nairobi EAT)
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center bg-stone-100 dark:bg-stone-900 p-1 rounded-xl border border-stone-200 dark:border-stone-800">
                  {(['hour', 'day', 'month', 'year'] as const).map(gran => (
                    <button
                      key={gran}
                      type="button"
                      onClick={() => setAwGranularity(gran)}
                      className={`px-3 py-1 rounded-lg font-bold capitalize transition cursor-pointer ${
                        awGranularity === gran
                          ? 'bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                      }`}
                    >
                      {gran}
                    </button>
                  ))}
                </div>

                <select
                  value={awFiscalYear}
                  onChange={e => {
                    setAwFiscalYear(e.target.value ? Number(e.target.value) : '');
                    setAwPage(1);
                  }}
                  aria-label="Filter by Fiscal Year"
                  className="px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 font-semibold"
                >
                  <option value="">All EAT Years</option>
                  {Array.from(
                    new Set([
                      awSummary?.currentEatYear || new Date().getUTCFullYear(),
                      ...awArchives.map(a => a.fiscalYear),
                    ])
                  )
                    .sort((a, b) => b - a)
                    .map(y => (
                      <option key={y} value={y}>
                        FY {y} (EAT)
                      </option>
                    ))}
                </select>

                <input
                  type="date"
                  value={awFrom}
                  onChange={e => {
                    setAwFrom(e.target.value);
                    setAwPage(1);
                  }}
                  aria-label="From date (EAT)"
                  className="px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
                />
                <span className="text-stone-400">to</span>
                <input
                  type="date"
                  value={awTo}
                  onChange={e => {
                    setAwTo(e.target.value);
                    setAwPage(1);
                  }}
                  aria-label="To date (EAT)"
                  className="px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
                />
                {(awFrom || awTo || awFiscalYear) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAwFrom('');
                      setAwTo('');
                      setAwFiscalYear('');
                      setAwPage(1);
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Visual Bar Chart + Table */}
            {awTotals.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-400 bg-stone-50 dark:bg-stone-900/50 rounded-2xl">
                No EAT wallet rollup entries match this period yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-2.5">
                  <div className="text-[11px] font-bold text-stone-500 uppercase">
                    Recent {awGranularity} Net Totals (EAT)
                  </div>
                  {(() => {
                    const topBuckets = awTotals.slice(0, 10);
                    const maxVal = Math.max(1, ...topBuckets.map(b => Math.max(b.inflow, Math.abs(b.net))));
                    return topBuckets.map(bucket => {
                      const pct = Math.max(4, Math.round((Math.max(0, bucket.net) / maxVal) * 100));
                      return (
                        <div key={bucket.key} className="space-y-1 text-[11px]">
                          <div className="flex justify-between font-semibold text-stone-700 dark:text-stone-300">
                            <span className="font-mono">{bucket.key}</span>
                            <span>
                              KES {bucket.net.toLocaleString()} ({bucket.count} tx)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 dark:bg-stone-900 text-stone-500 uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Period (EAT)</th>
                        <th className="px-3 py-2">Credits</th>
                        <th className="px-3 py-2">Refunds</th>
                        <th className="px-3 py-2">Net</th>
                        <th className="px-3 py-2">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                      {awTotals.slice(0, 12).map(b => (
                        <tr key={b.key}>
                          <td className="px-3 py-2 font-mono font-semibold text-stone-800 dark:text-stone-200">{b.key}</td>
                          <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-bold">
                            +{b.inflow.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-rose-600 dark:text-rose-400">
                            {b.refunds > 0 ? `-${b.refunds.toLocaleString()}` : '0'}
                          </td>
                          <td className="px-3 py-2 font-black text-stone-900 dark:text-white">
                            KES {b.net.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-stone-500">{b.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Breakdown by Purpose */}
          <div className="p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
            <h4 className="text-sm font-extrabold text-stone-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
              <span>Period Breakdown by Purpose (EAT)</span>
              <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                Period Total: KES {(awBreakdown?.grandTotal ?? 0).toLocaleString()}
              </span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1 text-xs">
              {(
                [
                  { key: 'SUBSCRIPTION', label: 'Host Subscriptions', color: 'text-amber-600 dark:text-amber-400' },
                  { key: 'ADVERTISING', label: 'Advertising & Boosts', color: 'text-purple-600 dark:text-purple-400' },
                  { key: 'TRIP_DATING', label: 'Trip Dating Unlocks', color: 'text-[#ff2e93]' },
                  { key: 'AIRBUS_PLUS', label: 'AirBus Plus VVVIP', color: 'text-yellow-600 dark:text-yellow-400' },
                  { key: 'OTHER', label: 'Wallet Top-Ups & Other', color: 'text-emerald-600 dark:text-emerald-400' },
                ] as const
              ).map(p => {
                const stat = awBreakdown?.breakdown?.[p.key] || { amount: 0, count: 0 };
                return (
                  <div
                    key={p.key}
                    className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-1"
                  >
                    <div className="font-bold text-stone-800 dark:text-stone-200">{p.label}</div>
                    <div className={`text-xl font-black ${p.color}`}>
                      KES {stat.amount.toLocaleString()}
                    </div>
                    <p className="text-[10px] text-stone-500">{stat.count} ledger entries</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Searchable, Filterable & Paginated Admin Wallet Ledger */}
          <div className="p-5 sm:p-6 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-stone-900 dark:text-white uppercase tracking-wider">
                  Admin Wallet Audit Ledger ({awLedger.total} entries)
                </h4>
                <p className="text-[11px] text-stone-500">
                  Records depositor name/ID/role, UTC &amp; EAT timestamps, unique payment code, integer KES, purpose, and approving admin.
                </p>
              </div>
              <button
                type="button"
                onClick={loadAdminWalletAnalytics}
                className="self-start px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-bold flex items-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${awLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={awSearch}
                  onChange={e => {
                    setAwSearch(e.target.value);
                    setAwPage(1);
                  }}
                  placeholder="Search code, depositor, admin..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={awPurpose}
                onChange={e => {
                  setAwPurpose(e.target.value);
                  setAwPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 font-semibold"
              >
                <option value="ALL">All Purposes</option>
                <option value="SUBSCRIPTION">SUBSCRIPTION</option>
                <option value="ADVERTISING">ADVERTISING</option>
                <option value="TRIP_DATING">TRIP_DATING</option>
                <option value="AIRBUS_PLUS">AIRBUS_PLUS</option>
                <option value="OTHER">OTHER</option>
              </select>

              <select
                value={awRole}
                onChange={e => {
                  setAwRole(e.target.value);
                  setAwPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 font-semibold"
              >
                <option value="ALL">All Depositor Roles</option>
                <option value="owner">Host (owner)</option>
                <option value="guest">Guest</option>
                <option value="admin">Admin</option>
              </select>

              <select
                value={awKind}
                onChange={e => {
                  setAwKind(e.target.value);
                  setAwPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 font-semibold"
              >
                <option value="ALL">All Entry Types</option>
                <option value="APPROVED_DEPOSIT">Approved Deposits</option>
                <option value="SERVICE_PAYMENT">Service Payments</option>
                <option value="SPECIAL_REFUND">Special Refunds</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 dark:bg-stone-900 text-stone-500 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Timestamp (EAT / UTC)</th>
                    <th className="px-3 py-2.5">Depositor</th>
                    <th className="px-3 py-2.5">Payment Code</th>
                    <th className="px-3 py-2.5">Purpose</th>
                    <th className="px-3 py-2.5">Approving Admin</th>
                    <th className="px-3 py-2.5 text-right">Amount (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {awLedger.entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-stone-400">
                        No Admin Wallet ledger entries found for these filters.
                      </td>
                    </tr>
                  ) : (
                    awLedger.entries.map(entry => (
                      <tr key={entry.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-900/40">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-semibold text-stone-800 dark:text-stone-200">
                            {formatEATDateTime(entry.timestampUtc)} EAT
                          </div>
                          <div className="text-[10px] font-mono text-stone-400">
                            {new Date(entry.timestampUtc).toISOString()}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-stone-900 dark:text-white">{entry.depositorName}</div>
                          <div className="text-[10px] text-stone-500 font-mono">
                            {entry.depositorId} · {entry.depositorRole}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-stone-800 dark:text-stone-200">
                          {entry.paymentCode}
                          {entry.originalPaymentCode && (
                            <div className="text-[10px] text-rose-500">Orig: {entry.originalPaymentCode}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                            {entry.purpose}
                          </span>
                          <div className="text-[10px] text-stone-500 mt-0.5 max-w-xs truncate">
                            {entry.description}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-stone-600 dark:text-stone-300">
                          {entry.approvingAdmin}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-black whitespace-nowrap ${
                            entry.amount < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {entry.amount < 0 ? '-' : '+'}KES {Math.abs(entry.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {awLedger.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 text-xs">
                <span className="text-stone-500">
                  Page {awLedger.page} of {awLedger.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={awLedger.page <= 1}
                    onClick={() => setAwPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-700 font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={awLedger.page >= awLedger.totalPages}
                    onClick={() => setAwPage(p => p + 1)}
                    className="px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-700 font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Year-End Fiscal Archives (Jan 1 00:00 EAT) */}
          <div className="p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
                  <Archive className="w-4 h-4 text-amber-500" />
                  <span>Year-End Fiscal Archives (Africa/Nairobi EAT · Jan 1 00:00)</span>
                </h4>
                <p className="text-[11px] text-stone-500">
                  Annual statements preserve monthly &amp; purpose totals, transaction counts, carry-forward opening balances, and SHA-256 checksums.
                </p>
              </div>
              <button
                type="button"
                disabled={awArchiveRunning}
                onClick={async () => {
                  setAwArchiveRunning(true);
                  try {
                    const prevYear = (awSummary?.currentEatYear || new Date().getUTCFullYear()) - 1;
                    const res = await api.runAdminWalletArchive(prevYear);
                    showToast?.(`Fiscal year ${res.archive.fiscalYear} EAT archive verified (Checksum ${res.archive.checksum}).`);
                    loadAdminWalletAnalytics();
                  } catch (err: any) {
                    showToast?.(err.message || 'Archive check failed.');
                  } finally {
                    setAwArchiveRunning(false);
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-stone-900 dark:bg-stone-800 text-white text-xs font-bold hover:opacity-90 cursor-pointer disabled:opacity-50"
              >
                {awArchiveRunning ? 'Running Archive...' : 'Verify / Run Prior-Year Archive'}
              </button>
            </div>

            {awArchives.length === 0 ? (
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/50 text-xs text-stone-500">
                No prior fiscal years have closed yet. Prior-year records automatically archive on Jan 1 00:00 EAT with balance carry-forward.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {awArchives.map(arch => (
                  <div
                    key={arch.id}
                    className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-stone-900 dark:text-white text-sm">
                        Fiscal Year {arch.fiscalYear} (EAT)
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        SHA256: {arch.checksum}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-stone-400 block">Opening Carry-Forward</span>
                        <span className="font-bold">KES {arch.openingCarryForward.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Closing Carry-Forward</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                          KES {arch.closingBalance.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Net Period Flow</span>
                        <span className="font-bold">KES {arch.netTotal.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Transactions</span>
                        <span className="font-bold">{arch.transactionCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                    {s.location} · KES {Number(s.price ?? 0).toLocaleString()}/night · {s.guests ?? 0} guests · Rating: {s.rating ?? 0} ★ ({s.reviewsCount ?? 0})
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
                    api
                      .getAdminListingMedia({ type: f.id, flaggedOnly: mediaFlaggedOnly, search: mediaSearch }, 'admin')
                      .then(res => setListingMediaList(res.media || []))
                      .catch(() => {});
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
                  api
                    .getAdminListingMedia({ type: mediaTypeFilter, flaggedOnly: next, search: mediaSearch }, 'admin')
                    .then(res => setListingMediaList(res.media || []))
                    .catch(() => {});
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
                    api
                      .getAdminListingMedia({ type: mediaTypeFilter, flaggedOnly: mediaFlaggedOnly, search: e.target.value }, 'admin')
                      .then(res => setListingMediaList(res.media || []))
                      .catch(() => {});
                  }}
                  placeholder="Search listings..."
                  className="w-full pl-8 pr-3 py-1.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
                />
              </div>
              <button
                onClick={() => {
                  api
                    .getAdminListingMedia({ type: mediaTypeFilter, flaggedOnly: mediaFlaggedOnly, search: mediaSearch }, 'admin')
                    .then(res => setListingMediaList(res.media || []))
                    .catch(() => {});
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
          <div className="p-4 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <span>Registered Users &amp; Hosts</span>
                  <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300">
                    {adminUsersCounts.total}
                  </span>
                </h3>
                <p className="text-xs text-stone-500">
                  Every registered Guest and Host account with signup dates, roles, search, and verification controls.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: `All (${adminUsersCounts.total})` },
                  { id: 'guests', label: `Guests (${adminUsersCounts.guests})` },
                  { id: 'hosts', label: `Hosts (${adminUsersCounts.hosts})` },
                  { id: 'suspended', label: `Suspended (${adminUsersCounts.suspended})` },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setUserFilter(f.id as any);
                      setUserPage(1);
                    }}
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

            {/* Live Search & Refresh */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => {
                    setUserSearch(e.target.value);
                    setUserPage(1);
                  }}
                  placeholder="Search by name, username, email, phone, or location..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs outline-none focus:border-stone-400"
                />
              </div>
              <button
                type="button"
                onClick={() => loadAdminUsers()}
                disabled={usersLoading}
                className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
                <span>{usersLoading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {(adminUsersList.length > 0 ? adminUsersList : users).length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 text-xs text-stone-500">
                No matching Guest or Host accounts found.
              </div>
            ) : (
              (adminUsersList.length > 0 ? adminUsersList : users).map(u => {
                const roleBadge = u.role === 'owner' ? 'HOST' : u.role === 'admin' ? 'ADMIN' : 'GUEST';
                return (
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
                        <span
                          className={`px-2 py-0.5 rounded font-mono uppercase text-[10px] font-bold ${
                            u.role === 'owner'
                              ? 'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300'
                              : u.role === 'admin'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300'
                          }`}
                        >
                          {roleBadge}
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
                      <div className="text-stone-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-mono text-stone-700 dark:text-stone-300">
                          {u.username ? `@${u.username} · ` : ''}
                          {u.email}
                        </span>
                        <span>·</span>
                        <span>Joined: {u.createdAt ? new Date(u.createdAt).toLocaleString() : 'Seeded account'}</span>
                        <span>·</span>
                        <span>{u.phone || 'No phone'}</span>
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
                            loadAdminUsers();
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
                            loadAdminUsers();
                            loadAdminData();
                          }}
                          className="px-3 py-1.5 rounded-full text-xs font-bold bg-stone-100 dark:bg-stone-800 hover:bg-rose-100 text-rose-600 cursor-pointer"
                        >
                          Suspend
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          await onVerifyUser(u.email);
                          loadAdminUsers();
                        }}
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
                );
              })
            )}
          </div>

          {userTotalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-stone-500">
              <span>
                Showing page {userPage} of {userTotalPages} ({userTotalMatched} accounts)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={userPage <= 1}
                  onClick={() => setUserPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={userPage >= userTotalPages}
                  onClick={() => setUserPage(p => Math.min(userTotalPages, p + 1))}
                  className="px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
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
                All contact numbers are unlocked via AirBus Wallet (KES 50 for a 10-minute window).
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
              <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 block mb-0.5">Pending Submissions</span>
              <span className="text-xl font-black text-amber-500">
                {tripDatingCounts.pending}
              </span>
            </div>

            <div className="p-3.5 bg-gradient-to-br from-amber-500/10 to-emerald-500/10 rounded-2xl border border-amber-500/30 text-center">
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 block mb-0.5">KES 50 Revenue</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                KES {(datingStats?.totalRevenueKes || datingRequests.filter(r => r.status === 'approved').length * 50).toLocaleString()}
              </span>
            </div>
          </div>

          {/* SECTION 0: TRIP DATING SUBMISSIONS MODERATION QUEUE (Pending Review / Approved / Declined) */}
          <div className="bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-500" />
                  Trip Dating Submissions Review &amp; Moderation
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Review submitted profiles, inspect photos &amp; videos, approve live to the top of the feed, or decline with a mandatory 10–500 char reason.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadTripDatingSubmissions(tdStatusTab, tdPage)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Status Filter Sub-Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
              {([
                { id: 'PENDING_REVIEW', label: `Pending Review (${tripDatingCounts.pending})`, activeCls: 'bg-amber-500 text-stone-950' },
                { id: 'APPROVED', label: `Approved (${tripDatingCounts.approved})`, activeCls: 'bg-emerald-600 text-white' },
                { id: 'DECLINED', label: `Declined (${tripDatingCounts.declined})`, activeCls: 'bg-rose-600 text-white' },
                { id: 'ALL', label: `All (${tripDatingCounts.total})`, activeCls: 'bg-stone-900 dark:bg-white text-white dark:text-stone-950' },
              ] as const).map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setTdStatusTab(st.id);
                    setTdPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    tdStatusTab === st.id
                      ? `${st.activeCls} shadow-sm`
                      : 'bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {tdLoading ? (
              <div className="py-10 text-center text-xs text-stone-400">Loading submissions...</div>
            ) : tdSubmissions.length === 0 ? (
              <div className="py-10 text-center text-xs text-stone-400">
                No Trip Dating submissions in {tdStatusTab.replace(/_/g, ' ')}.
              </div>
            ) : (
              <div className="space-y-4">
                {tdSubmissions.map(sub => {
                  const subPhotos = Array.from(
                    new Set(
                      [sub.full_body_photo, sub.primaryPhoto, ...(sub.photos || [])].filter(Boolean) as string[]
                    )
                  );
                  const subVideo = sub.videoUrl || sub.videos?.[0];
                  const modState = sub.moderationState || 'PENDING_REVIEW';
                  const isBusy = tdActionBusyId === sub.id;

                  return (
                    <div
                      key={sub.id}
                      className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/50 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                modState === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : modState === 'DECLINED'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {modState}
                            </span>
                            {sub.city_custom && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                                Custom City: {sub.city_custom}
                              </span>
                            )}
                            <span className="text-[11px] text-stone-500">
                              Submitted (EAT): <strong>{formatEATDateTime(sub.createdAt)}</strong>
                            </span>
                            {(sub.published_at || sub.reviewed_at) && (
                              <span className="text-[11px] text-stone-500">
                                · Reviewed (EAT): <strong>{formatEATDateTime(sub.published_at || sub.reviewed_at)}</strong>
                              </span>
                            )}
                          </div>
                          <h5 className="text-base font-extrabold text-stone-900 dark:text-white">
                            {sub.fullName} · {sub.gender}, {sub.age} yrs
                          </h5>
                          <p className="text-xs text-stone-600 dark:text-stone-300">
                            City: <strong>{sub.city_custom || sub.city}</strong> · Location: {sub.location} · Intention: {sub.datingIntention?.replace(/_/g, ' ')} · Contact: {sub.phoneNumber}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            Submitter: {sub.ownerEmail || sub.clientSessionId || 'Anonymous Session'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {modState !== 'APPROVED' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={async () => {
                                setTdActionBusyId(sub.id);
                                try {
                                  const res = await api.approveAdminTripDatingSubmission(sub.id);
                                  if (res?.counts) setTripDatingCounts(res.counts);
                                  showToast?.(`Approved ${sub.fullName}. Live at top of Trip Dating feed!`);
                                  loadTripDatingSubmissions(tdStatusTab, tdPage);
                                  api.getAdminReviewQueue().then(r => r && setReviewQueue(normalizeReviewQueue(r))).catch(() => {});
                                } catch (err: any) {
                                  showToast?.(err.message || 'Approval failed');
                                } finally {
                                  setTdActionBusyId(null);
                                }
                              }}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{isBusy ? 'Approving...' : 'Approve'}</span>
                            </button>
                          )}

                          {modState !== 'DECLINED' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setTdDeclineTarget({ id: sub.id, fullName: sub.fullName });
                                setTdDeclineReason('');
                                setTdDeclineError(null);
                              }}
                              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Decline</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-950 p-3 rounded-xl border border-stone-200 dark:border-stone-800 space-y-1">
                        <div><strong>Bio:</strong> {sub.description}</div>
                        {sub.lookingFor && <div><strong>Looking for:</strong> {sub.lookingFor}</div>}
                        {modState === 'DECLINED' && (sub.decline_reason || sub.admin_feedback) && (
                          <div className="text-rose-600 dark:text-rose-400 pt-1">
                            <strong>Decline reason:</strong> {sub.decline_reason || sub.admin_feedback}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold text-stone-500 uppercase">Video</div>
                          {subVideo ? (
                            <SharedVideoPlayer
                              src={subVideo}
                              poster={sub.videoThumbnail || sub.primaryPhoto}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full h-64 rounded-2xl border border-stone-200 dark:border-stone-800"
                              videoClassName="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="h-32 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 flex items-center justify-center text-xs text-stone-400">
                              No video uploaded
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold text-stone-500 uppercase">
                            Photos ({subPhotos.length}) — Click to enlarge
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {subPhotos.map((pUrl, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() =>
                                  setReviewPhotoLightbox({
                                    title: sub.fullName,
                                    photos: subPhotos,
                                    idx: pIdx,
                                  })
                                }
                                className="aspect-[3/4] rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 hover:ring-2 hover:ring-rose-500 cursor-pointer"
                              >
                                <img src={pUrl} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tdTotalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800 text-xs">
                <button
                  type="button"
                  disabled={tdPage <= 1 || tdLoading}
                  onClick={() => setTdPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-stone-500 font-semibold">
                  Page {tdPage} of {tdTotalPages}
                </span>
                <button
                  type="button"
                  disabled={tdPage >= tdTotalPages || tdLoading}
                  onClick={() => setTdPage(p => Math.min(tdTotalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* SECTION 1: KES 50 CONTACT UNLOCK LOGS & LEGACY REQUESTS */}
          <div className="bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  KES 50 Contact Unlock Requests (Wallet &amp; Legacy)
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Contact unlocks now process immediately from AirBus Wallet for a 10-minute window.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-stone-600 dark:text-stone-300">
                {datingRequests.filter(r => r.status === 'pending').length} Pending
              </span>
            </div>

            {datingRequests.length === 0 ? (
              <p className="text-xs text-stone-400 py-6 text-center">No contact unlock requests logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-400">
                      <th className="pb-2 font-semibold">Target Member</th>
                      <th className="pb-2 font-semibold">Requester</th>
                      <th className="pb-2 font-semibold">Payer Phone</th>
                      <th className="pb-2 font-semibold">Reference Code</th>
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
                                onClick={() => {
                                  setDatingModalPrompt({
                                    kind: 'reject_request',
                                    id: req.id,
                                    label: req.profileName || req.id,
                                  });
                                  setDatingModalReason('');
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
                              onClick={() => {
                                setDatingModalPrompt({
                                  kind: 'suspend_profile',
                                  id: p.id,
                                  label: p.fullName,
                                });
                                setDatingModalReason('');
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

      {/* TAB: AIRBUS PLUS & LOCAL MODERATION */}
      {tab === 'plus-local' && (
        <div className="space-y-8">
          {/* 1. AirBus Plus Custom Service Requests ("Other services, ask.") */}
          <div className="p-6 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <span>AirBus Plus — &ldquo;Other services, ask.&rdquo; Requests ({plusRequests.length})</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  View requests from active AirBus Plus members and link them with reliable service providers.
                </p>
              </div>
              <button
                type="button"
                onClick={loadAdminData}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {plusRequests.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-4">No AirBus Plus custom service requests yet.</p>
            ) : (
              <div className="space-y-3">
                {plusRequests.map(reqItem => {
                  const draft = plusLinkInputs[reqItem.id] || {
                    providerName: reqItem.assignedProviderName || '',
                    providerContact: reqItem.assignedProviderContact || '',
                    adminNote: reqItem.adminNote || '',
                  };
                  return (
                    <div
                      key={reqItem.id}
                      className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs">
                          <strong className="text-stone-900 dark:text-white">{reqItem.userName}</strong>{' '}
                          <span className="text-stone-500">({reqItem.userEmail})</span>
                        </div>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            reqItem.status === 'linked'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {reqItem.status}
                        </span>
                      </div>

                      <p className="text-xs text-stone-700 dark:text-stone-300 bg-white dark:bg-[#15171e] p-3 rounded-xl border border-stone-200 dark:border-stone-800">
                        {reqItem.requestText}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Reliable Provider Name *"
                          value={draft.providerName}
                          onChange={e =>
                            setPlusLinkInputs(prev => ({
                              ...prev,
                              [reqItem.id]: { ...draft, providerName: e.target.value },
                            }))
                          }
                          className="px-3 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Provider Contact (Phone/Email) *"
                          value={draft.providerContact}
                          onChange={e =>
                            setPlusLinkInputs(prev => ({
                              ...prev,
                              [reqItem.id]: { ...draft, providerContact: e.target.value },
                            }))
                          }
                          className="px-3 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Admin note (optional)"
                          value={draft.adminNote}
                          onChange={e =>
                            setPlusLinkInputs(prev => ({
                              ...prev,
                              [reqItem.id]: { ...draft, adminNote: e.target.value },
                            }))
                          }
                          className="px-3 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs outline-none"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={async () => {
                            if (!draft.providerName.trim() || !draft.providerContact.trim()) {
                              showToast?.('Enter reliable provider name and contact.');
                              return;
                            }
                            try {
                              setActionLoading(true);
                              await api.linkPlusServiceRequest(reqItem.id, {
                                providerName: draft.providerName.trim(),
                                providerContact: draft.providerContact.trim(),
                                adminNote: draft.adminNote.trim() || undefined,
                              });
                              showToast?.(`Linked ${reqItem.userName} with ${draft.providerName.trim()}.`);
                              loadAdminData();
                            } catch (err: any) {
                              showToast?.(err.message || 'Could not link provider.');
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                          className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                          {reqItem.status === 'linked' ? 'Update Linked Provider' : 'Link Reliable Provider'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. AirBus Local Providers Moderation */}
          <div className="p-6 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-500" />
                <span>AirBus Local Registered Providers ({localProvidersAdmin.length})</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                No drugs or illegal activities. Any such provider profile will be pulled down.
              </p>
            </div>

            {localProvidersAdmin.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-4">No AirBus Local provider registrations submitted yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {localProvidersAdmin.map(prov => (
                  <div
                    key={prov.id}
                    className={`p-4 rounded-2xl border flex gap-3 ${
                      prov.status === 'pulled_down'
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900 opacity-75'
                        : 'bg-stone-50 dark:bg-stone-900/60 border-stone-200 dark:border-stone-800'
                    }`}
                  >
                    <img
                      src={prov.photoUrl}
                      alt={prov.fullName}
                      className="w-16 h-16 rounded-2xl object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-extrabold text-stone-900 dark:text-white truncate">
                          {prov.fullName}
                        </div>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                            prov.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {prov.status === 'active' ? 'Active' : 'Pulled Down'}
                        </span>
                      </div>

                      <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        {prov.category}
                        {prov.trainerDiscipline ? ` (${prov.trainerDiscipline})` : ''}
                        {prov.customServiceDescription ? ` — ${prov.customServiceDescription}` : ''}
                      </div>

                      <div className="text-[11px] text-stone-500">
                        📍 {prov.locationTown} · 📞 {prov.contact}
                      </div>

                      <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-2">
                        {prov.description}
                      </p>

                      {prov.pulledDownReason && (
                        <div className="text-[11px] text-rose-600 font-semibold">
                          Reason: {prov.pulledDownReason}
                        </div>
                      )}

                      {prov.status === 'active' && (
                        <div className="pt-2">
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={async () => {
                              const reason =
                                prompt(
                                  `Pull down ${prov.fullName}'s profile? Reason:`,
                                  'Violation: Drugs or illegal activities policy.'
                                ) ?? '';
                              if (!reason.trim()) return;
                              try {
                                setActionLoading(true);
                                await api.pullDownLocalProvider(prov.id, reason.trim());
                                showToast?.(`Profile for ${prov.fullName} has been pulled down.`);
                                loadAdminData();
                              } catch (err: any) {
                                showToast?.(err.message || 'Pull down failed.');
                              } finally {
                                setActionLoading(false);
                              }
                            }}
                            className="px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            Pull Down Profile
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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

      {/* SHARED APPROVE PAYMENT MODAL (Queue & Wallets tabs) */}
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
              <div>User: <strong className="text-stone-900 dark:text-white">{approveModalPayment.userName || approveModalPayment.userId || approveModalPayment.hostEmail}</strong></div>
              <div>Type: <strong className="capitalize">{approveModalPayment.type || approveModalPayment.kind}</strong></div>
              <div>
                Exact Amount to Credit:{' '}
                <strong className="font-mono text-emerald-600">
                  KES {Number(approveModalPayment.claimedAmount || approveModalPayment.amountKes || approveModalPayment.amount || 0).toLocaleString()}
                </strong>
              </div>
              {approveModalPayment.mpesaCode && <div>Receipt: <strong className="font-mono">{approveModalPayment.mpesaCode}</strong></div>}

              <div className="pt-2 border-t border-stone-200 dark:border-stone-800 text-[11px] text-stone-500 dark:text-stone-400">
                Exact amount locked to user&apos;s submission. If the M-Pesa message amount does not match, Decline so the user can resubmit.
              </div>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              Approving this deposit will credit the user&apos;s wallet with this exact amount and send a real-time update.
            </p>

            {paymentModalError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{paymentModalError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={processingPayment}
                onClick={() => {
                  setPaymentModalError(null);
                  setApproveModalPayment(null);
                }}
                className="px-4 py-2 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingPayment}
                onClick={() => handleApprovePaymentRecord(approveModalPayment)}
                className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {processingPayment ? 'Activating...' : 'Yes, Approve & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHARED DECLINE MODAL (Queue & Wallets tabs) */}
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
              <div>User: <strong className="text-stone-900 dark:text-white">{rejectModalPayment.userName || rejectModalPayment.userId || rejectModalPayment.hostEmail}</strong></div>
              <div>Code / Ref: <strong className="font-mono">{rejectModalPayment.mpesaCode || rejectModalPayment.reference || rejectModalPayment.referenceId || rejectModalPayment.id}</strong></div>
              <div>Amount: <strong className="font-mono text-rose-600">KES {Number(rejectModalPayment.claimedAmount ?? rejectModalPayment.amountKes ?? rejectModalPayment.amountSc ?? rejectModalPayment.amount ?? 0).toLocaleString()}</strong></div>
            </div>

            {rejectModalPayment.method === 'wallet' && (
              <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-[11px] text-purple-900 dark:text-purple-200">
                <strong>Atomic Reversal: </strong>Since this payment was deducted from the user's wallet, declining will automatically credit {rejectModalPayment.amountSc || rejectModalPayment.amount} back to their wallet with reversal ledger rows.
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Decline Reason ({MPESA_CONFIG.DECLINE_REASON_MIN_LEN}–{MPESA_CONFIG.DECLINE_REASON_MAX_LEN} chars) *
                </label>
                <span className={`text-[10px] font-mono ${rejectReason.trim().length < MPESA_CONFIG.DECLINE_REASON_MIN_LEN ? 'text-rose-500 font-bold' : 'text-stone-400'}`}>
                  {rejectReason.trim().length}/{MPESA_CONFIG.DECLINE_REASON_MAX_LEN}
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={MPESA_CONFIG.DECLINE_REASON_MAX_LEN}
                value={rejectReason}
                onChange={e => {
                  setRejectReason(e.target.value);
                  if (paymentModalError) setPaymentModalError(null);
                }}
                placeholder="Enter specific reason (e.g. M-Pesa receipt could not be verified on statement)..."
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-rose-500"
                required
              />
            </div>

            {paymentModalError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{paymentModalError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={processingPayment}
                onClick={() => {
                  setPaymentModalError(null);
                  setRejectModalPayment(null);
                }}
                className="px-4 py-2 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingPayment}
                onClick={async () => {
                  const trimmed = rejectReason.trim();
                  if (
                    trimmed.length < MPESA_CONFIG.DECLINE_REASON_MIN_LEN ||
                    trimmed.length > MPESA_CONFIG.DECLINE_REASON_MAX_LEN
                  ) {
                    setPaymentModalError(
                      `Decline reason must be between ${MPESA_CONFIG.DECLINE_REASON_MIN_LEN} and ${MPESA_CONFIG.DECLINE_REASON_MAX_LEN} characters.`
                    );
                    return;
                  }
                  setProcessingPayment(true);
                  setPaymentModalError(null);
                  try {
                    const res = await api.declineAdminPayment(rejectModalPayment.id, trimmed);
                    if (res?.counts) setPaymentCounts(res.counts);
                    showToast?.('Payment declined and merchant notified.');
                    setRejectModalPayment(null);
                    loadAdminData();
                    if (onPaymentModerated) {
                      await Promise.resolve(onPaymentModerated()).catch(() => {});
                    }
                  } catch (err: any) {
                    setPaymentModalError(err?.message || 'Decline failed.');
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

      {/* GATED REFUND MODAL (Approved Payments Only) */}
      {refundModalPayment && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center gap-2 text-sky-600">
              <Lock className="w-6 h-6" />
              <h4 className="text-base font-extrabold text-stone-900 dark:text-white">
                Refund Approved Payment
              </h4>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-2xl text-xs space-y-1 text-stone-600 dark:text-stone-300">
              <div>Account: <strong className="text-stone-900 dark:text-white">{refundModalPayment.userName || refundModalPayment.userId || refundModalPayment.hostEmail}</strong></div>
              <div>M-Pesa / Ref Code: <strong className="font-mono">{refundModalPayment.mpesaCode || refundModalPayment.reference || refundModalPayment.id}</strong></div>
              <div>Original Amount: <strong className="font-mono">KES {Number(refundModalPayment.approvedAmount ?? refundModalPayment.amountKes ?? refundModalPayment.amount ?? 0).toLocaleString()}</strong></div>
            </div>

            <form
              onSubmit={async e => {
                e.preventDefault();
                setRefundError(null);
                const maxRefund =
                  Number(refundModalPayment.approvedAmount ?? refundModalPayment.amountKes ?? refundModalPayment.amount ?? 0) -
                  Number(refundModalPayment.refundAmount || 0);
                const amt = Number(refundAmountInput.trim());
                if (!Number.isInteger(amt) || amt <= 0 || amt > maxRefund) {
                  setRefundError(`Refund amount must be a whole integer between 1 and KES ${maxRefund.toLocaleString()}.`);
                  return;
                }
                const trimmedReason = refundReason.trim();
                if (
                  trimmedReason.length < MPESA_CONFIG.DECLINE_REASON_MIN_LEN ||
                  trimmedReason.length > MPESA_CONFIG.DECLINE_REASON_MAX_LEN
                ) {
                  setRefundError(
                    `Refund reason must be ${MPESA_CONFIG.DECLINE_REASON_MIN_LEN}-${MPESA_CONFIG.DECLINE_REASON_MAX_LEN} characters.`
                  );
                  return;
                }
                if (!refundAdminPassword) {
                  setRefundError('Admin password confirmation is required.');
                  return;
                }
                setRefundBusy(true);
                try {
                  const res = await api.refundAdminPayment(refundModalPayment.id, {
                    amount: amt,
                    reason: trimmedReason,
                    adminPassword: refundAdminPassword,
                    idempotencyKey: `ref_${refundModalPayment.id}_${amt}_${Date.now()}`,
                  });
                  if (res?.counts) setPaymentCounts(res.counts);
                  showToast?.(`Refunded KES ${amt.toLocaleString()} (Ref: ${res.refundReference}).`);
                  setRefundModalPayment(null);
                  loadAdminData();
                  if (onPaymentModerated) {
                    await Promise.resolve(onPaymentModerated()).catch(() => {});
                  }
                } catch (err: any) {
                  setRefundError(err?.message || 'Refund failed.');
                } finally {
                  setRefundBusy(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Refund Amount (KES integer) *
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={refundAmountInput}
                  onChange={e => setRefundAmountInput(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-mono font-bold outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Refund Reason ({MPESA_CONFIG.DECLINE_REASON_MIN_LEN}–{MPESA_CONFIG.DECLINE_REASON_MAX_LEN} chars) *
                </label>
                <textarea
                  rows={3}
                  maxLength={MPESA_CONFIG.DECLINE_REASON_MAX_LEN}
                  required
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  placeholder="State clear reason for authorizing this refund..."
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Admin Password Re-Auth *
                </label>
                <input
                  type="password"
                  required
                  value={refundAdminPassword}
                  onChange={e => setRefundAdminPassword(e.target.value)}
                  placeholder="Enter admin password to authorize"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-sky-500"
                />
              </div>

              {refundError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{refundError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={refundBusy}
                  onClick={() => setRefundModalPayment(null)}
                  className="px-4 py-2 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refundBusy}
                  className="px-5 py-2 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {refundBusy ? 'Processing Refund...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* REVIEW QUEUE DECLINE FEEDBACK MODAL */}
      {reviewDeclineTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <XCircle className="w-6 h-6" />
              <h4 className="text-base font-extrabold text-stone-900 dark:text-white">
                Decline Submission
              </h4>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-2xl text-xs text-stone-600 dark:text-stone-300">
              Item: <strong className="text-stone-900 dark:text-white">{reviewDeclineTarget.title}</strong>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Creator Feedback (admin_feedback) *
              </label>
              <textarea
                rows={4}
                value={reviewFeedback}
                onChange={e => {
                  setReviewFeedback(e.target.value);
                  if (reviewFeedbackError) setReviewFeedbackError(null);
                }}
                placeholder="Explain clearly what needs to be fixed before resubmitting..."
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-rose-500"
              />
            </div>

            {reviewFeedbackError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {reviewFeedbackError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={reviewActionBusy}
                onClick={() => {
                  setReviewDeclineTarget(null);
                  setReviewFeedback('');
                  setReviewFeedbackError(null);
                }}
                className="px-4 py-2 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewActionBusy}
                onClick={async () => {
                  const trimmed = reviewFeedback.trim();
                  if (!trimmed) {
                    setReviewFeedbackError('Feedback is required when declining a submission.');
                    return;
                  }
                  if (reviewDeclineTarget.kind === 'trip_dating' && (trimmed.length < 10 || trimmed.length > 500)) {
                    setReviewFeedbackError('Decline reason must be between 10 and 500 characters.');
                    return;
                  }
                  setReviewActionBusy(true);
                  setReviewFeedbackError(null);
                  try {
                    if (reviewDeclineTarget.kind === 'stay') {
                      await api.moderateReviewQueueStay(reviewDeclineTarget.id, 'decline', trimmed);
                    } else {
                      await api.declineAdminTripDatingSubmission(reviewDeclineTarget.id, trimmed);
                    }
                    showToast?.(`Declined "${reviewDeclineTarget.title}" with creator feedback.`);
                    setReviewDeclineTarget(null);
                    setReviewFeedback('');
                    await refreshReviewQueue();
                    loadAdminData();
                  } catch (err: any) {
                    setReviewFeedbackError(err.message || 'Decline failed.');
                  } finally {
                    setReviewActionBusy(false);
                  }
                }}
                className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {reviewActionBusy ? 'Submitting...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRIP DATING DECLINE MODAL (10–500 CHAR REASON REQUIRED) */}
      {tdDeclineTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <XCircle className="w-6 h-6" />
              <h4 className="text-base font-extrabold text-stone-900 dark:text-white">
                Decline Trip Dating Submission
              </h4>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-2xl text-xs text-stone-600 dark:text-stone-300">
              Member: <strong className="text-stone-900 dark:text-white">{tdDeclineTarget.fullName}</strong>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Decline Reason (10–500 characters) *
                </label>
                <span className="text-[11px] font-mono text-stone-500">
                  {tdDeclineReason.trim().length}/500
                </span>
              </div>
              <textarea
                rows={4}
                maxLength={500}
                value={tdDeclineReason}
                onChange={e => {
                  setTdDeclineReason(e.target.value);
                  if (tdDeclineError) setTdDeclineError(null);
                }}
                placeholder="Explain clearly why this submission was declined (min 10 chars)..."
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-rose-500"
              />
            </div>

            {tdDeclineError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {tdDeclineError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={tdActionBusyId === tdDeclineTarget.id}
                onClick={() => {
                  setTdDeclineTarget(null);
                  setTdDeclineReason('');
                  setTdDeclineError(null);
                }}
                className="px-4 py-2 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={tdActionBusyId === tdDeclineTarget.id}
                onClick={async () => {
                  const trimmed = tdDeclineReason.trim();
                  if (trimmed.length < 10 || trimmed.length > 500) {
                    setTdDeclineError('Decline reason must be between 10 and 500 characters.');
                    return;
                  }
                  setTdActionBusyId(tdDeclineTarget.id);
                  setTdDeclineError(null);
                  try {
                    const res = await api.declineAdminTripDatingSubmission(tdDeclineTarget.id, trimmed);
                    if (res?.counts) setTripDatingCounts(res.counts);
                    showToast?.(`Declined "${tdDeclineTarget.fullName}" and sent reason.`);
                    setTdDeclineTarget(null);
                    setTdDeclineReason('');
                    loadTripDatingSubmissions(tdStatusTab, tdPage);
                    api.getAdminReviewQueue().then(r => r && setReviewQueue(normalizeReviewQueue(r))).catch(() => {});
                  } catch (err: any) {
                    setTdDeclineError(err.message || 'Decline failed.');
                  } finally {
                    setTdActionBusyId(null);
                  }
                }}
                className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {tdActionBusyId === tdDeclineTarget.id ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW QUEUE FULL-RES PHOTO LIGHTBOX */}
      {reviewPhotoLightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-neutral-950 border border-neutral-800 rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-white">
              <span className="font-bold">
                {reviewPhotoLightbox.title} — Photo {reviewPhotoLightbox.idx + 1} / {reviewPhotoLightbox.photos.length}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={reviewPhotoLightbox.photos[reviewPhotoLightbox.idx]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Original</span>
                </a>
                <button
                  type="button"
                  onClick={() => setReviewPhotoLightbox(null)}
                  className="p-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="relative flex items-center justify-center bg-black rounded-2xl overflow-hidden max-h-[78vh]">
              <img
                src={reviewPhotoLightbox.photos[reviewPhotoLightbox.idx]}
                alt=""
                className="max-h-[75vh] max-w-full object-contain"
              />
            </div>
            {reviewPhotoLightbox.photos.length > 1 && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setReviewPhotoLightbox(prev =>
                      prev
                        ? {
                            ...prev,
                            idx: (prev.idx - 1 + prev.photos.length) % prev.photos.length,
                          }
                        : null
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setReviewPhotoLightbox(prev =>
                      prev
                        ? {
                            ...prev,
                            idx: (prev.idx + 1) % prev.photos.length,
                          }
                        : null
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REVIEW QUEUE FULL VIDEO INSPECTION MODAL */}
      {reviewVideoModal && (
        <div className="fixed inset-0 z-50 bg-black/92 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-neutral-950 border border-neutral-800 rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-white">
              <span className="font-bold flex items-center gap-2">
                <Video className="w-4 h-4 text-emerald-400" />
                <span>Full Video Inspection — {reviewVideoModal.title}</span>
              </span>
              <button
                type="button"
                onClick={() => setReviewVideoModal(null)}
                className="p-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-black rounded-2xl overflow-hidden flex items-center justify-center max-h-[78vh]">
              <SharedVideoPlayer
                src={reviewVideoModal.videoUrl}
                poster={reviewVideoModal.poster}
                controls
                playsInline
                preload="auto"
                className="w-full h-[65vh] rounded-2xl"
                videoClassName="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* TRIP DATING MODAL PROMPT (No window.prompt) */}
      {datingModalPrompt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
            <h4 className="text-base font-extrabold">
              {datingModalPrompt.kind === 'reject_request'
                ? `Reject Request for ${datingModalPrompt.label}`
                : `Suspend Profile: ${datingModalPrompt.label}`}
            </h4>
            <textarea
              rows={3}
              value={datingModalReason}
              onChange={e => setDatingModalReason(e.target.value)}
              placeholder="Enter reason..."
              className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-rose-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDatingModalPrompt(null)}
                className="px-4 py-2 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={async () => {
                  try {
                    setActionLoading(true);
                    if (datingModalPrompt.kind === 'reject_request') {
                      if (!datingModalReason.trim()) return;
                      await api.rejectAdminTripDatingRequest(datingModalPrompt.id, datingModalReason.trim());
                      showToast?.(`Rejected request for ${datingModalPrompt.label}`);
                    } else {
                      await api.moderateAdminTripDatingProfile(
                        datingModalPrompt.id,
                        'suspended',
                        datingModalReason.trim() || undefined
                      );
                      showToast?.(`Suspended profile for ${datingModalPrompt.label}.`);
                    }
                    setDatingModalPrompt(null);
                    setDatingModalReason('');
                    loadAdminData();
                  } catch (err: any) {
                    showToast?.(err.message || 'Action failed');
                  } finally {
                    setActionLoading(false);
                  }
                }}
                className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {/* GATED SPECIAL REFUND MODAL (Requires reason, case reference, original payment code, <= excess, and admin password) */}
      {specialRefundOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-extrabold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <Lock className="w-4 h-4" />
                <span>Admin Wallet · Special Refund</span>
              </h4>
              <button
                type="button"
                onClick={() => setSpecialRefundOpen(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-500">
              Only for returning verified overpayments/excess against an existing payment code. Requires written justification and admin password confirmation.
            </p>

            {specialRefundError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-300 font-semibold">
                {specialRefundError}
              </div>
            )}

            <form
              className="space-y-3 text-xs"
              onSubmit={async e => {
                e.preventDefault();
                setSpecialRefundError(null);
                setSpecialRefundBusy(true);
                try {
                  const res = await api.executeAdminWalletSpecialRefund({
                    reason: specialRefundForm.reason,
                    caseReference: specialRefundForm.caseReference,
                    originalPaymentCode: specialRefundForm.originalPaymentCode,
                    amount: Number(specialRefundForm.amount),
                    adminPassword: specialRefundForm.adminPassword,
                  });
                  showToast?.(`Special Refund logged (${res.entry.paymentCode}). Reconciled balance: KES ${res.adminBalance.toLocaleString()}`);
                  setSpecialRefundOpen(false);
                  setSpecialRefundForm({
                    reason: '',
                    caseReference: '',
                    originalPaymentCode: '',
                    amount: '',
                    adminPassword: '',
                  });
                  loadAdminData();
                } catch (err: any) {
                  setSpecialRefundError(err.message || 'Special Refund rejected.');
                } finally {
                  setSpecialRefundBusy(false);
                }
              }}
            >
              <div>
                <label className="font-bold block mb-1">Original Payment / M-Pesa Code *</label>
                <input
                  type="text"
                  required
                  value={specialRefundForm.originalPaymentCode}
                  onChange={e => setSpecialRefundForm(f => ({ ...f, originalPaymentCode: e.target.value.toUpperCase() }))}
                  placeholder="e.g. QWE123RTY4"
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 font-mono uppercase outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">Excess Refund (KES) *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={specialRefundForm.amount}
                    onChange={e => setSpecialRefundForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="Integer KES"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Case / User / Phone Ref *</label>
                  <input
                    type="text"
                    required
                    value={specialRefundForm.caseReference}
                    onChange={e => setSpecialRefundForm(f => ({ ...f, caseReference: e.target.value }))}
                    placeholder="+2547... or Case #"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Written Reason *</label>
                <textarea
                  rows={2}
                  required
                  minLength={5}
                  value={specialRefundForm.reason}
                  onChange={e => setSpecialRefundForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Explain the verified overpayment / excess..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Admin Password Confirmation *</label>
                <input
                  type="password"
                  required
                  value={specialRefundForm.adminPassword}
                  onChange={e => setSpecialRefundForm(f => ({ ...f, adminPassword: e.target.value }))}
                  placeholder="Re-enter your admin password"
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSpecialRefundOpen(false)}
                  className="px-4 py-2 rounded-full border border-stone-200 dark:border-stone-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={specialRefundBusy}
                  className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold cursor-pointer disabled:opacity-50"
                >
                  {specialRefundBusy ? 'Processing...' : 'Authorize Special Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
