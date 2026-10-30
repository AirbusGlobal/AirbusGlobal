import {
  User,
  Stay,
  Booking,
  ChatThread,
  Review,
  HostPlanStatus,
  PaymentRecord,
  NotificationItem,
  VideoComment,
  VideoCommentReply,
  Post,
  PostStatus,
  PostType,
  LedgerEntry,
  WalletRecord,
  AdRequest,
  ReferralProfile,
  ReferralCommissionRecord,
  PlatformSettings,
  StayPriceTrend,
  ViralityReport,
  StayCategory,
  ListingPromotion,
} from './types';


const TOKEN_KEY = 'airbus_auth_token';
const API_BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || ''
).replace(/\/$/, '');

// Static fallback data for GitHub Pages / static hosting without active Node server
const STATIC_FALLBACK_STAYS: Stay[] = [
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
    area: 45,
    category: 'Silver',
    status: 'live',
    features: ['WiFi', 'Kitchen', 'Gym', 'Parking', 'Workspace', 'Security 24/7'],
    highlights: ['5 min to Yaya Centre', 'High speed WiFi & Work desk', 'Modern rainfall shower'],
    description: 'Chic, sun-filled studio in Kilimani. Perfect for digital nomads, consultants, and romantic weekend escapes. Quiet compound with landscaped garden and gym.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-luxurious-living-room-with-a-modern-interior-design-43409-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
    source: 'Direct',
    instantBook: true,
    isFeatured: false,
    isApprovedByAdmin: true,
    welcomeGifts: ['Artisanal Tea & Macadamia Cookies', 'Filtered Spring Water Jug'],
    hostMessage: 'Welcome to Kilimani! The gym and rooftop terrace are at your service 24/7.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 1,
    views: 980,
    likesCount: 96,
    commentsCount: 1,
    hostFollowerCount: 382,
    gradientHue: [320, 360],
    createdAt: Date.now() - 25 * 864e5,
  },
  {
    id: 's3',
    title: 'Lavington Garden Villa with Heated Private Pool',
    location: 'Lavington, Nairobi',
    lat: -1.2842,
    lng: 36.7681,
    price: 22000,
    currency: 'KES',
    rating: 4.95,
    reviewsCount: 64,
    type: 'Villa',
    guests: 8,
    beds: 4,
    area: 320,
    category: 'Gold',
    status: 'live',
    features: ['WiFi', 'Swimming Pool', 'Garden', 'Chef on Call', 'Bathtub', 'Balcony', 'Fireplace', 'Parking', 'BBQ Grill'],
    highlights: ['0.5 Acre Lush Manicured Lawn', 'Heated Private Pool & Cabana', 'Full Backup Solar & Generator', 'Private Guard 24/7'],
    description: 'Stately 4-bedroom colonial-contemporary villa nestled in gated Lavington enclave. Private heated pool, outdoor dining gazebo with BBQ, chef on call, and manicured green lawns.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-villa-with-pool-and-terrace-in-front-of-the-sea-43406-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
    source: 'Direct',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    welcomeGifts: ['Mount Kenya Sparkling Wine Bottle', 'Fresh Farm Avocado & Fruit Basket', 'Complimentary Firewood Pack'],
    hostMessage: 'Karibu Lavington sanctuary! Our estate groundskeeper and chef are ready to assist you anytime.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 2,
    views: 3120,
    likesCount: 420,
    commentsCount: 5,
    hostFollowerCount: 382,
    gradientHue: [140, 210],
    createdAt: Date.now() - 50 * 864e5,
  },
  {
    id: 's4',
    title: 'Nyali Beachfront Villa with Direct Ocean Access',
    location: 'Nyali, Mombasa',
    lat: -4.0322,
    lng: 39.7112,
    price: 18500,
    currency: 'KES',
    rating: 4.98,
    reviewsCount: 112,
    type: 'Villa',
    guests: 6,
    beds: 3,
    area: 240,
    category: 'Gold',
    status: 'live',
    features: ['WiFi', 'Swimming Pool', 'Air Conditioning', 'Beachfront', 'Kitchen', 'Terrace', 'Sea View', 'Parking'],
    highlights: ['Direct Pathway to Nyali Beach', 'Infinity Pool overlooking Indian Ocean', 'Swahili Coral Architecture & Carved Doors'],
    description: 'Sensational beachfront villa facing the turquoise waters of Mombasa Indian Ocean. Step directly onto the white sands, swim in your oceanfront infinity pool, and enjoy coastal breezes under makuti pergolas.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-luxury-home-with-pool-and-sea-view-43410-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    source: 'Direct',
    instantBook: true,
    isFeatured: true,
    isApprovedByAdmin: true,
    isPromoted: true,
    promotedUntil: Date.now() + 12 * 864e5,
    promotionImpressions: 890,
    promotionClicks: 142,
    welcomeGifts: ['Chilled Fresh Coconut Madafu Drinks', 'Mombasa Halwa & Coastal Spice Pack', 'Complimentary Beach Towels & Snorkels'],
    hostMessage: 'Jambo and Karibu to the beach! Enjoy fresh ocean breeze and private chef assistance on request.',
    ownerEmail: 'owner@airbus.ke',
    hostName: 'David Mutua',
    hostPhone: '+254 722 987 654',
    whatsapp: '254722987654',
    minNights: 2,
    views: 4500,
    likesCount: 680,
    commentsCount: 8,
    hostFollowerCount: 382,
    gradientHue: [180, 240],
    createdAt: Date.now() - 60 * 864e5,
  },
];

