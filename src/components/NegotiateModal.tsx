import React, { useState } from 'react';
import { Stay, Currency, CURRENCY_RATES } from '../types';
import { X, BadgeDollarSign, Sparkles, ArrowRight } from 'lucide-react';

interface NegotiateModalProps {
  stay: Stay | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitOffer: (amount: number) => Promise<void>;
  currency: Currency;
}

export const NegotiateModal: React.FC<NegotiateModalProps> = ({
  stay,
  isOpen,
  onClose,
  onSubmitOffer,
  currency,
}) => {
  if (!isOpen || !stay) return null;

  const [offerAmount, setOfferAmount] = useState<number>(Math.round(stay.price * 0.9));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatMoney = (val: number) => {
    const rate = CURRENCY_RATES[currency] || 1;
    const converted = Math.round(val * rate);
    return `${currency} ${converted.toLocaleString()}`;
  };

  const discountPercent = Math.round(((stay.price - offerAmount) / stay.price) * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!offerAmount || offerAmount <= 0) {
      setError('Please enter a valid positive offer amount.');
      return;
    }
    if (offerAmount > stay.price * 1.5) {
      setError('Offer cannot be excessively higher than the listed price.');
      return;
    }
    if (offerAmount < stay.price * 0.4) {
      setError('Offers below 40% of listing rate are unlikely to be accepted. Please enter a realistic offer.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmitOffer(offerAmount);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error submitting offer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff2e93] to-[#8b5cf6] text-white flex items-center justify-center">
            <BadgeDollarSign className="w-4 h-4" />
          </div>
          <h2 className="text-xl font-extrabold font-heading">Negotiate Rate</h2>
        </div>

        <p className="text-xs text-stone-500 mb-4">
          Listed at <span className="font-bold text-stone-800 dark:text-stone-200">{formatMoney(stay.price)}/night</span> for {stay.title}. Send the host your counter-offer directly.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
              Your Offer Per Night ({stay.currency})
            </label>
            <div className="relative">
              <input
                type="number"
                min="500"
                step="100"
                value={offerAmount}
                onChange={e => setOfferAmount(Number(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-base font-extrabold outline-none focus:border-[#ff2e93]"
                required
              />
              <span className="absolute right-4 top-3.5 text-xs font-bold text-stone-400">
                {stay.currency}
              </span>
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex gap-2">
            {[0.95, 0.9, 0.85, 0.8].map(ratio => {
              const val = Math.round((stay.price * ratio) / 50) * 50;
              const disc = Math.round((1 - ratio) * 100);
              return (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setOfferAmount(val)}
                  className={`flex-1 py-1.5 px-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                    offerAmount === val
                      ? 'bg-[#ff2e93] text-white border-[#ff2e93]'
                      : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50'
                  }`}
                >
                  -{disc}%
                </button>
              );
            })}
          </div>

          {discountPercent > 0 && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl text-xs text-purple-900 dark:text-purple-300 flex items-center justify-between">
              <span>Proposed Savings:</span>
              <span className="font-extrabold text-[#ff2e93]">
                {discountPercent}% OFF (save {formatMoney(stay.price - offerAmount)}/night)
              </span>
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 text-xs text-rose-700 dark:text-rose-300 rounded-xl">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold rounded-full text-xs hover:bg-stone-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white font-extrabold rounded-full text-xs hover:opacity-95 shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{submitting ? 'Sending...' : 'Send Offer to Host'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
