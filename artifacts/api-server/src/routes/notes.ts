import { Router } from "express";
import { db } from "@workspace/db";
import { notesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateNoteBody,
  UpdateNoteBody,
  ListNotesQueryParams,
  GetNoteParams,
  UpdateNoteParams,
  DeleteNoteParams,
} from "@workspace/api-zod";
import { ZodError } from "zod";

const router = Router();

// GET /api/notes - list notes with optional search and tag filter
router.get("/", async (req, res) => {
  try {
    const query = ListNotesQueryParams.parse(req.query);
    let notes = await db.select().from(notesTable);

    if (query.search) {
      const s = query.search.toLowerCase();
      notes = notes.filter(
        (n) =>
          (n.title && n.title.toLowerCase().includes(s)) ||
          n.content.toLowerCase().includes(s),
      );
    }

    if (query.tag) {
      notes = notes.filter((n) => n.tags && n.tags.includes(query.tag!));
    }

    notes.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );

    return res.json(
      notes.map((n) => ({
        ...n,
        scheduled_at: n.scheduled_at ? n.scheduled_at.toISOString() : null,
        gcal_event_id: n.gcal_event_id ?? null,
        created_at: n.created_at.toISOString(),
        updated_at: n.updated_at.toISOString(),
      })),
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Invalid request parameters", details: err.issues });
    }
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/notes/tags/all - get all unique tags
router.get("/tags/all", async (req, res) => {
  try {
    const notes = await db.select({ tags: notesTable.tags }).from(notesTable);
    const tagSet = new Set<string>();
    notes.forEach((n) => {
      if (n.tags) n.tags.forEach((t) => tagSet.add(t));
    });
    const tags = Array.from(tagSet)
      .sort()
      .map((name, index) => ({ id: index + 1, name }));
    return res.json(tags);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/notes/:id - get note by id
router.get("/:id", async (req, res) => {
  try {
    const { id } = GetNoteParams.parse({ id: Number(req.params.id) });
    const [note] = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.id, id));
    if (!note) return res.status(404).json({ error: "Nota no encontrada" });
    return res.json({
      ...note,
      scheduled_at: note.scheduled_at ? note.scheduled_at.toISOString() : null,
      created_at: note.created_at.toISOString(),
      updated_at: note.updated_at.toISOString(),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Invalid request parameters", details: err.issues });
    }
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/notes - create note
router.post("/", async (req, res) => {
  try {
    const body = CreateNoteBody.parse(req.body);
    if (!body.content) {
      return res.status(400).json({ error: "El contenido es requerido" });
    }
    const [note] = await db
      .insert(notesTable)
      .values({
        title: body.title ?? null,
        content: body.content,
        tags: body.tags ?? [],
        scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : null,
      })
      .returning();
    return res.status(201).json({
      ...note,
      scheduled_at: note.scheduled_at ? note.scheduled_at.toISOString() : null,
      created_at: note.created_at.toISOString(),
      updated_at: note.updated_at.toISOString(),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Invalid request body", details: err.issues });
    }
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/notes/:id - update note
router.put("/:id", async (req, res) => {
  try {
    const { id } = UpdateNoteParams.parse({ id: Number(req.params.id) });
    const body = UpdateNoteBody.parse(req.body);
    const [note] = await db
      .update(notesTable)
      .set({
        title: body.title ?? null,
        content: body.content,
        tags: body.tags ?? [],
        scheduled_at: body.scheduled_at !== undefined ? (body.scheduled_at ? new Date(body.scheduled_at) : null) : undefined,
        updated_at: new Date(),
      })
      .where(eq(notesTable.id, id))
      .returning();
    if (!note) return res.status(404).json({ error: "Nota no encontrada" });
    return res.json({
      ...note,
      scheduled_at: note.scheduled_at ? note.scheduled_at.toISOString() : null,
      created_at: note.created_at.toISOString(),
      updated_at: note.updated_at.toISOString(),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Invalid request body", details: err.issues });
    }
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/notes/:id - delete note
router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteNoteParams.parse({ id: Number(req.params.id) });
    const [deleted] = await db
      .delete(notesTable)
      .where(eq(notesTable.id, id))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Nota no encontrada" });
    return res.json({ message: "Nota eliminada correctamente" });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Invalid request parameters", details: err.issues });
    }
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
