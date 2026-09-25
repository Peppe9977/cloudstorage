import React from 'react';

export default function Breadcrumb({ path, onNavigate }) {
  const parts = path ? path.split('/') : [];

  return (
    <div style={styles.wrap}>
      <button style={styles.crumb} onClick={() => onNavigate('')}>Storage</button>
      {parts.map((part, i) => {
        const target = parts.slice(0, i + 1).join('/');
        return (
          <React.Fragment key={target}>
            <span style={styles.sep}>/</span>
            <button style={styles.crumb} onClick={() => onNavigate(target)}>{part}</button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', alignItems: 'center', gap: 2, fontFamily: 'var(--font-mono)', fontSize: 13 },
  crumb: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    padding: '4px 6px',
    borderRadius: 5,
    fontFamily: 'inherit',
    fontSize: 'inherit'
  },
  sep: { color: 'var(--text-faint)' }
};
