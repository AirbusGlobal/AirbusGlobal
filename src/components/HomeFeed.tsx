import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Stay, Currency } from '../types';
import { StayCard } from './StayCard';
import { StayMap } from './StayMap';
import { InfiniteFeed } from './shared/InfiniteFeed';
import { api } from '../api';
import {
  SlidersHorizontal,
  Zap,
  Award,
  Sparkles,
  MapPin,
  Calendar,
  Layers,
  ArrowUpDown,
  RotateCcw,
  LayoutGrid,
  Columns2,
  Map as MapIcon,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Lock,
  Loader2,
} from 'lucide-react';

interface HomeFeedProps {
  stays: Stay[];
  savedStayIds: string[];
  onToggleSave: (stayId: string) => void;
  onSelectStay: (stayId: string) => void;
  onCheckAvailability: (stayId: string) => void;
  onBookNow: (stayId: string) => void;
  onChatHost: (stayId: string) => void;
  onNegotiate: (stayId: string) => void;
  onNavigateCollection?: (slug: string) => void;
  currency: Currency;
  searchQuery: string;
  guestCount: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

const SHELF_META = [
  { id: 'black-friday', label: 'AirBus Black Friday', emoji: '🏷️', badge: 'Up to 50% OFF' },
  { id: 'work', label: 'AirBus Work', emoji: '💼', badge: 'Remote & Monthly' },
  { id: 'escapes', label: 'AirBus Escapes', emoji: '🌴', badge: 'Weekend Offers' },
  { id: 'local', label: 'AirBus Local', emoji: '🧭', badge: 'Local Guides' },
  { id: 'worldwide', label: 'AirBus World Wide', emoji: '🌍', badge: 'Global Stays' },
  { id: 'plus', label: 'AirBus Plus', emoji: '💎', badge: 'VVVIP Concierge' },
] as const;

const CATEGORY_TABS = [
  { id: 'all', emoji: '✨', label: 'All Stays' },
  { id: 'beach', emoji: '🏖️', label: 'Beachfront' },
  { id: 'city', emoji: '🏙️', label: 'City' },
  { id: 'country', emoji: '🌿', label: 'Countryside' },
  { id: 'pool', emoji: '🏊', label: 'Pools' },
  { id: 'home', emoji: '🏡', label: 'Villas & Homes' },
];

const CORE_AMENITIES = ['WiFi', 'Kitchen', 'Swimming Pool', 'Parking', 'Air Conditioning', 'Garden'];

export const HomeFeed: React.FC<HomeFeedProps> = ({
  stays,
  savedStayIds,
  onToggleSave,
  onSelectStay,
  onCheckAvailability,
  onBookNow,
  onChatHost,
  onNegotiate,
  onNavigateCollection,
  currency,
  searchQuery,
  guestCount,
  hasMore,
  loadingMore,
  onLoadMore,
}) => {
  const [hoveredStayId, setHoveredStayId] = useState<string | null>(null);

  // Horizontal Collection Shelves state (fetches /api/airbus/collections/:id/listings)
  const [shelves, setShelves] = useState<
    Record<
      string,
      {
        stays: Stay[];
        nextCursor: string | null;
        hasMore: boolean;
        totalCount: number;
        locked: boolean;
        loading: boolean;
        message?: string;
      }
    >
  >({});
  const shelfRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let active = true;
    const loadInitialShelves = async () => {
      const results = await Promise.all(
        SHELF_META.map(async meta => {
          try {
            const res = await api.getCollectionRowListings(meta.id, { limit: 12 });
            return { id: meta.id, res };
          } catch {
            return {
              id: meta.id,
              res: { stays: [], nextCursor: null, hasMore: false, totalCount: 0, locked: false, message: undefined as string | undefined },
            };
          }
        })
      );
      if (!active) return;
      const next: typeof shelves = {};
      results.forEach(({ id, res }) => {
        next[id] = {
          stays: res.stays || [],
          nextCursor: res.nextCursor || null,
          hasMore: Boolean(res.hasMore),
          totalCount: Number(res.totalCount || res.stays?.length || 0),
          locked: Boolean(res.locked),
          loading: false,
          message: res.message,
        };
      });
      setShelves(next);
    };
    loadInitialShelves();
    return () => {
      active = false;
    };
  }, [stays.length]);

  const handleLoadMoreShelf = async (id: string) => {
    const cur = shelves[id];
    if (!cur || cur.loading || !cur.hasMore || !cur.nextCursor || cur.stays.length >= 50) return;
    setShelves(prev => ({ ...prev, [id]: { ...prev[id], loading: true } }));
    try {
      const res = await api.getCollectionRowListings(id, { cursor: cur.nextCursor, limit: 12 });
      setShelves(prev => {
        const existing = prev[id];
        const existingIds = new Set(existing.stays.map(s => s.id));
        const appended = (res.stays || []).filter(s => !existingIds.has(s.id));
        const combined = [...existing.stays, ...appended].slice(0, 50);
        return {
          ...prev,
          [id]: {
            ...existing,
            stays: combined,
            nextCursor: combined.length >= 50 ? null : res.nextCursor,
            hasMore: combined.length < 50 && Boolean(res.hasMore),
            totalCount: res.totalCount,
            loading: false,
          },
        };
      });
    } catch {
      setShelves(prev => ({ ...prev, [id]: { ...prev[id], loading: false } }));
    }
  };

  const scrollShelfBy = (id: string, dir: -1 | 1) => {
    const el = shelfRefs.current[id];
    if (!el) return;
    el.scrollBy({ left: dir * 340, behavior: 'smooth' });
  };

  // Discovery view switcher: 'split' | 'grid' | 'map'
  const [discoveryView, setDiscoveryView] = useState<'split' | 'grid' | 'map'>('split');

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [entireHomeOnly, setEntireHomeOnly] = useState<boolean>(false);
  const [checkIn, setCheckIn] = useState<string>('');
  const [checkOut, setCheckOut] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('new');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [instantBookOnly, setInstantBookOnly] = useState<boolean>(false);
  const [superhostOnly, setSuperhostOnly] = useState<boolean>(false);
  const [minBeds, setMinBeds] = useState<number>(0);

  // Dynamic price bounds in dataset
  const absoluteMinPrice = useMemo(() => {
    return stays.length > 0 ? Math.min(...stays.map(s => s.price)) : 1000;
  }, [stays]);

  const absoluteMaxPrice = useMemo(() => {
    return stays.length > 0 ? Math.max(...stays.map(s => s.price), 30000) : 35000;
  }, [stays]);

  // Types list
  const availableTypes = useMemo(() => {
    return Array.from(new Set(stays.map(s => s.type)));
  }, [stays]);

  // Toggle helpers
  const toggleType = (t: string) => {
    setSelectedTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const toggleAmenity = (a: string) => {
    setSelectedAmenities(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  };

  const resetFilters = () => {
    setSelectedCategory('all');
    setMinPrice(0);
    setMaxPrice(0);
    setEntireHomeOnly(false);
    setCheckIn('');
    setCheckOut('');
    setSelectedTypes([]);
    setSelectedAmenities([]);
    setInstantBookOnly(false);
    setSuperhostOnly(false);
    setMinBeds(0);
    setSortBy('rec');
  };

  const resetMapOverlayFilters = () => {
    setMinPrice(0);
    setMaxPrice(0);
    setEntireHomeOnly(false);
    setInstantBookOnly(false);
  };

  const activeMapOverlayCount = useMemo(() => {
    let count = 0;
    if (instantBookOnly) count++;
    if (entireHomeOnly) count++;
    if (minPrice > absoluteMinPrice) count++;
    if (maxPrice > 0 && maxPrice < absoluteMaxPrice) count++;
    return count;
  }, [instantBookOnly, entireHomeOnly, minPrice, maxPrice, absoluteMinPrice, absoluteMaxPrice]);

  // Filter & sort logic
  const filteredStays = useMemo(() => {
    let list = stays.filter(s => {
      // Search query (title, location, type, area, landmarks)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          s.title.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          s.type.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Guests
      if (guestCount > 1 && s.guests < guestCount) {
        return false;
      }

      // Beds
      if (minBeds > 0 && s.beds < minBeds) {
        return false;
      }

      // Min & Max Price
      if (minPrice > 0 && s.price < minPrice) {
        return false;
      }
      if (maxPrice > 0 && s.price > maxPrice) {
        return false;
      }

      // Instant Book
      if (instantBookOnly && !s.instantBook) {
        return false;
      }

      // Entire Home
      if (entireHomeOnly) {
        const isEntire = /entire|villa|house|cottage|bungalow|penthouse/i.test(s.title + ' ' + s.type);
        if (!isEntire) return false;
      }

      // Superhost
      if (superhostOnly) {
        const isSuper = s.rating >= 4.85 && s.reviewsCount >= 40;
        if (!isSuper) return false;
      }

      // Types
      if (selectedTypes.length > 0 && !selectedTypes.includes(s.type)) {
        return false;
      }

      // Amenities
      if (
        selectedAmenities.length > 0 &&
        !selectedAmenities.every(a => s.features.includes(a))
      ) {
        return false;
      }

      // Category matching
      if (selectedCategory !== 'all') {
        const text = (s.title + ' ' + s.location + ' ' + s.type).toLowerCase();
        if (selectedCategory === 'beach' && !/beach|nyali|diani|coast|ocean|marine|watamu/.test(text)) return false;
        if (selectedCategory === 'city' && !/nairobi|westlands|kilimani|loft|downtown/.test(text)) return false;
        if (selectedCategory === 'country' && !/karen|naivasha|garden|lake|bungalow|cottage/.test(text)) return false;
        if (selectedCategory === 'pool' && !s.features.includes('Swimming Pool')) return false;
        if (selectedCategory === 'home' && !/villa|house|bungalow|residence/.test(text)) return false;
      }

      return true;
    });

    // Sorting
    list = [...list].sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price;
      if (sortBy === 'priceD') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'new') return b.createdAt - a.createdAt;
      // 'rec' - prioritize promoted listings (boosted at KES 100/day) at top, then featured, then rating
      const scoreA = (a.isPromoted ? 4 : 0) + (a.isFeatured ? 2 : 0);
      const scoreB = (b.isPromoted ? 4 : 0) + (b.isFeatured ? 2 : 0);
      return scoreB - scoreA || b.rating - a.rating;
    });

    return list;
  }, [
    stays,
    searchQuery,
    guestCount,
    minBeds,
    minPrice,
    maxPrice,
    instantBookOnly,
    entireHomeOnly,
    superhostOnly,
    selectedTypes,
    selectedAmenities,
    selectedCategory,
    sortBy,
  ]);

  // Recommendations
  const recommendedStays = useMemo(() => {
    return stays.filter(s => s.rating >= 4.9).slice(0, 4);
  }, [stays]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-5 space-y-5">
      {/* Top Header Row with Category Tabs & Discovery View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
          {CATEGORY_TABS.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#e4002b] text-white shadow-sm scale-[1.02]'
                  : 'bg-white dark:bg-[#15171e] text-stone-700 dark:text-stone-300 border border-[#e6e6e1] dark:border-[#262934] hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Discovery View Switcher: Split / Grid / Map */}
        <div className="flex items-center gap-1 bg-white dark:bg-[#15171e] p-1 rounded-full border border-stone-200 dark:border-stone-800 shadow-sm shrink-0 self-end sm:self-auto">
          <button
            onClick={() => setDiscoveryView('split')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              discoveryView === 'split'
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
            title="Split view: listings on left, map on right"
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Split View</span>
          </button>

          <button
            onClick={() => setDiscoveryView('grid')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              discoveryView === 'grid'
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
            title="Grid view: expansive cards grid"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>

          <button
            onClick={() => setDiscoveryView('map')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              discoveryView === 'map'
                ? 'bg-[#e4002b] text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
            title="Map view: full screen map discovery"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Map</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters Toolbar */}
      <div className="bg-white dark:bg-[#15171e] p-3.5 sm:p-4 rounded-2xl border border-[#e6e6e1] dark:border-[#262934] shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Price Range Slider */}
          <div className="flex items-center gap-2 min-w-[200px]">
            <span className="font-bold text-stone-700 dark:text-stone-300 whitespace-nowrap">
              Max Price: {maxPrice > 0 ? `${currency} ${maxPrice.toLocaleString()}` : 'Any'}
            </span>
            <input
              type="range"
              min="0"
              max={absoluteMaxPrice}
              step="1000"
              value={maxPrice}
              onChange={e => setMaxPrice(Number(e.target.value))}
              className="accent-[#e4002b] w-28 sm:w-36 cursor-pointer"
            />
          </div>

          {/* Quick Date Inputs */}
          <div className="flex items-center gap-2">
            <span className="text-stone-400 hidden sm:inline">Dates:</span>
            <input
              type="date"
              value={checkIn}
              onChange={e => setCheckIn(e.target.value)}
              className="px-2 py-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs outline-none"
              title="Check in"
            />
            <span className="text-stone-400">→</span>
            <input
              type="date"
              value={checkOut}
              onChange={e => setCheckOut(e.target.value)}
              className="px-2 py-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs outline-none"
              title="Check out"
            />
          </div>

          {/* Sort By Select */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-2.5 py-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-semibold outline-none cursor-pointer"
            >
              <option value="rec">Recommended</option>
              <option value="price">Price: Low to High</option>
              <option value="priceD">Price: High to Low</option>
              <option value="rating">Top Rated</option>
              <option value="new">Newest First</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          <button
            onClick={resetFilters}
            className="text-stone-400 hover:text-[#e4002b] text-xs flex items-center gap-1 transition-colors ml-auto cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        {/* Quick Checkbox Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
          <label className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border border-stone-200 dark:border-stone-700 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800">
            <input
              type="checkbox"
              checked={instantBookOnly}
              onChange={e => setInstantBookOnly(e.target.checked)}
              className="accent-[#e4002b] cursor-pointer"
            />
            <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500" />
            <span>Instant Book</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border border-stone-200 dark:border-stone-700 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800">
            <input
              type="checkbox"
              checked={superhostOnly}
              onChange={e => setSuperhostOnly(e.target.checked)}
              className="accent-[#e4002b] cursor-pointer"
            />
            <Award className="w-3 h-3 text-[#e4002b]" />
            <span>Superhost</span>
          </label>

          {/* Property Types */}
          {availableTypes.map(t => {
            const isSelected = selectedTypes.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#e4002b] text-white border-[#e4002b] font-bold'
                    : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
                }`}
              >
                {t}
              </button>
            );
          })}

          {/* Amenities chips */}
          {CORE_AMENITIES.map(a => {
            const isSelected = selectedAmenities.includes(a);
            return (
              <button
                key={a}
                onClick={() => toggleAmenity(a)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#ff2e93]/10 border-[#ff2e93] text-[#ff2e93] font-bold'
                    : 'border-stone-200 dark:border-stone-700 text-stone-500 hover:bg-stone-50'
                }`}
              >
                {isSelected ? `✓ ${a}` : a}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Layout based on Discovery View */}
      {discoveryView === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Listings Column (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
                {filteredStays.length} video stays available
                {searchQuery ? ` for "${searchQuery}"` : ''}
              </span>
            </div>

            {/* Advertise Here (@ KES 100/day) Banner */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-stone-900 to-rose-950/40 border border-purple-500/30 flex items-center justify-between gap-3 text-white shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff2e93] to-[#8b5cf6] flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black tracking-wide text-white">
                      Advertise Here (@ KES 100/day)
                    </span>
                    <span className="text-[10px] bg-gradient-to-r from-pink-500 to-rose-500 font-extrabold px-2 py-0.5 rounded-full">
                      High Visibility
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-300 line-clamp-1">
                    Promote your safari, car hire, or restaurant directly to short-stay guests across Kenya.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (filteredStays.length > 0) {
                    onSelectStay(filteredStays[0].id);
                  }
                }}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold whitespace-nowrap transition-colors cursor-pointer border border-white/10 shrink-0"
              >
                Place Ad
              </button>
            </div>

            {filteredStays.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-300 dark:border-stone-800">
                <MapPin className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">No stays match your criteria</h3>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto mb-4">
                  Try widening your price range, clearing amenities filters, or exploring anywhere in Nairobi or Mombasa.
                </p>
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-[#e4002b] text-white rounded-full text-xs font-bold hover:bg-[#c90026] transition-colors"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <InfiniteFeed
                hasMore={Boolean(hasMore && onLoadMore)}
                isLoadingMore={Boolean(loadingMore)}
                onLoadMore={onLoadMore || (() => {})}
                maxAutoPages={5}
                showJumpToFooter
                footerHref="#app-footer"
                loadMoreLabel="Load More Stays"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredStays.map(s => (
                    <div key={s.id} className="feed-snap-card">
                      <StayCard
                        stay={s}
                        isSaved={savedStayIds.includes(s.id)}
                        onToggleSave={onToggleSave}
                        onSelectStay={onSelectStay}
                        onCheckAvailability={onCheckAvailability}
                        onBookNow={onBookNow}
                        onChatHost={onChatHost}
                        onNegotiate={onNegotiate}
                        onHover={id => setHoveredStayId(id)}
                        currency={currency}
                      />
                    </div>
                  ))}
                </div>
              </InfiniteFeed>
            )}

            {/* Recommended for You Section */}
            {recommendedStays.length > 0 && (
              <div className="pt-6 border-t border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-1.5 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-extrabold text-stone-900 dark:text-white">Recommended Video Stays</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recommendedStays.map(s => (
                    <StayCard
                      key={`rec_${s.id}`}
                      stay={s}
                      isSaved={savedStayIds.includes(s.id)}
                      onToggleSave={onToggleSave}
                      onSelectStay={onSelectStay}
                      onCheckAvailability={onCheckAvailability}
                      onBookNow={onBookNow}
                      onChatHost={onChatHost}
                      onNegotiate={onNegotiate}
                      onHover={id => setHoveredStayId(id)}
                      currency={currency}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sticky Leaflet Map Column (5 cols) */}
          <div className="lg:col-span-5 sticky top-20">
            <StayMap
              stays={filteredStays}
              hoveredStayId={hoveredStayId}
              onHoverStay={setHoveredStayId}
              onSelectStay={onSelectStay}
              currency={currency}
              instantBookOnly={instantBookOnly}
              onToggleInstantBook={() => setInstantBookOnly(!instantBookOnly)}
              entireHomeOnly={entireHomeOnly}
              onToggleEntireHome={() => setEntireHomeOnly(!entireHomeOnly)}
              minPrice={minPrice}
              maxPrice={maxPrice}
              absoluteMinPrice={absoluteMinPrice}
              absoluteMaxPrice={absoluteMaxPrice}
              onPriceRangeChange={(min, max) => {
                setMinPrice(min);
                setMaxPrice(max);
              }}
              onResetOverlayFilters={resetMapOverlayFilters}
              activeFilterCount={activeMapOverlayCount}
            />
          </div>
        </div>
      )}

      {discoveryView === 'grid' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
              Showing {filteredStays.length} video stays in Grid View
            </span>
          </div>

          {filteredStays.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-300 dark:border-stone-800">
              <MapPin className="w-10 h-10 text-stone-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">No stays match your criteria</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto mb-4">
                Try widening your price range or clearing filters.
              </p>
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-[#e4002b] text-white rounded-full text-xs font-bold hover:bg-[#c90026] transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <InfiniteFeed
              hasMore={Boolean(hasMore && onLoadMore)}
              isLoadingMore={Boolean(loadingMore)}
              onLoadMore={onLoadMore || (() => {})}
              maxAutoPages={5}
              showJumpToFooter
              footerHref="#app-footer"
              loadMoreLabel="Load More Stays"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredStays.map(s => (
                  <div key={s.id} className="feed-snap-card">
                    <StayCard
                      stay={s}
                      isSaved={savedStayIds.includes(s.id)}
                      onToggleSave={onToggleSave}
                      onSelectStay={onSelectStay}
                      onCheckAvailability={onCheckAvailability}
                      onBookNow={onBookNow}
                      onChatHost={onChatHost}
                      onNegotiate={onNegotiate}
                      onHover={id => setHoveredStayId(id)}
                      currency={currency}
                    />
                  </div>
                ))}
              </div>
            </InfiniteFeed>
          )}
        </div>
      )}

      {discoveryView === 'map' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
              Explore {filteredStays.length} stays across Kenya
            </span>
            <button
              onClick={() => setDiscoveryView('split')}
              className="text-xs font-bold text-[#e4002b] hover:underline"
            >
              Back to Split View
            </button>
          </div>

          {/* Full Expansive Map */}
          <div className="h-[calc(100vh-250px)] min-h-[500px] w-full">
            <StayMap
              stays={filteredStays}
              hoveredStayId={hoveredStayId}
              onHoverStay={setHoveredStayId}
              onSelectStay={onSelectStay}
              currency={currency}
              className="h-full"
              instantBookOnly={instantBookOnly}
              onToggleInstantBook={() => setInstantBookOnly(!instantBookOnly)}
              entireHomeOnly={entireHomeOnly}
              onToggleEntireHome={() => setEntireHomeOnly(!entireHomeOnly)}
              minPrice={minPrice}
              maxPrice={maxPrice}
              absoluteMinPrice={absoluteMinPrice}
              absoluteMaxPrice={absoluteMaxPrice}
              onPriceRangeChange={(min, max) => {
                setMinPrice(min);
                setMaxPrice(max);
              }}
              onResetOverlayFilters={resetMapOverlayFilters}
              activeFilterCount={activeMapOverlayCount}
            />
          </div>
        </div>
      )}

      {/* Horizontal AirBus Collections Shelves */}
      {discoveryView !== 'map' && (
        <section aria-label="AirBus Collections" className="pt-6 border-t border-stone-200 dark:border-stone-800 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#e4002b]" />
                <span>Explore AirBus Collections</span>
              </h2>
              <p className="text-xs text-stone-500">
                Swipe or scroll horizontally across curated AirBus collections (newest approved first).
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {SHELF_META.map(meta => {
              const shelf = shelves[meta.id];
              if (!shelf) return null;
              if (!shelf.locked && shelf.stays.length === 0) return null;

              return (
                <div key={meta.id} className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{meta.emoji}</span>
                      <h3 className="text-sm font-extrabold text-stone-900 dark:text-white">{meta.label}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                        {meta.badge}
                      </span>
                      {!shelf.locked && (
                        <span className="text-[11px] text-stone-400 font-semibold">
                          ({shelf.totalCount})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!shelf.locked && shelf.stays.length > 0 && (
                        <div className="hidden sm:flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => scrollShelfBy(meta.id, -1)}
                            aria-label={`Scroll ${meta.label} left`}
                            className="p-1.5 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => scrollShelfBy(meta.id, 1)}
                            aria-label={`Scroll ${meta.label} right`}
                            className="p-1.5 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {onNavigateCollection && (
                        <button
                          type="button"
                          onClick={() => onNavigateCollection(meta.id)}
                          className="text-xs font-bold text-[#e4002b] hover:underline px-2 py-1 cursor-pointer"
                        >
                          View all →
                        </button>
                      )}
                    </div>
                  </div>

                  {shelf.locked ? (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-stone-900 to-purple-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white">
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                        <div>
                          <p className="text-xs font-extrabold">{meta.label} · Members Only</p>
                          <p className="text-[11px] text-stone-300">
                            {shelf.message || 'Unlock AirBus Plus VVVIP membership to browse exclusive stays.'}
                          </p>
                        </div>
                      </div>
                      {onNavigateCollection && (
                        <button
                          type="button"
                          onClick={() => onNavigateCollection(meta.id)}
                          className="px-4 py-1.5 rounded-full bg-amber-500 text-black text-xs font-extrabold cursor-pointer shrink-0"
                        >
                          Unlock AirBus Plus
                        </button>
                      )}
                    </div>
                  ) : (
                    <div
                      ref={el => {
                        shelfRefs.current[meta.id] = el;
                      }}
                      tabIndex={0}
                      aria-label={`${meta.label} horizontal listings shelf`}
                      onKeyDown={e => {
                        if (e.key === 'ArrowRight') {
                          e.preventDefault();
                          scrollShelfBy(meta.id, 1);
                        } else if (e.key === 'ArrowLeft') {
                          e.preventDefault();
                          scrollShelfBy(meta.id, -1);
                        }
                      }}
                      className="horizontal-shelf flex items-stretch gap-4 overflow-x-auto pb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e4002b]/50 rounded-2xl"
                    >
                      {shelf.stays.map(s => (
                        <div
                          key={`${meta.id}_${s.id}`}
                          className="horizontal-shelf-card w-[270px] sm:w-[295px] shrink-0"
                        >
                          <StayCard
                            stay={s}
                            isSaved={savedStayIds.includes(s.id)}
                            onToggleSave={onToggleSave}
                            onSelectStay={onSelectStay}
                            onCheckAvailability={onCheckAvailability}
                            onBookNow={onBookNow}
                            onChatHost={onChatHost}
                            onNegotiate={onNegotiate}
                            onHover={id => setHoveredStayId(id)}
                            currency={currency}
                          />
                        </div>
                      ))}

                      {shelf.hasMore && shelf.stays.length < 50 && (
                        <div className="horizontal-shelf-card w-[200px] shrink-0 flex items-center justify-center">
                          <button
                            type="button"
                            disabled={shelf.loading}
                            onClick={() => handleLoadMoreShelf(meta.id)}
                            className="w-full h-full min-h-[220px] rounded-3xl border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-[#e4002b] bg-stone-50 dark:bg-stone-900/60 flex flex-col items-center justify-center gap-2 p-4 text-xs font-bold text-stone-700 dark:text-stone-300 hover:text-[#e4002b] transition cursor-pointer disabled:opacity-50"
                          >
                            {shelf.loading ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                            <span>{shelf.loading ? 'Loading more...' : 'Load more'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
