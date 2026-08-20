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
 * Invoca la Supabase Edge Function 'send-push' de forma segura desde el backend/Edge runtime.
 * Esta función consulta el token FCM del usuario en Supabase y despacha la notificación Push Web (FCM v1).
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
  const { recipientUid, title, body, linkUrl, confessionId, commentId } = payload;

  if (!recipientUid) {
    console.warn('[FCM Push] Intento de envío sin recipientUid');
    return false;
  }

  try {
    const cleanTitle = title.replace(/[\[\]]/g, '').trim();
    const targetLink = linkUrl || (confessionId ? `/?show_confession=${confessionId}` : '/');

    console.log(`[FCM Push] Invocando Edge Function 'send-push' para destinatario: ${recipientUid}`);

    // Invocación a la Supabase Edge Function 'send-push'
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: {
        recipientUid,
        title: cleanTitle || 'Starryz 5',
        body,
        linkUrl: targetLink,
        confessionId: confessionId || '',
        commentId: commentId || '',
      }
    });

    if (error) {
      console.warn('[FCM Push] Aviso al invocar Edge Function send-push:', error.message);
      return false;
    }

    console.log('[FCM Push] Respuesta exitosa de Edge Function send-push:', data);
    return true;
  } catch (err) {
    console.error('[FCM Push] Excepción al despachar push notification:', err);
    return false;
  }
}
