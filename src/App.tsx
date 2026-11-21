import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  Stay,
  Booking,
  ChatThread,
  Review,
  HostPlanStatus,
  PaymentRecord,
  NotificationItem,
  Currency,
  ShortIntentType,
} from './types';
import { api } from './api';
import { Header } from './components/Header';
import { HomeFeed } from './components/HomeFeed';
import { ShortsView } from './components/ShortsView';
import { GuestDashboard } from './components/GuestDashboard';
import { OwnerDashboard } from './components/OwnerDashboard';
import { AuthModal } from './components/AuthModal';
import { AdminPortalLanding } from './components/AdminPortalLanding';
import { isAdminRoute, ADMIN_PORTAL_PATH, getNormalizedBasePrefix } from './config/adminRoute';

// Dynamic lazy import: AdminDashboard bundle is NEVER shipped to public visitors
const AdminDashboard = React.lazy(() =>
  import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard }))
);
import { StayDetailModal } from './components/StayDetailModal';
import { NegotiateModal } from './components/NegotiateModal';
import { ChatModal } from './components/ChatModal';
import { PlanModal } from './components/PlanModal';
import { TripFinderModal } from './components/TripFinderModal';
import { NotificationsModal } from './components/NotificationsModal';
import { EarnTab } from './components/EarnTab';
import { PersistentAdCard } from './components/PersistentAdCard';
import { SettingsModal } from './components/SettingsModal';
import { TripDatingPage } from './components/trip-dating/TripDatingPage';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/shared/ScrollToTop';
import { CollectionsPage, CollectionSlug } from './components/CollectionsPage';
import { Lock, Clock } from 'lucide-react';
import {
  trigger24HourCheckinAlert,
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
} from './utils/notifications';

const DEFAULT_IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const IDLE_WARNING_BEFORE_MS = 60 * 1000;

