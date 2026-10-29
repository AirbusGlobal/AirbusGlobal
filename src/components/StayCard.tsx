import React, { useState, useRef } from 'react';
import { Stay, Currency, CURRENCY_RATES } from '../types';
import {
  Heart,
  Star,
  Play,
  Zap,
  Award,
  MessageSquare,
  BadgeDollarSign,
  Calendar,
  ExternalLink,
  PhoneCall,
  Volume2,
  VolumeX,
  Eye,
  ThumbsUp,
  Youtube,
} from 'lucide-react';

interface StayCardProps {
  stay: Stay;
  isSaved: boolean;
  onToggleSave: (stayId: string) => void;
  onSelectStay: (stayId: string) => void;
  onCheckAvailability: (stayId: string) => void;
  onBookNow: (stayId: string) => void;
  onChatHost: (stayId: string) => void;
  onNegotiate: (stayId: string) => void;
  onHover: (stayId: string | null) => void;
  currency: Currency;
}

export const StayCard: React.FC<StayCardProps> = ({
  stay,
  isSaved,
  onToggleSave,
  onSelectStay,
  onCheckAvailability,
  onBookNow,
  onChatHost,
  onNegotiate,
  onHover,
  currency,
}) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Format currency
  const formatMoney = (price: number) => {
    const rate = CURRENCY_RATES[currency] || 1;
    const converted = Math.round(price * rate);
    return `${currency} ${converted.toLocaleString()}`;
  };

  // Badge logic matching original
  const isSuperhost = stay.rating >= 4.85 && stay.reviewsCount >= 40;

  // Dynamic CSS gradient matching hue
  const cardGradient = `linear-gradient(135deg, hsl(${stay.gradientHue[0]}, 55%, 32%), hsl(${stay.gradientHue[1]}, 60%, 20%))`;

  const handleMouseEnter = () => {
    onHover(stay.id);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
      setIsVideoPlaying(true);
    }
  };

  const handleMouseLeave = () => {
    onHover(null);
    if (videoRef.current) {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  const commentsCount = (stay.comments || []).length;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group bg-white dark:bg-[#15171e] rounded-2xl overflow-hidden border border-[#e6e6e1] dark:border-[#262934] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
    >
      {/* Media Thumbnail Container with Video Preview */}
      <div
        className="relative aspect-[16/10] overflow-hidden cursor-pointer flex items-center justify-center text-white"
        style={{ background: cardGradient }}
        onClick={() => onSelectStay(stay.id)}
      >
        {/* Background Image / YouTube thumbnail fallback */}
        {stay.thumbnailUrl && (
          <img
            src={stay.thumbnailUrl}
            alt={stay.title}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              isVideoPlaying ? 'opacity-0' : 'opacity-85 group-hover:scale-105 transition-transform duration-700'
            }`}
            loading="lazy"
          />
        )}

        {/* Video Element for MP4 / MOV */}
        {stay.videoUrl && !stay.youtubeVideoId && (
          <video
            ref={videoRef}
            src={stay.videoUrl}
            loop
            muted={isMuted}
            playsInline
            preload="metadata"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              isVideoPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Gradient Overlay for Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
          <span className="bg-[#fbbf24] text-stone-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
            {stay.category}
          </span>
          <span className="bg-black/60 backdrop-blur-sm text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
            {stay.type}
          </span>

          {stay.youtubeVideoId && (
            <span className="bg-[#ff0000]/90 text-white font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <Youtube className="w-2.5 h-2.5" /> YouTube
            </span>
          )}

          {stay.instantBook && (
            <span className="bg-emerald-500/90 text-white font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" /> Instant
            </span>
          )}

          {isSuperhost && (
            <span className="bg-[#e4002b]/90 text-white font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <Award className="w-2.5 h-2.5" /> Superhost
            </span>
          )}
        </div>

        {/* Heart Wishlist Button */}
        <button
          onClick={e => {
            e.stopPropagation();
            onToggleSave(stay.id);
          }}
          className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isSaved
              ? 'bg-[#e4002b] text-white shadow-md scale-105'
              : 'bg-black/50 backdrop-blur-sm text-white hover:bg-black/70'
          }`}
          title={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
        </button>

        {/* Center Play Icon Badge */}
        {!isVideoPlaying && (
          <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 text-white ml-0.5 fill-white" />
          </div>
        )}

        {/* Audio Toggle (when native video is playing) */}
        {isVideoPlaying && (
          <button
            onClick={e => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className="absolute bottom-2.5 left-2.5 z-10 bg-black/60 backdrop-blur-sm text-white p-1.5 rounded-full hover:bg-black/80"
            title={isMuted ? 'Unmute video' : 'Mute video'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Live Social Badges (Views & Likes) */}
        <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-2 text-[10px] font-bold text-white/90 drop-shadow">
          <span className="flex items-center gap-0.5 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded">
            <Eye className="w-3 h-3 text-stone-300" />
            {(stay.views || 0).toLocaleString()}
          </span>
          <span className="flex items-center gap-0.5 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded">
            <ThumbsUp className="w-3 h-3 text-pink-400" />
            {stay.likesCount || 0}
          </span>
          {commentsCount > 0 && (
            <span className="flex items-center gap-0.5 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded">
              <MessageSquare className="w-3 h-3 text-amber-300" />
              {commentsCount}
            </span>
          )}
        </div>

        {/* Bottom Right Price Pill */}
        <div className="absolute right-2.5 bottom-2.5 text-right font-extrabold text-sm drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] z-10">
          <span className="text-[11px] font-normal opacity-85 mr-1">from</span>
          <span className="text-white text-base tracking-tight">{formatMoney(stay.price)}</span>
          <span className="text-[11px] font-normal opacity-85">/night</span>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3
              onClick={() => onSelectStay(stay.id)}
              className="text-sm font-bold text-stone-900 dark:text-white leading-snug line-clamp-1 hover:text-[#e4002b] transition-colors cursor-pointer"
            >
              {stay.title}
            </h3>
            {stay.reviewsCount > 0 ? (
              <div className="flex items-center gap-1 text-xs font-bold text-stone-800 dark:text-stone-200 shrink-0">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>{stay.rating.toFixed(1)}</span>
                <span className="text-[11px] text-stone-400 font-normal">({stay.reviewsCount})</span>
              </div>
            ) : (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                NEW
              </span>
            )}
          </div>

          <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1 line-clamp-1">
            <span>📍 {stay.location}</span>
          </div>

          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            {stay.guests} guests · {stay.beds} {stay.beds === 1 ? 'bed' : 'beds'} · {stay.area} m²
          </div>

          <div className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5 flex items-center justify-between">
            <span>
              Source: <span className="font-semibold text-stone-600 dark:text-stone-300">{stay.source}</span>
            </span>
            {stay.hostName && (
              <span className="text-[10px] text-stone-400">
                Host: <span className="text-stone-600 dark:text-stone-300 font-semibold">{stay.hostName}</span>
              </span>
            )}
          </div>
        </div>

        {/* 4 Action Buttons Grid */}
        <div className="space-y-1.5 pt-1">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onCheckAvailability(stay.id)}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-semibold border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <Calendar className="w-3 h-3 text-stone-400" />
              <span>Availability</span>
            </button>

            <button
              onClick={() => onBookNow(stay.id)}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-[#e4002b] hover:bg-[#c90026] text-white transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Book now</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onChatHost(stay.id)}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-semibold border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <MessageSquare className="w-3 h-3 text-stone-400" />
              <span>Chat host</span>
            </button>

            <button
              onClick={() => onNegotiate(stay.id)}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white hover:opacity-95 transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer"
            >
              <BadgeDollarSign className="w-3 h-3" />
              <span>Negotiate</span>
            </button>
          </div>

          {/* Direct WhatsApp button if phone is present */}
          {stay.whatsapp && (
            <a
              href={`https://wa.me/${stay.whatsapp.replace(/[^0-9]/g, '')}?text=Hello!%20I'm%20inquiring%20about%20your%20stay%20on%20AirBus:%20${encodeURIComponent(
                stay.title
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-1.5 px-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <PhoneCall className="w-3 h-3" />
              <span>Book direct on WhatsApp</span>
            </a>
          )}

          {/* Affiliate link if external source */}
          {stay.affiliateLink && (
            <a
              href={stay.affiliateLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-1.5 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>View deal on {stay.source}</span>
              <ExternalLink className="w-3 h-3 text-stone-400" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
