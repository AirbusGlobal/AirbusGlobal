import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { db, hashPassword, PLANS, SESSION_IDLE_TIMEOUT_MS, validatePasswordStrength } from './src/server/db';
import { User, Stay, StayCategory, Booking, ChatThread, ChatMessage, PaymentRecordType, PaymentRecordMethod, ShortIntentType } from './src/types';
import { audioLibraryService } from './src/server/services/audioLibraryService';
import { CHUNK_UPLOADS_DIR, mediaProcessingService, VIDEOS_OUTPUT_DIR } from './src/server/services/mediaProcessingService';
import { shortJobQueue } from './src/server/services/shortJobQueue';
import { SHORTS_TIER_CONFIG, AUDIO_UPLOAD_CONFIG } from './src/config/shortsTierConfig';
import { apiRateLimiter, logger, opsMetrics, requestIdMiddleware, walletMutex } from './src/server/services/ops';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const portArgIdx = process.argv.indexOf('--port');
const cliPort =
  portArgIdx !== -1 && process.argv[portArgIdx + 1]
    ? parseInt(process.argv[portArgIdx + 1], 10)
    : NaN;
const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : NaN;
const nginxPort = process.env.NGINX_PORT ? parseInt(process.env.NGINX_PORT, 10) : 8080;
const defaultAppPort = process.env.DEFAULT_APP_PORT
  ? parseInt(process.env.DEFAULT_APP_PORT, 10)
  : 3000;
const PORT = !Number.isNaN(cliPort)
  ? cliPort
  : !Number.isNaN(envPort) && (isProduction || envPort !== nginxPort)
    ? envPort
    : defaultAppPort;

app.use(express.json({ limit: '65mb' }));
app.use(requestIdMiddleware);

// Serve generated Shorts, thumbnails, raw media, transcoded videos, and free-source audio assets
// with explicit HTTP 206 Range streaming, Content-Type, Accept-Ranges, and CORS headers
const uploadsRoot = path.resolve(process.cwd(), 'uploads');
const RAW_UPLOADS_DIR = path.resolve(uploadsRoot, 'raw');
for (const dir of [uploadsRoot, RAW_UPLOADS_DIR, VIDEOS_OUTPUT_DIR, CHUNK_UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getUploadMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.ogg') return 'audio/ogg';
  return 'application/octet-stream';
}

function serveUploadsWithRange(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  let cleanRel = '';
  try {
    cleanRel = decodeURIComponent(req.path || '').replace(/^\/+/, '');
  } catch {
    return res.status(400).end();
  }
  if (!cleanRel || cleanRel.includes('..')) {
    return next();
  }

  const resolved = path.resolve(uploadsRoot, cleanRel);
  if (!resolved.startsWith(uploadsRoot + path.sep) || !fs.existsSync(resolved)) {
    return next();
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    return next();
  }

  const mime = getUploadMimeType(resolved);
  const total = stat.size;
  res.setHeader('Content-Type', mime);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  const rangeHeader = req.headers.range;
  if (rangeHeader && /^bytes=\d*-\d*$/i.test(rangeHeader.trim())) {
    const [rawStart, rawEnd] = rangeHeader.trim().replace(/^bytes=/i, '').split('-');
    let start = rawStart ? parseInt(rawStart, 10) : 0;
    let end = rawEnd ? parseInt(rawEnd, 10) : total - 1;

    if (!rawStart && rawEnd) {
      const suffixLen = parseInt(rawEnd, 10);
      start = Math.max(0, total - suffixLen);
      end = total - 1;
    }

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
      res.setHeader('Content-Range', `bytes */${total}`);
      return res.status(416).end();
    }

    end = Math.min(end, total - 1);
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', String(chunkSize));

    if (req.method === 'HEAD') {
      return res.end();
    }
    const stream = fs.createReadStream(resolved, { start, end });
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    return stream.pipe(res);
  }

  res.status(200);
  res.setHeader('Content-Length', String(total));
  if (req.method === 'HEAD') {
    return res.end();
  }
  const stream = fs.createReadStream(resolved);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).end();
    else res.end();
  });
  return stream.pipe(res);
}

app.use('/uploads', serveUploadsWithRange, express.static(uploadsRoot));
app.use('/AirbusGlobal/uploads', serveUploadsWithRange, express.static(uploadsRoot));

// Normalize /AirbusGlobal/api into /api so both paths work seamlessly
app.use((req, res, next) => {
  if (req.url.startsWith('/AirbusGlobal/api/')) {
    req.url = req.url.replace(/^\/AirbusGlobal/, '');
  }
  next();
});

// Initialize Google GenAI client if API key exists
let genAI: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenAI({});
  } catch (err) {
    console.warn('GenAI initialization skipped:', err);
  }
}

// Auth helper from Bearer header or query token (for EventSource SSE)
function extractAuthToken(req: express.Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }
  if (typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  return '';
}

function getAuthUser(req: express.Request, options?: { touch?: boolean }): User | null {
  const token = extractAuthToken(req);
  if (!token) return null;
  return db.getUserByAuthToken(token, options) || null;
}

// In-Memory Rate Limiting Store
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const loginRateLimitMap = new Map<string, RateLimitRecord>();
const adminSetupRateLimitMap = new Map<string, RateLimitRecord>();

function checkRateLimit(
  map: Map<string, RateLimitRecord>,
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = map.get(key);

  if (!entry || now > entry.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// -----------------------------------------------------------------------------
// REST API ENDPOINTS
// -----------------------------------------------------------------------------

// Health check & operational metrics
app.get('/api/health', (req, res) => {
  const raw = db.getRaw();
  res.json({
    status: 'ok',
    service: 'AirBus Backend',
    time: new Date().toISOString(),
    uptimeSec: Math.round((Date.now() - opsMetrics.startedAt) / 1000),
    totalRequests: opsMetrics.totalRequests,
    totalErrors: opsMetrics.totalErrors,
    recentErrors: opsMetrics.recentErrors.slice(0, 10),
    dbOk: Boolean(raw && Array.isArray(raw.stays)),
  });
});

// -----------------------------------------------------------------------------
// CONFIRMED PERSISTENT MEDIA UPLOAD, CHUNKED UPLOAD & TRANSCODING (No blob: URLs)
// -----------------------------------------------------------------------------
const rawMediaUploadParser = express.raw({
  type: ['video/*', 'image/*', 'application/octet-stream'],
  limit: '155mb',
});

const rawChunkUploadParser = express.raw({
  type: ['application/octet-stream', 'video/*', 'image/*'],
  limit: '25mb',
});

interface ChunkUploadSession {
  uploadId: string;
  ownerId: string;
  kind: 'photo' | 'video';
  mime: string;
  filename: string;
  totalBytes: number;
  totalChunks: number;
  receivedChunks: Set<number>;
  tempDir: string;
  createdAt: number;
}
const activeChunkUploads = new Map<string, ChunkUploadSession>();

async function finalizeUploadedMediaBuffer(params: {
  buffer?: Buffer;
  inputFilePath?: string;
  kind: 'photo' | 'video';
  mime: string;
  ownerId: string;
  requestId?: string;
}): Promise<{
  url: string;
  posterUrl?: string;
  id: string;
  mediaAsset: any;
  kind: 'photo' | 'video';
  bytes: number;
  mime: string;
  duration?: number;
  width?: number;
  height?: number;
  status: string;
}> {
  if (!fs.existsSync(RAW_UPLOADS_DIR)) fs.mkdirSync(RAW_UPLOADS_DIR, { recursive: true });
  const { kind, mime, ownerId, requestId } = params;

  const assetId = `ma_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  if (kind === 'photo') {
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `img_${Date.now()}_${crypto.randomBytes(5).toString('hex')}.${ext}`;
    const fullPath = path.join(RAW_UPLOADS_DIR, fileName);
    let sizeBytes = 0;
    if (params.buffer) {
      fs.writeFileSync(fullPath, params.buffer);
      sizeBytes = params.buffer.length;
    } else if (params.inputFilePath) {
      fs.copyFileSync(params.inputFilePath, fullPath);
      sizeBytes = fs.statSync(fullPath).size;
      try { fs.unlinkSync(params.inputFilePath); } catch {}
    }
    const url = `/uploads/raw/${fileName}`;
    const asset = db.createMediaAsset({
      id: assetId,
      owner_id: ownerId,
      type: 'IMAGE',
      storage_key: `raw/${fileName}`,
      url,
      mime,
      size_bytes: sizeBytes,
      status: 'READY',
    });
    logger.info('media_upload_saved', { requestId, kind, mime, bytes: sizeBytes, url, assetId, actor: ownerId });
    return { url, id: asset.id, mediaAsset: asset, kind, bytes: sizeBytes, mime, status: 'READY' };
  }

  // VIDEO: save raw file -> create PROCESSING asset -> transcode to web-safe H.264/AAC MP4 + poster -> mark READY
  const rawExt = mime === 'video/webm' ? 'webm' : mime === 'video/quicktime' ? 'mov' : 'mp4';
  const rawTempName = `raw_${assetId}.${rawExt}`;
  const rawTempPath = params.inputFilePath || path.join(RAW_UPLOADS_DIR, rawTempName);
  let inputBytes = 0;
  if (params.buffer) {
    fs.writeFileSync(rawTempPath, params.buffer);
    inputBytes = params.buffer.length;
  } else if (fs.existsSync(rawTempPath)) {
    inputBytes = fs.statSync(rawTempPath).size;
  }

  db.createMediaAsset({
    id: assetId,
    owner_id: ownerId,
    type: 'VIDEO',
    storage_key: `videos/${assetId}.mp4`,
    url: '',
    mime: 'video/mp4',
    size_bytes: inputBytes,
    status: 'PROCESSING',
  });

  try {
    const transcoded = await mediaProcessingService.transcodeUploadedVideo({
      inputPath: rawTempPath,
      assetId,
    });
    try {
      if (fs.existsSync(rawTempPath)) fs.unlinkSync(rawTempPath);
    } catch {}

    const asset = db.updateMediaAsset(assetId, {
      storage_key: transcoded.storageKey,
      url: transcoded.url,
      poster_url: transcoded.posterUrl,
      mime: transcoded.mime,
      size_bytes: transcoded.sizeBytes,
      duration: transcoded.duration,
      width: transcoded.width,
      height: transcoded.height,
      status: 'READY',
      error_message: undefined,
    });

    logger.info('media_video_transcoded', {
      requestId,
      assetId,
      url: transcoded.url,
      posterUrl: transcoded.posterUrl,
      duration: transcoded.duration,
      sizeBytes: transcoded.sizeBytes,
      actor: ownerId,
    });

    return {
      url: transcoded.url,
      posterUrl: transcoded.posterUrl,
      id: assetId,
      mediaAsset: asset,
      kind: 'video',
      bytes: transcoded.sizeBytes,
      mime: transcoded.mime,
      duration: transcoded.duration,
      width: transcoded.width,
      height: transcoded.height,
      status: 'READY',
    };
  } catch (err: any) {
    try {
      if (fs.existsSync(rawTempPath)) fs.unlinkSync(rawTempPath);
    } catch {}
    const msg = err?.message || 'Video transcoding failed.';
    db.updateMediaAsset(assetId, { status: 'FAILED', error_message: msg });
    throw new Error(msg);
  }
}

app.post('/api/uploads/media', rawMediaUploadParser, async (req, res) => {
  const user = getAuthUser(req);
  const clientSessionId = (req.headers['x-client-session'] as string) || '';
  const ownerId = user?.email || clientSessionId || 'anon';
  const rl = apiRateLimiter.check(`upload:${ownerId || req.ip || 'anon'}`, 60, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({
      error: `Too many media uploads. Please retry in ${rl.retryAfterSec}s.`,
    });
  }

  try {
    const reqId = (req as any).requestId;
    const isBinaryBuffer = Buffer.isBuffer(req.body);
    let buffer: Buffer;
    let mime = '';
    let kind: 'photo' | 'video' = 'photo';

    if (isBinaryBuffer) {
      buffer = req.body;
      mime = String(req.headers['x-file-mime'] || req.headers['content-type'] || '').toLowerCase();
      const origName = String(req.query.filename || req.headers['x-file-name'] || '').toLowerCase();
      const reqKind = String(req.query.kind || req.headers['x-media-kind'] || '').toLowerCase();
      if (reqKind === 'video' || mime.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(origName)) {
        kind = 'video';
      } else {
        kind = 'photo';
      }
      if (!mime || mime === 'application/octet-stream') {
        if (origName.endsWith('.mp4')) mime = 'video/mp4';
        else if (origName.endsWith('.webm')) mime = 'video/webm';
        else if (origName.endsWith('.mov')) mime = 'video/quicktime';
        else if (origName.endsWith('.png')) mime = 'image/png';
        else if (origName.endsWith('.webp')) mime = 'image/webp';
        else mime = kind === 'video' ? 'video/mp4' : 'image/jpeg';
      }
    } else {
      const { dataUrl, filename, kind: bodyKind } = req.body || {};
      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ error: 'Media payload is required (binary body or dataUrl).' });
      }
      const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
      if (!match) {
        return res.status(400).json({ error: 'Invalid media dataUrl format.' });
      }
      mime = match[1].toLowerCase();
      buffer = Buffer.from(match[2], 'base64');
      kind = bodyKind === 'video' || mime.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(String(filename || ''))
        ? 'video'
        : 'photo';
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Uploaded media file is empty.' });
    }

    const maxBytes = kind === 'video' ? 150 * 1024 * 1024 : 5 * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return res.status(400).json({
        error: `${kind === 'video' ? 'Video' : 'Photo'} exceeds maximum allowed size (${kind === 'video' ? '150MB' : '5MB'}).`,
      });
    }

    if (kind === 'photo' && !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mime)) {
      return res.status(400).json({ error: 'Only JPG, PNG, and WebP images are permitted.' });
    }
    if (kind === 'video' && !['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'].includes(mime)) {
      return res.status(400).json({ error: 'Only MP4, WebM, and MOV videos are permitted.' });
    }

    const result = await finalizeUploadedMediaBuffer({
      buffer,
      kind,
      mime,
      ownerId,
      requestId: reqId,
    });
    return res.status(201).json(result);
  } catch (err: any) {
    logger.error('media_upload_failed', { error: err?.message });
    return res.status(400).json({ error: err?.message || 'Media upload failed.' });
  }
});

// Resumable / Chunked Upload Endpoints for Large Video Files (up to 150MB)
app.post('/api/uploads/media/init', (req, res) => {
  const user = getAuthUser(req);
  const clientSessionId = (req.headers['x-client-session'] as string) || '';
  const ownerId = user?.email || clientSessionId || 'anon';
  const { filename, mime, totalBytes, totalChunks, kind } = req.body || {};
  const resolvedKind: 'photo' | 'video' =
    kind === 'video' || String(mime || '').startsWith('video/') || /\.(mp4|mov|webm)$/i.test(String(filename || ''))
      ? 'video'
      : 'photo';

  const normalizedMime = String(mime || (resolvedKind === 'video' ? 'video/mp4' : 'image/jpeg')).toLowerCase();
  if (resolvedKind === 'video' && !['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'].includes(normalizedMime)) {
    return res.status(400).json({ error: 'Only MP4, MOV, and WebM videos are supported.' });
  }
  const bytes = Number(totalBytes) || 0;
  const maxBytes = resolvedKind === 'video' ? 150 * 1024 * 1024 : 5 * 1024 * 1024;
  if (bytes <= 0 || bytes > maxBytes) {
    return res.status(400).json({ error: `Invalid file size. Max allowed is ${resolvedKind === 'video' ? '150MB' : '5MB'}.` });
  }

  const uploadId = `up_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
  const tempDir = path.join(CHUNK_UPLOADS_DIR, uploadId);
  fs.mkdirSync(tempDir, { recursive: true });

  activeChunkUploads.set(uploadId, {
    uploadId,
    ownerId,
    kind: resolvedKind,
    mime: normalizedMime,
    filename: String(filename || `${uploadId}.mp4`),
    totalBytes: bytes,
    totalChunks: Math.max(1, Number(totalChunks) || 1),
    receivedChunks: new Set<number>(),
    tempDir,
    createdAt: Date.now(),
  });

  return res.status(201).json({ uploadId, kind: resolvedKind });
});

app.put('/api/uploads/media/chunk/:uploadId', rawChunkUploadParser, (req, res) => {
  const session = activeChunkUploads.get(req.params.uploadId);
  if (!session) {
    return res.status(404).json({ error: 'Upload session not found or expired. Please restart upload.' });
  }
  const chunkIndex = Number(req.query.index ?? req.headers['x-chunk-index']);
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks) {
    return res.status(400).json({ error: 'Invalid chunk index.' });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Empty chunk payload.' });
  }

  const chunkPath = path.join(session.tempDir, `part_${String(chunkIndex).padStart(6, '0')}`);
  fs.writeFileSync(chunkPath, req.body);
  session.receivedChunks.add(chunkIndex);

  return res.json({
    uploadId: session.uploadId,
    chunkIndex,
    receivedCount: session.receivedChunks.size,
    totalChunks: session.totalChunks,
  });
});

app.post('/api/uploads/media/complete/:uploadId', async (req, res) => {
  const session = activeChunkUploads.get(req.params.uploadId);
  if (!session) {
    return res.status(404).json({ error: 'Upload session not found or already completed.' });
  }
  if (session.receivedChunks.size < session.totalChunks) {
    return res.status(400).json({
      error: `Upload incomplete: received ${session.receivedChunks.size} of ${session.totalChunks} chunks.`,
    });
  }

  const ext = session.mime === 'video/webm' ? 'webm' : session.mime === 'video/quicktime' ? 'mov' : session.kind === 'video' ? 'mp4' : 'jpg';
  const assembledPath = path.join(session.tempDir, `assembled.${ext}`);
  try {
    const outFd = fs.openSync(assembledPath, 'w');
    try {
      for (let i = 0; i < session.totalChunks; i += 1) {
        const partPath = path.join(session.tempDir, `part_${String(i).padStart(6, '0')}`);
        const data = fs.readFileSync(partPath);
        fs.writeSync(outFd, data);
      }
    } finally {
      fs.closeSync(outFd);
    }

    const result = await finalizeUploadedMediaBuffer({
      inputFilePath: assembledPath,
      kind: session.kind,
      mime: session.mime,
      ownerId: session.ownerId,
      requestId: (req as any).requestId,
    });
    activeChunkUploads.delete(session.uploadId);
    try {
      fs.rmSync(session.tempDir, { recursive: true, force: true });
    } catch {}
    return res.status(201).json(result);
  } catch (err: any) {
    activeChunkUploads.delete(session.uploadId);
    try {
      fs.rmSync(session.tempDir, { recursive: true, force: true });
    } catch {}
    return res.status(400).json({ error: err?.message || 'Chunked upload transcoding failed.' });
  }
});

app.get('/api/media/:id', (req, res) => {
  const asset = db.getMediaAssetById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Media asset not found.' });
  return res.json({ mediaAsset: asset });
});

