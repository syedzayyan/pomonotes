// Service worker for Pomonotes
// Cache names
const STATIC_CACHE = 'pomonotes-static-v1';
const DYNAMIC_CACHE = 'pomonotes-dynamic-v1';
const API_CACHE = 'pomonotes-api-v1';

// Resources to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/style.css',
  '/static/script.js',
  '/static/auth.js',
  '/static/navbar.js',
  '/static/icon-192x192.png',
  '/static/icon-512x512.png',
  '/static/favicon.ico',
  '/static/notification.mp3',
  '/static/manifest.json',
  'https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css',
  'https://cdn.jsdelivr.net/simplemde/latest/simplemde.min.css',
  'https://unpkg.com/htmx.org@1.9.6',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/simplemde/latest/simplemde.min.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Static assets cached');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
      })
      .then(cachesToDelete => {
        return Promise.all(cachesToDelete.map(cacheToDelete => {
          console.log('[Service Worker] Deleting old cache:', cacheToDelete);
          return caches.delete(cacheToDelete);
        }));
      })
      .then(() => self.clients.claim())
  );
});

// Function to determine if a request is an API request
function isApiRequest(url) {
  const apiPaths = ['/api/sessions', '/api/pomodoros', '/api/breaks', '/api/notes', '/api/tags'];
  return apiPaths.some(path => url.pathname.startsWith(path));
}

// Function to check if request is GET
function isGetRequest(request) {
  return request.method === 'GET';
}

