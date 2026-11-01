import React, { useState } from 'react';
import { User, Currency } from '../types';
import { api } from '../api';
import {
  X,
  User as UserIcon,
  Lock,
  ShieldCheck,
  Globe,
  Phone,
  MapPin,
  FileText,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdateProfile: (data: Partial<User>) => Promise<void>;
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  showToast?: (msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateProfile,
  currency,
  onCurrencyChange,
  showToast,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'privacy'>('profile');

  // Profile Form State
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [location, setLocation] = useState(user.location || '');
  const [bio, setBio] = useState(user.bio || '');
  const [languages, setLanguages] = useState(user.languages || 'English, Swahili');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await onUpdateProfile({
        name: name.trim(),
        phone: phone.trim(),
        location: location.trim(),
        bio: bio.trim(),
        languages: languages.trim(),
      });
      setProfileMsg('Profile saved successfully!');
      showToast?.('Profile updated successfully!');
      setTimeout(() => setProfileMsg(null), 3000);
    } catch (err: any) {
      setProfileMsg('Error saving profile: ' + (err.message || 'Server error'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setPwError('New password must be different from your current password.');
      return;
    }

    setPwSaving(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setPwSuccess('Password changed successfully! Keep it safe.');
      showToast?.('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(null), 4000);
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 dark:border-stone-800 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 font-mono">
              Account · {user.role.toUpperCase()}
            </span>
            {user.idVerified && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> ID Verified
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold font-heading">Settings &amp; Profile</h2>
          <p className="text-xs text-stone-500">
            Manage your personal profile, security credentials, and private dashboard preferences.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3 mb-5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-xs'
                : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Profile Details</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'security'
                ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-xs'
                : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Change Password</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-xs'
                : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy &amp; Isolation</span>
          </button>
        </div>

        {/* TAB 1: PROFILE DETAILS */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Email Address (Private Login ID)
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={user.email}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs opacity-75 font-mono cursor-not-allowed"
                />
                <Lock className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              <span className="text-[10px] text-stone-400 mt-0.5 block">
                Email is permanently linked to your private wallet and bookings.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Phone Number / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+254 7..."
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Location / City
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. Westlands, Nairobi"
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                About / Bio
              </label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={2}
                placeholder="A short note about yourself or your hosting style..."
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Languages Spoken
              </label>
              <input
                type="text"
                value={languages}
                onChange={e => setLanguages(e.target.value)}
                placeholder="e.g. English, Swahili, French"
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
              />
            </div>

            {profileMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs rounded-xl">
                {profileMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={profileSaving}
              className="w-full py-2.5 bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-900 font-extrabold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {profileSaving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        )}

        {/* TAB 2: SECURITY & CHANGE PASSWORD */}
        {activeTab === 'security' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Unique User Password Protection
              </span>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                Each AirBus account has its own unique password. You can change your password anytime here. Passwords must be at least 6 characters long.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Current Password *
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                New Password (minimum 6 characters) *
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Confirm New Password *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
                required
              />
            </div>

            {pwError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 text-xs rounded-xl flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs rounded-xl flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{pwSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pwSaving}
              className="w-full py-2.5 bg-[#e4002b] hover:bg-[#c90026] text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              {pwSaving ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        )}

        {/* TAB 3: PRIVACY & DASHBOARDS ISOLATION */}
        {activeTab === 'privacy' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Private Dashboards &amp; Wallet Isolation</span>
              </div>
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                AirBus enforces strict data isolation:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-stone-600 dark:text-stone-400">
                <li>
                  <strong>Private Wallets:</strong> Each user has their own independent wallet. Coin balance and ledger history are visible only to you.
                </li>
                <li>
                  <strong>Private Notifications:</strong> Your alerts, booking requests, and negotiation offers are delivered exclusively to your inbox.
                </li>
                <li>
                  <strong>Dashboard Security:</strong> Guests cannot access host studios or admin moderation tools. Each account role is strictly isolated.
                </li>
              </ul>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Display Currency
              </label>
              <div className="flex gap-2">
                {(['KES', 'USD', 'EUR'] as Currency[]).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onCurrencyChange(c)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      currency === c
                        ? 'bg-amber-500 border-amber-500 text-stone-950 font-black shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