app.post('/api/uploads/cleanup', (req, res) => {
  const { urls } = req.body || {};
  if (!Array.isArray(urls)) {
    return res.status(400).json({ error: 'urls array is required.' });
  }
  let removed = 0;
  for (const rawUrl of urls.slice(0, 30)) {
    if (typeof rawUrl !== 'string' || !rawUrl.startsWith('/uploads/raw/')) continue;
    const base = path.basename(rawUrl);
    if (!/^[a-zA-Z0-9_.-]+$/.test(base)) continue;
    const target = path.join(RAW_UPLOADS_DIR, base);
    if (fs.existsSync(target)) {
      try {
        fs.unlinkSync(target);
        removed += 1;
      } catch {
        // ignore cleanup error
      }
    }
  }
  return res.json({ removed });
});

// Serve robots.txt directly
app.get('/robots.txt', (req, res) => {
  const robotsPath = path.resolve(process.cwd(), 'public', 'robots.txt');
  if (fs.existsSync(robotsPath)) {
    res.type('text/plain');
    return res.sendFile(robotsPath);
  }
  res.type('text/plain').send('User-agent: *\nDisallow: /admin-portal-k7x2q9\nDisallow: /AirbusGlobal/admin-portal-k7x2q9\nAllow: /\n');
});

// Admin Portal Status (checks if single admin exists)
app.get('/api/admin-portal/status', (req, res) => {
  const hasAdmin = db.hasAdminAccount();
  return res.json({
    hasAdmin,
    canRegisterAdmin: !hasAdmin,
  });
});

// One-time Admin Registration on Private Portal
app.post('/api/admin-portal/setup', (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const rateCheck = checkRateLimit(adminSetupRateLimitMap, `setup_${clientIp}`, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Too many setup attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
      });
    }

    if (db.hasAdminAccount()) {
      return res.status(403).json({
        error: 'Admin registration is permanently closed. There is already a registered administrator.',
      });
    }

    const { name, email, password, setupKey, phone, location } = req.body;
    if (!name || !email || !password || !setupKey) {
      return res.status(400).json({ error: 'Name, email, password, and setup key are required.' });
    }

    const expectedSetupKey = process.env.ADMIN_SETUP_KEY || 'airbus-setup-2026';
    if (String(setupKey).trim() !== expectedSetupKey.trim()) {
      return res.status(401).json({ error: 'Invalid admin setup key.' });
    }

    const pwErr = validatePasswordStrength(String(password));
    if (pwErr) {
      return res.status(400).json({ error: pwErr });
    }

    const newAdmin = db.registerSingleAdmin({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash: hashPassword(String(password)),
      phone,
      location,
    });

    const { passwordHash, ...safeUser } = newAdmin as any;
    const session = db.createAuthSession(newAdmin, 'admin');
    return res.status(201).json({
      message: 'Sole administrator account successfully created.',
      user: safeUser,
      token: session.token,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to setup admin account.' });
  }
});

// Change Admin Credentials (username, email, password) from inside dashboard
app.post('/api/admin/change-credentials', (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { currentPassword, newPassword, newName, newEmail } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to update credentials.' });
    }

    if (newPassword) {
      const pwErr = validatePasswordStrength(String(newPassword));
      if (pwErr) {
        return res.status(400).json({ error: pwErr });
      }
    }

    const updated = db.updateAdminCredentials(
      user.email,
      hashPassword(String(currentPassword)),
      {
        newName: newName ? String(newName).trim() : undefined,
        newEmail: newEmail ? String(newEmail).trim().toLowerCase() : undefined,
        newPasswordHash: newPassword ? hashPassword(String(newPassword)) : undefined,
      }
    );

    const { passwordHash, ...safeUser } = updated as any;
    const session = db.createAuthSession(updated, 'admin');
    return res.json({
      message: 'Admin credentials successfully updated.',
      user: safeUser,
      token: session.token,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update admin credentials.' });
  }
});

// Reset Admin Password (using admin email and secret setup key)
app.post('/api/admin-portal/reset-password', (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const rateCheck = checkRateLimit(adminSetupRateLimitMap, `reset_${clientIp}`, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Too many password reset attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
      });
    }

    const { email, setupKey, newPassword } = req.body;
    if (!email || !setupKey || !newPassword) {
      return res.status(400).json({ error: 'Admin email, setup key, and new password are required.' });
    }

    const expectedSetupKey = process.env.ADMIN_SETUP_KEY || 'airbus-setup-2026';
    if (String(setupKey).trim() !== expectedSetupKey.trim()) {
      return res.status(401).json({ error: 'Invalid admin setup key.' });
    }

    const resetPwErr = validatePasswordStrength(String(newPassword));
    if (resetPwErr) {
      return res.status(400).json({ error: resetPwErr });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const updated = db.resetAdminPassword(cleanEmail, hashPassword(String(newPassword)));

    const { passwordHash, ...safeUser } = updated as any;
    const session = db.createAuthSession(updated, 'admin');
    return res.json({
      message: 'Admin password reset successfully.',
      user: safeUser,
      token: session.token,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to reset admin password.' });
  }
});

// Public Authentication (Isolated Guest & Host Portals; Never allows admin registration)
app.post('/api/auth/register', (req, res) => {
  try {
    const { portal, role, username, name, password, phone, location, referredByCode } = req.body || {};

    // Strict security: Public registration CANNOT create admin accounts!
    if (role === 'admin' || portal === 'admin') {
      return res.status(403).json({ error: 'Admin registration is not permitted through public sign-up.' });
    }

    const chosenPortal = portal === 'owner' || role === 'owner' ? 'owner' : 'guest';
    const rawUsername = typeof username === 'string' ? username : typeof name === 'string' ? name : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (!rawUsername.trim() || !rawPassword) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    const regPwErr = validatePasswordStrength(rawPassword);
    if (regPwErr) {
      return res.status(400).json({ error: regPwErr });
    }

    const { user, token } = db.registerPortalUser({
      portal: chosenPortal,
      username: rawUsername,
      password: rawPassword,
      phone,
      location,
      referredByCode,
    });

    const { passwordHash, ...safeUser } = user as any;
    return res.status(201).json({ user: safeUser, token });
  } catch (err: any) {
    const msg = err?.message || 'Registration failed.';
    const status = msg.toLowerCase().includes('already') || msg.toLowerCase().includes('similar') || msg.toLowerCase().includes('taken')
      ? 409
      : 400;
    return res.status(status).json({ error: msg });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const rateCheck = checkRateLimit(loginRateLimitMap, `login_${clientIp}`, 30, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Too many login attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
      });
    }

    const { portal, username, email, password } = req.body || {};

    // Isolated Guest or Host portal login (strictly exact case- and punctuation-sensitive username + password)
    if (portal === 'guest' || portal === 'owner' || (username !== undefined && !email)) {
      if (portal !== 'guest' && portal !== 'owner') {
        return res.status(400).json({ error: 'Please choose Login to Guest or Login to Host first.' });
      }
      if (!String(username || '').trim() || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      try {
        const { user, token } = db.loginPortalUser({
          portal,
          username: String(username),
          password: String(password),
        });
        loginRateLimitMap.delete(`login_${clientIp}`);
        const { passwordHash, ...safeUser } = user as any;
        return res.json({ user: safeUser, token });
      } catch (err: any) {
        return res.status(401).json({
          error: err.message || 'Invalid credentials.',
          failedAttempts: err.failedAttempts || 1,
          showRecovery: Boolean(err.showRecovery),
        });
      }
    }

    // Admin portal login (via email + password ONLY for administrator accounts)
    if (!email || !password) {
      return res.status(400).json({ error: 'Please choose Login to Guest or Login to Host.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const user = db.findUserByEmail(cleanEmail) as any;
    if (!user || user.role !== 'admin' || user.passwordHash !== hashPassword(String(password))) {
      return res.status(401).json({ error: 'Invalid administrator email or password.' });
    }

    loginRateLimitMap.delete(`login_${clientIp}`);
    const session = db.createAuthSession(user, 'admin');
    const { passwordHash, ...safeUser } = user;
    return res.json({ user: safeUser, token: session.token });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractAuthToken(req);
  if (token) {
    db.invalidateSession(token);
  }
  return res.json({ success: true });
});

app.post('/api/auth/recovery', (req, res) => {
  try {
    const { portal, mode, currentUsername, newPassword, currentPassword, newUsername } = req.body || {};
    if (portal !== 'guest' && portal !== 'owner') {
      return res.status(400).json({ error: 'Please choose Guest or Host portal for recovery.' });
    }
    if (mode !== 'password' && mode !== 'username') {
      return res.status(400).json({ error: 'Recovery mode must be password or username.' });
    }
    if (mode === 'password') {
      if (!currentUsername || !newPassword) {
        return res.status(400).json({ error: 'Exact current username and a new password are required.' });
      }
      const recPwErr = validatePasswordStrength(String(newPassword));
      if (recPwErr) {
        return res.status(400).json({ error: recPwErr });
      }
    }
    if (mode === 'username' && (!currentPassword || !newUsername || !String(newUsername).trim())) {
      return res.status(400).json({ error: 'Current password and a new username are required.' });
    }

    const result = db.recoverPortalCredential({
      portal,
      mode,
      currentUsername,
      newPassword,
      currentPassword,
      newUsername,
    });
    const { passwordHash, ...safeUser } = result.user as any;
    return res.json({ user: safeUser, token: result.token, message: result.message });
  } catch (err: any) {
    const msg = err?.message || 'Credential recovery failed.';
    const status = msg.toLowerCase().includes('similar') || msg.toLowerCase().includes('taken') || msg.toLowerCase().includes('already')
      ? 409
      : 400;
    return res.status(status).json({ error: msg });
  }
});

app.post('/api/auth/ping', (req, res) => {
  const token = extractAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });
  }
  const touched = db.touchAuthSession(token);
  if (!touched) {
    return res.status(401).json({
      error: 'Session expired due to 20 minutes of inactivity. Please log in again.',
      code: 'SESSION_IDLE_EXPIRED',
    });
  }
  return res.json({
    ok: true,
    lastActiveAt: touched.session.lastActiveAt,
    idleTimeoutMs: touched.idleTimeoutMs,
    idleRemainingMs: touched.idleRemainingMs,
  });
});

app.get('/api/auth/me', (req, res) => {
  const token = extractAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });
  }
  const touch = req.query.silent !== '1';
  const state = db.getSessionState(token, { touch });
  if (!state.user || !state.session) {
    return res.status(401).json({
      error: state.idleExpired
        ? 'Session expired due to 20 minutes of inactivity. Please log in again.'
        : 'Not authenticated',
      code: state.idleExpired ? 'SESSION_IDLE_EXPIRED' : 'UNAUTHENTICATED',
    });
  }
  const user = state.user as any;
  const { passwordHash, ...safeUser } = user;
  const idleTimeoutMs = state.session.idleTimeoutMs || SESSION_IDLE_TIMEOUT_MS;
  const idleRemainingMs = Math.max(0, idleTimeoutMs - (Date.now() - (state.session.lastActiveAt || state.session.createdAt)));
  return res.json({
    user: safeUser,
    session: {
      portal: state.session.portal,
      role: state.session.role,
      lastActiveAt: state.session.lastActiveAt,
      idleTimeoutMs,
      idleRemainingMs,
    },
    walletBalance: db.getWalletBalance(user.email),
    hostPlan: user.role === 'owner' ? db.getHostPlan(user.email) : undefined,
  });
});

app.patch('/api/auth/profile', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { name, phone, location, bio, languages, photos, videos } = req.body;
  const updated = db.updateUser(user.email, {
    name: name !== undefined ? name : user.name,
    phone: phone !== undefined ? phone : user.phone,
    location: location !== undefined ? location : user.location,
    bio: bio !== undefined ? bio : user.bio,
    languages: languages !== undefined ? languages : user.languages,
    photos: photos !== undefined ? (Array.isArray(photos) ? photos.slice(0, 3) : []) : (user as any).photos,
    videos: videos !== undefined ? (Array.isArray(videos) ? videos.slice(0, 2) : []) : (user as any).videos,
  }) as any;
  if (!updated) return res.status(404).json({ error: 'User not found' });
  const { passwordHash, ...safeUser } = updated;
  return res.json({ user: safeUser });
});

// Change Password Endpoint
app.post('/api/auth/change-password', (req, res) => {
  const user = getAuthUser(req) as any;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  if (user.passwordHash && user.passwordHash !== hashPassword(currentPassword)) {
    return res.status(400).json({ error: 'Incorrect current password.' });
  }
  const changePwErr = validatePasswordStrength(String(newPassword));
  if (changePwErr) {
    return res.status(400).json({ error: changePwErr });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'New password must be different from current password.' });
  }

  try {
    db.updatePortalPassword(user, newPassword);
  } catch (err: any) {
    return res.status(409).json({ error: err.message });
  }
  db.createAuditLog({
    id: 'aud_' + Date.now(),
    action: 'change_password',
    actorEmail: user.email,
    details: 'User successfully updated account password.',
    createdAt: Date.now(),
  });
  return res.json({ success: true, message: 'Password updated successfully!' });
});

// Stays / Listings with Full Search & Keyset Cursor Pagination (Newest-First)
app.get('/api/stays', (req, res) => {
  try {
    const {
      q,
      guests,
      minPrice,
      maxPrice,
      types,
      features,
      instantBook,
      isFeatured,
      category,
      checkIn,
      checkOut,
      beds,
      status,
      ownerEmail,
      cursor,
      limit,
      sort,
    } = req.query;

    const viewerUser = getAuthUser(req);

    if (ownerEmail) {
      const cleanOwner = String(ownerEmail).trim().toLowerCase();
      if (!viewerUser || (viewerUser.role !== 'admin' && viewerUser.email.toLowerCase() !== cleanOwner)) {
        return res.status(403).json({ error: 'Unauthorized to view another host\'s unapproved listings.' });
      }
      const stays = db.getMyStays(cleanOwner);
      return res.json({ stays, nextCursor: null, hasMore: false, totalCount: stays.length });
    }

    const result = db.queryStaysFeed({
      query: q as string,
      guests: guests ? parseInt(guests as string, 10) : undefined,
      minPrice: minPrice ? parseInt(minPrice as string, 10) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice as string, 10) : undefined,
      types: types ? (Array.isArray(types) ? (types as string[]) : [types as string]) : undefined,
      features: features ? (Array.isArray(features) ? (features as string[]) : [features as string]) : undefined,
      instantBook: instantBook === 'true',
      isFeatured: isFeatured === 'true',
      category: category as string,
      checkIn: checkIn as string,
      checkOut: checkOut as string,
      beds: beds ? parseInt(beds as string, 10) : undefined,
      status: (status as any) || undefined,
      viewerUser,
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: limit ? parseInt(limit as string, 10) : 20,
      sort: sort === 'featured' ? 'featured' : 'new',
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Host's own submissions (PENDING / APPROVED / DECLINED with exact admin_feedback)
app.get('/api/stays/my-submissions', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  const stays = db.getMyStays(user.email);
  return res.json({ stays });
});

app.get('/api/stays/check-live/:id', (req, res) => {
  const viewerUser = getAuthUser(req);
  const status = db.checkStayLiveStatus(req.params.id, viewerUser);
  if (!status.exists) {
    return res.status(404).json(status);
  }
  return res.json(status);
});

app.get('/api/stays/:id', (req, res) => {
  const viewerUser = getAuthUser(req);
  const rawStay = db.getRaw().stays.find(s => s.id === req.params.id);
  if (!rawStay) {
    return res.status(404).json({ error: 'Stay not found' });
  }
  const stay = db.getStayById(req.params.id, viewerUser);
  if (!stay) {
    return res.status(404).json({ error: 'Stay not found' });
  }
  const isOwnerOrAdmin = Boolean(
    viewerUser &&
      (viewerUser.role === 'admin' ||
        (stay.ownerEmail && viewerUser.email.toLowerCase() === stay.ownerEmail.toLowerCase()))
  );
  if (!isOwnerOrAdmin) {
    const isLiveStatus = stay.status === 'live' || stay.status === 'PUBLISHED';
    const isApproved =
      stay.moderationState
        ? stay.moderationState === 'APPROVED' && isLiveStatus
        : isLiveStatus && stay.isApprovedByAdmin !== false;
    if (!isApproved || stay.isDelisted || stay.ownerSubscriptionExpired) {
      return res.status(404).json({ error: 'This listing is currently unavailable.' });
    }
  }
  db.incrementStayViews(req.params.id);
  return res.json({ stay });
});

// View count increment
app.post('/api/stays/:id/view', (req, res) => {
  db.incrementStayViews(req.params.id);
  const stay = db.getStayById(req.params.id);
  return res.json({ views: stay?.views || 0 });
});

// Like toggle
app.post('/api/stays/:id/like', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to like this video tour.' });
  const result = db.toggleLikeStay(req.params.id, user.email);
  return res.json(result);
});

// Follow host toggle
app.post('/api/hosts/:email/follow', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to follow this host.' });
  const result = db.toggleFollowHost(req.params.email, user.email);
  return res.json(result);
});

// Comments & Nested Replies
app.get('/api/stays/:id/comments', (req, res) => {
  const comments = db.getComments(req.params.id);
  return res.json({ comments });
});

app.post('/api/stays/:id/comments', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to leave a comment.' });
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text is required.' });

  const comment = db.addComment(req.params.id, user, text);
  if (!comment) return res.status(404).json({ error: 'Stay not found.' });
  return res.status(201).json({ comment });
});

app.post('/api/stays/:id/comments/:commentId/reply', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to reply to this comment.' });
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Reply text is required.' });

  const reply = db.addCommentReply(req.params.id, req.params.commentId, user, text);
  if (!reply) return res.status(404).json({ error: 'Comment not found.' });
  return res.status(201).json({ reply });
});

