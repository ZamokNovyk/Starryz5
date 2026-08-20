import { useEffect, useState, useCallback, useRef } from 'react';
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
  const isInitializingRef = useRef(false);

  // Función para guardar token en Supabase con logs detallados
  const saveTokenToSupabase = useCallback(async (fcmToken: string, userUid: string) => {
    if (!fcmToken || !userUid) return;

    try {
      console.log(`[FCM] Guardando token en Supabase para el usuario: ${userUid}...`);
      
      const { data, error } = await supabase
        .from('user_fcm_tokens')
        .upsert({
          user_uid: userUid,
          fcm_token: fcmToken,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_uid'
        })
        .select();

      if (error) {
        console.error('[FCM] Error al registrar token en tabla user_fcm_tokens:', error.message, error.details);
      } else {
        console.log(`%c[FCM] Token FCM registrado con éxito: ${fcmToken}`, 'color: #22c55e; font-weight: bold; font-size: 13px;');
        console.log('[FCM] Datos guardados en Supabase:', data);
      }
    } catch (err) {
      console.error('[FCM] Excepción al guardar token FCM en Supabase:', err);
    }
  }, []);

  // Función para registrar Service Worker y obtener Token de FCM
  const initializeFCM = useCallback(async (currentUserId?: string) => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('[FCM] Las notificaciones o Service Workers no están soportados en este navegador/dispositivo.');
      setPermission('unsupported');
      return null;
    }

    try {
      const supported = await isSupported();
      if (!supported) {
        console.warn('[FCM] Firebase Messaging no está soportado en este entorno.');
        return null;
      }

      // 1. Verificar o solicitar permisos
      let currentPermission = Notification.permission;
      console.log(`[FCM] Estado actual de permisos de notificación: "${currentPermission}"`);
      setPermission(currentPermission);

      if (currentPermission === 'default') {
        try {
          console.log('[FCM] Solicitando permisos de notificación al usuario...');
          currentPermission = await Notification.requestPermission();
          setPermission(currentPermission);
          console.log(`[FCM] Respuesta del usuario a la solicitud de permisos: "${currentPermission}"`);
        } catch (permErr) {
          console.warn('[FCM] Error al solicitar permisos de notificación:', permErr);
        }
      }

      if (currentPermission !== 'granted') {
        console.warn(`[FCM] No se pueden generar tokens porque los permisos están en estado: "${currentPermission}"`);
        return null;
      }

      // 2. Registrar el Service Worker explícitamente y esperar a que esté listo
      console.log('[FCM] Registrando Service Worker /firebase-messaging-sw.js...');
      let swRegistration: ServiceWorkerRegistration;
      try {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        });
        await navigator.serviceWorker.ready;
        console.log('[FCM] Service Worker activo y listo con scope:', swRegistration.scope);
      } catch (swErr) {
        console.error('[FCM] Error crítico al registrar el Service Worker:', swErr);
        return null;
      }

      // 3. Obtener el Token FCM
      const messaging = getMessaging(app);
      const vapidKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_VAPID_KEY) 
        ? import.meta.env.VITE_FIREBASE_VAPID_KEY 
        : DEFAULT_VAPID_KEY;

      console.log('[FCM] Solicitando token a Firebase Cloud Messaging con VAPID Key...');
      const currentToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: swRegistration
      });

      if (currentToken) {
        setToken(currentToken);
        console.log(`%c[FCM] Token obtenido de Firebase: ${currentToken}`, 'color: #3b82f6; font-weight: bold;');

        // Si tenemos el UID del usuario, guardarlo inmediatamente en Supabase
        const targetUid = currentUserId || user?.uid;
        if (targetUid) {
          await saveTokenToSupabase(currentToken, targetUid);
        } else {
          console.log('[FCM] Token guardado en memoria local. Esperando autenticación para asociar a user_uid...');
        }

        return currentToken;
      } else {
        console.warn('[FCM] No se pudo generar token de registro. Permisos o configuración VAPID requeridos.');
      }
    } catch (err: any) {
      console.error('[FCM] Error durante la inicialización de Firebase Messaging:', err);
    }
    return null;
  }, [user?.uid, saveTokenToSupabase]);

  // Función pública para solicitar permisos manualmente
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        await initializeFCM();
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[FCM] Error al solicitar permiso manual de notificación:', e);
      return false;
    }
  }, [initializeFCM]);

  // Efecto principal de inicialización al cargar o al cambiar de usuario
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;
    let unsubscribeMessage: (() => void) | undefined;

    const runSetup = async () => {
      if (isInitializingRef.current) return;
      isInitializingRef.current = true;

      try {
        await initializeFCM(user?.uid);

        // Configurar listener para mensajes en primer plano (Foreground)
        try {
          const supported = await isSupported();
          if (supported) {
            const messaging = getMessaging(app);
            unsubscribeMessage = onMessage(messaging, (payload) => {
              console.log('[FCM] Mensaje recibido en primer plano (Foreground):', payload);

              const title = payload.notification?.title || payload.data?.title || 'Starryz 5';
              const body = payload.notification?.body || payload.data?.body || 'Tienes una nueva interacción';
              const linkUrl = payload.data?.link_url || payload.data?.url || payload.fcmOptions?.link;

              // Reproducir sonido
              try {
                const audio = new Audio('/sonidos/noti.mp3');
                audio.play().catch(e => console.log('[FCM Audio] Reproducción bloqueada:', e));
              } catch (audioErr) {
                console.error('[FCM] Error reproduciendo sonido:', audioErr);
              }

              // Mostrar Toast
              if (isMounted) {
                setToastNotification({
                  title,
                  body,
                  linkUrl
                });

                setTimeout(() => {
                  if (isMounted) setToastNotification(null);
                }, 7000);
              }
            });
          }
        } catch (msgErr) {
          console.warn('[FCM] Error configurando onMessage listener:', msgErr);
        }
      } finally {
        isInitializingRef.current = false;
      }
    };

    runSetup();

    return () => {
      isMounted = false;
      if (unsubscribeMessage) {
        unsubscribeMessage();
      }
    };
  }, [user?.uid, initializeFCM]);

  // Efecto secundario: Garantizar sincronización en Supabase si el token ya existe y el usuario inicia sesión
  useEffect(() => {
    if (user?.uid && token) {
      saveTokenToSupabase(token, user.uid);
    }
  }, [user?.uid, token, saveTokenToSupabase]);

  const closeToast = useCallback(() => {
    setToastNotification(null);
  }, []);

  return {
    token,
    permission,
    toastNotification,
    closeToast,
    requestPermission,
    initializeFCM
  };
}
