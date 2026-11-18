import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export type LogLevel = 'info' | 'warn' | 'error';

export const logger = {
  log(level: LogLevel, event: string, meta: Record<string, unknown> = {}) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      event,
      ...meta,
    };
    const line = JSON.stringify(entry);
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  },
  info(event: string, meta: Record<string, unknown> = {}) {
    this.log('info', event, meta);
  },
  warn(event: string, meta: Record<string, unknown> = {}) {
    this.log('warn', event, meta);
  },
  error(event: string, meta: Record<string, unknown> = {}) {
    this.log('error', event, meta);
  },
};

export interface OpsErrorRecord {
  ts: string;
  requestId: string;
  method: string;
  path: string;
  status: number;
  message: string;
}

export const opsMetrics = {
  startedAt: Date.now(),
  totalRequests: 0,
  totalErrors: 0,
  recentErrors: [] as OpsErrorRecord[],
  recordError(err: OpsErrorRecord) {
    this.totalErrors += 1;
    this.recentErrors.unshift(err);
    if (this.recentErrors.length > 50) {
      this.recentErrors.length = 50;
    }
  },
};

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && incomingId.trim()
      ? incomingId.trim().slice(0, 64)
      : `req_${crypto.randomBytes(6).toString('hex')}`;
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const started = Date.now();
  opsMetrics.totalRequests += 1;

  res.on('finish', () => {
    const durationMs = Date.now() - started;
    const isApi = req.originalUrl.startsWith('/api/');
    if (res.statusCode >= 500) {
      const msg = res.locals?.errorMessage || `HTTP ${res.statusCode}`;
      opsMetrics.recordError({
        ts: new Date().toISOString(),
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        message: String(msg),
      });
      logger.error('http_request_error', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
      });
    } else if (isApi && res.statusCode >= 400) {
      logger.warn('http_request_client_error', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
      });
    } else if (isApi && !req.originalUrl.includes('/stream') && !req.originalUrl.includes('/realtime/feed')) {
      logger.info('http_request', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
      });
    }
  });

  next();
}

/**
 * Per-wallet mutex queue that serializes concurrent wallet mutations so
 * simultaneous debits/credits cannot double-spend or corrupt balances.
 */
class WalletMutex {
  private queues = new Map<string, Promise<void>>();

  private acquireSingle(key: string): Promise<() => void> {
    const prev = this.queues.get(key) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => {
      release = resolve;
    });
    const nextChain = prev.then(() => current).catch(() => current);
    this.queues.set(key, nextChain);
    return prev.then(() => () => {
      release();
      if (this.queues.get(key) === nextChain) {
        this.queues.delete(key);
      }
    });
  }

  public async withWalletLock<T>(emails: string | string[], fn: () => Promise<T> | T): Promise<T> {
    const list = Array.isArray(emails) ? emails : [emails];
    const normalized = Array.from(
      new Set(
        list
          .map(e => String(e || '').trim().toLowerCase())
          .filter(Boolean)
      )
    ).sort();

    if (normalized.length === 0) {
      return await fn();
    }

    const releases: Array<() => void> = [];
    try {
      for (const key of normalized) {
        releases.push(await this.acquireSingle(key));
      }
      return await fn();
    } finally {
      for (let i = releases.length - 1; i >= 0; i -= 1) {
        try {
          releases[i]();
        } catch {
          // ignore release error
        }
      }
    }
  }
}

export const walletMutex = new WalletMutex();

/**
 * Sliding window in-memory rate limiter.
 */
export class SlidingRateLimiter {
  private buckets = new Map<string, number[]>();

  public check(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
    const now = Date.now();
    const cutoff = now - windowMs;
    const existing = (this.buckets.get(key) || []).filter(ts => ts > cutoff);
    if (existing.length >= maxRequests) {
      const oldest = existing[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      this.buckets.set(key, existing);
      return { allowed: false, retryAfterSec };
    }
    existing.push(now);
    this.buckets.set(key, existing);
    return { allowed: true, retryAfterSec: 0 };
  }

  public reset(key?: string) {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }
}

export const apiRateLimiter = new SlidingRateLimiter();
