import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { db, hashPassword, PLANS } from './src/server/db';
import { User, Stay, Booking, ChatThread, ChatMessage } from './src/types';

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

// -----------------------------------------------------------------------------
// REST API ENDPOINTS
// -----------------------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'AirBus Backend', time: new Date().toISOString() });
});

// Authentication
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, role, phone, location } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (db.findUserByEmail(cleanEmail)) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const assignedRole = role === 'admin' ? 'admin' : role === 'owner' ? 'owner' : 'guest';
    const newUser: User = {
      id: 'u_' + Date.now(),
      name: name.trim(),
      email: cleanEmail,
      role: assignedRole,
      passwordHash: hashPassword(password),
      phone: phone || '',
      location: location || 'Nairobi, Kenya',
      idVerified: assignedRole === 'admin',
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
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const user = db.findUserByEmail(cleanEmail) as any;
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

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
  } = req.body;

  if (!title || !location || !price) {
    return res.status(400).json({ error: 'Title, location, and price are required.' });
  }

  // Property must be approved by admin before going live!
  const isApproved = user.role === 'admin';
  const initialStatus = isApproved ? 'live' : 'review';

  const newStay: Stay = {
    id: 's_' + Date.now(),
    title: title.trim(),
    location: location.trim(),
    lat: lat || -1.29 + (Math.random() - 0.5) * 0.08,
    lng: lng || 36.8 + (Math.random() - 0.5) * 0.08,
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
    features: Array.isArray(features) ? features : ['WiFi', 'Parking'],
    highlights: Array.isArray(highlights) ? highlights : [],
    description: description || '',
    videoUrl: videoUrl || 'https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-living-room-and-terrace-43405-large.mp4',
    thumbnailUrl: thumbnailUrl || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
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
    views: 1,
    likesCount: 0,
    commentsCount: 0,
    comments: [],
    hostFollowerCount: 0,
    gradientHue: [Math.floor(Math.random() * 360), Math.floor(Math.random() * 360)],
    createdAt: Date.now(),
  };

  db.createStay(newStay);

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
    'price',
    'type',
    'guests',
    'beds',
    'area',
    'features',
    'highlights',
    'description',
    'videoUrl',
    'thumbnailUrl',
    'youtubeUrl',
    'youtubeVideoId',
    'whatsapp',
    'minNights',
    'welcomeGifts',
    'hostMessage',
    'instantBook',
  ];

  const updates: any = {};
  for (const key of allowedUpdates) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  const updatedStay = db.updateStay(req.params.id, updates);
  return res.json({ stay: updatedStay });
});

// Promote Listing (KES 100/day visibility boost)
app.post('/api/listings/:id/promote', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { days, idempotencyKey } = req.body;
  const numDays = Number(days) || 3;

  try {
    const result = db.promoteListing(req.params.id, user.email, numDays, idempotencyKey);
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Get Owner Promotions
app.get('/api/owner/promotions', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const promotions = db.getPromotions(user.role === 'admin' ? undefined : user.email);
  return res.json({ promotions });
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

app.patch('/api/stays/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const stay = db.getStayById(req.params.id);
  if (!stay) return res.status(404).json({ error: 'Stay not found' });
  if (user.role !== 'admin' && stay.ownerEmail !== user.email) {
    return res.status(403).json({ error: 'Unauthorized to edit this stay' });
  }

  const updated = db.updateStay(req.params.id, req.body);
  return res.json({ stay: updated });
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

  const { stayId, checkIn, checkOut, guests, note } = req.body;
  const stay = db.getStayById(stayId);
  if (!stay) return res.status(404).json({ error: 'Stay not found' });

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
  const total = subtotal + cleaningFee + serviceFee;

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
    createdAt: Date.now(),
  };

  db.createBooking(newBooking);
  return res.status(201).json({ booking: newBooking });
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

app.post('/api/payments', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { kind, tier, amount, mpesaCode } = req.body;

  if (!mpesaCode || !/^[A-Z0-9]{10}$/i.test(mpesaCode.trim())) {
    return res.status(400).json({ error: 'M-Pesa reference code must be exactly 10 alphanumeric characters (e.g. QGH7X2K9LM).' });
  }

  const codeClean = mpesaCode.trim().toUpperCase();
  if (db.getPayments().some(p => p.mpesaCode === codeClean && p.status !== 'rejected')) {
    return res.status(409).json({ error: 'This M-Pesa receipt code has already been submitted.' });
  }

  const payment = db.createPayment({
    id: 'pay_' + Date.now(),
    hostEmail: user.email,
    kind: kind === 'wallet' ? 'wallet' : 'plan',
    tier: tier || 'Silver',
    amount: Number(amount) || 1000,
    mpesaCode: codeClean,
    status: 'pending',
    createdAt: Date.now(),
  });

  return res.status(201).json({ payment });
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
  const { amount, mpesaCode } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount < 100) {
    return res.status(400).json({ error: 'Minimum top-up amount is KES 100.' });
  }
  if (!mpesaCode || !/^[A-Z0-9]{10}$/i.test(mpesaCode.trim())) {
    return res.status(400).json({ error: 'M-Pesa code must be a 10-character alphanumeric transaction reference.' });
  }

  const payment = db.createPayment({
    id: 'topup_' + Date.now(),
    hostEmail: user.email,
    kind: 'wallet',
    amount: numAmount,
    mpesaCode: mpesaCode.trim().toUpperCase(),
    status: 'pending',
    createdAt: Date.now(),
  });

  return res.status(201).json({ payment });
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

// Pay 30-Day Plan from Wallet
app.post('/api/plans/wallet-pay', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { tier } = req.body;
  if (!['Silver', 'Diamond', 'Gold'].includes(tier)) {
    return res.status(400).json({ error: 'Valid plan tier required (Silver, Diamond, Gold).' });
  }
  try {
    const result = db.paySubscriptionFromWallet(user.email, tier);
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
// VITE DEV SERVER OR STATIC PRODUCTION SERVING
// -----------------------------------------------------------------------------
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // Seamlessly redirect root to /AirbusGlobal/ in dev
    app.get('/', (req, res) => {
      res.redirect('/AirbusGlobal/');
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
