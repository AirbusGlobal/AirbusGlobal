import React, { useState, useRef, useEffect } from 'react';
import { Stay, Currency, CURRENCY_RATES, User } from '../types';
import {
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  Heart,
  MessageSquare,
  BadgeDollarSign,
  Share2,
  Star,
  MapPin,
  Sparkles,
  ArrowLeft,
  ThumbsUp,
  Eye,
  UserPlus,
  UserCheck,
  Send,
  TrendingUp,
  Megaphone,
} from 'lucide-react';
import { api } from '../api';
import { AdvertModal } from './AdvertModal';
import { ViralityModal } from './ViralityModal';
import { AdRequest } from '../types';

interface ShortsViewProps {
  stays: Stay[];
  savedStayIds: string[];
  user: User | null;
  onToggleSave: (id: string) => void;
  onBookNow: (id: string) => void;
  onNegotiate: (id: string) => void;
  onChatHost: (id: string) => void;
  onBackToFeed: () => void;
  currency: Currency;
  onUpdateStay?: (id: string, updates: Partial<Stay>) => void;
  userWalletBalance?: number;
  onOpenTopup?: () => void;
  onOpenAuth?: () => void;
  showToast?: (msg: string) => void;
}

export const ShortsView: React.FC<ShortsViewProps> = ({
  stays,
  savedStayIds,
  user,
  onToggleSave,
  onBookNow,
  onNegotiate,
  onChatHost,
  onBackToFeed,
  currency,
  onUpdateStay,
  userWalletBalance = 0,
  onOpenTopup,
  onOpenAuth,
  showToast,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // AI Drawer inside Shorts
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);

  // Ads & Virality Modals
  const [advertModalOpen, setAdvertModalOpen] = useState(false);
  const [viralityModalOpen, setViralityModalOpen] = useState(false);
  const [activeAds, setActiveAds] = useState<AdRequest[]>([]);


  const currentStay = stays[currentIndex] || stays[0];

  // Local social states for reactive updates
  const [likesCount, setLikesCount] = useState(currentStay?.likesCount || 0);
  const [liked, setLiked] = useState(
    user && currentStay ? (currentStay.likedByUserEmails || []).includes(user.email) : false
  );
  const [isFollowing, setIsFollowing] = useState(
    user && currentStay?.owner ? (currentStay.hostFollowedByUserEmails || []).includes(user.email) : false
  );
  const [followerCount, setFollowerCount] = useState(currentStay?.hostFollowerCount || 12);
  const [viewsCount, setViewsCount] = useState(currentStay?.views || 0);

  // Sync state when index changes
  useEffect(() => {
    if (currentStay) {
      setLikesCount(currentStay.likesCount || 0);
      setLiked(user ? (currentStay.likedByUserEmails || []).includes(user.email) : false);
      setIsFollowing(user && currentStay.owner ? (currentStay.hostFollowedByUserEmails || []).includes(user.email) : false);
      setFollowerCount(currentStay.hostFollowerCount || 12);
      setViewsCount(currentStay.views || 0);
      setAiDrawerOpen(false);
      setAiAnswer(null);

      // Record view
      api.recordStayView(currentStay.id)
        .then(res => {
          if (res.views) {
            setViewsCount(res.views);
            onUpdateStay?.(currentStay.id, { views: res.views });
          }
        })
        .catch(() => {});

      // Load active ads for this video
      api.getAds({ stayId: currentStay.id, status: 'approved' })
        .then(res => setActiveAds(res.ads))
        .catch(() => {});
    }

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [currentIndex, currentStay?.id]);

  const handleNext = () => {
    if (currentIndex < stays.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      setCurrentIndex(stays.length - 1);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const handleToggleLike = async () => {
    if (!user) {
      alert('Please sign in to like this stay.');
      return;
    }
    const newLiked = !liked;
    const newCount = newLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setLiked(newLiked);
    setLikesCount(newCount);

    try {
      const res = await api.toggleLikeStay(currentStay.id);
      setLiked(res.liked);
      setLikesCount(res.likesCount);
      onUpdateStay?.(currentStay.id, { likesCount: res.likesCount });
    } catch {
      setLiked(!newLiked);
      setLikesCount(likesCount);
    }
  };

  const handleToggleFollow = async () => {
    if (!user) {
      alert('Please sign in to follow this host.');
      return;
    }
    const hostEmail = currentStay.owner || 'host@airbus.ke';
    const newFollowing = !isFollowing;
    const newCount = newFollowing ? followerCount + 1 : Math.max(0, followerCount - 1);
    setIsFollowing(newFollowing);
    setFollowerCount(newCount);

    try {
      const res = await api.toggleFollowHost(hostEmail);
      setIsFollowing(res.isFollowing);
      setFollowerCount(res.followerCount);
      onUpdateStay?.(currentStay.id, { hostFollowerCount: res.followerCount });
    } catch {
      setIsFollowing(!newFollowing);
      setFollowerCount(followerCount);
    }
  };

  const handleAskAi = async (customPrompt?: string) => {
    const query = customPrompt || aiQuestion;
    if (!query.trim()) return;
    setAiLoading(true);
    setAiAnswer(null);

    try {
      const res = await api.askStayAi(currentStay.id, query);
      setAiAnswer(res.answer);
    } catch (err: any) {
      setAiAnswer('AirBus.AI: ' + (err.message || 'Unable to connect to concierge right now.'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/#stay-${currentStay.id}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert('Stay link copied to clipboard!');
    }
  };

  if (!currentStay) {
    return (
      <div className="p-8 text-center text-stone-500">
        No video stays available right now.
      </div>
    );
  }

  const formatMoney = (price: number) => {
    const rate = CURRENCY_RATES[currency] || 1;
    const converted = Math.round(price * rate);
    return `${currency} ${converted.toLocaleString()}`;
  };

  const isSaved = savedStayIds.includes(currentStay.id);
  const commentsCount = (currentStay.comments || []).length;

  return (
    <div className="relative w-full max-w-md mx-auto my-4 h-[calc(100vh-140px)] min-h-[580px] max-h-[820px] bg-black rounded-3xl overflow-hidden shadow-2xl border border-stone-800 flex items-center justify-center select-none">
      {/* Video Player: YouTube Embed OR Native Video */}
      {currentStay.youtubeVideoId ? (
        <iframe
          src={`https://www.youtube.com/embed/${currentStay.youtubeVideoId}?autoplay=1&mute=${
            isMuted ? 1 : 0
          }&loop=1&playsinline=1&controls=0`}
          title={currentStay.title}
          className="w-full h-full border-0 pointer-events-auto"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video
          ref={videoRef}
          src={currentStay.videoUrl}
          poster={currentStay.thumbnailUrl}
          loop
          playsInline
          muted={isMuted}
          onClick={togglePlay}
          className="w-full h-full object-cover cursor-pointer"
        />
      )}

      {/* Top Header Overlay with Ubiquitous Go Back */}
      <div className="absolute top-4 inset-x-4 z-20 flex items-center justify-between pointer-events-none">
        <button
          onClick={onBackToFeed}
          className="pointer-events-auto bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-black/80 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#e4002b]" />
          <span>Go Back</span>
        </button>

        <div className="flex items-center gap-2 pointer-events-auto">
          {!currentStay.youtubeVideoId && (
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="bg-black/60 backdrop-blur-md text-white p-2 rounded-full hover:bg-black/80 transition-all cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          )}
        </div>
      </div>

      {/* Vertical Navigation Chevrons */}
      <div className="absolute top-1/2 -translate-y-1/2 right-3 z-30 flex flex-col gap-4 pointer-events-auto">
        <button
          onClick={handlePrev}
          className="bg-black/60 hover:bg-black/90 text-white p-2 rounded-full backdrop-blur-md transition-all shadow-lg active:scale-90 cursor-pointer"
          title="Previous stay"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          onClick={handleNext}
          className="bg-black/60 hover:bg-black/90 text-white p-2 rounded-full backdrop-blur-md transition-all shadow-lg active:scale-90 cursor-pointer"
          title="Next stay"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Right Side Social Actions Column */}
      <div className="absolute bottom-24 right-3 z-20 flex flex-col items-center gap-3.5 pointer-events-auto">
        {/* Follow Host Avatar */}
        <button
          onClick={handleToggleFollow}
          className="relative flex flex-col items-center group cursor-pointer"
          title={isFollowing ? 'Following Host' : 'Follow Host'}
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#e4002b] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-xs border-2 border-white shadow-md">
            {(currentStay.hostName || 'H')[0].toUpperCase()}
          </div>
          <div
            className={`absolute -bottom-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white ${
              isFollowing ? 'bg-emerald-500' : 'bg-[#e4002b]'
            }`}
          >
            {isFollowing ? '✓' : '+'}
          </div>
        </button>

        {/* Like Button */}
        <button
          onClick={handleToggleLike}
          className="flex flex-col items-center gap-1 text-white group cursor-pointer"
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
              liked ? 'bg-[#ff2e93] text-white shadow-[0_0_15px_#ff2e93]' : 'bg-black/60 hover:bg-black/80'
            }`}
          >
            <ThumbsUp className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-[10px] font-bold drop-shadow">{likesCount}</span>
        </button>

        {/* AirBus.AI Concierge Button */}
        <button
          onClick={() => setAiDrawerOpen(!aiDrawerOpen)}
          className="flex flex-col items-center gap-1 text-white group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#8b5cf6] to-[#ff2e93] hover:opacity-95 flex items-center justify-center shadow-lg transition-all">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-[10px] font-bold drop-shadow text-pink-300">AI Info</span>
        </button>

        {/* Wishlist */}
        <button
          onClick={() => onToggleSave(currentStay.id)}
          className="flex flex-col items-center gap-1 text-white group cursor-pointer"
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
              isSaved ? 'bg-[#e4002b] text-white shadow-[0_0_15px_#e4002b]' : 'bg-black/60 hover:bg-black/80'
            }`}
          >
            <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
          </div>
          <span className="text-[10px] font-bold drop-shadow">{isSaved ? 'Saved' : 'Save'}</span>
        </button>

        {/* Chat Host */}
        <button
          onClick={() => onChatHost(currentStay.id)}
          className="flex flex-col items-center gap-1 text-white group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center backdrop-blur-md transition-all">
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold drop-shadow">Chat</span>
        </button>

        {/* Negotiate Offer */}
        <button
          onClick={() => onNegotiate(currentStay.id)}
          className="flex flex-col items-center gap-1 text-white group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#ff2e93] to-[#8b5cf6] flex items-center justify-center shadow-lg transition-all active:scale-95">
            <BadgeDollarSign className="w-5 h-5 text-white" />
          </div>
          <span className="text-[10px] font-bold drop-shadow">Offer</span>
        </button>

        {/* Virality Engine */}
        <button
          onClick={() => setViralityModalOpen(true)}
          className="flex flex-col items-center gap-1 text-white group cursor-pointer"
          title="Virality Graph & Analytics"
        >
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#06b6d4] to-[#8b5cf6] flex items-center justify-center shadow-lg transition-all active:scale-95">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-[10px] font-bold drop-shadow text-cyan-300">Virality</span>
        </button>

        {/* Sponsor Advert Strip Button */}
        <button
          onClick={() => {
            if (!user) onOpenAuth?.();
            else setAdvertModalOpen(true);
          }}
          className="flex flex-col items-center gap-1 text-white group cursor-pointer"
          title="Sponsor this video (KES 100/day)"
        >
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#ff2e93] to-amber-500 flex items-center justify-center shadow-lg transition-all active:scale-95">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <span className="text-[10px] font-bold drop-shadow text-amber-300">Sponsor</span>
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1 text-white group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center backdrop-blur-md transition-all">
            <Share2 className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold drop-shadow">Share</span>
        </button>
      </div>

      {/* Benevolent AirBus.AI Drawer Overlay in Shorts */}
      {aiDrawerOpen && (
        <div className="absolute inset-x-3 bottom-24 z-40 bg-stone-900/95 backdrop-blur-xl border border-purple-500/40 rounded-2xl p-4 text-white space-y-2.5 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-pink-300">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>AirBus.AI on {currentStay.title}</span>
            </div>
            <button
              onClick={() => setAiDrawerOpen(false)}
              className="text-stone-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {['Is WiFi fast?', 'Is it quiet?', 'Best review summary'].map(q => (
              <button
                key={q}
                onClick={() => handleAskAi(q)}
                className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 hover:bg-purple-500/40 border border-purple-400/30 text-stone-200 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            <input
              type="text"
              value={aiQuestion}
              onChange={e => setAiQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAskAi()}
              placeholder="Ask anything..."
              className="flex-1 px-3 py-1.5 bg-stone-800 border border-stone-700 rounded-xl text-xs outline-none text-white"
            />
            <button
              onClick={() => handleAskAi()}
              disabled={aiLoading}
              className="px-3 py-1.5 bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {aiLoading ? '...' : 'Ask'}
            </button>
          </div>

          {aiAnswer && (
            <div className="p-2.5 bg-black/60 rounded-xl text-xs text-stone-200 max-h-32 overflow-y-auto leading-relaxed border border-stone-800">
              {aiAnswer}
            </div>
          )}
        </div>
      )}

      {/* Bottom Stay Info & CTAs */}
      <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black via-black/80 to-transparent z-10 text-white flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="bg-[#fbbf24] text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
            {currentStay.category}
          </span>
          <span className="bg-white/20 backdrop-blur-sm text-[10px] font-bold px-2 py-0.5 rounded-full">
            {currentStay.type}
          </span>
          <div className="flex items-center gap-0.5 text-xs font-bold text-amber-400">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>{currentStay.rating}</span>
            <span className="text-white/60 font-normal">({currentStay.reviewsCount})</span>
          </div>
          <span className="text-[10px] text-stone-400 flex items-center gap-1 ml-auto">
            <Eye className="w-3 h-3 text-stone-300" />
            {viewsCount.toLocaleString()}
          </span>
        </div>

        <h3 className="text-base font-extrabold font-heading leading-tight line-clamp-1 drop-shadow-md">
          {currentStay.title}
        </h3>

        <div className="flex items-center gap-1 text-xs text-stone-300">
          <MapPin className="w-3 h-3 text-[#ff2e93]" />
          <span>{currentStay.location}</span>
          <span>·</span>
          <span>{currentStay.guests} guests</span>
          <span>·</span>
          <span>{currentStay.beds} beds</span>
        </div>

        {/* Price & Primary CTA */}
        <div className="flex items-center justify-between gap-3 pt-1 pointer-events-auto">
          <div>
            <div className="text-lg font-black tracking-tight text-white drop-shadow">
              {formatMoney(currentStay.price)}
              <span className="text-xs font-normal text-stone-300 ml-1">/night</span>
            </div>
            <div className="text-[10px] text-stone-400">
              Host: {currentStay.hostName || 'AirBus Host'} ({followerCount} followers)
            </div>
          </div>

          <button
            onClick={() => onBookNow(currentStay.id)}
            className="bg-[#e4002b] hover:bg-[#c90026] text-white px-5 py-2.5 rounded-full text-xs font-extrabold shadow-lg hover:shadow-[#e4002b]/50 transition-all active:scale-95 cursor-pointer"
          >
            Book Stay Now
          </button>
        </div>

        {/* Active Sponsor Card Pill in Shorts */}
        {activeAds.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto py-1 pointer-events-auto no-scrollbar">
            {activeAds.map(ad => (
              <a
                key={ad.id}
                href={ad.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-purple-500/40 text-white shrink-0 max-w-[220px] transition-all"
              >
                <img src={ad.imageUrl} alt={ad.title} className="w-4 h-4 rounded-full object-cover shrink-0" />
                <span className="text-[9px] uppercase font-black text-[#ff2e93] shrink-0">AD</span>
                <span className="text-[10px] font-bold truncate">{ad.title}</span>
              </a>
            ))}
          </div>
        )}

        {/* Shorts Progress Dots */}
        <div className="flex items-center justify-center gap-1 pt-1">
          {stays.slice(0, 8).map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all ${
                idx === currentIndex ? 'w-6 bg-[#ff2e93]' : 'w-1.5 bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Sponsor Advert Modal */}
      {currentStay && (
        <AdvertModal
          stayId={currentStay.id}
          stayTitle={currentStay.title}
          isOpen={advertModalOpen}
          onClose={() => setAdvertModalOpen(false)}
          user={user}
          userWalletBalance={userWalletBalance}
          onOpenAuth={() => onOpenAuth?.()}
          onOpenTopup={() => onOpenTopup?.()}
          onAdCreated={() => {
            api.getAds({ stayId: currentStay.id, status: 'approved' })
              .then(res => setActiveAds(res.ads))
              .catch(() => {});
            setAdvertModalOpen(false);
          }}
          showToast={showToast || (() => {})}
        />
      )}

      {/* Virality Analytics Modal */}
      {currentStay && (
        <ViralityModal
          stayOrPostId={currentStay.id}
          title={currentStay.title}
          isOpen={viralityModalOpen}
          onClose={() => setViralityModalOpen(false)}
        />
      )}
    </div>
  );
};

