import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Breadcrumb from './Breadcrumb.jsx';
import SearchBar from './SearchBar.jsx';
import FileList from './FileList.jsx';
import PreviewModal from './PreviewModal.jsx';

export default function FileBrowser({ currentPath, onNavigate, onTreeChanged }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [uploads, setUploads] = useState([]); // { id, name, progress, error }
  const [previewIndex, setPreviewIndex] = useState(null); // index into fileEntries, or null

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const [folderSizes, setFolderSizes] = useState({});
  const requestedSizes = useRef(new Set());

  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  const searchActive = searchQuery.trim() !== '';
  const displayEntries = searchActive ? searchResults || [] : entries;

  // Only files (not folders) are part of the swipeable preview sequence.
  const fileEntries = displayEntries.filter((e) => e.type === 'file');

  function resolveEntryPath(entry) {
    return searchActive ? entry.path : currentPath ? `${currentPath}/${entry.name}` : entry.name;
  }

  // Folder sizes are cached per path; any change to the contents makes them stale,
  // so forget what was requested and let the refreshed list re-fetch them.
  const refresh = useCallback(() => {
    requestedSizes.current.clear();
    setLoading(true);
    api
      .list(currentPath)
      .then((data) => setEntries(data.entries))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [currentPath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Leaving the folder (e.g. via the sidebar tree) clears any active search
  // rather than carrying a stale query into the new location.
  useEffect(() => {
    setSearchQuery('');
    setSearchResults(null);
  }, [currentPath]);

  const runSearch = useCallback(
    (query) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setSearchResults(null);
        return;
      }
      setSearching(true);
      api
        .search(currentPath, trimmed)
        .then((data) => setSearchResults(data.results))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    },
    [currentPath]
  );

  // Debounce: wait for a short pause in typing before hitting the server.
  useEffect(() => {
    const handle = setTimeout(() => runSearch(searchQuery), 300);
    return () => clearTimeout(handle);
  }, [searchQuery, runSearch]);

  function requestFolderSize(path) {
    if (requestedSizes.current.has(path)) return;
    requestedSizes.current.add(path);
    // null = loading marker; keep any previous value visible while re-fetching
    setFolderSizes((prev) => (path in prev ? prev : { ...prev, [path]: null }));
    api
      .folderSize(path)
      .then((data) => setFolderSizes((prev) => ({ ...prev, [path]: data.size })))
      .catch(() => {
        requestedSizes.current.delete(path);
        setFolderSizes((prev) => {
          const next = { ...prev };
          delete next[path];
          return next;
        });
      });
  }

  function uploadFiles(fileList) {
    Array.from(fileList).forEach((file) => {
      const id = `${Date.now()}-${file.name}`;
      setUploads((u) => [...u, { id, name: file.name, progress: 0, error: null }]);

      api
        .upload(currentPath, file, (progress) => {
          setUploads((u) => u.map((item) => (item.id === id ? { ...item, progress } : item)));
        })
        .then(() => {
          setUploads((u) => u.filter((item) => item.id !== id));
          handleChanged(); // refreshes list, folder sizes and disk usage
        })
        .catch((err) => {
          setUploads((u) => u.map((item) => (item.id === id ? { ...item, error: err.message } : item)));
        });
    });
  }

  function handleDrop(e) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  }

  function handleDragEnter(e) {
    e.preventDefault();
    dragCounter.current += 1;
    setDragActive(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) setDragActive(false);
  }

  async function handleNewFolder() {
    const name = prompt('Folder name');
    if (!name) return;
    const full = currentPath ? `${currentPath}/${name}` : name;
    try {
      await api.mkdir(full);
      refresh();
      onTreeChanged?.();
    } catch (err) {
      alert(err.message);
    }
  }

  function handleChanged() {
    requestedSizes.current.clear();
    if (searchActive) runSearch(searchQuery);
    else refresh();
    onTreeChanged?.();
  }

  return (
    <main
      style={styles.main}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <div style={styles.topBar} className="browser-topbar">
        <div style={styles.topBarRow}>
          <Breadcrumb path={currentPath} onNavigate={onNavigate} />
          <div style={styles.actions}>
            <button className="toolbar-btn" onClick={handleNewFolder}>
              <PlusFolderIcon /> New folder
            </button>
            <button className="toolbar-btn primary" onClick={() => fileInputRef.current?.click()}>
              <UploadIcon /> Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.length) uploadFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={`Search in ${currentPath || 'Storage'} and subfolders…`}
        />
      </div>

      <div className={`dropzone ${dragActive ? 'active' : ''} browser-content`} style={styles.content}>
        {(searchActive ? searching && searchResults === null : loading) ? (
          <div style={styles.loading}>{searchActive ? 'Searching…' : 'Loading…'}</div>
        ) : (
          <FileList
            entries={displayEntries}
            currentPath={currentPath}
            searchMode={searchActive}
            onOpenFolder={onNavigate}
            onPreview={(entry) => {
              const idx = fileEntries.findIndex((e) => resolveEntryPath(e) === resolveEntryPath(entry));
              setPreviewIndex(idx);
            }}
            onChanged={handleChanged}
            folderSizes={folderSizes}
            onRequestFolderSize={requestFolderSize}
            emptyTitle={searchActive ? 'No matches found' : 'This folder is empty'}
            emptyHint={
              searchActive
                ? 'Try a different search term.'
                : 'Drop a file anywhere on this page, or use Upload above.'
            }
          />
        )}
      </div>

      {uploads.length > 0 && (
        <div style={styles.uploadPanel}>
          {uploads.map((u) => (
            <div key={u.id} style={styles.uploadItem}>
              <span style={styles.uploadName}>{u.name}</span>
              {u.error ? (
                <span style={{ color: 'var(--danger)', fontSize: 12 }}>{u.error}</span>
              ) : (
                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: `${u.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {previewIndex !== null && fileEntries[previewIndex] && (
        <PreviewModal
          entry={fileEntries[previewIndex]}
          path={resolveEntryPath(fileEntries[previewIndex])}
          onClose={() => setPreviewIndex(null)}
          onPrev={previewIndex > 0 ? () => setPreviewIndex(previewIndex - 1) : null}
          onNext={previewIndex < fileEntries.length - 1 ? () => setPreviewIndex(previewIndex + 1) : null}
          position={{ index: previewIndex, total: fileEntries.length }}
        />
      )}
    </main>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16">
      <path d="M8 11V2.5M4.5 6 8 2.5 11.5 6M3 13.5h10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusFolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16">
      <path d="M1.5 3.5A1 1 0 0 1 2.5 2.5h3l1.2 1.4H13.5a1 1 0 0 1 1 1V12.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V3.5Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7.5v3M6.5 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const styles = {
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' },
  topBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '16px 24px',
    borderBottom: '1px solid var(--border-soft)'
  },
  topBarRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10
  },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 },
  content: { flex: 1, margin: '14px 24px 24px', padding: '10px 0', overflowY: 'auto' },
  loading: { padding: '40px', color: 'var(--text-muted)', fontSize: 13 },
  uploadPanel: {
    position: 'fixed',
    bottom: 20,
    left: 24,
    width: 280,
    maxWidth: 'calc(100vw - 48px)',
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
    zIndex: 20
  },
  uploadItem: { display: 'flex', flexDirection: 'column', gap: 5 },
  uploadName: { fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  progressTrack: { height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--accent)', transition: 'width 120ms' }
};
