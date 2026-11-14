import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Stay,
  Booking,
  HostPlanStatus,
  Currency,
  CURRENCY_RATES,
  ListingPromotion,
  BoostRecord,
  Post,
  ShortJob,
  ListingAudioConfig,
  ShortAudioConfig,
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
  MapPin,
  Images,
  Image as ImageIcon,
  Camera,
  Layers,
  ChevronLeft,
  ChevronRight,
  Flame,
  Compass,
  Percent,
  Video,
  Music,
  RefreshCw,
  Captions,
} from 'lucide-react';
import { AMENITY_GROUPS, PLANS } from '../constants';
import { extractYouTubeId, getYouTubeThumbnailUrl, isYouTubeUrl } from '../utils/youtube';
import { ComplimentaryGiftsSelector } from './ComplimentaryGiftsSelector';
import { ListingMediaViewer } from './ListingMediaViewer';
import { ShortsCreatorModal } from './shorts/ShortsCreatorModal';
import { ShortsAudioPickerSheet } from './shorts/ShortsAudioPickerSheet';
import { getShortsTierRules } from '../config/shortsTierConfig';

interface OwnerDashboardProps {
  user: User;
  myStays: Stay[];
  bookings: Booking[];
  plan: HostPlanStatus;
  walletBalance: number;
  onOpenPlanModal: () => void;
  onOpenTopupModal: () => void;
  onCreateStay: (stayData: any) => Promise<any>;
  onUpdateStay: (id: string, updates: Partial<Stay>) => Promise<void>;
  onDeleteStay: (id: string) => Promise<void>;
  onUpdateBookingStatus: (id: string, status: Booking['status']) => Promise<void>;
  onDescribeStayAI: (params: any) => Promise<{ description: string; highlights: string[] }>;
  currency: Currency;
  onBackToFeed?: () => void;
  onNavigateToShorts?: () => void;
  showToast?: (msg: string) => void;
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
  onNavigateToShorts,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'listings' | 'reservations' | 'promotions' | 'shorts' | 'new-stay' | 'insights'>('listings');

  // Check if subscription is active
  const isPlanActive = plan.status === 'active' && plan.expiresAt > Date.now();
  const daysRemaining = Math.max(0, Math.ceil((plan.expiresAt - Date.now()) / 864e5));
  const isGracePeriod = !isPlanActive && Date.now() <= plan.expiresAt + 2 * 864e5;

