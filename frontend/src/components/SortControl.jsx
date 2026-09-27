import React from 'react';

const OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'date', label: 'Date modified' },
  { value: 'size', label: 'Size' }
];

// A dedicated control rather than clickable table headers, because the
// Size/Modified columns are hidden on narrow screens (see components.css) —
// this stays reachable at every width.
export default function SortControl({ sortKey, sortDir, onChange }) {
  return (
    <div style={styles.wrap}>
      <select
        value={sortKey}
        onChange={(e) => onChange(e.target.value, sortDir)}
        style={styles.select}
        aria-label="Sort by"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            Sort by {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="icon-btn neutral"
        style={styles.dirBtn}
        onClick={() => onChange(sortKey, sortDir === 'asc' ? 'desc' : 'asc')}
        title={sortDir === 'asc' ? 'Ascending — click for descending' : 'Descending — click for ascending'}
        aria-label="Toggle sort direction"
      >
        <SortDirIcon flipped={sortDir === 'desc'} />
      </button>
    </div>
  );
}

function SortDirIcon({ flipped }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      style={{ transform: flipped ? 'scaleY(-1)' : 'none' }}
    >
      <path d="M4 6.5 8 2.5 12 6.5M8 3v10.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const styles = {
  wrap: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  select: {
    padding: '8px 10px',
    fontSize: 13,
    borderRadius: 7,
    background: 'var(--panel-raised)',
    border: '1px solid var(--border)',
    color: 'var(--text)'
  },
  dirBtn: {
    border: '1px solid var(--border)',
    borderRadius: 7,
    padding: 7
  }
};
