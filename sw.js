// A deliberately minimal service worker. Some browsers only offer a real "Install app" (no browser bar) when one exists.
// It caches nothing and answers nothing itself: every request goes straight to the network, so updates are never held back.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
