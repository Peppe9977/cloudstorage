import React from 'react';

export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={styles.wrap}>
      <span style={styles.icon}>
        <SearchIcon />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.input}
      />
      {value && (
        <button style={styles.clear} onClick={() => onChange('')} title="Clear search" aria-label="Clear search">
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16">
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <line x1="10.8" y1="10.8" x2="14" y2="14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16">
      <path d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'var(--panel-raised)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    width: '100%',
    maxWidth: 420
  },
  icon: { color: 'var(--text-faint)', display: 'flex', flexShrink: 0 },
  input: {
    flex: 1,
    border: 'none',
    background: 'none',
    padding: 0,
    fontSize: 13.5,
    minWidth: 0
  },
  clear: {
    background: 'none',
    border: 'none',
    color: 'var(--text-faint)',
    display: 'flex',
    flexShrink: 0,
    padding: 2,
    borderRadius: 4
  }
};
