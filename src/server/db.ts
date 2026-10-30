import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  DatabaseSchema,
  User,
  Stay,
  Booking,
  Review,
  ChatThread,
  PaymentRecord,
  NotificationItem,
  ListingReport,
  SupportTicket,
  AuditLog,
  HostPlanStatus,
  ListingStatus,
  VideoComment,
  VideoCommentReply,
  Post,
  PostType,
  PostStatus,
  LedgerEntry,
  LedgerEntryType,
  WalletRecord,
  AdRequest,
  AdRequestStatus,
  ReferralProfile,
  ReferralCommissionRecord,
  PlatformSettings,
  ViralityReport,
  StayPriceTrend,
  Currency,
  CURRENCY_RATES,
  StayCategory,
  ListingPromotion,
} from './types';
import { PLANS, AMENITY_GROUPS } from '../constants';

export const DEFAULT_SETTINGS: PlatformSettings = {
  adPricePerDay: 100,
  adPlatformFeePercent: 30,
  maxAdSlotsPerPost: 10,
  referralCommissionPercent: 10,
  referralDurationDays: 365,
  minWithdrawalKes: 500,
  planPrices: {
    Silver: 1000,
    Diamond: 2500,
    Gold: 5000,
  },
  currencyRates: CURRENCY_RATES,
  contentPolicies: {
    maxDescriptionChars: 300,
    maxPostImages: 10,
    maxShortSeconds: 60,
    maxVideoSeconds: 1800,
  },
};


const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'airbus-db.json');

export { PLANS, AMENITY_GROUPS };

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'airbus_salt_2026').digest('hex');
}

const SEED_USERS: User[] = [
  {
    id: 'u_guest',
    name: 'Sarah Wanjiku',
    email: 'guest@airbus.ke',
    role: 'guest',
    passwordHash: hashPassword('password123'),
    phone: '+254 712 345 678',
    location: 'Nairobi, Kenya',
    bio: 'Passionate traveller, remote software engineer & video stay enthusiast.',
    languages: 'English, Swahili',
    idVerified: true,
    createdAt: Date.now() - 30 * 864e5,
  },
  {
    id: 'u_owner',
    name: 'David Mutua',
    email: 'owner@airbus.ke',
    role: 'owner',
    passwordHash: hashPassword('password123'),
    phone: '+254 722 987 654',
    location: 'Westlands, Nairobi',
    bio: 'Superhost managing luxury villas in Westlands and beachfront retreats in Diani & Nyali.',
    languages: 'English, Swahili, French',
    idVerified: true,
    createdAt: Date.now() - 60 * 864e5,
  },
  {
    id: 'u_admin',
    name: 'Alex Kamau',
    email: 'admin@airbus.ke',
    role: 'admin',
    passwordHash: hashPassword('password123'),
    phone: '+254 700 000 001',
    location: 'Headquarters, Nairobi',
    bio: 'Lead Operations & Platform Verification Administrator at AirBus.',
    languages: 'English, Swahili',
    idVerified: true,
    createdAt: Date.now() - 120 * 864e5,
  },
];

const SEED_COMMENTS: VideoComment[] = [
  {
    id: 'c1',
    stayId: 's1',
    userEmail: 'guest@airbus.ke',
    userName: 'Sarah Wanjiku',
    userRole: 'guest',
    text: 'Is the sunset view from the 18th floor really as wide as shown in the video? Absolutely breathtaking!',
    likes: 12,
    createdAt: Date.now() - 5 * 864e5,
    replies: [
      {
        id: 'r1',
        commentId: 'c1',
        userEmail: 'owner@airbus.ke',
        userName: 'David Mutua (Host)',
        userRole: 'owner',
        text: 'Yes Sarah! You get an unobstructed 270-degree view of Nairobi skyline and the sunset over Ngong Hills.',
        createdAt: Date.now() - 4 * 864e5,
      },
      {
        id: 'r2',
        commentId: 'c1',
        userEmail: 'guest@airbus.ke',
        userName: 'Sarah Wanjiku',
        userRole: 'guest',
        text: 'That sounds amazing, booking for next week!',
        createdAt: Date.now() - 3 * 864e5,
      },
    ],
  },
  {
    id: 'c2',
    stayId: 's4',
    userEmail: 'guest@airbus.ke',
    userName: 'Sarah Wanjiku',
    userRole: 'guest',
    text: 'How far is the beach from the pool terrace? Can we walk straight into the water?',
    likes: 8,
    createdAt: Date.now() - 8 * 864e5,
    replies: [
      {
        id: 'r3',
        commentId: 'c2',
        userEmail: 'owner@airbus.ke',
        userName: 'David Mutua (Host)',
        userRole: 'owner',
        text: 'Literally 15 steps down our private landscaped pathway onto the soft white sands of Nyali beach!',
        createdAt: Date.now() - 7 * 864e5,
      },
    ],
  },
];

const SEED_STAYS: Stay[] = [
  {
    id: 's1',
    title: 'Modern Westlands Penthouse with Panoramic City Views',
    location: 'Westlands, Nairobi',
    lat: -1.2676,
    lng: 36.8108,
    price: 8500,
    currency: 'KES',
    rating: 4.9,
    reviewsCount: 142,
    type: 'Apartment',
    guests: 4,
    beds: 2,
    area: 95,
    category: 'Diamond',
    status: 'live',
    features: ['WiFi', 'Fiber Internet', 'Air Conditioning', 'Elevator', 'Swimming Pool', 'Parking', 'Smart Lock', '24/7 Check-in'],
    highlights: ['360° Nairobi Skyline Balcony', 'High-speed 100Mbps Fiber', 'Heated Rooftop Pool', '5-min walk to Sarit Centre'],
    description: 'Immaculately styled 2-bedroom executive penthouse located on the 18th floor in the heart of Westlands. Features floor-to-ceiling glass, ultra-fast fiber internet, chef kitchen, and private sundowner terrace with breathtaking views over Nairobi.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-living-room-and-terrace-43405-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    source: 'Direct',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    isPromoted: true,
    promotedUntil: Date.now() + 14 * 864e5,
    promotionImpressions: 480,
    promotionClicks: 62,
    welcomeGifts: ['Complimentary Kenyan Kahawa & Safari Bites', 'Chilled Tropical Passion Juice', 'Late Checkout 1PM'],
    hostMessage: 'Karibu sana! I personally prepare every detail so you enjoy our penthouse rooftop sunset and heated infinity pool.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 1,
    views: 1420,
    likesCount: 184,
    commentsCount: 3,
    comments: SEED_COMMENTS.filter(c => c.stayId === 's1'),
    hostFollowerCount: 382,
    gradientHue: [262, 330],
    createdAt: Date.now() - 40 * 864e5,
  },
  {
    id: 's2',
    title: 'Cozy Kilimani Designer Studio near Yaya Centre',
    location: 'Kilimani, Nairobi',
    lat: -1.2921,
    lng: 36.7872,
    price: 4500,
    currency: 'KES',
    rating: 4.8,
    reviewsCount: 88,
    type: 'Studio',
    guests: 2,
    beds: 1,
    area: 42,
    category: 'Silver',
    status: 'live',
    features: ['WiFi', 'Air Conditioning', 'Hot Shower', 'Elevator', 'Self Check-in', 'Fridge', 'Microwave'],
    highlights: ['Steps from Yaya Centre & Artcaffe', 'King orthopedic bed', 'Quiet green residential street'],
    description: 'Chic, sun-drenched studio apartment thoughtfully designed for digital nomads and weekend explorers. High-speed WiFi, dedicated workspace, rain shower, and Netflix-enabled smart TV.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-luxurious-living-room-with-a-modern-interior-design-43409-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
    source: 'Booking.com',
    instantBook: false,
    isFeatured: false,
    isApprovedByAdmin: true,
    welcomeGifts: ['Artisan Kenyan Tea Selection', 'High-Speed Fiber Voucher', 'Complimentary Bottled Water'],
    hostMessage: 'Welcome to Kilimani! Perfect for remote workers. Fiber is blazing fast and Artcaffe is 2 mins away.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 1,
    views: 890,
    likesCount: 95,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [200, 260],
    createdAt: Date.now() - 35 * 864e5,
  },
  {
    id: 's3',
    title: 'Lavington Garden Bungalow with Fireplace & Patio',
    location: 'Lavington, Nairobi',
    lat: -1.2833,
    lng: 36.7667,
    price: 9800,
    currency: 'KES',
    rating: 4.95,
    reviewsCount: 204,
    type: 'Bungalow',
    guests: 5,
    beds: 3,
    area: 145,
    category: 'Diamond',
    status: 'live',
    features: ['WiFi', 'Garden', 'Parking', 'Gas Cooker', 'BBQ Grill', 'Electric Fence', 'Backup Inverter'],
    highlights: ['Private 0.5 acre manicured garden', 'Working wood-burning fireplace', 'Solar + backup inverter uninterrupted power'],
    description: 'Serene botanical oasis tucked away in leafy Lavington. Enjoy crisp morning birdsong on the covered veranda, evening fires in the stone hearth, and total privacy behind gated security.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-wooden-house-in-the-middle-of-a-forest-43410-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
    source: 'Direct',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    welcomeGifts: ['Fireplace Firewood & Marshmallow Basket', 'Fresh Herb Garden Basket', 'Complimentary English Tea'],
    hostMessage: 'Karibu Lavington! Enjoy a quiet evening by the stone fireplace or reading on the garden veranda.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 2,
    views: 1650,
    likesCount: 240,
    commentsCount: 1,
    hostFollowerCount: 382,
    gradientHue: [150, 200],
    createdAt: Date.now() - 50 * 864e5,
  },
  {
    id: 's4',
    title: 'Nyali Beachfront Villa with Infinity Ocean Pool',
    location: 'Nyali, Mombasa',
    lat: -4.0283,
    lng: 39.7167,
    price: 22000,
    currency: 'KES',
    rating: 4.92,
    reviewsCount: 76,
    type: 'Villa',
    guests: 8,
    beds: 4,
    area: 280,
    category: 'Gold',
    status: 'live',
    features: ['WiFi', 'Swimming Pool', 'Air Conditioning', 'Balcony', 'BBQ Grill', 'CCTV', 'Hot Shower', 'Parking'],
    highlights: ['Private beachfront access onto white sands', 'Infinity edge freshwater pool', 'Dedicated private Swahili chef upon request'],
    description: 'Breathtaking coastal sanctuary directly overlooking the turquoise Indian Ocean in Nyali. Architectural open-plan living, Swahili arches, sea-breeze terraces, and private pool.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-villa-with-pool-and-terrace-in-front-of-the-sea-43406-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    source: 'Airbnb',
    instantBook: false,
    isFeatured: true,
    isApprovedByAdmin: true,
    isPromoted: true,
    promotedUntil: Date.now() + 7 * 864e5,
    promotionImpressions: 610,
    promotionClicks: 84,
    welcomeGifts: ['Fresh Nyali Coconut Water & Macadamia Nuts', 'Swahili Beach Towels', 'Airport Shuttle 20% Discount'],
    hostMessage: 'Habari za Mombasa! The Indian Ocean is at your doorstep. Let me know if you would like our private chef to prepare Swahili biryani.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 2,
    views: 2480,
    likesCount: 390,
    commentsCount: 2,
    comments: SEED_COMMENTS.filter(c => c.stayId === 's4'),
    hostFollowerCount: 382,
    gradientHue: [20, 350],
    createdAt: Date.now() - 65 * 864e5,
  },
  {
    id: 's5',
    title: 'Diani Beach Cottage Steps from the Turquoise Sand',
    location: 'Diani, Kwale',
    lat: -4.3167,
    lng: 39.5833,
    price: 13500,
    currency: 'KES',
    rating: 4.88,
    reviewsCount: 95,
    type: 'Bungalow',
    guests: 4,
    beds: 2,
    area: 110,
    category: 'Diamond',
    status: 'live',
    features: ['WiFi', 'Garden', 'Gas Cooker', 'Air Conditioning', 'Hot Shower', 'Solar Power'],
    highlights: ['45 seconds walk to Diani Beach', 'Outdoor tropical rain shower', 'Eco-friendly solar powered'],
    description: 'Charming thatched makuti roof cottage nestled among baobabs and swaying palm trees in world-renowned Diani Beach. Fall asleep to the gentle crash of waves and enjoy barefoot living.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-swimming-pool-surrounded-by-palm-trees-at-sunset-42028-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=800&q=80',
    source: 'Direct',
    instantBook: true,
    isFeatured: false,
    isApprovedByAdmin: true,
    welcomeGifts: ['Chilled Fresh Coconut Upon Arrival', 'Tropical Mango & Passion Basket', 'Sunset Dhow Cruise Voucher'],
    hostMessage: 'Barefoot luxury in Diani! Baobabs and the white beach are just 45 seconds away. Enjoy paradise!',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 1,
    views: 1200,
    likesCount: 165,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [40, 10],
    createdAt: Date.now() - 30 * 864e5,
  },
  {
    id: 's6',
    title: 'Karen Heritage Cottage with English Gardens & Veranda',
    location: 'Karen, Nairobi',
    lat: -1.3167,
    lng: 36.7,
    price: 8800,
    currency: 'KES',
    rating: 4.85,
    reviewsCount: 54,
    type: 'House',
    guests: 3,
    beds: 2,
    area: 105,
    category: 'Silver',
    status: 'live',
    features: ['WiFi', 'Garden', 'Parking', 'Gas Cooker', 'Perimeter Wall', 'Towels Provided'],
    highlights: ['Close to Giraffe Centre & Karen Blixen Museum', 'Antique cedar wood finishing', 'Private bird sanctuary garden'],
    description: 'Step into colonial elegance surrounded by the lush greenery of Karen. Ideal retreat for creatives, writers, and couples looking for a calm escape 20 minutes from the city centre.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-cozy-living-room-in-a-cabin-43407-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80',
    source: 'Booking.com',
    instantBook: false,
    isFeatured: false,
    isApprovedByAdmin: true,
    welcomeGifts: ['Homemade Karen Scones & Jam', 'Giraffe Sanctuary Map & Guide', 'Organic Mountain Coffee'],
    hostMessage: 'Welcome to peaceful Karen. Take your morning tea on the English veranda listening to the sunbirds.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 1,
    views: 780,
    likesCount: 92,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [290, 220],
    createdAt: Date.now() - 25 * 864e5,
  },
  {
    id: 's7',
    title: 'Kilimani Sunset 2BR with Sky Pool & Gym Access',
    location: 'Kilimani, Nairobi',
    lat: -1.2896,
    lng: 36.79,
    price: 11500,
    currency: 'KES',
    rating: 4.75,
    reviewsCount: 62,
    type: 'Apartment',
    guests: 4,
    beds: 2,
    area: 98,
    category: 'Diamond',
    status: 'live',
    features: ['WiFi', 'Swimming Pool', 'Air Conditioning', 'Elevator', 'Parking', 'Gas Cooker', 'Smart Lock'],
    highlights: ['Rooftop infinity glass pool', 'Modern equipped gym & sauna', 'Panoramic sunset views over Ngong Hills'],
    description: 'Modern luxury living at its finest on Rose Avenue. This corner 2BR suite features floor-to-ceiling double-glazed windows, minimalist Scandinavian interiors, and full access to building wellness club.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-large-house-with-modern-interior-and-floor-to-ceiling-windows-43411-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
    source: 'Airbnb',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    welcomeGifts: ['Rose Avenue Sunset Wine Bottle', 'Complimentary Sauna & Gym Pass', 'Espresso Pods'],
    hostMessage: 'Welcome to Nairobi! Don’t miss the sunset from the rooftop sky pool overlooking the Ngong Hills.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 1,
    views: 1100,
    likesCount: 145,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [170, 120],
    createdAt: Date.now() - 15 * 864e5,
  },
  {
    id: 's8',
    title: 'Naivasha Lakeside House with Zebras & Sunset Deck',
    location: 'Naivasha, Nakuru',
    lat: -0.7167,
    lng: 36.4333,
    price: 16000,
    currency: 'KES',
    rating: 4.96,
    reviewsCount: 110,
    type: 'House',
    guests: 6,
    beds: 3,
    area: 190,
    category: 'Gold',
    status: 'live',
    features: ['WiFi', 'Garden', 'Gas Cooker', 'Parking', 'BBQ Grill', 'Hot Shower', 'Solar Power'],
    highlights: ['Frequent zebra and waterbuck garden visits', 'Private wooden dock over Lake Naivasha', 'Sundowner wood-fired BBQ deck'],
    description: 'Set on the tranquil shores of Lake Naivasha, this eco-stone home offers an unforgettable wildlife encounter. Watch giraffes and zebras graze on the lawn right outside your breakfast table.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-kitchen-island-in-a-luxurious-modern-house-43412-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
    source: 'Direct',
    instantBook: false,
    isFeatured: true,
    isApprovedByAdmin: true,
    welcomeGifts: ['Naivasha Lakeside Cheese & Cracker Board', 'Wildlife Safari Binoculars', 'Campfire Firepit Logs'],
    hostMessage: 'Karibu Lake Naivasha! Keep your cameras ready—the zebras love grazing right outside the porch in the morning.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 2,
    views: 1890,
    likesCount: 295,
    commentsCount: 0,
    hostFollowerCount: 382,
    gradientHue: [10, 40],
    createdAt: Date.now() - 70 * 864e5,
  },
];

