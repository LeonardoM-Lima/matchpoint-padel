self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'EvoPadel';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: data.icon || '/icons/pwa-192x192.png',
      badge: '/icons/pwa-192x192.png',
      tag: data.tag || 'evopadel',
      data: {
        url: data.url || data.data?.url || '/',
      },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const targetUrl = new URL(url, self.location.origin).href;

      for (const client of clients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }

      return self.clients.openWindow(url);
    }),
  );
});
