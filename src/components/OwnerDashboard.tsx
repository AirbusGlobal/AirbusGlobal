import React, { useState, useRef } from 'react';
import {
  User,
  Stay,
  Booking,
  HostPlanStatus,
  Currency,
  CURRENCY_RATES,
} from '../types';
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
  const [activeTab, setActiveTab] = useState<'listings' | 'reservations' | 'new-stay' | 'insights'>('listings');

  // Check if subscription is active
  const isPlanActive = plan.status === 'active' && plan.expiresAt > Date.now();
  const daysRemaining = Math.max(0, Math.ceil((plan.expiresAt - Date.now()) / 864e5));
  const isGracePeriod = !isPlanActive && Date.now() <= plan.expiresAt + 2 * 864e5;

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
      setStep(1);
      setActiveTab('listings');
    } catch (err: any) {
      setWizardError(err.message || 'Failed to publish stay.');
    } finally {
      setCreatingStay(false);
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
