import React, { useState } from 'react';
import { Stay, Currency } from '../types';
import { X, Sparkles, Search, MapPin, Calendar, Users, Home } from 'lucide-react';
import { StayCard } from './StayCard';

interface TripFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFindTrips: (params: any) => Promise<Array<{ stay: Stay; matchReason: string }>>;
  savedStayIds: string[];
  onToggleSave: (stayId: string) => void;
  onSelectStay: (stayId: string) => void;
  onCheckAvailability: (stayId: string) => void;
  onBookNow: (stayId: string) => void;
  onChatHost: (stayId: string) => void;
  onNegotiate: (stayId: string) => void;
  currency: Currency;
}

export const TripFinderModal: React.FC<TripFinderModalProps> = ({
  isOpen,
  onClose,
  onFindTrips,
  savedStayIds,
  onToggleSave,
  onSelectStay,
  onCheckAvailability,
  onBookNow,
  onChatHost,
  onNegotiate,
  currency,
}) => {
  if (!isOpen) return null;

  const [dates, setDates] = useState('');
  const [budget, setBudget] = useState('10000');
  const [location, setLocation] = useState('Westlands');
  const [homeType, setHomeType] = useState('');
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState('High-speed fiber internet, rooftop pool, quiet neighborhood');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ stay: Stay; matchReason: string }>>([]);
  const [searched, setSearched] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const matches = await onFindTrips({
        dates,
        budget: Number(budget) || 0,
        location,
        homeType,
        guests,
        notes,
      });
      setResults(matches);
    } catch (err: any) {
      alert(err.message || 'Error matching trips');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 dark:border-stone-800 my-auto max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-pink-500 text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold font-heading">✨ AI Trip Finder</h2>
        </div>
        <p className="text-xs text-stone-500 mb-6">
          Tell us your ideal vibe, dates, and budget. Our Gemini AI assistant will analyze stay videos, amenities, and host reviews to surface your top matches.
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-4 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                Preferred Destination / Area
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Westlands, Diani Beach, Karen"
                className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                Max Budget / Night (KES)
              </label>
              <input
                type="number"
                step="500"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">Home Type</label>
              <select
                value={homeType}
                onChange={e => setHomeType(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
              >
                <option value="">Any Type</option>
                <option value="Apartment">Apartment</option>
                <option value="Studio">Studio</option>
                <option value="Villa">Villa</option>
                <option value="Bungalow">Bungalow</option>
                <option value="House">House</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">Guests</label>
              <input
                type="number"
                min="1"
                max="16"
                value={guests}
                onChange={e => setGuests(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">Trip Dates</label>
              <input
                type="text"
                value={dates}
                onChange={e => setDates(e.target.value)}
                placeholder="e.g. Next weekend / Nov 1-4"
                className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
              Vibes &amp; Wishlist (Tell AI what you love)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Sea view, walking distance to cafes, quiet night sleep, balcony workstation"
              className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-[#ff2e93] via-[#8b5cf6] to-[#06b6d4] text-white font-extrabold rounded-full text-xs shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'AI Analyzing Video Stays...' : 'Find My Perfect Stays'}</span>
          </button>
        </form>

        {/* Results */}
        {searched && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
              <span>Matched Video Stays</span>
              <span className="text-xs text-stone-400 font-normal">({results.length} found)</span>
            </h3>

            {results.length === 0 ? (
              <p className="text-xs text-stone-400 italic text-center py-6">
                No stays matched your exact criteria. Try adjusting your budget or destination.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.map(({ stay, matchReason }) => (
                  <div key={stay.id} className="space-y-2">
                    <StayCard
                      stay={stay}
                      isSaved={savedStayIds.includes(stay.id)}
                      onToggleSave={onToggleSave}
                      onSelectStay={onSelectStay}
                      onCheckAvailability={onCheckAvailability}
                      onBookNow={onBookNow}
                      onChatHost={onChatHost}
                      onNegotiate={onNegotiate}
                      onHover={() => {}}
                      currency={currency}
                    />
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-stone-700 dark:text-stone-300">
                      <span className="font-bold text-amber-600 mr-1">✨ Match Rationale:</span>
                      {matchReason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
