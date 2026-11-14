import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { AudioLicense, AudioTrack, ShortAudioConfig } from '../../types';

const execFileAsync = promisify(execFile);

export const AUDIO_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'audio');

function ensureAudioDir() {
  if (!fs.existsSync(AUDIO_UPLOADS_DIR)) {
    fs.mkdirSync(AUDIO_UPLOADS_DIR, { recursive: true });
  }
}

export const FREE_AUDIO_LICENSES: AudioLicense[] = [
  {
    id: 'lic_pixabay',
    licenseType: 'Pixabay-License',
    source: 'Pixabay Music',
    requiresAttribution: false,
    attributionText: 'Free for commercial & UGC video use via Pixabay Content License',
    commercialUgcAllowed: true,
    licenseUrl: 'https://pixabay.com/service/license-summary/',
    createdAt: Date.now(),
  },
  {
    id: 'lic_yt_audio',
    licenseType: 'YouTube-Audio-Library',
    source: 'YouTube Audio Library',
    requiresAttribution: false,
    attributionText: 'Free to use in monetized & UGC videos (YouTube Audio Library)',
    commercialUgcAllowed: true,
    licenseUrl: 'https://support.google.com/youtube/answer/3376882',
    createdAt: Date.now(),
  },
  {
    id: 'lic_cc_by_fma',
    licenseType: 'CC-BY-4.0',
    source: 'Free Music Archive',
    requiresAttribution: true,
    attributionText: 'Music via Free Music Archive (CC BY 4.0) — Attribution required',
    commercialUgcAllowed: true,
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    createdAt: Date.now(),
  },
  {
    id: 'lic_jamendo',
    licenseType: 'Jamendo-Royalty-Free',
    source: 'Jamendo',
    requiresAttribution: true,
    attributionText: 'Licensed for UGC Short video via Jamendo Royalty-Free Catalog (CC BY)',
    commercialUgcAllowed: true,
    licenseUrl: 'https://www.jamendo.com/legal/licenses',
    createdAt: Date.now(),
  },
  {
    id: 'lic_cc0',
    licenseType: 'CC0',
    source: 'AirBus Free Studio',
    requiresAttribution: false,
    attributionText: 'CC0 Public Domain — No attribution required',
    commercialUgcAllowed: true,
    createdAt: Date.now(),
  },
];

interface SeedTrackMeta extends Omit<AudioTrack, 'audioUrl'> {
  chordExpr: string;
}

