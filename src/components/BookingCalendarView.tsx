import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  CheckCircle2,
  CalendarDays,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Booking, Stay, Currency, CURRENCY_RATES } from '../types';

interface BookingCalendarViewProps {
  bookings: Booking[];
  stays: Stay[];
  onSelectStay: (stayId: string) => void;
  onChatHost?: (stayId: string) => void;
  currency: Currency;
}

export const BookingCalendarView: React.FC<BookingCalendarViewProps> = ({
  bookings,
  stays,
  onSelectStay,
  onChatHost,
  currency,
}) => {
  // Current calendar viewing month
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const stayMap = new Map<string, Stay>();
  stays.forEach(s => stayMap.set(s.id, s));

  // Only aggregate confirmed bookings
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');

  const formatMoney = (price: number) => {
    const rate = CURRENCY_RATES[currency] || 1;
    const converted = Math.round(price * rate);
    return `${currency} ${converted.toLocaleString()}`;
  };

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const jumpToToday = () => {
    setCurrentDate(new Date());
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Compute days in month
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
  const offsetDays = (firstDayIndex + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Helper to format date YYYY-MM-DD
  const formatDateKey = (d: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  // Find bookings active on a specific day (checkIn <= dateKey && dateKey <= checkOut)
  const getBookingsForDate = (dateKey: string) => {
    return confirmedBookings.filter(b => b.checkIn <= dateKey && dateKey <= b.checkOut);
  };

  const todayKey = new Date().toISOString().slice(0, 10);

  // Active bookings on the currently selected date (or today by default)
  const activeSelectedKey = selectedDateStr || todayKey;
  const activeSelectedBookings = getBookingsForDate(activeSelectedKey);

  // Sorted upcoming timeline
  const sortedUpcoming = [...confirmedBookings]
    .filter(b => b.checkOut >= todayKey)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  return (
    <div className="space-y-6">
      {/* Calendar Header Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#e4002b]/10 text-[#e4002b]">
                <CalendarIcon className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-stone-900 dark:text-white">
                Trip Timeline &amp; Booking Calendar
              </h2>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Visual overview of all your confirmed AirBus stays, arrival schedules, and stay durations.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={jumpToToday}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
            >
              Today
            </button>
            <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
              <button
                onClick={prevMonth}
                className="p-1 rounded-lg hover:bg-white dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-extrabold px-2 min-w-[120px] text-center text-stone-900 dark:text-white">
                {monthName}
              </span>
              <button
                onClick={nextMonth}
                className="p-1 rounded-lg hover:bg-white dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[11px] font-bold text-stone-400 uppercase tracking-wider pb-1">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Leading blank slots */}
          {Array.from({ length: offsetDays }).map((_, idx) => (
            <div
              key={`blank-${idx}`}
              className="min-h-[70px] sm:min-h-[85px] p-1.5 rounded-2xl bg-stone-50/40 dark:bg-stone-900/20 border border-transparent"
            />
          ))}

          {/* Day slots */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateKey = formatDateKey(dayNum);
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === activeSelectedKey;
            const dayBookings = getBookingsForDate(dateKey);
            const hasBooking = dayBookings.length > 0;

            return (
              <div
                key={dateKey}
                onClick={() => setSelectedDateStr(dateKey)}
                className={`min-h-[70px] sm:min-h-[85px] p-1.5 sm:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                  isSelected
                    ? 'border-[#e4002b] bg-rose-50/50 dark:bg-rose-950/20 shadow-xs'
                    : hasBooking
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 hover:border-emerald-500'
                    : isToday
                    ? 'border-stone-400 dark:border-stone-600 bg-stone-100/60 dark:bg-stone-800/60'
                    : 'border-stone-100 dark:border-stone-800/80 bg-stone-50/60 dark:bg-stone-900/40 hover:bg-white dark:hover:bg-stone-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday
                        ? 'bg-[#e4002b] text-white shadow-xs'
                        : isSelected
                        ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900'
                        : 'text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {hasBooking && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>

                {/* Booking badges inside cell */}
                <div className="space-y-1 mt-1">
                  {dayBookings.slice(0, 2).map(b => {
                    const stay = stayMap.get(b.stayId);
                    const isCheckin = b.checkIn === dateKey;
                    const isCheckout = b.checkOut === dateKey;

                    return (
                      <div
                        key={b.id}
                        className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md truncate font-extrabold flex items-center gap-1 ${
                          isCheckin
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : isCheckout
                            ? 'bg-amber-500 text-stone-950'
                            : 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200'
                        }`}
                        title={`${stay?.title || 'Stay'} (${b.checkIn} - ${b.checkOut})`}
                      >
                        <span>{isCheckin ? 'Check-in: ' : isCheckout ? 'Check-out: ' : ''}</span>
                        <span className="truncate">{stay?.title?.split(' ')[0] || 'Stay'}</span>
                      </div>
                    );
                  })}
                  {dayBookings.length > 2 && (
                    <div className="text-[9px] text-stone-400 font-bold px-1">
                      +{dayBookings.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Inspector Panel */}
      {activeSelectedBookings.length > 0 ? (
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-stone-900/10 border-2 border-emerald-500/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white">
                Bookings for {activeSelectedKey} ({activeSelectedBookings.length})
              </h3>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              Confirmed Schedule
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSelectedBookings.map(b => {
              const stay = stayMap.get(b.stayId);
              if (!stay) return null;

              return (
                <div
                  key={`inspector-${b.id}`}
                  className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={stay.thumbnailUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80'}
                      alt={stay.title}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 cursor-pointer"
                      onClick={() => onSelectStay(stay.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                          Ref: {b.reference}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-bold">Confirmed</span>
                      </div>
                      <h4
                        className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-white truncate mt-1 hover:text-[#e4002b] cursor-pointer"
                        onClick={() => onSelectStay(stay.id)}
                      >
                        {stay.title}
                      </h4>
                      <div className="flex items-center gap-1 text-[11px] text-stone-500 mt-0.5 truncate">
                        <MapPin className="w-3 h-3 text-[#e4002b] shrink-0" />
                        <span className="truncate">{stay.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
                    <div className="text-[11px] text-stone-600 dark:text-stone-400">
                      <span>{b.checkIn} → {b.checkOut}</span>
                      <span className="mx-1">·</span>
                      <strong className="text-stone-900 dark:text-white">{formatMoney(b.total)}</strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onChatHost && (
                        <button
                          onClick={() => onChatHost(stay.id)}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3 text-[#e4002b]" />
                          <span>Chat</span>
                        </button>
                      )}
                      <button
                        onClick={() => onSelectStay(stay.id)}
                        className="px-2.5 py-1 rounded-lg bg-[#e4002b] hover:bg-[#c90026] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Stay</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800 text-center text-xs text-stone-500">
          No confirmed stays checking in or active on <strong>{activeSelectedKey}</strong>. Click any date on the calendar with green dots to view its trip itinerary.
        </div>
      )}

      {/* Visual Timeline Strip for All Confirmed Trips */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#15171e] border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <CalendarDays className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white">
                Upcoming Stays Timeline ({sortedUpcoming.length})
              </h3>
              <p className="text-[11px] text-stone-500">Chronological travel milestones across Kenya</p>
            </div>
          </div>
        </div>

        {sortedUpcoming.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs font-bold text-stone-600 dark:text-stone-300">No upcoming confirmed trips scheduled.</p>
            <p className="text-[11px] text-stone-400">Book any video-first short stay to have it automatically mapped onto your planning calendar.</p>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-6 before:content-[''] before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-[#e4002b] via-amber-500 to-emerald-500">
            {sortedUpcoming.map((b, idx) => {
              const stay = stayMap.get(b.stayId);
              const checkinDate = new Date(`${b.checkIn}T14:00:00`);
              const diffDays = Math.ceil((checkinDate.getTime() - Date.now()) / (1000 * 3600 * 24));
              const countdownLabel =
                diffDays <= 0
                  ? 'Check-in Today!'
                  : diffDays === 1
                  ? 'Starts Tomorrow'
                  : `Starts in ${diffDays} days`;

              return (
                <div key={`timeline-${b.id}`} className="relative group">
                  {/* Timeline node */}
                  <div className="absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white dark:bg-stone-900 border-2 border-[#e4002b] flex items-center justify-center text-xs font-black text-[#e4002b] shadow-xs">
                    {idx + 1}
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          {countdownLabel}
                        </span>
                        <span className="text-xs font-bold text-stone-500">
                          {b.checkIn} → {b.checkOut}
                        </span>
                        <span className="text-xs font-mono text-stone-400">Ref: {b.reference}</span>
                      </div>
                      <h4
                        className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white cursor-pointer hover:text-[#e4002b]"
                        onClick={() => stay && onSelectStay(stay.id)}
                      >
                        {stay?.title || 'Stay'}
                      </h4>
                      <p className="text-xs text-stone-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#e4002b]" />
                        <span>{stay?.location || 'Kenya'}</span>
                        <span>·</span>
                        <span>{b.guests} guests</span>
                        <span>·</span>
                        <span>{formatMoney(b.total)}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {stay && onChatHost && (
                        <button
                          onClick={() => onChatHost(stay.id)}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-stone-100 cursor-pointer"
                        >
                          Chat Host
                        </button>
                      )}
                      {stay && (
                        <button
                          onClick={() => onSelectStay(stay.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#e4002b] hover:bg-[#c90026] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
