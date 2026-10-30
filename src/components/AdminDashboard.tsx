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
} from 'lucide-react';
import { api } from '../api';

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
  onRejectPayment: (paymentId: string) => Promise<void>;
  onVerifyUser: (email: string) => Promise<void>;
  onUpdateStay: (id: string, updates: Partial<Stay>) => Promise<void>;
  onDeleteStay: (id: string) => Promise<void>;
  onAdjustHostPlan: (hostEmail: string, tier: string, days: number) => Promise<void>;
  currency: Currency;
  onBackToFeed?: () => void;
  showToast?: (msg: string) => void;
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
}) => {
  const [tab, setTab] = useState<
    'queue' | 'posts' | 'ads' | 'withdrawals' | 'settings' | 'treasury' | 'listings' | 'plans' | 'users' | 'negotiations' | 'audit'
  >('queue');

  // Plan adjustment form state
  const [targetHost, setTargetHost] = useState(users.find(u => u.role === 'owner')?.email || 'owner@airbus.ke');
  const [targetTier, setTargetTier] = useState('Diamond');
  const [adjustDays, setAdjustDays] = useState(30);

  // New Domain Collections State
  const [posts, setPosts] = useState<Post[]>([]);
  const [ads, setAds] = useState<AdRequest[]>([]);
  const [promotions, setPromotions] = useState<ListingPromotion[]>([]);
  const [adFilter, setAdFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [treasuryLedger, setTreasuryLedger] = useState<LedgerEntry[]>([]);
  const [treasuryWallet, setTreasuryWallet] = useState<WalletRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadAdminData = () => {
    api.getPosts().then(res => setPosts(res.posts)).catch(() => {});
    api.getAds().then(res => setAds(res.ads)).catch(() => {});
    api.getOwnerPromotions().then(res => setPromotions(res.promotions || [])).catch(() => {});
    api.getAdminWithdrawals().then(res => setWithdrawals(res.withdrawals)).catch(() => {});
    api.getSettings().then(res => setSettings(res.settings)).catch(() => {});
    api.getWallet().then(res => {
      setTreasuryWallet(res.wallet);
      setTreasuryLedger(res.ledger);
    }).catch(() => {});
  };

  useEffect(() => {
    loadAdminData();
  }, []);


  const pendingPayments = payments.filter(p => p.status === 'pending');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Ubiquitous Go Back to Feed Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBackToFeed}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#e4002b]" />
          <span>Go Back to Stays Feed</span>
        </button>
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

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 border-b border-stone-200 dark:border-stone-800 text-xs font-bold">
        <button
          onClick={() => setTab('queue')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'queue'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>M-Pesa ({pendingPayments.length})</span>
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
          onClick={() => setTab('ads')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'ads'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Megaphone className="w-4 h-4 text-purple-500" />
          <span>Ad Approvals 70/30 ({ads.filter(a => a.status === 'pending').length})</span>
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
          <span>Treasury & Ledger</span>
        </button>

        <button
          onClick={() => setTab('listings')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'listings'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Listings ({stays.length})</span>
        </button>

        <button
          onClick={() => setTab('plans')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'plans'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Plans</span>
        </button>

        <button
          onClick={() => setTab('users')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'users'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users ({users.length})</span>
        </button>

        <button
          onClick={() => setTab('negotiations')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'negotiations'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Negotiations ({threads.length})</span>
        </button>

        <button
          onClick={() => setTab('audit')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            tab === 'audit'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit</span>
        </button>
      </div>

      {/* TAB 1: M-PESA APPROVALS QUEUE */}
      {tab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-stone-900 dark:text-white">Pending M-Pesa Payment Submissions</h3>
            <span className="text-xs text-stone-500">Paybill 222111 / Acc: ff1314</span>
          </div>

          {pendingPayments.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-300 dark:border-stone-800 text-xs text-stone-400">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              All M-Pesa payments have been verified and processed.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingPayments.map(p => (
                <div
                  key={p.id}
                  className="p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-amber-200 dark:border-amber-900/60 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full">
                        {p.kind === 'plan' ? `${p.tier} Plan` : 'Wallet Deposit'}
                      </span>
                      <span className="text-sm font-extrabold text-stone-900 dark:text-white">
                        KES {p.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="text-xs text-stone-600 dark:text-stone-300">
                      Host: <span className="font-bold">{p.hostEmail}</span>
                    </div>

                    <div className="text-xs text-stone-400 mt-0.5">
                      M-Pesa Reference Code:{' '}
                      <span className="font-mono font-bold text-stone-800 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded">
                        {p.mpesaCode}
                      </span>{' '}
                      · Submitted {new Date(p.createdAt).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onApprovePayment(p.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve &amp; Activate</span>
                    </button>

                    <button
                      onClick={() => onRejectPayment(p.id)}
                      className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-rose-100 text-rose-600 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
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

      {/* TAB: DYNAMIC SETTINGS EDITOR */}
      {tab === 'settings' && settings && (
        <div className="space-y-4">
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

      {/* TAB: TREASURY & LEDGER STREAM */}
      {tab === 'treasury' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Treasury Wallet Balance</span>
              <div className="text-2xl font-black text-stone-900 dark:text-white mt-1">
                KES {(treasuryWallet?.balance || 62450).toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Platform Fees Collected</span>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                KES {(treasuryWallet?.lifetimeEarnings || 65000).toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Referral Commissions Paid</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                KES {(treasuryWallet?.lifetimeSpent || 2550).toLocaleString()}
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
            {stays.map(s => (
              <div
                key={s.id}
                className="p-4 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
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
                    <span className="text-xs text-stone-400">Host: {s.ownerEmail || 'Sample Host'}</span>
                  </div>

                  <h4 className="text-sm font-bold text-stone-900 dark:text-white">{s.title}</h4>
                  <div className="text-xs text-stone-500">
                    {s.location} · KES {s.price.toLocaleString()}/night · {s.guests} guests · Rating: {s.rating} ★ ({s.reviewsCount})
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onUpdateStay(s.id, { isFeatured: !s.isFeatured })}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                      s.isFeatured
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {s.isFeatured ? 'Unfeature' : 'Feature'}
                  </button>

                  {s.status === 'review' && (
                    <button
                      onClick={() => onUpdateStay(s.id, { status: 'live' })}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-full text-xs font-bold hover:bg-emerald-500 cursor-pointer"
                    >
                      Approve Live
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (window.confirm('Delete this listing permanently as admin?')) {
                        onDeleteStay(s.id);
                      }
                    }}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-full cursor-pointer"
                    title="Delete listing"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SUBSCRIPTION CONTROLS */}
      {tab === 'plans' && (
        <div className="max-w-xl mx-auto bg-white dark:bg-[#15171e] p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-stone-900 dark:text-white">Host Subscription Plan Controls</h3>
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
              alert(`Updated plan for ${targetHost} to ${targetTier} for ${adjustDays} days!`);
            }}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Update Subscription
          </button>
        </div>
      )}

      {/* TAB 4: USER DIRECTORY & ID VERIFICATION */}
      {tab === 'users' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-stone-900 dark:text-white">Registered Users</h3>
          <div className="space-y-3">
            {users.map(u => (
              <div
                key={u.id}
                className="p-4 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 dark:text-white">{u.name}</span>
                    <span className="bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded font-mono uppercase text-[10px]">
                      {u.role}
                    </span>
                    {u.idVerified ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> ID Verified
                      </span>
                    ) : (
                      <span className="text-stone-400">ID Pending</span>
                    )}
                  </div>
                  <div className="text-stone-500 mt-0.5">{u.email} · {u.phone || 'No phone'} · {u.location || 'Kenya'}</div>
                </div>

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
            ))}
          </div>
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
    </div>
  );
};
