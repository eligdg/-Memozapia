import { Router } from "express";
import { googleFetch, GMAIL_BASE } from "../lib/google-auth";

const router = Router();

interface SendEmailBody {
  to: string;
  subject: string;
  body: string;
}

// ─── POST /api/gmail/send ─────────────────────────────────────────────────────
router.post("/send", async (req, res) => {
  try {
    const { to, subject, body } = req.body as SendEmailBody;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Se requieren: to, subject y body" });
    }

    const messageParts = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=UTF-8",
      "MIME-Version: 1.0",
      "",
      body,
    ];
    const raw = Buffer.from(messageParts.join("\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const resp = await googleFetch(
      `${GMAIL_BASE}/users/me/messages/send`,
      {
        method: "POST",
        body: JSON.stringify({ raw }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const data = (await resp.json()) as {
      id?: string;
      error?: { message: string };
    };
    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }
    return res.json({ success: true, messageId: data.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al enviar email";
    return res.status(500).json({ error: msg });
  }
});

export default router;
