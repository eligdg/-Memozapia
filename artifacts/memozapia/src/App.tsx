import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useListNotes, useListTags, useCreateNote, useUpdateNote, useDeleteNote, getListNotesQueryKey, getListTagsQueryKey } from "@workspace/api-client-react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import NotFound from "@/pages/not-found";
import "./memozapia.css";

const queryClient = new QueryClient();

type Note = {
  id: number;
  title?: string | null;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

type Tag = {
  id: number;
  name: string;
};

function SearchBar({ searchTerm, onSearch }: { searchTerm: string; onSearch: (s: string) => void }) {
  const [inputValue, setInputValue] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => onSearch(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue, onSearch]);

  return (
    <div className="mz-search-bar">
      <input
        type="text"
        placeholder="Buscar notas..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="mz-search-input"
      />
      {inputValue && (
        <button className="mz-clear-search" onClick={() => setInputValue("")}>×</button>
      )}
    </div>
  );
}

function TagFilter({ tags, selectedTag, onSelectTag }: { tags: Tag[]; selectedTag: string | null; onSelectTag: (t: string | null) => void }) {
  return (
    <div className="mz-tag-filter">
      <h3>Etiquetas</h3>
      <div className="mz-tags-list">
        <button className={`mz-tag-item ${!selectedTag ? "active" : ""}`} onClick={() => onSelectTag(null)}>Todas</button>
        {tags.map((tag) => (
          <button
            key={tag.id}
            className={`mz-tag-item ${selectedTag === tag.name ? "active" : ""}`}
            onClick={() => onSelectTag(tag.name)}
          >
            {tag.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function NoteList({ notes, selectedNote, onSelectNote, onDeleteNote }: { notes: Note[]; selectedNote: Note | null; onSelectNote: (n: Note) => void; onDeleteNote: (id: number) => void }) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const truncateText = (text: string, maxLength = 60) => {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  return (
    <div className="mz-note-list">
      {notes.length === 0 ? (
        <p className="mz-no-notes">No hay notas</p>
      ) : (
        notes.map((note) => (
          <div
            key={note.id}
            className={`mz-note-item mz-glass-card ${selectedNote?.id === note.id ? "selected" : ""}`}
            onClick={() => onSelectNote(note)}
          >
            <div className="mz-note-item-header">
              <h4>{note.title || "Sin título"}</h4>
              <button
                className="mz-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm("¿Eliminar esta nota?")) onDeleteNote(note.id);
                }}
              >×</button>
            </div>
            <p className="mz-note-preview">{truncateText(note.content)}</p>
            {note.tags && note.tags.length > 0 && (
              <div className="mz-note-tags">
                {note.tags.map((tag, idx) => (
                  <span key={`${tag}-${idx}`} className="mz-tag-badge">{tag}</span>
                ))}
              </div>
            )}
            <span className="mz-note-date">{formatDate(note.updated_at)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function NoteEditor({ note, tags, onSave, onCancel }: { note: Note | { title: string; content: string; tags: string[] }; tags: Tag[]; onSave: (data: { title: string | null; content: string; tags: string[] }) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(note.title || "");
  const [content, setContent] = useState(note.content || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(note.tags ? note.tags.map((t: string | Tag) => (typeof t === "string" ? t : t.name)) : []);
  const [newTag, setNewTag] = useState("");
  const [allTags, setAllTags] = useState<Tag[]>(tags);

  useEffect(() => {
    setTitle(note.title || "");
    setContent(note.content || "");
    setSelectedTags(note.tags ? note.tags.map((t: string | Tag) => (typeof t === "string" ? t : t.name)) : []);
  }, [(note as Note).id]);

  const handleSave = () => {
    if (!content.trim()) { alert("El contenido es requerido"); return; }
    onSave({ title: (title.trim() || null) as string | null, content, tags: selectedTags });
  };

  const toggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagName));
    } else {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const addNewTag = () => {
    if (!newTag.trim()) return;
    const tagName = newTag.trim();
    if (!allTags.find((t) => t.name === tagName)) {
      setAllTags([...allTags, { id: Date.now(), name: tagName }]);
    }
    if (!selectedTags.includes(tagName)) setSelectedTags([...selectedTags, tagName]);
    setNewTag("");
  };

  return (
    <div className="mz-note-editor">
      <input type="text" placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} className="mz-editor-title" />
      <textarea placeholder="Escribe tu nota aquí..." value={content} onChange={(e) => setContent(e.target.value)} className="mz-editor-content" autoFocus />
      <div className="mz-editor-tags">
        <h4>Etiquetas</h4>
        <div className="mz-tag-selector">
          {allTags.map((tag) => (
            <button key={tag.id || tag.name} className={`mz-tag-btn ${selectedTags.includes(tag.name) ? "selected" : ""}`} onClick={() => toggleTag(tag.name)}>{tag.name}</button>
          ))}
        </div>
        <div className="mz-add-tag">
          <input type="text" placeholder="Nueva etiqueta..." value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNewTag()} />
          <button onClick={addNewTag}>Añadir</button>
        </div>
      </div>
      <div className="mz-editor-actions">
        <button className="mz-cancel-btn" onClick={onCancel}>Cancelar</button>
        <button className="mz-save-btn" onClick={handleSave}>{(note as Note).id ? "Actualizar" : "Guardar"}</button>
      </div>
    </div>
  );
}

function MemozapiaApp() {
  const queryClient = useQueryClient();
  const [selectedNote, setSelectedNote] = useState<Note | { title: string; content: string; tags: string[] } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data: notes = [], isLoading } = useListNotes({ search: searchTerm || undefined, tag: selectedTag || undefined });
  const { data: tags = [] } = useListTags();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTagsQueryKey() });
  }, [queryClient]);

  const handleSave = async (noteData: { title: string | null; content: string; tags: string[] }) => {
    if (selectedNote && (selectedNote as Note).id) {
      const updated = await updateNote.mutateAsync({ id: (selectedNote as Note).id, data: noteData });
      refreshData();
      setSelectedNote(updated as unknown as Note);
    } else {
      const created = await createNote.mutateAsync({ data: noteData });
      refreshData();
      setSelectedNote(created as unknown as Note);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteNote.mutateAsync({ id });
    refreshData();
    if (selectedNote && (selectedNote as Note).id === id) setSelectedNote(null);
  };

  const handleSearch = useCallback((s: string) => {
    setSearchTerm(s);
    queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
  }, [queryClient]);

  return (
    <div className="mz-app">
      <header className="mz-app-header mz-glass-card">
        <h1>Memozapia</h1>
        <p>Segundo Cerebro</p>
      </header>
      <div className="mz-app-content">
        <aside className="mz-sidebar">
          <button className="mz-new-note-btn" onClick={() => setSelectedNote({ title: "", content: "", tags: [] })}>
            + Nueva Nota
          </button>
          <div className="mz-glass-card">
            <SearchBar searchTerm={searchTerm} onSearch={handleSearch} />
          </div>
          <div className="mz-glass-card">
            <TagFilter tags={tags as Tag[]} selectedTag={selectedTag} onSelectTag={setSelectedTag} />
          </div>
          {isLoading ? (
            <p style={{ textAlign: "center", color: "#94a3b8" }}>Cargando...</p>
          ) : (
            <NoteList
              notes={notes as unknown as Note[]}
              selectedNote={selectedNote as Note}
              onSelectNote={setSelectedNote}
              onDeleteNote={handleDelete}
            />
          )}
        </aside>
        <main className="mz-main-content">
          {selectedNote ? (
            <NoteEditor
              note={selectedNote as Note}
              tags={tags as Tag[]}
              onSave={handleSave}
              onCancel={() => setSelectedNote(null)}
            />
          ) : (
            <div className="mz-empty-state mz-glass-card">
              <h2>Selecciona una nota o crea una nueva</h2>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={MemozapiaApp} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
