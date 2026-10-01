// AbsTracker Customer Tracking Service Worker & Push Notification Hub
const CACHE_NAME = 'abstracker-user-v2';
const STATIC_ASSETS = [
  '/app/',
  '/manifest.json'
];

// 1. Install Event: Cache Core Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean Stale Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Network-first for dynamic telematics APIs & Tile layers
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket') ||
    url.pathname.startsWith('/ws') ||
    url.hostname.includes('google') ||
    url.hostname.includes('openstreetmap') ||
    url.hostname.includes('cartocdn') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// 4. Push Notification Event: Receive & Display Native Alerts
self.addEventListener('push', (event) => {
  let data = {
    title: 'AbsTracker Vehicle Alert',
    body: 'Vehicle activity detected.',
    icon: 'https://ik.imagekit.io/xgxpgvop9/abstracker.jpg'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Live telematics notification',
    icon: data.icon || 'https://ik.imagekit.io/xgxpgvop9/abstracker.jpg',
    badge: 'https://ik.imagekit.io/xgxpgvop9/abstracker.jpg',
    vibrate: [250, 100, 250, 100, 250],
    data: data.url || '/app/',
    tag: data.tag || 'abstracker-vehicle-alert',
    renotify: true,
    actions: [
      { action: 'open', title: 'Open Live Tracking' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AbsTracker Alert', options)
  );
});

// 5. Notification Click: Bring Window to Focus or Open App
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data || '/app/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes('/app') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
