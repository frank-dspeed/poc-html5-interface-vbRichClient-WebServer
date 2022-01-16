addEventListener("fetch", function(e) {
    e.respondWith((async function() {
       const cachedResponse = await caches.match(e.request);
       if (cachedResponse) {
          return cachedResponse;
       }
 
       const networkResponse = await fetch(e.request);
 
       const hosts = [
          'https://fonts.googleapis.com',
          'https://maxcdn.bootstrapcdn.com',
          'https://cdnjs.cloudflare.com',
       ];
 
       if (hosts.some((host) => e.request.url.startsWith(host))) {
          // This clone() happens before `return networkResponse` 
          const clonedResponse = networkResponse.clone();
 
          e.waitUntil((async function() {
             const cache = await caches.open(CACHE_NAME);
             // This will be called after `return networkResponse`
             // so make sure you already have the clone!
             await cache.put(e.request, clonedResponse);
          })());
       }
 
       return networkResponse;
    })());
 });