class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode; onBack?: () => void },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onBack?: () => void }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0d0f14] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#161822] border border-red-800/60 rounded-3xl p-6 space-y-4 text-center shadow-2xl">
            <h2 className="text-lg font-extrabold text-red-400">Admin Console Recovery</h2>
            <p className="text-xs text-stone-300">
              {this.state.error.message || 'An unexpected error occurred while rendering the Admin Console.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => this.setState({ error: null })}
                className="px-4 py-2 rounded-full bg-amber-500 text-stone-950 text-xs font-extrabold cursor-pointer"
              >
                Retry Render
              </button>
              {this.props.onBack && (
                <button
                  type="button"
                  onClick={this.props.onBack}
                  className="px-4 py-2 rounded-full border border-stone-700 text-stone-200 text-xs font-bold cursor-pointer"
                >
                  Back to Feed
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // Navigation & View
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [isOnAdminRoute, setIsOnAdminRoute] = useState<boolean>(() => isAdminRoute());
  const [adminInitialTab, setAdminInitialTab] = useState<'queue' | 'overview' | 'listings' | 'users' | 'payments' | 'treasury' | 'reports' | 'tickets' | 'audit' | 'trip-dating' | 'shorts-audio'>('queue');
  const [currency, setCurrency] = useState<Currency>('KES');
  const [searchQuery, setSearchQuery] = useState('');
  const [guestCount, setGuestCount] = useState(2);

  // Core Data
  const [user, setUser] = useState<User | null>(null);
  const [sessionHydrating, setSessionHydrating] = useState<boolean>(true);
  const [stays, setStays] = useState<Stay[]>([]);
  const [staysNextCursor, setStaysNextCursor] = useState<string | null>(null);
  const [staysHasMore, setStaysHasMore] = useState<boolean>(false);
  const [loadingMoreStays, setLoadingMoreStays] = useState<boolean>(false);
  const [ownerStays, setOwnerStays] = useState<Stay[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  // Host Data (hydrated strictly from backend; never assumes active before verification)
  const [hostPlan, setHostPlan] = useState<HostPlanStatus>({
    tier: 'Silver',
    status: 'pending',
    expiresAt: 0,
    hasPaidSubscription: false,
  });
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletRefreshTick, setWalletRefreshTick] = useState(0);

  // 20-Minute Idle Timeout & Countdown Modal State
  const [idleTimeoutMs, setIdleTimeoutMs] = useState<number>(DEFAULT_IDLE_TIMEOUT_MS);
  const [idleWarningOpen, setIdleWarningOpen] = useState<boolean>(false);
  const [idleSecondsLeft, setIdleSecondsLeft] = useState<number>(60);
  const lastActivityAtRef = useRef<number>(Date.now());
  const lastPingSentAtRef = useRef<number>(0);
  const idleWarningOpenRef = useRef<boolean>(false);
  useEffect(() => {
    idleWarningOpenRef.current = idleWarningOpen;
  }, [idleWarningOpen]);

  // Admin Data
  const [adminOverview, setAdminOverview] = useState<any>({
    metrics: {
      totalStays: 0,
      liveStays: 0,
      pendingReviews: 0,
      totalUsers: 0,
      pendingPayments: 0,
      totalBookings: 0,
      volumeKes: 0,
    },
    users: [],
    payments: [],
    reports: [],
    tickets: [],
    auditLogs: [],
  });

  // Modal States
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [authInitialPortal, setAuthInitialPortal] = useState<'guest' | 'owner' | null>(null);
  const [activeStayId, setActiveStayId] = useState<string | null>(null);
  const [activeStayIntent, setActiveStayIntent] = useState<ShortIntentType | null>(null);
  const [returnToShort, setReturnToShort] = useState<{ shortId: string; index: number } | null>(null);
  const [negotiateStayId, setNegotiateStayId] = useState<string | null>(null);
  const [chatStayId, setChatStayId] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planWalletMode, setPlanWalletMode] = useState(false);
  const [tripFinderOpen, setTripFinderOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Reviews for active stay
  const [activeStayReviews, setActiveStayReviews] = useState<Review[]>([]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadUserData = useCallback(async (currentUser: User) => {
    try {
      // Bookings
      const bRes = await api.getBookings();
      setBookings(bRes.bookings);

      // Threads
      const tRes = await api.getThreads();
      setThreads(tRes.threads);

      // Wishlist
      const wRes = await api.getWishlist();
      setWishlistIds(wRes.wishlist);

      // Notifications
      const nRes = await api.getNotifications();
      setNotifications(nRes.notifications);
      setUnreadNotifsCount(nRes.unreadCount);

      // Real wallet balance from unified backend ledger
      try {
        const walRes = await api.getWallet();
        if (walRes?.wallet?.balance !== undefined) {
          setWalletBalance(walRes.wallet.balance);
        }
      } catch {}

      // Host plan, owner listings (including pending/declined/hidden stays), & wallet
      if (currentUser.role === 'owner') {
        const [pRes, myStaysRes] = await Promise.all([
          api.getHostPlan(),
          api.getMyStays().catch(() => api.getStays({ ownerEmail: currentUser.email })),
        ]);
        if (pRes?.plan) setHostPlan(pRes.plan);
        if (pRes?.wallet !== undefined) setWalletBalance(pRes.wallet);
        setOwnerStays(myStaysRes?.stays || []);
      }

      // Admin metrics
      if (currentUser.role === 'admin') {
        const [pResSettled, aResSettled] = await Promise.allSettled([
          api.getHostPlan(),
          api.getAdminOverview(),
        ]);
        if (pResSettled.status === 'fulfilled' && pResSettled.value) {
          if (pResSettled.value.plan) setHostPlan(pResSettled.value.plan);
          if (pResSettled.value.wallet !== undefined) setWalletBalance(pResSettled.value.wallet);
        }
        if (aResSettled.status === 'fulfilled' && aResSettled.value) {
          setAdminOverview((prev: any) => ({
            ...prev,
            ...aResSettled.value,
            metrics: { ...prev.metrics, ...(aResSettled.value.metrics || {}) },
            stays: Array.isArray(aResSettled.value.stays) ? aResSettled.value.stays : prev.stays,
            users: Array.isArray(aResSettled.value.users) ? aResSettled.value.users : prev.users,
            payments: Array.isArray(aResSettled.value.payments) ? aResSettled.value.payments : prev.payments,
            auditLogs: Array.isArray(aResSettled.value.auditLogs) ? aResSettled.value.auditLogs : prev.auditLogs,
          }));
        }
      }
    } catch (err) {
      console.warn('Error loading user-specific data:', err);
    }
  }, []);

  // Initial Load (survives page refresh cleanly; restores dashboard state)
  const loadInitialData = useCallback(async () => {
    setSessionHydrating(true);
    try {
      // Fetch public stays (newest-first, keyset cursor paginated)
      const staysRes = await api.getStays({ limit: 20, sort: 'new' });
      setStays(staysRes.stays || []);
      setStaysNextCursor(staysRes.nextCursor || null);
      setStaysHasMore(Boolean(staysRes.hasMore));

      // Validate active portal session cleanly
      const slot = isAdminRoute(window.location.pathname) ? 'admin' : api.getActivePortalSlot();
      const token = api.getToken(slot);
      if (token) {
        try {
          const meRes = await api.getMe();
          setUser(meRes.user);
          if (typeof meRes.walletBalance === 'number') {
            setWalletBalance(meRes.walletBalance);
          }
          if (meRes.hostPlan) {
            setHostPlan(meRes.hostPlan);
          }
          if (meRes.session?.idleTimeoutMs) {
            setIdleTimeoutMs(meRes.session.idleTimeoutMs);
          }
          lastActivityAtRef.current = Date.now();
          lastPingSentAtRef.current = Date.now();
          await loadUserData(meRes.user);

          if (!isAdminRoute(window.location.pathname)) {
            const hash = window.location.hash.slice(1);
            if (!hash) {
              const savedTab = localStorage.getItem(`airbus_last_tab_${meRes.user.role}`);
              if (
                (savedTab === 'owner' && (meRes.user.role === 'owner' || meRes.user.role === 'admin')) ||
                (savedTab === 'guest' && meRes.user.role === 'guest')
              ) {
                setCurrentTab(savedTab);
                window.location.hash = savedTab;
              }
            }
          }
        } catch (err: any) {
          if (err?.status === 401) {
            api.logout(slot);
            setUser(null);
          }
        }
      }
    } catch (err) {
      console.warn('Initial data load warning:', err);
    } finally {
      setSessionHydrating(false);
    }
  }, [loadUserData]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Real-time approved feed stream + missed-event catch-up on reconnect
  const lastRealtimeTsRef = useRef<number>(Date.now());
  useEffect(() => {
    const canViewPlus = Boolean(
      user &&
        (user.role === 'admin' ||
          (user.role === 'guest'
            ? user.isVVVIP &&
              user.vvvipSubscription?.status === 'active' &&
              user.vvvipSubscription.expiresAt > Date.now()
            : user.isVVVIP))
    );

    const applyRealtimeEvent = (evt: { id?: string; type: 'stay' | 'trip_dating'; item: any; createdAt?: number }) => {
      if (!evt || !evt.item) return;
      if (evt.createdAt && evt.createdAt > lastRealtimeTsRef.current) {
        lastRealtimeTsRef.current = evt.createdAt;
      }
      if (evt.type === 'stay') {
        const item = evt.item as Stay;
        const isLive = item.status === 'live' || item.status === 'PUBLISHED';
        const modState = item.moderationState || (isLive && item.isApprovedByAdmin !== false ? 'APPROVED' : 'PENDING');
        if (modState === 'APPROVED' && isLive) {
          if (!item.isPlusVVVIP || canViewPlus) {
            setStays(prev => {
              const filtered = prev.filter(s => s.id !== item.id);
              return [item, ...filtered];
            });
          }
        }
        if (user && item.ownerEmail === user.email) {
          setOwnerStays(prev => {
            const exists = prev.some(s => s.id === item.id);
            return exists ? prev.map(s => (s.id === item.id ? item : s)) : [item, ...prev];
          });
        }
      }
      window.dispatchEvent(new CustomEvent('airbus:realtime-feed', { detail: evt }));
    };

    const slot = isOnAdminRoute ? 'admin' : user?.role === 'owner' ? 'owner' : 'guest';
    const url = api.getRealtimeFeedUrl(slot);
    let es: EventSource | null = null;
    try {
      es = new EventSource(url);
      es.addEventListener('feed_update', (e: MessageEvent) => {
        try {
          applyRealtimeEvent(JSON.parse(e.data));
        } catch {}
      });
      es.addEventListener('trip_dating_counts', (e: MessageEvent) => {
        try {
          window.dispatchEvent(new CustomEvent('airbus:trip-dating-counts', { detail: JSON.parse(e.data) }));
        } catch {}
      });
      es.addEventListener('open', () => {
        const since = lastRealtimeTsRef.current;
        if (since) {
          api
            .getMissedRealtimeFeed(since)
            .then(res => {
              (res?.events || []).forEach(applyRealtimeEvent);
            })
            .catch(() => {});
        }
      });
    } catch {}

    return () => {
      try {
        es?.close();
      } catch {}
    };
  }, [
    user?.email,
    user?.role,
    user?.isVVVIP,
    user?.vvvipSubscription?.status,
    user?.vvvipSubscription?.expiresAt,
    isOnAdminRoute,
  ]);

  const handleLoadMoreStays = async () => {
    if (!staysHasMore || !staysNextCursor || loadingMoreStays) return;
    setLoadingMoreStays(true);
    try {
      const res = await api.getStays({ limit: 20, sort: 'new', cursor: staysNextCursor });
      setStays(prev => {
        const existing = new Set(prev.map(s => s.id));
        const incoming = (res.stays || []).filter(s => !existing.has(s.id));
        return [...prev, ...incoming];
      });
      setStaysNextCursor(res.nextCursor || null);
      setStaysHasMore(Boolean(res.hasMore));
    } catch (err: any) {
      showToast(err?.message || 'Could not load more stays.');
    } finally {
      setLoadingMoreStays(false);
    }
  };

  const handleLogout = useCallback(async (customReason?: string) => {
    const slot = isOnAdminRoute
      ? 'admin'
      : user?.role === 'owner'
      ? 'owner'
      : 'guest';
    try {
      if (user?.role) {
        localStorage.removeItem(`airbus_last_tab_${user.role}`);
      }
      localStorage.removeItem(`airbus_last_tab_${slot}`);
    } catch {}
    setIdleWarningOpen(false);
    await api.logoutSession(slot);
    setUser(null);
    setOwnerStays([]);
    setWalletBalance(0);
    setBookings([]);
    setWishlistIds([]);
    setThreads([]);
    setHostPlan({
      tier: 'Silver',
      status: 'pending',
      expiresAt: 0,
      hasPaidSubscription: false,
    });
    if (!isOnAdminRoute) {
      setCurrentTab('home');
      if (window.location.pathname.startsWith('/listing/')) {
        window.history.pushState({}, '', '/');
      } else {
        window.location.hash = '';
      }
    }
    showToast(customReason || 'Signed out successfully.');
  }, [isOnAdminRoute, user]);

  // Activity reset + periodic backend ping + 20-minute idle countdown
  const resetIdleTimer = useCallback(
    (forcePing = false) => {
      if (!user) return;
      const now = Date.now();
      lastActivityAtRef.current = now;
      if (idleWarningOpenRef.current) {
        setIdleWarningOpen(false);
      }
      const slot = isOnAdminRoute
        ? 'admin'
        : user.role === 'owner'
        ? 'owner'
        : 'guest';
      if (forcePing || now - lastPingSentAtRef.current >= 30000) {
        lastPingSentAtRef.current = now;
        api.pingSession(slot).catch(() => {});
      }
    },
    [user, isOnAdminRoute]
  );

  useEffect(() => {
    if (!user) {
      api.setActivityListener(null);
      api.setSessionExpiredListener(null);
      setIdleWarningOpen(false);
      return;
    }

    lastActivityAtRef.current = Date.now();
    api.setActivityListener(() => {
      const now = Date.now();
      lastActivityAtRef.current = now;
      if (idleWarningOpenRef.current) {
        setIdleWarningOpen(false);
      }
    });

    api.setSessionExpiredListener((expiredSlot, message) => {
      const activeSlot = isOnAdminRoute
        ? 'admin'
        : user.role === 'owner'
        ? 'owner'
        : 'guest';
      if (expiredSlot === activeSlot) {
        handleLogout(message || 'Session expired after 20 minutes of inactivity.');
      }
    });

    let lastEventHandled = 0;
    const handleDeliberateActivity = () => {
      const now = Date.now();
      if (now - lastEventHandled < 1000) return;
      lastEventHandled = now;
      resetIdleTimer(idleWarningOpenRef.current);
    };
    const handlePassiveMouseMove = () => {
      // Ignore tiny cursor drift during the final warning countdown so user sees disclaimer
      if (idleWarningOpenRef.current) return;
      const now = Date.now();
      if (now - lastEventHandled < 2000) return;
      lastEventHandled = now;
      resetIdleTimer(false);
    };

    window.addEventListener('mousemove', handlePassiveMouseMove, { passive: true });
    window.addEventListener('mousedown', handleDeliberateActivity, { passive: true });
    window.addEventListener('keydown', handleDeliberateActivity);
    window.addEventListener('touchstart', handleDeliberateActivity, { passive: true });
    window.addEventListener('scroll', handleDeliberateActivity, { passive: true });
    window.addEventListener('hashchange', handleDeliberateActivity);

    const idleInterval = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityAtRef.current;
      const remainingMs = idleTimeoutMs - elapsed;

      if (remainingMs <= 0) {
        window.clearInterval(idleInterval);
        handleLogout('Logged out due to 20 minutes of inactivity. Your wallet & subscription data remain safely saved.');
        return;
      }

      if (remainingMs <= IDLE_WARNING_BEFORE_MS) {
        setIdleSecondsLeft(Math.max(1, Math.ceil(remainingMs / 1000)));
        if (!idleWarningOpenRef.current) {
          setIdleWarningOpen(true);
        }
      } else if (idleWarningOpenRef.current) {
        setIdleWarningOpen(false);
      }
    }, 1000);

    return () => {
      api.setActivityListener(null);
      api.setSessionExpiredListener(null);
      window.removeEventListener('mousemove', handlePassiveMouseMove);
      window.removeEventListener('mousedown', handleDeliberateActivity);
      window.removeEventListener('keydown', handleDeliberateActivity);
      window.removeEventListener('touchstart', handleDeliberateActivity);
      window.removeEventListener('scroll', handleDeliberateActivity);
      window.removeEventListener('hashchange', handleDeliberateActivity);
      window.clearInterval(idleInterval);
    };
  }, [user, isOnAdminRoute, idleTimeoutMs, resetIdleTimer, handleLogout]);

  // Real-Time Wallet Balance SSE Stream (Updates Guest & Host wallets immediately on Admin approval)
  useEffect(() => {
    const slot = isOnAdminRoute ? 'admin' : user?.role === 'owner' ? 'owner' : 'guest';
    const token = api.getToken(slot);
    if (!user || !token || typeof EventSource === 'undefined') return;

    const es = new EventSource(api.getWalletStreamUrl(slot));
    const handleWalletEvent = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (typeof payload.balance === 'number') {
          setWalletBalance(prev => {
            if (prev !== payload.balance && payload.balance > prev) {
              showToast(`Wallet updated: KES ${payload.balance.toLocaleString()}`);
            }
            return payload.balance;
          });
          if (user.role === 'owner' || user.role === 'admin') {
            api.getHostPlan().then(p => setHostPlan(p.plan)).catch(() => {});
          }
          if (user.role === 'owner') {
            api.getStays().then(r => setStays(r.stays)).catch(() => {});
            api.getStays({ ownerEmail: user.email }).then(r => setOwnerStays(r.stays || [])).catch(() => {});
          }
          api
            .getNotifications()
            .then(n => {
              setNotifications(n.notifications);
              setUnreadNotifsCount(n.unreadCount);
            })
            .catch(() => {});
        }
      } catch {
        // Ignore malformed SSE frame
      }
    };

    const handleSessionExpiredEvent = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        handleLogout(payload.error || 'Session expired after 20 minutes of inactivity.');
      } catch {
        handleLogout('Session expired due to inactivity.');
      }
    };

    es.addEventListener('wallet_update', handleWalletEvent as EventListener);
    es.addEventListener('session_expired', handleSessionExpiredEvent as EventListener);
    return () => {
      es.removeEventListener('wallet_update', handleWalletEvent as EventListener);
      es.removeEventListener('session_expired', handleSessionExpiredEvent as EventListener);
      es.close();
    };
  }, [user, isOnAdminRoute, handleLogout]);

  // Capture ?ref=CODE from URL and track referral click
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const refCode = searchParams.get('ref');
      if (refCode) {
        const clean = refCode.trim().toUpperCase();
        localStorage.setItem('airbus_ref_code', clean);
        api.trackReferralClick(clean).catch(() => {});
      }
    } catch (e) {
      console.warn('Referral param error:', e);
    }
  }, []);

  // URL Hash Routing Sync (Public site only; /#admin is permanently eliminated)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (!hash || hash === 'home' || hash === 'admin') {
        setCurrentTab('home');
        if (hash === 'admin') {
          // Requirement 1: Wipe hash completely so /#admin never renders an admin console
          try {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          } catch {
            window.location.hash = '';
          }
        }
      } else if (hash === 'shorts') {
        setCurrentTab('shorts');
      } else if (hash === 'earn') {
        setCurrentTab('earn');
      } else if (hash === 'trip-dating' || hash === 'dating') {
        setCurrentTab('trip-dating');
      } else if (hash === 'guest') {
        setCurrentTab('guest');
      } else if (hash === 'owner' || hash === 'host') {
        setCurrentTab('owner');
      } else if (hash === 'inbox') {
        if (!user) {
          if (!sessionHydrating && !api.getToken(api.getActivePortalSlot())) {
            setAuthModalOpen(true);
          }
        } else if (user.role === 'guest') {
          setCurrentTab('guest');
        } else {
          setCurrentTab('owner');
        }
      } else if (hash.startsWith('collection-')) {
        const slug = hash.replace('collection-', '');
        if (['black-friday', 'work', 'escapes', 'plus', 'local', 'worldwide'].includes(slug)) {
          setCurrentTab(`collection-${slug}`);
        } else {
          setCurrentTab('home');
        }
      } else if (hash.startsWith('stay-')) {
        const sId = hash.slice(5);
        setActiveStayId(sId);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user, sessionHydrating]);

  // Private Admin Portal & Deep-Linked Listing (/listing/:id?intent=...&source=short) Route Sync
  useEffect(() => {
    const validIntents = new Set<ShortIntentType>(['availability', 'book', 'chat', 'negotiate', 'whatsapp']);

    const handleRouteSync = () => {
      const match = isAdminRoute(window.location.pathname);
      setIsOnAdminRoute(match);

      let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
      if (match) {
        if (!robotsMeta) {
          robotsMeta = document.createElement('meta');
          robotsMeta.name = 'robots';
          document.head.appendChild(robotsMeta);
        }
        robotsMeta.content = 'noindex, nofollow';
      } else if (robotsMeta) {
        robotsMeta.content = 'index, follow';
      }

      if (!match) {
        const listingMatch = window.location.pathname.match(/\/listing\/([^/?#]+)/);
        if (listingMatch) {
          const listingStayId = decodeURIComponent(listingMatch[1]);
          const params = new URLSearchParams(window.location.search);
          const intentParam = params.get('intent') as ShortIntentType | null;
          const sourceParam = params.get('source');
          const historyState = window.history.state as { fromShort?: { shortId: string; index: number } } | null;

          setActiveStayId(listingStayId);
          setActiveStayIntent(intentParam && validIntents.has(intentParam) ? intentParam : null);
          if (sourceParam === 'short' || historyState?.fromShort) {
            setReturnToShort(historyState?.fromShort || { shortId: '', index: 0 });
          }
        } else {
          // If navigating back to /#shorts via browser Back button, close active listing modal cleanly
          if (window.location.hash === '#shorts') {
            setCurrentTab('shorts');
            setActiveStayId(null);
            setActiveStayIntent(null);
          }
        }
      }
    };

    handleRouteSync();
    window.addEventListener('popstate', handleRouteSync);
    return () => window.removeEventListener('popstate', handleRouteSync);
  }, []);

  // Load reviews & fresh stay details (including Gold listingAudio) when active stay opens
  useEffect(() => {
    if (activeStayId) {
      api.getReviews(activeStayId).then(res => setActiveStayReviews(res.reviews)).catch(() => {});
      api
        .getStay(activeStayId)
        .then(res => {
          if (res?.stay) {
            setStays(prev => {
              const exists = prev.some(s => s.id === res.stay.id);
              return exists ? prev.map(s => (s.id === res.stay.id ? res.stay : s)) : [res.stay, ...prev];
            });
          }
        })
        .catch(() => {});
    }
  }, [activeStayId]);

  // 24-Hour Stay Check-in Alert Runner (Acoustic Chime + Native Browser Notification + Toast Alert)
  const checkAndTriggerUpcomingCheckinAlerts = useCallback(
    (currentBookings: Booking[], currentStays: Stay[]) => {
      if (typeof window === 'undefined') return;
      if (localStorage.getItem('airbus_notif_24h_disabled') === 'true') return;

      const now = Date.now();
      currentBookings.forEach(booking => {
        if (booking.status !== 'confirmed') return;

        const stay = currentStays.find(s => s.id === booking.stayId);
        if (!stay) return;

        // Check-in standard arrival time (14:00 Kenyan time)
        const checkinDateStr = `${booking.checkIn}T14:00:00`;
        const checkinTime = new Date(checkinDateStr).getTime() || new Date(booking.checkIn).getTime();
        if (isNaN(checkinTime)) return;

        const diffMs = checkinTime - now;
        const hoursUntilCheckin = diffMs / (1000 * 60 * 60);

        // Check if within 24 hours (or today within 14h)
        if ((hoursUntilCheckin > 0 && hoursUntilCheckin <= 24) || (hoursUntilCheckin <= 0 && hoursUntilCheckin >= -14)) {
          const storageKey = `airbus_alert_checkin_24h_${booking.id}`;
          const lastAlerted = localStorage.getItem(storageKey);

          // Prevent spamming: only alert once every 12 hours
          if (!lastAlerted || now - Number(lastAlerted) > 12 * 3600 * 1000) {
            localStorage.setItem(storageKey, String(now));
            const alertData = trigger24HourCheckinAlert(booking, stay, hoursUntilCheckin);
            showToast(alertData.toastMessage);
          }
        }
      });
    },
    []
  );

  // Periodic and on-data 24h check-in alert watcher
  useEffect(() => {
    if (bookings.length > 0 && stays.length > 0) {
      checkAndTriggerUpcomingCheckinAlerts(bookings, stays);

      // Check every 60 seconds
      const timer = setInterval(() => {
        checkAndTriggerUpcomingCheckinAlerts(bookings, stays);
      }, 60000);

      return () => clearInterval(timer);
    }
  }, [bookings, stays, checkAndTriggerUpcomingCheckinAlerts]);

  // Handlers
  const handleNavigate = (tab: string) => {
    setCurrentTab(tab);
    if (user && !isOnAdminRoute) {
      try {
        if (tab === 'guest' || tab === 'owner') {
          localStorage.setItem(`airbus_last_tab_${user.role}`, tab);
        } else if (tab === 'home') {
          localStorage.removeItem(`airbus_last_tab_${user.role}`);
        }
      } catch {}
    }
    if (window.location.pathname.startsWith('/listing/')) {
      window.history.pushState({}, '', tab === 'home' ? '/' : `/#${tab}`);
    } else {
      window.location.hash = tab === 'home' ? '' : tab;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToListingFromShort = (
    stayId: string,
    intent: ShortIntentType,
    shortId: string,
    index: number
  ) => {
    const fromShortPayload = { shortId, index };
    setReturnToShort(fromShortPayload);
    setActiveStayIntent(intent);
    setActiveStayId(stayId);
    const nextUrl = `/listing/${encodeURIComponent(stayId)}?intent=${encodeURIComponent(intent)}&source=short#stay-${encodeURIComponent(stayId)}`;
    try {
      window.history.pushState({ fromShort: fromShortPayload }, '', nextUrl);
    } catch {
      window.location.hash = `stay-${stayId}`;
    }
  };

  const handleBackToShort = () => {
    setActiveStayId(null);
    setActiveStayIntent(null);
    setCurrentTab('shorts');
    try {
      if (window.location.pathname.startsWith('/listing/')) {
        window.history.pushState({}, '', '/#shorts');
      } else {
        window.location.hash = 'shorts';
      }
    } catch {
      window.location.hash = 'shorts';
    }
  };

  const handleLoginSuccess = async (loggedInUser: User) => {
    if (!isOnAdminRoute && (loggedInUser.role === 'owner' || loggedInUser.role === 'guest')) {
      api.setActivePublicPortal(loggedInUser.role);
    }
    lastActivityAtRef.current = Date.now();
    lastPingSentAtRef.current = Date.now();
    setIdleWarningOpen(false);
    setUser(loggedInUser);
    showToast(`Welcome back, ${loggedInUser.name}!`);
    await loadUserData(loggedInUser);

    // Route to dedicated dashboard on public site (Admin is handled strictly via private portal)
    if (isOnAdminRoute) {
      return;
    }
    if (loggedInUser.role === 'owner') handleNavigate('owner');
    else handleNavigate('guest');
  };

  const handleToggleWishlist = async (stayId: string) => {
    if (!user) {
      setAuthInitialMode('login');
      setAuthModalOpen(true);
      return;
    }
    try {
      const res = await api.toggleWishlist(stayId);
      setWishlistIds(res.wishlist);
      showToast(res.saved ? 'Saved to wishlist ♥' : 'Removed from wishlist');
    } catch (err: any) {
      showToast(err.message || 'Error updating wishlist');
    }
  };

  const handleBookStay = async (bookingData: any) => {
    if (!user) {
      setAuthInitialMode('login');
      setAuthModalOpen(true);
      throw new Error('Please sign in to confirm booking.');
    }
    const res = await api.createBooking(bookingData);
    setBookings(prev => [res.booking, ...prev]);
    showToast(`Booking ${res.booking.status === 'confirmed' ? 'confirmed' : 'requested'}! Ref: ${res.booking.reference}`);
    return res.booking;
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      const res = await api.updateBookingStatus(bookingId, 'cancelled');
      setBookings(prev => prev.map(b => (b.id === bookingId ? res.booking : b)));
      showToast('Trip cancelled successfully.');
    } catch (err: any) {
      showToast(err.message || 'Could not cancel booking.');
    }
  };

  const handleUpdateProfile = async (data: any) => {
    const res = await api.updateProfile(data);
    setUser(res.user);
    showToast('Profile updated!');
  };

  const handleCreateStay = async (stayData: any) => {
    if (stayData.lat === undefined || stayData.lng === undefined || isNaN(Number(stayData.lat)) || isNaN(Number(stayData.lng))) {
      throw new Error('Mandatory GPS coordinates missing: Valid latitude and longitude are strictly required to pinpoint this stay on the discovery map.');
    }
    const res = await api.createStay(stayData);
    // Newly created stays start as PENDING and NEVER enter the public feed until approved by Admin
    setOwnerStays(prev => [res.stay, ...prev]);
    showToast('Listing submitted for Admin Review. It will go live once approved.');
    return res.stay;
  };

  const handleResubmitStay = async (id: string, updates: any) => {
    const res = await api.resubmitStay(id, updates);
    setOwnerStays(prev => {
      const exists = prev.some(s => s.id === id);
      return exists ? prev.map(s => (s.id === id ? res.stay : s)) : [res.stay, ...prev];
    });
    setStays(prev => prev.filter(s => s.id !== id));
    showToast(res.message || 'Listing updated and resubmitted for Admin Review.');
    return res.stay;
  };

  const handleUpdateStay = async (id: string, updates: Partial<Stay>) => {
    if (updates.lat !== undefined && (isNaN(Number(updates.lat)) || updates.lat === null)) {
      throw new Error('Valid latitude coordinate is required.');
    }
    if (updates.lng !== undefined && (isNaN(Number(updates.lng)) || updates.lng === null)) {
      throw new Error('Valid longitude coordinate is required.');
    }
    const res = await api.updateStay(id, updates);
    const updated = res.stay;
    const isPubliclyVisible =
      (updated.status === 'live' || updated.status === 'PUBLISHED') &&
      (updated.moderationState === 'APPROVED' || (!updated.moderationState && updated.isApprovedByAdmin !== false));
    setStays(prev =>
      isPubliclyVisible
        ? prev.some(s => s.id === id)
          ? prev.map(s => (s.id === id ? updated : s))
          : [updated, ...prev]
        : prev.filter(s => s.id !== id)
    );
    setOwnerStays(prev => prev.map(s => (s.id === id ? updated : s)));
    showToast('Listing updated.');
  };

  const handleDeleteStay = async (id: string) => {
    await api.deleteStay(id);
    setStays(prev => prev.filter(s => s.id !== id));
    setOwnerStays(prev => prev.filter(s => s.id !== id));
    showToast('Listing deleted.');
  };

  const handleUpdateBookingStatus = async (id: string, status: Booking['status']) => {
    const res = await api.updateBookingStatus(id, status);
    setBookings(prev => prev.map(b => (b.id === id ? res.booking : b)));
    showToast(`Reservation marked as ${status}.`);
  };

  const handleSendMessage = async (msg: any) => {
    if (!chatStayId) return;
    const res = await api.sendMessage(chatStayId, msg);
    setThreads(prev => {
      const idx = prev.findIndex(t => t.id === res.thread.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = res.thread;
        return copy;
      }
      return [res.thread, ...prev];
    });
    showToast('Message sent.');
  };

  const handleReplyOffer = async (action: 'accept' | 'decline') => {
    if (!chatStayId) return;
    const res = await api.replyOffer(chatStayId, action);
    setThreads(prev => {
      const idx = prev.findIndex(t => t.id === res.thread.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = res.thread;
        return copy;
      }
      return [res.thread, ...prev];
    });
    showToast(action === 'accept' ? 'Offer accepted!' : 'Offer declined.');
  };

  const handleSubmitOffer = async (amount: number) => {
    if (!negotiateStayId) return;
    if (!user) {
      setAuthInitialMode('login');
      setAuthModalOpen(true);
      return;
    }
    const res = await api.sendMessage(negotiateStayId, {
      type: 'offer',
      amount,
    });
    setThreads(prev => {
      const idx = prev.findIndex(t => t.id === res.thread.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = res.thread;
        return copy;
      }
      return [res.thread, ...prev];
    });
    showToast(`Offer of KES ${amount.toLocaleString()} sent to host!`);
  };

  const handlePostReview = async (data: any) => {
    const res = await api.createReview(data);
    setActiveStayReviews(prev => [res.review, ...prev]);
    showToast('Review posted!');
  };

  const handleSubmitPayment = async (kind: 'plan' | 'wallet', tier: any, amount: number, mpesaCode: string, period?: 'monthly' | 'annual') => {
    await api.submitPayment({ kind, tier, amount, mpesaCode, period });
    showToast('Payment receipt submitted for admin verification.');
  };

  const handlePayPlanFromWallet = async (tier: any, period?: 'monthly' | 'annual') => {
    const res = await api.payPlanFromWallet(tier, period);
    setHostPlan(res.plan);
    setWalletBalance(res.walletBalance);
    // Refresh public stays & ownerStays so reactivated listings return live immediately
    api.getStays().then(r => setStays(r.stays)).catch(() => {});
    if (user?.email) {
      api.getStays({ ownerEmail: user.email }).then(r => setOwnerStays(r.stays || [])).catch(() => {});
    }
    if (res.plan.scheduledTier) {
      showToast(`${tier} Plan scheduled to activate when current period completes!`);
    } else {
      showToast(`${period === 'annual' ? 'Annual' : '30-Day'} ${tier} Plan activated instantly from wallet!`);
    }
  };

  const renderIdleWarningModal = () => {
    if (!user || !idleWarningOpen) return null;
    return (
      <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-md bg-white dark:bg-[#15171e] border border-amber-500/50 rounded-3xl p-6 shadow-2xl space-y-4 text-stone-900 dark:text-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Inactivity Timeout Warning
              </span>
              <h3 className="text-base font-extrabold">Session Expiring Soon</h3>
            </div>
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            You have been inactive for nearly 20 minutes. For your account security, your session will automatically log out in{' '}
            <strong className="font-mono text-sm text-[#e4002b]">{idleSecondsLeft}s</strong>. Dismiss this notice or keep using the app to stay logged in.
          </p>

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleLogout('Signed out successfully.')}
              className="px-4 py-2 rounded-full border border-stone-300 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              Log Out Now
            </button>
            <button
              type="button"
              onClick={() => resetIdleTimer(true)}
              className="px-5 py-2.5 rounded-full bg-[#e4002b] hover:bg-[#c90026] text-white text-xs font-extrabold shadow cursor-pointer"
            >
              Keep Using App / Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Active stay helper
  const activeStay = stays.find(s => s.id === activeStayId) || null;
  const negotiateStay = stays.find(s => s.id === negotiateStayId) || null;
  const chatStay = stays.find(s => s.id === chatStayId) || null;
  const activeThread = threads.find(t => t.id === chatStayId || t.stayId === chatStayId) || null;

  const totalUnreadMessages = threads.filter(t => (user?.role === 'owner' ? t.unreadHost : t.unreadGuest)).length;

  // PRIVATE ADMIN PORTAL (Requirements 2, 3, 4, 5, 6)
  if (isOnAdminRoute) {
    if (!user || user.role !== 'admin') {
      return (
        <AdminPortalLanding
          onAdminAuthenticated={adminUser => {
            lastActivityAtRef.current = Date.now();
            lastPingSentAtRef.current = Date.now();
            setIdleWarningOpen(false);
            setUser(adminUser);
            showToast(`Welcome Administrator, ${adminUser.name}`);
            loadUserData(adminUser);
          }}
          onLogin={async (email, pass) => api.login(email, pass)}
        />
      );
    }

    return (
      <div className="min-h-screen bg-[#fbfbf8] dark:bg-[#0b0c10] text-[#0a0a0a] dark:text-[#f4f4f2] transition-colors">
        {toastMessage && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0a0a0a] dark:bg-white text-white dark:text-black text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full shadow-2xl animate-in slide-in-from-bottom duration-200 border border-stone-700 pointer-events-none">
            {toastMessage}
          </div>
        )}

        <AdminErrorBoundary
          onBack={() => {
            const basePrefix = getNormalizedBasePrefix(window.location.pathname);
            window.history.pushState({}, '', `${basePrefix}/`);
            setIsOnAdminRoute(false);
            setCurrentTab('home');
          }}
        >
        <React.Suspense
          fallback={
            <div className="min-h-screen w-full bg-[#0d0f14] flex flex-col items-center justify-center text-white">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-[#e4002b] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-bold tracking-wide">Loading AirBus Administrative Console...</span>
              </div>
            </div>
          }
        >
          <AdminDashboard
            adminUser={user}
            initialTab={adminInitialTab}
            metrics={adminOverview?.metrics || {
              totalStays: stays.length,
              liveStays: stays.filter(s => s.status === 'live' || s.status === 'PUBLISHED').length,
              pendingReviews: 0,
              totalUsers: 0,
              pendingPayments: 0,
              totalBookings: 0,
              volumeKes: 0,
            }}
            stays={Array.isArray(adminOverview?.stays) && adminOverview.stays.length > 0 ? adminOverview.stays : stays}
            users={Array.isArray(adminOverview?.users) ? adminOverview.users : []}
            payments={Array.isArray(adminOverview?.payments) ? adminOverview.payments : []}
            threads={threads}
            auditLogs={Array.isArray(adminOverview?.auditLogs) ? adminOverview.auditLogs : []}
            onApprovePayment={async id => {
              await api.approvePayment(id);
              const updated = await api.getAdminOverview();
              setAdminOverview(updated);
              const sRes = await api.getStays();
              setStays(sRes.stays);
              showToast('Payment approved & subscription activated!');
            }}
            onRejectPayment={async (id, reason) => {
              await api.rejectPayment(id, reason);
              const updated = await api.getAdminOverview();
              setAdminOverview(updated);
              showToast('Payment marked as rejected.');
            }}
            onVerifyUser={async email => {
              await api.verifyUser(email);
              const updated = await api.getAdminOverview();
              setAdminOverview(updated);
              showToast('User ID verification toggled.');
            }}
            onUpdateStay={handleUpdateStay}
            onDeleteStay={handleDeleteStay}
            onAdjustHostPlan={async (hostEmail, tier, days) => {
              await api.adjustHostPlan(hostEmail, tier, days);
              const [updated, sRes] = await Promise.all([
                api.getAdminOverview(),
                api.getStays(),
              ]);
              setAdminOverview(updated);
              setStays(sRes.stays);
              showToast(`Plan updated for ${hostEmail}.`);
            }}
            currency={currency}
            onBackToFeed={() => {
              const basePrefix = getNormalizedBasePrefix(window.location.pathname);
              window.history.pushState({}, '', `${basePrefix}/`);
              setIsOnAdminRoute(false);
              setCurrentTab('home');
            }}
            showToast={showToast}
            onLogout={() => handleLogout()}
            onUpdateAdminUser={updated => setUser(updated)}
          />
        </React.Suspense>
        </AdminErrorBoundary>
        {renderIdleWarningModal()}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fbfbf8] dark:bg-[#0b0c10] text-[#0a0a0a] dark:text-[#f4f4f2] transition-colors">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0a0a0a] dark:bg-white text-white dark:text-black text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full shadow-2xl animate-in slide-in-from-bottom duration-200 border border-stone-700 pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* Global Header (hidden on mobile during fullscreen Shorts view to guarantee 100dvh safe-area fit) */}
      <div className={currentTab === 'shorts' ? 'hidden md:block' : ''}>
        <Header
          currentTab={currentTab}
          onNavigate={handleNavigate}
          user={user}
          onOpenAuth={mode => {
            setAuthInitialMode(mode || 'login');
            setAuthModalOpen(true);
          }}
          onLogout={handleLogout}
          currency={currency}
          onCurrencyChange={setCurrency}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          guestCount={guestCount}
          onGuestCountChange={setGuestCount}
          onSearchSubmit={() => handleNavigate('home')}
          unreadCount={totalUnreadMessages}
          unreadNotifications={unreadNotifsCount}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenTripFinder={() => setTripFinderOpen(true)}
          onOpenPlans={() => {
            setPlanWalletMode(false);
            setPlanModalOpen(true);
          }}
          onOpenSettings={() => setSettingsModalOpen(true)}
          walletBalance={walletBalance}
          onOpenWallet={() => {
            setPlanWalletMode(true);
            setPlanModalOpen(true);
          }}
          onOpenAdminWallet={() => {
            const basePrefix = getNormalizedBasePrefix(window.location.pathname);
            window.history.pushState({}, '', `${basePrefix}${ADMIN_PORTAL_PATH}`);
            setAdminInitialTab('treasury');
            setIsOnAdminRoute(true);
          }}
        />
      </div>

      {/* Main Content Router */}
      <main className="flex-1">
        {currentTab === 'home' && (
          <HomeFeed
            stays={stays}
            savedStayIds={wishlistIds}
            onToggleSave={handleToggleWishlist}
            onSelectStay={id => {
              setActiveStayId(id);
              window.location.hash = `stay-${id}`;
            }}
            onCheckAvailability={id => setActiveStayId(id)}
            onBookNow={id => setActiveStayId(id)}
            onChatHost={id => setChatStayId(id)}
            onNegotiate={id => setNegotiateStayId(id)}
            onNavigateCollection={slug => handleNavigate(`collection-${slug}`)}
            currency={currency}
            searchQuery={searchQuery}
            guestCount={guestCount}
            hasMore={staysHasMore}
            loadingMore={loadingMoreStays}
            onLoadMore={handleLoadMoreStays}
          />
        )}

        {currentTab === 'shorts' && (
          <ShortsView
            stays={stays}
            savedStayIds={wishlistIds}
            user={user}
            onToggleSave={handleToggleWishlist}
            onNavigateToListing={handleNavigateToListingFromShort}
            onBookNow={id => setActiveStayId(id)}
            onBackToFeed={() => handleNavigate('home')}
            initialShortId={returnToShort?.shortId || null}
            currency={currency}
            onUpdateStay={(id, updates) =>
              setStays(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)))
            }
            onOpenAuth={() => {
              setAuthInitialMode('login');
              setAuthModalOpen(true);
            }}
            showToast={showToast}
          />
        )}

        {/* GUEST DASHBOARD (Private — Guest Credentials Only) */}
        {currentTab === 'guest' && (
          !user ? (
            <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 text-center space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-[#e4002b]/10 text-[#e4002b] flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">Private Guest Dashboard</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Sign in with your Guest credentials to view your trips, wishlist, negotiations, and private Guest Wallet.
              </p>
              <button
                onClick={() => {
                  setAuthInitialMode('login');
                  setAuthInitialPortal('guest');
                  setAuthModalOpen(true);
                }}
                className="px-6 py-2.5 bg-[#e4002b] hover:bg-[#c90026] text-white rounded-full text-xs font-bold transition-all shadow cursor-pointer"
              >
                Login to Guest
              </button>
            </div>
          ) : user.role !== 'guest' ? (
            <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 text-center space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">Guest Portal Only</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Your active session ({user.username || user.name}) is a Host/Admin account. Guest and Host credentials are strictly separate. Log out and sign in or sign up as a Guest to access the Guest Dashboard.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => handleNavigate('home')}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-stone-300 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  Explore Stays
                </button>
                <button
                  onClick={async () => {
                    await handleLogout();
                    setAuthInitialMode('login');
                    setAuthInitialPortal('guest');
                    setAuthModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#e4002b] hover:bg-[#c90026] text-white text-xs font-bold shadow transition-all cursor-pointer"
                >
                  Log Out &amp; Login to Guest
                </button>
              </div>
            </div>
          ) : (
            <GuestDashboard
              user={user}
              bookings={bookings}
              stays={stays}
              wishlistIds={wishlistIds}
              threads={threads}
              walletBalance={walletBalance}
              onWalletBalanceUpdated={bal => setWalletBalance(bal)}
              onOpenAdvertise={() => window.dispatchEvent(new CustomEvent('airbus:open-advert-modal'))}
              onToggleSave={handleToggleWishlist}
              onSelectStay={id => {
                setActiveStayId(id);
                window.location.hash = `stay-${id}`;
              }}
              onCheckAvailability={id => setActiveStayId(id)}
              onBookNow={id => setActiveStayId(id)}
              onChatHost={id => setChatStayId(id)}
              onNegotiate={id => setNegotiateStayId(id)}
              onCancelBooking={handleCancelBooking}
              onUpdateProfile={handleUpdateProfile}
              currency={currency}
              onBackToFeed={() => handleNavigate('home')}
              onNavigateToShorts={() => handleNavigate('shorts')}
              onNavigateToCollections={() => handleNavigate('collection-plus')}
              showToast={showToast}
            />
          )
        )}

        {/* OWNER HUB DASHBOARD (Private — Host Credentials Only) */}
        {currentTab === 'owner' && (
          !user ? (
            <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 text-center space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">Private Host Dashboard</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Sign in with your Host credentials to manage your listings, 30-day subscriptions, and Host wallet.
              </p>
              <button
                onClick={() => {
                  setAuthInitialMode('login');
                  setAuthInitialPortal('owner');
                  setAuthModalOpen(true);
                }}
                className="px-6 py-2.5 bg-[#e4002b] hover:bg-[#c90026] text-white rounded-full text-xs font-bold transition-all shadow cursor-pointer"
              >
                Login to Host
              </button>
            </div>
          ) : user.role !== 'owner' && user.role !== 'admin' ? (
            <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 text-center space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">Host Portal Only</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Your active session ({user.username || user.name}) is a Guest account. Guests and Hosts have separate credentials and dashboards. To access the Host Dashboard, log out first and sign up or log in with Host credentials.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => handleNavigate('home')}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-stone-300 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  Explore Stays
                </button>
                <button
                  onClick={async () => {
                    await handleLogout();
                    setAuthInitialMode('login');
                    setAuthInitialPortal('owner');
                    setAuthModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#e4002b] hover:bg-[#c90026] text-white text-xs font-bold shadow transition-all cursor-pointer"
                >
                  Log Out &amp; Login to Host
                </button>
              </div>
            </div>
          ) : (
            <OwnerDashboard
              user={user}
              myStays={user.role === 'owner' ? ownerStays : stays.filter(s => s.ownerEmail === user.email)}
              bookings={bookings}
              plan={hostPlan}
              walletBalance={walletBalance}
              onOpenPlanModal={() => {
                setPlanWalletMode(false);
                setPlanModalOpen(true);
              }}
              onOpenTopupModal={() => {
                setPlanWalletMode(true);
                setPlanModalOpen(true);
              }}
              onCreateStay={handleCreateStay}
              onResubmitStay={handleResubmitStay}
              onRefreshMyStays={() =>
                api
                  .getMyStays()
                  .then(r => setOwnerStays(r?.stays || []))
                  .catch(() => {})
              }
              onUpdateStay={handleUpdateStay}
              onDeleteStay={handleDeleteStay}
              onUpdateBookingStatus={handleUpdateBookingStatus}
              onDescribeStayAI={params => api.describeStayAI(params)}
              currency={currency}
              onBackToFeed={() => handleNavigate('home')}
              onNavigateToShorts={() => handleNavigate('shorts')}
              onRefreshWallet={() => {
                const slot = user?.role === 'owner' ? 'owner' : user?.role === 'guest' ? 'guest' : undefined;
                api
                  .getWallet(slot)
                  .then(w => {
                    if (w?.wallet?.balance !== undefined) setWalletBalance(w.wallet.balance);
                  })
                  .catch(() => {});
              }}
              walletRefreshTick={walletRefreshTick}
              showToast={showToast}
            />
          )
        )}

        {currentTab === 'earn' && (
          <EarnTab
            user={user}
            onOpenAuth={() => {
              setAuthInitialMode('login');
              setAuthModalOpen(true);
            }}
            showToast={showToast}
            onGoToWallet={() => handleNavigate('owner')}
          />
        )}

        {/* TRIP DATING */}
        {currentTab === 'trip-dating' && (
          <TripDatingPage
            currentUser={user}
            onNavigateToStays={() => handleNavigate('home')}
            onOpenAuth={() => {
              setAuthInitialMode('login');
              setAuthModalOpen(true);
            }}
            userWalletBalance={walletBalance}
            onWalletBalanceUpdated={(bal: number) => setWalletBalance(bal)}
            onOpenWalletDeposit={() => {
              setPlanWalletMode(true);
              setPlanModalOpen(true);
            }}
            showToast={showToast}
          />
        )}

        {/* AIRBUS COLLECTIONS (Black Friday, Work, Escapes, Plus VVVIP, Local, World Wide) */}
        {currentTab.startsWith('collection-') && (
          <CollectionsPage
            slug={currentTab.replace('collection-', '') as CollectionSlug}
            user={user}
            currency={currency}
            onCurrencyChange={setCurrency}
            savedStayIds={wishlistIds}
            onToggleSave={handleToggleWishlist}
            onSelectStay={id => {
              setActiveStayId(id);
              window.location.hash = `stay-${id}`;
            }}
            onCheckAvailability={id => setActiveStayId(id)}
            onBookNow={id => setActiveStayId(id)}
            onChatHost={id => setChatStayId(id)}
            onNegotiate={id => setNegotiateStayId(id)}
            onBackToFeed={() => handleNavigate('home')}
            onNavigateCollection={slug => handleNavigate(`collection-${slug}`)}
            onNavigateTripDating={() => handleNavigate('trip-dating')}
            userWalletBalance={walletBalance}
            onOpenWalletDeposit={() => {
              setPlanWalletMode(true);
              setPlanModalOpen(true);
            }}
            onOpenAuth={() => {
              setAuthInitialMode('login');
              setAuthModalOpen(true);
            }}
            onUserUpgraded={updatedUser => {
              setUser(updatedUser);
              api.getStays().then(r => setStays(r.stays)).catch(() => {});
              api.getWallet().then(w => {
                if (w?.wallet?.balance !== undefined) setWalletBalance(w.wallet.balance);
              }).catch(() => {});
            }}
            showToast={showToast}
          />
        )}
      </main>

      {/* Airbnb-Mimic Mega Footer with dynamic category tabs & Kenyan destinations (hidden in fullscreen Shorts player) */}
      {currentTab !== 'shorts' && (
        <>
          <Footer
            onNavigate={handleNavigate}
            currency={currency}
            onCurrencyChange={setCurrency}
            onOpenTripFinder={() => setTripFinderOpen(true)}
            onOpenPlans={() => {
              setPlanWalletMode(false);
              setPlanModalOpen(true);
            }}
          />
          <ScrollToTop />
        </>
      )}

      {/* MODALS */}
      {/* 1. Neon Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setAuthInitialPortal(null);
        }}
        initialMode={authInitialMode}
        initialPortal={authInitialPortal}
        onLoginSuccess={handleLoginSuccess}
        onLogin={(email, pass) => api.login(email, pass)}
        onRegister={data => api.register(data)}
      />

      {/* 2. Stay Detail Modal */}
      <StayDetailModal
        stay={activeStay}
        isOpen={!!activeStayId}
        onClose={() => {
          if (returnToShort) {
            handleBackToShort();
            return;
          }
          setActiveStayId(null);
          setActiveStayIntent(null);
          if (window.location.pathname.startsWith('/listing/')) {
            window.history.pushState({}, '', currentTab === 'home' ? '/' : `/#${currentTab}`);
          } else {
            window.location.hash = currentTab === 'home' ? '' : currentTab;
          }
        }}
        user={user}
        isSaved={!!activeStayId && wishlistIds.includes(activeStayId)}
        onToggleSave={handleToggleWishlist}
        onBook={handleBookStay}
        onChatHost={id => setChatStayId(id)}
        onNegotiate={id => setNegotiateStayId(id)}
        onPostReview={handlePostReview}
        reviews={activeStayReviews}
        currency={currency}
        relatedStays={stays.filter(s => s.id !== activeStayId)}
        onSelectRelatedStay={id => {
          setActiveStayId(id);
          setActiveStayIntent(null);
          window.location.hash = `stay-${id}`;
        }}
        onUpdateStay={(id, updates) =>
          setStays(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)))
        }
        userWalletBalance={walletBalance}
        onOpenTopup={() => {
          setPlanWalletMode(true);
          setPlanModalOpen(true);
        }}
        onOpenAuth={() => {
          setAuthInitialMode('login');
          setAuthModalOpen(true);
        }}
        showToast={showToast}
        initialIntent={activeStayIntent}
        fromShort={Boolean(returnToShort)}
        onBackToShort={handleBackToShort}
      />

      {/* 3. Negotiate Modal */}
      <NegotiateModal
        stay={negotiateStay}
        isOpen={!!negotiateStayId}
        onClose={() => setNegotiateStayId(null)}
        onSubmitOffer={handleSubmitOffer}
        currency={currency}
      />

      {/* 4. Chat & Negotiations Modal */}
      <ChatModal
        stay={chatStay}
        thread={activeThread}
        user={user}
        isOpen={!!chatStayId}
        onClose={() => setChatStayId(null)}
        onSendMessage={handleSendMessage}
        onReplyOffer={handleReplyOffer}
      />

      {/* 5. Subscription Plan & M-Pesa Modal */}
      <PlanModal
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        currentPlan={hostPlan}
        onSubmitPayment={handleSubmitPayment}
        walletMode={planWalletMode}
        userWalletBalance={walletBalance}
        onPayFromWallet={handlePayPlanFromWallet}
        portalSlot={user?.role === 'owner' ? 'owner' : user?.role === 'guest' ? 'guest' : undefined}
        onDepositSubmitted={payment => {
          setWalletRefreshTick(t => t + 1);
          const amt = Number(payment?.claimedAmount ?? payment?.amountKes ?? payment?.amount ?? 0);
          const code = payment?.mpesaCode || '';
          showToast(
            amt > 0
              ? `Deposit of KES ${amt.toLocaleString()}${code ? ` (${code})` : ''} submitted for Admin approval.`
              : 'Deposit (M-Pesa) submitted for Admin approval.'
          );
        }}
      />

      {/* 6. AI Trip Finder Modal */}
      <TripFinderModal
        isOpen={tripFinderOpen}
        onClose={() => setTripFinderOpen(false)}
        onFindTrips={params => api.findTripsAI(params).then(res => res.matches)}
        savedStayIds={wishlistIds}
        onToggleSave={handleToggleWishlist}
        onSelectStay={id => {
          setTripFinderOpen(false);
          setActiveStayId(id);
        }}
        onCheckAvailability={id => {
          setTripFinderOpen(false);
          setActiveStayId(id);
        }}
        onBookNow={id => {
          setTripFinderOpen(false);
          setActiveStayId(id);
        }}
        onChatHost={id => {
          setTripFinderOpen(false);
          setChatStayId(id);
        }}
        onNegotiate={id => {
          setTripFinderOpen(false);
          setNegotiateStayId(id);
        }}
        currency={currency}
      />

      {/* 7. Notifications Modal */}
      <NotificationsModal
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={async () => {
          await api.markNotificationsRead();
          setUnreadNotifsCount(0);
          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }}
        onDeleteNotification={async id => {
          await api.deleteNotification(id);
          setNotifications(prev => prev.filter(n => n.id !== id));
          setUnreadNotifsCount(prev => Math.max(0, prev - 1));
          showToast('Notification deleted.');
        }}
        onClearAllNotifications={async () => {
          await api.clearNotifications();
          setNotifications([]);
          setUnreadNotifsCount(0);
          showToast('All notifications cleared.');
        }}
      />

      {/* 8. Settings & Profile Modal */}
      {user && (
        <SettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          user={user}
          onUpdateProfile={handleUpdateProfile}
          showToast={showToast}
          currency={currency}
          onCurrencyChange={setCurrency}
          bookings={bookings}
          stays={stays}
        />
      )}

      {/* 9. Part D: Persistent Advert Card in Bottom-Right Corner (Fixed, NO CLOSE/DISMISS CONTROL) */}
      <PersistentAdCard
        onSelectStay={id => {
          setActiveStayId(id);
          window.location.hash = `stay-${id}`;
        }}
        userWalletBalance={walletBalance}
        userEmail={user?.email}
        userRole={user?.role}
        onOpenWalletDeposit={() => {
          if (!user) {
            setAuthInitialMode('login');
            setAuthInitialPortal(null);
            setAuthModalOpen(true);
            return;
          }
          if (user.role === 'guest') {
            handleNavigate('guest');
          } else if (user.role === 'owner') {
            setPlanWalletMode(true);
            setPlanModalOpen(true);
          }
        }}
        showToast={showToast}
      />

      {/* 10. 20-Minute Inactivity Countdown Disclaimer Modal */}
      {renderIdleWarningModal()}
    </div>
  );
}
