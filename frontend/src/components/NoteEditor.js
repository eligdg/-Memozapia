import React, { useState, useEffect } from 'react';

function NoteEditor({ note, tags, onSave, onCancel }) {
  const [title, setTitle] = useState(note.title || '');
  const [content, setContent] = useState(note.content || '');
  const [selectedTags, setSelectedTags] = useState(
    note.tags ? note.tags.map(t => (typeof t === 'string' ? t : t.name)) : []
  );
  const [newTag, setNewTag] = useState('');
  const [allTags, setAllTags] = useState(tags);

  useEffect(() => {
    setTitle(note.title || '');
    setContent(note.content || '');
    setSelectedTags(note.tags ? note.tags.map(t => (typeof t === 'string' ? t : t.name)) : []);
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
