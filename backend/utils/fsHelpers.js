const path = require('path');
const fs = require('fs');

const STORAGE_ROOT = path.resolve(process.env.STORAGE_ROOT || './storage');

// Make sure the storage root actually exists.
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

/**
 * Turns a user's configured `root_folder` (as stored in MySQL — a path
 * relative to STORAGE_ROOT, or "/" for full access) into an absolute
 * directory on disk. Everything that user does is then resolved relative
 * to this directory, so they can never see or reach anything outside it.
 * Creates the folder on first use if it doesn't exist yet.
 */
function resolveUserRoot(rootFolder) {
  const value = (rootFolder || '/').trim();

  if (value === '' || value === '/') {
    return STORAGE_ROOT;
  }

  const cleaned = value.replace(/^\/+|\/+$/g, '');
  const resolved = path.resolve(STORAGE_ROOT, cleaned);

  if (resolved !== STORAGE_ROOT && !resolved.startsWith(STORAGE_ROOT + path.sep)) {
    const err = new Error('This account has an invalid storage root configured');
    err.status = 500;
    throw err;
  }

  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }

  return resolved;
}

/**
 * Resolves a user-supplied relative path against `baseDir` (the caller's
 * resolved root — see resolveUserRoot) and guarantees the result cannot
 * escape outside of it (blocks "../../etc" etc). Throws if the path tries
 * to escape.
 */
function resolveSafePath(baseDir, relativePath = '') {
  const cleaned = (relativePath || '').replace(/^\/+/, '');
  const resolved = path.resolve(baseDir, cleaned);

  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) {
    const err = new Error('Path escapes your storage root');
    err.status = 400;
    throw err;
  }
  return resolved;
}

/**
 * Lists the contents of a directory (non-recursive), returning
 * a clean array of { name, type, size, modified } entries.
 */
function listDirectory(baseDir, relativePath = '') {
  const dirPath = resolveSafePath(baseDir, relativePath);
  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    const err = new Error('Not a directory');
    err.status = 400;
    throw err;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  return entries
    .filter((e) => !e.name.startsWith('.'))
    .map((e) => {
      const fullPath = path.join(dirPath, e.name);
      const entryStat = fs.statSync(fullPath);
      return {
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
        size: e.isDirectory() ? null : entryStat.size,
        modified: entryStat.mtime
      };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Recursively sums the size of every file under fullPath (directories
 * themselves don't count, only the files they contain, at any depth).
 */
function getFolderSize(fullPath) {
  let total = 0;
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const entryPath = path.join(fullPath, entry.name);
    if (entry.isDirectory()) {
      total += getFolderSize(entryPath);
    } else if (entry.isFile()) {
      total += fs.statSync(entryPath).size;
    }
  }
  return total;
}

/**
 * Recursively searches for files/folders whose name contains `query`
 * (case-insensitive), starting from fullBasePath. Returns entries with a
 * path relative to `baseDir` (the user's own root) so the frontend can
 * jump straight to them without ever seeing a path outside their scope.
 * Caps the number of results so a huge disk can't hang the request.
 */
function searchTree(baseDir, fullBasePath, query, maxResults = 200) {
  const results = [];
  const needle = query.toLowerCase();

  function walk(dirFull) {
    if (results.length >= maxResults) return;
    let entries;
    try {
      entries = fs.readdirSync(dirFull, { withFileTypes: true });
    } catch (_e) {
      return; // unreadable directory (permissions etc.) — skip it
    }

    for (const entry of entries) {
      if (results.length >= maxResults) return;
      if (entry.name.startsWith('.')) continue;

      const entryFull = path.join(dirFull, entry.name);
      if (entry.name.toLowerCase().includes(needle)) {
        const stat = fs.statSync(entryFull);
        results.push({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entry.isDirectory() ? null : stat.size,
          modified: stat.mtime,
          path: path.relative(baseDir, entryFull).split(path.sep).join('/')
        });
      }

      if (entry.isDirectory()) {
        walk(entryFull);
      }
    }
  }

  walk(fullBasePath);
  return results;
}

module.exports = {
  STORAGE_ROOT,
  resolveUserRoot,
  resolveSafePath,
  listDirectory,
  getFolderSize,
  searchTree
};
