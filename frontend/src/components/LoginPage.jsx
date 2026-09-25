import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <div style={styles.mark}>
          <div style={styles.markDot} />
          <span style={styles.markText}>Peppugo Storage</span>
        </div>
        <p style={styles.subtitle}>Sign in to reach your storage.</p>

        <label style={styles.label} htmlFor="username">Username</label>
        <input
          id="username"
          style={styles.input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
        />

        <label style={styles.label} htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          style={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error && <div style={styles.error}>{error}</div>}

        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background:
      'radial-gradient(circle at 20% 20%, rgba(63,201,180,0.06), transparent 40%), var(--bg)'
  },
  card: {
    width: 'min(340px, 100%)',
    padding: '36px 32px',
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column'
  },
  mark: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  markDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: 'var(--accent)',
    boxShadow: '0 0 12px var(--accent)'
  },
  markText: {
    fontFamily: 'var(--font-mono)',
    fontSize: 16,
    letterSpacing: 0.5,
    color: 'var(--text)'
  },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 24px' },
  label: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 },
  input: { padding: '10px 12px', fontSize: 14, marginBottom: 18 },
  error: {
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    fontSize: 13,
    padding: '8px 10px',
    borderRadius: 6,
    marginBottom: 16
  },
  button: {
    padding: '11px 0',
    background: 'var(--accent)',
    color: '#0c1512',
    fontWeight: 600,
    fontSize: 14,
    border: 'none',
    borderRadius: 8
  }
};
