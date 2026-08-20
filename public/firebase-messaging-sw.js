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

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Starryz5';
  const options = {
    body: payload.notification?.body || 'Tienes una nueva actualización',
    icon: '/icon-192.png',
    data: payload.data
  };
  self.registration.showNotification(title, options);
});
