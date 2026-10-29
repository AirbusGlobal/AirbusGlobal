import React, { useState } from 'react';
import { HostPlanStatus, StayCategory } from '../types';
import { X, Check, ShieldCheck, ArrowRight, ArrowLeft, Wallet, Zap } from 'lucide-react';
import { PLANS } from '../constants';

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: HostPlanStatus;
  onSubmitPayment: (kind: 'plan' | 'wallet', tier: StayCategory, amount: number, mpesaCode: string) => Promise<void>;
  walletMode?: boolean;
  userWalletBalance?: number;
  onPayFromWallet?: (tier: StayCategory) => Promise<void>;
}

export const PlanModal: React.FC<PlanModalProps> = ({
  isOpen,
  onClose,
  currentPlan,
  onSubmitPayment,
  walletMode = false,
  userWalletBalance = 0,
  onPayFromWallet,
}) => {
  if (!isOpen) return null;

  const [selectedTier, setSelectedTier] = useState<StayCategory>('Diamond');
  const [inPayStep, setInPayStep] = useState(walletMode);
  const [walletAmount, setWalletAmount] = useState(2500);
  const [mpesaCode, setMpesaCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [walletPaying, setWalletPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);


  const tierDetails = {
    Silver: {
      price: 1000,
      limit: '3 live listings',
      features: [
        '3 active video-first listings',
        'Exposure in Feed & Shorts',
        'Direct booking requests & chat',
        'Zero commission on guest payouts',
      ],
    },
    Diamond: {
      price: 2500,
      limit: '10 live listings',
      features: [
        '10 active video-first listings',
        'AI Smart Pricing suggestions',
        'Conversion & performance analytics',
        'Everything included in Silver',
      ],
    },
    Gold: {
      price: 5000,
      limit: 'Unlimited listings',
      features: [
        'Unlimited active listings',
        'Featured placement on homepage',
        'Priority admin verification',
        'Everything in Diamond',
      ],
    },
  };

  const amountToPay = walletMode ? walletAmount : tierDetails[selectedTier].price;

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanCode = mpesaCode.trim().toUpperCase();
    if (!cleanCode || !/^[A-Z0-9]{10}$/.test(cleanCode)) {
      setError('M-Pesa code must be exactly 10 letters/digits (e.g. QGH7X2K9LM).');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitPayment(
        walletMode ? 'wallet' : 'plan',
        selectedTier,
        amountToPay,
        cleanCode
      );
      setSuccessMsg('Receipt submitted successfully! Admin will verify within 2–24 hours (or instantly in Admin Console).');
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Payment submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 dark:border-stone-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {!inPayStep ? (
          <div>
            <div className="mb-6">
              <span className="bg-[#ff2e93] text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                AirBus Host Subscriptions
              </span>
              <h2 className="text-2xl font-extrabold font-heading mt-2">Choose Your Hosting Plan</h2>
              <p className="text-xs text-stone-500 mt-1">
                Hosting on AirBus is a flat monthly subscription with zero guest commission. Guests pay you directly.
              </p>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {(['Silver', 'Diamond', 'Gold'] as StayCategory[]).map(t => {
                const isSelected = selectedTier === t;
                const isCurrent = currentPlan.tier === t && currentPlan.status === 'active';
                const d = tierDetails[t];

                return (
                  <div
                    key={t}
                    onClick={() => setSelectedTier(t)}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#e4002b] bg-[#fbeeee]/40 dark:bg-[#331219]/30 shadow-md scale-[1.02]'
                        : 'border-stone-200 dark:border-stone-800 hover:border-stone-400 bg-stone-50/50 dark:bg-stone-900/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-extrabold text-sm text-stone-900 dark:text-white">{t}</h3>
                        {isCurrent && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </div>

                      <div className="text-lg font-black text-[#e4002b] mt-1">
                        KES {d.price.toLocaleString()}
                        <span className="text-[10px] font-normal text-stone-400">/mo</span>
                      </div>

                      <div className="text-xs font-semibold text-stone-600 dark:text-stone-300 mt-2 mb-3">
                        {d.limit}
                      </div>

                      <div className="space-y-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                        {d.features.map((feat, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTier(t);
                        setInPayStep(true);
                      }}
                      className={`w-full py-2 rounded-xl text-xs font-bold mt-4 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#e4002b] text-white'
                          : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300'
                      }`}
                    >
                      {isCurrent ? 'Renew Plan' : `Select ${t}`}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-stone-400 pt-3 border-t border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-stone-400" />
                <span>Wallet Balance: <strong className="text-stone-900 dark:text-white">KES {userWalletBalance.toLocaleString()}</strong></span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {onPayFromWallet && userWalletBalance >= tierDetails[selectedTier].price && (
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null);
                      setWalletPaying(true);
                      try {
                        await onPayFromWallet(selectedTier);
                        setSuccessMsg(`30-Day ${selectedTier} Plan activated instantly!`);
                        setTimeout(() => onClose(), 2000);
                      } catch (err: any) {
                        setError(err.message || 'Payment from wallet failed.');
                      } finally {
                        setWalletPaying(false);
                      }
                    }}
                    disabled={walletPaying}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white rounded-full font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{walletPaying ? 'Activating...' : 'Pay from Wallet'}</span>
                  </button>
                )}
                <button
                  onClick={() => setInPayStep(true)}
                  className="flex-1 sm:flex-initial px-5 py-2 bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white rounded-full font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow hover:opacity-95"
                >
                  <span>Pay with M-Pesa</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* STEP 2: M-PESA PAYMENT SCREEN */
          <div>
            <div className="flex items-center gap-2 mb-4">
              {!walletMode && (
                <button
                  onClick={() => setInPayStep(false)}
                  className="p-1 rounded-full hover:bg-stone-100 text-stone-400"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h2 className="text-xl font-extrabold font-heading">
                {walletMode ? 'Deposit to AirBus Wallet' : `Pay for ${selectedTier} Plan`}
              </h2>
            </div>

            {/* M-PESA INSTRUCTIONS TICKET */}
            <div className="p-4 bg-stone-900 text-emerald-400 font-mono text-xs rounded-2xl shadow-inner border border-emerald-500/30 mb-5 space-y-1">
              <div className="text-white font-bold tracking-wider mb-1">LIPA NA M-PESA</div>
              <div>Paybill Number: <span className="text-white font-bold text-sm">222111</span></div>
              <div>Account Number: <span className="text-white font-bold text-sm">ff1314</span></div>
              <div>Amount to Pay: <span className="text-emerald-300 font-bold text-sm">KES {amountToPay.toLocaleString()}</span></div>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-4">
              {walletMode && (
                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Deposit Amount (KES)
                  </label>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    value={walletAmount}
                    onChange={e => setWalletAmount(Number(e.target.value) || 1000)}
                    className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold outline-none"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  M-Pesa 10-Character Receipt Code *
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={mpesaCode}
                  onChange={e => setMpesaCode(e.target.value.toUpperCase())}
                  placeholder="e.g. QGH7X2K9LM"
                  className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-mono font-bold tracking-widest uppercase outline-none focus:border-emerald-500"
                  required
                />
                <span className="text-[11px] text-stone-400 mt-1 block">
                  Check your M-Pesa SMS confirmation message for the 10-letter reference code.
                </span>
              </div>

              {error && (
                <div className="p-3 bg-red-950/60 border border-red-500/50 text-xs text-red-200 rounded-xl">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-200 rounded-xl">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-full text-xs font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                {submitting ? 'Submitting Receipt...' : 'I Have Paid — Submit for Verification'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
