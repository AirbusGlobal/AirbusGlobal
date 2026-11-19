import assert from 'node:assert/strict';
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
      const base = path.basename(relUrl);
      const target = path.join(RAW_UPLOADS_DIR, base);
      if (fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
        } catch {
          // ignore cleanup failure
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

    // Admin Review Queue must list oldest pending first
    const queue = await apiJson<{ listings: any[]; tripDating: any[] }>('/api/admin/review-queue', {
      token: adminToken,
    });
    assert.equal(queue.status, 200);
    const qIdx1 = queue.data.listings.findIndex(s => s.id === stay1.id);
    const qIdx2 = queue.data.listings.findIndex(s => s.id === stay2.id);
    assert.ok(qIdx1 !== -1 && qIdx2 !== -1 && qIdx1 < qIdx2, 'Admin Review Queue must return oldest pending first');

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
    assert.equal(td.moderationState, 'PENDING');
    assert.equal(td.status, 'pending');

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

    // Resubmit -> PENDING, admin_feedback cleared, createdAt preserved
    const resubmitted = await apiJson<{ profile: any }>(`/api/trip-dating/profiles/${td.id}/resubmit`, {
      method: 'POST',
      token: guestToken,
      headers: { 'x-client-session': clientSession },
      body: { description: 'Updated bio: Love coastal road trips, jazz, and espresso.' },
    });
    assert.equal(resubmitted.status, 200);
    assert.equal(resubmitted.data.profile.createdAt, td.createdAt);
    assert.equal(resubmitted.data.profile.admin_feedback, null);
    assert.equal(resubmitted.data.profile.moderationState, 'PENDING');

    // Approve -> live in public feed & unlockable
    const approved = await apiJson<{ profile: any }>(`/api/admin/review-queue/trip-dating/${td.id}`, {
      method: 'POST',
      token: adminToken,
      body: { action: 'approve' },
    });
    assert.equal(approved.status, 200);
    assert.equal(approved.data.profile.moderationState, 'APPROVED');
    assert.equal(approved.data.profile.status, 'active');

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
});
