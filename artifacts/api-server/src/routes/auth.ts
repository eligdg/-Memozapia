import { Router } from "express";
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  isGoogleAuthorized,
} from "../lib/google-auth";

const router = Router();

// ─── GET /api/auth/google ─────────────────────────────────────────────────────
// Inicia el flujo OAuth2 de Google redirigiendo al consent screen
router.get("/google", (_req, res) => {
  const url = getAuthorizationUrl();
  res.redirect(url);
});

// ─── GET /api/auth/status ─────────────────────────────────────────────────────
router.get("/status", async (_req, res) => {
  const authorized = await isGoogleAuthorized();
  res.json({ google: authorized });
});

// ─── GET /google-callback ─────────────────────────────────────────────────────
// Manejador del callback OAuth2 (viene de Vercel rewrite: /_/backend/google-callback)
// y también de /oauth2callback para desarrollo local
async function handleCallback(
  req: import("express").Request,
  res: import("express").Response
) {
  const { code, error } = req.query as { code?: string; error?: string };

  if (error || !code) {
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:3rem">
        <h2>❌ Error de autorización</h2>
        <p>${error ?? "No se recibió el código de autorización."}</p>
        <a href="javascript:window.close()">Cerrar</a>
      </body></html>
    `);
  }

  try {
    await exchangeCodeForTokens(code);
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:3rem;background:#f0fdf4">
        <h2 style="color:#16a34a">✅ Google autorizado correctamente</h2>
        <p>Ya puedes sincronizar el calendario y enviar emails desde Memozapia.</p>
        <p style="color:#64748b;font-size:0.9rem">Puedes cerrar esta ventana.</p>
        <script>setTimeout(()=>window.close(),2000)</script>
      </body></html>
    `);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return res.status(500).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:3rem">
        <h2>❌ Error al obtener tokens</h2>
        <p>${msg}</p>
      </body></html>
    `);
  }
}

router.get("/google-callback", handleCallback);
router.get("/oauth2callback", handleCallback);

export default router;
