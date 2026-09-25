import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function toGB(bytes) {
  return bytes / 1024 ** 3;
}

export default function DiskUsageBadge() {
  const [usage, setUsage] = useState(null); // { used, total }
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .diskUsage()
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed || !usage) return null;

  const usedGB = toGB(usage.used);
  const totalGB = toGB(usage.total);
  const percent = usage.total > 0 ? Math.min(100, (usage.used / usage.total) * 100) : 0;

  return (
    <div style={styles.wrap} title={`${usedGB.toFixed(1)} GB used of ${totalGB.toFixed(1)} GB`}>
      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${percent}%` }} />
      </div>
      <span style={styles.label}>
        {usedGB.toFixed(1)} / {totalGB.toFixed(1)} GB
      </span>
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed',
    bottom: 16,
    right: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 12px',
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 11.5,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
    zIndex: 15,
    userSelect: 'none'
  },
  barTrack: { width: 56, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 },
  barFill: { height: '100%', background: 'var(--accent)' },
  label: { whiteSpace: 'nowrap' }
};
