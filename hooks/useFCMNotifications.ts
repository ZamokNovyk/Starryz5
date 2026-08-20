import { useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from '@/src/lib/firebase';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';

export function useFCMNotifications() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any>(null);
  const [toastNotification, setToastNotification] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    // Solo ejecutar en el cliente y si el navegador soporta notificaciones
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const initFCM = async () => {
      try {
        const supported = await isSupported();
        if (!supported) {
          console.warn('FCM no está soportado en este navegador o entorno de iframe.');
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('Permiso para notificaciones push denegado por el usuario.');
          return;
        }

        const messaging = getMessaging(app);
        
        // Obtener el token de FCM usando la VAPID Key pública
        const currentToken = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
        });

        if (currentToken) {
          setToken(currentToken);

          // Si el usuario está autenticado, registrar/actualizar el token en Supabase
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
              console.error('Error al guardar el token de FCM en Supabase:', error);
            } else {
              console.log('Token de FCM sincronizado con éxito en Supabase.');
            }
          }
        } else {
          console.warn('No se pudo generar un token de registro FCM.');
        }

        // Escuchar mensajes entrantes en primer plano (foreground)
        const unsubscribe = onMessage(messaging, (payload) => {
          console.log('Mensaje recibido en primer plano (foreground):', payload);
          setNotification(payload);
          
          if (payload.notification) {
            const { title, body } = payload.notification;
            
            // Establecer estado de notificación flotante (toast en-pantalla)
            setToastNotification({
              title: title || 'Starryz 5',
              body: body || 'Tienes una nueva actualización'
            });

            // Auto-ocultar el toast después de 6 segundos
            setTimeout(() => {
              setToastNotification(null);
            }, 6000);

            // Intentar mostrar notificación nativa
            try {
              new Notification(title || 'Starryz 5', {
                body: body || 'Tienes una nueva actualización',
                icon: '/Logo/logo.jpg'
              });
            } catch (err) {
              console.warn('No se pudo disparar la notificación nativa en primer plano (común en iFrames):', err);
            }
          }
        });

        return unsubscribe;
      } catch (err) {
        console.error('Error durante la inicialización de FCM:', err);
      }
    };

    let unsubscribeFn: (() => void) | undefined;
    
    initFCM().then(unsub => {
      if (unsub) {
        unsubscribeFn = unsub;
      }
    });

    return () => {
      if (unsubscribeFn) unsubscribeFn();
    };
  }, [user?.uid]);

  const closeToast = () => setToastNotification(null);

  return { token, notification, toastNotification, closeToast };
}
