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
} from './types';


const TOKEN_KEY = 'airbus_auth_token';

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

    try {
      const res = await fetch(endpoint, {
        ...options,
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP error ${res.status}`);
      }
      return data;
    } catch (err: any) {
      console.warn(`API call failed for ${endpoint}:`, err);
      throw err;
    }
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

