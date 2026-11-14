import React, { useEffect, useRef, useState } from 'react';
import {
  Video,
  Images,
  Sparkles,
  Music,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UploadCloud,
  Scissors,
  Captions,
  Send,
} from 'lucide-react';
import { Post, ShortAudioConfig, ShortJob, Stay, StayCategory, User } from '../../types';
import { api } from '../../api';
import { SHORTS_Z_INDEX } from '../../config/shortsLayoutConfig';
import { ShortsAudioPickerSheet } from './ShortsAudioPickerSheet';

interface ShortsCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  myStays?: Stay[];
  fixedStay?: Stay;
  quotaInfo?: {
    used: number;
    limit: number;
    remaining: number;
    tier: StayCategory;
    isPlanActive: boolean;
    shortsAudioEnabled: boolean;
  };
  initialMedia?: {
    sourceType: 'video' | 'photo';
    files: string[];
    stayId?: string;
    caption?: string;
    label?: string;
  };
  onJobUpdated?: (job: ShortJob) => void;
  onShortPublished?: (post: Post) => void;
  onOpenAuth?: () => void;
  onOpenUpgrade?: () => void;
  showToast?: (msg: string) => void;
}

const DEFAULT_AUDIO_CONFIG: ShortAudioConfig = {
  mode: 'none',
  audioStartSec: 0,
  originalVolume: 100,
  musicVolume: 0,
  voiceOverVolume: 0,
  autoDuckMusic: false,
};

