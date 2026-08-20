import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceAccount {
  project_id?: string;
  private_key?: string;
  client_email?: string;
}

// Genera un token OAuth2 de Google a partir de la Service Account de Firebase
async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const { client_email, private_key } = serviceAccount;
  if (!client_email || !private_key) {
    throw new Error("Credenciales de Service Account incompletas (falta client_email o private_key)");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodeBase64Url = (str: string) => {
    return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  };

  const strHeader = encodeBase64Url(JSON.stringify(header));
  const strClaimSet = encodeBase64Url(JSON.stringify(claimSet));
  const unsignedToken = `${strHeader}.${strClaimSet}`;

  // Formatear llave privada PEM para WebCrypto
  const pem = private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");

  const binaryDer = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureBase64Url = encodeBase64Url(
    String.fromCharCode.apply(null, signatureArray)
  );

  const signedJwt = `${unsignedToken}.${signatureBase64Url}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error("[FCM OAuth Error]:", tokenData);
    throw new Error(`Error obteniendo Google OAuth2 Token: ${tokenData.error_description || tokenData.error || tokenRes.statusText}`);
  }

  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json().catch(() => ({}));
    console.log("[send-push] Petición recibida en Edge Function:", JSON.stringify(rawBody));

    // Soporte para Database Webhook (record) o llamada directa API
    const record = rawBody.record || rawBody;
    const recipientUid = record.user_uid || record.recipientUid;
    let title = record.title || "Starryz 5";
    let body = record.body || "Tienes una nueva interacción";
    const linkUrl = record.link_url || record.linkUrl || "/";
    const confessionId = record.confession_id || record.confessionId || "";
    const commentId = record.comment_id || record.commentId || "";

    if (!recipientUid) {
      return new Response(
        JSON.stringify({ error: "Falta el user_uid del destinatario" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inicializar cliente Supabase con Service Role Key para acceso a base de datos
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Obtener el token FCM del usuario desde user_fcm_tokens
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("user_fcm_tokens")
      .select("fcm_token")
      .eq("user_uid", recipientUid)
      .maybeSingle();

    if (tokenError) {
      console.error("[send-push] Error al consultar token FCM en Supabase:", tokenError);
      return new Response(
        JSON.stringify({ error: tokenError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokenRecord || !tokenRecord.fcm_token) {
      console.log(`[send-push] El usuario ${recipientUid} no tiene token FCM registrado en user_fcm_tokens.`);
      return new Response(
        JSON.stringify({ message: "Usuario sin token FCM registrado", sent: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fcmToken = tokenRecord.fcm_token;
    console.log(`[send-push] Destinatario ${recipientUid} tiene token: ${fcmToken.substring(0, 15)}...`);

    // Limpiar formato del título si viene con corchetes
    title = title.replace(/[\[\]]/g, "").trim();

    // 2. Obtener credenciales de Firebase Service Account desde variables de entorno
    let serviceAccount: ServiceAccount | null = null;
    const serviceAccountEnv = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (serviceAccountEnv) {
      try {
        serviceAccount = JSON.parse(serviceAccountEnv);
      } catch {
        // Intento decodificar base64 si no es JSON directo
        try {
          serviceAccount = JSON.parse(atob(serviceAccountEnv));
        } catch (e) {
          console.error("[send-push] Error parseando FIREBASE_SERVICE_ACCOUNT:", e);
        }
      }
    }

    // Variables individuales de fallback
    if (!serviceAccount) {
      const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
      const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");
      const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || "starryz5-usuarios";
      if (clientEmail && privateKey) {
        serviceAccount = {
          client_email: clientEmail,
          private_key: privateKey,
          project_id: projectId,
        };
      }
    }

    if (!serviceAccount || !serviceAccount.client_email || !serviceAccount.private_key) {
      console.warn("[send-push] AVISO: No se encontraron credenciales de Service Account configuradas en Supabase Edge Functions (FIREBASE_SERVICE_ACCOUNT).");
      return new Response(
        JSON.stringify({
          error: "Falta configurar FIREBASE_SERVICE_ACCOUNT en los secrets de Supabase Edge Functions",
          hint: "Ejecuta: supabase secrets set FIREBASE_SERVICE_ACCOUNT='{...serviceAccount.json}'",
          tokenFound: true,
          fcmTokenPreview: fcmToken.substring(0, 15)
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const projectId = serviceAccount.project_id || "starryz5-usuarios";

    // 3. Generar Access Token OAuth2
    console.log("[send-push] Generando OAuth2 Access Token para Google FCM v1...");
    const accessToken = await getAccessToken(serviceAccount);

    // 4. Construir payload FCM HTTP v1
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const fcmMessage = {
      message: {
        token: fcmToken,
        notification: {
          title: title,
          body: body,
        },
        webpush: {
          notification: {
            icon: "/Logo/logo.jpg",
            badge: "/Logo/favicon.jpg",
            tag: confessionId ? `confession-${confessionId}` : "starryz-push",
          },
          fcm_options: {
            link: linkUrl,
          },
        },
        data: {
          title: title,
          body: body,
          link_url: linkUrl,
          url: linkUrl,
          confession_id: confessionId,
          comment_id: commentId,
        },
      },
    };

    console.log("[send-push] Enviando mensaje a FCM v1 API:", JSON.stringify(fcmMessage));

    const fcmResponse = await fetch(fcmUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fcmMessage),
    });

    const fcmResult = await fcmResponse.json();

    if (!fcmResponse.ok) {
      console.error("[send-push] Error en respuesta de FCM API:", fcmResult);
      return new Response(
        JSON.stringify({ error: "FCM API Error", details: fcmResult }),
        { status: fcmResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-push] ¡Notificación enviada exitosamente a FCM! Respuesta:", fcmResult);

    return new Response(
      JSON.stringify({ success: true, messageId: fcmResult.name, recipientUid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[send-push] Excepción capturada en Edge Function:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Error interno del servidor", stack: err.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
