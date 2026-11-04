import React, { useState, useEffect, useRef } from 'react';
import { AdSlot } from '../types';
import { api } from '../api';
import {
  ExternalLink,
  Megaphone,
  Coins,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Wallet,
  Clock,
  Eye,
  MousePointer,
  ChevronRight,
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
  const [ads, setAds] = useState<AdSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'mpesa'>('wallet');
  const [mpesaCode, setMpesaCode] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Dynamic cost calculation: 10 SC / day
  const costSc = Math.max(1, durationDays) * 10;
  const currentBalance = userWalletBalance;
  const hasEnoughCoins = currentBalance >= costSc;
  const shortfall = Math.max(0, costSc - currentBalance);

  // Fetch active ads from GET /api/ads/active
  const loadActiveAds = async () => {
    try {
      const res = await api.getActiveAds();
      if (res && Array.isArray(res.ads)) {
        setAds(res.ads);
      }
    } catch (err) {
      console.warn('Could not load active ads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveAds();
  }, []);

  const currentAd: AdSlot | undefined = ads[currentIndex];

  // Record impression whenever the current ad changes
  useEffect(() => {
    if (currentAd?.id) {
      fetch(`/api/ads/slots/${currentAd.id}/view`, { method: 'POST' }).catch(() => {});
    }
  }, [currentAd?.id]);

  // Round-robin rotation every 8 seconds
  useEffect(() => {
    if (ads.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % ads.length);
        setIsFading(false);
      }, 300);
    }, 8000);

    return () => clearInterval(timer);
  }, [ads.length, isPaused]);

  // Handle click on card
  const handleCardClick = () => {
    if (!currentAd) return;

    // Record click
    fetch(`/api/ads/slots/${currentAd.id}/click`, { method: 'POST' }).catch(() => {});

    if (currentAd.linkUrl) {
      window.open(currentAd.linkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Submit new Ad Campaign
  const handleSubmitAd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!title.trim()) {
      setFormError('Video Title is required.');
      return;
    }
    if (!description.trim()) {
      setFormError('Description is required.');
      return;
    }
    if (!linkUrl.trim()) {
      setFormError('Destination Link URL is required.');
      return;
    }

    // URL validation
    try {
      const formatted = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
      new URL(formatted);
    } catch {
      setFormError('Please enter a valid website URL (e.g. https://example.com).');
      return;
    }

    if (paymentMethod === 'wallet' && !hasEnoughCoins) {
      setFormError(
        `Insufficient SnappCoins. You need ${costSc} SC, but your wallet has ${currentBalance} SC. Top up the shortfall of ${shortfall} SC via M-Pesa.`
      );
      return;
    }

    if (paymentMethod === 'mpesa') {
      const cleaned = mpesaCode.trim().toUpperCase();
      if (!cleaned || cleaned.length !== 10) {
        setFormError('M-Pesa transaction code must be exactly 10 alphanumeric characters (e.g. QHX78PL92D).');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await api.createAdSlot({
        title: title.trim(),
        description: description.trim(),
        linkUrl: linkUrl.startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`,
        thumbnailUrl:
          thumbnailUrl.trim() ||
          'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
        videoUrl: videoUrl.trim() || undefined,
        durationDays,
        paymentMethod,
        mpesaCode: paymentMethod === 'mpesa' ? mpesaCode.trim().toUpperCase() : undefined,
      });

      if (paymentMethod === 'wallet') {
        setFormSuccess(`🎉 Advert submitted! ${costSc} SC debited from your wallet. Live upon admin approval.`);
        showToast?.(`Success! Paid ${costSc} SC for ${durationDays} days advert slot.`);
      } else {
        setFormSuccess(`🎉 M-Pesa payment submitted (${mpesaCode.toUpperCase()})! Admin will verify and activate.`);
        showToast?.(`M-Pesa payment code submitted. Pending admin approval.`);
      }

      await loadActiveAds();

      setTimeout(() => {
        setShowModal(false);
        setTitle('');
        setDescription('');
        setLinkUrl('');
        setThumbnailUrl('');
        setVideoUrl('');
        setMpesaCode('');
        setFormSuccess(null);
      }, 2500);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create advert slot.');
    } finally {
      setSubmitting(false);
    }
  };

  // If no active ads exist and modal is closed, show subtle floating "Advertise" trigger so users can still buy ad slots
  if (ads.length === 0 && !loading && !showModal) {
    return (
      <aside className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30 select-none">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="group flex items-center gap-2 px-3 py-2 rounded-2xl bg-stone-900/95 border border-stone-800 text-stone-200 hover:text-white shadow-xl hover:border-rose-500/80 transition-all cursor-pointer backdrop-blur-md"
        >
          <span className="p-1 rounded-xl bg-gradient-to-r from-[#e4002b] to-[#ff2e93] text-white">
            <Megaphone className="w-3.5 h-3.5" />
          </span>
          <span className="text-xs font-bold">Advertise Here</span>
          <span className="text-[10px] text-amber-400 font-mono font-bold">10 SC/day</span>
        </button>
      </aside>
    );
  }

  return (
    <>
      {/* ============================================================ */}
      {/* Persistent Advert Card (NO CLOSE / NO DISMISS)               */}
      {/* ============================================================ */}
      {currentAd && (
        <aside
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30 w-[300px] sm:w-[320px] select-none shadow-[0_14px_45px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden border border-stone-800 bg-stone-900/95 backdrop-blur-md text-white transition-all duration-300 hover:border-rose-500/70"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          role="complementary"
          aria-label="Persistent Advert Card"
        >
          {/* Top glowing gradient stripe */}
          <div className="h-1 w-full bg-gradient-to-r from-[#e4002b] via-[#ff2e93] to-[#8b5cf6]" />

          <div className="p-3">
            {/* Header row: Badge and Round-robin counter */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-[#e4002b] to-[#ff2e93] text-white shadow-2xs">
                <Megaphone className="w-2.5 h-2.5" />
                <span>Sponsored · 10 SC/day</span>
              </span>

              {ads.length > 1 && (
                <span className="text-[10px] text-stone-400 font-mono">
                  {currentIndex + 1} of {ads.length}
                </span>
              )}
            </div>

            {/* Clickable Ad Body */}
            <div
              onClick={handleCardClick}
              className={`flex items-center gap-2.5 transition-all duration-300 cursor-pointer ${
                isFading ? 'opacity-0 scale-98' : 'opacity-100 scale-100'
              }`}
            >
              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-stone-800 border border-stone-700 relative">
                <img
                  src={
                    currentAd.thumbnailUrl ||
                    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=400&q=80'
                  }
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
                {currentAd.linkUrl && (
                  <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-rose-400">
                    <span>Visit Sponsor</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </div>
                )}
              </div>
            </div>

            {/* Persistent CTA Button: "Advertise here (@ 10 SC/day)" */}
            <div className="mt-2.5 pt-2 border-t border-stone-800/80">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setShowModal(true);
                }}
                className="w-full py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-[#e4002b] to-[#ff2e93] hover:from-[#c90026] hover:to-[#e02680] text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-98"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Advertise here (@ 10 SC/day)</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ============================================================ */}
      {/* "Advertise Here" Modal                                       */}
      {/* ============================================================ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-3xl p-5 sm:p-6 shadow-2xl text-white relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ad-modal-title"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="pr-8">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 rounded-2xl bg-gradient-to-br from-[#e4002b] to-[#ff2e93] text-white shadow-md">
                  <Megaphone className="w-5 h-5" />
                </span>
                <div>
                  <h3 id="ad-modal-title" className="text-base font-black">
                    Advertise on AirBus
                  </h3>
                  <p className="text-xs text-stone-400">
                    Reach thousands of travelers and guests across Kenya with rotating sponsored ads.
                  </p>
                </div>
              </div>
            </div>

            {/* Pricing Rate Banner */}
            <div className="mt-4 p-3 rounded-2xl bg-stone-950/90 border border-stone-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-stone-400 block">Rate & Pricing</span>
                <span className="text-xs font-black text-white">
                  10 SC / day <span className="text-stone-400 font-normal">(1 SC = 1 KES)</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-stone-400 block">Your Wallet Balance</span>
                <span className="text-xs font-mono font-black text-amber-400">
                  {currentBalance.toLocaleString()} SC
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitAd} className="mt-4 space-y-3.5 text-xs">
              {/* Video Title * */}
              <div>
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  Video / Promotion Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Airport Transfers & Mombasa Beach Villas"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-[#e4002b] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              {/* Description * */}
              <div>
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Catchy highlight of your service, discount, or package..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-[#e4002b] rounded-xl px-3 py-2 text-xs text-white outline-none resize-none"
                />
              </div>

              {/* Destination Link URL * */}
              <div>
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  Destination Link <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://yourwebsite.com or https://wa.me/254..."
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-[#e4002b] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              {/* Media: Thumbnail & Video */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-300 mb-1">
                    Thumbnail Image URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash..."
                    value={thumbnailUrl}
                    onChange={e => setThumbnailUrl(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-[#e4002b] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                  {thumbnailUrl && (
                    <div className="mt-1.5 w-16 h-12 rounded-lg overflow-hidden border border-stone-700 bg-stone-950">
                      <img
                        src={thumbnailUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={e => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-300 mb-1">
                    Video URL / Upload (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://assets.../promo.mp4"
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-[#e4002b] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              {/* Duration in Days (1 to 90) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-stone-300">
                    Campaign Duration: <span className="text-white font-black">{durationDays} days</span>
                  </label>
                  <span className="text-[11px] font-bold text-amber-400 font-mono">
                    Total: {costSc} SC ({costSc} KES)
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[1, 7, 14, 30].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationDays(d)}
                      className={`py-1.5 px-2 rounded-xl text-center border font-bold transition-all cursor-pointer ${
                        durationDays === d
                          ? 'bg-[#e4002b]/20 border-[#e4002b] text-[#e4002b]'
                          : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <div className="text-[11px]">{d} Days</div>
                      <div className="text-[10px] font-mono font-black">{d * 10} SC</div>
                    </button>
                  ))}
                </div>

                {/* Range Slider for 1 to 90 days */}
                <input
                  type="range"
                  min={1}
                  max={90}
                  value={durationDays}
                  onChange={e => setDurationDays(Number(e.target.value))}
                  className="w-full accent-[#e4002b] bg-stone-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-[11px] font-bold text-stone-300 mb-1.5">
                  Select Payment Method:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'wallet'
                        ? 'bg-[#e4002b]/15 border-[#e4002b] text-white'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <Wallet className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="text-left">
                      <div className="text-xs font-bold">SnappCoin Wallet</div>
                      <div className="text-[10px] font-mono text-stone-400">
                        Bal: {currentBalance.toLocaleString()} SC
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mpesa')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'mpesa'
                        ? 'bg-emerald-950/40 border-emerald-500 text-white'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="text-left">
                      <div className="text-xs font-bold">M-Pesa Direct</div>
                      <div className="text-[10px] text-stone-400">Paybill / Till</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Wallet Shortfall Notice if Wallet is chosen and insufficient */}
              {paymentMethod === 'wallet' && !hasEnoughCoins && (
                <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-800 text-amber-200 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Insufficient SnappCoins</p>
                      <p className="text-[11px] text-amber-300/90 mt-0.5">
                        You have {currentBalance} SC, but this campaign requires {costSc} SC.
                        Please top up the difference of <strong className="text-white font-mono">{shortfall} SC</strong> via M-Pesa to use your wallet, or choose M-Pesa Direct below.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* M-Pesa instructions & code input */}
              {paymentMethod === 'mpesa' && (
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                  <div className="text-[11px] text-stone-300">
                    Pay <strong className="text-emerald-400 font-mono">KES {costSc}</strong> to Paybill{' '}
                    <strong className="text-white font-mono">522522</strong>, Account{' '}
                    <strong className="text-white font-mono">AIRBUS-AD</strong>.
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">
                      10-Character M-Pesa Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      placeholder="e.g. QHX78PL92D"
                      value={mpesaCode}
                      onChange={e => setMpesaCode(e.target.value.toUpperCase())}
                      className="w-full bg-stone-900 border border-stone-700 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-white font-mono tracking-widest uppercase outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Error & Success Messages */}
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || (paymentMethod === 'wallet' && !hasEnoughCoins)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#e4002b] via-[#ff2e93] to-[#8b5cf6] hover:opacity-95 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Coins className="w-4 h-4 text-amber-300" />
                  <span>
                    {submitting
                      ? 'Processing...'
                      : paymentMethod === 'wallet'
                      ? `Pay ${costSc} SC & Submit Advert`
                      : `Submit M-Pesa Payment (${costSc} KES)`}
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
