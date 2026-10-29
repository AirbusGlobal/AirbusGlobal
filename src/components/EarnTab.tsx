import React, { useState, useEffect } from 'react';
import { Gift, Copy, Check, TrendingUp, Users, MousePointerClick, ShieldCheck, ArrowRight, Wallet } from 'lucide-react';
import { User, ReferralProfile, ReferralCommissionRecord } from '../types';
import { api } from '../api';

interface EarnTabProps {
  user: User | null;
  onOpenAuth: () => void;
  showToast: (msg: string) => void;
  onGoToWallet?: () => void;
}

export const EarnTab: React.FC<EarnTabProps> = ({
  user,
  onOpenAuth,
  showToast,
  onGoToWallet,
}) => {
  const [profile, setProfile] = useState<ReferralProfile | null>(null);
  const [commissions, setCommissions] = useState<ReferralCommissionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      setLoading(true);
      api.getReferralProfile()
        .then(res => {
          setProfile(res.profile);
          setCommissions(res.commissions || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white dark:bg-[#15171e] rounded-3xl border border-stone-200 dark:border-stone-800 text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 bg-gradient-to-tr from-[#ff2e93] to-[#8b5cf6] rounded-2xl flex items-center justify-center text-white mx-auto shadow-md">
          <Gift className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black font-heading text-stone-900 dark:text-white">AirBus Affiliate & Partner Program</h2>
        <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mx-auto leading-relaxed">
          Earn a continuous <span className="font-bold text-stone-900 dark:text-white">10% recurring commission</span> on all platform revenue (host 30-day subscriptions & video sponsor ad fees) for 12 months!
        </p>
        <button
          onClick={onOpenAuth}
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white text-xs font-extrabold hover:opacity-95 shadow-md transition-all cursor-pointer"
        >
          Sign In to Access Your Referral Link
        </button>
      </div>
    );
  }

  const referralCode = profile?.referralCode || `${user.name.split(' ')[0].toUpperCase()}2026`;
  const shareUrl = `${window.location.origin}/?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    showToast('Referral link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#15171e] via-[#201736] to-[#2d1134] text-white border border-purple-500/30 shadow-xl">
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-bold">
            <Gift className="w-3.5 h-3.5 text-[#ff2e93]" />
            <span>AirBus Affiliate & Earn Program</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-heading tracking-tight leading-tight">
            Share Video-First Stays. <br />
            Earn <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff2e93] via-[#ff5b79] to-[#06b6d4]">10% Recurring Commission.</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
            Invite hosts and advertisers to AirBus. When your referred creators pay monthly subscriptions or sponsor ads, 10% of platform revenue is automatically credited straight to your AirBus wallet for 12 continuous months!
          </p>

          {/* Referral Link Box */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-lg">
            <div className="flex-1 flex items-center bg-black/40 border border-white/20 rounded-2xl px-3.5 py-2.5 text-xs text-stone-200 font-mono truncate">
              <span className="truncate">{shareUrl}</span>
            </div>
            <button
              onClick={handleCopy}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 hover:opacity-95 shadow-md transition-all cursor-pointer active:scale-95 shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-950/40 text-[#ff2e93] flex items-center justify-center shrink-0">
            <MousePointerClick className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-stone-500">Link Clicks</span>
            <div className="text-2xl font-black text-stone-900 dark:text-white">
              {profile?.clicks || 0}
            </div>
            <span className="text-[10px] text-stone-400">Total visitors sent</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-[#8b5cf6] flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-stone-500">Registered Referrals</span>
            <div className="text-2xl font-black text-stone-900 dark:text-white">
              {profile?.signupsCount || 0}
            </div>
            <span className="text-[10px] text-stone-400">Hosts & travellers onboarded</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-stone-500">Lifetime Earnings</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              KES {(profile?.totalEarnedKes || 0).toLocaleString()}
            </div>
            <span className="text-[10px] text-stone-400">Available to withdraw or spend</span>
          </div>
        </div>
      </div>

      {/* Program Mechanics Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold text-stone-900 dark:text-white uppercase tracking-wider">
          How AirBus Commission Payouts Work
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-1.5">
            <span className="font-extrabold text-purple-600 dark:text-purple-400">1. Share Your Link</span>
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
              Drop your referral link on WhatsApp groups, Instagram bios, Twitter or safari forums. Anyone who taps your link is attributed to you.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-1.5">
            <span className="font-extrabold text-[#ff2e93]">2. Host Subscriptions</span>
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
              When a referred host activates a 30-day plan (Silver: KES 1,000 | Diamond: KES 2,500 | Gold: KES 5,000), you immediately receive 10% (up to KES 500/month).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-1.5">
            <span className="font-extrabold text-[#06b6d4]">3. Sponsor Ad Placements</span>
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
              When your referred contacts purchase video sponsor ads, you earn 10% on the platform ad service fee, credited atomically via ledger.
            </p>
          </div>
        </div>
      </div>

      {/* Commission Ledger History */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-stone-900 dark:text-white uppercase tracking-wider">
            Affiliate Commission History
          </h3>
          <span className="text-xs text-stone-500 font-semibold">{commissions.length} Payouts</span>
        </div>

        {commissions.length === 0 ? (
          <div className="py-8 text-center text-xs text-stone-500 space-y-2">
            <p>No commissions earned yet.</p>
            <p className="text-stone-400">Share your link above to start receiving instant platform commissions!</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
            {commissions.map(c => (
              <div key={c.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 dark:text-white">
                      From: {c.referredEmail}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      {c.sourceType === 'subscription' ? 'Plan Subscription' : 'Video Ad Fee'}
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-400">
                    {new Date(c.createdAt).toLocaleDateString()} · Gross Activity: KES {c.grossAmount.toLocaleString()}
                  </span>
                </div>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                  +KES {c.commissionAmount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
