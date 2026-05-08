import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useListNotes, useListTags, useCreateNote, useUpdateNote, useDeleteNote, getListNotesQueryKey, getListTagsQueryKey } from "@workspace/api-client-react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import NotFound from "@/pages/not-found";
import "./memozapia.css";

type BotStatus = { active: boolean; username: string | null; aiConfigured: boolean };

function useBotStatus() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/bot/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: BotStatus | null) => { if (d) setStatus(d); })
      .catch(() => {});
  }, []);
  return status;
}

const queryClient = new QueryClient();

type Note = {
  id: number;
  title?: string | null;
  content: string;
  tags: string[];
  scheduled_at?: string | null;
  gcal_event_id?: string | null;
  created_at: string;
  updated_at: string;
};

type Tag = {
  id: number;
  name: string;
};

type ActiveView = "notas" | "agenda";

// ─── SearchBar ────────────────────────────────────────────────────────────────
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

// ─── TagFilter ────────────────────────────────────────────────────────────────
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

// ─── NoteList ─────────────────────────────────────────────────────────────────
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
            {note.scheduled_at && (
              <div className="mz-note-scheduled">
                📅 {new Date(note.scheduled_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            <span className="mz-note-date">{formatDate(note.updated_at)}</span>
          </div>
        ))
      )}
    </div>
  );
}