// Function to handle API requests with offline support
async function handleApiRequest(request) {
  // For GET requests, try network first, then cache
  if (isGetRequest(request)) {
    try {
      // Try to get from network
      const response = await fetch(request);
      
      // Store in cache if successful
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
      
      return response;
    } catch (error) {
      console.log('[Service Worker] Network error, trying cache', error);
      
      // If network fails, try from cache
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // If not in cache either, return offline response for API
      return new Response(
        JSON.stringify({ 
          error: 'You are offline',
          offline: true,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } else {
    // For non-GET requests (POST, PUT, etc.), try online first
    try {
      const response = await fetch(request);
      return response;
    } catch (error) {
      console.log('[Service Worker] Network error for non-GET request', error);
      
      // Queue the request for later if it's a POST or PUT
      if (request.method === 'POST' || request.method === 'PUT') {
        await queueRequest(request.clone());
        
        // Return a "success" response to prevent app errors
        return new Response(
          JSON.stringify({ 
            id: 'offline-' + new Date().getTime(),
            offline: true,
            queued: true,
            message: 'Request queued for when you\'re back online'
          }),
          { 
            status: 202, // Accepted
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // For other methods, return error
      return new Response(
        JSON.stringify({ 
          error: 'Cannot perform this action while offline',
          offline: true
        }),
        { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
}

// Queue a request for later execution when back online
async function queueRequest(request) {
  try {
    // Clone the request to a serializable format
    const serializedRequest = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: new Date().getTime()
    };
    
    // Get current queue from IndexedDB
    const db = await openRequestQueue();
    const tx = db.transaction('requests', 'readwrite');
    const store = tx.objectStore('requests');
    
    // Add to queue
    await store.add(serializedRequest);
    console.log('[Service Worker] Request queued for later', serializedRequest);
    
    // Commit transaction
    await tx.complete;
    db.close();
    
    // Notify any open clients about the queued request
    const clients = await self.clients.matchAll({
      type: 'window'
    });
    
    clients.forEach(client => {
      client.postMessage({ 
        type: 'REQUEST_QUEUED',
        payload: {
          method: serializedRequest.method,
          url: serializedRequest.url,
          timestamp: serializedRequest.timestamp
        }
      });
    });
    
  } catch (error) {
    console.error('[Service Worker] Failed to queue request', error);
  }
}

// Open the IndexedDB database for request queue
function openRequestQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PomonotesOfflineQueue', 1);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('requests')) {
        db.createObjectStore('requests', { keyPath: 'timestamp' });
      }
    };
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    request.onerror = event => {
      console.error('[Service Worker] IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Function to process queued requests
async function processQueue() {
  try {
    const db = await openRequestQueue();
    const tx = db.transaction('requests', 'readwrite');
    const store = tx.objectStore('requests');
    const requests = await store.getAll();
    
    if (requests.length === 0) {
      console.log('[Service Worker] No requests in queue');
      db.close();
      return;
    }
    
    console.log('[Service Worker] Processing', requests.length, 'queued requests');
    
    // Process each request
    for (const requestData of requests) {
      try {
        const request = new Request(requestData.url, {
          method: requestData.method,
          headers: new Headers(requestData.headers),
          body: requestData.method !== 'GET' ? requestData.body : undefined
        });
        
        // Send the request
        await fetch(request);
        console.log('[Service Worker] Successfully processed queued request:', requestData.url);
        
        // Remove from queue
        await store.delete(requestData.timestamp);
        
      } catch (error) {
        console.error('[Service Worker] Failed to process queued request:', error);
        // Leave in queue to try again later
      }
    }
    
    await tx.complete;
    db.close();
    
    // Notify clients that the queue was processed
    const clients = await self.clients.matchAll({
      type: 'window'
    });
    
    clients.forEach(client => {
      client.postMessage({ 
        type: 'QUEUE_PROCESSED' 
      });
    });
    
  } catch (error) {
    console.error('[Service Worker] Failed to process queue:', error);
  }
}

// Listen for online events
self.addEventListener('online', () => {
  console.log('[Service Worker] Back online, processing request queue');
  processQueue();
});

// Fetch event - handle requests
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle API requests
  if (isApiRequest(url)) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }
  
  // For non-API requests, use stale-while-revalidate strategy
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if available
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            // Update cache with fresh version
            if (networkResponse && networkResponse.status === 200) {
              const cache = caches.open(DYNAMIC_CACHE)
                .then(cache => {
                  cache.put(event.request, networkResponse.clone());
                  return networkResponse;
                });
              return cache;
            }
            return networkResponse;
          })
          .catch(error => {
            console.log('[Service Worker] Fetch failed:', error);
            // Return cached version if network fails
            return cachedResponse;
          });
          
        return cachedResponse || fetchPromise;
      })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  // Handle actions
  if (event.action === 'pause') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ action: 'pauseTimer' }));
      })
    );
  } else if (event.action === 'resume') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ action: 'resumeTimer' }));
      })
    );
  } else {
    // Focus or open a window on notification click
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  }
});

// Listen for push notifications
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || 'New notification',
    icon: '/static/icon-192x192.png',
    badge: '/static/icon-192x192.png',
    data: data.data || {}
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Pomonotes', options)
  );
});

// Listen for sync events (background sync)
self.addEventListener('sync', event => {
  console.log('[Service Worker] Sync event:', event.tag);
  
  if (event.tag === 'sync-queue') {
    event.waitUntil(processQueue());
  }
});

// Listen for message events from clients
self.addEventListener('message', event => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data.action === 'checkQueue') {
    event.waitUntil(
      checkQueueSize().then(size => {
        event.source.postMessage({
          type: 'QUEUE_SIZE',
          size: size
        });
      })
    );
  } else if (event.data.action === 'processQueue') {
    event.waitUntil(processQueue());
  }
});

// Helper function to check queue size
async function checkQueueSize() {
  try {
    const db = await openRequestQueue();
    const tx = db.transaction('requests', 'readonly');
    const store = tx.objectStore('requests');
    const countRequest = store.count();
    
    return new Promise((resolve, reject) => {
      countRequest.onsuccess = () => {
        const count = countRequest.result;
        tx.complete;
        db.close();
        resolve(count);
      };
      
      countRequest.onerror = event => {
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('[Service Worker] Failed to check queue size:', error);
    return 0;
  }
}