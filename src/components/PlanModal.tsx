import React, { useState, useEffect } from 'react';
import { HostPlanStatus, StayCategory, SubscriptionRecord } from '../types';
import { X, Check, ShieldCheck, ArrowRight, ArrowLeft, Wallet, Zap, AlertCircle, Clock } from 'lucide-react';
import { PLANS } from '../constants';
import { api } from '../api';

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: HostPlanStatus;
  onSubmitPayment: (
    kind: 'plan' | 'wallet',
    tier: StayCategory,
    amount: number,
    mpesaCode: string,
    period?: 'monthly' | 'annual'
  ) => Promise<void>;
  walletMode?: boolean;
  userWalletBalance?: number;
  onPayFromWallet?: (tier: StayCategory, period?: 'monthly' | 'annual') => Promise<void>;
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
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [inPayStep, setInPayStep] = useState(walletMode);
  const [walletAmount, setWalletAmount] = useState(2500);
  const [mpesaCode, setMpesaCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [walletPaying, setWalletPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [activeSub, setActiveSub] = useState<SubscriptionRecord | null>(null);
  const [pendingSub, setPendingSub] = useState<SubscriptionRecord | null>(null);

  useEffect(() => {
    let isMounted = true;
    api.getCurrentSubscription()
      .then(res => {
        if (!isMounted) return;
        if (res.activeSubscription) setActiveSub(res.activeSubscription);
        if (res.pendingSubscription) setPendingSub(res.pendingSubscription);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const tierDetails = {
    Silver: {
      monthlyPrice: PLANS.Silver.p,
      annualPrice: PLANS.Silver.annualPrice,
      savings: PLANS.Silver.annualSavings,
      limit: '3 live listings',
      features: [
        '3 active video-first listings',
        'Exposure in Home feed & Shorts',
        'Direct booking requests & chat',
        'Zero commission on guest payouts',
      ],
    },
    Diamond: {
      monthlyPrice: PLANS.Diamond.p,
      annualPrice: PLANS.Diamond.annualPrice,
      savings: PLANS.Diamond.annualSavings,
      limit: '10 live listings',
      features: [
        '10 active video-first listings',
        'AI Smart Pricing suggestions',
        'Conversion & performance analytics',
        'Everything included in Silver',
      ],
    },
    Gold: {
      monthlyPrice: PLANS.Gold.p,
      annualPrice: PLANS.Gold.annualPrice,
      savings: PLANS.Gold.annualSavings,
      limit: 'Unlimited listings',
      features: [
        'Unlimited active listings',
        'Featured placement on homepage',
        'Priority admin verification',
        'Everything in Diamond',
      ],
    },
  };

  const selectedDetails = tierDetails[selectedTier];
  const amountToPay = walletMode
    ? walletAmount
    : billingCycle === 'annual'
    ? selectedDetails.annualPrice
    : selectedDetails.monthlyPrice;

  // Subscription Enforcement Rules:
  const isCurrentlyActive = (activeSub !== null && activeSub.status === 'active' && activeSub.endsAt > Date.now()) ||
    (currentPlan.status === 'active' && currentPlan.expiresAt > Date.now());
  const activeExpiryDate = activeSub?.endsAt
    ? new Date(activeSub.endsAt).toLocaleDateString()
    : currentPlan.expiresAt > 0
    ? new Date(currentPlan.expiresAt).toLocaleDateString()
    : '';

  const hasPendingApproval = pendingSub !== null && pendingSub.status === 'pending';

  // Can purchase new plan if NOT in wallet mode?
  const isPlanPurchaseBlocked = !walletMode && (isCurrentlyActive || hasPendingApproval);

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isPlanPurchaseBlocked) {
      if (hasPendingApproval) {
        setError('You already have a subscription payment pending admin approval.');
      } else {
        setError(`You have an active subscription expiring on ${activeExpiryDate}. Upgrades or new subscriptions can only be purchased after the current period ends.`);
      }
      return;
    }

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
        cleanCode,
        walletMode ? undefined : billingCycle
      );
      setSuccessMsg('Receipt submitted successfully! Admin will verify and activate your plan.');
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
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 dark:border-stone-800 max-h-[95vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {!inPayStep ? (
          <div>
            <div className="mb-4">
              <span className="bg-[#ff2e93] text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                AirBus Host Subscriptions
              </span>
              <h2 className="text-2xl font-extrabold font-heading mt-2">Choose Your Hosting Plan</h2>
              <p className="text-xs text-stone-500 mt-1">
                Hosting on AirBus is a flat subscription with zero guest commission. Guests pay you directly.
              </p>
            </div>

            {/* Server-Enforced Active Subscription Alert */}
            {isCurrentlyActive && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 mb-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    <h4 className="font-extrabold text-sm">Active Subscription In Progress</h4>
                    <p className="mt-1 leading-relaxed text-[11px] text-stone-600 dark:text-stone-300">
                      You currently have an active <strong>{activeSub?.tier || currentPlan.tier}</strong> plan that expires on{' '}
                      <strong className="text-amber-500">{activeExpiryDate}</strong>.
                      Per AirBus platform rules, only one active subscription is allowed at a time. You can upgrade or switch to another plan immediately after your current period finishes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pending Subscription Alert */}
            {hasPendingApproval && (
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 mb-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 shrink-0 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-extrabold text-sm">Payment Awaiting Admin Approval</h4>
                    <p className="mt-1 leading-relaxed text-[11px] text-stone-600 dark:text-stone-300">
                      You have submitted a payment for a <strong>{pendingSub?.tier}</strong> ({pendingSub?.billing}) subscription.
                      Our admin is reviewing the transaction code. Second purchases are blocked while approval is pending.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Monthly vs Annual Toggle */}
            <div className="flex items-center justify-center my-4">
              <div className="inline-flex p-1 rounded-2xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                  }`}
                >
                  Monthly (30 Days)
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    billingCycle === 'annual'
                      ? 'bg-[#e4002b] text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                  }`}
                >
                  <span>Annual (365 Days)</span>
                  <span className="bg-amber-400 text-stone-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                    Save up to KES 10,000
                  </span>
                </button>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {(['Silver', 'Diamond', 'Gold'] as StayCategory[]).map(t => {
                const isSelected = selectedTier === t;
                const isCurrent = (activeSub?.tier || currentPlan.tier) === t && isCurrentlyActive;
                const d = tierDetails[t];
                const displayPrice = billingCycle === 'annual' ? d.annualPrice : d.monthlyPrice;

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
                            Active
                          </span>
                        )}
                      </div>

                      <div className="text-lg font-black text-[#e4002b] mt-1">
                        KES {displayPrice.toLocaleString()}
                        <span className="text-[10px] font-normal text-stone-400">
                          {billingCycle === 'annual' ? '/yr' : '/mo'}
                        </span>
                      </div>

                      {billingCycle === 'annual' && (
                        <div className="inline-block mt-0.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-md">
                          Save KES {d.savings.toLocaleString()} / yr
                        </div>
                      )}

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
                      disabled={isPlanPurchaseBlocked}
                      onClick={() => {
                        setSelectedTier(t);
                        setInPayStep(true);
                      }}
                      className={`w-full py-2 rounded-xl text-xs font-bold mt-4 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-[#e4002b] text-white'
                          : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300'
                      }`}
                    >
                      {isCurrentlyActive
                        ? `Active until ${activeExpiryDate}`
                        : hasPendingApproval
                        ? 'Approval Pending'
                        : `Select ${t}`}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Wallet Coin & Insufficient Coins Banner */}
            {userWalletBalance < (billingCycle === 'annual' ? selectedDetails.annualPrice : selectedDetails.monthlyPrice) && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                    <Wallet className="w-4 h-4 text-amber-600" />
                    <span>Insufficient Wallet Coins (1 Coin = 1 KES)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                    Current wallet: <strong>{userWalletBalance.toLocaleString()} Coins</strong> (KES {userWalletBalance.toLocaleString()}).
                    Required: <strong>{(billingCycle === 'annual' ? selectedDetails.annualPrice : selectedDetails.monthlyPrice).toLocaleString()} Coins</strong>.
                    <span className="block font-black text-rose-600 dark:text-rose-400 mt-0.5">
                      Shortfall: {((billingCycle === 'annual' ? selectedDetails.annualPrice : selectedDetails.monthlyPrice) - userWalletBalance).toLocaleString()} Coins (KES {((billingCycle === 'annual' ? selectedDetails.annualPrice : selectedDetails.monthlyPrice) - userWalletBalance).toLocaleString()})
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setWalletAmount((billingCycle === 'annual' ? selectedDetails.annualPrice : selectedDetails.monthlyPrice) - userWalletBalance);
                    setInPayStep(true);
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[11px] shrink-0 shadow-sm cursor-pointer"
                >
                  Top Up Difference ({((billingCycle === 'annual' ? selectedDetails.annualPrice : selectedDetails.monthlyPrice) - userWalletBalance).toLocaleString()} Coins)
                </button>
              </div>
            )}

            {/* Required Disclaimer */}
            <div className="p-3 rounded-2xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed mb-4">
              <span className="font-bold text-stone-800 dark:text-stone-200">Subscription Terms &amp; Policy: </span>
              Subscription is valid for 30 days (or 365 days for annual) from the day of admin payment approval. If your subscription expires, your contact details will be hidden and guests will not be able to book your short stays until you renew. If your subscription stays inactive for 3 consecutive months, your listings will be delisted from the platform.
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-stone-400 pt-3 border-t border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-stone-400" />
                <span>
                  Wallet: <strong className="text-stone-900 dark:text-white font-mono">{userWalletBalance.toLocaleString()} Coins</strong> (KES {userWalletBalance.toLocaleString()})
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {onPayFromWallet && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (isPlanPurchaseBlocked) {
                        setError(`Active subscription ongoing until ${activeExpiryDate}. Please finish the current period first.`);
                        return;
                      }
                      const cost = billingCycle === 'annual' ? selectedDetails.annualPrice : selectedDetails.monthlyPrice;
                      if (userWalletBalance < cost) {
                        const diff = cost - userWalletBalance;
                        setError(`Insufficient coins! You have ${userWalletBalance} coins but need ${cost} coins. Please top up the difference of ${diff} coins (KES ${diff}) via M-Pesa.`);
                        return;
                      }
                      setError(null);
                      setWalletPaying(true);
                      try {
                        await onPayFromWallet(selectedTier, billingCycle);
                        setSuccessMsg(`Plan activated instantly from wallet!`);
                        setTimeout(() => onClose(), 2000);
                      } catch (err: any) {
                        setError(err.message || 'Payment from wallet failed.');
                      } finally {
                        setWalletPaying(false);
                      }
                    }}
                    disabled={isPlanPurchaseBlocked || walletPaying || userWalletBalance < (billingCycle === 'annual' ? selectedDetails.annualPrice : selectedDetails.monthlyPrice)}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white rounded-full font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{walletPaying ? 'Activating...' : 'Pay from Wallet'}</span>
                  </button>
                )}
                <button
                  disabled={isPlanPurchaseBlocked}
                  onClick={() => setInPayStep(true)}
                  className="flex-1 sm:flex-initial px-5 py-2 bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white rounded-full font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
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
                  className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h2 className="text-xl font-extrabold font-heading">
                {walletMode
                  ? 'Deposit to AirBus Wallet'
                  : `Pay for ${selectedTier} Plan (${billingCycle === 'annual' ? '365 Days' : '30 Days'})`}
              </h2>
            </div>

            {/* M-PESA INSTRUCTIONS TICKET */}
            <div className="p-4 bg-stone-900 text-emerald-400 font-mono text-xs rounded-2xl shadow-inner border border-emerald-500/30 mb-5 space-y-1">
              <div className="text-white font-bold tracking-wider mb-1">LIPA NA M-PESA</div>
              <div>Paybill Number: <span className="text-white font-bold text-sm">222111</span></div>
              <div>Account Number: <span className="text-white font-bold text-sm">ff1314</span></div>
              <div>Amount to Pay: <span className="text-emerald-300 font-bold text-sm">KES {amountToPay.toLocaleString()}</span></div>
              {!walletMode && (
                <div className="text-stone-400 text-[10px] pt-1">
                  Plan Duration: {billingCycle === 'annual' ? '365 days' : '30 days'} from date of admin approval.
                </div>
              )}
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
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-full text-xs font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
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
