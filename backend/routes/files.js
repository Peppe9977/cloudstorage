const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const exifr = require('exifr');
const { requireAuth } = require('../middleware/auth');
const {
  STORAGE_ROOT,
  resolveUserRoot,
  resolveSafePath,
  listDirectory,
  getFolderSize,
  searchTree
} = require('../utils/fsHelpers');

const router = express.Router();
router.use(requireAuth);

// Every route below only ever touches req.userRoot, never STORAGE_ROOT
// directly — that's what confines each user to their configured folder
// (and everything under it) and nothing else.
router.use((req, res, next) => {
  try {
    req.userRoot = resolveUserRoot(req.user.rootFolder);
    next();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Invalid storage configuration' });
  }
});

// GET /api/files/list?path=some/sub/folder
router.get('/list', (req, res) => {
  try {
    const relPath = req.query.path || '';
    const entries = listDirectory(req.userRoot, relPath);
    res.json({ path: relPath, entries });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to list directory' });
  }
});

// GET /api/files/view?path=some/file.jpg
// Serves the file inline (not as an attachment) with the right content type,
// so the browser can render images/video/audio/PDF directly. Express's
// underlying `send` handles Range requests automatically, which is what
// lets video/audio seek instead of re-downloading from the start.
router.get('/view', (req, res) => {
  try {
    const relPath = req.query.path;
    if (!relPath) return res.status(400).json({ error: 'path is required' });

    const fullPath = resolveSafePath(req.userRoot, relPath);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Cannot view a directory' });
    }

    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(fullPath);
  } catch (err) {
    res.status(err.status || 404).json({ error: err.message || 'File not found' });
  }
});

// GET /api/files/size?path=some/folder
// Recursively sums the size of everything inside a folder. Computed on
// demand (not part of /list) since walking a large tree is comparatively
// expensive — the frontend fetches this per-folder, lazily, as folders
// come into view.
router.get('/size', (req, res) => {
  try {
    const relPath = req.query.path || '';
    const fullPath = resolveSafePath(req.userRoot, relPath);
    const stat = fs.statSync(fullPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Not a directory' });
    }
    const size = getFolderSize(fullPath);
    res.json({ path: relPath, size });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to compute folder size' });
  }
});

// GET /api/files/search?path=some/folder&q=term
// Recursively searches for files/folders whose name contains `q`, starting
// from `path` (relative to the user's own root) and descending into every
// subfolder — never leaving the user's root.
router.get('/search', (req, res) => {
  try {
    const basePath = req.query.path || '';
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ results: [] });

    const fullBasePath = resolveSafePath(req.userRoot, basePath);
    const results = searchTree(req.userRoot, fullBasePath, q);
    res.json({ results });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Search failed' });
  }
});

// PATCH /api/files/rename  { path: "some/file.txt", newName: "renamed.txt" }
router.patch('/rename', express.json(), (req, res) => {
  try {
    const { path: relPath, newName } = req.body;
    if (!relPath || !newName) {
      return res.status(400).json({ error: 'path and newName are required' });
    }

    const safeName = path.basename(newName).trim();
    if (!safeName || safeName === '.' || safeName === '..') {
      return res.status(400).json({ error: 'Invalid name' });
    }

    const oldFull = resolveSafePath(req.userRoot, relPath);
    const newFull = path.join(path.dirname(oldFull), safeName);

    if (fs.existsSync(newFull)) {
      return res.status(409).json({ error: 'A file or folder with that name already exists' });
    }

    fs.renameSync(oldFull, newFull);
    res.json({ success: true, name: safeName });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to rename' });
  }
});

// GET /api/files/download?path=some/file.pdf
router.get('/download', (req, res) => {
  try {
    const relPath = req.query.path;
    if (!relPath) return res.status(400).json({ error: 'path is required' });

    const fullPath = resolveSafePath(req.userRoot, relPath);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Cannot download a directory' });
    }

    res.download(fullPath, path.basename(fullPath));
  } catch (err) {
    res.status(err.status || 404).json({ error: err.message || 'File not found' });
  }
});