// Benevolent AirBus.AI Assistant on each video
app.post('/api/ai/ask-stay', async (req, res) => {
  try {
    const { stayId, question } = req.body;
    if (!stayId || !question) {
      return res.status(400).json({ error: 'stayId and question are required.' });
    }

    const stay = db.getStayById(stayId);
    if (!stay) return res.status(404).json({ error: 'Stay not found.' });

    const reviews = db.getReviews(stayId);
    const host = stay.ownerEmail ? db.findUserByEmail(stay.ownerEmail) : null;

    if (genAI && process.env.GEMINI_API_KEY) {
      try {
        const prompt = `You are "AirBus.AI", a benevolent, warm, and hyper-knowledgeable concierge for the AirBus video-first stays platform in Kenya.
Your role: Answer the guest's question about this specific property with complete honesty, warmth, helpful local insights, and clear recommendations.

Property Details:
- Title: ${stay.title}
- Location: ${stay.location} (Lat: ${stay.lat}, Lng: ${stay.lng})
- Type: ${stay.type} (${stay.guests} guests max, ${stay.beds} beds, ${stay.area} m²)
- Nightly Rate: KES ${stay.price.toLocaleString()}
- Minimum Stay: ${stay.minNights || 1} night(s)
- Category: ${stay.category} Plan
- Instant Book: ${stay.instantBook ? 'Yes' : 'Requires host approval'}
- Description: ${stay.description}
- Amenities: ${stay.features.join(', ')}
- Verified Reviews (${reviews.length}):
${reviews.map(r => `  * ${r.guestName} (${r.rating}/5 stars): "${r.comment}"`).join('\n') || '  (No reviews posted yet, brand new listing)'}
- Host Info: ${host ? `${host.name} (ID Verified: ${host.idVerified})` : 'AirBus Verified Host'}

Guest Question: "${question}"

Provide a friendly, direct, and benevolent response in 2 to 4 concise sentences. If they ask about recommendations, WiFi, check-in, safety, or negotiation, advise them constructively.`;

        const response = await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const answer = response.text || '';
        return res.json({ answer: answer.trim() });
      } catch (aiErr) {
        console.warn('Gemini ask-stay error, using fallback:', aiErr);
      }
    }

    // Benevolent fallback answer generator
    const qLower = question.toLowerCase();
    let fallbackAnswer = `Thank you for asking about ${stay.title}! `;
    if (qLower.includes('wifi') || qLower.includes('internet') || qLower.includes('work')) {
      fallbackAnswer += stay.features.includes('Fiber Internet') || stay.features.includes('WiFi')
        ? 'High-speed internet is fully equipped and tested for streaming and remote video calls.'
        : 'WiFi is available in the main areas; please confirm specific speed requirements with the host in chat.';
    } else if (qLower.includes('price') || qLower.includes('negotiat') || qLower.includes('discount') || qLower.includes('offer')) {
      fallbackAnswer += `This stay is listed at KES ${stay.price.toLocaleString()}/night. You can click the "Negotiate Rate" button to send an offer directly to ${stay.hostName || 'the host'}.`;
    } else if (qLower.includes('beach') || qLower.includes('ocean') || qLower.includes('sea')) {
      fallbackAnswer += stay.location.toLowerCase().includes('diani') || stay.location.toLowerCase().includes('nyali')
        ? 'This property is located in the coastal zone, just minutes away from the soft white sands and watersports!'
        : 'This stay is located in Nairobi/interior Kenya. For beachfront stays, browse our Nyali and Diani listings in Feed!';
    } else if (qLower.includes('review') || qLower.includes('experience') || qLower.includes('feedback')) {
      fallbackAnswer += reviews.length > 0
        ? `Previous guests rated this stay ${stay.rating.toFixed(1)}/5 stars. Highlights praised include the cleanliness, views, and responsive hosting.`
        : 'This is a freshly curated listing with verified high-definition video walkthroughs.';
    } else {
      fallbackAnswer += `This ${stay.type} accommodates up to ${stay.guests} guests with ${stay.beds} beds. Feel free to use the "Chat Host" button for any specific custom requests!`;
    }

    return res.json({ answer: fallbackAnswer });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Listing Creation with MANDATORY Subscription Enforcement & PENDING Moderation
app.post('/api/stays', (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Only registered owners and admins can create listings.' });
  }

  const rl = apiRateLimiter.check(`stays:${user.email.toLowerCase()}`, 20, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit exceeded. Try again in ${rl.retryAfterSec}s.` });
  }

  // MANDATORY 30-Day Subscription Check: Owner must have an active, non-expired subscription!
  const plan = db.getHostPlan(user.email);
  if (user.role !== 'admin') {
    if (plan.status !== 'active') {
      return res.status(403).json({
        error: 'A 30-day hosting subscription (Silver, Diamond, or Gold) is mandatory before you can upload and publish video stays. Please pay from your Host wallet.',
      });
    }

    // Check expiration
    if (plan.expiresAt > 0 && Date.now() > plan.expiresAt) {
      return res.status(403).json({
        error: 'Your 30-day hosting plan has expired. Please renew your subscription from your Host wallet before publishing new listings.',
      });
    }

    const myStays = db.getRaw().stays.filter(s => s.ownerEmail === user.email);
    const tierLimit = PLANS[plan.tier]?.l || 3;
    if (myStays.length >= tierLimit) {
      return res.status(403).json({
        error: `Your ${plan.tier} plan limit of ${tierLimit} active listings has been reached. Upgrade to Diamond or Gold for more listings.`,
      });
    }
  }

  const {
    title,
    location,
    lat,
    lng,
    price,
    type,
    guests,
    beds,
    area,
    features,
    highlights,
    description,
    videoUrl,
    thumbnailUrl,
    youtubeUrl,
    youtubeVideoId,
    whatsapp,
    affiliateLink,
    minNights,
    media,
    images,
    blackFridayOptIn,
    isAirbusWork,
    isLocalGuideExperience,
    isWorldWide,
    country,
    isEscapeOffer,
    isPlusVVVIP,
    collections,
    videoMediaId,
    videoThumbnail,
  } = req.body;

  if (!title || !location || !price) {
    return res.status(400).json({ error: 'Title, location, and price are required.' });
  }

  if (Boolean(isWorldWide) && !String(country || '').trim()) {
    return res.status(400).json({ error: 'Please indicate which country this AirBus World Wide listing is based in.' });
  }

  const cleanedWhatsapp = typeof whatsapp === 'string' ? whatsapp.trim().replace(/\s+/g, '') : '';
  if (cleanedWhatsapp && !/^\+[1-9]\d{7,14}$/.test(cleanedWhatsapp)) {
    return res.status(400).json({
      error: 'Host WhatsApp number must be in E.164 international format (e.g. +254712345678).',
    });
  }

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (lat === undefined || lng === undefined || isNaN(parsedLat) || isNaN(parsedLng)) {
    return res.status(400).json({
      error: 'Accurate geographic latitude and longitude coordinates are strictly required for the listing to appear on the discovery map.',
    });
  }

  // Validate at least one media type is provided
  const hasPhotosInput = (Array.isArray(images) && images.length > 0) || (media?.photos && media.photos.length > 0) || Boolean(thumbnailUrl);
  const hasVideoInput = Boolean(videoUrl && videoUrl.trim()) || Boolean(media?.video?.url && media.video.url.trim());
  if (!hasPhotosInput && !hasVideoInput) {
    return res.status(400).json({
      error: 'At least one media type is required (one video tour or at least one photo). Please upload media before saving.',
    });
  }

  if (Array.isArray(images) && images.length > 30) {
    return res.status(400).json({ error: 'A maximum of 30 photos is allowed per listing.' });
  }
  if (media?.photos && media.photos.length > 30) {
    return res.status(400).json({ error: 'A maximum of 30 photos is allowed per listing.' });
  }

  // Mandatory Admin Review pipeline: NEVER live immediately upon submission
  const newStay: Stay = {
    id: 's_' + Date.now(),
    title: title.trim(),
    location: location.trim(),
    lat: parsedLat,
    lng: parsedLng,
    price: Number(price),
    currency: 'KES',
    rating: 5.0,
    reviewsCount: 0,
    type: type || 'Apartment',
    guests: Number(guests) || 2,
    beds: Number(beds) || 1,
    area: Number(area) || 60,
    category: plan.tier || 'Silver',
    status: 'review',
    moderationStatus: 'pending',
    moderationState: 'PENDING',
    admin_feedback: null,
    reviewed_at: null,
    reviewed_by: null,
    mediaModerationStatus: 'clean',
    features: Array.isArray(features) ? features : ['WiFi', 'Parking'],
    highlights: Array.isArray(highlights) ? highlights : [],
    description: description || '',
    videoUrl: videoUrl || (media?.video?.url || ''),
    videoMediaId: videoMediaId || media?.video?.mediaId || undefined,
    thumbnailUrl: thumbnailUrl || videoThumbnail || (images && images[0]) || (media?.photos && media.photos[0]?.url) || '',
    images: Array.isArray(images) ? images : undefined,
    media: media
      ? {
          ...media,
          video: media.video
            ? {
                ...media.video,
                mediaId: media.video.mediaId || videoMediaId || undefined,
                thumbnail: media.video.thumbnail || videoThumbnail || thumbnailUrl || undefined,
              }
            : undefined,
        }
      : undefined,
    youtubeUrl: youtubeUrl || undefined,
    youtubeVideoId: youtubeVideoId || undefined,
    source: affiliateLink ? 'External' : 'Direct',
    instantBook: true,
    isFeatured: false,
    isApprovedByAdmin: false,
    ownerEmail: user.email,
    hostName: user.name,
    hostPhone: user.phone || '',
    whatsapp: whatsapp || '',
    affiliateLink: affiliateLink || '',
    minNights: Number(minNights) || 1,
    nights: Number(req.body.nights) || Number(minNights) || 1,
    welcomeGifts: Array.isArray(req.body.welcomeGifts) && req.body.welcomeGifts.length > 0
      ? req.body.welcomeGifts
      : ['Kenyan Safari Kahawa & Fresh Ground Beans', 'Coconut Water & Tropical Basket'],
    hostMessage: req.body.hostMessage || 'Karibu sana! We look forward to hosting you in our serene home.',
    instalmentsAccepted: Boolean(req.body.instalmentsAccepted),
    depositRequired: Boolean(req.body.depositRequired),
    depositAmount: req.body.depositAmount ? Number(req.body.depositAmount) : undefined,
    depositReason: req.body.depositReason || undefined,
    depositRefundTerms: req.body.depositRefundTerms || undefined,
    views: 1,
    likesCount: 0,
    commentsCount: 0,
    comments: [],
    hostFollowerCount: 0,
    gradientHue: [Math.floor(Math.random() * 360), Math.floor(Math.random() * 360)],
    createdAt: Date.now(),
    collections: Array.isArray(collections) ? collections : undefined,
    blackFridayOptIn: Boolean(blackFridayOptIn) || (Array.isArray(collections) && collections.includes('black-friday')),
    blackFridayDiscountPercent: (Boolean(blackFridayOptIn) || (Array.isArray(collections) && collections.includes('black-friday'))) ? 50 : undefined,
    isAirbusWork: Boolean(isAirbusWork) || (Array.isArray(collections) && collections.includes('work')),
    monthlyPrice: (Boolean(isAirbusWork) || (Array.isArray(collections) && collections.includes('work'))) ? Math.round(Number(price) * 24) : undefined,
    isLocalGuideExperience: Boolean(isLocalGuideExperience) || (Array.isArray(collections) && collections.includes('local')),
    isWorldWide: Boolean(isWorldWide) || (Array.isArray(collections) && collections.includes('worldwide')),
    country: String(country || '').trim() || undefined,
    isEscapeOffer: Boolean(isEscapeOffer) || (Array.isArray(collections) && collections.includes('escapes')),
    escapeOfferTitle: (Boolean(isEscapeOffer) || (Array.isArray(collections) && collections.includes('escapes'))) ? 'AirBus Escapes Special Offer' : undefined,
    isPlusVVVIP: Boolean(isPlusVVVIP) || (Array.isArray(collections) && collections.includes('plus')),
    plusServices: (Boolean(isPlusVVVIP) || (Array.isArray(collections) && collections.includes('plus')))
      ? ['24/7 Butler or Chef', 'Airport Transfer', 'Hotel-Grade Hygiene']
      : undefined,
  };

  try {
    db.createStay(newStay);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to save listing with media.' });
  }

  return res.status(201).json({
    stay: newStay,
    message: 'Listing submitted for Admin Review. It will go live once approved.',
  });
});

// Edit & Resubmit a Stay (Preserves createdAt, clears admin_feedback, sets PENDING)
app.post('/api/stays/:id/resubmit', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const stay = db.resubmitStay(req.params.id, user.email, user.role === 'admin', req.body || {});
    return res.json({
      stay,
      message: 'Listing updated and resubmitted for Admin Review.',
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Could not resubmit listing.' });
  }
});

// Update stay listing (Owner or Admin)
app.patch('/api/stays/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const stay = db.getStayById(req.params.id);
  if (!stay) return res.status(404).json({ error: 'Stay not found' });

  if (user.role !== 'admin' && stay.ownerEmail?.toLowerCase() !== user.email.toLowerCase()) {
    return res.status(403).json({ error: 'Permission denied. You can only edit your own stays.' });
  }
  if (user.role === 'owner') {
    try {
      db.assertHostSubscriptionActive(user.email);
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  }

  const allowedUpdates = [
    'title',
    'location',
    'lat',
    'lng',
    'price',
    'type',
    'guests',
    'beds',
    'area',
    'category',
    'status',
    'isFeatured',
    'features',
    'highlights',
    'description',
    'videoUrl',
    'thumbnailUrl',
    'images',
    'media',
    'hasVideo',
    'hasPhotos',
    'moderationStatus',
    'moderationReason',
    'mediaModerationStatus',
    'youtubeUrl',
    'youtubeVideoId',
    'whatsapp',
    'minNights',
    'welcomeGifts',
    'hostMessage',
    'instantBook',
    'instalmentsAccepted',
    'depositRequired',
    'depositAmount',
    'depositReason',
    'depositRefundTerms',
    'isVerified',
    'blackFridayOptIn',
    'blackFridayDiscountPercent',
    'isAirbusWork',
    'monthlyPrice',
    'wifiSpeedMbps',
    'hasDedicatedWorkspace',
    'corporateInvoicingAvailable',
    'isEscapeOffer',
    'escapeOfferTitle',
    'escapeOriginalPrice',
    'escapeOfferPrice',
    'escapeDiscountPercent',
    'escapeValidFrom',
    'escapeValidTo',
    'isPlusVVVIP',
    'plusServices',
    'isLocalGuideExperience',
    'localMarketNear',
    'isWorldWide',
    'country',
    'countryCode',
    'region',
    'localCurrency',
    'localCurrencyPrice',
    'blockedDates',
    'collections',
    'videoMediaId',
    'publishState',
    'published_at',
  ];

  if (req.body.lat !== undefined && (typeof req.body.lat !== 'number' || isNaN(req.body.lat))) {
    return res.status(400).json({ error: 'Latitude must be a valid number.' });
  }
  if (req.body.lng !== undefined && (typeof req.body.lng !== 'number' || isNaN(req.body.lng))) {
    return res.status(400).json({ error: 'Longitude must be a valid number.' });
  }

  const updates: any = {};
  for (const key of allowedUpdates) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  try {
    const updatedStay = db.updateStay(req.params.id, updates);
    return res.json({ stay: updatedStay });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Update failed.' });
  }
});

// Promote Listing (KES 100/day visibility boost - Host Wallet Only)
app.post('/api/promotions/purchase', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to boost listings.' });
  if (user.role !== 'owner') {
    return res.status(403).json({ error: 'Listing promotions use a Host wallet only.' });
  }
  const rl = apiRateLimiter.check(`pay:${user.email.toLowerCase()}`, 30, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` });
  }
  try {
    db.assertHostSubscriptionActive(user.email);
  } catch (err: any) {
    return res.status(403).json({ error: err.message });
  }

  const { listingId, days, paymentMethod } = req.body;
  if (!listingId) return res.status(400).json({ error: 'Listing ID is required.' });
  if (paymentMethod && paymentMethod !== 'wallet') {
    return res.status(400).json({ error: 'Pay with M-Pesa has been removed. Use Deposit (M-Pesa) to top up your Host wallet, then Pay from Wallet.' });
  }

  const idemKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
  try {
    const out = await walletMutex.withWalletLock([user.email, 'admin@airbus.ke'], () =>
      db.runWithIdempotency(idemKey, () =>
        db.purchasePromotion({
          listingId,
          ownerEmail: user.email,
          days: Number(days) || 7,
          paymentMethod: 'wallet',
        }),
        201
      )
    );
    return res.status(out.deduplicated ? 200 : 201).json(out.response);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Backwards-compatible promote endpoint (Host Wallet Only)
app.post('/api/listings/:id/promote', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (user.role !== 'owner') {
    return res.status(403).json({ error: 'Listing promotions use a Host wallet only.' });
  }
  const rl = apiRateLimiter.check(`pay:${user.email.toLowerCase()}`, 30, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` });
  }
  try {
    db.assertHostSubscriptionActive(user.email);
  } catch (err: any) {
    return res.status(403).json({ error: err.message });
  }

  const { days, paymentMethod } = req.body;
  if (paymentMethod && paymentMethod !== 'wallet') {
    return res.status(400).json({ error: 'Pay with M-Pesa has been removed. Use Deposit (M-Pesa) to top up your Host wallet, then Pay from Wallet.' });
  }

  const idemKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
  try {
    const out = await walletMutex.withWalletLock([user.email, 'admin@airbus.ke'], () =>
      db.runWithIdempotency(idemKey, () =>
        db.purchasePromotion({
          listingId: req.params.id,
          ownerEmail: user.email,
          days: Number(days) || 7,
          paymentMethod: 'wallet',
        }),
        201
      )
    );
    return res.status(out.deduplicated ? 200 : 201).json(out.response);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Get Owner Boost Campaigns (Real database-backed)
app.get('/api/promotions/campaigns', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const boosts = db.getBoosts(user.role === 'admin' ? undefined : user.email);
  return res.json({ campaigns: boosts, boosts });
});

// Dynamic Listing Sponsor Slots (1 to 10 Slots - Wallet Only)
app.post('/api/listings/:id/sponsors', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to reserve sponsor slots.' });
  if (user.role === 'owner') {
    try {
      db.assertHostSubscriptionActive(user.email);
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  }

  const { title, description, linkUrl, thumbnailUrl, durationDays, paymentMethod } = req.body;
  if (paymentMethod && paymentMethod !== 'wallet') {
    return res.status(400).json({ error: 'Adverts can only be paid from your private AirBus Wallet.' });
  }
  if (!title || !linkUrl) {
    return res.status(400).json({ error: 'Headline title and target link are required.' });
  }

  try {
    const result = db.purchaseSponsorSlot({
      listingId: req.params.id,
      advertiserEmail: user.email,
      title,
      description: description || '',
      linkUrl,
      thumbnailUrl: thumbnailUrl || '',
      durationDays: Number(durationDays) || 30,
      paymentMethod: 'wallet',
    });
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.get('/api/listings/:id/sponsors', (req, res) => {
  const result = db.getSponsorSlots(req.params.id);
  return res.json(result);
});

// Get Owner Promotions (legacy compatibility)
app.get('/api/owner/promotions', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const boosts = db.getBoosts(user.role === 'admin' ? undefined : user.email);
  const promotions = db.getPromotions(user.role === 'admin' ? undefined : user.email);
  return res.json({ promotions, boosts });
});

// Record Promotion Impression
app.post('/api/listings/:id/promo-impression', (req, res) => {
  db.recordPromotionImpression(req.params.id);
  return res.json({ recorded: true });
});

// Record Promotion Click
app.post('/api/listings/:id/promo-click', (req, res) => {
  db.recordPromotionClick(req.params.id);
  return res.json({ recorded: true });
});

// Admin approves listing to go live (syncs moderationState & emits real-time feed event)
app.post('/api/admin/stays/:id/approve', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    const stay = db.moderateStay(req.params.id, 'approve', user.email, req.body?.feedback);
    if (!stay) return res.status(404).json({ error: 'Stay not found' });
    return res.json({ stay });
  } catch (err: any) {
    return res.status(404).json({ error: err.message || 'Stay not found' });
  }
});

// Dedicated Admin Review Queue (oldest pending first)
app.get('/api/admin/review-queue', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const queue = db.getAdminReviewQueue();
  return res.json(queue);
});

app.post('/api/admin/review-queue/stays/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const { action, admin_feedback } = req.body || {};
  if (action !== 'approve' && action !== 'decline') {
    return res.status(400).json({ error: 'action must be approve or decline.' });
  }
  if (action === 'decline' && (!admin_feedback || !String(admin_feedback).trim())) {
    return res.status(400).json({ error: 'Decline feedback explaining why the listing was declined is strictly required.' });
  }
  try {
    const stay = db.moderateStay(
      req.params.id,
      action === 'approve' ? 'approve' : 'reject',
      user.email,
      admin_feedback
    );
    return res.json({ stay });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Review action failed.' });
  }
});

app.post('/api/admin/review-queue/trip-dating/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const { action, admin_feedback, reason } = req.body || {};
  if (action !== 'approve' && action !== 'decline') {
    return res.status(400).json({ error: 'action must be approve or decline.' });
  }
  const finalReason = String(reason ?? admin_feedback ?? '').trim();
  if (action === 'decline' && (finalReason.length < 10 || finalReason.length > 500)) {
    return res.status(400).json({
      error: 'Decline reason explaining why the Trip Dating post was declined is strictly required (10–500 characters).',
    });
  }
  try {
    if (action === 'approve') {
      const result = db.approveTripDatingSubmission(req.params.id, user.email);
      return res.json(result);
    }
    const result = db.declineTripDatingSubmission(req.params.id, user.email, finalReason);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Review action failed.' });
  }
});

app.delete('/api/stays/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const stay = db.getStayById(req.params.id);
  if (!stay) return res.status(404).json({ error: 'Stay not found' });
  if (user.role !== 'admin' && stay.ownerEmail !== user.email) {
    return res.status(403).json({ error: 'Unauthorized to delete this stay' });
  }

  db.deleteStay(req.params.id);
  return res.json({ success: true });
});

// Gold-Only Listing Audio (optional 1 music track +/or 1 voice-over on listing page)
app.put('/api/stays/:id/audio', (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Only registered hosts can configure listing audio.' });
  }
  if (user.role === 'owner') {
    try {
      db.assertHostSubscriptionActive(user.email);
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  }
  try {
    const config = db.saveListingAudio(req.params.id, user.email, user.role === 'admin', req.body || {});
    const updatedStay = db.getStayById(req.params.id, user, true);
    return res.json({ listingAudio: config, stay: updatedStay });
  } catch (err: any) {
    const msg = err?.message || 'Unable to save listing audio.';
    const status = msg.toLowerCase().includes('gold') || msg.toLowerCase().includes('only the host') ? 403 : 400;
    return res.status(status).json({ error: msg });
  }
});

app.delete('/api/stays/:id/audio', (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Only the listing host can delete listing audio.' });
  }
  try {
    db.deleteListingAudio(req.params.id, user.email, user.role === 'admin');
    const updatedStay = db.getStayById(req.params.id, user, true);
    return res.json({ success: true, stay: updatedStay });
  } catch (err: any) {
    return res.status(403).json({ error: err.message || 'Unable to remove listing audio.' });
  }
});

// Listing Media removal (Host or Admin)
app.post('/api/listings/:id/media/remove', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const stay = db.getStayById(req.params.id);
  if (!stay) return res.status(404).json({ error: 'Stay not found' });

  if (user.role !== 'admin' && stay.ownerEmail?.toLowerCase() !== user.email.toLowerCase()) {
    return res.status(403).json({ error: 'Only the listing owner or administrator can remove media.' });
  }

  const { mediaType, photoUrl, reason } = req.body;
  if (!mediaType || (mediaType !== 'video' && mediaType !== 'photo')) {
    return res.status(400).json({ error: 'Valid mediaType (video or photo) required.' });
  }

  try {
    const updated = db.removeStayMedia(req.params.id, mediaType, photoUrl, user.email, reason);
    return res.json({ stay: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to remove media.' });
  }
});

// Bookings
app.get('/api/bookings', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const bookings = db.getBookings(user.role === 'admin' ? undefined : user.email, user.role as any);
  return res.json({ bookings });
});

app.post('/api/bookings', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to book.' });

  const {
    stayId,
    checkIn,
    checkOut,
    guests,
    note,
    paymentType,
    instalmentCount,
    instalmentSurcharge,
    instalments,
    depositAcknowledged,
    depositAmount,
  } = req.body;
  const stay = db.getStayById(stayId);
  if (!stay) return res.status(404).json({ error: 'Stay not found' });

  // Disallow booking if owner subscription is expired
  if (stay.ownerEmail) {
    const plan = db.getHostPlan(stay.ownerEmail);
    const isPlanActive = plan.status === 'active' && plan.expiresAt > Date.now();
    if (!isPlanActive) {
      return res.status(403).json({ error: 'This listing is temporarily unavailable.' });
    }
  }

  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return res.status(400).json({ error: 'Please select valid check-in and check-out dates.' });
  }

  const clash = db.getBookings().some(b =>
    b.stayId === stayId &&
    (b.status === 'confirmed' || b.status === 'requested') &&
    checkIn < b.checkOut && checkOut > b.checkIn
  );
  if (clash) {
    return res.status(409).json({ error: 'These dates are already booked. Please choose different dates.' });
  }

  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 864e5));
  if (nights < (stay.minNights || 1)) {
    return res.status(400).json({ error: `Minimum stay is ${stay.minNights || 1} nights.` });
  }

  const subtotal = stay.price * nights;
  const cleaningFee = Math.round(stay.price * 0.15);
  const serviceFee = 0; // AirBus has no escrow, so we don't collect a host booking fee.
  const baseTotal = subtotal + cleaningFee;
  const surcharge = paymentType === 'instalments' ? Math.round(baseTotal * 0.10) : 0;
  const total = baseTotal + surcharge;

  const newBooking: Booking = {
    id: 'b_' + Date.now(),
    reference: 'AB' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    stayId: stay.id,
    guestEmail: user.email,
    guestName: user.name,
    checkIn,
    checkOut,
    guests: Number(guests) || 2,
    subtotal,
    cleaningFee,
    serviceFee,
    total,
    currency: stay.currency || 'KES',
    status: stay.instantBook ? 'confirmed' : 'requested',
    note: note || '',
    paymentType: paymentType || 'full',
    instalmentCount: paymentType === 'instalments' ? instalmentCount : undefined,
    instalmentSurcharge: surcharge,
    instalments: paymentType === 'instalments' ? instalments : undefined,
    depositAcknowledged: Boolean(depositAcknowledged),
    depositAmount: depositAmount ? Number(depositAmount) : undefined,
    selectedGifts: Array.isArray(req.body.selectedGifts) ? req.body.selectedGifts : undefined,
    createdAt: Date.now(),
  };

  db.createBooking(newBooking);
  return res.status(201).json({ booking: newBooking });
});

// Check upcoming 24-hour check-in reminders for the logged-in user
app.get('/api/bookings/check-reminders', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const reminders = db.checkUpcomingCheckinReminders(user.email);
  return res.json({ upcomingReminders: reminders });
});

app.patch('/api/bookings/:id/status', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { status } = req.body;
  if (!['confirmed', 'cancelled', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const updated = db.updateBookingStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Booking not found' });
  return res.json({ booking: updated });
});

// Chat & Negotiations
app.get('/api/threads', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const threads = db.getThreads(user.role === 'admin' ? undefined : user.email);
  return res.json({ threads });
});

app.get('/api/threads/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const thread = db.getThread(req.params.id);
  if (!thread) {
    const stay = db.getStayById(req.params.id);
    if (!stay) return res.status(404).json({ error: 'Stay not found' });
    const emptyThread: ChatThread = {
      id: stay.id,
      stayId: stay.id,
      guestEmail: user.email,
      hostEmail: stay.ownerEmail || 'owner@airbus.ke',
      messages: [],
      unreadGuest: false,
      unreadHost: false,
      updatedAt: Date.now(),
    };
    return res.json({ thread: emptyThread });
  }
  return res.json({ thread });
});

app.post('/api/threads/:id/message', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { type, text, amount } = req.body;
  const stay = db.getStayById(req.params.id);
  if (!stay) return res.status(404).json({ error: 'Stay not found' });

  let thread = db.getThread(req.params.id);
  if (!thread) {
    thread = {
      id: stay.id,
      stayId: stay.id,
      guestEmail: user.email,
      hostEmail: stay.ownerEmail || 'owner@airbus.ke',
      messages: [],
      unreadGuest: false,
      unreadHost: false,
      updatedAt: Date.now(),
    };
  }

  const isHost = user.email.toLowerCase() === thread.hostEmail.toLowerCase();
  const fromRole = isHost ? 'host' : 'guest';

  const newMsg: ChatMessage = {
    id: 'm_' + Date.now(),
    from: fromRole,
    type: type || 'text',
    text: text || '',
    amount: amount ? Number(amount) : undefined,
    status: type === 'offer' || type === 'counter' ? 'pending' : undefined,
    createdAt: Date.now(),
  };

  if (type === 'counter' || type === 'offer') {
    thread.messages.forEach(m => {
      if ((m.type === 'offer' || m.type === 'counter') && m.status === 'pending') {
        m.status = 'countered';
      }
    });
  }

  thread.messages.push(newMsg);
  thread.updatedAt = Date.now();
  if (isHost) {
    thread.unreadGuest = true;
  } else {
    thread.unreadHost = true;
  }

  db.saveThread(thread);
  return res.status(201).json({ thread, message: newMsg });
});

app.post('/api/threads/:id/reply', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { action } = req.body;
  const thread = db.getThread(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  const isHost = user.email.toLowerCase() === thread.hostEmail.toLowerCase();
  const fromRole = isHost ? 'host' : 'guest';

  const lastOffer = [...thread.messages].reverse().find(m => (m.type === 'offer' || m.type === 'counter') && m.status === 'pending');
  if (lastOffer) {
    lastOffer.status = action === 'accept' ? 'accepted' : 'declined';
  }

  const newMsg: ChatMessage = {
    id: 'm_' + Date.now(),
    from: fromRole,
    type: action === 'accept' ? 'accept' : 'decline',
    text: action === 'accept' ? 'Offer accepted!' : 'Offer declined.',
    amount: lastOffer?.amount,
    status: action === 'accept' ? 'accepted' : 'declined',
    createdAt: Date.now(),
  };

  thread.messages.push(newMsg);
  thread.updatedAt = Date.now();
  db.saveThread(thread);

  return res.json({ thread, message: newMsg });
});

// Reviews
app.get('/api/reviews/:stayId', (req, res) => {
  const reviews = db.getReviews(req.params.stayId);
  return res.json({ reviews });
});

app.post('/api/reviews', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to write a review.' });
  const { stayId, rating, comment } = req.body;
  if (!stayId || !rating || !comment) {
    return res.status(400).json({ error: 'Stay ID, rating, and comment are required.' });
  }

  const hasBooking = db.getBookings(user.email, 'guest').some(b => b.stayId === stayId && b.status === 'confirmed');
  if (!hasBooking && user.role !== 'admin') {
    return res.status(403).json({ error: 'Only guests with a confirmed booking can leave a review.' });
  }

  const review = db.createReview({
    id: 'rev_' + Date.now(),
    stayId,
    guestEmail: user.email,
    guestName: user.name,
    rating: Number(rating),
    comment: String(comment).trim(),
    createdAt: Date.now(),
  });

  return res.status(201).json({ review });
});

// Host Plan & Wallet
app.get('/api/host/plan', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const plan = db.getHostPlan(user.email);
  const wallet = db.getWallet(user.email);
  return res.json({ plan, wallet, availablePlans: PLANS });
});

// ============================================================================
// 1. PAYMENT MODULE & WALLET TRANSACTIONS LEDGER
// ============================================================================

// List payment records with filtering and search
app.get('/api/payments', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to view payments.' });

  const { status, type, method, search } = req.query;

  // Non-admins can only view their own payments
  if (user.role !== 'admin') {
    const list = db.getPaymentRecords({
      status: status as any,
      type: type as any,
      method: method as any,
      search: search as string,
    }).filter(p => (p.userId || p.hostEmail)?.toLowerCase() === user.email.toLowerCase());
    return res.json({ payments: list, count: list.length });
  }

  // Admins see all filtered payments
  const payments = db.getPaymentRecords({
    status: status as any,
    type: type as any,
    method: method as any,
    search: search as string,
  });

  const pendingCount = payments.filter(p => p.status === 'pending').length;
  return res.json({ payments, count: payments.length, pendingCount });
});

// Atomic Wallet Payment
app.post('/api/payments/wallet', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to pay from wallet.' });

  const rl = apiRateLimiter.check(`pay:${user.email.toLowerCase()}`, 30, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` });
  }

  const { type, amountSc, referenceId, planTier, durationDays, period, note } = req.body;

  if (!type || !['advert', 'subscription', 'boost', 'vvvip', 'trip_dating', 'booking_fee'].includes(type)) {
    return res.status(400).json({ error: 'Valid payment type is required.' });
  }
  if ((type === 'subscription' || type === 'boost') && user.role !== 'owner') {
    return res.status(403).json({ error: 'Subscriptions and listing promotions use a Host wallet only.' });
  }
  if (type === 'vvvip' && user.role !== 'guest') {
    return res.status(403).json({ error: 'AirBus Plus is for Guests only and never uses a Host wallet.' });
  }

  const numAmount = Number(amountSc);
  if (!Number.isInteger(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be a positive whole integer in Ksh.' });
  }

  const idemKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
  try {
    const out = await walletMutex.withWalletLock([user.email, 'admin@airbus.ke'], () =>
      db.runWithIdempotency(idemKey, () =>
        db.payWithWallet({
          userId: user.email,
          type,
          amountSc: numAmount,
          referenceId: referenceId || ('ref_' + Date.now()),
          planTier,
          durationDays: Number(durationDays) || undefined,
          period,
          note,
        }),
        201
      )
    );
    return res.status(out.deduplicated ? 200 : 201).json(out.response);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Wallet payment failed.' });
  }
});

// Direct M-Pesa Payment Submission — REMOVED (Wallet-only payments; M-Pesa is strictly Deposit (M-Pesa) into wallet)
app.post('/api/payments/mpesa', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in first.' });
  return res.status(400).json({
    error: 'Pay with M-Pesa has been removed. Use Deposit (M-Pesa) to top up your wallet, then Pay from Wallet.',
  });
});

