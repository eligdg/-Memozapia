import { Router } from "express";
import { db } from "@workspace/db";
import { notesTable } from "@workspace/db";
import { eq, isNotNull } from "drizzle-orm";
import { googleFetch, CALENDAR_BASE } from "../lib/google-auth";

const router = Router();

const FRONTEND_URL =
  process.env["FRONTEND_URL"] ?? "https://memozapia.vercel.app";

// ─── GET /api/calendar/events ─────────────────────────────────────────────────
router.get("/events", async (_req, res) => {
  try {
    const now = new Date().toISOString();
    const maxTime = new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1000
    ).toISOString();
    const resp = await googleFetch(
      `${CALENDAR_BASE}/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(maxTime)}&singleEvents=true&orderBy=startTime&maxResults=50`
    );
    const data = (await resp.json()) as {
      items?: unknown[];
      error?: { message: string };
    };
    if (data.error) return res.status(500).json({ error: data.error.message });
    return res.json({ events: data.items ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener eventos";
    if (msg.includes("autorizado")) {
      return res.status(401).json({
        error: msg,
        authUrl: `${FRONTEND_URL}/api/auth/google`,
      });
    }
    return res.status(500).json({ error: msg });
  }
});

// ─── POST /api/calendar/sync ──────────────────────────────────────────────────
router.post("/sync", async (_req, res) => {
  try {
    const notes = await db
      .select()
      .from(notesTable)
      .where(isNotNull(notesTable.scheduled_at));

    const results: { noteId: number; eventId: string; action: string }[] = [];

    for (const note of notes) {
      const startIso = note.scheduled_at!.toISOString();
      const endIso = new Date(
        note.scheduled_at!.getTime() + 60 * 60 * 1000
      ).toISOString();
      const summary = note.title || note.content.slice(0, 60);
      const description =
        note.content +
        (note.tags.length ? `\n\nEtiquetas: ${note.tags.join(", ")}` : "");

      const body = JSON.stringify({
        summary,
        description,
        start: { dateTime: startIso, timeZone: "Europe/Madrid" },
        end: { dateTime: endIso, timeZone: "Europe/Madrid" },
        source: { title: "Memozapia", url: FRONTEND_URL },
      });

      let eventId = note.gcal_event_id;
      let action = "created";

      if (eventId) {
        try {
          const patchResp = await googleFetch(
            `${CALENDAR_BASE}/calendars/primary/events/${eventId}`,
            { method: "PATCH", body, headers: { "Content-Type": "application/json" } }
          );
          const patchData = (await patchResp.json()) as {
            id?: string;
            error?: { message: string };
          };
          if (patchData.error) {
            eventId = null;
          } else {
            action = "updated";
          }
        } catch {
          eventId = null;
        }
      }

      if (!eventId) {
        const createResp = await googleFetch(
          `${CALENDAR_BASE}/calendars/primary/events`,
          { method: "POST", body, headers: { "Content-Type": "application/json" } }
        );
        const createData = (await createResp.json()) as {
          id?: string;
          error?: { message: string };
        };
        if (createData.error) continue;
        eventId = createData.id ?? null;
        if (!eventId) continue;
        await db
          .update(notesTable)
          .set({ gcal_event_id: eventId })
          .where(eq(notesTable.id, note.id));
      }

      results.push({ noteId: note.id, eventId: eventId!, action });
    }

    return res.json({ synced: results.length, results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al sincronizar";
    if (msg.includes("autorizado")) {
      return res.status(401).json({
        error: msg,
        authUrl: `${FRONTEND_URL}/api/auth/google`,
      });
    }
    return res.status(500).json({ error: msg });
  }
});

// ─── DELETE /api/calendar/event/:eventId ─────────────────────────────────────
router.delete("/event/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    await googleFetch(
      `${CALENDAR_BASE}/calendars/primary/events/${eventId}`,
      { method: "DELETE" }
    );
    await db
      .update(notesTable)
      .set({ gcal_event_id: null })
      .where(eq(notesTable.gcal_event_id, eventId));
    return res.json({ message: "Evento eliminado" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al eliminar evento";
    return res.status(500).json({ error: msg });
  }
});

export default router;
