/**
 * AbsTracker Universal Push Notification & Sound Manager
 * Handles native Android Capacitor local notifications, browser Web Push API,
 * and audio chime / text-to-speech dispatch for live telematics events (ignition, overspeed, alarms).
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const NOTIFICATION_PREFS_KEY = 'abstracker_notification_prefs';
const NATIVE_PERM_KEY = 'abstracker_native_notif_perm';

export function getStoredNotificationPrefs() {
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    pushEnabled: true,
    soundEnabled: true,
    voiceAlerts: true,
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
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return true;
  return 'Notification' in window;
}

// Ensure notification channel is created for Android 8.0+
let isChannelCreated = false;
export async function ensureAndroidChannel() {
  if (!Capacitor.isNativePlatform() || isChannelCreated) return;
  try {
    await LocalNotifications.createChannel({
      id: 'abstracker-telematics-alerts',
      name: 'AbsTracker Vehicle Alerts',
      description: 'Critical ignition, overspeed, and vehicle security telematics alerts',
      importance: 5, // MAX importance: heads-up banner with sound & vibration
      visibility: 1, // Show on lock screen
      vibration: true,
      lights: true,
      lightColor: '#2563EB'
    });
    isChannelCreated = true;
  } catch (e) {
    console.warn('Channel creation warning:', e);
  }
}

export async function checkNotificationPermissionAsync() {
  if (Capacitor.isNativePlatform()) {
    try {
      const check = await LocalNotifications.checkPermissions();
      if (check.display === 'granted') {
        localStorage.setItem(NATIVE_PERM_KEY, 'granted');
        return 'granted';
      } else if (check.display === 'denied') {
        localStorage.setItem(NATIVE_PERM_KEY, 'denied');
        return 'denied';
      } else {
        return 'default';
      }
    } catch (e) {
      return localStorage.getItem(NATIVE_PERM_KEY) || 'granted';
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function getNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    return localStorage.getItem(NATIVE_PERM_KEY) || 'granted';
  }
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureAndroidChannel();
      const res = await LocalNotifications.requestPermissions();
      const status = res.display === 'granted' ? 'granted' : (res.display === 'denied' ? 'denied' : 'default');
      localStorage.setItem(NATIVE_PERM_KEY, status);
      if (status === 'granted') {
        playNotificationSound();
      }
      return status;
    } catch (err) {
      console.error('Native notification permission error:', err);
      localStorage.setItem(NATIVE_PERM_KEY, 'granted');
      return 'granted';
    }
  }

  if (!isNotificationSupported()) {
    throw new Error('Push notifications are not supported in this environment.');
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

// Audio synthesizer tone for alert
export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch (e) {}
}

// Spoken Voice alert ("Engine On", "Engine Off", "Overspeed Alert")
export function speakVehicleAlert(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const prefs = getStoredNotificationPrefs();
    if (prefs.voiceAlerts === false) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const preferred = voices.find(v => 
        (v.lang.startsWith('en') || v.lang.startsWith('en-IN')) && 
        (v.name.includes('Google') || v.name.includes('Natural') || v.default)
      ) || voices[0];
      if (preferred) utterance.voice = preferred;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis warning:', e);
  }
}

// Dispatch native phone / browser push notification
let notifIdCounter = 1000;
export async function sendPushNotification(title, options = {}) {
  const prefs = getStoredNotificationPrefs();
  if (prefs.pushEnabled === false) return false;

  const notificationTitle = title || 'AbsTracker Fleet Alert';
  const notificationBody = options.body || 'Vehicle telematics update received.';

  if (prefs.soundEnabled !== false) {
    playNotificationSound();
  }

  // 1. If running on native Android APK via Capacitor
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureAndroidChannel();
      notifIdCounter = (notifIdCounter + 1) % 999999;
      await LocalNotifications.schedule({
        notifications: [
          {
            title: notificationTitle,
            body: notificationBody,
            id: notifIdCounter,
            channelId: 'abstracker-telematics-alerts',
            smallIcon: 'ic_launcher',
            largeIcon: 'ic_launcher',
            extra: {
              url: options.url || '/app/'
            }
          }
        ]
      });
      return true;
    } catch (e) {
      console.warn('Capacitor local notification dispatch warning:', e);
    }
  }

  // 2. Web ServiceWorker push notification
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(notificationTitle, {
          body: notificationBody,
          icon: options.icon || 'https://ik.imagekit.io/xgxpgvop9/abstracker.jpg',
          badge: 'https://ik.imagekit.io/xgxpgvop9/abstracker.jpg',
          vibrate: [250, 100, 250, 100, 250],
          data: options.url || '/app/',
          tag: options.tag || `alert-${Date.now()}`,
          renotify: true,
          ...options
        });
        return true;
      }
    } catch (e) {}
  }

  // 3. Fallback standard Web Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(notificationTitle, {
        body: notificationBody,
        icon: options.icon || 'https://ik.imagekit.io/xgxpgvop9/abstracker.jpg'
      });
      notif.onclick = () => {
        window.focus();
        if (options.url) window.location.href = options.url;
        notif.close();
      };
      return true;
    } catch (err) {}
  }

  return false;
}

export async function sendTestNotification() {
  const perm = getNotificationPermission();
  if (perm !== 'granted') {
    const requested = await requestNotificationPermission();
    if (requested !== 'granted') {
      throw new Error('Please enable notification permissions first.');
    }
  }

  speakVehicleAlert('AbsTracker Voice Alert: Engine On, Engine Off Active');

  return sendPushNotification('AbsTracker Live Alert Test', {
    body: 'Push notifications, voice engine speech, and alarms are active on this device!',
    tag: 'test-notification',
    url: '/app/'
  });
}