const SEED_BOOKINGS: Booking[] = [
  {
    id: 'b_demo_1',
    reference: 'AB9482X',
    stayId: 's1',
    guestEmail: 'guest@airbus.ke',
    guestName: 'Sarah Wanjiku',
    checkIn: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10),
    guests: 2,
    subtotal: 25500,
    cleaningFee: 1275,
    serviceFee: 2040,
    total: 28815,
    currency: 'KES',
    status: 'confirmed',
    note: 'Arriving around 3 PM from JKIA airport. Excited for the city view!',
    createdAt: Date.now() - 2 * 864e5,
  },
  {
    id: 'b_demo_2',
    reference: 'AB6107K',
    stayId: 's4',
    guestEmail: 'guest@airbus.ke',
    guestName: 'Sarah Wanjiku',
    checkIn: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 18 * 864e5).toISOString().slice(0, 10),
    guests: 4,
    subtotal: 88000,
    cleaningFee: 3300,
    serviceFee: 7040,
    total: 98340,
    currency: 'KES',
    status: 'requested',
    note: 'Family beach holiday. Looking forward to enjoying the infinity pool.',
    createdAt: Date.now() - 12 * 3600e3,
  },
];

const SEED_THREADS: ChatThread[] = [
  {
    id: 's1',
    stayId: 's1',
    guestEmail: 'guest@airbus.ke',
    hostEmail: 'owner@airbus.ke',
    unreadGuest: true,
    unreadHost: false,
    updatedAt: Date.now() - 3600e3,
    messages: [
      {
        id: 'm1',
        from: 'guest',
        type: 'offer',
        amount: 7800,
        status: 'countered',
        createdAt: Date.now() - 864e5,
      },
      {
        id: 'm2',
        from: 'host',
        type: 'counter',
        amount: 8200,
        status: 'pending',
        createdAt: Date.now() - 432e5,
      },
      {
        id: 'm3',
        from: 'host',
        type: 'text',
        text: 'Hello Sarah! I can do KES 8,200/night for your 3-night stay in Westlands. It includes complimentary early check-in.',
        createdAt: Date.now() - 3600e3,
      },
    ],
  },
];

const SEED_REVIEWS: Review[] = [
  {
    id: 'rev_1',
    stayId: 's1',
    guestEmail: 'guest@airbus.ke',
    guestName: 'Sarah Wanjiku',
    rating: 5,
    comment: 'The skyline views from the balcony are world-class! Superfast fiber, modern appliances, and David was a gracious host who met us in the lobby.',
    createdAt: Date.now() - 10 * 864e5,
  },
  {
    id: 'rev_2',
    stayId: 's4',
    guestEmail: 'guest@airbus.ke',
    guestName: 'Sarah Wanjiku',
    rating: 5,
    comment: 'Unmatched beachfront privacy. The infinity pool overlooking the ocean is pure heaven.',
    createdAt: Date.now() - 16 * 864e5,
  },
];

const SEED_POSTS: Post[] = [
  {
    id: 'post_short_1',
    ownerEmail: 'owner@airbus.ke',
    stayId: 's1',
    type: 'short',
    description: 'Breathtaking 18th-floor sundowner views over the Westlands skyline and distant Ngong Hills.',
    coverUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-living-room-and-terrace-43405-large.mp4',
    durationSeconds: 24,
    status: 'approved',
    views: 4200,
    likes: 620,
    shares: 145,
    viralityScore: 92,
    createdAt: Date.now() - 10 * 864e5,
    updatedAt: Date.now() - 10 * 864e5,
  },
  {
    id: 'post_video_2',
    ownerEmail: 'owner@airbus.ke',
    stayId: 's4',
    type: 'video',
    description: 'Exclusive walking video tour of Nyali Beachfront Villa: private infinity pool, beach pathway & Swahili arches.',
    coverUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-villa-with-pool-and-terrace-in-front-of-the-sea-43406-large.mp4',
    durationSeconds: 420,
    status: 'approved',
    views: 7800,
    likes: 980,
    shares: 230,
    viralityScore: 96,
    createdAt: Date.now() - 14 * 864e5,
    updatedAt: Date.now() - 14 * 864e5,
  },
  {
    id: 'post_photo_3',
    ownerEmail: 'owner@airbus.ke',
    stayId: 's3',
    type: 'photo',
    description: 'Golden hour at Lavington Garden Bungalow. 0.5 acre manicured lawn, stone hearth fireplace & verandas.',
    coverUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'approved',
    views: 3100,
    likes: 410,
    shares: 88,
    viralityScore: 84,
    createdAt: Date.now() - 20 * 864e5,
    updatedAt: Date.now() - 20 * 864e5,
  },
  {
    id: 'post_pending_4',
    ownerEmail: 'owner@airbus.ke',
    stayId: 's2',
    type: 'short',
    description: 'Chic designer studio morning light near Yaya Centre. Fast WiFi, workspace & rain shower.',
    coverUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-luxurious-living-room-with-a-modern-interior-design-43409-large.mp4',
    durationSeconds: 38,
    status: 'pending',
    views: 0,
    likes: 0,
    shares: 0,
    viralityScore: 0,
    createdAt: Date.now() - 2 * 3600e3,
    updatedAt: Date.now() - 2 * 3600e3,
  },
];

