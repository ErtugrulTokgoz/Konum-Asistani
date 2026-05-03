const CACHE_NAME = 'konum-asistani-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './main.js',
  './style.css',
  './icon.ico',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Yalnızca GET isteklerini önbelleğe al
  if (event.request.method !== 'GET') return;
  
  // Harici API isteklerini önbelleğe alma
  if (event.request.url.includes('overpass-api') || 
      event.request.url.includes('nominatim.openstreetmap') || 
      event.request.url.includes('geo.json')) {
      return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Önbellekte varsa döndür
        if (response) {
          return response;
        }
        
        // Önbellekte yoksa ağdan al ve önbelleğe kaydet
        return fetch(event.request).then(
          (response) => {
            // Geçersiz yanıtları önbelleğe alma
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            let responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          }
        ).catch(() => {
          // Çevrimdışı durumunda yapılabilecekler (örneğin offline page)
          console.log("Ağ isteği başarısız ve önbellekte yok.");
        });
      })
  );
});
