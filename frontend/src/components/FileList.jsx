import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatBytes, formatDate } from '../utils/format.js';
import { getFileKind } from '../utils/fileKind.js';

export default function FileList({
  entries,
  currentPath,
  onOpenFolder,
  onPreview,
  onChanged,
  folderSizes = {},
  onRequestFolderSize,
  searchMode = false,
  emptyTitle = 'This folder is empty',
  emptyHint = 'Drop a file anywhere on this page, or use Upload above.'
}) {
  const [renamingPath, setRenamingPath] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const resolvePath = (entry) =>
    searchMode ? entry.path : currentPath ? `${currentPath}/${entry.name}` : entry.name;

  // Lazily fetch the recursive size of every directory currently shown,
  // rather than computing it up front for the whole disk.
  useEffect(() => {
    if (!onRequestFolderSize) return;
    entries
      .filter((e) => e.type === 'directory')
      .forEach((e) => onRequestFolderSize(resolvePath(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyTitle}>{emptyTitle}</p>
        <p style={styles.emptyHint}>{emptyHint}</p>
      </div>
    );
  }

  async function handleDelete(entry, e) {
    e.stopPropagation();
    const full = resolvePath(entry);
    if (!confirm(`Delete "${entry.name}"? This cannot be undone.`)) return;
    await api.remove(full);
    onChanged();
  }

  function handleRowClick(entry) {
    const full = resolvePath(entry);
    if (entry.type === 'directory') {
      onOpenFolder(full);
      return;
    }
    const kind = getFileKind(entry.name);
    if (kind !== 'other') {
      onPreview(entry, full);
    } else {
      api.download(full, entry.name).catch((err) => alert(err.message || 'Download failed'));
    }
  }

  function handleDownloadClick(entry, e) {
    e.stopPropagation();
    api.download(resolvePath(entry), entry.name).catch((err) => alert(err.message || 'Download failed'));
  }

  function startRename(entry, e) {
    e.stopPropagation();
    setRenamingPath(resolvePath(entry));
    setRenameValue(entry.name);
  }

  function cancelRename(e) {
    e?.stopPropagation();
    setRenamingPath(null);
    setRenameValue('');
  }

  async function confirmRename(entry, e) {
    e?.stopPropagation();
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === entry.name) {
      cancelRename();
      return;
    }
    setRenaming(true);
    try {
      await api.rename(resolvePath(entry), trimmed);
      cancelRename();
      onChanged();
    } catch (err) {
      alert(err.message || 'Rename failed');
    } finally {
      setRenaming(false);
    }
  }

  function folderSizeLabel(entry) {
    const size = folderSizes[resolvePath(entry)];
    if (size === undefined) return '—';
    if (size === null) return '…';
    return formatBytes(size);
  }

  return (
    <div style={styles.table}>
      <div style={styles.headRow}>
        <span style={{ flex: 1 }}>Name</span>
        <span className="col-size" style={styles.headSize}>Size</span>
        <span className="col-modified" style={styles.headDate}>Modified</span>
        <span style={styles.headActions} />
      </div>

      {entries.map((entry) => {
        const full = resolvePath(entry);
        const isRenaming = renamingPath === full;
        const parentLabel = searchMode
          ? entry.path.split('/').slice(0, -1).join('/') || 'Storage root'
          : null;

        return (
          <div
            key={full}
            className="file-row"
            style={styles.row}
            onClick={() => !isRenaming && handleRowClick(entry)}
          >
            <span style={styles.nameCell}>
              {entry.type === 'directory' ? <FolderIcon /> : <FileIcon />}
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmRename(entry, e);
                    if (e.key === 'Escape') cancelRename(e);
                  }}
                  style={styles.renameInput}
                  disabled={renaming}
                />
              ) : (
                <span style={styles.nameCol}>
                  <span style={styles.name}>{entry.name}</span>
                  {searchMode && <span style={styles.parentLabel}>{parentLabel}</span>}
                </span>
              )}
            </span>

            <span className="col-size" style={styles.sizeCell}>
              {entry.type === 'directory' ? folderSizeLabel(entry) : formatBytes(entry.size)}
            </span>
            <span className="col-modified" style={styles.dateCell}>{formatDate(entry.modified)}</span>

            <span style={styles.actionsCell}>
              {isRenaming ? (
                <>
                  <button className="icon-btn neutral" title="Save" onClick={(e) => confirmRename(entry, e)} disabled={renaming}>
                    <CheckIcon />
                  </button>
                  <button className="icon-btn" title="Cancel" onClick={cancelRename} disabled={renaming}>
                    <CloseIcon />
                  </button>
                </>
              ) : (
                <>
                  {entry.type === 'file' && (
                    <button className="icon-btn neutral" title="Download" onClick={(e) => handleDownloadClick(entry, e)}>
                      <DownloadIcon />
                    </button>
                  )}
                  <button className="icon-btn neutral" title="Rename" onClick={(e) => startRename(entry, e)}>
                    <PencilIcon />
                  </button>
                  <button className="icon-btn" title="Delete" onClick={(e) => handleDelete(entry, e)}>
                    <TrashIcon />
                  </button>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, color: 'var(--accent)' }}>
      <path d="M1.5 3.5A1 1 0 0 1 2.5 2.5h3l1.2 1.4H13.5a1 1 0 0 1 1 1V12.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V3.5Z" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
      <path d="M3.5 1.5h6l3 3v10a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.5 1.5v3h3" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16">
      <path d="M8 2.5V11M4.5 7.5 8 11l3.5-3.5M3 13.5h10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16">
      <path d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16">
      <path d="M11 2.3 13.7 5 5.6 13.1 2.4 13.6l.5-3.2Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16">
      <path d="M3 8.5 6.5 12 13 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16">
      <path d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const styles = {
  table: { display: 'flex', flexDirection: 'column' },
  headRow: {
    display: 'flex',
    fontSize: 11,
    color: 'var(--text-faint)',
    padding: '0 14px 8px',
    borderBottom: '1px solid var(--border-soft)',
    marginBottom: 4
  },
  headSize: { width: 90, fontFamily: 'var(--font-mono)' },
  headDate: { width: 170, fontFamily: 'var(--font-mono)' },
  headActions: { width: 96 },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 14px',
    borderRadius: 7,
    cursor: 'pointer'
  },
  nameCell: { flex: 1, display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 },
  nameCol: { display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 },
  name: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13.5 },
  parentLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 11.5,
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-mono)'
  },
  renameInput: {
    flex: 1,
    padding: '4px 8px',
    fontSize: 13.5,
    minWidth: 0
  },
  sizeCell: { width: 90, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-muted)' },
  dateCell: { width: 170, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-muted)' },
  actionsCell: { width: 96, display: 'flex', justifyContent: 'flex-end', gap: 2, flexShrink: 0 },
  empty: { padding: '60px 20px', textAlign: 'center' },
  emptyTitle: { fontSize: 14, color: 'var(--text)', margin: '0 0 4px' },
  emptyHint: { fontSize: 12.5, color: 'var(--text-faint)', margin: 0 }
};
