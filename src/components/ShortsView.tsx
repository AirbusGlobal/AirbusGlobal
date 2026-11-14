import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Stay,
  Currency,
  CURRENCY_RATES,
  User,
  Post,
  ShortAudioConfig,
  CaptionSegment,
  PostComment,
  ShortIntentType,
} from '../types';
import {
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  Heart,
  MessageSquare,
  Share2,
  Star,
  MapPin,
  ArrowLeft,
  ThumbsUp,
  Eye,
  UserPlus,
  UserCheck,
  Music,
  Flag,
  Send,
  X,
  Captions,
  Copy,
  Check,
  Disc3,
  Play,
  Pause,
  Calendar,
  BadgeDollarSign,
  PhoneCall,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api';
import { VerifiedBadge } from './VerifiedBadge';
import { SHORTS_Z_INDEX, SHORTS_ZONES, SHORTS_TOUCH_TARGET } from '../config/shortsLayoutConfig';

interface ShortsViewProps {
  stays: Stay[];
  savedStayIds: string[];
  user: User | null;
  onToggleSave: (id: string) => void;
  onNavigateToListing?: (
    stayId: string,
    intent: ShortIntentType,
    shortId: string,
    index: number
  ) => void;
  onBookNow?: (id: string) => void;
  onNegotiate?: (id: string) => void;
  onChatHost?: (id: string) => void;
  onBackToFeed: () => void;
  initialShortId?: string | null;
  currency: Currency;
  onUpdateStay?: (id: string, updates: Partial<Stay>) => void;
  onOpenAuth?: () => void;
  showToast?: (msg: string) => void;
}

interface UnifiedShortItem {
  key: string;
  kind: 'post' | 'stay';
  id: string;
  stayId?: string;
  stay?: Stay;
  post?: Post;
  ownerEmail: string;
  creatorName: string;
  title: string;
  caption: string;
  hashtags: string[];
  videoUrl?: string;
  thumbnailUrl: string;
  durationSeconds: number;
  sourceType: 'video' | 'photo';
  captionsEnabled: boolean;
  captions: CaptionSegment[];
  shortAudio: ShortAudioConfig;
  listingUnavailable: boolean;
  views: number;
  likes: number;
  liked: boolean;
  comments: PostComment[];
  shares: number;
}

const NO_AUDIO_CONFIG: ShortAudioConfig = {
  mode: 'none',
  audioStartSec: 0,
  originalVolume: 100,
  musicVolume: 0,
  voiceOverVolume: 0,
  autoDuckMusic: false,
};

function hasAddedAudioTrack(audio?: ShortAudioConfig): boolean {
  if (!audio || audio.mode === 'none') return false;
  return Boolean(audio.trackUrl || audio.voiceOverUrl);
}

type ActiveSheet = 'none' | 'comments' | 'audio' | 'share';

export const ShortsView: React.FC<ShortsViewProps> = ({
  stays,
  savedStayIds,
  user,
  onToggleSave,
  onNavigateToListing,
  onBookNow,
  onBackToFeed,
  initialShortId,
  currency,
  onUpdateStay,
  onOpenAuth,
  showToast,
}) => {
  const [shortPosts, setShortPosts] = useState<Post[]>([]);
  const [feedMode, setFeedMode] = useState<'foryou' | 'following'>('foryou');
  const [filterTrackId, setFilterTrackId] = useState<string | null>(null);
  const [filterTrackLabel, setFilterTrackLabel] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);

  const [activeSheet, setActiveSheet] = useState<ActiveSheet>('none');

  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgAudioRef = useRef<HTMLAudioElement>(null);
  const voAudioRef = useRef<HTMLAudioElement>(null);
  const userPausedRef = useRef<boolean>(false);
  const playRecordedForKeyRef = useRef<string | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const wheelCooldownRef = useRef<number>(0);

  // Comments & Audio Report state
  const [commentInput, setCommentInput] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [reportAudioReason, setReportAudioReason] = useState('');
  const [showReportAudioBox, setShowReportAudioBox] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const loadShortsFeed = useCallback(() => {
    api
      .getShortsFeed()
      .then(res => setShortPosts(res.posts || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadShortsFeed();
  }, [loadShortsFeed]);

  // Build unified public feed (no login required to watch)
  const unifiedFeed = useMemo<UnifiedShortItem[]>(() => {
    const stayById = new Map<string, Stay>();
    stays.forEach(s => stayById.set(s.id, s));

    const items: UnifiedShortItem[] = [];
    const seenVideoUrls = new Set<string>();

    // 1. Published/auto-created Short posts (linked to listing)
    for (const post of shortPosts) {
      if (post.status !== 'approved' || post.type !== 'short') continue;
      const targetStayId = post.stayId || post.listing_id;
      const linkedStay = targetStayId ? stayById.get(targetStayId) : undefined;
      const unavailable = Boolean(
        post.listingUnavailable ||
          !targetStayId ||
          !linkedStay ||
          linkedStay.status === 'expired' ||
          linkedStay.status === 'paused' ||
          linkedStay.ownerSubscriptionExpired
      );
      if (post.videoUrl) seenVideoUrls.add(post.videoUrl);
      items.push({
        key: `post_${post.id}`,
        kind: 'post',
        id: post.id,
        stayId: targetStayId,
        stay: linkedStay,
        post,
        ownerEmail: post.ownerEmail || post.host_id || '',
        creatorName: post.creatorName || linkedStay?.hostName || 'AirBus Host',
        title: linkedStay?.title || post.caption || 'AirBus Short Reel',
        caption: post.caption || post.description || '',
        hashtags: post.hashtags && post.hashtags.length > 0 ? post.hashtags : ['#AirBusStays', '#TravelKenya'],
        videoUrl: post.videoUrl,
        thumbnailUrl: post.coverUrl,
        durationSeconds: post.durationSeconds || 24,
        sourceType: post.sourceType || 'video',
        captionsEnabled: post.captionsEnabled !== false,
        captions: post.captions || [],
        shortAudio: post.shortAudio || NO_AUDIO_CONFIG,
        listingUnavailable: unavailable,
        views: post.views || 0,
        likes: post.likes || 0,
        liked: user ? (post.likedByUserEmails || []).includes(user.email.toLowerCase()) : false,
        comments: post.comments || [],
        shares: post.shares || 0,
      });
    }

    // 2. Live video stays not already represented by a Short post
    const liveStays = stays.filter(s => (s.status === 'live' || !s.status) && !s.ownerSubscriptionExpired);
    const videoStays = liveStays.filter(s => s.hasVideo || s.videoUrl || s.youtubeVideoId || s.media?.video?.url);
    const staySource = videoStays.length > 0 ? videoStays : liveStays;

    for (const s of staySource) {
      const vUrl = s.media?.video?.url || s.videoUrl;
      if (vUrl && seenVideoUrls.has(vUrl) && items.some(it => it.stayId === s.id)) {
        continue;
      }
      const thumb =
        s.thumbnailUrl ||
        s.media?.video?.thumbnail ||
        s.media?.photos?.[0]?.url ||
        s.images?.[0] ||
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80';

      items.push({
        key: `stay_${s.id}`,
        kind: 'stay',
        id: s.id,
        stayId: s.id,
        stay: s,
        ownerEmail: s.ownerEmail || s.owner || 'owner@airbus.ke',
        creatorName: s.hostName || 'AirBus Host',
        title: s.title,
        caption: s.description || `Explore ${s.title} in ${s.location}. Book directly on AirBus.`,
        hashtags: [`#${s.category || 'Stay'}`, '#AirBusStays', `#${(s.location || 'Kenya').split(',')[0].replace(/\s+/g, '')}`],
        videoUrl: vUrl,
        thumbnailUrl: thumb,
        durationSeconds: s.media?.video?.duration || 30,
        sourceType: 'video',
        captionsEnabled: false,
        captions: [],
        shortAudio: NO_AUDIO_CONFIG,
        listingUnavailable: false,
        views: s.views || 0,
        likes: s.likesCount || 0,
        liked: user ? (s.likedByUserEmails || []).includes(user.email) : false,
        comments: [],
        shares: 0,
      });
    }

    let filtered = items;
    if (filterTrackId) {
      const matches = filtered.filter(i => i.shortAudio?.trackId === filterTrackId);
      if (matches.length > 0) filtered = matches;
    }
    if (feedMode === 'following' && user) {
      const followed = filtered.filter(i =>
        (i.stay?.hostFollowedByUserEmails || []).includes(user.email)
      );
      if (followed.length > 0) filtered = followed;
    }

    return filtered;
  }, [shortPosts, stays, user, filterTrackId, feedMode]);

  // Restore exact Short when returning from a listing page
  useEffect(() => {
    if (!initialShortId || unifiedFeed.length === 0) return;
    const foundIdx = unifiedFeed.findIndex(
      i => i.id === initialShortId || i.key === initialShortId
    );
    if (foundIdx >= 0) {
      setCurrentIndex(foundIdx);
    }
  }, [initialShortId, unifiedFeed.length]);

  const safeIndex = unifiedFeed.length > 0 ? Math.min(currentIndex, unifiedFeed.length - 1) : 0;
  const currentItem = unifiedFeed[safeIndex];
  const nextItem = unifiedFeed.length > 1 ? unifiedFeed[(safeIndex + 1) % unifiedFeed.length] : undefined;
  const currentStay = currentItem?.stay;

  // Reactive social state for active Short
  const [likesCount, setLikesCount] = useState(currentItem?.likes || 0);
  const [liked, setLiked] = useState(currentItem?.liked || false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewsCount, setViewsCount] = useState(currentItem?.views || 0);
  const [localComments, setLocalComments] = useState<PostComment[]>(currentItem?.comments || []);

  useEffect(() => {
    if (!currentItem) return;
    setLikesCount(currentItem.likes);
    setLiked(currentItem.liked);
    setViewsCount(currentItem.views);
    setLocalComments(currentItem.comments);
    setCaptionExpanded(false);
    setPlaybackProgress(0);
    setCurrentTimeSec(0);
    setActiveSheet('none');
    setShowReportAudioBox(false);
    userPausedRef.current = false;
    playRecordedForKeyRef.current = null;

    if (currentStay && !currentItem.listingUnavailable) {
      setIsFollowing(
        user && currentStay.owner
          ? (currentStay.hostFollowedByUserEmails || []).includes(user.email)
          : false
      );
      api
        .recordStayView(currentStay.id)
        .then(res => {
          if (res.views) {
            setViewsCount(res.views);
            onUpdateStay?.(currentStay.id, { views: res.views });
          }
        })
        .catch(() => {});
    }

    if (currentItem.kind === 'post') {
      fetch(`/api/posts/${encodeURIComponent(currentItem.id)}/view`, { method: 'POST' }).catch(() => {});
    }

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      setIsPlaying(true);
    }
  }, [safeIndex, currentItem?.key]);

  // Synchronize video volume & optional audio layers (song + voice-over)
  useEffect(() => {
    const audio = currentItem?.shortAudio;
    const vidEl = videoRef.current;
    const bgEl = bgAudioRef.current;
    const voEl = voAudioRef.current;

    if (vidEl) {
      const origVol = audio && audio.mode !== 'none' ? (audio.originalVolume ?? 100) / 100 : 1;
      vidEl.volume = isMuted ? 0 : Math.min(1, Math.max(0, origVol));
      vidEl.muted = isMuted || origVol === 0;
    }

    if (bgEl) {
      if (!isMuted && isPlaying && audio && audio.mode !== 'none' && audio.mode !== 'original' && audio.trackUrl && (audio.musicVolume ?? 80) > 0) {
        if (bgEl.getAttribute('src') !== audio.trackUrl) {
          bgEl.src = audio.trackUrl;
          bgEl.currentTime = audio.audioStartSec || 0;
        }
        const duckFactor = audio.voiceOverUrl && audio.autoDuckMusic ? 0.35 : 1;
        bgEl.volume = Math.min(1, Math.max(0, ((audio.musicVolume ?? 80) / 100) * duckFactor));
        bgEl.play().catch(() => {});
      } else {
        bgEl.pause();
      }
    }

    if (voEl) {
      if (!isMuted && isPlaying && audio && audio.mode !== 'none' && audio.voiceOverUrl && (audio.voiceOverVolume ?? 100) > 0) {
        if (voEl.getAttribute('src') !== audio.voiceOverUrl) {
          voEl.src = audio.voiceOverUrl;
          voEl.currentTime = 0;
        }
        voEl.volume = Math.min(1, Math.max(0, (audio.voiceOverVolume ?? 100) / 100));
        voEl.play().catch(() => {});
      } else {
        voEl.pause();
      }
    }
  }, [
    currentItem?.key,
    currentItem?.shortAudio?.mode,
    currentItem?.shortAudio?.trackUrl,
    currentItem?.shortAudio?.voiceOverUrl,
    currentItem?.shortAudio?.originalVolume,
    isMuted,
    isPlaying,
  ]);

  // Auto-pause on tab hidden / off-screen, auto-resume only if not explicitly paused by user
  useEffect(() => {
    const handleVisibility = () => {
      const vid = videoRef.current;
      if (document.hidden) {
        if (vid && !vid.paused) vid.pause();
        bgAudioRef.current?.pause();
        voAudioRef.current?.pause();
        setIsPlaying(false);
      } else if (!userPausedRef.current) {
        vid?.play().catch(() => {});
        setIsPlaying(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    let observer: IntersectionObserver | null = null;
    if (stageRef.current && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        entries => {
          const entry = entries[0];
          if (!entry) return;
          if (!entry.isIntersecting) {
            videoRef.current?.pause();
            bgAudioRef.current?.pause();
            voAudioRef.current?.pause();
            setIsPlaying(false);
          } else if (!userPausedRef.current && !document.hidden) {
            videoRef.current?.play().catch(() => {});
            setIsPlaying(true);
          }
        },
        { threshold: 0.25 }
      );
      observer.observe(stageRef.current);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      observer?.disconnect();
    };
  }, []);

  const handleNext = useCallback(() => {
    userPausedRef.current = false;
    setCurrentIndex(prev => (prev < unifiedFeed.length - 1 ? prev + 1 : 0));
  }, [unifiedFeed.length]);

  const handlePrev = useCallback(() => {
    userPausedRef.current = false;
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : Math.max(0, unifiedFeed.length - 1)));
  }, [unifiedFeed.length]);

  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (vid) {
      if (isPlaying) {
        userPausedRef.current = true;
        vid.pause();
        bgAudioRef.current?.pause();
        voAudioRef.current?.pause();
        setIsPlaying(false);
      } else {
        userPausedRef.current = false;
        vid.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(prev => {
        const next = !prev;
        userPausedRef.current = !next;
        return next;
      });
    }
  }, [isPlaying]);

  // Keyboard navigation: ArrowDown (Next), ArrowUp (Prev), Space (Play/Pause)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNext, handlePrev, togglePlay]);

  // Seamless continuous auto-replay of the SAME Short on video end
  const handleVideoEnded = () => {
    if (!currentItem) return;
    if (currentItem.kind === 'post') {
      api.recordShortAnalytics(currentItem.id, 'replay').catch(() => {});
    }
    if (userPausedRef.current) return;

    const vid = videoRef.current;
    if (vid) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    }
    if (!isMuted && hasAddedAudioTrack(currentItem.shortAudio)) {
      if (bgAudioRef.current && currentItem.shortAudio.trackUrl) {
        bgAudioRef.current.currentTime = currentItem.shortAudio.audioStartSec || 0;
        bgAudioRef.current.play().catch(() => {});
      }
      if (voAudioRef.current && currentItem.shortAudio.voiceOverUrl) {
        voAudioRef.current.currentTime = 0;
        voAudioRef.current.play().catch(() => {});
      }
    }
    setIsPlaying(true);
  };

  // Navigate cleanly to the linked listing with intent & analytics tracking (never run booking/chat/negotiate in Shorts)
  const handleListingActionClick = (intent: ShortIntentType) => {
    if (!currentItem) return;
    const targetStayId = currentItem.stayId || currentStay?.id;
    if (!targetStayId || currentItem.listingUnavailable) {
      showToast?.('This listing is currently unavailable.');
      return;
    }
    if (currentItem.kind === 'post') {
      api.recordShortAnalytics(currentItem.id, 'click', intent).catch(() => {});
    }
    if (onNavigateToListing) {
      onNavigateToListing(targetStayId, intent, currentItem.id, safeIndex);
    } else {
      onBookNow?.(targetStayId);
    }
  };

  const handleToggleLike = async () => {
    if (!currentItem) return;
    if (!user) {
      onOpenAuth?.();
      showToast?.('Sign in to like this Short.');
      return;
    }

    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => (newLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      if (currentItem.kind === 'post') {
        const res = await api.toggleLikePost(currentItem.id);
        setLiked(res.liked);
        setLikesCount(res.likes);
      } else if (currentStay) {
        const res = await api.toggleLikeStay(currentStay.id);
        setLiked(res.liked);
        setLikesCount(res.likesCount);
        onUpdateStay?.(currentStay.id, { likesCount: res.likesCount });
      }
    } catch {
      setLiked(!newLiked);
    }
  };

  const handleToggleFollow = async () => {
    if (!currentItem) return;
    if (!user) {
      onOpenAuth?.();
      showToast?.('Sign in to follow creators.');
      return;
    }
    const targetEmail = currentStay?.owner || currentItem.ownerEmail;
    const newFollowing = !isFollowing;
    setIsFollowing(newFollowing);
    try {
      const res = await api.toggleFollowHost(targetEmail);
      setIsFollowing(res.isFollowing);
      if (currentStay) onUpdateStay?.(currentStay.id, { hostFollowerCount: res.followerCount });
    } catch {
      setIsFollowing(!newFollowing);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem) return;
    if (!user) {
      onOpenAuth?.();
      return;
    }
    if (!commentInput.trim()) return;
    setCommentSaving(true);
    try {
      if (currentItem.kind === 'post') {
        const res = await api.addPostComment(currentItem.id, commentInput.trim());
        setLocalComments(prev => [res.comment, ...prev]);
      } else {
        const localNew: PostComment = {
          id: `pcom_${Date.now()}`,
          postId: currentItem.id,
          authorEmail: user.email,
          authorName: user.name,
          text: commentInput.trim(),
          createdAt: Date.now(),
        };
        setLocalComments(prev => [localNew, ...prev]);
      }
      setCommentInput('');
      showToast?.('Comment posted!');
    } catch (err: any) {
      showToast?.(err.message || 'Could not post comment.');
    } finally {
      setCommentSaving(false);
    }
  };

  const handleCopyShare = async () => {
    if (!currentItem) return;
    const shareUrl = currentStay
      ? `${window.location.origin}/listing/${encodeURIComponent(currentStay.id)}`
      : `${window.location.origin}/#shorts`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
    if (currentItem.kind === 'post') {
      api.sharePost(currentItem.id).catch(() => {});
    }
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
    showToast?.('Link copied to clipboard!');
  };

  const handleTapAudioLabel = () => {
    setActiveSheet('audio');
  };

  const handleFilterByThisAudio = () => {
    const trackId = currentItem?.shortAudio?.trackId;
    if (!trackId) return;
    setFilterTrackId(trackId);
    setFilterTrackLabel(`${currentItem.shortAudio.trackTitle} — ${currentItem.shortAudio.trackArtist || 'Free Library'}`);
    setCurrentIndex(0);
    setActiveSheet('none');
    showToast?.(`Showing Shorts using "${currentItem.shortAudio.trackTitle}"`);
  };

  const formatMoney = (price: number) => {
    const rate = CURRENCY_RATES[currency] || 1;
    return `${currency} ${Math.round(price * rate).toLocaleString()}`;
  };

  if (!currentItem) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center text-stone-400 space-y-3">
        <p className="text-sm font-semibold">No Shorts available right now.</p>
        <button
          type="button"
          onClick={onBackToFeed}
          className="px-4 py-2 rounded-full bg-[#e4002b] text-white text-xs font-bold cursor-pointer"
        >
          Back to Stays Feed
        </button>
      </div>
    );
  }

  const isSaved = currentStay ? savedStayIds.includes(currentStay.id) : false;
  const isUnavailable = currentItem.listingUnavailable;
  const showAudioUI = hasAddedAudioTrack(currentItem.shortAudio);
  const audioLabelText = currentItem.shortAudio.trackTitle
    ? `${currentItem.shortAudio.trackTitle}${currentItem.shortAudio.trackArtist ? ` - ${currentItem.shortAudio.trackArtist}` : ''}`
    : currentItem.shortAudio.voiceOverUrl
    ? 'Host Voice-Over'
    : '';

  const activeCaptionLine =
    showCaptions && currentItem.captionsEnabled && currentItem.captions.length > 0
      ? currentItem.captions.find(c => currentTimeSec >= c.startSec && currentTimeSec <= c.endSec)?.text ||
        currentItem.captions[0]?.text
      : null;

  const sameAudioShorts = currentItem.shortAudio?.trackId
    ? unifiedFeed.filter(i => i.shortAudio?.trackId === currentItem.shortAudio.trackId)
    : [];

  return (
    <div ref={stageRef} className={SHORTS_ZONES.stageContainerClass}>
      {/* Hidden synchronized audio elements for optional song + voice-over layering */}
      <audio ref={bgAudioRef} preload="none" />
      <audio ref={voAudioRef} preload="none" />
      {/* Preload next Short video in background for instant swipe playback */}
      {nextItem?.videoUrl && nextItem.videoUrl !== currentItem.videoUrl && (
        <video src={nextItem.videoUrl} preload="auto" muted className="hidden" aria-hidden="true" />
      )}

      {/* Desktop Left Side Context Panel (Pure Playback Navigation — NO Auto-Create UI) */}
      <div className="hidden lg:flex flex-col gap-3 w-64 mr-6 p-4 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-lg text-stone-800 dark:text-stone-200">
        <div className="text-xs font-black uppercase tracking-wider text-[#e4002b]">AirBus Shorts &amp; Reels</div>
        <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
          Swipe or use the arrows to explore verified stays in 9:16. Tap any action on a Short to open its stay page.
        </p>

        {filterTrackId && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] space-y-1.5">
            <div className="font-bold text-rose-500 truncate">Audio Filter: {filterTrackLabel}</div>
            <button
              type="button"
              onClick={() => {
                setFilterTrackId(null);
                setFilterTrackLabel(null);
              }}
              className="text-[11px] font-bold underline cursor-pointer"
            >
              Clear Audio Filter
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handlePrev}
            className="flex-1 min-h-[44px] rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
          >
            <ChevronUp className="w-4 h-4" />
            <span>Prev</span>
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 min-h-[44px] rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
          >
            <ChevronDown className="w-4 h-4" />
            <span>Next</span>
          </button>
        </div>

        <button
          type="button"
          onClick={togglePlay}
          className="w-full min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{isPlaying ? 'Pause Short' : 'Play Short'}</span>
        </button>

        <div className="text-[11px] text-stone-400 text-center">
          Short {safeIndex + 1} of {unifiedFeed.length}
        </div>
      </div>

      {/* ================================================================= */}
      {/* CENTERED 9:16 CONTAINER (Respects 100dvh + env(safe-area-inset))  */}
      {/* ================================================================= */}
      <div
        className={SHORTS_ZONES.phoneFrameClass}
        onTouchStart={e => {
          touchStartYRef.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={e => {
          if (touchStartYRef.current === null || activeSheet !== 'none') return;
          const endY = e.changedTouches[0]?.clientY ?? touchStartYRef.current;
          const delta = touchStartYRef.current - endY;
          touchStartYRef.current = null;
          if (Math.abs(delta) > 55) {
            if (delta > 0) handleNext();
            else handlePrev();
          }
        }}
        onWheel={e => {
          if (activeSheet !== 'none') return;
          const now = Date.now();
          if (now - wheelCooldownRef.current < 450) return;
          if (Math.abs(e.deltaY) > 40) {
            wheelCooldownRef.current = now;
            if (e.deltaY > 0) handleNext();
            else handlePrev();
          }
        }}
      >
        {/* Z-LAYER 1: Media Layer (Video / YouTube / Photo Fallback — Seamless Single-Short Replay) */}
        <div className="absolute inset-0" style={{ zIndex: SHORTS_Z_INDEX.video }}>
          {currentStay?.youtubeVideoId ? (
            <iframe
              src={`https://www.youtube.com/embed/${currentStay.youtubeVideoId}?autoplay=1&mute=${
                isMuted ? 1 : 0
              }&loop=1&playlist=${currentStay.youtubeVideoId}&playsinline=1&controls=0`}
              title={currentItem.title}
              className="w-full h-full border-0 pointer-events-auto"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : currentItem.videoUrl ? (
            <video
              ref={videoRef}
              src={currentItem.videoUrl}
              poster={currentItem.thumbnailUrl}
              playsInline
              preload="auto"
              muted={isMuted}
              onClick={togglePlay}
              onPlay={() => {
                setIsPlaying(true);
                if (currentItem.kind === 'post' && playRecordedForKeyRef.current !== currentItem.key) {
                  playRecordedForKeyRef.current = currentItem.key;
                  api.recordShortAnalytics(currentItem.id, 'play').catch(() => {});
                }
              }}
              onPause={() => setIsPlaying(false)}
              onEnded={handleVideoEnded}
              onTimeUpdate={() => {
                if (!videoRef.current || !videoRef.current.duration) return;
                setCurrentTimeSec(videoRef.current.currentTime);
                setPlaybackProgress(
                  Math.min(100, (videoRef.current.currentTime / videoRef.current.duration) * 100)
                );
              }}
              className="w-full h-full object-cover cursor-pointer"
            />
          ) : (
            <img
              src={currentItem.thumbnailUrl}
              alt={currentItem.title}
              onClick={togglePlay}
              className="w-full h-full object-cover cursor-pointer"
            />
          )}

          {/* Subtle Centered Play Indicator only when paused by user */}
          {!isPlaying && !currentStay?.youtubeVideoId && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Resume Short playback"
              className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/55 backdrop-blur-md text-white flex items-center justify-center shadow-2xl border border-white/25 cursor-pointer"
            >
              <Play className="w-7 h-7 fill-current ml-0.5" />
            </button>
          )}
        </div>

        {/* Z-LAYER 1.5: Verified Badge */}
        <VerifiedBadge isAbsolute size="md" />

        {/* Z-LAYER 3.5: ZONE 1 — Fixed Top Bar (Back, Section Tabs, Play/Pause, Captions, Mute — NO Create Camera Button) */}
        <div
          className="relative flex items-center justify-between gap-2 pointer-events-none shrink-0"
          style={SHORTS_ZONES.topBarStyle}
        >
          <button
            type="button"
            onClick={onBackToFeed}
            className={`pointer-events-auto ${SHORTS_TOUCH_TARGET.actionButtonClass} bg-black/60 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer`}
            aria-label="Back to home feed"
          >
            <ArrowLeft className="w-4 h-4 text-[#e4002b]" />
          </button>

          {/* Center Section Tabs / Active Audio Filter Indicator */}
          <div className="pointer-events-auto flex items-center gap-1 bg-black/55 backdrop-blur-md rounded-full p-1 max-w-[180px] overflow-hidden">
            {filterTrackId ? (
              <button
                type="button"
                onClick={() => {
                  setFilterTrackId(null);
                  setFilterTrackLabel(null);
                }}
                className="px-2.5 py-1 text-[11px] font-bold text-rose-300 flex items-center gap-1 truncate cursor-pointer"
                title="Clear audio filter"
              >
                <Music className="w-3 h-3 shrink-0" />
                <span className="truncate">{filterTrackLabel}</span>
                <X className="w-3 h-3 shrink-0" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setFeedMode('foryou');
                    setCurrentIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                    feedMode === 'foryou' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
                  }`}
                >
                  For You
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeedMode('following');
                    setCurrentIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                    feedMode === 'following' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
                  }`}
                >
                  Following
                </button>
              </>
            )}
          </div>

          {/* Playback Controls (Play/Pause, Captions toggle if captions exist, Mute) */}
          <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
            {!currentStay?.youtubeVideoId && (
              <button
                type="button"
                onClick={togglePlay}
                className={`${SHORTS_TOUCH_TARGET.actionButtonClass} bg-black/60 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/80 cursor-pointer`}
                aria-label={isPlaying ? 'Pause video' : 'Play video'}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
            )}

            {currentItem.captions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCaptions(c => !c)}
                className={`${SHORTS_TOUCH_TARGET.actionButtonClass} bg-black/60 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/80 cursor-pointer`}
                aria-label={showCaptions ? 'Hide captions' : 'Show captions'}
                title={showCaptions ? 'Hide captions' : 'Show captions'}
              >
                <Captions className={`w-4 h-4 ${showCaptions ? 'text-emerald-400' : 'text-stone-400'}`} />
              </button>
            )}

            {!currentStay?.youtubeVideoId && (
              <button
                type="button"
                onClick={() => setIsMuted(m => !m)}
                className={`${SHORTS_TOUCH_TARGET.actionButtonClass} bg-black/60 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/80 cursor-pointer`}
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
            )}
          </div>
        </div>

        {/* Z-LAYER 2: ZONE 4 — Auto-Captions Safe Area */}
        {activeCaptionLine && activeSheet === 'none' && (
          <div
            className="absolute inset-x-3 pointer-events-none flex justify-start"
            style={{
              bottom: SHORTS_ZONES.captionsBottomOffset,
              paddingRight: SHORTS_ZONES.captionsRightPadding,
              zIndex: SHORTS_Z_INDEX.captions,
            }}
          >
            <div className="bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl leading-snug shadow-lg max-w-full break-words">
              {activeCaptionLine}
            </div>
          </div>
        )}

        {/* Z-LAYER 3: ZONE 2 — Right-Side Vertical Action Rail */}
        <div
          className="absolute flex flex-col items-center gap-2.5 pointer-events-auto"
          style={{
            bottom: SHORTS_ZONES.actionRailBottomOffset,
            right: SHORTS_ZONES.actionRailRightOffset,
            zIndex: SHORTS_Z_INDEX.infoAndActionRail,
          }}
        >
          {/* Prev / Next controls on mobile */}
          <div className="flex lg:hidden flex-col items-center gap-1.5 mb-0.5">
            <button
              type="button"
              onClick={handlePrev}
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md cursor-pointer"
              aria-label="Previous Short"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md cursor-pointer"
              aria-label="Next Short"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Like */}
          <button
            type="button"
            onClick={handleToggleLike}
            className="flex flex-col items-center gap-0.5 text-white cursor-pointer"
            aria-label="Like Short"
          >
            <span
              className={`${SHORTS_TOUCH_TARGET.actionButtonClass} rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
                liked ? 'bg-[#ff2e93] text-white shadow-[0_0_15px_#ff2e93]' : 'bg-black/60 hover:bg-black/80'
              }`}
            >
              <ThumbsUp className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
            </span>
            <span className="text-[10px] font-bold drop-shadow">{likesCount}</span>
          </button>

          {/* Comments */}
          <button
            type="button"
            onClick={() => setActiveSheet(s => (s === 'comments' ? 'none' : 'comments'))}
            className="flex flex-col items-center gap-0.5 text-white cursor-pointer"
            aria-label="Open comments"
          >
            <span className={`${SHORTS_TOUCH_TARGET.actionButtonClass} rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center backdrop-blur-md`}>
              <MessageSquare className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold drop-shadow">{localComments.length}</span>
          </button>

          {/* Save */}
          {currentStay && !isUnavailable && (
            <button
              type="button"
              onClick={() => onToggleSave(currentStay.id)}
              className="flex flex-col items-center gap-0.5 text-white cursor-pointer"
              aria-label={isSaved ? 'Remove from saved' : 'Save stay'}
            >
              <span
                className={`${SHORTS_TOUCH_TARGET.actionButtonClass} rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
                  isSaved ? 'bg-[#e4002b] text-white shadow-[0_0_15px_#e4002b]' : 'bg-black/60 hover:bg-black/80'
                }`}
              >
                <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
              </span>
              <span className="text-[10px] font-bold drop-shadow">{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          )}

          {/* Share */}
          <button
            type="button"
            onClick={() => setActiveSheet(s => (s === 'share' ? 'none' : 'share'))}
            className="flex flex-col items-center gap-0.5 text-white cursor-pointer"
            aria-label="Share Short"
          >
            <span className={`${SHORTS_TOUCH_TARGET.actionButtonClass} rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center backdrop-blur-md`}>
              <Share2 className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold drop-shadow">Share</span>
          </button>

          {/* Audio Disc — ONLY rendered when Short has a song or voice-over attached */}
          {showAudioUI && (
            <button
              type="button"
              onClick={handleTapAudioLabel}
              className="flex flex-col items-center gap-0.5 text-white cursor-pointer"
              aria-label="Audio details and tracks using this audio"
            >
              <span className={`${SHORTS_TOUCH_TARGET.actionButtonClass} rounded-full bg-gradient-to-tr from-stone-900 via-stone-700 to-stone-900 border-2 border-white/30 flex items-center justify-center shadow-lg`}>
                <Disc3 className={`w-5 h-5 text-[#ff2e93] ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
              </span>
            </button>
          )}
        </div>

        {/* Z-LAYER 3: ZONE 3 — Bottom-Left Info Block */}
        <div
          className="relative mt-auto pt-12 px-3.5 bg-gradient-to-t from-black/95 via-black/80 to-transparent text-white flex flex-col gap-1.5 pointer-events-none"
          style={{
            paddingBottom: SHORTS_ZONES.infoBlockPaddingBottom,
            paddingRight: SHORTS_ZONES.infoBlockPaddingRight,
            zIndex: SHORTS_Z_INDEX.infoAndActionRail,
          }}
        >
          {/* Creator Row + Inline Follow + Views */}
          <div className="flex items-center gap-2 min-w-0 pointer-events-auto">
            <span className="text-xs sm:text-sm font-extrabold truncate">@{currentItem.creatorName}</span>
            <button
              type="button"
              onClick={handleToggleFollow}
              className={`min-h-[32px] px-2.5 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${
                isFollowing
                  ? 'bg-white/20 text-white'
                  : 'bg-[#e4002b] hover:bg-[#c90026] text-white'
              }`}
            >
              {isFollowing ? <UserCheck className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
              <span>{isFollowing ? 'Following' : 'Follow'}</span>
            </button>
            <span className="text-[11px] text-stone-300 flex items-center gap-1 ml-auto shrink-0">
              <Eye className="w-3 h-3" />
              {viewsCount.toLocaleString()}
            </span>
          </div>

          {/* Linked Stay Info OR Listing Unavailable Banner */}
          {isUnavailable || !currentStay ? (
            <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Listing unavailable</span>
            </div>
          ) : (
            <div className="pointer-events-auto min-w-0">
              <h3
                onClick={() => handleListingActionClick('book')}
                className="text-sm font-extrabold leading-tight truncate cursor-pointer hover:text-pink-300"
              >
                {currentStay.title}
              </h3>
              <div className="flex items-center gap-1.5 text-[11px] text-stone-300 truncate">
                <MapPin className="w-3 h-3 text-[#ff2e93] shrink-0" />
                <span className="truncate">{currentStay.location}</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-400 font-bold flex items-center gap-0.5 shrink-0">
                  <Star className="w-3 h-3 fill-current" />
                  {currentStay.rating}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-bold text-white shrink-0">{formatMoney(currentStay.price)}</span>
              </div>
            </div>
          )}

          {/* Caption (Collapsed to 2 lines with "more" toggle) */}
          <div className="pointer-events-auto text-xs text-stone-200 leading-snug">
            <p className={`${captionExpanded ? 'max-h-20 overflow-y-auto' : 'line-clamp-2'} break-words`}>
              {currentItem.caption}
            </p>
            {currentItem.caption.length > 75 && (
              <button
                type="button"
                onClick={() => setCaptionExpanded(e => !e)}
                className="text-[11px] font-bold text-stone-400 hover:text-white cursor-pointer"
              >
                {captionExpanded ? 'less' : 'more'}
              </button>
            )}
          </div>

          {/* Hashtags */}
          {currentItem.hashtags.length > 0 && (
            <div className="text-[11px] font-semibold text-sky-300 truncate">
              {currentItem.hashtags.join(' ')}
            </div>
          )}

          {/* Optional Audio Label — ONLY rendered when a song or voice-over is attached */}
          {showAudioUI && audioLabelText && (
            <button
              type="button"
              onClick={handleTapAudioLabel}
              className="pointer-events-auto flex items-center gap-1.5 min-h-[28px] max-w-full overflow-hidden text-left cursor-pointer group"
              title="Tap to see audio license & Shorts using this audio"
            >
              <Music className="w-3.5 h-3.5 text-[#ff2e93] shrink-0" />
              <div className="flex-1 min-w-0 overflow-hidden">
                <span className="shorts-audio-marquee text-[11px] font-bold text-white group-hover:text-pink-300">
                  Audio: {audioLabelText}
                  {currentItem.shortAudio.requiresAttribution && currentItem.shortAudio.attributionText
                    ? ` · ${currentItem.shortAudio.attributionText}`
                    : ''}
                </span>
              </div>
            </button>
          )}
        </div>

        {/* Z-LAYER 3: ZONE 3B — Dedicated 5 Listing Navigation Buttons Row */}
        <div
          className="absolute inset-x-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar pointer-events-auto"
          style={{
            bottom: SHORTS_ZONES.listingActionsBottomOffset,
            zIndex: SHORTS_Z_INDEX.infoAndActionRail,
          }}
        >
          <button
            type="button"
            disabled={isUnavailable}
            onClick={() => handleListingActionClick('book')}
            className="min-h-[44px] px-3 rounded-xl bg-[#e4002b] hover:bg-[#c90026] disabled:bg-stone-700 disabled:text-stone-400 disabled:cursor-not-allowed text-white text-[11px] font-extrabold shrink-0 shadow cursor-pointer"
          >
            Book now
          </button>
          <button
            type="button"
            disabled={isUnavailable}
            onClick={() => handleListingActionClick('availability')}
            className="min-h-[44px] px-2.5 rounded-xl bg-black/75 hover:bg-black/90 disabled:opacity-45 disabled:cursor-not-allowed border border-white/20 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 backdrop-blur-md cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Availability</span>
          </button>
          <button
            type="button"
            disabled={isUnavailable}
            onClick={() => handleListingActionClick('chat')}
            className="min-h-[44px] px-2.5 rounded-xl bg-black/75 hover:bg-black/90 disabled:opacity-45 disabled:cursor-not-allowed border border-white/20 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 backdrop-blur-md cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Chat host</span>
          </button>
          <button
            type="button"
            disabled={isUnavailable}
            onClick={() => handleListingActionClick('negotiate')}
            className="min-h-[44px] px-2.5 rounded-xl bg-black/75 hover:bg-black/90 disabled:opacity-45 disabled:cursor-not-allowed border border-white/20 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 backdrop-blur-md cursor-pointer"
          >
            <BadgeDollarSign className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Negotiate</span>
          </button>
          <button
            type="button"
            disabled={isUnavailable || !currentStay?.whatsapp}
            onClick={() => handleListingActionClick('whatsapp')}
            className="min-h-[44px] px-2.5 rounded-xl bg-[#16a34a]/90 hover:bg-[#15803d] disabled:bg-stone-800 disabled:text-stone-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5 shrink-0" />
            <span>Book direct on WhatsApp</span>
          </button>
        </div>

        {/* Z-LAYER 3.6: ZONE 5 — Thin Bottom Progress Bar */}
        <div
          className="absolute inset-x-0 h-[3px] bg-white/20 pointer-events-none"
          style={{
            bottom: SHORTS_ZONES.progressBarBottomOffset,
            zIndex: SHORTS_Z_INDEX.progressBar,
          }}
        >
          <div
            className="h-full bg-[#ff2e93] transition-all duration-150"
            style={{ width: `${playbackProgress}%` }}
          />
        </div>

        {/* ================================================================= */}
        {/* BOTTOM SHEETS (Comments / Audio Attribution / Share)               */}
        {/* ================================================================= */}
        {activeSheet !== 'none' && (
          <div
            className="absolute inset-0 bg-black/45 flex items-end"
            style={{ zIndex: SHORTS_Z_INDEX.bottomSheet }}
            onClick={() => setActiveSheet('none')}
          >
            <div
              className="w-full bg-[#15171e] text-white rounded-t-3xl border-t border-stone-800 shadow-2xl flex flex-col overflow-hidden"
              style={{
                maxHeight: SHORTS_ZONES.bottomSheetMaxHeight,
                paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="pt-2.5 pb-2.5 px-4 border-b border-stone-800 shrink-0">
                <div className="w-10 h-1 rounded-full bg-stone-600 mx-auto mb-2" />
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-extrabold">
                    {activeSheet === 'comments' && `Comments (${localComments.length})`}
                    {activeSheet === 'audio' && 'Audio & Attribution'}
                    {activeSheet === 'share' && 'Share Short'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveSheet('none')}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-stone-800 cursor-pointer"
                    aria-label="Close sheet"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {/* COMMENTS SHEET */}
                {activeSheet === 'comments' && (
                  <>
                    <form onSubmit={handleAddComment} className="flex gap-2">
                      <input
                        type="text"
                        value={commentInput}
                        onChange={e => setCommentInput(e.target.value)}
                        placeholder={user ? 'Add a comment...' : 'Sign in to comment...'}
                        className="flex-1 px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white outline-none focus:border-[#ff2e93]"
                      />
                      <button
                        type="submit"
                        disabled={commentSaving}
                        className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[#e4002b] text-white text-xs font-bold flex items-center justify-center cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>

                    {localComments.length === 0 ? (
                      <p className="text-xs text-stone-400 text-center py-6">
                        No comments yet. Be the first to share your thoughts!
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {localComments.map(c => (
                          <div key={c.id} className="p-2.5 rounded-xl bg-stone-900 border border-stone-800 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-white">{c.authorName}</span>
                              <span className="text-stone-500">
                                {new Date(c.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-stone-200 break-words">{c.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* AUDIO DETAILS & SAME-AUDIO SHORTS SHEET (Read-only public attribution) */}
                {activeSheet === 'audio' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl bg-stone-900 border border-stone-800 space-y-1.5">
                      <div className="text-sm font-extrabold text-white">
                        {currentItem.shortAudio.trackTitle || 'Host Voice-Over'}
                      </div>
                      {currentItem.shortAudio.trackArtist && (
                        <div className="text-xs text-stone-400">
                          Artist: {currentItem.shortAudio.trackArtist}
                        </div>
                      )}
                      <div className="text-[11px] text-stone-400">
                        {currentItem.shortAudio.attributionText || 'Cleared for AirBus UGC Shorts'}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        {currentItem.shortAudio.trackId && (
                          <button
                            type="button"
                            onClick={handleFilterByThisAudio}
                            className="min-h-[44px] px-3.5 rounded-xl bg-[#e4002b] hover:bg-[#c90026] text-white text-xs font-bold cursor-pointer"
                          >
                            View {sameAudioShorts.length} Short{sameAudioShorts.length === 1 ? '' : 's'} with this audio
                          </button>
                        )}
                        {currentItem.shortAudio.trackId && (
                          <button
                            type="button"
                            onClick={() => setShowReportAudioBox(v => !v)}
                            className="min-h-[44px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Flag className="w-3.5 h-3.5" />
                            <span>Report Audio</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {showReportAudioBox && currentItem.shortAudio.trackId && (
                      <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-700/50 space-y-2">
                        <input
                          type="text"
                          value={reportAudioReason}
                          onChange={e => setReportAudioReason(e.target.value)}
                          placeholder="Reason for reporting this audio..."
                          className="w-full px-3 py-2 bg-stone-950 border border-amber-800 rounded-lg text-xs text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await api.reportAudioTrack(
                              currentItem.shortAudio.trackId!,
                              reportAudioReason || 'Audio licensing concern',
                              currentItem.id
                            );
                            showToast?.('Audio reported for moderation review.');
                            setShowReportAudioBox(false);
                            setReportAudioReason('');
                          }}
                          className="min-h-[44px] px-4 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold cursor-pointer"
                        >
                          Submit Audio Report
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* SHARE SHEET */}
                {activeSheet === 'share' && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleCopyShare}
                      className="w-full min-h-[44px] px-4 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 flex items-center justify-between text-xs font-bold cursor-pointer"
                    >
                      <span>Copy Share Link</span>
                      {copiedShare ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    {currentStay && !isUnavailable && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSheet('none');
                          handleListingActionClick('book');
                        }}
                        className="w-full min-h-[44px] px-4 rounded-xl bg-[#e4002b] text-white text-xs font-extrabold cursor-pointer"
                      >
                        Go to Listing Page
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
