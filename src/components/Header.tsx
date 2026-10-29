import React from 'react';
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
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleDashboardClick = () => {
    if (!user) {
      onOpenAuth('login');
      return;
    }
    if (user.role === 'admin') onNavigate('admin');
    else if (user.role === 'owner') onNavigate('owner');
    else onNavigate('guest');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#15171e]/95 backdrop-blur-md border-b border-[#e6e6e1] dark:border-[#262934] transition-colors">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap md:flex-nowrap">
        {/* Left: Brand & Feed/Shorts Toggles */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            onClick={() => onNavigate('home')}
            className="bg-[#e4002b] text-white font-extrabold tracking-tight px-3 py-1.5 rounded-lg text-base cursor-pointer hover:bg-[#c90026] transition-all shadow-sm flex items-center gap-1.5 select-none"
          >
            <span className="font-heading tracking-wider">AIRBUS</span>
          </div>

          <button
            onClick={() => onNavigate('home')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              currentTab === 'home'
                ? 'bg-[#e4002b] text-white shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Feed</span>
          </button>

          <button
            onClick={() => onNavigate('shorts')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              currentTab === 'shorts'
                ? 'bg-[#0a0a0a] text-white shadow-sm dark:bg-white dark:text-black'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            <PlaySquare className="w-3.5 h-3.5 text-[#ff2e93]" />
            <span>Shorts</span>
          </button>
        </div>

        {/* Center: Search Capsule */}
        <div className="order-3 md:order-2 w-full md:w-auto flex-1 max-w-md mx-auto">
          <form
            onSubmit={e => {
              e.preventDefault();
              onSearchSubmit();
            }}
            className="flex items-center bg-stone-50 dark:bg-[#1a1c24] border border-[#e6e6e1] dark:border-[#2a2d3a] rounded-full p-1 pl-4 shadow-sm hover:shadow transition-all focus-within:ring-2 focus-within:ring-[#e4002b]/20 focus-within:border-[#e4002b]"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search Nairobi, Diani, Westlands..."
              className="bg-transparent border-none outline-none text-xs sm:text-sm text-stone-900 dark:text-white flex-1 min-w-[110px]"
            />
            <div className="h-4 w-[1px] bg-stone-200 dark:bg-stone-700 mx-1.5" />
            <div className="flex items-center gap-1 px-1">
              <span className="text-[11px] text-stone-400 font-medium hidden sm:inline">Guests:</span>
              <input
                type="number"
                min="1"
                max="16"
                value={guestCount}
                onChange={e => onGuestCountChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-8 sm:w-10 bg-transparent text-xs text-stone-800 dark:text-stone-200 text-center border-none outline-none font-semibold"
                title="Number of guests"
              />
            </div>
            <button
              type="submit"
              className="bg-gradient-to-r from-[#ff2e93] via-[#8b5cf6] to-[#06b6d4] text-white px-3.5 py-1.5 rounded-full text-xs font-bold hover:opacity-95 cursor-pointer transition-all shadow-sm active:scale-95 flex items-center gap-1"
            >
              <span>Search</span>
            </button>
          </form>
        </div>

        {/* Right Nav */}
        <div className="order-2 md:order-3 flex items-center gap-2 sm:gap-3 text-xs font-medium">
          {/* Currency dropdown */}
          <select
            value={currency}
            onChange={e => onCurrencyChange(e.target.value as Currency)}
            className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold px-2 py-1 rounded-md border border-stone-200 dark:border-stone-700 outline-none text-xs cursor-pointer hover:border-stone-400"
            title="Display currency"
          >
            <option value="KES">KES (KSh)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>

          {/* Trip Finder */}
          <button
            onClick={onOpenTripFinder}
            className="hidden lg:flex items-center gap-1 text-stone-700 dark:text-stone-300 hover:text-[#e4002b] transition-colors py-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Trip finder</span>
          </button>

          {/* Become Host / Plans */}
          {(!user || user.role === 'owner') && (
            <button
              onClick={() => {
                if (!user) onOpenAuth('register');
                else onNavigate('owner');
              }}
              className="hidden sm:flex items-center gap-1 text-stone-700 dark:text-stone-300 hover:text-[#e4002b] transition-colors py-1"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#e4002b]" />
              <span>{user?.role === 'owner' ? 'Owner Hub' : 'Become a host'}</span>
            </button>
          )}

          <button
            onClick={onOpenPlans}
            className="hidden sm:flex items-center gap-1 text-stone-700 dark:text-stone-300 hover:text-[#e4002b] transition-colors py-1"
          >
            <CreditCard className="w-3.5 h-3.5 text-stone-400" />
            <span>Plans</span>
          </button>

          {/* Affiliate Referral Earn */}
          <button
            onClick={() => onNavigate('earn')}
            className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
              currentTab === 'earn'
                ? 'bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white shadow-sm'
                : 'text-stone-700 dark:text-stone-300 hover:text-[#ff2e93]'
            }`}
          >
            <Gift className="w-3.5 h-3.5 text-[#ff2e93]" />
            <span>Earn 10%</span>
          </button>

          {/* Inbox with badge */}
          <button
            onClick={() => onNavigate('inbox')}
            className="relative p-1.5 text-stone-700 dark:text-stone-300 hover:text-[#e4002b] transition-colors rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
            title="Negotiations & Messages"
          >
            <Inbox className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#e4002b] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications bell */}
          {user && (
            <button
              onClick={onOpenNotifications}
              className="relative p-1.5 text-stone-700 dark:text-stone-300 hover:text-[#e4002b] transition-colors rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </button>
          )}

          {/* Admin link */}
          {user?.role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2.5 py-1 rounded-md font-bold flex items-center gap-1 hover:bg-amber-200 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}

          {/* User profile / Dashboard / Sign in */}
          {user ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDashboardClick}
                className="bg-stone-900 text-white dark:bg-white dark:text-stone-900 px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-all cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span className="max-w-[80px] sm:max-w-[120px] truncate">{user.name.split(' ')[0]}</span>
                <span className="text-[10px] opacity-75 uppercase font-mono tracking-wider ml-0.5">
                  ({user.role})
                </span>
              </button>
              <button
                onClick={onLogout}
                className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onOpenAuth('login')}
              className="bg-[#e4002b] text-white px-4 py-1.5 rounded-full font-bold hover:bg-[#c90026] transition-all shadow-sm cursor-pointer"
            >
              Sign in
            </button>
          )}

          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 py-3 bg-white dark:bg-[#15171e] border-t border-stone-200 dark:border-stone-800 flex flex-col gap-2.5 text-sm">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
            <span className="text-xs text-stone-500">Navigation</span>
            <span className="text-xs font-bold text-[#e4002b]">{user ? `${user.role.toUpperCase()} MODE` : 'GUEST'}</span>
          </div>
          <button
            onClick={() => {
              onNavigate('home');
              setMobileMenuOpen(false);
            }}
            className="text-left py-1 text-stone-800 dark:text-stone-200 font-medium"
          >
            Feed / All Stays
          </button>
          <button
            onClick={() => {
              onNavigate('shorts');
              setMobileMenuOpen(false);
            }}
            className="text-left py-1 text-stone-800 dark:text-stone-200 font-medium flex items-center gap-1.5"
          >
            <PlaySquare className="w-4 h-4 text-[#ff2e93]" />
            Shorts Reels
          </button>
          <button
            onClick={() => {
              onOpenTripFinder();
              setMobileMenuOpen(false);
            }}
            className="text-left py-1 text-stone-800 dark:text-stone-200 font-medium flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            AI Trip Finder
          </button>
          <button
            onClick={() => {
              onOpenPlans();
              setMobileMenuOpen(false);
            }}
            className="text-left py-1 text-stone-800 dark:text-stone-200 font-medium flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4 text-stone-400" />
            Host Subscription Plans
          </button>
          <button
            onClick={() => {
              onNavigate('earn');
              setMobileMenuOpen(false);
            }}
            className="text-left py-1 text-[#ff2e93] font-bold flex items-center gap-1.5"
          >
            <Gift className="w-4 h-4" />
            Earn 10% (Affiliate Program)
          </button>
          <button
            onClick={() => {
              handleDashboardClick();
              setMobileMenuOpen(false);
            }}
            className="text-left py-1 text-stone-800 dark:text-stone-200 font-medium flex items-center gap-1.5"
          >
            <UserIcon className="w-4 h-4" />
            {user ? `${user.role[0].toUpperCase() + user.role.slice(1)} Dashboard` : 'Sign in to Dashboard'}
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => {
                onNavigate('admin');
                setMobileMenuOpen(false);
              }}
              className="text-left py-1 text-amber-600 font-bold"
            >
              Admin Console
            </button>
          )}
        </div>
      )}
    </header>
  );
};
