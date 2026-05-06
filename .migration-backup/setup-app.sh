#!/bin/bash
echo "🚀 Configurando Memozapia..."

# Crear App.js correcto
cat > frontend/src/App.js << 'EOFAPP'
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import SearchBar from './components/SearchBar';
import TagFilter from './components/TagFilter';
import './App.css';

const API_URL = 'http://localhost:3001/api/notes';
const TAGS_URL = 'http://localhost:3001/api/tags/all';

function App() {
  const [notes, setNotes] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = {};
        if (searchTerm) params.search = searchTerm;
        if (selectedTag) params.tag = selectedTag;

        const notesRes = await axios.get(API_URL, { params });
        const tagsRes = await axios.get(TAGS_URL);

        setNotes(notesRes.data);
        setTags(tagsRes.data);
        setLoading(false);
      } catch (error) {
        console.error('Error:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, [searchTerm, selectedTag]);

  const createNote = async (noteData) => {
    try {
      const response = await axios.post(API_URL, noteData);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (selectedTag) params.tag = selectedTag;
      const notesRes = await axios.get(API_URL, { params });
      const tagsRes = await axios.get(TAGS_URL);
      setNotes(notesRes.data);
      setTags(tagsRes.data);
      setSelectedNote(response.data);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar');
    }
  };

  const updateNote = async (id, noteData) => {
    try {
      const response = await axios.put(API_URL + '/' + id, noteData);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (selectedTag) params.tag = selectedTag;
      const notesRes = await axios.get(API_URL, { params });
      const tagsRes = await axios.get(TAGS_URL);
      setNotes(notesRes.data);
      setTags(tagsRes.data);
      setSelectedNote(response.data);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar');
    }
  };

  const deleteNote = async (id) => {
    try {
      await axios.delete(API_URL + '/' + id);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (selectedTag) params.tag = selectedTag;
      const notesRes = await axios.get(API_URL, { params });
      const tagsRes = await axios.get(TAGS_URL);
      setNotes(notesRes.data);
      setTags(tagsRes.data);
      if (selectedNote?.id === id) setSelectedNote(null);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="app">
      <header className="app-header glass-card">
        <h1>Memozapia</h1>
        <p>Segundo Cerebro</p>
      </header>
      <div className="app-content">
        <aside className="sidebar">
          <button className="new-note-btn" onClick={() => setSelectedNote({ title: '', content: '', tags: [] })}>
            + Nueva Nota
          </button>
          <div className="glass-card">
            <SearchBar searchTerm={searchTerm} onSearch={setSearchTerm} />
          </div>
          <div className="glass-card">
            <TagFilter tags={tags} selectedTag={selectedTag} onSelectTag={setSelectedTag} />
          </div>
          {loading ? (
            <p style={{textAlign: 'center', color: '#94a3b8'}}>Cargando...</p>
          ) : (
            <NoteList notes={notes} selectedNote={selectedNote} onSelectNote={setSelectedNote} onDeleteNote={deleteNote} />
          )}
        </aside>
        <main className="main-content">
          {selectedNote ? (
            <NoteEditor
              note={selectedNote}
              tags={tags}
              onSave={async (noteData) => {
                if (selectedNote && selectedNote.id) {
                  await updateNote(selectedNote.id, noteData);
                } else {
                  await createNote(noteData);
                }
              }}
              onCancel={() => setSelectedNote(null)}
            />
          ) : (
            <div className="empty-state glass-card">
              <h2>Selecciona una nota o crea una nueva</h2>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
EOFAPP

echo "✅ App.js creado"

# Crear NoteEditor.js correcto
cat > frontend/src/components/NoteEditor.js << 'EOFEDITOR'
import React, { useState, useEffect } from 'react';

function NoteEditor({ note, tags, onSave, onCancel }) {
  const [title, setTitle] = useState(note.title || '');
  const [content, setContent] = useState(note.content || '');
  const [selectedTags, setSelectedTags] = useState(
    note.tags ? note.tags.map(t => t.name) : []
  );
  const [newTag, setNewTag] = useState('');
  const [allTags, setAllTags] = useState(tags);

  useEffect(() => {
    setTitle(note.title || '');
    setContent(note.content || '');
    setSelectedTags(note.tags ? note.tags.map(t => t.name) : []);
  }, [note]);

  const handleSave = () => {
    if (!content.trim()) {
      alert('El contenido es requerido');
      return;
    }
    onSave({
      title: title.trim() || null,
      content,
      tags: selectedTags
    });
  };

  const toggleTag = (tagName) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags(selectedTags.filter(t => t !== tagName));
    } else {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const addNewTag = () => {
    if (!newTag.trim()) return;
    const tagName = newTag.trim();
    if (!allTags.find(t => t.name === tagName)) {
      setAllTags([...allTags, { name: tagName }]);
    }
    if (!selectedTags.includes(tagName)) {
      setSelectedTags([...selectedTags, tagName]);
    }
    setNewTag('');
  };

  return (
    <div className="note-editor">
      <input
        type="text"
        placeholder="Título (opcional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="editor-title"
      />
      <textarea
        placeholder="Escribe tu nota aquí..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="editor-content"
        autoFocus
      />
      <div className="editor-tags">
        <h4>Etiquetas</h4>
        <div className="tag-selector">
          {allTags.map(tag => (
            <button
              key={tag.id || tag.name}
              className={`tag-btn ${selectedTags.includes(tag.name) ? 'selected' : ''}`}
              onClick={() => toggleTag(tag.name)}
            >
              {tag.name}
            </button>
          ))}
        </div>
        <div className="add-tag">
          <input
            type="text"
            placeholder="Nueva etiqueta..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addNewTag()}
          />
          <button onClick={addNewTag}>Añadir</button>
        </div>
      </div>
      <div className="editor-actions">
        <button className="cancel-btn" onClick={onCancel}>Cancelar</button>
        <button className="save-btn" onClick={handleSave}>
          {note.id ? 'Actualizar' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

export default NoteEditor;
EOFEDITOR

echo "✅ NoteEditor.js creado"
echo ""
echo "🎉 Archivos creados correctamente!"
