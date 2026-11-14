import React, { useEffect, useRef, useState } from 'react';
import {
  Music,
  Mic,
  MicOff,
  Upload,
  Volume2,
  Search,
  Play,
  Square,
  Flag,
  Sparkles,
  Check,
  X,
  Flame,
  Info,
} from 'lucide-react';
import { AudioTrack, ShortAudioConfig } from '../../types';
import { api } from '../../api';
import { SHORTS_Z_INDEX, SHORTS_ZONES } from '../../config/shortsLayoutConfig';
import { AUDIO_UPLOAD_CONFIG } from '../../config/shortsTierConfig';

interface ShortsAudioPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  value: ShortAudioConfig;
  onChange: (next: ShortAudioConfig) => void;
  defaultScript?: string;
  hasOriginalVideoAudio?: boolean;
  postId?: string;
  purpose?: 'short' | 'listing';
  hideOriginalTab?: boolean;
  allowMusicAndVoiceOver?: boolean;
  showToast?: (msg: string) => void;
}

const GENRES = ['All', 'Afrobeat', 'Chill', 'Upbeat', 'Acoustic', 'Cinematic', 'Ambient', 'Gospel'];
const MOODS = ['All', 'Uplifting', 'Relaxed', 'Energetic', 'Warm', 'Inspiring', 'Chill'];

