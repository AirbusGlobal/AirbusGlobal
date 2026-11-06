import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, UserCheck, Shield, Key } from 'lucide-react';
import { User, UserRole } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onLoginSuccess: (user: User) => void;
  onLogin: (email: string, pass: string) => Promise<{ user: User }>;
  onRegister: (data: any) => Promise<{ user: User }>;
  adminPortalMode?: boolean;
  canRegisterAdmin?: boolean;
  onAdminSetup?: (data: { name: string; email: string; password: string; setupKey: string }) => Promise<{ user: User }>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onLoginSuccess,
  onLogin,
  onRegister,
  adminPortalMode = false,
  canRegisterAdmin = false,
  onAdminSetup,
}) => {
  // If in admin portal mode and admin is already registered, registration is disabled
  const effectiveInitialSignUp = adminPortalMode
    ? canRegisterAdmin && initialMode === 'register'
    : initialMode === 'register';

  const [isSignUp, setIsSignUp] = useState(effectiveInitialSignUp);
  const [role, setRole] = useState<UserRole>('guest');

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [adminSetupKey, setAdminSetupKey] = useState('');
  const [referralCode, setReferralCode] = useState(() => {
    try {
      return localStorage.getItem('airbus_ref_code') || '';
    } catch {
      return '';
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail || !loginPassword) {
      setError('Please provide your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await onLogin(loginEmail, loginPassword);
      if (adminPortalMode && res.user.role !== 'admin') {
        setError('Access denied: this account does not have administrator privileges.');
        return;
      }
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!registerName || !registerEmail || !registerPassword) {
      setError('Please fill in all registration fields.');
      return;
    }
    if (registerPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (adminPortalMode) {
        if (!canRegisterAdmin) {
          setError('Admin registration is closed.');
          setLoading(false);
          return;
        }
        if (!adminSetupKey.trim()) {
          setError('Admin Setup Key is required.');
          setLoading(false);
          return;
        }
        const res = onAdminSetup
          ? await onAdminSetup({
              name: registerName,
              email: registerEmail,
              password: registerPassword,
              setupKey: adminSetupKey.trim(),
            })
          : await onRegister({
              name: registerName,
              email: registerEmail,
              password: registerPassword,
              setupKey: adminSetupKey.trim(),
              role: 'admin',
            });
        onLoginSuccess(res.user);
        onClose();
        return;
      }

      const res = await onRegister({
        name: registerName,
        email: registerEmail,
        password: registerPassword,
        role,
        referralCode: referralCode.trim() || undefined,
      });
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Demo 1-click login helper
  const handleQuickDemo = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await onLogin(email, 'password123');
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not log in demo account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-[860px] my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 z-50 bg-[#ff2e93] text-white p-2 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer"
          title="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Neon Sliding Container */}
        <div className={`neon-auth-container ${isSignUp ? 'is-signup' : ''}`}>
          {/* Animated Angled Neon Gradient Backdrop */}
          <div className="neon-auth-bg" />

          {/* PANEL 1: Form Login (Left side when login is active) */}
          <div className="neon-auth-panel form-login">
            <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight mb-2 drop-shadow-[0_0_12px_#ff2e93]">
              Login
            </h2>
            <p className="text-xs text-stone-300 mb-6">
              Access your video stays, booking calendar, or host console.
            </p>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="neon-input"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="neon-input"
                  required
                />
              </div>

              {error && (
                <div className="p-2.5 bg-red-950/80 border border-red-500/50 rounded-lg text-xs text-red-200">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="neon-btn w-full text-sm">
                {loading ? 'Signing in...' : 'Login'}
              </button>

              {adminPortalMode && !canRegisterAdmin ? (
                <div className="text-center text-xs text-amber-300/80 mt-4 bg-amber-950/40 border border-amber-800/50 py-1.5 px-3 rounded-xl font-medium">
                  AirBus Administration · Single-Admin Active
                </div>
              ) : adminPortalMode && canRegisterAdmin ? (
                <p className="text-center text-xs text-stone-400 mt-4">
                  First-time platform setup?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setIsSignUp(true);
                    }}
                    className="text-[#22d3ee] font-bold hover:underline cursor-pointer"
                  >
                    Setup Sole Admin Account
                  </button>
                </p>
              ) : (
                <p className="text-center text-xs text-stone-400 mt-4">
                  Don’t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setIsSignUp(true);
                    }}
                    className="text-[#22d3ee] font-bold hover:underline cursor-pointer"
                  >
                    Sign Up
                  </button>
                </p>
              )}
            </form>
          </div>

          {/* PANEL 2: Info Welcome Back (Right side when login is active) */}
          <div className="neon-auth-panel info-login">
            <div className="max-w-[280px]">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold text-white mb-3">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                {adminPortalMode ? 'Admin Portal' : 'AirBus Video Platform'}
              </div>
              <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight mb-3">
                WELCOME BACK!
              </h2>
              <p className="text-xs text-white/90 leading-relaxed font-medium">
                {adminPortalMode
                  ? 'Sign in to access the platform administrative console, approve stays, manage treasury, and inspect audits.'
                  : 'We’re thrilled to have you again. Sign in to reach your personalized trips, video listings, or host management console.'}
              </p>
            </div>
          </div>

          {/* PANEL 3: Info Hello Friend (Left side when register is active) */}
          <div className="neon-auth-panel info-register">
            <div className="max-w-[280px]">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold text-white mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300" />
                {adminPortalMode ? 'Master Account' : 'Join the Network'}
              </div>
              <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight mb-3">
                {adminPortalMode ? 'INITIAL SETUP' : 'HELLO, FRIEND!'}
              </h2>
              <p className="text-xs text-white/90 leading-relaxed font-medium">
                {adminPortalMode
                  ? 'Create the sole administrator account with your secret setup key. Once registered, setup closes permanently.'
                  : 'Join as a guest to book video-first stays with real-time negotiation, or register as a host to monetize your properties across Kenya.'}
              </p>
            </div>
          </div>

          {/* PANEL 4: Form Register (Right side when register is active) */}
          <div className="neon-auth-panel form-register">
            <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight mb-2 drop-shadow-[0_0_12px_#ff2e93]">
              {adminPortalMode ? 'Admin Setup' : 'Register'}
            </h2>

            {/* Role Select Buttons: Hidden in admin mode (strictly single admin); In public mode, only guest & owner */}
            {adminPortalMode ? (
              <div className="mb-3 p-2 rounded-xl bg-amber-950/60 border border-amber-700/60 flex items-center justify-center gap-2 text-amber-300 text-xs font-bold">
                <Shield className="w-4 h-4 text-amber-300" />
                <span>Primary Administrator Provisioning</span>
              </div>
            ) : (
              <div className="flex gap-2 mb-3">
                {(['guest', 'owner'] as UserRole[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 py-1.5 px-2 rounded-full text-xs font-bold transition-all border cursor-pointer capitalize flex items-center justify-center gap-1 ${
                      role === r
                        ? 'bg-[#ff2e93] text-white border-[#ff2e93] shadow-[0_0_12px_#ff2e93]'
                        : 'border-white/20 text-stone-300 hover:border-white/50 bg-black/30'
                    }`}
                  >
                    {r === 'owner' && <UserCheck className="w-3 h-3" />}
                    <span>{r}</span>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-0.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={registerName}
                  onChange={e => setRegisterName(e.target.value)}
                  placeholder="e.g. Administrator Name"
                  className="neon-input text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-0.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={registerEmail}
                  onChange={e => setRegisterEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="neon-input text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-0.5">
                  Password (6+ chars)
                </label>
                <input
                  type="password"
                  value={registerPassword}
                  onChange={e => setRegisterPassword(e.target.value)}
                  placeholder="••••••••"
                  className="neon-input text-xs"
                  required
                />
              </div>

              {adminPortalMode ? (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block mb-0.5 flex items-center justify-between">
                    <span>Admin Setup Key</span>
                    <span className="text-[10px] text-stone-400 lowercase font-normal">(one-time secret)</span>
                  </label>
                  <input
                    type="password"
                    value={adminSetupKey}
                    onChange={e => setAdminSetupKey(e.target.value)}
                    placeholder="Enter ADMIN_SETUP_KEY"
                    className="neon-input text-xs font-mono border-amber-500/50 focus:border-amber-400"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-0.5 flex items-center justify-between">
                    <span>Referral Code</span>
                    <span className="text-[10px] text-cyan-300 font-normal lowercase">(optional · 10% bonus)</span>
                  </label>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={e => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="e.g. REF-VIP77"
                    className="neon-input text-xs uppercase font-mono tracking-wider"
                  />
                </div>
              )}

              {error && (
                <div className="p-2 bg-red-950/80 border border-red-500/50 rounded-lg text-xs text-red-200">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="neon-btn w-full text-xs font-bold py-2.5">
                {loading
                  ? 'Provisioning...'
                  : adminPortalMode
                  ? 'Register Sole Administrator'
                  : `Create ${role.toUpperCase()} Account`}
              </button>

              <p className="text-center text-xs text-stone-400 mt-2">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setIsSignUp(false);
                  }}
                  className="text-[#22d3ee] font-bold hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            </form>
          </div>
        </div>

        {/* Frictionless One-Click Demo Profiles (Shown ONLY on public site, NEVER on admin portal; and NEVER with admin role) */}
        {!adminPortalMode && (
          <div className="mt-4 p-3 bg-stone-900/90 border border-stone-700 rounded-xl backdrop-blur-md text-white shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                1-Click Demo Profiles (instant dashboard switch):
              </span>
              <span className="text-[10px] text-stone-400">Password: password123</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => handleQuickDemo('guest@airbus.ke')}
                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-lg text-left transition-all group cursor-pointer"
              >
                <div className="text-xs font-bold text-white group-hover:text-[#ff2e93] transition-colors flex items-center justify-between">
                  <span>Sarah Wanjiku</span>
                  <span className="text-[10px] bg-stone-700 px-1.5 py-0.5 rounded text-stone-300">GUEST</span>
                </div>
                <div className="text-[11px] text-stone-400 truncate">guest@airbus.ke</div>
                <div className="text-[10px] text-emerald-400 mt-0.5">→ Guest Trips &amp; Wishlist</div>
              </button>

              <button
                onClick={() => handleQuickDemo('owner@airbus.ke')}
                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-lg text-left transition-all group cursor-pointer"
              >
                <div className="text-xs font-bold text-white group-hover:text-[#8b5cf6] transition-colors flex items-center justify-between">
                  <span>David Mutua</span>
                  <span className="text-[10px] bg-stone-700 px-1.5 py-0.5 rounded text-stone-300">OWNER</span>
                </div>
                <div className="text-[11px] text-stone-400 truncate">owner@airbus.ke</div>
                <div className="text-[10px] text-purple-400 mt-0.5">→ Host Listings &amp; Earnings</div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
