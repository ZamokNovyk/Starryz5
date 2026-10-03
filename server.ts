import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';

// Load .env if present
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        if (!process.env[key]) {
          process.env[key] = value.trim();
        }
      }
    });
  }
} catch (e) {
  console.warn('Could not load .env file:', e);
}

const B2_KEY_ID = process.env.B2_KEY_ID || '0056bac9fb621d40000000001';
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY || 'K00575GnrUfEa3rzdIEkV0NDBfhDcx0';
const B2_BUCKET_ID = process.env.B2_BUCKET_ID || 'a64b1a7cf94f0b26a2110d14';
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || 'starryz5';

// Cache B2 auth token in memory
let cachedAuth: {
  apiUrl: string;
  downloadUrl: string;
  token: string;
  expiresAt: number;
} | null = null;

async function getB2Auth() {
  if (cachedAuth && Date.now() < cachedAuth.expiresAt) {
    return cachedAuth;
  }

  const basicAuth = Buffer.from(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`).toString('base64');
  const res = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
    headers: { Authorization: `Basic ${basicAuth}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`B2 authorize failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const storage = data.apiInfo?.storageApi;
  if (!storage) {
    throw new Error('Invalid storageApi in B2 authorize response');
  }

  cachedAuth = {
    apiUrl: storage.apiUrl,
    downloadUrl: storage.downloadUrl,
    token: data.authorizationToken,
    // Cache for 12 hours (B2 tokens are valid for 24h)
    expiresAt: Date.now() + 12 * 60 * 60 * 1000,
  };

  return cachedAuth;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // JSON payload parser for base64 compressed images (limit 10MB)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // POST /api/upload-avatar - Subida de avatar a Backblaze B2
  app.post('/api/upload-avatar', async (req, res) => {
    try {
      const { imageBase64, contentType, userId, fileName: customFileName } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 es obligatorio' });
      }

      // Validate base64 data
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Check size limit: 100 KB max
      const sizeBytes = buffer.length;
      if (sizeBytes > 105 * 1024) { // allow a 5% tiny buffer margin, but reject if > 105KB
        return res.status(400).json({ 
          error: `La imagen excede el límite máximo de 100 KB. Tamaño recibido: ${(sizeBytes / 1024).toFixed(1)} KB` 
        });
      }

      const mime = contentType || 'image/webp';
      const ext = mime.includes('webp') ? 'webp' : 'jpg';
      const cleanUserId = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '');
      const timestamp = Date.now();
      const fileName = customFileName || `avatars/${cleanUserId}-${timestamp}.${ext}`;

      // 1. Authorize with B2
      const auth = await getB2Auth();

      // 2. Get upload URL for bucket
      const uploadUrlRes = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_url?bucketId=${B2_BUCKET_ID}`, {
        headers: { Authorization: auth.token }
      });

      if (!uploadUrlRes.ok) {
        const errText = await uploadUrlRes.text();
        throw new Error(`Failed to get B2 upload URL: ${errText}`);
      }

      const uploadUrlData = await uploadUrlRes.json();

      // 3. Upload file to Backblaze B2
      const uploadRes = await fetch(uploadUrlData.uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': uploadUrlData.authorizationToken,
          'X-Bz-File-Name': encodeURIComponent(fileName),
          'Content-Type': mime,
          'Content-Length': buffer.length.toString(),
          'X-Bz-Content-Sha1': 'do_not_verify'
        },
        body: buffer
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`B2 file upload failed (${uploadRes.status}): ${errText}`);
      }

      const uploadResult = await uploadRes.json();

      // Public URL of the uploaded image
      const publicUrl = `${auth.downloadUrl}/file/${B2_BUCKET_NAME}/${fileName}`;

      return res.json({
        success: true,
        publicUrl,
        fileId: uploadResult.fileId,
        fileName,
        sizeBytes: buffer.length,
        sizeKb: Number((buffer.length / 1024).toFixed(2))
      });

    } catch (err: any) {
      console.error('Error en /api/upload-avatar:', err);
      return res.status(500).json({ 
        error: err.message || 'Error interno al subir avatar a Backblaze B2' 
      });
    }
  });

  // Mount Vite or static dist in production
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Starryz 5 Server corriendo en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Error fatal al iniciar servidor:', err);
  process.exit(1);
});
