import React, { useState } from 'react';
import { api } from '../api.js';

export default function TreeNode({ name, path, depth, activePath, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);
  const isActive = activePath === path;

  async function toggle() {
    if (!expanded && children === null) {
      setLoading(true);
      try {
        const data = await api.list(path);
        setChildren(data.entries.filter((e) => e.type === 'directory'));
      } catch (_e) {
        setChildren([]);
      } finally {
        setLoading(false);
      }
    }
    setExpanded((v) => !v);
  }

  function handleClick() {
    onSelect(path);
    toggle();
  }

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          paddingLeft: 10 + depth * 16,
          borderRadius: 6,
          cursor: 'pointer',
          background: isActive ? 'var(--accent-soft)' : 'transparent',
          color: isActive ? 'var(--accent)' : 'var(--text)',
          fontSize: 13,
          userSelect: 'none'
        }}
      >
        <Chevron expanded={expanded} loading={loading} />
        <FolderIcon />
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {name}
        </span>
      </div>

      {expanded && children && children.length === 0 && (
        <div style={{ paddingLeft: 10 + (depth + 1) * 16, fontSize: 12, color: 'var(--text-faint)', padding: '4px 0' }}>
          empty
        </div>
      )}

      {expanded &&
        children &&
        children.map((child) => (
          <TreeNode
            key={child.name}
            name={child.name}
            path={path ? `${path}/${child.name}` : child.name}
            depth={depth + 1}
            activePath={activePath}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

function Chevron({ expanded, loading }) {
  if (loading) {
    return <span style={{ width: 12, fontSize: 10, color: 'var(--text-faint)' }}>⋯</span>;
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 120ms', flexShrink: 0 }}>
      <path d="M2 1 L8 5 L2 9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" style={{ flexShrink: 0, opacity: 0.85 }}>
      <path d="M1.5 3.5A1 1 0 0 1 2.5 2.5h3l1.2 1.4H13.5a1 1 0 0 1 1 1V12.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V3.5Z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}
