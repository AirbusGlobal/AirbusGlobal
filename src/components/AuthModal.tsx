import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  UserCheck,
  Shield,
  Key,
  RotateCcw,
  User as UserIcon,
  Building2,
  ArrowLeft,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { User } from '../types';
import { api } from '../api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'reset-password';
  initialPortal?: 'guest' | 'owner' | null;
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
  initialPortal = null,
  onLoginSuccess,
  onLogin,
  onRegister,
  adminPortalMode = false,
  canRegisterAdmin = false,
  onAdminSetup,
}) => {
  const effectiveInitialSignUp = adminPortalMode
    ? canRegisterAdmin && initialMode === 'register'
    : initialMode === 'register';

  const [isSignUp, setIsSignUp] = useState(effectiveInitialSignUp);

  // Public dual-portal selector: Guest vs Host
  const [selectedPortal, setSelectedPortal] = useState<'guest' | 'owner' | null>(
    adminPortalMode ? null : initialPortal || null
  );
  const [registerPortal, setRegisterPortal] = useState<'guest' | 'owner'>(
    initialPortal === 'owner' ? 'owner' : 'guest'
  );

  // Public Login state (strictly exact username + password)
  const [loginUsername, setLoginUsername] = useState('');
  const [loginEmail, setLoginEmail] = useState(adminPortalMode ? 'kamalahari93@gmail.com' : '');
  const [loginPassword, setLoginPassword] = useState('');

  // Public 3-failed-attempts Recovery state (Forgot Password or Forgot Username)
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<'none' | 'password' | 'username'>('none');
  const [recCurrentUsername, setRecCurrentUsername] = useState('');
  const [recNewPassword, setRecNewPassword] = useState('');
  const [recCurrentPassword, setRecCurrentPassword] = useState('');
  const [recNewUsername, setRecNewUsername] = useState('');

  // Admin Reset Password State
  const [isResetMode, setIsResetMode] = useState(initialMode === 'reset-password');
  const [resetEmail, setResetEmail] = useState(adminPortalMode ? 'kamalahari93@gmail.com' : '');
  const [resetSetupKey, setResetSetupKey] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Sign-Up State (Public collects username & password only; Admin setup collects full details)
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
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

  useEffect(() => {
    if (isOpen) {
      if (initialMode === 'reset-password') {
        setIsResetMode(true);
        setIsSignUp(false);
      } else if (initialMode === 'register' && (!adminPortalMode || canRegisterAdmin)) {
        setIsSignUp(true);
        setIsResetMode(false);
      } else {
        setIsSignUp(false);
        setIsResetMode(false);
      }
      if (adminPortalMode) {
        setLoginEmail('kamalahari93@gmail.com');
        setResetEmail('kamalahari93@gmail.com');
        setSelectedPortal(null);
      } else {
        setSelectedPortal(initialPortal || null);
        setRegisterPortal(initialPortal === 'owner' ? 'owner' : 'guest');
      }
      setLoginUsername('');
      setLoginPassword('');
      setFailedAttempts(0);
      setShowRecoveryPrompt(false);
      setRecoveryMode('none');
      setRecCurrentUsername('');
      setRecNewPassword('');
      setRecCurrentPassword('');
      setRecNewUsername('');
      setError(null);
      setResetSuccess(null);
      setRegisterConfirmPassword('');
      setShowRegisterPassword(false);
      setShowRegisterConfirmPassword(false);
    }
  }, [isOpen, initialMode, initialPortal, adminPortalMode, canRegisterAdmin]);

  if (!isOpen) return null;

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSuccess(null);

    if (!resetEmail || !resetSetupKey || !resetNewPassword) {
      setError('Please provide your admin email, master setup key, and new password.');
      return;
    }
    if (resetNewPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.resetAdminPassword({
        email: resetEmail.trim(),
        setupKey: resetSetupKey.trim(),
        newPassword: resetNewPassword,
      });
      setResetSuccess('Password reset successfully! Logging in...');
      setTimeout(() => {
        onLoginSuccess(res.user);
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Failed to reset admin password. Check your email and setup key.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (adminPortalMode) {
      if (!loginEmail || !loginPassword) {
        setError('Please provide your email and password.');
        return;
      }
      setLoading(true);
      try {
        const res = await onLogin(loginEmail, loginPassword);
        if (res.user.role !== 'admin') {
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
      return;
    }

    if (!selectedPortal) {
      setError('Please select Login to Guest or Login to Host first.');
      return;
    }

    // Preserve exact username & password (no .trim() or .toLowerCase()) for exact case/punctuation matching
    if (!loginUsername || !loginPassword) {
      setError('Please enter your exact username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.loginPortal(selectedPortal, loginUsername, loginPassword);
      setFailedAttempts(0);
      setShowRecoveryPrompt(false);
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      const nextCount = typeof err.failedAttempts === 'number' ? err.failedAttempts : failedAttempts + 1;
      setFailedAttempts(nextCount);
      if (nextCount >= 3 || err.showRecovery) {
        setShowRecoveryPrompt(true);
      }
      setError(err.message || 'Invalid username or password (check exact capitalization and punctuation).');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortal || recoveryMode === 'none') return;
    setError(null);

    if (recoveryMode === 'password') {
      if (!recCurrentUsername || !recNewPassword || recNewPassword.length < 6) {
        setError('Enter your exact current username and a new password (at least 6 characters).');
        return;
      }
    } else if (recoveryMode === 'username') {
      if (!recCurrentPassword || !recNewUsername.trim()) {
        setError('Enter your current password and choose a new unique username.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await api.recoverCredential({
        portal: selectedPortal,
        mode: recoveryMode,
        currentUsername: recCurrentUsername,
        newPassword: recNewPassword,
        currentPassword: recCurrentPassword,
        newUsername: recNewUsername,
      });
      setFailedAttempts(0);
      setShowRecoveryPrompt(false);
      setRecoveryMode('none');
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not recover credentials. Please check your input.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (adminPortalMode) {
      if (!registerName || !registerEmail || !registerPassword) {
        setError('Please fill in all registration fields.');
        return;
      }
      if (registerPassword.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (registerPassword !== registerConfirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!canRegisterAdmin) {
        setError('Admin registration is closed.');
        return;
      }
      if (!adminSetupKey.trim()) {
        setError('Admin Setup Key is required.');
        return;
      }
      setLoading(true);
      try {
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
      } catch (err: any) {
        setError(err.message || 'Admin registration failed.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Public Sign-Up: Username + Password only
    if (!registerUsername.trim() || !registerPassword) {
      setError('Please choose a unique username and password.');
      return;
    }
    if (registerPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.registerPortal({
        portal: registerPortal,
        username: registerUsername.trim(),
        password: registerPassword,
        referredByCode: referralCode.trim() || undefined,
      });
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Demo 1-click login helper (uses strictly isolated Guest or Host credentials)
  const handleQuickDemo = async (portal: 'guest' | 'owner', username: string, password: string) => {
    setLoading(true);
    setError(null);
    setSelectedPortal(portal);
    try {
      const res = await api.loginPortal(portal, username, password);
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
      <div className="relative w-full max-w-[880px] my-auto">
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

          {/* PANEL 1: Form Login / Portal Entrance / Recovery */}
          <div className="neon-auth-panel form-login overflow-y-auto max-h-[82vh]">
            {isResetMode ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <RotateCcw className="w-5 h-5 text-[#ff2e93]" />
                  <h2 className="text-2xl font-extrabold font-heading text-white tracking-tight drop-shadow-[0_0_12px_#ff2e93]">
                    Reset Password
                  </h2>
                </div>
                <p className="text-xs text-stone-300 mb-4">
                  Enter your admin email, master setup key, and choose your new password.
                </p>

                <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                      Admin Email Address
                    </label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="kamalahari93@gmail.com"
                      className="neon-input"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                      Master Setup / Recovery Key
                    </label>
                    <input
                      type="password"
                      value={resetSetupKey}
                      onChange={e => setResetSetupKey(e.target.value)}
                      placeholder="Enter master setup key"
                      className="neon-input"
                      required
                    />
                    <span className="text-[10px] text-stone-400 mt-1 block">
                      Default setup key is <code className="text-[#22d3ee] font-mono">airbus-setup-2026</code>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={resetNewPassword}
                        onChange={e => setResetNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="neon-input"
                        required
                        minLength={6}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={resetConfirmPassword}
                        onChange={e => setResetConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="neon-input"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-2.5 bg-red-950/80 border border-red-500/50 rounded-lg text-xs text-red-200">
                      {error}
                    </div>
                  )}

                  {resetSuccess && (
                    <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-lg text-xs text-emerald-200">
                      {resetSuccess}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="neon-btn w-full text-sm">
                    {loading ? 'Resetting & Authenticating...' : 'Reset Password & Sign In'}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setResetSuccess(null);
                        setIsResetMode(false);
                      }}
                      className="text-xs text-stone-400 hover:text-white transition-colors cursor-pointer"
                    >
                      ← Back to Admin Login
                    </button>
                  </div>
                </form>
              </div>
            ) : adminPortalMode ? (
              <div>
                <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight mb-2 drop-shadow-[0_0_12px_#ff2e93]">
                  Admin Login
                </h2>
                <p className="text-xs text-stone-300 mb-6">
                  Access the AirBus Administrative Control Portal
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setResetSuccess(null);
                          setIsResetMode(true);
                        }}
                        className="text-[11px] text-[#22d3ee] hover:underline font-semibold cursor-pointer"
                      >
                        Forgot / Reset Password?
                      </button>
                    </div>
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

                  {!canRegisterAdmin ? (
                    <div className="space-y-2 mt-4 text-center">
                      <div className="text-xs text-amber-300/80 bg-amber-950/40 border border-amber-800/50 py-1.5 px-3 rounded-xl font-medium">
                        AirBus Administration · Single-Admin Active
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setResetSuccess(null);
                          setIsResetMode(true);
                        }}
                        className="text-xs text-stone-400 hover:text-white underline cursor-pointer"
                      >
                        Need to reset admin password? Click here
                      </button>
                    </div>
                  ) : (
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
                  )}
                </form>
              </div>
            ) : !selectedPortal ? (
              /* STEP 1: TWO DISTINCT ENTRANCES (Login to Guest vs Login to Host) */
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-white tracking-tight mb-1.5 drop-shadow-[0_0_12px_#ff2e93]">
                    Choose Login Entrance
                  </h2>
                  <p className="text-xs text-stone-300">
                    Guest and Host accounts are strictly separate. Select which dashboard you are signing into:
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPortal('guest');
                      setFailedAttempts(0);
                      setShowRecoveryPrompt(false);
                      setRecoveryMode('none');
                      setError(null);
                    }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#22d3ee]/15 to-cyan-950/50 hover:from-[#22d3ee]/25 hover:to-cyan-900/60 border border-[#22d3ee]/50 text-left transition-all cursor-pointer group flex items-center gap-3.5"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#22d3ee]/20 text-[#22d3ee] flex items-center justify-center shrink-0">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-extrabold text-white group-hover:text-[#22d3ee] transition-colors">
                        Login to Guest
                      </div>
                      <div className="text-[11px] text-stone-300">
                        Book video stays, manage Guest Wallet &amp; trips
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPortal('owner');
                      setFailedAttempts(0);
                      setShowRecoveryPrompt(false);
                      setRecoveryMode('none');
                      setError(null);
                    }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#ff2e93]/15 to-purple-950/50 hover:from-[#ff2e93]/25 hover:to-purple-900/60 border border-[#ff2e93]/50 text-left transition-all cursor-pointer group flex items-center gap-3.5"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#ff2e93]/20 text-[#ff2e93] flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-extrabold text-white group-hover:text-[#ff2e93] transition-colors">
                        Login to Host
                      </div>
                      <div className="text-[11px] text-stone-300">
                        Manage property listings, subscriptions &amp; Host earnings
                      </div>
                    </div>
                  </button>
                </div>

                <p className="text-center text-xs text-stone-400 pt-2">
                  New to AirBus?{' '}
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
              </div>
            ) : recoveryMode !== 'none' ? (
              /* RECOVERY FLOW: Forgot Password OR Forgot Username */
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryMode('none');
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-stone-300 hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to {selectedPortal === 'owner' ? 'Host' : 'Guest'} Login</span>
                </button>

                <div className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-[#22d3ee]" />
                  <h2 className="text-xl font-extrabold font-heading text-white tracking-tight">
                    {recoveryMode === 'password' ? 'Reset Password' : 'Reset Username'}
                  </h2>
                </div>
                <p className="text-xs text-stone-300">
                  {recoveryMode === 'password'
                    ? `Enter your exact ${selectedPortal === 'owner' ? 'Host' : 'Guest'} username to set a new unique password and sign in.`
                    : `Enter your exact ${selectedPortal === 'owner' ? 'Host' : 'Guest'} password to set a new unique username and sign in.`}
                </p>

                <form onSubmit={handleRecoverySubmit} className="space-y-3">
                  {recoveryMode === 'password' ? (
                    <>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                          Exact Current Username
                        </label>
                        <input
                          type="text"
                          value={recCurrentUsername}
                          onChange={e => setRecCurrentUsername(e.target.value)}
                          placeholder="Exact case & punctuation"
                          className="neon-input text-xs"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                          New Unique Password (6+ chars)
                        </label>
                        <input
                          type="password"
                          value={recNewPassword}
                          onChange={e => setRecNewPassword(e.target.value)}
                          placeholder="Choose a unique password"
                          className="neon-input text-xs"
                          required
                          minLength={6}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                          Exact Current Password
                        </label>
                        <input
                          type="password"
                          value={recCurrentPassword}
                          onChange={e => setRecCurrentPassword(e.target.value)}
                          placeholder="Exact case & punctuation"
                          className="neon-input text-xs"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                          New Unique Username
                        </label>
                        <input
                          type="text"
                          value={recNewUsername}
                          onChange={e => setRecNewUsername(e.target.value)}
                          placeholder="Choose a unique username"
                          className="neon-input text-xs"
                          required
                        />
                      </div>
                    </>
                  )}

                  {error && (
                    <div className="p-2.5 bg-red-950/80 border border-red-500/50 rounded-lg text-xs text-red-200">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="neon-btn w-full text-xs font-bold py-2.5">
                    {loading ? 'Updating & Signing In...' : 'Update & Sign In'}
                  </button>
                </form>
              </div>
            ) : (
              /* STEP 2: SELECTED PORTAL LOGIN FORM (Guest Login OR Host Login) */
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                      selectedPortal === 'owner'
                        ? 'bg-[#ff2e93]/20 text-[#ff2e93] border-[#ff2e93]/40'
                        : 'bg-[#22d3ee]/20 text-[#22d3ee] border-[#22d3ee]/40'
                    }`}
                  >
                    {selectedPortal === 'owner' ? 'Host Entrance' : 'Guest Entrance'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPortal(null);
                      setFailedAttempts(0);
                      setShowRecoveryPrompt(false);
                      setError(null);
                    }}
                    className="text-[11px] text-stone-400 hover:text-white underline cursor-pointer"
                  >
                    Switch Entrance
                  </button>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-white tracking-tight mb-1 drop-shadow-[0_0_12px_#ff2e93]">
                  {selectedPortal === 'owner' ? 'Host Login' : 'Guest Login'}
                </h2>
                <p className="text-[11px] text-stone-300 mb-4">
                  {selectedPortal === 'owner'
                    ? 'Authenticates against Host credentials only & opens Host Dashboard.'
                    : 'Authenticates against Guest credentials only & opens Guest Dashboard.'}
                </p>

                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                      Username (Exact Case &amp; Punctuation)
                    </label>
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={e => setLoginUsername(e.target.value)}
                      placeholder={selectedPortal === 'owner' ? 'e.g. DavidMutua' : 'e.g. SarahWanjiku'}
                      className="neon-input"
                      autoComplete="username"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                      Password (Exact Case &amp; Punctuation)
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="neon-input"
                      autoComplete="current-password"
                      required
                    />
                  </div>

                  {error && (
                    <div className="p-2.5 bg-red-950/80 border border-red-500/50 rounded-lg text-xs text-red-200">
                      {error}
                    </div>
                  )}

                  {/* Recovery prompt after 3 failed attempts */}
                  {showRecoveryPrompt && (
                    <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-500/60 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Need help signing in? ({failedAttempts} failed attempts)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setRecoveryMode('password');
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs cursor-pointer transition-colors"
                        >
                          Forgot Password
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setRecoveryMode('username');
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-white border border-stone-600 font-bold text-xs cursor-pointer transition-colors"
                        >
                          Forgot Username
                        </button>
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="neon-btn w-full text-sm">
                    {loading
                      ? 'Authenticating...'
                      : selectedPortal === 'owner'
                      ? 'Login to Host'
                      : 'Login to Guest'}
                  </button>

                  <p className="text-center text-xs text-stone-400 mt-3">
                    Need a {selectedPortal === 'owner' ? 'Host' : 'Guest'} account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setRegisterPortal(selectedPortal);
                        setIsSignUp(true);
                      }}
                      className="text-[#22d3ee] font-bold hover:underline cursor-pointer"
                    >
                      Sign Up as {selectedPortal === 'owner' ? 'Host' : 'Guest'}
                    </button>
                  </p>
                </form>
              </div>
            )}
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
                  : 'Choose Login to Guest or Login to Host. Guest and Host portals have isolated credentials and private wallets.'}
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
                  : 'Create a Guest or Host account with a unique username and unique password. Your username and password are case- and punctuation-sensitive.'}
              </p>
            </div>
          </div>

          {/* PANEL 4: Form Register (Right side when register is active) */}
          <div className="neon-auth-panel form-register overflow-y-auto max-h-[82vh]">
            <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight mb-2 drop-shadow-[0_0_12px_#ff2e93]">
              {adminPortalMode ? 'Admin Setup' : 'Sign Up'}
            </h2>

            {adminPortalMode ? (
              <div className="mb-3 p-2 rounded-xl bg-amber-950/60 border border-amber-700/60 flex items-center justify-center gap-2 text-amber-300 text-xs font-bold">
                <Shield className="w-4 h-4 text-amber-300" />
                <span>Primary Administrator Provisioning</span>
              </div>
            ) : (
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setRegisterPortal('guest')}
                  className={`flex-1 py-1.5 px-2 rounded-full text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1 ${
                    registerPortal === 'guest'
                      ? 'bg-[#22d3ee] text-stone-950 border-[#22d3ee] shadow-[0_0_12px_#22d3ee]'
                      : 'border-white/20 text-stone-300 hover:border-white/50 bg-black/30'
                  }`}
                >
                  <UserIcon className="w-3 h-3" />
                  <span>Guest Sign Up</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegisterPortal('owner')}
                  className={`flex-1 py-1.5 px-2 rounded-full text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1 ${
                    registerPortal === 'owner'
                      ? 'bg-[#ff2e93] text-white border-[#ff2e93] shadow-[0_0_12px_#ff2e93]'
                      : 'border-white/20 text-stone-300 hover:border-white/50 bg-black/30'
                  }`}
                >
                  <UserCheck className="w-3 h-3" />
                  <span>Host Sign Up</span>
                </button>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              {adminPortalMode ? (
                <>
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
                </>
              ) : (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-0.5">
                    Username (Unique Across AirBus)
                  </label>
                  <input
                    type="text"
                    value={registerUsername}
                    onChange={e => setRegisterUsername(e.target.value)}
                    placeholder="Choose a unique username"
                    className="neon-input text-xs"
                    autoComplete="username"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-0.5">
                  Password (Unique · 6+ chars)
                </label>
                <div className="relative">
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerPassword}
                    onChange={e => setRegisterPassword(e.target.value)}
                    placeholder="••••••••"
                    className="neon-input text-xs pr-10"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 cursor-pointer"
                    aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                  >
                    {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-0.5">
                  Repeat Password
                </label>
                <div className="relative">
                  <input
                    type={showRegisterConfirmPassword ? 'text' : 'password'}
                    value={registerConfirmPassword}
                    onChange={e => setRegisterConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="neon-input text-xs pr-10"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterConfirmPassword(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 cursor-pointer"
                    aria-label={showRegisterConfirmPassword ? 'Hide repeat password' : 'Show repeat password'}
                  >
                    {showRegisterConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
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
                  ? 'Creating Account...'
                  : adminPortalMode
                  ? 'Register Sole Administrator'
                  : `Create ${registerPortal === 'owner' ? 'Host' : 'Guest'} Account`}
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
                  Login
                </button>
              </p>
            </form>
          </div>
        </div>

        {/* Frictionless One-Click Demo Profiles (Shown ONLY on public site, NEVER on admin portal) */}
        {!adminPortalMode && (
          <div className="mt-4 p-3 bg-stone-900/90 border border-stone-700 rounded-xl backdrop-blur-md text-white shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                1-Click Demo Entrances (Separate Guest &amp; Host Credentials):
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('guest', 'SarahWanjiku', 'Sarah$Nairobi88!')}
                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-lg text-left transition-all group cursor-pointer"
              >
                <div className="text-xs font-bold text-white group-hover:text-[#22d3ee] transition-colors flex items-center justify-between">
                  <span>Login to Guest · SarahWanjiku</span>
                  <span className="text-[10px] bg-cyan-950/80 border border-cyan-500/40 px-1.5 py-0.5 rounded text-cyan-300">
                    GUEST
                  </span>
                </div>
                <div className="text-[10px] text-emerald-400 mt-0.5">→ Opens Guest Dashboard &amp; Wallet</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('owner', 'DavidMutua', 'Mutua@Westlands91#')}
                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-lg text-left transition-all group cursor-pointer"
              >
                <div className="text-xs font-bold text-white group-hover:text-[#ff2e93] transition-colors flex items-center justify-between">
                  <span>Login to Host · DavidMutua</span>
                  <span className="text-[10px] bg-pink-950/80 border border-pink-500/40 px-1.5 py-0.5 rounded text-pink-300">
                    HOST
                  </span>
                </div>
                <div className="text-[10px] text-purple-400 mt-0.5">→ Opens Host Dashboard &amp; Listings</div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
