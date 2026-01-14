// Service Worker for DzBigbuy PWA

// Listen for install event
self.addEventListener('install', event => {
  console.log('Service Worker: Installed');
  self.skipWaiting(); // Activate worker immediately
});

// Listen for activate event
self.addEventListener('activate', event => {
  console.log('Service Worker: Activated');
  event.waitUntil(clients.claim()); // Become available to all pages
});

// Listen for push notifications
self.addEventListener('push', event => {
  if (!event.data) {
    console.error('Push event but no data');
    return;
  }
  const data = event.data.json();
  console.log('Service Worker: Push Received.', data);

  const title = data.title || 'DzBigbuy';
  const options = {
    body: data.body || 'لديك رسالة جديدة!',
    icon: '/images/icon-192.png', // Main icon
    badge: '/images/icon-192.png', // Icon for notification bar on Android
    vibrate: [200, 100, 200], // Vibration pattern
    data: {
      url: data.url || '/' // URL to open on click
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Listen for notification click
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked');
  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data.url || '/';

  // Open the app window or focus if already open
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus().then(c => c.navigate(urlToOpen));
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

    