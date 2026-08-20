import { useEffect, useState, useCallback } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from '@/src/lib/firebase';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';

const DEFAULT_VAPID_KEY = "BB6-Vfe1DmpPKhZU_CDp2tyFvM2q8i_eXbzEWgZhF2uC3fV2zKaRcGlhy1u_AaLPRiyOsK-tnLQ0Zj_GDG82P9c";

export interface FCMToastData {
  title: string;
  body: string;
  linkUrl?: string;
}

export function useFCMNotifications() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [toastNotification, setToastNotification] = useState<FCMToastData | null>(null);

  // Función para solicitar permisos de manera explícita
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (e) {
      console.warn('Error al solicitar permiso de notificación:', e);
      return false;
    }
  }, []);

  useEffect(() => {
    // Solo ejecutar en el cliente y si el navegador soporta notificaciones y service workers
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission);

    let isMounted = true;
    let unsubscribeMessage: (() => void) | undefined;

    const setupFCM = async () => {
      try {
        const supported = await isSupported();
        if (!supported) {
          console.warn('[FCM] FCM no está soportado en este entorno o iFrame.');
          return;
        }

        // Si el permiso no está otorgado, intentar solicitarlo
        let currentPermission = Notification.permission;
        if (currentPermission === 'default') {
          try {
            currentPermission = await Notification.requestPermission();
            if (isMounted) setPermission(currentPermission);
          } catch (permErr) {
            console.warn('[FCM] No se pudo solicitar permiso:', permErr);
          }
        }

        if (currentPermission !== 'granted') {
          console.log('[FCM] Notificaciones push no otorgadas:', currentPermission);
          return;
        }

        // Registrar explícitamente el Service Worker de FCM
        let swRegistration: ServiceWorkerRegistration | undefined;
        try {
          swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('[FCM] Service worker registrado con éxito:', swRegistration.scope);
        } catch (swErr) {
          console.warn('[FCM] Error al registrar service worker:', swErr);
        }

        const messaging = getMessaging(app);
        const vapidKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_VAPID_KEY) 
          ? import.meta.env.VITE_FIREBASE_VAPID_KEY 
          : DEFAULT_VAPID_KEY;

        // Obtener Token de FCM
        const currentToken = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: swRegistration
        });

        if (currentToken && isMounted) {
          setToken(currentToken);
          console.log('[FCM] Token obtenido correctamente:', currentToken.substring(0, 15) + '...');

          // Guardar o actualizar en la tabla 'user_fcm_tokens' de Supabase
          if (user?.uid) {
            const { error } = await supabase
              .from('user_fcm_tokens')
              .upsert({
                user_uid: user.uid,
                fcm_token: currentToken,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'user_uid'
              });

            if (error) {
              console.error('[FCM] Error al guardar token en Supabase:', error.message);
            } else {
              console.log('[FCM] Token de usuario sincronizado en Supabase con éxito.');
            }
          }
        }

        // Escuchar notificaciones en primer plano
        unsubscribeMessage = onMessage(messaging, (payload) => {
          console.log('[FCM] Mensaje recibido en primer plano:', payload);

          const title = payload.notification?.title || payload.data?.title || 'Starryz 5';
          const body = payload.notification?.body || payload.data?.body || 'Tienes una nueva interacción';
          const linkUrl = payload.data?.link_url || payload.data?.url || payload.fcmOptions?.link;

          // Reproducir sonido
          try {
            const audio = new Audio('/sonidos/noti.mp3');
            audio.play().catch(e => console.log('Audio playback info:', e));
          } catch (audioErr) {
            console.error('Error al reproducir audio FCM:', audioErr);
          }

          // Mostrar Toast en pantalla
          if (isMounted) {
            setToastNotification({
              title,
              body,
              linkUrl
            });

            setTimeout(() => {
              if (isMounted) setToastNotification(null);
            }, 6000);
          }

          // Notificación del sistema si está permitido
          try {
            new Notification(title, {
              body,
              icon: '/icon-192.png'
            });
          } catch (nativeErr) {
            console.warn('[FCM] No se pudo lanzar la notificación nativa en primer plano:', nativeErr);
          }
        });

      } catch (err) {
        console.error('[FCM] Error durante la inicialización de FCM:', err);
      }
    };

    setupFCM();

    return () => {
      isMounted = false;
      if (unsubscribeMessage) {
        unsubscribeMessage();
      }
    };
  }, [user?.uid]);

  const closeToast = useCallback(() => {
    setToastNotification(null);
  }, []);

  return {
    token,
    permission,
    toastNotification,
    closeToast,
    requestPermission
  };
}
