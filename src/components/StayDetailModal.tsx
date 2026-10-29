import React, { useState, useEffect } from 'react';
import {
  Stay,
  Booking,
  Review,
  User,
  Currency,
  CURRENCY_RATES,
  VideoComment,
  AdRequest,
} from '../types';
import {
  X,
  Star,
  MapPin,
  Calendar,
  Users,
  ShieldCheck,
  CheckCircle2,
  Heart,
  Share2,
  Flag,
  MessageSquare,
  BadgeDollarSign,
  PhoneCall,
  ExternalLink,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ArrowLeft,
  Eye,
  ThumbsUp,
  UserPlus,
  UserCheck,
  Sparkles,
  Send,
  CornerDownRight,
  Youtube,
  Tv,
  Image as ImageIcon,
  TrendingUp,
  Megaphone,
} from 'lucide-react';
import { api } from '../api';
import { PriceTrendCard } from './PriceTrendCard';
import { AdvertModal } from './AdvertModal';
import { ViralityModal } from './ViralityModal';


interface StayDetailModalProps {
  stay: Stay | null;
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  isSaved: boolean;
  onToggleSave: (stayId: string) => void;
  onBook: (bookingData: {
    stayId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    note?: string;
  }) => Promise<Booking>;
  onChatHost: (stayId: string) => void;
  onNegotiate: (stayId: string) => void;
  onPostReview: (data: { stayId: string; rating: number; comment: string }) => Promise<void>;
  reviews: Review[];
  currency: Currency;
  relatedStays: Stay[];
  onSelectRelatedStay: (stayId: string) => void;
  onUpdateStay?: (stayId: string, updates: Partial<Stay>) => void;
  userWalletBalance?: number;
  onOpenTopup?: () => void;
  onOpenAuth?: () => void;
  showToast?: (msg: string) => void;
}

