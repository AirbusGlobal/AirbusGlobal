import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle2,
  Compass,
  Crown,
  Flame,
  Globe,
  Lock,
  Mail,
  MapPin,
  Percent,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Wifi,
  FileText,
  Monitor,
  BookOpen,
  PhoneCall,
  Send,
  X,
  Wallet,
  Upload,
  Heart,
  AlertCircle,
} from 'lucide-react';
import {
  Stay,
  User,
  Currency,
  CURRENCY_RATES,
  LocalGuideProfile,
  NeighborhoodArticle,
  LocalServiceProvider,
  LocalProviderCategory,
  PlusServiceRequest,
} from '../types';
import { api } from '../api';
import { StayCard } from './StayCard';
import { getNextBlackFridayEvent, BlackFridayEvent } from '../utils/blackFridayHelper';

export type CollectionSlug =
  | 'black-friday'
  | 'work'
  | 'escapes'
  | 'plus'
  | 'local'
  | 'worldwide';

const LOCAL_PROVIDER_CATEGORIES: LocalProviderCategory[] = [
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

const AIRBUS_PLUS_SERVICES = [
  {
    title: '24/7 Butler or Chef',
    desc: 'In-residence culinary menus and personal concierge. Pay separately.',
  },
  {
    title: 'Airport Transfer',
    desc: 'Seamless tarmac or VIP arrivals chauffeur pickup. Pay separately.',
  },
  {
    title: 'Hotel-Grade Hygiene',
    desc: 'Daily linen turn-down service and private spa. Pay separately.',
  },
  {
    title: 'Other services, ask.',
    desc: 'Other extra services when you need them. Pay separately.',
  },
];

interface CollectionsPageProps {
  slug: CollectionSlug;
  user: User | null;
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  savedStayIds: string[];
  onToggleSave: (stayId: string) => void;
  onSelectStay: (stayId: string) => void;
  onCheckAvailability: (stayId: string) => void;
  onBookNow: (stayId: string) => void;
  onChatHost: (stayId: string) => void;
  onNegotiate: (stayId: string) => void;
  onBackToFeed: () => void;
  onNavigateCollection: (slug: CollectionSlug) => void;
  onNavigateTripDating?: () => void;
  userWalletBalance?: number;
  onOpenWalletDeposit?: () => void;
  onOpenAuth: () => void;
  onUserUpgraded?: (updatedUser: User) => void;
  showToast?: (msg: string) => void;
}

function getFlagEmoji(code?: string): string {
  if (!code || code.length !== 2) return '🌍';
  return code
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('');
}

export const CollectionsPage: React.FC<CollectionsPageProps> = ({
  slug,
  user,
  currency,
  onCurrencyChange,
  savedStayIds,
  onToggleSave,
  onSelectStay,
  onCheckAvailability,
  onBookNow,
  onChatHost,
  onNegotiate,
  onBackToFeed,
  onNavigateCollection,
  onNavigateTripDating,
  userWalletBalance = 0,
  onOpenWalletDeposit,
  onOpenAuth,
  onUserUpgraded,
  showToast,
}) => {
  const [stays, setStays] = useState<Stay[]>([]);
  const [guides, setGuides] = useState<LocalGuideProfile[]>([]);
  const [articles, setArticles] = useState<NeighborhoodArticle[]>([]);
  const [localProviders, setLocalProviders] = useState<LocalServiceProvider[]>([]);
  const [serviceRequests, setServiceRequests] = useState<PlusServiceRequest[]>([]);
  const [plusMembership, setPlusMembership] = useState<{
    isActive: boolean;
    status: string;
    startsAt?: number;
    expiresAt: number | null;
    daysRemaining: number;
  } | null>(null);
  const [plusPendingApproval, setPlusPendingApproval] = useState<boolean>(false);
  const [lockedPlus, setLockedPlus] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Black Friday State
  const [bfEvent, setBfEvent] = useState<BlackFridayEvent>(() => getNextBlackFridayEvent());
  const [notifyEmail, setNotifyEmail] = useState<string>(user?.email || '');
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null);
  const [notifySubmitting, setNotifySubmitting] = useState(false);

  // AirBus Work Filters
  const [workStayLength, setWorkStayLength] = useState<number>(1);
  const [workMinWifi, setWorkMinWifi] = useState<number>(0);
  const [workDedicatedDesk, setWorkDedicatedDesk] = useState<boolean>(false);
  const [workCorpInvoice, setWorkCorpInvoice] = useState<boolean>(false);

  // AirBus Plus Membership Modal (Ksh 3,500 / 30 Days - Guest Wallet Only)
  const [showVvvipModal, setShowVvvipModal] = useState(false);
  const [vvvipModalError, setVvvipModalError] = useState<string | null>(null);
  const [vvvipLoading, setVvvipLoading] = useState(false);

  // AirBus Plus Item 4 ("Other services, ask.")
  const [customPlusRequestText, setCustomPlusRequestText] = useState('');
  const [customPlusRequestLoading, setCustomPlusRequestLoading] = useState(false);

  // AirBus Local Registration State ("Register as an AirBus Local" - Free)
  const [localRegFullName, setLocalRegFullName] = useState('');
  const [localRegTown, setLocalRegTown] = useState('');
  const [localRegCategory, setLocalRegCategory] = useState<LocalProviderCategory>('Personal Chef');
  const [localRegDiscipline, setLocalRegDiscipline] = useState('');
  const [localRegCustomService, setLocalRegCustomService] = useState('');
  const [localRegDescription, setLocalRegDescription] = useState('');
  const [localRegContact, setLocalRegContact] = useState('');
  const [localRegPhotoUrl, setLocalRegPhotoUrl] = useState('');
  const [localRegSubmitting, setLocalRegSubmitting] = useState(false);
  const [localRegError, setLocalRegError] = useState<string | null>(null);
  const [localRegSuccess, setLocalRegSuccess] = useState<string | null>(null);

  // AirBus Local Guide Request & Article Reader
  const [selectedGuide, setSelectedGuide] = useState<LocalGuideProfile | null>(null);
  const [guideReqDates, setGuideReqDates] = useState('');
  const [guideReqNotes, setGuideReqNotes] = useState('');
  const [guideReqEmail, setGuideReqEmail] = useState(user?.email || '');
  const [guideReqSubmitting, setGuideReqSubmitting] = useState(false);
  const [activeArticle, setActiveArticle] = useState<NeighborhoodArticle | null>(null);

  // AirBus World Wide Filters
  const [wwRegion, setWwRegion] = useState<string>('all');
  const [wwCountry, setWwCountry] = useState<string>('all');

  // Update live countdown every second on Black Friday
  useEffect(() => {
    if (slug !== 'black-friday') return;
    setBfEvent(getNextBlackFridayEvent());
    const timer = setInterval(() => {
      setBfEvent(getNextBlackFridayEvent());
    }, 1000);
    return () => clearInterval(timer);
  }, [slug]);

  useEffect(() => {
    if (user?.email && !notifyEmail) setNotifyEmail(user.email);
    if (user?.email && !guideReqEmail) setGuideReqEmail(user.email);
  }, [user]);

  const loadCollection = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCollection(slug);
      setStays(res.stays || []);
      setLockedPlus(Boolean(res.locked));
      setPlusPendingApproval(Boolean(res.pendingApproval));
      setPlusMembership(res.membership || null);
      if (res.guides) setGuides(res.guides);
      if (res.articles) setArticles(res.articles);
      if (res.providers) setLocalProviders(res.providers);
      if (res.serviceRequests) setServiceRequests(res.serviceRequests);
      else setServiceRequests([]);
    } catch (err: any) {
      setError(err.message || 'Could not load collection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollection();
  }, [slug, user?.isVVVIP, user?.email]);

  useEffect(() => {
    const onRealtime = (e: Event) => {
      const evt = (e as CustomEvent).detail;
      if (evt?.type === 'stay') {
        loadCollection();
      }
    };
    window.addEventListener('airbus:realtime-feed', onRealtime);
    return () => window.removeEventListener('airbus:realtime-feed', onRealtime);
  }, [slug, user?.isVVVIP, user?.email]);

  // Collection Header Copy
  const meta = {
    'black-friday': {
      title: 'AirBus Black Friday',
      subtitle: 'Quarterly Half-Price Stays (Up to 50% Off)',
      intro:
        'Hosts announce dramatic quarterly reductions of up to 50% off normal nightly rates on the last Friday of March, June, September, and December.',
      accent: 'from-rose-600 via-red-600 to-amber-500',
      icon: Flame,
    },
    work: {
      title: 'AirBus Work',
      subtitle: 'Monthly Stays, Corporate Housing & High-Speed Studios',
      intro:
        'Designed for remote engineers, consultants, and corporate teams. Filter by stay length (1+ month), verified Wi-Fi speed, dedicated workspace, and corporate invoicing.',
      accent: 'from-blue-600 via-indigo-600 to-cyan-500',
      icon: Briefcase,
    },
    escapes: {
      title: 'AirBus Escapes',
      subtitle: 'Special Promotional Prices & Weekend Getaway Offers',
      intro:
        'Curated weekend and vacation rental promotions announced directly by hosts with limited-time validity dates and verified savings.',
      accent: 'from-amber-500 via-orange-500 to-rose-500',
      icon: Compass,
    },
    plus: {
      title: 'AirBus Plus',
      subtitle: 'VIP to VVVIP Exclusive Stays & Concierge Services',
      intro:
        'Ksh 3,500 monthly membership used to source top-notch exclusive extra services attached to VIP-to-VVVIP listings. Access, membership records, and service requests remain private to you and the administrator.',
      accent: 'from-amber-400 via-yellow-500 to-amber-600',
      icon: Crown,
    },
    local: {
      title: 'AirBus Local',
      subtitle: 'Neighborhood Guides, Markets & Authentic Budget Stays',
      intro:
        'Partner with vetted local neighborhood guides who help you navigate open-air markets, local transport, and uncover ultra-affordable stays.',
      accent: 'from-emerald-600 via-teal-600 to-cyan-600',
      icon: MapPin,
    },
    worldwide: {
      title: 'AirBus World Wide',
      subtitle: 'Global Host Announcements & International Holiday Homes',
      intro:
        'Discover verified homes hosted across Africa, the Middle East, Asia, and Europe with instant local-to-home currency comparison.',
      accent: 'from-purple-600 via-pink-600 to-indigo-600',
      icon: Globe,
    },
  }[slug];

  const HeaderIcon = meta.icon;

  // Filtered AirBus Work Stays
  const filteredWorkStays = useMemo(() => {
    if (slug !== 'work') return stays;
    return stays.filter(s => {
      if (workMinWifi > 0 && (s.wifiSpeedMbps || 50) < workMinWifi) return false;
      if (workDedicatedDesk && !s.hasDedicatedWorkspace && !s.features.some(f => f.toLowerCase().includes('workspace'))) {
        return false;
      }
      if (workCorpInvoice && !s.corporateInvoicingAvailable) return false;
      return true;
    });
  }, [stays, slug, workMinWifi, workDedicatedDesk, workCorpInvoice]);

  // Filtered AirBus World Wide Stays
  const wwRegions = useMemo(() => {
    const set = new Set<string>();
    stays.forEach(s => s.region && set.add(s.region));
    return Array.from(set);
  }, [stays]);

  const wwCountries = useMemo(() => {
    const set = new Set<string>();
    stays.forEach(s => {
      if (wwRegion === 'all' || s.region === wwRegion) {
        if (s.country) set.add(s.country);
      }
    });
    return Array.from(set);
  }, [stays, wwRegion]);

  const filteredWorldwideStays = useMemo(() => {
    if (slug !== 'worldwide') return stays;
    return stays.filter(s => {
      if (wwRegion !== 'all' && s.region !== wwRegion) return false;
      if (wwCountry !== 'all' && s.country !== wwCountry) return false;
      return true;
    });
  }, [stays, slug, wwRegion, wwCountry]);

  const handleBlackFridayNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyEmail.trim()) return;
    setNotifySubmitting(true);
    try {
      const res = await api.subscribeBlackFriday(notifyEmail.trim());
      setNotifySuccess(res.message);
      showToast?.(res.message);
    } catch (err: any) {
      showToast?.(err.message || 'Could not subscribe right now.');
    } finally {
      setNotifySubmitting(false);
    }
  };

  const handleUpgradeVVVIP = async (e: React.FormEvent) => {
    e.preventDefault();
    setVvvipModalError(null);
    if (!user) {
      onOpenAuth();
      return;
    }
    if (user.role !== 'guest') {
      setVvvipModalError('AirBus Plus is for Guests only and never uses a Host wallet.');
      return;
    }
    if (userWalletBalance < 3500) {
      setVvvipModalError(
        `Insufficient Guest wallet balance (KES ${userWalletBalance.toLocaleString()}). Ksh 3,500 is required. Use Deposit (M-Pesa) to fund your wallet first.`
      );
      return;
    }
    setVvvipLoading(true);
    try {
      const res = await api.upgradeToVVVIP({
        billing: 'monthly',
        method: 'wallet',
      });
      onUserUpgraded?.(res.user);
      setShowVvvipModal(false);
      setVvvipModalError(null);
      showToast?.(res.message);
      await loadCollection();
    } catch (err: any) {
      setVvvipModalError(err.message || 'Payment from Guest wallet failed.');
    } finally {
      setVvvipLoading(false);
    }
  };

  const handleSubmitPlusServiceRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPlusRequestText.trim()) return;
    setCustomPlusRequestLoading(true);
    try {
      const res = await api.createPlusServiceRequest(customPlusRequestText.trim());
      setCustomPlusRequestText('');
      setServiceRequests(prev => [res.request, ...prev]);
      showToast?.(res.message);
    } catch (err: any) {
      showToast?.(err.message || 'Could not submit service request.');
    } finally {
      setCustomPlusRequestLoading(false);
    }
  };

  const handleLocalPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setLocalRegError('Profile photo must be under 4MB.');
      return;
    }
    try {
      const uploaded = await api.uploadMediaWithProgress(file, 'photo', file.name);
      setLocalRegPhotoUrl(uploaded.url);
      setLocalRegError(null);
    } catch (err: any) {
      setLocalRegError(err?.message || 'Failed to upload profile photo. Please retry.');
    }
  };

  const handleRegisterLocalProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalRegError(null);
    setLocalRegSuccess(null);

    if (!localRegFullName.trim() || !localRegTown.trim() || !localRegDescription.trim() || !localRegContact.trim() || !localRegPhotoUrl.trim()) {
      setLocalRegError('All fields including Full personal name, Location (town), Short description, Contact, and Profile photo are required.');
      return;
    }
    if (localRegCategory === 'Trainer' && !localRegDiscipline.trim()) {
      setLocalRegError('Trainers must indicate what they train.');
      return;
    }
    if (localRegCategory === 'Others' && !localRegCustomService.trim()) {
      setLocalRegError('Please state the services you offer under Others.');
      return;
    }
    const lowerCombined = `${localRegCustomService} ${localRegDescription}`.toLowerCase();
    if (localRegCategory === 'Others' && /\b(companionship|dating|escort|date|romantic)\b/i.test(lowerCombined)) {
      setLocalRegError('Companionship and dating are not allowed under Others. Please choose Companionship -> Trip Dating.');
      return;
    }

    setLocalRegSubmitting(true);
    try {
      const res = await api.registerLocalProvider({
        fullName: localRegFullName.trim(),
        locationTown: localRegTown.trim(),
        category: localRegCategory,
        trainerDiscipline: localRegCategory === 'Trainer' ? localRegDiscipline.trim() : undefined,
        customServiceDescription: localRegCategory === 'Others' ? localRegCustomService.trim() : undefined,
        description: localRegDescription.trim(),
        contact: localRegContact.trim(),
        photoUrl: localRegPhotoUrl,
      });
      setLocalProviders(prev => [res.provider, ...prev]);
      setLocalRegFullName('');
      setLocalRegTown('');
      setLocalRegDiscipline('');
      setLocalRegCustomService('');
      setLocalRegDescription('');
      setLocalRegContact('');
      setLocalRegPhotoUrl('');
      setLocalRegSuccess(res.message);
      showToast?.(res.message);
    } catch (err: any) {
      setLocalRegError(err.message || 'Could not post AirBus Local profile.');
    } finally {
      setLocalRegSubmitting(false);
    }
  };

  const handleSubmitGuideRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuide) return;
    setGuideReqSubmitting(true);
    try {
      const res = await api.requestLocalGuide({
        guideId: selectedGuide.id,
        area: selectedGuide.areaCovered,
        dates: guideReqDates,
        notes: guideReqNotes,
        guestEmail: guideReqEmail,
        guestName: user?.name || 'AirBus Guest',
      });
      showToast?.(res.message);
      setSelectedGuide(null);
      setGuideReqDates('');
      setGuideReqNotes('');
    } catch (err: any) {
      showToast?.(err.message || 'Could not send request.');
    } finally {
      setGuideReqSubmitting(false);
    }
  };

  // Switch between collections cleanly at top
  const collectionNav: { id: CollectionSlug; label: string }[] = [
    { id: 'black-friday', label: 'Black Friday' },
    { id: 'work', label: 'Work' },
    { id: 'escapes', label: 'Escapes' },
    { id: 'plus', label: 'AirBus Plus' },
    { id: 'local', label: 'Local' },
    { id: 'worldwide', label: 'World Wide' },
  ];

  const isPlusDark = slug === 'plus';

  return (
    <div
      className={`min-h-screen transition-colors pb-16 ${
        isPlusDark
          ? 'bg-neutral-950 text-amber-50'
          : 'bg-[#fbfbf8] dark:bg-[#0f1117] text-stone-900 dark:text-stone-100'
      }`}
    >
      {/* Top Collection Navigation Bar */}
      <div
        className={`border-b ${
          isPlusDark
            ? 'bg-neutral-900/90 border-amber-500/20'
            : 'bg-white/90 dark:bg-[#15171e]/90 border-stone-200 dark:border-stone-800'
        } backdrop-blur-md sticky top-14 sm:top-16 z-30`}
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={onBackToFeed}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition ${
              isPlusDark
                ? 'bg-neutral-800 hover:bg-neutral-700 text-amber-300'
                : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {collectionNav.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigateCollection(item.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  slug === item.id
                    ? item.id === 'plus'
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-600 text-black shadow-md'
                      : 'bg-[#0a0a0a] dark:bg-white text-white dark:text-black shadow-sm'
                    : isPlusDark
                    ? 'text-stone-400 hover:text-amber-300 hover:bg-neutral-800'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hero Header Banner */}
      <div
        className={`relative overflow-hidden border-b ${
          isPlusDark
            ? 'bg-gradient-to-b from-amber-950/30 via-neutral-950 to-neutral-950 border-amber-500/20'
            : 'bg-white dark:bg-[#15171e] border-stone-200 dark:border-stone-800'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider">
              <span
                className={`p-2 rounded-xl bg-gradient-to-tr ${meta.accent} text-white shadow-md`}
              >
                <HeaderIcon className="w-4 h-4" />
              </span>
              <span className={isPlusDark ? 'text-amber-400' : 'text-[#e4002b]'}>
                AirBus Collections · {meta.subtitle}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
              {meta.title}
            </h1>

            <p
              className={`text-sm sm:text-base leading-relaxed ${
                isPlusDark ? 'text-amber-100/80' : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              {meta.intro}
            </p>
          </div>

          {/* ========================================================== */}
          {/* 1. BLACK FRIDAY COUNTDOWN & NOTIFY ME BAR                  */}
          {/* ========================================================== */}
          {slug === 'black-friday' && (
            <div className="mt-6 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-stone-950 via-rose-950 to-stone-950 text-white border border-rose-500/30 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-rose-400">
                  <Flame className="w-4 h-4 fill-rose-500 text-rose-500" />
                  {bfEvent.isActive ? (
                    <span>Q{bfEvent.quarter} Black Friday Sale is LIVE NOW!</span>
                  ) : (
                    <span>Next Event: Q{bfEvent.quarter} Last Friday of {bfEvent.monthName}</span>
                  )}
                </div>

                <div className="text-lg sm:text-xl font-extrabold">
                  {bfEvent.formattedDate}
                </div>

                {!bfEvent.isActive ? (
                  <div className="flex items-center gap-2 sm:gap-3 pt-2">
                    {[
                      { val: bfEvent.daysRemaining, label: 'Days' },
                      { val: bfEvent.hoursRemaining, label: 'Hours' },
                      { val: bfEvent.minutesRemaining, label: 'Mins' },
                      { val: bfEvent.secondsRemaining, label: 'Secs' },
                    ].map(unit => (
                      <div
                        key={unit.label}
                        className="bg-black/50 border border-white/15 rounded-2xl px-3.5 py-2 text-center min-w-[64px]"
                      >
                        <div className="text-xl sm:text-2xl font-black font-mono text-white">
                          {String(unit.val).padStart(2, '0')}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-rose-300 font-bold">
                          {unit.label}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-300 font-bold">
                    Up to 50% off deals are unlocked below for 72 hours!
                  </p>
                )}
              </div>

              <div className="lg:col-span-5">
                <form
                  onSubmit={handleBlackFridayNotify}
                  className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 space-y-2.5"
                >
                  <div className="text-xs font-bold flex items-center gap-1.5 text-amber-300">
                    <Bell className="w-4 h-4" />
                    <span>Get Early Access Alert (Notify Me)</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      required
                      value={notifyEmail}
                      onChange={e => setNotifyEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-xs text-white placeholder-stone-400 outline-none focus:border-rose-400"
                    />
                    <button
                      type="submit"
                      disabled={notifySubmitting}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition shrink-0 disabled:opacity-50"
                    >
                      {notifySubmitting ? 'Saving...' : 'Notify me'}
                    </button>
                  </div>
                  {notifySuccess && (
                    <div className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{notifySuccess}</span>
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* 2. AIRBUS WORK FILTERS                                     */}
          {/* ========================================================== */}
          {slug === 'work' && (
            <div className="mt-6 p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
              <div>
                <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                  Stay Length
                </label>
                <select
                  value={workStayLength}
                  onChange={e => setWorkStayLength(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold outline-none"
                >
                  <option value={1}>1 Month+</option>
                  <option value={3}>3 Months+ (10% Long Stay)</option>
                  <option value={6}>6 Months+ (Corporate Rate)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                  Minimum Wi-Fi Speed
                </label>
                <select
                  value={workMinWifi}
                  onChange={e => setWorkMinWifi(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold outline-none"
                >
                  <option value={0}>Any High-Speed Fiber</option>
                  <option value={100}>100+ Mbps Verified</option>
                  <option value={200}>200+ Mbps Enterprise</option>
                </select>
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 cursor-pointer text-xs font-bold">
                <input
                  type="checkbox"
                  checked={workDedicatedDesk}
                  onChange={e => setWorkDedicatedDesk(e.target.checked)}
                  className="accent-indigo-600"
                />
                <Monitor className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Dedicated Workspace</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 cursor-pointer text-xs font-bold">
                <input
                  type="checkbox"
                  checked={workCorpInvoice}
                  onChange={e => setWorkCorpInvoice(e.target.checked)}
                  className="accent-indigo-600"
                />
                <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Corporate Invoicing</span>
              </label>
            </div>
          )}

          {/* ========================================================== */}
          {/* 6. AIRBUS WORLD WIDE FILTERS & CURRENCY                    */}
          {/* ========================================================== */}
          {slug === 'worldwide' && (
            <div className="mt-6 p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[160px]">
                <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                  Region
                </label>
                <select
                  value={wwRegion}
                  onChange={e => {
                    setWwRegion(e.target.value);
                    setWwCountry('all');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold outline-none"
                >
                  <option value="all">All World Regions</option>
                  {wwRegions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[160px]">
                <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                  Country
                </label>
                <select
                  value={wwCountry}
                  onChange={e => setWwCountry(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold outline-none"
                >
                  <option value="all">All Countries</option>
                  {wwCountries.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="min-w-[160px]">
                <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                  Convert Display Currency
                </label>
                <select
                  value={currency}
                  onChange={e => onCurrencyChange(e.target.value as Currency)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold outline-none"
                >
                  <option value="KES">KES (Kenyan Shilling)</option>
                  <option value="USD">USD (US Dollar $)</option>
                  <option value="EUR">EUR (Euro €)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="max-w-7xl mx-auto px-4 pt-8 space-y-12">
        {loading ? (
          <div className="py-20 text-center text-sm font-semibold opacity-70">
            Loading {meta.title}...
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-sm font-bold text-center">
            {error}
          </div>
        ) : slug === 'plus' && lockedPlus ? (
          /* ========================================================== */
          /* 4. AIRBUS PLUS (LOCKED NON-MEMBER GATE - STRICT PRIVACY)   */
          /* ========================================================== */
          <div className="max-w-4xl mx-auto my-6 p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-neutral-900 via-neutral-900 to-black border border-amber-500/40 shadow-2xl text-center space-y-6 relative overflow-hidden">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-600 text-black flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                Members-Only Luxury Portfolio · Ksh 3,500 / 30 Days
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                AirBus Plus is Reserved VIP to VVVIP Guests.
              </h2>
              <p className="text-sm text-stone-300 max-w-2xl mx-auto leading-relaxed">
                Pay the monthly membership fee of <strong className="text-amber-300">Ksh 3,500</strong> (30 days from payment) from your <strong className="text-white">Guest Wallet</strong> to unlock AirBus Plus. The fee is used to source top-notch exclusive extra services attached to VIP-to-VVVIP listings. Need funds? Use <strong className="text-emerald-300">Deposit (M-Pesa)</strong> to top up your Guest Wallet first.
              </p>
            </div>

            {plusPendingApproval && (
              <div className="max-w-xl mx-auto p-3.5 rounded-2xl bg-blue-500/15 border border-blue-400/40 text-xs text-blue-200 font-semibold">
                Your Ksh 3,500 AirBus Plus M-Pesa payment is currently awaiting Admin approval into your wallet. Access will unlock automatically for 30 days once approved.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
              {AIRBUS_PLUS_SERVICES.map(perk => (
                <div
                  key={perk.title}
                  className="p-4 rounded-2xl bg-black/60 border border-amber-500/20 space-y-1"
                >
                  <Crown className="w-4 h-4 text-amber-400" />
                  <div className="text-xs font-bold text-amber-100">{perk.title}</div>
                  <div className="text-[11px] text-stone-400">{perk.desc}</div>
                </div>
              ))}
            </div>

            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    onOpenAuth();
                  } else {
                    setVvvipModalError(null);
                    setShowVvvipModal(true);
                  }
                }}
                className="px-7 py-3 rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:brightness-110 text-black font-black text-sm shadow-xl shadow-amber-500/20 cursor-pointer transition active:scale-95 flex items-center gap-2"
              >
                <Crown className="w-4 h-4" />
                <span>
                  {!user
                    ? 'Sign In to Join AirBus Plus'
                    : plusPendingApproval
                    ? 'Pending Approval · View Payment'
                    : 'Join / Renew AirBus Plus (Ksh 3,500)'}
                </span>
              </button>
              <button
                type="button"
                onClick={onBackToFeed}
                className="px-6 py-3 rounded-full border border-stone-700 text-stone-300 hover:text-white text-xs font-bold cursor-pointer"
              >
                Return to Public Stays
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================== */
          /* STAYS FEED + PLUS PRIVATE MEMBER CONSOLE + LOCAL REGISTER  */
          /* ========================================================== */
          <>
            {/* Private AirBus Plus Member Dashboard & Services */}
            {slug === 'plus' && (
              <div className="space-y-6">
                {/* Private Membership Status & Renewal Bar */}
                <div className="p-6 rounded-3xl bg-neutral-900 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Crown className="w-5 h-5 text-amber-400" />
                      <h2 className="text-lg font-black text-white">AirBus Plus Private Membership</h2>
                      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Active · Private to You &amp; Admin
                      </span>
                      {plusPendingApproval && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Renewal Pending Approval
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-300">
                      {plusMembership?.expiresAt
                        ? `Expires: ${new Date(plusMembership.expiresAt).toLocaleDateString()} · ${plusMembership.daysRemaining} days remaining. Renewing from your Guest Wallet adds 30 days (Ksh 3,500).`
                        : 'Monthly membership is Ksh 3,500 per 30 days paid from your Guest Wallet.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setVvvipModalError(null);
                      setShowVvvipModal(true);
                    }}
                    className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 text-black font-black text-xs shadow-lg cursor-pointer shrink-0"
                  >
                    Renew (+30 Days · Ksh 3,500)
                  </button>
                </div>

                {/* 4 Exact AirBus Plus Services + Item 4 Request Form */}
                <div className="p-6 rounded-3xl bg-neutral-900/80 border border-amber-500/25 space-y-5">
                  <div>
                    <h3 className="text-base font-black text-amber-300">AirBus Plus Services</h3>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Top-notch exclusive extra services attached to VIP-to-VVVIP listings.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {AIRBUS_PLUS_SERVICES.map(srv => (
                      <div
                        key={srv.title}
                        className="p-4 rounded-2xl bg-black/60 border border-amber-500/20 space-y-1.5"
                      >
                        <div className="text-xs font-extrabold text-amber-200">{srv.title}</div>
                        <p className="text-[11px] text-stone-400 leading-relaxed">{srv.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Interactive "Other services, ask." request box for unlocked member */}
                  <div className="pt-4 border-t border-amber-500/20 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                      4. Other services, ask. — Submit a Private Request
                    </h4>
                    <form onSubmit={handleSubmitPlusServiceRequest} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        required
                        value={customPlusRequestText}
                        onChange={e => setCustomPlusRequestText(e.target.value)}
                        placeholder="Describe any other extra service you need (admin will link you with reliable providers)..."
                        className="flex-1 px-4 py-2.5 rounded-xl bg-black/60 border border-stone-700 text-xs text-white outline-none focus:border-amber-400"
                      />
                      <button
                        type="submit"
                        disabled={customPlusRequestLoading}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {customPlusRequestLoading ? 'Submitting...' : 'Submit Request'}
                      </button>
                    </form>

                    {serviceRequests.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <div className="text-[11px] font-bold text-stone-400">Your Private Service Requests</div>
                        {serviceRequests.map(reqItem => (
                          <div
                            key={reqItem.id}
                            className="p-3 rounded-xl bg-black/50 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="text-white font-semibold">{reqItem.requestText}</div>
                              {reqItem.assignedProviderName && (
                                <div className="text-[11px] text-emerald-300 font-semibold">
                                  Linked Provider: {reqItem.assignedProviderName} ({reqItem.assignedProviderContact})
                                  {reqItem.adminNote ? ` · ${reqItem.adminNote}` : ''}
                                </div>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 self-start sm:self-center ${
                                reqItem.status === 'linked'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {reqItem.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Black Friday Info Strip */}
            {slug === 'black-friday' && (
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-200 dark:border-stone-800">
                <div>
                  <h2 className="text-lg font-extrabold">
                    {bfEvent.isActive
                      ? `Live Black Friday Deals (${stays.length} Stays Up to 50% Off)`
                      : `Upcoming Host Opt-In Deals (${stays.length} Pre-Registered Stays)`}
                  </h2>
                  <p className="text-xs text-stone-500">
                    {bfEvent.isActive
                      ? 'Book instantly at quarterly half-price rates before Sunday 23:59!'
                      : 'Hosts can opt-in ahead of time from their Owner Hub. Savings go live automatically on Black Friday.'}
                  </p>
                </div>
              </div>
            )}

            {/* AirBus Local: Free Service Provider Registration + Directory + Guides */}
            {slug === 'local' && (
              <div className="space-y-10">
                {/* "Register as an AirBus Local" Free Form */}
                <section className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#15171e] border border-emerald-200 dark:border-emerald-900/50 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider mb-1">
                        Free Service Registration
                      </span>
                      <h2 className="text-lg sm:text-xl font-black text-stone-900 dark:text-white">
                        Register as an AirBus Local
                      </h2>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Offer your local services for free to travellers and residents in your town.
                      </p>
                    </div>
                  </div>

                  {/* Mandatory Policy Warning */}
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>No drugs or illegal activities. Any such provider profile will be pulled down.</span>
                  </div>

                  <form onSubmit={handleRegisterLocalProvider} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-bold block mb-1">Service Category *</label>
                        <select
                          value={localRegCategory}
                          onChange={e => setLocalRegCategory(e.target.value as LocalProviderCategory)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold outline-none"
                        >
                          {LOCAL_PROVIDER_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold block mb-1">Full Personal Name *</label>
                        <input
                          type="text"
                          required
                          value={localRegFullName}
                          onChange={e => setLocalRegFullName(e.target.value)}
                          placeholder="e.g. Jane Wanjiku"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold block mb-1">Location (Town) *</label>
                        <input
                          type="text"
                          required
                          value={localRegTown}
                          onChange={e => setLocalRegTown(e.target.value)}
                          placeholder="e.g. Diani, Kilimani, Mombasa"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs outline-none"
                        />
                      </div>
                    </div>

                    {/* Conditional Category Controls */}
                    {localRegCategory === 'Trainer' && (
                      <div>
                        <label className="text-xs font-bold block mb-1 text-emerald-700 dark:text-emerald-400">
                          What do you train? *
                        </label>
                        <input
                          type="text"
                          required
                          value={localRegDiscipline}
                          onChange={e => setLocalRegDiscipline(e.target.value)}
                          placeholder="e.g. Personal Fitness, Swimming, Boxing, Yoga, Dog Training"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-emerald-300 dark:border-emerald-800 text-xs outline-none"
                        />
                      </div>
                    )}

                    {localRegCategory === 'Companionship' && (
                      <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-xs font-extrabold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                            <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                            <span>Companionship &amp; Dating Connects Directly to Trip Dating</span>
                          </div>
                          <p className="text-[11px] text-stone-600 dark:text-stone-300">
                            Looking for dating or companionship profiles? Visit Trip Dating directly, or post your companionship profile below.
                          </p>
                        </div>
                        {onNavigateTripDating && (
                          <button
                            type="button"
                            onClick={onNavigateTripDating}
                            className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold cursor-pointer shrink-0"
                          >
                            Trip Dating
                          </button>
                        )}
                      </div>
                    )}

                    {localRegCategory === 'Others' && (
                      <div>
                        <label className="text-xs font-bold block mb-1 text-amber-700 dark:text-amber-400">
                          State the services you offer (companionship and dating are not allowed under Others) *
                        </label>
                        <input
                          type="text"
                          required
                          value={localRegCustomService}
                          onChange={e => setLocalRegCustomService(e.target.value)}
                          placeholder="e.g. Private Photography, Babysitting, Laundry & Dry Cleaning"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-amber-300 dark:border-amber-800 text-xs outline-none"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold block mb-1">Contact (Phone or Email) *</label>
                        <input
                          type="text"
                          required
                          value={localRegContact}
                          onChange={e => setLocalRegContact(e.target.value)}
                          placeholder="e.g. +254 712 345 678"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold block mb-1">Profile Photo Upload *</label>
                        <div className="flex items-center gap-3">
                          <label className="flex-1 px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold cursor-pointer flex items-center gap-2 hover:border-emerald-500">
                            <Upload className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{localRegPhotoUrl ? 'Photo Selected (Change)' : 'Upload Profile Photo'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLocalPhotoUpload}
                              className="hidden"
                            />
                          </label>
                          {localRegPhotoUrl && (
                            <img
                              src={localRegPhotoUrl}
                              alt="Preview"
                              className="w-10 h-10 rounded-xl object-cover border border-stone-300 dark:border-stone-700 shrink-0"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold block mb-1">Short Description of What You Do *</label>
                      <textarea
                        rows={3}
                        required
                        value={localRegDescription}
                        onChange={e => setLocalRegDescription(e.target.value)}
                        placeholder="Describe your experience, availability, and how you serve guests..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs outline-none"
                      />
                    </div>

                    {localRegError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200">
                        {localRegError}
                      </div>
                    )}

                    {localRegSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-200">
                        {localRegSuccess}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={localRegSubmitting}
                        className="px-7 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow cursor-pointer disabled:opacity-50"
                      >
                        {localRegSubmitting ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </form>
                </section>

                {/* Registered AirBus Local Providers Directory */}
                {localProviders.length > 0 && (
                  <section className="space-y-4">
                    <div>
                      <h2 className="text-lg sm:text-xl font-black">
                        AirBus Local Service Providers ({localProviders.length})
                      </h2>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Independent local professionals ready to help in your destination town.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {localProviders.map(prov => (
                        <div
                          key={prov.id}
                          className="p-5 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={prov.photoUrl}
                                alt={prov.fullName}
                                className="w-14 h-14 rounded-2xl object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                              />
                              <div className="min-w-0">
                                <h3 className="text-sm font-black text-stone-900 dark:text-white truncate">
                                  {prov.fullName}
                                </h3>
                                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  {prov.category}
                                  {prov.trainerDiscipline ? ` · ${prov.trainerDiscipline}` : ''}
                                </div>
                                <div className="text-[11px] text-stone-500 truncate">
                                  📍 {prov.locationTown}
                                </div>
                              </div>
                            </div>

                            {prov.customServiceDescription && (
                              <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                Services: {prov.customServiceDescription}
                              </div>
                            )}

                            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                              {prov.description}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2 text-xs">
                            <span className="font-mono font-bold text-stone-800 dark:text-stone-200 truncate">
                              {prov.contact}
                            </span>
                            {prov.category === 'Companionship' && onNavigateTripDating && (
                              <button
                                type="button"
                                onClick={onNavigateTripDating}
                                className="px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer shrink-0"
                              >
                                Trip Dating
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Guide Directory */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg sm:text-xl font-black">
                        Vetted Neighborhood Guides
                      </h2>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Connect with locals who help you navigate street markets and find ultra-affordable stays.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {guides.map(guide => (
                      <div
                        key={guide.id}
                        className="p-5 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={guide.avatar}
                              alt={guide.name}
                              className="w-14 h-14 rounded-2xl object-cover border border-stone-200 dark:border-stone-700"
                            />
                            <div>
                              <h3 className="text-sm font-black text-stone-900 dark:text-white flex items-center gap-1.5">
                                <span>{guide.name}</span>
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                              </h3>
                              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                ★ {guide.rating} ({guide.reviewsCount} tours)
                              </div>
                              <div className="text-[11px] text-stone-500">
                                KES {guide.hourlyRateKes}/hr · {guide.languages.join(', ')}
                              </div>
                            </div>
                          </div>

                          <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
                            Area Covered: <span className="font-normal text-stone-600 dark:text-stone-400">{guide.areaCovered}</span>
                          </div>

                          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                            {guide.bio}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                          <button
                            type="button"
                            onClick={() => setSelectedGuide(guide)}
                            className="flex-1 py-2 px-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Request a guide</span>
                          </button>
                          <a
                            href={`tel:${guide.phone.replace(/\s+/g, '')}`}
                            className="p-2 rounded-full border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                            title={`Call ${guide.name}`}
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Neighborhood Guide Articles & Host Recommendations */}
                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-emerald-600" />
                      <span>Neighborhood Guides &amp; Host Recommendations</span>
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Insider market playbooks for scoring the best budget rooms and local eats.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {articles.map(article => (
                      <div
                        key={article.id}
                        className="rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm flex flex-col justify-between"
                      >
                        <div className="h-44 overflow-hidden relative">
                          <img
                            src={article.heroImage}
                            alt={article.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              {article.area} · {article.readTime}
                            </div>
                            <h3 className="text-base font-black text-stone-900 dark:text-white leading-snug">
                              {article.title}
                            </h3>
                            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                              {article.excerpt}
                            </p>
                            <div className="pt-2 space-y-1.5">
                              {article.hostRecommendations.map(rec => (
                                <div
                                  key={rec.spot}
                                  className="text-xs p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-800"
                                >
                                  <span className="font-bold text-stone-900 dark:text-white">{rec.spot}</span>
                                  <span className="text-stone-400"> · {rec.category}: </span>
                                  <span className="text-stone-600 dark:text-stone-300">{rec.tip}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setActiveArticle(article)}
                            className="mt-3 text-xs font-bold text-emerald-600 hover:underline text-left cursor-pointer"
                          >
                            Read Full Neighborhood Guide →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* Stays Feed Grid */}
            <section className="space-y-4">
              {slug === 'local' && (
                <div>
                  <h2 className="text-lg sm:text-xl font-black">
                    Affordable Market-Adjacent Stays
                  </h2>
                  <p className="text-xs text-stone-500">
                    Hand-picked value apartments &amp; studios close to open-air markets and commuter stages.
                  </p>
                </div>
              )}

              {(() => {
                const list =
                  slug === 'work'
                    ? filteredWorkStays
                    : slug === 'worldwide'
                    ? filteredWorldwideStays
                    : stays;

                if (list.length === 0) {
                  return (
                    <div className="p-10 rounded-3xl border border-dashed border-stone-300 dark:border-stone-800 text-center space-y-2">
                      <p className="text-sm font-bold">No listings match these filters right now.</p>
                      <p className="text-xs text-stone-500">
                        Try relaxing your filter criteria or explore other AirBus collections.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {list.map(stay => (
                      <div key={stay.id} className="space-y-2">
                        <StayCard
                          stay={stay}
                          isSaved={savedStayIds.includes(stay.id)}
                          onToggleSave={onToggleSave}
                          onSelectStay={onSelectStay}
                          onCheckAvailability={onCheckAvailability}
                          onBookNow={onBookNow}
                          onChatHost={onChatHost}
                          onNegotiate={onNegotiate}
                          onHover={() => {}}
                          currency={currency}
                          workView={slug === 'work'}
                          blackFridayActive={slug === 'black-friday' && bfEvent.isActive}
                        />
                        {/* Collection-specific summary strip below card */}
                        {slug === 'work' && stay.monthlyPrice && (
                          <div className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-xs">
                            <span className="font-bold text-indigo-800 dark:text-indigo-200">
                              Monthly ({workStayLength}mo+): {currency} {Math.round(stay.monthlyPrice * (CURRENCY_RATES[currency] || 1) * (workStayLength >= 3 ? 0.9 : 1)).toLocaleString()}/mo
                            </span>
                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                              {stay.wifiSpeedMbps || 100} Mbps · {stay.corporateInvoicingAvailable ? 'VAT Invoice' : 'Receipt'}
                            </span>
                          </div>
                        )}
                        {slug === 'escapes' && stay.isEscapeOffer && (
                          <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
                            <span className="font-bold text-amber-800 dark:text-amber-300">
                              {stay.escapeOfferTitle || 'Escape Offer'} (-{stay.escapeDiscountPercent || 25}%)
                            </span>
                            <span className="text-[11px] text-amber-700 dark:text-amber-400">
                              {stay.escapeValidFrom} → {stay.escapeValidTo}
                            </span>
                          </div>
                        )}
                        {slug === 'worldwide' && stay.isWorldWide && (
                          <div className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs">
                            <span className="font-bold">
                              {getFlagEmoji(stay.countryCode)} {stay.country} ({stay.region})
                            </span>
                            {stay.localCurrency && stay.localCurrencyPrice && (
                              <span className="font-mono font-bold text-stone-600 dark:text-stone-300">
                                {stay.localCurrency} {stay.localCurrencyPrice.toLocaleString()}/nt
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>
          </>
        )}
      </div>

      {/* AirBus Plus Membership Payment / Renewal Modal (Ksh 3,500 / 30 Days - Guest Wallet Only) */}
      {showVvvipModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-amber-500/40 rounded-3xl p-6 space-y-4 text-white shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowVvvipModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-neutral-800 text-stone-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-amber-400 font-black text-base">
              <Crown className="w-5 h-5" />
              <span>Join or Renew AirBus Plus</span>
            </div>

            <div className="p-3.5 rounded-2xl border border-amber-400 bg-amber-500/15 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-amber-300">Monthly Membership (30 Days)</span>
                <span className="text-base font-black font-mono text-white">Ksh 3,500</span>
              </div>
              <p className="text-[11px] text-stone-300 leading-relaxed">
                Paid strictly from your Guest Wallet. Lasts 30 days from payment and unlocks AirBus Plus immediately. Renewing adds another 30 days.
              </p>
            </div>

            {user?.role !== 'guest' ? (
              <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-xs text-rose-200 leading-relaxed">
                AirBus Plus is for Guests only and never uses a Host wallet. Sign in with a Guest account to subscribe.
              </div>
            ) : (
              <form onSubmit={handleUpgradeVVVIP} className="space-y-3">
                <div className="p-3.5 rounded-xl bg-black/50 border border-stone-800 text-xs text-stone-300 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold text-stone-300">
                      <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                      Guest Wallet Balance
                    </span>
                    <strong className="font-mono text-white">KES {userWalletBalance.toLocaleString()}</strong>
                  </div>
                  <div className={userWalletBalance < 3500 ? 'text-rose-300 font-semibold' : 'text-emerald-300 font-semibold'}>
                    {userWalletBalance < 3500
                      ? `Insufficient balance. Shortfall: KES ${(3500 - userWalletBalance).toLocaleString()}. Deposit via M-Pesa first.`
                      : 'Sufficient Guest wallet balance for instant 30-day activation / renewal.'}
                  </div>
                </div>

                {vvvipModalError && (
                  <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-xs text-rose-200">
                    {vvvipModalError}
                  </div>
                )}

                {userWalletBalance < 3500 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowVvvipModal(false);
                      onOpenWalletDeposit?.();
                    }}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer transition-colors"
                  >
                    Deposit (M-Pesa)
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={vvvipLoading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-xs cursor-pointer hover:brightness-110 disabled:opacity-50"
                  >
                    {vvvipLoading ? 'Activating from Wallet...' : 'Pay Ksh 3,500 from Wallet'}
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Request Local Guide Modal */}
      {selectedGuide && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 rounded-3xl p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedGuide(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <img
                src={selectedGuide.avatar}
                alt={selectedGuide.name}
                className="w-12 h-12 rounded-2xl object-cover"
              />
              <div>
                <h3 className="text-sm font-black">Request Guide: {selectedGuide.name}</h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {selectedGuide.areaCovered} · KES {selectedGuide.hourlyRateKes}/hr
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitGuideRequest} className="space-y-3">
              <div>
                <label className="text-xs font-bold block mb-1">Your Contact Email *</label>
                <input
                  type="email"
                  required
                  value={guideReqEmail}
                  onChange={e => setGuideReqEmail(e.target.value)}
                  placeholder="guest@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Preferred Dates *</label>
                <input
                  type="text"
                  required
                  value={guideReqDates}
                  onChange={e => setGuideReqDates(e.target.value)}
                  placeholder="e.g. Nov 18 - Nov 20, Morning"
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">What do you need help finding?</label>
                <textarea
                  rows={3}
                  value={guideReqNotes}
                  onChange={e => setGuideReqNotes(e.target.value)}
                  placeholder="Budget stay under KES 2,500, fresh food market orientation..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={guideReqSubmitting}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                {guideReqSubmitting ? 'Sending Request...' : 'Send Guide Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Neighborhood Article Reader Modal */}
      {activeArticle && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 rounded-3xl overflow-hidden shadow-2xl relative my-auto">
            <button
              type="button"
              onClick={() => setActiveArticle(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={activeArticle.heroImage} alt={activeArticle.title} className="w-full h-48 object-cover" />
            <div className="p-6 space-y-4">
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {activeArticle.area} · {activeArticle.readTime}
              </div>
              <h3 className="text-xl font-black">{activeArticle.title}</h3>
              <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                {activeArticle.content}
              </p>
              <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <div className="text-xs font-black uppercase text-stone-500">Host Picks</div>
                {activeArticle.hostRecommendations.map(rec => (
                  <div key={rec.spot} className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 text-xs">
                    <div className="font-bold">{rec.spot} ({rec.category})</div>
                    <div className="text-stone-500 mt-0.5">{rec.tip}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