  // Promoted Listings & Visibility Boost State
  const [promotions, setPromotions] = useState<ListingPromotion[]>([]);
  const [boostCampaigns, setBoostCampaigns] = useState<BoostRecord[]>([]);
  const [selectedStayIdForPromo, setSelectedStayIdForPromo] = useState<string>(myStays[0]?.id || '');
  const [promoDays, setPromoDays] = useState<number>(7);
  const [promoPaymentMethod, setPromoPaymentMethod] = useState<'wallet' | 'mpesa'>('wallet');
  const [promoMpesaCode, setPromoMpesaCode] = useState<string>('');
  const [promoLoading, setPromoLoading] = useState<boolean>(false);
  const [promoFeedback, setPromoFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Load host promotions and boosts
  const fetchPromotions = () => {
    api.getBoosts()
      .then(res => setBoostCampaigns(res.campaigns || res.boosts || []))
      .catch(() => {});
    api.getOwnerPromotions()
      .then(res => setPromotions(res.promotions || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  // Shorts & Reels Auto-Creation + Per-Listing Tier Quotas + Gold Listing Audio State
  const tierRules = getShortsTierRules(plan.tier, isPlanActive);
  const [myShortJobs, setMyShortJobs] = useState<ShortJob[]>([]);
  const [myShortsPosts, setMyShortsPosts] = useState<Post[]>([]);
  const [shortsAnalyticsMap, setShortsAnalyticsMap] = useState<Record<string, { views: number; plays: number; replays: number; actionClicks: number }>>({});
  const [loadingShorts, setLoadingShorts] = useState(false);
  const [autoCreateShortOnUpload, setAutoCreateShortOnUpload] = useState(true);
  const [autoShortCaptions, setAutoShortCaptions] = useState(true);
  const [autoShortReviewBeforePosting, setAutoShortReviewBeforePosting] = useState(false);
  const [creatorModalOpen, setCreatorModalOpen] = useState(false);
  const [creatorFixedStay, setCreatorFixedStay] = useState<Stay | null>(null);
  const [creatorInitialMedia, setCreatorInitialMedia] = useState<{
    sourceType: 'video' | 'photo';
    files: string[];
    stayId?: string;
    caption?: string;
    label?: string;
  } | undefined>(undefined);
  const [listingAudioStay, setListingAudioStay] = useState<Stay | null>(null);
  const [listingAudioSaving, setListingAudioSaving] = useState(false);

  const loadCreatorShorts = async () => {
    setLoadingShorts(true);
    try {
      const [jobsRes, feedRes, analyticsRes] = await Promise.all([
        api.getShortJobs().catch(() => ({ jobs: [] })),
        api.getShortsFeed({ ownerEmail: user.email }).catch(() => ({ posts: [] })),
        api.getOwnerShortsAnalytics().catch(() => ({ byShort: [] })),
      ]);
      setMyShortJobs(jobsRes.jobs || []);
      setMyShortsPosts(feedRes.posts || []);
      const aMap: Record<string, { views: number; plays: number; replays: number; actionClicks: number }> = {};
      for (const row of analyticsRes?.byShort || []) {
        const clicksTotal = Object.values(row.clicks || {}).reduce((acc: number, v: any) => acc + (Number(v) || 0), 0);
        aMap[row.shortId] = {
          views: row.views || 0,
          plays: row.plays || 0,
          replays: row.replays || 0,
          actionClicks: clicksTotal,
        };
      }
      setShortsAnalyticsMap(aMap);
    } finally {
      setLoadingShorts(false);
    }
  };

  useEffect(() => {
    loadCreatorShorts();
  }, [user.email]);

  useEffect(() => {
    const hasActiveJobs = myShortJobs.some(j => j.state === 'queued' || j.state === 'processing');
    if (!hasActiveJobs) return;
    const timer = window.setInterval(async () => {
      try {
        const res = await api.getShortJobs();
        const prevMap = new Map(myShortJobs.map(j => [j.id, j.state]));
        for (const job of res.jobs || []) {
          const prev = prevMap.get(job.id);
          if ((prev === 'queued' || prev === 'processing') && job.state === 'ready') {
            showToast?.(
              job.reviewBeforePosting
                ? 'Your 9:16 Short draft is ready to review & publish!'
                : 'Your 9:16 Short was automatically published to Shorts!'
            );
            api.getShortsFeed({ ownerEmail: user.email }).then(r => setMyShortsPosts(r.posts || [])).catch(() => {});
          } else if ((prev === 'queued' || prev === 'processing') && job.state === 'failed') {
            showToast?.(`Short generation failed: ${job.errorMessage || 'Please retry in Shorts & Reels tab.'}`);
          }
        }
        setMyShortJobs(res.jobs || []);
      } catch {}
    }, 3000);
    return () => window.clearInterval(timer);
  }, [myShortJobs, user.email]);

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const getListingQuotaInfo = (stayId: string) => {
    const publishedCount = myShortsPosts.filter(
      p => (p.stayId === stayId || p.listing_id === stayId) && p.type === 'short'
    ).length;
    const activeJobCount = myShortJobs.filter(
      j =>
        j.stayId === stayId &&
        (j.state === 'queued' || j.state === 'processing' || (j.state === 'ready' && !j.publishedPostId))
    ).length;
    const used = publishedCount + activeJobCount;
    const limit = tierRules.shorts_per_listing;
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      tier: plan.tier,
      isPlanActive,
      shortsAudioEnabled: tierRules.shorts_audio_enabled,
    };
  };

  const handleOpenAutoCreateForMedia = (
    stay: Stay,
    sourceType: 'video' | 'photo',
    files: string[],
    label: string
  ) => {
    if (!isPlanActive || tierRules.shorts_per_listing <= 0) {
      setGateModal({
        isOpen: true,
        title: 'Upgrade to Gold or Diamond',
        message: isPlanActive
          ? 'Auto-Create Shorts is locked on the Silver plan. Upgrade to Diamond (1 Short per listing) or Gold (5 Shorts per listing).'
          : 'Your host subscription is inactive or expired. Activate Diamond or Gold to auto-create 9:16 Shorts from listing media.',
        actionText: 'Upgrade to Gold or Diamond',
      });
      return;
    }

    const quota = getListingQuotaInfo(stay.id);
    if (quota.remaining <= 0) {
      setGateModal({
        isOpen: true,
        title: `Short Limit Reached (${quota.used}/${quota.limit})`,
        message:
          plan.tier === 'Diamond'
            ? `This listing already uses ${quota.used} of ${quota.limit} Short allowed on Diamond. Delete an existing Short on this listing or upgrade to Gold (5 Shorts per listing).`
            : `This listing has reached the maximum of ${quota.limit} Shorts. Delete an existing Short on this listing to create a new one.`,
        actionText: plan.tier === 'Diamond' ? 'Upgrade to Gold (5 Shorts)' : 'View Plans',
      });
      return;
    }

    setCreatorFixedStay(stay);
    setCreatorInitialMedia({
      sourceType,
      files,
      stayId: stay.id,
      caption: `${stay.title} · ${stay.location}`,
      label,
    });
    setCreatorModalOpen(true);
  };

  const handleDeleteShort = async (postId: string) => {
    try {
      await api.deleteShortPost(postId);
      setMyShortsPosts(prev => prev.filter(p => p.id !== postId));
      setMyShortJobs(prev => prev.filter(j => j.publishedPostId !== postId));
      showToast?.('Short deleted. 1 slot freed on this listing!');
    } catch (err: any) {
      showToast?.(err.message || 'Could not delete Short.');
    }
  };

  const handleOpenListingAudio = (stay: Stay) => {
    if (!isPlanActive || !tierRules.listing_audio_enabled) {
      setGateModal({
        isOpen: true,
        title: 'Gold Plan Required for Listing Audio',
        message:
          'Adding background music or a voice-over directly to a listing page is an exclusive Gold Host feature. Upgrade to Gold to unlock.',
        actionText: 'Upgrade to Gold',
      });
      return;
    }
    setListingAudioStay(stay);
  };

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

  // Black Friday & AirBus Escapes Host Controls State
  const [bfStayModal, setBfStayModal] = useState<Stay | null>(null);
  const [bfOptIn, setBfOptIn] = useState<boolean>(true);
  const [bfDiscountPercent, setBfDiscountPercent] = useState<number>(50);
  const [bfSaving, setBfSaving] = useState<boolean>(false);

  const [escapeStayModal, setEscapeStayModal] = useState<Stay | null>(null);
  const [escapeActive, setEscapeActive] = useState<boolean>(true);
  const [escapeTitle, setEscapeTitle] = useState<string>('');
  const [escapeDiscountPct, setEscapeDiscountPct] = useState<number>(25);
  const [escapeValidFrom, setEscapeValidFrom] = useState<string>('');
  const [escapeValidTo, setEscapeValidTo] = useState<string>('');
  const [escapeSaving, setEscapeSaving] = useState<boolean>(false);

  // New Stay Wizard State
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [lat, setLat] = useState<number>(-1.2683);
  const [lng, setLng] = useState<number>(36.8044);
  const [rooms, setRooms] = useState(2);
  const [nights, setNights] = useState<number>(1);
  const [price, setPrice] = useState(7500);
  const [desc, setDesc] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['WiFi', 'Parking', 'Kitchen']);

  // Geocoding & AI Short Prompt State
  const [geocoding, setGeocoding] = useState<boolean>(false);
  const [aiShortPromptStay, setAiShortPromptStay] = useState<Stay | null>(null);
  const [generatingAiShort, setGeneratingAiShort] = useState<boolean>(false);

  const handleAutoDetectCoordinates = async () => {
    const query = area || landmark || 'Nairobi';
    setGeocoding(true);
    try {
      const res = await api.geocode(query);
      if (res && res.lat !== undefined && res.lng !== undefined) {
        setLat(res.lat);
        setLng(res.lng);
        showToast?.(`📍 Coordinates detected for ${query}: ${res.lat.toFixed(4)}, ${res.lng.toFixed(4)}`);
      }
    } catch (err: any) {
      setWizardError(err.message || 'Auto-detect coordinates failed.');
    } finally {
      setGeocoding(false);
    }
  };

  // Media Mode & Photos States (Video only, Photos only, or Both)
  const [mediaMode, setMediaMode] = useState<'both' | 'video' | 'photos'>('both');
  const [wizardPhotos, setWizardPhotos] = useState<{ url: string; order: number; isCover: boolean }[]>([
    {
      url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      order: 0,
      isCover: true,
    },
  ]);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const photoFileInputRef = useRef<HTMLInputElement>(null);

  // Manage Media Modal for Existing Listings
  const [manageMediaStay, setManageMediaStay] = useState<Stay | null>(null);
  const [manageMediaVideoUrl, setManageMediaVideoUrl] = useState('');
  const [manageMediaPhotos, setManageMediaPhotos] = useState<{ url: string; order: number; isCover: boolean }[]>([]);
  const [manageMediaSaving, setManageMediaSaving] = useState(false);
  const [manageMediaError, setManageMediaError] = useState<string | null>(null);
  const [manageMediaSuccess, setManageMediaSuccess] = useState<string | null>(null);
  const [managePhotoUrlInput, setManagePhotoUrlInput] = useState('');

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

  // Instalments (Mdogo Mdogo) & Deposit Model States
  const [instalmentsAccepted, setInstalmentsAccepted] = useState(false);
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositAmount, setDepositAmount] = useState(5000);
  const [depositReason, setDepositReason] = useState('Security against property damage or lost keys');
  const [depositRefundTerms, setDepositRefundTerms] = useState('Inspected and refunded directly to guest via M-Pesa within 2 hours of checkout');

  // Subscription Gate Modal before adding listing
  const [gateModal, setGateModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionText: string;
  } | null>(null);

  const handleAddListingClick = () => {
    // 1. Check whether owner has an ACTIVE subscription
    if (!isPlanActive) {
      setGateModal({
        isOpen: true,
        title: 'Active Subscription Required',
        message: 'To add a listing, you must have an active subscription. Please subscribe to Silver, Diamond, or Gold to publish listings on AirBus.',
        actionText: 'Pay for Subscription',
      });
      return;
    }

    // 2. Enforce subscription tier limits
    const maxLimit = PLANS[plan.tier]?.l || 3;
    if (myStays.length >= maxLimit) {
      setGateModal({
        isOpen: true,
        title: 'Listing Limit Reached',
        message: `Your current ${plan.tier} Plan allows up to ${maxLimit} listings. You currently have ${myStays.length} active listings. Please upgrade your subscription to add more listings.`,
        actionText: 'Upgrade Subscription',
      });
      return;
    }

    // Allowed: continue to the listing form
    setStep(1);
    setActiveTab('new-stay');
  };

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

    if (lat === undefined || lng === undefined || isNaN(Number(lat)) || isNaN(Number(lng))) {
      setWizardError('Latitude and Longitude coordinates are strictly mandatory to pin your stay on the AirBus discovery map.');
      return;
    }

    const cleanWhatsapp = whatsapp ? whatsapp.trim().replace(/\s+/g, '') : '';
    if (!cleanWhatsapp || !/^\+[1-9]\d{7,14}$/.test(cleanWhatsapp)) {
      setWizardError('Host WhatsApp number is required in E.164 international format (e.g. +254712345678) so guests can chat with you.');
      return;
    }

    const hasVideoInput = Boolean(videoUrl || youtubeVideoId);
    const hasPhotosInput = wizardPhotos.length > 0;

    if (!hasVideoInput && !hasPhotosInput) {
      setWizardError('At least one media type is required (one video tour or at least one photo). Please upload media before submitting.');
      return;
    }

    if (wizardPhotos.length > 30) {
      setWizardError('A maximum of 30 photos is allowed per listing.');
      return;
    }

    setCreatingStay(true);
    try {
      const coverPhoto = wizardPhotos.find(p => p.isCover) || wizardPhotos[0];
      const thumb = youtubeVideoId
        ? getYouTubeThumbnailUrl(youtubeVideoId)
        : (coverPhoto?.url || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80');

      const fullVideoUrl = youtubeVideoId
        ? `https://www.youtube.com/watch?v=${youtubeVideoId}`
        : (videoUrl || '');

      const mediaPayload = {
        video: hasVideoInput ? {
          url: fullVideoUrl,
          thumbnail: thumb,
          duration: 60,
          size: videoFile ? videoFile.size : 15000000,
        } : null,
        photos: wizardPhotos.map((p, idx) => ({
          url: p.url,
          order: idx,
          isCover: p.isCover ?? idx === 0,
        })),
      };

      const createdStay = await onCreateStay({
        title,
        location: `${area} · near ${landmark || 'Central'}`,
        lat: Number(lat),
        lng: Number(lng),
        price: Number(price),
        nights: Number(nights) || 1,
        type: rooms === 1 ? 'Studio' : rooms > 3 ? 'Villa' : 'Apartment',
        guests: rooms * 2,
        beds: rooms,
        area: rooms * 35,
        features: selectedFeatures,
        highlights: aiHighlights,
        description: desc,
        videoUrl: fullVideoUrl,
        youtubeUrl: youtubeVideoId ? youtubeInput : undefined,
        youtubeVideoId: youtubeVideoId || undefined,
        thumbnailUrl: thumb,
        images: wizardPhotos.map(p => p.url),
        media: mediaPayload,
        hasVideo: hasVideoInput,
        hasPhotos: hasPhotosInput,
        whatsapp: whatsapp || '',
        affiliateLink: affiliateLink || '',
        minNights: 1,
        welcomeGifts: welcomeGifts.length > 0 ? welcomeGifts : ['Kenyan Safari Kahawa & Fresh Ground Beans'],
        hostMessage: hostMessage.trim() || 'Karibu sana! We look forward to hosting you.',
        instalmentsAccepted,
        depositRequired,
        depositAmount: depositRequired ? Number(depositAmount) : undefined,
        depositReason: depositRequired ? depositReason : undefined,
        depositRefundTerms: depositRequired ? depositRefundTerms : undefined,
      });

      if (createdStay && createdStay.id) {
        if (autoCreateShortOnUpload && isPlanActive && tierRules.shorts_per_listing > 0) {
          (async () => {
            try {
              let sourceType: 'video' | 'photo' = 'photo';
              let mediaFiles: string[] = wizardPhotos.map(p => p.url).filter(Boolean);

              if (videoFile && mediaMode !== 'photos') {
                const dataUrl = await fileToDataUrl(videoFile);
                const uploaded = await api.uploadShortMedia([dataUrl], 'video');
                sourceType = 'video';
                mediaFiles = uploaded.urls;
              } else if (fullVideoUrl && !youtubeVideoId && !fullVideoUrl.startsWith('blob:') && mediaMode !== 'photos') {
                sourceType = 'video';
                mediaFiles = [fullVideoUrl];
              }

              if (mediaFiles.length > 0) {
                const jobRes = await api.createShortJob({
                  stayId: createdStay.id,
                  sourceType,
                  sourceFiles: mediaFiles,
                  caption: `${title} · ${area} — ${desc?.slice(0, 110) || 'Book directly on AirBus'}`,
                  hashtags: ['#AirBusStays', `#${area.replace(/[^a-zA-Z0-9]/g, '') || 'Kenya'}`, '#TravelKenya'],
                  autoCaptionsEnabled: autoShortCaptions,
                  reviewBeforePosting: autoShortReviewBeforePosting,
                  audioConfig: {
                    mode: 'none',
                    audioStartSec: 0,
                    originalVolume: 100,
                    musicVolume: 0,
                    voiceOverVolume: 0,
                    autoDuckMusic: false,
                  },
                  idempotencyKey: `stay_auto_${createdStay.id}`,
                });
                setMyShortJobs(prev => [jobRes.job, ...prev]);
                showToast?.('Auto-creating your 9:16 Short in the background!');
              }
            } catch (shortErr: any) {
              console.warn('Auto Short creation failed:', shortErr);
            }
          })();
        }
      }

      // Reset wizard
      setTitle('');
      setArea('');
      setLandmark('');
      setLat(-1.2683);
      setLng(36.8044);
      setRooms(2);
      setNights(1);
      setVideoFile(null);
      setVideoPreviewUrl('');
      setVideoUrl('');
      setYoutubeInput('');
      setYoutubeVideoId(null);
      setWelcomeGifts(['Kenyan Safari Kahawa & Fresh Ground Beans', 'Fresh Coconut Water & Tropical Basket']);
      setHostMessage('Karibu sana! We look forward to hosting you in our serene home.');
      setInstalmentsAccepted(false);
      setDepositRequired(false);
      setDepositAmount(5000);
      setDepositReason('Security against property damage or lost keys');
      setDepositRefundTerms('Inspected and refunded directly to guest via M-Pesa within 2 hours of checkout');
      setStep(1);
      setActiveTab('listings');
    } catch (err: any) {
      setWizardError(err.message || 'Failed to publish stay.');
    } finally {
      setCreatingStay(false);
    }
  };

  const handleAddWizardPhotoUrl = () => {
    const url = photoUrlInput.trim();
    if (!url) return;
    if (wizardPhotos.length >= 30) {
      setWizardError('Maximum 30 photos allowed.');
      return;
    }
    setWizardPhotos(prev => [
      ...prev,
      { url, order: prev.length, isCover: prev.length === 0 }
    ]);
    setPhotoUrlInput('');
  };

  const handleRemoveWizardPhoto = (index: number) => {
    setWizardPhotos(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((p, i) => ({
        ...p,
        order: i,
        isCover: i === 0 ? true : p.isCover && !filtered[0]?.isCover ? false : p.isCover,
      }));
    });
  };

