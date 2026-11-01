import React, { useState, useEffect, useCallback } from 'react';
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
} from './types';
import { api } from './api';
import { Header } from './components/Header';
import { HomeFeed } from './components/HomeFeed';
import { ShortsView } from './components/ShortsView';
import { GuestDashboard } from './components/GuestDashboard';
import { OwnerDashboard } from './components/OwnerDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { StayDetailModal } from './components/StayDetailModal';
import { NegotiateModal } from './components/NegotiateModal';
import { ChatModal } from './components/ChatModal';
import { PlanModal } from './components/PlanModal';
import { TripFinderModal } from './components/TripFinderModal';
import { NotificationsModal } from './components/NotificationsModal';
import { EarnTab } from './components/EarnTab';
import { AdvertisementManager } from './components/AdvertisementManager';
import { SettingsModal } from './components/SettingsModal';
import { Lock } from 'lucide-react';
import {
  trigger24HourCheckinAlert,
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
} from './utils/notifications';

export default function App() {
  // Navigation & View
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [currency, setCurrency] = useState<Currency>('KES');
  const [searchQuery, setSearchQuery] = useState('');
  const [guestCount, setGuestCount] = useState(2);

  // Core Data
  const [user, setUser] = useState<User | null>(null);
  const [stays, setStays] = useState<Stay[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  // Host Data
  const [hostPlan, setHostPlan] = useState<HostPlanStatus>({
    tier: 'Diamond',
    status: 'active',
    expiresAt: Date.now() + 30 * 864e5,
  });
  const [walletBalance, setWalletBalance] = useState(14500);

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
  const [activeStayId, setActiveStayId] = useState<string | null>(null);
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

  // Initial Load
  const loadInitialData = useCallback(async () => {
    try {
      // Fetch public stays
      const staysRes = await api.getStays();
      setStays(staysRes.stays);

      // Check user session
      const token = api.getToken();
      if (token) {
        try {
          const meRes = await api.getMe();
          setUser(meRes.user);
          await loadUserData(meRes.user);
        } catch {
          api.logout();
        }
      }
    } catch (err) {
      console.warn('Initial data load warning:', err);
    }
  }, []);

  const loadUserData = async (currentUser: User) => {
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

      // Host plan & wallet
      if (currentUser.role === 'owner' || currentUser.role === 'admin') {
        const pRes = await api.getHostPlan();
        setHostPlan(pRes.plan);
        setWalletBalance(pRes.wallet);
      }

      // Admin metrics
      if (currentUser.role === 'admin') {
        const aRes = await api.getAdminOverview();
        setAdminOverview(aRes);
      }
    } catch (err) {
      console.warn('Error loading user-specific data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

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

  // URL Hash Routing Sync
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (!hash || hash === 'home') {
        setCurrentTab('home');
      } else if (hash === 'shorts') {
        setCurrentTab('shorts');
      } else if (hash === 'earn') {
        setCurrentTab('earn');
      } else if (hash === 'guest') {
        setCurrentTab('guest');
      } else if (hash === 'owner' || hash === 'host') {
        setCurrentTab('owner');
      } else if (hash === 'admin') {
        setCurrentTab('admin');
      } else if (hash === 'inbox') {
        if (!user) {
          setAuthModalOpen(true);
        } else if (user.role === 'guest') {
          setCurrentTab('guest');
        } else {
          setCurrentTab('owner');
        }
      } else if (hash.startsWith('stay-')) {
        const sId = hash.slice(5);
        setActiveStayId(sId);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user]);

  // Load reviews when active stay opens
  useEffect(() => {
    if (activeStayId) {
      api.getReviews(activeStayId).then(res => setActiveStayReviews(res.reviews)).catch(() => {});
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
    window.location.hash = tab === 'home' ? '' : tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = async (loggedInUser: User) => {
    setUser(loggedInUser);
    showToast(`Welcome back, ${loggedInUser.name}!`);
    await loadUserData(loggedInUser);

    // Route to dedicated dashboard
    if (loggedInUser.role === 'admin') handleNavigate('admin');
    else if (loggedInUser.role === 'owner') handleNavigate('owner');
    else handleNavigate('guest');
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setBookings([]);
    setWishlistIds([]);
    setThreads([]);
    handleNavigate('home');
    showToast('Signed out successfully.');
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
    setStays(prev => [res.stay, ...prev]);
    showToast('Stay published live successfully!');
  };

  const handleUpdateStay = async (id: string, updates: Partial<Stay>) => {
    if (updates.lat !== undefined && (isNaN(Number(updates.lat)) || updates.lat === null)) {
      throw new Error('Valid latitude coordinate is required.');
    }
    if (updates.lng !== undefined && (isNaN(Number(updates.lng)) || updates.lng === null)) {
      throw new Error('Valid longitude coordinate is required.');
    }
    const res = await api.updateStay(id, updates);
    setStays(prev => prev.map(s => (s.id === id ? res.stay : s)));
    showToast('Listing updated.');
  };

  const handleDeleteStay = async (id: string) => {
    await api.deleteStay(id);
    setStays(prev => prev.filter(s => s.id !== id));
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
    if (res.plan.scheduledTier) {
      showToast(`${tier} Plan scheduled to activate when current period completes!`);
    } else {
      showToast(`${period === 'annual' ? 'Annual' : '30-Day'} ${tier} Plan activated instantly from wallet!`);
    }
  };

  // Active stay helper
  const activeStay = stays.find(s => s.id === activeStayId) || null;
  const negotiateStay = stays.find(s => s.id === negotiateStayId) || null;
  const chatStay = stays.find(s => s.id === chatStayId) || null;
  const activeThread = threads.find(t => t.id === chatStayId || t.stayId === chatStayId) || null;

  const totalUnreadMessages = threads.filter(t => (user?.role === 'owner' ? t.unreadHost : t.unreadGuest)).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#fbfbf8] dark:bg-[#0b0c10] text-[#0a0a0a] dark:text-[#f4f4f2] transition-colors">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0a0a0a] dark:bg-white text-white dark:text-black text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full shadow-2xl animate-in slide-in-from-bottom duration-200 border border-stone-700 pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* Global Header */}
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
      />

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
            currency={currency}
            searchQuery={searchQuery}
            guestCount={guestCount}
          />
        )}

        {currentTab === 'shorts' && (
          <ShortsView
            stays={stays}
            savedStayIds={wishlistIds}
            user={user}
            onToggleSave={handleToggleWishlist}
            onBookNow={id => setActiveStayId(id)}
            onNegotiate={id => setNegotiateStayId(id)}
            onChatHost={id => setChatStayId(id)}
            onBackToFeed={() => handleNavigate('home')}
            currency={currency}
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
          />
        )}

        {/* GUEST DASHBOARD (Private) */}
        {currentTab === 'guest' && (
          !user ? (
            <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 text-center space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-[#e4002b]/10 text-[#e4002b] flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">Private Guest Dashboard</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Please sign in to view your private reservations, saved short-stay wishlist, and direct host negotiation threads.
              </p>
              <button
                onClick={() => {
                  setAuthInitialMode('login');
                  setAuthModalOpen(true);
                }}
                className="px-6 py-2.5 bg-[#e4002b] hover:bg-[#c90026] text-white rounded-full text-xs font-bold transition-all shadow cursor-pointer"
              >
                Sign In / Register
              </button>
            </div>
          ) : (
            <GuestDashboard
              user={user}
              bookings={bookings}
              stays={stays}
              wishlistIds={wishlistIds}
              threads={threads}
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
            />
          )
        )}

        {/* OWNER HUB DASHBOARD (Private) */}
        {currentTab === 'owner' && (
          !user ? (
            <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 text-center space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">Private Owner Hub</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Sign in to manage your listings, active subscriptions, booking calendar, and host wallet.
              </p>
              <button
                onClick={() => {
                  setAuthInitialMode('login');
                  setAuthModalOpen(true);
                }}
                className="px-6 py-2.5 bg-[#e4002b] hover:bg-[#c90026] text-white rounded-full text-xs font-bold transition-all shadow cursor-pointer"
              >
                Sign In to Owner Hub
              </button>
            </div>
          ) : user.role !== 'owner' && user.role !== 'admin' ? (
            <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 text-center space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">Host Registration Required</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Your account ({user.email}) is currently registered as a Guest. You can switch to a Host account or explore stays.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => handleNavigate('home')}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-stone-300 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Explore Stays
                </button>
                <button
                  onClick={async () => {
                    await handleUpdateProfile({ role: 'owner' });
                    showToast('Role updated to Host / Owner!');
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#e4002b] hover:bg-[#c90026] text-white text-xs font-bold shadow transition-all cursor-pointer"
                >
                  Activate Host Account
                </button>
              </div>
            </div>
          ) : (
            <OwnerDashboard
              user={user}
              myStays={stays.filter(s => s.ownerEmail === user.email)}
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
              onUpdateStay={handleUpdateStay}
              onDeleteStay={handleDeleteStay}
              onUpdateBookingStatus={handleUpdateBookingStatus}
              onDescribeStayAI={params => api.describeStayAI(params)}
              currency={currency}
              onBackToFeed={() => handleNavigate('home')}
            />
          )
        )}

        {/* ADMIN DASHBOARD (Private) */}
        {currentTab === 'admin' && (
          !user || user.role !== 'admin' ? (
            <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 text-center space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">Admin Console Restricted</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Access to the AirBus Admin Console is strictly restricted to verified platform administrators.
              </p>
              <button
                onClick={() => handleNavigate('home')}
                className="px-6 py-2.5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-full text-xs font-bold shadow cursor-pointer hover:opacity-90"
              >
                Return to Public Feed
              </button>
            </div>
          ) : (
            <AdminDashboard
              adminUser={user}
              metrics={adminOverview.metrics}
              stays={stays}
              users={adminOverview.users}
              payments={adminOverview.payments}
              threads={threads}
              auditLogs={adminOverview.auditLogs}
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
                showToast(`Plan updated for ${hostEmail}.`);
              }}
              currency={currency}
              onBackToFeed={() => handleNavigate('home')}
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
      </main>

      {/* Footer */}
      <footer className="mt-12 py-8 bg-white dark:bg-[#15171e] border-t border-[#e6e6e1] dark:border-[#262934] text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#e4002b] text-sm font-heading">AIRBUS</span>
            <span>·</span>
            <span>Video-First Stays &amp; Direct Booking</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <button onClick={() => setTripFinderOpen(true)} className="hover:text-[#e4002b] cursor-pointer">
              ✨ Trip Finder
            </button>
            <button
              onClick={() => {
                setPlanWalletMode(false);
                setPlanModalOpen(true);
              }}
              className="hover:text-[#e4002b] cursor-pointer"
            >
              Hosting Plans
            </button>
            <button
              onClick={() => handleNavigate('earn')}
              className="hover:text-[#ff2e93] cursor-pointer font-bold flex items-center gap-1"
            >
              🎁 Earn 10% Affiliate
            </button>
            <button
              onClick={() => {
                if (user?.role === 'admin') handleNavigate('admin');
                else if (user?.role === 'owner') handleNavigate('owner');
                else if (user) handleNavigate('guest');
                else setAuthModalOpen(true);
              }}
              className="hover:text-[#e4002b] cursor-pointer font-bold"
            >
              Dashboard
            </button>
          </div>

          <div className="text-[11px] text-stone-400">
            Nairobi · Mombasa · Diani · Naivasha · 0% Guest Platform Fees
          </div>
        </div>
      </footer>

      {/* MODALS */}
      {/* 1. Neon Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authInitialMode}
        onLoginSuccess={handleLoginSuccess}
        onLogin={(email, pass) => api.login(email, pass)}
        onRegister={data => api.register(data)}
      />

      {/* 2. Stay Detail Modal */}
      <StayDetailModal
        stay={activeStay}
        isOpen={!!activeStayId}
        onClose={() => {
          setActiveStayId(null);
          window.location.hash = currentTab === 'home' ? '' : currentTab;
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

      {/* 9. Continuous Advertisement Popups in Bottom-Right Corner (Cycles 3s & redirects to stay) */}
      <AdvertisementManager
        onSelectStay={id => {
          setActiveStayId(id);
          window.location.hash = `stay-${id}`;
        }}
      />
    </div>
  );
}
