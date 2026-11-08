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
  DormantOwner,
  TripDatingProfile,
  TripDatingProfileStatus,
  TripDatingPaymentRequest,
  TripDatingContactUnlock,
  TripDatingStats,
  SnappAddCampaign,
  PaymentRecordType,
  PaymentRecordMethod,
  PaymentRecordStatus,
  WalletTransaction,
  BoostRecord,
  SponsorSlot,
  AdSlot,
  SubscriptionRecord,
  FollowRecord,
  ListingLikeRecord,
  ListingViewRecord,
  AutoShortRecord,
} from './types';
import { PLANS, AMENITY_GROUPS } from '../constants';

export const DEFAULT_SETTINGS: PlatformSettings = {
  adPricePerDay: 100,
  adPlatformFeePercent: 30,
  maxAdSlotsPerPost: 10,
  referralCommissionPercent: 10,
  referralDurationDays: 365,
  minWithdrawalKes: 500,
  mpesaPaybill: '222111',
  mpesaTill: '987654',
  mpesaAccountPrefix: 'AIRBUS',
  scToKesRate: 10,
  dailyRateSc: 10,
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
    id: 'u_admin_master',
    name: 'Kamala Hari',
    email: 'kamalahari93@gmail.com',
    role: 'admin',
    passwordHash: hashPassword('2019xyz//'),
    phone: '+254 700 000 001',
    location: 'Headquarters, Nairobi',
    bio: 'Lead Platform Administrator at AirBus Global.',
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
    id: 'b_demo_upcoming_24h',
    reference: 'AB24HRS',
    stayId: 's2',
    guestEmail: 'guest@airbus.ke',
    guestName: 'Sarah Wanjiku',
    checkIn: new Date(Date.now() + 20 * 3600 * 1000).toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
    guests: 2,
    subtotal: 9000,
    cleaningFee: 450,
    serviceFee: 720,
    total: 10170,
    currency: 'KES',
    status: 'confirmed',
    note: 'Arriving tomorrow afternoon. Ready for check-in!',
    selectedGifts: ['Kenyan Safari Kahawa & Fresh Ground Beans', 'Fresh Coconut Water & Tropical Basket'],
    createdAt: Date.now() - 864e5,
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

export const SEED_TRIP_DATING_PROFILES: TripDatingProfile[] = [
  {
    id: 'tdp_1',
    userId: 'u_zawadi',
    fullName: 'Zawadi Njeri',
    phoneNumber: '+254 718 293 841',
    gender: 'female',
    age: 27,
    dob: '1999-04-12',
    country: 'Kenya',
    city: 'Nairobi',
    location: 'Westlands & Kileleshwa, Nairobi',
    description: 'Tech product manager & weekend mountain hiker. Love sunset conversations over rooftop cappuccino, discovering boutique art galleries, and exploring Kenya’s hidden stay gems.',
    lookingFor: 'A smart, ambitious, kind gentleman who values deep conversations, spontaneous road trips, and laughter.',
    datingIntention: 'dating_companionship',
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=800&q=80',
    ],
    primaryPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    full_body_photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    full_body_verified: true,
    fullBodyModerationStatus: 'approved',
    likes: 42,
    likedByUserEmails: ['guest@airbus.ke'],
    views: 310,
    status: 'active',
    createdAt: Date.now() - 14 * 864e5,
    updatedAt: Date.now() - 2 * 864e5,
  },
  {
    id: 'tdp_2',
    userId: 'u_kevin',
    fullName: 'Kevin Ochieng',
    phoneNumber: '+254 723 881 290',
    gender: 'male',
    age: 30,
    dob: '1996-08-20',
    country: 'Kenya',
    city: 'Nairobi',
    location: 'Kilimani, Nairobi',
    description: 'Architect & urban design enthusiast. When not sketching modern eco-villas, you will find me playing jazz piano, searching for Nairobi’s finest espresso, or tennis at the club.',
    lookingFor: 'An authentic, emotionally mature lady with her own passions who loves travel, good food, and genuine companionship.',
    datingIntention: 'serious_relationship',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1480429370139-e0132c086e2a?auto=format&fit=crop&w=800&q=80',
    ],
    primaryPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    full_body_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    full_body_verified: true,
    fullBodyModerationStatus: 'approved',
    likes: 67,
    likedByUserEmails: [],
    views: 480,
    status: 'active',
    createdAt: Date.now() - 20 * 864e5,
    updatedAt: Date.now() - 5 * 864e5,
  },
  {
    id: 'tdp_3',
    userId: 'u_brenda',
    fullName: 'Brenda Chebet',
    phoneNumber: '+254 791 405 612',
    gender: 'female',
    age: 26,
    dob: '2000-01-15',
    country: 'Kenya',
    city: 'Mombasa',
    location: 'Nyali & Diani, Coastal Kenya',
    description: 'Marine conservationist & coastal guide. Living by the tides, morning beach jogs, Swahili seafood dining, and sunset dhow cruises. Always carrying sunshine and positive energy.',
    lookingFor: 'Someone genuine, respectful, and adventurous to share coastal escapes, snorkeling trips, and hearty laughter.',
    datingIntention: 'travel_partner',
    photos: [
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
    ],
    primaryPhoto: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80',
    full_body_photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80',
    full_body_verified: true,
    fullBodyModerationStatus: 'approved',
    likes: 89,
    likedByUserEmails: ['guest@airbus.ke'],
    views: 620,
    status: 'active',
    createdAt: Date.now() - 10 * 864e5,
    updatedAt: Date.now() - 1 * 864e5,
  },
  {
    id: 'tdp_4',
    userId: 'u_brian',
    fullName: 'Brian Mwangi',
    phoneNumber: '+254 702 334 119',
    gender: 'male',
    age: 32,
    dob: '1994-11-03',
    country: 'Kenya',
    city: 'Nakuru',
    location: 'Milimani, Nakuru & Nairobi',
    description: 'Renewable energy engineer & wildlife photography hobbyist. Love weekend drives around the Rift Valley lakes, campfires under star-filled skies, and cooking gourmet meals.',
    lookingFor: 'An open-hearted companion who enjoys nature, intellectual curiosity, and building something meaningful together.',
    datingIntention: 'serious_relationship',
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=800&q=80',
    ],
    primaryPhoto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
    full_body_photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
    full_body_verified: true,
    fullBodyModerationStatus: 'approved',
    likes: 38,
    likedByUserEmails: [],
    views: 295,
    status: 'active',
    createdAt: Date.now() - 18 * 864e5,
    updatedAt: Date.now() - 3 * 864e5,
  },
  {
    id: 'tdp_5',
    userId: 'u_faith',
    fullName: 'Faith Wambui',
    phoneNumber: '+254 715 892 014',
    gender: 'female',
    age: 25,
    dob: '2001-06-25',
    country: 'Kenya',
    city: 'Nairobi',
    location: 'Karen & Lavington, Nairobi',
    description: 'Interior decorator & botanical plant collector. I believe life is made sweeter by jazz, fresh blooms, warm baked bread, and great road trips to the countryside.',
    lookingFor: 'A chivalrous, grounded guy who appreciates creativity, loves travel, and isn’t afraid to be silly on a Saturday afternoon.',
    datingIntention: 'dating_companionship',
    photos: [
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1589571894960-20bbe2828d0a?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
    ],
    primaryPhoto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
    full_body_photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
    full_body_verified: true,
    fullBodyModerationStatus: 'approved',
    likes: 54,
    likedByUserEmails: [],
    views: 410,
    status: 'active',
    createdAt: Date.now() - 12 * 864e5,
    updatedAt: Date.now() - 2 * 864e5,
  },
  {
    id: 'tdp_6',
    userId: 'u_dennis',
    fullName: 'Dennis Kiprop',
    phoneNumber: '+254 725 610 933',
    gender: 'male',
    age: 29,
    dob: '1997-09-14',
    country: 'Kenya',
    city: 'Eldoret',
    location: 'Eldoret & Nairobi',
    description: 'Agritech founder, long-distance runner & coffee enthusiast. Balancing technology and nature. Looking forward to exploring more of East Africa.',
    lookingFor: 'An energetic, driven partner who enjoys outdoor adventures, fitness, and shared ambitious dreams.',
    datingIntention: 'dating_companionship',
    photos: [
      'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80',
    ],
    primaryPhoto: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=800&q=80',
    full_body_photo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=800&q=80',
    full_body_verified: true,
    fullBodyModerationStatus: 'approved',
    likes: 31,
    likedByUserEmails: [],
    views: 220,
    status: 'active',
    createdAt: Date.now() - 8 * 864e5,
    updatedAt: Date.now() - 1 * 864e5,
  },
];

