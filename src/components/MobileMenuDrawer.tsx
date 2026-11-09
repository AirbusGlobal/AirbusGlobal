import React, { useEffect, useState } from 'react';
import {
  Compass,
  PlaySquare,
  Sparkles,
  Heart,
  PlusCircle,
  CreditCard,
  Gift,
  X,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Globe,
  ShieldCheck,
  MapPin,
  HelpCircle,
  FileText,
  User as UserIcon,
  Flame,
  Building,
  PhoneCall,
  Lock,
} from 'lucide-react';
import { User, Currency } from '../types';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
  onNavigate: (tab: string) => void;
  user: User | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onLogout: () => void;
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  onOpenTripFinder?: () => void;
  onOpenPlans?: () => void;
  onOpenSettings?: () => void;
}

export const MobileMenuDrawer: React.FC<MobileMenuDrawerProps> = ({
  isOpen,
  onClose,
  currentTab,
  onNavigate,
  user,
  onOpenAuth,
  onLogout,
  currency,
  onCurrencyChange,
  onOpenTripFinder,
  onOpenPlans,
  onOpenSettings,
}) => {
  const [openSection, setOpenSection] = useState<'destinations' | 'hosting' | 'support' | 'legal' | null>(null);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleSection = (section: 'destinations' | 'hosting' | 'support' | 'legal') => {
    setOpenSection(prev => (prev === section ? null : section));
  };

  const handleNav = (tab: string) => {
    onNavigate(tab);
    onClose();
  };

  const destinations = [
    { city: 'Nairobi Kilimani', desc: 'Executive Penthouses' },
    { city: 'Diani Beach', desc: 'Oceanfront Villas' },
    { city: 'Westlands Nairobi', desc: 'Skyline Studios' },
    { city: 'Naivasha Lakeside', desc: 'Sunset Cottages' },
    { city: 'Mombasa Nyali', desc: 'Swahili Beach Access' },
    { city: 'Watamu Marine', desc: 'Coral Coast Hideaways' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in drawer panel */}
      <aside
        className="relative w-full max-w-sm sm:max-w-md h-full bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250 border-l border-stone-200 dark:border-stone-800"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation Menu"
      >
        {/* Top Header Bar */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between shrink-0 bg-stone-50/50 dark:bg-stone-900/50">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/22.06.2026_10.38.23_REC_e5adb991.png"
              alt="AirBus"
              className="h-8 w-auto object-contain rounded-lg"
            />
            <div>
              <span className="font-extrabold text-sm tracking-tight text-stone-900 dark:text-white block font-heading">
                AirBus
              </span>
              <span className="text-[10px] text-stone-400 font-semibold block uppercase tracking-wider">
                Menu &amp; Directory
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-800 transition cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Account Quick Card */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-[#15171e] shrink-0">
          {user ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#e4002b]/10 text-[#e4002b] flex items-center justify-center font-bold text-sm shrink-0 border border-[#e4002b]/20">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-xs text-stone-900 dark:text-white truncate">
                    {user.name}
                  </div>
                  <div className="text-[11px] text-stone-400 truncate font-mono">
                    {user.email}
                  </div>
                  <span className="inline-block px-1.5 py-0.2 mt-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                    {user.role} mode
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {onOpenSettings && (
                  <button
                    onClick={() => {
                      onOpenSettings();
                      onClose();
                    }}
                    className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-800 transition"
                    title="Profile Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-stone-900 to-neutral-900 text-white space-y-2">
              <div className="text-xs font-bold text-stone-200">
                Welcome to AirBus
              </div>
              <p className="text-[11px] text-stone-400">
                Sign in to book video stays, unlock dating connections, or manage your listing properties.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    onOpenAuth('login');
                    onClose();
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#e4002b] hover:bg-[#c90026] text-white font-extrabold text-xs text-center transition cursor-pointer shadow-sm"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    onOpenAuth('register');
                    onClose();
                  }}
                  className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs text-center transition cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800/80 px-4 py-2 space-y-4">
          {/* 1. Primary App Features */}
          <div className="space-y-1 pt-1">
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider px-2 block mb-1">
              Main Navigation
            </span>

            <button
              onClick={() => handleNav('home')}
              className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'home'
                  ? 'bg-[#e4002b] text-white shadow-sm'
                  : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4" />
                <span>Home &amp; Stays Feed</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-50" />
            </button>

            <button
              onClick={() => handleNav('shorts')}
              className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'shorts'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                  : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <PlaySquare className="w-4 h-4 text-rose-500" />
                <span>Video Stay Shorts</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 font-extrabold uppercase">
                Reels
              </span>
            </button>

            <button
              onClick={() => handleNav('trip-dating')}
              className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'trip-dating'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Flame className="w-4 h-4 text-rose-500 fill-rose-500" />
                <span>Trip Dating – Services Near You</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500 font-black uppercase">
                Free
              </span>
            </button>

            <button
              onClick={() => {
                if (!user) onOpenAuth('register');
                else handleNav('owner');
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'owner'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                  : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <PlusCircle className="w-4 h-4 text-[#e4002b]" />
                <span>{user?.role === 'owner' ? 'Owner & Host Hub' : 'AirBus Your Home (Host)'}</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-50" />
            </button>

            <button
              onClick={() => handleNav('earn')}
              className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'earn'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Gift className="w-4 h-4 text-[#ff2e93]" />
                <span>Earn 10% Affiliate Program</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-600 font-extrabold">
                10% Net
              </span>
            </button>

            {onOpenTripFinder && (
              <button
                onClick={() => {
                  onOpenTripFinder();
                  onClose();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>AI Smart Trip Finder</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>
            )}

            {onOpenPlans && (
              <button
                onClick={() => {
                  onOpenPlans();
                  onClose();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  <span>Host Subscription Plans</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 font-bold">
                  Silver / Diamond / Gold
                </span>
              </button>
            )}
          </div>

          {/* 2. Inspiration for Getaways (Footer link migration) */}
          <div className="pt-3">
            <button
              onClick={() => toggleSection('destinations')}
              className="w-full flex items-center justify-between p-2 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#e4002b]" />
                <span>Explore Destinations &amp; Experiences</span>
              </div>
              {openSection === 'destinations' ? (
                <ChevronUp className="w-4 h-4 text-stone-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-400" />
              )}
            </button>

            {openSection === 'destinations' && (
              <div className="p-2 space-y-1.5 pl-8 text-xs animate-in slide-in-from-top-1 duration-150">
                {destinations.map(d => (
                  <div
                    key={d.city}
                    onClick={() => handleNav('home')}
                    className="py-1.5 hover:text-[#e4002b] cursor-pointer flex items-center justify-between"
                  >
                    <span className="font-semibold text-stone-800 dark:text-stone-200">{d.city}</span>
                    <span className="text-[10px] text-stone-400">{d.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Hosting & Landlord Guides (Footer link migration) */}
          <div className="pt-2">
            <button
              onClick={() => toggleSection('hosting')}
              className="w-full flex items-center justify-between p-2 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-500" />
                <span>Hosting Resources &amp; Protection</span>
              </div>
              {openSection === 'hosting' ? (
                <ChevronUp className="w-4 h-4 text-stone-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-400" />
              )}
            </button>

            {openSection === 'hosting' && (
              <div className="p-2 space-y-2 pl-8 text-xs text-stone-600 dark:text-stone-400 animate-in slide-in-from-top-1 duration-150">
                <div onClick={() => handleNav('owner')} className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  AirBus Your Home
                </div>
                <div onClick={() => onOpenPlans?.()} className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  AirCover for Hosts
                </div>
                <div onClick={() => onOpenPlans?.()} className="hover:text-[#e4002b] font-bold cursor-pointer">
                  Subscription Plans (Silver, Gold, Diamond)
                </div>
                <div className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  Hosting Resources &amp; Guides
                </div>
                <div className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  Host Responsibly in Kenya
                </div>
              </div>
            )}
          </div>

          {/* 4. Support & Protection (Footer link migration) */}
          <div className="pt-2">
            <button
              onClick={() => toggleSection('support')}
              className="w-full flex items-center justify-between p-2 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-500" />
                <span>Guest Support &amp; AirCover</span>
              </div>
              {openSection === 'support' ? (
                <ChevronUp className="w-4 h-4 text-stone-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-400" />
              )}
            </button>

            {openSection === 'support' && (
              <div className="p-2 space-y-2 pl-8 text-xs text-stone-600 dark:text-stone-400 animate-in slide-in-from-top-1 duration-150">
                <div onClick={() => handleNav('home')} className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  Help Center &amp; Guides
                </div>
                <div onClick={() => handleNav('home')} className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  AirCover Guest Protection
                </div>
                <div className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  Anti-discrimination Policy
                </div>
                <div className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  Disability &amp; Accessibility Support
                </div>
                <div className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  Cancellation Policies
                </div>
                <div className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  Report Neighborhood Concern
                </div>
              </div>
            )}
          </div>

          {/* 5. Legal & Company Details */}
          <div className="pt-2">
            <button
              onClick={() => toggleSection('legal')}
              className="w-full flex items-center justify-between p-2 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-stone-500" />
                <span>About AirBus &amp; Legal</span>
              </div>
              {openSection === 'legal' ? (
                <ChevronUp className="w-4 h-4 text-stone-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-400" />
              )}
            </button>

            {openSection === 'legal' && (
              <div className="p-2 space-y-2 pl-8 text-xs text-stone-600 dark:text-stone-400 animate-in slide-in-from-top-1 duration-150">
                <div className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  How AirBus Works
                </div>
                <div className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  Newsroom &amp; Press
                </div>
                <div className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  Privacy Policy &amp; Terms
                </div>
                <div className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  Your Privacy Choices
                </div>
                <div className="hover:text-stone-900 dark:hover:text-white cursor-pointer">
                  Company Details &amp; HQ Nairobi
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preferences & Footer Bar */}
        <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/60 shrink-0 space-y-3">
          <div className="flex items-center justify-between text-xs">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 font-bold text-stone-700 dark:text-stone-300">
              <Globe className="w-3.5 h-3.5 text-stone-400" />
              <span>English (US)</span>
            </div>

            {/* Currency Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-400 font-semibold text-[11px]">Currency:</span>
              <select
                value={currency}
                onChange={e => onCurrencyChange(e.target.value as Currency)}
                className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1 text-xs font-bold text-stone-900 dark:text-white outline-none cursor-pointer"
              >
                <option value="KES">KES (KSh)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>

          <div className="text-[10px] text-stone-400 text-center">
            © 2026 AirBus, Inc. All rights reserved.
          </div>
        </div>
      </aside>
    </div>
  );
};
