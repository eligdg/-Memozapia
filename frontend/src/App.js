import React, { useState, useEffect } from 'react';
import axios from 'axios';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import SearchBar from './components/SearchBar';
import TagFilter from './components/TagFilter';
import './App.css';

// Cambia entre desarrollo y producción
const isDevelopment = process.env.NODE_ENV === 'development';
const API_BASE = isDevelopment  
  ? 'http://localhost:3001'  
  : 'https://memozapia-backend.onrender.com';

const API_URL = `${API_BASE}/api/notes`;
const TAGS_URL = `${API_BASE}/api/tags/all`;

function App() {
  const [notes, setNotes] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar notas y etiquetas
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

  // Crear nota
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

  // Actualizar nota
  const updateNote = async (id, noteData) => {
    try {
      const response = await axios.put(`${API_URL}/${id}`, noteData);
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

  // Eliminar nota
  const deleteNote = async (id) => {
    try {
      await axios.delete(`${API_URL}/${id}`);
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
            <TagFilter
              tags={tags}
              selectedTag={selectedTag}
              onSelectTag={setSelectedTag}
            />
          </div>

          {loading ? (
            <p style={{textAlign: 'center', color: '#94a3b8'}}>Cargando...</p>
          ) : (
            <NoteList
              notes={notes}
              selectedNote={selectedNote}
              onSelectNote={setSelectedNote}
              onDeleteNote={deleteNote}
            />
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