export const ShortsCreatorModal: React.FC<ShortsCreatorModalProps> = ({
  isOpen,
  onClose,
  user,
  myStays = [],
  fixedStay,
  quotaInfo,
  initialMedia,
  onJobUpdated,
  onShortPublished,
  onOpenAuth,
  onOpenUpgrade,
  showToast,
}) => {
  const [sourceType, setSourceType] = useState<'video' | 'photo'>(initialMedia?.sourceType || 'video');
  const [selectedFiles, setSelectedFiles] = useState<string[]>(initialMedia?.files || []);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [stayId, setStayId] = useState<string>(fixedStay?.id || initialMedia?.stayId || myStays[0]?.id || '');

  // Creation toggles
  const [autoCreateEnabled, setAutoCreateEnabled] = useState(true);
  const [reviewBeforePosting, setReviewBeforePosting] = useState(false); // Default OFF => Auto-publish
  const [autoCaptionsEnabled, setAutoCaptionsEnabled] = useState(true);
  const [aspectCropMode, setAspectCropMode] = useState<'smart_center' | 'blur_fill'>('smart_center');
  const [trimStartSec, setTrimStartSec] = useState(0);
  const [trimEndSec, setTrimEndSec] = useState(30);

  // Post metadata
  const [caption, setCaption] = useState(
    initialMedia?.caption || (fixedStay ? `Explore ${fixedStay.title} in ${fixedStay.location} ✨` : 'Explore this curated AirBus stay in stunning 9:16 view')
  );
  const [hashtagsInput, setHashtagsInput] = useState('#AirBusStays #KenyaTravel #Shorts');
  const [audioConfig, setAudioConfig] = useState<ShortAudioConfig>(DEFAULT_AUDIO_CONFIG);
  const [audioSheetOpen, setAudioSheetOpen] = useState(false);

  // Job tracking & quick edit state
  const [submitting, setSubmitting] = useState(false);
  const [activeJob, setActiveJob] = useState<ShortJob | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    `short_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  );
  const [publishingDraft, setPublishingDraft] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setActiveJob(null);
      return;
    }
    setIdempotencyKey(`short_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    setAudioConfig(DEFAULT_AUDIO_CONFIG);
    if (fixedStay) setStayId(fixedStay.id);
    if (initialMedia) {
      setSourceType(initialMedia.sourceType);
      setSelectedFiles(initialMedia.files);
      setFileNames(initialMedia.label ? [initialMedia.label] : ['Listing Media']);
      if (initialMedia.stayId) setStayId(initialMedia.stayId);
      if (initialMedia.caption) setCaption(initialMedia.caption);
    }
  }, [isOpen, fixedStay?.id, initialMedia]);

  // Poll active background job until ready or failed
  useEffect(() => {
    if (!isOpen || !activeJob) return;
    if (activeJob.state === 'ready' || activeJob.state === 'failed') return;

    const timer = window.setInterval(async () => {
      try {
        const res = await api.getShortJob(activeJob.id);
        setActiveJob(res.job);
        onJobUpdated?.(res.job);
        if (res.job.state === 'ready') {
          showToast?.(
            res.job.reviewBeforePosting
              ? 'Your 9:16 Short draft is ready for preview & publish!'
              : 'Your 9:16 Short was auto-published to Shorts!'
          );
          if (!res.job.reviewBeforePosting && res.job.publishedPostId) {
            api.getShortsFeed().then(feed => {
              const p = feed.posts.find(item => item.id === res.job.publishedPostId);
              if (p) onShortPublished?.(p);
            }).catch(() => {});
          }
        } else if (res.job.state === 'failed') {
          showToast?.(res.job.errorMessage || 'Short generation failed. You can retry.');
        }
      } catch {}
    }, 1500);

    return () => window.clearInterval(timer);
  }, [isOpen, activeJob?.id, activeJob?.state]);

  if (!isOpen) return null;

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const isVideo = files[0].type.startsWith('video/');
    setSourceType(isVideo ? 'video' : 'photo');
    setFileNames(files.map(f => f.name));
    setIdempotencyKey(`short_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    const readPromises = files.slice(0, isVideo ? 1 : 10).map(
      file =>
        new Promise<string>((resolve, reject) => {
          if (file.size > 45 * 1024 * 1024) {
            reject(new Error(`${file.name} exceeds 45MB limit.`));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsDataURL(file);
        })
    );

    try {
      const dataUrls = await Promise.all(readPromises);
      setSelectedFiles(dataUrls);
      showToast?.(
        isVideo
          ? `Video "${files[0].name}" loaded — ready for 9:16 auto-Short!`
          : `${dataUrls.length} photo${dataUrls.length > 1 ? 's' : ''} loaded for Ken Burns 9:16 Reel!`
      );
    } catch (err: any) {
      showToast?.(err.message || 'Could not load selected files.');
    }
  };

  const handleStartJob = async () => {
    if (!user) {
      onOpenAuth?.();
      return;
    }
    if (selectedFiles.length === 0) {
      showToast?.('Please select a video or one or more photos first.');
      return;
    }

    setSubmitting(true);
    try {
      const tags = hashtagsInput
        .split(/[\s,]+/)
        .map(t => t.trim())
        .filter(Boolean);

      const res = await api.createShortJob({
        idempotencyKey,
        stayId: stayId || undefined,
        sourceType,
        sourceFiles: selectedFiles,
        autoCreateEnabled,
        reviewBeforePosting,
        autoCaptionsEnabled,
        aspectCropMode,
        trimStartSec: sourceType === 'video' ? trimStartSec : 0,
        trimEndSec: sourceType === 'video' ? trimEndSec : 0,
        caption: caption.trim(),
        hashtags: tags,
        audioConfig,
      });

      setActiveJob(res.job);
      onJobUpdated?.(res.job);
      showToast?.('Short auto-creation started in background — you can leave and get notified!');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to queue Short job.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryJob = async () => {
    if (!activeJob) return;
    try {
      const res = await api.retryShortJob(activeJob.id);
      setActiveJob(res.job);
      onJobUpdated?.(res.job);
      showToast?.('Retrying Short generation...');
    } catch (err: any) {
      showToast?.(err.message || 'Retry failed.');
    }
  };

  const handlePublishDraftOrSaveEdits = async () => {
    if (!activeJob) return;
    setPublishingDraft(true);
    try {
      const tags = hashtagsInput
        .split(/[\s,]+/)
        .map(t => t.trim())
        .filter(Boolean);
      const res = await api.publishDraftShort(activeJob.id, {
        caption: caption.trim(),
        hashtags: tags,
        captionsEnabled: autoCaptionsEnabled,
        audioConfig,
      });
      setActiveJob(res.job);
      onJobUpdated?.(res.job);
      onShortPublished?.(res.post);
      showToast?.('Short published live to the Shorts feed & your profile!');
      onClose();
    } catch (err: any) {
      showToast?.(err.message || 'Could not publish Short.');
    } finally {
      setPublishingDraft(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      style={{ zIndex: SHORTS_Z_INDEX.modal }}
    >
      <div className="w-full max-w-[460px] max-h-[94dvh] bg-[#12141b] text-white rounded-3xl border border-stone-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div
          className="px-4 py-3 border-b border-stone-800 flex items-center justify-between gap-2 shrink-0"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-[#ff2e93] shrink-0" />
            <h3 className="text-sm font-extrabold truncate">Auto-Create 9:16 Short / Reel</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-stone-800 text-stone-300 cursor-pointer"
            aria-label="Close Short creator"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Active Job View */}
          {activeJob ? (
            <div className="space-y-4">
              {/* Status Card */}
              <div className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    {activeJob.state === 'ready' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : activeJob.state === 'failed' ? (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <RefreshCw className="w-4 h-4 text-[#ff2e93] animate-spin" />
                    )}
                    <span className="capitalize">{activeJob.state}</span>
                  </span>
                  <span>{activeJob.progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      activeJob.state === 'failed'
                        ? 'bg-rose-500'
                        : activeJob.state === 'ready'
                        ? 'bg-emerald-500'
                        : 'bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6]'
                    }`}
                    style={{ width: `${activeJob.progress}%` }}
                  />
                </div>
                <p className="text-[11px] text-stone-400">{activeJob.stageLabel}</p>
              </div>

              {activeJob.state === 'failed' && (
                <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800 space-y-2.5">
                  <p className="text-xs text-rose-200">{activeJob.errorMessage}</p>
                  <button
                    type="button"
                    onClick={handleRetryJob}
                    className="w-full min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold cursor-pointer"
                  >
                    Retry Processing
                  </button>
                </div>
              )}

              {(activeJob.state === 'queued' || activeJob.state === 'processing') && (
                <div className="p-3 rounded-xl bg-stone-900/70 border border-stone-800 text-xs text-stone-300 space-y-2">
                  <p>Processing runs in the background. You can leave this screen and we’ll notify you once your Short is ready.</p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full min-h-[40px] rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Run in Background &amp; Notify Me
                  </button>
                </div>
              )}

              {/* Ready Preview & Quick Edit */}
              {activeJob.state === 'ready' && activeJob.outputVideoUrl && (
                <div className="space-y-3">
                  <div className="relative mx-auto w-full max-w-[230px] aspect-[9/16] bg-black rounded-2xl overflow-hidden border border-stone-700">
                    <video
                      src={activeJob.outputVideoUrl}
                      poster={activeJob.outputThumbnailUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {autoCaptionsEnabled && activeJob.captions[0] && (
                      <div className="pointer-events-none absolute bottom-12 inset-x-3 text-center">
                        <span className="inline-block bg-black/75 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                          {activeJob.captions[0].text}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Quick Edit Caption, Auto-Captions, Audio */}
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-stone-400 block mb-1">Edit Caption</label>
                      <textarea
                        rows={2}
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-stone-400 block mb-1">Hashtags</label>
                      <input
                        type="text"
                        value={hashtagsInput}
                        onChange={e => setHashtagsInput(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAudioSheetOpen(true)}
                        className="min-h-[44px] px-3 rounded-xl bg-stone-900 border border-stone-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Music className="w-4 h-4 text-[#ff2e93]" />
                        <span className="truncate">{audioConfig.trackTitle || 'Change Audio'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutoCaptionsEnabled(v => !v)}
                        className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                          autoCaptionsEnabled
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-stone-900 border-stone-700 text-stone-400'
                        }`}
                      >
                        <Captions className="w-4 h-4" />
                        <span>{autoCaptionsEnabled ? 'Captions ON' : 'Captions OFF'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={publishingDraft}
                      onClick={handlePublishDraftOrSaveEdits}
                      className="w-full min-h-[46px] rounded-xl bg-[#e4002b] hover:bg-[#c90026] text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {publishingDraft
                          ? 'Saving...'
                          : activeJob.reviewBeforePosting
                          ? 'Confirm & Publish to Shorts Feed'
                          : 'Save Edits & View in Shorts'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Upload & Auto-Create Setup */
            <div className="space-y-4">
              {/* Listing & Tier Quota Header */}
              {fixedStay && (
                <div className="p-3 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Linked Listing</div>
                    <div className="text-xs font-extrabold text-white truncate">{fixedStay.title}</div>
                  </div>
                  {quotaInfo && (
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 ${
                        !quotaInfo.isPlanActive || quotaInfo.limit <= 0
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : quotaInfo.remaining === 0
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {quotaInfo.limit > 0
                        ? `Shorts: ${quotaInfo.used} of ${quotaInfo.limit} (${quotaInfo.tier})`
                        : `Locked (${quotaInfo.tier})`}
                    </span>
                  )}
                </div>
              )}

              {quotaInfo && (!quotaInfo.isPlanActive || quotaInfo.limit <= 0) && (
                <div className="p-3.5 rounded-2xl bg-amber-950/50 border border-amber-700/60 space-y-2 text-xs">
                  <p className="text-amber-200 font-bold">
                    Auto-Create Shorts requires an active Diamond (1 Short/listing) or Gold (5 Shorts/listing) plan.
                  </p>
                  {onOpenUpgrade && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenUpgrade();
                      }}
                      className="min-h-[40px] px-4 rounded-xl bg-amber-400 text-black font-extrabold text-xs cursor-pointer"
                    >
                      Upgrade to Gold or Diamond
                    </button>
                  )}
                </div>
              )}

              {/* Source Switcher (locked if triggered directly from a specific listing asset) */}
              {!initialMedia?.files?.length && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSourceType('video')}
                    className={`min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 border cursor-pointer ${
                      sourceType === 'video'
                        ? 'bg-[#e4002b]/20 border-[#e4002b] text-white'
                        : 'bg-stone-900 border-stone-800 text-stone-400'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    <span>Video → 9:16 Short</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceType('photo')}
                    className={`min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 border cursor-pointer ${
                      sourceType === 'photo'
                        ? 'bg-[#e4002b]/20 border-[#e4002b] text-white'
                        : 'bg-stone-900 border-stone-800 text-stone-400'
                    }`}
                  >
                    <Images className="w-4 h-4" />
                    <span>Photos → Reel</span>
                  </button>
                </div>
              )}

              {/* Upload Zone or Pre-Attached Listing Media Summary */}
              <input
                ref={fileInputRef}
                type="file"
                accept={sourceType === 'video' ? 'video/*' : 'image/*'}
                multiple={sourceType === 'photo'}
                onChange={handleFilePick}
                className="hidden"
              />
              {initialMedia?.files?.length && selectedFiles.length > 0 ? (
                <div className="p-3 rounded-2xl bg-stone-900/90 border border-stone-700 flex items-center gap-3">
                  {sourceType === 'photo' ? (
                    <img
                      src={selectedFiles[0]}
                      alt="Selected listing photo"
                      className="w-12 h-16 rounded-xl object-cover shrink-0 border border-stone-700"
                    />
                  ) : (
                    <div className="w-12 h-16 rounded-xl bg-black flex items-center justify-center shrink-0 border border-stone-700">
                      <Video className="w-5 h-5 text-[#ff2e93]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">
                      {initialMedia.label || (sourceType === 'video' ? 'Listing Tour Video' : `${selectedFiles.length} Listing Photo${selectedFiles.length > 1 ? 's' : ''}`)}
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Auto-reframed to 1080×1920 (9:16) &amp; linked to this listing
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-5 rounded-2xl border-2 border-dashed border-stone-700 hover:border-[#ff2e93] bg-stone-900/60 text-center space-y-1.5 cursor-pointer transition-colors"
                >
                  <UploadCloud className="w-7 h-7 text-[#ff2e93] mx-auto" />
                  <div className="text-xs font-bold text-white">
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} ${sourceType}${selectedFiles.length > 1 ? 's' : ''} ready (${fileNames.slice(0, 2).join(', ')})`
                      : sourceType === 'video'
                      ? 'Tap to upload MP4, MOV, or WebM video'
                      : 'Tap to select 1–10 photos for Ken Burns slideshow'}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    Auto-reframed to 1080×1920 (9:16) · Optional music or voice-over
                  </div>
                </button>
              )}

              {/* Toggles */}
              <div className="p-3 rounded-2xl bg-stone-900 border border-stone-800 space-y-2.5 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Create Short automatically</span>
                  <input
                    type="checkbox"
                    checked={autoCreateEnabled}
                    onChange={e => setAutoCreateEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#e4002b]"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Auto-captions (subtitles)</span>
                  <input
                    type="checkbox"
                    checked={autoCaptionsEnabled}
                    onChange={e => setAutoCaptionsEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#e4002b]"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="block">Review before posting</span>
                    <span className="text-[10px] text-stone-400">
                      {reviewBeforePosting ? 'Holds Short as draft until you confirm' : 'Auto-publishes to Shorts when done'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={reviewBeforePosting}
                    onChange={e => setReviewBeforePosting(e.target.checked)}
                    className="w-4 h-4 accent-[#e4002b]"
                  />
                </label>
              </div>

              {/* Video framing & optional manual trim */}
              {sourceType === 'video' && (
                <div className="p-3 rounded-2xl bg-stone-900 border border-stone-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-stone-400" />
                      9:16 Framing
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setAspectCropMode('smart_center')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                          aspectCropMode === 'smart_center' ? 'bg-white text-black' : 'bg-stone-800 text-stone-300'
                        }`}
                      >
                        Smart Crop
                      </button>
                      <button
                        type="button"
                        onClick={() => setAspectCropMode('blur_fill')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                          aspectCropMode === 'blur_fill' ? 'bg-white text-black' : 'bg-stone-800 text-stone-300'
                        }`}
                      >
                        Blur Fill
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-stone-400 block mb-0.5">Trim Start (sec)</label>
                      <input
                        type="number"
                        min={0}
                        max={300}
                        value={trimStartSec}
                        onChange={e => setTrimStartSec(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-stone-950 border border-stone-700 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 block mb-0.5">Trim End (15-60s span)</label>
                      <input
                        type="number"
                        min={15}
                        max={360}
                        value={trimEndSec}
                        onChange={e => setTrimEndSec(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-stone-950 border border-stone-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Caption & Hashtags */}
              <div className="space-y-2">
                {!fixedStay && myStays.length > 0 && (
                  <select
                    value={stayId}
                    onChange={e => setStayId(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white outline-none"
                  >
                    {myStays.map(s => (
                      <option key={s.id} value={s.id}>
                        Link Stay: {s.title}
                      </option>
                    ))}
                  </select>
                )}

                <textarea
                  rows={2}
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Write a catchy caption (editable later)..."
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white outline-none"
                />

                <input
                  type="text"
                  value={hashtagsInput}
                  onChange={e => setHashtagsInput(e.target.value)}
                  placeholder="#AirBusStays #DianiBeach #Kenya"
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white outline-none"
                />
              </div>

              {/* Optional Audio Picker Trigger (Diamond & Gold only) */}
              <button
                type="button"
                disabled={quotaInfo ? !quotaInfo.shortsAudioEnabled : false}
                onClick={() => setAudioSheetOpen(true)}
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 border border-stone-700 flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff2e93] to-[#8b5cf6] flex items-center justify-center shrink-0">
                    <Music className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {audioConfig.mode === 'none'
                        ? 'No added music or voice-over (Optional)'
                        : audioConfig.trackTitle || 'Voice-Over Attached'}
                    </div>
                    <div className="text-[10px] text-stone-400 truncate">
                      {audioConfig.mode === 'none'
                        ? 'Tap to optionally add a song or voice-over (Diamond/Gold)'
                        : audioConfig.mode === 'original'
                        ? 'Original Video Audio'
                        : `${audioConfig.trackArtist || 'Free Library'}${audioConfig.voiceOverUrl ? ' + Voice-Over' : ''}`}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#ff2e93] shrink-0">
                  {audioConfig.mode === 'none' ? 'Add Audio' : 'Change'}
                </span>
              </button>

              <button
                type="button"
                disabled={
                  submitting ||
                  selectedFiles.length === 0 ||
                  Boolean(quotaInfo && (!quotaInfo.isPlanActive || quotaInfo.remaining <= 0))
                }
                onClick={handleStartJob}
                className="w-full min-h-[48px] rounded-2xl bg-[#e4002b] hover:bg-[#c90026] text-white text-xs font-extrabold shadow-lg cursor-pointer disabled:opacity-50"
              >
                {submitting
                  ? 'Uploading & Queuing Job...'
                  : quotaInfo && quotaInfo.remaining <= 0 && quotaInfo.limit > 0
                  ? `Limit Reached (${quotaInfo.used} of ${quotaInfo.limit})`
                  : reviewBeforePosting
                  ? 'Generate 9:16 Short Draft'
                  : 'Auto-Create & Publish Short'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Audio Picker Bottom Sheet (Max 70% height) */}
      <ShortsAudioPickerSheet
        isOpen={audioSheetOpen}
        onClose={() => setAudioSheetOpen(false)}
        value={audioConfig}
        onChange={setAudioConfig}
        defaultScript={caption}
        hasOriginalVideoAudio={sourceType === 'video'}
        showToast={showToast}
      />
    </div>
  );
};
