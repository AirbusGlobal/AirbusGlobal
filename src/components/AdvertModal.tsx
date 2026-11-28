import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, CheckCircle2, Wallet, Calendar, Clock } from 'lucide-react';
import { AdRequest, User } from '../types';
import { api } from '../api';

interface AdvertModalProps {
  stayId: string;
  stayTitle?: string;
  stayThumbnail?: string;
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  userWalletBalance: number;
  onOpenAuth: () => void;
  onOpenTopup: () => void;
  onAdCreated?: (ad?: AdRequest, walletBalance?: number) => void;
  showToast: (msg: string) => void;
}

export const AdvertModal: React.FC<AdvertModalProps> = ({
  stayId,
  stayTitle,
  stayThumbnail,
  isOpen,
  onClose,
  user,
  userWalletBalance,
  onOpenAuth,
  onOpenTopup,
  onAdCreated,
  showToast,
}) => {
  const [days, setDays] = useState(3);
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('Featured Sponsor');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState(
    stayThumbnail || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80'
  );
  const [targetUrl, setTargetUrl] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [adPricePerDay, setAdPricePerDay] = useState(100);
  const [maxSlots, setMaxSlots] = useState(10);
  const [activeSlotsCount, setActiveSlotsCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successAd, setSuccessAd] = useState<AdRequest | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessAd(null);
      setTitle('');
      setDescription('');
      setImageUrl(
        stayThumbnail || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80'
      );
      setTargetUrl('');
      api
        .getSettings()
        .then(res => {
          setAdPricePerDay(res.settings.adPricePerDay || 100);
          setMaxSlots(res.settings.maxAdSlotsPerPost || 10);
        })
        .catch(() => {});

      if (stayId) {
        api
          .getAds({ stayId, status: 'active' })
          .then(res => setActiveSlotsCount(res.ads.length))
          .catch(() => {});
      }
    }
  }, [isOpen, stayId, stayThumbnail]);

  if (!isOpen) return null;

  const totalAmount = days * adPricePerDay;
  const hasSufficientFunds = userWalletBalance >= totalAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Please enter an advert headline title.');
      return;
    }
    if (!hasSufficientFunds) {
      setErrorMsg(`Insufficient wallet balance. You need KES ${totalAmount.toLocaleString()}, but have KES ${userWalletBalance.toLocaleString()}.`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const idempotencyKey = `adpay_${stayId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const res = await api.createAd({
        stayId,
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || stayThumbnail || undefined,
        targetUrl: targetUrl.trim() || undefined,
        contactPhone: contactPhone.trim(),
        tag: tag.trim(),
        days,
        payNow: true,
        paymentMethod: 'wallet',
        idempotencyKey,
      });

      setSuccessAd(res.ad);
      showToast(
        `Advert active on "${stayTitle || 'this listing'}" & its Shorts for ${days} ${days === 1 ? 'day' : 'days'}! KES ${totalAmount.toLocaleString()} paid from wallet.`
      );
      onAdCreated?.(res.ad, res.walletBalance);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to activate advert.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff2e93] to-[#8b5cf6] flex items-center justify-center text-white shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold font-heading">Advertise on Selected Listing</h3>
              <p className="text-xs text-stone-500 truncate max-w-[260px] sm:max-w-xs">{stayTitle || 'Chosen Listing'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successAd ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto text-emerald-500">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-stone-900 dark:text-white">Advert Active on Footer &amp; Related Shorts!</h4>
            <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mx-auto leading-relaxed">
              <span className="font-bold text-stone-900 dark:text-white">KES {totalAmount.toLocaleString()}</span> was paid from your AirBus Wallet to AirBus Admin income. Your advert is now live strictly on the footer of{' '}
              <span className="font-semibold text-stone-900 dark:text-white">{stayTitle || 'this listing'}</span> and its related Short videos for {days} {days === 1 ? 'day' : 'days'}, and will remove itself automatically upon expiry.
            </p>
            <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 text-xs text-stone-500 space-y-1 text-left">
              <div className="flex justify-between">
                <span>Advert Fee Paid (Wallet → Admin):</span>
                <span className="font-bold text-stone-900 dark:text-white">KES {totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Placement Scope:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">This Listing &amp; Related Shorts Footer Only</span>
              </div>
              {(successAd.end_at || successAd.expiresAt) && (
                <div className="flex justify-between">
                  <span>Auto-Removes On:</span>
                  <span className="font-semibold text-stone-700 dark:text-stone-300">
                    {new Date(successAd.end_at || successAd.expiresAt || Date.now()).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-6 py-2.5 rounded-full bg-[#e4002b] text-white text-xs font-bold hover:bg-[#c90026] cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Slot Capacity Status */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 gap-2">
              <div className="min-w-0">
                <span className="font-bold text-stone-800 dark:text-stone-200">Listing Footer &amp; Related Shorts</span>
                <p className="text-[11px] text-stone-500">
                  Appears exclusively on this listing&apos;s footer and its Short videos ({maxSlots} max slots)
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap shrink-0 ${activeSlotsCount < maxSlots ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-700'}`}>
                {activeSlotsCount}/{maxSlots} Occupied
              </span>
            </div>

            {/* Duration Selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>Paid Duration (@ KES {adPricePerDay}/day · Auto-expires)</span>
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {[1, 3, 5, 7, 14, 30].map(d => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDays(d)}
                    className={`py-2 rounded-xl font-bold border transition-all text-xs cursor-pointer ${
                      days === d
                        ? 'bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white border-transparent shadow-sm'
                        : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-stone-400'
                    }`}
                  >
                    {d} {d === 1 ? 'Day' : 'Days'}
                  </button>
                ))}
              </div>
            </div>

            {/* Ad Content Fields */}
            <div className="space-y-2.5">
              <div>
                <label className="font-semibold text-stone-600 dark:text-stone-400">Headline Title *</label>
                <input
                  type="text"
                  maxLength={60}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. VIP Airport Transfers / Private Chef"
                  className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:border-[#ff2e93]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-stone-600 dark:text-stone-400">Tag / Category</label>
                  <input
                    type="text"
                    maxLength={30}
                    value={tag}
                    onChange={e => setTag(e.target.value)}
                    placeholder="e.g. Chauffeur, Dining, Safari"
                    className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:border-[#ff2e93]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-stone-600 dark:text-stone-400">Contact / WhatsApp Phone</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    placeholder="+254 712 345 678"
                    className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:border-[#ff2e93]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-600 dark:text-stone-400">Description (Brief)</label>
                <textarea
                  rows={2}
                  maxLength={150}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief note shown in the listing & Shorts footer..."
                  className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:border-[#ff2e93] resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-600 dark:text-stone-400">Banner Image URL (optional)</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:border-[#ff2e93]"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-600 dark:text-stone-400">Destination Link (optional)</label>
                <input
                  type="text"
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value)}
                  placeholder="https://wa.me/254... or booking URL"
                  className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:border-[#ff2e93]"
                />
              </div>
            </div>

            {/* Live Pricing Card */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/10 to-pink-950/10 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-500/30 space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-stone-800 dark:text-stone-200">Total Advert Fee ({days}d × KES {adPricePerDay}):</span>
                <span className="text-base font-extrabold text-[#e4002b] dark:text-[#ff2e93]">KES {totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-stone-600 dark:text-stone-400 pt-1 border-t border-purple-500/20">
                <Clock className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span>
                  Paid from your wallet to Admin income. Automatically removed after {days} {days === 1 ? 'day' : 'days'}.
                </span>
              </div>
            </div>

            {/* Wallet Balance Status */}
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-stone-400" />
                  <div>
                    <span className="font-semibold text-stone-700 dark:text-stone-300">Your AirBus Wallet:</span>
                    <p className="text-[11px] font-bold text-stone-900 dark:text-white">KES {userWalletBalance.toLocaleString()}</p>
                  </div>
                </div>
                {!hasSufficientFunds && (
                  <button
                    type="button"
                    onClick={onOpenTopup}
                    className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    Deposit (M-Pesa)
                  </button>
                )}
              </div>

              {!hasSufficientFunds && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs space-y-1 leading-relaxed">
                  <p>
                    Insufficient wallet balance. Your advert cannot be placed until your wallet covers KES {totalAmount.toLocaleString()}.
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                    Shortfall: KES {(totalAmount - userWalletBalance).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || activeSlotsCount >= maxSlots || !hasSufficientFunds}
              className="w-full py-3 rounded-full bg-gradient-to-r from-[#ff2e93] via-[#8b5cf6] to-[#06b6d4] hover:opacity-95 text-white font-extrabold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {loading
                ? 'Processing Wallet Payment...'
                : !hasSufficientFunds
                ? 'Insufficient Balance — Advert Not Placed'
                : activeSlotsCount >= maxSlots
                ? 'All 10 Slots Occupied'
                : `Pay KES ${totalAmount.toLocaleString()} from Wallet & Activate Advert`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

