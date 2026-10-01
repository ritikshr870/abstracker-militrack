/**
 * AbsTracker Universal Push Notification & Sound Manager
 * Handles browser notification permissions, native service worker push notifications,
 * and audio chime dispatch for live telematics events (ignition, overspeed, alarms).
 */

const NOTIFICATION_PREFS_KEY = 'abstracker_notification_prefs';

export function getStoredNotificationPrefs() {
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    pushEnabled: true,
    soundEnabled: true,
    ignitionAlerts: true,
    overspeedAlerts: true,
    geofenceAlerts: true,
    alarmAlerts: true
  };
}

export function saveNotificationPrefs(prefs) {
  try {
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {}
}

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      playNotificationSound();
    }
    return permission;
  } catch (err) {
    console.error('Notification permission request failed:', err);
    return Notification.permission;
  }
}

// Generates an instant high-fidelity audio tone for critical vehicle alerts
export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // E6

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch (e) {}
}

/**
 * Dispatches a native phone/browser push notification
 */
export async function sendPushNotification(title, options = {}) {
  const prefs = getStoredNotificationPrefs();
  if (prefs.pushEnabled === false) return false;

  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const notificationTitle = title || 'AbsTracker Fleet Alert';
  const notificationOptions = {
    body: options.body || 'Vehicle telematics update received.',
    icon: options.icon || 'https://ik.imagekit.io/xgxpgvop9/abstracker.jpg',
    badge: 'https://ik.imagekit.io/xgxpgvop9/abstracker.jpg',
    vibrate: [250, 100, 250, 100, 250],
    data: options.url || '/app/',
    tag: options.tag || `alert-${Date.now()}`,
    renotify: true,
    ...options
  };

  if (prefs.soundEnabled !== false) {
    playNotificationSound();
  }

  // 1. Primary: Use Service Worker registration if active (works on background / mobile)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(notificationTitle, notificationOptions);
        return true;
      }
    } catch (e) {}
  }

  // 2. Fallback: Standard browser Notification constructor
  try {
    const notif = new Notification(notificationTitle, notificationOptions);
    notif.onclick = () => {
      window.focus();
      if (options.url) window.location.href = options.url;
      notif.close();
    };
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Fires an immediate test notification with sound and vibration
 */
export async function sendTestNotification() {
  const perm = getNotificationPermission();
  if (perm !== 'granted') {
    const requested = await requestNotificationPermission();
    if (requested !== 'granted') {
      throw new Error('Please enable browser notification permission first.');
    }
  }

  return sendPushNotification('AbsTracker Live Alert Test', {
    body: 'Push notifications & vehicle sound alarms are fully active on this device!',
    tag: 'test-notification',
    url: '/app/'
  });
}