class DatabaseStore {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
    this.checkSubscriptionExpirations();
    this.checkUpcomingCheckinReminders();
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
          if (!parsed.tripDatingProfiles || parsed.tripDatingProfiles.length === 0) {
            parsed.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
          }
          if (!parsed.tripDatingPaymentRequests) parsed.tripDatingPaymentRequests = [];
          if (!parsed.tripDatingContactUnlocks) parsed.tripDatingContactUnlocks = [];
          if (!parsed.paymentRecords) parsed.paymentRecords = [];
          if (!parsed.walletTransactions) parsed.walletTransactions = [];
          if (!parsed.reports) parsed.reports = [];
          if (Array.isArray(parsed.stays)) {
            parsed.stays.forEach((stay: any) => {
              if (!stay.media) {
                const photos: any[] = [];
                if (stay.images && stay.images.length > 0) {
                  stay.images.forEach((url: string, i: number) => {
                    photos.push({ url, order: i, isCover: i === 0 });
                  });
                } else if (stay.thumbnailUrl) {
                  photos.push({ url: stay.thumbnailUrl, order: 0, isCover: true });
                }

                stay.media = {
                  video: stay.videoUrl ? {
                    url: stay.videoUrl,
                    thumbnail: stay.thumbnailUrl || (photos[0]?.url || ''),
                    duration: 60,
                    size: 15000000,
                  } : null,
                  photos,
                };
              }
              stay.hasVideo = Boolean(stay.media?.video?.url && stay.media.video.url.trim().length > 0);
              stay.hasPhotos = Boolean(stay.media?.photos && stay.media.photos.length > 0);
              if (!stay.moderationStatus) stay.moderationStatus = 'approved';
              if (!stay.mediaModerationStatus) stay.mediaModerationStatus = 'clean';
            });
          }
          if (!parsed.adSlots) {
            parsed.adSlots = [
              {
                id: 'adslot_kenya_safari',
                ownerId: 'owner@airbus.ke',
                owner_id: 'owner@airbus.ke',
                title: 'Nairobi Luxury Safari Loft & Car Hire',
                description: 'Special 20% discount on weekend getaways and airport transfers across Nairobi.',
                linkUrl: 'https://airbus.ke',
                link_url: 'https://airbus.ke',
                thumbnailUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
                thumbnail_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
                videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                durationDays: 30,
                duration_days: 30,
                costSc: 300,
                cost_sc: 300,
                status: 'active',
                paymentId: 'pay_demo_1',
                payment_id: 'pay_demo_1',
                paymentMethod: 'wallet',
                impressions: 1420,
                clicks: 86,
                startsAt: Date.now() - 5 * 864e5,
                endsAt: Date.now() + 25 * 864e5,
                createdAt: Date.now() - 5 * 864e5,
                updatedAt: Date.now() - 5 * 864e5,
              },
            ];
          }
          if (!parsed.subscriptions) {
            parsed.subscriptions = [
              {
                id: 'sub_owner_demo',
                ownerId: 'owner@airbus.ke',
                owner_id: 'owner@airbus.ke',
                tier: 'Diamond',
                billing: 'monthly',
                status: 'active',
                startsAt: Date.now() - 2 * 864e5,
                endsAt: Date.now() + 28 * 864e5,
                paymentId: 'pay_demo_1',
                createdAt: Date.now() - 2 * 864e5,
                updatedAt: Date.now() - 2 * 864e5,
              },
            ];
          }
          if (!parsed.follows) parsed.follows = [];
          if (!parsed.listingLikes) parsed.listingLikes = [];
          if (!parsed.listingViews) parsed.listingViews = [];
          if (!parsed.autoShorts) parsed.autoShorts = [];
          if (!parsed.boosts) parsed.boosts = [];
          if (!parsed.sponsorSlots) parsed.sponsorSlots = [];

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
          userId: 'owner@airbus.ke',
          user_id: 'owner@airbus.ke',
          type: 'subscription',
          method: 'wallet',
          amountSc: 2500,
          amount_sc: 2500,
          amountKes: 2500,
          amount_kes: 2500,
          amount: 2500,
          referenceId: 'sub_owner_demo',
          reference_id: 'sub_owner_demo',
          kind: 'plan',
          tier: 'Diamond',
          planTier: 'Diamond',
          mpesaCode: 'QGH7X2K9LM',
          status: 'approved',
          createdAt: Date.now() - 10 * 864e5,
          updatedAt: Date.now() - 10 * 864e5,
        },
      ],
      paymentRecords: [
        {
          id: 'pay_demo_1',
          userId: 'owner@airbus.ke',
          user_id: 'owner@airbus.ke',
          hostEmail: 'owner@airbus.ke',
          type: 'subscription',
          method: 'wallet',
          amountSc: 2500,
          amount_sc: 2500,
          amountKes: 2500,
          amount_kes: 2500,
          amount: 2500,
          referenceId: 'sub_owner_demo',
          reference_id: 'sub_owner_demo',
          planTier: 'Diamond',
          durationDays: 30,
          period: 'monthly',
          status: 'approved',
          approvedBy: 'admin@airbus.ke',
          approvedAt: Date.now() - 10 * 864e5,
          createdAt: Date.now() - 10 * 864e5,
          updatedAt: Date.now() - 10 * 864e5,
        },
      ],
      walletTransactions: [
        {
          id: 'wtx_seed_1',
          walletId: 'owner@airbus.ke',
          wallet_id: 'owner@airbus.ke',
          direction: 'debit',
          amountSc: 2500,
          amount_sc: 2500,
          relatedPaymentId: 'pay_demo_1',
          note: 'Subscription payment for Diamond tier (30 days)',
          createdAt: Date.now() - 10 * 864e5,
        },
      ],
      adSlots: [
        {
          id: 'adslot_kenya_safari',
          ownerId: 'owner@airbus.ke',
          owner_id: 'owner@airbus.ke',
          title: 'Nairobi Luxury Safari Loft & Car Hire',
          description: 'Special 20% discount on weekend getaways and airport transfers across Nairobi.',
          linkUrl: 'https://airbus.ke',
          link_url: 'https://airbus.ke',
          thumbnailUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
          thumbnail_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          durationDays: 30,
          duration_days: 30,
          costSc: 300,
          cost_sc: 300,
          status: 'active',
          paymentId: 'pay_demo_1',
          payment_id: 'pay_demo_1',
          paymentMethod: 'wallet',
          impressions: 1420,
          clicks: 86,
          startsAt: Date.now() - 5 * 864e5,
          endsAt: Date.now() + 25 * 864e5,
          createdAt: Date.now() - 5 * 864e5,
          updatedAt: Date.now() - 5 * 864e5,
        },
      ],
      subscriptions: [
        {
          id: 'sub_owner_demo',
          ownerId: 'owner@airbus.ke',
          owner_id: 'owner@airbus.ke',
          tier: 'Diamond',
          billing: 'monthly',
          status: 'active',
          startsAt: Date.now() - 2 * 864e5,
          endsAt: Date.now() + 28 * 864e5,
          paymentId: 'pay_demo_1',
          createdAt: Date.now() - 2 * 864e5,
          updatedAt: Date.now() - 2 * 864e5,
        },
      ],
      follows: [],
      listingLikes: [],
      listingViews: [],
      autoShorts: [],
      boosts: [],
      sponsorSlots: [],
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
      tripDatingProfiles: SEED_TRIP_DATING_PROFILES,
      tripDatingPaymentRequests: [],
      tripDatingContactUnlocks: [],
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

  public checkAllExpirations() {
    this.checkSubscriptionExpirations();
    const now = Date.now();
    let changed = false;

    // 1. Expire boosts
    if (this.data.boosts) {
      for (const boost of this.data.boosts) {
        if (boost.status === 'active' && boost.ends_at && boost.ends_at < now) {
          boost.status = 'expired';
          changed = true;
          const stayId = boost.listing_id || boost.listingId;
          const otherActive = this.data.boosts.some(
            b => (b.listing_id === stayId || b.listingId === stayId) && b.status === 'active' && b.ends_at && b.ends_at >= now
          );
          if (!otherActive && stayId) {
            const stay = this.data.stays.find(s => s.id === stayId);
            if (stay) {
              stay.isPromoted = false;
              stay.promotedUntil = undefined;
            }
          }
        }
      }
    }

    // 2. Expire sponsor slots
    if (this.data.sponsorSlots) {
      for (const slot of this.data.sponsorSlots) {
        if (slot.status === 'active' && slot.ends_at && slot.ends_at < now) {
          slot.status = 'expired';
          changed = true;
        }
      }
    }

    // 3. Expire adSlots
    if (this.data.adSlots) {
      for (const slot of this.data.adSlots) {
        if (slot.status === 'active' && slot.endsAt && slot.endsAt < now) {
          slot.status = 'expired';
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

  // --- Single Admin Management ---
  public hasAdminAccount(): boolean {
    return this.data.users.some(u => u.role === 'admin');
  }

  public getAdminUser(): User | undefined {
    return this.data.users.find(u => u.role === 'admin');
  }

  public getAdminEmail(): string {
    const admin = this.getAdminUser();
    return admin ? admin.email : 'admin@airbus.ke';
  }

  public registerSingleAdmin(data: {
    name: string;
    email: string;
    passwordHash: string;
    phone?: string;
    location?: string;
  }): User {
    if (this.hasAdminAccount()) {
      throw new Error('An administrator account is already registered. Registration is permanently closed.');
    }
    const cleanEmail = data.email.trim().toLowerCase();
    const existing = this.findUserByEmail(cleanEmail);
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const newAdmin: User = {
      id: 'u_admin_' + Date.now(),
      name: data.name.trim(),
      email: cleanEmail,
      role: 'admin',
      passwordHash: data.passwordHash,
      phone: data.phone || '+254 700 000 000',
      location: data.location || 'Headquarters, Nairobi',
      bio: 'Platform Administrator at AirBus Global.',
      languages: 'English, Swahili',
      idVerified: true,
      createdAt: Date.now(),
    } as any;

    this.data.users.push(newAdmin);
    this.data.isSingleAdminRegistered = true;
    this.ensureWallet(cleanEmail);
    this.save();
    return newAdmin;
  }

  public updateAdminCredentials(
    currentEmail: string,
    currentPasswordHash: string,
    updates: {
      newName?: string;
      newEmail?: string;
      newPasswordHash?: string;
    }
  ): User {
    const admin = this.findUserByEmail(currentEmail);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Admin user not found.');
    }
    if (admin.passwordHash !== currentPasswordHash) {
      throw new Error('Incorrect current password.');
    }

    if (updates.newName && updates.newName.trim()) {
      admin.name = updates.newName.trim();
    }

    if (updates.newPasswordHash) {
      admin.passwordHash = updates.newPasswordHash;
    }

    if (updates.newEmail) {
      const cleanNewEmail = updates.newEmail.trim().toLowerCase();
      if (cleanNewEmail !== admin.email) {
        const existing = this.findUserByEmail(cleanNewEmail);
        if (existing) {
          throw new Error('An account with that email already exists.');
        }
        const oldEmail = admin.email;
        admin.email = cleanNewEmail;

        if (this.data.wallets[oldEmail] !== undefined) {
          this.data.wallets[cleanNewEmail] = this.data.wallets[oldEmail];
          delete this.data.wallets[oldEmail];
        }
        if (this.data.walletRecords[oldEmail] !== undefined) {
          const rec = this.data.walletRecords[oldEmail];
          rec.email = cleanNewEmail;
          this.data.walletRecords[cleanNewEmail] = rec;
          delete this.data.walletRecords[oldEmail];
        }
      }
    }

    this.save();
    return admin;
  }

  public resetAdminPassword(email: string, newPasswordHash: string): User {
    const admin = this.findUserByEmail(email);
    if (!admin || admin.role !== 'admin') {
      throw new Error('No administrator account found with this email.');
    }
    admin.passwordHash = newPasswordHash;
    this.save();
    return admin;
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
    this.checkAllExpirations();

    let list = this.data.stays;

    // By default, public feed only shows live, admin-approved stays whose owner subscription is active
    if (!filter?.status) {
      list = list.filter(s => {
        if (s.status !== 'live' || s.isDelisted) return false;
        // Verify host subscription is active
        if (s.ownerEmail) {
          const plan = this.getHostPlan(s.ownerEmail);
          if (plan.status !== 'active' || (plan.expiresAt > 0 && plan.expiresAt < Date.now())) return false;
        }
        return true;
      });
    } else {
      list = list.filter(s => s.status === filter.status && !s.isDelisted);
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

    // Active boosts rank listings at top of feed with Promoted Boost badge, followed by newest
    const now = Date.now();
    return list.slice().sort((a, b) => {
      const aBoosted = Boolean(a.isPromoted && a.promotedUntil && a.promotedUntil > now);
      const bBoosted = Boolean(b.isPromoted && b.promotedUntil && b.promotedUntil > now);
      if (aBoosted && !bBoosted) return -1;
      if (!aBoosted && bBoosted) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  public getStayById(id: string): Stay | undefined {
    const s = this.data.stays.find(stay => stay.id === id);
    if (!s) return undefined;
    if (s.ownerEmail) {
      const plan = this.getHostPlan(s.ownerEmail);
      const isExpired = plan.status !== 'active' || (plan.expiresAt > 0 && plan.expiresAt < Date.now());
      return {
        ...s,
        ownerSubscriptionExpired: isExpired,
      };
    }
    return s;
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
    this.normalizeStayMedia(stay);
    if (!stay.hasVideo && !stay.hasPhotos) {
      throw new Error('At least one media type is required (one video tour or at least one photo).');
    }
    if (stay.media?.photos && stay.media.photos.length > 30) {
      throw new Error('Maximum 30 photos allowed per listing.');
    }
    this.data.stays.unshift(stay);
    // Auto-generate shorts based on owner subscription tier (Diamond = 1, Gold = 5, Silver = 0)
    if (stay.ownerEmail && stay.videoUrl) {
      const plan = this.getHostPlan(stay.ownerEmail);
      this.generateAutoShortsForListing(stay, plan.tier || 'Silver');
    }
    this.save();
    return stay;
  }

  public updateStay(id: string, updates: Partial<Stay>): Stay | null {
    const s = this.getStayById(id);
    if (!s) return null;
    Object.assign(s, updates);
    this.normalizeStayMedia(s);
    if (!s.hasVideo && !s.hasPhotos) {
      throw new Error('Listing must retain at least one media type (video or at least one photo).');
    }
    if (s.media?.photos && s.media.photos.length > 30) {
      throw new Error('Maximum 30 photos allowed per listing.');
    }
    if (updates.videoUrl && s.ownerEmail) {
      const plan = this.getHostPlan(s.ownerEmail);
      this.generateAutoShortsForListing(s, plan.tier || 'Silver');
    }
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
      // Find or create chat thread between guest and host for this stay
      let thread = this.data.threads.find(
        t =>
          t.stayId === stay.id &&
          t.guestEmail.toLowerCase() === booking.guestEmail.toLowerCase() &&
          t.hostEmail.toLowerCase() === stay.ownerEmail!.toLowerCase()
      );

      if (!thread) {
        thread = {
          id: 'th_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          stayId: stay.id,
          guestEmail: booking.guestEmail.toLowerCase(),
          hostEmail: stay.ownerEmail.toLowerCase(),
          messages: [],
          unreadGuest: false,
          unreadHost: true,
          updatedAt: Date.now(),
        };
        this.data.threads.unshift(thread);
      }

      // Add booking context message at top of chat thread
      thread.messages.push({
        id: 'msg_b_' + Date.now(),
        from: 'system',
        type: 'text',
        text: `📌 New Reservation Context: ${booking.reference}\nDates: ${booking.checkIn} to ${booking.checkOut}\nGuests: ${booking.guests} | Total: ${booking.currency} ${booking.total.toLocaleString()}\nPayment: Guest pays on arrival outside the platform.`,
        createdAt: Date.now(),
      });
      thread.unreadHost = true;
      thread.updatedAt = Date.now();

      // Real-time host notification with deep-link opening chat thread
      this.createNotification({
        id: 'notif_' + Date.now(),
        userEmail: stay.ownerEmail,
        title: 'New Booking Reservation',
        message: `${booking.guestName} has booked your listing ${stay.title}`,
        read: false,
        link: `/#chat?thread=${thread.id}`,
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

  // --- Automatic 24-Hour Stay Check-in Alerts ---
  public checkUpcomingCheckinReminders(userEmail?: string): Array<{
    booking: Booking;
    stay: Stay;
    hoursUntilCheckIn: number;
    isWithin24Hours: boolean;
  }> {
    const now = Date.now();
    const results: Array<{
      booking: Booking;
      stay: Stay;
      hoursUntilCheckIn: number;
      isWithin24Hours: boolean;
    }> = [];

    let hasCreatedNotification = false;

    for (const b of this.data.bookings) {
      if (b.status !== 'confirmed') continue;
      if (userEmail && b.guestEmail.toLowerCase() !== userEmail.toLowerCase()) continue;

      // Calculate checkIn timestamp (standard 14:00 check-in time)
      const checkInDate = new Date(`${b.checkIn}T14:00:00`);
      const checkInTime = !isNaN(checkInDate.getTime()) ? checkInDate.getTime() : new Date(b.checkIn).getTime();
      if (isNaN(checkInTime)) continue;

      const diffMs = checkInTime - now;
      const hoursUntilCheckIn = Math.round((diffMs / (3600 * 1000)) * 10) / 10;
      const isWithin24Hours = diffMs > 0 && diffMs <= 24 * 3600 * 1000;
      const isToday = diffMs <= 0 && diffMs >= -14 * 3600 * 1000;

      const stay = this.getStayById(b.stayId);
      if (!stay) continue;

      if (isWithin24Hours || isToday) {
        results.push({
          booking: b,
          stay,
          hoursUntilCheckIn: Math.max(0, hoursUntilCheckIn),
          isWithin24Hours: true,
        });

        // 1. Generate persistent 24h reminder notification for guest if not already sent
        const guestNotifId = `notif_remind_24h_${b.id}`;
        const alreadyGuestNotified = this.data.notifications.some(n => n.id === guestNotifId);
        if (!alreadyGuestNotified) {
          const timeText = diffMs > 0 ? `in ~${Math.max(1, Math.round(hoursUntilCheckIn))} hours` : 'today';
          this.data.notifications.unshift({
            id: guestNotifId,
            userEmail: b.guestEmail,
            title: `🛎️ 24h Check-in Reminder: ${stay.title}`,
            message: `Your stay at "${stay.title}" (${stay.location}) starts ${timeText}! Check-in: ${b.checkIn}. Host contact: ${stay.whatsapp || stay.hostPhone || 'Direct message'}. Have a wonderful trip!`,
            read: false,
            link: '/#guest',
            type: 'booking',
            createdAt: now,
          });
          hasCreatedNotification = true;
        }

        // 2. Generate persistent notification for host if not already sent
        if (stay.ownerEmail) {
          const hostNotifId = `notif_host_remind_24h_${b.id}`;
          const alreadyHostNotified = this.data.notifications.some(n => n.id === hostNotifId);
          if (!alreadyHostNotified) {
            this.data.notifications.unshift({
              id: hostNotifId,
              userEmail: stay.ownerEmail,
              title: `🛎️ Guest Check-in within 24 Hours: ${b.guestName}`,
              message: `Guest ${b.guestName} is arriving on ${b.checkIn} for "${stay.title}". Check-in ready!`,
              read: false,
              link: '/#owner',
              type: 'booking',
              createdAt: now,
            });
            hasCreatedNotification = true;
          }
        }
      }
    }

    if (hasCreatedNotification) {
      this.save();
    }

    return results;
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
    // Check if scheduled tier upgrade/downgrade transition is due
    if (plan.scheduledTier && plan.expiresAt > 0 && now >= plan.expiresAt) {
      const isAnnual = plan.scheduledPeriod === 'annual';
      const durationMs = isAnnual ? 365 * 864e5 : 30 * 864e5;
      plan.tier = plan.scheduledTier;
      plan.period = plan.scheduledPeriod || 'monthly';
      plan.expiresAt = plan.expiresAt + durationMs;
      plan.graceExpiresAt = plan.expiresAt + 2 * 864e5;
      plan.status = 'active';
      delete plan.scheduledTier;
      delete plan.scheduledStartsAt;
      delete plan.scheduledPeriod;
      this.save();
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
    return this.getPaymentRecords();
  }

  public getPaymentRecords(filter?: {
    status?: PaymentRecordStatus;
    type?: PaymentRecordType;
    method?: PaymentRecordMethod;
    search?: string;
  }): PaymentRecord[] {
    let list = this.data.paymentRecords || [];
    if (list.length === 0 && this.data.payments && this.data.payments.length > 0) {
      list = this.data.payments as PaymentRecord[];
    }

    if (filter) {
      if (filter.status && (filter.status as string) !== 'all') {
        list = list.filter(p => p.status === filter.status);
      }
      if (filter.type && (filter.type as string) !== 'all') {
        list = list.filter(p => p.type === filter.type || (filter.type === 'subscription' && p.kind === 'plan'));
      }
      if (filter.method && (filter.method as string) !== 'all') {
        list = list.filter(p => (p.method || 'mpesa') === filter.method);
      }
      if (filter.search && filter.search.trim()) {
        const q = filter.search.toLowerCase().trim();
        list = list.filter(p =>
          (p.id && p.id.toLowerCase().includes(q)) ||
          (p.userId && p.userId.toLowerCase().includes(q)) ||
          (p.hostEmail && p.hostEmail.toLowerCase().includes(q)) ||
          (p.referenceId && p.referenceId.toLowerCase().includes(q)) ||
          (p.mpesaCode && p.mpesaCode.toLowerCase().includes(q))
        );
      }
    }

    return list.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  public createPayment(input: any): PaymentRecord {
    const p: PaymentRecord = {
      id: input.id || ('pay_' + Date.now()),
      userId: input.userId || input.hostEmail || 'guest@airbus.ke',
      user_id: input.userId || input.hostEmail || 'guest@airbus.ke',
      hostEmail: input.hostEmail || input.userId,
      kind: input.kind || 'wallet',
      type: input.type || (input.kind === 'plan' ? 'subscription' : 'booking_fee'),
      method: input.method || 'mpesa',
      amountSc: input.amountSc || input.amount || 0,
      amount_sc: input.amountSc || input.amount || 0,
      amountKes: input.amountKes || input.amount || 0,
      amount_kes: input.amountKes || input.amount || 0,
      amount: input.amount || input.amountSc || 0,
      status: input.status || 'pending',
      referenceId: input.referenceId || input.id || ('ref_' + Date.now()),
      reference_id: input.referenceId || input.id || ('ref_' + Date.now()),
      mpesaCode: input.mpesaCode,
      mpesa_code: input.mpesaCode,
      planTier: input.planTier || input.tier,
      plan_tier: input.planTier || input.tier,
      tier: input.tier || input.planTier,
      durationDays: input.durationDays,
      duration_days: input.durationDays,
      period: input.period,
      createdAt: input.createdAt || Date.now(),
      created_at: input.createdAt || Date.now(),
      updatedAt: input.updatedAt || Date.now(),
      updated_at: input.updatedAt || Date.now(),
    };

    if (!this.data.paymentRecords) this.data.paymentRecords = [];
    if (!this.data.payments) this.data.payments = [];
    this.data.paymentRecords.unshift(p);
    this.data.payments.unshift(p);

    // Notify admin
    this.data.users
      .filter(u => u.role === 'admin')
      .forEach(admin => {
        this.createNotification({
          id: 'notif_' + Date.now() + Math.random(),
          userEmail: admin.email,
          title: 'New Payment Pending Verification',
          message: `${p.userId || p.hostEmail} submitted KES ${p.amountSc || p.amount} (${p.method.toUpperCase()}, Ref: ${p.mpesaCode || p.id}) for ${p.type || p.kind}.`,
          read: false,
          link: '/#admin',
          type: 'payment',
          createdAt: Date.now(),
        });
      });
    this.save();
    return p;
  }

  public payWithWallet(opts: {
    userId: string;
    type: PaymentRecordType;
    amountSc: number;
    referenceId: string;
    planTier?: StayCategory;
    durationDays?: number;
    period?: 'monthly' | 'annual';
    note?: string;
  }): { payment: PaymentRecord; userTx: WalletTransaction; adminTx: WalletTransaction } {
    const cleanUserId = opts.userId.toLowerCase().trim();
    const intAmount = Math.floor(opts.amountSc);
    if (intAmount <= 0) {
      throw new Error('Payment amount must be greater than 0.');
    }

    const userWallet = this.ensureWallet(cleanUserId);
    const available = userWallet.balance - (userWallet.holdBalance || 0);
    if (available < intAmount) {
      const diff = intAmount - available;
      throw new Error(
        `Insufficient wallet balance. You have ${available} Coins but need ${intAmount} Coins. Please top up the shortfall of ${diff} Coins via M-Pesa to complete this payment.`
      );
    }

    // Atomic deduction from user wallet
    userWallet.balance -= intAmount;
    userWallet.lifetimeSpent = (userWallet.lifetimeSpent || 0) + intAmount;
    userWallet.updatedAt = Date.now();
    this.data.wallets[cleanUserId] = userWallet.balance;

    // Atomic credit to admin/treasury
    const adminWallet = this.ensureWallet('admin@airbus.ke');
    adminWallet.balance += intAmount;
    adminWallet.lifetimeEarnings = (adminWallet.lifetimeEarnings || 0) + intAmount;
    adminWallet.updatedAt = Date.now();
    this.data.wallets['admin@airbus.ke'] = adminWallet.balance;

    const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const payment: PaymentRecord = {
      id: paymentId,
      userId: cleanUserId,
      user_id: cleanUserId,
      hostEmail: cleanUserId,
      type: opts.type,
      kind: opts.type === 'subscription' ? 'plan' : 'advert',
      method: 'wallet',
      amountSc: intAmount,
      amount_sc: intAmount,
      amountKes: intAmount,
      amount_kes: intAmount,
      amount: intAmount,
      status: 'pending',
      referenceId: opts.referenceId,
      reference_id: opts.referenceId,
      planTier: opts.planTier,
      plan_tier: opts.planTier,
      durationDays: opts.durationDays,
      duration_days: opts.durationDays,
      period: opts.period || (opts.durationDays && opts.durationDays > 30 ? 'annual' : 'monthly'),
      createdAt: Date.now(),
      created_at: Date.now(),
      updatedAt: Date.now(),
      updated_at: Date.now(),
    };

    const userTx: WalletTransaction = {
      id: 'wtx_' + Date.now() + '_dr',
      walletId: cleanUserId,
      wallet_id: cleanUserId,
      direction: 'debit',
      amountSc: intAmount,
      amount_sc: intAmount,
      relatedPaymentId: paymentId,
      related_payment_id: paymentId,
      note: opts.note || `Payment for ${opts.type} (${opts.referenceId})`,
      createdAt: Date.now(),
      created_at: Date.now(),
    };

    const adminTx: WalletTransaction = {
      id: 'wtx_' + Date.now() + '_cr',
      walletId: 'admin@airbus.ke',
      wallet_id: 'admin@airbus.ke',
      direction: 'credit',
      amountSc: intAmount,
      amount_sc: intAmount,
      relatedPaymentId: paymentId,
      related_payment_id: paymentId,
      note: `Received ${opts.type} payment (${opts.referenceId}) from ${cleanUserId}`,
      createdAt: Date.now(),
      created_at: Date.now(),
    };

    if (!this.data.paymentRecords) this.data.paymentRecords = [];
    this.data.paymentRecords.unshift(payment);
    if (!this.data.payments) this.data.payments = [];
    this.data.payments.unshift(payment);

    if (!this.data.walletTransactions) this.data.walletTransactions = [];
    this.data.walletTransactions.unshift(userTx, adminTx);

    // Write to ledger
    if (!this.data.ledgerEntries) this.data.ledgerEntries = [];
    this.data.ledgerEntries.unshift({
      id: 'ledg_' + Date.now(),
      fromWallet: cleanUserId,
      toWallet: 'admin@airbus.ke',
      amount: intAmount,
      type: opts.type === 'advert' ? 'ad_payment' : 'subscription',
      referenceId: opts.referenceId,
      description: `Wallet payment of ${intAmount} SC for ${opts.type}`,
      createdAt: Date.now(),
    });

    // Audit log
    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: `wallet_payment_${opts.type}`,
      actorEmail: cleanUserId,
      details: `Paid ${intAmount} SC for ${opts.type} (ref: ${opts.referenceId}) via Wallet`,
      createdAt: Date.now(),
    });

    // Notify Admins
    this.data.users.filter(u => u.role === 'admin').forEach(admin => {
      this.createNotification({
        id: 'notif_' + Date.now() + Math.random(),
        userEmail: admin.email,
        title: `New Pending ${opts.type === 'advert' ? 'Advert' : 'Subscription'} (Wallet)`,
        message: `${cleanUserId} paid ${intAmount} Coins from wallet for ${opts.type}. Awaiting your approval.`,
        read: false,
        link: '/#admin',
        type: 'payment',
        createdAt: Date.now(),
      });
    });

    this.save();
    return { payment, userTx, adminTx };
  }

  public createMpesaPayment(opts: {
    userId: string;
    type: PaymentRecordType;
    amountKes: number;
    mpesaCode: string;
    referenceId: string;
    planTier?: StayCategory;
    durationDays?: number;
    period?: 'monthly' | 'annual';
  }): PaymentRecord {
    const cleanCode = opts.mpesaCode.trim().toUpperCase();
    if (!cleanCode || !/^[A-Z0-9]{10}$/.test(cleanCode)) {
      throw new Error('M-Pesa reference code must be exactly 10 alphanumeric characters (e.g. QGH7X2K9LM).');
    }

    const cleanUserId = opts.userId.toLowerCase().trim();
    const intAmount = Math.floor(opts.amountKes);

    const existing = (this.data.paymentRecords || []).find(
      p => p.mpesaCode === cleanCode && p.status !== 'rejected'
    );
    if (existing) {
      throw new Error('This M-Pesa transaction code has already been submitted and is in verification.');
    }

    const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const payment: PaymentRecord = {
      id: paymentId,
      userId: cleanUserId,
      user_id: cleanUserId,
      hostEmail: cleanUserId,
      type: opts.type,
      kind: opts.type === 'subscription' ? 'plan' : 'advert',
      method: 'mpesa',
      amountSc: intAmount,
      amount_sc: intAmount,
      amountKes: intAmount,
      amount_kes: intAmount,
      amount: intAmount,
      status: 'pending',
      referenceId: opts.referenceId,
      reference_id: opts.referenceId,
      mpesaCode: cleanCode,
      mpesa_code: cleanCode,
      planTier: opts.planTier,
      plan_tier: opts.planTier,
      durationDays: opts.durationDays,
      duration_days: opts.durationDays,
      period: opts.period || (opts.durationDays && opts.durationDays > 30 ? 'annual' : 'monthly'),
      createdAt: Date.now(),
      created_at: Date.now(),
      updatedAt: Date.now(),
      updated_at: Date.now(),
    };

    if (!this.data.paymentRecords) this.data.paymentRecords = [];
    this.data.paymentRecords.unshift(payment);
    if (!this.data.payments) this.data.payments = [];
    this.data.payments.unshift(payment);

    // Audit log
    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: `mpesa_payment_${opts.type}`,
      actorEmail: cleanUserId,
      details: `Submitted M-Pesa receipt ${cleanCode} for KES ${intAmount} (${opts.type}, ref: ${opts.referenceId})`,
      createdAt: Date.now(),
    });

    // Notify admins
    this.data.users.filter(u => u.role === 'admin').forEach(admin => {
      this.createNotification({
        id: 'notif_' + Date.now() + Math.random(),
        userEmail: admin.email,
        title: 'New M-Pesa Payment Verification',
        message: `${cleanUserId} submitted M-Pesa code ${cleanCode} (KES ${intAmount}) for ${opts.type}.`,
        read: false,
        link: '/#admin',
        type: 'payment',
        createdAt: Date.now(),
      });
    });

    this.save();
    return payment;
  }

  public approvePayment(paymentId: string, adminEmail: string): PaymentRecord | null {
    return this.approvePaymentRecord(paymentId, adminEmail);
  }

  public approvePaymentRecord(paymentId: string, adminEmail: string): PaymentRecord {
    const p = (this.data.paymentRecords || []).find(x => x.id === paymentId) ||
              (this.data.payments || []).find(x => x.id === paymentId);
    if (!p) throw new Error('Payment record not found.');
    if (p.status !== 'pending') throw new Error(`Payment is already ${p.status}.`);

    p.status = 'approved';
    p.approvedBy = adminEmail;
    p.approved_by = adminEmail;
    p.approvedAt = Date.now();
    p.approved_at = Date.now();
    p.updatedAt = Date.now();
    p.updated_at = Date.now();

    const pMirror = (this.data.payments || []).find(x => x.id === paymentId);
    if (pMirror && pMirror !== p) {
      pMirror.status = 'approved';
    }

    const now = Date.now();
    const hostEmail = (p.userId || p.hostEmail || '').toLowerCase();

    // 1. If Boost Payment: activate boost & stay promotion
    if (p.type === 'boost' || p.referenceId?.startsWith('boost_') || p.kind === 'boost') {
      const boost = (this.data.boosts || []).find(b => b.id === p.referenceId || b.payment_id === p.id);
      if (boost) {
        boost.status = 'active';
        boost.starts_at = now;
        boost.startsAt = now;
        boost.ends_at = now + (boost.days * 864e5);
        boost.endsAt = boost.ends_at;

        // Activate stay promotion
        const stay = this.getStayById(boost.listing_id || boost.listingId || '');
        if (stay) {
          stay.isPromoted = true;
          stay.promotedUntil = boost.ends_at;
        }

        // Sync legacy promotions table
        if (!this.data.promotions) this.data.promotions = [];
        this.data.promotions.unshift({
          id: boost.id,
          stayId: boost.listing_id || boost.listingId || '',
          ownerEmail: boost.owner_id || boost.ownerId || hostEmail,
          days: boost.days,
          cost: (boost.cost_sc || 70) * 10,
          startsAt: now,
          expiresAt: boost.ends_at,
          status: 'active',
          impressions: 0,
          clicks: 0,
          createdAt: now,
        });
      }
    }

    // 2. If Advert / Sponsor Payment: activate slot & perform 70/30 host/platform revenue split
    if (p.type === 'advert' || p.referenceId?.startsWith('adslot_') || p.referenceId?.startsWith('sponsor_') || p.kind === 'advert') {
      const slot = (this.data.adSlots || []).find(s => s.id === p.referenceId || s.paymentId === p.id);
      if (slot) {
        slot.status = 'active';
        slot.startsAt = now;
        slot.endsAt = now + (slot.durationDays * 864e5);
        slot.updatedAt = now;
      }
      const spSlot = (this.data.sponsorSlots || []).find(s => s.id === p.referenceId || s.payment_id === p.id);
      if (spSlot) {
        spSlot.status = 'active';
        spSlot.starts_at = now;
        spSlot.startsAt = now;
        spSlot.ends_at = now + (spSlot.duration_days * 864e5);
        spSlot.endsAt = spSlot.ends_at;
      }
      const adReq = (this.data.adRequests || []).find(a => a.id === p.referenceId);
      if (adReq) {
        adReq.status = 'approved';
        adReq.startsAt = now;
        adReq.expiresAt = now + (adReq.days * 864e5);
      }

      // 70/30 REVENUE SPLIT:
      // On admin approval, move 70% of amount from admin wallet to listing host's wallet with ledger rows.
      // 30% stays with platform.
      const stayId = spSlot?.listing_id || spSlot?.listingId || adReq?.stayId;
      const stay = stayId ? this.getStayById(stayId) : undefined;
      const stayHostEmail = (stay?.ownerEmail || '').toLowerCase().trim();
      const totalAmountSc = p.amountSc || Math.floor((p.amount || 0) / 10) || 70;
      const hostShareSc = Math.floor(totalAmountSc * 0.7);

      if (stayHostEmail && hostShareSc > 0) {
        const adminWallet = this.ensureWallet('admin@airbus.ke');
        adminWallet.balance = Math.max(0, adminWallet.balance - (hostShareSc * 10));
        adminWallet.updatedAt = now;
        this.data.wallets['admin@airbus.ke'] = adminWallet.balance;

        const hostWallet = this.ensureWallet(stayHostEmail);
        hostWallet.balance += (hostShareSc * 10);
        hostWallet.lifetimeEarnings = (hostWallet.lifetimeEarnings || 0) + (hostShareSc * 10);
        hostWallet.updatedAt = now;
        this.data.wallets[stayHostEmail] = hostWallet.balance;

        if (!this.data.walletTransactions) this.data.walletTransactions = [];
        this.data.walletTransactions.unshift(
          {
            id: 'wtx_' + now + '_admin_split_dr',
            walletId: 'admin@airbus.ke',
            wallet_id: 'admin@airbus.ke',
            direction: 'debit',
            amountSc: hostShareSc,
            amount_sc: hostShareSc,
            relatedPaymentId: p.id,
            related_payment_id: p.id,
            note: `70% host ad payout for stay "${stay?.title || stayId}"`,
            createdAt: now,
            created_at: now,
          },
          {
            id: 'wtx_' + now + '_host_split_cr',
            walletId: stayHostEmail,
            wallet_id: stayHostEmail,
            direction: 'credit',
            amountSc: hostShareSc,
            amount_sc: hostShareSc,
            relatedPaymentId: p.id,
            related_payment_id: p.id,
            note: `70% sponsor ad revenue received for stay "${stay?.title || stayId}"`,
            createdAt: now,
            created_at: now,
          }
        );

        this.createNotification({
          id: 'notif_' + now + '_host_split',
          userEmail: stayHostEmail,
          title: 'Sponsor Ad Revenue Credited! 💰',
          message: `You earned ${hostShareSc} SC (KES ${(hostShareSc * 10).toLocaleString()}) from an approved sponsor ad on your listing "${stay?.title}".`,
          read: false,
          link: '/#owner',
          type: 'payment',
          createdAt: now,
        });
      }
    }

    // 3. If Subscription Payment: activate subscription & hostPlan
    if (p.type === 'subscription' || p.kind === 'plan') {
      const sub = (this.data.subscriptions || []).find(s => s.id === p.referenceId || s.paymentId === p.id);
      const isAnnual = p.period === 'annual' || (sub && sub.billing === 'annual');
      const durationMs = isAnnual ? 365 * 864e5 : 30 * 864e5;
      const endsAt = now + durationMs;

      if (sub) {
        sub.status = 'active';
        sub.startsAt = now;
        sub.endsAt = endsAt;
        sub.updatedAt = now;
      } else {
        if (!this.data.subscriptions) this.data.subscriptions = [];
        this.data.subscriptions.unshift({
          id: 'sub_' + Date.now(),
          ownerId: hostEmail,
          owner_id: hostEmail,
          tier: (p.planTier as StayCategory) || p.tier || 'Diamond',
          billing: isAnnual ? 'annual' : 'monthly',
          status: 'active',
          startsAt: now,
          endsAt: endsAt,
          paymentId: p.id,
          createdAt: now,
          updatedAt: now,
        });
      }

      this.setHostPlan(hostEmail, {
        tier: (p.planTier as StayCategory) || p.tier || 'Diamond',
        status: 'active',
        expiresAt: endsAt,
        graceExpiresAt: endsAt + 2 * 864e5,
        hasPaidSubscription: true,
        period: isAnnual ? 'annual' : 'monthly',
      });

      // Restore stays
      this.data.stays.forEach(s => {
        if (s.ownerEmail?.toLowerCase() === hostEmail) {
          if (s.status === 'expired' || s.status === 'delisted' || s.isDelisted) {
            s.status = 'live';
            s.isDelisted = false;
          }
        }
      });
    }

    // 4. If standard wallet deposit
    if (p.kind === 'wallet' || p.type === 'wallet_topup') {
      this.addWallet(hostEmail, (p.amountSc || p.amount) * 10);
    }

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'payment_approve',
      actorEmail: adminEmail,
      details: `Approved ${p.type || p.kind} (${p.amountSc || p.amount} SC, method ${p.method}) for ${hostEmail}`,
      createdAt: now,
    });

    const itemLabel = p.type === 'boost' ? 'Visibility Boost' : p.type === 'advert' ? 'Advert Campaign' : p.type === 'subscription' ? 'Hosting Subscription' : 'Payment';
    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: hostEmail,
      title: `${itemLabel} Approved! ✓`,
      message: `Your payment of ${p.amountSc || p.amount} Coins (${p.method.toUpperCase()}) was verified! Your ${itemLabel.toLowerCase()} is now active.`,
      read: false,
      link: p.type === 'advert' ? '/#ads' : '/#owner',
      type: p.type === 'subscription' ? 'subscription' : 'payment',
      createdAt: now,
    });

    this.save();
    return p;
  }

  // --- Dormant Owners (Inactive for >= 90 days / 3 months) & Delisting ---
  public getDormantOwners(): DormantOwner[] {
    const now = Date.now();
    const ninetyDaysMs = 90 * 864e5;
    const owners = this.data.users.filter(u => u.role === 'owner');

    const dormantList: DormantOwner[] = [];

    for (const owner of owners) {
      const plan = this.getHostPlan(owner.email);
      const stays = this.data.stays.filter(s => s.ownerEmail?.toLowerCase() === owner.email.toLowerCase());
      const hasDelisted = stays.some(s => s.isDelisted || s.status === 'delisted');

      const isExpiredLongEnough = plan.expiresAt > 0 && (now - plan.expiresAt) >= ninetyDaysMs;
      const isNeverActiveLongEnough = plan.expiresAt === 0 && (now - (owner.createdAt || 0)) >= ninetyDaysMs;

      if (isExpiredLongEnough || isNeverActiveLongEnough || hasDelisted) {
        const daysInactive = plan.expiresAt > 0
          ? Math.max(0, Math.floor((now - plan.expiresAt) / 864e5))
          : Math.max(0, Math.floor((now - (owner.createdAt || 0)) / 864e5));

        dormantList.push({
          name: owner.name,
          email: owner.email,
          tier: plan.tier || 'Silver',
          lastExpiryDate: plan.expiresAt || 0,
          daysInactive,
          listingCount: stays.length,
          isDelisted: hasDelisted,
        });
      }
    }

    return dormantList;
  }

  public delistOwner(email: string): boolean {
    const low = email.toLowerCase();
    let updated = false;

    this.data.stays.forEach(s => {
      if (s.ownerEmail?.toLowerCase() === low) {
        s.isDelisted = true;
        s.status = 'delisted';
        s.delistedAt = Date.now();
        updated = true;
      }
    });

    if (updated) {
      this.createAuditLog({
        id: 'aud_' + Date.now(),
        action: 'owner_delist',
        actorEmail: 'admin@airbus.ke',
        details: `Delisted all stays for dormant owner ${email}`,
        createdAt: Date.now(),
      });
      this.save();
    }
    return updated;
  }

  public relistOwner(email: string): boolean {
    const low = email.toLowerCase();
    let updated = false;

    this.data.stays.forEach(s => {
      if (s.ownerEmail?.toLowerCase() === low) {
        s.isDelisted = false;
        s.status = 'live';
        updated = true;
      }
    });

    if (updated) {
      this.createAuditLog({
        id: 'aud_' + Date.now(),
        action: 'owner_relist',
        actorEmail: 'admin@airbus.ke',
        details: `Restored listings to live for owner ${email}`,
        createdAt: Date.now(),
      });
      this.save();
    }
    return updated;
  }

  public rejectPayment(paymentId: string, adminEmail: string, reason?: string): PaymentRecord | null {
    return this.rejectPaymentRecord(paymentId, adminEmail, reason || 'Invalid or unverified receipt details.');
  }

  public rejectPaymentRecord(paymentId: string, adminEmail: string, rejectionReason: string): PaymentRecord {
    const p = (this.data.paymentRecords || []).find(x => x.id === paymentId) ||
              (this.data.payments || []).find(x => x.id === paymentId);
    if (!p) throw new Error('Payment record not found.');
    if (p.status !== 'pending') throw new Error(`Payment is already ${p.status}.`);

    const cleanReason = rejectionReason.trim() || 'Payment could not be verified.';
    p.status = 'rejected';
    p.rejectionReason = cleanReason;
    p.rejection_reason = cleanReason;
    p.approvedBy = adminEmail;
    p.approved_by = adminEmail;
    p.updatedAt = Date.now();
    p.updated_at = Date.now();

    const pMirror = (this.data.payments || []).find(x => x.id === paymentId);
    if (pMirror && pMirror !== p) {
      pMirror.status = 'rejected';
      pMirror.rejectionReason = cleanReason;
    }

    const cleanUserId = (p.userId || p.hostEmail || '').toLowerCase().trim();
    const amount = p.amountSc || p.amount;

    // REVERSAL TRANSFER IF WALLET:
    // Admin wallet debited, user credited, ledger entries created
    if (p.method === 'wallet') {
      const adminWallet = this.ensureWallet('admin@airbus.ke');
      adminWallet.balance = Math.max(0, adminWallet.balance - amount);
      adminWallet.updatedAt = Date.now();
      this.data.wallets['admin@airbus.ke'] = adminWallet.balance;

      const userWallet = this.ensureWallet(cleanUserId);
      userWallet.balance += amount;
      userWallet.lifetimeSpent = Math.max(0, (userWallet.lifetimeSpent || 0) - amount);
      userWallet.updatedAt = Date.now();
      this.data.wallets[cleanUserId] = userWallet.balance;

      const adminRevTx: WalletTransaction = {
        id: 'wtx_' + Date.now() + '_rev_dr',
        walletId: 'admin@airbus.ke',
        wallet_id: 'admin@airbus.ke',
        direction: 'debit',
        amountSc: amount,
        amount_sc: amount,
        relatedPaymentId: p.id,
        related_payment_id: p.id,
        note: `Reversal debit for rejected payment ${p.id}: ${cleanReason}`,
        createdAt: Date.now(),
        created_at: Date.now(),
      };

      const userRevTx: WalletTransaction = {
        id: 'wtx_' + Date.now() + '_rev_cr',
        walletId: cleanUserId,
        wallet_id: cleanUserId,
        direction: 'credit',
        amountSc: amount,
        amount_sc: amount,
        relatedPaymentId: p.id,
        related_payment_id: p.id,
        note: `Refund for rejected ${p.type || p.kind} payment: ${cleanReason}`,
        createdAt: Date.now(),
        created_at: Date.now(),
      };

      if (!this.data.walletTransactions) this.data.walletTransactions = [];
      this.data.walletTransactions.unshift(adminRevTx, userRevTx);

      if (!this.data.ledgerEntries) this.data.ledgerEntries = [];
      this.data.ledgerEntries.unshift({
        id: 'ledg_' + Date.now() + '_refund',
        fromWallet: 'admin@airbus.ke',
        toWallet: cleanUserId,
        amount: amount,
        type: 'ad_fee',
        referenceId: p.id,
        description: `Refund of ${amount} SC for rejected payment (${cleanReason})`,
        createdAt: Date.now(),
      });
    }

    // Deactivate item
    if (p.type === 'boost' || p.referenceId?.startsWith('boost_') || p.kind === 'boost') {
      const boost = (this.data.boosts || []).find(b => b.id === p.referenceId || b.payment_id === p.id);
      if (boost) {
        boost.status = 'rejected';
      }
    }
    if (p.type === 'advert' || p.referenceId?.startsWith('adslot_') || p.referenceId?.startsWith('sponsor_') || p.kind === 'advert') {
      const slot = (this.data.adSlots || []).find(s => s.id === p.referenceId || s.paymentId === p.id);
      if (slot) {
        slot.status = 'rejected';
        slot.rejectionReason = cleanReason;
        slot.updatedAt = Date.now();
      }
      const sp = (this.data.sponsorSlots || []).find(s => s.id === p.referenceId || s.payment_id === p.id);
      if (sp) {
        sp.status = 'rejected';
      }
    }
    if (p.type === 'subscription') {
      const sub = (this.data.subscriptions || []).find(s => s.id === p.referenceId || s.paymentId === p.id);
      if (sub) {
        sub.status = 'rejected';
        sub.updatedAt = Date.now();
      }
    }

    // Audit log
    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'payment_rejected',
      actorEmail: adminEmail,
      details: `Rejected ${p.type || p.kind} payment ${p.id} for ${cleanUserId}. Reason: ${cleanReason}`,
      createdAt: Date.now(),
    });

    // Notify User
    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: cleanUserId,
      title: 'Payment Verification Declined',
      message: `Your payment of ${amount} Coins (${p.method.toUpperCase()}) was declined: "${cleanReason}". ${p.method === 'wallet' ? 'Your wallet balance has been refunded in full.' : 'Please check your receipt or contact support.'}`,
      read: false,
      link: '/#owner',
      type: 'payment',
      createdAt: Date.now(),
    });

    this.save();
    return p;
  }

  // --- Ad Slots (10 SC/day dynamic adverts) ---
  public createAdSlot(opts: {
    ownerId: string;
    title: string;
    description: string;
    linkUrl: string;
    thumbnailUrl: string;
    videoUrl?: string;
    durationDays: number;
    paymentMethod: 'wallet' | 'mpesa';
    mpesaCode?: string;
  }): { slot: AdSlot; payment: PaymentRecord } {
    const days = Math.min(90, Math.max(1, Math.floor(opts.durationDays || 7)));
    const costSc = days * 10; // Exactly 10 SC / day

    const cleanOwnerId = opts.ownerId.toLowerCase().trim();
    const slotId = 'adslot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const slot: AdSlot = {
      id: slotId,
      ownerId: cleanOwnerId,
      owner_id: cleanOwnerId,
      title: opts.title.trim(),
      description: opts.description.trim(),
      linkUrl: opts.linkUrl.trim(),
      link_url: opts.linkUrl.trim(),
      thumbnailUrl: opts.thumbnailUrl.trim() || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
      thumbnail_url: opts.thumbnailUrl.trim() || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
      videoUrl: opts.videoUrl?.trim(),
      video_url: opts.videoUrl?.trim(),
      durationDays: days,
      duration_days: days,
      costSc,
      cost_sc: costSc,
      status: 'pending_approval',
      paymentId: '',
      paymentMethod: opts.paymentMethod,
      mpesaCode: opts.mpesaCode?.trim().toUpperCase(),
      impressions: 0,
      clicks: 0,
      createdAt: Date.now(),
      created_at: Date.now(),
      updatedAt: Date.now(),
      updated_at: Date.now(),
    };

    let payment: PaymentRecord;

    if (opts.paymentMethod === 'wallet') {
      const result = this.payWithWallet({
        userId: cleanOwnerId,
        type: 'advert',
        amountSc: costSc,
        referenceId: slotId,
        durationDays: days,
        note: `Advert Payment for "${opts.title}" (${days} days @ 10 SC/day)`,
      });
      payment = result.payment;
      slot.paymentId = payment.id;
      slot.payment_id = payment.id;
    } else {
      payment = this.createMpesaPayment({
        userId: cleanOwnerId,
        type: 'advert',
        amountKes: costSc,
        mpesaCode: opts.mpesaCode || '',
        referenceId: slotId,
        durationDays: days,
      });
      slot.paymentId = payment.id;
      slot.payment_id = payment.id;
    }

    if (!this.data.adSlots) this.data.adSlots = [];
    this.data.adSlots.unshift(slot);
    this.save();

    return { slot, payment };
  }

  public getActiveAdSlots(): AdSlot[] {
    const now = Date.now();
    if (!this.data.adSlots) this.data.adSlots = [];

    // Expire outdated ad slots
    this.data.adSlots.forEach(slot => {
      if (slot.status === 'active' && slot.endsAt && slot.endsAt <= now) {
        slot.status = 'expired';
        slot.updatedAt = now;
      }
    });

    const activeSlots = this.data.adSlots.filter(s => s.status === 'active' && (!s.endsAt || s.endsAt > now));
    return activeSlots;
  }

  public recordAdSlotImpression(id: string): void {
    const slot = (this.data.adSlots || []).find(s => s.id === id);
    if (slot) {
      slot.impressions = (slot.impressions || 0) + 1;
      this.save();
    }
  }

  public recordAdSlotClick(id: string): void {
    const slot = (this.data.adSlots || []).find(s => s.id === id);
    if (slot) {
      slot.clicks = (slot.clicks || 0) + 1;
      this.save();
    }
  }

  // --- Follows, Likes, and Views (24h de-duplication) ---
  public toggleFollow(followerId: string, ownerId: string): { isFollowing: boolean; followerCount: number } {
    const fId = followerId.toLowerCase().trim();
    const oId = ownerId.toLowerCase().trim();
    if (!this.data.follows) this.data.follows = [];

    const idx = this.data.follows.findIndex(f => f.followerId.toLowerCase() === fId && f.ownerId.toLowerCase() === oId);
    let isFollowing = false;
    if (idx >= 0) {
      this.data.follows.splice(idx, 1);
      isFollowing = false;
    } else {
      this.data.follows.push({
        id: 'fol_' + Date.now(),
        followerId: fId,
        ownerId: oId,
        createdAt: Date.now(),
      });
      isFollowing = true;

      const follower = this.data.users.find(u => u.email.toLowerCase() === fId);
      this.createNotification({
        id: 'notif_' + Date.now(),
        userEmail: oId,
        title: 'New Follower! 🎉',
        message: `${follower?.name || fId} started following your AirBus stays.`,
        read: false,
        link: '/#owner',
        type: 'system',
        createdAt: Date.now(),
      });
    }

    const followerCount = this.data.follows.filter(f => f.ownerId.toLowerCase() === oId).length;

    this.data.stays.forEach(s => {
      if (s.ownerEmail?.toLowerCase() === oId) {
        s.hostFollowerCount = followerCount;
      }
    });

    this.save();
    return { isFollowing, followerCount };
  }

  public toggleListingLike(userId: string, listingId: string): { isLiked: boolean; likesCount: number } {
    const uId = userId.toLowerCase().trim();
    if (!this.data.listingLikes) this.data.listingLikes = [];

    const stay = this.getStayById(listingId);
    if (!stay) throw new Error('Stay not found');

    const idx = this.data.listingLikes.findIndex(l => l.userId.toLowerCase() === uId && l.listingId === listingId);
    let isLiked = false;
    if (idx >= 0) {
      this.data.listingLikes.splice(idx, 1);
      stay.likesCount = Math.max(0, (stay.likesCount || 1) - 1);
      isLiked = false;
    } else {
      this.data.listingLikes.push({
        id: 'like_' + Date.now(),
        userId: uId,
        listingId,
        createdAt: Date.now(),
      });
      stay.likesCount = (stay.likesCount || 0) + 1;
      isLiked = true;
    }

    this.save();
    return { isLiked, likesCount: stay.likesCount };
  }

  public recordListingView(listingId: string, viewerId?: string, sessionId?: string): { recorded: boolean; viewsCount: number } {
    const stay = this.getStayById(listingId);
    if (!stay) throw new Error('Stay not found');

    if (!this.data.listingViews) this.data.listingViews = [];

    const now = Date.now();
    const cleanViewerId = viewerId?.toLowerCase().trim();
    const cleanSessionId = sessionId?.trim() || '';

    // Check unique view per viewer/session per 24 hours
    const recent = this.data.listingViews.find(v => {
      if (v.listingId !== listingId) return false;
      const isSameUser = cleanViewerId && v.viewerId && v.viewerId.toLowerCase() === cleanViewerId;
      const isSameSession = cleanSessionId && v.sessionId === cleanSessionId;
      return (isSameUser || isSameSession) && (now - v.createdAt < 864e5);
    });

    if (recent) {
      return { recorded: false, viewsCount: stay.views || 0 };
    }

    this.data.listingViews.push({
      id: 'vw_' + Date.now() + Math.random().toString(36).substring(2, 5),
      listingId,
      viewerId: cleanViewerId,
      sessionId: cleanSessionId,
      createdAt: now,
    });

    stay.views = (stay.views || 0) + 1;
    this.save();
    return { recorded: true, viewsCount: stay.views };
  }

  public getListingStats(listingId: string, viewerId?: string): {
    followerCount: number;
    isFollowing: boolean;
    likesCount: number;
    isLiked: boolean;
    viewsCount: number;
  } {
    const stay = this.getStayById(listingId);
    if (!stay) {
      return { followerCount: 0, isFollowing: false, likesCount: 0, isLiked: false, viewsCount: 0 };
    }

    const ownerEmail = (stay.ownerEmail || '').toLowerCase();
    const cleanViewerId = (viewerId || '').toLowerCase().trim();

    if (!this.data.follows) this.data.follows = [];
    if (!this.data.listingLikes) this.data.listingLikes = [];

    const followerCount = this.data.follows.filter(f => f.ownerId.toLowerCase() === ownerEmail).length;
    const isFollowing = cleanViewerId
      ? this.data.follows.some(f => f.followerId.toLowerCase() === cleanViewerId && f.ownerId.toLowerCase() === ownerEmail)
      : false;

    const likesCount = stay.likesCount || 0;
    const isLiked = cleanViewerId
      ? this.data.listingLikes.some(l => l.userId.toLowerCase() === cleanViewerId && l.listingId === listingId)
      : false;

    return {
      followerCount,
      isFollowing,
      likesCount,
      isLiked,
      viewsCount: stay.views || 0,
    };
  }

  // --- Subscriptions (Server Enforced Rules) ---
  public getActiveSubscription(ownerId: string): SubscriptionRecord | undefined {
    const cleanOwnerId = ownerId.toLowerCase().trim();
    const now = Date.now();
    return (this.data.subscriptions || []).find(
      s => s.ownerId.toLowerCase() === cleanOwnerId && s.status === 'active' && s.endsAt && s.endsAt > now
    );
  }

  public getPendingSubscription(ownerId: string): SubscriptionRecord | undefined {
    const cleanOwnerId = ownerId.toLowerCase().trim();
    return (this.data.subscriptions || []).find(
      s => s.ownerId.toLowerCase() === cleanOwnerId && s.status === 'pending'
    );
  }

  public purchaseSubscription(opts: {
    ownerId: string;
    tier: StayCategory;
    billing: 'monthly' | 'annual';
    method: 'wallet' | 'mpesa';
    mpesaCode?: string;
  }): { subscription: SubscriptionRecord; payment: PaymentRecord } {
    const cleanOwnerId = opts.ownerId.toLowerCase().trim();

    // SERVER RULE 1: Only one active subscription at a time.
    const activeSub = this.getActiveSubscription(cleanOwnerId);
    if (activeSub) {
      const expiryDate = new Date(activeSub.endsAt!).toLocaleDateString();
      throw new Error(
        `You currently have an active ${activeSub.tier} subscription expiring on ${expiryDate}. Per platform rules, you must finish your current subscription period before upgrading or purchasing a new tier.`
      );
    }

    // SERVER RULE 2: Block second purchase if one is pending approval.
    const pendingSub = this.getPendingSubscription(cleanOwnerId);
    if (pendingSub) {
      throw new Error(
        `You already have a ${pendingSub.tier} subscription request pending admin verification. Please wait for approval before submitting a new one.`
      );
    }

    const isAnnual = opts.billing === 'annual';
    const planConfig = PLANS[opts.tier];
    const cost = isAnnual ? planConfig.annualPrice : planConfig.p;
    const durationDays = isAnnual ? 365 : 30;

    const subId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const subscription: SubscriptionRecord = {
      id: subId,
      ownerId: cleanOwnerId,
      owner_id: cleanOwnerId,
      tier: opts.tier,
      billing: opts.billing,
      status: 'pending',
      paymentId: '',
      createdAt: Date.now(),
      created_at: Date.now(),
      updatedAt: Date.now(),
      updated_at: Date.now(),
    };

    let payment: PaymentRecord;

    if (opts.method === 'wallet') {
      const result = this.payWithWallet({
        userId: cleanOwnerId,
        type: 'subscription',
        amountSc: cost,
        referenceId: subId,
        planTier: opts.tier,
        durationDays,
        period: opts.billing,
        note: `Subscription Payment for ${opts.tier} Plan (${opts.billing === 'annual' ? '365 Days' : '30 Days'})`,
      });
      payment = result.payment;
      subscription.paymentId = payment.id;
    } else {
      payment = this.createMpesaPayment({
        userId: cleanOwnerId,
        type: 'subscription',
        amountKes: cost,
        mpesaCode: opts.mpesaCode || '',
        referenceId: subId,
        planTier: opts.tier,
        durationDays,
        period: opts.billing,
      });
      subscription.paymentId = payment.id;
    }

    if (!this.data.subscriptions) this.data.subscriptions = [];
    this.data.subscriptions.unshift(subscription);
    this.save();

    return { subscription, payment };
  }

  // --- Auto-Generated Shorts from Listing Videos ---
  public generateAutoShortsForListing(stay: Stay, ownerPlanTier: StayCategory): AutoShortRecord[] {
    if (!stay.videoUrl || stay.videoUrl.trim().length === 0) return [];

    let segmentCount = 0;
    if (ownerPlanTier === 'Diamond') {
      segmentCount = 1;
    } else if (ownerPlanTier === 'Gold') {
      segmentCount = 5;
    } else {
      segmentCount = 0; // Silver = 0
    }

    if (segmentCount === 0) return [];

    if (!this.data.autoShorts) this.data.autoShorts = [];
    if (!this.data.posts) this.data.posts = [];

    const newShorts: AutoShortRecord[] = [];
    const ownerEmail = (stay.ownerEmail || '').toLowerCase();

    for (let i = 0; i < segmentCount; i++) {
      const startSec = i * 20;
      const endSec = startSec + 20;
      const shortId = `short_auto_${stay.id}_${i + 1}`;

      if (this.data.autoShorts.some(s => s.id === shortId)) continue;

      const autoShort: AutoShortRecord = {
        id: shortId,
        listingId: stay.id,
        ownerId: ownerEmail,
        title: `${stay.title} - Highlight Tour #${i + 1}`,
        description: `Explore ${stay.title} in ${stay.location}. Book directly with zero guest fees on AirBus.`,
        videoUrl: stay.videoUrl,
        thumbnailUrl: stay.thumbnailUrl || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
        durationSeconds: 20,
        sourceStartSec: startSec,
        sourceEndSec: endSec,
        status: 'ready',
        aspectRatio: '9:16',
        views: 120 + Math.floor(Math.random() * 80),
        likes: 15 + Math.floor(Math.random() * 20),
        createdAt: Date.now(),
      };

      this.data.autoShorts.unshift(autoShort);
      newShorts.push(autoShort);

      const postRecord: Post = {
        id: `post_${shortId}`,
        ownerEmail,
        stayId: stay.id,
        type: 'short',
        description: autoShort.description,
        coverUrl: autoShort.thumbnailUrl,
        videoUrl: stay.videoUrl,
        durationSeconds: 20,
        status: 'approved',
        views: autoShort.views,
        likes: autoShort.likes,
        shares: 4,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.data.posts.unshift(postRecord);
    }

    this.save();
    return newShorts;
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

  public paySubscriptionFromWallet(
    email: string,
    tier: StayCategory,
    period: 'monthly' | 'annual' = 'monthly'
  ): { plan: HostPlanStatus; ledger: LedgerEntry; walletBalance: number } {
    const isAnnual = period === 'annual';
    const annualPrices: Record<StayCategory, number> = { Silver: 10000, Diamond: 25000, Gold: 50000 };
    const settings = this.getSettings();
    const cost = isAnnual
      ? annualPrices[tier]
      : (settings.planPrices as any)?.[tier] || (tier === 'Gold' ? 5000 : tier === 'Diamond' ? 2500 : 1000);

    const rec = this.ensureWallet(email);
    const available = rec.balance - (rec.holdBalance || 0);
    if (available < cost) {
      const diff = cost - available;
      throw new Error(
        `Insufficient coins in wallet: you have ${available} coins, but ${tier} (${period}) requires ${cost} coins. Please top up ${diff} coins (KES ${diff}) via M-Pesa.`
      );
    }

    const durationLabel = isAnnual ? '365-Day Annual' : '30-Day';
    const ledger = this.transfer(
      email,
      'treasury',
      cost,
      'subscription',
      tier,
      `${durationLabel} ${tier} Plan Subscription from wallet`
    );

    // Referral commission check
    this.distributeReferralCommission(email, cost, 'subscription');

    const now = Date.now();
    const cur = this.getHostPlan(email);
    const durationMs = isAnnual ? 365 * 864e5 : 30 * 864e5;

    let targetPlan: HostPlanStatus;
    // Upgrade / Downgrade policy: Host must finish current subscription period first!
    if (cur.status === 'active' && cur.expiresAt > now && cur.tier !== tier) {
      cur.scheduledTier = tier;
      cur.scheduledStartsAt = cur.expiresAt;
      cur.scheduledPeriod = period;
      targetPlan = cur;
      this.setHostPlan(email, cur);
    } else {
      const baseStart = cur.status === 'active' && cur.expiresAt > now ? cur.expiresAt : now;
      const newEnd = baseStart + durationMs;
      const graceEnd = newEnd + 2 * 864e5;

      targetPlan = {
        tier,
        status: 'active',
        expiresAt: newEnd,
        graceExpiresAt: graceEnd,
        hasPaidSubscription: true,
        period,
      };
      this.setHostPlan(email, targetPlan);
    }

    this.data.stays.forEach(s => {
      if (s.ownerEmail?.toLowerCase() === email.toLowerCase()) {
        if (s.status === 'expired' || s.status === 'delisted' || s.isDelisted) {
          s.status = 'live';
          s.isDelisted = false;
        }
      }
    });

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'plan_wallet_pay',
      actorEmail: email,
      details: `Paid ${cost} coins/KES from wallet for ${durationLabel} ${tier} Plan.`,
      createdAt: Date.now(),
    });

    this.createNotification({
      id: 'notif_' + Date.now(),
      userEmail: email,
      title: `${durationLabel} ${tier} Plan ${targetPlan.scheduledTier ? 'Scheduled' : 'Activated'}! 🎉`,
      message: `${cost} coins were deducted from your wallet. ${
        targetPlan.scheduledTier
          ? `Your current plan finishes first, then ${tier} takes effect on ${new Date(targetPlan.expiresAt).toLocaleDateString()}.`
          : `Your subscription is active until ${new Date(targetPlan.expiresAt).toLocaleDateString()}.`
      }`,
      read: false,
      link: '/#owner',
      type: 'subscription',
      createdAt: Date.now(),
    });

    this.save();
    const updatedRec = this.ensureWallet(email);
    const remaining = updatedRec.balance - (updatedRec.holdBalance || 0);
    return { plan: targetPlan, ledger, walletBalance: remaining };
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

  // --- SnappAdd Advert Campaigns ---
  public createSnappAddCampaign(data: {
    userEmail: string;
    title: string;
    description: string;
    websiteUrl: string;
    thumbnailUrl: string;
    videoUrl?: string;
    durationDays: number;
    coinsPaid: number;
  }): { campaign: SnappAddCampaign; walletBalance: number } {
    if (!this.data.snappAddCampaigns) this.data.snappAddCampaigns = [];
    const coins = Math.max(10, Math.floor(data.coinsPaid));
    const cleanEmail = data.userEmail.toLowerCase().trim();

    // Check wallet balance
    const wallet = this.ensureWallet(cleanEmail);
    if (wallet.balance < coins) {
      throw new Error(`Insufficient SnappCoins. You need ${coins} SC, but have ${wallet.balance} SC. Please top up.`);
    }

    // Debit wallet atomically
    wallet.balance -= coins;
    wallet.lifetimeSpent = (wallet.lifetimeSpent || 0) + coins;
    wallet.updatedAt = Date.now();
    this.data.wallets[cleanEmail] = wallet.balance;

    // Credit treasury
    if (this.data.walletRecords?.['treasury']) {
      this.data.walletRecords['treasury'].balance += coins;
      this.data.walletRecords['treasury'].lifetimeEarnings += coins;
      this.data.walletRecords['treasury'].updatedAt = Date.now();
    }

    const campaignId = 'snappadd_' + Date.now();
    const campaign: SnappAddCampaign = {
      id: campaignId,
      userEmail: cleanEmail,
      title: data.title.trim(),
      description: data.description?.trim() || '',
      websiteUrl: data.websiteUrl.trim(),
      thumbnailUrl: data.thumbnailUrl.trim() || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
      videoUrl: data.videoUrl?.trim(),
      targetCategory: 'News & Politics: Local Campaign 3',
      durationDays: data.durationDays,
      coinsPaid: coins,
      status: 'active',
      createdAt: Date.now(),
      expiresAt: Date.now() + data.durationDays * 864e5,
    };

    this.data.snappAddCampaigns.unshift(campaign);

    // Also inject into active adRequests so it rotates across the entire platform
    if (!this.data.adRequests) this.data.adRequests = [];
    this.data.adRequests.unshift({
      id: 'ad_' + campaignId,
      advertiserEmail: cleanEmail,
      stayId: '1',
      title: campaign.title,
      description: campaign.description,
      imageUrl: campaign.thumbnailUrl,
      targetUrl: campaign.websiteUrl,
      tag: 'News & Politics: Local Campaign 3',
      days: campaign.durationDays,
      totalAmount: coins,
      platformFee: coins,
      hostNet: 0,
      status: 'approved',
      startsAt: Date.now(),
      expiresAt: campaign.expiresAt,
      views: 0,
      clicks: 0,
      createdAt: Date.now(),
    });

    this.createAuditLog({
      id: 'aud_snappadd_' + Date.now(),
      action: 'snappadd_campaign_launched',
      actorEmail: cleanEmail,
      details: `Created SnappAdd campaign "${campaign.title}" (${coins} SC) featured below News & Politics: Local Campaign 3 for ${campaign.durationDays} days.`,
      createdAt: Date.now(),
    });

    this.save();
    return { campaign, walletBalance: wallet.balance };
  }

  public getSnappAddCampaigns(): SnappAddCampaign[] {
    if (!this.data.snappAddCampaigns) this.data.snappAddCampaigns = [];
    return this.data.snappAddCampaigns;
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

  // --- Real Visibility Boosts (Atomic Wallet & M-Pesa Verification) ---
  public purchasePromotion(opts: {
    listingId: string;
    ownerEmail: string;
    days: number;
    paymentMethod: 'wallet' | 'mpesa';
    mpesaCode?: string;
  }): {
    boost: BoostRecord;
    payment: PaymentRecord;
    message: string;
  } {
    const cleanEmail = opts.ownerEmail.toLowerCase().trim();
    const stay = this.getStayById(opts.listingId);
    if (!stay) throw new Error('Listing not found');
    if (stay.ownerEmail && stay.ownerEmail.toLowerCase() !== cleanEmail) {
      throw new Error('Only the listing owner can activate a boost on this listing');
    }

    // Pricing calculation strictly on server:
    // 10 SC per day: 1 day = 10 SC, 7 days = 70 SC, 30 days = 300 SC
    const days = Math.max(1, Math.floor(opts.days || 7));
    const costSc = days === 30 ? 300 : days * 10;
    const costKes = costSc * 10;

    const boostId = 'boost_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const paymentId = 'pay_boost_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

    let paymentRecord: PaymentRecord;

    if (opts.paymentMethod === 'wallet') {
      const userWallet = this.ensureWallet(cleanEmail);
      const available = userWallet.balance - (userWallet.holdBalance || 0);
      if (available < costSc) {
        throw new Error('Not enough SC. Top up your wallet or pay with M-Pesa');
      }

      // Debit owner, credit admin
      userWallet.balance -= costSc;
      userWallet.lifetimeSpent = (userWallet.lifetimeSpent || 0) + costSc;
      userWallet.updatedAt = Date.now();
      this.data.wallets[cleanEmail] = userWallet.balance;

      const adminWallet = this.ensureWallet('admin@airbus.ke');
      adminWallet.balance += costSc;
      adminWallet.lifetimeEarnings = (adminWallet.lifetimeEarnings || 0) + costSc;
      adminWallet.updatedAt = Date.now();
      this.data.wallets['admin@airbus.ke'] = adminWallet.balance;

      paymentRecord = {
        id: paymentId,
        userId: cleanEmail,
        user_id: cleanEmail,
        type: 'boost',
        kind: 'boost',
        method: 'wallet',
        amountSc: costSc,
        amount_sc: costSc,
        amountKes: costKes,
        amount_kes: costKes,
        amount: costSc,
        status: 'pending',
        referenceId: boostId,
        reference_id: boostId,
        durationDays: days,
        duration_days: days,
        createdAt: Date.now(),
        created_at: Date.now(),
        updatedAt: Date.now(),
        updated_at: Date.now(),
      };

      const userTx: WalletTransaction = {
        id: 'wtx_' + Date.now() + '_boost_dr',
        walletId: cleanEmail,
        wallet_id: cleanEmail,
        direction: 'debit',
        amountSc: costSc,
        amount_sc: costSc,
        relatedPaymentId: paymentId,
        related_payment_id: paymentId,
        note: `Boost payment for "${stay.title}" (${days} days)`,
        createdAt: Date.now(),
        created_at: Date.now(),
      };

      const adminTx: WalletTransaction = {
        id: 'wtx_' + Date.now() + '_boost_cr',
        walletId: 'admin@airbus.ke',
        wallet_id: 'admin@airbus.ke',
        direction: 'credit',
        amountSc: costSc,
        amount_sc: costSc,
        relatedPaymentId: paymentId,
        related_payment_id: paymentId,
        note: `Boost revenue for "${stay.title}" (${days} days) from ${cleanEmail}`,
        createdAt: Date.now(),
        created_at: Date.now(),
      };

      if (!this.data.walletTransactions) this.data.walletTransactions = [];
      this.data.walletTransactions.unshift(userTx, adminTx);
    } else {
      const cleanCode = (opts.mpesaCode || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{10}$/.test(cleanCode)) {
        throw new Error('Please enter a valid 10-character alphanumeric M-Pesa receipt code (e.g. QGH7X2K9LM).');
      }
      const duplicate = (this.data.paymentRecords || []).some(
        p => (p.mpesaCode?.toUpperCase() === cleanCode || p.mpesa_code?.toUpperCase() === cleanCode)
      );
      if (duplicate) {
        throw new Error('This M-Pesa transaction code has already been submitted. Please check your receipt.');
      }

      paymentRecord = {
        id: paymentId,
        userId: cleanEmail,
        user_id: cleanEmail,
        type: 'boost',
        kind: 'boost',
        method: 'mpesa',
        amountSc: costSc,
        amount_sc: costSc,
        amountKes: costKes,
        amount_kes: costKes,
        amount: costKes,
        mpesaCode: cleanCode,
        mpesa_code: cleanCode,
        status: 'pending',
        referenceId: boostId,
        reference_id: boostId,
        durationDays: days,
        duration_days: days,
        createdAt: Date.now(),
        created_at: Date.now(),
        updatedAt: Date.now(),
        updated_at: Date.now(),
      };
    }

    if (!this.data.paymentRecords) this.data.paymentRecords = [];
    this.data.paymentRecords.unshift(paymentRecord);
    if (!this.data.payments) this.data.payments = [];
    this.data.payments.unshift(paymentRecord);

    const boost: BoostRecord = {
      id: boostId,
      listing_id: stay.id,
      listingId: stay.id,
      owner_id: cleanEmail,
      ownerId: cleanEmail,
      days,
      cost_sc: costSc,
      costSc,
      status: 'pending',
      payment_id: paymentId,
      paymentId,
      created_at: Date.now(),
      createdAt: Date.now(),
    };

    if (!this.data.boosts) this.data.boosts = [];
    this.data.boosts.unshift(boost);

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'boost_purchase',
      actorEmail: cleanEmail,
      details: `Submitted boost for "${stay.title}" (${days} days, ${costSc} SC / KES ${costKes}) via ${opts.paymentMethod.toUpperCase()}`,
      createdAt: Date.now(),
    });

    this.data.users.filter(u => u.role === 'admin').forEach(admin => {
      this.createNotification({
        id: 'notif_' + Date.now() + Math.random(),
        userEmail: admin.email,
        title: 'New Boost Pending Approval',
        message: `${cleanEmail} requested a ${days}-day boost for "${stay.title}" (${opts.paymentMethod.toUpperCase()}).`,
        read: false,
        link: '/#admin',
        type: 'payment',
        createdAt: Date.now(),
      });
    });

    this.save();

    return {
      boost,
      payment: paymentRecord,
      message: 'Boost submitted. It goes live once the admin approves.',
    };
  }

  public getBoosts(ownerEmail?: string): BoostRecord[] {
    this.checkAllExpirations();
    if (!this.data.boosts) this.data.boosts = [];
    if (!ownerEmail) return this.data.boosts;
    const clean = ownerEmail.toLowerCase().trim();
    return this.data.boosts.filter(b => (b.owner_id || b.ownerId || '').toLowerCase() === clean);
  }

  // --- Dynamic Sponsor Slots (1 to 10 Slots with 70/30 Split) ---
  public purchaseSponsorSlot(opts: {
    listingId: string;
    advertiserEmail: string;
    title: string;
    description: string;
    linkUrl: string;
    thumbnailUrl: string;
    durationDays: number;
    paymentMethod: 'wallet' | 'mpesa';
    mpesaCode?: string;
  }): {
    sponsorSlot: SponsorSlot;
    payment: PaymentRecord;
    message: string;
  } {
    const cleanEmail = opts.advertiserEmail.toLowerCase().trim();
    const stay = this.getStayById(opts.listingId);
    if (!stay) throw new Error('Listing stay not found');

    const existingSlots = (this.data.sponsorSlots || []).filter(
      s => (s.listing_id === stay.id || s.listingId === stay.id) && (s.status === 'active' || s.status === 'pending_approval')
    );
    if (existingSlots.length >= 10) {
      throw new Error('Slots full: All 10 sponsor slots for this listing are currently occupied.');
    }

    const nextSlotNumber = existingSlots.length + 1;
    const days = Math.max(1, Math.floor(opts.durationDays || 30));
    const costSc = days === 30 ? 300 : days * 10;
    const costKes = costSc * 10;

    const slotId = 'sponsor_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const paymentId = 'pay_sponsor_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

    let paymentRecord: PaymentRecord;

    if (opts.paymentMethod === 'wallet') {
      const userWallet = this.ensureWallet(cleanEmail);
      const available = userWallet.balance - (userWallet.holdBalance || 0);
      if (available < costSc) {
        throw new Error('Not enough SC. Top up your wallet or pay with M-Pesa');
      }

      userWallet.balance -= costSc;
      userWallet.lifetimeSpent = (userWallet.lifetimeSpent || 0) + costSc;
      userWallet.updatedAt = Date.now();
      this.data.wallets[cleanEmail] = userWallet.balance;

      const adminWallet = this.ensureWallet('admin@airbus.ke');
      adminWallet.balance += costSc;
      adminWallet.lifetimeEarnings = (adminWallet.lifetimeEarnings || 0) + costSc;
      adminWallet.updatedAt = Date.now();
      this.data.wallets['admin@airbus.ke'] = adminWallet.balance;

      paymentRecord = {
        id: paymentId,
        userId: cleanEmail,
        user_id: cleanEmail,
        type: 'advert',
        kind: 'advert',
        method: 'wallet',
        amountSc: costSc,
        amount_sc: costSc,
        amountKes: costKes,
        amount_kes: costKes,
        amount: costSc,
        status: 'pending',
        referenceId: slotId,
        reference_id: slotId,
        durationDays: days,
        duration_days: days,
        createdAt: Date.now(),
        created_at: Date.now(),
        updatedAt: Date.now(),
        updated_at: Date.now(),
      };

      const userTx: WalletTransaction = {
        id: 'wtx_' + Date.now() + '_slot_dr',
        walletId: cleanEmail,
        wallet_id: cleanEmail,
        direction: 'debit',
        amountSc: costSc,
        amount_sc: costSc,
        relatedPaymentId: paymentId,
        related_payment_id: paymentId,
        note: `Sponsor slot #${nextSlotNumber} on "${stay.title}" (${days} days)`,
        createdAt: Date.now(),
        created_at: Date.now(),
      };

      const adminTx: WalletTransaction = {
        id: 'wtx_' + Date.now() + '_slot_cr',
        walletId: 'admin@airbus.ke',
        wallet_id: 'admin@airbus.ke',
        direction: 'credit',
        amountSc: costSc,
        amount_sc: costSc,
        relatedPaymentId: paymentId,
        related_payment_id: paymentId,
        note: `Sponsor slot payment for "${stay.title}" from ${cleanEmail}`,
        createdAt: Date.now(),
        created_at: Date.now(),
      };

      if (!this.data.walletTransactions) this.data.walletTransactions = [];
      this.data.walletTransactions.unshift(userTx, adminTx);
    } else {
      const cleanCode = (opts.mpesaCode || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{10}$/.test(cleanCode)) {
        throw new Error('Please enter a valid 10-character alphanumeric M-Pesa receipt code (e.g. QGH7X2K9LM).');
      }
      const duplicate = (this.data.paymentRecords || []).some(
        p => (p.mpesaCode?.toUpperCase() === cleanCode || p.mpesa_code?.toUpperCase() === cleanCode)
      );
      if (duplicate) {
        throw new Error('This M-Pesa transaction code has already been submitted. Please check your receipt.');
      }

      paymentRecord = {
        id: paymentId,
        userId: cleanEmail,
        user_id: cleanEmail,
        type: 'advert',
        kind: 'advert',
        method: 'mpesa',
        amountSc: costSc,
        amount_sc: costSc,
        amountKes: costKes,
        amount_kes: costKes,
        amount: costKes,
        mpesaCode: cleanCode,
        mpesa_code: cleanCode,
        status: 'pending',
        referenceId: slotId,
        reference_id: slotId,
        durationDays: days,
        duration_days: days,
        createdAt: Date.now(),
        created_at: Date.now(),
        updatedAt: Date.now(),
        updated_at: Date.now(),
      };
    }

    if (!this.data.paymentRecords) this.data.paymentRecords = [];
    this.data.paymentRecords.unshift(paymentRecord);
    if (!this.data.payments) this.data.payments = [];
    this.data.payments.unshift(paymentRecord);

    const sponsorSlot: SponsorSlot = {
      id: slotId,
      listing_id: stay.id,
      listingId: stay.id,
      advertiser_id: cleanEmail,
      advertiserId: cleanEmail,
      title: opts.title.trim(),
      description: opts.description.trim(),
      link_url: opts.linkUrl.trim(),
      linkUrl: opts.linkUrl.trim(),
      thumbnail_url: opts.thumbnailUrl.trim(),
      thumbnailUrl: opts.thumbnailUrl.trim(),
      duration_days: days,
      durationDays: days,
      cost_sc: costSc,
      costSc,
      status: 'pending_approval',
      slot_number: nextSlotNumber,
      slotNumber: nextSlotNumber,
      payment_id: paymentId,
      paymentId,
      impressions: 0,
      clicks: 0,
      created_at: Date.now(),
      createdAt: Date.now(),
    };

    if (!this.data.sponsorSlots) this.data.sponsorSlots = [];
    this.data.sponsorSlots.unshift(sponsorSlot);

    if (!this.data.adSlots) this.data.adSlots = [];
    this.data.adSlots.unshift({
      id: slotId,
      ownerId: cleanEmail,
      owner_id: cleanEmail,
      title: opts.title.trim(),
      description: opts.description.trim(),
      linkUrl: opts.linkUrl.trim(),
      link_url: opts.linkUrl.trim(),
      thumbnailUrl: opts.thumbnailUrl.trim(),
      thumbnail_url: opts.thumbnailUrl.trim(),
      durationDays: days,
      costSc,
      cost_sc: costSc,
      costCoins: costSc,
      cost_coins: costSc,
      paymentMethod: opts.paymentMethod,
      status: 'pending',
      paymentId,
      impressions: 0,
      clicks: 0,
      createdAt: Date.now(),
      created_at: Date.now(),
      updatedAt: Date.now(),
      updated_at: Date.now(),
    });

    this.createAuditLog({
      id: 'aud_' + Date.now(),
      action: 'sponsor_slot_purchase',
      actorEmail: cleanEmail,
      details: `Reserved sponsor slot #${nextSlotNumber} on "${stay.title}" (${days} days) via ${opts.paymentMethod.toUpperCase()}`,
      createdAt: Date.now(),
    });

    this.save();

    return {
      sponsorSlot,
      payment: paymentRecord,
      message: 'Sponsor advert submitted. It goes live once approved by the admin.',
    };
  }

  public getSponsorSlots(listingId?: string): {
    slots: SponsorSlot[];
    activeCount: number;
    maxSlots: number;
    isFull: boolean;
  } {
    this.checkAllExpirations();
    if (!this.data.sponsorSlots) this.data.sponsorSlots = [];
    let list = this.data.sponsorSlots;
    if (listingId) {
      list = list.filter(s => s.listing_id === listingId || s.listingId === listingId);
    }
    const activeList = list.filter(s => s.status === 'active');
    return {
      slots: list,
      activeCount: activeList.length,
      maxSlots: 10,
      isFull: activeList.length >= 10,
    };
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
    return (this.data.auditLogs || []).slice().sort((a, b) => b.createdAt - a.createdAt);
  }

  // --- TRIP DATING: A Dating Services Near You ---

  public getTripDatingProfiles(
    viewerEmail?: string,
    clientSessionId?: string,
    query?: { gender?: string; city?: string; search?: string; intention?: string; showAllStatuses?: boolean }
  ) {
    if (!this.data.tripDatingProfiles) {
      this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
      this.save();
    }

    const now = Date.now();
    let profiles = [...this.data.tripDatingProfiles];

    if (!query?.showAllStatuses) {
      // Part E: Users without approved full-body photo cannot appear in Trip Dating discovery
      profiles = profiles.filter(
        p => p.status === 'active' &&
             p.full_body_verified &&
             (p.fullBodyModerationStatus === 'approved' || p.fullBodyModerationStatus === undefined)
      );
    }

    if (query?.gender && query.gender !== 'all') {
      profiles = profiles.filter(p => p.gender.toLowerCase() === query.gender?.toLowerCase());
    }

    if (query?.city && query.city !== 'all') {
      profiles = profiles.filter(p => p.city.toLowerCase().includes(query.city!.toLowerCase()) || p.location.toLowerCase().includes(query.city!.toLowerCase()));
    }

    if (query?.intention && query.intention !== 'all') {
      profiles = profiles.filter(p => p.datingIntention === query.intention);
    }

    if (query?.search && query.search.trim()) {
      const q = query.search.toLowerCase().trim();
      profiles = profiles.filter(p => 
        p.fullName.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.lookingFor.toLowerCase().includes(q)
      );
    }

    // Mask phone numbers unless active 10-minute unlock exists
    return profiles.map(p => {
      const activeUnlock = this.checkActiveContactUnlock(p.id, viewerEmail, clientSessionId);
      const isLikedByViewer = viewerEmail ? (p.likedByUserEmails || []).includes(viewerEmail) : false;

      if (activeUnlock && activeUnlock.expiresAt > now) {
        return {
          ...p,
          phoneNumber: activeUnlock.unlockedPhone,
          isUnlocked: true,
          unlockExpiresAt: activeUnlock.expiresAt,
          isLikedByViewer,
        };
      }

      return {
        ...p,
        phoneNumber: '+254 7•• ••• •••', // Securely masked
        isUnlocked: false,
        unlockExpiresAt: undefined,
        isLikedByViewer,
      };
    });
  }

  public getTripDatingProfileById(id: string, viewerEmail?: string, clientSessionId?: string) {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const profile = this.data.tripDatingProfiles.find(p => p.id === id);
    if (!profile) return null;

    const now = Date.now();
    const activeUnlock = this.checkActiveContactUnlock(profile.id, viewerEmail, clientSessionId);
    const isLikedByViewer = viewerEmail ? (profile.likedByUserEmails || []).includes(viewerEmail) : false;

    if (activeUnlock && activeUnlock.expiresAt > now) {
      return {
        ...profile,
        phoneNumber: activeUnlock.unlockedPhone,
        isUnlocked: true,
        unlockExpiresAt: activeUnlock.expiresAt,
        isLikedByViewer,
      };
    }

    return {
      ...profile,
      phoneNumber: '+254 7•• ••• •••',
      isUnlocked: false,
      unlockExpiresAt: undefined,
      isLikedByViewer,
    };
  }

  public getRawTripDatingProfileById(id: string): TripDatingProfile | null {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    return this.data.tripDatingProfiles.find(p => p.id === id) || null;
  }

  public createTripDatingProfile(data: {
    fullName: string;
    phoneNumber: string;
    gender: 'male' | 'female' | 'other';
    age: number;
    dob?: string;
    country?: string;
    city: string;
    location: string;
    description: string;
    lookingFor: string;
    datingIntention: any;
    photos: string[];
    primaryPhoto?: string;
    full_body_photo?: string;
    full_body_verified?: boolean;
    fullBodyModerationStatus?: 'pending_review' | 'approved' | 'rejected';
    userId?: string;
  }): { profile: TripDatingProfile; message: string } {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;

    // Automated Content Policy Enforcement
    const combinedContent = `${data.fullName} ${data.description} ${data.lookingFor}`.toLowerCase();

    // 1. Check for adult / escort / sexual solicitation
    const adultPatterns = [/\b(nude|naked|sex|escort|camgirl|hooker|porn|xxx|blowjob|anal|massage with happy ending)\b/i];
    for (const pat of adultPatterns) {
      if (pat.test(combinedContent)) {
        throw new Error('Community Safety Policy: Explicit sexual content or escort solicitation is strictly prohibited on Trip Dating.');
      }
    }

    // 2. Check for commercial merchandise sales
    const merchandisePatterns = [/\b(for sale|wholesale|brand new shoes|handbags?|merchandise|discount price|stock available|shop now|order via whatsapp|in stock)\b/i];
    for (const pat of merchandisePatterns) {
      if (pat.test(combinedContent)) {
        throw new Error('Content Policy: Trip Dating is exclusively for genuine dating and companionship. Selling commercial goods or merchandise is strictly prohibited.');
      }
    }

    // 3. Check for drugs or illicit substances
    const drugPatterns = [/\b(weed|bhang|cocaine|narcotics|prescription pills|shrooms|meth)\b/i];
    for (const pat of drugPatterns) {
      if (pat.test(combinedContent)) {
        throw new Error('Content Policy: Mention or solicitation of drugs or illegal substances is prohibited.');
      }
    }

    // 4. Check for hotel or rental accommodation listings
    const stayPatterns = [/\b(per night|airbnb|rental unit|check-in fee|booking deposit|serviced apartment for rent|studio to let)\b/i];
    for (const pat of stayPatterns) {
      if (pat.test(combinedContent)) {
        throw new Error('Content Policy: This section is for Trip Dating, not accommodation rentals. Please publish stays via the Host section.');
      }
    }

    // Validate photos (maximum 4)
    const sanitizedPhotos = (data.photos || []).filter(p => typeof p === 'string' && p.trim().length > 0).slice(0, 4);
    if (sanitizedPhotos.length === 0) {
      sanitizedPhotos.push('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80');
    }

    const fullBodyPhoto = data.full_body_photo || sanitizedPhotos[0];

    const newProfile: TripDatingProfile = {
      id: 'tdp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      userId: data.userId || 'u_guest',
      fullName: data.fullName.trim(),
      phoneNumber: data.phoneNumber.trim(),
      gender: data.gender,
      age: Math.max(18, Math.min(99, Number(data.age) || 25)),
      dob: data.dob,
      country: data.country || 'Kenya',
      city: data.city.trim() || 'Nairobi',
      location: data.location.trim() || 'Nairobi',
      description: data.description.trim(),
      lookingFor: data.lookingFor.trim(),
      datingIntention: data.datingIntention || 'dating_companionship',
      photos: sanitizedPhotos,
      primaryPhoto: data.primaryPhoto || sanitizedPhotos[0],
      full_body_photo: fullBodyPhoto,
      full_body_verified: data.full_body_verified !== undefined ? Boolean(data.full_body_verified) : true,
      fullBodyModerationStatus: data.fullBodyModerationStatus || 'approved',
      likes: 0,
      likedByUserEmails: [],
      views: 0,
      status: 'active', // Automated policy passed
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.data.tripDatingProfiles.unshift(newProfile);
    this.createAuditLog({
      id: 'aud_tdp_' + Date.now(),
      action: 'trip_dating_profile_created',
      actorEmail: data.userId || 'guest@airbus.ke',
      details: `Created and auto-published Trip Dating profile for ${newProfile.fullName} (${newProfile.city}).`,
      createdAt: Date.now(),
    });

    this.save();
    return {
      profile: newProfile,
      message: 'Congratulations! Your Trip Dating profile has been verified by our automated safety system and is now live across Kenya.',
    };
  }

  public updateTripDatingProfile(id: string, updates: Partial<TripDatingProfile>, actorEmail?: string) {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const index = this.data.tripDatingProfiles.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Dating profile not found');

    const current = this.data.tripDatingProfiles[index];

    // If updating description or photos, enforce limits
    if (updates.photos && updates.photos.length > 4) {
      updates.photos = updates.photos.slice(0, 4);
    }

    const updated = {
      ...current,
      ...updates,
      id: current.id,
      updatedAt: Date.now(),
    };

    this.data.tripDatingProfiles[index] = updated;
    this.save();
    return updated;
  }

  public toggleLikeTripDatingProfile(id: string, userEmail: string) {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const profile = this.data.tripDatingProfiles.find(p => p.id === id);
    if (!profile) throw new Error('Profile not found');

    if (!profile.likedByUserEmails) profile.likedByUserEmails = [];
    const index = profile.likedByUserEmails.indexOf(userEmail);

    let liked = false;
    if (index > -1) {
      profile.likedByUserEmails.splice(index, 1);
      profile.likes = Math.max(0, (profile.likes || 1) - 1);
      liked = false;
    } else {
      profile.likedByUserEmails.push(userEmail);
      profile.likes = (profile.likes || 0) + 1;
      liked = true;
    }

    this.save();
    return { liked, totalLikes: profile.likes };
  }

  public incrementTripDatingProfileViews(id: string) {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const profile = this.data.tripDatingProfiles.find(p => p.id === id);
    if (profile) {
      profile.views = (profile.views || 0) + 1;
      this.save();
      return profile.views;
    }
    return 0;
  }

  public createTripDatingPaymentRequest(req: {
    profileId: string;
    userEmail: string;
    clientSessionId: string;
    payerPhone: string;
    transactionCode: string;
  }) {
    if (!this.data.tripDatingPaymentRequests) this.data.tripDatingPaymentRequests = [];
    const profile = this.getRawTripDatingProfileById(req.profileId);
    if (!profile) throw new Error('Target dating profile does not exist');

    const cleanCode = req.transactionCode.trim().toUpperCase();
    if (cleanCode.length < 5) throw new Error('Please enter a valid M-Pesa transaction code (e.g. QGH7X2K9LM)');

    const newReq: TripDatingPaymentRequest = {
      id: 'tdpr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      profileId: profile.id,
      profileName: profile.fullName,
      userEmail: req.userEmail || 'guest@airbus.ke',
      clientSessionId: req.clientSessionId || 'session_default',
      payerPhone: req.payerPhone.trim(),
      transactionCode: cleanCode,
      amount: 50, // KES 50 fee
      status: 'pending',
      createdAt: Date.now(),
    };

    this.data.tripDatingPaymentRequests.unshift(newReq);
    this.createAuditLog({
      id: 'aud_tdpr_' + Date.now(),
      action: 'trip_dating_payment_submitted',
      actorEmail: req.userEmail || req.payerPhone,
      details: `Submitted KES 50 payment (${cleanCode}) to unlock contact for ${profile.fullName}.`,
      createdAt: Date.now(),
    });

    this.save();
    return newReq;
  }

  public getTripDatingPaymentRequests() {
    if (!this.data.tripDatingPaymentRequests) this.data.tripDatingPaymentRequests = [];
    return this.data.tripDatingPaymentRequests;
  }

  public approveTripDatingPayment(requestId: string, adminEmail: string) {
    if (!this.data.tripDatingPaymentRequests) this.data.tripDatingPaymentRequests = [];
    if (!this.data.tripDatingContactUnlocks) this.data.tripDatingContactUnlocks = [];

    const req = this.data.tripDatingPaymentRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Payment request not found');
    if (req.status === 'approved') return { request: req, unlock: null, message: 'Already approved' };

    const profile = this.getRawTripDatingProfileById(req.profileId);
    if (!profile) throw new Error('Profile associated with payment does not exist');

    req.status = 'approved';
    req.reviewedBy = adminEmail;
    req.reviewedAt = Date.now();

    // Credit treasury
    if (this.data.walletRecords?.['treasury']) {
      this.data.walletRecords['treasury'].balance += 50;
      this.data.walletRecords['treasury'].lifetimeEarnings += 50;
      this.data.walletRecords['treasury'].updatedAt = Date.now();
    }

    // Grant 10-Minute Contact Unlock window
    const now = Date.now();
    const unlockDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
    const unlock: TripDatingContactUnlock = {
      id: 'unlock_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      profileId: profile.id,
      profileName: profile.fullName,
      unlockedPhone: profile.phoneNumber || '+254 712 345 678',
      userEmail: req.userEmail,
      clientSessionId: req.clientSessionId,
      unlockedAt: now,
      expiresAt: now + unlockDuration,
    };

    this.data.tripDatingContactUnlocks.unshift(unlock);

    this.createAuditLog({
      id: 'aud_unlock_' + Date.now(),
      action: 'trip_dating_payment_approved',
      actorEmail: adminEmail,
      details: `Approved KES 50 payment (${req.transactionCode}). Granted 10-minute contact unlock for ${profile.fullName} to ${req.userEmail}.`,
      createdAt: Date.now(),
    });

    this.save();
    return { request: req, unlock };
  }

  public rejectTripDatingPayment(requestId: string, adminEmail: string, reason?: string) {
    if (!this.data.tripDatingPaymentRequests) this.data.tripDatingPaymentRequests = [];
    const req = this.data.tripDatingPaymentRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Payment request not found');

    req.status = 'rejected';
    req.rejectionReason = reason || 'Payment transaction code could not be verified on Till 943210.';
    req.reviewedBy = adminEmail;
    req.reviewedAt = Date.now();

    this.createAuditLog({
      id: 'aud_tdprej_' + Date.now(),
      action: 'trip_dating_payment_rejected',
      actorEmail: adminEmail,
      details: `Rejected KES 50 payment request (${req.transactionCode}) for ${req.profileName}. Reason: ${req.rejectionReason}`,
      createdAt: Date.now(),
    });

    this.save();
    return req;
  }

  public checkActiveContactUnlock(profileId: string, userEmail?: string, clientSessionId?: string): TripDatingContactUnlock | null {
    if (!this.data.tripDatingContactUnlocks) return null;
    const now = Date.now();

    const unlock = this.data.tripDatingContactUnlocks.find(u => 
      u.profileId === profileId &&
      u.expiresAt > now &&
      ((userEmail && u.userEmail === userEmail) || (clientSessionId && u.clientSessionId === clientSessionId))
    );

    return unlock || null;
  }

  public adminModerateTripDatingProfile(profileId: string, status: TripDatingProfileStatus, reason?: string, adminEmail?: string) {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    const profile = this.data.tripDatingProfiles.find(p => p.id === profileId);
    if (!profile) throw new Error('Dating profile not found');

    profile.status = status;
    profile.removalReason = reason;
    profile.updatedAt = Date.now();

    this.createAuditLog({
      id: 'aud_mod_tdp_' + Date.now(),
      action: `trip_dating_profile_${status}`,
      actorEmail: adminEmail || 'admin@airbus.ke',
      details: `Admin changed status of ${profile.fullName} to ${status}. Reason: ${reason || 'N/A'}`,
      createdAt: Date.now(),
    });

    this.save();
    return profile;
  }

  public getTripDatingStats(): TripDatingStats {
    if (!this.data.tripDatingProfiles) this.data.tripDatingProfiles = SEED_TRIP_DATING_PROFILES;
    if (!this.data.tripDatingPaymentRequests) this.data.tripDatingPaymentRequests = [];
    if (!this.data.tripDatingContactUnlocks) this.data.tripDatingContactUnlocks = [];

    const profiles = this.data.tripDatingProfiles;
    const reqs = this.data.tripDatingPaymentRequests;
    const unlocks = this.data.tripDatingContactUnlocks;

    const approvedCount = reqs.filter(r => r.status === 'approved').length;

    return {
      totalMembers: profiles.length,
      activeProfiles: profiles.filter(p => p.status === 'active').length,
      suspendedProfiles: profiles.filter(p => p.status === 'suspended').length,
      removedProfiles: profiles.filter(p => p.status === 'removed').length,
      totalViews: profiles.reduce((sum, p) => sum + (p.views || 0), 0),
      totalLikes: profiles.reduce((sum, p) => sum + (p.likes || 0), 0),
      totalContactRequests: reqs.length,
      pendingApprovals: reqs.filter(r => r.status === 'pending').length,
      approvedPayments: approvedCount,
      rejectedPayments: reqs.filter(r => r.status === 'rejected').length,
      successfulUnlocks: unlocks.length,
      totalRevenueKes: approvedCount * 50,
    };
  }

  // --- Duplicate M-Pesa Code Checker (Section 2.3) ---
  public isMpesaCodeUsed(code: string): boolean {
    if (!code || !code.trim()) return false;
    const clean = code.trim().toUpperCase();
    const records = this.data.paymentRecords || [];
    const payments = this.data.payments || [];
    const datingReqs = this.data.tripDatingPaymentRequests || [];

    const inRecords = records.some(p => (p.mpesaCode?.toUpperCase() === clean || p.reference?.toUpperCase() === clean));
    const inPayments = payments.some(p => (p.mpesaCode?.toUpperCase() === clean || p.reference?.toUpperCase() === clean));
    const inDating = datingReqs.some(r => r.transactionCode?.toUpperCase() === clean);

    return inRecords || inPayments || inDating;
  }

  // --- Stay Media Normalization & Management (Section 1) ---
  public normalizeStayMedia(stay: Stay): Stay {
    if (!stay.media) {
      const photos: any[] = [];
      if (stay.images && stay.images.length > 0) {
        stay.images.forEach((url: string, i: number) => {
          photos.push({ url, order: i, isCover: i === 0 });
        });
      } else if (stay.thumbnailUrl) {
        photos.push({ url: stay.thumbnailUrl, order: 0, isCover: true });
      }

      stay.media = {
        video: stay.videoUrl ? {
          url: stay.videoUrl,
          thumbnail: stay.thumbnailUrl || (photos[0]?.url || ''),
          duration: 60,
          size: 15000000,
        } : null,
        photos,
      };
    } else {
      if (!stay.media.photos) stay.media.photos = [];
    }

    stay.hasVideo = Boolean(stay.media?.video?.url && stay.media.video.url.trim().length > 0);
    stay.hasPhotos = Boolean(stay.media?.photos && stay.media.photos.length > 0);

    // Keep legacy fields synchronized
    if (stay.media.video?.url) {
      stay.videoUrl = stay.media.video.url;
    }
    if (stay.media.photos && stay.media.photos.length > 0) {
      stay.images = stay.media.photos.slice().sort((a, b) => a.order - b.order).map(p => p.url);
      const cover = stay.media.photos.find(p => p.isCover) || stay.media.photos[0];
      if (cover) stay.thumbnailUrl = cover.url;
    }

    if (!stay.moderationStatus) stay.moderationStatus = 'approved';
    if (!stay.mediaModerationStatus) stay.mediaModerationStatus = 'clean';

    return stay;
  }

  public removeStayMedia(
    stayId: string,
    mediaType: 'video' | 'photo',
    photoUrl?: string,
    adminEmail?: string,
    reason?: string
  ): Stay {
    const stay = this.getStayById(stayId);
    if (!stay) throw new Error('Listing not found.');
    this.normalizeStayMedia(stay);

    const now = Date.now();
    if (mediaType === 'video') {
      stay.media!.video = null;
      stay.videoUrl = '';
      stay.hasVideo = false;
    } else if (mediaType === 'photo' && photoUrl) {
      stay.media!.photos = stay.media!.photos.filter(p => p.url !== photoUrl);
      stay.images = (stay.images || []).filter(u => u !== photoUrl);
      if (stay.thumbnailUrl === photoUrl) {
        stay.thumbnailUrl = stay.media!.photos[0]?.url || '';
      }
      stay.hasPhotos = stay.media!.photos.length > 0;
    }

    // If both video and photos were removed, delist the stay until compliant
    if (!stay.hasVideo && !stay.hasPhotos) {
      stay.status = 'delisted';
      stay.isDelisted = true;
      stay.mediaModerationStatus = 'flagged';
    }

    if (adminEmail) {
      this.createAuditLog({
        id: 'aud_' + now,
        action: 'media_remove',
        actorEmail: adminEmail,
        details: `Removed ${mediaType} from listing "${stay.title}" (${stay.id}). Reason: ${reason || 'Policy violation'}.`,
        createdAt: now,
      });

      if (stay.ownerEmail) {
        this.createNotification({
          id: 'notif_' + now,
          userEmail: stay.ownerEmail,
          title: 'Listing Media Removed by Moderation',
          message: `A ${mediaType} on your listing "${stay.title}" was removed due to: ${reason || 'Terms of service compliance'}. Please upload replacement media.`,
          read: false,
          link: '/#owner',
          type: 'system',
          createdAt: now,
        });
      }
    }

    this.save();
    return stay;
  }

  public flagStayMedia(stayId: string, status: 'approved' | 'flagged' | 'clean', adminEmail: string, reason?: string): Stay {
    const stay = this.getStayById(stayId);
    if (!stay) throw new Error('Listing not found.');
    this.normalizeStayMedia(stay);

    stay.mediaModerationStatus = status;
    const now = Date.now();

    this.createAuditLog({
      id: 'aud_' + now,
      action: 'media_flag',
      actorEmail: adminEmail,
      details: `Set media moderation status to ${status} for listing "${stay.title}" (${stay.id}). Reason: ${reason || 'N/A'}.`,
      createdAt: now,
    });

    this.save();
    return stay;
  }

  public getListingMedia(filter?: { type?: string; flaggedOnly?: boolean; search?: string }): any[] {
    let list = this.data.stays || [];
    list.forEach(s => this.normalizeStayMedia(s));

    if (filter?.flaggedOnly) {
      list = list.filter(s => s.mediaModerationStatus === 'flagged');
    }
    if (filter?.type && filter.type !== 'all') {
      if (filter.type === 'video') list = list.filter(s => s.hasVideo && !s.hasPhotos);
      else if (filter.type === 'photos') list = list.filter(s => !s.hasVideo && s.hasPhotos);
      else if (filter.type === 'both') list = list.filter(s => s.hasVideo && s.hasPhotos);
    }
    if (filter?.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.ownerEmail || '').toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q)
      );
    }

    return list.map(s => ({
      stayId: s.id,
      title: s.title,
      location: s.location,
      ownerEmail: s.ownerEmail || s.owner,
      status: s.status,
      hasVideo: s.hasVideo,
      hasPhotos: s.hasPhotos,
      video: s.media?.video || null,
      photos: s.media?.photos || [],
      mediaModerationStatus: s.mediaModerationStatus || 'clean',
      thumbnailUrl: s.thumbnailUrl,
      videoUrl: s.videoUrl,
      images: s.images,
    }));
  }

  // --- Listing Moderation Queue (Section 3) ---
  public moderateStay(
    id: string,
    action: 'approve' | 'reject' | 'suspend' | 'unsuspend' | 'delist' | 'relist' | 'delete',
    adminEmail: string,
    reason?: string
  ): Stay | null {
    const stay = this.getStayById(id);
    if (!stay && action !== 'delete') throw new Error('Listing not found.');

    const now = Date.now();
    const cleanReason = (reason || '').trim() || 'Moderation decision by platform administrator.';

    if (action === 'delete') {
      this.deleteStay(id);
      this.createAuditLog({
        id: 'aud_' + now,
        action: 'stay_delete',
        actorEmail: adminEmail,
        details: `Permanently deleted stay ${id}. Reason: ${cleanReason}`,
        createdAt: now,
      });
      return null;
    }

    if (!stay) return null;

    if (action === 'approve') {
      stay.status = 'live';
      stay.isApprovedByAdmin = true;
      stay.moderationStatus = 'approved';
      stay.isDelisted = false;
    } else if (action === 'reject') {
      stay.status = 'delisted';
      stay.isApprovedByAdmin = false;
      stay.moderationStatus = 'rejected';
      stay.moderationReason = cleanReason;
      stay.isDelisted = true;
    } else if (action === 'suspend') {
      stay.status = 'delisted';
      stay.moderationStatus = 'suspended';
      stay.moderationReason = cleanReason;
      stay.isDelisted = true;
    } else if (action === 'unsuspend' || action === 'relist') {
      stay.status = 'live';
      stay.moderationStatus = 'approved';
      stay.isDelisted = false;
      stay.moderationReason = undefined;
    } else if (action === 'delist') {
      stay.status = 'delisted';
      stay.isDelisted = true;
      stay.moderationReason = cleanReason;
    }

    this.createAuditLog({
      id: 'aud_' + now,
      action: `stay_${action}`,
      actorEmail: adminEmail,
      details: `${action.toUpperCase()} stay "${stay.title}" (${stay.id}). Reason: ${cleanReason}`,
      createdAt: now,
    });

    if (stay.ownerEmail) {
      this.createNotification({
        id: 'notif_' + now,
        userEmail: stay.ownerEmail,
        title: `Listing ${action === 'approve' ? 'Approved & Published' : action === 'unsuspend' ? 'Restored' : 'Moderated'}`,
        message: `Your listing "${stay.title}" was ${action === 'approve' ? 'approved and is now live!' : `updated: ${action} (${cleanReason})`}`,
        read: false,
        link: '/#owner',
        type: 'system',
        createdAt: now,
      });
    }

    this.save();
    return stay;
  }

  // --- Subscriptions Moderation Queue (Section 3) ---
  public getAllSubscriptions(): any[] {
    const subs = this.data.subscriptions || [];
    const hostPlans = this.data.hostPlans || {};

    // Combine explicit subscription records and all hosts' current plan states
    const items: any[] = subs.map(s => ({
      ...s,
      type: 'record',
    }));

    Object.entries(hostPlans).forEach(([ownerEmail, plan]) => {
      const existing = items.find(s => s.ownerId?.toLowerCase() === ownerEmail.toLowerCase() || s.owner_id?.toLowerCase() === ownerEmail.toLowerCase());
      if (!existing) {
        items.push({
          id: 'sub_host_' + ownerEmail,
          ownerId: ownerEmail,
          owner_id: ownerEmail,
          tier: plan.tier || 'Diamond',
          billing: plan.period || 'monthly',
          status: plan.status || 'active',
          startsAt: plan.expiresAt ? plan.expiresAt - 30 * 864e5 : Date.now(),
          endsAt: plan.expiresAt || (Date.now() + 30 * 864e5),
          createdAt: Date.now() - 30 * 864e5,
          updatedAt: Date.now(),
          type: 'host_plan',
        });
      }
    });

    return items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  public moderateSubscription(
    id: string,
    action: 'approve' | 'reject' | 'extend' | 'revoke' | 'expire',
    adminEmail: string,
    days = 30,
    reason?: string
  ): any {
    const now = Date.now();
    const subs = this.data.subscriptions || [];
    const sub = subs.find(s => s.id === id);
    const ownerEmail = (sub?.ownerId || sub?.owner_id || id.replace('sub_host_', '')).toLowerCase().trim();
    const cleanReason = (reason || '').trim() || 'Admin subscription adjustment.';

    if (action === 'extend') {
      const addedMs = days * 864e5;
      if (sub) {
        sub.endsAt = Math.max(now, sub.endsAt || now) + addedMs;
        sub.status = 'active';
        sub.updatedAt = now;
      }
      const plan = this.getHostPlan(ownerEmail);
      this.setHostPlan(ownerEmail, {
        ...plan,
        status: 'active',
        expiresAt: Math.max(now, plan.expiresAt || now) + addedMs,
        graceExpiresAt: Math.max(now, plan.expiresAt || now) + addedMs + 2 * 864e5,
      });

      // Restore any expired stays
      this.data.stays.forEach(s => {
        if (s.ownerEmail?.toLowerCase() === ownerEmail && (s.status === 'expired' || s.isDelisted)) {
          s.status = 'live';
          s.isDelisted = false;
        }
      });
    } else if (action === 'revoke' || action === 'expire') {
      if (sub) {
        sub.status = 'expired';
        sub.updatedAt = now;
      }
      const plan = this.getHostPlan(ownerEmail);
      this.setHostPlan(ownerEmail, {
        ...plan,
        status: 'expired',
        expiresAt: now,
      });
      // Expire stays
      this.data.stays.forEach(s => {
        if (s.ownerEmail?.toLowerCase() === ownerEmail) {
          s.status = 'expired';
        }
      });
    } else if (action === 'approve') {
      if (sub) {
        sub.status = 'active';
        sub.startsAt = now;
        sub.endsAt = now + (sub.billing === 'annual' ? 365 * 864e5 : 30 * 864e5);
        sub.updatedAt = now;
      }
      this.setHostPlan(ownerEmail, {
        tier: sub?.tier || 'Diamond',
        status: 'active',
        expiresAt: now + (sub?.billing === 'annual' ? 365 * 864e5 : 30 * 864e5),
      });
    } else if (action === 'reject') {
      if (sub) {
        sub.status = 'rejected';
        sub.updatedAt = now;
      }
    }

    this.createAuditLog({
      id: 'aud_' + now,
      action: `subscription_${action}`,
      actorEmail: adminEmail,
      details: `${action.toUpperCase()} subscription for ${ownerEmail}. Added days: ${days}. Reason: ${cleanReason}`,
      createdAt: now,
    });

    this.createNotification({
      id: 'notif_' + now,
      userEmail: ownerEmail,
      title: `Hosting Subscription ${action === 'extend' ? 'Extended' : action === 'approve' ? 'Activated' : 'Updated'}`,
      message: `Your hosting subscription was updated by admin: ${action} (${cleanReason}).`,
      read: false,
      link: '/#owner',
      type: 'subscription',
      createdAt: now,
    });

    this.save();
    return { success: true, ownerEmail, action, sub };
  }

  // --- Adverts Moderation Queue (Section 3) ---
  public moderateAd(
    id: string,
    action: 'approve' | 'reject' | 'pause' | 'resume' | 'end',
    adminEmail: string,
    reason?: string
  ): any {
    const now = Date.now();
    const cleanReason = (reason || '').trim() || 'Administrative advert update.';

    // Check adSlots
    const adSlot = (this.data.adSlots || []).find(s => s.id === id);
    // Check sponsorSlots
    const spSlot = (this.data.sponsorSlots || []).find(s => s.id === id);
    // Check adRequests
    const adReq = (this.data.adRequests || []).find(a => a.id === id);

    let advertiserEmail = '';
    if (adSlot) {
      advertiserEmail = adSlot.ownerId || adSlot.owner_id || '';
      if (action === 'approve') {
        adSlot.status = 'active';
        adSlot.startsAt = now;
        adSlot.endsAt = now + (adSlot.durationDays * 864e5);
      } else if (action === 'reject') {
        adSlot.status = 'rejected';
        adSlot.rejectionReason = cleanReason;
      } else if (action === 'pause') {
        adSlot.status = 'pending_approval';
      } else if (action === 'resume') {
        adSlot.status = 'active';
      } else if (action === 'end') {
        adSlot.status = 'expired';
        adSlot.endsAt = now;
      }
      adSlot.updatedAt = now;
    }

    if (spSlot) {
      advertiserEmail = spSlot.advertiser_id || spSlot.advertiserId || advertiserEmail;
      if (action === 'approve') {
        spSlot.status = 'active';
        spSlot.starts_at = now;
        spSlot.ends_at = now + (spSlot.duration_days * 864e5);
      } else if (action === 'reject') {
        spSlot.status = 'rejected';
      } else if (action === 'end') {
        spSlot.status = 'expired';
        spSlot.ends_at = now;
      }
    }

    if (adReq) {
      advertiserEmail = adReq.advertiserEmail || advertiserEmail;
      if (action === 'approve') {
        adReq.status = 'approved';
        adReq.startsAt = now;
        adReq.expiresAt = now + (adReq.days * 864e5);
      } else if (action === 'reject') {
        adReq.status = 'rejected';
      } else if (action === 'end') {
        adReq.status = 'expired';
        adReq.expiresAt = now;
      }
    }

    this.createAuditLog({
      id: 'aud_' + now,
      action: `ad_${action}`,
      actorEmail: adminEmail,
      details: `${action.toUpperCase()} advert ${id}. Reason: ${cleanReason}`,
      createdAt: now,
    });

    if (advertiserEmail) {
      this.createNotification({
        id: 'notif_' + now,
        userEmail: advertiserEmail,
        title: `Advert ${action === 'approve' ? 'Approved & Live' : 'Updated'}`,
        message: `Your advert was updated: ${action} (${cleanReason}).`,
        read: false,
        link: '/#ads',
        type: 'system',
        createdAt: now,
      });
    }

    this.save();
    return { success: true, id, action };
  }

  // --- Users & Hosts Moderation (Section 3) ---
  public moderateUser(
    email: string,
    action: 'suspend' | 'reactivate' | 'verify',
    adminEmail: string,
    reason?: string
  ): User {
    const user = this.findUserByEmail(email);
    if (!user) throw new Error('User account not found.');

    const now = Date.now();
    const cleanReason = (reason || '').trim() || 'Admin user moderation.';

    if (action === 'suspend') {
      user.isSuspended = true;
      user.suspendedReason = cleanReason;
    } else if (action === 'reactivate') {
      user.isSuspended = false;
      user.suspendedReason = undefined;
    } else if (action === 'verify') {
      user.idVerified = true;
    }

    this.createAuditLog({
      id: 'aud_' + now,
      action: `user_${action}`,
      actorEmail: adminEmail,
      details: `${action.toUpperCase()} user ${email}. Reason: ${cleanReason}`,
      createdAt: now,
    });

    this.createNotification({
      id: 'notif_' + now,
      userEmail: email,
      title: `Account Status: ${action === 'verify' ? 'ID Verified ✓' : action === 'reactivate' ? 'Reactivated' : 'Suspended'}`,
      message: action === 'suspend'
        ? `Your AirBus account was suspended: ${cleanReason}. Contact support to appeal.`
        : action === 'verify'
        ? 'Congratulations! Your identity verification has been approved.'
        : 'Your account has been reactivated. Welcome back!',
      read: false,
      link: '/#home',
      type: 'system',
      createdAt: now,
    });

    this.save();
    return user;
  }

  // --- Reports & Flags Moderation (Section 3) ---
  public getReports(): ListingReport[] {
    if (!this.data.reports) this.data.reports = [];
    return this.data.reports.slice().sort((a, b) => b.createdAt - a.createdAt);
  }

  public actionReport(
    id: string,
    action: 'resolve' | 'dismiss' | 'penalize',
    adminEmail: string,
    actionTaken?: string
  ): ListingReport {
    if (!this.data.reports) this.data.reports = [];
    const rep = this.data.reports.find(r => r.id === id);
    if (!rep) throw new Error('Report ticket not found.');

    const now = Date.now();
    rep.status = action === 'dismiss' ? 'dismissed' : 'resolved';
    rep.reviewedBy = adminEmail;
    rep.reviewedAt = now;
    rep.actionTaken = actionTaken || `Marked ${action} by administrator.`;

    // If penalize, flag the reported stay
    if (action === 'penalize' && rep.stayId) {
      const stay = this.getStayById(rep.stayId);
      if (stay) {
        stay.moderationStatus = 'suspended';
        stay.isDelisted = true;
        stay.moderationReason = `Suspended following user report: ${rep.reason}`;
      }
    }

    this.createAuditLog({
      id: 'aud_' + now,
      action: `report_${action}`,
      actorEmail: adminEmail,
      details: `Report ${id} marked ${action}. Action taken: ${rep.actionTaken}`,
      createdAt: now,
    });

    this.save();
    return rep;
  }

  // --- Reviews Moderation (Section 3) ---
  public getAllReviews(): any[] {
    const reviews = this.data.reviews || [];
    return reviews.map(r => {
      const stay = this.getStayById(r.stayId);
      return {
        ...r,
        stayTitle: stay?.title || 'Airbus Stay',
        status: r.status || 'approved',
      };
    }).sort((a, b) => b.createdAt - a.createdAt);
  }

  public moderateReview(id: string, action: 'approve' | 'hide' | 'unhide' | 'delete', adminEmail: string): Review | null {
    if (!this.data.reviews) this.data.reviews = [];
    const idx = this.data.reviews.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Review not found.');

    const now = Date.now();
    const rev = this.data.reviews[idx];

    if (action === 'delete') {
      this.data.reviews.splice(idx, 1);
      this.createAuditLog({
        id: 'aud_' + now,
        action: 'review_delete',
        actorEmail: adminEmail,
        details: `Deleted review ${id} by ${rev.guestEmail} on stay ${rev.stayId}`,
        createdAt: now,
      });
      this.save();
      return null;
    }

    rev.status = action === 'hide' ? 'hidden' : 'approved';
    rev.moderatedBy = adminEmail;
    rev.moderatedAt = now;

    this.createAuditLog({
      id: 'aud_' + now,
      action: `review_${action}`,
      actorEmail: adminEmail,
      details: `${action.toUpperCase()} review ${id} by ${rev.guestEmail} on stay ${rev.stayId}`,
      createdAt: now,
    });

    this.save();
    return rev;
  }
}

export const db = new DatabaseStore();


