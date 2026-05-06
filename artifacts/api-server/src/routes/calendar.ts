/**
 * Google Calendar sync routes — uses @replit/connectors-sdk (google-calendar connector)
 * Proxy pattern: connectors.proxy("google-calendar", "/path") handles OAuth2 automatically.
 */
import { Router } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { db } from "@workspace/db";
import { notesTable } from "@workspace/db";
import { eq, isNotNull } from "drizzle-orm";

const router = Router();

function getConnectors() {
  return new ReplitConnectors();
}

// ─── GET /api/calendar/events ─────────────────────────────────────────────────
// Fetch upcoming events from the user's primary Google Calendar
router.get("/events", async (req, res) => {
  try {
    const connectors = getConnectors();
    const now = new Date().toISOString();
    const maxTime = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days ahead
    const resp = await connectors.proxy(
      "google-calendar",
      `/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(maxTime)}&singleEvents=true&orderBy=startTime&maxResults=50`,
      { method: "GET" }
    );
    const data = await resp.json() as { items?: unknown[]; error?: { message: string } };
    if (data.error) return res.status(500).json({ error: data.error.message });
    return res.json({ events: data.items ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener eventos";
    return res.status(500).json({ error: msg });
  }
});

// ─── POST /api/calendar/sync ──────────────────────────────────────────────────
// Push all notes with scheduled_at to Google Calendar (create or update)
router.post("/sync", async (req, res) => {
  try {
    const connectors = getConnectors();
    const notes = await db.select().from(notesTable).where(isNotNull(notesTable.scheduled_at));

    const results: { noteId: number; eventId: string; action: string }[] = [];

    for (const note of notes) {
      const startIso = note.scheduled_at!.toISOString();
      const endIso = new Date(note.scheduled_at!.getTime() + 60 * 60 * 1000).toISOString(); // +1h
      const summary = note.title || note.content.slice(0, 60);
      const description = note.content + (note.tags.length ? `\n\nEtiquetas: ${note.tags.join(", ")}` : "");

      const body = JSON.stringify({
        summary,
        description,
        start: { dateTime: startIso, timeZone: "Europe/Madrid" },
        end: { dateTime: endIso, timeZone: "Europe/Madrid" },
        source: { title: "Memozapia", url: "https://memozapia.replit.app" },
      });

      let eventId = note.gcal_event_id;
      let action = "created";

      if (eventId) {
        // Update existing event
        try {
          const patchResp = await connectors.proxy(
            "google-calendar",
            `/calendars/primary/events/${eventId}`,
            { method: "PATCH", body, headers: { "Content-Type": "application/json" } }
          );
          const patchData = await patchResp.json() as { id?: string; error?: { message: string } };
          if (patchData.error) {
            // Event may have been deleted in GCal — create a new one
            eventId = null;
          } else {
            action = "updated";
          }
        } catch {
          eventId = null;
        }
      }

      if (!eventId) {
        // Create new event
        const createResp = await connectors.proxy(
          "google-calendar",
          `/calendars/primary/events`,
          { method: "POST", body, headers: { "Content-Type": "application/json" } }
        );
        const createData = await createResp.json() as { id?: string; error?: { message: string } };
        if (createData.error) continue;
        eventId = createData.id ?? null;
        if (!eventId) continue;

        // Persist gcal_event_id to DB
        await db.update(notesTable).set({ gcal_event_id: eventId }).where(eq(notesTable.id, note.id));
      }

      results.push({ noteId: note.id, eventId: eventId!, action });
    }

    return res.json({ synced: results.length, results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al sincronizar";
    return res.status(500).json({ error: msg });
  }
});

// ─── DELETE /api/calendar/event/:eventId ─────────────────────────────────────
// Remove an event from Google Calendar and clear its reference in the note
router.delete("/event/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const connectors = getConnectors();
    await connectors.proxy("google-calendar", `/calendars/primary/events/${eventId}`, { method: "DELETE" });
    // Clear gcal_event_id in DB
    await db.update(notesTable).set({ gcal_event_id: null }).where(eq(notesTable.gcal_event_id, eventId));
    return res.json({ message: "Evento eliminado" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al eliminar evento";
    return res.status(500).json({ error: msg });
  }
});

export default router;
