import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, CheckCircle2, Wallet, ExternalLink, Calendar, Phone } from 'lucide-react';
import { User } from '../types';
import { api } from '../api';

interface AdvertModalProps {
  stayId: string;
  stayTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  userWalletBalance: number;
  onOpenAuth: () => void;
  onOpenTopup: () => void;
  onAdCreated?: () => void;
  showToast: (msg: string) => void;
}

export const AdvertModal: React.FC<AdvertModalProps> = ({
  stayId,
  stayTitle,
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
  const [imageUrl, setImageUrl] = useState('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80');
  const [targetUrl, setTargetUrl] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [adPricePerDay, setAdPricePerDay] = useState(100);
  const [maxSlots, setMaxSlots] = useState(10);
  const [activeSlotsCount, setActiveSlotsCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccess(false);
      api.getSettings()
        .then(res => {
          setAdPricePerDay(res.settings.adPricePerDay || 100);
          setMaxSlots(res.settings.maxAdSlotsPerPost || 10);
        })
        .catch(() => {});

      if (stayId) {
        api.getAds({ stayId, status: 'approved' })
          .then(res => setActiveSlotsCount(res.ads.length))
          .catch(() => {});
      }
    }
  }, [isOpen, stayId]);

  if (!isOpen) return null;

  const totalAmount = days * adPricePerDay; // e.g. 3 * 100 = 300 KES
  const platformFee = Math.round(totalAmount * 0.3); // 30% -> 90 KES
  const hostNet = totalAmount - platformFee; // 70% -> 210 KES
  const hasSufficientFunds = userWalletBalance >= totalAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!title.trim() || !imageUrl.trim() || !targetUrl.trim()) {
      setErrorMsg('Please fill in headline title, banner image, and destination link.');
      return;
    }
    if (!hasSufficientFunds) {
      setErrorMsg(`Insufficient wallet balance. You need KES ${totalAmount}, but have KES ${userWalletBalance}.`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await api.createAd({
        stayId,
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        targetUrl: targetUrl.trim(),
        contactPhone: contactPhone.trim(),
        tag: tag.trim(),
        days,
      });

      setSuccess(true);
      showToast(`Ad request submitted! KES ${totalAmount} held in wallet pending admin verification.`);
      if (onAdCreated) onAdCreated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit advert request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff2e93] to-[#8b5cf6] flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold font-heading">Sponsor This Video Tour</h3>
              <p className="text-xs text-stone-500 truncate max-w-[260px] sm:max-w-xs">{stayTitle || 'Short-Stay Listing'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto text-emerald-500">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-stone-900 dark:text-white">Advert Reserved & Queued!</h4>
            <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mx-auto leading-relaxed">
              A temporary hold of <span className="font-bold text-stone-900 dark:text-white">KES {totalAmount}</span> was placed on your wallet. Once the AirBus team approves your ad content, it will go live in the video footer strip for {days} days!
            </p>
            <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 text-xs text-stone-500 space-y-1 text-left">
              <div className="flex justify-between">
                <span>Total Fee:</span>
                <span className="font-bold text-stone-900 dark:text-white">KES {totalAmount}</span>
              </div>
              <div className="flex justify-between">
                <span>Host Net Revenue (70%):</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">KES {hostNet}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform Service Fee (30%):</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">KES {platformFee}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 rounded-full bg-[#e4002b] text-white text-xs font-bold hover:bg-[#c90026] cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Slot Capacity Status */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
              <div>
                <span className="font-bold text-stone-800 dark:text-stone-200">Video Ad Slots</span>
                <p className="text-[11px] text-stone-500">Max {maxSlots} active sponsor cards per listing video</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${activeSlotsCount < maxSlots ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-700'}`}>
                {activeSlotsCount}/{maxSlots} Occupied
              </span>
            </div>

            {/* Duration Selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>Campaign Duration (@ KES {adPricePerDay}/day)</span>
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {[1, 3, 5, 7, 14, 30].map(d => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDays(d)}
                    className={`py-2 rounded-xl font-bold border transition-all text-xs ${
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
                  placeholder="e.g. VIP Airport Transfers / Organic Breakfast Box"
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
                  placeholder="Tell guests why they need your service during their stay..."
                  className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:border-[#ff2e93] resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-600 dark:text-stone-400">Banner Image URL *</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:border-[#ff2e93]"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-stone-600 dark:text-stone-400">Target Website / Booking Link *</label>
                <input
                  type="url"
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value)}
                  placeholder="https://wa.me/254... or website"
                  className="w-full mt-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:border-[#ff2e93]"
                  required
                />
              </div>
            </div>

            {/* Live Pricing & Split Card */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/20 to-pink-950/20 border border-purple-500/30 space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-stone-800 dark:text-stone-200">Total Campaign Cost:</span>
                <span className="text-base font-extrabold text-[#e4002b] dark:text-[#ff2e93]">KES {totalAmount}</span>
              </div>
              <div className="text-[11px] text-stone-500 space-y-0.5 pt-1 border-t border-purple-500/20">
                <div className="flex justify-between">
                  <span>Host Net Revenue (70% immediately credited upon approval):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">KES {hostNet}</span>
                </div>
                <div className="flex justify-between">
                  <span>AirBus Platform Verification Fee (30%):</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">KES {platformFee}</span>
                </div>
              </div>
            </div>

            {/* Wallet Balance Status */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
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
                  className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                >
                  Top Up Wallet
                </button>
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
                ? 'Reserving Slot...'
                : !hasSufficientFunds
                ? 'Insufficient Balance (Top Up Required)'
                : activeSlotsCount >= maxSlots
                ? 'All 10 Slots Occupied'
                : `Submit Advert & Reserve (Hold KES ${totalAmount})`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
