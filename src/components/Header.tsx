import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Compass,
  PlaySquare,
  Sparkles,
  Inbox,
  ShieldCheck,
  Bell,
  User as UserIcon,
  LogOut,
  PlusCircle,
  CreditCard,
  Gift,
  Menu,
  X,
  Settings,
  Heart,
  ChevronDown,
  Search,
} from 'lucide-react';
import { User, Currency } from '../types';

interface HeaderProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  user: User | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onLogout: () => void;
  currency: Currency;
  onCurrencyChange: (cur: Currency) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  guestCount: number;
  onGuestCountChange: (g: number) => void;
  onSearchSubmit: () => void;
  unreadCount: number;
  unreadNotifications: number;
  onOpenNotifications: () => void;
  onOpenTripFinder: () => void;
  onOpenPlans: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onNavigate,
  user,
  onOpenAuth,
  onLogout,
  currency,
  onCurrencyChange,
  searchQuery,
  onSearchChange,
  guestCount,
  onGuestCountChange,
  onSearchSubmit,
  unreadCount,
  unreadNotifications,
  onOpenNotifications,
  onOpenTripFinder,
  onOpenPlans,
  onOpenSettings,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchExpanded, setMobileSearchExpanded] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  // Keyboard navigation for Profile Dropdown (ESC to close, Tab / Arrows)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!profileDropdownOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setProfileDropdownOpen(false);
        profileButtonRef.current?.focus();
      }
    },
    [profileDropdownOpen]
  );

  const handleDashboardClick = () => {
    if (!user) {
      onOpenAuth('login');
      return;
    }
    if (user.role === 'admin') onNavigate('admin');
    else if (user.role === 'owner') onNavigate('owner');
    else onNavigate('guest');
    setProfileDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <header
      className="sticky top-0 z-40 bg-white/95 dark:bg-[#15171e]/95 backdrop-blur-md border-b border-[#e6e6e1] dark:border-[#262934] transition-colors"
      onKeyDown={handleKeyDown}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* ============================================================ */}
        {/* ZONE 1 (LEFT): Logo, Home Pill, Shorts Pill                  */}
        {/* ============================================================ */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Logo with direct link to Home */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="h-8 sm:h-9 rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity flex items-center shrink-0 border border-transparent shadow-xs select-none"
            title="AirBUS - Home"
            aria-label="AirBUS Home"
          >
            <img
              src="/assets/aistudio/22.06.2026_10.38.23_REC_e5adb991.png"
              alt="AirBUS"
              className="h-full w-auto object-contain rounded-lg"
            />
          </button>

          {/* Home Pill */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className={`h-8 sm:h-9 px-3 sm:px-3.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              currentTab === 'home'
                ? 'bg-[#e4002b] text-white shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">Home</span>
          </button>

          {/* Shorts Pill - Equal height/styling, fully visible, no overlap */}
          <button
            type="button"
            onClick={() => onNavigate('shorts')}
            className={`h-8 sm:h-9 px-3 sm:px-3.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              currentTab === 'shorts'
                ? 'bg-[#0a0a0a] text-white shadow-sm dark:bg-white dark:text-black'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            <PlaySquare className="w-3.5 h-3.5 text-[#ff2e93]" />
            <span className="hidden xs:inline sm:inline">Shorts</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* ZONE 2 (CENTRE): Search Bar (Flexible 320px–560px, Truncates) */}
        {/* ============================================================ */}
        <div className="hidden md:flex flex-1 justify-center min-w-[280px] max-w-[560px] mx-2">
          <form
            onSubmit={e => {
              e.preventDefault();
              onSearchSubmit();
            }}
            className="w-full flex items-center bg-stone-50 dark:bg-[#1a1c24] border border-[#e6e6e1] dark:border-[#2a2d3a] rounded-full p-1 pl-3.5 shadow-xs hover:shadow transition-all focus-within:ring-2 focus-within:ring-[#e4002b]/25 focus-within:border-[#e4002b]"
          >
            <Search className="w-3.5 h-3.5 text-stone-400 shrink-0 mr-1.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search Nairobi, Diani, Westlands, villas..."
              className="bg-transparent border-none outline-none text-xs sm:text-sm text-stone-900 dark:text-white flex-1 min-w-[120px] truncate"
            />
            <div className="h-4 w-[1px] bg-stone-200 dark:bg-stone-700 mx-1.5 shrink-0" />
            <div className="flex items-center gap-1 px-1 shrink-0">
              <span className="text-[11px] text-stone-400 font-medium hidden lg:inline">Guests:</span>
              <input
                type="number"
                min="1"
                max="16"
                value={guestCount}
                onChange={e => onGuestCountChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-8 sm:w-9 bg-transparent text-xs text-stone-800 dark:text-stone-200 text-center border-none outline-none font-bold"
                title="Number of guests"
              />
            </div>
            <button
              type="submit"
              className="bg-gradient-to-r from-[#ff2e93] via-[#8b5cf6] to-[#06b6d4] text-white px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold hover:opacity-95 cursor-pointer transition-all shadow-xs active:scale-95 flex items-center gap-1 shrink-0 ml-1"
            >
              <span>Search</span>
            </button>
          </form>
        </div>

        {/* ============================================================ */}
        {/* ZONE 3 (RIGHT): Inbox, Notifications, Admin, Profile Menu    */}
        {/* ============================================================ */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs font-medium shrink-0">
          {/* Mobile Search Toggle Button (< md) */}
          <button
            type="button"
            onClick={() => setMobileSearchExpanded(!mobileSearchExpanded)}
            className="md:hidden p-2 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg cursor-pointer"
            title="Search stays"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Inbox with red unread badge */}
          <button
            type="button"
            onClick={() => onNavigate('inbox')}
            className="relative p-2 text-stone-700 dark:text-stone-300 hover:text-[#e4002b] transition-colors rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            title="Negotiations & Messages"
          >
            <Inbox className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-[#e4002b] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications bell (if user logged in) */}
          {user && (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative p-2 text-stone-700 dark:text-stone-300 hover:text-[#e4002b] transition-colors rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </button>
          )}

          {/* Admin shortcut badge if admin */}
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="hidden sm:flex bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2.5 py-1 rounded-lg font-bold items-center gap-1 hover:bg-amber-200 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}

          {/* Profile Menu Trigger & Dropdown Container (Desktop only: hidden md:block prevents duplicate menu on mobile) */}
          <div className="relative hidden md:block" ref={profileMenuRef}>
            <button
              ref={profileButtonRef}
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              aria-haspopup="menu"
              aria-expanded={profileDropdownOpen}
              className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-full border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 hover:border-stone-400 dark:hover:border-stone-600 transition-all cursor-pointer shadow-2xs"
            >
              <div className="w-6 h-6 rounded-full bg-stone-900 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center font-bold text-[11px]">
                {user ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
              </div>
              <span className="max-w-[75px] sm:max-w-[110px] truncate text-stone-800 dark:text-stone-200 font-semibold text-xs hidden xs:inline">
                {user ? user.name.split(' ')[0] : 'Sign In'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1a1c24] rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs"
              >
                {/* 1. Account Block */}
                {user ? (
                  <div className="px-3.5 py-2.5 bg-stone-50/70 dark:bg-stone-900/50 mx-2 rounded-xl mb-1">
                    <div className="font-bold text-stone-900 dark:text-white truncate">
                      {user.name}
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">{user.email}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e4002b]/10 text-[#e4002b] dark:bg-[#e4002b]/20 uppercase">
                        {user.role} mode
                      </span>
                      {user.role === 'owner' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Host
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleDashboardClick}
                      className="mt-2 w-full text-center py-1.5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Open {user.role === 'admin' ? 'Admin Panel' : user.role === 'owner' ? 'Owner Hub' : 'Guest Dashboard'}
                    </button>
                  </div>
                ) : (
                  <div className="px-3 py-2 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenAuth('login');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-center py-1.5 bg-[#e4002b] text-white rounded-xl font-bold hover:bg-[#c90026] transition-colors cursor-pointer"
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenAuth('register');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-center py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-semibold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                    >
                      Create Account
                    </button>
                  </div>
                )}

                <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />

                {/* 2. Quick Links (All same font weight) */}
                <div className="px-1 py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenTripFinder();
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer font-medium text-left"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Trip Finder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('trip-dating');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer font-medium text-left"
                  >
                    <Heart className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Trip Dating</span>
                  </button>

                  {(!user || user.role === 'owner') && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) onOpenAuth('register');
                        else onNavigate('owner');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer font-medium text-left"
                    >
                      <PlusCircle className="w-4 h-4 text-[#e4002b] shrink-0" />
                      <span>{user?.role === 'owner' ? 'Owner Hub' : 'Become a host'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onOpenPlans();
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer font-medium text-left"
                  >
                    <CreditCard className="w-4 h-4 text-stone-400 shrink-0" />
                    <span>Plans</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('earn');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer font-medium text-left"
                  >
                    <Gift className="w-4 h-4 text-[#ff2e93] shrink-0" />
                    <span>Earn 10%</span>
                  </button>
                </div>

                <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />

                {/* 3. Currency Selector Row */}
                <div className="px-3.5 py-2 flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Currency</span>
                  <select
                    value={currency}
                    onChange={e => onCurrencyChange(e.target.value as Currency)}
                    className="bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-semibold px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 outline-none text-xs cursor-pointer hover:border-stone-400"
                    title="Select display currency"
                  >
                    <option value="KES">KES (KSh)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                {/* 4. Settings & Log Out (if logged in) */}
                {user && (
                  <>
                    <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />
                    <div className="px-1 py-1 space-y-0.5">
                      {onOpenSettings && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenSettings();
                            setProfileDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer font-medium text-left"
                        >
                          <Settings className="w-4 h-4 text-stone-400 shrink-0" />
                          <span>Settings & Profile</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onLogout();
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer font-medium text-left"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span>Log out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Mobile hamburger menu toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Expandable Search Bar */}
      {mobileSearchExpanded && (
        <div className="md:hidden px-3 py-2 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#1a1c24] animate-in slide-in-from-top-1 duration-150">
          <form
            onSubmit={e => {
              e.preventDefault();
              onSearchSubmit();
              setMobileSearchExpanded(false);
            }}
            className="flex items-center bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-700 rounded-full p-1 pl-3 shadow-xs"
          >
            <Search className="w-3.5 h-3.5 text-stone-400 shrink-0 mr-1.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search destination, Nairobi..."
              className="bg-transparent border-none outline-none text-xs text-stone-900 dark:text-white flex-1 min-w-0"
              autoFocus
            />
            <div className="flex items-center gap-1 px-1 shrink-0">
              <span className="text-[10px] text-stone-400 font-medium">Guests:</span>
              <input
                type="number"
                min="1"
                max="16"
                value={guestCount}
                onChange={e => onGuestCountChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-7 bg-transparent text-xs text-stone-800 dark:text-stone-200 text-center font-bold"
              />
            </div>
            <button
              type="submit"
              className="bg-gradient-to-r from-[#ff2e93] via-[#8b5cf6] to-[#06b6d4] text-white px-3 py-1 rounded-full text-xs font-bold shrink-0"
            >
              Go
            </button>
          </form>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 py-3 bg-white dark:bg-[#15171e] border-t border-stone-200 dark:border-stone-800 flex flex-col gap-2.5 text-sm animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
            <span className="text-xs text-stone-500 font-medium">Account & Navigation</span>
            <span className="text-xs font-bold text-[#e4002b]">
              {user ? `${user.role.toUpperCase()} MODE` : 'GUEST'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              onNavigate('home');
              setMobileMenuOpen(false);
            }}
            className={`text-left py-1.5 flex items-center gap-2 font-medium ${
              currentTab === 'home' ? 'text-[#e4002b] font-bold' : 'text-stone-800 dark:text-stone-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate('shorts');
              setMobileMenuOpen(false);
            }}
            className={`text-left py-1.5 flex items-center gap-2 font-medium ${
              currentTab === 'shorts' ? 'text-[#e4002b] font-bold' : 'text-stone-800 dark:text-stone-200'
            }`}
          >
            <PlaySquare className="w-4 h-4 text-[#ff2e93]" />
            <span>Shorts Reels</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenTripFinder();
              setMobileMenuOpen(false);
            }}
            className="text-left py-1.5 text-stone-800 dark:text-stone-200 font-medium flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI Trip Finder</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate('trip-dating');
              setMobileMenuOpen(false);
            }}
            className="text-left py-1.5 text-stone-800 dark:text-stone-200 font-medium flex items-center gap-2"
          >
            <Heart className="w-4 h-4 text-rose-500" />
            <span>Trip Dating (Near You)</span>
          </button>

          {(!user || user.role === 'owner') && (
            <button
              type="button"
              onClick={() => {
                if (!user) onOpenAuth('register');
                else onNavigate('owner');
                setMobileMenuOpen(false);
              }}
              className="text-left py-1.5 text-stone-800 dark:text-stone-200 font-medium flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-[#e4002b]" />
              <span>{user?.role === 'owner' ? 'Owner Hub' : 'Become a host'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onOpenPlans();
              setMobileMenuOpen(false);
            }}
            className="text-left py-1.5 text-stone-800 dark:text-stone-200 font-medium flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4 text-stone-400" />
            <span>Plans</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate('earn');
              setMobileMenuOpen(false);
            }}
            className="text-left py-1.5 text-stone-800 dark:text-stone-200 font-medium flex items-center gap-2"
          >
            <Gift className="w-4 h-4 text-[#ff2e93]" />
            <span>Earn 10% (Affiliate)</span>
          </button>

          <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />

          {/* Currency picker on mobile */}
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-stone-500">Currency</span>
            <select
              value={currency}
              onChange={e => onCurrencyChange(e.target.value as Currency)}
              className="bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-semibold px-2.5 py-1 rounded-lg text-xs"
            >
              <option value="KES">KES (KSh)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>

          <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />

          {/* User profile action on mobile */}
          {user ? (
            <>
              <button
                type="button"
                onClick={handleDashboardClick}
                className="text-left py-1.5 text-stone-800 dark:text-stone-200 font-medium flex items-center gap-2"
              >
                <UserIcon className="w-4 h-4" />
                <span>Open Dashboard ({user.role})</span>
              </button>
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenSettings();
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 text-stone-800 dark:text-stone-200 font-medium flex items-center gap-2"
                >
                  <Settings className="w-4 h-4 text-stone-400" />
                  <span>Settings & Profile</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  setMobileMenuOpen(false);
                }}
                className="text-left py-1.5 text-rose-600 dark:text-rose-400 font-medium flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                onOpenAuth('login');
                setMobileMenuOpen(false);
              }}
              className="w-full text-center py-2 bg-[#e4002b] text-white rounded-xl font-bold"
            >
              Sign In / Register
            </button>
          )}
        </div>
      )}
    </header>
  );
};