// Legacy / backward-compatible POST /api/payments — Deposit (M-Pesa) only
app.post('/api/payments', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const rl = apiRateLimiter.check(`dep:${user.email.toLowerCase()}`, 20, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` });
  }
  const { kind, amount, mpesaCode, referenceId } = req.body;

  const rawType = String(kind || req.body.type || req.body.purpose || '');
  if (!['wallet', 'wallet_topup', 'deposit'].includes(rawType)) {
    return res.status(400).json({
      error: 'Pay with M-Pesa has been removed. Submit Deposit (M-Pesa) to fund your wallet, then Pay from Wallet.',
    });
  }

  if (!mpesaCode || !/^[A-Z0-9]{8,15}$/i.test(String(mpesaCode).trim())) {
    return res.status(400).json({
      error: 'M-Pesa reference code must be 8-15 alphanumeric characters (e.g. QGH7X2K9LM).',
    });
  }

  const numAmount = Number(amount);
  if (!Number.isInteger(numAmount) || numAmount < 10) {
    return res.status(400).json({ error: 'Minimum deposit amount is KES 10 (whole integer Ksh).' });
  }

  const cleanCode = String(mpesaCode).trim().toUpperCase();
  if (db.isMpesaCodeUsed(cleanCode)) {
    return res.status(400).json({ error: 'Duplicate M-Pesa transaction code. This code has already been submitted and cannot be reused.' });
  }

  try {
    const payment = await walletMutex.withWalletLock(user.email, () =>
      db.createPayment({
        id: 'pay_dep_' + Date.now(),
        userId: user.email,
        user_id: user.email,
        hostEmail: user.email,
        userRole: user.role,
        userName: user.username || user.name,
        kind: 'deposit',
        type: 'deposit',
        method: 'mpesa_manual',
        amount: numAmount,
        amountKes: numAmount,
        amountSc: numAmount,
        claimedAmount: numAmount,
        mpesaCode: cleanCode,
        reference: cleanCode,
        referenceId: referenceId || cleanCode,
        status: 'pending',
        createdAt: Date.now(),
      })
    );
    return res.status(201).json({ payment });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Deposit submission failed.' });
  }
});

// ============================================================================
// 2. SUBSCRIPTIONS (SERVER ENFORCED RULES)
// ============================================================================

app.get('/api/subscriptions/current', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const active = db.getActiveSubscription(user.email);
  const pending = db.getPendingSubscription(user.email);
  const hostPlan = db.getHostPlan(user.email);
  const wallet = db.getWallet(user.email);

  return res.json({
    activeSubscription: active || null,
    pendingSubscription: pending || null,
    hostPlan,
    wallet,
    availablePlans: PLANS,
  });
});

app.post('/api/subscriptions/purchase', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to purchase a hosting plan.' });
  if (user.role !== 'owner') {
    return res.status(403).json({ error: 'Host subscriptions use a Host wallet only.' });
  }
  const rl = apiRateLimiter.check(`pay:${user.email.toLowerCase()}`, 30, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` });
  }

  const { tier, billing, method } = req.body;

  if (!['Silver', 'Diamond', 'Gold'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid plan tier selected.' });
  }
  if (!['monthly', 'annual'].includes(billing)) {
    return res.status(400).json({ error: 'Invalid billing cycle. Choose monthly (30 days) or annual (365 days).' });
  }
  if (method && method !== 'wallet') {
    return res.status(400).json({ error: 'Pay with M-Pesa has been removed. Use Deposit (M-Pesa) to top up your Host wallet, then Pay from Wallet.' });
  }

  const idemKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
  try {
    const out = await walletMutex.withWalletLock([user.email, 'admin@airbus.ke'], () =>
      db.runWithIdempotency(idemKey, () =>
        db.purchaseSubscription({
          ownerId: user.email,
          tier,
          billing,
          method: 'wallet',
        }),
        201
      )
    );
    return res.status(out.deduplicated ? 200 : 201).json(out.response);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// 3. ADVERT SLOTS ("ADVERTISE HERE" & PERSISTENT AD CARD)
// ============================================================================

app.post('/api/ads/slots', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to advertise on AirBus.' });
  const rl = apiRateLimiter.check(`pay:${user.email.toLowerCase()}`, 30, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` });
  }
  if (user.role === 'owner') {
    try {
      db.assertHostSubscriptionActive(user.email);
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  }

  const {
    title,
    description,
    linkUrl,
    thumbnailUrl,
    videoUrl,
    durationDays,
    paymentMethod,
  } = req.body;

  if (paymentMethod && paymentMethod !== 'wallet') {
    return res.status(400).json({ error: 'Adverts can only be paid strictly from your private AirBus Wallet.' });
  }

  if (!title || !description || !linkUrl) {
    return res.status(400).json({ error: 'Title, description, and link URL are required.' });
  }

  // Validate URL format
  try {
    new URL(linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`);
  } catch {
    return res.status(400).json({ error: 'Please enter a valid website destination URL.' });
  }

  const days = Math.min(90, Math.max(1, Math.floor(Number(durationDays) || 7)));
  const idemKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;

  try {
    const out = await walletMutex.withWalletLock([user.email, 'admin@airbus.ke'], () =>
      db.runWithIdempotency(idemKey, () =>
        db.createAdSlot({
          ownerId: user.email,
          title,
          description,
          linkUrl: linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`,
          thumbnailUrl: thumbnailUrl || '',
          videoUrl: videoUrl || undefined,
          durationDays: days,
          paymentMethod: 'wallet',
        }),
        201
      )
    );
    return res.status(out.deduplicated ? 200 : 201).json(out.response);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Ad slot creation failed.' });
  }
});

// Return active ads for persistent round-robin display with fair rotation
app.get('/api/ads/active', (req, res) => {
  const activeSlots = (db.getActiveAdSlots() || []).map(a => ({
    id: a.id,
    ownerId: a.ownerId || a.owner_id,
    title: a.title,
    description: a.description,
    linkUrl: a.linkUrl || a.link_url,
    thumbnailUrl: a.thumbnailUrl || a.thumbnail_url,
    durationDays: a.durationDays || a.duration_days,
    costSc: a.costSc || a.cost_sc || a.costCoins || 70,
    status: 'active' as const,
    paymentId: a.paymentId || '',
    paymentMethod: a.paymentMethod || 'wallet',
    impressions: a.impressions || 0,
    clicks: a.clicks || 0,
    createdAt: a.createdAt || a.created_at || Date.now(),
    updatedAt: a.updatedAt || a.updated_at || Date.now(),
  }));

  const spRes = db.getSponsorSlots();
  const activeSponsors = (spRes.slots || []).filter(s => s.status === 'active').map(s => ({
    id: s.id,
    ownerId: s.advertiser_id || s.advertiserId,
    title: s.title,
    description: s.description,
    linkUrl: s.link_url || s.linkUrl,
    thumbnailUrl: s.thumbnail_url || s.thumbnailUrl,
    durationDays: s.duration_days || s.durationDays,
    costSc: s.cost_sc || s.costSc,
    status: 'active' as const,
    paymentId: s.payment_id || s.paymentId,
    paymentMethod: 'wallet' as const,
    impressions: s.impressions || 0,
    clicks: s.clicks || 0,
    createdAt: s.created_at || s.createdAt,
    updatedAt: s.created_at || s.createdAt,
  }));

  const combined = [...activeSlots, ...activeSponsors];

  // If no slots yet, fallback to approved legacy ad requests
  if (combined.length === 0) {
    const approvedLegacy = db.getAdRequests({ status: 'approved' });
    const formatted = approvedLegacy.map(a => ({
      id: a.id,
      ownerId: a.advertiserEmail,
      title: a.title,
      description: a.description,
      linkUrl: a.targetUrl,
      thumbnailUrl: a.imageUrl,
      durationDays: a.days,
      costSc: a.totalAmount,
      status: 'active' as const,
      paymentId: '',
      paymentMethod: 'wallet' as const,
      impressions: a.views || 0,
      clicks: a.clicks || 0,
      createdAt: a.createdAt,
      updatedAt: a.createdAt,
    }));
    return res.json({ ads: formatted, count: formatted.length });
  }

  // Fair rotation: lowest impressions served first so campaigns get balanced exposure
  combined.sort((a, b) => (a.impressions || 0) - (b.impressions || 0));

  return res.json({ ads: combined, count: combined.length });
});

app.post('/api/ads/slots/:id/view', (req, res) => {
  db.recordAdSlotImpression(req.params.id);
  return res.json({ success: true });
});

app.post('/api/ads/slots/:id/click', (req, res) => {
  db.recordAdSlotClick(req.params.id);
  return res.json({ success: true });
});

// ============================================================================
// 4. SOCIAL METRICS: FOLLOW, VIEWS, AND LIKES BACKEND
// ============================================================================

app.post('/api/owners/:id/follow', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to follow this host.' });

  const ownerId = req.params.id;
  if (!ownerId) return res.status(400).json({ error: 'Owner ID is required.' });

  const result = db.toggleFollow(user.email, ownerId);
  return res.json(result);
});

app.post('/api/listings/:id/like', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to like this stay.' });

  try {
    const result = db.toggleListingLike(user.email, req.params.id);
    return res.json(result);
  } catch (err: any) {
    return res.status(404).json({ error: err.message || 'Listing not found.' });
  }
});

app.post('/api/listings/:id/view', (req, res) => {
  const user = getAuthUser(req);
  const { sessionId } = req.body;
  const ipSession = sessionId || req.ip || ('sess_' + Math.random().toString(36).substring(2, 8));

  try {
    const result = db.recordListingView(req.params.id, user?.email, ipSession);
    return res.json(result);
  } catch (err: any) {
    return res.status(404).json({ error: err.message || 'Listing not found.' });
  }
});

app.get('/api/listings/:id/stats', (req, res) => {
  const user = getAuthUser(req);
  const stats = db.getListingStats(req.params.id, user?.email);
  return res.json(stats);
});

// Wishlist
app.get('/api/wishlist', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const ids = db.getWishlist(user.email);
  const stays = ids.map(id => db.getStayById(id)).filter(Boolean);
  return res.json({ wishlist: ids, stays });
});

app.post('/api/wishlist/toggle', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { stayId } = req.body;
  if (!stayId) return res.status(400).json({ error: 'stayId required' });
  const saved = db.toggleWishlist(user.email, stayId);
  return res.json({ saved, wishlist: db.getWishlist(user.email) });
});

// Dedicated Notifications (Get, Mark Read, Delete, Clear All)
app.get('/api/notifications', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  // Check and trigger any due 24-hour check-in notifications
  db.checkUpcomingCheckinReminders(user.email);
  const notifications = db.getNotifications(user.email);
  return res.json({ notifications, unreadCount: notifications.filter(n => !n.read).length });
});

app.post('/api/notifications/read', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  db.markNotificationsRead(user.email);
  return res.json({ success: true });
});

app.delete('/api/notifications/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const success = db.deleteNotification(user.email, req.params.id);
  return res.json({ success });
});

app.delete('/api/notifications', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const success = db.clearAllNotifications(user.email);
  return res.json({ success });
});

// Support & Reports
app.post('/api/support/ticket', (req, res) => {
  const { email, message, subject } = req.body;
  if (!email || !message) return res.status(400).json({ error: 'Email and message are required.' });
  const ticket = db.createTicket({
    id: 'tick_' + Date.now(),
    email,
    subject: subject || 'Support Query',
    message,
    createdAt: Date.now(),
  });
  return res.status(201).json({ ticket });
});

app.post('/api/support/report', (req, res) => {
  const user = getAuthUser(req);
  const { stayId, reason, details } = req.body;
  if (!stayId || !reason) return res.status(400).json({ error: 'Stay ID and reason are required.' });
  const report = db.createReport({
    id: 'rep_' + Date.now(),
    stayId,
    reason,
    details: details || '',
    reportedBy: user ? user.email : 'guest_anonymous',
    createdAt: Date.now(),
  });
  return res.status(201).json({ report });
});

// Admin Console
app.get('/api/admin/overview', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const raw = db.getRaw();
  const stays = raw.stays;
  const users = raw.users.map(({ passwordHash, ...u }: any) => u);
  const payments = raw.payments;
  const reports = raw.reports;
  const tickets = raw.tickets;
  const auditLogs = raw.auditLogs;
  const bookings = raw.bookings;

  return res.json({
    metrics: {
      totalStays: stays.length,
      liveStays: stays.filter(s => s.status === 'live' || s.status === 'PUBLISHED').length,
      pendingReviews: stays.filter(s => s.status === 'review').length,
      totalUsers: users.length,
      pendingPayments: payments.filter(p => p.status === 'pending').length,
      totalBookings: bookings.length,
      volumeKes: bookings.filter(b => b.status === 'confirmed').reduce((acc, b) => acc + b.total, 0),
    },
    stays,
    users,
    payments,
    reports,
    tickets,
    auditLogs,
  });
});

app.post('/api/admin/payments/:id/approve', async (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    const hasConfirmedAmount = req.body && req.body.confirmedAmount !== undefined && req.body.confirmedAmount !== null && req.body.confirmedAmount !== '';
    const confirmedAmount = hasConfirmedAmount ? Number(req.body.confirmedAmount) : undefined;
    const targetPay = db.getPaymentRecords({}).find(p => p.id === req.params.id);
    const lockKeys = [targetPay?.userId || targetPay?.hostEmail || '', 'admin@airbus.ke'];
    const idemKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
    const out = await walletMutex.withWalletLock(lockKeys, () =>
      db.runWithIdempotency(idemKey, () => {
        const result = db.approvePayment(req.params.id, user.email, confirmedAmount);
        if (!result) throw new Error('Payment not found or already processed.');
        return { payment: result };
      })
    );
    return res.json(out.response);
  } catch (err: any) {
    const msg = err.message || 'Could not approve payment.';
    return res.status(msg.includes('not found') ? 404 : 400).json({ error: msg });
  }
});

app.post('/api/admin/payments/:id/reject', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const { reason } = req.body;
  const result = db.rejectPayment(req.params.id, user.email, reason);
  if (!result) return res.status(404).json({ error: 'Payment not found.' });
  return res.json({ payment: result });
});

app.get('/api/admin/wallet/reconciliation', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const result = db.getWalletReconciliation();
  return res.json(result);
});

app.get('/api/admin/wallet/income-report', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const result = db.getAdminIncomeReport();
  return res.json(result);
});

app.get('/api/admin/wallets', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  return res.json(db.getAdminWalletsBreakdown());
});

app.get('/api/admin/wallet/summary', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const fiscalYear = req.query.fiscalYear ? Number(req.query.fiscalYear) : undefined;
  return res.json(db.getAdminWalletSummary(fiscalYear));
});

app.get('/api/admin/wallet/ledger', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const result = db.getAdminWalletLedger({
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    purpose: typeof req.query.purpose === 'string' ? req.query.purpose : undefined,
    role: typeof req.query.role === 'string' ? req.query.role : undefined,
    sourceKind: typeof req.query.sourceKind === 'string' ? req.query.sourceKind : undefined,
    fiscalYear: req.query.fiscalYear ? Number(req.query.fiscalYear) : undefined,
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 25,
  });
  return res.json(result);
});

app.get('/api/admin/wallet/totals', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const gran = String(req.query.granularity || 'day').toLowerCase();
  const granularity = (['hour', 'day', 'month', 'year'].includes(gran) ? gran : 'day') as 'hour' | 'day' | 'month' | 'year';
  return res.json(
    db.getAdminWalletTotals({
      granularity,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      fiscalYear: req.query.fiscalYear ? Number(req.query.fiscalYear) : undefined,
    })
  );
});

app.get('/api/admin/wallet/breakdown', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  return res.json(
    db.getAdminWalletBreakdown({
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      fiscalYear: req.query.fiscalYear ? Number(req.query.fiscalYear) : undefined,
    })
  );
});

app.get('/api/admin/wallet/archives', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  return res.json({ archives: db.getAdminWalletArchives() });
});

app.get('/api/admin/wallet/archives/:year', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const year = Number(req.params.year);
  if (!Number.isInteger(year)) {
    return res.status(400).json({ error: 'Invalid fiscal year.' });
  }
  const archive = db.getAdminWalletArchiveByYear(year);
  if (!archive) return res.status(404).json({ error: `No archive found for fiscal year ${year}.` });
  return res.json({ archive });
});

app.post('/api/admin/wallet/archives/run', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const year = req.body?.fiscalYear ? Number(req.body.fiscalYear) : undefined;
  const archive = db.runYearEndWalletArchive(year, user.email);
  return res.json({ archive });
});

app.get('/api/admin/wallet/export', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const csv = db.exportAdminWalletCsv({
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    purpose: typeof req.query.purpose === 'string' ? req.query.purpose : undefined,
    role: typeof req.query.role === 'string' ? req.query.role : undefined,
    sourceKind: typeof req.query.sourceKind === 'string' ? req.query.sourceKind : undefined,
    fiscalYear: req.query.fiscalYear ? Number(req.query.fiscalYear) : undefined,
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="airbus-admin-wallet-ledger.csv"');
  return res.send(csv);
});

app.post('/api/admin/wallet/special-refund', async (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const { adminPassword, reason, caseReference, originalPaymentCode, amount } = req.body || {};
  try {
    const out = await walletMutex.withWalletLock('admin@airbus.ke', () =>
      db.executeSpecialRefund({
        adminEmail: user.email,
        adminPassword: String(adminPassword || ''),
        reason: String(reason || ''),
        caseReference: String(caseReference || ''),
        originalPaymentCode: String(originalPaymentCode || ''),
        amount: Number(amount),
      })
    );
    return res.json(out);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Special Refund failed.' });
  }
});

app.get('/api/geocode', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const result = db.geocodeKenyanLocation(query);
  return res.json(result);
});

app.get('/api/music/tracks', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const genre = typeof req.query.genre === 'string' ? req.query.genre : undefined;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = db.getMusicTracks(q, genre, page, limit);
  return res.json(result);
});

app.post('/api/music/upload', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (user.role === 'owner') {
    try {
      db.assertHostSubscriptionActive(user.email);
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  }
  try {
    const { title, artist, genre, audioUrl, duration, licenceDeclaration } = req.body;
    if (!audioUrl) return res.status(400).json({ error: 'Audio file or URL is required.' });
    const track = db.uploadMusicTrack({
      title: title || 'Custom Track',
      artist: artist || user.name,
      genre: genre || 'Custom',
      audioUrl,
      duration: Number(duration) || 30,
      userEmail: user.email,
      licenceDeclaration: Boolean(licenceDeclaration),
    });
    return res.status(201).json({ track });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Audio upload failed' });
  }
});

app.post('/api/stays/:id/ai-short', (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Only owners or admins can generate shorts.' });
  }
  if (user.role === 'owner') {
    try {
      db.assertHostSubscriptionActive(user.email);
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  }
  try {
    const result = db.generateStayAiShort(req.params.id);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'AI Short generation failed.' });
  }
});

app.post('/api/admin/users/:email/verify', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const targetUser = db.findUserByEmail(req.params.email);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });
  targetUser.idVerified = !targetUser.idVerified;
  db.save();
  db.createAuditLog({
    id: 'aud_' + Date.now(),
    action: 'id_verify_toggle',
    actorEmail: user.email,
    details: `Toggled ID verification for ${targetUser.email} to ${targetUser.idVerified}`,
    createdAt: Date.now(),
  });
  return res.json({ user: targetUser });
});

// Admin Dormant Owners & Delisting
app.get('/api/admin/dormant-owners', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const dormantOwners = db.getDormantOwners();
  return res.json({ dormantOwners });
});

app.post('/api/admin/owners/:email/delist', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const success = db.delistOwner(req.params.email);
  return res.json({ success, dormantOwners: db.getDormantOwners() });
});

app.post('/api/admin/owners/:email/relist', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const success = db.relistOwner(req.params.email);
  return res.json({ success, dormantOwners: db.getDormantOwners() });
});

app.post('/api/admin/plan', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const { hostEmail, tier, durationDays } = req.body;
  if (!hostEmail || !tier) return res.status(400).json({ error: 'Host email and tier required.' });
  const days = Number(durationDays) || 30;
  const now = Date.now();
  const newPlan = {
    tier: tier as any,
    status: 'active' as const,
    expiresAt: now + days * 864e5,
    graceExpiresAt: now + (days + 2) * 864e5,
    hasPaidSubscription: true,
  };
  db.setHostPlan(hostEmail, newPlan);
  db.createAuditLog({
    id: 'aud_' + Date.now(),
    action: 'admin_plan_adjust',
    actorEmail: user.email,
    details: `Updated plan for ${hostEmail} to ${tier} (+${days} days)`,
    createdAt: Date.now(),
  });
  return res.json({ plan: newPlan });
});

// ============================================================================
// ADMIN COMPREHENSIVE MODERATION SUITE (PART 3)
// ============================================================================

// 1. Listing Media Moderation Queue
app.get('/api/admin/listing-media', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const { type, flaggedOnly, search } = req.query;
  const items = db.getListingMedia({
    type: type as string,
    flaggedOnly: flaggedOnly === 'true',
    search: search as string,
  });

  return res.json({ media: items, total: items.length });
});

app.post('/api/admin/stays/:id/media/remove', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const { mediaType, photoUrl, reason } = req.body;
  if (!mediaType || (mediaType !== 'video' && mediaType !== 'photo')) {
    return res.status(400).json({ error: 'Valid mediaType (video or photo) is required.' });
  }

  try {
    const updated = db.removeStayMedia(req.params.id, mediaType, photoUrl, user.email, reason);
    return res.json({ stay: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Media removal failed.' });
  }
});

app.post('/api/admin/stays/:id/media/flag', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const { status, reason } = req.body;
  if (!status || !['clean', 'flagged', 'under_review'].includes(status)) {
    return res.status(400).json({ error: 'Valid status (clean | flagged | under_review) required.' });
  }

  try {
    const updated = db.flagStayMedia(req.params.id, status, user.email, reason);
    return res.json({ stay: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Flagging media failed.' });
  }
});

// 2. Listing Full Moderation (Approve, Reject with Reason, Suspend, Unsuspend, Delist, Delete)
app.post('/api/admin/stays/:id/moderate', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const { action, reason } = req.body;
  const validActions = ['approve', 'reject', 'suspend', 'unsuspend', 'delist', 'relist', 'delete'];
  if (!action || !validActions.includes(action)) {
    return res.status(400).json({ error: `Action must be one of: ${validActions.join(', ')}` });
  }

  if (action === 'reject' && (!reason || !reason.trim())) {
    return res.status(400).json({ error: 'A specific reason is strictly required when rejecting a listing.' });
  }

  try {
    const stay = db.moderateStay(req.params.id, action, user.email, reason);
    return res.json({ success: true, action, stay });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Listing moderation failed.' });
  }
});

// 3. Subscriptions Moderation (View All, Approve, Reject, Extend, Revoke, Expire)
app.get('/api/admin/subscriptions', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const subscriptions = db.getAllSubscriptions();
  return res.json({ subscriptions, total: subscriptions.length });
});

app.post('/api/admin/subscriptions/:id/moderate', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const { action, days, reason } = req.body;
  const validActions = ['approve', 'reject', 'extend', 'revoke', 'expire'];
  if (!action || !validActions.includes(action)) {
    return res.status(400).json({ error: `Action must be one of: ${validActions.join(', ')}` });
  }

  try {
    const result = db.moderateSubscription(req.params.id, action, user.email, Number(days) || 30, reason);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Subscription moderation failed.' });
  }
});

// 4. Adverts Moderation (Approve, Reject, Pause, Resume, End Early)
app.post('/api/admin/ads/:id/moderate', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const { action, reason } = req.body;
  const validActions = ['approve', 'reject', 'pause', 'resume', 'end'];
  if (!action || !validActions.includes(action)) {
    return res.status(400).json({ error: `Action must be one of: ${validActions.join(', ')}` });
  }

  if (action === 'reject' && (!reason || !reason.trim())) {
    return res.status(400).json({ error: 'A specific reason is required when rejecting an advert.' });
  }

  try {
    const result = db.moderateAd(req.params.id, action, user.email, reason);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Advert moderation failed.' });
  }
});

// 5. Users & Hosts Moderation (Suspend, Ban, Reactivate, Verify)
app.post('/api/admin/users/:email/status', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const { action, reason } = req.body;
  const validActions = ['suspend', 'reactivate', 'verify'];
  if (!action || !validActions.includes(action)) {
    return res.status(400).json({ error: `Action must be one of: ${validActions.join(', ')}` });
  }

  try {
    const updatedUser = db.moderateUser(decodeURIComponent(req.params.email), action, user.email, reason);
    return res.json({ user: updatedUser });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'User status update failed.' });
  }
});

// 6. Reports & Flags Moderation
app.get('/api/admin/reports', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const reports = db.getReports();
  return res.json({ reports, total: reports.length });
});

app.post('/api/admin/reports/:id/action', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const { action, actionTaken } = req.body;
  const validActions = ['resolve', 'dismiss', 'penalize'];
  if (!action || !validActions.includes(action)) {
    return res.status(400).json({ error: `Action must be one of: ${validActions.join(', ')}` });
  }

  try {
    const report = db.actionReport(req.params.id, action, user.email, actionTaken);
    return res.json({ report });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Report action failed.' });
  }
});

// 7. Reviews Moderation
app.get('/api/admin/reviews', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const reviews = db.getAllReviews();
  return res.json({ reviews, total: reviews.length });
});

app.post('/api/admin/reviews/:id/moderate', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const { action } = req.body;
  const validActions = ['approve', 'hide', 'unhide', 'delete'];
  if (!action || !validActions.includes(action)) {
    return res.status(400).json({ error: `Action must be one of: ${validActions.join(', ')}` });
  }

  try {
    const review = db.moderateReview(req.params.id, action, user.email);
    return res.json({ review });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Review moderation failed.' });
  }
});

// 8. Audit Log Read-Only View
app.get('/api/admin/audit-logs', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const logs = db.getAuditLogs();
  return res.json({ logs, total: logs.length });
});

// 9. Live Updates Sync Polling (Real-Time sync without page reload)
app.get('/api/live/updates', (req, res) => {
  const user = getAuthUser(req);
  const raw = db.getRaw();
  const pendingPayments = (raw.paymentRecords || []).filter(p => p.status === 'pending').length;
  const pendingStays = (raw.stays || []).filter(s => s.status === 'review' || s.moderationStatus === 'pending').length;
  const flaggedMedia = (raw.stays || []).filter(s => s.mediaModerationStatus === 'flagged').length;
  const pendingReports = (raw.reports || []).filter(r => r.status === 'pending').length;
  const unreadNotifs = user ? (raw.notifications || []).filter(n => n.userEmail?.toLowerCase() === user.email.toLowerCase() && !n.read).length : 0;

  return res.json({
    timestamp: Date.now(),
    counts: {
      pendingPayments,
      pendingStays,
      flaggedMedia,
      pendingReports,
      unreadNotifs,
    },
  });
});

// AI Features: Trip Finder & Describe Stay
app.post('/api/ai/trip-finder', async (req, res) => {
  try {
    const { dates, budget, location, homeType, guests, notes } = req.body;
    const allStays = db.getStays();

    if (genAI && process.env.GEMINI_API_KEY) {
      try {
        const prompt = `You are the AI Matchmaker for AirBus, a premier video-first stays platform in Kenya.
Traveller preferences:
- Dates: ${dates || 'Flexible'}
- Budget: KES ${budget || 'Any'} per night
- Preferred Location: ${location || 'Anywhere in Kenya'}
- Home Type: ${homeType || 'Any'}
- Guests: ${guests || 2}
- Vibes & Notes: ${notes || 'Clean, safe, high-speed WiFi'}

Available listings:
${JSON.stringify(allStays.map(s => ({ id: s.id, title: s.title, loc: s.location, price: s.price, type: s.type, rating: s.rating, features: s.features })))}

Return ONLY a valid JSON array of up to 4 objects in this exact format:
[
  { "id": "s1", "matchReason": "Why this property matches their exact request in 1 punchy sentence" }
]`;

        const response = await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const text = response.text || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const results = parsed.map((item: any) => ({
            stay: db.getStayById(item.id),
            matchReason: item.matchReason,
          })).filter((x: any) => !!x.stay);
          if (results.length > 0) {
            return res.json({ matches: results });
          }
        }
      } catch (aiErr) {
        console.warn('Gemini trip-finder call error, falling back to smart heuristics:', aiErr);
      }
    }

    const scored = allStays.map(stay => {
      let score = 0;
      if (budget && stay.price <= Number(budget)) score += 3;
      if (homeType && stay.type.toLowerCase() === homeType.toLowerCase()) score += 3;
      if (location && (stay.location.toLowerCase().includes(location.toLowerCase()) || stay.title.toLowerCase().includes(location.toLowerCase()))) score += 4;
      if (stay.rating >= 4.8) score += 2;
      return { stay, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 4).map(item => ({
      stay: item.stay,
      matchReason: `Top rated ${item.stay.type} in ${item.stay.location} with outstanding guest verified reviews.`,
    }));

    return res.json({ matches: top });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.post('/api/ai/describe-stay', async (req, res) => {
  try {
    const { title, location, type, features } = req.body;
    if (genAI && process.env.GEMINI_API_KEY) {
      try {
        const prompt = `Write a luxury, persuasive description and 3 highlights for a video-first stay on AirBus Kenya.
Title: ${title}
Location: ${location}
Type: ${type}
Amenities: ${(features || []).join(', ')}

Return ONLY valid JSON:
{
  "description": "2-3 polished, compelling sentences highlighting the experience and location.",
  "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"]
}`;
        const response = await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
        const text = response.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return res.json(JSON.parse(jsonMatch[0]));
        }
      } catch (aiErr) {
        console.warn('Gemini describe-stay error, fallback applied:', aiErr);
      }
    }

    return res.json({
      description: `Spectacular ${type || 'stay'} situated in prime ${location || 'Nairobi'}. Designed with modern elegance, sunlit spaces, and top-tier comforts ideal for both leisure and business stays.`,
      highlights: [
        'Prime tranquil location with easy access to city attractions',
        'High-speed WiFi and dedicated work environment',
        '24/7 private security and premium amenities',
      ],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

// -----------------------------------------------------------------------------
// DYNAMIC SETTINGS & PLATFORM CONFIGURATION
// -----------------------------------------------------------------------------
app.get('/api/settings', (req, res) => {
  return res.json({ settings: db.getSettings() });
});

app.patch('/api/settings', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required to modify platform settings.' });
  }
  try {
    const updated = db.updateSettings(req.body, user.email);
    return res.json({ settings: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// WALLET & LEDGER SYSTEM
// -----------------------------------------------------------------------------
app.get('/api/wallet', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const wallet = db.getWalletRecord(user.email);
  const ledger = db.getLedgerEntries(user.email);
  const transactions = db.getUserWalletTransactions(user.email, false);
  return res.json({ wallet, ledger, transactions });
});

app.get('/api/wallet/transactions', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const reqEmail = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
  const wantAll = req.query.scope === 'all';
  if (user.role !== 'admin' && (wantAll || (reqEmail && reqEmail !== user.email.toLowerCase()))) {
    return res.status(403).json({ error: 'Privacy error: you can only view your own wallet transactions.' });
  }
  const targetEmail = user.role === 'admin' && reqEmail ? reqEmail : user.email;
  const transactions = db.getUserWalletTransactions(targetEmail, user.role === 'admin' && wantAll && !reqEmail);
  return res.json({ transactions });
});

app.get('/api/wallet/stream', (req, res) => {
  const token = extractAuthToken(req);
  const state = db.getSessionState(token, { touch: false });
  if (!state.user) return res.status(401).json({ error: 'Not authenticated' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const targetEmail = state.user.email.toLowerCase();
  const initialWallet = db.getWalletRecord(targetEmail);
  res.write(
    `event: wallet_update\ndata: ${JSON.stringify({
      email: targetEmail,
      balance: initialWallet.balance || 0,
      holdBalance: initialWallet.holdBalance || 0,
      available: Math.max(0, (initialWallet.balance || 0) - (initialWallet.holdBalance || 0)),
      updatedAt: Date.now(),
    })}\n\n`
  );

  const unsubscribe = db.subscribeWalletUpdates(payload => {
    if (payload.email === targetEmail) {
      res.write(`event: wallet_update\ndata: ${JSON.stringify(payload)}\n\n`);
    }
  });

  const keepalive = setInterval(() => {
    const check = db.getSessionState(token, { touch: false });
    if (!check.user) {
      res.write(`event: session_expired\ndata: ${JSON.stringify({ reason: 'idle_timeout' })}\n\n`);
      clearInterval(keepalive);
      unsubscribe();
      res.end();
      return;
    }
    res.write(': keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepalive);
    unsubscribe();
  });
});

app.post('/api/wallet/topup', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const rl = apiRateLimiter.check(`dep:${user.email.toLowerCase()}`, 20, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` });
  }
  const { amount, mpesaCode, phoneNumber, proofUrl, purpose } = req.body;
  const numAmount = Number(amount);
  if (!Number.isInteger(numAmount) || numAmount < 10) {
    return res.status(400).json({ error: 'Minimum deposit amount is KES 10 (whole integer Ksh).' });
  }
  if (!mpesaCode || !/^[A-Z0-9]{8,15}$/i.test(String(mpesaCode).trim())) {
    return res.status(400).json({ error: 'M-Pesa code must be a valid 8-15 character alphanumeric transaction reference (e.g. QWE123RTY4).' });
  }

  const cleanCode = String(mpesaCode).trim().toUpperCase();
  if (db.isMpesaCodeUsed(cleanCode)) {
    return res.status(400).json({ error: 'Duplicate M-Pesa transaction code. This code has already been submitted and cannot be reused.' });
  }

  const payment = await walletMutex.withWalletLock(user.email, () =>
    db.createPayment({
      id: 'pay_dep_' + Date.now(),
      userId: user.email,
      user_id: user.email,
      hostEmail: user.email,
      userRole: user.role,
      userName: user.username || user.name,
      kind: 'deposit',
      type: 'deposit',
      method: 'mpesa_manual',
      amount: numAmount,
      amountKes: numAmount,
      amountSc: numAmount,
      claimedAmount: numAmount,
      mpesaCode: cleanCode,
      reference: cleanCode,
      referenceId: cleanCode,
      phoneNumber: phoneNumber || user.phone || '',
      proofUrl: proofUrl || undefined,
      walletPurpose: typeof purpose === 'string' ? purpose : undefined,
      status: 'pending',
      createdAt: Date.now(),
    })
  );

  return res.status(201).json({
    message: `Deposit (M-Pesa) of KES ${numAmount.toLocaleString()} submitted. Awaiting Admin approval.`,
    payment,
  });
});

app.post('/api/wallet/deposit', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const rl = apiRateLimiter.check(`dep:${user.email.toLowerCase()}`, 20, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` });
  }
  const { amount, mpesaCode, phoneNumber, proofUrl, purpose } = req.body;
  const numAmount = Number(amount);
  if (!Number.isInteger(numAmount) || numAmount < 10) {
    return res.status(400).json({ error: 'Deposit amount must be a whole integer Ksh (minimum KES 10).' });
  }
  if (!mpesaCode || !/^[A-Z0-9]{8,15}$/i.test(String(mpesaCode).trim())) {
    return res.status(400).json({ error: 'M-Pesa code must be a valid 8-15 character alphanumeric transaction reference.' });
  }

  const cleanCode = String(mpesaCode).trim().toUpperCase();
  if (db.isMpesaCodeUsed(cleanCode)) {
    return res.status(400).json({ error: 'Duplicate M-Pesa transaction code. This code has already been submitted and cannot be reused.' });
  }

  const payment = await walletMutex.withWalletLock(user.email, () =>
    db.createPayment({
      id: 'pay_dep_' + Date.now(),
      userId: user.email,
      user_id: user.email,
      hostEmail: user.email,
      userRole: user.role,
      userName: user.username || user.name,
      kind: 'deposit',
      type: 'deposit',
      method: 'mpesa_manual',
      amount: numAmount,
      amountKes: numAmount,
      amountSc: numAmount,
      claimedAmount: numAmount,
      mpesaCode: cleanCode,
      reference: cleanCode,
      referenceId: cleanCode,
      phoneNumber: phoneNumber || user.phone || '',
      proofUrl: proofUrl || undefined,
      walletPurpose: typeof purpose === 'string' ? purpose : undefined,
      status: 'pending',
      createdAt: Date.now(),
    })
  );

  return res.status(201).json({
    message: `Deposit (M-Pesa) of KES ${numAmount.toLocaleString()} submitted and awaiting Admin approval.`,
    payment,
  });
});

app.post('/api/wallet/withdraw', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { amount, destination } = req.body;
  if (!amount || !destination) {
    return res.status(400).json({ error: 'Amount and payout destination (e.g. M-Pesa phone number or bank details) are required.' });
  }
  try {
    const reqItem = db.requestWithdrawal(user.email, Number(amount), String(destination).trim());
    return res.status(201).json({ withdrawal: reqItem });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/withdrawals', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  return res.json({ withdrawals: db.getWithdrawals() });
});

app.post('/api/admin/withdrawals/:id/approve', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const result = db.approveWithdrawal(req.params.id, user.email);
  if (!result) return res.status(404).json({ error: 'Withdrawal not found or already processed.' });
  return res.json({ withdrawal: result });
});

app.post('/api/admin/withdrawals/:id/reject', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const { reason } = req.body;
  const result = db.rejectWithdrawal(req.params.id, user.email, reason);
  if (!result) return res.status(404).json({ error: 'Withdrawal not found.' });
  return res.json({ withdrawal: result });
});

// Pay Plan from Wallet (Monthly or Annual - Host Wallet Only)
app.post('/api/plans/wallet-pay', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (user.role !== 'owner') {
    return res.status(403).json({ error: 'Host subscriptions use a Host wallet only.' });
  }
  const rl = apiRateLimiter.check(`pay:${user.email.toLowerCase()}`, 30, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` });
  }
  const { tier, period } = req.body;
  if (!['Silver', 'Diamond', 'Gold'].includes(tier)) {
    return res.status(400).json({ error: 'Valid plan tier required (Silver, Diamond, Gold).' });
  }
  const idemKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
  try {
    const out = await walletMutex.withWalletLock([user.email, 'admin@airbus.ke'], () =>
      db.runWithIdempotency(idemKey, () =>
        db.paySubscriptionFromWallet(user.email, tier, period === 'annual' ? 'annual' : 'monthly')
      )
    );
    return res.json(out.response);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// POSTS & CONTENT (PHOTO, SHORT, VIDEO)
// -----------------------------------------------------------------------------
app.get('/api/posts', (req, res) => {
  const { ownerEmail, status, type } = req.query;
  const user = getAuthUser(req);

  // If not admin and not filtering own posts, default to approved only
  let filterStatus = status as any;
  if (!user || user.role !== 'admin') {
    if (!ownerEmail || (user && user.email.toLowerCase() !== String(ownerEmail).toLowerCase())) {
      filterStatus = 'approved';
    }
  }

  const posts = db.getPosts({
    ownerEmail: ownerEmail ? String(ownerEmail) : undefined,
    status: filterStatus,
    type: type as any,
  });
  return res.json({ posts });
});

app.get('/api/posts/:id', (req, res) => {
  const post = db.getPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  return res.json({ post });
});

app.post('/api/posts', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to publish content.' });

  // Verify host has paid active non-expired subscription before publishing
  if (user.role === 'owner') {
    try {
      db.assertHostSubscriptionActive(user.email);
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  }

  const { stayId, type, description, coverUrl, images, videoUrl, videoAssetId, durationSeconds } = req.body;
  if (!type || !['photo', 'short', 'video'].includes(type)) {
    return res.status(400).json({ error: 'Type must be one of: photo, short, video.' });
  }
  if (!coverUrl) {
    return res.status(400).json({ error: 'Cover photo / thumbnail URL is required.' });
  }

  try {
    const newPost = db.createPost({
      ownerEmail: user.email,
      stayId,
      type,
      description: description || '',
      coverUrl,
      images,
      videoUrl,
      videoAssetId,
      durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
      status: 'pending',
    });
    return res.status(201).json({ post: newPost });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/posts/:id/moderate', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const { status, reason } = req.body;
  if (!['approved', 'rejected', 'removed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved, rejected, or removed.' });
  }
  const result = db.moderatePost(req.params.id, status, user.email, reason);
  if (!result) return res.status(404).json({ error: 'Post not found.' });
  return res.json({ post: result });
});

app.post('/api/posts/:id/view', (req, res) => {
  const viewer = req.ip || req.headers['x-forwarded-for'] || 'anonymous';
  const recorded = db.recordViewEvent(req.params.id, String(viewer));
  return res.json({ recorded });
});

app.patch('/api/posts/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const post = db.updatePostShort(req.params.id, user.email, req.body || {});
    return res.json({ post });
  } catch (err: any) {
    const msg = err.message || 'Unable to update post.';
    return res.status(msg.toLowerCase().includes('diamond') || msg.toLowerCase().includes('only the creator') ? 403 : 400).json({ error: msg });
  }
});