export const StayDetailModal: React.FC<StayDetailModalProps> = ({
  stay,
  isOpen,
  onClose,
  user,
  isSaved,
  onToggleSave,
  onBook,
  onChatHost,
  onNegotiate,
  onPostReview,
  reviews,
  currency,
  relatedStays,
  onSelectRelatedStay,
  onUpdateStay,
  userWalletBalance = 0,
  onOpenTopup,
  onOpenAuth,
  showToast,
}) => {
  if (!isOpen || !stay) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

  const [checkIn, setCheckIn] = useState(todayStr);
  const [checkOut, setCheckOut] = useState(new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
  const [guestCount, setGuestCount] = useState(Math.min(2, stay.guests));
  const [guestNote, setGuestNote] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  // Review states
  const [ratingInput, setRatingInput] = useState(5);
  const [commentInput, setCommentInput] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  // Video states
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [mediaMode, setMediaMode] = useState<'video' | 'gallery'>('video');

  // Social metrics states (Local reactive for instant feedback)
  const isInitiallyLiked = user ? (stay.likedByUserEmails || []).includes(user.email) : false;
  const isInitiallyFollowing = user && stay.owner ? (stay.hostFollowedByUserEmails || []).includes(user.email) : false;

  const [liked, setLiked] = useState(isInitiallyLiked);
  const [likesCount, setLikesCount] = useState(stay.likesCount || 0);
  const [isFollowing, setIsFollowing] = useState(isInitiallyFollowing);
  const [followerCount, setFollowerCount] = useState(stay.hostFollowerCount || 12);
  const [viewsCount, setViewsCount] = useState(stay.views || 0);

  // AirBus.AI Concierge State
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);

  // Comments State
  const [comments, setComments] = useState<VideoComment[]>(stay.comments || []);
  const [newCommentText, setNewCommentText] = useState('');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Ads & Virality Modals
  const [advertModalOpen, setAdvertModalOpen] = useState(false);
  const [viralityModalOpen, setViralityModalOpen] = useState(false);
  const [activeAds, setActiveAds] = useState<AdRequest[]>([]);

  const loadActiveAds = () => {
    if (stay?.id) {
      api.getAds({ stayId: stay.id, status: 'approved' })
        .then(res => setActiveAds(res.ads))
        .catch(() => {});
    }
  };

  useEffect(() => {
    loadActiveAds();
  }, [stay?.id]);


  // Record view on open
  useEffect(() => {
    if (stay?.id) {
      api.recordStayView(stay.id)
        .then(res => {
          if (res.views) {
            setViewsCount(res.views);
            onUpdateStay?.(stay.id, { views: res.views });
          }
        })
        .catch(() => {});
    }
  }, [stay?.id]);

  const formatMoney = (val: number) => {
    const rate = CURRENCY_RATES[currency] || 1;
    const converted = Math.round(val * rate);
    return `${currency} ${converted.toLocaleString()}`;
  };

  // Pricing math
  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 864e5));
  const subtotal = stay.price * nights;
  const cleaningFee = Math.round(stay.price * 0.15);
  const serviceFee = Math.round(subtotal * 0.08);
  const grandTotal = subtotal + cleaningFee + serviceFee;

  // Handle like toggle
  const handleToggleLike = async () => {
    if (!user) {
      alert('Please sign in to like this video stay.');
      return;
    }
    const newLiked = !liked;
    const newCount = newLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setLiked(newLiked);
    setLikesCount(newCount);

    try {
      const res = await api.toggleLikeStay(stay.id);
      setLiked(res.liked);
      setLikesCount(res.likesCount);
      onUpdateStay?.(stay.id, { likesCount: res.likesCount });
    } catch (e) {
      setLiked(!newLiked);
      setLikesCount(likesCount);
    }
  };

  // Handle follow toggle
  const handleToggleFollow = async () => {
    if (!user) {
      alert('Please sign in to follow this host.');
      return;
    }
    const hostEmail = stay.owner || 'host@airbus.ke';
    const newFollowing = !isFollowing;
    const newCount = newFollowing ? followerCount + 1 : Math.max(0, followerCount - 1);
    setIsFollowing(newFollowing);
    setFollowerCount(newCount);

    try {
      const res = await api.toggleFollowHost(hostEmail);
      setIsFollowing(res.isFollowing);
      setFollowerCount(res.followerCount);
      onUpdateStay?.(stay.id, { hostFollowerCount: res.followerCount });
    } catch (e) {
      setIsFollowing(!newFollowing);
      setFollowerCount(followerCount);
    }
  };

  // Ask AirBus.AI
  const handleAskAi = async (customPrompt?: string) => {
    const query = customPrompt || aiQuestion;
    if (!query.trim()) return;
    setAiLoading(true);
    setAiAnswer(null);

    try {
      const res = await api.askStayAi(stay.id, query);
      setAiAnswer(res.answer);
    } catch (err: any) {
      setAiAnswer('AirBus.AI: ' + (err.message || 'Unable to connect to concierge right now.'));
    } finally {
      setAiLoading(false);
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    setPostingComment(true);

    try {
      const res = await api.addStayComment(stay.id, newCommentText.trim());
      setComments(res.comments);
      setNewCommentText('');
      onUpdateStay?.(stay.id, { comments: res.comments });
    } catch (err: any) {
      alert(err.message || 'Could not post comment.');
    } finally {
      setPostingComment(false);
    }
  };

  // Add Nested Reply
  const handleAddReply = async (commentId: string) => {
    if (!replyText.trim()) return;
    try {
      const res = await api.addCommentReply(stay.id, commentId, replyText.trim());
      setComments(res.comments);
      setActiveReplyId(null);
      setReplyText('');
      onUpdateStay?.(stay.id, { comments: res.comments });
    } catch (err: any) {
      alert(err.message || 'Could not post reply.');
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      alert('Please select valid check-in and check-out dates.');
      return;
    }
    setBookingLoading(true);
    try {
      const b = await onBook({
        stayId: stay.id,
        checkIn,
        checkOut,
        guests: guestCount,
        note: guestNote,
      });
      setConfirmedBooking(b);
    } catch (err: any) {
      alert(err.message || 'Booking request failed.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) {
      alert('Please enter a review comment.');
      return;
    }
    setReviewLoading(true);
    setReviewMsg(null);
    try {
      await onPostReview({
        stayId: stay.id,
        rating: ratingInput,
        comment: commentInput.trim(),
      });
      setCommentInput('');
      setReviewMsg('Thank you! Your verified review has been posted.');
    } catch (err: any) {
      setReviewMsg(err.message || 'Error posting review.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert('Stay link copied to clipboard!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl overflow-hidden shadow-2xl border border-stone-200 dark:border-stone-800 my-auto">
        {/* Modal Top Header with Ubiquitous Go Back Button */}
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#15171e]/95 backdrop-blur-md px-4 sm:px-6 py-3 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-bold transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#e4002b]" />
            <span>Go Back</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleSave(stay.id)}
              className={`p-2 rounded-full border transition-all cursor-pointer ${
                isSaved
                  ? 'bg-[#e4002b] text-white border-[#e4002b]'
                  : 'border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-900 dark:hover:text-white'
              }`}
              title={isSaved ? 'Saved to Wishlist' : 'Save to Wishlist'}
            >
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={handleShare}
              className="p-2 rounded-full border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-900 dark:hover:text-white transition-all cursor-pointer"
              title="Share stay"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-6 max-h-[calc(90vh-65px)] overflow-y-auto">
          {/* Media Player Section: YouTube Embed OR Native Video OR Gallery */}
          <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-black shadow-lg">
            {mediaMode === 'video' ? (
              stay.youtubeVideoId ? (
                /* YouTube Video Player Embed */
                <iframe
                  src={`https://www.youtube.com/embed/${stay.youtubeVideoId}?autoplay=1&mute=${
                    isMuted ? 1 : 0
                  }&playsinline=1&rel=0`}
                  title={stay.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : stay.videoUrl ? (
                /* HTML5 Video Player */
                <video
                  src={stay.videoUrl}
                  poster={stay.thumbnailUrl}
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white">
                  <Play className="w-12 h-12 text-[#e4002b] mb-2" />
                  <p className="text-xs text-stone-400">Video tour being processed by host</p>
                </div>
              )
            ) : (
              /* Photo Gallery fallback */
              <div className="w-full h-full">
                <img
                  src={stay.thumbnailUrl || (stay.images && stay.images[0])}
                  alt={stay.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Media Mode & Audio Controls */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
              <button
                onClick={() => setMediaMode('video')}
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  mediaMode === 'video'
                    ? 'bg-[#e4002b] text-white shadow-md'
                    : 'bg-black/60 backdrop-blur-md text-white/80 hover:text-white'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Video Tour</span>
              </button>

              <button
                onClick={() => setMediaMode('gallery')}
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  mediaMode === 'gallery'
                    ? 'bg-[#e4002b] text-white shadow-md'
                    : 'bg-black/60 backdrop-blur-md text-white/80 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Photos ({stay.images?.length || 1})</span>
              </button>
            </div>

            {/* Audio Toggle (For native video) */}
            {mediaMode === 'video' && !stay.youtubeVideoId && stay.videoUrl && (
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="absolute bottom-3 right-3 z-20 bg-black/70 backdrop-blur-md text-white p-2 rounded-full hover:bg-black/90 cursor-pointer"
                title={isMuted ? 'Unmute video' : 'Mute video'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* YouTube-Style Channel & Engagement Social Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
            {/* Host Channel Info */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#e4002b] to-[#8b5cf6] flex items-center justify-center text-white font-extrabold text-sm shadow-md">
                {(stay.hostName || 'H')[0].toUpperCase()}
              </div>

              <div>
                <div className="flex items-center gap-1.5 font-bold text-stone-900 dark:text-white text-sm">
                  <span>{stay.hostName || 'AirBus Verified Host'}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  {followerCount.toLocaleString()} followers · Verified 30-day host
                </div>
              </div>

              {/* Follow Button */}
              <button
                onClick={handleToggleFollow}
                className={`ml-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  isFollowing
                    ? 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                    : 'bg-[#e4002b] hover:bg-[#c90026] text-white shadow-sm'
                }`}
              >
                {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                <span>{isFollowing ? 'Following' : 'Follow'}</span>
              </button>
            </div>

            {/* Engagement Metrics (Views, Thumbs Up Likes, Comments) */}
            <div className="flex items-center gap-2">
              {/* Views */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300">
                <Eye className="w-3.5 h-3.5 text-stone-400" />
                <span>{viewsCount.toLocaleString()} views</span>
              </div>

              {/* Likes */}
              <button
                onClick={handleToggleLike}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                  liked
                    ? 'bg-[#ff2e93] text-white border-[#ff2e93] shadow-sm'
                    : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                }`}
              >
                <ThumbsUp className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
                <span>{likesCount.toLocaleString()}</span>
              </button>

              {/* Virality Graph Button */}
              <button
                onClick={() => setViralityModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border border-purple-500/30 text-xs font-bold text-purple-700 dark:text-purple-300 transition-all cursor-pointer shadow-xs active:scale-95"
                title="View virality graph and creator engagement insights"
              >
                <TrendingUp className="w-3.5 h-3.5 text-[#ff2e93]" />
                <span className="hidden sm:inline">Virality Graph</span>
              </button>
            </div>
          </div>

          {/* Title & Location Header */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-[#fbbf24] text-stone-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase">
                {stay.category}
              </span>
              <span className="bg-stone-100 dark:bg-stone-800 font-bold text-stone-600 dark:text-stone-300 text-xs px-2.5 py-0.5 rounded-full">
                {stay.type}
              </span>
              <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{stay.rating.toFixed(1)}</span>
                <span className="text-stone-400 font-normal">({stay.reviewsCount} reviews)</span>
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-black font-heading tracking-tight text-stone-900 dark:text-white">
              {stay.title}
            </h1>

            <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
              <MapPin className="w-3.5 h-3.5 text-[#e4002b]" />
              <span>{stay.location}</span>
              <span>·</span>
              <span>{stay.guests} guests max</span>
              <span>·</span>
              <span>{stay.beds} beds</span>
              <span>·</span>
              <span>{stay.area} m²</span>
            </div>
          </div>

          {/* Benevolent AirBus.AI Concierge Box */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-purple-950/20 via-pink-950/20 to-stone-900/40 border border-purple-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#ff2e93] to-[#8b5cf6] flex items-center justify-center text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold text-stone-900 dark:text-white">
                  Ask AirBus.AI Concierge
                </h3>
              </div>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold">
                Live Property Intelligence
              </span>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300">
              Get benevolent, authentic answers and review summaries specifically for {stay.title}.
            </p>

            {/* Quick Prompt Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'Is there fast WiFi for work?',
                'Is it safe & quiet for families?',
                'What are nearest landmarks?',
                'Summarize the best reviews',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => handleAskAi(q)}
                  disabled={aiLoading}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/80 dark:bg-stone-800/80 hover:bg-white dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-purple-300/40 transition-colors cursor-pointer disabled:opacity-50"
                >
                  ✨ {q}
                </button>
              ))}
            </div>

            {/* Custom Question Input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={aiQuestion}
                onChange={e => setAiQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAskAi()}
                placeholder="Ask anything about this stay (e.g. kitchen appliances, parking, security)..."
                className="flex-1 px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#ff2e93]"
              />
              <button
                onClick={() => handleAskAi()}
                disabled={aiLoading || !aiQuestion.trim()}
                className="px-4 py-2 bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {aiLoading ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Ask</span>
              </button>
            </div>

            {/* AI Response Display */}
            {aiAnswer && (
              <div className="p-3.5 rounded-2xl bg-white/90 dark:bg-stone-900/90 border border-purple-500/30 text-xs space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-1 text-[11px] font-bold text-purple-600 dark:text-purple-400">
                  <Sparkles className="w-3 h-3" />
                  <span>AirBus.AI Recommendation</span>
                </div>
                <div className="text-stone-800 dark:text-stone-200 leading-relaxed whitespace-pre-wrap">
                  {aiAnswer}
                </div>
              </div>
            )}
          </div>

          {/* Description & Amenities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Description, Amenities, Host Rules */}
            <div className="md:col-span-7 space-y-5">
              {stay.description && (
                <div>
                  <h3 className="text-sm font-extrabold text-stone-900 dark:text-white mb-2">About this stay</h3>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed whitespace-pre-line">
                    {stay.description}
                  </p>
                </div>
              )}

              {/* Amenities */}
              <div>
                <h3 className="text-sm font-extrabold text-stone-900 dark:text-white mb-2">
                  What this place offers ({stay.features?.length || 0})
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {stay.features?.map(feat => (
                    <div
                      key={feat}
                      className="flex items-center gap-2 p-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-700 dark:text-stone-300"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* House Rules & Policies */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                  <h4 className="text-xs font-bold text-stone-900 dark:text-white mb-1">House Rules</h4>
                  <p className="text-[11px] text-stone-500 leading-normal">
                    Check-in after 14:00, checkout before 10:00. No unauthorized parties. Respect neighborhood quiet hours.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                  <h4 className="text-xs font-bold text-stone-900 dark:text-white mb-1">Direct Settlement</h4>
                  <p className="text-[11px] text-stone-500 leading-normal">
                    Free cancellation before check-in. Guests pay hosts directly after property tour and key handover.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Reservation & Price Trend */}
            <div className="md:col-span-5 space-y-4">
              {/* 30-Day Price Trend Sparkline */}
              <PriceTrendCard
                stayId={stay.id}
                currency={currency}
                onNegotiate={() => onNegotiate(stay.id)}
              />

              <div className="bg-stone-50 dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4 sticky top-16">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-stone-900 dark:text-white">
                      {formatMoney(stay.price)}
                    </span>
                    <span className="text-xs text-stone-500 ml-1">/ night</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {stay.instantBook ? '⚡ Instant Confirmation' : 'Host approval'}
                  </span>
                </div>

                {confirmedBooking ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <h4 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                      Booking Confirmed!
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      Reference: <span className="font-mono font-bold">{confirmedBooking.reference}</span>
                    </p>
                    <p className="text-[11px] text-stone-500">
                      Settle payment directly with your host at check-in.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleBookingSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 uppercase">Check-in</label>
                        <input
                          type="date"
                          value={checkIn}
                          min={todayStr}
                          onChange={e => setCheckIn(e.target.value)}
                          className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 uppercase">Check-out</label>
                        <input
                          type="date"
                          value={checkOut}
                          min={tomorrowStr}
                          onChange={e => setCheckOut(e.target.value)}
                          className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-stone-500 uppercase">
                        Guests (max {stay.guests})
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={stay.guests}
                        value={guestCount}
                        onChange={e => setGuestCount(Number(e.target.value))}
                        className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
                        required
                      />
                    </div>

                    {/* Price Breakdown */}
                    <div className="space-y-1.5 text-xs text-stone-500 pt-2 border-t border-stone-200 dark:border-stone-800">
                      <div className="flex justify-between">
                        <span>
                          {formatMoney(stay.price)} × {nights} {nights === 1 ? 'night' : 'nights'}
                        </span>
                        <span>{formatMoney(subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cleaning fee (15%)</span>
                        <span>{formatMoney(cleaningFee)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Service fee (8%)</span>
                        <span>{formatMoney(serviceFee)}</span>
                      </div>
                      <div className="flex justify-between font-extrabold text-stone-900 dark:text-white pt-1 border-t border-stone-200 dark:border-stone-800 text-sm">
                        <span>Total (Display only)</span>
                        <span>{formatMoney(grandTotal)}</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={bookingLoading}
                      className="w-full py-2.5 rounded-full bg-[#e4002b] hover:bg-[#c90026] text-white font-extrabold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
                    >
                      {bookingLoading ? 'Processing...' : stay.instantBook ? 'Book Now (Instant)' : 'Request to Book'}
                    </button>
                  </form>
                )}

                {/* Direct Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                  <button
                    onClick={() => onChatHost(stay.id)}
                    className="py-2 px-3 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-stone-400" />
                    <span>Chat Host</span>
                  </button>

                  <button
                    onClick={() => onNegotiate(stay.id)}
                    className="py-2 px-3 rounded-full bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <BadgeDollarSign className="w-3.5 h-3.5" />
                    <span>Negotiate</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Video Discussion & Nested Comments Section */}
          <div className="pt-6 border-t border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#e4002b]" />
                <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
                  Property Discussion ({comments.length})
                </h3>
              </div>
            </div>

            {/* Post Comment Input */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={newCommentText}
                onChange={e => setNewCommentText(e.target.value)}
                placeholder={user ? `Comment as ${user.name}...` : 'Sign in to join the conversation...'}
                disabled={!user || postingComment}
                className="flex-1 px-4 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl text-xs outline-none focus:border-[#e4002b]"
              />
              <button
                type="submit"
                disabled={!user || postingComment || !newCommentText.trim()}
                className="px-4 py-2 bg-[#e4002b] text-white rounded-2xl text-xs font-bold hover:bg-[#c90026] disabled:opacity-50 cursor-pointer"
              >
                Post
              </button>
            </form>

            {/* Comments List */}
            <div className="space-y-3 pt-2">
              {comments.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No comments on this stay yet. Be the first to start the conversation!</p>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-stone-300 dark:bg-stone-700 flex items-center justify-center text-[10px] font-bold">
                          {c.userName[0].toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-stone-800 dark:text-stone-200">{c.userName}</span>
                        {c.isHost && (
                          <span className="text-[10px] bg-[#e4002b] text-white font-bold px-1.5 py-0.2 rounded">
                            Host
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>

                    <p className="text-xs text-stone-700 dark:text-stone-300 pl-8">{c.text}</p>

                    {/* Reply Action */}
                    <div className="pl-8 pt-1 flex items-center gap-3 text-[11px]">
                      <button
                        onClick={() => setActiveReplyId(activeReplyId === c.id ? null : c.id)}
                        className="text-stone-500 hover:text-[#e4002b] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <CornerDownRight className="w-3 h-3" />
                        <span>Reply</span>
                      </button>
                    </div>

                    {/* Nested Replies */}
                    {c.replies && c.replies.length > 0 && (
                      <div className="pl-8 pt-2 space-y-2 border-l-2 border-stone-200 dark:border-stone-800 ml-4">
                        {c.replies.map(rep => (
                          <div key={rep.id} className="text-xs space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-stone-800 dark:text-stone-200">{rep.userName}</span>
                              {rep.isHost && (
                                <span className="text-[9px] bg-[#e4002b] text-white font-bold px-1 rounded">Host</span>
                              )}
                              <span className="text-[10px] text-stone-400">{new Date(rep.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-stone-600 dark:text-stone-300">{rep.text}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Nested Reply Input Box */}
                    {activeReplyId === c.id && (
                      <div className="pl-8 pt-2 flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="Write a reply..."
                          className="flex-1 px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
                        />
                        <button
                          onClick={() => handleAddReply(c.id)}
                          className="px-3 py-1.5 bg-[#e4002b] text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                          Send
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Guest Reviews Section */}
          <div className="pt-6 border-t border-stone-200 dark:border-stone-800 space-y-4">
            <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
              Verified Guest Reviews ({reviews.length})
            </h3>

            {/* Review Form */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">Your Rating:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingInput(star)}
                      className="cursor-pointer"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          star <= ratingInput ? 'text-amber-500 fill-amber-500' : 'text-stone-300 dark:text-stone-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                placeholder="Share your stay experience (unlocked for verified guests)..."
                rows={2}
                className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
              />

              <div className="flex items-center justify-between">
                {reviewMsg && <span className="text-xs font-bold text-emerald-600">{reviewMsg}</span>}
                <button
                  onClick={handleReviewSubmit}
                  disabled={reviewLoading}
                  className="ml-auto px-4 py-1.5 bg-[#e4002b] hover:bg-[#c90026] text-white rounded-full text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {reviewLoading ? 'Posting...' : 'Post Review'}
                </button>
              </div>
            </div>

            {/* Reviews Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {reviews.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No reviews yet for this stay.</p>
              ) : (
                reviews.map(r => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                        {r.guestName || r.userName || 'Verified Guest'}
                      </span>
                      <div className="flex items-center text-amber-500 text-xs">
                        <Star className="w-3 h-3 fill-current mr-0.5" />
                        <span>{r.rating}</span>
                      </div>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400">{r.comment}</p>
                    <span className="text-[10px] text-stone-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Video Sponsor Ads Footer Strip (Up to 10 slots) */}
          <div className="pt-6 border-t border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#ff2e93] to-[#8b5cf6] flex items-center justify-center text-white">
                  <Megaphone className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 dark:text-white">
                      Featured Sponsors & Local Experiences
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                      {activeAds.length}/10 Slots
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">Chauffeurs, island cruises, breakfast deliveries & tour guides</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!user) onOpenAuth?.();
                  else setAdvertModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] hover:opacity-95 text-white text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Advertise Here (@ KES 100/day)</span>
              </button>
            </div>

            {activeAds.length === 0 ? (
              <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-dashed border-stone-300 dark:border-stone-700 text-center space-y-1.5">
                <p className="text-xs font-bold text-stone-700 dark:text-stone-300">Sponsor Slots Available for this Stay Video</p>
                <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
                  Target travellers viewing this stay in Nairobi/Mombasa. 70% of ad spend goes directly to the host, 30% platform fee.
                </p>
                <button
                  onClick={() => {
                    if (!user) onOpenAuth?.();
                    else setAdvertModalOpen(true);
                  }}
                  className="mt-1 px-4 py-1.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-bold hover:bg-stone-300 cursor-pointer"
                >
                  Reserve Slot #1
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeAds.map(ad => (
                  <div
                    key={ad.id}
                    className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col justify-between space-y-2.5 shadow-xs hover:border-purple-400 dark:hover:border-purple-600 transition-all"
                  >
                    <div className="flex items-start gap-2.5">
                      <img
                        src={ad.imageUrl}
                        alt={ad.title}
                        className="w-14 h-14 rounded-xl object-cover shrink-0 border border-stone-200 dark:border-stone-700"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 rounded">
                            AD
                          </span>
                          <span className="text-[10px] font-bold text-[#ff2e93] truncate">
                            {ad.tag || 'Sponsor'}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-stone-900 dark:text-white truncate mt-0.5">{ad.title}</h4>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-snug">{ad.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800 text-xs">
                      {ad.contactPhone ? (
                        <a
                          href={`tel:${ad.contactPhone}`}
                          className="text-[11px] font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1 hover:text-[#e4002b]"
                        >
                          <PhoneCall className="w-3 h-3 text-stone-400" />
                          <span>Contact</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-stone-400">Verified Sponsor</span>
                      )}
                      <a
                        href={ad.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-extrabold text-[#8b5cf6] hover:underline flex items-center gap-1"
                      >
                        <span>Open Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sponsor Advert Modal */}
      <AdvertModal
        stayId={stay.id}
        stayTitle={stay.title}
        isOpen={advertModalOpen}
        onClose={() => setAdvertModalOpen(false)}
        user={user}
        userWalletBalance={userWalletBalance}
        onOpenAuth={() => onOpenAuth?.()}
        onOpenTopup={() => onOpenTopup?.()}
        onAdCreated={() => {
          loadActiveAds();
          setAdvertModalOpen(false);
        }}
        showToast={showToast || (() => {})}
      />

      {/* Virality Analytics Modal */}
      <ViralityModal
        stayOrPostId={stay.id}
        title={stay.title}
        isOpen={viralityModalOpen}
        onClose={() => setViralityModalOpen(false)}
      />
    </div>
  );
};

