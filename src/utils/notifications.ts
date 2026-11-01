/**
 * Browser Notification & Sound Utilities for AirBus Stays
 * Supports native HTML5 Desktop/Mobile Notifications, Web Audio chimes, and 24-hour check-in alerts.
 */

import { Booking, Stay } from '../types';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return window.Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const perm = await window.Notification.requestPermission();
    return perm;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return window.Notification.permission;
  }
}

/**
 * Play a gentle, pleasant dual-tone chime using Web Audio API (zero external asset dependency)
 */
export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // First tone (587.33 Hz - D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Second harmonic tone (880 Hz - A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.09, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // AudioContext might be restricted prior to user gesture; fail silently
  }
}

/**
 * Send native browser notification
 */
export function sendBrowserNotification(
  title: string,
  options?: NotificationOptions & { onClickUrl?: string }
): boolean {
  if (!isNotificationSupported()) return false;
  if (window.Notification.permission !== 'granted') return false;

  try {
    const notif = new window.Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: options?.tag || 'airbus-alert',
      body: options?.body || '',
      ...options,
    });

    if (options?.onClickUrl) {
      notif.onclick = () => {
        window.focus();
        window.location.hash = options.onClickUrl!.replace(/^#/, '');
        notif.close();
      };
    }

    return true;
  } catch (err) {
    console.warn('Native notification failed:', err);
    return false;
  }
}

/**
 * Triggers 24-hour check-in alert (both native desktop notification and sound chime)
 */
export function trigger24HourCheckinAlert(
  booking: Booking,
  stay: Stay,
  hoursUntilCheckin: number = 24,
  isTest: boolean = false
): { title: string; body: string; toastMessage: string } {
  const timeLabel = isTest
    ? 'DEMO TEST (Starts in 24 hours)'
    : hoursUntilCheckin > 0
    ? `in ~${Math.max(1, Math.round(hoursUntilCheckin))} hours (Tomorrow, ${booking.checkIn})`
    : `today (${booking.checkIn})`;

  const title = `🛎️ Check-in Alert: ${stay.title}`;
  const body = `Your stay begins ${timeLabel} at ${stay.location}! Host Contact: ${stay.whatsapp || stay.hostPhone || '+254 700 000000'}. Ref: ${booking.reference}`;
  const toastMessage = `🛎️ 24h Check-in Reminder: Your stay at "${stay.title}" begins ${timeLabel}! Tap for directions & host contact.`;

  // Play chime
  playNotificationChime();

  // Trigger native browser notification
  sendBrowserNotification(title, {
    body,
    tag: `checkin-24h-${booking.id}`,
    onClickUrl: 'guest',
  });

  return { title, body, toastMessage };
}
