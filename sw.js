'use strict';
self.addEventListener('push', event => {
  const message = event.data?.json() || {};
  event.waitUntil(self.registration.showNotification(message.title || 'CourtPilot', {
    body: message.body || 'Controlla i promemoria luci.',
    tag: message.id || 'courtpilot', data: { url: './#notifications' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('./#notifications', self.registration.scope).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url.startsWith(self.registration.scope));
    if (existing) { await existing.navigate(url); return existing.focus(); }
    return self.clients.openWindow(url);
  })());
});

