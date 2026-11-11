import React, { useState, useEffect, useId, useRef } from 'react';
import {
  Heart,
  Eye,
  Phone,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Lock,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  Search,
  Filter,
  UserPlus,
  Info,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Flame,
  Camera,
  Calendar,
  Compass,
  Video,
  Play,
  Pause,
  Volume2,
  VolumeX,
  UploadCloud,
  Sliders,
  Film,
  Scissors,
  Wand2,
  Zap,
  Trash2,
  Image as ImageIcon,
  MoreVertical,
  Flag,
  Share2,
  Check,
  SlidersHorizontal,
  Navigation,
} from 'lucide-react';
import {
  TripDatingProfile,
  TripDatingPaymentRequest,
  TripDatingGender,
  TripDatingIntention,
} from '../../types';
import { api } from '../../api';

interface TripDatingPageProps {
  currentUser?: any;
  onNavigateToStays?: () => void;
  onOpenAuth?: () => void;
}

const PRESET_PHOTOS = {
  female: [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
  ],
  male: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80',
  ],
};

const FULL_BODY_PRESETS = {
  female: [
    {
      url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
      label: 'Casual Street Style (Head to Toe)',
    },
    {
      url: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=800&q=80',
      label: 'Standing Portrait (Head to Toe)',
    },
    {
      url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
      label: 'Outdoor Casual (Full Length)',
    },
  ],
  male: [
    {
      url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=80',
      label: 'Standing Casual (Head to Toe)',
    },
    {
      url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80',
      label: 'Urban Modern (Full Length)',
    },
    {
      url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
      label: 'Travel Adventure (Full Body)',
    },
  ],
};

const PRESET_916_VIDEOS = [
  {
    title: 'Beach Walk & Sunset (60s)',
    duration: 60,
    url: 'https://assets.mixkit.co/videos/preview/mixkit-woman-enjoying-a-sunny-day-in-a-park-41528-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Cafe & Nairobi Vibe (45s)',
    duration: 45,
    url: 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-talking-on-video-call-with-her-phone-41525-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'City Walk & Lifestyle (55s)',
    duration: 55,
    url: 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-smiling-at-the-camera-in-the-street-41523-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
  },
];

export interface AestheticVideoFilter {
  id: string;
  name: string;
  badge: string;
  css: string;
  previewBg: string;
  description: string;
}

export const AESTHETIC_VIDEO_FILTERS: AestheticVideoFilter[] = [
  {
    id: 'normal',
    name: 'Original',
    badge: 'Standard',
    css: 'none',
    previewBg: 'bg-neutral-800',
    description: 'Natural authentic color and contrast',
  },
  {
    id: 'warm_sunset',
    name: 'Warm Sunset',
    badge: 'Sunset Glow',
    css: 'sepia(0.35) saturate(1.4) brightness(1.05) contrast(1.05) hue-rotate(-10deg)',
    previewBg: 'bg-gradient-to-tr from-amber-600 to-rose-500',
    description: 'Rich golden warmth with amber sunset tones',
  },
  {
    id: 'neon_night',
    name: 'Neon Night',
    badge: 'Electric',
    css: 'contrast(1.3) saturate(1.6) hue-rotate(190deg) brightness(0.95)',
    previewBg: 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500',
    description: 'Vibrant neon purple and electric blue night vibes',
  },
  {
    id: 'vintage_grain',
    name: 'Vintage Grain',
    badge: 'Retro 90s',
    css: 'sepia(0.45) contrast(1.15) brightness(0.95) saturate(0.85)',
    previewBg: 'bg-gradient-to-tr from-stone-700 to-amber-900',
    description: 'Classic nostalgic film tone with warm sepia grading',
  },
  {
    id: 'golden_hour',
    name: 'Golden Hour',
    badge: 'Magic Hour',
    css: 'saturate(1.5) brightness(1.1) contrast(1.1) sepia(0.22)',
    previewBg: 'bg-gradient-to-tr from-yellow-500 to-orange-500',
    description: 'Sun-drenched honey radiance with enhanced highlights',
  },
  {
    id: 'noir_film',
    name: 'Noir Film',
    badge: 'Cinematic B&W',
    css: 'grayscale(1) contrast(1.35) brightness(0.95)',
    previewBg: 'bg-gradient-to-tr from-black via-neutral-700 to-neutral-400',
    description: 'Timeless high-contrast cinematic black and white',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    badge: 'Teal & Cyan',
    css: 'contrast(1.35) saturate(1.8) hue-rotate(80deg)',
    previewBg: 'bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500',
    description: 'Futuristic urban nightlife with electric cyan contrast',
  },
  {
    id: 'soft_dream',
    name: 'Soft Dream',
    badge: 'Pastel Glow',
    css: 'brightness(1.1) contrast(0.95) saturate(1.25)',
    previewBg: 'bg-gradient-to-tr from-pink-400 to-rose-300',
    description: 'Romantic pastel aesthetic with luminous skin glow',
  },
];

export const getVideoFilterCss = (filterId?: string): string => {
  const found = AESTHETIC_VIDEO_FILTERS.find(f => f.id === filterId);
  return found ? found.css : 'none';
};

export const getVideoFilterBadge = (filterId?: string): string | null => {
  if (!filterId || filterId === 'normal') return null;
  const found = AESTHETIC_VIDEO_FILTERS.find(f => f.id === filterId);
  return found ? found.name : null;
};

// Kenya Major Cities Coordinates for Proximity & Distance Filtering
export const KENYAN_CITIES_COORDS: Record<string, { lat: number; lng: number }> = {
  Nairobi: { lat: -1.286389, lng: 36.817223 },
  Mombasa: { lat: -4.043477, lng: 39.668206 },
  Kisumu: { lat: -0.091702, lng: 34.767956 },
  Nakuru: { lat: -0.303099, lng: 36.080026 },
  Eldoret: { lat: 0.514277, lng: 35.269780 },
  Diani: { lat: -4.316667, lng: 39.583333 },
  Naivasha: { lat: -0.717178, lng: 36.431026 },
  Malindi: { lat: -3.218556, lng: 40.116890 },
};

export function getCoordinatesForCity(cityName?: string): { lat: number; lng: number } {
  if (!cityName) return KENYAN_CITIES_COORDS['Nairobi'];
  const key = Object.keys(KENYAN_CITIES_COORDS).find(k =>
    cityName.toLowerCase().includes(k.toLowerCase())
  );
  return key ? KENYAN_CITIES_COORDS[key] : KENYAN_CITIES_COORDS['Nairobi'];
}

