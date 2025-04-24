const CACHE_NAME = 'pomonotes-v2';
const ASSETS = [
  '/',
  '/history',
  '/notes',
  '/static/style.css',
  '/static/script.js',
  '/static/history.js',
  '/static/notes.js',
  '/static/icon-192x192.png',
  '/static/icon-512x512.png',
  '/static/notification.mp3',
  'https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css',
  'https://unpkg.com/htmx.org@1.9.6',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Skip API requests (don't cache these)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response - one to return, one to cache
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          });
      })
  );
});

// Handle push notifications
self.addEventListener('push', event => {
  const data = event.data.text() ? JSON.parse(event.data.text()) : {};
  const title = data.title || 'Pomonotes';
  const options = {
    body: data.body || 'Your timer has completed!',
    icon: '/static/icon-192x192.png',
    badge: '/static/icon-192x192.png',
    tag: 'pomodoro-notification',
    renotify: true,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    data: {
      url: '/'
    }
  };
  
  // Try to increment the badge counter
  if ('setAppBadge' in navigator) {
    self.registration.getNotifications().then(notifications => {
      const count = notifications.length + 1;
      navigator.setAppBadge(count).catch(err => console.error('Badge error:', err));
    });
  }
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
// Add this to your service-worker.js file

// Handle notification clicks with enhanced interaction for timer notifications
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  notification.close();
  
  // Handle timer controls via notification actions
  if (notification.tag === 'timer-notification') {
    if (event.action === 'pause') {
      // Tell the page to pause the timer
      self.clients.matchAll({type: 'window'}).then(clients => {
        if (clients && clients.length) {
          clients[0].postMessage({
            action: 'pauseTimer'
          });
        }
      });
    } else if (event.action === 'resume') {
      // Tell the page to resume the timer
      self.clients.matchAll({type: 'window'}).then(clients => {
        if (clients && clients.length) {
          clients[0].postMessage({
            action: 'resumeTimer'
          });
        }
      });
    } else {
      // Default action is to focus/open the app
      event.waitUntil(
        clients.matchAll({type: 'window'}).then(clientList => {
          for (const client of clientList) {
            if (client.url === '/' && 'focus' in client) {
              return client.focus();
            }
          }
          
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
      );
    }
    return;
  }
  
  // Handle regular notification clicks (existing code)
  if (event.action === 'dismiss') {
    return;
  }
  
  // Default action is to open the app
  event.waitUntil(
    clients.matchAll({type: 'window'}).then(clientList => {
      // If a tab is already open, focus it
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Handle notification close events
self.addEventListener('notificationclose', event => {
  console.log('Notification was closed', event);
});
