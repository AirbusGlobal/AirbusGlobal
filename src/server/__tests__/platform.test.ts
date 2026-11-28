import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

process.env.AIRBUS_TEST_NO_LISTEN = '1';

import { app } from '../../../server';
import { db } from '../db';
import { walletMutex } from '../services/ops';

const DB_FILE = path.resolve(process.cwd(), 'data', 'airbus-db.json');
const RAW_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'raw');

let server: http.Server;
let baseUrl = '';
let dbSnapshotRaw: string | null = null;
const createdUploadFiles: string[] = [];

async function apiJson<T = any>(
  route: string,
  options: {
    method?: string;
    token?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${baseUrl}${route}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

describe('AirBus Platform End-to-End Integrity Suite', () => {
  let guestToken = '';
  let hostToken = '';
  let adminToken = '';

  before(async () => {
    dbSnapshotRaw = fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE, 'utf-8') : null;

    await new Promise<void>(resolve => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    const guestLogin = await apiJson<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: { portal: 'guest', username: 'SarahWanjiku', password: 'Sarah$Nairobi88!' },
    });
    assert.equal(guestLogin.status, 200, 'Guest login must succeed');
    guestToken = guestLogin.data.token;

    const hostLogin = await apiJson<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: { portal: 'owner', username: 'DavidMutua', password: 'Mutua@Westlands91#' },
    });
    assert.equal(hostLogin.status, 200, 'Host login must succeed');
    hostToken = hostLogin.data.token;

    const adminLogin = await apiJson<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: { email: 'kamalahari93@gmail.com', password: '2019xyz//' },
    });
    assert.equal(adminLogin.status, 200, 'Admin login must succeed');
    adminToken = adminLogin.data.token;

    // Ensure owner@airbus.ke has an active Gold plan with room for test listings
    const initPlan = await apiJson('/api/admin/plan', {
      method: 'POST',
      token: adminToken,
      body: { hostEmail: 'owner@airbus.ke', tier: 'Gold', durationDays: 30 },
    });
    assert.equal(initPlan.status, 200, 'Host Gold plan setup must succeed');
  });

  after(async () => {
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
    if (dbSnapshotRaw !== null) {
      fs.writeFileSync(DB_FILE, dbSnapshotRaw, 'utf-8');
    }
    for (const relUrl of createdUploadFiles) {
      const cleaned = relUrl.startsWith('/uploads/')
        ? path.resolve(process.cwd(), relUrl.replace(/^\//, ''))
        : path.join(RAW_UPLOADS_DIR, path.basename(relUrl));
      for (const candidate of [cleaned, path.join(RAW_UPLOADS_DIR, path.basename(relUrl))]) {
        if (fs.existsSync(candidate)) {
          try {
            fs.unlinkSync(candidate);
          } catch {
            // ignore cleanup failure
          }
        }
      }
    }
  });

  it('1. Wallet mutex prevents race-condition lost updates & idempotency deduplicates retries', async () => {
    const startBal = db.getWalletBalance('guest@airbus.ke');
    await Promise.all(
      Array.from({ length: 10 }, (_, idx) =>
        walletMutex.withWalletLock('guest@airbus.ke', async () => {
          await new Promise(r => setTimeout(r, 2));
          db.recordWalletTransaction({
            walletId: 'guest@airbus.ke',
            direction: 'credit',
            amount: 100,
            type: 'test_credit',
            reference: `RACECODE0${idx}`,
            note: 'Concurrency test credit',
          });
        })
      )
    );
    const afterConcurrent = db.getWalletBalance('guest@airbus.ke');
    assert.equal(afterConcurrent, startBal + 1000, 'All 10 concurrent credits must be preserved');

    let execCount = 0;
    const key = `idem_test_${Date.now()}`;
    const first = db.runWithIdempotency(key, () => {
      execCount += 1;
      return { ok: true, seq: execCount };
    }, 201);
    const second = db.runWithIdempotency(key, () => {
      execCount += 1;
      return { ok: true, seq: execCount };
    }, 201);

    assert.equal(first.deduplicated, false);
    assert.equal(second.deduplicated, true);
    assert.equal(execCount, 1, 'Idempotency key must execute operation once');
    assert.deepEqual(second.response, first.response);
  });

  it('2. Enforces wallet-only payments, exact Deposit (M-Pesa) approval, duplicate code rejection & KES 50 Trip Dating unlock', async () => {
    // Pay with M-Pesa endpoints must reject
    const directMpesa = await apiJson('/api/payments/mpesa', {
      method: 'POST',
      token: guestToken,
      body: { type: 'vvvip', amount: 3500, mpesaCode: 'QWE9988776' },
    });
    assert.equal(directMpesa.status, 400);

    const legacyContactReq = await apiJson('/api/trip-dating/contact-requests', {
      method: 'POST',
      token: guestToken,
      body: { profileId: 'tdp_1', mpesaCode: 'QWE9988776' },
    });
    assert.equal(legacyContactReq.status, 400);

    const uniqueCode = `DEP${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const depositAmount = 5000;
    const beforeBal = db.getWalletBalance('guest@airbus.ke');

    const depositRes = await apiJson<{ payment: any }>('/api/wallet/deposit', {
      method: 'POST',
      token: guestToken,
      body: { amount: depositAmount, mpesaCode: uniqueCode, phoneNumber: '+254712345678' },
    });
    assert.equal(depositRes.status, 201);
    assert.equal(depositRes.data.payment.status, 'pending');
    assert.equal(depositRes.data.payment.amountKes, depositAmount);

    // Duplicate M-Pesa code must be rejected
    const dupRes = await apiJson('/api/wallet/deposit', {
      method: 'POST',
      token: guestToken,
      body: { amount: depositAmount, mpesaCode: uniqueCode },
    });
    assert.equal(dupRes.status, 400);

    // Admin approval with mismatched amount must be rejected
    const mismatchApprove = await apiJson(`/api/admin/payments/${depositRes.data.payment.id}/approve`, {
      method: 'POST',
      token: adminToken,
      body: { confirmedAmount: depositAmount + 50 },
    });
    assert.equal(mismatchApprove.status, 400);

    // Admin approval with exact amount credits exact KES 5,000
    const exactApprove = await apiJson<{ payment: any }>(`/api/admin/payments/${depositRes.data.payment.id}/approve`, {
      method: 'POST',
      token: adminToken,
      body: { confirmedAmount: depositAmount },
    });
    assert.equal(exactApprove.status, 200);
    assert.equal(exactApprove.data.payment.status, 'approved');
    assert.equal(db.getWalletBalance('guest@airbus.ke'), beforeBal + depositAmount);

    // Trip Dating unlock must deduct KES 50, grant 10-minute window, and reject unapproved profiles
    const preUnlockBal = db.getWalletBalance('guest@airbus.ke');
    const unlockRes = await apiJson<{
      unlockedPhone: string;
      expiresAt: number;
      remainingSeconds: number;
      walletBalance: number;
    }>('/api/trip-dating/unlock', {
      method: 'POST',
      token: guestToken,
      body: { profileId: 'tdp_1' },
    });
    assert.equal(unlockRes.status, 200);
    assert.ok(unlockRes.data.unlockedPhone, 'Unlocked phone must be returned');
    assert.ok(unlockRes.data.remainingSeconds > 540 && unlockRes.data.remainingSeconds <= 600);
    assert.equal(unlockRes.data.walletBalance, preUnlockBal - 50);

    const statusRes = await apiJson<{ isUnlocked: boolean; unlockedPhone: string | null }>(
      '/api/trip-dating/contact-status/tdp_1',
      { token: guestToken }
    );
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.data.isUnlocked, true);
    assert.equal(statusRes.data.unlockedPhone, unlockRes.data.unlockedPhone);
  });

  it('3. Wallet ledger reconciliation reports zero drift on transacted wallets', async () => {
    const res = await apiJson<{
      mismatches: number;
      totalWallets: number;
      wallets: Array<{ email: string; difference: number; isMatched: boolean }>;
    }>('/api/admin/wallet/reconciliation', {
      token: adminToken,
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.totalWallets >= 3);
    const guestWallet = res.data.wallets.find(w => w.email === 'guest@airbus.ke');
    const adminWallet = res.data.wallets.find(w => w.email === 'admin@airbus.ke');
    assert.ok(guestWallet?.isMatched && guestWallet.difference === 0, 'Guest wallet must reconcile to 0 diff');
    assert.ok(adminWallet?.isMatched && adminWallet.difference === 0, 'Admin wallet must reconcile to 0 diff');
  });

  it('4. Persists real media uploads to /uploads/raw, serves them over HTTP, and blocks blob: URLs', async () => {
    const samplePng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );

    const uploadRes = await fetch(`${baseUrl}/api/uploads/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hostToken}`,
        'Content-Type': 'image/png',
        'x-media-kind': 'photo',
        'x-file-mime': 'image/png',
        'x-file-name': 'test-suite-photo.png',
      },
      body: samplePng,
    });
    assert.equal(uploadRes.status, 201);
    const uploaded = (await uploadRes.json()) as { url: string; kind: string; bytes: number };
    assert.ok(uploaded.url.startsWith('/uploads/raw/'));
    createdUploadFiles.push(uploaded.url);

    const staticFetch = await fetch(`${baseUrl}${uploaded.url}`);
    assert.equal(staticFetch.status, 200);
    const fetchedBuf = Buffer.from(await staticFetch.arrayBuffer());
    assert.equal(fetchedBuf.length, samplePng.length);

    assert.throws(() => db.assertNoBlobUrls(['blob:http://localhost:3000/fake-blob-id']), /blob:/i);

    const blobStayAttempt = await apiJson('/api/stays', {
      method: 'POST',
      token: adminToken,
      body: {
        title: 'Rejected Blob Stay',
        location: 'Kilimani, Nairobi',
        lat: -1.29,
        lng: 36.78,
        price: 8500,
        images: ['blob:http://localhost:3000/deadbeef'],
        thumbnailUrl: 'blob:http://localhost:3000/deadbeef',
      },
    });
    assert.equal(blobStayAttempt.status, 400);
  });

  it('5–8. Full Stay submission -> PENDING -> Review Queue (oldest first) -> Decline w/ feedback -> Resubmit -> Approve -> SSE & Newest-First feed', async () => {
    // Ensure host has an active Diamond/Gold plan with room for test stays
    const planGrant = await apiJson('/api/admin/plan', {
      method: 'POST',
      token: adminToken,
      body: { hostEmail: 'owner@airbus.ke', tier: 'Gold', durationDays: 30 },
    });
    assert.equal(planGrant.status, 200);

    // Upload a valid photo first
    const tinyPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const up = await apiJson<{ url: string }>('/api/uploads/media', {
      method: 'POST',
      token: hostToken,
      body: { dataUrl: tinyPngDataUrl, filename: 'stay1.png', kind: 'photo' },
    });
    assert.equal(up.status, 201);
    createdUploadFiles.push(up.data.url);

    // Create two stays to check oldest-pending-first ordering in queue
    const createStay1 = await apiJson<{ stay: any }>('/api/stays', {
      method: 'POST',
      token: hostToken,
      body: {
        title: 'Test Suite Penthouse One',
        location: 'Westlands, Nairobi',
        lat: -1.264,
        lng: 36.802,
        price: 14500,
        guests: 4,
        beds: 2,
        images: [up.data.url],
        thumbnailUrl: up.data.url,
        description: 'Automated suite verification stay one.',
      },
    });
    assert.equal(createStay1.status, 201);
    const stay1 = createStay1.data.stay;
    assert.equal(stay1.moderationState, 'PENDING');
    assert.equal(stay1.status, 'review');

    await new Promise(r => setTimeout(r, 15));

    const createStay2 = await apiJson<{ stay: any }>('/api/stays', {
      method: 'POST',
      token: hostToken,
      body: {
        title: 'Test Suite Penthouse Two',
        location: 'Nyali, Mombasa',
        lat: -4.02,
        lng: 39.71,
        price: 16500,
        guests: 4,
        beds: 2,
        images: [up.data.url],
        thumbnailUrl: up.data.url,
        description: 'Automated suite verification stay two.',
      },
    });
    assert.equal(createStay2.status, 201);
    const stay2 = createStay2.data.stay;

    // Must NOT appear in public feed or shorts feed while PENDING
    const publicFeedPending = await apiJson<{ stays: any[] }>('/api/stays?limit=50');
    assert.equal(publicFeedPending.status, 200);
    assert.equal(publicFeedPending.data.stays.some(s => s.id === stay1.id), false);

    const shortsPending = await apiJson<{ shorts: any[] }>('/api/shorts/feed');
    assert.equal(shortsPending.status, 200);
    assert.equal((shortsPending.data.shorts || []).some(s => s.stayId === stay1.id || s.id === stay1.id), false);

    // Host sees stay in My Submissions (newest first)
    const mySubs = await apiJson<{ stays: any[] }>('/api/stays/my-submissions', { token: hostToken });
    assert.equal(mySubs.status, 200);
    const idx2 = mySubs.data.stays.findIndex(s => s.id === stay2.id);
    const idx1 = mySubs.data.stays.findIndex(s => s.id === stay1.id);
    assert.ok(idx2 !== -1 && idx1 !== -1 && idx2 < idx1, 'My Submissions must be newest first');

    // Admin Review Queue must list oldest pending first and include stays + counts for AdminDashboard
    const queue = await apiJson<{
      stays: any[];
      listings: any[];
      tripDating: any[];
      counts: { stays: number; tripDating: number; total: number };
    }>('/api/admin/review-queue', {
      token: adminToken,
    });
    assert.equal(queue.status, 200);
    assert.ok(Array.isArray(queue.data.stays), 'Admin Review Queue must include stays array');
    assert.ok(queue.data.counts && typeof queue.data.counts.total === 'number', 'Admin Review Queue must include counts object');
    assert.equal(queue.data.counts.total, queue.data.counts.stays + queue.data.counts.tripDating);
    const qIdx1 = queue.data.listings.findIndex(s => s.id === stay1.id);
    const qIdx2 = queue.data.listings.findIndex(s => s.id === stay2.id);
    assert.ok(qIdx1 !== -1 && qIdx2 !== -1 && qIdx1 < qIdx2, 'Admin Review Queue must return oldest pending first');

    const overview = await apiJson<{
      metrics: any;
      stays: any[];
      users: any[];
      payments: any[];
      auditLogs: any[];
    }>('/api/admin/overview', { token: adminToken });
    assert.equal(overview.status, 200);
    assert.ok(overview.data.metrics && typeof overview.data.metrics.totalStays === 'number');
    assert.ok(Array.isArray(overview.data.stays) && overview.data.stays.some(s => s.id === stay1.id), 'Admin overview must include all stays');
    assert.ok(Array.isArray(overview.data.users) && Array.isArray(overview.data.payments) && Array.isArray(overview.data.auditLogs));

    // Declining without admin_feedback must fail with 400
    const badDecline = await apiJson(`/api/admin/review-queue/stays/${stay1.id}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'decline', admin_feedback: '   ' },
    });
    assert.equal(badDecline.status, 400);

    // Declining with feedback succeeds and hides from Review Queue
    const feedbackMsg = 'Please sharpen exterior photo lighting before approval.';
    const goodDecline = await apiJson<{ stay: any }>(`/api/admin/review-queue/stays/${stay1.id}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'decline', admin_feedback: feedbackMsg },
    });
    assert.equal(goodDecline.status, 200);
    assert.equal(goodDecline.data.stay.moderationState, 'DECLINED');
    assert.equal(goodDecline.data.stay.admin_feedback, feedbackMsg);

    // Resubmit preserves createdAt, clears admin_feedback, and returns to PENDING
    const origCreatedAt = stay1.createdAt;
    const resubmit = await apiJson<{ stay: any }>(`/api/stays/${stay1.id}/resubmit`, {
      method: 'POST',
      token: hostToken,
      body: { title: 'Test Suite Penthouse One Updated' },
    });
    assert.equal(resubmit.status, 200);
    assert.equal(resubmit.data.stay.createdAt, origCreatedAt);
    assert.equal(resubmit.data.stay.admin_feedback, null);
    assert.equal(resubmit.data.stay.moderationState, 'PENDING');

    const beforeApproveTs = Date.now() - 1;
    const approveRes = await apiJson<{ stay: any }>(`/api/admin/review-queue/stays/${stay1.id}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'approve' },
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.stay.moderationState, 'APPROVED');
    assert.equal(approveRes.data.stay.status, 'live');

    // Public feed immediately includes approved stay (newest first) & SSE missed replay has event
    const publicFeedAfter = await apiJson<{ stays: any[] }>('/api/stays?limit=20');
    assert.equal(publicFeedAfter.status, 200);
    assert.ok(publicFeedAfter.data.stays.some(s => s.id === stay1.id), 'Approved stay must appear in public feed');

    const missed = await apiJson<{ events: Array<{ type: string; item: any }> }>(
      `/api/realtime/feed/missed?since=${beforeApproveTs}`,
      { token: guestToken }
    );
    assert.equal(missed.status, 200);
    assert.ok(missed.data.events.some(e => e.type === 'stay' && e.item?.id === stay1.id));
  });

  it('9. Trip Dating full PENDING -> Review Queue -> Decline / Resubmit -> Approve lifecycle & unlock guard', async () => {
    const clientSession = `sess_test_${Date.now()}`;
    const tinyPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const up = await apiJson<{ url: string }>('/api/uploads/media', {
      method: 'POST',
      token: guestToken,
      body: { dataUrl: tinyPngDataUrl, filename: 'td1.png', kind: 'photo' },
    });
    assert.equal(up.status, 201);
    createdUploadFiles.push(up.data.url);

    const createTd = await apiJson<{ profile: any }>('/api/trip-dating/profiles', {
      method: 'POST',
      token: guestToken,
      headers: { 'x-client-session': clientSession },
      body: {
        fullName: 'Amani K.',
        phoneNumber: '+254711223344',
        gender: 'female',
        age: 26,
        city: 'Nairobi',
        description: 'Love coastal road trips and good espresso.',
        lookingFor: 'Fun adventure partner',
        datingIntention: 'dating_companionship',
        primaryPhoto: up.data.url,
        full_body_photo: up.data.url,
        photos: [up.data.url],
      },
    });
    assert.equal(createTd.status, 201);
    const td = createTd.data.profile;
    assert.equal(td.moderationState, 'PENDING_REVIEW');
    assert.equal(td.status, 'PENDING_REVIEW');

    // Non-approved Trip Dating profile cannot be unlocked
    const lockedAttempt = await apiJson('/api/trip-dating/unlock', {
      method: 'POST',
      token: guestToken,
      body: { profileId: td.id },
    });
    assert.equal(lockedAttempt.status, 400);

    // Must not appear in public Trip Dating feed yet
    const publicTdPending = await apiJson<{ profiles: any[] }>('/api/trip-dating/profiles?limit=50');
    assert.equal(publicTdPending.data.profiles.some(p => p.id === td.id), false);

    // Admin declines without feedback -> 400; with feedback -> DECLINED
    const badDecline = await apiJson(`/api/admin/review-queue/trip-dating/${td.id}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'decline', admin_feedback: '' },
    });
    assert.equal(badDecline.status, 400);

    const declined = await apiJson<{ profile: any }>(`/api/admin/review-queue/trip-dating/${td.id}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'decline', admin_feedback: 'Add a clearer bio line.' },
    });
    assert.equal(declined.status, 200);
    assert.equal(declined.data.profile.moderationState, 'DECLINED');
    assert.equal(declined.data.profile.admin_feedback, 'Add a clearer bio line.');

    // Resubmit -> PENDING_REVIEW, admin_feedback cleared, createdAt preserved
    const resubmitted = await apiJson<{ profile: any }>(`/api/trip-dating/profiles/${td.id}/resubmit`, {
      method: 'POST',
      token: guestToken,
      headers: { 'x-client-session': clientSession },
      body: { description: 'Updated bio: Love coastal road trips, jazz, and espresso.' },
    });
    assert.equal(resubmitted.status, 200);
    assert.equal(resubmitted.data.profile.createdAt, td.createdAt);
    assert.equal(resubmitted.data.profile.admin_feedback, null);
    assert.equal(resubmitted.data.profile.moderationState, 'PENDING_REVIEW');

    // Approve -> live in public feed & unlockable
    const approved = await apiJson<{ profile: any }>(`/api/admin/review-queue/trip-dating/${td.id}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'approve' },
    });
    assert.equal(approved.status, 200);
    assert.equal(approved.data.profile.moderationState, 'APPROVED');
    assert.equal(approved.data.profile.status, 'APPROVED');

    const publicTdApproved = await apiJson<{ profiles: any[] }>('/api/trip-dating/profiles?limit=20');
    assert.ok(publicTdApproved.data.profiles.some(p => p.id === td.id));
  });

  it('10. Enforces AirBus Plus (isPlusVVVIP) gating across /api/stays, /api/collections/plus, and SSE missed replay', async () => {
    const tinyPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const up = await apiJson<{ url: string }>('/api/uploads/media', {
      method: 'POST',
      token: hostToken,
      body: { dataUrl: tinyPngDataUrl, filename: 'plus.png', kind: 'photo' },
    });
    createdUploadFiles.push(up.data.url);

    const plusStayRes = await apiJson<{ stay: any }>('/api/stays', {
      method: 'POST',
      token: adminToken,
      body: {
        title: 'Exclusive AirBus Plus Villa',
        location: 'Diani, Kwale',
        lat: -4.28,
        lng: 39.59,
        price: 55000,
        images: [up.data.url],
        thumbnailUrl: up.data.url,
        isPlusVVVIP: true,
      },
    });
    assert.equal(plusStayRes.status, 201);
    const plusStay = plusStayRes.data.stay;

    const plusApproveTs = Date.now() - 1;
    await apiJson(`/api/admin/review-queue/stays/${plusStay.id}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'approve' },
    });

    // Non-Plus guest cannot see Plus stay in feed, collection, or missed SSE
    const guestFeed = await apiJson<{ stays: any[] }>('/api/stays?limit=50', { token: guestToken });
    assert.equal(guestFeed.data.stays.some(s => s.id === plusStay.id), false);

    const plusLocked = await apiJson<{ locked: boolean; stays: any[] }>('/api/collections/plus', {
      token: guestToken,
    });
    assert.equal(plusLocked.status, 200);
    assert.equal(plusLocked.data.locked, true);
    assert.equal(plusLocked.data.stays.length, 0);

    const missedNonPlus = await apiJson<{ events: Array<{ item: any }> }>(
      `/api/realtime/feed/missed?since=${plusApproveTs}`,
      { token: guestToken }
    );
    assert.equal(missedNonPlus.data.events.some(e => e.item?.id === plusStay.id), false);

    // Guest upgrades via Ksh 3,500 Wallet payment -> gains immediate access
    const upgradeRes = await apiJson<{ user: any; walletBalance: number }>('/api/collections/vvvip/upgrade', {
      method: 'POST',
      token: guestToken,
      body: { method: 'wallet' },
    });
    assert.equal(upgradeRes.status, 200);
    assert.equal(upgradeRes.data.user.isVVVIP, true);

    const plusUnlocked = await apiJson<{ locked: boolean; stays: any[] }>('/api/collections/plus', {
      token: guestToken,
    });
    assert.equal(plusUnlocked.data.locked, false);
    assert.ok(
      plusUnlocked.data.stays.some(s => s.id === plusStay.id),
      `Expected ${plusStay.id} in Plus collection (got ${plusUnlocked.data.stays.map(s => s.id).join(',')})`
    );
  });

  it('11. Keyset cursor pagination returns disjoint pages in newest-first order', async () => {
    const page1 = await apiJson<{ stays: any[]; nextCursor: string | null; hasMore: boolean }>(
      '/api/stays?limit=2'
    );
    assert.equal(page1.status, 200);
    assert.equal(page1.data.stays.length, 2);
    assert.ok(page1.data.hasMore);
    assert.ok(page1.data.nextCursor);

    const page2 = await apiJson<{ stays: any[]; nextCursor: string | null; hasMore: boolean }>(
      `/api/stays?limit=2&cursor=${encodeURIComponent(page1.data.nextCursor!)}`
    );
    assert.equal(page2.status, 200);
    assert.ok(page2.data.stays.length >= 1);

    const p1Ids = new Set(page1.data.stays.map(s => s.id));
    for (const item of page2.data.stays) {
      assert.equal(p1Ids.has(item.id), false, 'Cursor pages must not overlap');
    }
    assert.ok(
      page1.data.stays[page1.data.stays.length - 1].createdAt >= page2.data.stays[0].createdAt,
      'Pages must stay in newest-first order'
    );
  });

  it('12. Health check and startup migration rollback/re-apply idempotency work cleanly', async () => {
    const health = await apiJson<{ status: string; dbOk: boolean }>('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.status, 'ok');
    assert.equal(health.data.dbOk, true);

    const rolledBack = db.rollbackMigration('v1_moderation_pipeline_sync');
    assert.equal(typeof rolledBack, 'boolean');
    db.runStartupMigrations();
    // Re-running startup migrations must be idempotent
    db.runStartupMigrations();
    const healthAfter = await apiJson<{ status: string; dbOk: boolean }>('/api/health');
    assert.equal(healthAfter.status, 200);
    assert.equal(healthAfter.data.dbOk, true);
  });

  it('13. Enforces 8-char mixed password policy & guarantees Sign Up -> Login credential match for Guest and Host', async () => {
    const uniq = Date.now().toString(36).toUpperCase();
    const weakPasswords = ['Ab1!xyz', 'OnlyLetters!', '12345678!', 'Letters1234'];
    for (const badPw of weakPasswords) {
      const badReg = await apiJson('/api/auth/register', {
        method: 'POST',
        body: { portal: 'guest', username: `WeakGuest_${uniq}`, password: badPw },
      });
      assert.equal(badReg.status, 400, `Weak password "${badPw}" must be rejected`);
    }

    const guestUsername = `GuestUser_${uniq}`;
    const guestPassword = `Gst@${uniq}9!`;
    const guestReg = await apiJson<{ user: any; token: string }>('/api/auth/register', {
      method: 'POST',
      body: { portal: 'guest', username: `  ${guestUsername}  `, password: guestPassword },
    });
    assert.equal(guestReg.status, 201);
    assert.equal(guestReg.data.user.role, 'guest');
    assert.equal(guestReg.data.user.username, guestUsername);

    const guestLoginExact = await apiJson<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: { portal: 'guest', username: guestUsername, password: guestPassword },
    });
    assert.equal(guestLoginExact.status, 200);
    assert.equal(guestLoginExact.data.user.id, guestReg.data.user.id);
    assert.ok(guestLoginExact.data.token);

    // Trailing/leading whitespace on username during login still matches cleanly
    const guestLoginTrimmed = await apiJson<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: { portal: 'guest', username: ` ${guestUsername} `, password: guestPassword },
    });
    assert.equal(guestLoginTrimmed.status, 200);
    assert.equal(guestLoginTrimmed.data.user.id, guestReg.data.user.id);

    const hostUsername = `HostUser_${uniq}`;
    const hostPassword = `Hst#${uniq}7$`;
    const hostReg = await apiJson<{ user: any; token: string }>('/api/auth/register', {
      method: 'POST',
      body: { portal: 'owner', username: hostUsername, password: hostPassword },
    });
    assert.equal(hostReg.status, 201);
    assert.equal(hostReg.data.user.role, 'owner');

    const hostLoginExact = await apiJson<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: { portal: 'owner', username: hostUsername, password: hostPassword },
    });
    assert.equal(hostLoginExact.status, 200);
    assert.equal(hostLoginExact.data.user.id, hostReg.data.user.id);
    assert.ok(hostLoginExact.data.token);

    // Wrong portal yields a clear portal-switch message
    const wrongPortal = await apiJson<{ error: string }>('/api/auth/login', {
      method: 'POST',
      body: { portal: 'guest', username: hostUsername, password: hostPassword },
    });
    assert.equal(wrongPortal.status, 401);
    assert.match(wrongPortal.data.error, /Login to Host/i);

    // Wrong password still rejects with 401
    const wrongPass = await apiJson('/api/auth/login', {
      method: 'POST',
      body: { portal: 'owner', username: hostUsername, password: `${hostPassword}_wrong` },
    });
    assert.equal(wrongPass.status, 401);
  });

  it('14. Trip Dating City Other canonicalization, Admin counts/approve/decline, feed top placement, v2 migration, & chunked video transcode + 206 Range streaming', async () => {
    // a) Admin Trip Dating authorization guards
    const unauthCounts = await apiJson('/api/admin/trip-dating/counts', { token: guestToken });
    assert.equal(unauthCounts.status, 403);
    const unauthSubs = await apiJson('/api/admin/trip-dating/submissions?status=PENDING_REVIEW', { token: guestToken });
    assert.equal(unauthSubs.status, 403);
    const unauthApprove = await apiJson('/api/admin/trip-dating/nonexistent/approve', { method: 'POST', token: guestToken });
    assert.equal(unauthApprove.status, 403);

    // b) Chunked video upload with real tiny MP4 + FFmpeg faststart transcode + 206 Range streaming
    const tmpMp4 = path.join('/tmp', `airbus_test_${Date.now()}.mp4`);
    execFileSync(
      'ffmpeg',
      ['-y', '-f', 'lavfi', '-i', 'color=c=navy:s=320x240:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', tmpMp4],
      { stdio: 'ignore' }
    );
    const mp4Buf = fs.readFileSync(tmpMp4);
    try { fs.unlinkSync(tmpMp4); } catch {}
    assert.ok(mp4Buf.length > 512, 'Generated test MP4 must be non-empty');

    const splitAt = Math.floor(mp4Buf.length / 2);
    const chunk0 = mp4Buf.subarray(0, splitAt);
    const chunk1 = mp4Buf.subarray(splitAt);

    const initRes = await apiJson<{ uploadId: string; kind: string }>('/api/uploads/media/init', {
      method: 'POST',
      token: guestToken,
      body: {
        filename: 'trip-preview.mp4',
        mime: 'video/mp4',
        totalBytes: mp4Buf.length,
        totalChunks: 2,
        kind: 'video',
      },
    });
    assert.equal(initRes.status, 201);
    const { uploadId } = initRes.data;

    for (const [idx, buf] of [[0, chunk0], [1, chunk1]] as Array<[number, Buffer]>) {
      const putRes = await fetch(`${baseUrl}/api/uploads/media/chunk/${uploadId}?index=${idx}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${guestToken}`,
          'Content-Type': 'application/octet-stream',
          'x-chunk-index': String(idx),
        },
        body: new Uint8Array(buf),
      });
      assert.equal(putRes.status, 200, `Chunk ${idx} upload must succeed`);
    }

    const completeRes = await apiJson<{ url: string; posterUrl?: string; mediaAsset?: any }>(
      `/api/uploads/media/complete/${uploadId}`,
      { method: 'POST', token: guestToken }
    );
    assert.equal(completeRes.status, 201);
    assert.ok(completeRes.data.url.startsWith('/uploads/'), `Expected /uploads URL, got ${completeRes.data.url}`);
    createdUploadFiles.push(completeRes.data.url);
    if (completeRes.data.posterUrl) createdUploadFiles.push(completeRes.data.posterUrl);
    assert.equal(completeRes.data.mediaAsset?.status, 'READY');
    assert.ok(
      completeRes.data.mediaAsset?.poster_url || completeRes.data.posterUrl,
      'Expected extracted video posterUrl'
    );

    // Verify HTTP 206 Partial Content Range streaming
    const rangeRes = await fetch(`${baseUrl}${completeRes.data.url}`, {
      headers: { Range: 'bytes=0-511' },
    });
    assert.equal(rangeRes.status, 206, 'Video Range request must return HTTP 206 Partial Content');
    assert.equal(rangeRes.headers.get('accept-ranges'), 'bytes');
    assert.match(rangeRes.headers.get('content-range') || '', /^bytes 0-511\/\d+$/);
    const rangedBytes = await rangeRes.arrayBuffer();
    assert.equal(rangedBytes.byteLength, 512);

    // c) Upload test photo & validate City "Other (type your city)"
    const tinyPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const photoUp = await apiJson<{ url: string }>('/api/uploads/media', {
      method: 'POST',
      token: guestToken,
      body: { dataUrl: tinyPngDataUrl, filename: 'td_other.png', kind: 'photo' },
    });
    assert.equal(photoUp.status, 201);
    createdUploadFiles.push(photoUp.data.url);

    const basePayload = {
      fullName: 'Zawadi M.',
      phoneNumber: '+254722889900',
      gender: 'female',
      age: 27,
      city: 'Other',
      description: 'Sunset dhow trips and coastal coffee spots.',
      lookingFor: 'Easygoing weekend traveler',
      datingIntention: 'dating_companionship',
      primaryPhoto: photoUp.data.url,
      full_body_photo: photoUp.data.url,
      photos: [photoUp.data.url],
      videoMediaId: completeRes.data.mediaAsset.id,
      videoUrl: completeRes.data.url,
      videoThumbnail: completeRes.data.posterUrl,
    };

    for (const badCustomCity of ['A', '<script>alert(1)</script>', 'Diani 123!', '']) {
      const badRes = await apiJson('/api/trip-dating/profiles', {
        method: 'POST',
        token: guestToken,
        body: { ...basePayload, city_custom: badCustomCity },
      });
      assert.equal(badRes.status, 400, `Invalid custom city "${badCustomCity}" must return 400`);
    }

    const clientSess = `td14_${Date.now()}`;
    const createSub1 = await apiJson<{ profile: any }>('/api/trip-dating/profiles', {
      method: 'POST',
      token: guestToken,
      headers: { 'x-client-session': clientSess },
      body: { ...basePayload, city_custom: '  Diani Beach  ' },
    });
    assert.equal(createSub1.status, 201);
    const sub1 = createSub1.data.profile;
    assert.equal(sub1.city, 'Diani Beach');
    assert.equal(sub1.city_custom, 'Diani Beach');
    assert.equal(sub1.moderationState, 'PENDING_REVIEW');

    // Second submission with lowercase spacing should reuse canonical "Diani Beach"
    const createSub2 = await apiJson<{ profile: any }>('/api/trip-dating/profiles', {
      method: 'POST',
      token: guestToken,
      headers: { 'x-client-session': clientSess },
      body: { ...basePayload, fullName: 'Tariq N.', gender: 'male', city_custom: '  diani beach ' },
    });
    assert.equal(createSub2.status, 201);
    const sub2 = createSub2.data.profile;
    assert.equal(sub2.city, 'Diani Beach');

    // d) Admin counts + pending visibility (never 0 while pending exists)
    const countsBefore = await apiJson<{ pending: number; approved: number; declined: number; total: number }>(
      '/api/admin/trip-dating/counts',
      { token: adminToken }
    );
    assert.equal(countsBefore.status, 200);
    assert.ok(countsBefore.data.pending >= 2, `Expected pending >= 2, got ${countsBefore.data.pending}`);

    const pendingPage = await apiJson<{ submissions: any[]; counts: any }>(
      '/api/admin/trip-dating/submissions?status=PENDING_REVIEW&page=1&limit=20',
      { token: adminToken }
    );
    assert.equal(pendingPage.status, 200);
    assert.ok(pendingPage.data.submissions.some(p => p.id === sub1.id));
    assert.ok(pendingPage.data.submissions.some(p => p.id === sub2.id));

    // e) Decline enforces 10–500 chars and excludes declined profile from public feed
    const shortDecline = await apiJson(`/api/admin/trip-dating/${sub2.id}/decline`, {
      method: 'POST',
      token: adminToken,
      body: { reason: 'Too short' },
    });
    assert.equal(shortDecline.status, 400);

    const validDecline = await apiJson<{ profile: any }>(`/api/admin/trip-dating/${sub2.id}/decline`, {
      method: 'POST',
      token: adminToken,
      body: { reason: 'Please add two clearer full-body photos before approval.' },
    });
    assert.equal(validDecline.status, 200);
    assert.equal(validDecline.data.profile.moderationState, 'DECLINED');
    assert.equal(validDecline.data.profile.decline_reason, 'Please add two clearer full-body photos before approval.');

    const feedBeforeApprove = await apiJson<{ profiles: any[] }>('/api/trip-dating/feed?limit=20');
    assert.equal(feedBeforeApprove.status, 200);
    assert.equal(feedBeforeApprove.data.profiles.some(p => p.id === sub2.id), false, 'Declined post must never reach feed');
    assert.equal(feedBeforeApprove.data.profiles.some(p => p.id === sub1.id), false, 'Pending post must never reach feed');

    // f) Approve -> idempotent, sets published_at, appears #1 at top of /api/trip-dating/feed, city in /cities
    const approve1 = await apiJson<{ profile: any; alreadyApproved?: boolean; counts: any }>(
      `/api/admin/trip-dating/${sub1.id}/approve`,
      { method: 'POST', token: adminToken }
    );
    assert.equal(approve1.status, 200);
    assert.equal(approve1.data.profile.moderationState, 'APPROVED');
    assert.ok(approve1.data.profile.published_at, 'published_at must be set on approval');

    const approveRepeat = await apiJson<{ profile: any; alreadyApproved?: boolean }>(
      `/api/admin/trip-dating/${sub1.id}/approve`,
      { method: 'POST', token: adminToken }
    );
    assert.equal(approveRepeat.status, 200);
    assert.equal(approveRepeat.data.alreadyApproved, true);

    const feedAfterApprove = await apiJson<{ profiles: any[] }>('/api/trip-dating/feed?limit=20');
    assert.equal(feedAfterApprove.status, 200);
    assert.equal(
      feedAfterApprove.data.profiles[0]?.id,
      sub1.id,
      'Newly approved Trip Dating submission must appear #1 at top of feed'
    );

    const citiesRes = await apiJson<{ cities: string[] }>('/api/trip-dating/cities');
    assert.equal(citiesRes.status, 200);
    assert.ok(citiesRes.data.cities.includes('Diani Beach'), 'Approved custom city must appear in /api/trip-dating/cities');

    // g) v2 migration rollback + idempotent re-run
    const v2RolledBack = db.rollbackMigration('v2_trip_dating_status_and_feed_sync');
    assert.equal(typeof v2RolledBack, 'boolean');
    db.runStartupMigrations();
    db.runStartupMigrations();
  });

  it('15. Prompt 2: Approved AirBus listings appear topmost on feed, check-live endpoint works, multi-collection join syncs & paginates without duplicates, and videoMediaId persists', async () => {
    const tinyPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const up = await apiJson<{ url: string }>('/api/uploads/media', {
      method: 'POST',
      token: hostToken,
      body: { dataUrl: tinyPngDataUrl, filename: 'p2_stay.png', kind: 'photo' },
    });
    assert.equal(up.status, 201);
    createdUploadFiles.push(up.data.url);

    // Upload real MP4 so videoMediaId & poster_url link end-to-end
    const tmpMp4 = path.join('/tmp', `airbus_p2_${Date.now()}.mp4`);
    execFileSync(
      'ffmpeg',
      ['-y', '-f', 'lavfi', '-i', 'color=c=teal:s=320x240:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', tmpMp4],
      { stdio: 'ignore' }
    );
    const mp4Buf = fs.readFileSync(tmpMp4);
    try { fs.unlinkSync(tmpMp4); } catch {}
    const initVid = await apiJson<{ uploadId: string }>('/api/uploads/media/init', {
      method: 'POST',
      token: hostToken,
      body: {
        filename: 'villa-tour.mp4',
        mime: 'video/mp4',
        totalBytes: mp4Buf.length,
        totalChunks: 1,
        kind: 'video',
      },
    });
    assert.equal(initVid.status, 201);
    const putChunk = await fetch(`${baseUrl}/api/uploads/media/chunk/${initVid.data.uploadId}?index=0`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${hostToken}`,
        'Content-Type': 'application/octet-stream',
        'x-chunk-index': '0',
      },
      body: new Uint8Array(mp4Buf),
    });
    assert.equal(putChunk.status, 200);
    const vidDone = await apiJson<{ url: string; posterUrl?: string; mediaAsset?: any }>(
      `/api/uploads/media/complete/${initVid.data.uploadId}`,
      { method: 'POST', token: hostToken }
    );
    assert.equal(vidDone.status, 201);
    createdUploadFiles.push(vidDone.data.url);
    if (vidDone.data.posterUrl) createdUploadFiles.push(vidDone.data.posterUrl);

    // Create two listings: stayA (no collections) and stayB (multiple collections + videoMediaId)
    const createA = await apiJson<{ stay: any }>('/api/stays', {
      method: 'POST',
      token: hostToken,
      body: {
        title: 'Standard Feed Stay Alpha',
        location: 'Kilimani, Nairobi',
        lat: -1.2921,
        lng: 36.783,
        price: 9000,
        images: [up.data.url],
        thumbnailUrl: up.data.url,
        collections: [],
      },
    });
    assert.equal(createA.status, 201);
    const stayA = createA.data.stay;

    const createB = await apiJson<{ stay: any }>('/api/stays', {
      method: 'POST',
      token: hostToken,
      body: {
        title: 'Multi-Collection Video Villa Beta',
        location: 'Nyali, Mombasa',
        lat: -4.0435,
        lng: 39.713,
        price: 18500,
        images: [up.data.url],
        thumbnailUrl: up.data.url,
        videoUrl: vidDone.data.url,
        videoMediaId: vidDone.data.mediaAsset.id,
        collections: ['work', 'escapes', 'local'],
        blackFridayOptIn: false,
      },
    });
    assert.equal(createB.status, 201);
    const stayB = createB.data.stay;
    assert.equal(stayB.videoMediaId, vidDone.data.mediaAsset.id);

    // Before approval: check-live returns inPublicFeed = false
    const checkPending = await apiJson<{ exists: boolean; inPublicFeed: boolean }>(
      `/api/stays/check-live/${stayA.id}`
    );
    assert.equal(checkPending.status, 200);
    assert.equal(checkPending.data.exists, true);
    assert.equal(checkPending.data.inPublicFeed, false);

    // Approve stayA first, then wait 5ms and approve stayB so stayB must rank #1 topmost
    const appA = await apiJson<{ stay: any }>(`/api/admin/review-queue/stays/${stayA.id}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'approve' },
    });
    assert.equal(appA.status, 200);
    assert.equal(appA.data.stay.status, 'live');
    assert.equal(appA.data.stay.publishState, 'PUBLISHED');
    assert.ok(appA.data.stay.published_at);
    assert.ok(appA.data.stay.approved_by);

    await new Promise(r => setTimeout(r, 10));

    const appB = await apiJson<{ stay: any }>(`/api/admin/review-queue/stays/${stayB.id}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'approve' },
    });
    assert.equal(appB.status, 200);
    assert.equal(appB.data.stay.status, 'live');
    assert.equal(appB.data.stay.publishState, 'PUBLISHED');
    assert.ok(appB.data.stay.published_at > appA.data.stay.published_at);

    // Public feed orders newest approved (stayB) #1 topmost ahead of stayA
    const publicFeed = await apiJson<{ stays: any[] }>('/api/stays?limit=20');
    assert.equal(publicFeed.status, 200);
    const idxB = publicFeed.data.stays.findIndex(s => s.id === stayB.id);
    const idxA = publicFeed.data.stays.findIndex(s => s.id === stayA.id);
    assert.equal(idxB, 0, 'Most recently approved listing must appear #1 topmost on public feed');
    assert.ok(idxA > idxB, 'Earlier approved stay must appear after newer approved stay');

    // /api/stays/check-live/:id confirms feedRank 1 for stayB
    const checkLiveB = await apiJson<{ inPublicFeed: boolean; feedRank: number; publishState: string }>(
      `/api/stays/check-live/${stayB.id}`
    );
    assert.equal(checkLiveB.status, 200);
    assert.equal(checkLiveB.data.inPublicFeed, true);
    assert.equal(checkLiveB.data.feedRank, 1);
    assert.equal(checkLiveB.data.publishState, 'PUBLISHED');

    // Multi-collection joins appear in each selected row deduplicated & absent from unselected rows
    for (const colSlug of ['work', 'escapes', 'local']) {
      const colRes = await apiJson<{ stays: any[]; collection: string }>(
        `/api/airbus/collections/${colSlug}/listings?limit=20`
      );
      assert.equal(colRes.status, 200);
      const matches = colRes.data.stays.filter(s => s.id === stayB.id);
      assert.equal(matches.length, 1, `stayB must appear exactly once in collection ${colSlug}`);
      assert.equal(
        colRes.data.stays.some(s => s.id === stayA.id),
        false,
        `stayA (no collections) must not appear in ${colSlug}`
      );
    }

    // Unlink 'local' from stayB via PATCH -> removed from 'local' row immediately
    const patchUnlink = await apiJson<{ stay: any }>(`/api/stays/${stayB.id}`, {
      method: 'PATCH',
      token: hostToken,
      body: { collections: ['work', 'escapes'] },
    });
    assert.equal(patchUnlink.status, 200);
    const localAfter = await apiJson<{ stays: any[] }>('/api/airbus/collections/local/listings?limit=20');
    assert.equal(localAfter.data.stays.some(s => s.id === stayB.id), false, 'Unlinked collection must no longer include stayB');
  });

  it('16. Prompt 2: Bookings enforce zero host booking fee (serviceFee === 0) & no escrow deduction', async () => {
    const publicFeed = await apiJson<{ stays: any[] }>('/api/stays?limit=5');
    const liveStay = publicFeed.data.stays[0];
    assert.ok(liveStay, 'Need at least one live stay for booking check');

    const checkInDate = new Date(Date.now() + 20 * 86400_000).toISOString().slice(0, 10);
    const checkOutDate = new Date(Date.now() + 22 * 86400_000).toISOString().slice(0, 10);

    const bookRes = await apiJson<{ booking: any }>('/api/bookings', {
      method: 'POST',
      token: guestToken,
      body: {
        stayId: liveStay.id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests: 2,
        paymentType: 'full',
      },
    });
    assert.equal(bookRes.status, 201);
    assert.equal(bookRes.data.booking.serviceFee, 0, 'Host booking fee / escrow serviceFee must be strictly 0');
    assert.equal(
      bookRes.data.booking.total,
      bookRes.data.booking.subtotal + bookRes.data.booking.cleaningFee,
      'Total must equal subtotal + cleaningFee with 0 serviceFee'
    );
  });

  it('17. Prompt 2: Admin Wallet ledger audit, EAT hourly/daily/monthly/yearly rollups, CSV export, Year-End archive & gated Special Refund', async () => {
    // Unauthorized access blocked
    const unauthSummary = await apiJson('/api/admin/wallet/summary', { token: guestToken });
    assert.equal(unauthSummary.status, 403);

    // 1. Submit & approve a deposit with unique M-Pesa code -> recorded in admin_wallet_entries
    const uniqCode = `MP${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const depRes = await apiJson<{ payment: any }>('/api/wallet/deposit', {
      method: 'POST',
      token: guestToken,
      body: { amount: 2500, mpesaCode: uniqCode, purpose: 'TRIP_DATING' },
    });
    assert.equal(depRes.status, 201);

    // Duplicate M-Pesa code rejected
    const dupDep = await apiJson('/api/wallet/deposit', {
      method: 'POST',
      token: guestToken,
      body: { amount: 2500, mpesaCode: uniqCode },
    });
    assert.equal(dupDep.status, 400);

    const appDep = await apiJson<{ payment: any }>(`/api/admin/payments/${depRes.data.payment.id}/approve`, {
      method: 'POST',
      token: adminToken,
      body: { confirmedAmount: 2500 },
    });
    assert.equal(appDep.status, 200);

    // 2. Verify Admin Wallet summary, EAT rollups, purpose breakdown, ledger search & CSV export
    const summaryBefore = await apiJson<any>('/api/admin/wallet/summary', { token: adminToken });
    assert.equal(summaryBefore.status, 200);
    assert.equal(Number.isInteger(summaryBefore.data.adminWalletBalance), true);
    const baselineMismatches = summaryBefore.data.reconciliation.mismatches;
    const adminRecBefore = db.getWalletReconciliation().wallets.find(w => w.email === 'admin@airbus.ke');
    assert.equal(adminRecBefore?.difference, 0, 'admin@airbus.ke stored vs ledger balance must match with 0 difference');

    const ledgerSearch = await apiJson<{ entries: any[]; total: number }>(
      `/api/admin/wallet/ledger?q=${encodeURIComponent(uniqCode)}`,
      { token: adminToken }
    );
    assert.equal(ledgerSearch.status, 200);
    assert.equal(ledgerSearch.data.entries.length, 1);
    const entry = ledgerSearch.data.entries[0];
    assert.equal(entry.paymentCode, uniqCode);
    assert.equal(entry.amount, 2500);
    assert.equal(entry.purpose, 'TRIP_DATING');
    assert.equal(entry.depositorRole, 'guest');
    assert.ok(entry.depositorName);
    assert.ok(entry.depositorId);
    assert.equal(entry.approvingAdmin, 'kamalahari93@gmail.com');

    for (const gran of ['hour', 'day', 'month', 'year']) {
      const totRes = await apiJson<{ granularity: string; timezone: string; periods: any[] }>(
        `/api/admin/wallet/totals?granularity=${gran}`,
        { token: adminToken }
      );
      assert.equal(totRes.status, 200);
      assert.equal(totRes.data.timezone, 'Africa/Nairobi');
      assert.ok(totRes.data.periods.length >= 1, `Expected EAT periods for ${gran}`);
    }

    const breakdownRes = await apiJson<{ timezone: string; breakdown: Record<string, any>; grandTotal: number }>(
      '/api/admin/wallet/breakdown',
      { token: adminToken }
    );
    assert.equal(breakdownRes.status, 200);
    assert.equal(breakdownRes.data.timezone, 'Africa/Nairobi');
    assert.ok(breakdownRes.data.grandTotal >= 2500);

    const csvFetch = await fetch(`${baseUrl}/api/admin/wallet/export?q=${encodeURIComponent(uniqCode)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(csvFetch.status, 200);
    const csvText = await csvFetch.text();
    assert.ok(csvText.includes('Timestamp (EAT)'));
    assert.ok(csvText.includes(uniqCode));

    // 3. Year-End EAT Fiscal Archive idempotency & checksum
    const priorYear = new Date().getUTCFullYear() - 1;
    const archRun1 = await apiJson<{ archive: any }>('/api/admin/wallet/archives/run', {
      method: 'POST',
      token: adminToken,
      body: { fiscalYear: priorYear },
    });
    assert.equal(archRun1.status, 200);
    assert.equal(archRun1.data.archive.fiscalYear, priorYear);
    assert.ok(archRun1.data.archive.checksum);

    const archRun2 = await apiJson<{ archive: any }>('/api/admin/wallet/archives/run', {
      method: 'POST',
      token: adminToken,
      body: { fiscalYear: priorYear },
    });
    assert.equal(archRun2.status, 200);
    assert.equal(archRun2.data.archive.id, archRun1.data.archive.id, 'Archive run must be idempotent per fiscal year');

    const archDetail = await apiJson<{ archive: any }>(`/api/admin/wallet/archives/${priorYear}`, {
      token: adminToken,
    });
    assert.equal(archDetail.status, 200);
    assert.equal(archDetail.data.archive.checksum, archRun1.data.archive.checksum);

    // 4. Special Refund validation & atomic execution (only <= excess, requires password & reason)
    const badPwRefund = await apiJson('/api/admin/wallet/special-refund', {
      method: 'POST',
      token: adminToken,
      body: {
        adminPassword: 'wrong_password',
        reason: 'Overpayment reversal requested',
        caseReference: 'CASE-001',
        originalPaymentCode: uniqCode,
        amount: 500,
      },
    });
    assert.equal(badPwRefund.status, 400);

    const excessFailRefund = await apiJson('/api/admin/wallet/special-refund', {
      method: 'POST',
      token: adminToken,
      body: {
        adminPassword: '2019xyz//',
        reason: 'Overpayment exceeding deposit amount',
        caseReference: 'CASE-002',
        originalPaymentCode: uniqCode,
        amount: 3000,
      },
    });
    assert.equal(excessFailRefund.status, 400);

    const validRefund = await apiJson<{ entry: any; adminBalance: number }>(
      '/api/admin/wallet/special-refund',
      {
        method: 'POST',
        token: adminToken,
        body: {
          adminPassword: '2019xyz//',
          reason: 'Guest sent KES 500 excess above intended deposit',
          caseReference: 'MPESA-254711000111',
          originalPaymentCode: uniqCode,
          amount: 500,
        },
      }
    );
    assert.equal(validRefund.status, 200);
    assert.equal(validRefund.data.entry.sourceKind, 'SPECIAL_REFUND');
    assert.equal(validRefund.data.entry.amount, -500);

    const summaryAfter = await apiJson<any>('/api/admin/wallet/summary', { token: adminToken });
    assert.equal(summaryAfter.data.adminWalletBalance, summaryBefore.data.adminWalletBalance - 500);
    assert.equal(summaryAfter.data.reconciliation.mismatches, baselineMismatches, 'Special Refund must introduce 0 reconciliation drift');
    const adminRecAfter = db.getWalletReconciliation().wallets.find(w => w.email === 'admin@airbus.ke');
    assert.equal(adminRecAfter?.difference, 0, 'admin@airbus.ke stored vs ledger balance must remain exactly 0 difference after Special Refund');

    // 5. v3 migration rollback + idempotent re-run
    const v3RolledBack = db.rollbackMigration('v3_airbus_listings_collections_and_admin_wallet');
    assert.equal(typeof v3RolledBack, 'boolean');
    db.runStartupMigrations();
    db.runStartupMigrations();
  });

  it('18. Host Deposit (M-Pesa) submission renders for Host & Admin with exact amount and code, and credits Host wallet on Admin approval', async () => {
    const beforeHostWallet = await apiJson<{ wallet: any; transactions: any[] }>('/api/wallet', {
      token: hostToken,
    });
    assert.equal(beforeHostWallet.status, 200);
    const startingBalance = Number(beforeHostWallet.data.wallet.balance || 0);

    const hostCode = `HST${Date.now().toString(36).toUpperCase().slice(-7)}`;
    const depositAmount = 3750;

    // 1. Host submits Deposit (M-Pesa) via /api/wallet/topup
    const topupRes = await apiJson<{ payment: any; message: string }>('/api/wallet/topup', {
      method: 'POST',
      token: hostToken,
      body: { amount: depositAmount, mpesaCode: hostCode },
    });
    assert.equal(topupRes.status, 201);
    assert.equal(topupRes.data.payment.status, 'pending');
    assert.equal(topupRes.data.payment.claimedAmount, depositAmount);
    assert.equal(topupRes.data.payment.amountKes, depositAmount);
    assert.equal(topupRes.data.payment.mpesaCode, hostCode);
    assert.equal(topupRes.data.payment.userRole, 'owner');

    // 2. Host immediately sees the pending deposit with code and amount in GET /api/wallet
    const hostWalletPending = await apiJson<{ wallet: any; transactions: any[] }>('/api/wallet', {
      token: hostToken,
    });
    assert.equal(hostWalletPending.status, 200);
    const hostTxPending = hostWalletPending.data.transactions.find(
      t => t.id === topupRes.data.payment.id || t.mpesaCode === hostCode
    );
    assert.ok(hostTxPending, 'Host wallet transactions must immediately render the submitted pending deposit');
    assert.equal(hostTxPending.amount, depositAmount);
    assert.equal(hostTxPending.mpesaCode, hostCode);
    assert.equal(hostTxPending.status, 'pending');

    // 3. Admin sees the submitted Host deposit in /api/payments, /api/admin/overview, and /api/admin/wallets
    const [adminPayments, adminOverview, adminWallets] = await Promise.all([
      apiJson<{ payments: any[] }>('/api/payments', { token: adminToken }),
      apiJson<{ payments: any[] }>('/api/admin/overview', { token: adminToken }),
      apiJson<{ hostDeposits: any[] }>('/api/admin/wallets', { token: adminToken }),
    ]);

    assert.equal(adminPayments.status, 200);
    const inPayments = adminPayments.data.payments.find(p => p.id === topupRes.data.payment.id);
    assert.ok(inPayments, 'Admin /api/payments must include the Host deposit');
    assert.equal(inPayments.mpesaCode, hostCode);
    assert.equal(inPayments.claimedAmount, depositAmount);
    assert.equal(inPayments.userRole, 'owner');
    assert.equal(inPayments.status, 'pending');

    assert.equal(adminOverview.status, 200);
    const inOverview = adminOverview.data.payments.find(p => p.id === topupRes.data.payment.id);
    assert.ok(inOverview, 'Admin /api/admin/overview must include the Host deposit');
    assert.equal(inOverview.mpesaCode, hostCode);

    assert.equal(adminWallets.status, 200);
    const inHostDeposits = adminWallets.data.hostDeposits.find(p => p.id === topupRes.data.payment.id);
    assert.ok(inHostDeposits, 'Admin /api/admin/wallets hostDeposits must include the Host deposit');
    assert.equal(inHostDeposits.mpesaCode, hostCode);
    assert.equal(inHostDeposits.claimedAmount, depositAmount);
    assert.equal(inHostDeposits.status, 'pending');

    // 4. Admin approves Host deposit -> Host wallet increases by exact integer depositAmount
    const approveRes = await apiJson<{ payment: any }>(
      `/api/admin/payments/${topupRes.data.payment.id}/approve`,
      {
        method: 'POST',
        token: adminToken,
        body: {},
      }
    );
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.payment.status, 'approved');
    assert.equal(approveRes.data.payment.approvedAmount, depositAmount);

    const afterHostWallet = await apiJson<{ wallet: any; transactions: any[] }>('/api/wallet', {
      token: hostToken,
    });
    assert.equal(afterHostWallet.status, 200);
    assert.equal(
      afterHostWallet.data.wallet.balance,
      startingBalance + depositAmount,
      'Host wallet balance must increase by exact approved deposit amount'
    );
    const hostTxApproved = afterHostWallet.data.transactions.find(
      t => t.id === topupRes.data.payment.id
    );
    assert.equal(hostTxApproved?.status, 'approved');
  });

  it('19. Admin endpoints return 401 UNAUTHENTICATED for missing/invalid sessions and 403 for non-admin sessions', async () => {
    const [noTokQueue, badTokCounts, guestQueue, guestCounts] = await Promise.all([
      apiJson<{ code?: string }>('/api/admin/review-queue'),
      apiJson<{ code?: string }>('/api/admin/trip-dating/counts', { token: 'stale_invalid_admin_token_xyz' }),
      apiJson<{ error?: string }>('/api/admin/review-queue', { token: guestToken }),
      apiJson<{ error?: string }>('/api/admin/trip-dating/counts', { token: guestToken }),
    ]);

    assert.equal(noTokQueue.status, 401);
    assert.equal(noTokQueue.data.code, 'UNAUTHENTICATED');

    assert.equal(badTokCounts.status, 401);
    assert.equal(badTokCounts.data.code, 'UNAUTHENTICATED');

    assert.equal(guestQueue.status, 403);
    assert.equal(guestCounts.status, 403);
  });

  it('20. Real-time SSE wallet/payment stream pushes pending deposits to Admin and auto-credits Host & Admin wallets on approval', async () => {
    const readSseUntil = async (
      streamUrl: string,
      predicate: (events: Array<{ event: string; data: any }>) => boolean,
      triggerFn: () => Promise<void>,
      timeoutMs = 5000
    ) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(streamUrl, { signal: controller.signal });
      assert.equal(res.status, 200);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const collected: Array<{ event: string; data: any }> = [];

      await triggerFn();

      try {
        while (!predicate(collected)) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() || '';
          for (const frame of frames) {
            if (!frame.trim() || frame.startsWith(':')) continue;
            let evtName = 'message';
            let dataStr = '';
            for (const line of frame.split('\n')) {
              if (line.startsWith('event:')) evtName = line.slice(6).trim();
              else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
            }
            if (dataStr) {
              try {
                collected.push({ event: evtName, data: JSON.parse(dataStr) });
              } catch {
                collected.push({ event: evtName, data: dataStr });
              }
            }
          }
        }
      } finally {
        clearTimeout(timer);
        controller.abort();
        try {
          await reader.cancel();
        } catch {}
      }
      return collected;
    };

    const beforeHost = await apiJson<{ wallet: any }>('/api/wallet', { token: hostToken });
    const beforeAdminSummary = await apiJson<{
      adminWalletBalance: number;
      yearToDate: { approvedDeposits: number; totalCredits: number };
    }>('/api/admin/wallet/summary', {
      token: adminToken,
    });
    const hostStartBal = Number(beforeHost.data.wallet.balance || 0);
    const adminStartBal = Number(beforeAdminSummary.data.adminWalletBalance || 0);
    const adminStartApprovedDeposits = Number(beforeAdminSummary.data.yearToDate?.approvedDeposits || 0);

    const rtAmount = 4200;
    const rtCode = `RT${Date.now().toString(36).toUpperCase().slice(-8)}`;
    let createdPaymentId = '';

    // Open Admin SSE stream and trigger Host M-Pesa deposit submission
    const adminEvents = await readSseUntil(
      `${baseUrl}/api/wallet/stream?token=${encodeURIComponent(adminToken)}`,
      evts => evts.some(e => e.event === 'payment_update' && e.data?.eventType === 'payment_created' && e.data?.payment?.mpesaCode === rtCode),
      async () => {
        const res = await apiJson<{ payment: any }>('/api/wallet/topup', {
          method: 'POST',
          token: hostToken,
          body: { amount: rtAmount, mpesaCode: rtCode },
        });
        assert.equal(res.status, 201);
        assert.equal(res.data.payment.status, 'pending');
        createdPaymentId = res.data.payment.id;
      }
    );
    assert.ok(
      adminEvents.some(e => e.event === 'payment_update' && e.data?.eventType === 'payment_created' && e.data?.payment?.claimedAmount === rtAmount),
      'Admin SSE must receive payment_created event with exact amount and code'
    );

    // Open Host SSE stream and trigger Admin approval
    let approvePayload: any = null;
    const hostEvents = await readSseUntil(
      `${baseUrl}/api/wallet/stream?token=${encodeURIComponent(hostToken)}`,
      evts =>
        evts.some(e => e.event === 'wallet_update' && e.data?.paymentId === createdPaymentId) &&
        evts.some(e => e.event === 'payment_update' && e.data?.eventType === 'payment_approved' && e.data?.payment?.id === createdPaymentId),
      async () => {
        const approveRes = await apiJson<{ payment: any; userWalletBalance?: number; adminWalletBalance?: number }>(
          `/api/admin/payments/${createdPaymentId}/approve`,
          { method: 'POST', token: adminToken, body: {} }
        );
        assert.equal(approveRes.status, 200);
        approvePayload = approveRes.data;
      }
    );

    assert.equal(approvePayload?.payment?.status, 'approved');
    assert.equal(approvePayload?.userWalletBalance, hostStartBal + rtAmount);
    assert.equal(approvePayload?.adminWalletBalance, adminStartBal);

    const afterAdminSummary = await apiJson<{
      adminWalletBalance: number;
      yearToDate: { approvedDeposits: number; totalCredits: number };
    }>('/api/admin/wallet/summary', {
      token: adminToken,
    });
    assert.equal(afterAdminSummary.status, 200);
    assert.equal(
      afterAdminSummary.data.yearToDate.approvedDeposits,
      adminStartApprovedDeposits + rtAmount,
      'Admin Wallet YTD Approved Deposits ledger must increase by exact deposit amount'
    );

    const hostWalletEvt = hostEvents.find(e => e.event === 'wallet_update' && e.data?.paymentId === createdPaymentId);
    assert.equal(hostWalletEvt?.data?.balance, hostStartBal + rtAmount);
    assert.equal(hostWalletEvt?.data?.approvedAmount, rtAmount);
    assert.equal(hostWalletEvt?.data?.mpesaCode, rtCode);

    const hostPayEvt = hostEvents.find(
      e => e.event === 'payment_update' && e.data?.eventType === 'payment_approved' && e.data?.payment?.id === createdPaymentId
    );
    assert.equal(hostPayEvt?.data?.userWalletBalance, hostStartBal + rtAmount);
  });

  it('21. Unified Merchant Deposit -> Admin Payments Queue -> Approve/Decline/Gated Refund -> Notice Ack -> Idempotency & 403/401 Auth Guards', async () => {
    // 1. Server-side authorization: unauthenticated -> 401; guest & host -> 403 on all /api/admin/payments* endpoints
    const adminEndpoints: Array<{ url: string; method?: string; body?: any }> = [
      { url: '/api/admin/payments' },
      { url: '/api/admin/payments/counts' },
      { url: '/api/admin/payments/audit' },
      { url: '/api/admin/payments/audit/export' },
      { url: '/api/admin/payments/reconciliation' },
      { url: '/api/admin/payments/reconciliation/repair', method: 'POST' },
      { url: '/api/admin/payments/fake_id/approve', method: 'POST', body: {} },
      { url: '/api/admin/payments/fake_id/decline', method: 'POST', body: { reason: 'Testing guard access check' } },
      { url: '/api/admin/payments/fake_id/refund', method: 'POST', body: { adminPassword: 'x', amount: 100, reason: 'Testing guard' } },
    ];

    for (const ep of adminEndpoints) {
      const unauth = await apiJson(ep.url, { method: ep.method || 'GET', body: ep.body });
      assert.equal(unauth.status, 401, `${ep.method || 'GET'} ${ep.url} must return 401 without token`);
      const asGuest = await apiJson(ep.url, { method: ep.method || 'GET', token: guestToken, body: ep.body });
      assert.equal(asGuest.status, 403, `${ep.method || 'GET'} ${ep.url} must return 403 for guest`);
      const asHost = await apiJson(ep.url, { method: ep.method || 'GET', token: hostToken, body: ep.body });
      assert.equal(asHost.status, 403, `${ep.method || 'GET'} ${ep.url} must return 403 for merchant/owner`);
    }

    // 2. Merchant deposit validation errors
    const badPhone = await apiJson('/api/merchant/deposits', {
      method: 'POST',
      token: hostToken,
      body: { amountKes: 500, mpesaCode: 'MPVALID01', phone: '12345', purpose: 'AIRBUS_WALLET_TOPUP' },
    });
    assert.equal(badPhone.status, 400, 'Invalid Kenyan phone must return 400');

    const badDecimal = await apiJson('/api/merchant/deposits', {
      method: 'POST',
      token: hostToken,
      body: { amountKes: 500.75, mpesaCode: 'MPVALID02', phone: '0712345678', purpose: 'AIRBUS_WALLET_TOPUP' },
    });
    assert.equal(badDecimal.status, 400, 'Non-integer KES amount must return 400');

    const badLow = await apiJson('/api/merchant/deposits', {
      method: 'POST',
      token: hostToken,
      body: { amountKes: 5, mpesaCode: 'MPVALID03', phone: '0712345678', purpose: 'AIRBUS_WALLET_TOPUP' },
    });
    assert.equal(badLow.status, 400, 'Below minimum KES amount must return 400');

    // 3. Submit merchant deposit with Idempotency-Key -> single record, normalized +254 phone, canonical PENDING
    const hostWalletBefore = await apiJson<{ wallet: any }>('/api/wallet', { token: hostToken });
    const startHostBal = Number(hostWalletBefore.data.wallet.balance || 0);
    const countsBefore = await apiJson<{ pending: number; approved: number; declined: number; refunded: number; total: number }>(
      '/api/admin/payments/counts',
      { token: adminToken }
    );
    assert.equal(countsBefore.status, 200);

    const depCode1 = `MER${Date.now().toString(36).toUpperCase().slice(-7)}`;
    const depIdemKey = `dep_idem_${Date.now()}`;
    const submit1 = await apiJson<{ payment: any; message: string }>('/api/merchant/deposits', {
      method: 'POST',
      token: hostToken,
      headers: { 'Idempotency-Key': depIdemKey },
      body: {
        amountKes: 2800,
        mpesaCode: depCode1,
        phone: '0712345678',
        purpose: 'WALLET_TOPUP',
      },
    });
    assert.equal(submit1.status, 201);
    assert.equal(submit1.data.payment.canonicalStatus, 'PENDING');
    assert.equal(submit1.data.payment.status, 'pending');
    assert.equal(submit1.data.payment.phone, '+254712345678');
    assert.equal(submit1.data.payment.purpose, 'WALLET_TOPUP');
    assert.equal(submit1.data.payment.walletPurpose, 'OTHER');
    const payId1 = submit1.data.payment.id;

    // Duplicate retry with identical Idempotency-Key returns same payment without inserting a duplicate
    const submit1Retry = await apiJson<{ payment: any }>('/api/merchant/deposits', {
      method: 'POST',
      token: hostToken,
      headers: { 'Idempotency-Key': depIdemKey },
      body: {
        amountKes: 2800,
        mpesaCode: depCode1,
        phone: '0712345678',
        purpose: 'WALLET_TOPUP',
      },
    });
    assert.equal(submit1Retry.status, 200);
    assert.equal(submit1Retry.data.payment.id, payId1, 'Idempotent retry must return original payment');

    // Duplicate code with different idempotency key must reject
    const dupCodeRes = await apiJson('/api/merchant/deposits', {
      method: 'POST',
      token: hostToken,
      body: {
        amountKes: 2800,
        mpesaCode: depCode1,
        phone: '0712345678',
        purpose: 'AIRBUS_WALLET_TOPUP',
      },
    });
    assert.equal(dupCodeRes.status, 400, 'Duplicate M-Pesa code must be rejected');

    // 4. Immediately visible in Admin Queue (/api/admin/payments?status=PENDING), /counts, /api/payments, & /api/admin/wallets
    const [pendingQueue, countsAfterSubmit, legacyPayments, adminWallets] = await Promise.all([
      apiJson<{ payments: any[]; counts: any; totalCount: number }>(`/api/admin/payments?status=PENDING&search=${depCode1}`, {
        token: adminToken,
      }),
      apiJson<{ pending: number }>('/api/admin/payments/counts', { token: adminToken }),
      apiJson<{ payments: any[]; counts: any }>('/api/payments', { token: adminToken }),
      apiJson<{ hostDeposits: any[] }>('/api/admin/wallets', { token: adminToken }),
    ]);

    assert.equal(pendingQueue.status, 200);
    assert.equal(pendingQueue.data.payments.length, 1, 'Submitted deposit must appear once in Admin Pending queue');
    assert.equal(pendingQueue.data.payments[0].id, payId1);
    assert.equal(pendingQueue.data.payments[0].phone, '+254712345678');
    assert.equal(countsAfterSubmit.data.pending, countsBefore.data.pending + 1);
    assert.ok(legacyPayments.data.payments.some(p => p.id === payId1));
    assert.ok(adminWallets.data.hostDeposits.some(p => p.id === payId1));

    // Pending payment cannot be refunded (must use Decline)
    const refundPendingAttempt = await apiJson(`/api/admin/payments/${payId1}/refund`, {
      method: 'POST',
      token: adminToken,
      body: { adminPassword: '2019xyz//', amount: 500, reason: 'Cannot refund pending row' },
    });
    assert.equal(refundPendingAttempt.status, 400);

    // 5. Admin Approve & Activate (with idempotent double-click test) -> credits wallet once, writes ledger, creates unacked notice
    const approveIdemKey = `app_idem_${Date.now()}`;
    const app1 = await apiJson<{ payment: any; userWalletBalance: number; counts: any }>(
      `/api/admin/payments/${payId1}/approve`,
      {
        method: 'POST',
        token: adminToken,
        headers: { 'Idempotency-Key': approveIdemKey },
        body: {},
      }
    );
    assert.equal(app1.status, 200);
    assert.equal(app1.data.payment.canonicalStatus, 'APPROVED');
    assert.ok(app1.data.payment.creditLedgerId, 'Approved deposit must record creditLedgerId');
    assert.equal(app1.data.userWalletBalance, startHostBal + 2800);

    // Repeat approve (both with same key and without key) must NOT double-credit
    const appRepeatKey = await apiJson<{ userWalletBalance: number }>(
      `/api/admin/payments/${payId1}/approve`,
      { method: 'POST', token: adminToken, headers: { 'Idempotency-Key': approveIdemKey }, body: {} }
    );
    const appRepeatNoKey = await apiJson<{ userWalletBalance: number }>(
      `/api/admin/payments/${payId1}/approve`,
      { method: 'POST', token: adminToken, body: {} }
    );
    assert.equal(appRepeatKey.status, 200);
    assert.equal(appRepeatNoKey.status, 200);
    assert.equal(appRepeatNoKey.data.userWalletBalance, startHostBal + 2800, 'Repeated approve must never double-credit');

    // Merchant sees approved deposit in GET /api/merchant/deposits & unackedNotices until acked
    const merchDeps1 = await apiJson<{ deposits: any[]; unackedNotices: any[]; walletBalance: number }>(
      '/api/merchant/deposits',
      { token: hostToken }
    );
    assert.equal(merchDeps1.status, 200);
    assert.equal(merchDeps1.data.walletBalance, startHostBal + 2800);
    assert.ok(merchDeps1.data.unackedNotices.some(n => n.id === payId1 && n.merchantNoticeEvent === 'APPROVED'));

    const ackApp = await apiJson<{ payment: any }>(`/api/merchant/deposits/${payId1}/ack`, {
      method: 'POST',
      token: hostToken,
    });
    assert.equal(ackApp.status, 200);
    assert.ok(ackApp.data.payment.merchantNoticeAckedAt);

    const merchDepsAfterAck = await apiJson<{ unackedNotices: any[] }>('/api/merchant/deposits', { token: hostToken });
    assert.equal(merchDepsAfterAck.data.unackedNotices.some(n => n.id === payId1), false);

    // 6. Gated Refund on APPROVED deposit
    const wrongPw = await apiJson(`/api/admin/payments/${payId1}/refund`, {
      method: 'POST',
      token: adminToken,
      body: { adminPassword: 'bad-password', amount: 800, reason: 'Incorrect password test case' },
    });
    assert.equal(wrongPw.status, 400);

    const overRefund = await apiJson(`/api/admin/payments/${payId1}/refund`, {
      method: 'POST',
      token: adminToken,
      body: { adminPassword: '2019xyz//', amount: 999999, reason: 'Excessive refund amount test' },
    });
    assert.equal(overRefund.status, 400);

    const validRefund = await apiJson<{ payment: any; userWalletBalance: number; refundLedgerId: string; counts: any }>(
      `/api/admin/payments/${payId1}/refund`,
      {
        method: 'POST',
        token: adminToken,
        body: { adminPassword: '2019xyz//', amount: 800, reason: 'Partial reversal of duplicate merchant payment' },
      }
    );
    assert.equal(validRefund.status, 200);
    assert.equal(validRefund.data.payment.canonicalStatus, 'REFUNDED');
    assert.equal(validRefund.data.userWalletBalance, startHostBal + 2000);
    assert.ok(validRefund.data.refundLedgerId);

    // Ack refund notice
    const merchAfterRefund = await apiJson<{ unackedNotices: any[] }>('/api/merchant/deposits', { token: hostToken });
    assert.ok(merchAfterRefund.data.unackedNotices.some(n => n.id === payId1 && n.merchantNoticeEvent === 'REFUNDED'));
    await apiJson(`/api/merchant/deposits/${payId1}/ack`, { method: 'POST', token: hostToken });

    // 7. Submit second deposit & Admin Decline (enforces 10-500 char reason, HTML stripped, no wallet mutation)
    const depCode2 = `DEC${Date.now().toString(36).toUpperCase().slice(-7)}`;
    const submit2 = await apiJson<{ payment: any }>('/api/merchant/deposits', {
      method: 'POST',
      token: hostToken,
      body: {
        amountKes: 1500,
        mpesaCode: depCode2,
        phone: '+254722111222',
        purpose: 'SUBSCRIPTION',
      },
    });
    assert.equal(submit2.status, 201);
    const payId2 = submit2.data.payment.id;

    const shortDecline = await apiJson(`/api/admin/payments/${payId2}/decline`, {
      method: 'POST',
      token: adminToken,
      body: { reason: 'Too short' },
    });
    assert.equal(shortDecline.status, 400);

    const validDecline = await apiJson<{ payment: any; counts: any }>(`/api/admin/payments/${payId2}/decline`, {
      method: 'POST',
      token: adminToken,
      body: { reason: '<b>M-Pesa confirmation code</b> not found in Till statement.' },
    });
    assert.equal(validDecline.status, 200);
    assert.equal(validDecline.data.payment.canonicalStatus, 'DECLINED');
    assert.equal(
      validDecline.data.payment.declineReason,
      'M-Pesa confirmation code not found in Till statement.',
      'Decline reason must strip HTML tags'
    );

    const walletAfterDecline = await apiJson<{ wallet: any }>('/api/wallet', { token: hostToken });
    assert.equal(walletAfterDecline.data.wallet.balance, startHostBal + 2000, 'Declining deposit must not alter balance');

    const merchAfterDecline = await apiJson<{ deposits: any[]; unackedNotices: any[] }>('/api/merchant/deposits', {
      token: hostToken,
    });
    const declinedRow = merchAfterDecline.data.deposits.find(d => d.id === payId2);
    assert.equal(declinedRow?.canonicalStatus, 'DECLINED');
    assert.ok(merchAfterDecline.data.unackedNotices.some(n => n.id === payId2 && n.merchantNoticeEvent === 'DECLINED'));
  });

  it('22. Payments & Ledger Audit CSV Export, Anomaly Reconciliation Repair, Outbox Exponential Backoff Retry, and Reversible v4 Migration', async () => {
    // 1. Submit & approve a deposit so audit & CSV definitely contain a recent deposit entry
    const code = `AUD${Date.now().toString(36).toUpperCase().slice(-7)}`;
    const dep = await apiJson<{ payment: any }>('/api/merchant/deposits', {
      method: 'POST',
      token: hostToken,
      body: { amountKes: 1200, mpesaCode: code, phone: '0733445566', purpose: 'AIRBUS_WALLET_TOPUP' },
    });
    assert.equal(dep.status, 201);
    const payId = dep.data.payment.id;

    const appRes = await apiJson<{ payment: any }>(`/api/admin/payments/${payId}/approve`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    assert.equal(appRes.status, 200);
    const creditLedgerId = appRes.data.payment.creditLedgerId as string;
    assert.ok(creditLedgerId);

    // 2. Payments & Ledger Audit query + CSV export
    const auditRes = await apiJson<{ entries: any[]; total: number; reconciliation: any }>(
      `/api/admin/payments/audit?q=${encodeURIComponent(code)}`,
      { token: adminToken }
    );
    assert.equal(auditRes.status, 200);
    assert.ok(auditRes.data.entries.some(e => e.paymentCode === code && e.amount === 1200));

    const csvRes = await fetch(`${baseUrl}/api/admin/payments/audit/export?q=${encodeURIComponent(code)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(csvRes.status, 200);
    const csvText = await csvRes.text();
    assert.ok(csvText.includes('Timestamp (UTC)'));
    assert.ok(csvText.includes('Timestamp (Africa/Nairobi EAT)'));
    assert.ok(csvText.includes(code));

    // 3. Reconciliation detects missing ledger link & repair restores totalAnomalies === 0
    const rawData = (db as any).data;
    const ledgerIdx = rawData.ledgerEntries.findIndex((l: any) => l.id === creditLedgerId);
    assert.ok(ledgerIdx >= 0, 'Credit ledger entry must exist before simulated anomaly');
    rawData.ledgerEntries.splice(ledgerIdx, 1);

    const recBroken = await apiJson<{ missingDepositLedgerCount: number; missingDepositLedgerPaymentIds: string[]; totalAnomalies: number }>(
      '/api/admin/payments/reconciliation',
      { token: adminToken }
    );
    assert.equal(recBroken.status, 200);
    assert.ok(recBroken.data.missingDepositLedgerCount >= 1);
    assert.ok(recBroken.data.missingDepositLedgerPaymentIds.includes(payId));
    assert.ok(recBroken.data.totalAnomalies >= 1);

    const recRepair = await apiJson<{ repairedCount: number; after: { totalAnomalies: number; missingDepositLedgerCount: number } }>(
      '/api/admin/payments/reconciliation/repair',
      { method: 'POST', token: adminToken }
    );
    assert.equal(recRepair.status, 200);
    assert.ok(recRepair.data.repairedCount >= 1);
    assert.equal(recRepair.data.after.missingDepositLedgerCount, 0);
    assert.equal(recRepair.data.after.totalAnomalies, 0);

    // 4. Transactional Outbox retry with failure + exponential backoff recovery
    try {
      db.enqueuePaymentOutboxEvent('payment.approved', payId, { testRetry: true });
      let failOnce = true;
      db.setOutboxDeliveryHookForTest((_kind, targetPayId) => {
        if (targetPayId === payId && failOnce) {
          failOnce = false;
          throw new Error('Simulated transient webhook timeout');
        }
      });

      const run1 = db.processTransactionalOutbox(Date.now());
      assert.ok(run1.failed >= 1, 'First outbox pass must record transient failure');
      const failedRow = (rawData.transactional_outbox || []).find(
        (o: any) => o.paymentId === payId && o.status === 'failed'
      );
      assert.ok(failedRow, 'Failed outbox item must persist backoff metadata');
      assert.equal(failedRow.attempts, 1);

      const run2 = db.processTransactionalOutbox(Date.now() + 120_000);
      assert.ok(run2.delivered >= 1, 'Second outbox pass after backoff must deliver cleanly');
    } finally {
      db.setOutboxDeliveryHookForTest(null);
    }

    // 5. Reversible v4 migration rollback + idempotent re-run
    const v4RolledBack = db.rollbackMigration('v4_unified_payments_outbox_and_audit');
    assert.equal(typeof v4RolledBack, 'boolean');
    db.runStartupMigrations();
    db.runStartupMigrations();
  });

  it('23. Restore Admin to Factory Settings (401/403 guards, password re-auth, admin_only & full_factory restore, and reversible v5 migration)', async () => {
    // 1. Auth guards on /api/admin/factory-reset
    const noAuth = await apiJson('/api/admin/factory-reset', {
      method: 'POST',
      body: { adminPassword: '2019xyz//', scope: 'admin_only' },
    });
    assert.equal(noAuth.status, 401);

    const asGuest = await apiJson('/api/admin/factory-reset', {
      method: 'POST',
      token: guestToken,
      body: { adminPassword: '2019xyz//', scope: 'admin_only' },
    });
    assert.equal(asGuest.status, 403);

    const asHost = await apiJson('/api/admin/factory-reset', {
      method: 'POST',
      token: hostToken,
      body: { adminPassword: '2019xyz//', scope: 'admin_only' },
    });
    assert.equal(asHost.status, 403);

    // 2. Wrong password rejected with 400
    const badPw = await apiJson('/api/admin/factory-reset', {
      method: 'POST',
      token: adminToken,
      body: { adminPassword: 'wrong-password', scope: 'admin_only' },
    });
    assert.equal(badPw.status, 400);

    // 3. Mutate admin credentials + platform settings, then restore via scope='admin_only'
    const credChange = await apiJson<{ token: string; user: any }>('/api/admin/change-credentials', {
      method: 'POST',
      token: adminToken,
      body: {
        currentPassword: '2019xyz//',
        newName: 'Modified Temp Admin',
        newPassword: 'TempReset#2026!',
      },
    });
    assert.equal(credChange.status, 200);
    let currentAdminToken = credChange.data.token;

    const settingsUpdate = await apiJson<{ settings: any }>('/api/settings', {
      method: 'PATCH',
      token: currentAdminToken,
      body: { adPricePerDay: 999, referralCommissionPercent: 25 },
    });
    assert.equal(settingsUpdate.status, 200);
    assert.equal(settingsUpdate.data.settings.adPricePerDay, 999);

    const adminOnlyReset = await apiJson<{
      user: any;
      token: string;
      settings: any;
      adminWalletBalance: number;
      reconciliation: { totalAnomalies: number };
    }>('/api/admin/factory-reset', {
      method: 'POST',
      token: currentAdminToken,
      body: { adminPassword: 'TempReset#2026!', scope: 'admin_only' },
    });
    assert.equal(adminOnlyReset.status, 200);
    assert.equal(adminOnlyReset.data.user.name, 'Kamala Hari');
    assert.equal(adminOnlyReset.data.user.email, 'kamalahari93@gmail.com');
    assert.equal(adminOnlyReset.data.settings.adPricePerDay, 100);
    assert.equal(adminOnlyReset.data.settings.referralCommissionPercent, 10);
    assert.equal(adminOnlyReset.data.adminWalletBalance, 2800);
    assert.equal(adminOnlyReset.data.reconciliation.totalAnomalies, 0);
    assert.ok(adminOnlyReset.data.token);
    currentAdminToken = adminOnlyReset.data.token;

    // Original factory password '2019xyz//' must work again for admin login
    const relogin = await apiJson<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: { email: 'kamalahari93@gmail.com', password: '2019xyz//' },
    });
    assert.equal(relogin.status, 200);
    assert.equal(relogin.data.user.role, 'admin');
    currentAdminToken = relogin.data.token;

    // 4. Full factory reset restores clean seeded payments, wallets, and 0 reconciliation anomalies
    const fullReset = await apiJson<{
      user: any;
      token: string;
      adminWalletBalance: number;
      counts: { pending: number; approved: number; total: number };
      reconciliation: { totalAnomalies: number; mismatches: number };
    }>('/api/admin/factory-reset', {
      method: 'POST',
      token: currentAdminToken,
      body: { adminPassword: '2019xyz//', scope: 'full_factory' },
    });
    assert.equal(fullReset.status, 200);
    assert.equal(fullReset.data.adminWalletBalance, 2800);
    assert.equal(fullReset.data.counts.pending, 0);
    assert.equal(fullReset.data.reconciliation.mismatches, 0);
    assert.equal(fullReset.data.reconciliation.totalAnomalies, 0);
    adminToken = fullReset.data.token;

    // 5. Reversible v5 migration rollback + idempotent re-run
    const v5RolledBack = db.rollbackMigration('v5_restore_admin_factory_status');
    assert.equal(typeof v5RolledBack, 'boolean');
    db.runStartupMigrations();
    db.runStartupMigrations();
  });

  it('24. Task 1: Signup hashes passwords with bcrypt, trimmed case-insensitive username/email login works, and legacy SHA-256 credentials migrate safely', async () => {
    const uniq = Date.now().toString(36).toUpperCase();
    const guestUser = `BcryptGuest_${uniq}`;
    const guestPass = `Nairobi@Guest${uniq}!7`;
    const hostUser = `BcryptHost_${uniq}`;
    const hostPass = `Diani#Host${uniq}$9`;

    const sg = await apiJson<{ user: any; token: string }>('/api/auth/register', {
      method: 'POST',
      body: { portal: 'guest', username: guestUser, password: guestPass },
    });
    assert.equal(sg.status, 201);
    assert.equal(sg.data.user.passwordHash, undefined, 'Signup response must never expose passwordHash');
    const actualGuestEmail = sg.data.user.email;

    const sh = await apiJson<{ user: any; token: string }>('/api/auth/register', {
      method: 'POST',
      body: { portal: 'owner', username: hostUser, password: hostPass },
    });
    assert.equal(sh.status, 201);
    assert.equal(sh.data.user.passwordHash, undefined, 'Signup response must never expose passwordHash');
    const actualHostEmail = sh.data.user.email;

    // Verify bcrypt hash at rest in database
    const storedGuest = db.findUserByEmail(actualGuestEmail);
    const storedHost = db.findUserByEmail(actualHostEmail);
    assert.ok(storedGuest && /^\$2[aby]\$/.test(storedGuest.passwordHash || ''));
    assert.ok(storedHost && /^\$2[aby]\$/.test(storedHost.passwordHash || ''));

    // Trimmed case-insensitive login via username AND email for both Guest and Host
    for (const [portal, identifiers, password] of [
      ['guest', [`  ${guestUser.toLowerCase()}  `, `  ${actualGuestEmail.toUpperCase()}  `], guestPass],
      ['owner', [`  ${hostUser.toUpperCase()}  `, `  ${actualHostEmail.toLowerCase()}  `], hostPass],
    ] as const) {
      for (const id of identifiers) {
        const res = await apiJson<{ user: any; token: string }>('/api/auth/login', {
          method: 'POST',
          body: { portal, username: id, password },
        });
        assert.equal(res.status, 200, `Login for ${portal} with "${id}" must succeed`);
        assert.equal(res.data.user.passwordHash, undefined);
      }
      const bad = await apiJson('/api/auth/login', {
        method: 'POST',
        body: { portal, username: identifiers[0], password: 'WrongPassword#999!' },
      });
      assert.equal(bad.status, 401);
    }

    // Legacy SHA-256 credential transparently authenticates and upgrades to bcrypt at rest
    const legacyPass = 'LegacySha#2026!';
    const legacySha256 = crypto
      .createHash('sha256')
      .update(legacyPass + 'airbus_salt_2026')
      .digest('hex');
    const legacyEmail = `legacy_${uniq.toLowerCase()}@airbus.ke`;
    const legacyUsername = `LegacyUser_${uniq}`;
    db.createUser({
      id: `u_legacy_${uniq.toLowerCase()}`,
      name: legacyUsername,
      username: legacyUsername,
      portal: 'guest',
      email: legacyEmail,
      role: 'guest',
      passwordHash: legacySha256,
      idVerified: true,
      createdAt: Date.now() - 10 * 864e5,
    });
    // Running v6_bcrypt_credentials wraps raw SHA-256 with legacy256$bcrypt(...) cleanly
    db.rollbackMigration('v6_bcrypt_credentials');
    db.runStartupMigrations();
    const migratedBeforeLogin = db.findUserByEmail(legacyEmail);
    assert.ok(migratedBeforeLogin && migratedBeforeLogin.passwordHash?.startsWith('legacy256$'));

    const legacyLogin = await apiJson<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: { portal: 'guest', username: `  ${legacyUsername.toLowerCase()} `, password: legacyPass },
    });
    assert.equal(legacyLogin.status, 200, 'Legacy SHA-256 user must still log in with original password');
    const upgradedUser = db.findUserByEmail(legacyEmail);
    assert.ok(upgradedUser && /^\$2[aby]\$/.test(upgradedUser.passwordHash || ''), 'Successful login must upgrade legacy256$ to pure bcrypt');
  });

  it('25. Task 2: Admin "Registered Users & Hosts" endpoint enforces guards, hides hashes, and supports role/search/pagination', async () => {
    // Re-issue Guest & Host tokens after Test 23 full_factory reset cleared authSessions
    const gRe = await apiJson<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: { portal: 'guest', username: 'SarahWanjiku', password: 'Sarah$Nairobi88!' },
    });
    assert.equal(gRe.status, 200);
    guestToken = gRe.data.token;
    const hRe = await apiJson<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: { portal: 'owner', username: 'DavidMutua', password: 'Mutua@Westlands91#' },
    });
    assert.equal(hRe.status, 200);
    hostToken = hRe.data.token;
    const aRe = await apiJson<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: { email: 'kamalahari93@gmail.com', password: '2019xyz//' },
    });
    assert.equal(aRe.status, 200);
    adminToken = aRe.data.token;

    const unauth = await apiJson('/api/admin/users');
    assert.equal(unauth.status, 401);
    const asGuest = await apiJson('/api/admin/users', { token: guestToken });
    assert.equal(asGuest.status, 403);
    const asHost = await apiJson('/api/admin/users', { token: hostToken });
    assert.equal(asHost.status, 403);

    const allRes = await apiJson<{
      users: any[];
      total: number;
      counts: { total: number; guests: number; hosts: number; suspended: number };
    }>('/api/admin/users?role=all&limit=50', { token: adminToken });
    assert.equal(allRes.status, 200);
    assert.ok(allRes.data.users.length >= 2);
    assert.ok(allRes.data.users.some(u => u.email === 'guest@airbus.ke' && u.role === 'guest'));
    assert.ok(allRes.data.users.some(u => u.email === 'owner@airbus.ke' && u.role === 'owner'));
    for (const u of allRes.data.users) {
      assert.equal(u.passwordHash, undefined, 'Admin users list must never return passwordHash');
      assert.ok(u.createdAt, 'Every listed account must include signup date createdAt');
    }

    const hostFilter = await apiJson<{ users: any[] }>('/api/admin/users?role=hosts&q=DavidMutua', { token: adminToken });
    assert.equal(hostFilter.status, 200);
    assert.ok(hostFilter.data.users.every(u => u.role === 'owner'));
    assert.ok(hostFilter.data.users.some(u => u.email === 'owner@airbus.ke'));
  });

  it('26. Task 3: Kenya geocoding endpoint resolves Kenyan cities and returns 404 on unmatched strict lookup', async () => {
    const hit = await apiJson<{ lat: number; lng: number; formattedAddress: string }>(
      '/api/geocode?q=Westlands&strict=1'
    );
    assert.equal(hit.status, 200);
    assert.ok(hit.data.lat < 5 && hit.data.lat > -5);
    assert.ok(hit.data.lng > 33 && hit.data.lng < 42);
    assert.ok(hit.data.formattedAddress.toLowerCase().includes('westlands'));

    const miss = await apiJson<{ error: string }>(
      '/api/geocode?q=NonExistentKenyanTownXyz99999&strict=1'
    );
    assert.equal(miss.status, 404);
    assert.ok(miss.data.error);
  });

  it('27. Task 4: airbus.ai translation validates inputs, returns exact English source, and serves cached per-field translations', async () => {
    const stay = db.getStays()[0];
    assert.ok(stay);

    const bad = await apiJson(`/api/stays/${stay.id}/translate`, {
      method: 'POST',
      body: { targetLanguage: '   ' },
    });
    assert.equal(bad.status, 400);

    const orig = await apiJson<{ language: string; isOriginal: boolean; translated: any }>(
      `/api/stays/${stay.id}/translate`,
      {
        method: 'POST',
        body: { targetLanguage: 'English' },
      }
    );
    assert.equal(orig.status, 200);
    assert.equal(orig.data.isOriginal, true);
    assert.equal(orig.data.translated.title, stay.title);
    assert.ok(orig.data.translated.priceText.includes('KES'));

    const defaultBookingHours =
      'Check-in after 14:00, checkout before 10:00. No unauthorized parties. Respect neighborhood quiet hours.';
    const defaultSettlement =
      'Free cancellation before check-in. Guests pay hosts directly after property tour and key handover.';
    const defaultPriceText = `KES ${Number(stay.price || 0).toLocaleString()} for ${stay.nights || 1} ${
      (stay.nights || 1) === 1 ? 'night' : 'nights'
    }`;
    const sourceFields = {
      title: String(stay.title || ''),
      location: String(stay.location || ''),
      type: String(stay.type || ''),
      description: String(stay.description || ''),
      hostMessage: String(stay.hostMessage || ''),
      welcomeGifts: Array.isArray(stay.welcomeGifts) ? stay.welcomeGifts.map(String) : [],
      features: Array.isArray(stay.features) ? stay.features.map(String) : [],
      highlights: Array.isArray(stay.highlights) ? stay.highlights.map(String) : [],
      bookingHoursText: defaultBookingHours,
      directSettlementText: defaultSettlement,
      priceText: defaultPriceText,
      instantBookLabel: stay.instantBook ? 'Instant Confirmation' : 'Host approval',
    };
    const sourceHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(sourceFields))
      .digest('hex')
      .slice(0, 16);

    db.setStayTranslationFields(stay.id, 'Swahili', sourceHash, {
      ...sourceFields,
      title: `${stay.title} (Kiswahili)`,
      description: 'Nyumba ya kifahari yenye mandhari mazuri.',
      bookingHoursText: 'Kuingia baada ya 14:00, kutoka kabla ya 10:00.',
      priceText: `KES ${Number(stay.price || 0).toLocaleString()} kwa usiku ${stay.nights || 1}`,
    });

    const sw = await apiJson<{ language: string; cached: boolean; isOriginal: boolean; translated: any }>(
      `/api/stays/${stay.id}/translate`,
      {
        method: 'POST',
        body: { targetLanguage: 'Swahili' },
      }
    );
    assert.equal(sw.status, 200);
    assert.equal(sw.data.cached, true);
    assert.equal(sw.data.isOriginal, false);
    assert.ok(sw.data.translated.title.includes('(Kiswahili)'));
    assert.ok(sw.data.translated.bookingHoursText.includes('14:00'));
    assert.ok(sw.data.translated.priceText.includes('KES'));
  });

  it('28. Task 5: Atomic boosting validates balance, pins old listing at top of "new" feed during boost_start..boost_end, logs admin ledger, and reverts on expiry', async () => {
    // Re-ensure active Gold plan on owner@airbus.ke after factory reset
    await apiJson('/api/admin/plan', {
      method: 'POST',
      token: adminToken,
      body: { hostEmail: 'owner@airbus.ke', tier: 'Gold', durationDays: 30 },
    });

    const staysChrono = db.getStays().filter(s => (s.ownerEmail || '').toLowerCase() === 'owner@airbus.ke');
    const oldestHostStay = staysChrono[staysChrono.length - 1];
    assert.ok(oldestHostStay);
    const originalCreatedAt = oldestHostStay.createdAt;

    const hostBalBefore = db.getWalletBalance('owner@airbus.ke');
    const adminBalBefore = db.getWalletBalance('admin@airbus.ke');

    // Insufficient balance must fail atomically with zero balance change
    const overDays = Math.ceil((hostBalBefore + 5000) / 100);
    const failBoost = await apiJson<{ error: string }>('/api/promotions/purchase', {
      method: 'POST',
      token: hostToken,
      body: { listingId: oldestHostStay.id, days: overDays, paymentMethod: 'wallet' },
    });
    assert.equal(failBoost.status, 400);
    assert.equal(db.getWalletBalance('owner@airbus.ke'), hostBalBefore);
    assert.equal(db.getWalletBalance('admin@airbus.ke'), adminBalBefore);

    // Valid atomic boost (3 days = KES 300) with idempotency key
    const idem = `boost_idem_${Date.now()}`;
    const okBoost = await apiJson<{ boost: any; payment: any }>('/api/promotions/purchase', {
      method: 'POST',
      token: hostToken,
      headers: { 'Idempotency-Key': idem },
      body: { listingId: oldestHostStay.id, days: 3, paymentMethod: 'wallet' },
    });
    assert.equal(okBoost.status, 201);
    assert.equal(okBoost.data.boost.amount_paid, 300);
    assert.ok(okBoost.data.boost.boost_start);
    assert.ok(okBoost.data.boost.boost_end > okBoost.data.boost.boost_start);

    // Retry with same idempotency key must not double debit
    const retryBoost = await apiJson<{ boost: any }>('/api/promotions/purchase', {
      method: 'POST',
      token: hostToken,
      headers: { 'Idempotency-Key': idem },
      body: { listingId: oldestHostStay.id, days: 3, paymentMethod: 'wallet' },
    });
    assert.equal(retryBoost.status, 200);

    assert.equal(db.getWalletBalance('owner@airbus.ke'), hostBalBefore - 300);
    assert.equal(db.getWalletBalance('admin@airbus.ke'), adminBalBefore + 300);

    // Old boosted listing is pinned at #1 topmost on default 'new' feed without altering createdAt
    const feedActive = await apiJson<{ stays: any[] }>('/api/stays?sort=new&limit=20');
    assert.equal(feedActive.status, 200);
    assert.equal(feedActive.data.stays[0].id, oldestHostStay.id);
    assert.equal(feedActive.data.stays[0].createdAt, originalCreatedAt);

    // Simulate boost expiry and run scheduled expiration check
    const targetStayRef = (db as any).data.stays.find((s: any) => s.id === oldestHostStay.id)!;
    targetStayRef.boost_end = Date.now() - 5000;
    targetStayRef.promotedUntil = targetStayRef.boost_end;
    db.checkAllExpirations();

    const feedAfterExpiry = await apiJson<{ stays: any[] }>('/api/stays?sort=new&limit=20');
    assert.equal(feedAfterExpiry.status, 200);
    assert.notEqual(
      feedAfterExpiry.data.stays[0].id,
      oldestHostStay.id,
      'Expired boost must revert back to original chronological createdAt order'
    );
    assert.equal(targetStayRef.createdAt, originalCreatedAt);
  });

  it('29. Task 6: Admin Review Queue lists oldest pending first with counts & full media, requires decline feedback, and publishes approved posts', async () => {
    const tinyPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const up = await apiJson<{ url: string }>('/api/uploads/media', {
      method: 'POST',
      token: hostToken,
      body: { dataUrl: tinyPngDataUrl, filename: 'rq_photo.png', kind: 'photo' },
    });
    assert.equal(up.status, 201);
    createdUploadFiles.push(up.data.url);

    const stayOneRes = await apiJson<{ stay: any }>('/api/stays', {
      method: 'POST',
      token: hostToken,
      body: {
        title: 'Review Queue Oldest Listing',
        location: 'Westlands, Nairobi',
        lat: -1.267,
        lng: 36.811,
        price: 7500,
        images: [up.data.url],
        thumbnailUrl: up.data.url,
      },
    });
    assert.equal(stayOneRes.status, 201);
    await new Promise(r => setTimeout(r, 8));
    const stayTwoRes = await apiJson<{ stay: any }>('/api/stays', {
      method: 'POST',
      token: hostToken,
      body: {
        title: 'Review Queue Newer Listing',
        location: 'Kilimani, Nairobi',
        lat: -1.292,
        lng: 36.783,
        price: 8200,
        images: [up.data.url],
        thumbnailUrl: up.data.url,
      },
    });
    assert.equal(stayTwoRes.status, 201);

    const queue = await apiJson<{
      stays: any[];
      tripDating: any[];
      counts: { stays: number; tripDating: number; total: number };
    }>('/api/admin/review-queue', { token: adminToken });
    assert.equal(queue.status, 200);
    assert.equal(queue.data.counts.stays + queue.data.counts.tripDating, queue.data.counts.total);
    assert.ok(queue.data.counts.stays >= 2);
    const idx1 = queue.data.stays.findIndex(s => s.id === stayOneRes.data.stay.id);
    const idx2 = queue.data.stays.findIndex(s => s.id === stayTwoRes.data.stay.id);
    assert.ok(idx1 !== -1 && idx2 !== -1 && idx1 < idx2, 'Queue must list oldest pending first');
    assert.ok(Array.isArray(queue.data.stays[idx1].media?.photos));

    // Decline without feedback fails 400
    const badDecline = await apiJson(`/api/admin/review-queue/stays/${stayOneRes.data.stay.id}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'decline', admin_feedback: '   ' },
    });
    assert.equal(badDecline.status, 400);

    // Decline with feedback removes from queue & preserves feedback for host
    const goodDecline = await apiJson<{ stay: any }>(`/api/admin/review-queue/stays/${stayOneRes.data.stay.id}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'decline', admin_feedback: 'Please upload clearer daylight photos of the balcony.' },
    });
    assert.equal(goodDecline.status, 200);
    assert.equal(goodDecline.data.stay.admin_feedback, 'Please upload clearer daylight photos of the balcony.');

    // Approve second listing publishes to live feed
    const approveTwo = await apiJson<{ stay: any }>(`/api/admin/review-queue/stays/${stayTwoRes.data.stay.id}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'approve' },
    });
    assert.equal(approveTwo.status, 200);
    assert.equal(approveTwo.data.stay.status, 'live');
  });

  it('30. Subscription notifications fire once on approval, never on pending/rejected', async () => {
    const subCode = `SUBNOTIF${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const notifsBefore = await apiJson<{ notifications: any[] }>('/api/notifications', { token: hostToken });
    const countBefore = notifsBefore.data.notifications.filter(
      n => n.title === 'M-Pesa Deposit Approved' || n.title === 'Subscription Active'
    ).length;

    // Submit pending subscription deposit -> zero success notifications
    const depRes = await apiJson<{ payment: any }>('/api/merchant/deposits', {
      method: 'POST',
      token: hostToken,
      body: {
        amountKes: 2500,
        mpesaCode: subCode,
        phone: '0712345678',
        purpose: 'SUBSCRIPTION',
        planTier: 'Diamond',
        period: 'monthly',
      },
    });
    assert.equal(depRes.status, 201);

    // Also submit & reject another payment -> zero success notifications
    const rejCode = `SUBREJ${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const rejDep = await apiJson<{ payment: any }>('/api/merchant/deposits', {
      method: 'POST',
      token: hostToken,
      body: { amountKes: 1000, mpesaCode: rejCode, phone: '0712345678', purpose: 'SUBSCRIPTION', planTier: 'Silver' },
    });
    assert.equal(rejDep.status, 201);
    const rejAction = await apiJson(`/api/admin/payments/${rejDep.data.payment.id}/decline`, {
      method: 'POST',
      token: adminToken,
      body: { reason: 'Code mismatch during test' },
    });
    assert.equal(rejAction.status, 200);

    const notifsWhilePending = await apiJson<{ notifications: any[] }>('/api/notifications', { token: hostToken });
    const countWhilePending = notifsWhilePending.data.notifications.filter(
      n => n.title === 'M-Pesa Deposit Approved' || n.title === 'Subscription Active'
    ).length;
    assert.equal(countWhilePending, countBefore, 'Pending or declined payments must never trigger subscription active notifications');

    // Clear active plan briefly so approval activates subscription cleanly, then approve twice to test idempotency
    const hostPlanRef = (db as any).data.hostPlans['owner@airbus.ke'];
    if (hostPlanRef) {
      hostPlanRef.expiresAt = Date.now() - 1000;
      hostPlanRef.status = 'expired';
    }
    const app1 = await apiJson(`/api/admin/payments/${depRes.data.payment.id}/approve`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    assert.equal(app1.status, 200);
    const app2 = await apiJson(`/api/admin/payments/${depRes.data.payment.id}/approve`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    assert.equal(app2.status, 200);

    const notifsAfter = await apiJson<{ notifications: any[] }>('/api/notifications', { token: hostToken });
    const addedDepApproved = notifsAfter.data.notifications.filter(n => n.title === 'M-Pesa Deposit Approved');
    const addedSubActive = notifsAfter.data.notifications.filter(n => n.title === 'Subscription Active');
    assert.ok(addedDepApproved.length >= 1, 'Host must receive M-Pesa Deposit Approved notification');
    assert.ok(addedSubActive.length >= 1, 'Host must receive Subscription Active notification with start & expiry dates');
    assert.equal(
      addedDepApproved.length + addedSubActive.length - countBefore,
      2,
      'Double approval must emit the 2 subscription notifications exactly once'
    );
    assert.ok(addedSubActive[0].message.includes('Start date:') && addedSubActive[0].message.includes('Expiry date:'));

    // Restore Gold plan capacity for subsequent tests
    await apiJson('/api/admin/plan', {
      method: 'POST',
      token: adminToken,
      body: { hostEmail: 'owner@airbus.ke', tier: 'Gold', durationDays: 30 },
    });
  });

  it('31. Listing description, per-category custom amenities (deduped), public feed visibility & unauthenticated media access', async () => {
    const tinyPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const up = await apiJson<{ url: string }>('/api/uploads/media', {
      method: 'POST',
      token: hostToken,
      body: { dataUrl: tinyPngDataUrl, filename: 'pub_test.png', kind: 'photo' },
    });
    assert.equal(up.status, 201);
    createdUploadFiles.push(up.data.url);

    const createRes = await apiJson<{ stay: any }>('/api/stays', {
      method: 'POST',
      token: hostToken,
      body: {
        title: 'Karen Sanctuary Villa',
        description: 'Quiet garden retreat near Giraffe Centre with private chef kitchen.',
        location: 'Karen, Nairobi',
        lat: -1.319,
        lng: 36.707,
        price: 12000,
        features: ['WiFi', 'Starlink Mesh', 'starlink mesh', 'Solar Heater'],
        customAmenitiesByCategory: {
          Connectivity: ['Starlink Mesh', '  starlink mesh ', 'Ethernet Desk'],
          Utilities: ['Solar Heater', 'Rainwater Filter'],
        },
        images: [up.data.url],
        thumbnailUrl: up.data.url,
      },
    });
    assert.equal(createRes.status, 201);
    const stayId = createRes.data.stay.id;
    assert.equal(createRes.data.stay.description, 'Quiet garden retreat near Giraffe Centre with private chef kitchen.');
    assert.deepEqual(createRes.data.stay.customAmenitiesByCategory.Connectivity, ['Starlink Mesh', 'Ethernet Desk']);

    // Pending listing is hidden from unauthenticated public feed & detail
    const pubPendingFeed = await apiJson<{ stays: any[] }>('/api/stays');
    assert.equal(pubPendingFeed.status, 200);
    assert.ok(!pubPendingFeed.data.stays.some(s => s.id === stayId), 'Pending stay must not appear on public feed');
    const pubPendingDetail = await apiJson(`/api/stays/${stayId}`);
    assert.equal(pubPendingDetail.status, 404, 'Pending stay detail must be hidden from unauthenticated visitors');

    // Approve listing -> immediately visible on public feed and detail, including media URL accessibility without auth
    const approveRes = await apiJson<{ stay: any }>(`/api/admin/review-queue/stays/${stayId}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'approve' },
    });
    assert.equal(approveRes.status, 200);

    const pubLiveDetail = await apiJson<{ stay: any }>(`/api/stays/${stayId}`);
    assert.equal(pubLiveDetail.status, 200);
    assert.equal(pubLiveDetail.data.stay.description, 'Quiet garden retreat near Giraffe Centre with private chef kitchen.');
    assert.deepEqual(pubLiveDetail.data.stay.customAmenitiesByCategory.Utilities, ['Solar Heater', 'Rainwater Filter']);

    const mediaRes = await fetch(`${baseUrl}${up.data.url}`);
    assert.equal(mediaRes.status, 200, 'Uploaded media must be publicly readable without auth');
    assert.equal(mediaRes.headers.get('access-control-allow-origin'), '*');
  });

  it('32. Optional Adverts: pending -> atomic approval debit/credit (idempotent), insufficient balance block, decline with reason, strict expiry & extension', async () => {
    const liveHostStay = db.getStays().find(s => (s.ownerEmail || '').toLowerCase() === 'owner@airbus.ke');
    assert.ok(liveHostStay);

    // 1. Submit optional advert -> pending, KES 0 charged
    const hostBalStart = db.getWalletBalance('owner@airbus.ke');
    const adminBalStart = db.getWalletBalance('admin@airbus.ke');
    const createAdRes = await apiJson<{ ad: any }>('/api/ads', {
      method: 'POST',
      token: hostToken,
      body: {
        stayId: liveHostStay.id,
        title: 'Nairobi Weekend Escapes',
        description: 'Direct airport pickup included',
        days: 3,
      },
    });
    assert.equal(createAdRes.status, 201);
    const adId = createAdRes.data.ad.id;
    assert.equal(createAdRes.data.ad.status, 'pending');
    assert.equal(db.getWalletBalance('owner@airbus.ke'), hostBalStart);

    // 2. Insufficient balance blocks approval atomically with no changes
    const hugeAdRes = await apiJson<{ ad: any }>('/api/ads', {
      method: 'POST',
      token: hostToken,
      body: {
        stayId: liveHostStay.id,
        title: 'Expensive Year Campaign',
        days: 365,
      },
    });
    assert.equal(hugeAdRes.status, 201);
    const failApprove = await apiJson<{ error: string }>(`/api/ads/${hugeAdRes.data.ad.id}/approve`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    assert.equal(failApprove.status, 400);
    assert.ok(failApprove.data.error.toLowerCase().includes('insufficient'));
    assert.equal(db.getWalletBalance('owner@airbus.ke'), hostBalStart);
    assert.equal(db.getWalletBalance('admin@airbus.ke'), adminBalStart);

    // Decline expensive ad -> requires reason, charges 0
    const declineBad = await apiJson(`/api/ads/${hugeAdRes.data.ad.id}/reject`, {
      method: 'POST',
      token: adminToken,
      body: { reason: '  ' },
    });
    assert.equal(declineBad.status, 400);
    const declineOk = await apiJson<{ ad: any }>(`/api/ads/${hugeAdRes.data.ad.id}/reject`, {
      method: 'POST',
      token: adminToken,
      body: { reason: 'Budget exceeds current campaign limit' },
    });
    assert.equal(declineOk.status, 200);
    assert.equal(declineOk.data.ad.status, 'declined');
    assert.equal(db.getWalletBalance('owner@airbus.ke'), hostBalStart);

    // 3. Approve valid 3-day advert (KES 300) twice -> debits host once & credits Admin "Advert fee" once
    const idem = `ad_app_${Date.now()}`;
    const appAd1 = await apiJson<{ ad: any }>(`/api/ads/${adId}/approve`, {
      method: 'POST',
      token: adminToken,
      headers: { 'Idempotency-Key': idem },
      body: {},
    });
    assert.equal(appAd1.status, 200);
    assert.equal(appAd1.data.ad.status, 'active');
    assert.equal(appAd1.data.ad.amount_paid, 300);
    assert.ok(appAd1.data.ad.end_at > appAd1.data.ad.start_at);
    assert.equal(appAd1.data.ad.end_at - appAd1.data.ad.start_at, 3 * 864e5);

    const appAd2 = await apiJson<{ ad: any }>(`/api/ads/${adId}/approve`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    assert.equal(appAd2.status, 200);
    assert.equal(db.getWalletBalance('owner@airbus.ke'), hostBalStart - 300);
    assert.equal(db.getWalletBalance('admin@airbus.ke'), adminBalStart + 300);

    // Check host expense tx & admin Advert fee entry
    const hostWalletRes = await apiJson<{ transactions: any[] }>('/api/wallet', { token: hostToken });
    assert.ok(hostWalletRes.data.transactions.some(t => t.advertId === adId && t.direction === 'debit' && t.amount === 300));
    const adminWalletRes = await apiJson<{ entries: any[] }>('/api/admin/wallet/ledger?purpose=ADVERTISING', { token: adminToken });
    assert.equal(adminWalletRes.status, 200);
    assert.ok(adminWalletRes.data.entries.some(e => e.subPurpose === 'Advert fee' && e.amount === 300));

    // 4. Strict duration expiry notifies host and asks for extension (new pending request)
    const adRef = (db as any).data.adRequests.find((a: any) => a.id === adId)!;
    adRef.end_at = Date.now() - 1000;
    adRef.expiresAt = adRef.end_at;

    const adsAfterExpiry = await apiJson<{ ads: any[] }>(`/api/ads?stayId=${liveHostStay.id}`, { token: hostToken });
    const expiredAd = adsAfterExpiry.data.ads.find(a => a.id === adId);
    assert.equal(expiredAd?.status, 'expired');

    const hostNotifs = await apiJson<{ notifications: any[] }>('/api/notifications', { token: hostToken });
    assert.ok(hostNotifs.data.notifications.some(n => n.title.includes('Advert Expired')));

    const extRes = await apiJson<{ ad: any }>('/api/ads', {
      method: 'POST',
      token: hostToken,
      body: {
        stayId: liveHostStay.id,
        title: 'Nairobi Weekend Escapes (Extension)',
        days: 1,
        extensionOfAdId: adId,
      },
    });
    assert.equal(extRes.status, 201);
    assert.equal(extRes.data.ad.status, 'pending');
    assert.equal(extRes.data.ad.extensionOfAdId, adId);
  });

  it('33. Listing-scoped payNow Advert: blocks insufficient wallet, credits Admin Wallet on payment, attaches ONLY to chosen listing (Dubai Marina s_ww_3) & its related Shorts, and auto-removes on expiry', async () => {
    const dubaiStay = db.getStayById('s_ww_3');
    assert.ok(dubaiStay);
    assert.equal(dubaiStay.title, 'Dubai Marina High-Floor Skyline Suite with Burj Al Arab Horizon');

    // Publish an approved Short video linked to s_ww_3 AND another Short linked to s2
    const now = Date.now();
    const dubaiShort = db.createPost({
      ownerEmail: 'owner@airbus.ke',
      creatorName: 'David Mutua',
      stayId: 's_ww_3',
      type: 'short',
      description: 'Dubai Marina Balcony Sunset Tour',
      caption: 'Dubai Marina Balcony Sunset Tour',
      coverUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-living-room-and-terrace-43405-large.mp4',
      status: 'approved',
      durationSeconds: 22,
    });
    db.moderatePost(dubaiShort.id, 'approved', 'admin@airbus.ke');
    await new Promise(r => setTimeout(r, 5));
    const otherShort = db.createPost({
      ownerEmail: 'owner@airbus.ke',
      creatorName: 'David Mutua',
      stayId: 's2',
      type: 'short',
      description: 'Karen Villa Garden Tour',
      caption: 'Karen Villa Garden Tour',
      coverUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-living-room-and-terrace-43405-large.mp4',
      status: 'approved',
      durationSeconds: 20,
    });
    db.moderatePost(otherShort.id, 'approved', 'admin@airbus.ke');

    // Set guest wallet to insufficient KES 50 (needs KES 300 for 3 days @ 100/day)
    const guestWallet = db.ensureWallet('guest@airbus.ke');
    const prevGuestBal = guestWallet.balance;
    guestWallet.balance = 50;
    guestWallet.holdBalance = 0;
    (db as any).data.wallets['guest@airbus.ke'] = 50;
    const adminBalBeforeFail = db.getWalletBalance('admin@airbus.ke');

    // 1. Insufficient wallet balance blocks advert cleanly with zero mutations
    const failRes = await apiJson<{ error: string }>('/api/ads', {
      method: 'POST',
      token: guestToken,
      body: {
        stayId: 's_ww_3',
        title: 'Dubai Yacht Charter VIP',
        description: 'Private sunset yacht boarding near Marina Walk',
        days: 3,
        payNow: true,
        paymentMethod: 'wallet',
      },
    });
    assert.equal(failRes.status, 400);
    assert.ok(failRes.data.error.toLowerCase().includes('insufficient'));
    assert.equal(db.getWalletBalance('guest@airbus.ke'), 50);
    assert.equal(db.getWalletBalance('admin@airbus.ke'), adminBalBeforeFail);
    assert.ok(!(db.getStayById('s_ww_3')?.activeAds || []).some(a => a.title === 'Dubai Yacht Charter VIP'));

    // Restore / fund guest wallet to KES 500 (re-fetch after rollback replaced detached reference)
    const fundedWallet = db.ensureWallet('guest@airbus.ke');
    fundedWallet.balance = Math.max(500, prevGuestBal);
    fundedWallet.holdBalance = 0;
    (db as any).data.wallets['guest@airbus.ke'] = fundedWallet.balance;
    const fundedGuestBal = fundedWallet.balance;
    const adminBalStart = db.getWalletBalance('admin@airbus.ke');

    // 2. Pay with wallet (payNow: true) for s_ww_3 -> debits advertiser, credits Admin Wallet as income, activates strictly on s_ww_3 & its Shorts
    const idemKey = `ad_dubai_${now}`;
    const payRes = await apiJson<{ ad: any; walletBalance: number }>('/api/ads', {
      method: 'POST',
      token: guestToken,
      headers: { 'Idempotency-Key': idemKey },
      body: {
        stayId: 's_ww_3',
        title: 'Dubai Yacht Charter VIP',
        description: 'Private sunset yacht boarding near Marina Walk',
        targetUrl: 'https://example.com/dubai-yacht',
        days: 3,
        payNow: true,
        paymentMethod: 'wallet',
      },
    });
    assert.equal(payRes.status, 201, JSON.stringify(payRes.data));
    const paidAdId = payRes.data.ad.id;
    assert.equal(payRes.data.ad.status, 'active');
    assert.equal(payRes.data.ad.stayId, 's_ww_3');
    assert.equal(payRes.data.ad.amount_paid, 300);
    assert.equal(payRes.data.walletBalance, fundedGuestBal - 300);
    assert.equal(db.getWalletBalance('guest@airbus.ke'), fundedGuestBal - 300);
    assert.equal(db.getWalletBalance('admin@airbus.ke'), adminBalStart + 300);

    // Admin wallet income entry verified
    const adminLedger = await apiJson<{ entries: any[] }>('/api/admin/wallet/ledger?purpose=ADVERTISING', { token: adminToken });
    assert.equal(adminLedger.status, 200);
    assert.ok(adminLedger.data.entries.some(e => e.subPurpose === 'Advert fee' && e.amount === 300 && e.description.includes('Dubai Yacht Charter VIP')));

    // 3. Strict scoping on GET /api/stays: present ONLY on s_ww_3 footer, absent from every other listing
    const feedRes = await apiJson<{ stays: any[] }>('/api/stays?limit=50');
    assert.equal(feedRes.status, 200);
    const feedDubai = feedRes.data.stays.find(s => s.id === 's_ww_3');
    const feedOtherStays = feedRes.data.stays.filter(s => s.id !== 's_ww_3');
    assert.ok(feedDubai);
    assert.ok((feedDubai.activeAds || []).some((a: any) => a.id === paidAdId));
    assert.ok(feedOtherStays.length > 0);
    for (const other of feedOtherStays) {
      assert.ok(!(other.activeAds || []).some((a: any) => a.id === paidAdId), `Advert leaked to unrelated listing ${other.id}`);
    }

    // 4. Strict scoping on GET /api/shorts/feed: present ONLY on Short(s) related to s_ww_3, absent from s2 Short
    const shortsRes = await apiJson<{ posts: any[] }>('/api/shorts/feed');
    assert.equal(shortsRes.status, 200);
    const dubaiShortFeed = shortsRes.data.posts.find(p => p.id === dubaiShort.id);
    const otherShortFeed = shortsRes.data.posts.find(p => p.id === otherShort.id);
    assert.ok(dubaiShortFeed);
    assert.ok(otherShortFeed);
    assert.ok((dubaiShortFeed.activeAds || []).some((a: any) => a.id === paidAdId));
    assert.ok(!(otherShortFeed.activeAds || []).some((a: any) => a.id === paidAdId), 'Advert leaked to unrelated Short video');

    // 5. Automatic removal when advert duration expires
    const storedAd = (db as any).data.adRequests.find((a: any) => a.id === paidAdId)!;
    storedAd.end_at = Date.now() - 1000;
    storedAd.expiresAt = storedAd.end_at;

    const feedAfterExpiry = await apiJson<{ stays: any[] }>('/api/stays?limit=50');
    const dubaiAfterExpiry = feedAfterExpiry.data.stays.find(s => s.id === 's_ww_3');
    assert.ok(!(dubaiAfterExpiry?.activeAds || []).some((a: any) => a.id === paidAdId), 'Expired advert must auto-remove from listing card footer');

    const shortsAfterExpiry = await apiJson<{ posts: any[] }>('/api/shorts/feed');
    const shortAfterExpiry = shortsAfterExpiry.data.posts.find(p => p.id === dubaiShort.id);
    assert.ok(!(shortAfterExpiry?.activeAds || []).some((a: any) => a.id === paidAdId), 'Expired advert must auto-remove from related Short video footer');

    const adStatusAfterExpiry = await apiJson<{ ads: any[] }>('/api/ads?stayId=s_ww_3');
    assert.equal(adStatusAfterExpiry.data.ads.find(a => a.id === paidAdId)?.status, 'expired');
  });
});





