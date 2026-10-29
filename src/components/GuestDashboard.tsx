import React, { useState } from 'react';
import {
  User,
  Booking,
  Stay,
  ChatThread,
  Currency,
  CURRENCY_RATES,
} from '../types';
import {
  Calendar,
  Heart,
  MessageSquare,
  Sparkles,
  Download,
  XCircle,
  Clock,
  User as UserIcon,
  MapPin,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { StayCard } from './StayCard';

interface GuestDashboardProps {
  user: User;
  bookings: Booking[];
  stays: Stay[];
  wishlistIds: string[];
  threads: ChatThread[];
  onToggleSave: (stayId: string) => void;
  onSelectStay: (stayId: string) => void;
  onCheckAvailability: (stayId: string) => void;
  onBookNow: (stayId: string) => void;
  onChatHost: (stayId: string) => void;
  onNegotiate: (stayId: string) => void;
  onCancelBooking: (bookingId: string) => Promise<void>;
  onUpdateProfile: (data: any) => Promise<void>;
  currency: Currency;
  onBackToFeed?: () => void;
}

export const GuestDashboard: React.FC<GuestDashboardProps> = ({
  user,
  bookings,
  stays,
  wishlistIds,
  threads,
  onToggleSave,
  onSelectStay,
  onCheckAvailability,
  onBookNow,
  onChatHost,
  onNegotiate,
  onCancelBooking,
  onUpdateProfile,
  currency,
  onBackToFeed,
}) => {
  const [activeTab, setActiveTab] = useState<'trips' | 'wishlist' | 'messages' | 'recommended' | 'profile'>('trips');
  const [tripFilter, setTripFilter] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');

  // Profile form state
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [location, setLocation] = useState(user.location || '');
  const [bio, setBio] = useState(user.bio || '');
  const [languages, setLanguages] = useState(user.languages || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Map stay lookup
  const stayMap = new Map<string, Stay>();
  stays.forEach(s => stayMap.set(s.id, s));

  const formatMoney = (price: number) => {
    const rate = CURRENCY_RATES[currency] || 1;
    const converted = Math.round(price * rate);
    return `${currency} ${converted.toLocaleString()}`;
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  // Classify bookings
  const upcomingBookings = bookings.filter(
    b => b.status !== 'cancelled' && b.status !== 'declined' && b.checkOut >= todayStr
  );
  const pastBookings = bookings.filter(
    b => b.status !== 'cancelled' && b.status !== 'declined' && b.checkOut < todayStr
  );
  const cancelledBookings = bookings.filter(
    b => b.status === 'cancelled' || b.status === 'declined'
  );

  const awaitingHostCount = bookings.filter(b => b.status === 'requested').length;

  const currentTripList =
    tripFilter === 'upcoming'
      ? upcomingBookings
      : tripFilter === 'past'
      ? pastBookings
      : cancelledBookings;

  // Next upcoming stay
  const nextStayBooking = upcomingBookings.sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
  const nextStay = nextStayBooking ? stayMap.get(nextStayBooking.stayId) : null;

  // Saved stays
  const savedStays = wishlistIds.map(id => stayMap.get(id)).filter(Boolean) as Stay[];

  // Recommended stays
  const recommendedStays = stays.filter(s => s.rating >= 4.85).slice(0, 4);

  // Export .ICS calendar file
  const handleExportICS = (b: Booking) => {
    const s = stayMap.get(b.stayId);
    const d = (x: string) => x.replace(/-/g, '');
    const cleanTitle = (s?.title || 'AirBus Stay').replace(/,/g, '');
    const cleanLoc = (s?.location || 'Kenya').replace(/,/g, '');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AirBus Video Stays//EN',
      'BEGIN:VEVENT',
      `UID:${b.id}@airbus.ke`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${d(b.checkIn)}`,
      `DTEND;VALUE=DATE:${d(b.checkOut)}`,
      `SUMMARY:AirBus Stay: ${cleanTitle}`,
      `LOCATION:${cleanLoc}`,
      `DESCRIPTION:Booking Ref: ${b.reference}. Guests: ${b.guests}.`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `airbus-trip-${b.reference}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await onUpdateProfile({ name, phone, location, bio, languages });
      setProfileMsg('Profile saved successfully!');
    } catch (err: any) {
      setProfileMsg(err.message || 'Error saving profile');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Ubiquitous Go Back to Feed Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBackToFeed}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#e4002b]" />
          <span>Go Back to Stays Feed</span>
        </button>
      </div>

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white p-6 rounded-3xl shadow-lg border border-stone-700/50 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-[#ff2e93] text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                Guest Dashboard
              </span>
              {user.idVerified && (
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> ID Verified
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight">
              Hi {user.name.split(' ')[0]} 👋
            </h1>
            <p className="text-xs text-stone-300 mt-1 max-w-md">
              Manage your upcoming short-stay trips, track real-time host negotiations, and access your saved video listings.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 text-center">
              <div className="text-base font-extrabold text-emerald-400">{upcomingBookings.length}</div>
              <div className="text-[10px] text-stone-300 uppercase font-semibold">Upcoming</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 text-center">
              <div className="text-base font-extrabold text-amber-400">{awaitingHostCount}</div>
              <div className="text-[10px] text-stone-300 uppercase font-semibold">Awaiting Host</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 text-center">
              <div className="text-base font-extrabold text-stone-200">{pastBookings.length}</div>
              <div className="text-[10px] text-stone-300 uppercase font-semibold">Completed</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 text-center">
              <div className="text-base font-extrabold text-[#ff2e93]">{savedStays.length}</div>
              <div className="text-[10px] text-stone-300 uppercase font-semibold">Wishlist</div>
            </div>
          </div>
        </div>

        {/* Next Trip Card inside banner if exists */}
        {nextStay && nextStayBooking && (
          <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/5 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-700 shrink-0">
                <img
                  src={nextStay.thumbnailUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80'}
                  alt={nextStay.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Next Trip: {nextStayBooking.checkIn} → {nextStayBooking.checkOut}
                </div>
                <div className="text-sm font-bold text-white hover:underline cursor-pointer" onClick={() => onSelectStay(nextStay.id)}>
                  {nextStay.title}
                </div>
                <div className="text-[11px] text-stone-400">
                  Ref: <span className="font-mono text-stone-200">{nextStayBooking.reference}</span> · {nextStayBooking.guests} guests · {formatMoney(nextStayBooking.total)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onChatHost(nextStay.id)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold transition-colors"
              >
                Chat Host
              </button>
              <button
                onClick={() => handleExportICS(nextStayBooking)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-bold transition-colors flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> Add to Calendar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 border-b border-stone-200 dark:border-stone-800">
        <button
          onClick={() => setActiveTab('trips')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'trips'
              ? 'bg-[#e4002b] text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>My Trips ({bookings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('wishlist')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'wishlist'
              ? 'bg-[#e4002b] text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Heart className="w-4 h-4 text-[#ff2e93]" />
          <span>Wishlist ({savedStays.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'messages'
              ? 'bg-[#e4002b] text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Negotiations ({threads.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('recommended')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'recommended'
              ? 'bg-[#e4002b] text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>For You</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            activeTab === 'profile'
              ? 'bg-[#e4002b] text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>Profile Settings</span>
        </button>
      </div>

      {/* TAB 1: MY TRIPS */}
      {activeTab === 'trips' && (
        <div className="space-y-6">
          {/* Subfilter Pills */}
          <div className="flex gap-2">
            {(['upcoming', 'past', 'cancelled'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setTripFilter(tab)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all cursor-pointer ${
                  tripFilter === tab
                    ? 'bg-stone-900 text-white dark:bg-white dark:text-black shadow-sm'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                }`}
              >
                {tab} (
                {tab === 'upcoming'
                  ? upcomingBookings.length
                  : tab === 'past'
                  ? pastBookings.length
                  : cancelledBookings.length}
                )
              </button>
            ))}
          </div>

          {currentTripList.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-300 dark:border-stone-800">
              <Calendar className="w-10 h-10 text-stone-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">No {tripFilter} trips found</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                Explore our video-first stays across Nairobi, Diani, Nyali, and Naivasha to reserve your next getaway.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentTripList.map(b => {
                const s = stayMap.get(b.stayId);
                const isConfirmed = b.status === 'confirmed';
                const isRequested = b.status === 'requested';

                return (
                  <div
                    key={b.id}
                    className="bg-white dark:bg-[#15171e] p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isConfirmed
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : isRequested
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {b.status}
                          </span>
                          <span className="text-xs text-stone-400 ml-2 font-mono font-medium">Ref: {b.reference}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-stone-900 dark:text-white">
                            {formatMoney(b.total)}
                          </div>
                          <div className="text-[10px] text-stone-400">Total (pay host direct)</div>
                        </div>
                      </div>

                      <h3
                        onClick={() => s && onSelectStay(s.id)}
                        className="text-base font-bold text-stone-900 dark:text-white hover:text-[#e4002b] transition-colors cursor-pointer line-clamp-1"
                      >
                        {s ? s.title : 'AirBus Stay'}
                      </h3>

                      <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-[#e4002b]" />
                        <span>{s ? s.location : 'Kenya'}</span>
                      </div>

                      <div className="mt-2.5 p-2.5 bg-stone-50 dark:bg-stone-900/60 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between text-stone-700 dark:text-stone-300 font-medium">
                          <span>Dates:</span>
                          <span>{b.checkIn} → {b.checkOut}</span>
                        </div>
                        <div className="flex justify-between text-stone-500">
                          <span>Guests:</span>
                          <span>{b.guests} {b.guests === 1 ? 'guest' : 'guests'}</span>
                        </div>
                        {b.note && (
                          <div className="text-[11px] text-stone-400 italic pt-1 border-t border-stone-200 dark:border-stone-800">
                            Note to host: "{b.note}"
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                      <button
                        onClick={() => onChatHost(b.stayId)}
                        className="px-3 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 rounded-full text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Message Host</span>
                      </button>

                      {isConfirmed && (
                        <button
                          onClick={() => handleExportICS(b)}
                          className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-full text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>.ICS Calendar</span>
                        </button>
                      )}

                      {tripFilter === 'upcoming' && (
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to cancel this trip? Cancellation is free before check-in.')) {
                              onCancelBooking(b.id);
                            }
                          }}
                          className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ml-auto"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WISHLIST */}
      {activeTab === 'wishlist' && (
        <div>
          {savedStays.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-300 dark:border-stone-800">
              <Heart className="w-10 h-10 text-[#ff2e93] mx-auto mb-3" />
              <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">No saved stays in your wishlist</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                Click the heart icon on any video stay in the feed or shorts to save it for quick review and booking.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedStays.map(s => (
                <StayCard
                  key={s.id}
                  stay={s}
                  isSaved={true}
                  onToggleSave={onToggleSave}
                  onSelectStay={onSelectStay}
                  onCheckAvailability={onCheckAvailability}
                  onBookNow={onBookNow}
                  onChatHost={onChatHost}
                  onNegotiate={onNegotiate}
                  onHover={() => {}}
                  currency={currency}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: NEGOTIATIONS & MESSAGES */}
      {activeTab === 'messages' && (
        <div className="space-y-4">
          {threads.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#15171e] rounded-3xl border border-dashed border-stone-300 dark:border-stone-800">
              <MessageSquare className="w-10 h-10 text-stone-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">No conversations or offers yet</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                Use the "Negotiate" or "Chat Host" buttons on any stay to send your counter-offer or ask questions.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {threads.map(t => {
                const s = stayMap.get(t.stayId);
                const lastMsg = t.messages[t.messages.length - 1];
                const hasPendingOffer = t.messages.some(
                  m => (m.type === 'offer' || m.type === 'counter') && m.status === 'pending'
                );

                return (
                  <div
                    key={t.id}
                    onClick={() => onChatHost(t.stayId)}
                    className="p-4 bg-white dark:bg-[#15171e] rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-[#ff2e93]/50 shadow-sm transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {t.unreadGuest && (
                          <span className="w-2 h-2 rounded-full bg-[#ff2e93] animate-pulse" />
                        )}
                        <h4 className="text-sm font-bold text-stone-900 dark:text-white">
                          {s ? s.title : `Stay ${t.stayId}`}
                        </h4>
                        {hasPendingOffer && (
                          <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                            Pending Offer
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-1">
                        {lastMsg ? (
                          lastMsg.type === 'offer' || lastMsg.type === 'counter' ? (
                            <span className="font-semibold text-[#ff2e93]">
                              {lastMsg.type === 'counter' ? 'Counter-offer:' : 'Offer:'} {s?.currency || 'KES'} {lastMsg.amount?.toLocaleString()} ({lastMsg.status})
                            </span>
                          ) : (
                            <span>{lastMsg.from === 'host' ? 'Host: ' : 'You: '} {lastMsg.text}</span>
                          )
                        ) : (
                          'No messages yet.'
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button className="px-3.5 py-1.5 bg-[#e4002b] text-white rounded-full text-xs font-bold hover:bg-[#c90026] transition-colors">
                        Open Chat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RECOMMENDED FOR YOU */}
      {activeTab === 'recommended' && (
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-stone-900 dark:text-white">Curated for your preferences</h3>
            <p className="text-xs text-stone-500">Based on your highest-rated stay views and wishlist saves.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendedStays.map(s => (
              <StayCard
                key={s.id}
                stay={s}
                isSaved={wishlistIds.includes(s.id)}
                onToggleSave={onToggleSave}
                onSelectStay={onSelectStay}
                onCheckAvailability={onCheckAvailability}
                onBookNow={onBookNow}
                onChatHost={onChatHost}
                onNegotiate={onNegotiate}
                onHover={() => {}}
                currency={currency}
              />
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PROFILE SETTINGS */}
      {activeTab === 'profile' && (
        <div className="max-w-xl mx-auto bg-white dark:bg-[#15171e] p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-stone-100 dark:border-stone-800">
            <div className="w-12 h-12 rounded-full bg-[#e4002b] text-white font-extrabold text-lg flex items-center justify-center">
              {user.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">{user.name}</h3>
              <div className="text-xs text-stone-400">{user.email} · Role: {user.role}</div>
            </div>
          </div>

          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+254 712 345 678"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Nairobi, Kenya"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">Languages</label>
                <input
                  type="text"
                  value={languages}
                  onChange={e => setLanguages(e.target.value)}
                  placeholder="e.g. English, Swahili"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={3}
                placeholder="Tell hosts a little about yourself..."
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-[#e4002b]"
              />
            </div>

            {profileMsg && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-xs text-emerald-800 dark:text-emerald-300 rounded-xl">
                {profileMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-2.5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
            >
              {savingProfile ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
