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
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onLoginSuccess,
  onLogin,
  onRegister,
}) => {
  const [isSignUp, setIsSignUp] = useState(initialMode === 'register');
  const [role, setRole] = useState<UserRole>('guest');

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
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
            </form>
          </div>

          {/* PANEL 2: Info Welcome Back (Right side when login is active) */}
          <div className="neon-auth-panel info-login">
            <div className="max-w-[280px]">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold text-white mb-3">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                AirBus Video Platform
              </div>
              <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight mb-3">
                WELCOME BACK!
              </h2>
              <p className="text-xs text-white/90 leading-relaxed font-medium">
                We’re thrilled to have you again. Sign in to reach your personalized trips, video listings, or host management console.
              </p>
            </div>
          </div>

          {/* PANEL 3: Info Hello Friend (Left side when register is active) */}
          <div className="neon-auth-panel info-register">
            <div className="max-w-[280px]">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold text-white mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300" />
                Join the Network
              </div>
              <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight mb-3">
                HELLO, FRIEND!
              </h2>
              <p className="text-xs text-white/90 leading-relaxed font-medium">
                Join as a guest to book video-first stays with real-time negotiation, or register as a host to monetize your properties across Kenya.
              </p>
            </div>
          </div>

          {/* PANEL 4: Form Register (Right side when register is active) */}
          <div className="neon-auth-panel form-register">
            <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight mb-2 drop-shadow-[0_0_12px_#ff2e93]">
              Register
            </h2>

            {/* Role Select Buttons (Guest, Owner, Admin) */}
            <div className="flex gap-2 mb-3">
              {(['guest', 'owner', 'admin'] as UserRole[]).map(r => (
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
                  {r === 'admin' && <Shield className="w-3 h-3 text-amber-300" />}
                  {r === 'owner' && <UserCheck className="w-3 h-3" />}
                  <span>{r}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-0.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={registerName}
                  onChange={e => setRegisterName(e.target.value)}
                  placeholder="e.g. Joy Kimani"
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
                  placeholder="name@example.com"
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

              {error && (
                <div className="p-2 bg-red-950/80 border border-red-500/50 rounded-lg text-xs text-red-200">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="neon-btn w-full text-xs font-bold py-2.5">
                {loading ? 'Creating account...' : `Create ${role.toUpperCase()} Account`}
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

        {/* Frictionless One-Click Demo Profiles */}
        <div className="mt-4 p-3 bg-stone-900/90 border border-stone-700 rounded-xl backdrop-blur-md text-white shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              1-Click Demo Profiles (instant dashboard switch):
            </span>
            <span className="text-[10px] text-stone-400">Password: password123</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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

            <button
              onClick={() => handleQuickDemo('admin@airbus.ke')}
              className="px-3 py-2 bg-stone-800 hover:bg-stone-700 border border-amber-600/60 rounded-lg text-left transition-all group cursor-pointer"
            >
              <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors flex items-center justify-between">
                <span>Alex Kamau</span>
                <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-700">ADMIN</span>
              </div>
              <div className="text-[11px] text-stone-400 truncate">admin@airbus.ke</div>
              <div className="text-[10px] text-amber-300 mt-0.5">→ Platform Verifications</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
