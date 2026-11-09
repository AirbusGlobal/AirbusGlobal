import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { db, hashPassword, PLANS } from './src/server/db';
import { User, Stay, Booking, ChatThread, ChatMessage, PaymentRecordType, PaymentRecordMethod } from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

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

// Simple auth helper from header
function getAuthUser(req: express.Request): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  return db.findUserByEmail(token) || null;
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'AirBus Backend', time: new Date().toISOString() });
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

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const newAdmin = db.registerSingleAdmin({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash: hashPassword(String(password)),
      phone,
      location,
    });

    const { passwordHash, ...safeUser } = newAdmin as any;
    return res.status(201).json({
      message: 'Sole administrator account successfully created.',
      user: safeUser,
      token: safeUser.email,
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

    if (newPassword && String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
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
    return res.json({
      message: 'Admin credentials successfully updated.',
      user: safeUser,
      token: safeUser.email,
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

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const updated = db.resetAdminPassword(cleanEmail, hashPassword(String(newPassword)));

    const { passwordHash, ...safeUser } = updated as any;
    return res.json({
      message: 'Admin password reset successfully.',
      user: safeUser,
      token: safeUser.email,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to reset admin password.' });
  }
});

// Public Authentication (Never allows admin registration)
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, role, phone, location } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    // Strict security: Public registration CANNOT create admin accounts!
    if (role === 'admin') {
      return res.status(403).json({ error: 'Admin registration is not permitted through public sign-up.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (db.findUserByEmail(cleanEmail)) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const assignedRole = role === 'owner' ? 'owner' : 'guest';
    const newUser: User = {
      id: 'u_' + Date.now(),
      name: name.trim(),
      email: cleanEmail,
      role: assignedRole,
      passwordHash: hashPassword(password),
      phone: phone || '',
      location: location || 'Nairobi, Kenya',
      idVerified: false,
      createdAt: Date.now(),
    } as any;

    db.createUser(newUser);

    if (req.body.referredByCode) {
      db.recordReferralSignup(req.body.referredByCode, cleanEmail);
    }

    const { passwordHash, ...safeUser } = newUser as any;
    return res.status(201).json({ user: safeUser, token: safeUser.email });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const rateCheck = checkRateLimit(loginRateLimitMap, `login_${clientIp}`, 10, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Too many login attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
      });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const user = db.findUserByEmail(cleanEmail) as any;
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Reset rate limiter on successful login
    loginRateLimitMap.delete(`login_${clientIp}`);

    const { passwordHash, ...safeUser } = user;
    return res.json({ user: safeUser, token: safeUser.email });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req) as any;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { passwordHash, ...safeUser } = user;
  return res.json({ user: safeUser });
});

app.patch('/api/auth/profile', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { name, phone, location, bio, languages } = req.body;
  const updated = db.updateUser(user.email, {
    name: name !== undefined ? name : user.name,
    phone: phone !== undefined ? phone : user.phone,
    location: location !== undefined ? location : user.location,
    bio: bio !== undefined ? bio : user.bio,
    languages: languages !== undefined ? languages : user.languages,
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
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'New password must be different from current password.' });
  }

  const newHash = hashPassword(newPassword);
  db.updateUser(user.email, { passwordHash: newHash } as any);
  db.createAuditLog({
    id: 'aud_' + Date.now(),
    action: 'change_password',
    actorEmail: user.email,
    details: 'User successfully updated account password.',
    createdAt: Date.now(),
  });
  return res.json({ success: true, message: 'Password updated successfully!' });
});