app.delete('/api/posts/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const result = db.deleteShortPost(req.params.id, user.email, user.role === 'admin');
    return res.json(result);
  } catch (err: any) {
    const msg = err.message || 'Unable to delete Short.';
    return res.status(msg.includes('permission') ? 403 : 404).json({ error: msg });
  }
});

app.delete('/api/shorts/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const result = db.deleteShortPost(req.params.id, user.email, user.role === 'admin');
    return res.json(result);
  } catch (err: any) {
    const msg = err.message || 'Unable to delete Short.';
    return res.status(msg.includes('permission') ? 403 : 404).json({ error: msg });
  }
});

app.post('/api/posts/:id/like', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to like this Short.' });
  try {
    const result = db.toggleLikePost(req.params.id, user.email);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/posts/:id/comments', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to comment.' });
  try {
    const comment = db.addPostComment(req.params.id, user.email, user.name, req.body?.text || '');
    return res.status(201).json({ comment });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/posts/:id/share', (req, res) => {
  const shares = db.incrementPostShare(req.params.id);
  return res.json({ shares });
});

// -----------------------------------------------------------------------------
// SHORTS / REELS HOST-ONLY AUTO-CREATION, TIER CONFIG, AUDIO LIBRARY & ANALYTICS
// -----------------------------------------------------------------------------
app.get('/api/config/shorts-tiers', (req, res) => {
  return res.json({
    tiers: SHORTS_TIER_CONFIG,
    audioUpload: {
      allowedExtensions: AUDIO_UPLOAD_CONFIG.allowedExtensions,
      allowedMimeTypes: AUDIO_UPLOAD_CONFIG.allowedMimeTypes,
      maxFileSizeBytes: AUDIO_UPLOAD_CONFIG.maxFileSizeBytes,
      maxShortDurationSec: AUDIO_UPLOAD_CONFIG.maxShortDurationSec,
      maxListingDurationSec: AUDIO_UPLOAD_CONFIG.maxListingDurationSec,
    },
  });
});