// ─── NoteEditor ───────────────────────────────────────────────────────────────
function NoteEditor({
  note,
  tags,
  onSave,
  onCancel,
}: {
  note: Note | { title: string; content: string; tags: string[]; scheduled_at?: string | null };
  tags: Tag[];
  onSave: (data: { title: string | null; content: string; tags: string[]; scheduled_at: string | null }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(note.title || "");
  const [content, setContent] = useState(note.content || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    note.tags ? note.tags.map((t: string | Tag) => (typeof t === "string" ? t : t.name)) : []
  );
  const [newTag, setNewTag] = useState("");
  const [allTags, setAllTags] = useState<Tag[]>(tags);
  const [scheduledAt, setScheduledAt] = useState<string>(
    note.scheduled_at ? note.scheduled_at.slice(0, 16) : ""
  );

  useEffect(() => {
    setTitle(note.title || "");
    setContent(note.content || "");
    setSelectedTags(note.tags ? note.tags.map((t: string | Tag) => (typeof t === "string" ? t : t.name)) : []);
    setScheduledAt(note.scheduled_at ? note.scheduled_at.slice(0, 16) : "");
  }, [(note as Note).id]);

  const [showEmail, setShowEmail] = useState(false);
  const [emailTo, setEmailTo] = useState("eligomez83@gmail.com");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [emailMsg, setEmailMsg] = useState("");

  const handleSendEmail = async () => {
    setEmailStatus("sending");
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const resp = await fetch(`${base}/api/gmail/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          subject: title.trim() || "Nota de Memozapia",
          body: content,
        }),
      });
      const data = await resp.json() as { success?: boolean; error?: string };
      if (!resp.ok || data.error) throw new Error(data.error ?? "Error desconocido");
      setEmailStatus("ok");
      setEmailMsg("Enviado correctamente");
      setTimeout(() => { setEmailStatus("idle"); setShowEmail(false); }, 2500);
    } catch (e: unknown) {
      setEmailStatus("error");
      setEmailMsg(e instanceof Error ? e.message : "Error al enviar");
    }
  };

  const handleSave = () => {
    if (!content.trim()) { alert("El contenido es requerido"); return; }
    onSave({
      title: (title.trim() || null) as string | null,
      content,
      tags: selectedTags,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    });
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(selectedTags.includes(tagName)
      ? selectedTags.filter((t) => t !== tagName)
      : [...selectedTags, tagName]);
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

      <div className="mz-editor-date-row">
        <label className="mz-date-label">📅 Programar para:</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="mz-datetime-input"
        />
        {scheduledAt && (
          <button className="mz-clear-date" onClick={() => setScheduledAt("")}>Quitar fecha</button>
        )}
      </div>

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

      {/* Email panel */}
      {showEmail && (
        <div className="mz-email-panel">
          <div className="mz-email-row">
            <label className="mz-email-label">Para:</label>
            <input
              type="email"
              className="mz-email-input"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="destinatario@email.com"
            />
          </div>
          <div className="mz-email-actions">
            <button className="mz-cancel-btn" onClick={() => { setShowEmail(false); setEmailStatus("idle"); setEmailMsg(""); }}>Cancelar</button>
            <button
              className="mz-email-send-btn"
              onClick={handleSendEmail}
              disabled={emailStatus === "sending"}
            >
              {emailStatus === "sending" ? "⏳ Enviando..." : emailStatus === "ok" ? `✅ ${emailMsg}` : emailStatus === "error" ? `❌ ${emailMsg}` : "📧 Enviar"}
            </button>
          </div>
        </div>
      )}

      <div className="mz-editor-actions">
        <button className="mz-cancel-btn" onClick={onCancel}>Cancelar</button>
        <button className="mz-email-btn" onClick={() => { setShowEmail(!showEmail); setEmailStatus("idle"); setEmailMsg(""); }}>📧 Email</button>
        <button className="mz-save-btn" onClick={handleSave}>{(note as Note).id ? "Actualizar" : "Guardar"}</button>
      </div>
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_CORTOS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

type SyncStatus = "idle" | "syncing" | "ok" | "error";

function CalendarView({
  notes,
  onSelectNote,
  onNewNoteForDate,
  onSyncDone,
}: {
  notes: Note[];
  onSelectNote: (n: Note) => void;
  onNewNoteForDate: (date: Date) => void;
  onSyncDone: () => void;
}) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMsg, setSyncMsg] = useState("");

  const handleSync = async () => {
    setSyncStatus("syncing");
    setSyncMsg("");
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const resp = await fetch(`${base}/api/calendar/sync`, { method: "POST" });
      const data = await resp.json() as { synced?: number; error?: string };
      if (!resp.ok || data.error) throw new Error(data.error ?? "Error desconocido");
      setSyncStatus("ok");
      setSyncMsg(`${data.synced} nota${data.synced === 1 ? "" : "s"} sincronizada${data.synced === 1 ? "" : "s"}`);
      onSyncDone();
      setTimeout(() => setSyncStatus("idle"), 4000);
    } catch (e: unknown) {
      setSyncStatus("error");
      setSyncMsg(e instanceof Error ? e.message : "Error al sincronizar");
      setTimeout(() => setSyncStatus("idle"), 5000);
    }
  };
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date | null>(today);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  // Monday-based: 0=Mon...6=Sun
  let startOffset = firstDayOfMonth.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const scheduledNotes = notes.filter((n) => n.scheduled_at);

  const notesForDate = (d: Date) =>
    scheduledNotes.filter((n) => {
      const nd = new Date(n.scheduled_at!);
      return nd.getFullYear() === d.getFullYear() && nd.getMonth() === d.getMonth() && nd.getDate() === d.getDate();
    });

  const selectedDayNotes = selectedDay ? notesForDate(selectedDay) : [];

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(today); };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const formatTimeShort = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="mz-calendar-wrapper">
      {/* Month Grid */}
      <div className="mz-calendar mz-glass-card">
        <div className="mz-cal-header">
          <button className="mz-cal-nav" onClick={prevMonth}>‹</button>
          <div className="mz-cal-title-group">
            <h2 className="mz-cal-title">{MESES[month]} {year}</h2>
            <button className="mz-cal-today" onClick={goToday}>Hoy</button>
          </div>
          <div className="mz-cal-header-right">
            <button
              className={`mz-sync-btn ${syncStatus}`}
              onClick={handleSync}
              disabled={syncStatus === "syncing"}
              title="Sincronizar notas con Google Calendar"
            >
              {syncStatus === "syncing" ? "⏳ Sincronizando..." : syncStatus === "ok" ? `✅ ${syncMsg}` : syncStatus === "error" ? `❌ ${syncMsg}` : "🔄 Sync Google"}
            </button>
            <button className="mz-cal-nav" onClick={nextMonth}>›</button>
          </div>
        </div>

        <div className="mz-cal-grid">
          {DIAS_CORTOS.map((d) => (
            <div key={d} className="mz-cal-day-name">{d}</div>
          ))}
          {Array.from({ length: totalCells }).map((_, i) => {
            const dayNum = i - startOffset + 1;
            if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} className="mz-cal-cell mz-cal-empty" />;
            const cellDate = new Date(year, month, dayNum);
            const dayNotes = notesForDate(cellDate);
            const isToday = isSameDay(cellDate, today);
            const isSelected = selectedDay && isSameDay(cellDate, selectedDay);
            return (
              <div
                key={i}
                className={`mz-cal-cell ${isToday ? "mz-cal-today-cell" : ""} ${isSelected ? "mz-cal-selected" : ""}`}
                onClick={() => setSelectedDay(cellDate)}
              >
                <span className="mz-cal-day-num">{dayNum}</span>
                {dayNotes.length > 0 && (
                  <div className="mz-cal-dots">
                    {dayNotes.slice(0, 3).map((n) => (
                      <span key={n.id} className="mz-cal-dot" title={n.title || n.content} />
                    ))}
                    {dayNotes.length > 3 && <span className="mz-cal-dot-more">+{dayNotes.length - 3}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Panel */}
      {selectedDay && (
        <div className="mz-day-panel mz-glass-card">
          <div className="mz-day-panel-header">
            <h3 className="mz-day-panel-title">
              {selectedDay.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </h3>
            <button
              className="mz-day-new-btn"
              onClick={() => onNewNoteForDate(selectedDay)}
            >+ Nueva nota aquí</button>
          </div>

          {selectedDayNotes.length === 0 ? (
            <p className="mz-day-empty">Sin notas programadas para este día</p>
          ) : (
            <div className="mz-day-notes">
              {selectedDayNotes
                .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
                .map((note) => (
                  <div key={note.id} className="mz-day-note" onClick={() => onSelectNote(note)}>
                    <div className="mz-day-note-time">{formatTimeShort(note.scheduled_at!)}</div>
                    <div className="mz-day-note-body">
                      <div className="mz-day-note-title">{note.title || "Sin título"}</div>
                      <div className="mz-day-note-preview">{note.content.slice(0, 80)}{note.content.length > 80 ? "…" : ""}</div>
                      {note.tags.length > 0 && (
                        <div className="mz-note-tags" style={{ marginTop: "0.3rem" }}>
                          {note.tags.map((t, i) => <span key={i} className="mz-tag-badge">{t}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── BotStatusBadge ───────────────────────────────────────────────────────────
function BotStatusBadge({ status }: { status: BotStatus | null }) {
  if (!status) return null;
  if (!status.active) {
    return (
      <a
        href="https://t.me/"
        target="_blank"
        rel="noopener noreferrer"
        className="mz-bot-badge mz-bot-badge--off"
        title="Bot de Telegram no configurado"
      >
        🤖 Bot desactivado
      </a>
    );
  }
  return (
    <a
      href={`https://t.me/${status.username}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`mz-bot-badge ${status.aiConfigured ? "mz-bot-badge--on" : "mz-bot-badge--warn"}`}
      title={status.aiConfigured ? "Bot activo con IA" : "Bot activo, IA no configurada"}
    >
      🤖 @{status.username}
      {!status.aiConfigured && <span className="mz-bot-badge-warn"> ⚠️</span>}
    </a>
  );
}

// ─── MemozapiaApp ─────────────────────────────────────────────────────────────
function MemozapiaApp() {
  const queryClient = useQueryClient();
  const botStatus = useBotStatus();
  const [selectedNote, setSelectedNote] = useState<Note | { title: string; content: string; tags: string[]; scheduled_at?: string | null } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("notas");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: notes = [], isLoading } = useListNotes({ search: searchTerm || undefined, tag: selectedTag || undefined });
  const { data: tags = [] } = useListTags();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTagsQueryKey() });
  }, [queryClient]);

  const openNote = (note: Note | { title: string; content: string; tags: string[]; scheduled_at?: string | null }) => {
    setSelectedNote(note);
    setSidebarOpen(false);
  };

  const handleCancel = () => {
    setSelectedNote(null);
    setSidebarOpen(true);
  };

  const handleSave = async (noteData: { title: string | null; content: string; tags: string[]; scheduled_at: string | null }) => {
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
    if (selectedNote && (selectedNote as Note).id === id) {
      setSelectedNote(null);
      setSidebarOpen(true);
    }
  };

  const handleSearch = useCallback((s: string) => {
    setSearchTerm(s);
    queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
  }, [queryClient]);

  const handleNewNoteForDate = (date: Date) => {
    const iso = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0).toISOString();
    openNote({ title: "", content: "", tags: [], scheduled_at: iso });
  };

  const handleNewNote = () => openNote({ title: "", content: "", tags: [] });

  const changeView = (v: ActiveView) => {
    setActiveView(v);
    setSelectedNote(null);
    setSidebarOpen(false);
  };

  return (
    <div className="mz-app">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="mz-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <header className="mz-app-header mz-glass-card">
        <div className="mz-header-inner">
          {/* Hamburger — mobile only */}
          <button
            className="mz-hamburger"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Abrir menú"
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>

          <div className="mz-brand">
            <h1>Memozapia</h1>
            <p>Segundo Cerebro</p>
          </div>

          {/* Tabs — desktop/tablet */}
          <nav className="mz-view-tabs">
            <button className={`mz-view-tab ${activeView === "notas" ? "active" : ""}`} onClick={() => changeView("notas")}>📝 Notas</button>
            <button className={`mz-view-tab ${activeView === "agenda" ? "active" : ""}`} onClick={() => changeView("agenda")}>📅 Agenda</button>
          </nav>

          <BotStatusBadge status={botStatus} />
        </div>
      </header>

      <div className="mz-app-content">
        {/* Sidebar */}
        <aside className={`mz-sidebar ${sidebarOpen ? "mz-sidebar--open" : ""}`}>
          <button className="mz-new-note-btn" onClick={handleNewNote}>+ Nueva Nota</button>
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
              onSelectNote={(n) => openNote(n)}
              onDeleteNote={handleDelete}
            />
          )}
        </aside>

        {/* Main content */}
        <main className="mz-main-content">
          {selectedNote ? (
            <NoteEditor
              note={selectedNote as Note}
              tags={tags as Tag[]}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          ) : activeView === "agenda" ? (
            <CalendarView
              notes={notes as unknown as Note[]}
              onSelectNote={(n) => openNote(n)}
              onNewNoteForDate={handleNewNoteForDate}
              onSyncDone={refreshData}
            />
          ) : (
            <div className="mz-empty-state mz-glass-card">
              <h2>Selecciona una nota o crea una nueva</h2>
            </div>
          )}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="mz-mobile-nav">
        <button
          className={`mz-mobile-nav-btn ${activeView === "notas" && !selectedNote ? "active" : ""}`}
          onClick={() => changeView("notas")}
        >
          <span className="mz-mobile-nav-icon">📝</span>
          <span className="mz-mobile-nav-label">Notas</span>
        </button>
        <button
          className="mz-mobile-nav-btn mz-mobile-nav-center"
          onClick={handleNewNote}
        >
          <span className="mz-mobile-nav-plus">+</span>
        </button>
        <button
          className={`mz-mobile-nav-btn ${activeView === "agenda" && !selectedNote ? "active" : ""}`}
          onClick={() => changeView("agenda")}
        >
          <span className="mz-mobile-nav-icon">📅</span>
          <span className="mz-mobile-nav-label">Agenda</span>
        </button>
      </nav>
    </div>
  );
}

// ─── Router / App ─────────────────────────────────────────────────────────────
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
