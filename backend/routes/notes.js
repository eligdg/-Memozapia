const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/notes - Listar notas con búsqueda y filtro por etiqueta
router.get('/', (req, res) => {
  try {
    const { search, tag } = req.query;
    const notes = db.getNotes({ search, tag });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notes/:id - Obtener una nota
router.get('/:id', (req, res) => {
  try {
    const note = db.getNoteById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notes - Crear nota
router.post('/', (req, res) => {
  try {
    const { title, content, tags } = req.body;
    if (!content) return res.status(400).json({ error: 'El contenido es requerido' });

    const newNote = db.createNote({ title, content, tags: tags || [] });
    res.status(201).json(newNote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/notes/:id - Actualizar nota
router.put('/:id', (req, res) => {
  try {
    const { title, content, tags } = req.body;
    const updatedNote = db.updateNote(req.params.id, { title, content, tags });
    if (!updatedNote) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json(updatedNote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notes/:id - Eliminar nota
router.delete('/:id', (req, res) => {
  try {
    const deleted = db.deleteNote(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json({ message: 'Nota eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tags/all - Obtener todas las etiquetas
router.get('/tags/all', (req, res) => {
  try {
    const tags = db.getAllTags();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
