export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  REFUNDED = 'REFUNDED',
}

export type LegacyPaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded';

export enum PaymentPurpose {
  WALLET_TOPUP = 'OTHER',
  SUBSCRIPTION = 'SUBSCRIPTION',
  ADVERTISING = 'ADVERTISING',
  TRIP_DATING = 'TRIP_DATING',
  AIRBUS_PLUS = 'AIRBUS_PLUS',
  OTHER = 'OTHER',
}

export enum WalletType {
  AIRBUS = 'AIRBUS',
  USER = 'USER',
  ADMIN_PLATFORM = 'ADMIN_PLATFORM',
}

export const DEPOSIT_RECORD_TYPES = [
  'deposit',
  'wallet',
  'wallet_topup',
  'mpesa_deposit',
] as const;

export const WALLET_PAYMENT_TYPES = [
  'advert',
  'subscription',
  'boost',
  'vvvip',
  'trip_dating',
  'booking_fee',
] as const;

export const PAYMENT_PURPOSE_OPTIONS: ReadonlyArray<{
  value: string;
  walletPurpose: PaymentPurpose;
  label: string;
  description: string;
}> = [
  {
    value: 'WALLET_TOPUP',
    walletPurpose: PaymentPurpose.WALLET_TOPUP,
    label: 'AirBus Wallet Top-Up',
    description: 'General deposit to fund your AirBus Wallet balance',
  },
  {
    value: 'SUBSCRIPTION',
    walletPurpose: PaymentPurpose.SUBSCRIPTION,
    label: 'Host Subscription (Silver / Diamond / Gold)',
    description: 'Fund wallet for activating or renewing your hosting plan',
  },
  {
    value: 'ADVERTISING',
    walletPurpose: PaymentPurpose.ADVERTISING,
    label: 'Advertising & Listing Boosts',
    description: 'Fund wallet for sponsored slots and promoted stays',
  },
  {
    value: 'TRIP_DATING',
    walletPurpose: PaymentPurpose.TRIP_DATING,
    label: 'Trip Dating Unlocks',
    description: 'Fund wallet for KES 50 Trip Dating contact unlocks',
  },
  {
    value: 'AIRBUS_PLUS',
    walletPurpose: PaymentPurpose.AIRBUS_PLUS,
    label: 'AirBus Plus Membership',
    description: 'Fund wallet for AirBus Plus VVVIP membership',
  },
];

const safeEnv = (key: string, fallback: string): string => {
  try {
    if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string' && process.env[key]) {
      return String(process.env[key]).trim();
    }
  } catch {
    // ignore
  }
  return fallback;
};

export const MPESA_CONFIG = {
  TILL_NUMBER: safeEnv('AIRBUS_MPESA_TILL', '943210'),
  PAYBILL_NUMBER: safeEnv('AIRBUS_MPESA_PAYBILL', '222111'),
  PAYBILL_ACCOUNT: safeEnv('AIRBUS_MPESA_ACCOUNT', 'ff1314'),
  ADMIN_WALLET_ID: 'admin@airbus.ke',
  MIN_DEPOSIT_KES: 10,
  MAX_DEPOSIT_KES: 1_000_000,
  CODE_MIN_LEN: 8,
  CODE_MAX_LEN: 15,
  CODE_REGEX: /^[A-Z0-9]{8,15}$/,
  STRICT_CODE_REGEX: /^[A-Z0-9]{10}$/,
  PHONE_REGEX: /^(?:\+?254|0)[17]\d{8}$/,
  PRESET_AMOUNTS_KES: [500, 1000, 2500, 5000, 10000] as const,
  DECLINE_REASON_MIN_LEN: 10,
  DECLINE_REASON_MAX_LEN: 500,
  POLL_INTERVAL_MS: 15_000,
  RECONCILIATION_INTERVAL_MS: 60_000,
} as const;

export function normalizePaymentStatus(raw?: string | null): PaymentStatus {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'APPROVED' || s === 'COMPLETED' || s === 'CONFIRMED') return PaymentStatus.APPROVED;
  if (s === 'DECLINED' || s === 'REJECTED' || s === 'FAILED') return PaymentStatus.DECLINED;
  if (s === 'REFUNDED' || s === 'REVERSED') return PaymentStatus.REFUNDED;
  return PaymentStatus.PENDING;
}

export function toLegacyPaymentStatus(canonical: PaymentStatus | string): LegacyPaymentStatus {
  const norm = normalizePaymentStatus(canonical);
  if (norm === PaymentStatus.APPROVED) return 'approved';
  if (norm === PaymentStatus.DECLINED) return 'rejected';
  if (norm === PaymentStatus.REFUNDED) return 'refunded';
  return 'pending';
}

export function isDepositRecord(record: { type?: string; kind?: string } | null | undefined): boolean {
  if (!record) return false;
  const t = String(record.type || '').toLowerCase().trim();
  const k = String(record.kind || '').toLowerCase().trim();
  return (
    (DEPOSIT_RECORD_TYPES as readonly string[]).includes(t) ||
    (DEPOSIT_RECORD_TYPES as readonly string[]).includes(k)
  );
}

export function normalizePaymentPurpose(raw?: string | null): PaymentPurpose {
  const p = String(raw || '').trim().toUpperCase();
  if (p === 'SUBSCRIPTION' || p === 'PLAN') return PaymentPurpose.SUBSCRIPTION;
  if (p === 'ADVERTISING' || p === 'ADVERT' || p === 'BOOST' || p === 'PROMOTION') return PaymentPurpose.ADVERTISING;
  if (p === 'TRIP_DATING') return PaymentPurpose.TRIP_DATING;
  if (p === 'AIRBUS_PLUS' || p === 'VVVIP') return PaymentPurpose.AIRBUS_PLUS;
  return PaymentPurpose.OTHER;
}

export function normalizeKenyanPhone(raw?: string | null): string {
  const cleaned = String(raw || '').replace(/[\s()-]/g, '').trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '+254' + cleaned.slice(1);
  }
  if (cleaned.startsWith('254') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  return cleaned;
}

export function stripHtmlTags(raw: string): string {
  return String(raw || '').replace(/<[^>]*>/g, '').trim();
}