app.get('/api/owner/listings/:stayId/shorts-status', (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Host authentication required.' });
  }
  try {
    const status = db.getListingShortsStatus(req.params.stayId, user.email, user.role === 'admin');
    return res.json(status);
  } catch (err: any) {
    const msg = err.message || 'Listing Shorts status unavailable.';
    return res.status(msg.includes('Unauthorized') ? 403 : 404).json({ error: msg });
  }
});

app.get('/api/owner/shorts-analytics', (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Host authentication required.' });
  }
  const summary = db.getOwnerShortsAnalytics(user.email);
  return res.json(summary);
});

app.get('/api/audio/tracks', async (req, res) => {
  await audioLibraryService.ensureLocalAudioAssets().catch(() => {});
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const genre = typeof req.query.genre === 'string' ? req.query.genre : undefined;
  const mood = typeof req.query.mood === 'string' ? req.query.mood : undefined;
  const trendingOnly = req.query.trending === 'true';
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 25;
  const result = db.getAudioLibrary({ query: q, genre, mood, trendingOnly, page, limit });
  return res.json(result);
});

app.post('/api/audio/tracks/:id/report', (req, res) => {
  const user = getAuthUser(req);
  const reporter = user?.email || req.body?.email || 'anonymous@airbus.ke';
  const { reason, postId } = req.body || {};
  const report = db.reportAudioTrack(req.params.id, reporter, reason || 'Licensing / audio issue', postId);
  return res.status(201).json({
    report,
    message: 'Audio report submitted for moderation review.',
  });
});

