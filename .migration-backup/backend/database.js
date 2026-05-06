const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'memozapia.json');

// Estructura inicial de la base de datos
const initialDB = {
  notes: [],
  tags: [],
  noteIdCounter: 1,
  tagIdCounter: 1
};

// Cargar o crear base de datos
function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error al cargar DB:', error);
  }
  return { ...initialDB };
}

// Guardar base de datos
function saveDB(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (error) {
    console.error('Error al guardar DB:', error);
  }
}

// Obtener todas las notas
function getNotes({ search, tag } = {}) {
  const db = loadDB();
  let notes = [...db.notes];

  // Búsqueda por palabra clave
  if (search) {
    const searchLower = search.toLowerCase();
    notes = notes.filter(note =>
      (note.title && note.title.toLowerCase().includes(searchLower)) ||
      (note.content && note.content.toLowerCase().includes(searchLower))
    );
  }

  // Filtrar por etiqueta
  if (tag) {
    notes = notes.filter(note =>
      note.tags && note.tags.includes(tag)
    );
  }

  // Ordenar por fecha de actualización (más recientes primero)
  notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  return notes;
}

// Obtener una nota por ID
function getNoteById(id) {
  const db = loadDB();
  return db.notes.find(note => note.id === parseInt(id));
}

// Crear nueva nota
function createNote({ title, content, tags = [] }) {
  const db = loadDB();
  const now = new Date().toISOString();
  const newNote = {
    id: db.noteIdCounter++,
    title: title || null,
    content,
    tags,
    created_at: now,
    updated_at: now
  };
  db.notes.push(newNote);
  saveDB(db);
  return newNote;
}

// Actualizar nota
function updateNote(id, { title, content, tags }) {
  const db = loadDB();
  const index = db.notes.findIndex(note => note.id === parseInt(id));
  if (index === -1) return null;

  db.notes[index] = {
    ...db.notes[index],
    title: title || null,
    content,
    tags: tags || [],
    updated_at: new Date().toISOString()
  };
  saveDB(db);
  return db.notes[index];
}

// Eliminar nota
function deleteNote(id) {
  const db = loadDB();
  const index = db.notes.findIndex(note => note.id === parseInt(id));
  if (index === -1) return false;
  db.notes.splice(index, 1);
  saveDB(db);
  return true;
}

// Obtener todas las etiquetas únicas
function getAllTags() {
  const db = loadDB();
  const tagSet = new Set();
  db.notes.forEach(note => {
    if (note.tags) {
      note.tags.forEach(tag => tagSet.add(tag));
    }
  });
  return Array.from(tagSet).sort().map((name, index) => ({ id: index + 1, name }));
}

module.exports = { getNotes, getNoteById, createNote, updateNote, deleteNote, getAllTags };