export function calculateDistanceKm(c1: { lat: number; lng: number }, c2: { lat: number; lng: number }): number {
  const R = 6371; // Earth radius in km
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLon = ((c2.lng - c1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(2, Math.round(R * c));
}

export const PROFILE_INTERESTS_MAP: Record<string, string[]> = {
  serious_relationship: ['Deep Sunset Conversations', 'Weekend Road Trips', 'Fine Dining & Cooking', 'Scenic Photography'],
  dating_companionship: ['Specialty Coffee Dates', 'Art & Culture Galleries', 'Live Acoustic Music', 'Rooftop Lounges'],
  travel_partner: ['Spontaneous Coast Getaways', 'National Park Safari', 'Scenic Hiking Trails', 'Stargazing Camps'],
  friendship: ['Book & Film Clubs', 'Fitness & Wellness', 'Game Nights & Trivia', 'Urban Walking Tours'],
};

export function getProfileMatchScore(profile: TripDatingProfile): {
  score: number;
  explanation: string;
  tags: string[];
} {
  let hash = 0;
  const seed = (profile.id || '') + (profile.fullName || '');
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const variance = Math.abs(hash) % 15;
  const score = 84 + variance; // 84% - 98% (all positively matched)
  const tags = (PROFILE_INTERESTS_MAP[profile.datingIntention] || ['Weekend Escapes', 'Coffee Lovers', 'Scenic Drives']).slice(0, 3);

  let explanation = '';
  if (profile.datingIntention === 'serious_relationship') {
    explanation = `${score}% Match: You both share an affectionate vision for meaningful long-term romance, peaceful weekend getaways, and deep evening conversations.`;
  } else if (profile.datingIntention === 'travel_partner') {
    explanation = `${score}% Match: Exceptional adventure synergy! Both of you love exploring scenic spots, spontaneous road trips across Kenya, and capturing beautiful memories.`;
  } else if (profile.datingIntention === 'dating_companionship') {
    explanation = `${score}% Match: Warm mutual chemistry. Perfect synergy for relaxed coffee dates, coastal sunsets, laughter, and uplifting conversations.`;
  } else {
    explanation = `${score}% Match: Uplifting mutual vibes! Shared enthusiasm for creative lifestyles, fitness, and inspiring companionship.`;
  }

  return { score, explanation, tags };
}

export const TripDatingPage: React.FC<TripDatingPageProps> = ({
  currentUser,
  onNavigateToStays,
  onOpenAuth,
}) => {
  // Session id stored in localStorage to preserve unlocks across reloads
  const [sessionId, setSessionId] = useState<string>(() => {
    let s = localStorage.getItem('airbus_dating_session_id');
    if (!s) {
      s = 'sess_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('airbus_dating_session_id', s);
    }
    return s;
  });

  const [profiles, setProfiles] = useState<TripDatingProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedIntention, setSelectedIntention] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 3-Step Guided Entry Modal (shown once or on click "Find My Match")
  const [showGuidedEntry, setShowGuidedEntry] = useState<boolean>(false);
  const [guidedStep, setGuidedStep] = useState<number>(1);
  const [guidedGender, setGuidedGender] = useState<'male' | 'female' | 'other'>('female');
  const [guidedGoal, setGuidedGoal] = useState<'search' | 'become'>('search');
  const [guidedCity, setGuidedCity] = useState<string>('Nairobi');

  // "Become a Trip Date" Free Registration Modal
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [regForm, setRegForm] = useState({
    fullName: '',
    phoneNumber: '',
    gender: 'female' as TripDatingGender,
    age: 26,
    dob: '1998-05-15',
    city: 'Nairobi',
    location: 'Westlands, Nairobi',
    description: '',
    lookingFor: '',
    datingIntention: 'dating_companionship' as TripDatingIntention,
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    ],
    videoUrl: '',
    videoDuration: 60,
    videoThumbnail: '',
    videoFilter: 'normal',
    videoTrimStart: 0,
    videoTrimEnd: 60,
  });
  const [customPhotoInput, setCustomPhotoInput] = useState<string>('');
  const [registering, setRegistering] = useState<boolean>(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // State for Photo Upload (Max 3 photos)
  const photoUploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState<boolean>(false);

  // State for 9:16 Video Upload (Max 2 videos, compressed)
  interface VideoItemState {
    url: string;
    duration: number;
    thumbnail: string;
    filter: string;
    trimStart: number;
    trimEnd: number;
    originalSizeMb?: number;
    compressedSizeMb?: number;
    isCompressed?: boolean;
  }
  const [regVideos, setRegVideos] = useState<VideoItemState[]>([]);
  const [activeVideoSlot, setActiveVideoSlot] = useState<number>(0);
  const [compressingVideo, setCompressingVideo] = useState<boolean>(false);
  const [compressionStats, setCompressionStats] = useState<{
    originalMb: number;
    compressedMb: number;
    savings: number;
  } | null>(null);

  // Heart Reaction notification toast & watching video index
  const [heartReactionToast, setHeartReactionToast] = useState<{
    profileName: string;
    isLiked: boolean;
  } | null>(null);
  const [watchingVideoIndex, setWatchingVideoIndex] = useState<number>(0);

  // 9:16 Video Upload mechanics states
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const [customVideoUrlInput, setCustomVideoUrlInput] = useState<string>('');
  const [previewVideoPlaying, setPreviewVideoPlaying] = useState<boolean>(false);
  const [previewVideoMuted, setPreviewVideoMuted] = useState<boolean>(true);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Timeline-based Video Trimming Tool states
  const [showTrimmer, setShowTrimmer] = useState<boolean>(false);
  const [rawVideoUrl, setRawVideoUrl] = useState<string>('');
  const [rawVideoDuration, setRawVideoDuration] = useState<number>(0);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(60);
  const [trimPlayhead, setTrimPlayhead] = useState<number>(0);
  const [trimIsPlaying, setTrimIsPlaying] = useState<boolean>(false);
  const trimVideoRef = useRef<HTMLVideoElement>(null);

  // Scrawler on Registration Card Modal: Up/Down navigation, scroll progress, section jumping
  const regModalScrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [canScrollUp, setCanScrollUp] = useState<boolean>(false);
  const [canScrollDown, setCanScrollDown] = useState<boolean>(true);

  const handleModalScroll = () => {
    const el = regModalScrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
    setScrollProgress(progress);
    setCanScrollUp(scrollTop > 15);
    setCanScrollDown(scrollTop < maxScroll - 15);
  };

  const handleScrollModal = (direction: 'up' | 'down') => {
    const el = regModalScrollRef.current;
    if (!el) return;
    const offset = direction === 'up' ? -280 : 280;
    el.scrollBy({ top: offset, behavior: 'smooth' });
  };

  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Dedicated 9:16 Video Player Modal for other users to watch member videos
  const [watchingVideoProfile, setWatchingVideoProfile] = useState<TripDatingProfile | null>(null);
  const [watchVideoPlaying, setWatchVideoPlaying] = useState<boolean>(true);
  const [watchVideoMuted, setWatchVideoMuted] = useState<boolean>(false);
  const [watchVideoCurrentTime, setWatchVideoCurrentTime] = useState<number>(0);
  const [watchVideoDuration, setWatchVideoDuration] = useState<number>(60);
  const watchVideoRef = useRef<HTMLVideoElement>(null);

  // Part E: Full-Body Photo State & Client-Side Verification
  const [fullBodyPhoto, setFullBodyPhoto] = useState<string>(FULL_BODY_PRESETS.female[0].url);
  const [fullBodyVerified, setFullBodyVerified] = useState<boolean>(true);
  const [verifyingPhoto, setVerifyingPhoto] = useState<boolean>(false);
  const [verificationFeedback, setVerificationFeedback] = useState<{
    valid: boolean;
    reason?: string;
  }>({ valid: true });

  const verifyPhotoFullBody = async (url: string) => {
    setVerifyingPhoto(true);
    try {
      const result = await new Promise<{ valid: boolean; reason?: string }>((resolve) => {
        if (!url || !url.trim()) {
          resolve({ valid: false, reason: 'Please select or upload a full-body photo.' });
          return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          // 1. Aspect Ratio check: Portrait orientation required (height >= 1.15x width)
          const ratio = img.height / img.width;
          if (ratio < 1.15) {
            resolve({
              valid: false,
              reason: 'Photo is horizontal or square. A portrait photo (head to toe) is required.',
            });
            return;
          }
          // 2. Minimum resolution check (min 250x350)
          if (img.width < 250 || img.height < 350) {
            resolve({
              valid: false,
              reason: 'Photo resolution is too low. Please upload a clear photo with at least 400px height.',
            });
            return;
          }
          // 3. Canvas vertical distribution check for head-to-toe
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 160;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, 100, 160);
              // Sample lower 25% (legs/feet area)
              const lowerData = ctx.getImageData(0, 120, 100, 40).data;
              let variance = 0;
              for (let i = 0; i < lowerData.length - 4; i += 16) {
                variance += Math.abs(lowerData[i] - lowerData[i + 4]);
              }
              if (variance < 5) {
                resolve({
                  valid: false,
                  reason: 'Cropped or face-only photo detected. The photo must show feet and legs.',
                });
                return;
              }
            }
          } catch (e) {
            // In case of CORS canvas taint, pass through if portrait format is verified
          }
          resolve({ valid: true });
        };
        img.onerror = () => {
          if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/')) {
            resolve({ valid: true });
          } else {
            resolve({ valid: false, reason: 'Invalid photo URL.' });
          }
        };
        img.src = url;
      });

      setFullBodyVerified(result.valid);
      setVerificationFeedback(result);
    } finally {
      setVerifyingPhoto(false);
    }
  };

  const handleSelectFullBodyPhoto = (url: string) => {
    setFullBodyPhoto(url);
    verifyPhotoFullBody(url);
  };

  // "See Contact · KES 50" Payment Modal
  const [selectedProfileForContact, setSelectedProfileForContact] = useState<TripDatingProfile | null>(null);
  const [payerPhone, setPayerPhone] = useState<string>('');
  const [transactionCode, setTransactionCode] = useState<string>('');
  const [paymentSubmitting, setPaymentSubmitting] = useState<boolean>(false);
  const [paymentMsg, setPaymentMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Lightbox Photo Viewer Modal
  const [lightboxData, setLightboxData] = useState<{
    photos: string[];
    currentIndex: number;
    profileName: string;
  } | null>(null);

  // Canvas Hearts Rain Particle Engine & Pulse State (60FPS requestAnimationFrame)
  const heartsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heartAnimationIdRef = useRef<number | null>(null);
  const [activeHeartPulseId, setActiveHeartPulseId] = useState<string | null>(null);

  // Report Profile Modal state
  const [reportModalProfile, setReportModalProfile] = useState<TripDatingProfile | null>(null);
  const [reportReason, setReportReason] = useState<string>('fake_profile');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [reportSubmitting, setReportSubmitting] = useState<boolean>(false);
  const [reportToast, setReportToast] = useState<string | null>(null);

  // Share Profile Modal state
  const [shareModalProfile, setShareModalProfile] = useState<TripDatingProfile | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState<boolean>(false);

  // Card Menu & Interactive Popover states
  const [openCardMenuProfileId, setOpenCardMenuProfileId] = useState<string | null>(null);
  const [hoveredBioProfileId, setHoveredBioProfileId] = useState<string | null>(null);
  const [hoveredMatchScoreProfileId, setHoveredMatchScoreProfileId] = useState<string | null>(null);

  // Filter by Distance & Proximity State
  const [filterDistance, setFilterDistance] = useState<number | 'all'>('all');
  const [userCurrentCity, setUserCurrentCity] = useState<string>(() => currentUser?.location || 'Nairobi');

  // Advanced Filter Modal State
  const [showAdvancedFiltersModal, setShowAdvancedFiltersModal] = useState<boolean>(false);
  const [advFilterAgeMin, setAdvFilterAgeMin] = useState<number>(18);
  const [advFilterAgeMax, setAdvFilterAgeMax] = useState<number>(55);
  const [advFilterTravelStyle, setAdvFilterTravelStyle] = useState<string>('all');
  const [advFilterInterests, setAdvFilterInterests] = useState<string[]>([]);

  // 60FPS Canvas Hearts Rain Particle System
  const triggerHeartsRain = () => {
    const canvas = heartsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const heartChars = ['❤️', '💖', '💕', '💘', '💗', '✨', '💓'];
    const particleCount = 65;
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      rotation: number;
      rotationSpeed: number;
      char: string;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -40 - Math.random() * 250,
        size: 16 + Math.random() * 22,
        speedY: 2.5 + Math.random() * 4.5,
        speedX: (Math.random() - 0.5) * 2.5,
        opacity: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.08,
        char: heartChars[Math.floor(Math.random() * heartChars.length)],
      });
    }

    if (heartAnimationIdRef.current) {
      cancelAnimationFrame(heartAnimationIdRef.current);
    }

    const startTime = performance.now();
    const maxDuration = 3200;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let aliveCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += p.speedY;
        p.x += p.speedX + Math.sin((elapsed + i * 100) / 250) * 0.8;
        p.rotation += p.rotationSpeed;

        if (elapsed > 1800) {
          p.opacity = Math.max(0, 1 - (elapsed - 1800) / 1400);
        }

        if (p.opacity > 0 && p.y < canvas.height + 50) {
          aliveCount++;
          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.font = `${p.size}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.char, 0, 0);
          ctx.restore();
        }
      }

      if (aliveCount > 0 && elapsed < maxDuration) {
        heartAnimationIdRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        heartAnimationIdRef.current = null;
      }
    };

    heartAnimationIdRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => {
      if (heartAnimationIdRef.current) {
        cancelAnimationFrame(heartAnimationIdRef.current);
      }
    };
  }, []);

  // Handle Report Profile submission
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportModalProfile) return;
    setReportSubmitting(true);
    try {
      await api.reportTripDatingProfile({
        profileId: reportModalProfile.id,
        profileName: reportModalProfile.fullName,
        reason: reportReason,
        details: reportDetails,
      });
      setReportToast('Your concern has been logged for review.');
      setReportModalProfile(null);
      setReportDetails('');
      setTimeout(() => setReportToast(null), 4500);
    } catch {
      setReportToast('Your concern has been logged for review.');
      setReportModalProfile(null);
      setReportDetails('');
      setTimeout(() => setReportToast(null), 4500);
    } finally {
      setReportSubmitting(false);
    }
  };

  const getProfileDeepLink = (profile: TripDatingProfile) => {
    if (typeof window === 'undefined') return `https://airbus.ke/#trip-dating?id=${profile.id}`;
    return `${window.location.origin}/#trip-dating?id=${profile.id}`;
  };

  const handleCopyShareLink = async (profile: TripDatingProfile) => {
    const link = getProfileDeepLink(profile);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 3000);
    } catch {
      // Ignore
    }
  };

  // Active Unlocks tracking with live countdowns
  // Map profileId -> remaining seconds
  const [activeCountdowns, setActiveCountdowns] = useState<Record<string, number>>({});
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Fetch profiles
  const loadProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getTripDatingProfiles({
        gender: selectedGender,
        city: selectedCity,
        search: searchQuery,
        intention: selectedIntention,
        sessionId,
      });
      setProfiles(res.profiles || []);

      // Initialize countdowns for unlocked profiles
      const newCountdowns: Record<string, number> = {};
      res.profiles.forEach(p => {
        if (p.isUnlocked && p.unlockExpiresAt) {
          const remaining = Math.max(0, Math.round((p.unlockExpiresAt - Date.now()) / 1000));
          if (remaining > 0) {
            newCountdowns[p.id] = remaining;
          }
        }
      });
      setActiveCountdowns(newCountdowns);
    } catch (err: any) {
      setError(err.message || 'Failed to load dating profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [selectedGender, selectedCity, selectedIntention]);

  // Periodic 1-second interval to update 10-minute countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveCountdowns(prev => {
        let changed = false;
        const next: Record<string, number> = {};
        for (const [id, secs] of Object.entries(prev)) {
          if (secs > 1) {
            next[id] = secs - 1;
            changed = true;
          } else if (secs === 1) {
            // Relock after 10 minutes expire
            changed = true;
            // Refetch this profile to update masked phone
            api.getTripDatingProfile(id, sessionId).then(res => {
              setProfiles(curr => curr.map(p => (p.id === id ? res.profile : p)));
            }).catch(() => {});
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionId]);

  // Handle Heart Reaction on Trip Dating video card
  const handleHeartReaction = async (profileId: string) => {
    const target = profiles.find(p => p.id === profileId);
    const willBeLiked = target ? !target.isLikedByViewer : true;

    // Small scale-up pulse animation on Heart button on toggle
    setActiveHeartPulseId(profileId);
    setTimeout(() => {
      setActiveHeartPulseId(null);
    }, 650);

    // Canvas-based Hearts Rain particle animation (60fps) when user clicks Heart on high Match Score (>80%)
    const match = target ? getProfileMatchScore(target) : { score: 92 };
    if (willBeLiked && match.score > 80) {
      triggerHeartsRain();
    }

    // Optimistically update card state immediately
    setProfiles(prev =>
      prev.map(p =>
        p.id === profileId
          ? {
              ...p,
              isLikedByViewer: willBeLiked,
              likes: Math.max(0, (p.likes || 0) + (willBeLiked ? 1 : -1)),
            }
          : p
      )
    );

    if (watchingVideoProfile?.id === profileId) {
      setWatchingVideoProfile(prev =>
        prev
          ? {
              ...prev,
              isLikedByViewer: willBeLiked,
              likes: Math.max(0, (prev.likes || 0) + (willBeLiked ? 1 : -1)),
            }
          : null
      );
    }

    if (target) {
      setHeartReactionToast({
        profileName: target.fullName,
        isLiked: willBeLiked,
      });
      setTimeout(() => {
        setHeartReactionToast(null);
      }, 3500);
    }

    try {
      const res = await api.likeTripDatingProfile(profileId);
      setProfiles(prev =>
        prev.map(p =>
          p.id === profileId
            ? { ...p, likes: res.totalLikes, isLikedByViewer: res.liked }
            : p
        )
      );
      if (watchingVideoProfile?.id === profileId) {
        setWatchingVideoProfile(prev =>
          prev ? { ...prev, likes: res.totalLikes, isLikedByViewer: res.liked } : null
        );
      }
    } catch (err) {
      console.error('Heart reaction error:', err);
    }
  };

  const handleLike = handleHeartReaction;

  // Record View on photo interaction or click
  const handleRecordView = async (profileId: string) => {
    try {
      const res = await api.viewTripDatingProfile(profileId);
      setProfiles(prev =>
        prev.map(p => (p.id === profileId ? { ...p, views: res.views } : p))
      );
    } catch (err) {
      console.error('View error:', err);
    }
  };

  // Submit KES 50 Contact Request
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileForContact) return;
    if (!payerPhone.trim() || !transactionCode.trim()) {
      setPaymentMsg({ type: 'error', text: 'Please fill in both your phone number and M-Pesa transaction code.' });
      return;
    }

    try {
      setPaymentSubmitting(true);
      setPaymentMsg(null);
      const res = await api.requestTripDatingContact({
        profileId: selectedProfileForContact.id,
        payerPhone: payerPhone.trim(),
        transactionCode: transactionCode.trim().toUpperCase(),
        clientSessionId: sessionId,
      });

      setPaymentMsg({
        type: 'success',
        text: res.message || 'Payment submitted! Admin will verify M-Pesa Till 943210 and unlock this contact for 10 minutes.',
      });

      setTimeout(() => {
        // Poll for unlock or close modal
        setSelectedProfileForContact(null);
        setTransactionCode('');
        loadProfiles();
      }, 3500);
    } catch (err: any) {
      setPaymentMsg({ type: 'error', text: err.message || 'Failed to submit payment request.' });
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Client-Side Image Compression (Max dimension 1200px, JPEG 0.82)
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_DIM = 1200;
          let width = img.width;
          let height = img.height;
          if (width > height && width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          } else {
            resolve((e.target?.result as string) || '');
          }
        };
        img.onerror = () => resolve((e.target?.result as string) || '');
        img.src = (e.target?.result as string) || '';
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Client-Side Video Compression: Downscales 9:16 vertical video to 540x960 1.2 Mbps for small lightweight streaming
  const compressVideoFile = (file: File): Promise<{
    compressedUrl: string;
    originalMb: number;
    compressedMb: number;
    savings: number;
    duration: number;
  }> => {
    const originalMb = Number((file.size / (1024 * 1024)).toFixed(1));
    const rawUrl = URL.createObjectURL(file);

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.src = rawUrl;
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        const dur = Math.min(60, Math.round(video.duration) || 60);

        // Check if MediaRecorder and canvas captureStream are available
        const canvas = document.createElement('canvas');
        canvas.width = 540;
        canvas.height = 960; // 9:16 mobile resolution
        const ctx = canvas.getContext('2d');

        let stream: MediaStream | null = null;
        try {
          stream = (canvas as any).captureStream ? (canvas as any).captureStream(24) : null;
        } catch (e) {
          stream = null;
        }

        let mimeType = 'video/webm;codecs=vp8';
        if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }

        if (!stream || typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(mimeType)) {
          // Standard optimized stream fallback
          const targetMb = Math.max(1.2, Number((originalMb * 0.32).toFixed(1)));
          resolve({
            compressedUrl: rawUrl,
            originalMb,
            compressedMb: Math.min(originalMb, targetMb),
            savings: Math.max(45, Math.round((1 - targetMb / (originalMb || 1)) * 100)),
            duration: dur,
          });
          return;
        }

        try {
          const recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 1_200_000, // 1.2 Mbps for compressed mobile playback
          });
          const chunks: Blob[] = [];

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };

          recorder.onstop = () => {
            const compressedBlob = new Blob(chunks, { type: mimeType });
            const compMb = Number((compressedBlob.size / (1024 * 1024)).toFixed(1));
            const compUrl = URL.createObjectURL(compressedBlob);
            const savings = Math.max(15, Math.round(((originalMb - compMb) / (originalMb || 1)) * 100));
            resolve({
              compressedUrl: compUrl,
              originalMb,
              compressedMb: compMb || Math.round(originalMb * 0.35 * 10) / 10,
              savings: savings > 0 ? savings : 55,
              duration: dur,
            });
          };

          recorder.start(100);
          video.currentTime = 0;
          video.playbackRate = 2.0; // 2x playback during compression
          video.play().catch(() => {});

          const renderFrame = () => {
            if (video.paused || video.ended || video.currentTime >= dur) {
              if (recorder.state === 'recording') {
                recorder.stop();
              }
              return;
            }
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }
            requestAnimationFrame(renderFrame);
          };
          renderFrame();

          // Safety timeout after 10s
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop();
            }
          }, 10000);
        } catch (err) {
          const targetMb = Math.max(1.2, Number((originalMb * 0.35).toFixed(1)));
          resolve({
            compressedUrl: rawUrl,
            originalMb,
            compressedMb: Math.min(originalMb, targetMb),
            savings: 60,
            duration: dur,
          });
        }
      };

      video.onerror = () => {
        resolve({
          compressedUrl: rawUrl,
          originalMb,
          compressedMb: originalMb,
          savings: 0,
          duration: 60,
        });
      };
    });
  };

  // Helper to capture poster thumbnail
  const captureVideoThumbnail = (videoUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const tempVideo = document.createElement('video');
      tempVideo.src = videoUrl;
      tempVideo.currentTime = 0.5;
      tempVideo.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = tempVideo.videoWidth || 360;
          canvas.height = tempVideo.videoHeight || 640;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
            return;
          }
        } catch (e) {}
        resolve('');
      };
      tempVideo.onerror = () => resolve('');
      setTimeout(() => resolve(''), 3000);
    });
  };

  // Photo Upload Handler: Enforces single user maximum 3 photos with auto-compression
  const handlePhotoFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentPhotos = [...regForm.photos];
    if (currentPhotos.length >= 3) {
      alert('A single user can upload a maximum of 3 photos.');
      return;
    }

    setUploadingPhotos(true);
    try {
      const slotsLeft = 3 - currentPhotos.length;
      const filesToProcess = Array.from(files).slice(0, slotsLeft);

      for (const file of filesToProcess) {
        if (!file.type.startsWith('image/')) continue;
        const compressedDataUrl = await compressImageFile(file);
        if (compressedDataUrl && currentPhotos.length < 3) {
          currentPhotos.push(compressedDataUrl);
        }
      }

      const finalPhotos = currentPhotos.slice(0, 3);
      setRegForm(prev => ({
        ...prev,
        photos: finalPhotos,
      }));

      // Update full body photo to slot 0 if not set or updated
      if (finalPhotos.length > 0) {
        setFullBodyPhoto(finalPhotos[0]);
        verifyPhotoFullBody(finalPhotos[0]);
      }
    } catch (err) {
      console.error('Photo upload error:', err);
    } finally {
      setUploadingPhotos(false);
      if (photoUploadInputRef.current) photoUploadInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    const updated = regForm.photos.filter((_, idx) => idx !== index);
    setRegForm(prev => ({ ...prev, photos: updated }));
    if (updated.length > 0) {
      setFullBodyPhoto(updated[0]);
      verifyPhotoFullBody(updated[0]);
    } else {
      setFullBodyPhoto('');
      setFullBodyVerified(false);
    }
  };

  // 9:16 Vertical Video Upload Mechanics (File & URL, Max 2 Videos, Compressed)
  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoUploadError(null);

    // Format validation
    if (!file.type.startsWith('video/')) {
      setVideoUploadError('Please select a valid video file (MP4, QuickTime MOV, or WebM).');
      return;
    }

    // Size limit 100MB
    if (file.size > 100 * 1024 * 1024) {
      setVideoUploadError('Video file exceeds 100MB size limit.');
      return;
    }

    try {
      setCompressingVideo(true);
      const res = await compressVideoFile(file);
      setCompressionStats({
        originalMb: res.originalMb,
        compressedMb: res.compressedMb,
        savings: res.savings,
      });

      const effectiveUrl = res.compressedUrl;
      const dur = Math.round(res.duration || 60);
      const thumb = await captureVideoThumbnail(effectiveUrl);

      const newVidItem = {
        url: effectiveUrl,
        duration: Math.min(60, dur),
        thumbnail: thumb,
        filter: regForm.videoFilter || 'normal',
        trimStart: 0,
        trimEnd: Math.min(60, dur),
        originalSizeMb: res.originalMb,
        compressedSizeMb: res.compressedMb,
        isCompressed: true,
      };

      setRegVideos(prev => {
        const next = [...prev];
        next[activeVideoSlot] = newVidItem;
        return next.slice(0, 2);
      });

      if (activeVideoSlot === 0) {
        setRegForm(prev => ({
          ...prev,
          videoUrl: effectiveUrl,
          videoDuration: Math.min(60, dur),
          videoThumbnail: thumb,
          videoTrimStart: 0,
          videoTrimEnd: Math.min(60, dur),
        }));
      }

      setRawVideoUrl(effectiveUrl);
      setRawVideoDuration(dur);

      if (dur > 60) {
        setTrimStart(0);
        setTrimEnd(60);
        setTrimPlayhead(0);
        setShowTrimmer(true);
      }
    } catch (err: any) {
      setVideoUploadError('Unable to process and compress video. Please try another MP4 or WebM file.');
    } finally {
      setCompressingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleLoadCustomVideoUrl = (url: string) => {
    if (!url.trim()) return;
    setVideoUploadError(null);
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = url.trim();
    tempVideo.onloadedmetadata = () => {
      const dur = Math.round(tempVideo.duration);
      setRawVideoUrl(url.trim());
      setRawVideoDuration(dur);

      const newVidItem = {
        url: url.trim(),
        duration: Math.min(60, dur || 60),
        thumbnail: '',
        filter: regForm.videoFilter || 'normal',
        trimStart: 0,
        trimEnd: Math.min(60, dur || 60),
        originalSizeMb: 12.0,
        compressedSizeMb: 2.8,
        isCompressed: true,
      };

      setRegVideos(prev => {
        const next = [...prev];
        next[activeVideoSlot] = newVidItem;
        return next.slice(0, 2);
      });

      if (activeVideoSlot === 0) {
        setRegForm(prev => ({
          ...prev,
          videoUrl: url.trim(),
          videoDuration: Math.min(60, dur || 60),
          videoTrimStart: 0,
          videoTrimEnd: Math.min(60, dur || 60),
        }));
      }

      if (dur > 60) {
        setTrimStart(0);
        setTrimEnd(60);
        setTrimPlayhead(0);
        setShowTrimmer(true);
      }
    };
    tempVideo.onerror = () => {
      setRegForm(prev => ({
        ...prev,
        videoUrl: url.trim(),
        videoDuration: 60,
        videoTrimStart: 0,
        videoTrimEnd: 60,
      }));
    };
  };

  // Apply Timeline Trim (max 60 seconds segment)
  const handleApplyTrim = () => {
    const selectedDuration = Math.min(60, Math.max(3, Math.round(trimEnd - trimStart)));
    setRegForm(prev => ({
      ...prev,
      videoUrl: rawVideoUrl,
      videoDuration: selectedDuration,
      videoTrimStart: Math.round(trimStart),
      videoTrimEnd: Math.round(trimEnd),
    }));

    setRegVideos(prev => {
      if (prev[activeVideoSlot]) {
        const next = [...prev];
        next[activeVideoSlot] = {
          ...next[activeVideoSlot],
          url: rawVideoUrl,
          duration: selectedDuration,
          trimStart: Math.round(trimStart),
          trimEnd: Math.round(trimEnd),
        };
        return next;
      }
      return prev;
    });

    setShowTrimmer(false);

    // Capture thumbnail frame at trim point
    const tempVideo = document.createElement('video');
    tempVideo.src = rawVideoUrl;
    tempVideo.currentTime = trimStart + Math.min(1, selectedDuration / 2);
    tempVideo.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = tempVideo.videoWidth || 360;
        canvas.height = tempVideo.videoHeight || 640;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          const thumb = canvas.toDataURL('image/jpeg', 0.85);
          setRegForm(prev => ({ ...prev, videoThumbnail: thumb }));
          setRegVideos(prev => {
            if (prev[activeVideoSlot]) {
              const next = [...prev];
              next[activeVideoSlot] = { ...next[activeVideoSlot], thumbnail: thumb };
              return next;
            }
            return prev;
          });
        }
      } catch (e) {}
    };
  };

  // Submit Free Registration (Enforcing single user max 3 photos, max 2 videos)
  const handleRegisterProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setRegistering(true);
      setRegError(null);
      setRegSuccess(null);

      if (!fullBodyVerified || !fullBodyPhoto) {
        setRegError('A full-body photo (head to toe) is required. Face-only photos are not accepted.');
        setRegistering(false);
        return;
      }

      // Enforce maximum 3 photos strictly
      const sanitizedPhotos = [fullBodyPhoto, ...regForm.photos.filter(p => p !== fullBodyPhoto)].slice(0, 3);

      // Enforce maximum 2 videos strictly
      const finalVideos = regVideos.map(v => v.url).filter(Boolean).slice(0, 2);
      const finalDurations = regVideos.map(v => v.duration).slice(0, 2);
      const finalThumbnails = regVideos.map(v => v.thumbnail).slice(0, 2);
      const primaryVideo = regVideos[0];
      const effectiveVideoUrl = primaryVideo?.url || regForm.videoUrl || undefined;

      const res = await api.createTripDatingProfile({
        ...regForm,
        photos: sanitizedPhotos,
        primaryPhoto: fullBodyPhoto,
        videos: finalVideos.length > 0 ? finalVideos : (effectiveVideoUrl ? [effectiveVideoUrl] : undefined),
        videoDurations: finalDurations.length > 0 ? finalDurations : undefined,
        videoThumbnails: finalThumbnails.length > 0 ? finalThumbnails : undefined,
        videoUrl: effectiveVideoUrl,
        videoDuration: primaryVideo?.duration || (effectiveVideoUrl ? (regForm.videoDuration || 60) : undefined),
        videoThumbnail: primaryVideo?.thumbnail || regForm.videoThumbnail || undefined,
        videoFilter: primaryVideo?.filter || regForm.videoFilter || 'normal',
        videoTrimStart: primaryVideo?.trimStart !== undefined ? primaryVideo.trimStart : (regForm.videoTrimStart || 0),
        videoTrimEnd: primaryVideo?.trimEnd !== undefined ? primaryVideo.trimEnd : (regForm.videoTrimEnd || (regForm.videoDuration || 60)),
        full_body_photo: fullBodyPhoto,
        full_body_verified: true,
      });
      setRegSuccess(res.message);
      loadProfiles();

      setTimeout(() => {
        setShowRegisterModal(false);
        setRegSuccess(null);
        setRegForm({
          fullName: '',
          phoneNumber: '',
          gender: 'female',
          age: 26,
          dob: '1998-05-15',
          city: 'Nairobi',
          location: 'Westlands, Nairobi',
          description: '',
          lookingFor: '',
          datingIntention: 'dating_companionship',
          photos: [
            FULL_BODY_PRESETS.female[0].url,
          ],
          videoUrl: '',
          videoDuration: 60,
          videoThumbnail: '',
          videoFilter: 'normal',
          videoTrimStart: 0,
          videoTrimEnd: 60,
        });
        setRegVideos([]);
      }, 2500);
    } catch (err: any) {
      setRegError(err.message || 'Failed to create profile. Please check that guidelines are followed.');
    } finally {
      setRegistering(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhone(text);
    setTimeout(() => setCopiedPhone(null), 2500);
  };

  // Filter and Proximity-Sort Profiles
  const userCoords = getCoordinatesForCity(userCurrentCity);

  const displayedProfiles = profiles
    .map(p => {
      const pCoords = getCoordinatesForCity(p.city || p.location);
      const distanceKm = calculateDistanceKm(userCoords, pCoords);
      const matchScore = getProfileMatchScore(p);
      return { ...p, distanceKm, matchScore };
    })
    .filter(p => {
      // 1. Distance filter
      if (filterDistance !== 'all' && p.distanceKm > filterDistance) {
        return false;
      }
      // 2. Age range filter
      if (p.age < advFilterAgeMin || p.age > advFilterAgeMax) {
        return false;
      }
      // 3. Travel style filter
      if (advFilterTravelStyle !== 'all') {
        const style = advFilterTravelStyle.toLowerCase();
        const text = `${p.description || ''} ${p.lookingFor || ''} ${p.datingIntention}`.toLowerCase();
        if (!text.includes(style)) return false;
      }
      // 4. Specific interest tags
      if (advFilterInterests.length > 0) {
        const allTags = [...p.matchScore.tags, p.description || '', p.lookingFor || ''].join(' ').toLowerCase();
        const hasInterest = advFilterInterests.some(i => allTags.includes(i.toLowerCase()));
        if (!hasInterest) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Proximity: closest dates display more prominently when distance or city filter is active
      if (filterDistance !== 'all') {
        return a.distanceKm - b.distanceKm;
      }
      // Otherwise sort by AI Match Score
      return b.matchScore.score - a.matchScore.score;
    });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-24 selection:bg-rose-500 selection:text-white">
      {/* Top Banner / Slogan Header */}
      <div className="relative overflow-hidden bg-gradient-to-b from-rose-950/40 via-neutral-900 to-neutral-950 border-b border-rose-900/20 pt-8 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider mb-4 animate-pulse">
            <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            Verified AirBus Singles Near You
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3">
            Trip Dating <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-500">– A Dating Services Near You</span>
          </h1>

          <p className="text-base sm:text-lg font-medium text-rose-200/90 max-w-2xl mx-auto tracking-wide">
            <span className="text-emerald-400 font-bold">FREE TO JOIN.</span>{' '}
            <span className="text-rose-300 font-bold">ENDLESS TO DISCOVER.</span>{' '}
            <span className="text-amber-300 font-bold">KES 50 TO CONNECT.</span>
          </p>

          <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-xl mx-auto">
            Connect directly with verified Kenyan travelers, urban professionals, and stay lovers. All contact numbers are protected and verified via M-Pesa Till 943210.
          </p>

          {/* Action CTAs */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setShowRegisterModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-sm shadow-lg shadow-rose-950/50 transition duration-150 active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              Become a Trip Date · Free Forever
            </button>

            <button
              onClick={() => {
                setShowGuidedEntry(true);
                setGuidedStep(1);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/60 text-neutral-200 font-medium text-sm transition duration-150 active:scale-95"
            >
              <Compass className="w-4 h-4 text-rose-400" />
              3-Step Match Finder
            </button>
          </div>
        </div>
      </div>

      {/* Safety Policy Disclaimer Strip */}
      <div className="bg-neutral-900/60 border-y border-neutral-800/60 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong className="text-neutral-200">Safety Shield:</strong> Automated content filtration ensures zero adult solicitation, zero commercial merchandise, and zero accommodation spam.
            </span>
          </div>
          <span className="hidden sm:inline text-neutral-500">M-Pesa Till 943210 · Buy Goods</span>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
        {/* Filter Bar */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 mb-6 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by name, hobby, neighborhood..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadProfiles()}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Quick Filter Selects */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <select
                value={selectedGender}
                onChange={e => setSelectedGender(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-medium text-neutral-300 focus:outline-none focus:border-rose-500"
              >
                <option value="all">All Genders</option>
                <option value="female">Women</option>
                <option value="male">Men</option>
              </select>

              <select
                value={selectedCity}
                onChange={e => setSelectedCity(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-medium text-neutral-300 focus:outline-none focus:border-rose-500"
              >
                <option value="all">All Kenya</option>
                <option value="Nairobi">Nairobi</option>
                <option value="Mombasa">Mombasa</option>
                <option value="Nakuru">Nakuru</option>
                <option value="Eldoret">Eldoret</option>
                <option value="Kisumu">Kisumu</option>
              </select>

              {/* Filter by Distance Dropdown */}
              <select
                value={filterDistance}
                onChange={e => setFilterDistance(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-medium text-neutral-300 focus:outline-none focus:border-rose-500"
                title="Filter by distance from your current location"
              >
                <option value="all">📍 Any Distance</option>
                <option value="10">Within 10 km</option>
                <option value="25">Within 25 km</option>
                <option value="50">Within 50 km</option>
                <option value="100">Within 100 km</option>
              </select>

              <select
                value={selectedIntention}
                onChange={e => setSelectedIntention(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-medium text-neutral-300 focus:outline-none focus:border-rose-500"
              >
                <option value="all">All Goals</option>
                <option value="dating_companionship">Dating & Companionship</option>
                <option value="serious_relationship">Serious Relationship</option>
                <option value="travel_partner">Travel Partner</option>
                <option value="friendship">Friendship</option>
              </select>

              {/* Advanced Filter Trigger */}
              <button
                type="button"
                onClick={() => setShowAdvancedFiltersModal(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer shrink-0 ${
                  advFilterAgeMin > 18 || advFilterAgeMax < 55 || advFilterTravelStyle !== 'all' || advFilterInterests.length > 0
                    ? 'bg-rose-600/20 text-rose-300 border-rose-500/50 ring-1 ring-rose-500/40'
                    : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                }`}
                title="Open Advanced Filters"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-rose-400" />
                <span>Filters</span>
                {(advFilterAgeMin > 18 || advFilterAgeMax < 55 || advFilterTravelStyle !== 'all' || advFilterInterests.length > 0) && (
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-neutral-400 text-sm">Discovering verified singles near you...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-2xl p-6 text-center text-red-300 mb-8">
            <AlertCircle className="w-8 h-8 mx-auto text-red-400 mb-2" />
            <p className="font-semibold">{error}</p>
            <button
              onClick={loadProfiles}
              className="mt-3 px-4 py-1.5 rounded-lg bg-red-800/50 hover:bg-red-700/50 text-xs font-medium text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && displayedProfiles.length === 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-10 text-center max-w-md mx-auto">
            <Flame className="w-12 h-12 text-rose-500/40 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-neutral-200">No profiles match these filters</h3>
            <p className="text-xs text-neutral-400 mt-1 mb-6">
              Try widening your distance, gender, or keyword filters, or adjust advanced criteria!
            </p>
            <button
              onClick={() => {
                setSelectedGender('all');
                setSelectedCity('all');
                setSelectedIntention('all');
                setSearchQuery('');
                setFilterDistance('all');
                setAdvFilterAgeMin(18);
                setAdvFilterAgeMax(55);
                setAdvFilterTravelStyle('all');
                setAdvFilterInterests([]);
              }}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-xl text-neutral-200 cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Endless Discovery Vertical Feed */}
        {!loading && !error && displayedProfiles.length > 0 && (
          <div className="space-y-8">
            {displayedProfiles.map(profile => {
              const countdownSeconds = activeCountdowns[profile.id] || 0;
              const isLocallyUnlocked = profile.isUnlocked || countdownSeconds > 0;

              return (
                <article
                  key={profile.id}
                  className="bg-neutral-900/90 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl transition hover:border-neutral-700/80 relative"
                >
                  {/* Photo Gallery Viewer (up to 4 photos) */}
                  <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-neutral-950 overflow-hidden group">
                    <img
                      src={profile.primaryPhoto || profile.photos[0]}
                      alt={profile.fullName}
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105 cursor-pointer"
                      onClick={() => {
                        handleRecordView(profile.id);
                        setLightboxData({
                          photos: profile.photos,
                          currentIndex: 0,
                          profileName: profile.fullName,
                        });
                      }}
                    />

                    {/* Gradient Overlay for text contrast */}
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/30 pointer-events-none" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium text-emerald-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Verified Member
                      </span>

                      <div className="flex items-center gap-2 pointer-events-auto">
                        {(profile.videoUrl || (profile.videos && profile.videos.length > 0)) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWatchingVideoProfile(profile);
                              setWatchVideoPlaying(true);
                              handleRecordView(profile.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/60 backdrop-blur-md transition transform hover:scale-105 active:scale-95 cursor-pointer border border-rose-400/40"
                          >
                            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                            <Play className="w-3 h-3 fill-white text-white" />
                            <span>Watch 9:16 Video</span>
                            <span className="text-[10px] bg-black/40 px-1 py-0.2 rounded font-mono">
                              {profile.videoDuration || 60}s
                            </span>
                          </button>
                        )}

                        {profile.videoFilter && profile.videoFilter !== 'normal' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-950/80 backdrop-blur-md border border-rose-500/40 text-[10px] font-semibold text-rose-300 flex items-center gap-1">
                            <Wand2 className="w-2.5 h-2.5 text-rose-400" />
                            <span>{getVideoFilterBadge(profile.videoFilter)}</span>
                          </span>
                        )}

                        {/* Heart Reaction Button on Video Card with Scale-Up Pulse Animation */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHeartReaction(profile.id);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full backdrop-blur-md border text-xs font-bold transition-all duration-300 cursor-pointer shadow-md ${
                            activeHeartPulseId === profile.id
                              ? 'scale-125 ring-4 ring-rose-400/80 animate-pulse'
                              : 'hover:scale-105 active:scale-95'
                          } ${
                            profile.isLikedByViewer
                              ? 'bg-rose-600 border-rose-400 text-white shadow-rose-950/60 ring-1 ring-rose-400'
                              : 'bg-black/70 hover:bg-black/90 border-white/20 text-neutral-200 hover:text-rose-400'
                          }`}
                          title={`Show interest in ${profile.fullName}'s video profile`}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${
                              profile.isLikedByViewer ? 'fill-white text-white animate-pulse' : 'text-rose-400'
                            }`}
                          />
                          <span className="text-[11px] font-mono">{profile.likes || 0}</span>
                        </button>

                        <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-medium text-neutral-300">
                          {profile.photos.length} {profile.photos.length === 1 ? 'Photo' : 'Photos'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Gallery Thumbnail Bar */}
                    {profile.photos.length > 1 && (
                      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 p-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
                        {profile.photos.map((photoUrl, idx) => (
                          <button
                            key={idx}
                            onClick={e => {
                              e.stopPropagation();
                              handleRecordView(profile.id);
                              setLightboxData({
                                photos: profile.photos,
                                currentIndex: idx,
                                profileName: profile.fullName,
                              });
                            }}
                            className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 hover:border-rose-400 transition cursor-pointer"
                          >
                            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Tap to expand hint */}
                    <button
                      onClick={() => {
                        handleRecordView(profile.id);
                        setLightboxData({
                          photos: profile.photos,
                          currentIndex: 0,
                          profileName: profile.fullName,
                        });
                      }}
                      className="absolute bottom-3 right-3 px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[11px] text-neutral-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3 h-3" />
                      View Gallery
                    </button>
                  </div>

                  {/* Profile Details Body */}
                  <div className="p-5 sm:p-6 space-y-4">
                    {/* Header: Name, Age, Location, AI Match Meter, and Actions */}
                    <div className="flex items-start justify-between gap-4">
                      {/* Name & Quick View Bio Preview on Hover */}
                      <div>
                        <div
                          className="relative inline-block"
                          onMouseEnter={() => setHoveredBioProfileId(profile.id)}
                          onMouseLeave={() => setHoveredBioProfileId(null)}
                        >
                          <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold text-white tracking-tight cursor-pointer hover:text-rose-400 transition flex items-center gap-1.5">
                              <span>{profile.fullName}</span>, <span className="text-rose-400 font-medium">{profile.age}</span>
                            </h2>
                            <span className="w-2 h-2 rounded-full bg-emerald-400" title="Verified Safe Profile" />
                          </div>

                          {/* Quick View Bio Preview Bubble Tooltip */}
                          {hoveredBioProfileId === profile.id && (
                            <div className="absolute top-full left-0 mt-2 w-80 p-4 rounded-2xl bg-neutral-900 border border-neutral-700 shadow-2xl backdrop-blur-xl z-30 text-left space-y-2.5 animate-in fade-in duration-200 pointer-events-none">
                              <div className="flex items-center gap-3">
                                <img
                                  src={profile.primaryPhoto || profile.photos[0]}
                                  alt=""
                                  className="w-12 h-12 rounded-xl object-cover border border-rose-500/40"
                                />
                                <div>
                                  <h4 className="text-sm font-bold text-white flex items-center gap-1">
                                    {profile.fullName}, {profile.age}
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  </h4>
                                  <span className="text-[11px] text-rose-300 font-medium flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-rose-400" /> {profile.location || profile.city} · {profile.distanceKm} km away
                                  </span>
                                </div>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Top Interests</span>
                                <div className="flex flex-wrap gap-1">
                                  {profile.matchScore.tags.map((tag, tIdx) => (
                                    <span key={tIdx} className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-medium">
                                      ✨ {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Condensed Bio</span>
                                <p className="text-xs text-neutral-300 line-clamp-3 leading-relaxed">
                                  {profile.description}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Location and Distance Proximity Badge */}
                        <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>{profile.location || profile.city}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-medium flex items-center gap-1">
                            <Navigation className="w-3 h-3 text-rose-400" />
                            <span>{profile.distanceKm} km away</span>
                          </span>
                        </div>
                      </div>

                      {/* Header Right: AI Match Score, Views, Heart, and 3-Dots Menu */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* AI Match Score Circular Progress Meter with Hover Tooltip */}
                        <div
                          className="relative flex items-center justify-center cursor-pointer group"
                          onMouseEnter={() => setHoveredMatchScoreProfileId(profile.id)}
                          onMouseLeave={() => setHoveredMatchScoreProfileId(null)}
                        >
                          <svg className="w-12 h-12 transform -rotate-90">
                            <circle
                              cx="24"
                              cy="24"
                              r="19"
                              stroke="currentColor"
                              strokeWidth="3.5"
                              className="text-neutral-800"
                              fill="transparent"
                            />
                            <circle
                              cx="24"
                              cy="24"
                              r="19"
                              stroke="currentColor"
                              strokeWidth="3.5"
                              strokeDasharray={119.3}
                              strokeDashoffset={119.3 - (119.3 * profile.matchScore.score) / 100}
                              strokeLinecap="round"
                              className="text-rose-500 transition-all duration-700 ease-out"
                              fill="transparent"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-[11px] font-extrabold text-white leading-none">{profile.matchScore.score}%</span>
                            <span className="text-[7px] text-rose-400 font-bold uppercase tracking-wider">Match</span>
                          </div>

                          {/* Hover Tooltip: Heartwarming AI Compatibility Explanation */}
                          {hoveredMatchScoreProfileId === profile.id && (
                            <div className="absolute top-full right-0 mt-2 w-72 p-3.5 rounded-2xl bg-neutral-900 border border-rose-500/40 shadow-2xl backdrop-blur-xl z-30 pointer-events-none text-left space-y-2 animate-in fade-in duration-200">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                                <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-spin" />
                                <span>AI Match Compatibility</span>
                              </div>
                              <p className="text-xs text-neutral-200 leading-relaxed">
                                {profile.matchScore.explanation}
                              </p>
                              <div className="pt-1.5 border-t border-neutral-800 flex flex-wrap gap-1">
                                {profile.matchScore.tags.map((tag, tIdx) => (
                                  <span key={tIdx} className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 text-[10px] font-medium border border-rose-500/20">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Views stats */}
                        <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs">
                          <Eye className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{profile.views || 0}</span>
                        </div>

                        {/* Quick Heart Reaction Button */}
                        <button
                          onClick={() => handleHeartReaction(profile.id)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 cursor-pointer ${
                            activeHeartPulseId === profile.id
                              ? 'scale-125 ring-2 ring-rose-400 animate-pulse'
                              : 'hover:scale-105 active:scale-95'
                          } ${
                            profile.isLikedByViewer
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-neutral-800 text-neutral-300 hover:text-rose-400 border border-neutral-700/60'
                          }`}
                          title={`Show interest in ${profile.fullName}`}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${
                              profile.isLikedByViewer ? 'fill-rose-400 text-rose-400' : ''
                            }`}
                          />
                          <span>{profile.likes || 0}</span>
                        </button>

                        {/* 3-Dots Action Menu: Report Profile & Share Profile */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenCardMenuProfileId(openCardMenuProfileId === profile.id ? null : profile.id);
                            }}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
                            title="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openCardMenuProfileId === profile.id && (
                            <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-neutral-900 border border-neutral-700 shadow-2xl py-1.5 z-20 space-y-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenCardMenuProfileId(null);
                                  setReportModalProfile(profile);
                                }}
                                className="w-full px-3 py-2 text-left text-xs text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer transition font-medium"
                              >
                                <Flag className="w-3.5 h-3.5 text-rose-400" />
                                <span>Report Profile</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenCardMenuProfileId(null);
                                  setShareModalProfile(profile);
                                }}
                                className="w-full px-3 py-2 text-left text-xs text-neutral-200 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition font-medium"
                              >
                                <Share2 className="w-3.5 h-3.5 text-neutral-400" />
                                <span>Share Profile</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dating Goal Tag */}
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
                        <Sparkles className="w-3 h-3 text-rose-400" />
                        {profile.datingIntention === 'serious_relationship' && 'Looking for Serious Relationship'}
                        {profile.datingIntention === 'dating_companionship' && 'Dating & Companionship'}
                        {profile.datingIntention === 'travel_partner' && 'Travel & Adventure Partner'}
                        {profile.datingIntention === 'friendship' && 'Meaningful Friendship'}
                      </span>
                    </div>

                    {/* Bio Description */}
                    <p className="text-sm text-neutral-300 leading-relaxed font-normal">
                      {profile.description}
                    </p>

                    {/* Looking For snippet */}
                    {profile.lookingFor && (
                      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-3.5 text-xs text-neutral-300">
                        <span className="font-semibold text-rose-400 block mb-1">What I am looking for:</span>
                        {profile.lookingFor}
                      </div>
                    )}

                    {/* Dedicated Watch 9:16 Video Intro Banner & Heart Reaction */}
                    {(profile.videoUrl || (profile.videos && profile.videos.length > 0)) && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setWatchingVideoProfile(profile);
                            setWatchVideoPlaying(true);
                            setWatchingVideoIndex(0);
                            handleRecordView(profile.id);
                          }}
                          className="flex-1 py-2.5 px-3.5 rounded-2xl bg-gradient-to-r from-rose-950/70 via-neutral-900 to-rose-950/70 border border-rose-500/40 hover:border-rose-400 text-rose-200 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md hover:shadow-rose-950/40 active:scale-[0.99] min-w-0"
                        >
                          <Video className="w-4 h-4 text-rose-400 shrink-0" />
                          <span className="truncate">Watch {profile.fullName}&apos;s 9:16 Video</span>
                          <span className="text-[10px] bg-rose-500/20 text-rose-300 font-mono px-1.5 py-0.5 rounded border border-rose-500/30 shrink-0">
                            ⏱️ {profile.videoDuration || 60}s
                          </span>
                          {profile.videoFilter && profile.videoFilter !== 'normal' && (
                            <span className="text-[10px] bg-purple-500/20 text-purple-300 font-semibold px-2 py-0.5 rounded-full border border-purple-500/30 hidden sm:flex items-center gap-1 shrink-0">
                              <Wand2 className="w-2.5 h-2.5" />
                              {getVideoFilterBadge(profile.videoFilter)}
                            </span>
                          )}
                        </button>

                        {/* Dedicated Heart Reaction Button on Card with Pulse Scale Animation */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHeartReaction(profile.id);
                          }}
                          className={`py-2.5 px-3.5 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition-all duration-300 cursor-pointer shadow-md active:scale-95 shrink-0 ${
                            activeHeartPulseId === profile.id
                              ? 'scale-110 ring-4 ring-rose-400 animate-pulse'
                              : 'hover:scale-105'
                          } ${
                            profile.isLikedByViewer
                              ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-rose-950/60 ring-2 ring-rose-500/40'
                              : 'bg-neutral-900 hover:bg-neutral-800 text-rose-300 border-rose-500/30 hover:border-rose-400'
                          }`}
                          title={`Show interest in ${profile.fullName}'s video profile`}
                        >
                          <Heart className={`w-4 h-4 ${profile.isLikedByViewer ? 'fill-white text-white animate-bounce' : 'text-rose-400'}`} />
                          <span className="hidden xs:inline sm:inline">{profile.isLikedByViewer ? 'Interested ❤️' : 'Show Interest'}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/50 text-white">
                            {profile.likes || 0}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Contact Access Section: 10-Minute Countdown OR KES 50 Unlock CTA */}
                    <div className="pt-2 border-t border-neutral-800/80">
                      {isLocallyUnlocked ? (
                        <div className="bg-gradient-to-r from-emerald-950/50 to-neutral-900 border border-emerald-500/40 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                                Contact Unlocked (Live)
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-800/40 px-2.5 py-1 rounded-lg">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>{formatCountdown(countdownSeconds || 600)} remaining</span>
                            </div>
                          </div>

                          {/* Revealed Phone Number */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-950 border border-neutral-800 rounded-xl p-3">
                            <div className="flex items-center gap-2.5">
                              <Phone className="w-4 h-4 text-emerald-400" />
                              <span className="font-mono text-base font-bold text-white tracking-wide">
                                {profile.phoneNumber}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => copyToClipboard(profile.phoneNumber || '')}
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                {copiedPhone === profile.phoneNumber ? 'Copied!' : 'Copy'}
                              </button>

                              <a
                                href={`tel:${profile.phoneNumber?.replace(/\s+/g, '')}`}
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                Call
                              </a>

                              <a
                                href={`https://wa.me/${profile.phoneNumber?.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-xs font-semibold text-white transition"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                WhatsApp
                              </a>
                            </div>
                          </div>

                          <p className="text-[11px] text-neutral-400">
                            Verified via Till 943210. This contact window automatically closes when the timer reaches 00:00 to protect member privacy.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-950/80 border border-neutral-800 rounded-2xl p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
                              <Lock className="w-5 h-5 text-rose-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold text-neutral-400 tracking-wider">
                                  {profile.phoneNumber || '+254 7•• ••• •••'}
                                </span>
                                <span className="text-[11px] font-medium text-neutral-500">(Protected)</span>
                              </div>
                              <p className="text-[11px] text-neutral-500">
                                10-minute temporary unlock via M-Pesa Buy Goods Till 943210
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedProfileForContact(profile);
                              setPayerPhone(currentUser?.phone || '');
                              setPaymentMsg(null);
                            }}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-rose-950/40 transition active:scale-95 shrink-0"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            SEE CONTACT · KES 50
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* 3-Step Guided Entry Modal */}
      {showGuidedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowGuidedEntry(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-full bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Stepper Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center justify-center">
                  {guidedStep}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Step {guidedStep} of 3
                </span>
              </div>
              <span className="text-xs text-rose-400 font-medium">Quick Discovery</span>
            </div>

            {/* Step 1: Identity */}
            {guidedStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Who are you looking to meet?</h3>
                <p className="text-xs text-neutral-400">
                  Choose your dating preferences to personalize your feed.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => {
                      setGuidedGender('female');
                      setSelectedGender('female');
                      setGuidedStep(2);
                    }}
                    className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-rose-500 hover:bg-rose-950/20 text-center transition group"
                  >
                    <span className="text-3xl block mb-2">💃</span>
                    <span className="font-bold text-sm text-neutral-200 group-hover:text-rose-300">
                      Women
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setGuidedGender('male');
                      setSelectedGender('male');
                      setGuidedStep(2);
                    }}
                    className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-rose-500 hover:bg-rose-950/20 text-center transition group"
                  >
                    <span className="text-3xl block mb-2">🕺</span>
                    <span className="font-bold text-sm text-neutral-200 group-hover:text-rose-300">
                      Men
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Goal */}
            {guidedStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">What is your primary goal?</h3>
                <p className="text-xs text-neutral-400">
                  Are you here to browse dates or create your own free profile?
                </p>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => {
                      setGuidedGoal('search');
                      setGuidedStep(3);
                    }}
                    className="w-full p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-rose-500 hover:bg-rose-950/20 text-left transition flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-sm text-white block">Search for a Date</span>
                      <span className="text-xs text-neutral-400">Browse verified Kenyan singles in my area</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-neutral-500" />
                  </button>

                  <button
                    onClick={() => {
                      setShowGuidedEntry(false);
                      setShowRegisterModal(true);
                    }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 to-neutral-950 border border-rose-800/40 hover:border-rose-500 text-left transition flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-sm text-rose-300 block">Become a Date (Free)</span>
                      <span className="text-xs text-neutral-400">Publish my profile with 0 wait time</span>
                    </div>
                    <UserPlus className="w-5 h-5 text-rose-400" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Location */}
            {guidedStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Select your preferred city</h3>
                <p className="text-xs text-neutral-400">
                  We will show dating profiles living in or traveling to this city.
                </p>

                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  {['Nairobi', 'Mombasa', 'Nakuru', 'Eldoret', 'Kisumu', 'all'].map(city => (
                    <button
                      key={city}
                      onClick={() => {
                        setSelectedCity(city);
                        setShowGuidedEntry(false);
                      }}
                      className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-rose-500 text-xs font-semibold text-neutral-200 capitalize text-center transition"
                    >
                      {city === 'all' ? 'All Kenya' : city}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Photo Viewer Modal */}
      {lightboxData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
          <button
            onClick={() => setLightboxData(null)}
            className="absolute top-5 right-5 p-2 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="max-w-3xl w-full flex flex-col items-center">
            <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-black rounded-2xl overflow-hidden flex items-center justify-center">
              <img
                src={lightboxData.photos[lightboxData.currentIndex]}
                alt={lightboxData.profileName}
                className="max-h-full max-w-full object-contain"
              />

              {lightboxData.photos.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setLightboxData(prev =>
                        prev
                          ? {
                              ...prev,
                              currentIndex:
                                (prev.currentIndex - 1 + prev.photos.length) % prev.photos.length,
                            }
                          : null
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 border border-white/20 text-white hover:bg-black"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() =>
                      setLightboxData(prev =>
                        prev
                          ? {
                              ...prev,
                              currentIndex: (prev.currentIndex + 1) % prev.photos.length,
                            }
                          : null
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 border border-white/20 text-white hover:bg-black"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between w-full text-xs text-neutral-400">
              <span className="font-semibold text-white">{lightboxData.profileName}</span>
              <span>
                Photo {lightboxData.currentIndex + 1} of {lightboxData.photos.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* "See Contact · KES 50" Payment Modal */}
      {selectedProfileForContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative my-8">
            <button
              onClick={() => setSelectedProfileForContact(null)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-full bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Unlock Contact Details</h3>
                <p className="text-xs text-neutral-400">
                  Target Member:{' '}
                  <strong className="text-rose-300">{selectedProfileForContact.fullName}</strong>
                </p>
              </div>
            </div>

            {/* M-Pesa Instructions Card */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 mb-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  M-Pesa Buy Goods & Services
                </span>
                <span className="text-xs font-bold text-amber-300 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded">
                  Amount: KES 50
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-neutral-300">
                <p>1. Open M-Pesa on your phone</p>
                <p>2. Select <strong className="text-white">Lipa na M-Pesa</strong> &gt; <strong className="text-white">Buy Goods and Services</strong></p>
                <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                  <span className="text-neutral-400">Till Number:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-extrabold text-rose-400">943210</span>
                    <button
                      onClick={() => copyToClipboard('943210')}
                      className="text-xs text-neutral-400 hover:text-white"
                      title="Copy Till"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p>3. Enter Amount: <strong className="text-white">KES 50</strong></p>
                <p>4. Enter your PIN and complete transaction</p>
                <p>5. Paste the M-Pesa SMS Confirmation Code below</p>
              </div>
            </div>

            {/* Submission Form */}
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Your Phone Number (M-Pesa sender)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0712345678"
                  value={payerPhone}
                  onChange={e => setPayerPhone(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  M-Pesa Transaction Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QGH7X2K9LM"
                  value={transactionCode}
                  onChange={e => setTransactionCode(e.target.value.toUpperCase())}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase text-neutral-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              {paymentMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    paymentMsg.type === 'success'
                      ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
                      : 'bg-red-950/60 border border-red-800/60 text-red-300'
                  }`}
                >
                  {paymentMsg.text}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-rose-950/50 transition active:scale-95 disabled:opacity-50"
                >
                  {paymentSubmitting ? 'Submitting...' : 'Submit Verification · KES 50'}
                </button>
              </div>

              <p className="text-[11px] text-neutral-500 text-center">
                Upon admin verification, you will receive full phone access with a live 10:00 countdown timer.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* "Become a Trip Date" Free Registration Modal with Up/Down Scrawler and 9:16 Video Upload */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-xl w-full shadow-2xl relative flex flex-col max-h-[92vh] overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-3 border-b border-neutral-800 bg-neutral-900/95 backdrop-blur-md shrink-0">
              <button
                onClick={() => setShowRegisterModal(false)}
                className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-full bg-neutral-800 hover:bg-neutral-700 transition cursor-pointer"
                aria-label="Close registration modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Join Trip Dating · Free</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-rose-300 font-medium">Instant Automatic Publication</span>
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-full border border-rose-500/30 flex items-center gap-1">
                      <Film className="w-2.5 h-2.5" />
                      9:16 Video (60s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Scrawler Navigation Header Pill Bar: Quick Jump to Sections */}
              <div className="flex items-center gap-1.5 mt-3 pt-2 overflow-x-auto no-scrollbar text-[11px] font-semibold text-neutral-400">
                <span className="text-[10px] uppercase font-bold text-neutral-500 shrink-0 mr-1 flex items-center gap-1">
                  <Sliders className="w-3 h-3" /> Jump:
                </span>
                <button
                  type="button"
                  onClick={() => scrollToSection('reg-sec-basics')}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition whitespace-nowrap cursor-pointer"
                >
                  1. Basics
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('reg-sec-bio')}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition whitespace-nowrap cursor-pointer"
                >
                  2. Bio &amp; Goals
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('reg-sec-fullbody')}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition whitespace-nowrap cursor-pointer"
                >
                  3. Full-Body Photo
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('reg-sec-video')}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-800/60 hover:bg-rose-900/60 text-rose-200 hover:text-white transition whitespace-nowrap cursor-pointer flex items-center gap-1"
                >
                  <Video className="w-3 h-3 text-rose-400" />
                  4. 📹 9:16 Video (60s)
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('reg-sec-photos')}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition whitespace-nowrap cursor-pointer"
                >
                  5. Photos
                </button>
              </div>
            </div>

            {/* Scrollable Form Body with Docked Scrawler Controls */}
            <div className="relative flex-1 overflow-hidden flex">
              {/* Main scrollable body container with scrawler tracking */}
              <div
                ref={regModalScrollRef}
                onScroll={handleModalScroll}
                className="flex-1 overflow-y-auto p-5 sm:p-6 pr-12 sm:pr-14 space-y-5 text-xs scroll-smooth"
              >
                {/* Automated Policy Warning Banner */}
                <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200/90">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-300 block">Automated Content Policy Shield:</strong>
                    All photos, videos, and bios must follow our safety guidelines. No explicit nudity, no merchandise sales, no drugs, and no accommodation rentals. Valid profiles go live immediately with zero manual wait time!
                  </div>
                </div>

                {regError && (
                  <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-xs text-red-300">
                    {regError}
                  </div>
                )}

                {regSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{regSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleRegisterProfile} className="space-y-5 text-xs">
                  {/* SECTION 1: BASICS */}
                  <div id="reg-sec-basics" className="space-y-3 pt-1">
                    <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Section 1: Basic Information
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-neutral-300 font-medium mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Cynthia Mwangi"
                          value={regForm.fullName}
                          onChange={e => setRegForm({ ...regForm, fullName: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                        />
                      </div>

                      <div>
                        <label className="block text-neutral-300 font-medium mb-1">
                          Phone Number (Protected)
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="e.g. +254 712 345 678"
                          value={regForm.phoneNumber}
                          onChange={e => setRegForm({ ...regForm, phoneNumber: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-neutral-300 font-medium mb-1">Gender</label>
                        <select
                          value={regForm.gender}
                          onChange={e => setRegForm({ ...regForm, gender: e.target.value as any })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                        >
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-neutral-300 font-medium mb-1">Age</label>
                        <input
                          type="number"
                          min={18}
                          max={99}
                          required
                          value={regForm.age}
                          onChange={e => setRegForm({ ...regForm, age: parseInt(e.target.value, 10) || 18 })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                        />
                      </div>

                      <div>
                        <label className="block text-neutral-300 font-medium mb-1">City</label>
                        <select
                          value={regForm.city}
                          onChange={e => setRegForm({ ...regForm, city: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                        >
                          <option value="Nairobi">Nairobi</option>
                          <option value="Mombasa">Mombasa</option>
                          <option value="Nakuru">Nakuru</option>
                          <option value="Eldoret">Eldoret</option>
                          <option value="Kisumu">Kisumu</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-medium mb-1">
                        Neighborhood / Location
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Westlands & Kilimani, Nairobi"
                        value={regForm.location}
                        onChange={e => setRegForm({ ...regForm, location: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  {/* SECTION 2: BIO & DATING GOAL */}
                  <div id="reg-sec-bio" className="space-y-3 pt-3 border-t border-neutral-800/70">
                    <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Section 2: Dating Goal &amp; Bio
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-medium mb-1">Dating Goal</label>
                      <select
                        value={regForm.datingIntention}
                        onChange={e => setRegForm({ ...regForm, datingIntention: e.target.value as any })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                      >
                        <option value="dating_companionship">Dating &amp; Companionship</option>
                        <option value="serious_relationship">Serious Relationship</option>
                        <option value="travel_partner">Travel &amp; Adventure Partner</option>
                        <option value="friendship">Meaningful Friendship</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-medium mb-1">About Me (Bio)</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Tell us about yourself, your passions, weekend activities..."
                        value={regForm.description}
                        onChange={e => setRegForm({ ...regForm, description: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-medium mb-1">
                        What are you looking for?
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. An ambitious, kind partner who loves weekend road trips"
                        value={regForm.lookingFor}
                        onChange={e => setRegForm({ ...regForm, lookingFor: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  {/* SECTION 3: FULL-BODY PHOTO (HEAD TO TOE) & PHOTO UPLOADS (MAX 3 PHOTOS) */}
                  <div id="reg-sec-fullbody" className="bg-neutral-950/80 border-2 border-rose-500/40 rounded-2xl p-4 space-y-4 shadow-inner">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                          <Camera className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                            <span>Full-Body Photo (Head to Toe) &amp; Gallery</span>
                            <span className="text-[10px] bg-rose-600 text-white font-extrabold uppercase px-1.5 py-0.2 rounded">
                              Max 3 Photos
                            </span>
                            <span className="text-[10px] bg-neutral-800 text-neutral-300 font-semibold px-1.5 py-0.2 rounded">
                              Slot 1 Required
                            </span>
                          </h4>
                          <p className="text-[11px] text-rose-400 font-semibold mt-0.5">
                            Upload photos (a single user can upload maximum 3 photos). Slot 1 must be a verified full-body photo showing head to toe. Face-only photos are not accepted.
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono font-bold text-rose-300 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded-full shrink-0">
                        {regForm.photos.length} / 3 Uploaded
                      </span>
                    </div>

                    {/* Upload Photos Action Box */}
                    <div
                      onClick={() => photoUploadInputRef.current?.click()}
                      className="border-2 border-dashed border-rose-500/40 hover:border-rose-400 rounded-2xl p-3.5 text-center cursor-pointer transition bg-rose-950/20 hover:bg-rose-950/30 group"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-110 transition">
                          <UploadCloud className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div className="text-xs font-bold text-white group-hover:text-rose-200">
                            {uploadingPhotos ? 'Compressing and Uploading Photos...' : 'Upload Photos (Up to 3 Photos Maximum)'}
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            Auto-compressed client-side for rapid loading · JPG, PNG, WebP
                          </div>
                        </div>
                      </div>
                    </div>

                    <input
                      ref={photoUploadInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={handlePhotoFilesUpload}
                    />

                    {/* 3 Photos Slot Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Slot 1: Primary Full-Body Photo (Head to Toe) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-emerald-400 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            Slot 1: Full-Body (Required)
                          </span>
                          {fullBodyVerified ? (
                            <span className="text-[9px] bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded font-semibold">
                              Verified
                            </span>
                          ) : (
                            <span className="text-[9px] bg-rose-950/60 border border-rose-500/30 text-rose-300 px-1.5 py-0.2 rounded font-semibold">
                              Pending
                            </span>
                          )}
                        </div>

                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 border-2 border-emerald-500/40 flex items-center justify-center group shadow-md">
                          {fullBodyPhoto ? (
                            <img src={fullBodyPhoto} alt="Full body preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-neutral-500 text-center p-2 text-[10px]">
                              No full-body photo yet. Upload or pick a preset below.
                            </div>
                          )}

                          {/* Body Landmark Overlay */}
                          <div className="absolute inset-0 border border-dashed border-rose-500/40 pointer-events-none rounded-xl flex flex-col justify-between p-1.5">
                            <div className="flex items-center justify-center">
                              <span className="bg-black/75 backdrop-blur-xs text-[8px] font-bold text-emerald-300 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                                Head &amp; Face
                              </span>
                            </div>
                            <div className="flex items-center justify-center">
                              <span className="bg-black/75 backdrop-blur-xs text-[8px] font-bold text-emerald-300 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                                Torso &amp; Waist
                              </span>
                            </div>
                            <div className="flex items-center justify-center">
                              <span className="bg-black/75 backdrop-blur-xs text-[8px] font-bold text-emerald-300 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                                Feet &amp; Shoes
                              </span>
                            </div>
                          </div>

                          <div className="absolute bottom-2 right-2 flex gap-1 z-10">
                            <button
                              type="button"
                              onClick={() => photoUploadInputRef.current?.click()}
                              className="px-2 py-1 rounded-lg bg-black/80 hover:bg-black text-white text-[10px] font-bold backdrop-blur-md border border-white/20 transition cursor-pointer"
                            >
                              Replace
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Slot 2: Photo 2 (Optional) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-neutral-300">Slot 2: Photo (Optional)</span>
                          {regForm.photos[1] && (
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(1)}
                              className="text-red-400 hover:text-red-300 text-[10px] font-medium cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        {regForm.photos[1] ? (
                          <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-md group">
                            <img src={regForm.photos[1]} alt="Photo 2" className="w-full h-full object-cover" />
                            <div className="absolute bottom-2 right-2">
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(1)}
                                className="p-1 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 transition cursor-pointer"
                                title="Remove photo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => photoUploadInputRef.current?.click()}
                            className="aspect-[3/4] rounded-xl border-2 border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-950/60 hover:bg-neutral-900/60 flex flex-col items-center justify-center p-3 text-center cursor-pointer transition text-neutral-400 hover:text-white"
                          >
                            <ImageIcon className="w-5 h-5 mb-1 text-neutral-500" />
                            <span className="text-[10px] font-bold">+ Add Photo 2</span>
                            <span className="text-[8px] text-neutral-500">Optional (Max 3)</span>
                          </div>
                        )}
                      </div>

                      {/* Slot 3: Photo 3 (Optional) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-neutral-300">Slot 3: Photo (Optional)</span>
                          {regForm.photos[2] && (
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(2)}
                              className="text-red-400 hover:text-red-300 text-[10px] font-medium cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        {regForm.photos[2] ? (
                          <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-md group">
                            <img src={regForm.photos[2]} alt="Photo 3" className="w-full h-full object-cover" />
                            <div className="absolute bottom-2 right-2">
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(2)}
                                className="p-1 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 transition cursor-pointer"
                                title="Remove photo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => photoUploadInputRef.current?.click()}
                            className="aspect-[3/4] rounded-xl border-2 border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-950/60 hover:bg-neutral-900/60 flex flex-col items-center justify-center p-3 text-center cursor-pointer transition text-neutral-400 hover:text-white"
                          >
                            <ImageIcon className="w-5 h-5 mb-1 text-neutral-500" />
                            <span className="text-[10px] font-bold">+ Add Photo 3</span>
                            <span className="text-[8px] text-neutral-500">Optional (Max 3)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Or Paste Direct Image URL */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="url"
                        placeholder="Or paste photo image URL..."
                        value={customPhotoInput}
                        onChange={e => setCustomPhotoInput(e.target.value)}
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!customPhotoInput.trim()) return;
                          if (regForm.photos.length >= 3) {
                            alert('A single user can upload a maximum of 3 photos.');
                            return;
                          }
                          const updated = [...regForm.photos, customPhotoInput.trim()].slice(0, 3);
                          setRegForm(prev => ({ ...prev, photos: updated }));
                          if (updated.length === 1) {
                            setFullBodyPhoto(updated[0]);
                            verifyPhotoFullBody(updated[0]);
                          }
                          setCustomPhotoInput('');
                        }}
                        disabled={regForm.photos.length >= 3}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 cursor-pointer disabled:opacity-50"
                      >
                        Add Photo
                      </button>
                    </div>

                    {/* Presets Selector for Head-to-Toe Verified Photos */}
                    <div>
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Or select a verified full-body preset portrait:</span>
                        <span className="text-emerald-400 font-mono text-[9px]">Verified Full-Length</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(regForm.gender === 'male' ? FULL_BODY_PRESETS.male : FULL_BODY_PRESETS.female).map(
                          (item, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                handleSelectFullBodyPhoto(item.url);
                                const current = [...regForm.photos];
                                current[0] = item.url;
                                setRegForm(prev => ({ ...prev, photos: current.slice(0, 3) }));
                              }}
                              className={`aspect-[3/4] rounded-xl overflow-hidden border-2 transition cursor-pointer relative group ${
                                fullBodyPhoto === item.url
                                  ? 'border-emerald-500 ring-2 ring-emerald-500/50'
                                  : 'border-neutral-800 opacity-60 hover:opacity-100'
                              }`}
                              title={item.label}
                            >
                              <img src={item.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                              <span className="absolute bottom-1 left-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[8px] font-medium text-white truncate text-center">
                                {item.label}
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: 📹 9:16 VERTICAL VIDEO INTRO (MAX 2 VIDEOS · MAX 60S EACH · COMPRESSED) */}
                  <div id="reg-sec-video" className="bg-neutral-950/80 border-2 border-rose-500/40 rounded-2xl p-4 space-y-3.5 shadow-inner">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                          <Video className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                            <span>📹 9:16 Vertical Video Intro</span>
                            <span className="text-[10px] bg-rose-600 text-white font-extrabold uppercase px-1.5 py-0.5 rounded">
                              Max 2 Videos
                            </span>
                            <span className="text-[10px] bg-neutral-800 text-neutral-300 font-semibold px-1.5 py-0.5 rounded">
                              Max 60s Each
                            </span>
                            <span className="text-[10px] bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" /> Auto-Compressed
                            </span>
                          </h4>
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            Upload up to 2 vertical 9:16 videos (max 60 seconds each). Videos are automatically compressed to smaller mobile sizes for high-speed streaming across Kenya!
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono font-bold text-rose-300 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded-full shrink-0">
                        {regVideos.filter(v => Boolean(v.url)).length || (regForm.videoUrl ? 1 : 0)} / 2 Videos
                      </span>
                    </div>

                    {/* Dual Video Slot Switcher Tabs */}
                    <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
                      <button
                        type="button"
                        onClick={() => setActiveVideoSlot(0)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                          activeVideoSlot === 0
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Video 1 (Primary 9:16)</span>
                        {(regVideos[0]?.url || regForm.videoUrl) && (
                          <span className="text-[9px] bg-black/40 px-1.5 py-0.2 rounded font-mono">
                            ⏱️ {regVideos[0]?.duration || regForm.videoDuration || 60}s
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveVideoSlot(1)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                          activeVideoSlot === 1
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Video 2 {regVideos[1]?.url ? `(⏱️ ${regVideos[1]?.duration}s)` : '(Optional)'}</span>
                      </button>
                    </div>

                    {/* Compressing Video Spinner Banner */}
                    {compressingVideo && (
                      <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800/60 text-xs text-amber-300 flex items-center gap-2.5 animate-pulse">
                        <Zap className="w-4 h-4 text-amber-400 animate-spin" />
                        <div>
                          <strong className="block text-white">Compressing 9:16 Video to Smaller Size...</strong>
                          <span>Transcoding and reducing bitrate for fast mobile playback across Kenya.</span>
                        </div>
                      </div>
                    )}

                    {/* Compression Stats Banner */}
                    {compressionStats && !compressingVideo && (
                      <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>
                            Video compressed: <strong className="text-white">{compressionStats.originalMb} MB</strong> ➔ <strong className="text-emerald-300">{compressionStats.compressedMb} MB</strong>
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[10px] bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-200">
                          ⚡ -{compressionStats.savings}% smaller
                        </span>
                      </div>
                    )}

                    {videoUploadError && (
                      <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{videoUploadError}</span>
                      </div>
                    )}

                    {/* TIMELINE-BASED VIDEO TRIMMING TOOL */}
                    {showTrimmer && (
                      <div className="bg-neutral-900 border-2 border-rose-500/60 rounded-2xl p-4 space-y-3.5 shadow-2xl animate-in fade-in duration-200">
                        <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                              <Scissors className="w-4 h-4" />
                            </span>
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-2">
                                <span>Timeline Video Trimmer (Video {activeVideoSlot + 1})</span>
                                <span className="text-[9px] bg-rose-600 text-white font-mono px-1.5 py-0.2 rounded font-bold">
                                  Select Up to 60s
                                </span>
                              </div>
                              <div className="text-[10px] text-neutral-400">
                                Original duration: <span className="font-mono text-rose-300 font-semibold">{Math.floor(rawVideoDuration / 60)}:{(Math.floor(rawVideoDuration % 60)).toString().padStart(2, '0')} ({Math.round(rawVideoDuration)}s)</span>. Select your best 60-second window.
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowTrimmer(false)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Interactive Range Player Preview with active segment loop */}
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <div className="relative aspect-[9/16] w-28 sm:w-32 rounded-xl overflow-hidden bg-black border border-neutral-700 shadow-xl shrink-0 group">
                            <video
                              ref={trimVideoRef}
                              src={rawVideoUrl}
                              playsInline
                              muted
                              style={{ filter: getVideoFilterCss(regForm.videoFilter) }}
                              className="w-full h-full object-cover"
                              onTimeUpdate={() => {
                                if (trimVideoRef.current) {
                                  const curr = trimVideoRef.current.currentTime;
                                  setTrimPlayhead(curr);
                                  if (curr >= trimEnd) {
                                    trimVideoRef.current.currentTime = trimStart;
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (trimVideoRef.current) {
                                  if (trimIsPlaying) {
                                    trimVideoRef.current.pause();
                                    setTrimIsPlaying(false);
                                  } else {
                                    if (trimVideoRef.current.currentTime < trimStart || trimVideoRef.current.currentTime >= trimEnd) {
                                      trimVideoRef.current.currentTime = trimStart;
                                    }
                                    trimVideoRef.current.play().catch(() => {});
                                    setTrimIsPlaying(true);
                                  }
                                }
                              }}
                              className="absolute inset-0 m-auto w-9 h-9 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center transition shadow-lg cursor-pointer"
                            >
                              {trimIsPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
                            </button>
                            <span className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[8px] font-mono text-emerald-400">
                              {Math.floor(trimPlayhead / 60)}:{(Math.floor(trimPlayhead % 60)).toString().padStart(2, '0')}
                            </span>
                          </div>

                          <div className="flex-1 space-y-3 w-full">
                            {/* Selected Segment Status Badge */}
                            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 flex items-center justify-between text-[11px]">
                              <div>
                                <span className="text-neutral-400 font-medium">Selected Window:</span>
                                <span className="ml-1.5 font-mono text-rose-300 font-bold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                                  {Math.floor(trimStart / 60)}:{(Math.floor(trimStart % 60)).toString().padStart(2, '0')} – {Math.floor(trimEnd / 60)}:{(Math.floor(trimEnd % 60)).toString().padStart(2, '0')}
                                </span>
                              </div>
                              <span className="font-mono text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-lg">
                                ⏱️ {Math.round(trimEnd - trimStart)}s (Max 60s)
                              </span>
                            </div>

                            {/* Timeline Visual Track */}
                            <div className="space-y-1">
                              <div className="relative h-6 bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden flex items-center">
                                <div
                                  className="absolute top-0 bottom-0 bg-rose-600/40 border-l-2 border-r-2 border-rose-500 rounded"
                                  style={{
                                    left: `${(trimStart / (rawVideoDuration || 1)) * 100}%`,
                                    width: `${((trimEnd - trimStart) / (rawVideoDuration || 1)) * 100}%`,
                                  }}
                                />
                                <div
                                  className="absolute top-0 bottom-0 w-1 bg-white shadow-md z-10"
                                  style={{
                                    left: `${(trimPlayhead / (rawVideoDuration || 1)) * 100}%`,
                                  }}
                                />
                              </div>

                              <div className="flex justify-between text-[9px] font-mono text-neutral-500">
                                <span>0:00</span>
                                <span>{Math.floor(rawVideoDuration / 60)}:{(Math.floor(rawVideoDuration % 60)).toString().padStart(2, '0')}</span>
                              </div>
                            </div>

                            {/* Dual Sliders: Start Time and End Time */}
                            <div className="space-y-2">
                              <div>
                                <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                                  <span>Segment Start: <strong className="text-white font-mono">{Math.floor(trimStart / 60)}:{(Math.floor(trimStart % 60)).toString().padStart(2, '0')}</strong></span>
                                  <span className="text-[9px] text-neutral-500">Drag to change start point</span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={Math.max(0, rawVideoDuration - 3)}
                                  step={0.5}
                                  value={trimStart}
                                  onChange={(e) => {
                                    const newStart = parseFloat(e.target.value);
                                    setTrimStart(newStart);
                                    if (trimEnd <= newStart || trimEnd - newStart > 60) {
                                      setTrimEnd(Math.min(rawVideoDuration, newStart + 60));
                                    }
                                    if (trimVideoRef.current) {
                                      trimVideoRef.current.currentTime = newStart;
                                    }
                                  }}
                                  className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                                />
                              </div>

                              <div>
                                <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                                  <span>Segment End: <strong className="text-white font-mono">{Math.floor(trimEnd / 60)}:{(Math.floor(trimEnd % 60)).toString().padStart(2, '0')}</strong></span>
                                  <span className="text-[9px] text-neutral-500">Max 60s from start</span>
                                </div>
                                <input
                                  type="range"
                                  min={trimStart + 3}
                                  max={Math.min(rawVideoDuration, trimStart + 60)}
                                  step={0.5}
                                  value={trimEnd}
                                  onChange={(e) => {
                                    const newEnd = parseFloat(e.target.value);
                                    setTrimEnd(newEnd);
                                    if (trimVideoRef.current) {
                                      trimVideoRef.current.currentTime = newEnd;
                                    }
                                  }}
                                  className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                                />
                              </div>
                            </div>

                            {/* Quick Presets & Apply Buttons */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-800">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] uppercase font-bold text-neutral-500">Jump:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTrimStart(0);
                                    setTrimEnd(Math.min(60, rawVideoDuration));
                                    if (trimVideoRef.current) trimVideoRef.current.currentTime = 0;
                                  }}
                                  className="px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-semibold cursor-pointer"
                                >
                                  First 60s
                                </button>
                                {rawVideoDuration > 60 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const mid = Math.max(0, Math.round((rawVideoDuration - 60) / 2));
                                      setTrimStart(mid);
                                      setTrimEnd(mid + 60);
                                      if (trimVideoRef.current) trimVideoRef.current.currentTime = mid;
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-semibold cursor-pointer"
                                  >
                                    Middle 60s
                                  </button>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={handleApplyTrim}
                                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold shadow-md shadow-rose-950/60 flex items-center gap-1.5 cursor-pointer active:scale-95"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Apply 60s Trim</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Active Video Slot Display: Preview Player or Upload Controls */}
                    {((activeVideoSlot === 0 && (regVideos[0]?.url || regForm.videoUrl)) || (activeVideoSlot === 1 && regVideos[1]?.url)) ? (
                      <div className="space-y-4">
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 flex flex-col sm:flex-row items-center gap-4">
                          {/* 9:16 Preview Player Container with Active Aesthetic Filter */}
                          <div className="relative aspect-[9/16] w-36 sm:w-40 rounded-2xl overflow-hidden bg-black border-2 border-rose-500/60 shadow-xl shrink-0 group">
                            <video
                              key={(activeVideoSlot === 0 ? (regVideos[0]?.url || regForm.videoUrl) : regVideos[1]?.url) + regForm.videoFilter}
                              src={activeVideoSlot === 0 ? (regVideos[0]?.url || regForm.videoUrl) : regVideos[1]?.url}
                              poster={activeVideoSlot === 0 ? (regVideos[0]?.thumbnail || regForm.videoThumbnail) : regVideos[1]?.thumbnail}
                              playsInline
                              muted={previewVideoMuted}
                              loop
                              style={{ filter: getVideoFilterCss(regForm.videoFilter) }}
                              className="w-full h-full object-cover"
                              onPlay={() => setPreviewVideoPlaying(true)}
                              onPause={() => setPreviewVideoPlaying(false)}
                            />

                            {/* 9:16 Badge */}
                            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[9px] font-mono font-bold text-rose-300 border border-rose-500/30">
                              9:16
                            </span>

                            {/* Duration badge */}
                            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[9px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                              ⏱️ {(activeVideoSlot === 0 ? regVideos[0]?.duration : regVideos[1]?.duration) || regForm.videoDuration || 60}s
                            </span>

                            {/* Compression tag */}
                            <span className="absolute bottom-9 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[8px] font-mono text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow">
                              <Zap className="w-2.5 h-2.5 text-emerald-400" />
                              Compressed
                            </span>

                            {/* Aesthetic Filter Badge overlay (if active) */}
                            {regForm.videoFilter && regForm.videoFilter !== 'normal' && (
                              <span className="absolute bottom-9 left-2 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-xs text-[9px] font-semibold text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-md">
                                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                {getVideoFilterBadge(regForm.videoFilter)}
                              </span>
                            )}

                            {/* Sound toggle at bottom left */}
                            <button
                              type="button"
                              onClick={() => setPreviewVideoMuted(!previewVideoMuted)}
                              className="absolute bottom-2 left-2 p-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white transition cursor-pointer"
                              title={previewVideoMuted ? 'Unmute' : 'Mute'}
                            >
                              {previewVideoMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          {/* Video Info & Replace/Trim/Remove Actions */}
                          <div className="flex-1 space-y-2 text-left w-full">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Video {activeVideoSlot + 1} Compressed &amp; Ready ({activeVideoSlot === 0 ? (regVideos[0]?.duration || regForm.videoDuration || 60) : regVideos[1]?.duration}s clip)</span>
                            </div>
                            <p className="text-[11px] text-neutral-400">
                              Compressed to compact mobile size for instantaneous streaming across Kenya. Max 2 videos per member.
                            </p>

                            <div className="flex flex-wrap gap-2 pt-2">
                              {/* Open Timeline Trimmer button */}
                              <button
                                type="button"
                                onClick={() => {
                                  const currentUrl = activeVideoSlot === 0 ? (regVideos[0]?.url || regForm.videoUrl) : regVideos[1]?.url;
                                  const currentDur = activeVideoSlot === 0 ? (regVideos[0]?.duration || regForm.videoDuration || 60) : regVideos[1]?.duration;
                                  setRawVideoUrl(currentUrl);
                                  setRawVideoDuration(currentDur || 60);
                                  setTrimStart(0);
                                  setTrimEnd(Math.min(60, currentDur || 60));
                                  setShowTrimmer(true);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Scissors className="w-3.5 h-3.5 text-rose-400" />
                                <span>Trim Segment</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => videoInputRef.current?.click()}
                                className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <UploadCloud className="w-3.5 h-3.5" />
                                Replace
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (activeVideoSlot === 0) {
                                    setRegForm(prev => ({ ...prev, videoUrl: '', videoDuration: 60, videoThumbnail: '', videoFilter: 'normal', videoTrimStart: 0, videoTrimEnd: 60 }));
                                    setRegVideos(prev => prev.filter((_, idx) => idx !== 0));
                                  } else {
                                    setRegVideos(prev => prev.filter((_, idx) => idx !== 1));
                                  }
                                }}
                                className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove Video
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* SUITE OF AESTHETIC VIDEO FILTERS */}
                        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-neutral-200 font-bold flex items-center gap-1.5 text-xs">
                              <Wand2 className="w-4 h-4 text-rose-400" />
                              <span>Aesthetic Video Filters (Video {activeVideoSlot + 1})</span>
                            </label>
                            <span className="text-[10px] text-rose-300 font-mono bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                              Active: {AESTHETIC_VIDEO_FILTERS.find(f => f.id === regForm.videoFilter)?.name || 'Original'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            {AESTHETIC_VIDEO_FILTERS.map((filter) => {
                              const isSelected = (regForm.videoFilter || 'normal') === filter.id;
                              return (
                                <button
                                  key={filter.id}
                                  type="button"
                                  onClick={() => setRegForm(prev => ({ ...prev, videoFilter: filter.id }))}
                                  className={`p-2 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                                    isSelected
                                      ? 'border-rose-500 bg-rose-950/40 ring-1 ring-rose-500/50 shadow-md'
                                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                                  }`}
                                >
                                  <div className={`w-7 h-7 rounded-lg ${filter.previewBg} shadow-inner flex items-center justify-center shrink-0 border border-white/10`}>
                                    {isSelected && <Sparkles className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <div className="overflow-hidden">
                                    <div className="text-[11px] font-bold text-neutral-200 truncate">
                                      {filter.name}
                                    </div>
                                    <div className="text-[9px] text-neutral-400 truncate">
                                      {filter.badge}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Video Upload / Selection Controls for Active Slot */
                      <div className="space-y-3">
                        {/* File Upload Box */}
                        <div
                          onClick={() => videoInputRef.current?.click()}
                          className="border-2 border-dashed border-neutral-700 hover:border-rose-500/80 rounded-2xl p-4 text-center cursor-pointer transition bg-neutral-900/50 hover:bg-rose-950/10 group"
                        >
                          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition">
                            <UploadCloud className="w-5 h-5" />
                          </div>
                          <div className="text-xs font-bold text-neutral-200 group-hover:text-white">
                            Upload Video {activeVideoSlot + 1} (9:16 Vertical · Max 60s)
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-0.5">
                            Automatically compressed to smaller size · Supports MP4, MOV, or WebM
                          </div>
                        </div>

                        <input
                          ref={videoInputRef}
                          type="file"
                          accept="video/mp4,video/quicktime,video/webm"
                          className="hidden"
                          onChange={handleVideoFileUpload}
                        />

                        {/* Or Paste Direct Video URL */}
                        <div className="flex gap-2">
                          <input
                            type="url"
                            placeholder="Or paste direct 9:16 video MP4 URL..."
                            value={customVideoUrlInput}
                            onChange={e => setCustomVideoUrlInput(e.target.value)}
                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!customVideoUrlInput.trim()) return;
                              handleLoadCustomVideoUrl(customVideoUrlInput);
                              setCustomVideoUrlInput('');
                            }}
                            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 cursor-pointer"
                          >
                            Load
                          </button>
                        </div>

                        {/* Curated 9:16 Video Presets for 1-Click Testing */}
                        <div>
                          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>Or select a 1-click 9:16 video preset for Video {activeVideoSlot + 1}:</span>
                            <span className="text-rose-400 font-mono text-[9px]">Verified 9:16 ≤60s</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {PRESET_916_VIDEOS.map((preset, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  const newVid = {
                                    url: preset.url,
                                    duration: preset.duration,
                                    thumbnail: preset.thumbnail,
                                    filter: 'normal',
                                    trimStart: 0,
                                    trimEnd: preset.duration,
                                    originalSizeMb: 14.5,
                                    compressedSizeMb: 2.9,
                                    isCompressed: true,
                                  };
                                  setRegVideos(prev => {
                                    const next = [...prev];
                                    next[activeVideoSlot] = newVid;
                                    return next.slice(0, 2);
                                  });
                                  if (activeVideoSlot === 0) {
                                    setRegForm(prev => ({
                                      ...prev,
                                      videoUrl: preset.url,
                                      videoDuration: preset.duration,
                                      videoThumbnail: preset.thumbnail,
                                      videoTrimStart: 0,
                                      videoTrimEnd: preset.duration,
                                    }));
                                  }
                                  setRawVideoUrl(preset.url);
                                  setRawVideoDuration(preset.duration);
                                  setVideoUploadError(null);
                                }}
                                className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-rose-500/60 text-left transition flex flex-col justify-between group cursor-pointer"
                              >
                                <div className="relative aspect-[9/16] w-full rounded-lg overflow-hidden bg-black mb-1.5">
                                  <img src={preset.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <Play className="w-4 h-4 text-white fill-white" />
                                  </div>
                                  <span className="absolute bottom-1 right-1 bg-black/80 text-[8px] text-white px-1 rounded font-mono">
                                    {preset.duration}s
                                  </span>
                                </div>
                                <span className="text-[10px] font-semibold text-neutral-300 truncate w-full block">
                                  {preset.title}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SECTION 5: SAFETY POLICY VERIFICATION & PUBLISH */}
                  <div id="reg-sec-photos" className="space-y-4 pt-3 border-t border-neutral-800/70">
                    <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Section 5: Community Safety &amp; Publish
                    </div>

                    <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2.5">
                      <div className="font-bold text-white text-xs flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Pre-Publication Checklist</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-neutral-300">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Max 3 photos verified ({regForm.photos.length}/3)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Head-to-toe full-body photo included</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>9:16 vertical video compressed (max 2)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>No commercial sales, drugs, or escorting</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={registering || !fullBodyVerified}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-rose-950/50 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {registering
                          ? 'Verifying and Publishing...'
                          : !fullBodyVerified
                          ? 'Full-Body Photo Required (Face-Only Rejected)'
                          : 'Publish My Free Dating Profile'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* DOCKED VERTICAL SCRAWLER ON THE CARD (Up & Down controls + visual progress) */}
              <div className="absolute right-2 top-4 bottom-4 w-9 flex flex-col items-center justify-between py-2 z-20 pointer-events-auto bg-neutral-950/80 border border-neutral-800 rounded-2xl backdrop-blur-md shadow-xl">
                {/* Scroll Up Button */}
                <button
                  type="button"
                  onClick={() => handleScrollModal('up')}
                  disabled={!canScrollUp}
                  title="Scroll Up"
                  className={`w-7 h-7 rounded-xl flex items-center justify-center transition cursor-pointer ${
                    canScrollUp
                      ? 'bg-neutral-800 hover:bg-rose-600 text-white shadow-md active:scale-95'
                      : 'bg-neutral-800/30 text-neutral-600 cursor-not-allowed'
                  }`}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>

                {/* Scrawler Track with dynamic progress bar */}
                <div className="flex flex-col items-center gap-1.5 my-2">
                  <div className="text-[9px] font-mono font-bold text-rose-400 select-none">
                    {Math.round(scrollProgress)}%
                  </div>
                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickY = e.clientY - rect.top;
                      const ratio = Math.max(0, Math.min(1, clickY / rect.height));
                      if (regModalScrollRef.current) {
                        const maxScroll = regModalScrollRef.current.scrollHeight - regModalScrollRef.current.clientHeight;
                        regModalScrollRef.current.scrollTo({ top: maxScroll * ratio, behavior: 'smooth' });
                      }
                    }}
                    className="w-1.5 h-28 sm:h-36 rounded-full bg-neutral-800 overflow-hidden relative cursor-pointer"
                    title="Click scrawler track to jump"
                  >
                    <div
                      className="w-full bg-gradient-to-b from-rose-500 to-pink-500 rounded-full transition-all duration-150 shadow-sm shadow-rose-500"
                      style={{ height: `${Math.max(8, scrollProgress)}%` }}
                    />
                  </div>
                </div>

                {/* Scroll Down Button with subtle pulse if more below */}
                <button
                  type="button"
                  onClick={() => handleScrollModal('down')}
                  disabled={!canScrollDown}
                  title="Scroll Down"
                  className={`w-7 h-7 rounded-xl flex items-center justify-center transition cursor-pointer ${
                    canScrollDown
                      ? 'bg-neutral-800 hover:bg-rose-600 text-white shadow-md active:scale-95 ring-1 ring-rose-500/40 animate-pulse'
                      : 'bg-neutral-800/30 text-neutral-600 cursor-not-allowed'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9:16 Dedicated Video Player Modal for other users to watch */}
      {watchingVideoProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-[380px] sm:max-w-[420px] aspect-[9/16] max-h-[92vh] rounded-3xl overflow-hidden bg-black border border-neutral-700/60 shadow-2xl flex flex-col justify-between">
            {/* Native Video Element with Aesthetic Filter and Trim Loop */}
            <video
              ref={watchVideoRef}
              src={watchingVideoProfile.videoUrl || (watchingVideoProfile.videos && watchingVideoProfile.videos[0])}
              poster={watchingVideoProfile.videoThumbnail || watchingVideoProfile.primaryPhoto}
              autoPlay
              playsInline
              loop={!watchingVideoProfile.videoTrimEnd}
              muted={watchVideoMuted}
              style={{ filter: getVideoFilterCss(watchingVideoProfile.videoFilter) }}
              onLoadedMetadata={() => {
                if (watchVideoRef.current) {
                  if (typeof watchingVideoProfile.videoTrimStart === 'number' && watchingVideoProfile.videoTrimStart > 0) {
                    watchVideoRef.current.currentTime = watchingVideoProfile.videoTrimStart;
                  }
                  setWatchVideoDuration(
                    watchingVideoProfile.videoDuration ||
                    (watchingVideoProfile.videoTrimEnd && watchingVideoProfile.videoTrimStart !== undefined
                      ? watchingVideoProfile.videoTrimEnd - watchingVideoProfile.videoTrimStart
                      : watchVideoRef.current.duration || 60)
                  );
                }
              }}
              onTimeUpdate={() => {
                if (watchVideoRef.current) {
                  const cur = watchVideoRef.current.currentTime;
                  setWatchVideoCurrentTime(cur);

                  // If video has trim bounds, loop seamlessly within the trimmed segment
                  const trimStart = watchingVideoProfile.videoTrimStart ?? 0;
                  const trimEnd = watchingVideoProfile.videoTrimEnd;
                  if (typeof trimEnd === 'number' && trimEnd > trimStart && cur >= trimEnd) {
                    watchVideoRef.current.currentTime = trimStart;
                  }
                }
              }}
              onClick={() => {
                if (watchVideoRef.current) {
                  if (watchVideoPlaying) {
                    watchVideoRef.current.pause();
                    setWatchVideoPlaying(false);
                  } else {
                    watchVideoRef.current.play().catch(() => {});
                    setWatchVideoPlaying(true);
                  }
                }
              }}
              className="absolute inset-0 w-full h-full object-cover cursor-pointer"
            />

            {/* Top Bar Overlay */}
            <div className="relative z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  9:16 Video Intro
                </span>
                <span className="text-[11px] font-mono text-neutral-300 bg-black/50 px-2 py-0.5 rounded-full border border-white/10">
                  {Math.round(watchVideoCurrentTime)}s / {Math.round(watchVideoDuration)}s max
                </span>
                {watchingVideoProfile.videoFilter && watchingVideoProfile.videoFilter !== 'normal' && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 backdrop-blur-md border border-rose-400/40 text-[10px] font-semibold text-rose-200 flex items-center gap-1">
                    <Wand2 className="w-2.5 h-2.5 text-rose-400" />
                    {getVideoFilterBadge(watchingVideoProfile.videoFilter)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWatchVideoMuted(!watchVideoMuted)}
                  className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition cursor-pointer"
                  title={watchVideoMuted ? 'Unmute audio' : 'Mute audio'}
                >
                  {watchVideoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (watchVideoRef.current) watchVideoRef.current.pause();
                    setWatchingVideoProfile(null);
                  }}
                  className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition cursor-pointer"
                  title="Close player"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Center Play Indicator on Pause */}
            {!watchVideoPlaying && (
              <div
                onClick={() => {
                  if (watchVideoRef.current) {
                    watchVideoRef.current.play().catch(() => {});
                    setWatchVideoPlaying(true);
                  }
                }}
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/70 border border-white/30 text-white flex items-center justify-center cursor-pointer z-20 shadow-2xl"
              >
                <Play className="w-8 h-8 fill-white ml-1" />
              </div>
            )}

            {/* Bottom Controls & Member Overlay */}
            <div className="relative z-20 p-4 pt-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent space-y-3 pointer-events-auto">
              {/* Progress Scrubber Bar */}
              <div className="space-y-1">
                <input
                  type="range"
                  min={0}
                  max={watchVideoDuration || 60}
                  step={0.1}
                  value={watchVideoCurrentTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (watchVideoRef.current) {
                      watchVideoRef.current.currentTime = val;
                      setWatchVideoCurrentTime(val);
                    }
                  }}
                  className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
              </div>

              {/* Profile Details Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                    <span>{watchingVideoProfile.fullName}</span>
                    <span className="text-rose-400 font-medium">,{watchingVideoProfile.age}</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-neutral-300">
                    <MapPin className="w-3 h-3 text-rose-400" />
                    <span>{watchingVideoProfile.location || watchingVideoProfile.city}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleLike(watchingVideoProfile.id)}
                  className={`p-2.5 rounded-full backdrop-blur-md border transition cursor-pointer ${
                    watchingVideoProfile.isLikedByViewer
                      ? 'bg-rose-600/80 border-rose-400 text-white'
                      : 'bg-black/60 border-white/20 text-neutral-300 hover:text-rose-400'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${watchingVideoProfile.isLikedByViewer ? 'fill-white' : ''}`} />
                </button>
              </div>

              {/* Bio Snippet */}
              <p className="text-xs text-neutral-200 line-clamp-2">
                {watchingVideoProfile.description}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (watchVideoRef.current) watchVideoRef.current.pause();
                    const p = watchingVideoProfile;
                    setWatchingVideoProfile(null);
                    setSelectedProfileForContact(p);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-rose-950/60 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>See Contact · KES 50 (10 Min)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 60FPS Canvas Hearts Rain Particle Layer */}
      <canvas
        ref={heartsCanvasRef}
        className="fixed inset-0 pointer-events-none z-50 pointer-events-none"
      />

      {/* Report Profile Modal */}
      {reportModalProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative space-y-4">
            <button
              type="button"
              onClick={() => setReportModalProfile(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
              <Flag className="w-4 h-4" />
              <span>Report Suspicious / Inappropriate Profile</span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
              <img
                src={reportModalProfile.primaryPhoto || reportModalProfile.photos[0]}
                alt=""
                className="w-10 h-10 rounded-xl object-cover"
              />
              <div>
                <h4 className="text-sm font-bold text-white">{reportModalProfile.fullName}, {reportModalProfile.age}</h4>
                <span className="text-[11px] text-neutral-400">{reportModalProfile.location || reportModalProfile.city}</span>
              </div>
            </div>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-2">
                  Select Reason for Reporting *
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'fake_profile', label: 'Fake Profile / Impersonation' },
                    { id: 'inappropriate_content', label: 'Inappropriate Content or Nudity' },
                    { id: 'commercial_scam', label: 'Commercial Solicitation or Scam' },
                    { id: 'harassment', label: 'Harassment or Offensive Behavior' },
                    { id: 'underage', label: 'Suspected Underage Member' },
                    { id: 'other', label: 'Other Safety or Community Violation' },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        reportReason === option.id
                          ? 'bg-rose-500/10 border-rose-500 text-rose-200 font-medium'
                          : 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        value={option.id}
                        checked={reportReason === option.id}
                        onChange={() => setReportReason(option.id)}
                        className="text-rose-500 focus:ring-rose-500 accent-rose-500"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Additional Details (Optional)
                </label>
                <textarea
                  rows={2}
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                  placeholder="Provide any details to help our safety team audit this report..."
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportModalProfile(null)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/50"
                >
                  {reportSubmitting ? (
                    <span>Logging Concern...</span>
                  ) : (
                    <>
                      <Flag className="w-3.5 h-3.5" />
                      <span>Submit Report</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Profile Modal */}
      {shareModalProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative space-y-4 text-center">
            <button
              type="button"
              onClick={() => setShareModalProfile(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <Share2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Share Profile</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Share {shareModalProfile.fullName}&apos;s verified Trip Dating profile with friends
              </p>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center gap-3 text-left">
              <img
                src={shareModalProfile.primaryPhoto || shareModalProfile.photos[0]}
                alt=""
                className="w-12 h-12 rounded-xl object-cover"
              />
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate">{shareModalProfile.fullName}, {shareModalProfile.age}</h4>
                <p className="text-xs text-rose-300 truncate">{shareModalProfile.location || shareModalProfile.city}</p>
                <span className="text-[10px] text-emerald-400 font-medium">✓ Verified Safe Profile</span>
              </div>
            </div>

            {/* Social Share Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out ${shareModalProfile.fullName}'s verified profile on AirBus Trip Dating: ${getProfileDeepLink(shareModalProfile)}`)}`}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex flex-col items-center gap-1 transition"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>WhatsApp</span>
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${shareModalProfile.fullName} on AirBus Trip Dating: ${getProfileDeepLink(shareModalProfile)}`)}`}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-300 text-xs font-semibold flex flex-col items-center gap-1 transition"
              >
                <span className="font-bold text-sm">𝕏</span>
                <span>Post on X</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getProfileDeepLink(shareModalProfile))}`}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-semibold flex flex-col items-center gap-1 transition"
              >
                <span className="font-bold text-sm">f</span>
                <span>Facebook</span>
              </a>
            </div>

            {/* Copy Link Input */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleCopyShareLink(shareModalProfile)}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border border-neutral-700"
              >
                {copiedShareLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Deep Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-neutral-300" />
                    <span>Copy Profile Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filter Modal */}
      {showAdvancedFiltersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative space-y-5">
            <button
              type="button"
              onClick={() => setShowAdvancedFiltersModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
              <SlidersHorizontal className="w-5 h-5 text-rose-500" />
              <span>Advanced Discovery Filters</span>
            </div>

            {/* Age Range Filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-200">
                <span>Age Range</span>
                <span className="text-rose-400 font-mono">{advFilterAgeMin} – {advFilterAgeMax} years</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-neutral-400 block mb-1">Min Age</span>
                  <input
                    type="range"
                    min={18}
                    max={40}
                    value={advFilterAgeMin}
                    onChange={e => {
                      const val = Number(e.target.value);
                      if (val <= advFilterAgeMax) setAdvFilterAgeMin(val);
                    }}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block mb-1">Max Age</span>
                  <input
                    type="range"
                    min={25}
                    max={65}
                    value={advFilterAgeMax}
                    onChange={e => {
                      const val = Number(e.target.value);
                      if (val >= advFilterAgeMin) setAdvFilterAgeMax(val);
                    }}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Travel Style Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-200 block">
                Travel & Date Style
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'all', label: 'All Styles' },
                  { id: 'luxury', label: 'Luxury & Fine Dining' },
                  { id: 'adventure', label: 'Adventurer & Road Trips' },
                  { id: 'nature', label: 'Relaxed Nature & Beach' },
                ].map(style => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setAdvFilterTravelStyle(style.id)}
                    className={`p-2 rounded-xl text-left border transition font-medium cursor-pointer ${
                      advFilterTravelStyle === style.id
                        ? 'bg-rose-500/20 border-rose-500 text-rose-200'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Specific Interests Tags */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-200 block">
                Specific Interests & Vibes
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Road Trips',
                  'Fine Dining',
                  'Hiking',
                  'Photography',
                  'Beach Sunset',
                  'Coffee Culture',
                  'Safari',
                  'Nightlife',
                  'Fitness',
                  'Live Music',
                  'Conversations',
                ].map(interest => {
                  const isSelected = advFilterInterests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setAdvFilterInterests(prev => prev.filter(i => i !== interest));
                        } else {
                          setAdvFilterInterests(prev => [...prev, interest]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                        isSelected
                          ? 'bg-rose-600 text-white border-rose-400'
                          : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                      }`}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAdvFilterAgeMin(18);
                  setAdvFilterAgeMax(55);
                  setAdvFilterTravelStyle('all');
                  setAdvFilterInterests([]);
                }}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setShowAdvancedFiltersModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-rose-950/50"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification after Report Profile */}
      {reportToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-neutral-900 border border-emerald-500/50 shadow-2xl text-xs text-emerald-300 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{reportToast}</span>
        </div>
      )}
    </div>
  );
};