app.post('/api/shorts/tts', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to generate text-to-speech voice-over.' });
  if (user.role !== 'owner' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Only Diamond or Gold hosts can generate voice-over audio.' });
  }
  if (user.role === 'owner') {
    try {
      db.assertHostSubscriptionActive(user.email);
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  }
  const { script, voice, language, purpose } = req.body || {};
  const tierInfo = db.getHostEffectiveTier(user.email);
  if (purpose === 'listing') {
    if (!tierInfo.rules.listing_audio_enabled && user.role !== 'admin') {
      return res.status(403).json({ error: 'Listing voice-over audio is exclusive to active Gold hosts.' });
    }
  } else if (!tierInfo.rules.shorts_audio_enabled && user.role !== 'admin') {
    return res.status(403).json({ error: 'Shorts voice-over audio requires an active Diamond or Gold plan.' });
  }
  if (!script || !String(script).trim()) {
    return res.status(400).json({ error: 'Please enter a script or caption to convert to voice-over.' });
  }
  try {
    const result = await audioLibraryService.synthesizeTtsTrack({
      script: String(script).trim().slice(0, 500),
      voice: voice ? String(voice) : 'warm_female',
      language: language ? String(language) : 'en-KE',
    });
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Voice-over generation failed.' });
  }
});

app.post('/api/shorts/upload-media', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to upload media.' });
  if (user.role !== 'owner' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Only hosts can upload Short & Listing audio media.' });
  }
  if (user.role === 'owner') {
    try {
      db.assertHostSubscriptionActive(user.email);
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  }

  const { files, kind, purpose } = req.body || {};
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No media files received.' });
  }
  try {
    if (kind === 'audio') {
      const tierInfo = db.getHostEffectiveTier(user.email);
      if (purpose === 'listing' && !tierInfo.rules.listing_audio_enabled && user.role !== 'admin') {
        return res.status(403).json({ error: 'Listing audio uploads require an active Gold subscription.' });
      }
      if (purpose !== 'listing' && !tierInfo.rules.shorts_audio_enabled && user.role !== 'admin') {
        return res.status(403).json({ error: 'Shorts audio uploads require an active Diamond or Gold subscription.' });
      }
      files.forEach((f: string) =>
        audioLibraryService.validateAudioDataUrl(f, AUDIO_UPLOAD_CONFIG.maxFileSizeBytes)
      );
    }
    const prefix = kind === 'audio' ? 'vo' : kind === 'photo' ? 'img' : 'vid';
    const savedUrls = files.slice(0, 12).map((item: string) =>
      mediaProcessingService.saveDataUrlToDisk(item, prefix)
    );
    return res.status(201).json({ urls: savedUrls });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Media upload failed.' });
  }
});

app.post('/api/shorts/jobs', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to auto-create a Short.' });

  const {
    idempotencyKey,
    stayId,
    sourceType,
    sourceFiles,
    autoCreateEnabled,
    reviewBeforePosting,
    autoCaptionsEnabled,
    aspectCropMode,
    trimStartSec,
    trimEndSec,
    caption,
    hashtags,
    audioConfig,
  } = req.body || {};

  if (!sourceType || !['video', 'photo'].includes(sourceType)) {
    return res.status(400).json({ error: 'sourceType must be video or photo.' });
  }
  if (!Array.isArray(sourceFiles) || sourceFiles.length === 0) {
    return res.status(400).json({ error: 'At least one listing video or photo is required.' });
  }

  const key =
    typeof idempotencyKey === 'string' && idempotencyKey.trim()
      ? idempotencyKey.trim()
      : `idem_${user.email}_${stayId || 'none'}_${sourceType}_${Date.now()}`;

  // Duplicate idempotency key does NOT double-charge quota — return existing job cleanly
  const existingByKey = db.getShortJobs(user.email).find(j => j.idempotencyKey === key);
  if (existingByKey) {
    return res.status(200).json({ job: existingByKey, deduplicated: true });
  }

  let validatedUsage;
  try {
    const check = db.assertHostCanCreateShort(stayId, user, audioConfig);
    validatedUsage = check.usage;
  } catch (err: any) {
    return res.status(403).json({ error: err.message || 'You are not authorized to auto-create Shorts for this listing.' });
  }

  try {
    const savedSources = sourceFiles.slice(0, 10).map((item: string) =>
      mediaProcessingService.saveDataUrlToDisk(item, sourceType === 'photo' ? 'img' : 'vid')
    );

    const resolvedAudioConfig = audioConfig ? { ...audioConfig } : undefined;
    if (resolvedAudioConfig?.voiceOverUrl && resolvedAudioConfig.voiceOverUrl.startsWith('data:')) {
      audioLibraryService.validateAudioDataUrl(
        resolvedAudioConfig.voiceOverUrl,
        AUDIO_UPLOAD_CONFIG.maxFileSizeBytes
      );
      resolvedAudioConfig.voiceOverUrl = mediaProcessingService.saveDataUrlToDisk(resolvedAudioConfig.voiceOverUrl, 'vo');
    }

    const result = shortJobQueue.enqueue({
      idempotencyKey: key,
      ownerEmail: user.email,
      ownerName: user.name,
      stayId,
      sourceType,
      sourceFiles: savedSources,
      autoCreateEnabled,
      reviewBeforePosting,
      autoCaptionsEnabled,
      aspectCropMode,
      trimStartSec,
      trimEndSec,
      caption,
      hashtags,
      audioConfig: resolvedAudioConfig,
      allowAudio: validatedUsage.shortsAudioEnabled,
    });

    const updatedUsage = db.getListingShortUsage(stayId, user.email);
    return res.status(result.deduplicated ? 200 : 202).json({ ...result, usage: updatedUsage });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Unable to queue Short creation job.' });
  }
});

app.get('/api/shorts/jobs', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  if (user.role !== 'owner' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Host access required.' });
  }
  const jobs = db.getShortJobs(user.email);
  return res.json({ jobs });
});

app.get('/api/shorts/jobs/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  const job = db.getShortJobById(req.params.id);
  if (!job || (job.ownerEmail !== user.email.toLowerCase() && user.role !== 'admin')) {
    return res.status(404).json({ error: 'Job not found.' });
  }
  return res.json({ job });
});

app.post('/api/shorts/jobs/:id/retry', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  const existing = db.getShortJobById(req.params.id);
  if (!existing || (existing.ownerEmail !== user.email.toLowerCase() && user.role !== 'admin')) {
    return res.status(404).json({ error: 'Job not found.' });
  }
  try {
    db.assertHostCanCreateShort(existing.stayId, user, existing.audioConfig);
  } catch (err: any) {
    return res.status(403).json({ error: err.message });
  }
  const job = shortJobQueue.retryJob(req.params.id);
  return res.json({ job });
});

app.post('/api/shorts/jobs/:id/publish', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const result = db.publishDraftShort(req.params.id, user.email, req.body || {});
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Could not publish Short.' });
  }
});

// Public Shorts Feed (No login required to watch; marks unavailable listings safely)
app.get('/api/shorts/feed', (req, res) => {
  const trackId = typeof req.query.trackId === 'string' ? req.query.trackId : undefined;
  const ownerEmail = typeof req.query.ownerEmail === 'string' ? req.query.ownerEmail : undefined;
  const posts = db.getPublicShortsFeed({ trackId, ownerEmail });
  return res.json({ posts });
});

// Public Shorts Playback & Listing-Action Click Analytics
app.post('/api/shorts/:id/analytics', (req, res) => {
  const { event, intent } = req.body || {};
  const validEvents = ['view', 'play', 'replay', 'click'];
  if (!validEvents.includes(event)) {
    return res.status(400).json({ error: 'Valid event (view | play | replay | click) required.' });
  }
  const record = db.recordShortAnalytics(
    req.params.id,
    event,
    intent as ShortIntentType | undefined
  );
  return res.json({ analytics: record });
});

// -----------------------------------------------------------------------------
// ADVERTS & 10 SLOTS SPONSORSHIPS
// -----------------------------------------------------------------------------
app.get('/api/ads', (req, res) => {
  const { stayId, status } = req.query;
  const ads = db.getAdRequests({
    stayId: stayId ? String(stayId) : undefined,
    status: status as any,
  });
  return res.json({ ads });
});

app.post('/api/ads', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to place an advert.' });
  if (user.role === 'owner') {
    try {
      db.assertHostSubscriptionActive(user.email);
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  }

  const { stayId, title, description, imageUrl, targetUrl, contactPhone, tag, days, paymentMethod } = req.body;
  if (paymentMethod && paymentMethod !== 'wallet') {
    return res.status(400).json({ error: 'Adverts can only be paid strictly from your private AirBus Wallet.' });
  }
  if (!stayId || !title || !imageUrl || !targetUrl) {
    return res.status(400).json({ error: 'Stay ID, headline title, banner image, and destination link/phone are required.' });
  }

  try {
    const ad = db.createAdRequest({
      advertiserEmail: user.email,
      stayId,
      title,
      description: description || '',
      imageUrl,
      targetUrl,
      contactPhone,
      tag,
      days: Number(days) || 3,
    });
    return res.status(201).json({ ad });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/ads/:id/approve', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const result = db.approveAdRequest(req.params.id, user.email);
  if (!result) return res.status(404).json({ error: 'Ad request not found or not pending.' });
  return res.json({ ad: result });
});

app.post('/api/ads/:id/reject', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const { reason } = req.body;
  const result = db.rejectAdRequest(req.params.id, user.email, reason);
  if (!result) return res.status(404).json({ error: 'Ad request not found.' });
  return res.json({ ad: result });
});

// Record Ad View & Click Visibility Events
app.post('/api/ads/:id/view', (req, res) => {
  const recorded = db.recordAdView(req.params.id);
  return res.json({ recorded });
});

app.post('/api/ads/:id/click', (req, res) => {
  const recorded = db.recordAdClick(req.params.id);
  return res.json({ recorded });
});

// SnappAdd Video Advert Placement & Payment API
app.get('/api/ads/snappadd', (req, res) => {
  try {
    const campaigns = db.getSnappAddCampaigns();
    return res.json({ campaigns });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch campaigns' });
  }
});