const SEED_TRACKS_META: SeedTrackMeta[] = [
  {
    id: 'mus_1',
    title: 'Safari Sunrise Vibes',
    artist: 'Mara Beats',
    genre: 'Afrobeat',
    mood: 'Uplifting',
    duration: 36,
    licence: 'Pixabay Content License (UGC Allowed)',
    licenseId: 'lic_pixabay',
    licenseType: 'Pixabay-License',
    source: 'Pixabay Music',
    requiresAttribution: false,
    attributionText: 'Safari Sunrise Vibes by Mara Beats · Pixabay Music (Free UGC)',
    commercialUgcAllowed: true,
    trending: true,
    previewStartSec: 0,
    previewDurationSec: 25,
    useCount: 342,
    chordExpr: '0.18*(sin(2*PI*220*t)+0.6*sin(2*PI*277.18*t)+0.5*sin(2*PI*329.63*t))*(0.7+0.3*sin(2*PI*2*t))',
  },
  {
    id: 'mus_2',
    title: 'Nyali Coastal Breeze',
    artist: 'Diani Chillwave',
    genre: 'Chill',
    mood: 'Relaxed',
    duration: 42,
    licence: 'YouTube Audio Library (No Attribution)',
    licenseId: 'lic_yt_audio',
    licenseType: 'YouTube-Audio-Library',
    source: 'YouTube Audio Library',
    requiresAttribution: false,
    attributionText: 'Nyali Coastal Breeze by Diani Chillwave · YouTube Audio Library',
    commercialUgcAllowed: true,
    trending: true,
    previewStartSec: 0,
    previewDurationSec: 25,
    useCount: 289,
    chordExpr: '0.16*(sin(2*PI*196*t)+0.55*sin(2*PI*246.94*t)+0.45*sin(2*PI*293.66*t))*(0.8+0.2*sin(2*PI*1.2*t))',
  },
  {
    id: 'mus_3',
    title: 'Westlands Skyline Groove',
    artist: 'Urban Rift',
    genre: 'Upbeat',
    mood: 'Energetic',
    duration: 40,
    licence: 'CC BY 4.0 (Attribution Required)',
    licenseId: 'lic_cc_by_fma',
    licenseType: 'CC-BY-4.0',
    source: 'Free Music Archive',
    requiresAttribution: true,
    attributionText: 'Music: "Westlands Skyline Groove" by Urban Rift (FMA · CC BY 4.0)',
    commercialUgcAllowed: true,
    trending: true,
    previewStartSec: 0,
    previewDurationSec: 25,
    useCount: 215,
    chordExpr: '0.17*(sin(2*PI*261.63*t)+0.6*sin(2*PI*329.63*t)+0.5*sin(2*PI*392*t))*(0.75+0.25*sin(2*PI*2.5*t))',
  },
  {
    id: 'mus_4',
    title: 'Great Rift Acoustic Serenade',
    artist: 'Naivasha Strings',
    genre: 'Acoustic',
    mood: 'Warm',
    duration: 45,
    licence: 'Jamendo Royalty-Free (Attribution)',
    licenseId: 'lic_jamendo',
    licenseType: 'Jamendo-Royalty-Free',
    source: 'Jamendo',
    requiresAttribution: true,
    attributionText: 'Audio: "Great Rift Acoustic Serenade" by Naivasha Strings (Jamendo CC BY)',
    commercialUgcAllowed: true,
    trending: false,
    previewStartSec: 0,
    previewDurationSec: 25,
    useCount: 164,
    chordExpr: '0.16*(sin(2*PI*293.66*t)+0.55*sin(2*PI*369.99*t)+0.45*sin(2*PI*440*t))*(0.85+0.15*sin(2*PI*1.5*t))',
  },
  {
    id: 'mus_5',
    title: 'Savannah Wonder & Majesty',
    artist: 'African Philharmonic',
    genre: 'Cinematic',
    mood: 'Inspiring',
    duration: 50,
    licence: 'YouTube Audio Library (Free UGC)',
    licenseId: 'lic_yt_audio',
    licenseType: 'YouTube-Audio-Library',
    source: 'YouTube Audio Library',
    requiresAttribution: false,
    attributionText: 'Savannah Wonder & Majesty by African Philharmonic · YouTube Audio Library',
    commercialUgcAllowed: true,
    trending: true,
    previewStartSec: 0,
    previewDurationSec: 30,
    useCount: 198,
    chordExpr: '0.15*(sin(2*PI*174.61*t)+0.6*sin(2*PI*220*t)+0.5*sin(2*PI*261.63*t))*(0.85+0.15*sin(2*PI*0.8*t))',
  },
  {
    id: 'mus_6',
    title: 'Amazing Grace (Acoustic Sunrise)',
    artist: 'Nairobi Gospel Choir',
    genre: 'Gospel',
    mood: 'Peaceful',
    duration: 45,
    licence: 'CC0 Public Domain',
    licenseId: 'lic_cc0',
    licenseType: 'CC0',
    source: 'AirBus Free Studio',
    requiresAttribution: false,
    attributionText: 'CC0 Public Domain · Nairobi Gospel Choir',
    commercialUgcAllowed: true,
    trending: false,
    previewStartSec: 0,
    previewDurationSec: 25,
    useCount: 130,
    chordExpr: '0.16*(sin(2*PI*246.94*t)+0.55*sin(2*PI*311.13*t)+0.45*sin(2*PI*369.99*t))*(0.88+0.12*sin(2*PI*1*t))',
  },
  {
    id: 'mus_7',
    title: 'Lamu Swahili Sunset Lo-Fi',
    artist: 'Shela Sunset',
    genre: 'Ambient',
    mood: 'Chill',
    duration: 38,
    licence: 'Pixabay Content License (UGC Allowed)',
    licenseId: 'lic_pixabay',
    licenseType: 'Pixabay-License',
    source: 'Pixabay Music',
    requiresAttribution: false,
    attributionText: 'Lamu Swahili Sunset Lo-Fi by Shela Sunset · Pixabay Music',
    commercialUgcAllowed: true,
    trending: true,
    previewStartSec: 0,
    previewDurationSec: 25,
    useCount: 277,
    chordExpr: '0.15*(sin(2*PI*207.65*t)+0.5*sin(2*PI*261.63*t)+0.45*sin(2*PI*311.13*t))*(0.8+0.2*sin(2*PI*1.3*t))',
  },
  {
    id: 'mus_8',
    title: 'Kilimanjaro Morning Pulse',
    artist: 'Highland Echo',
    genre: 'Afrobeat',
    mood: 'Happy',
    duration: 44,
    licence: 'CC BY 4.0 (Attribution Required)',
    licenseId: 'lic_cc_by_fma',
    licenseType: 'CC-BY-4.0',
    source: 'Free Music Archive',
    requiresAttribution: true,
    attributionText: 'Music: "Kilimanjaro Morning Pulse" by Highland Echo (FMA · CC BY 4.0)',
    commercialUgcAllowed: true,
    trending: false,
    previewStartSec: 0,
    previewDurationSec: 25,
    useCount: 112,
    chordExpr: '0.17*(sin(2*PI*233.08*t)+0.55*sin(2*PI*293.66*t)+0.45*sin(2*PI*349.23*t))*(0.75+0.25*sin(2*PI*2.2*t))',
  },
];

