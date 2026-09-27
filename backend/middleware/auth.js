const jwt = require('jsonwebtoken');

// How long a "view" token (see signViewToken below) stays valid. Long enough
// to watch a full-length video without interruption, while still expiring
// and staying confined to exactly one file if it ever leaks (browser
// history, a proxy access log, a shared screen).
const VIEW_TOKEN_EXPIRES_IN = '2h';

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // View tokens are single-file, read-only capabilities minted for
    // <video>/<audio> playback (see signViewToken/authenticateView) — never
    // valid as a stand-in for a real login session on any other route.
    if (payload.purpose === 'view') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Mints a short-lived token that can only ever be used to stream one
// specific file via GET /api/files/view — not to list, rename, delete or
// upload anything, and not to view any other file. This exists because a
// <video>/<audio> element makes its own request for its `src` and can't
// attach our normal Authorization header, so streaming needs a credential
// that's safe to put in a URL: narrowly scoped, and rejected everywhere else.
function signViewToken(user, relPath) {
  return jwt.sign(
    { sub: user.sub, rootFolder: user.rootFolder, purpose: 'view', path: relPath },
    process.env.JWT_SECRET,
    { expiresIn: VIEW_TOKEN_EXPIRES_IN }
  );
}

// Alternate auth path for GET /api/files/view only: accepts a view token via
// ?token=... in the query string instead of the Authorization header. Falls
// back to the normal header-based requireAuth when no token query param is
// present, so existing header-based callers (image/PDF preview, text
// preview, download) are unaffected.
function authenticateView(req, res, next) {
  const token = req.query.token;
  if (!token) return requireAuth(req, res, next);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Must be a view token, and scoped to exactly the file being requested —
    // otherwise a token minted for one file could be replayed against
    // another just by editing the URL's `path` parameter.
    if (payload.purpose !== 'view' || payload.path !== req.query.path) {
      return res.status(401).json({ error: 'Invalid or expired link' });
    }
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired link' });
  }
}

module.exports = { requireAuth, signViewToken, authenticateView };
