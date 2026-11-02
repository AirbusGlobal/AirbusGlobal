import React, { useState, useEffect, useId } from 'react';
import {
  Heart,
  Eye,
  Phone,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Lock,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  Filter,
  UserPlus,
  Info,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Flame,
  Camera,
  Calendar,
  Compass,
} from 'lucide-react';
import {
  TripDatingProfile,
  TripDatingPaymentRequest,
  TripDatingGender,
  TripDatingIntention,
} from '../../types';
import { api } from '../../api';

interface TripDatingPageProps {
  currentUser?: any;
  onNavigateToStays?: () => void;
  onOpenAuth?: () => void;
}

const PRESET_PHOTOS = {
  female: [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
  ],
  male: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80',
  ],
};

export const TripDatingPage: React.FC<TripDatingPageProps> = ({
  currentUser,
  onNavigateToStays,
  onOpenAuth,
}) => {
  // Session id stored in localStorage to preserve unlocks across reloads
  const [sessionId, setSessionId] = useState<string>(() => {
    let s = localStorage.getItem('airbus_dating_session_id');
    if (!s) {
      s = 'sess_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('airbus_dating_session_id', s);
    }
    return s;
  });

  const [profiles, setProfiles] = useState<TripDatingProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedIntention, setSelectedIntention] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 3-Step Guided Entry Modal (shown once or on click "Find My Match")
  const [showGuidedEntry, setShowGuidedEntry] = useState<boolean>(false);
  const [guidedStep, setGuidedStep] = useState<number>(1);
  const [guidedGender, setGuidedGender] = useState<'male' | 'female' | 'other'>('female');
  const [guidedGoal, setGuidedGoal] = useState<'search' | 'become'>('search');
  const [guidedCity, setGuidedCity] = useState<string>('Nairobi');

  // "Become a Trip Date" Free Registration Modal
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [regForm, setRegForm] = useState({
    fullName: '',
    phoneNumber: '',
    gender: 'female' as TripDatingGender,
    age: 26,
    dob: '1998-05-15',
    city: 'Nairobi',
    location: 'Westlands, Nairobi',
    description: '',
    lookingFor: '',
    datingIntention: 'dating_companionship' as TripDatingIntention,
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    ],
  });
  const [customPhotoInput, setCustomPhotoInput] = useState<string>('');
  const [registering, setRegistering] = useState<boolean>(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // "See Contact · KES 50" Payment Modal
  const [selectedProfileForContact, setSelectedProfileForContact] = useState<TripDatingProfile | null>(null);
  const [payerPhone, setPayerPhone] = useState<string>('');
  const [transactionCode, setTransactionCode] = useState<string>('');
  const [paymentSubmitting, setPaymentSubmitting] = useState<boolean>(false);
  const [paymentMsg, setPaymentMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Lightbox Photo Viewer Modal
  const [lightboxData, setLightboxData] = useState<{
    photos: string[];
    currentIndex: number;
    profileName: string;
  } | null>(null);

  // Active Unlocks tracking with live countdowns
  // Map profileId -> remaining seconds
  const [activeCountdowns, setActiveCountdowns] = useState<Record<string, number>>({});
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Fetch profiles
  const loadProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getTripDatingProfiles({
        gender: selectedGender,
        city: selectedCity,
        search: searchQuery,
        intention: selectedIntention,
        sessionId,
      });
      setProfiles(res.profiles || []);

      // Initialize countdowns for unlocked profiles
      const newCountdowns: Record<string, number> = {};
      res.profiles.forEach(p => {
        if (p.isUnlocked && p.unlockExpiresAt) {
          const remaining = Math.max(0, Math.round((p.unlockExpiresAt - Date.now()) / 1000));
          if (remaining > 0) {
            newCountdowns[p.id] = remaining;
          }
        }
      });
      setActiveCountdowns(newCountdowns);
    } catch (err: any) {
      setError(err.message || 'Failed to load dating profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [selectedGender, selectedCity, selectedIntention]);

  // Periodic 1-second interval to update 10-minute countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveCountdowns(prev => {
        let changed = false;
        const next: Record<string, number> = {};
        for (const [id, secs] of Object.entries(prev)) {
          if (secs > 1) {
            next[id] = secs - 1;
            changed = true;
          } else if (secs === 1) {
            // Relock after 10 minutes expire
            changed = true;
            // Refetch this profile to update masked phone
            api.getTripDatingProfile(id, sessionId).then(res => {
              setProfiles(curr => curr.map(p => (p.id === id ? res.profile : p)));
            }).catch(() => {});
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionId]);

  // Handle Like
  const handleLike = async (profileId: string) => {
    try {
      const res = await api.likeTripDatingProfile(profileId);
      setProfiles(prev =>
        prev.map(p =>
          p.id === profileId
            ? { ...p, likes: res.totalLikes, isLikedByViewer: res.liked }
            : p
        )
      );
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  // Record View on photo interaction or click
  const handleRecordView = async (profileId: string) => {
    try {
      const res = await api.viewTripDatingProfile(profileId);
      setProfiles(prev =>
        prev.map(p => (p.id === profileId ? { ...p, views: res.views } : p))
      );
    } catch (err) {
      console.error('View error:', err);
    }
  };

  // Submit KES 50 Contact Request
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileForContact) return;
    if (!payerPhone.trim() || !transactionCode.trim()) {
      setPaymentMsg({ type: 'error', text: 'Please fill in both your phone number and M-Pesa transaction code.' });
      return;
    }

    try {
      setPaymentSubmitting(true);
      setPaymentMsg(null);
      const res = await api.requestTripDatingContact({
        profileId: selectedProfileForContact.id,
        payerPhone: payerPhone.trim(),
        transactionCode: transactionCode.trim().toUpperCase(),
        clientSessionId: sessionId,
      });

      setPaymentMsg({
        type: 'success',
        text: res.message || 'Payment submitted! Admin will verify M-Pesa Till 943210 and unlock this contact for 10 minutes.',
      });

      setTimeout(() => {
        // Poll for unlock or close modal
        setSelectedProfileForContact(null);
        setTransactionCode('');
        loadProfiles();
      }, 3500);
    } catch (err: any) {
      setPaymentMsg({ type: 'error', text: err.message || 'Failed to submit payment request.' });
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Submit Free Registration
  const handleRegisterProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setRegistering(true);
      setRegError(null);
      setRegSuccess(null);

      const res = await api.createTripDatingProfile(regForm);
      setRegSuccess(res.message);
      loadProfiles();

      setTimeout(() => {
        setShowRegisterModal(false);
        setRegSuccess(null);
        setRegForm({
          fullName: '',
          phoneNumber: '',
          gender: 'female',
          age: 26,
          dob: '1998-05-15',
          city: 'Nairobi',
          location: 'Westlands, Nairobi',
          description: '',
          lookingFor: '',
          datingIntention: 'dating_companionship',
          photos: [
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
          ],
        });
      }, 3000);
    } catch (err: any) {
      setRegError(err.message || 'Registration failed. Check content policy guidelines.');
    } finally {
      setRegistering(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhone(text);
    setTimeout(() => setCopiedPhone(null), 2500);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-24 selection:bg-rose-500 selection:text-white">
      {/* Top Banner / Slogan Header */}
      <div className="relative overflow-hidden bg-gradient-to-b from-rose-950/40 via-neutral-900 to-neutral-950 border-b border-rose-900/20 pt-8 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider mb-4 animate-pulse">
            <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            Verified AirBus Singles Near You
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3">
            Trip Dating <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-500">– A Dating Services Near You</span>
          </h1>

          <p className="text-base sm:text-lg font-medium text-rose-200/90 max-w-2xl mx-auto tracking-wide">
            <span className="text-emerald-400 font-bold">FREE TO JOIN.</span>{' '}
            <span className="text-rose-300 font-bold">ENDLESS TO DISCOVER.</span>{' '}
            <span className="text-amber-300 font-bold">KES 50 TO CONNECT.</span>
          </p>

          <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-xl mx-auto">
            Connect directly with verified Kenyan travelers, urban professionals, and stay lovers. All contact numbers are protected and verified via M-Pesa Till 943210.
          </p>

          {/* Action CTAs */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setShowRegisterModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-sm shadow-lg shadow-rose-950/50 transition duration-150 active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              Become a Trip Date · Free Forever
            </button>

            <button
              onClick={() => {
                setShowGuidedEntry(true);
                setGuidedStep(1);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/60 text-neutral-200 font-medium text-sm transition duration-150 active:scale-95"
            >
              <Compass className="w-4 h-4 text-rose-400" />
              3-Step Match Finder
            </button>
          </div>
        </div>
      </div>

      {/* Safety Policy Disclaimer Strip */}
      <div className="bg-neutral-900/60 border-y border-neutral-800/60 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong className="text-neutral-200">Safety Shield:</strong> Automated content filtration ensures zero adult solicitation, zero commercial merchandise, and zero accommodation spam.
            </span>
          </div>
          <span className="hidden sm:inline text-neutral-500">M-Pesa Till 943210 · Buy Goods</span>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
        {/* Filter Bar */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 mb-6 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by name, hobby, neighborhood..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadProfiles()}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Quick Filter Selects */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <select
                value={selectedGender}
                onChange={e => setSelectedGender(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-medium text-neutral-300 focus:outline-none focus:border-rose-500"
              >
                <option value="all">All Genders</option>
                <option value="female">Women</option>
                <option value="male">Men</option>
              </select>

              <select
                value={selectedCity}
                onChange={e => setSelectedCity(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-medium text-neutral-300 focus:outline-none focus:border-rose-500"
              >
                <option value="all">All Kenya</option>
                <option value="Nairobi">Nairobi</option>
                <option value="Mombasa">Mombasa</option>
                <option value="Nakuru">Nakuru</option>
                <option value="Eldoret">Eldoret</option>
                <option value="Kisumu">Kisumu</option>
              </select>

              <select
                value={selectedIntention}
                onChange={e => setSelectedIntention(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-medium text-neutral-300 focus:outline-none focus:border-rose-500"
              >
                <option value="all">All Dating Goals</option>
                <option value="dating_companionship">Dating & Companionship</option>
                <option value="serious_relationship">Serious Relationship</option>
                <option value="travel_partner">Travel Partner</option>
                <option value="friendship">Friendship</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-neutral-400 text-sm">Discovering verified singles near you...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-2xl p-6 text-center text-red-300 mb-8">
            <AlertCircle className="w-8 h-8 mx-auto text-red-400 mb-2" />
            <p className="font-semibold">{error}</p>
            <button
              onClick={loadProfiles}
              className="mt-3 px-4 py-1.5 rounded-lg bg-red-800/50 hover:bg-red-700/50 text-xs font-medium text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && profiles.length === 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-10 text-center max-w-md mx-auto">
            <Flame className="w-12 h-12 text-rose-500/40 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-neutral-200">No profiles match this filter</h3>
            <p className="text-xs text-neutral-400 mt-1 mb-6">
              Try adjusting your gender, city or keyword filters, or be the first in this area!
            </p>
            <button
              onClick={() => {
                setSelectedGender('all');
                setSelectedCity('all');
                setSelectedIntention('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-xl text-neutral-200"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Endless Discovery Vertical Feed */}
        {!loading && !error && profiles.length > 0 && (
          <div className="space-y-8">
            {profiles.map(profile => {
              const countdownSeconds = activeCountdowns[profile.id] || 0;
              const isLocallyUnlocked = profile.isUnlocked || countdownSeconds > 0;

              return (
                <article
                  key={profile.id}
                  className="bg-neutral-900/90 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl transition hover:border-neutral-700/80"
                >
                  {/* Photo Gallery Viewer (up to 4 photos) */}
                  <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-neutral-950 overflow-hidden group">
                    <img
                      src={profile.primaryPhoto || profile.photos[0]}
                      alt={profile.fullName}
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105 cursor-pointer"
                      onClick={() => {
                        handleRecordView(profile.id);
                        setLightboxData({
                          photos: profile.photos,
                          currentIndex: 0,
                          profileName: profile.fullName,
                        });
                      }}
                    />

                    {/* Gradient Overlay for text contrast */}
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/30 pointer-events-none" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium text-emerald-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Verified Member
                      </span>

                      <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-medium text-neutral-300">
                        {profile.photos.length} {profile.photos.length === 1 ? 'Photo' : 'Photos'}
                      </span>
                    </div>

                    {/* Bottom Gallery Thumbnail Bar */}
                    {profile.photos.length > 1 && (
                      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 p-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
                        {profile.photos.map((photoUrl, idx) => (
                          <button
                            key={idx}
                            onClick={e => {
                              e.stopPropagation();
                              handleRecordView(profile.id);
                              setLightboxData({
                                photos: profile.photos,
                                currentIndex: idx,
                                profileName: profile.fullName,
                              });
                            }}
                            className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 hover:border-rose-400 transition"
                          >
                            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Tap to expand hint */}
                    <button
                      onClick={() => {
                        handleRecordView(profile.id);
                        setLightboxData({
                          photos: profile.photos,
                          currentIndex: 0,
                          profileName: profile.fullName,
                        });
                      }}
                      className="absolute bottom-3 right-3 px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[11px] text-neutral-300 hover:text-white transition flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      View Gallery
                    </button>
                  </div>

                  {/* Profile Details Body */}
                  <div className="p-5 sm:p-6 space-y-4">
                    {/* Header: Name, Age, Location & Counters */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-bold text-white tracking-tight">
                            {profile.fullName}, <span className="text-rose-400 font-medium">{profile.age}</span>
                          </h2>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>{profile.location || profile.city}</span>
                        </div>
                      </div>

                      {/* Views & Likes stats */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 text-xs">
                          <Eye className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{profile.views || 0}</span>
                        </div>

                        <button
                          onClick={() => handleLike(profile.id)}
                          className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition active:scale-95 ${
                            profile.isLikedByViewer
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-neutral-800 text-neutral-300 hover:text-rose-400 border border-neutral-700/60'
                          }`}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${
                              profile.isLikedByViewer ? 'fill-rose-400 text-rose-400' : ''
                            }`}
                          />
                          <span>{profile.likes || 0}</span>
                        </button>
                      </div>
                    </div>

                    {/* Dating Goal Tag */}
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
                        <Sparkles className="w-3 h-3 text-rose-400" />
                        {profile.datingIntention === 'serious_relationship' && 'Looking for Serious Relationship'}
                        {profile.datingIntention === 'dating_companionship' && 'Dating & Companionship'}
                        {profile.datingIntention === 'travel_partner' && 'Travel & Adventure Partner'}
                        {profile.datingIntention === 'friendship' && 'Meaningful Friendship'}
                      </span>
                    </div>

                    {/* Bio Description */}
                    <p className="text-sm text-neutral-300 leading-relaxed font-normal">
                      {profile.description}
                    </p>

                    {/* Looking For snippet */}
                    {profile.lookingFor && (
                      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-3.5 text-xs text-neutral-300">
                        <span className="font-semibold text-rose-400 block mb-1">What I am looking for:</span>
                        {profile.lookingFor}
                      </div>
                    )}

                    {/* Contact Access Section: 10-Minute Countdown OR KES 50 Unlock CTA */}
                    <div className="pt-2 border-t border-neutral-800/80">
                      {isLocallyUnlocked ? (
                        <div className="bg-gradient-to-r from-emerald-950/50 to-neutral-900 border border-emerald-500/40 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                                Contact Unlocked (Live)
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-800/40 px-2.5 py-1 rounded-lg">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>{formatCountdown(countdownSeconds || 600)} remaining</span>
                            </div>
                          </div>

                          {/* Revealed Phone Number */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-950 border border-neutral-800 rounded-xl p-3">
                            <div className="flex items-center gap-2.5">
                              <Phone className="w-4 h-4 text-emerald-400" />
                              <span className="font-mono text-base font-bold text-white tracking-wide">
                                {profile.phoneNumber}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => copyToClipboard(profile.phoneNumber || '')}
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                {copiedPhone === profile.phoneNumber ? 'Copied!' : 'Copy'}
                              </button>

                              <a
                                href={`tel:${profile.phoneNumber?.replace(/\s+/g, '')}`}
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                Call
                              </a>

                              <a
                                href={`https://wa.me/${profile.phoneNumber?.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-xs font-semibold text-white transition"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                WhatsApp
                              </a>
                            </div>
                          </div>

                          <p className="text-[11px] text-neutral-400">
                            Verified via Till 943210. This contact window automatically closes when the timer reaches 00:00 to protect member privacy.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-950/80 border border-neutral-800 rounded-2xl p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
                              <Lock className="w-5 h-5 text-rose-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold text-neutral-400 tracking-wider">
                                  {profile.phoneNumber || '+254 7•• ••• •••'}
                                </span>
                                <span className="text-[11px] font-medium text-neutral-500">(Protected)</span>
                              </div>
                              <p className="text-[11px] text-neutral-500">
                                10-minute temporary unlock via M-Pesa Buy Goods Till 943210
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedProfileForContact(profile);
                              setPayerPhone(currentUser?.phone || '');
                              setPaymentMsg(null);
                            }}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-rose-950/40 transition active:scale-95 shrink-0"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            SEE CONTACT · KES 50
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* 3-Step Guided Entry Modal */}
      {showGuidedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowGuidedEntry(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-full bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Stepper Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center justify-center">
                  {guidedStep}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Step {guidedStep} of 3
                </span>
              </div>
              <span className="text-xs text-rose-400 font-medium">Quick Discovery</span>
            </div>

            {/* Step 1: Identity */}
            {guidedStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Who are you looking to meet?</h3>
                <p className="text-xs text-neutral-400">
                  Choose your dating preferences to personalize your feed.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => {
                      setGuidedGender('female');
                      setSelectedGender('female');
                      setGuidedStep(2);
                    }}
                    className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-rose-500 hover:bg-rose-950/20 text-center transition group"
                  >
                    <span className="text-3xl block mb-2">💃</span>
                    <span className="font-bold text-sm text-neutral-200 group-hover:text-rose-300">
                      Women
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setGuidedGender('male');
                      setSelectedGender('male');
                      setGuidedStep(2);
                    }}
                    className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-rose-500 hover:bg-rose-950/20 text-center transition group"
                  >
                    <span className="text-3xl block mb-2">🕺</span>
                    <span className="font-bold text-sm text-neutral-200 group-hover:text-rose-300">
                      Men
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Goal */}
            {guidedStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">What is your primary goal?</h3>
                <p className="text-xs text-neutral-400">
                  Are you here to browse dates or create your own free profile?
                </p>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => {
                      setGuidedGoal('search');
                      setGuidedStep(3);
                    }}
                    className="w-full p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-rose-500 hover:bg-rose-950/20 text-left transition flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-sm text-white block">Search for a Date</span>
                      <span className="text-xs text-neutral-400">Browse verified Kenyan singles in my area</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-neutral-500" />
                  </button>

                  <button
                    onClick={() => {
                      setShowGuidedEntry(false);
                      setShowRegisterModal(true);
                    }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 to-neutral-950 border border-rose-800/40 hover:border-rose-500 text-left transition flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-sm text-rose-300 block">Become a Date (Free)</span>
                      <span className="text-xs text-neutral-400">Publish my profile with 0 wait time</span>
                    </div>
                    <UserPlus className="w-5 h-5 text-rose-400" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Location */}
            {guidedStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Select your preferred city</h3>
                <p className="text-xs text-neutral-400">
                  We will show dating profiles living in or traveling to this city.
                </p>

                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  {['Nairobi', 'Mombasa', 'Nakuru', 'Eldoret', 'Kisumu', 'all'].map(city => (
                    <button
                      key={city}
                      onClick={() => {
                        setSelectedCity(city);
                        setShowGuidedEntry(false);
                      }}
                      className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-rose-500 text-xs font-semibold text-neutral-200 capitalize text-center transition"
                    >
                      {city === 'all' ? 'All Kenya' : city}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Photo Viewer Modal */}
      {lightboxData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
          <button
            onClick={() => setLightboxData(null)}
            className="absolute top-5 right-5 p-2 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="max-w-3xl w-full flex flex-col items-center">
            <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-black rounded-2xl overflow-hidden flex items-center justify-center">
              <img
                src={lightboxData.photos[lightboxData.currentIndex]}
                alt={lightboxData.profileName}
                className="max-h-full max-w-full object-contain"
              />

              {lightboxData.photos.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setLightboxData(prev =>
                        prev
                          ? {
                              ...prev,
                              currentIndex:
                                (prev.currentIndex - 1 + prev.photos.length) % prev.photos.length,
                            }
                          : null
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 border border-white/20 text-white hover:bg-black"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() =>
                      setLightboxData(prev =>
                        prev
                          ? {
                              ...prev,
                              currentIndex: (prev.currentIndex + 1) % prev.photos.length,
                            }
                          : null
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 border border-white/20 text-white hover:bg-black"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between w-full text-xs text-neutral-400">
              <span className="font-semibold text-white">{lightboxData.profileName}</span>
              <span>
                Photo {lightboxData.currentIndex + 1} of {lightboxData.photos.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* "See Contact · KES 50" Payment Modal */}
      {selectedProfileForContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative my-8">
            <button
              onClick={() => setSelectedProfileForContact(null)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-full bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Unlock Contact Details</h3>
                <p className="text-xs text-neutral-400">
                  Target Member:{' '}
                  <strong className="text-rose-300">{selectedProfileForContact.fullName}</strong>
                </p>
              </div>
            </div>

            {/* M-Pesa Instructions Card */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 mb-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  M-Pesa Buy Goods & Services
                </span>
                <span className="text-xs font-bold text-amber-300 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded">
                  Amount: KES 50
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-neutral-300">
                <p>1. Open M-Pesa on your phone</p>
                <p>2. Select <strong className="text-white">Lipa na M-Pesa</strong> &gt; <strong className="text-white">Buy Goods and Services</strong></p>
                <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                  <span className="text-neutral-400">Till Number:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-extrabold text-rose-400">943210</span>
                    <button
                      onClick={() => copyToClipboard('943210')}
                      className="text-xs text-neutral-400 hover:text-white"
                      title="Copy Till"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p>3. Enter Amount: <strong className="text-white">KES 50</strong></p>
                <p>4. Enter your PIN and complete transaction</p>
                <p>5. Paste the M-Pesa SMS Confirmation Code below</p>
              </div>
            </div>

            {/* Submission Form */}
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Your Phone Number (M-Pesa sender)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0712345678"
                  value={payerPhone}
                  onChange={e => setPayerPhone(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  M-Pesa Transaction Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QGH7X2K9LM"
                  value={transactionCode}
                  onChange={e => setTransactionCode(e.target.value.toUpperCase())}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase text-neutral-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              {paymentMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    paymentMsg.type === 'success'
                      ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
                      : 'bg-red-950/60 border border-red-800/60 text-red-300'
                  }`}
                >
                  {paymentMsg.text}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-rose-950/50 transition active:scale-95 disabled:opacity-50"
                >
                  {paymentSubmitting ? 'Submitting...' : 'Submit Verification · KES 50'}
                </button>
              </div>

              <p className="text-[11px] text-neutral-500 text-center">
                Upon admin verification, you will receive full phone access with a live 10:00 countdown timer.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* "Become a Trip Date" Free Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative my-8">
            <button
              onClick={() => setShowRegisterModal(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-full bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Join Trip Dating · Free</h3>
                <p className="text-xs text-rose-300 font-medium">Instant Automatic Publication</p>
              </div>
            </div>

            {/* Automated Policy Warning Banner */}
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 my-4 flex items-start gap-2.5 text-xs text-amber-200/90">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 block">Automated Content Policy Shield:</strong>
                All photos and bios must follow our safety guidelines. No explicit nudity, no merchandise sales, no drugs, and no accommodation rentals. Valid profiles go live immediately with zero manual wait time!
              </div>
            </div>

            {regError && (
              <div className="p-3 mb-4 rounded-xl bg-red-950/60 border border-red-800/60 text-xs text-red-300">
                {regError}
              </div>
            )}

            {regSuccess && (
              <div className="p-4 mb-4 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{regSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cynthia Mwangi"
                    value={regForm.fullName}
                    onChange={e => setRegForm({ ...regForm, fullName: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">
                    Phone Number (Protected)
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +254 712 345 678"
                    value={regForm.phoneNumber}
                    onChange={e => setRegForm({ ...regForm, phoneNumber: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Gender</label>
                  <select
                    value={regForm.gender}
                    onChange={e => setRegForm({ ...regForm, gender: e.target.value as any })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Age</label>
                  <input
                    type="number"
                    min={18}
                    max={99}
                    required
                    value={regForm.age}
                    onChange={e => setRegForm({ ...regForm, age: parseInt(e.target.value, 10) || 18 })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">City</label>
                  <select
                    value={regForm.city}
                    onChange={e => setRegForm({ ...regForm, city: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="Nairobi">Nairobi</option>
                    <option value="Mombasa">Mombasa</option>
                    <option value="Nakuru">Nakuru</option>
                    <option value="Eldoret">Eldoret</option>
                    <option value="Kisumu">Kisumu</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Neighborhood / Location
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Westlands & Kilimani, Nairobi"
                  value={regForm.location}
                  onChange={e => setRegForm({ ...regForm, location: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Dating Goal</label>
                <select
                  value={regForm.datingIntention}
                  onChange={e => setRegForm({ ...regForm, datingIntention: e.target.value as any })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="dating_companionship">Dating & Companionship</option>
                  <option value="serious_relationship">Serious Relationship</option>
                  <option value="travel_partner">Travel & Adventure Partner</option>
                  <option value="friendship">Meaningful Friendship</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">About Me (Bio)</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Tell us about yourself, your passions, weekend activities..."
                  value={regForm.description}
                  onChange={e => setRegForm({ ...regForm, description: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  What are you looking for?
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. An ambitious, kind partner who loves weekend road trips"
                  value={regForm.lookingFor}
                  onChange={e => setRegForm({ ...regForm, lookingFor: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Photos Selection */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">
                  Photos (Up to 4 · Select from curated presets or add custom image URL)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(regForm.gender === 'male' ? PRESET_PHOTOS.male : PRESET_PHOTOS.female).map(
                    (url, idx) => {
                      const isSelected = regForm.photos.includes(url);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setRegForm({
                                ...regForm,
                                photos: regForm.photos.filter(p => p !== url),
                              });
                            } else {
                              if (regForm.photos.length >= 4) {
                                alert('Maximum of 4 photos per member profile allowed.');
                                return;
                              }
                              setRegForm({
                                ...regForm,
                                photos: [...regForm.photos, url],
                              });
                            }
                          }}
                          className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 transition ${
                            isSelected
                              ? 'border-rose-500 ring-2 ring-rose-500/50'
                              : 'border-neutral-800 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          {isSelected && (
                            <span className="absolute top-1 right-1 bg-rose-600 rounded-full p-0.5 text-white">
                              <CheckCircle2 className="w-3 h-3" />
                            </span>
                          )}
                        </button>
                      );
                    }
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Or paste custom image URL..."
                    value={customPhotoInput}
                    onChange={e => setCustomPhotoInput(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!customPhotoInput.trim()) return;
                      if (regForm.photos.length >= 4) {
                        alert('Maximum of 4 photos allowed.');
                        return;
                      }
                      setRegForm({
                        ...regForm,
                        photos: [...regForm.photos, customPhotoInput.trim()],
                      });
                      setCustomPhotoInput('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={registering || regForm.photos.length === 0}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-rose-950/50 transition active:scale-95 disabled:opacity-50"
                >
                  {registering ? 'Validating Policy & Publishing...' : 'Publish Profile Instantly · Free'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