export const ShortsAudioPickerSheet: React.FC<ShortsAudioPickerSheetProps> = ({
  isOpen,
  onClose,
  value,
  onChange,
  defaultScript = '',
  hasOriginalVideoAudio = true,
  postId,
  purpose = 'short',
  hideOriginalTab = false,
  allowMusicAndVoiceOver = true,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'songs' | 'voiceover' | 'original' | 'mixer' | 'none'>(
    value.mode === 'none' ? 'songs' : value.mode === 'voiceover' ? 'voiceover' : 'songs'
  );
  const [rightsConfirmed, setRightsConfirmed] = useState(true);
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedMood, setSelectedMood] = useState('All');
  const [trendingOnly, setTrendingOnly] = useState(false);

  // Audio preview state (15-30s clip)
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);

  // Report audio dialog state
  const [reportingTrack, setReportingTrack] = useState<AudioTrack | null>(null);
  const [reportReason, setReportReason] = useState('Copyright concern or incorrect attribution');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Voice-over states: mic recorder, file upload, TTS
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const voFileInputRef = useRef<HTMLInputElement>(null);

  const [ttsScript, setTtsScript] = useState(value.ttsScript || defaultScript || '');
  const [ttsVoice, setTtsVoice] = useState(value.ttsVoice || 'warm_female');
  const [ttsLanguage, setTtsLanguage] = useState(value.ttsLanguage || 'en-KE');
  const [ttsGenerating, setTtsGenerating] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      stopPreview();
      return;
    }
    setLoadingTracks(true);
    api
      .getAudioLibrary({
        q: searchQuery || undefined,
        genre: selectedGenre,
        mood: selectedMood,
        trending: trendingOnly,
        limit: 30,
      })
      .then(res => setTracks(res.tracks || []))
      .catch(() => setTracks([]))
      .finally(() => setLoadingTracks(false));
  }, [isOpen, searchQuery, selectedGenre, selectedMood, trendingOnly]);

  useEffect(() => {
    return () => {
      stopPreview();
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
    };
  }, []);

  const stopPreview = () => {
    if (previewTimeoutRef.current) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPreviewTrackId(null);
  };

  const handleTogglePreview = (track: AudioTrack) => {
    if (previewTrackId === track.id) {
      stopPreview();
      return;
    }
    stopPreview();
    try {
      const audio = new Audio(track.audioUrl);
      const startSec = value.trackId === track.id ? (value.audioStartSec || 0) : (track.previewStartSec || 0);
      audio.currentTime = Math.min(startSec, Math.max(0, track.duration - 5));
      audio.volume = 0.85;
      audio.play().catch(() => {});
      previewAudioRef.current = audio;
      setPreviewTrackId(track.id);
      const previewLenMs = Math.min(30, Math.max(15, track.previewDurationSec || 25)) * 1000;
      previewTimeoutRef.current = window.setTimeout(() => stopPreview(), previewLenMs);
      audio.onended = () => stopPreview();
    } catch {
      showToast?.('Unable to preview track in this browser.');
    }
  };

  const handleSelectTrack = (track: AudioTrack) => {
    onChange({
      ...value,
      mode: value.voiceOverUrl ? 'song_plus_voiceover' : 'song',
      trackId: track.id,
      trackTitle: track.title,
      trackArtist: track.artist,
      trackUrl: track.audioUrl,
      audioStartSec: value.trackId === track.id ? (value.audioStartSec || 0) : 0,
      musicVolume: value.musicVolume > 0 ? value.musicVolume : 80,
      licenseId: track.licenseId,
      requiresAttribution: track.requiresAttribution,
      attributionText: track.attributionText,
      isDefaultAssigned: false,
    });
    showToast?.(`Selected "${track.title}" by ${track.artist}`);
  };

  const handleStartMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = e => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = String(reader.result || '');
          try {
            const uploaded = await api.uploadShortMedia([dataUrl], 'audio', purpose);
            const voUrl = uploaded.urls[0] || dataUrl;
            onChange({
              ...value,
              mode: value.trackId && value.musicVolume > 0 ? 'song_plus_voiceover' : 'voiceover',
              voiceOverUrl: voUrl,
              voiceOverSource: 'mic',
              voiceOverVolume: 100,
              autoDuckMusic: true,
            });
            showToast?.('Voice-over recorded and attached!');
          } catch {
            onChange({
              ...value,
              mode: value.trackId && value.musicVolume > 0 ? 'song_plus_voiceover' : 'voiceover',
              voiceOverUrl: dataUrl,
              voiceOverSource: 'mic',
              voiceOverVolume: 100,
              autoDuckMusic: true,
            });
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSec(0);
      const maxRecSec = purpose === 'listing' ? AUDIO_UPLOAD_CONFIG.maxListingDurationSec : AUDIO_UPLOAD_CONFIG.maxShortDurationSec;
      recordTimerRef.current = window.setInterval(() => {
        setRecordingSec(prev => {
          if (prev >= maxRecSec - 1) {
            handleStopMicRecording();
            return maxRecSec;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      showToast?.('Microphone access denied or unavailable. Try uploading audio or Text-to-Speech.');
    }
  };

  const handleStopMicRecording = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleUploadVoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!rightsConfirmed) {
      showToast?.('Please confirm you hold rights or permission to use this audio file.');
      return;
    }
    if (file.size > AUDIO_UPLOAD_CONFIG.maxFileSizeBytes) {
      showToast?.('Audio file must be under 15MB.');
      return;
    }
    const lowerName = file.name.toLowerCase();
    const hasAllowedExt = AUDIO_UPLOAD_CONFIG.allowedExtensions.some(ext => lowerName.endsWith(ext));
    const hasAllowedMime = !file.type || AUDIO_UPLOAD_CONFIG.allowedMimeTypes.some(m => file.type.toLowerCase().includes(m.split('/')[1]));
    if (!hasAllowedExt && !hasAllowedMime) {
      showToast?.('Unsupported format. Please upload MP3, WAV, OGG, M4A, AAC, or WebM.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = String(reader.result || '');
      try {
        const res = await api.uploadShortMedia([dataUrl], 'audio', purpose);
        onChange({
          ...value,
          mode: value.trackId && value.musicVolume > 0 ? 'song_plus_voiceover' : 'voiceover',
          voiceOverUrl: res.urls[0],
          voiceOverSource: 'upload',
          voiceOverVolume: 100,
          autoDuckMusic: true,
        });
        showToast?.(`Voice-over "${file.name}" attached!`);
      } catch (err: any) {
        showToast?.(err.message || 'Voice-over upload failed.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateTts = async () => {
    const cleanScript = (ttsScript || defaultScript || '').trim();
    if (!cleanScript) {
      showToast?.('Enter a narration script or caption first.');
      return;
    }
    setTtsGenerating(true);
    try {
      const res = await api.generateVoiceOverTTS({
        script: cleanScript,
        voice: ttsVoice,
        language: ttsLanguage,
        purpose,
      });
      onChange({
        ...value,
        mode: value.trackId && value.musicVolume > 0 ? 'song_plus_voiceover' : 'voiceover',
        voiceOverUrl: res.audioUrl,
        voiceOverSource: 'tts',
        ttsScript: cleanScript,
        ttsVoice,
        ttsLanguage,
        voiceOverVolume: 100,
        autoDuckMusic: true,
      });
      // Browser speech preview if supported
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(cleanScript);
          utter.lang = ttsLanguage;
          window.speechSynthesis.speak(utter);
        } catch {}
      }
      showToast?.(`AI Voice-Over generated (${res.durationSeconds}s) & mixed!`);
    } catch (err: any) {
      showToast?.(err.message || 'Could not generate voice-over.');
    } finally {
      setTtsGenerating(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportingTrack) return;
    setReportSubmitting(true);
    try {
      const res = await api.reportAudioTrack(reportingTrack.id, reportReason, postId);
      showToast?.(res.message || 'Audio reported for review.');
      setReportingTrack(null);
    } catch (err: any) {
      showToast?.(err.message || 'Could not submit audio report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedTrack = tracks.find(t => t.id === value.trackId);

  return (
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/50 backdrop-blur-[2px]"
      style={{ zIndex: SHORTS_Z_INDEX.bottomSheet }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] bg-[#14161d] text-white rounded-t-3xl border-t border-stone-800 shadow-2xl flex flex-col overflow-hidden"
        style={{
          maxHeight: SHORTS_ZONES.bottomSheetMaxHeight,
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag Handle + Header */}
        <div className="pt-2.5 pb-3 px-4 border-b border-stone-800 shrink-0">
          <div className="w-10 h-1 rounded-full bg-stone-600 mx-auto mb-2.5" />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold truncate">
                {purpose === 'listing' ? 'Listing Audio (Optional · Gold)' : 'Audio Studio & Free Music (Optional)'}
              </h3>
              <p className="text-[11px] text-stone-400 truncate">
                {value.mode === 'none'
                  ? 'No added music or voice-over (optional)'
                  : value.mode === 'original'
                  ? 'Using Original Video Sound'
                  : value.trackTitle
                  ? `${value.trackTitle} — ${value.trackArtist || 'Free Source'}`
                  : 'Voice-over narration attached'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {value.mode !== 'none' && (
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      mode: 'none',
                      trackId: undefined,
                      trackTitle: undefined,
                      trackArtist: undefined,
                      trackUrl: undefined,
                      voiceOverUrl: undefined,
                      originalVolume: 100,
                      musicVolume: 0,
                      voiceOverVolume: 0,
                      autoDuckMusic: false,
                    });
                    showToast?.('Audio cleared (no added music or voice-over)');
                  }}
                  className="min-h-[36px] px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-[11px] font-bold text-stone-200 cursor-pointer"
                >
                  Clear Audio
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-stone-800 text-stone-300 cursor-pointer"
                aria-label="Close audio picker"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Segmented Picker Tabs */}
          <div className={`grid ${hideOriginalTab ? 'grid-cols-3' : 'grid-cols-4'} gap-1 mt-3 p-1 bg-stone-900 rounded-xl`}>
            {(
              [
                { id: 'songs', label: 'Songs' },
                { id: 'voiceover', label: 'Voice-Over' },
                ...(hideOriginalTab ? [] : [{ id: 'original', label: 'Original' } as const]),
                { id: 'mixer', label: 'Mixer' },
              ] as const
            ).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`min-h-[36px] px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-[#e4002b] text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Sheet Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* TAB 1: FREE-SOURCE SONGS */}
          {activeTab === 'songs' && (
            <div className="space-y-3">
              {/* Search & Trending */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search Pixabay, YouTube, FMA, Jamendo..."
                    className="w-full pl-9 pr-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white outline-none focus:border-[#ff2e93]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setTrendingOnly(v => !v)}
                  className={`min-h-[38px] px-3 rounded-xl text-xs font-bold flex items-center gap-1 border cursor-pointer shrink-0 ${
                    trendingOnly
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                      : 'bg-stone-900 border-stone-700 text-stone-300'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Trending</span>
                </button>
              </div>

              {/* Genre & Mood Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {GENRES.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGenre(g)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                      selectedGenre === g
                        ? 'bg-white text-black'
                        : 'bg-stone-900 text-stone-400 hover:text-white'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[10px] text-stone-500 shrink-0">Mood:</span>
                {MOODS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMood(m)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap cursor-pointer ${
                      selectedMood === m
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'bg-stone-900/70 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Trim Start Point when a track is selected */}
              {selectedTrack && value.mode !== 'original' && (
                <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-stone-200 truncate">
                      Trim start point: {value.audioStartSec || 0}s / {selectedTrack.duration}s
                    </span>
                    <span className="text-stone-400 shrink-0">{selectedTrack.source}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, selectedTrack.duration - 15)}
                    value={value.audioStartSec || 0}
                    onChange={e =>
                      onChange({
                        ...value,
                        audioStartSec: Number(e.target.value),
                      })
                    }
                    className="w-full accent-[#ff2e93]"
                  />
                  {selectedTrack.requiresAttribution && (
                    <div className="text-[10px] text-amber-300 flex items-center gap-1 pt-0.5">
                      <Info className="w-3 h-3 shrink-0" />
                      <span className="truncate">{selectedTrack.attributionText}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Track List */}
              {loadingTracks ? (
                <div className="py-6 text-center text-xs text-stone-400">Loading cleared free-source music...</div>
              ) : tracks.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-400">No tracks match your filter.</div>
              ) : (
                <div className="space-y-2">
                  {tracks.map(track => {
                    const isSelected = value.trackId === track.id && value.mode !== 'original';
                    const isPreviewing = previewTrackId === track.id;
                    return (
                      <div
                        key={track.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                          isSelected
                            ? 'bg-[#e4002b]/15 border-[#e4002b]'
                            : 'bg-stone-900/80 border-stone-800 hover:border-stone-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleTogglePreview(track)}
                          className="min-w-[44px] min-h-[44px] rounded-xl bg-stone-800 hover:bg-stone-700 flex items-center justify-center shrink-0 cursor-pointer"
                          aria-label={isPreviewing ? `Stop preview of ${track.title}` : `Preview ${track.title}`}
                        >
                          {isPreviewing ? (
                            <Square className="w-4 h-4 text-[#ff2e93] fill-current" />
                          ) : (
                            <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                          )}
                        </button>

                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handleSelectTrack(track)}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{track.title}</span>
                            {track.trending && (
                              <span className="text-[10px] text-rose-400 font-bold shrink-0">Trending</span>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-400 truncate">
                            {track.artist} · {track.genre} · {track.duration}s · {track.source}
                          </div>
                          <div className="text-[10px] text-stone-500 truncate">
                            {track.licenseType}
                            {track.requiresAttribution ? ' (Attribution shown on Short)' : ' (No attribution required)'}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setReportingTrack(track)}
                            className="min-w-[36px] min-h-[36px] p-2 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800 cursor-pointer"
                            title="Report audio"
                            aria-label={`Report ${track.title}`}
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectTrack(track)}
                            className={`min-h-[36px] px-3 rounded-lg text-xs font-bold cursor-pointer ${
                              isSelected
                                ? 'bg-[#e4002b] text-white'
                                : 'bg-white text-black hover:bg-stone-200'
                            }`}
                          >
                            {isSelected ? <Check className="w-4 h-4" /> : 'Use'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VOICE-OVER (MIC / UPLOAD / TTS) */}
          {activeTab === 'voiceover' && (
            <div className="space-y-4">
              {/* 1. Microphone Record */}
              <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Record with Microphone</h4>
                    <p className="text-[11px] text-stone-400">Up to 60s narration layered with auto-ducked music</p>
                  </div>
                  <button
                    type="button"
                    onClick={isRecording ? handleStopMicRecording : handleStartMicRecording}
                    className={`min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      isRecording
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-white text-black hover:bg-stone-200'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isRecording ? `Stop (${recordingSec}s)` : 'Record Voice'}</span>
                  </button>
                </div>
              </div>

              {/* 2. Upload Voice-over Audio File */}
              <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white">Upload Audio File</h4>
                    <p className="text-[11px] text-stone-400">MP3, WAV, OGG, M4A or AAC (max 15MB)</p>
                  </div>
                  <input
                    ref={voFileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm"
                    onChange={handleUploadVoFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => voFileInputRef.current?.click()}
                    disabled={!rightsConfirmed || !allowMusicAndVoiceOver}
                    className="min-h-[44px] px-4 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload</span>
                  </button>
                </div>
                <label className="flex items-start gap-2 text-[11px] text-stone-300 cursor-pointer pt-1 border-t border-stone-800">
                  <input
                    type="checkbox"
                    checked={rightsConfirmed}
                    onChange={e => setRightsConfirmed(e.target.checked)}
                    className="mt-0.5 w-3.5 h-3.5 accent-[#e4002b]"
                  />
                  <span>I own or have commercial rights/permission for any uploaded audio file.</span>
                </label>
              </div>

              {/* 3. Text-to-Speech Generator */}
              <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Sparkles className="w-4 h-4 text-[#ff2e93]" />
                  <span>Text-to-Speech Narration</span>
                </div>
                <textarea
                  rows={2}
                  value={ttsScript}
                  onChange={e => setTtsScript(e.target.value)}
                  placeholder="Type your voice-over script or use the Short caption..."
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white outline-none focus:border-[#ff2e93]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={ttsVoice}
                    onChange={e => setTtsVoice(e.target.value)}
                    className="px-2.5 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white outline-none"
                  >
                    <option value="warm_female">Warm Female</option>
                    <option value="warm_male">Warm Male</option>
                    <option value="bright_female">Bright Narrator</option>
                  </select>
                  <select
                    value={ttsLanguage}
                    onChange={e => setTtsLanguage(e.target.value)}
                    className="px-2.5 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white outline-none"
                  >
                    <option value="en-KE">English (Kenya)</option>
                    <option value="en-US">English (US)</option>
                    <option value="sw-KE">Swahili (Kenya)</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={ttsGenerating}
                  onClick={handleGenerateTts}
                  className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
                >
                  {ttsGenerating ? 'Generating Speech Audio...' : 'Generate Text-to-Speech Voice-Over'}
                </button>
              </div>

              {value.voiceOverUrl && (
                <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-700/50 flex items-center justify-between gap-2 text-xs">
                  <span className="text-emerald-300 font-bold truncate">
                    Voice-over ready ({value.voiceOverSource || 'attached'})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...value,
                        mode: value.trackId ? 'song' : 'original',
                        voiceOverUrl: undefined,
                        voiceOverVolume: 0,
                      })
                    }
                    className="text-rose-400 hover:underline font-bold cursor-pointer shrink-0"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ORIGINAL SOUND */}
          {activeTab === 'original' && (
            <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white">Keep Original Video Sound</h4>
                  <p className="text-xs text-stone-400 mt-1">
                    {hasOriginalVideoAudio
                      ? 'Plays the ambient sound recorded in your uploaded video without adding a music track.'
                      : 'Photo reels have no original camera audio — if selected, AirBus safely keeps a cleared ambient track so your Short is never silent.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onChange({
                    ...value,
                    mode: 'original',
                    trackTitle: 'Original Sound',
                    trackArtist: 'Creator Audio',
                    originalVolume: 100,
                    musicVolume: 0,
                    voiceOverVolume: 0,
                    isDefaultAssigned: false,
                  });
                  showToast?.('Switched to Original Sound');
                }}
                className={`w-full min-h-[44px] rounded-xl text-xs font-extrabold cursor-pointer ${
                  value.mode === 'original'
                    ? 'bg-[#e4002b] text-white'
                    : 'bg-white text-black hover:bg-stone-200'
                }`}
              >
                {value.mode === 'original' ? 'Using Original Sound ✓' : 'Use Original Sound'}
              </button>
            </div>
          )}

          {/* TAB 4: MIXER & AUTO-DUCKING */}
          {activeTab === 'mixer' && (
            <div className="space-y-4 p-3 rounded-2xl bg-stone-900 border border-stone-800">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-stone-400" />
                    Original Video Audio
                  </span>
                  <span>{value.originalVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={value.originalVolume}
                  onChange={e => onChange({ ...value, originalVolume: Number(e.target.value) })}
                  className="w-full accent-[#e4002b]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-[#ff2e93]" />
                    Music Volume
                  </span>
                  <span>{value.musicVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={value.musicVolume}
                  onChange={e => onChange({ ...value, musicVolume: Number(e.target.value) })}
                  className="w-full accent-[#ff2e93]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-sky-400" />
                    Voice-Over Volume
                  </span>
                  <span>{value.voiceOverVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={value.voiceOverVolume}
                  onChange={e => onChange({ ...value, voiceOverVolume: Number(e.target.value) })}
                  className="w-full accent-sky-400"
                />
              </div>

              <label className="flex items-center justify-between pt-2 border-t border-stone-800 cursor-pointer">
                <div>
                  <span className="text-xs font-bold block">Auto-duck music under voice-over</span>
                  <span className="text-[10px] text-stone-400">
                    Automatically lowers music volume while narration plays
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={value.autoDuckMusic}
                  onChange={e => onChange({ ...value, autoDuckMusic: e.target.checked })}
                  className="w-4 h-4 accent-[#ff2e93]"
                />
              </label>
            </div>
          )}

          {/* Inline Report Audio Prompt */}
          {reportingTrack && (
            <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-700/60 space-y-2">
              <div className="text-xs font-bold text-amber-200">
                Report "{reportingTrack.title}"
              </div>
              <input
                type="text"
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
                className="w-full px-3 py-1.5 bg-stone-950 border border-amber-800 rounded-lg text-xs text-white outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportingTrack(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-stone-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reportSubmitting}
                  onClick={handleSubmitReport}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold cursor-pointer"
                >
                  {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
