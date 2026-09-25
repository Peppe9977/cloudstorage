import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import TreeNode from './TreeNode.jsx';

export default function Sidebar({ activePath, onSelect }) {
  const [rootDirs, setRootDirs] = useState(null);

  useEffect(() => {
    api
      .list('')
      .then((data) => setRootDirs(data.entries.filter((e) => e.type === 'directory')))
      .catch(() => setRootDirs([]));
  }, []);

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand}>
        <div style={styles.dot} />
        <span style={styles.brandText}>Peppugo Storage</span>
      </div>

      <div
        onClick={() => onSelect('')}
        style={{
          ...styles.rootRow,
          background: activePath === '' ? 'var(--accent-soft)' : 'transparent',
          color: activePath === '' ? 'var(--accent)' : 'var(--text)'
        }}
      >
        <DiskIcon />
        <span>Storage</span>
      </div>

      <div style={styles.tree}>
        {rootDirs === null && <div style={styles.hint}>Loading…</div>}
        {rootDirs && rootDirs.length === 0 && <div style={styles.hint}>No folders yet</div>}
        {rootDirs &&
          rootDirs.map((d) => (
            <TreeNode
              key={d.name}
              name={d.name}
              path={d.name}
              depth={0}
              activePath={activePath}
              onSelect={onSelect}
            />
          ))}
      </div>
    </aside>
  );
}

function DiskIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" style={{ flexShrink: 0, opacity: 0.85 }}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <line x1="1.5" y1="10" x2="14.5" y2="10" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="11.5" cy="12" r="0.7" fill="currentColor" />
    </svg>
  );
}

const styles = {
  sidebar: {
    width: 260,
    flexShrink: 0,
    borderRight: '1px solid var(--border)',
    background: 'var(--panel)',
    display: 'flex',
    flexDirection: 'column',
    padding: '18px 12px'
  },
  brand: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 18px' },
  dot: { width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' },
  brandText: { fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--text)' },
  rootRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 6
  },
  tree: { overflowY: 'auto', flex: 1 },
  hint: { fontSize: 12, color: 'var(--text-faint)', padding: '4px 8px' }
};
