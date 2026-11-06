import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { User } from '../types';
import { api } from '../api';
import { AuthModal } from './AuthModal';

interface AdminPortalLandingProps {
  onAdminAuthenticated: (user: User) => void;
  onLogin: (email: string, pass: string) => Promise<{ user: User }>;
}

export const AdminPortalLanding: React.FC<AdminPortalLandingProps> = ({
  onAdminAuthenticated,
  onLogin,
}) => {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [canRegisterAdmin, setCanRegisterAdmin] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    api
      .getAdminPortalStatus()
      .then(res => {
        if (!isMounted) return;
        setHasAdmin(res.hasAdmin);
        setCanRegisterAdmin(res.canRegisterAdmin);
        setLoadingStatus(false);
      })
      .catch(err => {
        if (!isMounted) return;
        setStatusError(err.message || 'Unable to verify administrative portal state.');
        setLoadingStatus(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenAuth = () => {
    // If no admin is registered yet, open in setup/register mode; otherwise open in login mode
    if (canRegisterAdmin && !hasAdmin) {
      setAuthMode('register');
    } else {
      setAuthMode('login');
    }
    setAuthModalOpen(true);
  };

  const handleLoginSuccess = (user: User) => {
    if (user.role === 'admin') {
      onAdminAuthenticated(user);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0d0f14] text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#ff2e93]/15 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#22d3ee]/15 rounded-full blur-[128px] pointer-events-none" />

      {/* Main Centered Card */}
      <div className="relative z-10 w-full max-w-md bg-[#161822]/90 border border-stone-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center flex flex-col items-center">
        {/* Airbus Brand Logo / Badge */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 px-3 bg-[#e4002b] rounded-xl flex items-center justify-center text-white font-black tracking-wider text-base shadow-lg shadow-[#e4002b]/25">
            AirBus
          </div>
          <span className="text-stone-400 font-mono text-xs uppercase tracking-widest px-2 py-0.5 rounded-md bg-stone-800/80 border border-stone-700/60">
            Control
          </span>
        </div>

        {/* Shield Icon Ring */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-stone-800 to-stone-900 border border-stone-700/80 flex items-center justify-center shadow-inner group">
            <ShieldCheck className="w-8 h-8 text-[#22d3ee] drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
          </div>
        </div>

        {/* Title & Description */}
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2 font-heading">
          Administrative Portal
        </h1>
        <p className="text-xs sm:text-sm text-stone-400 leading-relaxed max-w-sm mb-6">
          Restricted access area for authorized platform management, verifications, treasury control, and audit logs.
        </p>

        {/* Loading Spinner or Status Pill */}
        {loadingStatus ? (
          <div className="flex items-center gap-2 text-xs text-stone-400 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-[#22d3ee]" />
            <span>Checking security gateway...</span>
          </div>
        ) : statusError ? (
          <div className="w-full mb-4 p-3 rounded-xl bg-red-950/70 border border-red-800/50 text-red-200 text-xs">
            {statusError}
          </div>
        ) : (
          <>
            {/* Setup Mode Notice if initial admin is not yet registered */}
            {canRegisterAdmin && (
              <div className="w-full mb-5 p-3 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-left text-xs flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-amber-300">Platform Setup Active</span>
                  <span className="text-[11px] text-amber-200/90 leading-tight">
                    No administrator is registered yet. Click below to establish the primary admin account with your setup key.
                  </span>
                </div>
              </div>
            )}

            {/* Single Action "Sign in" Button */}
            <button
              type="button"
              onClick={handleOpenAuth}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#e4002b] to-[#ff2e93] hover:from-[#c90026] hover:to-[#e02681] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#e4002b]/25 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{canRegisterAdmin ? 'Sign in / Setup Admin' : 'Sign in to Admin Dashboard'}</span>
              <ArrowRight className="w-4 h-4 ml-1 opacity-80" />
            </button>
          </>
        )}

        {/* Security watermark footer */}
        <div className="mt-8 pt-4 border-t border-stone-800/60 w-full flex items-center justify-between text-[11px] text-stone-500 font-mono">
          <span>End-to-End Encrypted</span>
          <span>AirBus Global</span>
        </div>
      </div>

      {/* Existing Airbus Auth Modal reused for authentication */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
        onLoginSuccess={handleLoginSuccess}
        onLogin={onLogin}
        onRegister={async (data) => {
          // Fallback if called directly
          return api.register(data);
        }}
        adminPortalMode={true}
        canRegisterAdmin={canRegisterAdmin}
        onAdminSetup={async (data) => {
          const res = await api.setupAdminAccount(data);
          setHasAdmin(true);
          setCanRegisterAdmin(false);
          return res;
        }}
      />
    </div>
  );
};
