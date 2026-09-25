require('dotenv').config();
const express = require('express');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const filesRoutes = require('./routes/files');

const app = express();

// Sets baseline security headers, notably X-Content-Type-Options: nosniff —
// important here because we serve arbitrary user-uploaded files inline
// (images, PDFs, text), so we don't want a browser guessing a different
// content type than the one we explicitly set.
app.use(
  helmet({
    // This app is a JSON/file API with a separately-hosted frontend, not a
    // page that renders untrusted HTML itself, so the default HTML-oriented
    // CSP isn't relevant here and would only get in the way.
    contentSecurityPolicy: false
  })
);

app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);

// Central error handler (multer file-size errors etc. land here too)
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File is too large' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Unexpected server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Cloud storage backend listening on http://localhost:${PORT}`);
});
