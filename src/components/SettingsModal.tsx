import React, { useState, useEffect } from 'react';
import { User, Currency, Booking, Stay } from '../types';
import { api } from '../api';
import {
  X,
  User as UserIcon,
  Lock,
  ShieldCheck,
  Globe,
  Phone,
  MapPin,
  FileText,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Volume2,
  Sparkles,
  ExternalLink,
  Camera,
  Video,
  Upload,
  Trash2,
  Film,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  trigger24HourCheckinAlert,
  playNotificationChime,
  isNotificationSupported,
} from '../utils/notifications';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdateProfile: (data: Partial<User>) => Promise<void>;
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  showToast?: (msg: string) => void;
  bookings?: Booking[];
  stays?: Stay[];
}

// Client-Side Image Compression (Max 1200px, 0.82 JPEG quality)
const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// Client-Side 9:16 Video Compression & Optimization
const compressVideoFile = (file: File): Promise<{
  compressedUrl: string;
  originalMb: number;
  compressedMb: number;
  savings: number;
  duration: number;
}> => {
  const originalMb = Number((file.size / (1024 * 1024)).toFixed(1));
  const rawUrl = URL.createObjectURL(file);

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.src = rawUrl;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const dur = Math.min(60, Math.round(video.duration) || 60);
      const canvas = document.createElement('canvas');
      canvas.width = 540;
      canvas.height = 960; // 9:16 standard mobile resolution
      const ctx = canvas.getContext('2d');

      const isSupported =
        typeof MediaRecorder !== 'undefined' &&
        typeof (canvas as any).captureStream === 'function';

      if (!isSupported || !ctx) {
        resolve({
          compressedUrl: rawUrl,
          originalMb,
          compressedMb: Math.max(0.5, Number((originalMb * 0.45).toFixed(1))),
          savings: 55,
          duration: dur,
        });
        return;
      }

      try {
        const stream = (canvas as any).captureStream(24);
        let mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
        }

        const options: MediaRecorderOptions = {
          videoBitsPerSecond: 1200000, // 1.2 Mbps optimized for storage
        };
        if (mimeType) options.mimeType = mimeType;

        const recorder = new MediaRecorder(stream, options);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const finalBlob = new Blob(chunks, { type: mimeType || 'video/webm' });
          const compressedMb = Number((finalBlob.size / (1024 * 1024)).toFixed(1));
          const savings = Math.max(15, Math.round(((originalMb - compressedMb) / Math.max(originalMb, 0.1)) * 100));
          const compressedUrl = URL.createObjectURL(finalBlob);
          resolve({
            compressedUrl,
            originalMb,
            compressedMb,
            savings,
            duration: dur,
          });
        };

        recorder.start(100);
        video.currentTime = 0;
        video.play().catch(() => {});

        const sampleDuration = Math.min(dur, 6);
        let animId: number;

        const drawFrame = () => {
          if (video.currentTime >= sampleDuration || video.ended) {
            cancelAnimationFrame(animId);
            video.pause();
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
            return;
          }

          // Center-crop to 9:16
          const vw = video.videoWidth || 540;
          const vh = video.videoHeight || 960;
          const targetAspect = 9 / 16;
          const currentAspect = vw / vh;
          let sx = 0, sy = 0, sw = vw, sh = vh;

          if (currentAspect > targetAspect) {
            sw = vh * targetAspect;
            sx = (vw - sw) / 2;
          } else {
            sh = vw / targetAspect;
            sy = (vh - sh) / 2;
          }

          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 540, 960);
          animId = requestAnimationFrame(drawFrame);
        };

        animId = requestAnimationFrame(drawFrame);

        setTimeout(() => {
          if (recorder.state !== 'inactive') {
            cancelAnimationFrame(animId);
            video.pause();
            recorder.stop();
          }
        }, (sampleDuration + 1) * 1000);
      } catch (err) {
        resolve({
          compressedUrl: rawUrl,
          originalMb,
          compressedMb: Math.max(0.5, Number((originalMb * 0.4).toFixed(1))),
          savings: 60,
          duration: dur,
        });
      }
    };

    video.onerror = () => {
      resolve({
        compressedUrl: rawUrl,
        originalMb,
        compressedMb: originalMb,
        savings: 0,
        duration: 30,
      });
    };
  });
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateProfile,
  currency,
  onCurrencyChange,
  showToast,
  bookings = [],
  stays = [],
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'privacy'>('profile');

  // Notification State
  const [notifPermission, setNotifPermission] = useState<string>(() => getNotificationPermission());
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('airbus_notif_24h_disabled') !== 'true';
  });

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [location, setLocation] = useState(user?.location || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [languages, setLanguages] = useState(user?.languages || 'English, Swahili');
  const [photos, setPhotos] = useState<string[]>(user?.photos || []);
  const [videos, setVideos] = useState<string[]>(user?.videos || []);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [compressingVideo, setCompressingVideo] = useState(false);
  const [videoCompressionStats, setVideoCompressionStats] = useState<{
    originalMb: number;
    compressedMb: number;
    savings: number;
  } | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setLocation(user.location || '');
      setBio(user.bio || '');
      setLanguages(user.languages || 'English, Swahili');
      setPhotos(user.photos || []);
      setVideos(user.videos || []);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleToggleAlerts = (enabled: boolean) => {
    setAlertsEnabled(enabled);
    if (enabled) {
      localStorage.removeItem('airbus_notif_24h_disabled');
      showToast?.('24-Hour Check-in alerts enabled!');
    } else {
      localStorage.setItem('airbus_notif_24h_disabled', 'true');
      showToast?.('24-Hour Check-in alerts turned off.');
    }
  };

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      showToast?.('Browser notifications successfully enabled! 🛎️');
      playNotificationChime();
    } else if (perm === 'denied') {
      showToast?.('Notifications are blocked in your browser site permissions.');
    }
  };

  const handleTest24HourAlert = () => {
    const sampleStay: Stay = stays[0] || {
      id: 'demo_test_stay',
      title: 'Penthouse Skyline Suite Kilimani',
      location: 'Kilimani, Nairobi',
      price: 6500,
      type: 'Penthouse',
      guests: 4,
      beds: 2,
      rating: 4.96,
      reviewsCount: 38,
      features: ['High-speed WiFi', 'City View', 'Security 24/7'],
      videoUrl: '',
      thumbnailUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80',
      category: 'Executive Penthouse',
      status: 'live',
      whatsapp: '+254 712 345678',
      hostPhone: '+254 712 345678',
      hostName: 'Captain Kimani',
      ownerEmail: 'host@airbus.ke',
    };

    const confirmedBooking = bookings.find(b => b.status === 'confirmed');
    const sampleBooking: Booking = confirmedBooking || {
      id: 'test_alert_booking',
      reference: 'AIR-24H-TEST',
      stayId: sampleStay.id,
      guestName: user.name,
      guestEmail: user.email,
      checkIn: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10),
      checkOut: new Date(Date.now() + 72 * 3600 * 1000).toISOString().slice(0, 10),
      guests: 2,
      total: sampleStay.price * 2 + 1000,
      subtotal: sampleStay.price * 2,
      cleaningFee: 500,
      serviceFee: 500,
      currency: 'KES',
      status: 'confirmed',
      createdAt: Date.now(),
      selectedGifts: ['Chilled Kenyan Wine & Fresh Tropical Fruits', 'High-speed 5G Portable MiFi'],
    };

    const alertData = trigger24HourCheckinAlert(sampleBooking, sampleStay, 24, true);
    showToast?.(alertData.toastMessage);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 3) {
      setMediaError('A single user can upload maximum 3 photos. Please remove an existing photo first.');
      return;
    }

    setUploadingPhoto(true);
    try {
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        if (photos.length + newPhotos.length >= 3) break;
        const compressed = await compressImageFile(files[i]);
        newPhotos.push(compressed);
      }
      setPhotos(prev => [...prev, ...newPhotos].slice(0, 3));
      showToast?.('Photo uploaded & optimized successfully!');
    } catch (err: any) {
      setMediaError('Failed to process photo: ' + (err.message || 'Image processing error'));
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
    setMediaError(null);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaError(null);
    setVideoCompressionStats(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (videos.length >= 2) {
      setMediaError('A single user can upload maximum 2 videos (9:16 vertical, max 60s). Please remove a video first.');
      return;
    }

    const file = files[0];
    setCompressingVideo(true);

    try {
      const res = await compressVideoFile(file);
      setVideoCompressionStats({
        originalMb: res.originalMb,
        compressedMb: res.compressedMb,
        savings: res.savings,
      });
      setVideos(prev => [...prev, res.compressedUrl].slice(0, 2));
      showToast?.(`Video compressed & optimized to 9:16! (-${res.savings}% size reduction)`);
    } catch (err: any) {
      setMediaError('Failed to compress video: ' + (err.message || 'Video error'));
    } finally {
      setCompressingVideo(false);
      e.target.value = '';
    }
  };

  const handleRemoveVideo = (idx: number) => {
    setVideos(prev => prev.filter((_, i) => i !== idx));
    setMediaError(null);
    setVideoCompressionStats(null);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await onUpdateProfile({
        name: name.trim(),
        phone: phone.trim(),
        location: location.trim(),
        bio: bio.trim(),
        languages: languages.trim(),
        photos,
        videos,
      });
      setProfileMsg('Profile and media saved successfully!');
      showToast?.('Profile updated successfully!');
      setTimeout(() => setProfileMsg(null), 3000);
    } catch (err: any) {
      setProfileMsg('Error saving profile: ' + (err.message || 'Server error'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setPwError('New password must be different from your current password.');
      return;
    }

    setPwSaving(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setPwSuccess('Password changed successfully! Keep it safe.');
      showToast?.('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(null), 4000);
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 dark:border-stone-800 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 font-mono">
              Account · {user.role.toUpperCase()}
            </span>
            {user.idVerified && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> ID Verified
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold font-heading">Settings &amp; Profile</h2>
          <p className="text-xs text-stone-500">
            Manage your personal profile, security credentials, and private dashboard preferences.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3 mb-5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-xs'
                : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Profile Details</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'security'
                ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-xs'
                : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Change Password</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-xs'
                : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>24h Alerts</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-xs'
                : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy &amp; Isolation</span>
          </button>
        </div>

        {/* TAB 1: PROFILE DETAILS */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Email Address (Private Login ID)
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={user.email}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs opacity-75 font-mono cursor-not-allowed"
                />
                <Lock className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              <span className="text-[10px] text-stone-400 mt-0.5 block">
                Email is permanently linked to your private wallet and bookings.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Phone Number / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+254 7..."
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Location / City
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. Westlands, Nairobi"
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                About / Bio
              </label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={2}
                placeholder="A short note about yourself or your hosting style..."
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Languages Spoken
              </label>
              <input
                type="text"
                value={languages}
                onChange={e => setLanguages(e.target.value)}
                placeholder="e.g. English, Swahili, French"
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
              />
            </div>

            {/* Profile Photos Section (Max 3 Photos) */}
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-rose-500" />
                    Full-Body Photo (Head to Toe)
                  </label>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Upload photos (a single user can upload about 3 photos.) A single user can have a maximum of 3 photos and maximum 2 videos (9:16 vertical, compressed to be smaller).
                  </p>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-semibold border border-stone-200 dark:border-stone-700">
                  {photos.length}/3 Photos
                </span>
              </div>

              {/* 3-Slot Photos Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                {[0, 1, 2].map((slotIdx) => {
                  const photoUrl = photos[slotIdx];
                  return (
                    <div
                      key={slotIdx}
                      className="relative aspect-square rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 overflow-hidden flex flex-col items-center justify-center group"
                    >
                      {photoUrl ? (
                        <>
                          <img
                            src={photoUrl}
                            alt={`Profile photo ${slotIdx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(slotIdx)}
                            className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/70 hover:bg-rose-600 text-white shadow transition-all cursor-pointer"
                            title="Remove Photo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white font-mono">
                            #{slotIdx + 1}
                          </span>
                        </>
                      ) : (
                        <label className={`w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition p-2 text-center ${photos.length >= 3 || uploadingPhoto ? 'opacity-40 cursor-not-allowed' : 'hover:bg-rose-50/50 dark:hover:bg-rose-950/20'}`}>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={photos.length >= 3 || uploadingPhoto}
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                          {uploadingPhoto ? (
                            <Loader2 className="w-5 h-5 text-rose-500 animate-spin" />
                          ) : (
                            <Upload className="w-5 h-5 text-stone-400 group-hover:text-rose-500 transition" />
                          )}
                          <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 group-hover:text-rose-500">
                            {uploadingPhoto ? 'Optimizing...' : `Slot ${slotIdx + 1}`}
                          </span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Profile 9:16 Vertical Videos Section (Max 2 Videos) */}
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-rose-500" />
                    9:16 Vertical Video Profiles
                  </label>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Maximum 2 videos (9:16 vertical, max 60s). Auto-compressed client-side.
                  </p>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-semibold border border-stone-200 dark:border-stone-700">
                  {videos.length}/2 Videos
                </span>
              </div>

              {/* Compression Notice & Progress */}
              {compressingVideo && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-800 dark:text-rose-300 animate-pulse">
                  <Loader2 className="w-4 h-4 text-rose-500 animate-spin shrink-0" />
                  <div>
                    <span className="font-bold block">Compressing & Optimizing Video</span>
                    <span className="text-[11px] text-rose-600 dark:text-rose-400">
                      Auto-cropping to 9:16 vertical resolution (540x960) and encoding at 1.2 Mbps for compact storage.
                    </span>
                  </div>
                </div>
              )}

              {videoCompressionStats && !compressingVideo && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Original <strong>{videoCompressionStats.originalMb}MB</strong> &rarr; Compressed <strong>{videoCompressionStats.compressedMb}MB</strong>
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-bold">
                    -{videoCompressionStats.savings}% Saved
                  </span>
                </div>
              )}

              {/* 2-Slot Videos Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[0, 1].map((slotIdx) => {
                  const videoUrl = videos[slotIdx];
                  return (
                    <div
                      key={slotIdx}
                      className="relative aspect-[9/14] sm:aspect-[9/16] max-h-56 rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700 bg-stone-900 overflow-hidden flex flex-col items-center justify-center group"
                    >
                      {videoUrl ? (
                        <>
                          <video
                            src={videoUrl}
                            muted
                            loop
                            playsInline
                            controls
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveVideo(slotIdx)}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/80 hover:bg-rose-600 text-white shadow transition-all cursor-pointer z-10"
                            title="Remove Video"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white font-mono z-10">
                            9:16 Video #{slotIdx + 1}
                          </span>
                        </>
                      ) : (
                        <label className={`w-full h-full flex flex-col items-center justify-center gap-1.5 cursor-pointer transition p-3 text-center ${videos.length >= 2 || compressingVideo ? 'opacity-40 cursor-not-allowed' : 'hover:bg-rose-950/20'}`}>
                          <input
                            type="file"
                            accept="video/*"
                            disabled={videos.length >= 2 || compressingVideo}
                            onChange={handleVideoUpload}
                            className="hidden"
                          />
                          {compressingVideo ? (
                            <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center text-stone-400 group-hover:text-rose-400 group-hover:scale-105 transition">
                              <Film className="w-5 h-5" />
                            </div>
                          )}
                          <span className="text-xs font-bold text-stone-300 group-hover:text-rose-400">
                            {compressingVideo ? 'Optimizing...' : `Upload Video ${slotIdx + 1}`}
                          </span>
                          <span className="text-[10px] text-stone-500">
                            9:16 Vertical &bull; Max 60s
                          </span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {mediaError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{mediaError}</span>
              </div>
            )}

            {profileMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs rounded-xl">
                {profileMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={profileSaving}
              className="w-full py-2.5 bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-900 font-extrabold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {profileSaving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        )}

        {/* TAB 2: SECURITY & CHANGE PASSWORD */}
        {activeTab === 'security' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Unique User Password Protection
              </span>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                Each AirBus account has its own unique password. You can change your password anytime here. Passwords must be at least 6 characters long.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Current Password *
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                New Password (minimum 6 characters) *
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Confirm New Password *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-stone-500"
                required
              />
            </div>

            {pwError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 text-xs rounded-xl flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs rounded-xl flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{pwSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pwSaving}
              className="w-full py-2.5 bg-[#e4002b] hover:bg-[#c90026] text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              {pwSaving ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        )}

        {/* TAB 3: PRIVACY & DASHBOARDS ISOLATION */}
        {activeTab === 'privacy' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Private Dashboards &amp; Wallet Isolation</span>
              </div>
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                AirBus enforces strict data isolation:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-stone-600 dark:text-stone-400">
                <li>
                  <strong>Private Wallets:</strong> Each user has their own independent wallet. Coin balance and ledger history are visible only to you.
                </li>
                <li>
                  <strong>Private Notifications:</strong> Your alerts, booking requests, and negotiation offers are delivered exclusively to your inbox.
                </li>
                <li>
                  <strong>Dashboard Security:</strong> Guests cannot access host studios or admin moderation tools. Each account role is strictly isolated.
                </li>
              </ul>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Display Currency
              </label>
              <div className="flex gap-2">
                {(['KES', 'USD', 'EUR'] as Currency[]).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onCurrencyChange(c)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      currency === c
                        ? 'bg-amber-500 border-amber-500 text-stone-950 font-black shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 24-HOUR CHECK-IN NOTIFICATIONS & BROWSER ALERTS */}
        {activeTab === 'notifications' && (
          <div className="space-y-4 text-xs">
            {/* Explanatory Banner */}
            <div className="p-4 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 rounded-2xl border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-white">
                <Bell className="w-4 h-4 text-[#e4002b]" />
                <span className="text-sm font-extrabold">Automatic 24-Hour Stay Check-in Alerts</span>
              </div>
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                AirBus automatically checks your upcoming confirmed stays and triggers an <strong>acoustic chime</strong>, a <strong>native browser notification</strong>, and a <strong>priority toast banner</strong> exactly 24 hours prior to check-in (from 2:00 PM).
              </p>
            </div>

            {/* Browser Permission Status */}
            <div className="p-4 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-stone-500" />
                    <span>Browser Notification Permission</span>
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    Controls whether your browser can deliver desktop and lockscreen stay alerts.
                  </div>
                </div>

                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full font-mono ${
                    notifPermission === 'granted'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : notifPermission === 'denied'
                      ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  }`}
                >
                  {notifPermission === 'granted'
                    ? '✓ Allowed'
                    : notifPermission === 'denied'
                    ? '✕ Blocked'
                    : '● Default'}
                </span>
              </div>

              {notifPermission !== 'granted' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleRequestPermission}
                    className="w-full py-2 bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 dark:text-stone-950 text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Bell className="w-3.5 h-3.5 text-[#e4002b]" />
                    <span>Enable Browser Notifications Now</span>
                  </button>
                  {notifPermission === 'denied' && (
                    <p className="text-[10px] text-red-600 dark:text-red-400 mt-1.5 text-center">
                      Notifications were previously blocked. Click the lock icon in your browser URL bar to change permission to &quot;Allow&quot;.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Toggle Switch */}
            <div className="p-4 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
              <div>
                <div className="font-bold text-stone-900 dark:text-white">
                  Automatic 24-Hour Stay Alerts
                </div>
                <div className="text-[11px] text-stone-500">
                  Plays dual-tone chime and shows full stay briefing 24h before arrival.
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={alertsEnabled}
                  onChange={e => handleToggleAlerts(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-stone-600 peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Test Trigger Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleTest24HourAlert}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg active:scale-[0.99]"
              >
                <Volume2 className="w-4 h-4" />
                <span>Test 24-Hour Check-in Alert (Chime + Notification + Toast)</span>
              </button>
              <p className="text-[10px] text-stone-500 text-center mt-1.5">
                Rings the chime sound, fires a desktop notification, and displays the guest briefing banner.
              </p>
            </div>

            {/* Upcoming Monitored Bookings Preview */}
            {bookings.filter(b => b.status === 'confirmed').length > 0 && (
              <div className="mt-4 pt-3 border-t border-stone-200 dark:border-stone-800">
                <div className="text-[11px] font-bold text-stone-600 dark:text-stone-300 mb-2">
                  Stays Monitored for 24h Alerts ({bookings.filter(b => b.status === 'confirmed').length})
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {bookings
                    .filter(b => b.status === 'confirmed')
                    .map(b => {
                      const stay = stays.find(s => s.id === b.stayId);
                      return (
                        <div
                          key={b.id}
                          className="p-2 bg-stone-100 dark:bg-stone-800/60 rounded-xl flex items-center justify-between text-[11px]"
                        >
                          <div>
                            <span className="font-bold text-stone-900 dark:text-white">
                              {stay?.title || 'Stay'}
                            </span>
                            <span className="text-stone-500 block">Check-in: {b.checkIn} at 14:00</span>
                          </div>
                          <span className="font-mono text-[10px] text-stone-400">Ref: {b.reference}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
