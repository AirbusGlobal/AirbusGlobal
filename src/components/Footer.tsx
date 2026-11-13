import React, { useState } from 'react';
import {
  Globe,
  ShieldCheck,
  Heart,
  ChevronDown,
  ChevronUp,
  MapPin,
  Sparkles,
  ExternalLink,
  Flame,
  Briefcase,
  Compass,
  Crown,
  Map,
} from 'lucide-react';
import { Currency } from '../types';

interface FooterProps {
  onNavigate: (tab: string) => void;
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  onOpenTripFinder?: () => void;
  onOpenPlans?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  currency,
  onCurrencyChange,
  onOpenTripFinder,
  onOpenPlans,
}) => {
  const [activeTab, setActiveTab] = useState<'destinations' | 'experiences' | 'services'>('destinations');

  const collections = [
    {
      tab: 'collection-black-friday',
      title: 'AirBus Black Friday',
      subtitle: 'Quarterly flash drops up to 50% off',
      icon: Flame,
      accent: 'text-[#e4002b]',
    },
    {
      tab: 'collection-work',
      title: 'AirBus Work',
      subtitle: 'Monthly remote & corporate stays',
      icon: Briefcase,
      accent: 'text-sky-600 dark:text-sky-400',
    },
    {
      tab: 'collection-escapes',
      title: 'AirBus Escapes',
      subtitle: 'Limited-time weekend & getaway offers',
      icon: Compass,
      accent: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      tab: 'collection-plus',
      title: 'AirBus Plus',
      subtitle: 'VVVIP luxury homes & hotel concierge',
      icon: Crown,
      accent: 'text-amber-500',
    },
    {
      tab: 'collection-local',
      title: 'AirBus Local',
      subtitle: 'Neighborhood guides & host picks',
      icon: Map,
      accent: 'text-purple-600 dark:text-purple-400',
    },
    {
      tab: 'collection-worldwide',
      title: 'AirBus World Wide',
      subtitle: 'International stays & global currencies',
      icon: Globe,
      accent: 'text-indigo-600 dark:text-indigo-400',
    },
  ];

  const destinations = [
    { city: 'Nairobi Kilimani', desc: 'Executive Penthouses & Lofts' },
    { city: 'Diani Beach', desc: 'Oceanfront Villas & Private Pools' },
    { city: 'Westlands Nairobi', desc: 'Skyline Studios & High-speed Fiber' },
    { city: 'Naivasha Lakeside', desc: 'Safari Lodges & Sunset Cottages' },
    { city: 'Mombasa Nyali', desc: 'Swahili Architecture & Beach Access' },
    { city: 'Watamu Marine', desc: 'Coral Coast Hideaways & Breezy Terraces' },
    { city: 'Kisumu City', desc: 'Lake Victoria Views & Serene Gardens' },
    { city: 'Nanyuki Equator', desc: 'Mount Kenya Cabins & Bush Retreats' },
  ];

  const experiences = [
    { name: 'Nairobi National Park Game Drive', tag: 'Wildlife Safari' },
    { name: 'Diani Ocean Skydiving & Kitesurfing', tag: 'Coast Thrills' },
    { name: 'Lake Naivasha Boat & Crescent Island Tour', tag: 'Lakeside Cruise' },
    { name: 'Old Town Mombasa Swahili Food Walk', tag: 'Cultural Tour' },
    { name: 'Great Rift Valley Scenic Escarpment Hike', tag: 'Nature Trails' },
    { name: 'Karura Forest Cycling & Waterfalls Picnic', tag: 'Green Sanctuary' },
  ];

  const services = [
    { title: 'Airport Chauffeur Transfers', note: 'JKIA & Moi International 24/7' },
    { title: 'Personal Private Chefs', note: 'Swahili, Italian & Continental Menus' },
    { title: 'Certified Safari Guides', note: 'Maasai Mara & Amboseli Itineraries' },
    { title: 'Express Laundry & Dry Cleaning', note: 'Same-day turnaround for travellers' },
    { title: 'Portable 5G MiFi Routers', note: 'Unlimited remote-work connectivity' },
    { title: 'Beach Buggy & Jet Ski Rentals', note: 'Hourly coastal water sports' },
  ];

  return (
    <footer className="bg-stone-100 dark:bg-[#111318] text-stone-700 dark:text-stone-300 border-t border-stone-200 dark:border-stone-800 transition-colors pt-10 pb-8 mt-16 text-xs">
      <div className="max-w-7xl mx-auto px-4 space-y-10">
        {/* Dynamic Inspiration Tabs: Destinations / Experiences / Services */}
        <div className="pb-8 border-b border-stone-200 dark:border-stone-800 space-y-4">
          <h2 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white">
            Inspiration for future getaways
          </h2>

          <div className="flex items-center gap-3 border-b border-stone-200 dark:border-stone-800 pb-2 text-xs font-bold overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('destinations')}
              className={`pb-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'destinations'
                  ? 'border-stone-900 dark:border-white text-stone-950 dark:text-white'
                  : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Destinations for you
            </button>
            <button
              onClick={() => setActiveTab('experiences')}
              className={`pb-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'experiences'
                  ? 'border-stone-900 dark:border-white text-stone-950 dark:text-white'
                  : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Popular experiences Near You
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`pb-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'services'
                  ? 'border-stone-900 dark:border-white text-stone-950 dark:text-white'
                  : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Find services near you
            </button>
          </div>

          {/* Tab Content Panels */}
          {activeTab === 'destinations' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-2">
              {destinations.map(d => (
                <div
                  key={d.city}
                  onClick={() => onNavigate('home')}
                  className="cursor-pointer group select-none"
                >
                  <div className="font-extrabold text-stone-900 dark:text-white group-hover:underline flex items-center gap-1">
                    <span>{d.city}</span>
                  </div>
                  <div className="text-[11px] text-stone-500 line-clamp-1">{d.desc}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'experiences' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              {experiences.map(e => (
                <div
                  key={e.name}
                  onClick={() => onNavigate('home')}
                  className="cursor-pointer group select-none p-2.5 rounded-xl bg-white/50 dark:bg-stone-900/40 border border-stone-200/50 dark:border-stone-800/60"
                >
                  <div className="text-[10px] font-black uppercase text-[#e4002b]">{e.tag}</div>
                  <div className="font-bold text-stone-900 dark:text-white group-hover:underline text-xs mt-0.5">
                    {e.name}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'services' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              {services.map(s => (
                <div
                  key={s.title}
                  className="p-2.5 rounded-xl bg-white/50 dark:bg-stone-900/40 border border-stone-200/50 dark:border-stone-800/60 select-none"
                >
                  <div className="font-bold text-stone-900 dark:text-white text-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>{s.title}</span>
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">{s.note}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AirBus Collections 6-Link Showcase Section */}
        <div className="pb-8 border-b border-stone-200 dark:border-stone-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <h3 className="font-extrabold text-stone-900 dark:text-white text-xs uppercase tracking-wider">
              AirBus Collections
            </h3>
            <span className="text-[11px] text-stone-500">
              Curated stays, quarterly Black Friday deals, VVVIP homes &amp; local guides
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {collections.map(col => {
              const IconComp = col.icon;
              return (
                <button
                  key={col.tab}
                  type="button"
                  onClick={() => onNavigate(col.tab)}
                  className="text-left p-3 rounded-2xl bg-white/80 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <IconComp className={`w-3.5 h-3.5 shrink-0 ${col.accent}`} />
                    <span className="font-extrabold text-stone-900 dark:text-white group-hover:underline text-xs truncate">
                      {col.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-snug">
                    {col.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4-Column Airbnb-Style Mega Footer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-8 border-b border-stone-200 dark:border-stone-800">
          {/* Column 1: Support (Mimic Airbnb footer) */}
          <div className="space-y-3">
            <h3 className="font-extrabold text-stone-900 dark:text-white text-xs uppercase tracking-wider">
              Support
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#home" onClick={() => onNavigate('home')} className="hover:underline">
                  Help Center &amp; Guides
                </a>
              </li>
              <li>
                <span className="hover:underline cursor-pointer" onClick={() => onNavigate('home')}>
                  AirCover Guest Protection
                </span>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Anti-discrimination Policy</span>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Disability &amp; Accessibility</span>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Cancellation Policy</span>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Report Neighborhood Concern</span>
              </li>
            </ul>
          </div>

          {/* Column 2: Hosting (Mimic Airbnb footer) */}
          <div className="space-y-3">
            <h3 className="font-extrabold text-stone-900 dark:text-white text-xs uppercase tracking-wider">
              Hosting
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('owner')}
                  className="hover:underline text-left cursor-pointer"
                >
                  AirBus Your Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPlans?.()}
                  className="hover:underline text-left cursor-pointer"
                >
                  AirCover for Hosts
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPlans?.()}
                  className="hover:underline text-left cursor-pointer font-bold text-[#e4002b]"
                >
                  Subscription Plans (Silver, Gold, Diamond)
                </button>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Hosting Resources &amp; Guides</span>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Community Forum</span>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Host Responsibly in Kenya</span>
              </li>
            </ul>
          </div>

          {/* Column 3: Trip Dating & Services */}
          <div className="space-y-3">
            <h3 className="font-extrabold text-stone-900 dark:text-white text-xs uppercase tracking-wider">
              Specialized Services
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('trip-dating')}
                  className="hover:underline text-left font-bold text-rose-500 cursor-pointer flex items-center gap-1"
                >
                  <Heart className="w-3 h-3 fill-rose-500" />
                  <span>Trip Dating – Meet Like-Minded Singles</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenTripFinder?.()}
                  className="hover:underline text-left cursor-pointer"
                >
                  AI Trip Finder
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('earn')}
                  className="hover:underline text-left cursor-pointer text-[#ff2e93] font-bold"
                >
                  Earn 10% Affiliate Program
                </button>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Video Stay Short Reels</span>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Live Host Negotiations</span>
              </li>
            </ul>
          </div>

          {/* Column 4: About us & Legal */}
          <div className="space-y-3">
            <h3 className="font-extrabold text-stone-900 dark:text-white text-xs uppercase tracking-wider">
              About Us &amp; Legal
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="hover:underline cursor-pointer">How AirBus Works</span>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Newsroom &amp; Press</span>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Careers &amp; Engineering</span>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Investors &amp; Partnerships</span>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Privacy &amp; Terms</span>
              </li>
              <li>
                <span className="hover:underline cursor-pointer">Your Privacy Choices</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright, Legal links, Currency and Language */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-stone-500">
          <div className="flex items-center gap-2 flex-wrap text-center md:text-left">
            <span>·© 2026 Airbus, Inc.</span>
            <span>·</span>
            <span className="hover:underline cursor-pointer">PrivacyTerms</span>
            <span>,</span>
            <span>·</span>
            <span className="hover:underline cursor-pointer">Your Privacy Choices</span>
            <span>·</span>
            <span className="hover:underline cursor-pointer">Company Details</span>
          </div>

          <div className="flex items-center gap-4 font-bold text-stone-800 dark:text-stone-200">
            <div className="flex items-center gap-1.5 cursor-pointer hover:underline">
              <Globe className="w-3.5 h-3.5" />
              <span>English (US)</span>
            </div>

            <div className="flex items-center gap-1">
              <span>Currency:</span>
              <select
                value={currency}
                onChange={e => onCurrencyChange(e.target.value as Currency)}
                className="bg-transparent font-extrabold text-stone-900 dark:text-white outline-none cursor-pointer hover:underline"
              >
                <option value="KES">KES (KSh)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