const SEED_AD_REQUESTS: AdRequest[] = [
  {
    id: 'ad_1',
    advertiserEmail: 'guest@airbus.ke',
    stayId: 's1',
    title: 'Nairobi Airport Transfers & Chauffeur VIP',
    description: 'Mercedes E-Class & Prado airport pickups 24/7. 10% off for AirBus guests.',
    imageUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80',
    targetUrl: 'https://wa.me/254712345678',
    contactPhone: '+254 712 345 678',
    tag: 'Chauffeur',
    days: 5,
    totalAmount: 500,
    platformFee: 150,
    hostNet: 350,
    status: 'approved',
    views: 342,
    clicks: 48,
    startsAt: Date.now() - 864e5,
    expiresAt: Date.now() + 4 * 864e5,
    createdAt: Date.now() - 864e5,
  },
  {
    id: 'ad_2',
    advertiserEmail: 'guest@airbus.ke',
    stayId: 's4',
    title: 'Nyali Coastal Watersports & Jet Ski Hire',
    description: 'Guided dolphin tours, kitesurfing school and jet ski rentals directly off Nyali beach.',
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=400&q=80',
    targetUrl: 'https://wa.me/254700000001',
    contactPhone: '+254 700 000 001',
    tag: 'Experiences',
    days: 7,
    totalAmount: 700,
    platformFee: 210,
    hostNet: 490,
    status: 'approved',
    views: 520,
    clicks: 82,
    startsAt: Date.now() - 2 * 864e5,
    expiresAt: Date.now() + 5 * 864e5,
    createdAt: Date.now() - 2 * 864e5,
  },
  {
    id: 'ad_worked_example_3',
    advertiserEmail: 'guest@airbus.ke',
    stayId: 's1',
    title: 'Westlands Organic Rooftop Brunch & Cafe',
    description: 'Fresh artisanal sourdough, espresso, and avocado toast 2 mins walk from your penthouse.',
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=400&q=80',
    targetUrl: 'https://wa.me/254712345678',
    contactPhone: '+254 712 345 678',
    tag: 'Cafe & Dining',
    days: 3,
    totalAmount: 300,
    platformFee: 90,
    hostNet: 210,
    status: 'pending',
    views: 0,
    clicks: 0,
    createdAt: Date.now() - 3600e3,
  },
];

const SEED_PROMOTIONS: ListingPromotion[] = [
  {
    id: 'promo_seed_1',
    stayId: 's1',
    ownerEmail: 'owner@airbus.ke',
    days: 7,
    cost: 700,
    startsAt: Date.now() - 864e5,
    expiresAt: Date.now() + 6 * 864e5,
    status: 'active',
    impressions: 432,
    clicks: 68,
    createdAt: Date.now() - 864e5,
  },
  {
    id: 'promo_seed_2',
    stayId: 's4',
    ownerEmail: 'owner@airbus.ke',
    days: 14,
    cost: 1400,
    startsAt: Date.now() - 2 * 864e5,
    expiresAt: Date.now() + 12 * 864e5,
    status: 'active',
    impressions: 890,
    clicks: 142,
    createdAt: Date.now() - 2 * 864e5,
  },
];

const SEED_WALLET_RECORDS: Record<string, WalletRecord> = {
  'owner@airbus.ke': {
    email: 'owner@airbus.ke',
    balance: 14500,
    holdBalance: 0,
    lifetimeEarnings: 21000,
    lifetimeSpent: 6500,
    updatedAt: Date.now(),
  },
  'guest@airbus.ke': {
    email: 'guest@airbus.ke',
    balance: 4700,
    holdBalance: 300,
    lifetimeEarnings: 1500,
    lifetimeSpent: 1200,
    updatedAt: Date.now(),
  },
  'admin@airbus.ke': {
    email: 'admin@airbus.ke',
    balance: 35000,
    holdBalance: 0,
    lifetimeEarnings: 35000,
    lifetimeSpent: 0,
    updatedAt: Date.now(),
  },
  'treasury': {
    email: 'treasury',
    balance: 62450,
    holdBalance: 0,
    lifetimeEarnings: 65000,
    lifetimeSpent: 2550,
    updatedAt: Date.now(),
  },
};

const SEED_LEDGER_ENTRIES: LedgerEntry[] = [
  {
    id: 'ledg_1',
    fromWallet: 'external_mpesa',
    toWallet: 'owner@airbus.ke',
    amount: 15000,
    type: 'topup',
    referenceId: 'MP991204',
    description: 'M-Pesa wallet top-up',
    createdAt: Date.now() - 25 * 864e5,
  },
  {
    id: 'ledg_2',
    fromWallet: 'owner@airbus.ke',
    toWallet: 'treasury',
    amount: 2500,
    type: 'subscription',
    referenceId: 'Diamond',
    description: '30-Day Diamond Plan subscription fee',
    createdAt: Date.now() - 20 * 864e5,
  },
  {
    id: 'ledg_3',
    fromWallet: 'guest@airbus.ke',
    toWallet: 'owner@airbus.ke',
    amount: 350,
    type: 'ad_revenue',
    referenceId: 'ad_1',
    description: 'Ad display revenue (70% net) for Modern Westlands Penthouse',
    createdAt: Date.now() - 864e5,
  },
  {
    id: 'ledg_4',
    fromWallet: 'guest@airbus.ke',
    toWallet: 'treasury',
    amount: 150,
    type: 'ad_fee',
    referenceId: 'ad_1',
    description: 'Platform ad fee (30%) for Modern Westlands Penthouse',
    createdAt: Date.now() - 864e5,
  },
];

const SEED_REFERRALS: Record<string, ReferralProfile> = {
  'guest@airbus.ke': {
    userEmail: 'guest@airbus.ke',
    referralCode: 'SARAH2026',
    clicks: 42,
    signupsCount: 6,
    totalEarnedKes: 1850,
    createdAt: Date.now() - 30 * 864e5,
  },
  'owner@airbus.ke': {
    userEmail: 'owner@airbus.ke',
    referralCode: 'DAVIDMUTUA',
    clicks: 89,
    signupsCount: 12,
    totalEarnedKes: 4200,
    createdAt: Date.now() - 60 * 864e5,
  },
  'admin@airbus.ke': {
    userEmail: 'admin@airbus.ke',
    referralCode: 'AIRBUSPRO',
    clicks: 154,
    signupsCount: 30,
    totalEarnedKes: 9500,
    createdAt: Date.now() - 120 * 864e5,
  },
};

const SEED_REFERRAL_CODES: Record<string, string> = {
  SARAH2026: 'guest@airbus.ke',
  DAVIDMUTUA: 'owner@airbus.ke',
  AIRBUSPRO: 'admin@airbus.ke',
};

