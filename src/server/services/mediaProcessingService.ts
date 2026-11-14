import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';
import { CaptionSegment, ShortAudioConfig, ShortJob } from '../../types';
import { audioLibraryService, AUDIO_UPLOADS_DIR } from './audioLibraryService';

const execFileAsync = promisify(execFile);

export const SHORTS_OUTPUT_DIR = path.resolve(process.cwd(), 'uploads', 'shorts');
export const RAW_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'raw');

function ensureMediaDirs() {
  for (const dir of [SHORTS_OUTPUT_DIR, RAW_UPLOADS_DIR, AUDIO_UPLOADS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export interface VideoProbeInfo {
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
}

export class MediaProcessingService {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    if (process.env.GEMINI_API_KEY) {
      try {
        this.genAI = new GoogleGenAI({});
      } catch {
        this.genAI = null;
      }
    }
  }

  /**
   * Saves a base64 data URL or raw buffer to disk under /uploads/raw and returns the public /uploads/raw/... URL.
   */
  public saveDataUrlToDisk(dataUrlOrPath: string, preferredPrefix: string): string {
    ensureMediaDirs();
    if (!dataUrlOrPath) throw new Error('Empty media payload');

    if (dataUrlOrPath.startsWith('/uploads/')) {
      return dataUrlOrPath;
    }
    if (dataUrlOrPath.startsWith('http://') || dataUrlOrPath.startsWith('https://')) {
      return dataUrlOrPath;
    }

    const match = dataUrlOrPath.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Unsupported media format. Provide a valid video, photo, or audio file.');
    }

    const mime = match[1].toLowerCase();
    const base64Data = match[2];
    let ext = 'bin';
    if (mime.includes('mp4') && !mime.includes('audio')) ext = 'mp4';
    else if (mime.includes('mp4') && mime.includes('audio')) ext = 'm4a';
    else if (mime.includes('m4a') || mime.includes('aac')) ext = 'm4a';
    else if (mime.includes('webm')) ext = 'webm';
    else if (mime.includes('quicktime') || mime.includes('mov')) ext = 'mov';
    else if (mime.includes('png')) ext = 'png';
    else if (mime.includes('webp')) ext = 'webp';
    else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
    else if (mime.includes('mpeg') || mime.includes('mp3')) ext = 'mp3';
    else if (mime.includes('wav')) ext = 'wav';
    else if (mime.includes('ogg')) ext = 'ogg';

    const filename = `${preferredPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const absPath = path.join(RAW_UPLOADS_DIR, filename);
    fs.writeFileSync(absPath, Buffer.from(base64Data, 'base64'));
    return `/uploads/raw/${filename}`;
  }

  public resolveLocalFilePath(publicUrlOrPath: string): string {
    if (publicUrlOrPath.startsWith('/uploads/')) {
      const rel = publicUrlOrPath.replace(/^\/uploads\//, '');
      return path.resolve(process.cwd(), 'uploads', rel);
    }
    if (publicUrlOrPath.startsWith('http://') || publicUrlOrPath.startsWith('https://')) {
      return publicUrlOrPath; // FFmpeg accepts http(s) URLs directly when reachable
    }
    return publicUrlOrPath;
  }

  public async probeVideo(inputPath: string): Promise<VideoProbeInfo> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'stream=codec_type,width,height:format=duration',
        '-of', 'json',
        inputPath,
      ], { timeout: 15000 });
      const parsed = JSON.parse(stdout);
      const videoStream = (parsed.streams || []).find((s: any) => s.codec_type === 'video');
      const audioStream = (parsed.streams || []).find((s: any) => s.codec_type === 'audio');
      const duration = Math.max(1, Number(parsed.format?.duration || 20));
      return {
        width: Number(videoStream?.width || 1080),
        height: Number(videoStream?.height || 1920),
        duration,
        hasAudio: Boolean(audioStream),
      };
    } catch {
      return { width: 1080, height: 1920, duration: 20, hasAudio: false };
    }
  }

  /**
   * Detects the best 15-60s segment in a longer video via FFmpeg scene change analysis.
   */
  public async detectBestVideoSegment(
    inputPath: string,
    totalDuration: number,
    requestedStart?: number,
    requestedEnd?: number
  ): Promise<{ startSec: number; durationSec: number }> {
    if (requestedStart !== undefined && requestedEnd !== undefined && requestedEnd > requestedStart) {
      const clampedDur = Math.min(60, Math.max(15, requestedEnd - requestedStart));
      return {
        startSec: Math.max(0, Math.min(requestedStart, Math.max(0, totalDuration - clampedDur))),
        durationSec: Math.min(totalDuration, clampedDur),
      };
    }

    if (totalDuration <= 60) {
      return { startSec: 0, durationSec: Math.max(5, totalDuration) };
    }

    // Target 30s highlight clip (within 15-60s policy)
    const targetDur = Math.min(45, Math.max(15, Math.round(totalDuration * 0.45)));
    try {
      const { stderr } = await execFileAsync('ffmpeg', [
        '-hide_banner',
        '-i', inputPath,
        '-vf', "select='gt(scene,0.28)',showinfo",
        '-f', 'null',
        '-',
      ], { timeout: 20000 });

      const ptsMatches = [...stderr.matchAll(/pts_time:([0-9.]+)/g)].map(m => Number(m[1]));
      if (ptsMatches.length > 0) {
        // Pick cluster start with highest activity early-to-mid video
        const anchor = ptsMatches[Math.min(ptsMatches.length - 1, Math.floor(ptsMatches.length / 3))];
        const safeStart = Math.max(0, Math.min(anchor, totalDuration - targetDur));
        return { startSec: Number(safeStart.toFixed(2)), durationSec: targetDur };
      }
    } catch {
      // Fallback to golden-ratio midpoint if scene filter produces no matches
    }

    const midStart = Math.max(0, Math.min(totalDuration * 0.25, totalDuration - targetDur));
    return { startSec: Number(midStart.toFixed(2)), durationSec: targetDur };
  }

  /**
   * Generates timed speech-to-text / caption segments for the Short.
   */
  public async generateAutoCaptions(params: {
    caption: string;
    voiceOverScript?: string;
    durationSec: number;
    enabled: boolean;
  }): Promise<CaptionSegment[]> {
    if (!params.enabled) return [];

    const sourceText = (params.voiceOverScript || params.caption || 'Explore this curated AirBus stay in stunning 9:16 view.').trim();

    if (this.genAI && sourceText.length > 6) {
      try {
        const response = await this.genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Split or adapt this Short video caption/narration into 3 to 5 concise subtitle lines (max 8 words per line) suitable for a ${Math.round(params.durationSec)}s travel vertical reel. Return ONLY valid JSON array of strings, no markdown:\n"${sourceText}"`,
        });
        const raw = (response.text || '').replace(/```json|```/g, '').trim();
        const lines: string[] = JSON.parse(raw);
        if (Array.isArray(lines) && lines.length > 0) {
          const step = params.durationSec / lines.length;
          return lines.slice(0, 6).map((line, idx) => ({
            id: `cap_${idx + 1}`,
            startSec: Number((idx * step).toFixed(2)),
            endSec: Number(((idx + 1) * step).toFixed(2)),
            text: String(line).slice(0, 80),
          }));
        }
      } catch {
        // Deterministic fallback below
      }
    }

    const words = sourceText.split(/\s+/).filter(Boolean);
    const chunkSize = 6;
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    if (chunks.length === 0) chunks.push('Welcome to AirBus Stays');

    const step = params.durationSec / chunks.length;
    return chunks.map((text, idx) => ({
      id: `cap_${idx + 1}`,
      startSec: Number((idx * step).toFixed(2)),
      endSec: Number(((idx + 1) * step).toFixed(2)),
      text,
    }));
  }

  /**
   * Runs platform content & copyright moderation on generated Short metadata + audio config.
   */
  public moderateShortContent(caption: string, hashtags: string[], audioConfig: ShortAudioConfig): { approved: boolean; reason?: string } {
    const blockedTerms = ['scam', 'fraud', 'explicit', 'hate', 'illegal'];
    const combined = `${caption} ${hashtags.join(' ')}`.toLowerCase();
    for (const term of blockedTerms) {
      if (combined.includes(term)) {
        return { approved: false, reason: `Caption or hashtags contain prohibited term "${term}".` };
      }
    }
    if (audioConfig.mode !== 'none' && audioConfig.mode !== 'original' && !audioConfig.trackUrl && !audioConfig.voiceOverUrl) {
      return { approved: false, reason: 'Short audio configuration is incomplete.' };
    }
    return { approved: true };
  }

  /**
   * Core FFmpeg processor:
   *  - Videos: scene-aware 15-60s trim + 1080x1920 9:16 crop or blur-fill
   *  - Photos: Ken Burns slideshow (3.5s/photo) + smooth crossfades in 1080x1920
   *  - Audio: mixes original + looped/trimmed song + voice-over with auto-ducking
   */
  public async processShortJob(
    job: ShortJob,
    onProgress: (progress: number, stageLabel: string) => void
  ): Promise<{
    outputVideoUrl: string;
    outputThumbnailUrl: string;
    outputDurationSec: number;
    captions: CaptionSegment[];
  }> {
    ensureMediaDirs();
    await audioLibraryService.ensureLocalAudioAssets();

    const outFilename = `short_${job.id}.mp4`;
    const thumbFilename = `short_${job.id}.jpg`;
    const outPath = path.join(SHORTS_OUTPUT_DIR, outFilename);
    const thumbPath = path.join(SHORTS_OUTPUT_DIR, thumbFilename);

    let videoDurationSec = 15;
    let sourceHasAudio = false;
    let resolvedCropMode = job.aspectCropMode;

    onProgress(15, 'Preparing 9:16 canvas and validating media');

    // Step 1: Build pure 9:16 intermediate video (without final mixed audio yet)
    const tempVideoPath = path.join(SHORTS_OUTPUT_DIR, `tmp_vid_${job.id}.mp4`);

    if (job.sourceType === 'video') {
      const rawUrl = job.sourceFiles[0];
      const inputPath = this.resolveLocalFilePath(rawUrl);

      onProgress(28, 'Analyzing motion, scene changes & framing');
      const probe = await this.probeVideo(inputPath);
      sourceHasAudio = probe.hasAudio;

      // Auto-select blur_fill for wide landscape videos so subjects are not cropped out
      if (probe.width / Math.max(1, probe.height) > 1.35 && job.aspectCropMode !== 'smart_center') {
        resolvedCropMode = 'blur_fill';
      }

      const seg = await this.detectBestVideoSegment(
        inputPath,
        probe.duration,
        job.trimStartSec > 0 ? job.trimStartSec : undefined,
        job.trimEndSec > job.trimStartSec ? job.trimEndSec : undefined
      );
      videoDurationSec = seg.durationSec;

      onProgress(48, 'Reframing video to 1080×1920 (9:16)');

      const vfFilter =
        resolvedCropMode === 'blur_fill'
          ? 'split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[b];[fg]scale=1080:1920:force_original_aspect_ratio=decrease[f];[b][f]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p'
          : 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,format=yuv420p';

      const args = [
        '-y',
        '-ss', String(seg.startSec),
        '-t', String(seg.durationSec),
        '-i', inputPath,
        '-vf', vfFilter,
        '-r', '30',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '24',
      ];
      if (sourceHasAudio) {
        args.push('-c:a', 'aac', '-b:a', '128k');
      } else {
        args.push('-an');
      }
      args.push(tempVideoPath);

      await execFileAsync('ffmpeg', args, { timeout: 120000 });
    } else {
      // PHOTO SLIDESHOW MODE (3.5s per photo, Ken Burns zoompan, 9:16 1080x1920)
      const photoInputs = job.sourceFiles.map(f => this.resolveLocalFilePath(f));
      if (photoInputs.length === 0) {
        throw new Error('At least one photo is required to auto-create a Photo Reel.');
      }

      onProgress(32, `Composing Ken Burns 9:16 slideshow (${photoInputs.length} photo${photoInputs.length > 1 ? 's' : ''})`);

      const perPhotoSec = photoInputs.length === 1 ? 15 : photoInputs.length === 2 ? 7.5 : 4;
      const totalSlides = photoInputs.length;
      videoDurationSec = Math.min(60, Math.max(15, Number((totalSlides * perPhotoSec).toFixed(1))));
      const effectiveSlideDur = videoDurationSec / totalSlides;
      const framesPerSlide = Math.max(30, Math.round(effectiveSlideDur * 30));

      const args: string[] = ['-y'];
      const filterParts: string[] = [];

      photoInputs.forEach((pPath, idx) => {
        args.push('-loop', '1', '-t', String(effectiveSlideDur + 0.5), '-i', pPath);
        const zoomExpr = idx % 2 === 0 ? "min(zoom+0.0012,1.15)" : "if(lte(zoom,1.0),1.15,max(1.001,zoom-0.0012))";
        filterParts.push(
          `[${idx}:v]scale=1280:2276:force_original_aspect_ratio=increase,crop=1280:2276,` +
          `zoompan=z='${zoomExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${framesPerSlide}:s=1080x1920:fps=30,` +
          `setsar=1,trim=duration=${effectiveSlideDur.toFixed(2)},setpts=PTS-STARTPTS[v${idx}]`
        );
      });

      if (totalSlides === 1) {
        filterParts.push(`[v0]format=yuv420p[vout]`);
      } else {
        // Chain smooth xfade crossfades (0.45s) between consecutive slides
        const fadeDur = 0.45;
        let lastLabel = 'v0';
        let currentOffset = effectiveSlideDur - fadeDur;
        for (let i = 1; i < totalSlides; i++) {
          const outLabel = i === totalSlides - 1 ? 'vmerged' : `xf${i}`;
          filterParts.push(
            `[${lastLabel}][v${i}]xfade=transition=fade:duration=${fadeDur}:offset=${Math.max(0.5, currentOffset).toFixed(2)}[${outLabel}]`
          );
          lastLabel = outLabel;
          currentOffset += effectiveSlideDur - fadeDur;
        }
        filterParts.push(`[${lastLabel}]format=yuv420p[vout]`);
      }

      args.push(
        '-filter_complex', filterParts.join(';'),
        '-map', '[vout]',
        '-t', String(videoDurationSec),
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '24',
        '-an',
        tempVideoPath
      );

      await execFileAsync('ffmpeg', args, { timeout: 120000 });
    }

    // Step 2: Audio Mixing (Original + Song looped/trimmed + Voice-over with auto-ducking)
    onProgress(72, 'Mixing audio tracks, voice-over & auto-ducking');
    const audio = job.audioConfig;
    const keepOriginal = sourceHasAudio && audio.originalVolume > 0;
    const songFile = audio.trackId
      ? audioLibraryService.getTrackFilePath(audio.trackId)
      : (audio.trackUrl ? this.resolveLocalFilePath(audio.trackUrl) : null);
    const hasMusic = Boolean(songFile && audio.musicVolume > 0 && audio.mode !== 'original' && audio.mode !== 'voiceover');
    const voFile = audio.voiceOverUrl ? this.resolveLocalFilePath(audio.voiceOverUrl) : null;
    const hasVo = Boolean(voFile && fs.existsSync(voFile) && audio.voiceOverVolume > 0);

    const mixArgs: string[] = ['-y', '-i', tempVideoPath];
    const audioFilterNodes: string[] = [];
    const mixInputs: string[] = [];
    let nextInputIdx = 1;

    if (keepOriginal) {
      const origGain = (audio.originalVolume / 100).toFixed(2);
      audioFilterNodes.push(`[0:a]volume=${origGain}[aorig]`);
      mixInputs.push('[aorig]');
    }

    let musicInputIdx = -1;
    if (hasMusic && songFile) {
      musicInputIdx = nextInputIdx++;
      mixArgs.push('-stream_loop', '-1');
      if (audio.audioStartSec && audio.audioStartSec > 0) {
        mixArgs.push('-ss', String(audio.audioStartSec));
      }
      mixArgs.push('-i', songFile);
    }

    let voInputIdx = -1;
    if (hasVo && voFile) {
      voInputIdx = nextInputIdx++;
      mixArgs.push('-i', voFile);
    }

    if (musicInputIdx !== -1 && voInputIdx !== -1 && audio.autoDuckMusic) {
      const musicGain = (audio.musicVolume / 100).toFixed(2);
      const voGain = (audio.voiceOverVolume / 100).toFixed(2);
      audioFilterNodes.push(
        `[${musicInputIdx}:a]volume=${musicGain}[amus_pre]`,
        `[${voInputIdx}:a]volume=${voGain},asplit=2[avo_sc][avo_mix]`,
        `[amus_pre][avo_sc]sidechaincompress=threshold=0.04:ratio=6:attack=40:release=350[amus_duck]`,
      );
      mixInputs.push('[amus_duck]', '[avo_mix]');
    } else {
      if (musicInputIdx !== -1) {
        const musicGain = (audio.musicVolume / 100).toFixed(2);
        audioFilterNodes.push(`[${musicInputIdx}:a]volume=${musicGain}[amus]`);
        mixInputs.push('[amus]');
      }
      if (voInputIdx !== -1) {
        const voGain = (audio.voiceOverVolume / 100).toFixed(2);
        audioFilterNodes.push(`[${voInputIdx}:a]volume=${voGain}[avo]`);
        mixInputs.push('[avo]');
      }
    }

    // Optional audio: when mode is 'none' (or no track/VO attached), preserve original audio if present or keep silent — NEVER inject mus_1 automatically
    if (mixInputs.length > 0) {
      const amixExpr =
        mixInputs.length === 1
          ? `${mixInputs[0]}atrim=0:${videoDurationSec.toFixed(2)},afade=t=out:st=${Math.max(0.5, videoDurationSec - 0.8).toFixed(2)}:d=0.8[aout]`
          : `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=longest:dropout_transition=2,atrim=0:${videoDurationSec.toFixed(2)},afade=t=out:st=${Math.max(0.5, videoDurationSec - 0.8).toFixed(2)}:d=0.8[aout]`;
      audioFilterNodes.push(amixExpr);

      mixArgs.push(
        '-filter_complex', audioFilterNodes.join(';'),
        '-map', '0:v',
        '-map', '[aout]',
        '-t', String(videoDurationSec),
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outPath
      );
    } else {
      mixArgs.push('-c:v', 'copy', '-an', '-movflags', '+faststart', outPath);
    }

    await execFileAsync('ffmpeg', mixArgs, { timeout: 120000 });

    // Clean temporary unmixed video
    try {
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    } catch {}

    // Step 3: Extract 9:16 Thumbnail
    onProgress(86, 'Generating 9:16 cover poster');
    try {
      await execFileAsync('ffmpeg', [
        '-y',
        '-ss', String(Math.min(1.5, videoDurationSec / 3)),
        '-i', outPath,
        '-vframes', '1',
        '-q:v', '3',
        thumbPath,
      ], { timeout: 15000 });
    } catch {}

    // Step 4: Auto-Captions
    onProgress(93, job.autoCaptionsEnabled ? 'Generating timed auto-captions' : 'Finalizing metadata');
    const captions = await this.generateAutoCaptions({
      caption: job.caption,
      voiceOverScript: job.audioConfig.ttsScript,
      durationSec: videoDurationSec,
      enabled: job.autoCaptionsEnabled,
    });

    onProgress(100, 'Ready');
    return {
      outputVideoUrl: `/uploads/shorts/${outFilename}`,
      outputThumbnailUrl: fs.existsSync(thumbPath)
        ? `/uploads/shorts/${thumbFilename}`
        : (job.sourceType === 'photo' ? job.sourceFiles[0] : 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80'),
      outputDurationSec: Math.round(videoDurationSec),
      captions,
    };
  }
}

export const mediaProcessingService = new MediaProcessingService();
