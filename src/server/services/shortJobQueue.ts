import { Post, ShortAudioConfig, ShortJob } from '../../types';
import { audioLibraryService } from './audioLibraryService';
import { mediaProcessingService } from './mediaProcessingService';

export interface ShortJobDbAdapter {
  getShortJobs(ownerEmail?: string): ShortJob[];
  getShortJobById(id: string): ShortJob | undefined;
  findShortJobByIdempotencyKey(key: string): ShortJob | undefined;
  upsertShortJob(job: ShortJob): void;
  getAudioTracks(): any[];
  publishGeneratedShortPost(params: {
    job: ShortJob;
    status: 'approved' | 'draft';
    moderationStatus: 'approved' | 'flagged';
  }): Post;
  notifyUser(userEmail: string, title: string, message: string, link?: string): void;
}

export class ShortJobQueue {
  private adapter: ShortJobDbAdapter | null = null;
  private activeJobIds = new Set<string>();

  public init(adapter: ShortJobDbAdapter) {
    this.adapter = adapter;
  }

  public enqueue(params: {
    idempotencyKey: string;
    ownerEmail: string;
    ownerName: string;
    stayId?: string;
    sourceType: 'video' | 'photo';
    sourceFiles: string[];
    autoCreateEnabled?: boolean;
    reviewBeforePosting?: boolean;
    autoCaptionsEnabled?: boolean;
    aspectCropMode?: 'smart_center' | 'blur_fill';
    trimStartSec?: number;
    trimEndSec?: number;
    caption?: string;
    hashtags?: string[];
    audioConfig?: Partial<ShortAudioConfig>;
    allowAudio?: boolean;
  }): { job: ShortJob; deduplicated: boolean } {
    if (!this.adapter) throw new Error('ShortJobQueue not initialized');

    // Prevent duplicate jobs & posts via idempotency key
    const existing = this.adapter.findShortJobByIdempotencyKey(params.idempotencyKey);
    if (existing) {
      return { job: existing, deduplicated: true };
    }

    const tracks = this.adapter.getAudioTracks();
    const resolvedAudio = audioLibraryService.resolveAudioConfig(params.audioConfig, tracks, {
      allowMusicOrVoiceOver: params.allowAudio !== false,
    });

    const cleanTags = (params.hashtags && params.hashtags.length > 0
      ? params.hashtags
      : ['#AirBusStays', '#TravelKenya', '#ShortStay']
    ).map(h => (h.startsWith('#') ? h : `#${h}`)).slice(0, 10);

    const autoCaption =
      params.caption?.trim() ||
      (params.sourceType === 'photo'
        ? `Take a closer look inside this curated AirBus stay ✨ ${cleanTags.slice(0, 2).join(' ')}`
        : `Highlight reel from this verified AirBus property ✨ ${cleanTags.slice(0, 2).join(' ')}`);

    const reviewBeforePosting = Boolean(params.reviewBeforePosting);

    const job: ShortJob = {
      id: `sjob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      idempotencyKey: params.idempotencyKey,
      ownerEmail: params.ownerEmail.toLowerCase(),
      ownerName: params.ownerName,
      stayId: params.stayId,
      sourceType: params.sourceType,
      sourceFiles: params.sourceFiles,
      autoCreateEnabled: params.autoCreateEnabled !== false,
      autoPublish: !reviewBeforePosting,
      reviewBeforePosting,
      autoCaptionsEnabled: params.autoCaptionsEnabled !== false,
      aspectCropMode: params.aspectCropMode || 'smart_center',
      trimStartSec: Number(params.trimStartSec || 0),
      trimEndSec: Number(params.trimEndSec || 0),
      caption: autoCaption,
      hashtags: cleanTags,
      captions: [],
      audioConfig: resolvedAudio,
      state: 'queued',
      progress: 5,
      stageLabel: 'Queued for background 9:16 processing',
      retryCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.adapter.upsertShortJob(job);

    // Trigger non-blocking background worker on next tick
    setImmediate(() => {
      this.runJob(job.id).catch(() => {});
    });

    return { job, deduplicated: false };
  }

  public retryJob(jobId: string): ShortJob {
    if (!this.adapter) throw new Error('ShortJobQueue not initialized');
    const job = this.adapter.getShortJobById(jobId);
    if (!job) throw new Error('Short processing job not found');

    job.state = 'queued';
    job.progress = 5;
    job.stageLabel = 'Re-queued for retry';
    job.errorMessage = undefined;
    job.retryCount = (job.retryCount || 0) + 1;
    job.updatedAt = Date.now();
    this.adapter.upsertShortJob(job);

    setImmediate(() => {
      this.runJob(job.id).catch(() => {});
    });

    return job;
  }

  private async runJob(jobId: string): Promise<void> {
    if (!this.adapter) return;
    if (this.activeJobIds.has(jobId)) return;

    const job = this.adapter.getShortJobById(jobId);
    if (!job || job.state === 'ready') return;

    this.activeJobIds.add(jobId);
    try {
      job.state = 'processing';
      job.progress = 10;
      job.stageLabel = 'Starting background 9:16 media pipeline';
      job.updatedAt = Date.now();
      this.adapter.upsertShortJob(job);

      const result = await mediaProcessingService.processShortJob(job, (progress, stageLabel) => {
        job.progress = progress;
        job.stageLabel = stageLabel;
        job.updatedAt = Date.now();
        this.adapter?.upsertShortJob(job);
      });

      // Content & copyright moderation check before publishing
      const mod = mediaProcessingService.moderateShortContent(job.caption, job.hashtags, job.audioConfig);
      if (!mod.approved) {
        throw new Error(mod.reason || 'Generated Short failed content moderation checks.');
      }

      job.outputVideoUrl = result.outputVideoUrl;
      job.outputThumbnailUrl = result.outputThumbnailUrl;
      job.outputDurationSec = result.outputDurationSec;
      job.captions = result.captions;
      job.state = 'ready';
      job.progress = 100;
      job.stageLabel = job.reviewBeforePosting ? 'Ready as draft (awaiting your review)' : 'Ready & published to Shorts';
      job.updatedAt = Date.now();

      // Publish or save as draft (never publishes partial/broken videos on failure)
      if (!job.publishedPostId) {
        const post = this.adapter.publishGeneratedShortPost({
          job,
          status: job.reviewBeforePosting ? 'draft' : 'approved',
          moderationStatus: 'approved',
        });
        job.publishedPostId = post.id;
      }

      this.adapter.upsertShortJob(job);

      this.adapter.notifyUser(
        job.ownerEmail,
        job.reviewBeforePosting ? 'Your Short Draft is Ready ✨' : 'Your Short is Live on AirBus Reels! 🎬',
        job.reviewBeforePosting
          ? `Your 9:16 Short (${result.outputDurationSec}s) finished processing and is waiting in your listing Shorts studio.`
          : `Your 9:16 Short (${result.outputDurationSec}s) has been published to Shorts and linked to your listing.`,
        '/#shorts'
      );
    } catch (err: any) {
      // Failed jobs must never publish partial or broken videos
      job.state = 'failed';
      job.stageLabel = 'Processing failed';
      job.errorMessage = err?.message || 'Unable to process uploaded media into a 9:16 Short.';
      job.updatedAt = Date.now();
      this.adapter.upsertShortJob(job);

      this.adapter.notifyUser(
        job.ownerEmail,
        'Short Creation Failed — Retry Available',
        `Background processing stopped: ${job.errorMessage}. Open your Shorts tab to retry.`,
        '/#owner'
      );
    } finally {
      this.activeJobIds.delete(jobId);
    }
  }
}

export const shortJobQueue = new ShortJobQueue();
