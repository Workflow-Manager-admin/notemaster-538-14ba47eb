import React, { useState, useEffect } from 'react';
import './App.css';

// Constants for colors (from project spec)
const PALETTE = {
  primary: '#1a73e8',
  secondary: '#e8eaed',
  accent: '#34a853',
};

// Placeholder backend API URL root (change if backend address differs)
const API_BASE = 'http://localhost:8000/api';

// --- AUTH HOOK & CONTEXT ---
const AuthContext = React.createContext();

// PUBLIC_INTERFACE
function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth() must be used within AuthProvider");
  }
  return context;
}

// PUBLIC_INTERFACE
function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // {username}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Try session restore on mount (placeholder logic)
  useEffect(() => {
    // If using local/sessionStorage for token-based auth
    const stored = window.localStorage.getItem("notesapp-user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  // PUBLIC_INTERFACE
  async function login(username, password) {
    setLoading(true);
    setError('');
    // Placeholder: Replace with backend "/login" fetch
    // Example response: {token, username}
    try {
      // Simulate API call:
      // let resp = await fetch(`${API_BASE}/login`, {...});
      // let data = await resp.json();
      // For demo, any non-empty pwd works:
      if (username && password) {
        const user = { username };
        setUser(user);
        window.localStorage.setItem("notesapp-user", JSON.stringify(user));
      } else throw new Error('Invalid credentials');
    } catch (e) {
      setError(e.message || "Login failed");
    }
    setLoading(false);
  }

  // PUBLIC_INTERFACE
  async function signup(username, password) {
    setLoading(true);
    setError('');
    // Placeholder: Replace with backend "/register" fetch
    // For demo, just set user
    try {
      if (username && password) {
        const user = { username };
        setUser(user);
        window.localStorage.setItem("notesapp-user", JSON.stringify(user));
      } else throw new Error('Invalid signup info');
    } catch (e) {
      setError(e.message || "Signup failed");
    }
    setLoading(false);
  }

  // PUBLIC_INTERFACE
  function logout() {
    setUser(null);
    window.localStorage.removeItem("notesapp-user");
  }

  // PUBLIC_INTERFACE
  return (
    <AuthContext.Provider value={{ user, loading, error, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- COMPONENTS ---

function LoginSignup() {
  const { login, signup, error, loading } = useAuth();
  const [form, setForm] = useState("login");
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inError, setInError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setInError('');
    if (!username || !password) {
      setInError("Username & password required");
      return;
    }
    if (form === "login") {
      await login(username, password);
    } else {
      await signup(username, password);
    }
  }
  return (
    <div className="auth-outer">
      <div className="auth-card">
        <h2>{form === "login" ? "Login" : "Sign Up"}</h2>
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Processing..." : (form === "login" ? "Login" : "Sign Up")}
          </button>
          {(error || inError) && <div className="auth-error">{error || inError}</div>}
        </form>
        <div className="switch-auth">
          {form === "login" ?
            <>No account? <button type="button" className="switch-btn" onClick={() => setForm("signup")}>Sign Up</button></>
            :
            <>Already have an account? <button type="button" className="switch-btn" onClick={() => setForm("login")}>Login</button></>
          }
        </div>
      </div>
    </div>
  )
}

function Sidebar({ notes, selectedId, onSelect, onNew, onLogout, mobileOpen, closeSidebar }) {
  return (
    <aside className={"sidebar" + (mobileOpen ? " sidebar-open" : "")}>
      <div className="sidebar-header">
        <span className="brand" style={{ color: PALETTE.primary }}>Notemaster</span>
        <button className="sidebar-hide-btn" onClick={closeSidebar} title="Close">&times;</button>
      </div>
      <button className="btn-accent" style={{ width: "100%", marginBottom: 16 }} onClick={onNew}>+ New Note</button>
      <nav className="sidebar-list">
        {notes.length === 0 && <div className="sidebar-empty">No notes</div>}
        {notes.map(n => (
          <div
            key={n.id}
            className={"sidebar-item" + (n.id === selectedId ? " selected" : "")}
            onClick={() => onSelect(n.id)}
            title={n.title}
          >
            <div className="sidebar-title">{n.title || <em>(untitled)</em>}</div>
            <div className="sidebar-snippet">{n.content?.slice(0, 42)}</div>
          </div>
        ))}
      </nav>
      <div style={{ marginTop: "auto", paddingTop: 16 }}>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </div>
    </aside>
  );
}

function NoteEditor({ note, onSave, onDelete, saving, deleting }) {
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  useEffect(() => {
    setTitle(note?.title || "");
    setContent(note?.content || "");
  }, [note]);
  function handleSave(e) {
    e.preventDefault();
    onSave({ ...note, title, content });
  }
  return note ? (
    <form className="note-editor" onSubmit={handleSave}>
      <input
        className="note-title"
        value={title}
        placeholder="Title"
        onChange={e => setTitle(e.target.value)}
        autoFocus
        required
      />
      <textarea
        className="note-content"
        value={content}
        placeholder="Write your note here..."
        onChange={e => setContent(e.target.value)}
        rows={10}
        required
      />
      <div className="editor-actions">
        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          className="btn-delete"
          type="button"
          onClick={() => onDelete(note)}
          disabled={deleting}
          style={{ marginLeft: 8 }}
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </form>
  ) : (
    <div className="no-note">Select or create a note</div>
  );
}

// --- NOTES HOOK & API LOGIC ---
function useNotes(user) {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeNote, setActiveNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Fetch notes from backend
  useEffect(() => {
    if (!user) return;
    async function fetchNotes() {
      setLoading(true);
      setError('');
      try {
        // Placeholder: GET /notes?user={user.username}
        // let resp = await fetch(`${API_BASE}/notes?user=${user.username}`);
        // let data = await resp.json();
        // For demo: localStorage mimic
        let key = "notes_" + user.username;
        let arr = [];
        try { arr = JSON.parse(window.localStorage.getItem(key) || "[]"); } catch {}
        setNotes(arr);
        if (arr.length) {
          setSelectedId(arr[0].id);
          setActiveNote(arr[0]);
        } else {
          setSelectedId(null);
          setActiveNote(null);
        }
      } catch (e) {
        setError('Failed to load notes');
      }
      setLoading(false);
    }
    fetchNotes();
    // eslint-disable-next-line
  }, [user]);

  // Fetch note by id (for when a note is selected)
  useEffect(() => {
    if (!selectedId) { setActiveNote(null); return; }
    let found = notes.find(n => n.id === selectedId);
    setActiveNote(found || null);
  }, [selectedId, notes]);

  // PUBLIC_INTERFACE
  async function createNote() {
    setSaving(true);
    setError('');
    try {
      let newNote = {
        id: Date.now().toString(),
        title: '',
        content: ''
      };
      const newNotes = [newNote, ...notes];
      setNotes(newNotes);
      setSelectedId(newNote.id);
      setActiveNote(newNote);

      // Placeholder: POST /notes
      // For demo: persist in localStorage
      let key = "notes_" + user.username;
      window.localStorage.setItem(key, JSON.stringify(newNotes));
    } catch (e) {
      setError("Failed to create note");
    }
    setSaving(false);
  }

  // PUBLIC_INTERFACE
  async function updateNote(note) {
    setSaving(true);
    setError('');
    try {
      let idx = notes.findIndex(n => n.id === note.id);
      if (idx < 0) return;
      const updated = notes.map(n => n.id === note.id ? note : n);
      setNotes(updated);
      setActiveNote(note);
      // Placeholder: PUT /notes/:id
      let key = "notes_" + user.username;
      window.localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      setError("Failed to update note");
    }
    setSaving(false);
  }

  // PUBLIC_INTERFACE
  async function deleteNote(note) {
    setDeleting(true);
    setError('');
    try {
      let filtered = notes.filter(n => n.id !== note.id);
      setNotes(filtered);
      // Select a different note
      if (filtered.length > 0) setSelectedId(filtered[0].id);
      else setSelectedId(null);
      // Placeholder: DELETE /notes/:id
      let key = "notes_" + user.username;
      window.localStorage.setItem(key, JSON.stringify(filtered));
    } catch (e) {
      setError("Failed to delete note");
    }
    setDeleting(false);
  }

  // PUBLIC_INTERFACE
  function selectNote(id) {
    setSelectedId(id);
  }

  return {
    notes,
    loading,
    saving,
    deleting,
    error,
    activeNote,
    selectedId,
    createNote,
    updateNote,
    deleteNote,
    selectNote
  };
}

// --- MOBILE SIDEBAR LOGIC ---
function useMobileSidebar() {
  const [open, setOpen] = useState(false);
  function openSidebar() { setOpen(true); }
  function closeSidebar() { setOpen(false); }
  return { open, openSidebar, closeSidebar };
}

// --- MAIN APP ---
function Main() {
  const { user, logout } = useAuth();
  const {
    notes, loading, saving, deleting, error,
    activeNote, selectedId, createNote, updateNote, deleteNote, selectNote
  } = useNotes(user);
  const mobileSidebar = useMobileSidebar();

  return (
    <div className="notes-app-container">
      {/* Mobile toggle button */}
      <button className="sidebar-mobile-show" onClick={mobileSidebar.openSidebar} title="Show Notes">&#9776;</button>
      <Sidebar
        notes={notes}
        selectedId={selectedId}
        onSelect={id => { selectNote(id); mobileSidebar.closeSidebar(); }}
        onNew={createNote}
        onLogout={logout}
        mobileOpen={mobileSidebar.open}
        closeSidebar={mobileSidebar.closeSidebar}
      />
      <main className="main-content">
        {loading
          ? <div className="loading">Loading notes...</div>
          : (
            <>
              {error && <div className="error-msg">{error}</div>}
              <NoteEditor
                note={activeNote}
                onSave={updateNote}
                onDelete={deleteNote}
                saving={saving}
                deleting={deleting}
              />
            </>
          )
        }
      </main>
    </div>
  )
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button className="theme-toggle" onClick={onToggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
      {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
    </button>
  )
}

// --- APP WRAPPER ---
function App() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <AuthProvider>
      <div className="App">
        <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')} />
        <AuthContext.Consumer>
          {({ user }) => (
            user
              ? <Main />
              : <LoginSignup />
          )}
        </AuthContext.Consumer>
      </div>
    </AuthProvider>
  );
}

export default App;
