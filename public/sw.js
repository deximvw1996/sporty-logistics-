// public/sw.js — RT1: push als de app dicht is.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.map(function (x) { return caches.delete(x); })); }).then(function () { return self.clients.claim(); })); }); // de oude cache mag weg
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data.json(); } catch (x) { d = { tekst: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.niveau === 'nu' ? 'Sporty: nu oplossen' : 'Sporty', { body: d.tekst || '', icon: '/public/icon-192.png', data: { link: d.link || '/meldingen' } }));
});
self.addEventListener('notificationclick', function (e) { e.notification.close(); e.waitUntil(clients.openWindow(e.notification.data.link)); });