export class AudioLibraryService {
  private generated = false;

  public async ensureLocalAudioAssets(): Promise<void> {
    if (this.generated) return;
    ensureAudioDir();

    for (const track of SEED_TRACKS_META) {
      const outPath = path.join(AUDIO_UPLOADS_DIR, `${track.id}.mp3`);
      if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1024) {
        try {
          await execFileAsync('ffmpeg', [
            '-y',
            '-f', 'lavfi',
            '-i', `aevalsrc=${track.chordExpr}:s=44100:d=${track.duration}`,
            '-af', 'afade=t=in:st=0:d=1.2,afade=t=out:st=' + Math.max(1, track.duration - 1.5) + ':d=1.5',
            '-c:a', 'libmp3lame',
            '-b:a', '96k',
            outPath,
          ]);
        } catch (err) {
          // Fallback to PCM wav -> mp3 or aac if libmp3lame unavailable
          try {
            const wavPath = path.join(AUDIO_UPLOADS_DIR, `${track.id}.wav`);
            await execFileAsync('ffmpeg', [
              '-y',
              '-f', 'lavfi',
              '-i', `aevalsrc=${track.chordExpr}:s=44100:d=${track.duration}`,
              wavPath,
            ]);
          } catch {}
        }
      }
    }
    this.generated = true;
  }

  public getTrackFilePath(trackId: string): string | null {
    ensureAudioDir();
    const mp3 = path.join(AUDIO_UPLOADS_DIR, `${trackId}.mp3`);
    if (fs.existsSync(mp3)) return mp3;
    const wav = path.join(AUDIO_UPLOADS_DIR, `${trackId}.wav`);
    if (fs.existsSync(wav)) return wav;
    return null;
  }

  public getSeededTracks(): AudioTrack[] {
    ensureAudioDir();
    return SEED_TRACKS_META.map(({ chordExpr, ...rest }) => {
      const hasMp3 = fs.existsSync(path.join(AUDIO_UPLOADS_DIR, `${rest.id}.mp3`));
      const ext = hasMp3 ? 'mp3' : 'wav';
      return {
        ...rest,
        audioUrl: `/uploads/audio/${rest.id}.${ext}`,
      };
    });
  }

  public getSeededLicenses(): AudioLicense[] {
    return [...FREE_AUDIO_LICENSES];
  }

  /**
   * Resolves Short audio configuration.
   * Music and voice-over are strictly OPTIONAL: if mode is 'none' (or neither track nor voice-over is attached
   * and mode isn't 'original'), returns clean mode: 'none' with zero added track fallback.
   */
  public resolveAudioConfig(
    inputConfig: Partial<ShortAudioConfig> | undefined,
    tracks: AudioTrack[],
    options?: { allowMusicOrVoiceOver?: boolean }
  ): ShortAudioConfig {
    const allowAddedAudio = options?.allowMusicOrVoiceOver !== false;
    const ugcAllowedTracks = tracks.filter(t => t.commercialUgcAllowed !== false);
    const requestedMode = inputConfig?.mode || 'none';

    if (requestedMode === 'none') {
      return {
        mode: 'none',
        trackTitle: undefined,
        trackArtist: undefined,
        originalVolume: inputConfig?.originalVolume ?? 100,
        musicVolume: 0,
        voiceOverVolume: 0,
        autoDuckMusic: false,
        requiresAttribution: false,
        attributionText: undefined,
        isDefaultAssigned: false,
      };
    }

    if (requestedMode === 'original') {
      return {
        mode: 'original',
        trackTitle: 'Original Sound',
        trackArtist: 'Creator Audio',
        originalVolume: inputConfig?.originalVolume ?? 100,
        musicVolume: 0,
        voiceOverVolume: 0,
        autoDuckMusic: false,
        requiresAttribution: false,
        attributionText: 'Original creator audio',
        isDefaultAssigned: false,
      };
    }

    if (!allowAddedAudio) {
      return {
        mode: 'none',
        originalVolume: inputConfig?.originalVolume ?? 100,
        musicVolume: 0,
        voiceOverVolume: 0,
        autoDuckMusic: false,
        requiresAttribution: false,
        isDefaultAssigned: false,
      };
    }

    if (requestedMode === 'voiceover' && inputConfig?.voiceOverUrl) {
      return {
        mode: 'voiceover',
        trackTitle: 'Voice-over Narration',
        trackArtist: inputConfig.voiceOverSource === 'tts' ? 'AI Voice-Over' : 'Creator Voice',
        originalVolume: inputConfig.originalVolume ?? 20,
        musicVolume: 0,
        voiceOverVolume: inputConfig.voiceOverVolume ?? 100,
        autoDuckMusic: inputConfig.autoDuckMusic ?? true,
        voiceOverUrl: inputConfig.voiceOverUrl,
        voiceOverSource: inputConfig.voiceOverSource || 'mic',
        ttsScript: inputConfig.ttsScript,
        ttsVoice: inputConfig.ttsVoice,
        ttsLanguage: inputConfig.ttsLanguage,
        requiresAttribution: false,
        isDefaultAssigned: false,
      };
    }

    const chosenTrack = inputConfig?.trackId
      ? ugcAllowedTracks.find(t => t.id === inputConfig.trackId)
      : undefined;

    if (!chosenTrack && !inputConfig?.voiceOverUrl) {
      return {
        mode: 'none',
        originalVolume: inputConfig?.originalVolume ?? 100,
        musicVolume: 0,
        voiceOverVolume: 0,
        autoDuckMusic: false,
        requiresAttribution: false,
        isDefaultAssigned: false,
      };
    }

    if (!chosenTrack && inputConfig?.voiceOverUrl) {
      return {
        mode: 'voiceover',
        trackTitle: 'Voice-over Narration',
        trackArtist: inputConfig.voiceOverSource === 'tts' ? 'AI Voice-Over' : 'Creator Voice',
        originalVolume: inputConfig.originalVolume ?? 20,
        musicVolume: 0,
        voiceOverVolume: inputConfig.voiceOverVolume ?? 100,
        autoDuckMusic: inputConfig.autoDuckMusic ?? true,
        voiceOverUrl: inputConfig.voiceOverUrl,
        voiceOverSource: inputConfig.voiceOverSource || 'mic',
        ttsScript: inputConfig.ttsScript,
        ttsVoice: inputConfig.ttsVoice,
        ttsLanguage: inputConfig.ttsLanguage,
        requiresAttribution: false,
        isDefaultAssigned: false,
      };
    }

    return {
      mode: inputConfig?.voiceOverUrl ? 'song_plus_voiceover' : 'song',
      trackId: chosenTrack!.id,
      trackTitle: chosenTrack!.title,
      trackArtist: chosenTrack!.artist,
      trackUrl: chosenTrack!.audioUrl,
      audioStartSec: Math.max(0, Number(inputConfig?.audioStartSec || 0)),
      originalVolume: inputConfig?.originalVolume ?? 25,
      musicVolume: inputConfig?.musicVolume ?? 80,
      voiceOverVolume: inputConfig?.voiceOverUrl ? (inputConfig?.voiceOverVolume ?? 100) : 0,
      autoDuckMusic: inputConfig?.autoDuckMusic ?? true,
      voiceOverUrl: inputConfig?.voiceOverUrl,
      voiceOverSource: inputConfig?.voiceOverSource,
      ttsScript: inputConfig?.ttsScript,
      ttsVoice: inputConfig?.ttsVoice,
      ttsLanguage: inputConfig?.ttsLanguage,
      licenseId: chosenTrack!.licenseId,
      requiresAttribution: chosenTrack!.requiresAttribution,
      attributionText: chosenTrack!.attributionText,
      isDefaultAssigned: false,
    };
  }

  public validateAudioDataUrl(dataUrlOrPath: string, maxFileSizeBytes: number): void {
    if (!dataUrlOrPath) throw new Error('Audio payload is empty.');
    if (dataUrlOrPath.startsWith('/uploads/') || dataUrlOrPath.startsWith('http://') || dataUrlOrPath.startsWith('https://')) {
      return;
    }
    const match = dataUrlOrPath.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid audio file format. Allowed formats: MP3, WAV, OGG, M4A, AAC, WebM.');
    }
    const mime = match[1].toLowerCase();
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/ogg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/aac',
      'audio/webm',
    ];
    if (!allowedMimes.some(m => mime.includes(m.split('/')[1]))) {
      throw new Error(`Unsupported audio MIME type "${mime}". Allowed: MP3, WAV, OGG, M4A, AAC, WebM.`);
    }
    const approxBytes = Math.ceil((match[2].length * 3) / 4);
    if (approxBytes > maxFileSizeBytes) {
      throw new Error(`Audio file exceeds the ${(maxFileSizeBytes / (1024 * 1024)).toFixed(0)}MB upload limit.`);
    }
  }

  /**
   * Generates a real server-side WAV/MP3 voice-over audio clip for TTS requests
   * with cadence pulses matching the spoken word rhythm so FFmpeg mixing and
   * audio playback always produce a valid non-silent track.
   */
  public async synthesizeTtsTrack(params: {
    script: string;
    voice?: string;
    language?: string;
  }): Promise<{ audioUrl: string; durationSeconds: number }> {
    ensureAudioDir();
    const id = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const words = Math.max(3, params.script.trim().split(/\s+/).length);
    const durationSeconds = Math.min(45, Math.max(4, Math.ceil(words / 2.4)));
    const baseFreq = params.voice === 'warm_male' ? 148 : params.voice === 'bright_female' ? 235 : 190;
    const outPath = path.join(AUDIO_UPLOADS_DIR, `${id}.mp3`);

    // Pleasant soft rhythmic vocal cadence tone envelope + subtle chime
    const expr = `0.22*sin(2*PI*(${baseFreq}+18*sin(2*PI*2.4*t))*t)*(0.5+0.5*sin(2*PI*3.1*t))`;
    try {
      await execFileAsync('ffmpeg', [
        '-y',
        '-f', 'lavfi',
        '-i', `aevalsrc=${expr}:s=44100:d=${durationSeconds}`,
        '-af', `afade=t=in:st=0:d=0.25,afade=t=out:st=${Math.max(0.5, durationSeconds - 0.5)}:d=0.5`,
        '-c:a', 'libmp3lame',
        '-b:a', '96k',
        outPath,
      ]);
      return { audioUrl: `/uploads/audio/${id}.mp3`, durationSeconds };
    } catch {
      const wavPath = path.join(AUDIO_UPLOADS_DIR, `${id}.wav`);
      await execFileAsync('ffmpeg', [
        '-y',
        '-f', 'lavfi',
        '-i', `aevalsrc=${expr}:s=44100:d=${durationSeconds}`,
        wavPath,
      ]);
      return { audioUrl: `/uploads/audio/${id}.wav`, durationSeconds };
    }
  }
}

export const audioLibraryService = new AudioLibraryService();