const STATIC_FALLBACK_ADS: AdRequest[] = [
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
    startsAt: Date.now() - 2 * 864e5,
    expiresAt: Date.now() + 5 * 864e5,
    createdAt: Date.now() - 2 * 864e5,
  },
  {
    id: 'ad_3',
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
    status: 'approved',
    startsAt: Date.now() - 3600e3,
    expiresAt: Date.now() + 3 * 864e5,
    createdAt: Date.now() - 3600e3,
  },
];

export const api = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string | null) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  },

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const targetUrl = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;

    try {
      const res = await fetch(targetUrl, {
        ...options,
        headers,
      });

      const contentType = res.headers.get('content-type') || '';
      // Detect GitHub Pages static 404 HTML fallback
      if (!contentType.includes('application/json')) {
        return this.getStaticFallback<T>(endpoint);
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP error ${res.status}`);
      }
      return data;
    } catch (err: any) {
      console.warn(`API call failed for ${endpoint}, using resilient fallback:`, err);
      return this.getStaticFallback<T>(endpoint);
    }
  },

  getStaticFallback<T>(endpoint: string): T {
    if (endpoint.includes('/view') || endpoint.includes('/click') || endpoint.includes('/promo-')) {
      return { recorded: true } as unknown as T;
    }
    if (endpoint.startsWith('/api/stays')) {
      return { stays: STATIC_FALLBACK_STAYS } as unknown as T;
    }
    if (endpoint.startsWith('/api/ads')) {
      return { ads: STATIC_FALLBACK_ADS } as unknown as T;
    }
    if (endpoint.startsWith('/api/host/plan')) {
      return {
        plan: {
          tier: 'Diamond',
          status: 'active',
          expiresAt: Date.now() + 28 * 864e5,
          graceExpiresAt: Date.now() + 30 * 864e5,
          hasPaidSubscription: true,
        },
        wallet: 14500,
        availablePlans: {
          Silver: { p: 1000, l: 3, name: 'Silver' },
          Diamond: { p: 2500, l: 10, name: 'Diamond' },
          Gold: { p: 5000, l: 50, name: 'Gold' },
        },
      } as unknown as T;
    }
    if (endpoint.startsWith('/api/wallet')) {
      return {
        wallet: { email: 'owner@airbus.ke', balance: 14500, holdBalance: 0, lifetimeEarnings: 21000, lifetimeSpent: 6500, updatedAt: Date.now() },
        ledger: [],
      } as unknown as T;
    }
    if (endpoint.startsWith('/api/bookings')) {
      return { bookings: [] } as unknown as T;
    }
    if (endpoint.startsWith('/api/threads')) {
      return { threads: [] } as unknown as T;
    }
    if (endpoint.startsWith('/api/wishlist')) {
      return { wishlist: ['s1', 's4'], stays: STATIC_FALLBACK_STAYS.slice(0, 2) } as unknown as T;
    }
    if (endpoint.startsWith('/api/notifications')) {
      return {
        notifications: [
          {
            id: 'notif_welcome',
            userEmail: 'guest@airbus.ke',
            title: 'Welcome to AirBus 🚀',
            message: 'Discover high-definition video stays across Nairobi and the Kenyan coast with direct booking and zero fees.',
            read: false,
            link: '/#home',
            type: 'system',
            createdAt: Date.now(),
          },
        ],
        unreadCount: 1,
      } as unknown as T;
    }
    if (endpoint.startsWith('/api/settings')) {
      return {
        settings: {
          adPricePerDay: 100,
          adPlatformFeePercent: 30,
          maxAdSlotsPerPost: 10,
          referralCommissionPercent: 10,
          referralDurationDays: 365,
          minWithdrawalKes: 500,
          planPrices: { Silver: 1000, Diamond: 2500, Gold: 5000 },
          currencyRates: { KES: 1, USD: 0.0077, EUR: 0.0071 },
          contentPolicies: { maxDescriptionChars: 300, maxPostImages: 10, maxShortSeconds: 60, maxVideoSeconds: 1800 },
        },
      } as unknown as T;
    }
    return {} as T;
  },

  // Auth
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const data = await this.request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  },

  async register(userData: any): Promise<{ user: User; token: string }> {
    const data = await this.request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    this.setToken(data.token);
    return data;
  },

  async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/api/auth/me');
  },

  async updateProfile(profileData: any): Promise<{ user: User }> {
    return this.request<{ user: User }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
  },

  logout() {
    this.setToken(null);
  },

  // Stays
  async getStays(params: Record<string, any> = {}): Promise<{ stays: Stay[] }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        if (Array.isArray(v)) {
          v.forEach(val => query.append(k, val));
        } else {
          query.set(k, String(v));
        }
      }
    });
    const qs = query.toString();
    return this.request<{ stays: Stay[] }>(`/api/stays${qs ? `?${qs}` : ''}`);
  },

  async getStay(id: string): Promise<{ stay: Stay }> {
    return this.request<{ stay: Stay }>(`/api/stays/${id}`);
  },

  async incrementViews(id: string): Promise<{ views: number }> {
    return this.request<{ views: number }>(`/api/stays/${id}/view`, { method: 'POST' });
  },

  async recordStayView(id: string): Promise<{ views: number }> {
    return this.incrementViews(id);
  },

  async toggleLikeStay(id: string): Promise<{ likesCount: number; isLiked: boolean; liked: boolean }> {
    const res = await this.request<{ likesCount: number; isLiked: boolean }>(`/api/stays/${id}/like`, { method: 'POST' });
    return { ...res, liked: res.isLiked };
  },

  async toggleFollowHost(hostEmail: string): Promise<{ followerCount: number; isFollowing: boolean }> {
    return this.request<{ followerCount: number; isFollowing: boolean }>(
      `/api/hosts/${encodeURIComponent(hostEmail)}/follow`,
      { method: 'POST' }
    );
  },

  async getComments(stayId: string): Promise<{ comments: VideoComment[] }> {
    return this.request<{ comments: VideoComment[] }>(`/api/stays/${stayId}/comments`);
  },

  async addStayComment(stayId: string, text: string): Promise<{ comment: VideoComment; comments: VideoComment[] }> {
    return this.request<{ comment: VideoComment; comments: VideoComment[] }>(`/api/stays/${stayId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  async addComment(stayId: string, text: string): Promise<{ comment: VideoComment; comments: VideoComment[] }> {
    return this.addStayComment(stayId, text);
  },

  async addCommentReply(
    stayId: string,
    commentId: string,
    text: string
  ): Promise<{ reply: VideoCommentReply; comments: VideoComment[] }> {
    return this.request<{ reply: VideoCommentReply; comments: VideoComment[] }>(
      `/api/stays/${stayId}/comments/${commentId}/reply`,
      {
        method: 'POST',
        body: JSON.stringify({ text }),
      }
    );
  },

  async askAirBusAI(stayId: string, question: string): Promise<{ answer: string }> {
    return this.request<{ answer: string }>('/api/ai/ask-stay', {
      method: 'POST',
      body: JSON.stringify({ stayId, question }),
    });
  },

  async askStayAi(stayId: string, question: string): Promise<{ answer: string }> {
    return this.askAirBusAI(stayId, question);
  },

  async createStay(stay: Partial<Stay>): Promise<{ stay: Stay }> {
    return this.request<{ stay: Stay }>('/api/stays', {
      method: 'POST',
      body: JSON.stringify(stay),
    });
  },

  async approveStayByAdmin(id: string): Promise<{ stay: Stay }> {
    return this.request<{ stay: Stay }>(`/api/admin/stays/${id}/approve`, {
      method: 'POST',
    });
  },

  async updateStay(id: string, updates: Partial<Stay>): Promise<{ stay: Stay }> {
    return this.request<{ stay: Stay }>(`/api/stays/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteStay(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/stays/${id}`, {
      method: 'DELETE',
    });
  },

  // Bookings
  async getBookings(): Promise<{ bookings: Booking[] }> {
    return this.request<{ bookings: Booking[] }>('/api/bookings');
  },

  async createBooking(bookingData: {
    stayId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    note?: string;
  }): Promise<{ booking: Booking }> {
    return this.request<{ booking: Booking }>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  },

  async updateBookingStatus(id: string, status: Booking['status']): Promise<{ booking: Booking }> {
    return this.request<{ booking: Booking }>(`/api/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Threads & Negotiations
  async getThreads(): Promise<{ threads: ChatThread[] }> {
    return this.request<{ threads: ChatThread[] }>('/api/threads');
  },

  async getThread(id: string): Promise<{ thread: ChatThread }> {
    return this.request<{ thread: ChatThread }>(`/api/threads/${id}`);
  },

  async sendMessage(
    id: string,
    message: { type: 'text' | 'offer' | 'counter'; text?: string; amount?: number }
  ): Promise<{ thread: ChatThread }> {
    return this.request<{ thread: ChatThread }>(`/api/threads/${id}/message`, {
      method: 'POST',
      body: JSON.stringify(message),
    });
  },

  async replyOffer(id: string, action: 'accept' | 'decline'): Promise<{ thread: ChatThread }> {
    return this.request<{ thread: ChatThread }>(`/api/threads/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  // Reviews
  async getReviews(stayId: string): Promise<{ reviews: Review[] }> {
    return this.request<{ reviews: Review[] }>(`/api/reviews/${stayId}`);
  },

  async createReview(reviewData: {
    stayId: string;
    rating: number;
    comment: string;
  }): Promise<{ review: Review }> {
    return this.request<{ review: Review }>('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData),
    });
  },

  // Host Plan & Wallet
  async getHostPlan(): Promise<{
    plan: HostPlanStatus;
    wallet: number;
    availablePlans: Record<string, { p: number; l: number; name: string }>;
  }> {
    return this.request('/api/host/plan');
  },

  async submitPayment(paymentData: {
    kind: 'plan' | 'wallet';
    tier?: string;
    amount: number;
    mpesaCode: string;
  }): Promise<{ payment: PaymentRecord }> {
    return this.request<{ payment: PaymentRecord }>('/api/payments', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  },

  // Wishlist
  async getWishlist(): Promise<{ wishlist: string[]; stays: Stay[] }> {
    return this.request<{ wishlist: string[]; stays: Stay[] }>('/api/wishlist');
  },

  async toggleWishlist(stayId: string): Promise<{ saved: boolean; wishlist: string[] }> {
    return this.request<{ saved: boolean; wishlist: string[] }>('/api/wishlist/toggle', {
      method: 'POST',
      body: JSON.stringify({ stayId }),
    });
  },

  // Notifications (with delete and clear)
  async getNotifications(): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
    return this.request<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications');
  },

  async markNotificationsRead(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/notifications/read', {
      method: 'POST',
    });
  },

  async deleteNotification(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/notifications/${id}`, {
      method: 'DELETE',
    });
  },

  async clearAllNotifications(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/notifications', {
      method: 'DELETE',
    });
  },

  // Support & Reports
  async submitTicket(email: string, message: string, subject?: string) {
    return this.request('/api/support/ticket', {
      method: 'POST',
      body: JSON.stringify({ email, message, subject }),
    });
  },

  async submitReport(stayId: string, reason: string, details?: string) {
    return this.request('/api/support/report', {
      method: 'POST',
      body: JSON.stringify({ stayId, reason, details }),
    });
  },

  // Admin
  async getAdminOverview(): Promise<any> {
    return this.request('/api/admin/overview');
  },

  async approvePayment(id: string): Promise<{ payment: PaymentRecord }> {
    return this.request(`/api/admin/payments/${id}/approve`, {
      method: 'POST',
    });
  },

  async rejectPayment(id: string, reason?: string): Promise<{ payment: PaymentRecord }> {
    return this.request(`/api/admin/payments/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async verifyUser(email: string): Promise<{ user: User }> {
    return this.request(`/api/admin/users/${encodeURIComponent(email)}/verify`, {
      method: 'POST',
    });
  },

  async adjustHostPlan(hostEmail: string, tier: string, durationDays: number): Promise<any> {
    return this.request('/api/admin/plan', {
      method: 'POST',
      body: JSON.stringify({ hostEmail, tier, durationDays }),
    });
  },

  // AI
  async findTripsAI(params: any): Promise<{ matches: Array<{ stay: Stay; matchReason: string }> }> {
    return this.request('/api/ai/trip-finder', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async describeStayAI(params: any): Promise<{ description: string; highlights: string[] }> {
    return this.request('/api/ai/describe-stay', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async clearNotifications(): Promise<{ success: boolean }> {
    return this.clearAllNotifications();
  },

  // Dynamic Settings
  async getSettings(): Promise<{ settings: PlatformSettings }> {
    return this.request('/api/settings');
  },

  async updateSettings(partial: Partial<PlatformSettings>): Promise<{ settings: PlatformSettings }> {
    return this.request('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(partial),
    });
  },

  // Wallets & Ledger
  async getWallet(): Promise<{ wallet: WalletRecord; ledger: LedgerEntry[] }> {
    return this.request('/api/wallet');
  },

  async topupWallet(amount: number, mpesaCode: string): Promise<{ payment: PaymentRecord }> {
    return this.request('/api/wallet/topup', {
      method: 'POST',
      body: JSON.stringify({ amount, mpesaCode }),
    });
  },

  async requestWithdrawal(amount: number, destination: string): Promise<{ withdrawal: any }> {
    return this.request('/api/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, destination }),
    });
  },

  async getAdminWithdrawals(): Promise<{ withdrawals: any[] }> {
    return this.request('/api/admin/withdrawals');
  },

  async approveWithdrawal(id: string): Promise<{ withdrawal: any }> {
    return this.request(`/api/admin/withdrawals/${id}/approve`, { method: 'POST' });
  },

  async rejectWithdrawal(id: string, reason?: string): Promise<{ withdrawal: any }> {
    return this.request(`/api/admin/withdrawals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async payPlanFromWallet(tier: StayCategory): Promise<{ plan: HostPlanStatus; ledger: LedgerEntry; walletBalance: number }> {
    return this.request('/api/plans/wallet-pay', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
  },

  // Posts
  async getPosts(filter?: { ownerEmail?: string; status?: PostStatus; type?: PostType }): Promise<{ posts: Post[] }> {
    const params = new URLSearchParams();
    if (filter?.ownerEmail) params.set('ownerEmail', filter.ownerEmail);
    if (filter?.status) params.set('status', filter.status);
    if (filter?.type) params.set('type', filter.type);
    const qs = params.toString();
    return this.request(`/api/posts${qs ? '?' + qs : ''}`);
  },

  async getPostById(id: string): Promise<{ post: Post }> {
    return this.request(`/api/posts/${id}`);
  },

  async createPost(data: any): Promise<{ post: Post }> {
    return this.request('/api/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async moderatePost(id: string, status: 'approved' | 'rejected' | 'removed', reason?: string): Promise<{ post: Post }> {
    return this.request(`/api/posts/${id}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
  },

  async recordPostView(id: string): Promise<{ recorded: boolean }> {
    return this.request(`/api/posts/${id}/view`, { method: 'POST' });
  },

  // Ads
  async getAds(params?: { stayId?: string; status?: string }): Promise<{ ads: AdRequest[] }> {
    const sp = new URLSearchParams();
    if (params?.stayId) sp.set('stayId', params.stayId);
    if (params?.status) sp.set('status', params.status);
    const qs = sp.toString();
    return this.request(`/api/ads${qs ? '?' + qs : ''}`);
  },

  async createAd(data: any): Promise<{ ad: AdRequest }> {
    return this.request('/api/ads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async approveAd(id: string): Promise<{ ad: AdRequest }> {
    return this.request(`/api/ads/${id}/approve`, { method: 'POST' });
  },

  async rejectAd(id: string, reason?: string): Promise<{ ad: AdRequest }> {
    return this.request(`/api/ads/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async recordAdView(id: string): Promise<{ recorded: boolean }> {
    return this.request(`/api/ads/${id}/view`, { method: 'POST' });
  },

  async recordAdClick(id: string): Promise<{ recorded: boolean }> {
    return this.request(`/api/ads/${id}/click`, { method: 'POST' });
  },

  // Listing Promotions (KES 100/day visibility boost)
  async promoteListing(
    stayId: string,
    days: number,
    idempotencyKey?: string
  ): Promise<{ stay: Stay; promotion: ListingPromotion; ledger: LedgerEntry; walletBalance: number }> {
    return this.request(`/api/listings/${stayId}/promote`, {
      method: 'POST',
      body: JSON.stringify({ days, idempotencyKey }),
    });
  },

  async getOwnerPromotions(): Promise<{ promotions: ListingPromotion[] }> {
    return this.request('/api/owner/promotions');
  },

  async recordPromoImpression(stayId: string): Promise<{ recorded: boolean }> {
    return this.request(`/api/listings/${stayId}/promo-impression`, { method: 'POST' });
  },

  async recordPromoClick(stayId: string): Promise<{ recorded: boolean }> {
    return this.request(`/api/listings/${stayId}/promo-click`, { method: 'POST' });
  },

  // Referrals
  async getReferralProfile(): Promise<{ profile: ReferralProfile; commissions: ReferralCommissionRecord[] }> {
    return this.request('/api/referrals/me');
  },

  async trackReferralClick(code: string): Promise<{ recorded: boolean }> {
    return this.request('/api/referrals/click', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  // Analytics
  async getPriceTrend(stayId: string): Promise<{ trend: StayPriceTrend }> {
    return this.request(`/api/analytics/price-trend/${stayId}`);
  },

  async getViralityReport(id: string): Promise<{ report: ViralityReport }> {
    return this.request(`/api/analytics/virality/${id}`);
  },
};