app.post('/api/ads/snappadd', async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Please sign in to run an advert campaign from your wallet.' });
    }
    const rl = apiRateLimiter.check(`pay:${user.email.toLowerCase()}`, 30, 60_000);
    if (!rl.allowed) {
      return res.status(429).json({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` });
    }
    if (user.role === 'owner') {
      db.assertHostSubscriptionActive(user.email);
    }

    const {
      title,
      description,
      websiteUrl,
      thumbnailUrl,
      videoUrl,
      durationDays,
      coinsPaid,
      paymentMethod,
    } = req.body;

    if (paymentMethod && paymentMethod !== 'wallet') {
      return res.status(400).json({ error: 'Adverts can only be paid strictly from your private AirBus Wallet.' });
    }

    if (!title || !websiteUrl) {
      return res.status(400).json({ error: 'Title and website URL are required.' });
    }

    const idemKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
    const out = await walletMutex.withWalletLock([user.email, 'admin@airbus.ke'], () =>
      db.runWithIdempotency(idemKey, () =>
        db.createSnappAddCampaign({
          userEmail: user.email,
          title,
          description: description || '',
          websiteUrl,
          thumbnailUrl: thumbnailUrl || '',
          videoUrl,
          durationDays: Number(durationDays) || 7,
          coinsPaid: Number(coinsPaid) || 70,
        }),
        201
      )
    );

    return res.status(out.deduplicated ? 200 : 201).json(out.response);
  } catch (err: any) {
    const msg = err.message || 'Payment processing failed.';
    return res.status(msg.toLowerCase().includes('subscription') ? 403 : 400).json({ error: msg });
  }
});

// -----------------------------------------------------------------------------
// AFFILIATE / REFERRAL PROGRAM ("EARN" TAB)
// -----------------------------------------------------------------------------
app.get('/api/referrals/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const profile = db.getReferralProfile(user.email);
  const commissions = db.getReferralCommissions(user.email);
  return res.json({ profile, commissions });
});

app.post('/api/referrals/click', (req, res) => {
  const { code } = req.body;
  const recorded = db.trackReferralClick(code);
  return res.json({ recorded });
});

// -----------------------------------------------------------------------------
// ANALYTICS: PRICE TREND SPARKLINE & VIRALITY GRAPH
// -----------------------------------------------------------------------------
app.get('/api/analytics/price-trend/:stayId', (req, res) => {
  const trend = db.getStayPriceTrend(req.params.stayId);
  return res.json({ trend });
});

app.get('/api/analytics/virality/:id', (req, res) => {
  const report = db.getViralityReport(req.params.id);
  return res.json({ report });
});

// -----------------------------------------------------------------------------
// REAL-TIME APPROVED FEED SSE STREAM & REPLAY (Part 3.6)
// -----------------------------------------------------------------------------
app.get('/api/realtime/feed', (req, res) => {
  const viewerUser = getAuthUser(req, { touch: false });
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

  const unsubscribe = db.subscribeFeedUpdates(evt => {
    const currentViewer = getAuthUser(req, { touch: false }) || viewerUser;
    if (evt.type === 'stay' && evt.item?.isPlusVVVIP) {
      const canSeePlus = Boolean(
        currentViewer && (currentViewer.role === 'admin' || db.isActivePlusMember(currentViewer))
      );
      if (!canSeePlus) return;
    }
    res.write(`event: feed_update\ndata: ${JSON.stringify(evt)}\n\n`);
  });

  const unsubscribeCounts =
    viewerUser?.role === 'admin'
      ? db.subscribeTripDatingCounts(counts => {
          res.write(`event: trip_dating_counts\ndata: ${JSON.stringify(counts)}\n\n`);
        })
      : () => {};

  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepalive);
    unsubscribe();
    unsubscribeCounts();
  });
});

app.get('/api/realtime/feed/missed', (req, res) => {
  const viewerUser = getAuthUser(req, { touch: false });
  const since = Number(req.query.since) || 0;
  const events = db.getMissedApprovedFeed(since, viewerUser);
  return res.json({ events });
});

// -----------------------------------------------------------------------------
// TRIP DATING: A Dating Services Near You
// Tagline: "Trip Dating – A Dating Services Near You. FREE TO JOIN. ENDLESS TO DISCOVER. KES 50 TO CONNECT."
// -----------------------------------------------------------------------------

app.get('/api/trip-dating/feed', (req, res) => {
  try {
    const user = getAuthUser(req);
    const clientSessionId = (req.headers['x-client-session'] as string) || (req.query.sessionId as string) || '';
    const { gender, city, search, intention, cursor, limit } = req.query;

    const result = db.queryTripDatingFeed(user?.email, clientSessionId, {
      gender: gender as string,
      city: city as string,
      search: search as string,
      intention: intention as string,
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: limit ? parseInt(limit as string, 10) : 15,
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch Trip Dating feed' });
  }
});

app.get('/api/trip-dating/cities', (_req, res) => {
  return res.json({ cities: db.getTripDatingAvailableCities(true) });
});

app.get('/api/trip-dating/profiles', (req, res) => {
  try {
    const user = getAuthUser(req);
    const clientSessionId = (req.headers['x-client-session'] as string) || (req.query.sessionId as string) || '';
    const { gender, city, search, intention, cursor, limit } = req.query;

    const result = db.queryTripDatingFeed(user?.email, clientSessionId, {
      gender: gender as string,
      city: city as string,
      search: search as string,
      intention: intention as string,
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: limit ? parseInt(limit as string, 10) : 15,
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch dating profiles' });
  }
});

app.get('/api/trip-dating/my-submissions', (req, res) => {
  try {
    const user = getAuthUser(req);
    const clientSessionId = (req.headers['x-client-session'] as string) || (req.query.sessionId as string) || '';
    const profiles = db.getMyTripDatingSubmissions(user?.email, clientSessionId);
    return res.json({ profiles });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch your submissions' });
  }
});

app.get('/api/trip-dating/profiles/:id', (req, res) => {
  try {
    const user = getAuthUser(req);
    const clientSessionId = (req.headers['x-client-session'] as string) || (req.query.sessionId as string) || '';
    const profile = db.getTripDatingProfileById(
      req.params.id,
      user?.email,
      clientSessionId,
      user?.role === 'admin'
    );

    if (!profile) {
      return res.status(404).json({ error: 'Dating profile not found' });
    }

    return res.json({ profile });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch profile' });
  }
});

// Registration with Mandatory Admin Review (starts in PENDING_REVIEW) & Uploaded Media Support
app.post('/api/trip-dating/profiles', (req, res) => {
  try {
    const user = getAuthUser(req);
    const clientSessionId = (req.headers['x-client-session'] as string) || (req.body?.clientSessionId as string) || '';
    const rl = apiRateLimiter.check(`td_create:${user?.email || clientSessionId || req.ip || 'anon'}`, 15, 60_000);
    if (!rl.allowed) {
      return res.status(429).json({ error: `Rate limit exceeded. Please retry in ${rl.retryAfterSec}s.` });
    }

    const {
      fullName,
      phoneNumber,
      gender,
      age,
      dob,
      city,
      city_custom,
      location,
      description,
      lookingFor,
      datingIntention,
      photos,
      primaryPhoto,
      videos,
      videoDurations,
      videoThumbnails,
      videoUrl,
      videoDuration,
      videoThumbnail,
      videoMediaId,
      videoMediaIds,
      mediaAssetIds,
      videoFilter,
      videoTrimStart,
      videoTrimEnd,
      full_body_photo,
      full_body_verified,
      status,
    } = req.body;

    if (!fullName || !phoneNumber || !city || !description || !gender) {
      return res.status(400).json({ error: 'Full name, valid phone number, gender, city, and bio description are required.' });
    }

    const effectiveDur = Number(videoDuration) || 60;
    if (videoUrl && effectiveDur > 60.5) {
      return res.status(400).json({
        error: 'Video exceeds the maximum duration limit of 60 seconds. Please upload or trim your video to 60 seconds or less.',
      });
    }

    const validVideos: string[] = [];
    const validDurations: number[] = [];
    if (Array.isArray(videos)) {
      videos.slice(0, 2).forEach((v: any, idx: number) => {
        if (typeof v === 'string' && v.trim().length > 0) {
          validVideos.push(v.trim());
          const dur = Array.isArray(videoDurations) ? Number(videoDurations[idx]) : 60;
          validDurations.push(Math.min(60, dur || 60));
        }
      });
    }

    const bodyPhoto = full_body_photo || primaryPhoto || (Array.isArray(photos) && photos[0]) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';

    const isDataUrl = typeof bodyPhoto === 'string' && bodyPhoto.startsWith('data:image/');
    const isHttpUrl = typeof bodyPhoto === 'string' && (bodyPhoto.startsWith('http://') || bodyPhoto.startsWith('https://'));
    const isUploadedUrl = typeof bodyPhoto === 'string' && bodyPhoto.startsWith('/uploads/');

    if (!isDataUrl && !isHttpUrl && !isUploadedUrl) {
      return res.status(400).json({
        error: 'Invalid photo format. Only JPG, PNG, and WebP images are permitted.',
      });
    }

    if (isDataUrl && bodyPhoto.length > 7 * 1024 * 1024) {
      return res.status(400).json({
        error: 'Photo file size exceeds maximum limit of 5MB. Please upload a compressed photo.',
      });
    }

    const result = db.createTripDatingProfile({
      fullName,
      phoneNumber,
      gender,
      age: Number(age) || 25,
      dob,
      country: 'Kenya',
      city,
      city_custom,
      location: location || city_custom || city,
      description,
      lookingFor: lookingFor || 'Genuine companionship and fun dates',
      datingIntention,
      photos: Array.isArray(photos) && photos.length > 0 ? photos.slice(0, 4) : [bodyPhoto],
      primaryPhoto: primaryPhoto || bodyPhoto,
      videos: validVideos.length > 0 ? validVideos : undefined,
      videoDurations: validDurations.length > 0 ? validDurations : undefined,
      videoThumbnails: Array.isArray(videoThumbnails) ? videoThumbnails.slice(0, 2) : undefined,
      videoUrl: typeof videoUrl === 'string' && videoUrl.trim() ? videoUrl.trim() : undefined,
      videoDuration: videoUrl ? Math.min(60, Math.max(1, Math.round(effectiveDur))) : undefined,
      videoThumbnail: typeof videoThumbnail === 'string' && videoThumbnail.trim() ? videoThumbnail.trim() : undefined,
      videoMediaId: typeof videoMediaId === 'string' ? videoMediaId : undefined,
      videoMediaIds: Array.isArray(videoMediaIds) ? videoMediaIds : undefined,
      mediaAssetIds: Array.isArray(mediaAssetIds) ? mediaAssetIds : undefined,
      videoFilter: typeof videoFilter === 'string' && videoFilter.trim() ? videoFilter.trim() : undefined,
      videoTrimStart: videoTrimStart !== undefined ? Number(videoTrimStart) : undefined,
      videoTrimEnd: videoTrimEnd !== undefined ? Number(videoTrimEnd) : undefined,
      full_body_photo: bodyPhoto,
      full_body_verified: full_body_verified !== undefined ? Boolean(full_body_verified) : true,
      status: status === 'DRAFT' ? 'DRAFT' : 'PENDING_REVIEW',
      userId: user?.id || user?.email,
      ownerEmail: user?.email,
      clientSessionId,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Registration rejected by safety policy.' });
  }
});

// Edit & Resubmit Trip Dating post (Preserves createdAt, clears admin_feedback, sets PENDING)
app.post('/api/trip-dating/profiles/:id/resubmit', (req, res) => {
  try {
    const user = getAuthUser(req);
    const clientSessionId = (req.headers['x-client-session'] as string) || (req.body?.clientSessionId as string) || '';
    const profile = db.resubmitTripDatingProfile(
      req.params.id,
      user?.email,
      clientSessionId,
      user?.role === 'admin',
      req.body || {}
    );
    return res.json({
      profile,
      message: 'Trip Dating post updated and resubmitted for Admin Review.',
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to resubmit Trip Dating post' });
  }
});

app.put('/api/trip-dating/profiles/:id', (req, res) => {
  try {
    const user = getAuthUser(req);
    const updated = db.updateTripDatingProfile(req.params.id, req.body, user?.email);
    return res.json({ profile: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update profile' });
  }
});

app.post('/api/trip-dating/profiles/:id/like', (req, res) => {
  try {
    const user = getAuthUser(req);
    const viewerEmail = user?.email || (req.headers['x-client-session'] as string) || 'guest@airbus.ke';
    const result = db.toggleLikeTripDatingProfile(req.params.id, viewerEmail);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to like profile' });
  }
});

app.post('/api/trip-dating/profiles/:id/view', (req, res) => {
  try {
    const views = db.incrementTripDatingProfileViews(req.params.id);
    return res.json({ views });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to record view' });
  }
});

// Pay KES 50 from Wallet to unlock Trip Dating contact for 10 minutes
app.post('/api/trip-dating/unlock', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Please sign in to unlock contacts using your AirBus Wallet.' });
  }
  const rl = apiRateLimiter.check(`pay:${user.email.toLowerCase()}`, 30, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` });
  }

  const { profileId, clientSessionId } = req.body || {};
  if (!profileId) {
    return res.status(400).json({ error: 'profileId is required.' });
  }

  const idemKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
  try {
    const out = await walletMutex.withWalletLock([user.email, 'admin@airbus.ke'], () =>
      db.runWithIdempotency(idemKey, () =>
        db.unlockTripDatingWithWallet({
          profileId,
          userEmail: user.email,
          clientSessionId: clientSessionId || (req.headers['x-client-session'] as string) || undefined,
        })
      )
    );
    return res.json(out.response);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to unlock contact from wallet.' });
  }
});

// Legacy M-Pesa Contact Unlock Request — REMOVED in favor of Pay from Wallet (KES 50)
app.post('/api/trip-dating/contact-requests', (_req, res) => {
  return res.status(400).json({
    error: 'Pay with M-Pesa has been removed. Use Deposit (M-Pesa) to top up your AirBus Wallet, then Pay KES 50 from Wallet.',
  });
});

// Check Active 10-Minute Contact Unlock Status
app.get('/api/trip-dating/contact-status/:profileId', (req, res) => {
  try {
    const user = getAuthUser(req);
    const clientSessionId = (req.headers['x-client-session'] as string) || (req.query.sessionId as string) || '';
    const unlock = db.checkActiveContactUnlock(req.params.profileId, user?.email, clientSessionId);

    if (unlock && unlock.expiresAt > Date.now()) {
      return res.json({
        isUnlocked: true,
        expiresAt: unlock.expiresAt,
        remainingSeconds: Math.max(0, Math.round((unlock.expiresAt - Date.now()) / 1000)),
        unlockedPhone: unlock.unlockedPhone,
      });
    }

    return res.json({
      isUnlocked: false,
      remainingSeconds: 0,
      unlockedPhone: null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to check unlock status' });
  }
});

// Report Suspicious / Inappropriate Profile
app.post('/api/trip-dating/reports', (req, res) => {
  try {
    const user = getAuthUser(req);
    const { profileId, profileName, reason, details } = req.body;
    if (!profileId || !reason) {
      return res.status(400).json({ error: 'Profile ID and reason are required.' });
    }
    const reporterEmail = user?.email || (req.headers['x-client-session'] as string) || 'guest@airbus.ke';
    db.reportTripDatingProfile({
      profileId,
      profileName: profileName || profileId,
      reportedByEmail: reporterEmail,
      reason,
      details,
    });
    return res.status(201).json({
      success: true,
      message: 'Your concern has been logged for review.',
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to submit report' });
  }
});

// --- ADMIN TRIP DATING MANAGEMENT ROUTES ---

app.get('/api/admin/trip-dating/counts', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  return res.json(db.getTripDatingAdminCounts());
});

app.get('/api/admin/trip-dating/submissions', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const status = typeof req.query.status === 'string' ? req.query.status : 'PENDING_REVIEW';
  const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
  return res.json(db.getAdminTripDatingSubmissions({ status, page, limit }));
});

app.post('/api/admin/trip-dating/:id/approve', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    const result = db.approveTripDatingSubmission(req.params.id, user.email);
    return res.json(result);
  } catch (err: any) {
    const status = /not found/i.test(err?.message || '') ? 404 : 400;
    return res.status(status).json({ error: err.message || 'Approval failed.' });
  }
});

app.post('/api/admin/trip-dating/:id/decline', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const rawReason = String(req.body?.reason ?? req.body?.admin_feedback ?? '').trim();
  if (rawReason.length < 10 || rawReason.length > 500) {
    return res.status(400).json({
      error: 'A decline reason between 10 and 500 characters is strictly required.',
    });
  }
  try {
    const result = db.declineTripDatingSubmission(req.params.id, user.email, rawReason);
    return res.json(result);
  } catch (err: any) {
    const status = /not found/i.test(err?.message || '') ? 404 : 400;
    return res.status(status).json({ error: err.message || 'Decline failed.' });
  }
});

app.get('/api/admin/trip-dating/requests', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const requests = db.getTripDatingPaymentRequests();
  return res.json({ requests });
});

app.post('/api/admin/trip-dating/requests/:id/approve', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    const result = db.approveTripDatingPayment(req.params.id, user.email);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Approval failed' });
  }
});

app.post('/api/admin/trip-dating/requests/:id/reject', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    const { reason } = req.body;
    const result = db.rejectTripDatingPayment(req.params.id, user.email, reason);
    return res.json({ request: result });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Rejection failed' });
  }
});

app.post('/api/admin/trip-dating/profiles/:id/moderate', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    const { status, reason } = req.body;
    const profile = db.adminModerateTripDatingProfile(req.params.id, status, reason, user.email);
    return res.json({ profile });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Moderation action failed' });
  }
});

app.get('/api/admin/trip-dating/stats', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const stats = db.getTripDatingStats();
  const counts = db.getTripDatingAdminCounts();
  const allProfiles = db.getTripDatingProfiles(user.email, undefined, { showAllStatuses: true });
  return res.json({ stats, counts, profiles: allProfiles });
});

// -----------------------------------------------------------------------------
// AIRBUS COLLECTIONS ENDPOINTS (With Server-Side VVVIP Gating)
// -----------------------------------------------------------------------------
app.get('/api/collections/:slug', (req, res) => {
  const viewerUser = getAuthUser(req);
  const slug = String(req.params.slug || '').toLowerCase();
  const data = db.getCollectionData(slug, viewerUser);
  return res.json(data);
});

app.get('/api/airbus/collections/:id/listings', (req, res) => {
  const viewerUser = getAuthUser(req);
  const slug = String(req.params.id || '').toLowerCase();
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 12;
  const data = db.getCollectionListingsPaginated(slug, { viewerUser, cursor, limit });
  return res.json(data);
});

app.post('/api/collections/black-friday/notify', (req, res) => {
  const user = getAuthUser(req);
  const email = (req.body?.email || user?.email || '').trim();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Please provide a valid email address for Black Friday reminders.' });
  }
  const result = db.subscribeBlackFriday(email);
  return res.status(201).json({
    ...result,
    message: result.alreadySubscribed
      ? 'You are already subscribed to quarterly AirBus Black Friday alerts!'
      : 'You are on the VIP list! We will notify you before the next AirBus Black Friday event.',
  });
});

app.post('/api/collections/vvvip/upgrade', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Please sign in first to access AirBus Plus.' });
  }
  if (user.role !== 'guest') {
    return res.status(403).json({ error: 'AirBus Plus is for Guests only and never uses a Host wallet.' });
  }
  const rl = apiRateLimiter.check(`pay:${user.email.toLowerCase()}`, 20, 60_000);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.` });
  }
  const { method } = req.body || {};
  if (method && method !== 'wallet') {
    return res.status(400).json({
      error: 'Pay with M-Pesa has been removed. Use Deposit (M-Pesa) to top up your Guest wallet, then Pay Ksh 3,500 from Wallet.',
    });
  }
  const idemKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
  try {
    const out = await walletMutex.withWalletLock([user.email, 'admin@airbus.ke'], () =>
      db.runWithIdempotency(idemKey, () => {
        const result = db.upgradeUserToVVVIP(
          user.email,
          undefined,
          { billing: 'monthly', method: 'wallet' }
        );
        const { passwordHash, ...safeUser } = result.user as any;
        return {
          user: safeUser,
          pending: result.pending,
          payment: result.payment,
          walletBalance: result.walletBalance,
          message: result.message,
        };
      })
    );
    return res.json(out.response);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'AirBus Plus upgrade failed.' });
  }
});

// Private AirBus Plus "Other services, ask." endpoints (Strictly private to the member & Admin)
app.get('/api/collections/plus/service-requests', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  const dbUser = db.findUserByEmail(user.email) || user;
  if (dbUser.role !== 'admin' && !db.isActivePlusMember(dbUser)) {
    return res.status(403).json({ error: 'AirBus Plus is Reserved VIP to VVVIP Guests.' });
  }
  const requests = db.getPlusServiceRequests(dbUser);
  return res.json({ requests });
});

app.post('/api/collections/plus/service-requests', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in first.' });
  const dbUser = db.findUserByEmail(user.email) || user;
  if (dbUser.role !== 'admin' && !db.isActivePlusMember(dbUser)) {
    return res.status(403).json({ error: 'AirBus Plus is Reserved VIP to VVVIP Guests.' });
  }
  try {
    const request = db.createPlusServiceRequest(user.email, req.body?.requestText);
    return res.status(201).json({
      request,
      message: 'Your extra service request has been sent to Admin to link you with a reliable provider.',
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Could not submit service request.' });
  }
});

app.post('/api/admin/plus/service-requests/:id/link', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    const request = db.linkPlusServiceRequest(req.params.id, user.email, req.body || {});
    return res.json({ request });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Could not link provider.' });
  }
});

// AirBus Local Free Provider Registration & Admin Moderation
app.get('/api/collections/local/providers', (_req, res) => {
  return res.json({ providers: db.getLocalProviders(false) });
});

app.post('/api/collections/local/providers', (req, res) => {
  const user = getAuthUser(req);
  try {
    const provider = db.registerLocalProvider({
      ...(req.body || {}),
      ownerEmail: user?.email,
    });
    return res.status(201).json({
      provider,
      message: 'Your AirBus Local profile is live! Remember: No drugs or illegal activities. Any such provider profile will be pulled down.',
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Could not register AirBus Local profile.' });
  }
});

app.get('/api/admin/local-providers', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  return res.json({ providers: db.getLocalProviders(true) });
});

app.post('/api/admin/local-providers/:id/pull-down', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    const provider = db.pullDownLocalProvider(req.params.id, user.email, req.body?.reason);
    return res.json({ provider });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Could not pull down provider profile.' });
  }
});

app.post('/api/collections/local/request-guide', (req, res) => {
  const user = getAuthUser(req);
  const { guideId, area, dates, notes, guestEmail, guestName } = req.body || {};
  if (!guideId) {
    return res.status(400).json({ error: 'Guide ID is required.' });
  }
  const email = user?.email || guestEmail;
  const name = user?.name || guestName || 'AirBus Guest';
  if (!email) {
    return res.status(400).json({ error: 'Please provide your email or sign in so the guide can reach you.' });
  }
  try {
    const result = db.requestLocalGuide({
      guideId,
      userEmail: email,
      userName: name,
      area: area || 'Local Market Tour',
      dates: dates || 'Flexible dates',
      notes: notes || '',
    });
    return res.status(201).json({
      ...result,
      message: `Request sent to ${result.guide.name}! Expect a message or call within 30 minutes.`,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Could not submit guide request.' });
  }
});

// -----------------------------------------------------------------------------
// VITE DEV SERVER OR STATIC PRODUCTION SERVING
// -----------------------------------------------------------------------------
async function startServer() {
  if (!isProduction) {
    let viteMiddleware: express.RequestHandler | null = null;
    const viteReady = import('vite').then(async ({ createServer: createViteServer }) => {
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false, ws: false },
        appType: 'spa',
      });
      viteMiddleware = vite.middlewares;
    });

    // Redirect legacy /AirbusGlobal paths to root
    app.get('/AirbusGlobal*', (req, res) => {
      res.redirect(req.url.replace(/^\/AirbusGlobal\/?/, '/') || '/');
    });

    app.use((req, res, next) => {
      if (viteMiddleware) return viteMiddleware(req, res, next);
      viteReady
        .then(() => {
          if (viteMiddleware) return viteMiddleware(req, res, next);
          return next();
        })
        .catch(next);
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use('/AirbusGlobal', express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AirBus full-stack server running on http://0.0.0.0:${PORT}`);
    // Run subscription/boost/ad expiration checks on startup and every 60 seconds
    db.checkAllExpirations();
    const expiryScheduler = setInterval(() => {
      try {
        db.checkAllExpirations();
      } catch (err) {
        console.warn('Scheduled expiration check warning:', err);
      }
    }, 60 * 1000);
    expiryScheduler.unref();

    // Warm local audio tracks only after server is listening & Vite has settled
    setTimeout(() => {
      audioLibraryService.ensureLocalAudioAssets().catch(() => {});
    }, 5000);
  });
  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    console.error(`Failed to bind server on port ${PORT}:`, err.message);
    process.exit(1);
  });
}

export { app };

const isTestRunner =
  Boolean(process.env.AIRBUS_TEST_NO_LISTEN) ||
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  process.argv.includes('--test');

if (!isTestRunner) {
  startServer().catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}
