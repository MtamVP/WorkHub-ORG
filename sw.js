const CACHE_NAME = 'workhub-cache-v1.4.2';

// 1. Cài đặt và kích hoạt ngay lập tức
self.addEventListener('install', event => {
    self.skipWaiting();
    console.log('[PWA] Service Worker đã cài đặt');
});

// 2. Dọn rác khi có bản cập nhật
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME) {
                    console.log('[PWA] Xóa cache cũ:', key);
                    return caches.delete(key);
                }
            })
        ))
    );
    return self.clients.claim();
});

// 3. Xử lý tải dữ liệu (Phân luồng thông minh)
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // LUỒNG 1: Bỏ qua API của Google Apps Script (Tuyệt đối không lưu đệm)
    if (url.includes('script.google.com') || url.includes('script.googleusercontent.com')) {
        return;
    }

    // LUỒNG 2: Xử lý trang HTML (Network First - Ưu tiên mạng, rớt mạng mới dùng Cache)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // LUỒNG 3: Xử lý file tĩnh CSS, JS, Ảnh, Font (Cache First - Ưu tiên Cache cho siêu mượt)
    if (['style', 'script', 'image', 'font'].includes(event.request.destination)) {
        event.respondWith(
            caches.match(event.request).then(cachedRes => {
                if (cachedRes) return cachedRes;
                return fetch(event.request).then(networkRes => {
                    if (!networkRes || networkRes.status !== 200 || networkRes.type !== 'basic') {
                        return networkRes;
                    }
                    const responseClone = networkRes.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                    return networkRes;
                });
            })
        );
    }
});