// Stays / Listings with Full Search
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
    } = req.query;

    let stays = db.getStays({
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
    });

    if (ownerEmail) {
      // Owner dashboard sees all their stays (live, review, paused, expired)
      stays = db.getRaw().stays.filter(s => s.ownerEmail?.toLowerCase() === String(ownerEmail).toLowerCase());
    }

    return res.json({ stays });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.get('/api/stays/:id', (req, res) => {
  const stay = db.getStayById(req.params.id);
  if (!stay) {
    return res.status(404).json({ error: 'Stay not found' });
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

// Listing Creation with MANDATORY Subscription Enforcement
app.post('/api/stays', (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Only registered owners and admins can create listings.' });
  }

  // MANDATORY 30-Day Subscription Check: Owner must have an active, non-expired subscription!
  const plan = db.getHostPlan(user.email);
  if (user.role !== 'admin') {
    if (plan.status !== 'active') {
      return res.status(403).json({
        error: 'A 30-day hosting subscription (Silver, Diamond, or Gold) is mandatory before you can upload and publish video stays. Please select a plan and complete M-Pesa payment.',
      });
    }

    // Check expiration
    if (plan.expiresAt > 0 && Date.now() > plan.expiresAt) {
      return res.status(403).json({
        error: 'Your 30-day hosting plan has expired. Please renew your subscription via M-Pesa before publishing new listings.',
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
  } = req.body;

  if (!title || !location || !price) {
    return res.status(400).json({ error: 'Title, location, and price are required.' });
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

  // Property must be approved by admin before going live!
  const isApproved = user.role === 'admin';
  const initialStatus = isApproved ? 'live' : 'review';

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
    status: initialStatus,
    moderationStatus: isApproved ? 'approved' : 'pending',
    mediaModerationStatus: 'clean',
    features: Array.isArray(features) ? features : ['WiFi', 'Parking'],
    highlights: Array.isArray(highlights) ? highlights : [],
    description: description || '',
    videoUrl: videoUrl || (media?.video?.url || ''),
    thumbnailUrl: thumbnailUrl || (images && images[0]) || (media?.photos && media.photos[0]?.url) || '',
    images: Array.isArray(images) ? images : undefined,
    media: media || undefined,
    youtubeUrl: youtubeUrl || undefined,
    youtubeVideoId: youtubeVideoId || undefined,
    source: affiliateLink ? 'External' : 'Direct',
    instantBook: true,
    isFeatured: false,
    isApprovedByAdmin: isApproved,
    ownerEmail: user.email,
    hostName: user.name,
    hostPhone: user.phone || '',
    whatsapp: whatsapp || '',
    affiliateLink: affiliateLink || '',
    minNights: Number(minNights) || 1,
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
  };

  try {
    db.createStay(newStay);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to save listing with media.' });
  }

  // Notify admin for approval if submitted by owner
  if (!isApproved) {
    db.getAllUsers()
      .filter(u => u.role === 'admin')
      .forEach(admin => {
        db.createNotification({
          id: 'notif_' + Date.now() + Math.random(),
          userEmail: admin.email,
          title: 'New Video Listing Pending Approval',
          message: `${user.name} submitted "${newStay.title}" for review.`,
          read: false,
          link: '/#admin',
          type: 'system',
          createdAt: Date.now(),
        });
      });
  }

  return res.status(201).json({ stay: newStay });
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

// Promote Listing (KES 100/day visibility boost - atomic wallet or M-Pesa verification)
app.post('/api/promotions/purchase', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to boost listings.' });

  const { listingId, days, paymentMethod, mpesaCode } = req.body;
  if (!listingId) return res.status(400).json({ error: 'Listing ID is required.' });

  try {
    const result = db.purchasePromotion({
      listingId,
      ownerEmail: user.email,
      days: Number(days) || 7,
      paymentMethod: paymentMethod === 'mpesa' ? 'mpesa' : 'wallet',
      mpesaCode,
    });
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Backwards-compatible promote endpoint
app.post('/api/listings/:id/promote', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { days, paymentMethod, mpesaCode } = req.body;
  try {
    const result = db.purchasePromotion({
      listingId: req.params.id,
      ownerEmail: user.email,
      days: Number(days) || 7,
      paymentMethod: paymentMethod === 'mpesa' ? 'mpesa' : 'wallet',
      mpesaCode,
    });
    return res.status(201).json(result);
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

// Dynamic Listing Sponsor Slots (1 to 10 Slots)
app.post('/api/listings/:id/sponsors', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to reserve sponsor slots.' });

  const { title, description, linkUrl, thumbnailUrl, durationDays, paymentMethod, mpesaCode } = req.body;
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
      paymentMethod: paymentMethod === 'mpesa' ? 'mpesa' : 'wallet',
      mpesaCode,
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

// Admin approves listing to go live
app.post('/api/admin/stays/:id/approve', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const stay = db.getStayById(req.params.id);
  if (!stay) return res.status(404).json({ error: 'Stay not found' });

  stay.isApprovedByAdmin = true;
  stay.status = 'live';
  db.save();

  if (stay.ownerEmail) {
    db.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: stay.ownerEmail,
      title: 'Listing Approved & Live! 🚀',
      message: `Your video stay "${stay.title}" has been approved by admin and is now live in search and Shorts!`,
      read: false,
      link: `/#stay-${stay.id}`,
      type: 'system',
      createdAt: Date.now(),
    });
  }

  return res.json({ stay });
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
  const serviceFee = Math.round(subtotal * 0.08);
  const baseTotal = subtotal + cleaningFee + serviceFee;
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
app.post('/api/payments/wallet', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to pay from wallet.' });

  const { type, amountSc, referenceId, planTier, durationDays, period, note } = req.body;

  if (!type || !['advert', 'subscription', 'booking_fee'].includes(type)) {
    return res.status(400).json({ error: 'Valid payment type (advert, subscription, booking_fee) is required.' });
  }

  const intAmount = Math.floor(Number(amountSc) || 0);
  if (intAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than 0 Coins.' });
  }

  try {
    const result = db.payWithWallet({
      userId: user.email,
      type,
      amountSc: intAmount,
      referenceId: referenceId || ('ref_' + Date.now()),
      planTier,
      durationDays: Number(durationDays) || undefined,
      period,
      note,
    });
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Wallet payment failed.' });
  }
});

// M-Pesa Payment Submission
app.post('/api/payments/mpesa', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to submit M-Pesa payment.' });

  const { type, amountKes, mpesaCode, referenceId, planTier, durationDays, period } = req.body;

  if (!type || !['advert', 'subscription', 'booking_fee'].includes(type)) {
    return res.status(400).json({ error: 'Valid payment type is required.' });
  }

  const intAmount = Math.floor(Number(amountKes) || 0);
  if (intAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than 0.' });
  }

  if (!mpesaCode || !/^[A-Z0-9]{10}$/i.test(String(mpesaCode).trim())) {
    return res.status(400).json({
      error: 'M-Pesa receipt code must be exactly 10 alphanumeric characters (e.g. QGH7X2K9LM).',
    });
  }

  try {
    const payment = db.createMpesaPayment({
      userId: user.email,
      type,
      amountKes: intAmount,
      mpesaCode: String(mpesaCode).trim().toUpperCase(),
      referenceId: referenceId || ('ref_' + Date.now()),
      planTier,
      durationDays: Number(durationDays) || undefined,
      period,
    });
    return res.status(201).json({ payment });
  } catch (err: any) {
    return res.status(409).json({ error: err.message || 'M-Pesa payment submission failed.' });
  }
});

// Legacy / backward-compatible POST /api/payments
app.post('/api/payments', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { kind, tier, amount, mpesaCode, period, referenceId } = req.body;

  if (!mpesaCode || !/^[A-Z0-9]{10}$/i.test(String(mpesaCode).trim())) {
    return res.status(400).json({
      error: 'M-Pesa reference code must be exactly 10 alphanumeric characters (e.g. QGH7X2K9LM).',
    });
  }

  const cleanCode = String(mpesaCode).trim().toUpperCase();
  const paymentType: PaymentRecordType = kind === 'advert' ? 'advert' : 'subscription';

  try {
    const payment = db.createMpesaPayment({
      userId: user.email,
      type: paymentType,
      amountKes: Number(amount) || 1000,
      mpesaCode: cleanCode,
      referenceId: referenceId || ('ref_' + Date.now()),
      planTier: tier || 'Silver',
      period: period === 'annual' ? 'annual' : 'monthly',
      durationDays: period === 'annual' ? 365 : 30,
    });
    return res.status(201).json({ payment });
  } catch (err: any) {
    return res.status(409).json({ error: err.message || 'Payment submission failed.' });
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

app.post('/api/subscriptions/purchase', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to purchase a hosting plan.' });

  const { tier, billing, method, mpesaCode } = req.body;

  if (!['Silver', 'Diamond', 'Gold'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid plan tier selected.' });
  }
  if (!['monthly', 'annual'].includes(billing)) {
    return res.status(400).json({ error: 'Invalid billing cycle. Choose monthly (30 days) or annual (365 days).' });
  }
  if (!['wallet', 'mpesa'].includes(method)) {
    return res.status(400).json({ error: 'Payment method must be wallet or mpesa.' });
  }

  try {
    const result = db.purchaseSubscription({
      ownerId: user.email,
      tier,
      billing,
      method,
      mpesaCode,
    });
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// 3. ADVERT SLOTS ("ADVERTISE HERE" & PERSISTENT AD CARD)
// ============================================================================

app.post('/api/ads/slots', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to advertise on AirBus.' });

  const {
    title,
    description,
    linkUrl,
    thumbnailUrl,
    videoUrl,
    durationDays,
    paymentMethod,
    mpesaCode,
  } = req.body;

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
  const method = paymentMethod === 'wallet' ? 'wallet' : 'mpesa';

  try {
    const result = db.createAdSlot({
      ownerId: user.email,
      title,
      description,
      linkUrl: linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`,
      thumbnailUrl: thumbnailUrl || '',
      videoUrl: videoUrl || undefined,
      durationDays: days,
      paymentMethod: method,
      mpesaCode,
    });
    return res.status(201).json(result);
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
      liveStays: stays.filter(s => s.status === 'live').length,
      pendingReviews: stays.filter(s => s.status === 'review').length,
      totalUsers: users.length,
      pendingPayments: payments.filter(p => p.status === 'pending').length,
      totalBookings: bookings.length,
      volumeKes: bookings.filter(b => b.status === 'confirmed').reduce((acc, b) => acc + b.total, 0),
    },
    users,
    payments,
    reports,
    tickets,
    auditLogs,
  });
});

app.post('/api/admin/payments/:id/approve', (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const result = db.approvePayment(req.params.id, user.email);
  if (!result) return res.status(404).json({ error: 'Payment not found or already processed.' });
  return res.json({ payment: result });
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
  return res.json({ wallet, ledger });
});

app.post('/api/wallet/topup', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { amount, mpesaCode, phoneNumber, proofUrl } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount < 10) {
    return res.status(400).json({ error: 'Minimum deposit amount is KES 10.' });
  }
  if (!mpesaCode || !/^[A-Z0-9]{8,15}$/i.test(mpesaCode.trim())) {
    return res.status(400).json({ error: 'M-Pesa code must be a valid 8-15 character alphanumeric transaction reference (e.g. QWE123RTY4).' });
  }

  const cleanCode = mpesaCode.trim().toUpperCase();
  if (db.isMpesaCodeUsed(cleanCode)) {
    return res.status(400).json({ error: 'Duplicate M-Pesa transaction code. This code has already been submitted and cannot be reused.' });
  }

  const payment = db.createPayment({
    id: 'pay_dep_' + Date.now(),
    userId: user.email,
    user_id: user.email,
    hostEmail: user.email,
    kind: 'deposit',
    type: 'deposit',
    method: 'mpesa_manual',
    amount: numAmount,
    amountKes: numAmount,
    amountSc: Math.floor(numAmount / 10),
    mpesaCode: cleanCode,
    reference: cleanCode,
    phoneNumber: phoneNumber || user.phone || '',
    proofUrl: proofUrl || undefined,
    status: 'pending',
    createdAt: Date.now(),
  });

  return res.status(201).json({
    message: 'Deposit request submitted. Awaiting administrative approval.',
    payment,
  });
});

app.post('/api/wallet/deposit', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { amount, mpesaCode, phoneNumber, proofUrl } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount < 10) {
    return res.status(400).json({ error: 'Deposit amount must be greater than 0 (minimum KES 10).' });
  }
  if (!mpesaCode || !/^[A-Z0-9]{8,15}$/i.test(mpesaCode.trim())) {
    return res.status(400).json({ error: 'M-Pesa code must be a valid 8-15 character alphanumeric transaction reference.' });
  }

  const cleanCode = mpesaCode.trim().toUpperCase();
  if (db.isMpesaCodeUsed(cleanCode)) {
    return res.status(400).json({ error: 'Duplicate M-Pesa transaction code. This code has already been submitted and cannot be reused.' });
  }

  const payment = db.createPayment({
    id: 'pay_dep_' + Date.now(),
    userId: user.email,
    user_id: user.email,
    hostEmail: user.email,
    kind: 'deposit',
    type: 'deposit',
    method: 'mpesa_manual',
    amount: numAmount,
    amountKes: numAmount,
    amountSc: Math.floor(numAmount / 10),
    mpesaCode: cleanCode,
    reference: cleanCode,
    phoneNumber: phoneNumber || user.phone || '',
    proofUrl: proofUrl || undefined,
    status: 'pending',
    createdAt: Date.now(),
  });

  return res.status(201).json({
    message: 'Deposit submitted and awaiting administrator approval. Funds will be credited to your wallet once verified.',
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

// Pay Plan from Wallet (Monthly or Annual)
app.post('/api/plans/wallet-pay', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { tier, period } = req.body;
  if (!['Silver', 'Diamond', 'Gold'].includes(tier)) {
    return res.status(400).json({ error: 'Valid plan tier required (Silver, Diamond, Gold).' });
  }
  try {
    const result = db.paySubscriptionFromWallet(user.email, tier, period === 'annual' ? 'annual' : 'monthly');
    return res.json(result);
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

  // Verify host has paid active subscription before publishing
  if (user.role === 'owner') {
    const plan = db.getHostPlan(user.email);
    if (plan.status !== 'active') {
      return res.status(403).json({ error: 'An active 30-day host subscription is required to post stays and video tours.' });
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

  const { stayId, title, description, imageUrl, targetUrl, contactPhone, tag, days } = req.body;
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

app.post('/api/ads/snappadd', (req, res) => {
  try {
    const user = getAuthUser(req);
    const {
      userEmail,
      title,
      description,
      websiteUrl,
      thumbnailUrl,
      videoUrl,
      durationDays,
      coinsPaid,
    } = req.body;

    const email = user?.email || userEmail || 'host@airbus.ke';
    if (!title || !websiteUrl) {
      return res.status(400).json({ error: 'Title and website URL are required.' });
    }

    const result = db.createSnappAddCampaign({
      userEmail: email,
      title,
      description: description || '',
      websiteUrl,
      thumbnailUrl: thumbnailUrl || '',
      videoUrl,
      durationDays: Number(durationDays) || 7,
      coinsPaid: Number(coinsPaid) || 70,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Payment processing failed.' });
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
// TRIP DATING: A Dating Services Near You
// Tagline: "Trip Dating – A Dating Services Near You. FREE TO JOIN. ENDLESS TO DISCOVER. KES 50 TO CONNECT."
// -----------------------------------------------------------------------------

app.get('/api/trip-dating/profiles', (req, res) => {
  try {
    const user = getAuthUser(req);
    const clientSessionId = (req.headers['x-client-session'] as string) || (req.query.sessionId as string) || '';
    const { gender, city, search, intention } = req.query;

    const profiles = db.getTripDatingProfiles(user?.email, clientSessionId, {
      gender: gender as string,
      city: city as string,
      search: search as string,
      intention: intention as string,
      showAllStatuses: false,
    });

    return res.json({ profiles });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch dating profiles' });
  }
});

app.get('/api/trip-dating/profiles/:id', (req, res) => {
  try {
    const user = getAuthUser(req);
    const clientSessionId = (req.headers['x-client-session'] as string) || (req.query.sessionId as string) || '';
    const profile = db.getTripDatingProfileById(req.params.id, user?.email, clientSessionId);

    if (!profile) {
      return res.status(404).json({ error: 'Dating profile not found' });
    }

    return res.json({ profile });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch profile' });
  }
});

// Free Instant Registration with Automated Policy Enforcement
app.post('/api/trip-dating/profiles', (req, res) => {
  try {
    const user = getAuthUser(req);
    const {
      fullName,
      phoneNumber,
      gender,
      age,
      dob,
      city,
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
      videoFilter,
      videoTrimStart,
      videoTrimEnd,
      full_body_photo,
      full_body_verified,
    } = req.body;

    if (!fullName || !phoneNumber || !city || !description || !gender) {
      return res.status(400).json({ error: 'Full name, valid phone number, gender, city, and bio description are required.' });
    }

    // Validate 9:16 vertical video duration (maximum 60 seconds)
    const effectiveDur = Number(videoDuration) || 60;
    if (videoUrl && effectiveDur > 60.5) {
      return res.status(400).json({
        error: 'Video exceeds the maximum duration limit of 60 seconds. Please upload or trim your video to 60 seconds or less.',
      });
    }

    // Validate optional videos (max 2 videos, max 60s each)
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

    // Part E: Validation for Photo (Head to toe recommended, optional fallback)
    const bodyPhoto = full_body_photo || primaryPhoto || (Array.isArray(photos) && photos[0]) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';

    // Validate image format if custom URL or Base64 provided
    const isDataUrl = typeof bodyPhoto === 'string' && bodyPhoto.startsWith('data:image/');
    const isHttpUrl = typeof bodyPhoto === 'string' && (bodyPhoto.startsWith('http://') || bodyPhoto.startsWith('https://'));
    
    if (!isDataUrl && !isHttpUrl) {
      return res.status(400).json({
        error: 'Invalid photo format. Only JPG, PNG, and WebP images are permitted.',
      });
    }

    // Max 5MB file size limit check for Base64 uploads
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
      location: location || city,
      description,
      lookingFor: lookingFor || 'Genuine companionship and fun dates',
      datingIntention,
      photos: Array.isArray(photos) && photos.length > 0 ? photos.slice(0, 3) : [bodyPhoto],
      primaryPhoto: primaryPhoto || bodyPhoto,
      videos: validVideos.length > 0 ? validVideos : undefined,
      videoDurations: validDurations.length > 0 ? validDurations : undefined,
      videoThumbnails: Array.isArray(videoThumbnails) ? videoThumbnails.slice(0, 2) : undefined,
      videoUrl: typeof videoUrl === 'string' && videoUrl.trim() ? videoUrl.trim() : undefined,
      videoDuration: videoUrl ? Math.min(60, Math.max(1, Math.round(effectiveDur))) : undefined,
      videoThumbnail: typeof videoThumbnail === 'string' && videoThumbnail.trim() ? videoThumbnail.trim() : undefined,
      videoFilter: typeof videoFilter === 'string' && videoFilter.trim() ? videoFilter.trim() : undefined,
      videoTrimStart: videoTrimStart !== undefined ? Number(videoTrimStart) : undefined,
      videoTrimEnd: videoTrimEnd !== undefined ? Number(videoTrimEnd) : undefined,
      full_body_photo: bodyPhoto,
      full_body_verified: full_body_verified !== undefined ? Boolean(full_body_verified) : true,
      fullBodyModerationStatus: 'approved',
      userId: user?.id || user?.email,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Registration rejected by safety policy.' });
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

// Submit KES 50 Contact Unlock Payment Request
app.post('/api/trip-dating/contact-requests', (req, res) => {
  try {
    const user = getAuthUser(req);
    const { profileId, payerPhone, transactionCode, clientSessionId } = req.body;

    if (!profileId || !payerPhone || !transactionCode) {
      return res.status(400).json({ error: 'Profile ID, payer phone number, and M-Pesa transaction code are required.' });
    }

    const request = db.createTripDatingPaymentRequest({
      profileId,
      userEmail: user?.email || 'guest@airbus.ke',
      clientSessionId: clientSessionId || (req.headers['x-client-session'] as string) || 'session_default',
      payerPhone,
      transactionCode,
    });

    return res.status(201).json({
      request,
      message: 'KES 50 payment submitted successfully! Our verification admin is reviewing the transaction code on Till 943210. Contact access unlocks immediately upon approval for 10 minutes.',
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to submit payment request' });
  }
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

// --- ADMIN TRIP DATING MANAGEMENT ROUTES ---

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
  const allProfiles = db.getTripDatingProfiles(user.email, undefined, { showAllStatuses: true });
  return res.json({ stats, profiles: allProfiles });
});

// -----------------------------------------------------------------------------
// VITE DEV SERVER OR STATIC PRODUCTION SERVING
// -----------------------------------------------------------------------------
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // Seamlessly redirect root and direct root admin portal in dev
    app.get('/', (req, res) => {
      res.redirect('/AirbusGlobal/');
    });
    app.get('/admin-portal-k7x2q9', (req, res) => {
      res.redirect('/AirbusGlobal/admin-portal-k7x2q9');
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use('/AirbusGlobal', express.static(distPath));
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AirBus full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