  const handleSetWizardCover = (index: number) => {
    setWizardPhotos(prev =>
      prev.map((p, i) => ({
        ...p,
        isCover: i === index,
      }))
    );
  };

  const handleMoveWizardPhoto = (index: number, direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= wizardPhotos.length) return;
    setWizardPhotos(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[newIndex];
      copy[newIndex] = temp;
      return copy.map((p, i) => ({ ...p, order: i }));
    });
  };

  const openManageMediaModal = (stay: Stay) => {
    setManageMediaStay(stay);
    setManageMediaVideoUrl(stay.media?.video?.url || stay.videoUrl || '');
    const photos: { url: string; order: number; isCover: boolean }[] = [];
    if (stay.media?.photos && stay.media.photos.length > 0) {
      photos.push(...stay.media.photos.map((p, idx) => ({ url: p.url, order: idx, isCover: Boolean(p.isCover) })));
    } else if (stay.images && stay.images.length > 0) {
      photos.push(...stay.images.map((url, idx) => ({ url, order: idx, isCover: idx === 0 })));
    } else if (stay.thumbnailUrl) {
      photos.push({ url: stay.thumbnailUrl, order: 0, isCover: true });
    }
    setManageMediaPhotos(photos);
    setManageMediaError(null);
    setManageMediaSuccess(null);
  };

  const handleSaveManageMedia = async () => {
    if (!manageMediaStay) return;
    const hasVideo = Boolean(manageMediaVideoUrl.trim());
    const hasPhotos = manageMediaPhotos.length > 0;
    if (!hasVideo && !hasPhotos) {
      setManageMediaError('At least one media item (video or photo) is required for every listing.');
      return;
    }
    if (manageMediaPhotos.length > 30) {
      setManageMediaError('Maximum 30 photos allowed.');
      return;
    }
    setManageMediaSaving(true);
    setManageMediaError(null);
    try {
      const cover = manageMediaPhotos.find(p => p.isCover) || manageMediaPhotos[0];
      const thumb = cover?.url || manageMediaStay.thumbnailUrl || '';
      const mediaPayload = {
        video: hasVideo ? {
          url: manageMediaVideoUrl.trim(),
          thumbnail: thumb,
          duration: 60,
          size: 15000000,
        } : null,
        photos: manageMediaPhotos.map((p, i) => ({ url: p.url, order: i, isCover: p.isCover ?? i === 0 })),
      };

      await onUpdateStay(manageMediaStay.id, {
        media: mediaPayload,
        images: manageMediaPhotos.map(p => p.url),
        videoUrl: hasVideo ? manageMediaVideoUrl.trim() : '',
        thumbnailUrl: thumb,
        hasVideo,
        hasPhotos,
      });

      setManageMediaSuccess('Listing media updated successfully!');
      setTimeout(() => {
        setManageMediaStay(null);
      }, 1200);
    } catch (err: any) {
      setManageMediaError(err.message || 'Failed to update media.');
    } finally {
      setManageMediaSaving(false);
    }
  };

  const handleBoostListing = async () => {
    if (!selectedStayIdForPromo) {
      setPromoFeedback({ type: 'error', msg: 'Please select a listing to boost.' });
      return;
    }
    const costSc = promoDays === 30 ? 300 : promoDays * 10;

    if (promoPaymentMethod === 'wallet' && walletBalance < costSc) {
      setPromoFeedback({
        type: 'error',
        msg: 'Not enough SC. Top up your wallet or pay with M-Pesa',
      });
      return;
    }

    if (promoPaymentMethod === 'mpesa') {
      const cleanCode = promoMpesaCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{10}$/.test(cleanCode)) {
        setPromoFeedback({
          type: 'error',
          msg: 'Please enter a valid 10-character M-Pesa transaction receipt code (e.g. QGH7X2K9LM).',
        });
        return;
      }
    }

    setPromoLoading(true);
    setPromoFeedback(null);
    try {
      const res = await api.purchasePromotion(
        selectedStayIdForPromo,
        promoDays,
        promoPaymentMethod,
        promoPaymentMethod === 'mpesa' ? promoMpesaCode.trim().toUpperCase() : undefined
      );
      setPromoFeedback({
        type: 'success',
        msg: res.message || 'Boost submitted. It goes live once the admin approves.',
      });
      setPromoMpesaCode('');
      fetchPromotions();
    } catch (err: any) {
      setPromoFeedback({ type: 'error', msg: err.message || 'Boost submission failed.' });
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
                To add listings and keep short stays visible in search, an active subscription (Silver KES 1,000, Diamond KES 2,500, or Gold KES 5,000) is required.
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
              onClick={handleAddListingClick}
              className="bg-[#e4002b] hover:bg-[#c90026] text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Listing</span>
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
                <div className="text-[10px] text-stone-400 mt-0.5">
                  Limit: {PLANS[plan.tier]?.l || 3} listings ({myStays.length} active)
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

        {/* Subscription Disclaimer */}
        <div className="mt-4 p-3.5 rounded-2xl bg-white/5 border border-white/10 text-[11px] text-stone-300 leading-relaxed">
          <span className="font-bold text-white">Subscription Disclaimer: </span>
          If your subscription expires, your contact details will be hidden and guests will not be able to book your short stays until you renew. If your subscription stays inactive for 3 consecutive months, your listings will be delisted from the platform.
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
          onClick={() => setActiveTab('shorts')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'shorts'
              ? 'bg-[#e4002b] text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Video className="w-4 h-4 text-rose-500" />
          <span>Shorts &amp; Reels ({myShortsPosts.length})</span>
          {myShortJobs.some(j => j.state === 'queued' || j.state === 'processing') && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        <button
          onClick={handleAddListingClick}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'new-stay'
              ? 'bg-[#e4002b] text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Add Listing</span>
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
                onClick={handleAddListingClick}
                className="px-5 py-2.5 bg-[#e4002b] text-white rounded-full text-xs font-bold hover:bg-[#c90026] cursor-pointer"
              >
                Add Listing
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
                          onClick={() => openManageMediaModal(s)}
                          className="px-3 py-1.5 rounded-full text-xs font-bold border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Manage listing video tour, photos & Auto-Create Shorts"
                        >
                          <Film className="w-3.5 h-3.5 text-rose-600" />
                          <span>Media ({s.hasVideo ? 'Video' : ''}{s.hasVideo && s.hasPhotos ? ' + ' : ''}{s.hasPhotos ? `${s.media?.photos?.length || s.images?.length || 1} Photos` : !s.hasVideo ? 'None' : ''})</span>
                        </button>

                        <button
                          onClick={() => handleOpenListingAudio(s)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                            s.listingAudio && s.listingAudio.mode !== 'none'
                              ? 'bg-amber-500/15 border-amber-400 text-amber-700 dark:text-amber-300'
                              : tierRules.listing_audio_enabled
                              ? 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                              : 'border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900 text-stone-400'
                          }`}
                          title={
                            tierRules.listing_audio_enabled
                              ? 'Add optional music or voice-over to this listing page (Gold)'
                              : 'Gold Plan required for Listing Page Audio'
                          }
                        >
                          {tierRules.listing_audio_enabled ? (
                            <Music className="w-3.5 h-3.5 text-amber-500" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-stone-400" />
                          )}
                          <span>
                            {s.listingAudio && s.listingAudio.mode !== 'none'
                              ? 'Listing Audio Active'
                              : tierRules.listing_audio_enabled
                              ? 'Listing Audio (Optional)'
                              : 'Listing Audio (Gold)'}
                          </span>
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
                          onClick={() => {
                            setBfStayModal(s);
                            setBfOptIn(!!s.blackFridayOptIn);
                            setBfDiscountPercent(s.blackFridayDiscountPercent || 45);
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                            s.blackFridayOptIn
                              ? 'bg-[#e4002b]/10 border-[#e4002b]/40 text-[#e4002b]'
                              : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                          }`}
                          title="Opt listing into quarterly AirBus Black Friday drops (up to 50% off)"
                        >
                          <Flame className="w-3.5 h-3.5 text-[#e4002b]" />
                          <span>
                            {s.blackFridayOptIn
                              ? `Black Friday (${s.blackFridayDiscountPercent || 50}% off)`
                              : 'Black Friday Opt-In'}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            const today = new Date().toISOString().slice(0, 10);
                            const twoWeeks = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
                            setEscapeStayModal(s);
                            setEscapeActive(!!s.isEscapeOffer);
                            setEscapeTitle(s.escapeOfferTitle || 'Weekend Flash Escape');
                            setEscapeDiscountPct(s.escapeDiscountPercent || 25);
                            setEscapeValidFrom(s.escapeValidFrom || today);
                            setEscapeValidTo(s.escapeValidTo || twoWeeks);
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                            s.isEscapeOffer
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                              : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                          }`}
                          title="Create or edit an AirBus Escapes promotional deal"
                        >
                          <Compass className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            {s.isEscapeOffer
                              ? `Escapes Offer (-${s.escapeDiscountPercent || 20}%)`
                              : 'Escapes Offer'}
                          </span>
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

                    {/* Per-Listing Media Shorts Studio (Attached directly to each Video & Photo) */}
                    {(() => {
                      const quota = getListingQuotaInfo(s.id);
                      const directVideo = s.media?.video?.url || s.videoUrl;
                      const hasDirectVideo = Boolean(directVideo && !isYouTubeUrl(directVideo) && !directVideo.startsWith('blob:'));
                      const stayPhotos = Array.from(
                        new Set(
                          (
                            s.media?.photos?.map(p => p.url) ||
                            s.images ||
                            (s.thumbnailUrl ? [s.thumbnailUrl] : [])
                          ).filter(Boolean)
                        )
                      );
                      const stayShorts = myShortsPosts.filter(
                        p => (p.stayId === s.id || p.listing_id === s.id) && p.type === 'short'
                      );
                      const stayJobs = myShortJobs.filter(j => j.stayId === s.id);
                      const lockedNoTier = !isPlanActive || tierRules.shorts_per_listing <= 0;

                      return (
                        <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Video className="w-4 h-4 text-[#e4002b]" />
                              <span className="text-xs font-extrabold text-stone-900 dark:text-white">
                                Listing Shorts &amp; Audio
                              </span>
                              {lockedNoTier ? (
                                <button
                                  type="button"
                                  onClick={onOpenPlanModal}
                                  className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 cursor-pointer"
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>Upgrade to Gold or Diamond</span>
                                </button>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    quota.remaining > 0
                                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                  }`}
                                >
                                  Shorts used: {quota.used} of {quota.limit} ({plan.tier})
                                </span>
                              )}
                            </div>

                            {s.listingAudio && s.listingAudio.mode !== 'none' && (
                              <div className="flex items-center gap-2 text-[11px]">
                                <span className="text-amber-600 dark:text-amber-300 font-semibold flex items-center gap-1">
                                  <Music className="w-3 h-3" />
                                  {s.listingAudio.trackTitle || 'Listing Voice-Over'}
                                </span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await api.deleteListingAudio(s.id);
                                    onUpdateStay(s.id, { listingAudio: null, listingAudioLocked: false });
                                    showToast?.('Listing audio removed.');
                                  }}
                                  className="text-rose-500 font-bold hover:underline cursor-pointer"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>

                          {s.listingAudioLocked && (
                            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                              <span>Your saved listing audio is preserved cleanly, and is currently inactive until you upgrade back to Gold.</span>
                              <button
                                type="button"
                                onClick={onOpenPlanModal}
                                className="px-2.5 py-1 rounded-full bg-amber-500 text-black text-[10px] font-extrabold shrink-0 cursor-pointer"
                              >
                                Upgrade to Gold
                              </button>
                            </div>
                          )}

                          {/* Individual Videos & Photos with attached "Auto Create Short" action */}
                          <div className="flex flex-wrap gap-2.5">
                            {hasDirectVideo && directVideo && (
                              <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                                <div className="w-11 h-11 rounded-lg bg-black overflow-hidden relative shrink-0 flex items-center justify-center">
                                  {s.thumbnailUrl ? (
                                    <img src={s.thumbnailUrl} alt="Listing video" className="w-full h-full object-cover opacity-80" />
                                  ) : (
                                    <Film className="w-4 h-4 text-white" />
                                  )}
                                  <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[8px] font-bold px-1 rounded">
                                    VID
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200 block">
                                    Listing Video
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAutoCreateForMedia(s, 'video', [directVideo], 'Listing Video')}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 cursor-pointer ${
                                      lockedNoTier || quota.remaining <= 0
                                        ? 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                                        : 'bg-[#e4002b] hover:bg-[#c90026] text-white shadow-xs'
                                    }`}
                                  >
                                    {lockedNoTier ? <Lock className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                                    <span>Auto Create Short</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {stayPhotos.slice(0, 6).map((photoUrl, pIdx) => (
                              <div
                                key={`${s.id}_p_${pIdx}`}
                                className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                              >
                                <img
                                  src={photoUrl}
                                  alt={`Photo ${pIdx + 1}`}
                                  className="w-11 h-11 rounded-lg object-cover shrink-0 border border-stone-200 dark:border-stone-700"
                                />
                                <div className="space-y-1">
                                  <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200 block">
                                    Photo #{pIdx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAutoCreateForMedia(s, 'photo', [photoUrl], `Photo #${pIdx + 1}`)}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 cursor-pointer ${
                                      lockedNoTier || quota.remaining <= 0
                                        ? 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                                        : 'bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white shadow-xs'
                                    }`}
                                  >
                                    {lockedNoTier ? <Lock className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                                    <span>Auto Create Short</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Active Short Jobs or Published Shorts for this Listing */}
                          {(stayJobs.some(j => j.state === 'queued' || j.state === 'processing' || j.state === 'failed') ||
                            stayShorts.length > 0) && (
                            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-1.5">
                              {stayJobs
                                .filter(j => j.state === 'queued' || j.state === 'processing' || j.state === 'failed')
                                .map(job => (
                                  <div
                                    key={job.id}
                                    className="flex items-center justify-between gap-2 text-[11px] bg-white dark:bg-stone-800 px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700"
                                  >
                                    <span className="truncate font-semibold">
                                      Job ({job.state} · {job.progress}%): {job.stageLabel}
                                    </span>
                                    {job.state === 'failed' && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const r = await api.retryShortJob(job.id);
                                          setMyShortJobs(prev => prev.map(x => (x.id === job.id ? r.job : x)));
                                          showToast?.('Retrying Short creation...');
                                        }}
                                        className="px-2 py-0.5 rounded-full bg-[#e4002b] text-white text-[10px] font-bold cursor-pointer"
                                      >
                                        Retry
                                      </button>
                                    )}
                                  </div>
                                ))}

                              {stayShorts.map(post => {
                                const stats = shortsAnalyticsMap[post.id];
                                return (
                                  <div
                                    key={post.id}
                                    className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-white dark:bg-stone-800 px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700"
                                  >
                                    <span className="font-bold text-stone-800 dark:text-stone-200 truncate max-w-[200px]">
                                      Short: {post.caption || post.description || 'Short Reel'}
                                    </span>
                                    <div className="flex items-center gap-3 text-stone-500">
                                      <span>Plays: {stats?.plays ?? post.plays ?? 0}</span>
                                      <span>Replays: {stats?.replays ?? post.replays ?? 0}</span>
                                      <span>Clicks: {stats?.actionClicks ?? post.actionClicks ?? 0}</span>
                                      {onNavigateToShorts && (
                                        <button
                                          type="button"
                                          onClick={onNavigateToShorts}
                                          className="text-[#e4002b] font-bold hover:underline cursor-pointer"
                                        >
                                          Watch
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteShort(post.id)}
                                        className="text-rose-500 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

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
                className={`p-4 rounded-2xl text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  promoFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {promoFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                  <span>{promoFeedback.msg}</span>
                </div>
                {promoFeedback.msg === 'Not enough SC. Top up your wallet or pay with M-Pesa' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={onOpenTopupModal}
                      className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Top Up Wallet
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromoPaymentMethod('mpesa')}
                      className="px-3 py-1.5 rounded-full bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 font-bold text-[11px] cursor-pointer"
                    >
                      Pay with M-Pesa
                    </button>
                  </div>
                )}
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
                  2. Choose Boost Duration (10 SC / day = KES 100/day)
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { days: 1, label: '1 Day', sc: 10, kes: 100 },
                    { days: 3, label: '3 Days', sc: 30, kes: 300 },
                    { days: 7, label: '7 Days', sc: 70, kes: 700 },
                    { days: 14, label: '14 Days', sc: 140, kes: 1400 },
                    { days: 30, label: '30 Days', sc: 300, kes: 3000 },
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
                      <span className="text-[10px] opacity-80 font-mono block">{opt.sc} SC</span>
                      <span className="text-[9px] opacity-60 font-mono block">KES {opt.kes}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-3">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
                3. Select Payment Method
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPromoPaymentMethod('wallet')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                    promoPaymentMethod === 'wallet'
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-900 dark:text-amber-200'
                      : 'bg-white dark:bg-[#15171e] border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <Wallet className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">AirBus Wallet</div>
                    <div className="text-[11px] text-stone-500">
                      Balance: <span className="font-mono font-bold text-stone-900 dark:text-white">{walletBalance} SC</span> (KES {(walletBalance * 10).toLocaleString()})
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPromoPaymentMethod('mpesa')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                    promoPaymentMethod === 'mpesa'
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-900 dark:text-amber-200'
                      : 'bg-white dark:bg-[#15171e] border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <CreditCard className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">M-Pesa Manual Paybill / Till</div>
                    <div className="text-[11px] text-stone-500">Till 987654 / Paybill 222111</div>
                  </div>
                </button>
              </div>

              {promoPaymentMethod === 'mpesa' && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    <p className="font-bold">M-Pesa Payment Instructions:</p>
                    <p>1. Go to M-Pesa &gt; Lipa na M-Pesa &gt; Buy Goods: <span className="font-mono font-black text-stone-900 dark:text-white">Till 987654</span> (or Paybill <span className="font-mono font-black">222111</span>, Acct: <span className="font-mono font-black">BOOST-{selectedStayIdForPromo.slice(-4).toUpperCase()}</span>)</p>
                    <p>2. Enter Amount: <span className="font-mono font-black text-stone-900 dark:text-white">KES {((promoDays === 30 ? 300 : promoDays * 10) * 10).toLocaleString()}</span></p>
                    <p>3. Enter your M-Pesa PIN and paste the 10-character confirmation code below:</p>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      M-Pesa 10-Character Receipt Code *
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={promoMpesaCode}
                      onChange={e => setPromoMpesaCode(e.target.value.toUpperCase())}
                      placeholder="e.g. QGH7X2K9LM"
                      className="w-full sm:w-64 px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-mono font-bold uppercase tracking-wider outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs text-stone-500 block">Total Campaign Cost:</span>
                <div className="text-lg font-black text-stone-900 dark:text-white">
                  {promoDays === 30 ? 300 : promoDays * 10} SC{' '}
                  <span className="text-xs font-normal text-stone-500">
                    (KES {((promoDays === 30 ? 300 : promoDays * 10) * 10).toLocaleString()} • {promoDays} days boost)
                  </span>
                </div>
              </div>

              <button
                onClick={handleBoostListing}
                disabled={promoLoading || myStays.length === 0}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-95 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Rocket className="w-4 h-4" />
                <span>
                  {promoLoading
                    ? 'Submitting Boost...'
                    : `Activate Boost for KES ${((promoDays === 30 ? 300 : promoDays * 10) * 10).toLocaleString()} (${promoDays === 30 ? 300 : promoDays * 10} SC)`}
                </span>
              </button>
            </div>
          </div>

          {/* Campaigns History & Live Performance Table */}
          <div className="p-6 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-stone-900 dark:text-white">
                Active &amp; Past Boost Campaigns ({boostCampaigns.length > 0 ? boostCampaigns.length : promotions.length})
              </h4>
              <button
                onClick={fetchPromotions}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 cursor-pointer flex items-center gap-1"
              >
                <span>Refresh</span>
              </button>
            </div>

            {boostCampaigns.length === 0 && promotions.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl text-xs text-stone-400">
                No boost campaigns launched yet. Choose a listing above to get top-of-feed placement and increase your bookings!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead className="border-b border-stone-200 dark:border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                    <tr>
                      <th className="py-2.5 px-3">Listing</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Cost</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Days Left</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {boostCampaigns.length > 0
                      ? boostCampaigns.map(b => {
                          const stay = myStays.find(s => s.id === (b.listing_id || b.listingId));
                          const isStillActive = b.status === 'active' && Boolean(b.ends_at && b.ends_at > Date.now());
                          const daysLeft = b.ends_at ? Math.max(0, Math.ceil((b.ends_at - Date.now()) / 864e5)) : 0;
                          return (
                            <tr key={b.id} className="hover:bg-stone-50 dark:hover:bg-stone-900/50">
                              <td className="py-3 px-3 font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                <span>🚀</span>
                                <span className="truncate max-w-[200px]">{stay?.title || `Stay #${b.listing_id || b.listingId}`}</span>
                              </td>
                              <td className="py-3 px-3">{b.days} Days</td>
                              <td className="py-3 px-3 font-mono font-bold">
                                {b.cost_sc || b.costSc || 70} SC{' '}
                                <span className="text-[10px] text-stone-400 font-normal">
                                  (KES {((b.cost_sc || b.costSc || 70) * 10).toLocaleString()})
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                    b.status === 'active' && isStillActive
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : b.status === 'pending'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                      : b.status === 'rejected'
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                      : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                                  }`}
                                >
                                  {b.status === 'pending'
                                    ? 'Pending Approval'
                                    : b.status === 'active' && isStillActive
                                    ? 'Active Boost 🚀'
                                    : b.status === 'rejected'
                                    ? 'Declined'
                                    : 'Expired'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-stone-500 font-semibold">
                                {b.status === 'pending'
                                  ? 'Awaiting review'
                                  : isStillActive
                                  ? `${daysLeft} days`
                                  : 'Completed'}
                              </td>
                            </tr>
                          );
                        })
                      : promotions.map(p => {
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

      {/* TAB: CREATOR SHORTS & REELS STUDIO (Per-Listing Jobs & Published Shorts Overview) */}
      {activeTab === 'shorts' && (
        <div className="space-y-6">
          <div className="p-5 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-[#e4002b]" />
                <span>Host Shorts Studio ({plan.tier} Tier)</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {tierRules.shorts_per_listing > 0
                  ? `You can auto-create up to ${tierRules.shorts_per_listing} Short${tierRules.shorts_per_listing > 1 ? 's' : ''} per listing directly from any listing's video or photos in My Stays.`
                  : 'Upgrade to Diamond (1 Short/listing) or Gold (5 Shorts/listing) to unlock Auto-Create Shorts on your listings.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onNavigateToShorts && (
                <button
                  type="button"
                  onClick={onNavigateToShorts}
                  className="px-4 py-2 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  Watch Public Shorts Feed
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('listings')}
                className="px-4 py-2 rounded-full bg-[#e4002b] hover:bg-[#c90026] text-white text-xs font-bold shadow cursor-pointer flex items-center gap-1.5"
              >
                <Film className="w-4 h-4" />
                <span>Create from Listing Media</span>
              </button>
            </div>
          </div>

          {/* Background Jobs Queue */}
          {myShortJobs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-stone-900 dark:text-white">
                  Background Creation Jobs ({myShortJobs.length})
                </h3>
                <button
                  type="button"
                  onClick={loadCreatorShorts}
                  className="text-xs font-bold text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingShorts ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {myShortJobs.map(job => (
                  <div
                    key={job.id}
                    className="p-4 rounded-2xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          job.state === 'ready'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : job.state === 'failed'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {job.state === 'ready'
                          ? job.publishedPostId && job.reviewBeforePosting
                            ? 'Draft / Ready'
                            : 'Ready & Published'
                          : job.state}
                      </span>
                      <span className="text-[11px] font-mono text-stone-400">
                        {job.sourceType.toUpperCase()} · {job.progress}%
                      </span>
                    </div>

                    <p className="text-xs font-bold text-stone-900 dark:text-white line-clamp-2">
                      {job.caption}
                    </p>

                    <div className="w-full h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          job.state === 'failed' ? 'bg-rose-500' : 'bg-[#e4002b]'
                        }`}
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                      <span className="truncate flex items-center gap-1">
                        <Music className="w-3 h-3 text-[#e4002b]" />
                        {job.audioConfig?.trackTitle || 'Auto-assigned soundtrack'}
                      </span>
                      <span className="shrink-0">{job.stageLabel}</span>
                    </div>

                    {job.errorMessage && (
                      <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px]">
                        {job.errorMessage}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      {job.state === 'failed' && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await api.retryShortJob(job.id);
                              setMyShortJobs(prev => prev.map(item => (item.id === job.id ? res.job : item)));
                              showToast?.('Retrying Short creation in background...');
                            } catch (err: any) {
                              showToast?.(err.message || 'Retry failed');
                            }
                          }}
                          className="px-3 py-1.5 rounded-full bg-[#e4002b] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                      )}
                      {job.state === 'ready' && job.reviewBeforePosting && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await api.publishDraftShort(job.id);
                              showToast?.('Short published to Shorts & Reels!');
                              setMyShortsPosts(prev => [res.post, ...prev.filter(p => p.id !== res.post.id)]);
                              loadCreatorShorts();
                            } catch (err: any) {
                              showToast?.(err.message || 'Failed to publish draft');
                            }
                          }}
                          className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirm &amp; Publish</span>
                        </button>
                      )}
                      {job.state === 'ready' && job.outputVideoUrl && onNavigateToShorts && (
                        <button
                          type="button"
                          onClick={onNavigateToShorts}
                          className="px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-bold ml-auto cursor-pointer"
                        >
                          Watch in Shorts
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Published Shorts Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-stone-900 dark:text-white">
              Published Shorts &amp; Reels ({myShortsPosts.length})
            </h3>
            {myShortsPosts.length === 0 ? (
              <div className="p-10 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 space-y-3">
                <Video className="w-10 h-10 text-stone-400 mx-auto" />
                <p className="text-xs text-stone-500">
                  No Shorts published yet. Open any listing in My Stays and click Auto Create Short beside its video or photos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myShortsPosts.map(post => {
                  const linkedStay = myStays.find(st => st.id === (post.stayId || post.listing_id));
                  const stats = shortsAnalyticsMap[post.id];
                  return (
                    <div
                      key={post.id}
                      className="rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs flex flex-col"
                    >
                      <div className="relative aspect-[9/16] max-h-80 bg-black overflow-hidden">
                        {post.videoUrl ? (
                          <video
                            src={post.videoUrl}
                            poster={post.coverUrl}
                            controls
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={post.coverUrl || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80'}
                            alt={post.caption || post.description}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-bold uppercase">
                          {post.sourceType || 'video'} · {post.status || 'approved'}
                        </span>
                      </div>
                      <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                        <div>
                          {linkedStay && (
                            <span className="text-[10px] font-extrabold text-[#e4002b] block truncate mb-0.5">
                              Listing: {linkedStay.title}
                            </span>
                          )}
                          <p className="text-xs font-bold text-stone-900 dark:text-white line-clamp-2">
                            {post.caption || post.description}
                          </p>
                          {post.shortAudio && post.shortAudio.mode !== 'none' && (post.shortAudio.trackTitle || post.shortAudio.voiceOverUrl) && (
                            <div className="text-[11px] text-[#e4002b] font-semibold mt-1 flex items-center gap-1 truncate">
                              <Music className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                Audio: {post.shortAudio.trackTitle || 'Host Voice-Over'}
                                {post.shortAudio.trackArtist ? ` - ${post.shortAudio.trackArtist}` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800 text-[11px] text-stone-500">
                          <span className="flex items-center gap-2.5">
                            <span title="Views" className="flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> {stats?.views ?? post.views ?? 0}
                            </span>
                            <span title="Replays" className="flex items-center gap-1">
                              <RefreshCw className="w-3 h-3" /> {stats?.replays ?? post.replays ?? 0}
                            </span>
                            <span title="Listing Clicks" className="font-semibold">
                              {stats?.actionClicks ?? post.actionClicks ?? 0} clicks
                            </span>
                          </span>
                          <div className="flex items-center gap-2">
                            {onNavigateToShorts && (
                              <button
                                type="button"
                                onClick={onNavigateToShorts}
                                className="font-bold text-[#e4002b] hover:underline cursor-pointer"
                              >
                                Feed →
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteShort(post.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full cursor-pointer"
                              title="Delete Short and free listing slot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: UPLOAD VIDEO STAY WIZARD */}
      {activeTab === 'new-stay' && !isPlanActive && (
        <div className="max-w-xl mx-auto bg-white dark:bg-[#15171e] p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-stone-900 dark:text-white">Active Subscription Required</h2>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            Hosts must have an active 30-day host subscription (Silver, Diamond, or Gold) before listing a property on AirBus.
          </p>
          <button
            type="button"
            onClick={onOpenPlanModal}
            className="px-6 py-2.5 rounded-full bg-[#e4002b] text-white text-xs font-bold shadow-md hover:bg-[#c90026] transition-all cursor-pointer"
          >
            Choose a Plan
          </button>
        </div>
      )}

      {activeTab === 'new-stay' && isPlanActive && (
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

                {/* Mandatory Latitude and Longitude with Presets */}
                <div className="p-3.5 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#e4002b]" />
                      <span>GPS Coordinates (Mandatory for Discovery Map) *</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAutoDetectCoordinates}
                        disabled={geocoding}
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#e4002b]/10 text-[#e4002b] hover:bg-[#e4002b]/20 border border-[#e4002b]/30 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        title="Auto-detect GPS latitude and longitude based on area or landmark"
                      >
                        <span>{geocoding ? 'Detecting...' : '📍 Auto-Detect Coordinates'}</span>
                      </button>
                      <span className="text-[10px] font-mono text-stone-500 bg-stone-200 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                        {lat.toFixed(4)}, {lng.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-semibold text-stone-500 block mb-1">Latitude</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={lat}
                        onChange={e => setLat(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-mono outline-none focus:border-[#e4002b]"
                        required
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-stone-500 block mb-1">Longitude</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={lng}
                        onChange={e => setLng(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-mono outline-none focus:border-[#e4002b]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-stone-500 block mb-1 uppercase tracking-wider">Quick Kenyan City Presets:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { name: 'Westlands', lat: -1.2683, lng: 36.8044 },
                        { name: 'Kilimani', lat: -1.2982, lng: 36.7907 },
                        { name: 'Karen', lat: -1.3197, lng: 36.7065 },
                        { name: 'Nairobi CBD', lat: -1.2864, lng: 36.8172 },
                        { name: 'Diani Beach', lat: -4.2796, lng: 39.5947 },
                        { name: 'Nyali, Mombasa', lat: -4.0326, lng: 39.6991 },
                        { name: 'Naivasha', lat: -0.7172, lng: 36.4310 },
                        { name: 'Malindi', lat: -3.2192, lng: 40.1169 },
                        { name: 'Kisumu', lat: -0.0917, lng: 34.7680 },
                      ].map(preset => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setLat(preset.lat);
                            setLng(preset.lng);
                            if (!area) setArea(preset.name);
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border transition-all cursor-pointer ${
                            Math.abs(lat - preset.lat) < 0.001 && Math.abs(lng - preset.lng) < 0.001
                              ? 'bg-[#e4002b] text-white border-[#e4002b]'
                              : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-stone-400'
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                      Duration (Nights) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={nights}
                      onChange={e => setNights(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Rate for {nights} Night{nights > 1 ? 's' : ''} (KES) *
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

            {/* STEP 3: LISTING MEDIA (VIDEO TOUR / PHOTOS TOGGLE) & CONTACTS */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-[#e4002b] text-[10px] font-black uppercase tracking-wider">
                      Global Listing Media
                    </span>
                    <span className="text-[11px] text-stone-400 font-medium">
                      At least one media type is required
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">
                    Video Tour &amp; Photo Gallery
                  </h3>
                  <p className="text-xs text-stone-500">
                    Choose whether guests see a high-definition video tour only, a photo gallery only, or both with a seamless Video/Photos switch!
                  </p>
                </div>

                {/* Media Format Selector: Both, Video Only, or Photos Only */}
                <div className="grid grid-cols-3 gap-2 p-1.5 bg-stone-100 dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setMediaMode('both')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      mediaMode === 'both'
                        ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-sm border border-stone-200 dark:border-stone-700'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-[#e4002b]" />
                    <span>Both (Video &amp; Photos)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMediaMode('video')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      mediaMode === 'video'
                        ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-sm border border-stone-200 dark:border-stone-700'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    <Film className="w-4 h-4 text-[#ff2e93]" />
                    <span>Video Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMediaMode('photos')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      mediaMode === 'photos'
                        ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-sm border border-stone-200 dark:border-stone-700'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    <Images className="w-4 h-4 text-purple-500" />
                    <span>Photos Only</span>
                  </button>
                </div>

                {/* 1. PRIMARY VIDEO SECTION (Active if 'both' or 'video') */}
                {(mediaMode === 'both' || mediaMode === 'video') && (
                  <div className="p-5 rounded-3xl bg-stone-50/70 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-rose-500/10 text-[#e4002b] flex items-center justify-center">
                          <Film className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="text-xs font-extrabold text-stone-900 dark:text-white">
                            Primary Video Tour (MP4 / MOV / YouTube Shorts)
                          </h4>
                          <span className="text-[10px] text-stone-400">
                            Plays first in guest view when both media types are present
                          </span>
                        </div>
                      </div>

                      {/* Video Source Type Switcher */}
                      <div className="flex items-center gap-1 bg-white dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setVideoSourceType('upload')}
                          className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                            videoSourceType === 'upload' ? 'bg-[#e4002b] text-white' : 'text-stone-500'
                          }`}
                        >
                          Direct File
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoSourceType('youtube')}
                          className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                            videoSourceType === 'youtube' ? 'bg-[#ff0000] text-white' : 'text-stone-500'
                          }`}
                        >
                          YouTube Link
                        </button>
                      </div>
                    </div>

                    {videoSourceType === 'upload' && (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`p-6 border-2 border-dashed rounded-3xl text-center transition-all cursor-pointer ${
                          isDraggingVideo
                            ? 'border-[#e4002b] bg-rose-50/50 dark:bg-rose-950/20 scale-[1.01]'
                            : 'border-stone-300 dark:border-stone-700 hover:border-stone-400 bg-white dark:bg-stone-800/60'
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
                            <div className="flex items-center justify-center gap-3">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs text-[#e4002b] hover:underline font-semibold cursor-pointer"
                              >
                                Replace video
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setVideoFile(null);
                                  setVideoPreviewUrl('');
                                  setVideoUrl('');
                                }}
                                className="text-xs text-stone-500 hover:text-stone-700 font-semibold cursor-pointer"
                              >
                                Remove video
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 py-3">
                            <UploadCloud className="w-8 h-8 text-stone-400 mx-auto" />
                            <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
                              Drag &amp; drop tour video here or browse
                            </h4>
                            <p className="text-[11px] text-stone-400">
                              Supports MP4, MOV, WebM (under 50 MB, 60 seconds recommended)
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {videoSourceType === 'youtube' && (
                      <div className="space-y-3 p-4 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700">
                        <div>
                          <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                            YouTube or YouTube Shorts URL
                          </label>
                          <input
                            type="url"
                            value={youtubeInput}
                            onChange={e => handleYoutubeChange(e.target.value)}
                            placeholder="e.g. https://youtube.com/shorts/xyz or https://youtu.be/xyz"
                            className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#ff0000]"
                          />
                        </div>

                        {youtubeVideoId && (
                          <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-emerald-600">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" /> YouTube ID: {youtubeVideoId}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setYoutubeInput('');
                                  setYoutubeVideoId(null);
                                }}
                                className="text-stone-400 hover:text-rose-500 text-[11px]"
                              >
                                Clear
                              </button>
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
                  </div>
                )}

                {/* 2. PHOTO GALLERY SECTION (Active if 'both' or 'photos') */}
                {(mediaMode === 'both' || mediaMode === 'photos') && (
                  <div className="p-5 rounded-3xl bg-stone-50/70 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                          <Images className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="text-xs font-extrabold text-stone-900 dark:text-white">
                            Photo Gallery ({wizardPhotos.length} / 30 photos)
                          </h4>
                          <span className="text-[10px] text-stone-400">
                            High-res JPG, PNG, or WebP. Set any photo as the cover.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          ref={photoFileInputRef}
                          type="file"
                          multiple
                          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                          onChange={e => {
                            if (e.target.files) {
                              Array.from(e.target.files).forEach((file, idx) => {
                                if (wizardPhotos.length + idx >= 30) return;
                                const reader = new FileReader();
                                reader.onload = ev => {
                                  if (ev.target?.result) {
                                    setWizardPhotos(prev => [
                                      ...prev,
                                      {
                                        url: ev.target!.result as string,
                                        order: prev.length,
                                        isCover: prev.length === 0,
                                      },
                                    ]);
                                  }
                                };
                                reader.readAsDataURL(file);
                              });
                            }
                          }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => photoFileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Upload Photos</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick URL Input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={photoUrlInput}
                        onChange={e => setPhotoUrlInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddWizardPhotoUrl();
                          }
                        }}
                        placeholder="Paste image link (e.g. https://images.unsplash.com/...)"
                        className="flex-1 px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-purple-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddWizardPhotoUrl}
                        className="px-4 py-2 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 text-stone-800 dark:text-stone-200 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Add Photo
                      </button>
                    </div>

                    {/* Photos Grid with Reordering & Cover Selection */}
                    {wizardPhotos.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {wizardPhotos.map((photo, idx) => (
                          <div
                            key={idx}
                            className={`relative group rounded-2xl overflow-hidden aspect-square border-2 transition-all ${
                              photo.isCover
                                ? 'border-[#e4002b] shadow-md ring-2 ring-rose-500/30'
                                : 'border-stone-200 dark:border-stone-700'
                            }`}
                          >
                            <img
                              src={photo.url}
                              alt={`Stay photo ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />

                            {/* Cover Badge */}
                            {photo.isCover && (
                              <span className="absolute top-2 left-2 bg-[#e4002b] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow">
                                Cover Photo
                              </span>
                            )}

                            {/* Hover overlay controls */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveWizardPhoto(idx)}
                                  className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 cursor-pointer shadow"
                                  title="Remove photo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="flex items-center justify-between gap-1">
                                {!photo.isCover && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetWizardCover(idx)}
                                    className="px-2 py-1 bg-white/90 text-stone-900 rounded-lg text-[10px] font-bold hover:bg-white cursor-pointer shadow"
                                  >
                                    Set Cover
                                  </button>
                                )}
                                <div className="flex items-center gap-1 ml-auto">
                                  {idx > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleMoveWizardPhoto(idx, 'left')}
                                      className="w-6 h-6 rounded-lg bg-black/60 text-white flex items-center justify-center hover:bg-black cursor-pointer"
                                      title="Move Left"
                                    >
                                      <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {idx < wizardPhotos.length - 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleMoveWizardPhoto(idx, 'right')}
                                      className="w-6 h-6 rounded-lg bg-black/60 text-white flex items-center justify-center hover:bg-black cursor-pointer"
                                      title="Move Right"
                                    >
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-2xl text-xs text-stone-400">
                        No photos added yet. Upload files or paste links to populate your gallery.
                      </div>
                    )}
                  </div>
                )}

                {/* 3. INTERACTIVE LIVE GUEST PREVIEW */}
                <div className="p-5 rounded-3xl bg-stone-900 text-white border border-stone-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-stone-300">
                        Interactive Live Guest Preview
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-stone-400">
                      {mediaMode === 'both' ? 'Video Tour / Photos toggle enabled' : mediaMode === 'video' ? 'Video player only' : 'Photo gallery only'}
                    </span>
                  </div>

                  <div className="rounded-2xl overflow-hidden border border-stone-800 bg-black">
                    <ListingMediaViewer
                      media={{
                        video: (mediaMode === 'both' || mediaMode === 'video') && (videoUrl || youtubeVideoId) ? {
                          url: youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : (videoUrl || ''),
                          thumbnail: wizardPhotos[0]?.url || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
                          duration: 60,
                          size: 15000000,
                        } : null,
                        photos: (mediaMode === 'both' || mediaMode === 'photos') ? wizardPhotos : [],
                      }}
                      title={title || 'Stay Preview'}
                      aspectRatio="video"
                    />
                  </div>
                </div>

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

                {/* Complimentary Welcome Gifts & Guest Perks (10,000 Catalog) */}
                <ComplimentaryGiftsSelector
                  selectedGifts={welcomeGifts}
                  onChange={setWelcomeGifts}
                  maxSelection={3}
                  title="10,000 Complimentary Host Perks & Gifts Catalog"
                />

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

                {/* Optional "Pay in Instalments" (Mdogo Mdogo) Model */}
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 dark:text-white">
                        Accept payment in instalments (Mdogo Mdogo)
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Allow guests to split reservations into 2 or 3 instalments with a 10% premium. All instalments must be completed before check-in.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={instalmentsAccepted}
                        onChange={e => setInstalmentsAccepted(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#e4002b]"></div>
                    </label>
                  </div>
                </div>

                {/* Optional Security Deposit Model */}
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 dark:text-white">
                        Require a security/damage deposit
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Require guests to place a refundable security deposit paid directly to you at check-in.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={depositRequired}
                        onChange={e => setDepositRequired(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#e4002b]"></div>
                    </label>
                  </div>

                  {depositRequired && (
                    <div className="pt-2 space-y-3 border-t border-stone-200 dark:border-stone-800 animate-in fade-in duration-150">
                      <div>
                        <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300 block mb-1">
                          Deposit Amount (KES) *
                        </label>
                        <input
                          type="number"
                          min="500"
                          step="500"
                          value={depositAmount}
                          onChange={e => setDepositAmount(Number(e.target.value) || 0)}
                          className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300 block mb-1">
                          Deposit Reason *
                        </label>
                        <input
                          type="text"
                          value={depositReason}
                          onChange={e => setDepositReason(e.target.value)}
                          placeholder="e.g. Security against property damage, lost keycards, or smoking violations"
                          className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300 block mb-1">
                          Refund Terms *
                        </label>
                        <textarea
                          rows={2}
                          value={depositRefundTerms}
                          onChange={e => setDepositRefundTerms(e.target.value)}
                          placeholder="e.g. Property is inspected at checkout; deposit is refunded in full directly to guest via M-Pesa within 2 hours of departure."
                          className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                          required
                        />
                      </div>

                      {/* Explicit Platform Disclaimer */}
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
                        <strong>Platform Disclaimer: </strong>
                        AirBus is not an escrow service. Deposits are collected and refunded directly between host and guest. AirBus does not hold deposit funds.
                      </div>
                    </div>
                  )}
                </div>

                {/* Auto-Create 9:16 Short / Reel on Upload (Diamond & Gold Plans Only) */}
                {tierRules.shorts_per_listing > 0 ? (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-purple-50 dark:from-rose-950/30 dark:to-purple-950/30 border border-rose-200 dark:border-rose-800/60 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-extrabold text-stone-900 dark:text-white flex items-center gap-1.5">
                          <Video className="w-4 h-4 text-[#e4002b]" />
                          <span>Create Short automatically (9:16 Reel · {plan.tier} Tier)</span>
                        </h4>
                        <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-0.5">
                          Automatically builds a 9:16 vertical Short from this listing’s video or photos ({tierRules.shorts_per_listing} Short{tierRules.shorts_per_listing > 1 ? 's' : ''} allowed per listing).
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={autoCreateShortOnUpload}
                          onChange={e => setAutoCreateShortOnUpload(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#e4002b]"></div>
                      </label>
                    </div>

                    {autoCreateShortOnUpload && (
                      <div className="pt-2 border-t border-rose-200/70 dark:border-rose-800/40 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-1.5 font-semibold text-stone-700 dark:text-stone-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoShortCaptions}
                              onChange={e => setAutoShortCaptions(e.target.checked)}
                              className="accent-[#e4002b]"
                            />
                            <Captions className="w-3.5 h-3.5 text-[#e4002b]" />
                            <span>Auto-captions</span>
                          </label>
                          <label className="flex items-center gap-1.5 font-semibold text-stone-700 dark:text-stone-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoShortReviewBeforePosting}
                              onChange={e => setAutoShortReviewBeforePosting(e.target.checked)}
                              className="accent-[#e4002b]"
                            />
                            <span>Review before posting (save draft)</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
                    <div className="text-xs text-stone-600 dark:text-stone-300 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Auto-Create 9:16 Shorts is available on Diamond (1/listing) and Gold (5/listing) plans.</span>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenPlanModal}
                      className="px-3 py-1.5 rounded-full bg-amber-500 text-black text-[11px] font-extrabold shrink-0 cursor-pointer"
                    >
                      Upgrade
                    </button>
                  </div>
                )}

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

      {/* Subscription Gate Modal */}
      {gateModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-[#e4002b] flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-extrabold font-heading text-stone-900 dark:text-white">
              {gateModal.title}
            </h3>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              {gateModal.message}
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setGateModal(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setGateModal(null);
                  onOpenPlanModal();
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#e4002b] hover:bg-[#c90026] text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
              >
                {gateModal.actionText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Listing Media Modal */}
      {manageMediaStay && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-5 my-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-[#e4002b] text-[10px] font-black uppercase tracking-wider">
                    Listing Media Studio
                  </span>
                  <span className="text-xs text-stone-400 font-mono">
                    ID: {manageMediaStay.id}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-stone-900 dark:text-white">
                  Manage Media: {manageMediaStay.title}
                </h3>
                <p className="text-xs text-stone-500">
                  Add, replace, or remove video and photos. At least one media type is required.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setManageMediaStay(null)}
                className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-900 dark:hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Live Media Viewer Preview */}
            <div className="rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-black">
              <ListingMediaViewer
                media={{
                  video: manageMediaVideoUrl ? {
                    url: manageMediaVideoUrl,
                    thumbnail: manageMediaPhotos[0]?.url || manageMediaStay.thumbnailUrl || '',
                    duration: 60,
                    size: 15000000,
                  } : null,
                  photos: manageMediaPhotos,
                }}
                title={manageMediaStay.title}
                aspectRatio="video"
              />
            </div>

            {/* Status alerts */}
            {manageMediaError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-2xl border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{manageMediaError}</span>
              </div>
            )}
            {manageMediaSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{manageMediaSuccess}</span>
              </div>
            )}

            {/* Video Manager */}
            <div className="p-4 bg-stone-50 dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-[#e4002b]" />
                  <span>Primary Video Tour</span>
                </h4>
                <div className="flex items-center gap-2">
                  {manageMediaVideoUrl && !isYouTubeUrl(manageMediaVideoUrl) && (
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenAutoCreateForMedia(
                          manageMediaStay,
                          'video',
                          [manageMediaVideoUrl],
                          'Primary Video Tour'
                        )
                      }
                      className="px-2.5 py-1 rounded-full bg-[#e4002b] hover:bg-[#c90026] text-white text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <Video className="w-3 h-3" />
                      <span>Auto Create Short</span>
                    </button>
                  )}
                  {manageMediaVideoUrl && (
                    <button
                      type="button"
                      onClick={() => setManageMediaVideoUrl('')}
                      className="text-[11px] text-rose-500 font-bold hover:underline cursor-pointer"
                    >
                      Remove Video
                    </button>
                  )}
                </div>
              </div>
              <input
                type="url"
                value={manageMediaVideoUrl}
                onChange={e => setManageMediaVideoUrl(e.target.value)}
                placeholder="Video URL (MP4 / MOV / WebM or YouTube link)"
                className="w-full px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
              />
            </div>

            {/* Photos Manager */}
            <div className="p-4 bg-stone-50 dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <Images className="w-4 h-4 text-purple-500" />
                  <span>Photo Gallery ({manageMediaPhotos.length} / 30 photos)</span>
                </h4>
                <span className="text-[10px] text-stone-400">
                  {manageMediaPhotos.length === 0 ? 'No photos' : 'Create a Short from any photo or set cover'}
                </span>
              </div>

              {/* Add Photo by URL */}
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={managePhotoUrlInput}
                  onChange={e => setManagePhotoUrlInput(e.target.value)}
                  placeholder="Paste photo URL and click Add"
                  className="flex-1 px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const u = managePhotoUrlInput.trim();
                    if (!u) return;
                    if (manageMediaPhotos.length >= 30) {
                      setManageMediaError('Maximum 30 photos allowed.');
                      return;
                    }
                    setManageMediaPhotos(prev => [
                      ...prev,
                      { url: u, order: prev.length, isCover: prev.length === 0 },
                    ]);
                    setManagePhotoUrlInput('');
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>

              {/* Photos Grid (each photo has an explicit "Auto Create Short" button) */}
              {manageMediaPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1">
                  {manageMediaPhotos.map((p, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl overflow-hidden border-2 bg-white dark:bg-stone-800 flex flex-col transition-all ${
                        p.isCover ? 'border-[#e4002b] ring-2 ring-rose-500/30' : 'border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      <div className="relative aspect-square">
                        <img src={p.url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                        {p.isCover && (
                          <span className="absolute top-1 left-1 bg-[#e4002b] text-white text-[8px] font-black uppercase px-1 rounded shadow">
                            Cover
                          </span>
                        )}
                        <div className="absolute top-1 right-1 flex items-center gap-1">
                          {!p.isCover && (
                            <button
                              type="button"
                              onClick={() => {
                                setManageMediaPhotos(prev => prev.map((item, i) => ({ ...item, isCover: i === idx })));
                              }}
                              className="text-[9px] bg-white/95 text-stone-900 font-bold px-1.5 py-0.5 rounded shadow cursor-pointer"
                            >
                              Cover
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setManageMediaPhotos(prev => {
                                const filtered = prev.filter((_, i) => i !== idx);
                                return filtered.map((item, i) => ({
                                  ...item,
                                  order: i,
                                  isCover: i === 0 ? true : item.isCover && !filtered[0]?.isCover ? false : item.isCover,
                                }));
                              });
                            }}
                            className="p-1 text-white bg-rose-600 rounded shadow hover:bg-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenAutoCreateForMedia(
                            manageMediaStay,
                            'photo',
                            [p.url],
                            `Photo #${idx + 1}`
                          )
                        }
                        className="w-full py-1.5 px-2 bg-stone-900 dark:bg-stone-950 hover:bg-[#e4002b] text-white text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Video className="w-3 h-3" />
                        <span>Auto Create Short</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setManageMediaStay(null)}
                className="px-4 py-2 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveManageMedia}
                disabled={manageMediaSaving}
                className="px-6 py-2 rounded-full bg-[#e4002b] hover:bg-[#c90026] text-white text-xs font-extrabold shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {manageMediaSaving ? 'Saving...' : 'Save Media Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt at end of stay creation: Gemini AI Short */}
      {aiShortPromptStay && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#ff2e93] to-[#8b5cf6] text-white flex items-center justify-center mx-auto shadow-lg">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black font-heading text-stone-900 dark:text-white">
              Stay Created Successfully! 🌟
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Do you want Gemini AI to generate a short video for your listing?
            </p>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-800/50 text-xs text-left">
              <span className="font-bold block text-purple-900 dark:text-purple-200">{aiShortPromptStay.title}</span>
              <span className="text-[11px] text-purple-700 dark:text-purple-300">9:16 vertical short showcase ready for AirBus feed and discovery stream.</span>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={generatingAiShort}
                onClick={() => setAiShortPromptStay(null)}
                className="px-4 py-2.5 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                Skip for Now
              </button>
              <button
                type="button"
                disabled={generatingAiShort}
                onClick={async () => {
                  setGeneratingAiShort(true);
                  try {
                    await api.generateStayAiShort(aiShortPromptStay.id);
                    showToast?.('Gemini AI Short generated successfully for your stay!');
                    setAiShortPromptStay(null);
                  } catch (err: any) {
                    showToast?.(err.message || 'Failed to generate AI Short.');
                  } finally {
                    setGeneratingAiShort(false);
                  }
                }}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white text-xs font-bold shadow-md hover:opacity-95 cursor-pointer disabled:opacity-50"
              >
                {generatingAiShort ? 'Generating AI Short...' : '✨ Yes, Generate AI Short'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: AirBus Black Friday Opt-In */}
      {bfStayModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#e4002b]/10 text-[#e4002b] flex items-center justify-center">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900 dark:text-white">
                    AirBus Black Friday Opt-In
                  </h3>
                  <p className="text-[11px] text-stone-500 line-clamp-1">{bfStayModal.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBfStayModal(null)}
                className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              AirBus Black Friday runs quarterly on the last Friday of March, June, September, and December. Opt this listing in ahead of time with up to 50% off your normal nightly price.
            </p>

            <label className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 cursor-pointer">
              <span className="text-xs font-bold">Enroll listing in Black Friday drops</span>
              <input
                type="checkbox"
                checked={bfOptIn}
                onChange={e => setBfOptIn(e.target.checked)}
                className="w-4 h-4 accent-[#e4002b]"
              />
            </label>

            {bfOptIn && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Black Friday Discount (up to 50%)</span>
                  <span className="text-[#e4002b] font-black">{bfDiscountPercent}% OFF</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={50}
                  step={5}
                  value={bfDiscountPercent}
                  onChange={e => setBfDiscountPercent(Number(e.target.value))}
                  className="w-full accent-[#e4002b]"
                />
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs flex items-center justify-between">
                  <span className="text-stone-500 line-through">
                    KES {bfStayModal.price.toLocaleString()}
                  </span>
                  <span className="font-black text-[#e4002b]">
                    New: KES {Math.round(bfStayModal.price * (1 - bfDiscountPercent / 100)).toLocaleString()} / night
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBfStayModal(null)}
                className="px-4 py-2 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bfSaving}
                onClick={async () => {
                  setBfSaving(true);
                  try {
                    await onUpdateStay(bfStayModal.id, {
                      blackFridayOptIn: bfOptIn,
                      blackFridayDiscountPercent: bfOptIn ? bfDiscountPercent : 0,
                    });
                    showToast?.(
                      bfOptIn
                        ? `Opted "${bfStayModal.title}" into AirBus Black Friday (${bfDiscountPercent}% off)!`
                        : 'Removed listing from AirBus Black Friday.'
                    );
                    setBfStayModal(null);
                  } catch (err: any) {
                    showToast?.(err.message || 'Could not update Black Friday setting.');
                  } finally {
                    setBfSaving(false);
                  }
                }}
                className="px-5 py-2 rounded-full bg-[#e4002b] hover:bg-[#c90026] text-white text-xs font-extrabold shadow cursor-pointer disabled:opacity-50"
              >
                {bfSaving ? 'Saving...' : 'Save Black Friday Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit AirBus Escapes Offer */}
      {escapeStayModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900 dark:text-white">
                    AirBus Escapes Offer
                  </h3>
                  <p className="text-[11px] text-stone-500 line-clamp-1">{escapeStayModal.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEscapeStayModal(null)}
                className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <label className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 cursor-pointer">
              <span className="text-xs font-bold">Publish active Escapes special offer</span>
              <input
                type="checkbox"
                checked={escapeActive}
                onChange={e => setEscapeActive(e.target.checked)}
                className="w-4 h-4 accent-emerald-600"
              />
            </label>

            {escapeActive && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                    Offer Title
                  </label>
                  <input
                    type="text"
                    value={escapeTitle}
                    onChange={e => setEscapeTitle(e.target.value)}
                    placeholder="e.g. Weekend Coastal Flash Escape"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-stone-600 dark:text-stone-400">Discount Percentage</span>
                    <span className="text-emerald-600 font-black">{escapeDiscountPct}% OFF</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={50}
                    step={5}
                    value={escapeDiscountPct}
                    onChange={e => setEscapeDiscountPct(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                  <div className="mt-1.5 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs flex items-center justify-between">
                    <span className="text-stone-500 line-through">
                      Orig: KES {(escapeStayModal.escapeOriginalPrice || escapeStayModal.price).toLocaleString()}
                    </span>
                    <span className="font-black text-emerald-700 dark:text-emerald-300">
                      Offer: KES {Math.round((escapeStayModal.escapeOriginalPrice || escapeStayModal.price) * (1 - escapeDiscountPct / 100)).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                      Valid From
                    </label>
                    <input
                      type="date"
                      value={escapeValidFrom}
                      onChange={e => setEscapeValidFrom(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                      Valid To
                    </label>
                    <input
                      type="date"
                      value={escapeValidTo}
                      onChange={e => setEscapeValidTo(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEscapeStayModal(null)}
                className="px-4 py-2 rounded-full border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={escapeSaving}
                onClick={async () => {
                  setEscapeSaving(true);
                  const origPrice = escapeStayModal.escapeOriginalPrice || escapeStayModal.price;
                  const offerPrice = Math.round(origPrice * (1 - escapeDiscountPct / 100));
                  try {
                    await onUpdateStay(escapeStayModal.id, {
                      isEscapeOffer: escapeActive,
                      escapeOfferTitle: escapeActive ? (escapeTitle.trim() || 'Special Escapes Deal') : undefined,
                      escapeOriginalPrice: origPrice,
                      escapeOfferPrice: escapeActive ? offerPrice : origPrice,
                      escapeDiscountPercent: escapeActive ? escapeDiscountPct : 0,
                      escapeValidFrom: escapeActive ? escapeValidFrom : undefined,
                      escapeValidTo: escapeActive ? escapeValidTo : undefined,
                    });
                    showToast?.(
                      escapeActive
                        ? `AirBus Escapes offer published for "${escapeStayModal.title}"!`
                        : 'AirBus Escapes offer removed.'
                    );
                    setEscapeStayModal(null);
                  } catch (err: any) {
                    showToast?.(err.message || 'Failed to save Escapes offer.');
                  } finally {
                    setEscapeSaving(false);
                  }
                }}
                className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow cursor-pointer disabled:opacity-50"
              >
                {escapeSaving ? 'Saving...' : 'Save Escapes Offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Shorts Auto-Creator Studio Modal (Strictly Bound to Listing + Tier Quota) */}
      <ShortsCreatorModal
        isOpen={creatorModalOpen}
        onClose={() => {
          setCreatorModalOpen(false);
          setCreatorFixedStay(null);
          setCreatorInitialMedia(undefined);
        }}
        user={user}
        myStays={myStays}
        fixedStay={creatorFixedStay || undefined}
        quotaInfo={creatorFixedStay ? getListingQuotaInfo(creatorFixedStay.id) : undefined}
        initialMedia={creatorInitialMedia}
        onOpenUpgrade={() => {
          setCreatorModalOpen(false);
          onOpenPlanModal();
        }}
        onJobUpdated={job => {
          setMyShortJobs(prev => {
            const exists = prev.some(j => j.id === job.id);
            return exists ? prev.map(j => (j.id === job.id ? job : j)) : [job, ...prev];
          });
        }}
        onShortPublished={post => {
          setMyShortsPosts(prev => [post, ...prev.filter(p => p.id !== post.id)]);
          showToast?.('Short published to Shorts & Reels!');
          loadCreatorShorts();
        }}
        showToast={showToast}
      />

      {/* Gold Host Optional Listing Audio Sheet */}
      {listingAudioStay && (
        <ShortsAudioPickerSheet
          isOpen={true}
          onClose={() => setListingAudioStay(null)}
          purpose="listing"
          hideOriginalTab={true}
          allowMusicAndVoiceOver={tierRules.listing_audio_enabled}
          value={
            listingAudioStay.listingAudio
              ? {
                  mode: listingAudioStay.listingAudio.mode,
                  trackId: listingAudioStay.listingAudio.trackId,
                  trackTitle: listingAudioStay.listingAudio.trackTitle,
                  trackArtist: listingAudioStay.listingAudio.trackArtist,
                  trackUrl: listingAudioStay.listingAudio.trackUrl,
                  audioStartSec: 0,
                  originalVolume: 100,
                  musicVolume: listingAudioStay.listingAudio.musicVolume ?? 70,
                  voiceOverUrl: listingAudioStay.listingAudio.voiceOverUrl,
                  voiceOverSource: listingAudioStay.listingAudio.voiceOverSource,
                  voiceOverVolume: listingAudioStay.listingAudio.voiceOverVolume ?? 100,
                  ttsScript: listingAudioStay.listingAudio.ttsScript,
                  ttsVoice: listingAudioStay.listingAudio.ttsVoice,
                  ttsLanguage: listingAudioStay.listingAudio.ttsLanguage,
                  autoDuckMusic: listingAudioStay.listingAudio.autoDuckMusic ?? true,
                  rightsConfirmed: listingAudioStay.listingAudio.rightsConfirmed,
                  requiresAttribution: listingAudioStay.listingAudio.requiresAttribution,
                  attributionText: listingAudioStay.listingAudio.attributionText,
                }
              : {
                  mode: 'none',
                  audioStartSec: 0,
                  originalVolume: 100,
                  musicVolume: 70,
                  voiceOverVolume: 100,
                  autoDuckMusic: true,
                }
          }
          onChange={async (nextCfg: ShortAudioConfig) => {
            if (listingAudioSaving) return;
            setListingAudioSaving(true);
            try {
              if (nextCfg.mode === 'none') {
                await api.deleteListingAudio(listingAudioStay.id);
                await onUpdateStay(listingAudioStay.id, { listingAudio: null, listingAudioLocked: false });
                showToast?.('Listing audio removed.');
              } else {
                const res = await api.saveListingAudio(listingAudioStay.id, {
                  mode: nextCfg.mode as ListingAudioConfig['mode'],
                  trackId: nextCfg.trackId,
                  musicVolume: nextCfg.musicVolume,
                  voiceOverUrl: nextCfg.voiceOverUrl,
                  voiceOverSource: nextCfg.voiceOverSource,
                  voiceOverVolume: nextCfg.voiceOverVolume,
                  ttsScript: nextCfg.ttsScript,
                  ttsVoice: nextCfg.ttsVoice,
                  ttsLanguage: nextCfg.ttsLanguage,
                  autoDuckMusic: nextCfg.autoDuckMusic,
                  rightsConfirmed: nextCfg.rightsConfirmed ?? true,
                });
                await onUpdateStay(listingAudioStay.id, {
                  listingAudio: res.listingAudio,
                  listingAudioLocked: false,
                });
                showToast?.('Gold listing audio saved!');
              }
            } catch (err: any) {
              showToast?.(err.message || 'Failed to update listing audio.');
            } finally {
              setListingAudioSaving(false);
            }
          }}
          defaultScript={`Welcome to ${listingAudioStay.title} in ${listingAudioStay.location}.`}
          showToast={showToast}
        />
      )}
    </div>
  );
};
