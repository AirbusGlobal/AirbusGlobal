import React, { useState, useMemo } from 'react';
import {
  Gift,
  Search,
  Check,
  X,
  Sparkles,
  Cake,
  Wine,
  Coffee,
  Car,
  Clock,
  Key,
  Sun,
  Heart,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  ComplimentaryGiftItem,
  GIFT_CATEGORIES,
  searchComplimentaryGifts,
  ALL_COMPLIMENTARY_GIFTS,
} from '../data/complimentaryGifts';

interface ComplimentaryGiftsSelectorProps {
  selectedGifts: string[];
  onChange: (gifts: string[]) => void;
  maxSelection?: number;
  isOpen?: boolean;
  onClose?: () => void;
  isModal?: boolean;
  title?: string;
  subtitle?: string;
}

export const ComplimentaryGiftsSelector: React.FC<ComplimentaryGiftsSelectorProps> = ({
  selectedGifts,
  onChange,
  maxSelection = 3,
  isOpen = true,
  onClose,
  isModal = false,
  title = 'Select 1–3 Complimentary Gifts for Guests',
  subtitle = 'Choose up to 3 complimentary gifts, celebration cakes, or vouchers from our 10,000+ hospitality catalog. These gifts are free for guests and incentivize bookings!',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [customGiftInput, setCustomGiftInput] = useState('');

  const searchResults = useMemo(() => {
    return searchComplimentaryGifts(searchQuery, selectedCategory, page, pageSize);
  }, [searchQuery, selectedCategory, page]);

  const handleToggleGift = (giftName: string) => {
    if (selectedGifts.includes(giftName)) {
      onChange(selectedGifts.filter(g => g !== giftName));
    } else {
      if (selectedGifts.length >= maxSelection) {
        alert(`You can select a maximum of ${maxSelection} complimentary gifts per listing.`);
        return;
      }
      onChange([...selectedGifts, giftName]);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customGiftInput.trim();
    if (!clean) return;
    if (selectedGifts.includes(clean)) {
      setCustomGiftInput('');
      return;
    }
    if (selectedGifts.length >= maxSelection) {
      alert(`You can select a maximum of ${maxSelection} complimentary gifts per listing.`);
      return;
    }
    onChange([...selectedGifts, clean]);
    setCustomGiftInput('');
  };

  const renderIcon = (name?: string) => {
    switch (name) {
      case 'Cake':
        return <Cake className="w-4 h-4 text-pink-500" />;
      case 'Wine':
        return <Wine className="w-4 h-4 text-purple-500" />;
      case 'Coffee':
        return <Coffee className="w-4 h-4 text-amber-600" />;
      case 'Car':
        return <Car className="w-4 h-4 text-blue-500" />;
      case 'Clock':
        return <Clock className="w-4 h-4 text-emerald-500" />;
      case 'Key':
        return <Key className="w-4 h-4 text-amber-500" />;
      case 'Sun':
        return <Sun className="w-4 h-4 text-yellow-500" />;
      case 'Heart':
        return <Heart className="w-4 h-4 text-rose-500" />;
      default:
        return <Gift className="w-4 h-4 text-amber-500" />;
    }
  };

  const content = (
    <div className="space-y-4">
      {/* Header & Limits Banner */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Gift className="w-5 h-5" />
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white">
              {title}
            </h3>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              selectedGifts.length > 0
                ? 'bg-amber-500 text-stone-950 shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
            }`}
          >
            {selectedGifts.length} / {maxSelection} Selected
          </span>
        </div>
        <p className="text-xs text-stone-500 mt-1">{subtitle}</p>
      </div>

      {/* Selected Items Tray */}
      {selectedGifts.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 space-y-2">
          <div className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center justify-between">
            <span>Active Complimentary Gifts (Awarded to Guests):</span>
            <span className="text-[10px] lowercase text-amber-700 dark:text-amber-400 font-normal">
              100% Free for Guests
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedGifts.map(gift => (
              <span
                key={gift}
                className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs font-bold rounded-xl border border-amber-300 dark:border-amber-800/80 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{gift}</span>
                <button
                  type="button"
                  onClick={() => onChange(selectedGifts.filter(g => g !== gift))}
                  className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full text-stone-400 hover:text-stone-700 cursor-pointer"
                  title="Remove gift"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search 10,000 gifts: birthday cake, christmas voucher, champagne, coffee, airport transfer..."
            className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl text-xs font-medium outline-none focus:border-amber-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Categories Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {GIFT_CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-stone-950 font-extrabold shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Gifts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
        {searchResults.items.map(item => {
          const isSelected = selectedGifts.includes(item.name);
          return (
            <div
              key={item.id}
              onClick={() => handleToggleGift(item.name)}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 dark:bg-amber-950/40 text-stone-900 dark:text-white shadow-xs ring-1 ring-amber-500/30'
                  : 'bg-white dark:bg-stone-900/60 border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="p-1 rounded-lg bg-stone-100 dark:bg-stone-800">
                    {renderIcon(item.iconName)}
                  </span>
                  {item.badge && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      {item.badge}
                    </span>
                  )}
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center ml-auto ${
                      isSelected
                        ? 'bg-amber-500 text-white'
                        : 'border border-stone-300 dark:border-stone-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 line-clamp-2">
                  {item.name}
                </h4>
                <p className="text-[10px] text-stone-500 mt-1 line-clamp-2">
                  {item.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 mt-2 border-t border-stone-100 dark:border-stone-800/80 text-[10px]">
                <span className="text-stone-400">{item.category}</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  Est. KES {item.valueKes.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-500">
        <span>
          Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, searchResults.total)} of{' '}
          <strong>{searchResults.total.toLocaleString()}</strong> catalog items
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-800 disabled:opacity-40 cursor-pointer hover:bg-stone-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono font-bold px-1.5">
            {page} / {searchResults.totalPages || 1}
          </span>
          <button
            type="button"
            disabled={page >= searchResults.totalPages}
            onClick={() => setPage(p => Math.min(searchResults.totalPages, p + 1))}
            className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-800 disabled:opacity-40 cursor-pointer hover:bg-stone-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Add Custom Gift Form */}
      <form onSubmit={handleAddCustom} className="pt-2 border-t border-stone-100 dark:border-stone-800 flex gap-2">
        <input
          type="text"
          value={customGiftInput}
          onChange={e => setCustomGiftInput(e.target.value)}
          placeholder="Can't find it? Type a custom complimentary gift (e.g. Free Champagne & Strawberries on arrival)..."
          className="flex-1 px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-900 rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0"
        >
          Add Custom
        </button>
      </form>
    </div>
  );

  if (!isOpen) return null;

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-3xl bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 dark:border-stone-800 max-h-[92vh] overflow-y-auto">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {content}
          <div className="pt-4 mt-4 border-t border-stone-100 dark:border-stone-800 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold rounded-full text-xs shadow-sm cursor-pointer"
            >
              Done ({selectedGifts.length} Gifts Selected)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-stone-50/80 dark:bg-stone-900/40 rounded-3xl border border-stone-200 dark:border-stone-800">
      {content}
    </div>
  );
};