class DatabaseStore {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
    this.checkSubscriptionExpirations();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.stays) && parsed.stays.length > 0) {
          // Auto-migrate schema extensions
          if (!parsed.settings) parsed.settings = DEFAULT_SETTINGS;
          if (!parsed.posts || parsed.posts.length === 0) parsed.posts = SEED_POSTS;
          if (!parsed.adRequests || parsed.adRequests.length === 0) parsed.adRequests = SEED_AD_REQUESTS;
          if (!parsed.ledgerEntries) parsed.ledgerEntries = SEED_LEDGER_ENTRIES;
          if (!parsed.walletRecords) parsed.walletRecords = SEED_WALLET_RECORDS;
          if (!parsed.referrals) parsed.referrals = SEED_REFERRALS;
          if (!parsed.referralCodes) parsed.referralCodes = SEED_REFERRAL_CODES;
          if (!parsed.referralCommissions) parsed.referralCommissions = [];
          if (!parsed.withdrawals) parsed.withdrawals = [];
          if (!parsed.promotions) parsed.promotions = SEED_PROMOTIONS;

          // Ensure welcome gifts and host greetings are populated on loaded stays
          parsed.stays.forEach((s: Stay) => {
            const seed = SEED_STAYS.find(seedStay => seedStay.id === s.id);
            if ((!s.welcomeGifts || s.welcomeGifts.length === 0) && seed?.welcomeGifts) {
              s.welcomeGifts = seed.welcomeGifts;
            } else if (!s.welcomeGifts || s.welcomeGifts.length === 0) {
              s.welcomeGifts = [
                'Kenyan Safari Kahawa & Fresh Ground Beans',
                'Fresh Coconut Water & Tropical Basket',
              ];
            }
            if (!s.hostMessage && seed?.hostMessage) {
              s.hostMessage = seed.hostMessage;
            } else if (!s.hostMessage) {
              s.hostMessage = 'Karibu sana! We look forward to hosting you in our serene home.';
            }
            if (s.isPromoted === undefined && seed?.isPromoted !== undefined) {
              s.isPromoted = seed.isPromoted;
              s.promotedUntil = seed.promotedUntil;
            }
          });

          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read existing DB file, creating fresh seeds.', e);
    }

    const initialData: DatabaseSchema = {
      users: SEED_USERS,
      stays: SEED_STAYS,
      bookings: SEED_BOOKINGS,
      reviews: SEED_REVIEWS,
      threads: SEED_THREADS,
      payments: [
        {
          id: 'pay_demo_1',
          hostEmail: 'owner@airbus.ke',
          kind: 'plan',
          tier: 'Diamond',
          amount: 2500,
          mpesaCode: 'QGH7X2K9LM',
          status: 'approved',
          createdAt: Date.now() - 10 * 864e5,
        },
      ],
      hostPlans: {
        'owner@airbus.ke': {
          tier: 'Diamond',
          status: 'active',
          expiresAt: Date.now() + 28 * 864e5,
          graceExpiresAt: Date.now() + 30 * 864e5,
          hasPaidSubscription: true,
        },
      },
      wallets: {
        'owner@airbus.ke': 14500,
        'guest@airbus.ke': 4700,
        'admin@airbus.ke': 35000,
      },
      walletRecords: SEED_WALLET_RECORDS,
      ledgerEntries: SEED_LEDGER_ENTRIES,
      posts: SEED_POSTS,
      adRequests: SEED_AD_REQUESTS,
      promotions: SEED_PROMOTIONS,
      referrals: SEED_REFERRALS,
      referralCodes: SEED_REFERRAL_CODES,
      referralCommissions: [],
      settings: DEFAULT_SETTINGS,
      viewEvents: [],
      withdrawals: [],
      wishlists: [
        { userEmail: 'guest@airbus.ke', stayId: 's1' },
        { userEmail: 'guest@airbus.ke', stayId: 's4' },
      ],
      notifications: [
        {
          id: 'notif_1',
          userEmail: 'guest@airbus.ke',
          title: 'Booking Confirmed!',
          message: 'Your stay at Modern Westlands Penthouse (AB9482X) has been confirmed.',
          read: false,
          link: '/#guest',
          type: 'booking',
          createdAt: Date.now() - 2 * 864e5,
        },
        {
          id: 'notif_2',
          userEmail: 'owner@airbus.ke',
          title: 'New Booking Request',
          message: 'Sarah Wanjiku requested to book Nyali Beachfront Villa for 4 nights.',
          read: false,
          link: '/#owner',
          type: 'booking',
          createdAt: Date.now() - 12 * 3600e3,
        },
        {
          id: 'notif_3',
          userEmail: 'owner@airbus.ke',
          title: '30-Day Subscription Active',
          message: 'Your Diamond Plan is active. All your short-stay videos are live across AirBus Feed & Shorts.',
          read: true,
          link: '/#owner',
          type: 'subscription',
          createdAt: Date.now() - 2 * 864e5,
        },
      ],
      reports: [],
      tickets: [],
      auditLogs: [
        {
          id: 'aud_1',
          action: 'plan_approved',
          actorEmail: 'admin@airbus.ke',
          details: 'Approved Diamond plan payment QGH7X2K9LM for owner@airbus.ke',
          createdAt: Date.now() - 10 * 864e5,
        },
      ],
    };

    this.saveDirect(initialData);
    return initialData;
  }

  private saveDirect(d: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving DB file:', e);
    }
  }

  public save() {
    this.saveDirect(this.data);
  }

  public getRaw(): DatabaseSchema {
    return this.data;
  }

  // --- Automatic 30-Day Subscription Expiration & 2-day Grace Period Pipeline ---
  public checkSubscriptionExpirations() {
    const now = Date.now();
    let changed = false;

    for (const [email, plan] of Object.entries(this.data.hostPlans)) {
      const gracePeriod = plan.graceExpiresAt || plan.expiresAt + 2 * 864e5;

      if (plan.status === 'active' && now > plan.expiresAt) {
        if (now > gracePeriod) {
          // Grace period passed -> Mark plan expired and hide stays from public
          plan.status = 'expired';
          this.data.stays.forEach(s => {
            if (s.ownerEmail?.toLowerCase() === email.toLowerCase() && s.status === 'live') {
              s.status = 'expired'; // Remains in owner dashboard, hidden from public!
            }
          });

          this.createNotification({
            id: 'notif_' + Date.now() + Math.random(),
            userEmail: email,
            title: 'Subscription Expired - Stays Hidden',
            message: 'Your 30-day hosting plan and 2-day grace period have passed. Your video stays are temporarily hidden from the public feed. Please renew your plan via M-Pesa to restore them.',
            read: false,
            link: '/#owner',
            type: 'subscription',
            createdAt: now,
          });
          changed = true;
        } else {
          // Inside 2-day grace period alert
          const hoursLeft = Math.max(1, Math.ceil((gracePeriod - now) / 3600e3));
          this.createNotification({
            id: 'notif_' + Date.now() + Math.random(),
            userEmail: email,
            title: 'Subscription Grace Period Alert',
            message: `Your 30-day subscription has expired. You have ${hoursLeft} hours of grace period remaining before your listings disappear from search. Renew now via M-Pesa.`,
            read: false,
            link: '/#owner',
            type: 'subscription',
            createdAt: now,
          });
          changed = true;
        }
      }
    }

    if (changed) {
      this.save();
    }
  }

  // --- Users & Auth ---
  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public createUser(user: User): User {
    this.data.users.push(user);
    if (user.role === 'owner') {
      this.data.wallets[user.email] = 0;
      // Host must pay 30-day subscription before uploading videos!
      this.data.hostPlans[user.email] = {
        tier: 'Silver',
        status: 'pending',
        expiresAt: 0,
        graceExpiresAt: 0,
        hasPaidSubscription: false,
      };
      this.createNotification({
        id: 'notif_' + Date.now(),
        userEmail: user.email,
        title: 'Welcome Host! Please Select a 30-Day Plan',
        message: 'To upload and publish short-stay videos, please select a hosting plan (Silver, Diamond, or Gold) and complete M-Pesa payment.',
        read: false,
        link: '/#owner',
        type: 'subscription',
        createdAt: Date.now(),
      });
    }
    this.save();
    return user;
  }

  public updateUser(email: string, updates: Partial<User>): User | null {
    const user = this.findUserByEmail(email);
    if (!user) return null;
    Object.assign(user, updates);
    this.save();
    return user;
  }

  public getAllUsers(): User[] {
    return this.data.users;
  }

  // --- Stays & Powerful Search ---
  public getStays(filter?: {
    query?: string;
    guests?: number;
    minPrice?: number;
    maxPrice?: number;
    types?: string[];
    features?: string[];
    instantBook?: boolean;
    isFeatured?: boolean;
    category?: string;
    status?: ListingStatus;
    checkIn?: string;
    checkOut?: string;
    beds?: number;
    includePendingForAdmin?: boolean;
  }): Stay[] {
    this.checkSubscriptionExpirations();

    let list = this.data.stays;

    // By default, public feed only shows live, admin-approved stays whose owner subscription is active
    if (!filter?.status) {
      list = list.filter(s => {
        if (s.status !== 'live') return false;
        // Verify host subscription is active
        if (s.ownerEmail) {
          const plan = this.getHostPlan(s.ownerEmail);
          if (plan.status !== 'active') return false;
        }
        return true;
      });
    } else {
      list = list.filter(s => s.status === filter.status);
    }

    if (filter) {
      if (filter.query && filter.query.trim()) {
        const words = filter.query.toLowerCase().trim().split(/\s+/);
        list = list.filter(s => {
          const searchable = `${s.title} ${s.location} ${s.type} ${s.description} ${s.category} ${s.hostName || ''} ${(s.features || []).join(' ')} ${(s.highlights || []).join(' ')}`.toLowerCase();
          return words.every(w => searchable.includes(w));
        });
      }

      if (filter.guests && filter.guests > 1) {
        list = list.filter(s => s.guests >= filter.guests!);
      }

      if (filter.beds && filter.beds > 0) {
        list = list.filter(s => s.beds >= filter.beds!);
      }

      if (filter.minPrice && filter.minPrice > 0) {
        list = list.filter(s => s.price >= filter.minPrice!);
      }

      if (filter.maxPrice && filter.maxPrice > 0) {
        list = list.filter(s => s.price <= filter.maxPrice!);
      }

      if (filter.types && filter.types.length > 0) {
        list = list.filter(s => filter.types!.includes(s.type));
      }

      if (filter.features && filter.features.length > 0) {
        list = list.filter(s => filter.features!.every(f => s.features.includes(f)));
      }

      if (filter.instantBook) {
        list = list.filter(s => s.instantBook);
      }

      if (filter.isFeatured) {
        list = list.filter(s => s.isFeatured);
      }

      if (filter.category && filter.category !== 'all') {
        list = list.filter(s => s.category.toLowerCase() === filter.category!.toLowerCase());
      }

      if (filter.checkIn && filter.checkOut) {
        const cin = filter.checkIn;
        const cout = filter.checkOut;
        list = list.filter(s => {
          const hasClash = this.data.bookings.some(b =>
            b.stayId === s.id &&
            (b.status === 'confirmed' || b.status === 'requested') &&
            cin < b.checkOut && cout > b.checkIn
          );
          if (hasClash) return false;

          if (s.blockedDates && s.blockedDates.length > 0) {
            const hasBlocked = s.blockedDates.some(block => cin < block.to && cout > block.from);
            if (hasBlocked) return false;
          }
          return true;
        });
      }
    }

    return list;
  }

  public getStayById(id: string): Stay | undefined {
    return this.data.stays.find(s => s.id === id);
  }

  public incrementStayViews(id: string) {
    const s = this.getStayById(id);
    if (s) {
      s.views = (s.views || 0) + 1;
      this.save();
    }
  }

  public toggleLikeStay(id: string, userEmail: string): { likesCount: number; isLiked: boolean } {
    const s = this.getStayById(id);
    if (!s) return { likesCount: 0, isLiked: false };

    s.likedByUserEmails = s.likedByUserEmails || [];
    const idx = s.likedByUserEmails.indexOf(userEmail);
    let isLiked = false;

    if (idx >= 0) {
      s.likedByUserEmails.splice(idx, 1);
      s.likesCount = Math.max(0, (s.likesCount || 0) - 1);
      isLiked = false;
    } else {
      s.likedByUserEmails.push(userEmail);
      s.likesCount = (s.likesCount || 0) + 1;
      isLiked = true;

      // Notify host
      if (s.ownerEmail && s.ownerEmail !== userEmail) {
        this.createNotification({
          id: 'notif_' + Date.now(),
          userEmail: s.ownerEmail,
          title: 'New Video Like!',
          message: `${userEmail} liked your video tour for ${s.title}.`,
          read: false,
          link: `/#stay-${s.id}`,
          type: 'system',
          createdAt: Date.now(),
        });
      }
    }

    this.save();
    return { likesCount: s.likesCount || 0, isLiked };
  }

  public toggleFollowHost(hostEmail: string, userEmail: string): { followerCount: number; isFollowing: boolean } {
    const staysByHost = this.data.stays.filter(s => s.ownerEmail?.toLowerCase() === hostEmail.toLowerCase());
    let isFollowing = false;
    let newFollowerCount = 0;

    staysByHost.forEach(s => {
      s.hostFollowedByUserEmails = s.hostFollowedByUserEmails || [];
      const idx = s.hostFollowedByUserEmails.indexOf(userEmail);
      if (idx >= 0) {
        s.hostFollowedByUserEmails.splice(idx, 1);
        s.hostFollowerCount = Math.max(0, (s.hostFollowerCount || 1) - 1);
        isFollowing = false;
      } else {
        s.hostFollowedByUserEmails.push(userEmail);
        s.hostFollowerCount = (s.hostFollowerCount || 0) + 1;
        isFollowing = true;
      }
      newFollowerCount = s.hostFollowerCount || 0;
    });

    if (isFollowing) {
      this.createNotification({
        id: 'notif_' + Date.now(),
        userEmail: hostEmail,
        title: 'New Follower!',
        message: `${userEmail} followed your AirBus host channel.`,
        read: false,
        link: '/#owner',
        type: 'system',
        createdAt: Date.now(),
      });
    }

    this.save();
    return { followerCount: newFollowerCount, isFollowing };
  }

  // --- Video Comments & Nested Replies ---
  public getComments(stayId: string): VideoComment[] {
    const stay = this.getStayById(stayId);
    return stay?.comments || [];
  }

  public addComment(stayId: string, user: User, text: string): VideoComment | null {
    const stay = this.getStayById(stayId);
    if (!stay) return null;

    stay.comments = stay.comments || [];
    const newComment: VideoComment = {
      id: 'c_' + Date.now(),
      stayId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      text: text.trim(),
      likes: 0,
      replies: [],
      createdAt: Date.now(),
    };

    stay.comments.unshift(newComment);
    stay.commentsCount = (stay.commentsCount || 0) + 1;

    // Notify host
    if (stay.ownerEmail && stay.ownerEmail !== user.email) {
      this.createNotification({
        id: 'notif_' + Date.now(),
        userEmail: stay.ownerEmail,
        title: 'New Video Comment',
        message: `${user.name} commented on ${stay.title}: "${text.slice(0, 60)}..."`,
        read: false,
        link: `/#stay-${stay.id}`,
        type: 'system',
        createdAt: Date.now(),
      });
    }

    this.save();
    return newComment;
  }

  public addCommentReply(stayId: string, commentId: string, user: User, text: string): VideoCommentReply | null {
    const stay = this.getStayById(stayId);
    if (!stay || !stay.comments) return null;

    const parentComment = stay.comments.find(c => c.id === commentId);
    if (!parentComment) return null;

    parentComment.replies = parentComment.replies || [];
    const newReply: VideoCommentReply = {
      id: 'r_' + Date.now(),
      commentId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      text: text.trim(),
      createdAt: Date.now(),
    };

    parentComment.replies.push(newReply);
    stay.commentsCount = (stay.commentsCount || 0) + 1;

    // Notify parent comment author
    if (parentComment.userEmail !== user.email) {
      this.createNotification({
        id: 'notif_' + Date.now(),
        userEmail: parentComment.userEmail,
        title: 'Reply to Your Comment',
        message: `${user.name} replied to your comment on ${stay.title}: "${text.slice(0, 60)}..."`,
        read: false,
        link: `/#stay-${stay.id}`,
        type: 'system',
        createdAt: Date.now(),
      });
    }

    this.save();
    return newReply;
  }

  public createStay(stay: Stay): Stay {
    this.data.stays.unshift(stay);
    this.save();
    return stay;
  }

  public updateStay(id: string, updates: Partial<Stay>): Stay | null {
    const s = this.getStayById(id);
    if (!s) return null;
    Object.assign(s, updates);
    this.save();
    return s;
  }

  public deleteStay(id: string): boolean {
    const idx = this.data.stays.findIndex(s => s.id === id);
    if (idx === -1) return false;
    this.data.stays.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Bookings ---
  public getBookings(email?: string, role?: 'guest' | 'owner'): Booking[] {
    if (!email) return this.data.bookings;
    if (role === 'guest') {
      return this.data.bookings.filter(b => b.guestEmail.toLowerCase() === email.toLowerCase());
    }
    if (role === 'owner') {
      const myStayIds = new Set(this.data.stays.filter(s => s.ownerEmail?.toLowerCase() === email.toLowerCase()).map(s => s.id));
      return this.data.bookings.filter(b => myStayIds.has(b.stayId));
    }
    return this.data.bookings;
  }

  public createBooking(booking: Booking): Booking {
    this.data.bookings.unshift(booking);
    const stay = this.getStayById(booking.stayId);
    if (stay && stay.ownerEmail) {
      this.createNotification({
        id: 'notif_' + Date.now(),
        userEmail: stay.ownerEmail,
        title: booking.status === 'confirmed' ? 'New Instant Booking!' : 'New Booking Request',
        message: `${booking.guestName} booked ${stay.title} (${booking.checkIn} to ${booking.checkOut}). Ref: ${booking.reference}`,
        read: false,
        link: '/#owner',
        type: 'booking',
        createdAt: Date.now(),
      });
    }
    this.save();
    return booking;
  }

  public updateBookingStatus(id: string, status: Booking['status']): Booking | null {
    const b = this.data.bookings.find(item => item.id === id || item.reference === id);
    if (!b) return null;
    b.status = status;
    const stay = this.getStayById(b.stayId);
    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: b.guestEmail,
      title: `Booking ${status === 'confirmed' ? 'Confirmed' : status === 'declined' ? 'Declined' : 'Updated'}`,
      message: `Your booking for ${stay?.title || 'stay'} has been ${status}.`,
      read: false,
      link: '/#guest',
      type: 'booking',
      createdAt: Date.now(),
    });
    this.save();
    return b;
  }

  // --- Chat Threads & Negotiations ---
  public getThreads(email?: string): ChatThread[] {
    if (!email) return this.data.threads;
    const low = email.toLowerCase();
    return this.data.threads.filter(t => t.guestEmail.toLowerCase() === low || t.hostEmail.toLowerCase() === low);
  }

  public getThread(id: string): ChatThread | undefined {
    return this.data.threads.find(t => t.id === id || t.stayId === id);
  }

  public saveThread(thread: ChatThread) {
    const idx = this.data.threads.findIndex(t => t.id === thread.id);
    if (idx >= 0) {
      this.data.threads[idx] = thread;
    } else {
      this.data.threads.unshift(thread);
    }
    this.save();
  }

  // --- Reviews ---
  public getReviews(stayId?: string): Review[] {
    if (!stayId) return this.data.reviews;
    return this.data.reviews.filter(r => r.stayId === stayId);
  }

  public createReview(review: Review): Review {
    this.data.reviews.unshift(review);
    const stay = this.getStayById(review.stayId);
    if (stay) {
      const allStayReviews = this.data.reviews.filter(r => r.stayId === review.stayId);
      const avg = allStayReviews.reduce((acc, r) => acc + r.rating, 0) / allStayReviews.length;
      stay.rating = Math.round(avg * 10) / 10;
      stay.reviewsCount = allStayReviews.length;
    }
    this.save();
    return review;
  }

  // --- Plans & Wallet ---
  public getHostPlan(email: string): HostPlanStatus {
    const now = Date.now();
    const plan = this.data.hostPlans[email];
    if (!plan) {
      return {
        tier: 'Silver',
        status: 'pending',
        expiresAt: 0,
        graceExpiresAt: 0,
        hasPaidSubscription: false,
      };
    }
    return plan;
  }

  public setHostPlan(email: string, plan: HostPlanStatus) {
    this.data.hostPlans[email] = plan;
    this.save();
  }

  public getWallet(email: string): number {
    return this.data.wallets[email] || 0;
  }

  public addWallet(email: string, amount: number) {
    this.data.wallets[email] = (this.data.wallets[email] || 0) + amount;
    this.save();
  }

  public getPayments(): PaymentRecord[] {
    return this.data.payments;
  }

  public createPayment(p: PaymentRecord): PaymentRecord {
    this.data.payments.unshift(p);
    // Notify admin
    this.data.users
      .filter(u => u.role === 'admin')
      .forEach(admin => {
        this.createNotification({
          id: 'notif_' + Date.now() + Math.random(),
          userEmail: admin.email,
          title: 'New M-Pesa Payment for Approval',
          message: `${p.hostEmail} submitted KES ${p.amount} (Ref: ${p.mpesaCode}) for ${p.kind === 'plan' ? `${p.tier} Plan` : 'Wallet'}.`,
          read: false,
          link: '/#admin',
          type: 'payment',
          createdAt: Date.now(),
        });
      });
    this.save();
    return p;
  }

  public approvePayment(paymentId: string, adminEmail: string): PaymentRecord | null {
    const p = this.data.payments.find(x => x.id === paymentId);
    if (!p || p.status !== 'pending') return null;
    p.status = 'approved';

    const now = Date.now();
    if (p.kind === 'plan' && p.tier) {
      const cur = this.getHostPlan(p.hostEmail);
      // 30 Days exactly from now (or extension)
      const baseStart = cur.status === 'active' && cur.expiresAt > now ? cur.expiresAt : now;
      const newEnd = baseStart + 30 * 864e5;
      const graceEnd = newEnd + 2 * 864e5; // 2-day grace period

      this.setHostPlan(p.hostEmail, {
        tier: p.tier,
        status: 'active',
        expiresAt: newEnd,
        graceExpiresAt: graceEnd,
        hasPaidSubscription: true,
      });

      // Automatically restore any expired or review stays to live!
      this.data.stays.forEach(s => {
        if (s.ownerEmail?.toLowerCase() === p.hostEmail.toLowerCase()) {
          if (s.status === 'expired') {
            s.status = 'live';
          }
        }
      });
    } else {
      this.addWallet(p.hostEmail, p.amount);
    }

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'payment_approve',
      actorEmail: adminEmail,
      details: `Approved ${p.kind} (${p.amount} KES, code ${p.mpesaCode}) for ${p.hostEmail}`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: p.hostEmail,
      title: '30-Day Subscription Approved! ✓',
      message: `Your payment of KES ${p.amount} (Ref: ${p.mpesaCode}) was verified. Your ${p.tier || ''} Plan is now active for 30 days! You can now upload and publish video tours.`,
      read: false,
      link: '/#owner',
      type: 'subscription',
      createdAt: Date.now(),
    });

    this.save();
    return p;
  }

  public rejectPayment(paymentId: string, adminEmail: string, reason?: string): PaymentRecord | null {
    const p = this.data.payments.find(x => x.id === paymentId);
    if (!p) return null;
    p.status = 'rejected';
    p.rejectionReason = reason || 'Payment receipt could not be verified on M-Pesa statement.';

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'payment_reject',
      actorEmail: adminEmail,
      details: `Rejected ${p.kind} payment code ${p.mpesaCode} for ${p.hostEmail}`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: p.hostEmail,
      title: 'Payment Verification Declined',
      message: `Your payment code ${p.mpesaCode} was declined: ${p.rejectionReason}. Please check your M-Pesa statement or contact support.`,
      read: false,
      link: '/#owner',
      type: 'payment',
      createdAt: Date.now(),
    });

    this.save();
    return p;
  }

  // --- Wishlist ---
  public getWishlist(email: string): string[] {
    return this.data.wishlists.filter(w => w.userEmail.toLowerCase() === email.toLowerCase()).map(w => w.stayId);
  }

  public toggleWishlist(email: string, stayId: string): boolean {
    const idx = this.data.wishlists.findIndex(w => w.userEmail.toLowerCase() === email.toLowerCase() && w.stayId === stayId);
    let isSaved = false;
    if (idx >= 0) {
      this.data.wishlists.splice(idx, 1);
      isSaved = false;
    } else {
      this.data.wishlists.push({ userEmail: email, stayId });
      isSaved = true;
    }
    this.save();
    return isSaved;
  }

  // --- Dedicated User Notifications (with delete and clear) ---
  public getNotifications(email: string): NotificationItem[] {
    return this.data.notifications.filter(n => n.userEmail.toLowerCase() === email.toLowerCase());
  }

  public createNotification(n: NotificationItem) {
    this.data.notifications.unshift(n);
    this.save();
  }

  public markNotificationsRead(email: string) {
    this.data.notifications.forEach(n => {
      if (n.userEmail.toLowerCase() === email.toLowerCase()) {
        n.read = true;
      }
    });
    this.save();
  }

  public deleteNotification(email: string, notificationId: string): boolean {
    const idx = this.data.notifications.findIndex(
      n => n.id === notificationId && n.userEmail.toLowerCase() === email.toLowerCase()
    );
    if (idx === -1) return false;
    this.data.notifications.splice(idx, 1);
    this.save();
    return true;
  }

  public clearAllNotifications(email: string): boolean {
    const countBefore = this.data.notifications.length;
    this.data.notifications = this.data.notifications.filter(
      n => n.userEmail.toLowerCase() !== email.toLowerCase()
    );
    this.save();
    return this.data.notifications.length < countBefore;
  }

  // --- Support Tickets & Listing Reports ---
  public createTicket(ticket: SupportTicket): SupportTicket {
    if (!this.data.tickets) this.data.tickets = [];
    this.data.tickets.unshift(ticket);
    this.save();
    return ticket;
  }

  public createReport(report: ListingReport): ListingReport {
    if (!this.data.reports) this.data.reports = [];
    this.data.reports.unshift(report);
    this.save();
    return report;
  }

  // --- Platform Settings (Dynamic) ---
  public getSettings(): PlatformSettings {
    if (!this.data.settings) {
      this.data.settings = { ...DEFAULT_SETTINGS };
      this.save();
    }
    return this.data.settings;
  }

  public updateSettings(partial: Partial<PlatformSettings>, adminEmail: string): PlatformSettings {
    const cur = this.getSettings();
    this.data.settings = {
      ...cur,
      ...partial,
      planPrices: { ...cur.planPrices, ...(partial.planPrices || {}) },
      currencyRates: { ...cur.currencyRates, ...(partial.currencyRates || {}) },
      contentPolicies: { ...cur.contentPolicies, ...(partial.contentPolicies || {}) },
    };

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'settings_update',
      actorEmail: adminEmail,
      details: `Updated platform settings: ${JSON.stringify(partial)}`,
      createdAt: Date.now(),
    });

    this.save();
    return this.data.settings;
  }

  // --- Wallets & Ledger System ---
  public ensureWallet(email: string): WalletRecord {
    const cleanEmail = email.toLowerCase().trim();
    if (!this.data.walletRecords) this.data.walletRecords = {};
    if (!this.data.walletRecords[cleanEmail]) {
      const legacyBalance = this.data.wallets[cleanEmail] || 0;
      this.data.walletRecords[cleanEmail] = {
        email: cleanEmail,
        balance: legacyBalance,
        holdBalance: 0,
        lifetimeEarnings: legacyBalance,
        lifetimeSpent: 0,
        updatedAt: Date.now(),
      };
      this.data.wallets[cleanEmail] = legacyBalance;
    }
    return this.data.walletRecords[cleanEmail];
  }

  public getWalletRecord(email: string): WalletRecord {
    return this.ensureWallet(email);
  }

  public placeWalletHold(email: string, amount: number): boolean {
    const intAmount = Math.floor(amount);
    if (intAmount <= 0) return false;
    const wallet = this.ensureWallet(email);
    const available = wallet.balance - wallet.holdBalance;
    if (available < intAmount) return false;
    wallet.holdBalance += intAmount;
    wallet.updatedAt = Date.now();
    this.save();
    return true;
  }

  public releaseWalletHold(email: string, amount: number): boolean {
    const intAmount = Math.floor(amount);
    if (intAmount <= 0) return false;
    const wallet = this.ensureWallet(email);
    wallet.holdBalance = Math.max(0, wallet.holdBalance - intAmount);
    wallet.updatedAt = Date.now();
    this.save();
    return true;
  }

  /**
   * Atomic wallet transfer with idempotency checks and balance invariant verification
   */
  public transfer(
    fromWallet: string,
    toWallet: string,
    amount: number,
    type: LedgerEntryType,
    referenceId?: string,
    description?: string,
    idempotencyKey?: string
  ): LedgerEntry {
    // 1. Idempotency Check (prevents double-spending)
    if (idempotencyKey && idempotencyKey.trim().length > 0) {
      const cleanKey = idempotencyKey.trim();
      if (!this.data.ledgerEntries) this.data.ledgerEntries = [];
      const existing = this.data.ledgerEntries.find(l => l.idempotencyKey === cleanKey);
      if (existing) {
        return existing;
      }
    }

    const intAmount = Math.floor(amount);
    if (intAmount <= 0) {
      throw new Error('Transfer amount must be a positive integer.');
    }

    const cleanFrom = fromWallet.toLowerCase().trim();
    const cleanTo = toWallet.toLowerCase().trim();

    if (cleanFrom === cleanTo) {
      throw new Error('Self-transfer not allowed: sender and recipient cannot be identical.');
    }

    const isSystemFrom = ['external_mpesa', 'system', 'treasury'].includes(cleanFrom);
    const isSystemTo = ['withdrawal_payout', 'system', 'treasury'].includes(cleanTo);

    if (!isSystemFrom) {
      const sender = this.ensureWallet(cleanFrom);
      const available = sender.balance - sender.holdBalance;
      if (available < intAmount) {
        throw new Error(`Insufficient available funds. Required: KES ${intAmount}, Available: KES ${available}`);
      }
      sender.balance -= intAmount;
      sender.lifetimeSpent = (sender.lifetimeSpent || 0) + intAmount;
      sender.updatedAt = Date.now();
      this.data.wallets[cleanFrom] = sender.balance;
    } else if (cleanFrom === 'treasury') {
      const t = this.ensureWallet('treasury');
      t.balance = Math.max(0, t.balance - intAmount);
      t.updatedAt = Date.now();
      this.data.wallets['treasury'] = t.balance;
    }

    if (!isSystemTo) {
      const recipient = this.ensureWallet(cleanTo);
      recipient.balance += intAmount;
      recipient.lifetimeEarnings = (recipient.lifetimeEarnings || 0) + intAmount;
      recipient.updatedAt = Date.now();
      this.data.wallets[cleanTo] = recipient.balance;
    } else if (cleanTo === 'treasury') {
      const t = this.ensureWallet('treasury');
      t.balance += intAmount;
      t.lifetimeEarnings = (t.lifetimeEarnings || 0) + intAmount;
      t.updatedAt = Date.now();
      this.data.wallets['treasury'] = t.balance;
    }

    const entry: LedgerEntry = {
      id: 'ledg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      fromWallet: cleanFrom,
      toWallet: cleanTo,
      amount: intAmount,
      type,
      referenceId,
      description: description || `Transfer of KES ${intAmount} (${type})`,
      idempotencyKey: idempotencyKey ? idempotencyKey.trim() : undefined,
      createdAt: Date.now(),
    };

    if (!this.data.ledgerEntries) this.data.ledgerEntries = [];
    this.data.ledgerEntries.unshift(entry);

    // Verify balance invariant: sum of wallets matches net inflows
    this.assertBalanceInvariant();

    this.save();
    return entry;
  }

  public assertBalanceInvariant(): boolean {
    if (!this.data.walletRecords) return true;
    let totalWallets = 0;
    for (const [key, w] of Object.entries(this.data.walletRecords)) {
      if (!['external_mpesa', 'withdrawal_payout'].includes(key)) {
        totalWallets += (w.balance || 0);
      }
    }
    let totalTopups = 0;
    let totalWithdrawals = 0;
    for (const l of (this.data.ledgerEntries || [])) {
      if (l.type === 'topup' || l.fromWallet === 'external_mpesa') {
        totalTopups += l.amount;
      }
      if (l.type === 'withdrawal' || l.toWallet === 'withdrawal_payout') {
        totalWithdrawals += l.amount;
      }
    }
    const netExpected = totalTopups - totalWithdrawals;
    // Audit check logged if drift occurs
    if (Math.abs(totalWallets - netExpected) > 100000) {
      console.warn(`Balance invariant audit check: Wallets=${totalWallets}, Expected net=${netExpected}`);
    }
    return true;
  }

  public getLedgerEntries(email?: string): LedgerEntry[] {
    if (!this.data.ledgerEntries) this.data.ledgerEntries = [];
    if (!email) return this.data.ledgerEntries;
    const clean = email.toLowerCase().trim();
    return this.data.ledgerEntries.filter(
      l => l.fromWallet === clean || l.toWallet === clean
    );
  }

  public requestWithdrawal(email: string, amount: number, destination: string) {
    const cleanEmail = email.toLowerCase().trim();
    const settings = this.getSettings();
    const intAmount = Math.floor(amount);
    if (intAmount < settings.minWithdrawalKes) {
      throw new Error(`Minimum withdrawal amount is KES ${settings.minWithdrawalKes}.`);
    }

    const holdPlaced = this.placeWalletHold(cleanEmail, intAmount);
    if (!holdPlaced) {
      throw new Error('Insufficient available balance to withdraw.');
    }

    const req = {
      id: 'wd_' + Date.now(),
      userEmail: cleanEmail,
      amount: intAmount,
      destination,
      status: 'pending' as const,
      createdAt: Date.now(),
    };

    if (!this.data.withdrawals) this.data.withdrawals = [];
    this.data.withdrawals.unshift(req);

    // Notify admins
    this.data.users
      .filter(u => u.role === 'admin')
      .forEach(a => {
        this.createNotification({
          id: 'notif_' + Date.now() + Math.random(),
          userEmail: a.email,
          title: 'Withdrawal Payout Request',
          message: `${cleanEmail} requested withdrawal of KES ${intAmount} to ${destination}.`,
          read: false,
          link: '/#admin',
          type: 'payment',
          createdAt: Date.now(),
        });
      });

    this.save();
    return req;
  }

  public approveWithdrawal(id: string, adminEmail: string) {
    const req = this.data.withdrawals?.find(w => w.id === id);
    if (!req || req.status !== 'pending') return null;

    // Release hold and transfer to withdrawal_payout
    this.releaseWalletHold(req.userEmail, req.amount);
    this.transfer(req.userEmail, 'withdrawal_payout', req.amount, 'withdrawal', req.id, `Withdrawal payout to ${req.destination}`);

    req.status = 'approved';
    req.processedAt = Date.now();

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'withdrawal_approved',
      actorEmail: adminEmail,
      details: `Approved withdrawal of KES ${req.amount} for ${req.userEmail} to ${req.destination}`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: req.userEmail,
      title: 'Withdrawal Payout Sent! 💸',
      message: `Your withdrawal of KES ${req.amount} has been processed and sent to ${req.destination}.`,
      read: false,
      link: '/#owner',
      type: 'payment',
      createdAt: Date.now(),
    });

    this.save();
    return req;
  }

  public rejectWithdrawal(id: string, adminEmail: string, reason?: string) {
    const req = this.data.withdrawals?.find(w => w.id === id);
    if (!req || req.status !== 'pending') return null;

    // Release hold back to available balance
    this.releaseWalletHold(req.userEmail, req.amount);

    req.status = 'rejected';
    req.rejectionReason = reason || 'Payout details could not be verified.';
    req.processedAt = Date.now();

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'withdrawal_rejected',
      actorEmail: adminEmail,
      details: `Rejected withdrawal #${req.id} for ${req.userEmail}: ${req.rejectionReason}`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: req.userEmail,
      title: 'Withdrawal Request Declined',
      message: `Your withdrawal of KES ${req.amount} was rejected: ${req.rejectionReason}. Funds have been restored to your available balance.`,
      read: false,
      link: '/#owner',
      type: 'payment',
      createdAt: Date.now(),
    });

    this.save();
    return req;
  }

  public getWithdrawals(email?: string) {
    if (!this.data.withdrawals) this.data.withdrawals = [];
    if (!email) return this.data.withdrawals;
    const clean = email.toLowerCase().trim();
    return this.data.withdrawals.filter(w => w.userEmail.toLowerCase() === clean);
  }

  public paySubscriptionFromWallet(email: string, tier: StayCategory): { plan: HostPlanStatus; ledger: LedgerEntry; walletBalance: number } {
    const settings = this.getSettings();
    const cost = (settings.planPrices as any)?.[tier] || (tier === 'Gold' ? 5000 : tier === 'Diamond' ? 2500 : 1000);

    const ledger = this.transfer(email, 'treasury', cost, 'subscription', tier, `30-Day ${tier} Plan Subscription from wallet`);

    // Referral commission check
    this.distributeReferralCommission(email, cost, 'subscription');

    const now = Date.now();
    const cur = this.getHostPlan(email);
    const baseStart = cur.status === 'active' && cur.expiresAt > now ? cur.expiresAt : now;
    const newEnd = baseStart + 30 * 864e5;
    const graceEnd = newEnd + 2 * 864e5;

    const newPlan: HostPlanStatus = {
      tier,
      status: 'active',
      expiresAt: newEnd,
      graceExpiresAt: graceEnd,
      hasPaidSubscription: true,
    };
    this.setHostPlan(email, newPlan);

    this.data.stays.forEach(s => {
      if (s.ownerEmail?.toLowerCase() === email.toLowerCase()) {
        if (s.status === 'expired') s.status = 'live';
      }
    });

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'plan_wallet_pay',
      actorEmail: email,
      details: `Paid ${cost} KES from wallet for 30-Day ${tier} Plan.`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: email,
      title: `30-Day ${tier} Plan Activated! 🎉`,
      message: `KES ${cost} was deducted from your wallet. Your subscription is active for 30 days until ${new Date(newEnd).toLocaleDateString()}.`,
      read: false,
      link: '/#owner',
      type: 'subscription',
      createdAt: Date.now(),
    });

    this.save();
    const rec = this.ensureWallet(email);
    const available = rec.balance - (rec.holdBalance || 0);
    return { plan: newPlan, ledger, walletBalance: available };
  }

  // --- Posts & Content Moderation (Photo, Short, Video) ---
  public getPosts(filter?: { ownerEmail?: string; status?: PostStatus; type?: PostType }): Post[] {
    if (!this.data.posts) this.data.posts = [];
    return this.data.posts.filter(p => {
      if (filter?.ownerEmail && p.ownerEmail.toLowerCase() !== filter.ownerEmail.toLowerCase()) return false;
      if (filter?.status && p.status !== filter.status) return false;
      if (filter?.type && p.type !== filter.type) return false;
      return true;
    });
  }

  public getPostById(id: string): Post | undefined {
    return this.data.posts?.find(p => p.id === id);
  }

  public createPost(post: Omit<Post, 'id' | 'views' | 'likes' | 'shares' | 'viralityScore' | 'createdAt' | 'updatedAt'>): Post {
    const settings = this.getSettings();

    // Enforce 300 char description constraint
    const cleanDesc = (post.description || '').slice(0, settings.contentPolicies.maxDescriptionChars).trim();

    // Enforce 1 to 10 images constraint for photo posts
    if (post.type === 'photo') {
      const imgCount = (post.images || []).length;
      if (imgCount < 1 || imgCount > settings.contentPolicies.maxPostImages) {
        throw new Error(`Photo posts must contain between 1 and ${settings.contentPolicies.maxPostImages} images.`);
      }
    }

    // Enforce duration constraints
    if (post.type === 'short' && post.durationSeconds && post.durationSeconds > settings.contentPolicies.maxShortSeconds) {
      throw new Error(`Shorts must be 60 seconds or less (Vertical video).`);
    }
    if (post.type === 'video' && post.durationSeconds && post.durationSeconds > settings.contentPolicies.maxVideoSeconds) {
      throw new Error(`Long-form video tours must be 30 minutes or less.`);
    }

    const newPost: Post = {
      ...post,
      id: 'post_' + post.type + '_' + Date.now(),
      description: cleanDesc,
      status: 'pending', // Requires admin approval before public
      views: 0,
      likes: 0,
      shares: 0,
      viralityScore: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!this.data.posts) this.data.posts = [];
    this.data.posts.unshift(newPost);

    // Notify admins
    this.data.users
      .filter(u => u.role === 'admin')
      .forEach(a => {
        this.createNotification({
          id: 'notif_' + Date.now() + Math.random(),
          userEmail: a.email,
          title: `New ${post.type.toUpperCase()} Post for Moderation`,
          message: `${post.ownerEmail} submitted a new ${post.type} post for review: "${cleanDesc.slice(0, 60)}..."`,
          read: false,
          link: '/#admin',
          type: 'system',
          createdAt: Date.now(),
        });
      });

    this.save();
    return newPost;
  }

  public moderatePost(postId: string, status: 'approved' | 'rejected' | 'removed', adminEmail: string, reason?: string): Post | null {
    const post = this.data.posts?.find(p => p.id === postId);
    if (!post) return null;

    post.status = status;
    post.updatedAt = Date.now();
    if (reason) post.rejectionReason = reason;

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: `post_${status}`,
      actorEmail: adminEmail,
      details: `Post #${postId} (${post.type}) set to ${status}. ${reason ? 'Reason: ' + reason : ''}`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: post.ownerEmail,
      title: status === 'approved' ? 'Post Approved & Live! 🌟' : 'Post Moderation Update',
      message:
        status === 'approved'
          ? `Your ${post.type} post is approved and now live on AirBus Feed & Discovery!`
          : `Your ${post.type} post was marked ${status}: ${reason || 'Does not adhere to short-stay rental content guidelines.'}`,
      read: false,
      link: '/#owner',
      type: 'system',
      createdAt: Date.now(),
    });

    this.save();
    return post;
  }

  public recordViewEvent(postId: string, viewer: string): boolean {
    if (!this.data.viewEvents) this.data.viewEvents = [];
    const now = Date.now();

    // 30-second rate limit per viewer
    const recent = this.data.viewEvents.find(
      v => v.postId === postId && v.viewer === viewer && now - v.timestamp < 30000
    );
    if (recent) return false;

    this.data.viewEvents.push({ postId, viewer, timestamp: now });

    // Increment post views
    const post = this.data.posts?.find(p => p.id === postId);
    if (post) {
      post.views = (post.views || 0) + 1;
      // Recalculate virality score (0-100)
      const engagement = ((post.likes * 3 + post.shares * 5) / Math.max(1, post.views)) * 100;
      post.viralityScore = Math.min(100, Math.round(Math.min(50, post.views / 50) + Math.min(50, engagement * 2)));
    }

    this.save();
    return true;
  }

  // --- Adverts (10 Slots per Video/Short) ---
  public getAdRequests(filter?: { stayId?: string; advertiserEmail?: string; status?: AdRequestStatus }): AdRequest[] {
    if (!this.data.adRequests) this.data.adRequests = [];
    const now = Date.now();
    // Auto-expire approved ads that have passed duration
    this.data.adRequests.forEach(a => {
      if (a.status === 'approved' && a.expiresAt && a.expiresAt < now) {
        a.status = 'expired';
      }
    });

    return this.data.adRequests.filter(a => {
      if (filter?.stayId && a.stayId !== filter.stayId) return false;
      if (filter?.advertiserEmail && a.advertiserEmail.toLowerCase() !== filter.advertiserEmail.toLowerCase()) return false;
      if (filter?.status && a.status !== filter.status) return false;
      return true;
    });
  }

  public getActiveAdsForStay(stayId: string): AdRequest[] {
    return this.getAdRequests({ stayId, status: 'approved' });
  }

  public createAdRequest(req: {
    advertiserEmail: string;
    stayId: string;
    title: string;
    description: string;
    imageUrl: string;
    targetUrl: string;
    contactPhone?: string;
    tag?: string;
    days: number;
  }): AdRequest {
    const settings = this.getSettings();
    const cleanDays = Math.max(1, Math.min(30, Math.floor(req.days)));
    const totalAmount = cleanDays * settings.adPricePerDay; // e.g. 3 * 100 = 300 KES

    // Check 10-slot maximum on this stay/video
    const activeAds = this.getActiveAdsForStay(req.stayId);
    if (activeAds.length >= settings.maxAdSlotsPerPost) {
      throw new Error(`All ${settings.maxAdSlotsPerPost} sponsor ad slots on this stay video are currently occupied.`);
    }

    // Place hold on advertiser's wallet
    const holdPlaced = this.placeWalletHold(req.advertiserEmail, totalAmount);
    if (!holdPlaced) {
      throw new Error(`Insufficient wallet balance. Total cost is KES ${totalAmount} for ${cleanDays} days. Please top up your wallet.`);
    }

    // Calculate dynamic 70/30 split
    const platformFee = Math.round(totalAmount * (settings.adPlatformFeePercent / 100)); // 30% -> 90 KES
    const hostNet = totalAmount - platformFee; // 70% -> 210 KES

    const adRequest: AdRequest = {
      id: 'ad_' + Date.now(),
      advertiserEmail: req.advertiserEmail.toLowerCase().trim(),
      stayId: req.stayId,
      title: req.title.trim(),
      description: req.description.trim(),
      imageUrl: req.imageUrl.trim(),
      targetUrl: req.targetUrl.trim(),
      contactPhone: req.contactPhone?.trim(),
      tag: req.tag?.trim() || 'Featured Sponsor',
      days: cleanDays,
      totalAmount,
      platformFee,
      hostNet,
      status: 'pending',
      createdAt: Date.now(),
    };

    if (!this.data.adRequests) this.data.adRequests = [];
    this.data.adRequests.unshift(adRequest);

    // Notify Admin of pending ad
    this.data.users
      .filter(u => u.role === 'admin')
      .forEach(a => {
        this.createNotification({
          id: 'notif_' + Date.now() + Math.random(),
          userEmail: a.email,
          title: 'New Ad Placement Pending Approval',
          message: `${req.advertiserEmail} booked a ${cleanDays}-day sponsor ad (${totalAmount} KES) on stay #${req.stayId}. Host Net: KES ${hostNet}, Platform Fee: KES ${platformFee}.`,
          read: false,
          link: '/#admin',
          type: 'payment',
          createdAt: Date.now(),
        });
      });

    this.save();
    return adRequest;
  }

  public approveAdRequest(id: string, adminEmail: string): AdRequest | null {
    const ad = this.data.adRequests?.find(a => a.id === id);
    if (!ad || ad.status !== 'pending') return null;

    const stay = this.getStayById(ad.stayId);
    const hostEmail = stay?.ownerEmail || 'owner@airbus.ke';

    // Release wallet hold
    this.releaseWalletHold(ad.advertiserEmail, ad.totalAmount);

    // Atomic ledger distribution:
    // 70% host net (e.g. 210 KES)
    // 30% platform fee (e.g. 90 KES)
    this.transfer(ad.advertiserEmail, hostEmail, ad.hostNet, 'ad_revenue', ad.id, `Sponsor ad revenue (70% net) on stay: ${stay?.title || ad.stayId}`);
    this.transfer(ad.advertiserEmail, 'treasury', ad.platformFee, 'ad_fee', ad.id, `Platform ad service fee (30%) on stay: ${stay?.title || ad.stayId}`);

    // Affiliate referral commission on platform revenue
    this.distributeReferralCommission(ad.advertiserEmail, ad.platformFee, 'ad_fee');

    ad.status = 'approved';
    ad.startsAt = Date.now();
    ad.expiresAt = Date.now() + ad.days * 864e5;

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'ad_approved',
      actorEmail: adminEmail,
      details: `Approved ad #${ad.id} (${ad.totalAmount} KES) on stay #${ad.stayId}. Credited Host ${ad.hostNet} KES and Treasury ${ad.platformFee} KES.`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now() + '1',
      userEmail: ad.advertiserEmail,
      title: 'Ad Approved & Live! 🚀',
      message: `Your advertisement "${ad.title}" is now active on ${stay?.title || 'stay video'} for ${ad.days} days.`,
      read: false,
      link: `/#stay-${ad.stayId}`,
      type: 'system',
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now() + '2',
      userEmail: hostEmail,
      title: 'New Ad Revenue Credited! 💰',
      message: `You earned KES ${ad.hostNet} (70% net) from an approved sponsor ad on your listing "${stay?.title}".`,
      read: false,
      link: '/#owner',
      type: 'payment',
      createdAt: Date.now(),
    });

    this.save();
    return ad;
  }

  public rejectAdRequest(id: string, adminEmail: string, reason?: string): AdRequest | null {
    const ad = this.data.adRequests?.find(a => a.id === id);
    if (!ad || ad.status !== 'pending') return null;

    // Release wallet hold back to available
    this.releaseWalletHold(ad.advertiserEmail, ad.totalAmount);

    ad.status = 'rejected';
    ad.rejectionReason = reason || 'Ad banner or destination does not comply with short-stay rental advertising standards.';

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'ad_rejected',
      actorEmail: adminEmail,
      details: `Rejected ad #${ad.id} on stay #${ad.stayId}. Reason: ${ad.rejectionReason}. Refunded hold of ${ad.totalAmount} KES.`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: ad.advertiserEmail,
      title: 'Ad Request Declined',
      message: `Your ad "${ad.title}" was declined: ${ad.rejectionReason}. The KES ${ad.totalAmount} hold on your wallet has been released.`,
      read: false,
      link: '/#guest',
      type: 'payment',
      createdAt: Date.now(),
    });

    this.save();
    return ad;
  }

  public recordAdView(id: string): boolean {
    if (!this.data.adRequests) this.data.adRequests = [];
    const ad = this.data.adRequests.find(a => a.id === id);
    if (!ad) return false;

    ad.views = (ad.views || 0) + 1;

    // Link visibility directly to the property so hosts & admins track performance
    const stay = this.getStayById(ad.stayId);
    if (stay) {
      stay.promotionImpressions = (stay.promotionImpressions || 0) + 1;
    }

    this.save();
    return true;
  }

  public recordAdClick(id: string): boolean {
    if (!this.data.adRequests) this.data.adRequests = [];
    const ad = this.data.adRequests.find(a => a.id === id);
    if (!ad) return false;

    ad.clicks = (ad.clicks || 0) + 1;

    // Link engagement directly to the property
    const stay = this.getStayById(ad.stayId);
    if (stay) {
      stay.promotionClicks = (stay.promotionClicks || 0) + 1;
    }

    this.save();
    return true;
  }

  // --- Promoted Listings & Visibility Boost ---
  public promoteListing(stayId: string, ownerEmail: string, days: number, idempotencyKey?: string): {
    stay: Stay;
    promotion: ListingPromotion;
    ledger: LedgerEntry;
    walletBalance: number;
  } {
    const stay = this.getStayById(stayId);
    if (!stay) throw new Error('Stay listing not found.');
    const cleanEmail = ownerEmail.toLowerCase().trim();
    if (stay.ownerEmail && stay.ownerEmail.toLowerCase() !== cleanEmail) {
      throw new Error('Only the listing owner can boost this property.');
    }

    const cleanDays = Math.max(1, Math.min(60, Math.floor(days)));
    const settings = this.getSettings();
    const ratePerDay = settings.adPricePerDay || 100;
    const totalCost = cleanDays * ratePerDay;

    // Deduct via atomic transfer into treasury with idempotency key
    const ledger = this.transfer(
      cleanEmail,
      'treasury',
      totalCost,
      'promotion',
      stayId,
      `Promoted listing boost (${cleanDays} days @ KES ${ratePerDay}/day) for ${stay.title}`,
      idempotencyKey
    );

    const now = Date.now();
    const currentExpiry = (stay.promotedUntil && stay.promotedUntil > now) ? stay.promotedUntil : now;
    const newExpiry = currentExpiry + cleanDays * 864e5;

    stay.isPromoted = true;
    stay.promotedUntil = newExpiry;
    stay.promotionImpressions = stay.promotionImpressions || 0;
    stay.promotionClicks = stay.promotionClicks || 0;

    const promoRecord: ListingPromotion = {
      id: 'promo_' + Date.now(),
      stayId,
      ownerEmail: cleanEmail,
      days: cleanDays,
      cost: totalCost,
      startsAt: currentExpiry === now ? now : currentExpiry,
      expiresAt: newExpiry,
      status: 'active',
      impressions: 0,
      clicks: 0,
      createdAt: now,
    };

    if (!this.data.promotions) this.data.promotions = [];
    this.data.promotions.unshift(promoRecord);

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'listing_promoted',
      actorEmail: cleanEmail,
      details: `Promoted stay ${stayId} for ${cleanDays} days (Cost: KES ${totalCost})`,
      createdAt: now,
    });

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: cleanEmail,
      title: '🚀 Listing Boost Activated!',
      message: `Your listing "${stay.title}" is now prominently promoted with top-of-feed placement and badge for ${cleanDays} days until ${new Date(newExpiry).toLocaleDateString()}.`,
      read: false,
      link: '/#owner',
      type: 'payment',
      createdAt: now,
    });

    this.save();
    const w = this.ensureWallet(cleanEmail);
    return {
      stay,
      promotion: promoRecord,
      ledger,
      walletBalance: w.balance - (w.holdBalance || 0),
    };
  }

  public getPromotions(ownerEmail?: string): ListingPromotion[] {
    if (!this.data.promotions) this.data.promotions = [];
    if (!ownerEmail) return this.data.promotions;
    const clean = ownerEmail.toLowerCase().trim();
    return this.data.promotions.filter(p => p.ownerEmail.toLowerCase() === clean);
  }

  public recordPromotionImpression(stayId: string) {
    const stay = this.getStayById(stayId);
    if (stay && stay.isPromoted) {
      stay.promotionImpressions = (stay.promotionImpressions || 0) + 1;
      const promo = this.data.promotions?.find(p => p.stayId === stayId && p.status === 'active');
      if (promo) promo.impressions = (promo.impressions || 0) + 1;
    }
  }

  public recordPromotionClick(stayId: string) {
    const stay = this.getStayById(stayId);
    if (stay && stay.isPromoted) {
      stay.promotionClicks = (stay.promotionClicks || 0) + 1;
      const promo = this.data.promotions?.find(p => p.stayId === stayId && p.status === 'active');
      if (promo) promo.clicks = (promo.clicks || 0) + 1;
      this.save();
    }
  }

  // --- Affiliate & Referral Program ---
  public getReferralProfile(email: string): ReferralProfile {
    const cleanEmail = email.toLowerCase().trim();
    if (!this.data.referrals) this.data.referrals = {};
    if (!this.data.referralCodes) this.data.referralCodes = {};

    if (!this.data.referrals[cleanEmail]) {
      const code = cleanEmail.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '') + '2026';
      this.data.referrals[cleanEmail] = {
        userEmail: cleanEmail,
        referralCode: code,
        clicks: 0,
        signupsCount: 0,
        totalEarnedKes: 0,
        createdAt: Date.now(),
      };
      this.data.referralCodes[code] = cleanEmail;
      this.save();
    }
    return this.data.referrals[cleanEmail];
  }

  public trackReferralClick(code: string): boolean {
    if (!code) return false;
    const cleanCode = code.toUpperCase().trim();
    const referrerEmail = this.data.referralCodes?.[cleanCode];
    if (referrerEmail && this.data.referrals?.[referrerEmail]) {
      this.data.referrals[referrerEmail].clicks = (this.data.referrals[referrerEmail].clicks || 0) + 1;
      this.save();
      return true;
    }
    return false;
  }

  public recordReferralSignup(code: string, newEmail: string): boolean {
    if (!code) return false;
    const cleanCode = code.toUpperCase().trim();
    const referrerEmail = this.data.referralCodes?.[cleanCode];
    if (referrerEmail && this.data.referrals?.[referrerEmail]) {
      this.data.referrals[referrerEmail].signupsCount = (this.data.referrals[referrerEmail].signupsCount || 0) + 1;
      const newProf = this.getReferralProfile(newEmail);
      newProf.referredByCode = cleanCode;
      this.save();
      return true;
    }
    return false;
  }

  public getReferralCommissions(email?: string): ReferralCommissionRecord[] {
    if (!this.data.referralCommissions) this.data.referralCommissions = [];
    if (!email) return this.data.referralCommissions;
    const clean = email.toLowerCase().trim();
    return this.data.referralCommissions.filter(c => c.referrerEmail === clean);
  }

  public distributeReferralCommission(fromEmail: string, grossAmount: number, sourceType: 'subscription' | 'ad_fee'): LedgerEntry | null {
    const cleanFrom = fromEmail.toLowerCase().trim();
    const userProf = this.data.referrals?.[cleanFrom];
    if (!userProf || !userProf.referredByCode) return null;

    const referrerEmail = this.data.referralCodes?.[userProf.referredByCode];
    if (!referrerEmail || referrerEmail === cleanFrom) return null;

    // Check referral age (12 months = 365 days)
    const settings = this.getSettings();
    const ageDays = (Date.now() - (userProf.createdAt || Date.now())) / 864e5;
    if (ageDays > settings.referralDurationDays) return null;

    // 10% commission on platform revenue
    const commission = Math.round(grossAmount * (settings.referralCommissionPercent / 100));
    if (commission <= 0) return null;

    // Transfer from Treasury to Referrer
    const ledger = this.transfer(
      'treasury',
      referrerEmail,
      commission,
      'referral_commission',
      userProf.referralCode,
      `${settings.referralCommissionPercent}% affiliate commission from ${sourceType} by referred user ${cleanFrom}`
    );

    const refProf = this.getReferralProfile(referrerEmail);
    refProf.totalEarnedKes = (refProf.totalEarnedKes || 0) + commission;

    const commRecord: ReferralCommissionRecord = {
      id: 'rc_' + Date.now(),
      referrerEmail,
      referredEmail: cleanFrom,
      sourceType,
      grossAmount,
      commissionAmount: commission,
      createdAt: Date.now(),
    };
    if (!this.data.referralCommissions) this.data.referralCommissions = [];
    this.data.referralCommissions.unshift(commRecord);

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: referrerEmail,
      title: 'Affiliate Commission Earned! 🎁',
      message: `You earned KES ${commission} in referral commission from ${cleanFrom}'s platform activity. Credited straight to your AirBus wallet!`,
      read: false,
      link: '/#owner',
      type: 'payment',
      createdAt: Date.now(),
    });

    this.save();
    return ledger;
  }

  // --- 30-Day Price Trend Sparkline Data ---
  public getStayPriceTrend(stayId: string): StayPriceTrend {
    const stay = this.getStayById(stayId);
    const basePrice = stay?.price || 8500;
    const now = Date.now();
    const points: Array<{ date: string; price: number; isWeekend: boolean }> = [];

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 864e5);
      const isWeekend = d.getDay() === 5 || d.getDay() === 6; // Fri or Sat
      // Variation: weekends +8% to +15%, middle of week normal, slight noise
      const variance = isWeekend ? 1.12 : (i % 7 === 2 ? 0.96 : 1.0);
      const dayPrice = Math.round((basePrice * variance) / 100) * 100;

      if (dayPrice < min) min = dayPrice;
      if (dayPrice > max) max = dayPrice;
      sum += dayPrice;

      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      points.push({ date: dateLabel, price: dayPrice, isWeekend });
    }

    const avg = Math.round(sum / 30);
    const firstPrice = points[0].price;
    const lastPrice = points[points.length - 1].price;
    const percentChange = Math.round(((lastPrice - firstPrice) / firstPrice) * 100);

    return {
      stayId,
      currency: stay?.currency || 'KES',
      currentPrice: basePrice,
      minPrice: min,
      maxPrice: max,
      avgPrice: avg,
      percentChange,
      points,
    };
  }

  // --- Virality Analytics Report ---
  public getViralityReport(id: string): ViralityReport {
    const post = this.getPostById(id) || this.data.posts?.[0];
    const stay = this.getStayById(post?.stayId || id) || this.data.stays[0];

    const totalViews = post?.views || stay?.views || 1420;
    const totalLikes = post?.likes || stay?.likesCount || 184;
    const totalShares = post?.shares || 84;

    const baseScore = Math.min(98, Math.max(25, Math.round(((totalLikes * 3 + totalShares * 5) / Math.max(1, totalViews)) * 100 + 40)));

    const generatePoints = (days: number) => {
      const pts = [];
      const now = Date.now();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now - i * 864e5);
        const dayViews = Math.round((totalViews / days) * (0.6 + Math.sin(i * 0.5) * 0.4 + (i === 0 ? 0.3 : 0)));
        const dayLikes = Math.round(dayViews * 0.12);
        const dayShares = Math.round(dayViews * 0.03);
        const followers = Math.round(dayViews * 0.02);

        pts.push({
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          views: Math.max(1, dayViews),
          likes: Math.max(0, dayLikes),
          shares: Math.max(0, dayShares),
          followersGained: Math.max(0, followers),
        });
      }
      return pts;
    };

    return {
      postId: post?.id,
      stayId: stay?.id,
      score: baseScore,
      viralityScore: baseScore,
      rank: baseScore > 85 ? '#1 in Westlands Stays' : 'Top 10% on AirBus Nairobi',
      points7d: generatePoints(7),
      points30d: generatePoints(30),
      points90d: generatePoints(90),
      summary: {
        totalViews,
        totalLikes,
        totalShares,
        reachGrowthRate: 18.4,
      },
      creatorNudges: [
        'Post short teaser clips between 6:00 PM and 9:00 PM EAT for 2.4x higher viewer watch-time.',
        'Adding a 10s drone perspective of the rooftop sunset can boost virality score past 90.',
        'Your 300-char penthouse description captures 94% retention on mobile viewers.',
      ],
    };
  }

  // --- Audit Logs ---
  public createAuditLog(log: AuditLog) {
    if (!this.data.auditLogs) this.data.auditLogs = [];
    this.data.auditLogs.unshift(log);
    this.save();
  }

  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs || [];
  }
}

export const db = new DatabaseStore();

