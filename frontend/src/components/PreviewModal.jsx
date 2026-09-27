import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { getFileKind } from '../utils/fileKind.js';
import { formatBytes } from '../utils/format.js';

export default function PreviewModal({ entry, path, onClose, onPrev, onNext, position }) {
  const kind = getFileKind(entry.name);
  const [textContent, setTextContent] = useState(null);
  const [textError, setTextError] = useState(null);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, onPrev, onNext]);

  // Basic swipe support for touch devices: swipe left → next, swipe right → previous.
  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const SWIPE_THRESHOLD = 60;
    if (deltaX > SWIPE_THRESHOLD && onPrev) onPrev();
    else if (deltaX < -SWIPE_THRESHOLD && onNext) onNext();
  }

  // Video/audio: point the element straight at /files/view with a
  // short-lived, single-file view token, so the browser streams and seeks
  // the file natively instead of us buffering the whole thing into memory
  // first (see api.viewToken).
  useEffect(() => {
    if (!['video', 'audio'].includes(kind)) return;
    setMediaUrl(null);
    setMediaError(null);
    let cancelled = false;

    api
      .viewToken(path)
      .then(({ token }) => {
        if (cancelled) return;
        setMediaUrl(`/api/files/view?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}`);
      })
      .catch((err) => setMediaError(err.message || 'Could not load file'));

    return () => {
      cancelled = true;
    };
  }, [kind, path]);

  // Images/PDF: small enough that fetching the whole file up front with our
  // normal auth header (never in a URL) and turning it into a local blob is
  // simpler than streaming, and just as fast in practice.
  useEffect(() => {
    if (!['image', 'pdf'].includes(kind)) return;
    setMediaUrl(null);
    setMediaError(null);
    let objectUrl = null;
    let cancelled = false;

    api
      .getPreviewUrl(path)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setMediaUrl(url);
      })
      .catch((err) => setMediaError(err.message || 'Could not load file'));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [kind, path]);

  useEffect(() => {
    if (kind !== 'text') return;
    setTextContent(null);
    setTextError(null);
    api
      .viewText(path)
      .then(setTextContent)
      .catch((err) => setTextError(err.message || 'Could not load file'));
  }, [kind, path]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await api.download(path, entry.name);
    } catch (err) {
      alert(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={styles.backdrop} className="preview-backdrop" onClick={onClose}>
      <div style={styles.panel} className="preview-panel" onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.headerText}>
            <span style={styles.name}>{entry.name}</span>
            <span style={styles.meta}>
              {formatBytes(entry.size)}
              {position && position.total > 1 ? ` · ${position.index + 1} of ${position.total}` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="toolbar-btn" onClick={handleDownload} disabled={downloading}>
              <DownloadIcon /> {downloading ? 'Downloading…' : 'Download'}
            </button>
            <button className="toolbar-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div style={styles.body} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {onPrev && (
            <button
              className="nav-btn"
              style={{ ...styles.navBtn, left: 12 }}
              onClick={onPrev}
              title="Previous file"
              aria-label="Previous file"
            >
              <ChevronIcon direction="left" />
            </button>
          )}
          {onNext && (
            <button
              className="nav-btn"
              style={{ ...styles.navBtn, right: 12 }}
              onClick={onNext}
              title="Next file"
              aria-label="Next file"
            >
              <ChevronIcon direction="right" />
            </button>
          )}

          {['image', 'video', 'audio', 'pdf'].includes(kind) && mediaError && (
            <div style={styles.textError}>{mediaError}</div>
          )}
          {['image', 'video', 'audio', 'pdf'].includes(kind) && !mediaError && !mediaUrl && (
            <div style={styles.textHint}>Loading…</div>
          )}

          {kind === 'image' && mediaUrl && (
            <img src={mediaUrl} alt={entry.name} style={styles.image} />
          )}

          {kind === 'video' && mediaUrl && (
            <video src={mediaUrl} controls autoPlay style={styles.media} />
          )}

          {kind === 'audio' && mediaUrl && (
            <div style={styles.audioWrap}>
              <audio src={mediaUrl} controls autoPlay style={{ width: '100%' }} />
            </div>
          )}

          {kind === 'pdf' && mediaUrl && (
            <iframe title={entry.name} src={mediaUrl} style={styles.iframe} />
          )}

          {kind === 'text' && (
            <div style={styles.textWrap}>
              {textError && <div style={styles.textError}>{textError}</div>}
              {!textError && textContent === null && <div style={styles.textHint}>Loading…</div>}
              {!textError && textContent !== null && <pre style={styles.pre}>{textContent}</pre>}
            </div>
          )}

          {kind === 'other' && (
            <div style={styles.noPreview}>
              <p style={styles.noPreviewTitle}>No preview available for this file type</p>
              <p style={styles.noPreviewHint}>Use Download above to open it locally.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChevronIcon({ direction }) {
  const d = direction === 'left' ? 'M9 2 L4 7 L9 12' : 'M5 2 L10 7 L5 12';
  return (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8, 10, 13, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 24
  },
  panel: {
    width: 'min(900px, 100%)',
    height: 'min(80vh, 720px)',
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid var(--border-soft)',
    flexShrink: 0
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  name: { fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' },
  body: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'auto',
    background: 'var(--bg)'
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '1px solid var(--border)',
    background: 'rgba(25, 31, 38, 0.85)',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5
  },
  image: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  media: { maxWidth: '100%', maxHeight: '100%' },
  audioWrap: { width: '80%', padding: 24 },
  iframe: { width: '100%', height: '100%', border: 'none' },
  textWrap: { width: '100%', height: '100%', overflow: 'auto', padding: 20 },
  pre: {
    margin: 0,
    fontFamily: 'var(--font-mono)',
    fontSize: 12.5,
    lineHeight: 1.6,
    color: 'var(--text)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  textHint: { color: 'var(--text-muted)', fontSize: 13 },
  textError: { color: 'var(--danger)', fontSize: 13 },
  noPreview: { textAlign: 'center' },
  noPreviewTitle: { fontSize: 14, color: 'var(--text)', margin: '0 0 4px' },
  noPreviewHint: { fontSize: 12.5, color: 'var(--text-faint)', margin: 0 }
};