// POST /api/files/mkdir  { path: "some/new-folder" }
router.post('/mkdir', express.json(), (req, res) => {
  try {
    const relPath = req.body.path;
    if (!relPath) return res.status(400).json({ error: 'path is required' });

    const fullPath = resolveSafePath(req.userRoot, relPath);
    fs.mkdirSync(fullPath, { recursive: false });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'EEXIST') {
      return res.status(409).json({ error: 'A file or folder with that name already exists' });
    }
    res.status(err.status || 500).json({ error: err.message || 'Failed to create folder' });
  }
});

// DELETE /api/files/delete?path=some/file-or-folder
router.delete('/delete', (req, res) => {
  try {
    const relPath = req.query.path;
    if (!relPath) return res.status(400).json({ error: 'path is required' });

    const fullPath = resolveSafePath(req.userRoot, relPath);
    fs.rmSync(fullPath, { recursive: true, force: false });
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to delete' });
  }
});

// GET /api/files/disk-usage
// Actual filesystem capacity/free space for the drive STORAGE_ROOT lives
// on (not just the sum of tracked files) — same figure `df` would show.
// This intentionally reflects the whole disk, not just one user's folder,
// since the point is "how full is the physical drive". Uses Node's built-in
// statfs rather than an extra dependency — works on Linux (WSL and the Pi).
router.get('/disk-usage', (req, res) => {
  try {
    const stats = fs.statfsSync(STORAGE_ROOT);
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize; // space available to a non-root user
    res.json({ total, free, used: total - free });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to read disk usage' });
  }
});

// --- Upload ---
// Files are streamed straight to their destination folder on the storage disk.
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const relPath = req.query.path || '';
      const fullPath = resolveSafePath(req.userRoot, relPath);
      cb(null, fullPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    // Keep the original filename; strip any path separators a client might sneak in.
    const safeName = path.basename(file.originalname);
    cb(null, safeName);
  }
});

const maxUploadBytes = (parseInt(process.env.MAX_UPLOAD_MB, 10) || 2048) * 1024 * 1024;
const upload = multer({ storage, limits: { fileSize: maxUploadBytes } });

const EXIF_DATE_EXT = new Set(['.jpg', '.jpeg', '.tiff', '.tif', '.heic', '.heif']);

// Figures out the file's "real" date — when a photo was actually taken, or
// when a document was last touched on the device it came from — rather than
// leaving it stamped with the moment it happened to be uploaded.
async function resolveOriginalDate(filePath, lastModifiedField) {
  // For photos, EXIF's capture date is the most reliable source: it's set
  // by the camera itself and survives being copied, synced or re-uploaded.
  if (EXIF_DATE_EXT.has(path.extname(filePath).toLowerCase())) {
    try {
      const exif = await exifr.parse(filePath, ['DateTimeOriginal', 'CreateDate']);
      if (exif?.DateTimeOriginal) return exif.DateTimeOriginal;
      if (exif?.CreateDate) return exif.CreateDate;
    } catch (_e) {
      // Not readable/valid EXIF — fall through to the browser-supplied date.
    }
  }

  // Otherwise, fall back to the file's own last-modified date on the device
  // it was uploaded from (the browser sends this as `file.lastModified`).
  if (lastModifiedField) {
    const ms = parseInt(lastModifiedField, 10);
    if (!Number.isNaN(ms)) return new Date(ms);
  }

  return null;
}

// POST /api/files/upload?path=some/folder   (multipart field name: "file")
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file received' });
  }

  try {
    const originalDate = await resolveOriginalDate(req.file.path, req.body.lastModified);
    if (originalDate) fs.utimesSync(req.file.path, originalDate, originalDate);
  } catch (err) {
    // Non-fatal — the file itself is already saved successfully.
    console.error('Failed to set original file date:', err);
  }

  res.json({
    success: true,
    file: {
      name: req.file.filename,
      size: req.file.size
    }
  });
});

module.exports = router;
