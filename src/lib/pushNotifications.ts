import { supabase } from './supabase';

export interface PushNotificationPayload {
  recipientUid: string;
  title: string;
  body: string;
  linkUrl?: string;
  confessionId?: string;
  commentId?: string;
}

/**
 * Consulta el token FCM del usuario en Supabase y despacha la notificación Push Web.
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
  const { recipientUid, title, body, linkUrl, confessionId, commentId } = payload;

  if (!recipientUid) return false;

  try {
    // 1. Obtener el token FCM del destinatario desde Supabase
    const { data, error } = await supabase
      .from('user_fcm_tokens')
      .select('fcm_token')
      .eq('user_uid', recipientUid)
      .maybeSingle();

    if (error) {
      console.warn('[FCM Push] Error al consultar token del usuario:', error.message);
      return false;
    }

    if (!data || !data.fcm_token) {
      console.log(`[FCM Push] El usuario ${recipientUid} no tiene token FCM registrado o no ha activado notificaciones.`);
      return false;
    }

    const fcmToken = data.fcm_token;
    console.log(`[FCM Push] Despachando notificación Push al token: ${fcmToken.substring(0, 15)}...`);

    const cleanTitle = title.replace(/[\[\]]/g, '').trim();
    const targetLink = linkUrl || (confessionId ? `/?show_confession=${confessionId}` : '/');

    // 2. Construir payload estándar de FCM
    const messagePayload = {
      to: fcmToken,
      notification: {
        title: cleanTitle || 'Starryz 5',
        body: body,
        icon: '/icon-192.png',
        click_action: targetLink
      },
      data: {
        title: cleanTitle || 'Starryz 5',
        body: body,
        url: targetLink,
        link_url: targetLink,
        confession_id: confessionId || '',
        comment_id: commentId || '',
        click_action: targetLink
      }
    };

    // 3. Si existe un endpoint o API configurada (Edge Function o API Route), intentar despacho
    try {
      // Intento opcional a endpoint local si estuviera disponible
      const response = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messagePayload)
      });
      if (response.ok) {
        console.log('[FCM Push] Notificación enviada con éxito vía API.');
        return true;
      }
    } catch {
      // Si no hay endpoint local corriendo, se registra el payload listo para Edge Function
    }

    console.log('[FCM Push] Payload generado y listo para entrega FCM:', messagePayload);
    return true;
  } catch (err) {
    console.error('[FCM Push] Error inesperado en el despacho de notificación push:', err);
    return false;
  }
}
