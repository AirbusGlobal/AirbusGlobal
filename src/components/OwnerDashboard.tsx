import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Stay,
  Booking,
  HostPlanStatus,
  Currency,
  CURRENCY_RATES,
  ListingPromotion,
} from '../types';
import { api } from '../api';
import {
  Plus,
  CreditCard,
  Wallet,
  Eye,
  Heart,
  TrendingUp,
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Trash2,
  ShieldAlert,
  ArrowRight,
  UploadCloud,
  PhoneCall,
  Check,
  ArrowLeft,
  Youtube,
  Film,
  AlertCircle,
  Lock,
  Gift,
  Rocket,
  Megaphone,
} from 'lucide-react';
import { AMENITY_GROUPS, PLANS } from '../constants';
import { extractYouTubeId, getYouTubeThumbnailUrl, isYouTubeUrl } from '../utils/youtube';

interface OwnerDashboardProps {
  user: User;
  myStays: Stay[];
  bookings: Booking[];
  plan: HostPlanStatus;
  walletBalance: number;
  onOpenPlanModal: () => void;
  onOpenTopupModal: () => void;
  onCreateStay: (stayData: any) => Promise<void>;
  onUpdateStay: (id: string, updates: Partial<Stay>) => Promise<void>;
  onDeleteStay: (id: string) => Promise<void>;
  onUpdateBookingStatus: (id: string, status: Booking['status']) => Promise<void>;
  onDescribeStayAI: (params: any) => Promise<{ description: string; highlights: string[] }>;
  currency: Currency;
  onBackToFeed?: () => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  user,
  myStays,
  bookings,
  plan,
  walletBalance,
  onOpenPlanModal,
  onOpenTopupModal,
  onCreateStay,
  onUpdateStay,
  onDeleteStay,
  onUpdateBookingStatus,
  onDescribeStayAI,
  currency,
  onBackToFeed,
}) => {
  const [activeTab, setActiveTab] = useState<'listings' | 'reservations' | 'promotions' | 'new-stay' | 'insights'>('listings');

  // Check if subscription is active
  const isPlanActive = plan.status === 'active' && plan.expiresAt > Date.now();
  const daysRemaining = Math.max(0, Math.ceil((plan.expiresAt - Date.now()) / 864e5));
  const isGracePeriod = !isPlanActive && Date.now() <= plan.expiresAt + 2 * 864e5;

  // Promoted Listings & Visibility Boost State
  const [promotions, setPromotions] = useState<ListingPromotion[]>([]);
  const [selectedStayIdForPromo, setSelectedStayIdForPromo] = useState<string>(myStays[0]?.id || '');
  const [promoDays, setPromoDays] = useState<number>(3);
  const [promoLoading, setPromoLoading] = useState<boolean>(false);
  const [promoFeedback, setPromoFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Load host promotions
  const fetchPromotions = () => {
    api.getOwnerPromotions()
      .then(res => setPromotions(res.promotions || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  // Welcome Gifts & Host Greeting Wizard State
  const [welcomeGifts, setWelcomeGifts] = useState<string[]>([
    'Kenyan Safari Kahawa & Fresh Ground Beans',
    'Fresh Coconut Water & Tropical Basket',
  ]);
  const [customGiftInput, setCustomGiftInput] = useState('');
  const [hostMessage, setHostMessage] = useState('Karibu sana! We look forward to hosting you in our serene home.');

  // In-place Quick Edit for Gifts & Message on existing listings
  const [editingGiftsStayId, setEditingGiftsStayId] = useState<string | null>(null);
  const [editGiftsList, setEditGiftsList] = useState<string[]>([]);
  const [editCustomGift, setEditCustomGift] = useState('');
  const [editHostMsg, setEditHostMsg] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // New Stay Wizard State
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [rooms, setRooms] = useState(2);
  const [price, setPrice] = useState(7500);
  const [desc, setDesc] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['WiFi', 'Parking', 'Kitchen']);

  // Video Upload & YouTube States
  const [videoSourceType, setVideoSourceType] = useState<'upload' | 'youtube'>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState('');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phone, setPhone] = useState(user.phone || '');
  const [whatsapp, setWhatsapp] = useState('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiHighlights, setAiHighlights] = useState<string[]>([]);
  const [creatingStay, setCreatingStay] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Date blocking state
  const [blockStayId, setBlockStayId] = useState<string | null>(null);
  const [blockFrom, setBlockFrom] = useState('');
  const [blockTo, setBlockTo] = useState('');

  const formatMoney = (val: number) => {
    const rate = CURRENCY_RATES[currency] || 1;
    const converted = Math.round(val * rate);
    return `${currency} ${converted.toLocaleString()}`;
  };

  // Handle Drag and Drop for MP4/MOV videos
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingVideo(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingVideo(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingVideo(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessVideoFile(e.dataTransfer.files[0]);
    }
  };

  const handleProcessVideoFile = (file: File) => {
    // Validate format (MP4, MOV, WebM)
    const validExtensions = ['mp4', 'mov', 'webm', 'm4v'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!validExtensions.includes(ext) && !file.type.startsWith('video/')) {
      alert('Please upload a video file in MP4, MOV, or WebM format.');
      return;
    }

    // Size limit: 50MB
    if (file.size > 50 * 1024 * 1024) {
      alert('Video file size exceeds 50MB limit. Please upload a short tour video (max 60 seconds).');
      return;
    }

    setVideoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(objectUrl);
    setVideoUrl(objectUrl);
  };

  // Handle YouTube URL input
  const handleYoutubeChange = (val: string) => {
    setYoutubeInput(val);
    const id = extractYouTubeId(val);
    setYoutubeVideoId(id);
  };

  // Reservation requests for my stays
  const myStayIds = new Set(myStays.map(s => s.id));
  const myReservations = bookings.filter(b => myStayIds.has(b.stayId));
  const pendingRequests = myReservations.filter(b => b.status === 'requested');
  const confirmedReservations = myReservations.filter(b => b.status === 'confirmed');

  const totalEarningsKes = confirmedReservations.reduce((acc, b) => acc + b.total, 0);

  const toggleFeature = (feat: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feat) ? prev.filter(f => f !== feat) : [...prev, feat]
    );
  };

  const handleGenerateAI = async () => {
    if (!title || !area) {
      alert('Please fill in Title and Area first before generating AI description.');
      return;
    }
    setAiGenerating(true);
    try {
      const res = await onDescribeStayAI({
        title,
        location: `${area}, near ${landmark || 'Nairobi'}`,
        type: 'Apartment',
        features: selectedFeatures,
      });
      setDesc(res.description);
      setAiHighlights(res.highlights || []);
    } catch (err: any) {
      alert('AI generator error: ' + err.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleWizardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWizardError(null);

    // Mandatory subscription enforcement
    if (!isPlanActive) {
      setWizardError('A mandatory 30-day host subscription (Silver, Diamond, or Gold) is required before listing a stay. Please select and pay for a plan via M-Pesa.');
      return;
    }

    if (!title || !area || !price) {
      setWizardError('Please complete required fields.');
      return;
    }

    if (!videoUrl && !youtubeVideoId) {
      setWizardError('AirBus is video-first! Please upload a tour video (MP4/MOV) or provide a YouTube / Shorts link.');
      return;
    }

    setCreatingStay(true);
    try {
      const thumb = youtubeVideoId
        ? getYouTubeThumbnailUrl(youtubeVideoId)
        : 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80';

      await onCreateStay({
        title,
        location: `${area} · near ${landmark || 'Central'}`,
        price: Number(price),
        type: rooms === 1 ? 'Studio' : rooms > 3 ? 'Villa' : 'Apartment',
        guests: rooms * 2,
        beds: rooms,
        area: rooms * 35,
        features: selectedFeatures,
        highlights: aiHighlights,
        description: desc,
        videoUrl: videoUrl || '',
        youtubeUrl: youtubeVideoId ? youtubeInput : undefined,
        youtubeVideoId: youtubeVideoId || undefined,
        thumbnailUrl: thumb,
        whatsapp: whatsapp || '',
        affiliateLink: affiliateLink || '',
        minNights: 1,
        welcomeGifts: welcomeGifts.length > 0 ? welcomeGifts : ['Kenyan Safari Kahawa & Fresh Ground Beans'],
        hostMessage: hostMessage.trim() || 'Karibu sana! We look forward to hosting you.',
      });

      // Reset wizard
      setTitle('');
      setArea('');
      setLandmark('');
      setVideoFile(null);
      setVideoPreviewUrl('');
      setVideoUrl('');
      setYoutubeInput('');
      setYoutubeVideoId(null);
      setWelcomeGifts(['Kenyan Safari Kahawa & Fresh Ground Beans', 'Fresh Coconut Water & Tropical Basket']);
      setHostMessage('Karibu sana! We look forward to hosting you in our serene home.');
      setStep(1);
      setActiveTab('listings');
    } catch (err: any) {
      setWizardError(err.message || 'Failed to publish stay.');
    } finally {
      setCreatingStay(false);
    }
  };

  const handleBoostListing = async () => {
    if (!selectedStayIdForPromo) {
      setPromoFeedback({ type: 'error', msg: 'Please select a listing to boost.' });
      return;
    }
    const cost = promoDays * 100;
    if (walletBalance < cost) {
      setPromoFeedback({
        type: 'error',
        msg: `Insufficient wallet balance (KES ${walletBalance}). Boost requires KES ${cost}. Please top up via M-Pesa.`,
      });
      return;
    }

    setPromoLoading(true);
    setPromoFeedback(null);
    try {
      const idempotencyKey = `promo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const res = await api.promoteListing(selectedStayIdForPromo, promoDays, idempotencyKey);
      setPromoFeedback({
        type: 'success',
        msg: `🚀 Promotion activated for ${res.promotion.days} days! Your listing now enjoys top-of-feed placement and the Promoted Boost badge.`,
      });
      fetchPromotions();
      await onUpdateStay(selectedStayIdForPromo, {
        isPromoted: true,
        promotedUntil: res.promotion.expiresAt,
      });
    } catch (err: any) {
      setPromoFeedback({ type: 'error', msg: err.message || 'Promotion failed.' });
    } finally {
      setPromoLoading(false);
    }
  };

  const handleSaveGifts = async (stayId: string) => {
    setEditSaving(true);
    try {
      await onUpdateStay(stayId, {
        welcomeGifts: editGiftsList,
        hostMessage: editHostMsg,
      });
      setEditingGiftsStayId(null);
    } catch (err: any) {
      alert('Could not update gifts: ' + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleBlockDates = async (stayId: string) => {
    if (!blockFrom || !blockTo || blockTo <= blockFrom) {
      alert('Please select valid block dates.');
      return;
    }
    const stay = myStays.find(s => s.id === stayId);
    if (!stay) return;
    const existing = stay.blockedDates || [];
    const updated = [...existing, { from: blockFrom, to: blockTo }];
    await onUpdateStay(stayId, { blockedDates: updated });
    setBlockFrom('');
    setBlockTo('');
    setBlockStayId(null);
  };

  const handleRemoveBlock = async (stayId: string, idx: number) => {
    const stay = myStays.find(s => s.id === stayId);
    if (!stay || !stay.blockedDates) return;
    const updated = [...stay.blockedDates];
    updated.splice(idx, 1);
    await onUpdateStay(stayId, { blockedDates: updated });
  };

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

        {/* Mandatory Subscription Status Pill */}
        <div className="flex items-center gap-2">
          {isPlanActive ? (
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>30-Day Plan Active: {daysRemaining} days left</span>
            </span>
          ) : isGracePeriod ? (
            <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>2-Day Grace Period: Renew now</span>
            </span>
          ) : (
            <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Subscription Expired: Listings Hidden</span>
            </span>
          )}
        </div>
      </div>

      {/* Mandatory Subscription Warning Banner if Inactive */}
      {!isPlanActive && (
        <div className="mb-6 p-4 rounded-3xl bg-gradient-to-r from-rose-950/40 via-stone-900 to-amber-950/40 border border-rose-500/40 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                Mandatory Host Subscription Required
              </h3>
              <p className="text-xs text-stone-300">
                To upload video stays and keep listings visible in search, an active 30-day subscription (Silver KES 1,000, Diamond KES 2,500, or Gold KES 5,000) is required. After expiration, you have a 2-day grace period before listings are hidden from public search.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenPlanModal}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white font-extrabold text-xs shadow-lg hover:opacity-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            Pay &amp; Activate Plan
          </button>
        </div>
      )}

      {/* Top Banner: Owner Metrics & Subscriptions */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white p-6 rounded-3xl shadow-lg border border-stone-700/50 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                Owner Host Console
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                Direct Host Payouts (0% Commission)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight">
              Welcome, {user.name}
            </h1>
            <p className="text-xs text-stone-300 mt-1 max-w-md">
              Manage your video-first listings, upload drag-and-drop tour videos or YouTube Shorts, and review guest requests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                if (!isPlanActive) {
                  onOpenPlanModal();
                  return;
                }
                setStep(1);
                setActiveTab('new-stay');
              }}
              className="bg-[#e4002b] hover:bg-[#c90026] text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>List a New Stay</span>
            </button>
          </div>
        </div>

        {/* Subscription & Wallet Bar */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Subscription Info */}
          <div className="bg-white/5 p-4 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] text-stone-400 uppercase font-semibold">Subscription Status</div>
                <div className="text-sm font-extrabold text-white flex items-center gap-2">
                  <span>{plan.tier} Plan</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      isPlanActive
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {isPlanActive ? `${daysRemaining} days left` : 'Expired'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onOpenPlanModal}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition-colors cursor-pointer"
            >
              {isPlanActive ? 'Renew / Upgrade' : 'Pay Subscription'}
            </button>
          </div>

          {/* Wallet Balance */}
          <div className="bg-white/5 p-4 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] text-stone-400 uppercase font-semibold">AirBus Wallet</div>
                <div className="text-sm font-extrabold text-white">
                  KES {walletBalance.toLocaleString()}
                </div>
              </div>
            </div>

            <button
              onClick={onOpenTopupModal}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-full text-xs font-bold transition-colors shadow-sm cursor-pointer"
            >
              Deposit (M-Pesa)
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 border-b border-stone-200 dark:border-stone-800">
        <button
          onClick={() => setActiveTab('listings')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'listings'
              ? 'bg-[#e4002b] text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          My Listings ({myStays.length})
        </button>

        <button
          onClick={() => setActiveTab('reservations')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'reservations'
              ? 'bg-[#e4002b] text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <span>Reservations Queue</span>
          {pendingRequests.length > 0 && (
            <span className="bg-amber-400 text-stone-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('promotions')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'promotions'
              ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Rocket className="w-4 h-4 text-amber-400" />
          <span>Promoted Listings</span>
          {myStays.some(s => s.isPromoted) && (
            <span className="bg-amber-400 text-stone-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
              Boost Active
            </span>
          )}
        </button>

        <button
          onClick={() => {
            if (!isPlanActive) {
              onOpenPlanModal();
              return;
            }
            setActiveTab('new-stay');
          }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'new-stay'
              ? 'bg-[#e4002b] text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Upload Video Stay</span>
        </button>
      </div>

      {/* TAB 1: LISTINGS */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {myStays.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-200 dark:border-stone-800">
              <UploadCloud className="w-12 h-12 text-stone-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">No active listings yet</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto mb-4">
                AirBus is video-only. Drag and drop a property video tour or paste your YouTube Shorts link to start receiving bookings.
              </p>
              <button
                onClick={() => {
                  if (!isPlanActive) {
                    onOpenPlanModal();
                    return;
                  }
                  setActiveTab('new-stay');
                }}
                className="px-5 py-2.5 bg-[#e4002b] text-white rounded-full text-xs font-bold hover:bg-[#c90026] cursor-pointer"
              >
                Upload Your First Stay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {myStays.map(s => {
                const requestsCount = bookings.filter(b => b.stayId === s.id).length;
                const conversionRate = s.views ? Math.round((requestsCount / s.views) * 100) : 0;
                const isBlockedFormOpen = blockStayId === s.id;
                const isExpired = s.status === 'expired' || (!isPlanActive && !isGracePeriod);

                return (
                  <div
                    key={s.id}
                    className={`bg-white dark:bg-[#15171e] p-5 rounded-3xl border shadow-sm space-y-4 transition-all ${
                      isExpired
                        ? 'border-rose-400/50 bg-rose-50/20 dark:bg-rose-950/10'
                        : 'border-stone-200 dark:border-stone-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {/* Stay Info */}
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-12 rounded-xl overflow-hidden bg-stone-900 relative shrink-0">
                          {s.thumbnailUrl && (
                            <img src={s.thumbnailUrl} alt={s.title} className="w-full h-full object-cover" />
                          )}
                          <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] font-bold px-1 rounded">
                            {s.youtubeVideoId ? 'YouTube' : 'Video'}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-stone-900 dark:text-white">
                              {s.title}
                            </h3>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isExpired
                                  ? 'bg-rose-500 text-white'
                                  : s.status === 'live'
                                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                  : s.status === 'review'
                                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                  : 'bg-stone-500/20 text-stone-500'
                              }`}
                            >
                              {isExpired ? 'Expired (Hidden)' : s.status}
                            </span>
                          </div>

                          <div className="text-xs text-stone-500 mt-0.5">
                            📍 {s.location} · {formatMoney(s.price)}/night
                          </div>

                          {isExpired && (
                            <div className="text-[11px] text-rose-500 font-bold mt-1 flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Hidden from public search: 30-day plan expired. Renew to restore visibility.</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {isExpired ? (
                          <button
                            onClick={onOpenPlanModal}
                            className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#e4002b] text-white hover:bg-[#c90026] shadow-sm cursor-pointer"
                          >
                            Renew Subscription
                          </button>
                        ) : (
                          <button
                            onClick={() => onUpdateStay(s.id, { status: s.status === 'live' ? 'paused' : 'live' })}
                            className="px-3 py-1.5 rounded-full text-xs font-bold border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            {s.status === 'live' ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                            <span>{s.status === 'live' ? 'Pause' : 'Resume'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedStayIdForPromo(s.id);
                            setActiveTab('promotions');
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            s.isPromoted
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                              : 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-xs hover:opacity-95'
                          }`}
                          title="Boost visibility at KES 100/day"
                        >
                          <Rocket className="w-3.5 h-3.5" />
                          <span>{s.isPromoted ? 'Boost Active 🚀' : 'Boost (KES 100/d)'}</span>
                        </button>

                        <button
                          onClick={() => {
                            if (editingGiftsStayId === s.id) {
                              setEditingGiftsStayId(null);
                            } else {
                              setEditingGiftsStayId(s.id);
                              setEditGiftsList(
                                s.welcomeGifts || [
                                  'Kenyan Safari Kahawa & Fresh Ground Beans',
                                  'Fresh Coconut Water & Tropical Basket',
                                ]
                              );
                              setEditHostMsg(
                                s.hostMessage || 'Karibu sana! We look forward to hosting you in our serene home.'
                              );
                            }
                          }}
                          className="px-3 py-1.5 rounded-full text-xs font-bold border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Gift className="w-3.5 h-3.5 text-amber-600" />
                          <span>Gifts &amp; Note ({s.welcomeGifts?.length || 0})</span>
                        </button>

                        <button
                          onClick={() => setBlockStayId(isBlockedFormOpen ? null : s.id)}
                          className="px-3 py-1.5 rounded-full text-xs font-bold border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Block Dates</span>
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm('Delete this listing permanently?')) {
                              onDeleteStay(s.id);
                            }
                          }}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-colors cursor-pointer"
                          title="Delete listing"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* In-place Welcome Gifts & Host Message Editor */}
                    {editingGiftsStayId === s.id && (
                      <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-300/70 dark:border-amber-800 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-amber-950 dark:text-amber-200 uppercase flex items-center gap-1.5">
                            <Gift className="w-4 h-4 text-amber-600" />
                            <span>Manage Welcome Gifts &amp; Host Greeting Note</span>
                          </h4>
                          <span className="text-[10px] text-amber-700 font-bold">
                            Displayed on card &amp; booking
                          </span>
                        </div>

                        {/* Gift Chips */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300 block">
                            Active Gifts ({editGiftsList.length})
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              'Kenyan Safari Kahawa & Fresh Ground Beans',
                              'Fresh Coconut Water & Tropical Basket',
                              'Late Checkout (1:00 PM)',
                              'Complimentary Airport Pickup',
                              'Artisanal Kenyan Macadamia Nuts',
                              'Chilled Sparkling Juice',
                              'Fresh Beach Towels & Sunscreen',
                            ].map(gift => {
                              const isSel = editGiftsList.includes(gift);
                              return (
                                <button
                                  key={gift}
                                  type="button"
                                  onClick={() => {
                                    setEditGiftsList(prev =>
                                      prev.includes(gift) ? prev.filter(g => g !== gift) : [...prev, gift]
                                    );
                                  }}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                                    isSel
                                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                      : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                                  }`}
                                >
                                  {isSel ? '✓ ' : '+ '} {gift}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={editCustomGift}
                              onChange={e => setEditCustomGift(e.target.value)}
                              placeholder="Add custom gift item..."
                              className="flex-1 px-3 py-1.5 bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-800 rounded-xl text-xs outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (editCustomGift.trim()) {
                                  setEditGiftsList(prev => [...prev, editCustomGift.trim()]);
                                  setEditCustomGift('');
                                }
                              }}
                              className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-amber-700"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {/* Host Greeting Note */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300 block">
                            Host Greeting / Personal Welcome Message
                          </label>
                          <textarea
                            rows={2}
                            value={editHostMsg}
                            onChange={e => setEditHostMsg(e.target.value)}
                            placeholder="e.g. Karibu sana! We look forward to hosting you..."
                            className="w-full px-3 py-1.5 bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-800 rounded-xl text-xs outline-none"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingGiftsStayId(null)}
                            className="px-3 py-1.5 rounded-full text-xs font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={editSaving}
                            onClick={() => handleSaveGifts(s.id)}
                            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-full text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {editSaving ? 'Saving...' : 'Save Gifts & Note'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Performance Metrics Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-stone-100 dark:border-stone-800 text-xs">
                      <div className="p-2.5 bg-stone-50 dark:bg-stone-900 rounded-xl">
                        <span className="text-stone-400 block text-[10px] font-semibold">Total Views</span>
                        <span className="text-sm font-extrabold text-stone-800 dark:text-stone-200">{s.views || 0}</span>
                      </div>

                      <div className="p-2.5 bg-stone-50 dark:bg-stone-900 rounded-xl">
                        <span className="text-stone-400 block text-[10px] font-semibold">Likes</span>
                        <span className="text-sm font-extrabold text-stone-800 dark:text-stone-200">{s.likesCount || 0}</span>
                      </div>

                      <div className="p-2.5 bg-stone-50 dark:bg-stone-900 rounded-xl">
                        <span className="text-stone-400 block text-[10px] font-semibold">Booking Requests</span>
                        <span className="text-sm font-extrabold text-stone-800 dark:text-stone-200">{requestsCount}</span>
                      </div>

                      <div className="p-2.5 bg-stone-50 dark:bg-stone-900 rounded-xl">
                        <span className="text-stone-400 block text-[10px] font-semibold">Conversion</span>
                        <span className="text-sm font-extrabold text-stone-800 dark:text-stone-200">{conversionRate}%</span>
                      </div>
                    </div>

                    {/* Block Dates Form & Existing Blocks */}
                    {isBlockedFormOpen && (
                      <div className="p-4 bg-stone-50 dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700">
                        <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 mb-2">Block dates from guest booking</h4>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="date"
                            value={blockFrom}
                            onChange={e => setBlockFrom(e.target.value)}
                            className="px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs"
                          />
                          <span className="text-xs text-stone-400">to</span>
                          <input
                            type="date"
                            value={blockTo}
                            onChange={e => setBlockTo(e.target.value)}
                            className="px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs"
                          />
                          <button
                            onClick={() => handleBlockDates(s.id)}
                            className="px-3 py-1.5 bg-stone-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Block Range
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RESERVATIONS QUEUE */}
      {activeTab === 'reservations' && (
        <div className="space-y-6">
          <div className="p-4 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm flex items-center justify-between flex-wrap gap-4 text-xs font-medium">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold rounded-full">
                {confirmedReservations.length} Confirmed
              </span>
              <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold rounded-full">
                {pendingRequests.length} Pending Approval
              </span>
            </div>

            <div className="text-right">
              <span className="text-stone-400 block text-[10px]">Estimated Confirmed Revenue</span>
              <span className="text-sm font-extrabold text-stone-900 dark:text-white">KES {totalEarningsKes.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-3">
            {pendingRequests.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#15171e] rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-400">
                You’re all caught up! No pending booking requests.
              </div>
            ) : (
              pendingRequests.map(req => {
                const s = myStays.find(item => item.id === req.stayId);
                return (
                  <div
                    key={req.id}
                    className="p-5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-extrabold text-stone-900 dark:text-white">
                          {req.guestName}
                        </span>
                        <span className="text-[11px] text-stone-400 font-mono">({req.guestEmail})</span>
                      </div>
                      <div className="text-xs text-stone-700 dark:text-stone-300">
                        Property: <span className="font-bold">{s?.title || req.stayId}</span>
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        Dates: {req.checkIn} → {req.checkOut} · {req.guests} guests · Total: <span className="font-bold text-stone-800 dark:text-stone-100">{formatMoney(req.total)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateBookingStatus(req.id, 'confirmed')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-full transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Accept Booking</span>
                      </button>

                      <button
                        onClick={() => onUpdateBookingStatus(req.id, 'declined')}
                        className="px-4 py-2 bg-stone-200 dark:bg-stone-800 hover:bg-rose-100 text-stone-700 dark:text-stone-300 hover:text-rose-600 text-xs font-bold rounded-full transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB: PROMOTED LISTINGS & VISIBILITY BOOST */}
      {activeTab === 'promotions' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-stone-900 to-rose-950/40 border border-amber-500/30 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-sm">
                  <Rocket className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-black tracking-wide">
                  Promoted Listings &amp; Visibility Boost
                </h3>
                <span className="text-[10px] bg-amber-400 text-stone-950 font-black px-2.5 py-0.5 rounded-full uppercase">
                  KES 100 / Day
                </span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed">
                Boost your video tours to the absolute top of the search feed, discover map, and Shorts recommendations. Promoted stays receive a distinct glowing badge and 3.8x more direct booking enquiries. Paid directly from your AirBus wallet!
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center shrink-0 w-full md:w-auto">
              <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Available Wallet Balance</span>
              <div className="text-xl font-black text-emerald-400 mb-2">
                KES {walletBalance.toLocaleString()}
              </div>
              <button
                onClick={onOpenTopupModal}
                className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm w-full"
              >
                + Top Up Wallet
              </button>
            </div>
          </div>

          {/* Campaign Launcher Card */}
          <div className="p-6 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-5">
            <h4 className="text-sm font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Launch a New Visibility Boost Campaign</span>
            </h4>

            {promoFeedback && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                  promoFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300'
                }`}
              >
                {promoFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{promoFeedback.msg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Select Listing */}
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1.5">
                  1. Select Stay Listing to Boost
                </label>
                {myStays.length === 0 ? (
                  <p className="text-xs text-stone-400">Please upload a stay first.</p>
                ) : (
                  <select
                    value={selectedStayIdForPromo}
                    onChange={e => setSelectedStayIdForPromo(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
                  >
                    {myStays.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.location}) — KES {s.price.toLocaleString()}/night
                        {s.isPromoted ? ' [Currently Boosted]' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Select Duration */}
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1.5">
                  2. Choose Boost Duration (@ KES 100/day)
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { days: 1, label: '1 Day', cost: 100 },
                    { days: 3, label: '3 Days', cost: 300 },
                    { days: 7, label: '7 Days', cost: 700 },
                    { days: 14, label: '14 Days', cost: 1400 },
                    { days: 30, label: '30 Days', cost: 3000 },
                  ].map(opt => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setPromoDays(opt.days)}
                      className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                        promoDays === opt.days
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <span className="text-xs font-bold block">{opt.label}</span>
                      <span className="text-[10px] opacity-80 font-mono">KES {opt.cost}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs text-stone-500 block">Total Campaign Investment:</span>
                <div className="text-lg font-black text-stone-900 dark:text-white">
                  KES {(promoDays * 100).toLocaleString()}{' '}
                  <span className="text-xs font-normal text-stone-400">({promoDays} days of top placement)</span>
                </div>
              </div>

              <button
                onClick={handleBoostListing}
                disabled={promoLoading || myStays.length === 0}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-95 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Rocket className="w-4 h-4" />
                <span>{promoLoading ? 'Activating Boost...' : `Activate Boost for KES ${promoDays * 100}`}</span>
              </button>
            </div>
          </div>

          {/* Campaigns History & Live Performance Table */}
          <div className="p-6 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-stone-900 dark:text-white">
                Active &amp; Past Boost Campaigns ({promotions.length})
              </h4>
              <button
                onClick={fetchPromotions}
                className="text-xs font-bold text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
              >
                Refresh
              </button>
            </div>

            {promotions.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl text-xs text-stone-400">
                No promotions launched yet. Choose a listing above to start getting more bookings!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-200 dark:border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                    <tr>
                      <th className="py-2.5 px-3">Listing</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Cost</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Impressions</th>
                      <th className="py-2.5 px-3">Clicks</th>
                      <th className="py-2.5 px-3">Days Left</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {promotions.map(p => {
                      const stay = myStays.find(s => s.id === p.stayId);
                      const isStillActive = p.expiresAt > Date.now();
                      const daysLeft = Math.max(0, Math.ceil((p.expiresAt - Date.now()) / 864e5));
                      return (
                        <tr key={p.id} className="hover:bg-stone-50 dark:hover:bg-stone-900/50">
                          <td className="py-3 px-3 font-bold text-stone-900 dark:text-white flex items-center gap-2">
                            <span>🚀</span>
                            <span className="truncate max-w-[200px]">{stay?.title || `Stay #${p.stayId}`}</span>
                          </td>
                          <td className="py-3 px-3">{p.days} Days</td>
                          <td className="py-3 px-3 font-mono font-bold">KES {p.cost}</td>
                          <td className="py-3 px-3">
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
                          <td className="py-3 px-3 font-mono">{p.impressions || stay?.promotionImpressions || 0}</td>
                          <td className="py-3 px-3 font-mono">{p.clicks || stay?.promotionClicks || 0}</td>
                          <td className="py-3 px-3 text-stone-500 font-semibold">
                            {isStillActive ? `${daysLeft} days` : '0 days'}
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

      {/* TAB 3: UPLOAD VIDEO STAY WIZARD */}
      {activeTab === 'new-stay' && (
        <div className="max-w-2xl mx-auto bg-white dark:bg-[#15171e] p-6 sm:p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xl space-y-6">
          {/* Steps Indicator */}
          <div className="grid grid-cols-3 gap-2 pb-4 border-b border-stone-100 dark:border-stone-800 text-center">
            {['1. Basics', '2. Amenities', '3. Video & Contact'].map((label, idx) => (
              <div
                key={label}
                className={`py-1 text-xs font-bold border-b-2 transition-all ${
                  step === idx + 1
                    ? 'border-[#e4002b] text-[#e4002b]'
                    : step > idx + 1
                    ? 'border-emerald-500 text-emerald-500'
                    : 'border-transparent text-stone-400'
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          {wizardError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-600 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{wizardError}</span>
            </div>
          )}

          <form onSubmit={handleWizardSubmit} className="space-y-5">
            {/* STEP 1: BASICS */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Stay Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Modern Kilimani 2BR with Rooftop Pool"
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Area / Neighborhood *
                    </label>
                    <input
                      type="text"
                      value={area}
                      onChange={e => setArea(e.target.value)}
                      placeholder="e.g. Westlands, Kilimani, Diani Beach"
                      className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Nearest Landmark *
                    </label>
                    <input
                      type="text"
                      value={landmark}
                      onChange={e => setLandmark(e.target.value)}
                      placeholder="e.g. Yaya Centre, Sarit Centre"
                      className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Bedrooms Count (1-50) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={rooms}
                      onChange={e => setRooms(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Nightly Rate (KES) *
                    </label>
                    <input
                      type="number"
                      min="500"
                      step="100"
                      value={price}
                      onChange={e => setPrice(parseInt(e.target.value, 10) || 1000)}
                      className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                      required
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!title || !area) {
                        alert('Please fill in title and area.');
                        return;
                      }
                      setStep(2);
                    }}
                    className="px-6 py-2.5 bg-[#e4002b] text-white rounded-full text-xs font-bold hover:bg-[#c90026] cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Next: Amenities</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: AMENITIES */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white">Amenities &amp; Features</h3>
                  <p className="text-xs text-stone-500">
                    Select every amenity your stay honestly offers ({selectedFeatures.length} selected).
                  </p>
                </div>

                <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                  {Object.entries(AMENITY_GROUPS).map(([category, items]) => (
                    <div key={category}>
                      <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider block mb-1.5">
                        {category}
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {items.map(item => {
                          const isChecked = selectedFeatures.includes(item);
                          return (
                            <label
                              key={item}
                              onClick={() => toggleFeature(item)}
                              className={`p-2 rounded-xl text-xs font-medium border flex items-center gap-2 cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-[#fbeeee] dark:bg-[#331219] border-[#e4002b] text-[#e4002b]'
                                  : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                                  isChecked ? 'bg-[#e4002b] border-[#e4002b]' : 'border-stone-400'
                                }`}
                              >
                                {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <span className="truncate">{item}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-5 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full text-xs font-bold hover:bg-stone-200 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-6 py-2.5 bg-[#e4002b] text-white rounded-full text-xs font-bold hover:bg-[#c90026] cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Next: Video &amp; Upload</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: VIDEO UPLOAD (DRAG & DROP OR YOUTUBE) & CONTACTS */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white">Video Tour &amp; Contacts</h3>
                  <p className="text-xs text-stone-500">
                    AirBus is video-first! Drag and drop an MP4 or MOV file, or paste a YouTube / YouTube Shorts link.
                  </p>
                </div>

                {/* Video Source Switcher */}
                <div className="flex items-center gap-2 p-1 bg-stone-100 dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setVideoSourceType('upload')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      videoSourceType === 'upload'
                        ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-sm'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    <Film className="w-4 h-4 text-[#e4002b]" />
                    <span>Drag &amp; Drop Video (MP4 / MOV)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVideoSourceType('youtube')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      videoSourceType === 'youtube'
                        ? 'bg-white dark:bg-stone-800 text-[#ff0000] shadow-sm'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    <Youtube className="w-4 h-4 text-[#ff0000]" />
                    <span>YouTube &amp; Shorts Embed</span>
                  </button>
                </div>

                {/* Option A: Drag and Drop MP4 / MOV Uploader */}
                {videoSourceType === 'upload' && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-6 border-2 border-dashed rounded-3xl text-center transition-all cursor-pointer ${
                      isDraggingVideo
                        ? 'border-[#e4002b] bg-rose-50/50 dark:bg-rose-950/20 scale-[1.01]'
                        : 'border-stone-300 dark:border-stone-700 hover:border-stone-400 bg-stone-50/50 dark:bg-stone-900/50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          handleProcessVideoFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />

                    {videoPreviewUrl ? (
                      <div className="space-y-3" onClick={e => e.stopPropagation()}>
                        <div className="relative aspect-video max-w-sm mx-auto rounded-2xl overflow-hidden bg-black shadow-lg">
                          <video src={videoPreviewUrl} controls className="w-full h-full object-cover" />
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{videoFile?.name} ({(videoFile!.size / (1024 * 1024)).toFixed(1)} MB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs text-[#e4002b] hover:underline font-semibold cursor-pointer"
                        >
                          Replace video
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 py-4">
                        <UploadCloud className="w-10 h-10 text-stone-400 mx-auto" />
                        <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
                          Drag and drop property tour video here
                        </h4>
                        <p className="text-[11px] text-stone-400">
                          Supports MP4, MOV, WebM (max 60 seconds, under 50 MB)
                        </p>
                        <span className="inline-block mt-2 px-4 py-1.5 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full text-xs font-bold">
                          Browse Files
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Option B: YouTube / YouTube Shorts Input */}
                {videoSourceType === 'youtube' && (
                  <div className="space-y-3 p-4 bg-stone-50 dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
                    <div>
                      <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                        YouTube or YouTube Shorts URL
                      </label>
                      <input
                        type="url"
                        value={youtubeInput}
                        onChange={e => handleYoutubeChange(e.target.value)}
                        placeholder="e.g. https://youtube.com/shorts/xyz or https://youtu.be/xyz"
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#ff0000]"
                      />
                    </div>

                    {youtubeVideoId && (
                      <div className="p-3 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>YouTube Video ID extracted: {youtubeVideoId}</span>
                        </div>
                        <div className="relative aspect-video max-w-sm mx-auto rounded-xl overflow-hidden bg-black shadow">
                          <iframe
                            src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                            title="YouTube Preview"
                            className="w-full h-full border-0"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Description & Highlights Generator */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200 dark:border-purple-800 rounded-2xl">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#ff2e93]" />
                      AI Description &amp; Highlights Generator
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateAI}
                      disabled={aiGenerating}
                      className="px-3 py-1 bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white rounded-full text-[11px] font-bold shadow hover:opacity-95 transition-all cursor-pointer"
                    >
                      {aiGenerating ? 'Generating...' : '✨ Generate with Gemini'}
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    placeholder="Provide property description or click Generate with Gemini..."
                    className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-purple-200 dark:border-purple-800 rounded-xl text-xs outline-none"
                  />
                </div>

                {/* Complimentary Welcome Gifts & Guest Perks */}
                <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300/60 dark:border-amber-800/40 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-amber-600" />
                      Complimentary Welcome Gifts (Incentives for Guests)
                    </span>
                    <span className="text-[10px] text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full font-bold">
                      {welcomeGifts.length} Included
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-300">
                    Select perks or Kenyan hospitality touches guests receive upon check-in.
                  </p>

                  {/* Preset Gift Suggestions */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Kenyan Safari Kahawa & Fresh Ground Beans',
                      'Fresh Coconut Water & Tropical Basket',
                      'Late Checkout (1:00 PM)',
                      'Complimentary Airport Pickup',
                      'Artisanal Kenyan Macadamia Nuts',
                      'Chilled Sparkling Juice',
                      'Fresh Beach Towels & Sunscreen',
                    ].map(gift => {
                      const isSelected = welcomeGifts.includes(gift);
                      return (
                        <button
                          key={gift}
                          type="button"
                          onClick={() => {
                            setWelcomeGifts(prev =>
                              prev.includes(gift) ? prev.filter(g => g !== gift) : [...prev, gift]
                            );
                          }}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                              : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-amber-400'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '} {gift}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Gift */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customGiftInput}
                      onChange={e => setCustomGiftInput(e.target.value)}
                      placeholder="Add custom gift (e.g. Swahili breakfast basket)..."
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-800 rounded-xl text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customGiftInput.trim()) {
                          setWelcomeGifts(prev => [...prev, customGiftInput.trim()]);
                          setCustomGiftInput('');
                        }
                      }}
                      className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-amber-700"
                    >
                      Add Gift
                    </button>
                  </div>
                </div>

                {/* Host Personal Message / Welcome Note */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
                    Host Personal Greeting / Welcome Note
                  </label>
                  <p className="text-[11px] text-stone-400">
                    A warm note shown prominently to guests on your video stay card and booking confirmation.
                  </p>
                  <textarea
                    rows={2}
                    value={hostMessage}
                    onChange={e => setHostMessage(e.target.value)}
                    placeholder="e.g. Karibu sana! We are delighted to host you in our serene home..."
                    className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                  />
                </div>

                {/* Contacts & Direct Booking */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Direct WhatsApp Number
                    </label>
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={e => setWhatsapp(e.target.value)}
                      placeholder="+254 700 000000"
                      className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Affiliate / External Link (optional)
                    </label>
                    <input
                      type="url"
                      value={affiliateLink}
                      onChange={e => setAffiliateLink(e.target.value)}
                      placeholder="https://airbnb.com/rooms/..."
                      className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-5 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full text-xs font-bold hover:bg-stone-200 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={creatingStay}
                    className="px-6 py-2.5 bg-[#e4002b] text-white rounded-full text-xs font-extrabold hover:bg-[#c90026] shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {creatingStay ? 'Submitting...' : 'Publish Stay (Submit for Review)'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
