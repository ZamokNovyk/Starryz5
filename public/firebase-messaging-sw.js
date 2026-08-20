importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAPTCYvXj0t_tT8pFL3T0au4lnGWFjvBAQ",
  authDomain: "starryz5-usuarios.firebaseapp.com",
  projectId: "starryz5-usuarios",
  storageBucket: "starryz5-usuarios.firebasestorage.app",
  messagingSenderId: "1048861626265",
  appId: "1:1048861626265:web:406d52cf245be964368d08"
});

const messaging = firebase.messaging();

// Manejo de mensajes en segundo plano (cuando la pestaña está en background o cerrada)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje recibido en background:', payload);

  const title = payload.notification?.title || payload.data?.title || 'Starryz 5';
  const body = payload.notification?.body || payload.data?.body || 'Tienes una nueva interacción';
  const targetUrl = payload.data?.url || payload.data?.link_url || payload.fcmOptions?.link || '/';

  const options = {
    body: body,
    icon: '/icon-192.png',
    badge: '/Logo/favicon.jpg',
    vibrate: [200, 100, 200],
    tag: payload.data?.confession_id ? `confession-${payload.data.confession_id}` : 'starryz-push',
    data: {
      url: targetUrl,
      ...payload.data
    },
    actions: [
      {
        action: 'open_url',
        title: 'Ver Confesión'
      }
    ]
  };

  return self.registration.showNotification(title, options);
});

// Listener para clics sobre la notificación del sistema
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || event.notification.data?.link_url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana abierta de la app, enfocarla y navegar
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Si la ventana no está abierta, abrirla
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
