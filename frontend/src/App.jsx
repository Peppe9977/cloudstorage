import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import LoginPage from './components/LoginPage.jsx';
import Sidebar from './components/Sidebar.jsx';
import FileBrowser from './components/FileBrowser.jsx';
import DiskUsageBadge from './components/DiskUsageBadge.jsx';

export default function App() {
  const { username, checking, logout } = useAuth();
  const [currentPath, setCurrentPath] = useState('');
  const [sidebarKey, setSidebarKey] = useState(0);
  const [diskKey, setDiskKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (checking) {
    return <div style={styles.loadingPage}>Loading…</div>;
  }

  if (!username) {
    return <LoginPage />;
  }

  function handleNavigate(path) {
    setCurrentPath(path);
    setSidebarOpen(false); // no-op on desktop; closes the mobile drawer
  }

  // Anything that adds/removes/renames a file or folder can change both the
  // folder tree and how much disk space is used, so refresh both together.
  function handleStorageChanged() {
    setSidebarKey((k) => k + 1);
    setDiskKey((k) => k + 1);
  }

  return (
    <>
      <div style={styles.shell}>
        <div className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
        <div className={`app-sidebar ${sidebarOpen ? 'open' : ''}`} style={{ height: '100%', display: 'flex' }}>
          <Sidebar key={sidebarKey} activePath={currentPath} onSelect={handleNavigate} />
        </div>
        <div style={styles.right}>
          <header className="app-header" style={styles.header}>
            <button
              className="mobile-only"
              style={styles.menuBtn}
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle folder list"
            >
              <MenuIcon />
            </button>
            <span style={styles.brandMobile} className="mobile-only">Peppugo Storage</span>
            <span style={{ flex: 1 }} />
            <span className="header-hint" style={styles.headerHint}>Signed in as</span>
            <span style={styles.userTag}>{username}</span>
            <button style={styles.logoutBtn} onClick={logout}>Sign out</button>
          </header>
          <FileBrowser
            currentPath={currentPath}
            onNavigate={handleNavigate}
            onTreeChanged={handleStorageChanged}
          />
        </div>
      </div>
      <DiskUsageBadge key={diskKey} />
    </>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const styles = {
  loadingPage: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)'
  },
  shell: { height: '100%', display: 'flex' },
  right: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 24px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--panel)',
    flexWrap: 'wrap'
  },
  menuBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    padding: '6px 8px',
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandMobile: {
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
    color: 'var(--text)'
  },
  headerHint: { fontSize: 12, color: 'var(--text-faint)' },
  userTag: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12.5,
    padding: '4px 9px',
    borderRadius: 6,
    background: 'var(--panel-raised)',
    border: '1px solid var(--border)'
  },
  logoutBtn: {
    fontSize: 12.5,
    color: 'var(--text-muted)',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '5px 10px',
    marginLeft: 6
  }
};
