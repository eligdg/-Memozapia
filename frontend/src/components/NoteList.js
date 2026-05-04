import React from 'react';

function NoteList({ notes, selectedNote, onSelectNote, onDeleteNote }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateText = (text, maxLength = 60) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="note-list">
      {notes.length === 0 ? (
        <p className="no-notes">No hay notas</p>
      ) : (
        notes.map(note => (
          <div
            key={note.id}
            className={`note-item glass-card ${selectedNote?.id === note.id ? 'selected' : ''}`}
            onClick={() => onSelectNote(note)}
          >
            <div className="note-item-header">
              <h4>{note.title || 'Sin título'}</h4>
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('¿Eliminar esta nota?')) {
                    onDeleteNote(note.id);
                  }
                }}
              >
                ×
              </button>
            </div>
            <p className="note-preview">{truncateText(note.content)}</p>
            {note.tags && note.tags.length > 0 && (
              <div className="note-tags">
                {note.tags.map((tag, idx) => {
                  const name = typeof tag === 'string' ? tag : tag.name;
                  const key = (tag && tag.id) ? tag.id : `${name}-${idx}`;
                  return (
                    <span key={key} className="tag-badge">{name}</span>
                  );
                })}
              </div>
            )}
            <span className="note-date">{formatDate(note.updated_at)}</span>
          </div>
        ))
      )}
    </div>
  );
}

export default NoteList;
