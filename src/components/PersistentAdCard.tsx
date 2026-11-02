import React, { useState, useEffect, useRef } from 'react';
import { AdRequest, SnappAddCampaign } from '../types';
import { api } from '../api';
import {
  ExternalLink,
  Megaphone,
  Home,
  Coins,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  PlaySquare,
  X,
  Plus,
} from 'lucide-react';

interface PersistentAdCardProps {
  onSelectStay?: (stayId: string) => void;
  userWalletBalance?: number;
  userEmail?: string;
  showToast?: (msg: string) => void;
}

export const PersistentAdCard: React.FC<PersistentAdCardProps> = ({
  onSelectStay,
  userWalletBalance = 8290,
  userEmail,
  showToast,
}) => {
  const [ads, setAds] = useState<AdRequest[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSnappAddModal, setShowSnappAddModal] = useState(false);

  // SnappAdd Campaign Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<7 | 1 | 30>(7);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate coins for chosen duration
  const DURATION_COINS: Record<number, number> = {
    1: 10,
    7: 70, // Explicitly requested 7 days [70 SC]
    30: 250,
  };

  const costSC = DURATION_COINS[selectedDuration] || 70;
  const currentBalance = userWalletBalance;
  const hasEnoughCoins = currentBalance >= costSC;
  const missingDifference = Math.max(0, costSC - currentBalance);

  // Load approved ads
  useEffect(() => {
    let isMounted = true;
    const fetchAds = async () => {
      try {
        const res = await api.getAds({ status: 'approved' });
        if (isMounted && res.ads && res.ads.length > 0) {
          const approved = res.ads.filter(a => a.status === 'approved');
          if (approved.length > 0) {
            setAds(approved);
          }
        }
      } catch (err) {
        console.warn('Could not load ads for persistent card:', err);
      }
    };
    fetchAds();
    return () => {
      isMounted = false;
    };
  }, []);

  const currentAd = ads[currentIndex] || {
    id: 'ad_default_kenya',
    stayId: '1',
    advertiserEmail: 'promote@airbus.ke',
    title: 'Nairobi Luxury Safari Loft & Car Hire',
    description: 'Special 20% discount on weekend getaways and airport transfers across Nairobi.',
    imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
    targetUrl: 'https://airbus.ke',
    tag: 'Featured Sponsor',
    days: 30,
    totalAmount: 100,
    platformFee: 30,
    hostNet: 70,
    status: 'approved',
    createdAt: Date.now(),
  };

  // Record impression
  useEffect(() => {
    if (currentAd?.id && currentAd.id !== 'ad_default_kenya') {
      api.recordAdView(currentAd.id).catch(() => {});
    }
  }, [currentAd?.id]);

  // Smooth rotation every 4 seconds if multiple ads exist
  useEffect(() => {
    if (ads.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % ads.length);
        setIsFading(false);
      }, 250);
    }, 4000);
    return () => clearInterval(timer);
  }, [ads.length, isPaused]);

  // Handle click on the advert card
  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;

    if (currentAd.id !== 'ad_default_kenya') {
      api.recordAdClick(currentAd.id).catch(() => {});
    }

    if (onSelectStay && currentAd.stayId) {
      onSelectStay(currentAd.stayId);
    } else if (currentAd.targetUrl) {
      window.open(currentAd.targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Handle submit SnappAdd campaign
  const handlePayAndGoLive = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!title.trim()) {
      setErrorMessage('Video Title is required.');
      return;
    }
    if (!websiteLink.trim()) {
      setErrorMessage('Advert Website Link is required.');
      return;
    }

    if (!hasEnoughCoins) {
      setErrorMessage(
        `Insufficient SnappCoins. You need ${costSC} SC, but your balance is ${currentBalance} SC. Top up the difference of ${missingDifference} SC via M-Pesa to proceed.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/ads/snappadd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: userEmail || 'host@airbus.ke',
          title: title.trim(),
          description: description.trim(),
          websiteUrl: websiteLink.trim(),
          thumbnailUrl:
            thumbnailUrl.trim() ||
            'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
          videoUrl: videoUrl.trim() || undefined,
          durationDays: selectedDuration,
          coinsPaid: costSC,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to launch SnappAdd campaign');
      }

      setSuccessMessage(
        `🎉 Live! Your video is now featured below "News & Politics: Local Campaign 3" for ${selectedDuration} days.`
      );
      showToast?.(`Success! Paid ${costSC} SC for ${selectedDuration} days campaign.`);

      // Add newly launched ad to active rotation
      if (data.campaign) {
        setAds(prev => [
          {
            id: 'ad_' + data.campaign.id,
            stayId: '1',
            advertiserEmail: data.campaign.userEmail,
            title: data.campaign.title,
            description: data.campaign.description,
            imageUrl: data.campaign.thumbnailUrl,
            targetUrl: data.campaign.websiteUrl,
            tag: 'News & Politics: Local Campaign 3',
            days: data.campaign.durationDays,
            totalAmount: costSC,
            platformFee: costSC,
            hostNet: 0,
            status: 'approved',
            createdAt: Date.now(),
          },
          ...prev,
        ]);
        setCurrentIndex(0);
      }

      setTimeout(() => {
        setShowSnappAddModal(false);
        setTitle('');
        setDescription('');
        setWebsiteLink('');
        setThumbnailUrl('');
        setVideoUrl('');
        setSuccessMessage(null);
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* ============================================================ */}
      {/* PART D: Persistent Advert Card (NO CLOSE / NO DISMISS)       */}
      {/* ============================================================ */}
      <aside
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30 w-[300px] sm:w-[320px] select-none shadow-[0_12px_40px_rgba(0,0,0,0.45)] rounded-2xl overflow-hidden border border-stone-800 bg-stone-900/95 backdrop-blur-md text-white transition-all duration-300 hover:border-rose-500/60"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        role="complementary"
        aria-label="Persistent Advert Card"
      >
        {/* Accent top gradient */}
        <div className="h-1 w-full bg-gradient-to-r from-[#e4002b] via-[#ff2e93] to-[#8b5cf6]" />

        <div className="p-3" onClick={handleCardClick}>
          {/* Header row: Badge and CTA trigger */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-[#e4002b] to-[#ff2e93] text-white shadow-2xs">
              <Megaphone className="w-2.5 h-2.5" />
              <span>Ad · KES 100/day</span>
            </span>

            {ads.length > 1 && (
              <span className="text-[10px] text-stone-400 font-mono">
                {currentIndex + 1}/{ads.length}
              </span>
            )}
          </div>

          {/* Ad content body */}
          <div
            className={`flex items-center gap-2.5 transition-opacity duration-200 cursor-pointer ${
              isFading ? 'opacity-0 scale-98' : 'opacity-100 scale-100'
            }`}
          >
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-stone-800 border border-stone-700 relative">
              <img
                src={currentAd.imageUrl}
                alt={currentAd.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white truncate leading-tight hover:text-amber-300 transition-colors">
                {currentAd.title}
              </h4>
              <p className="text-[10px] text-stone-300 line-clamp-2 mt-0.5 leading-snug">
                {currentAd.description}
              </p>
              {currentAd.targetUrl && (
                <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-rose-400">
                  <span>Visit Sponsor</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
          </div>

          {/* Persistent CTA Button: "Advertise here (@ KES 100/day)" */}
          <div className="mt-2.5 pt-2 border-t border-stone-800/80">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setShowSnappAddModal(true);
              }}
              className="w-full py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-[#e4002b] to-[#ff2e93] hover:from-[#c90026] hover:to-[#e02680] text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-98"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Advertise here (@ KES 100/day)</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* SnappAdd Payment & Placement Modal                          */}
      {/* ============================================================ */}
      {showSnappAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-2xl text-white relative animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="snappadd-modal-title"
          >
            {/* Close Modal */}
            <button
              type="button"
              onClick={() => setShowSnappAddModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="pr-8">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-[#e4002b]/20 text-[#e4002b]">
                  <Megaphone className="w-5 h-5" />
                </span>
                <div>
                  <h3 id="snappadd-modal-title" className="text-base font-extrabold">
                    Advertise with SnappAdd
                  </h3>
                  <p className="text-xs text-rose-400 font-bold">
                    Feature video below &ldquo;News &amp; Politics: Local Campaign 3&rdquo;
                  </p>
                </div>
              </div>
            </div>

            {/* Wallet Balance Display (e.g. 8290 SC) */}
            <div className="mt-3.5 p-3 rounded-2xl bg-stone-950/80 border border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-stone-300">Wallet Balance:</span>
              </div>
              <div className="text-xs font-black text-amber-400 font-mono">
                {currentBalance.toLocaleString()} SC{' '}
                <span className="text-[10px] text-stone-400 font-normal">(1 SC = KES 1)</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handlePayAndGoLive} className="mt-3.5 space-y-3 text-xs">
              {/* Video Title * */}
              <div>
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  Video Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diani Jet Ski & Beachfront Villa Promo"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-[#e4002b] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Highlight your offer, discount, or stay details..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-[#e4002b] rounded-xl px-3 py-2 text-xs text-white outline-none resize-none"
                />
              </div>

              {/* Advert Website Link * */}
              <div>
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  Advert Website Link <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://yourwebsite.com or https://wa.me/254..."
                  value={websiteLink}
                  onChange={e => setWebsiteLink(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-[#e4002b] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              {/* Thumbnail Image URL & Video File (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-300 mb-1">
                    Thumbnail Image URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash..."
                    value={thumbnailUrl}
                    onChange={e => setThumbnailUrl(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-[#e4002b] rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-300 mb-1">
                    Video File / URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://assets.../video.mp4"
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-[#e4002b] rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                  />
                </div>
              </div>

              {/* Duration Selector */}
              <div>
                <label className="block text-[11px] font-bold text-stone-300 mb-1.5">
                  Select Campaign Duration:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDuration(1)}
                    className={`py-2 px-2 rounded-xl text-center border font-bold transition-all cursor-pointer ${
                      selectedDuration === 1
                        ? 'bg-[#e4002b]/20 border-[#e4002b] text-[#e4002b]'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="text-[11px]">1 Day</div>
                    <div className="text-xs font-black">10 SC</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDuration(7)}
                    className={`py-2 px-2 rounded-xl text-center border font-bold transition-all cursor-pointer relative ${
                      selectedDuration === 7
                        ? 'bg-[#e4002b]/20 border-[#e4002b] text-[#e4002b]'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase">
                      Popular
                    </span>
                    <div className="text-[11px]">7 Days</div>
                    <div className="text-xs font-black">70 SC</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDuration(30)}
                    className={`py-2 px-2 rounded-xl text-center border font-bold transition-all cursor-pointer ${
                      selectedDuration === 30
                        ? 'bg-[#e4002b]/20 border-[#e4002b] text-[#e4002b]'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="text-[11px]">30 Days</div>
                    <div className="text-xs font-black">250 SC</div>
                  </button>
                </div>
              </div>

              {/* Status messages */}
              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px] flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[11px] flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Action Button: "Pay 70 SC & Go Live" */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#e4002b] via-[#ff2e93] to-[#8b5cf6] hover:opacity-95 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                >
                  <Coins className="w-4 h-4 text-amber-300" />
                  <span>
                    {submitting ? 'Debiting & Publishing...' : `Pay ${costSC} SC & Go Live`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
