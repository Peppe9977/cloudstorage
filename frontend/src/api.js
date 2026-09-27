const BASE = '/api';

function getToken() {
  return localStorage.getItem('vault_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch (_e) {
      /* non-JSON error body, ignore */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json') ? res.json() : res;
}

export const api = {
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }),

  me: () => request('/auth/me'),

  list: (path = '') => request(`/files/list?path=${encodeURIComponent(path)}`),

  mkdir: (path) =>
    request('/files/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    }),

  remove: (path) => request(`/files/delete?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),

  rename: (path, newName) =>
    request('/files/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, newName })
    }),

  folderSize: (path) => request(`/files/size?path=${encodeURIComponent(path)}`),

  // Short-lived (2h), single-file view token — lets <video>/<audio> stream
  // straight from /files/view (real seeking, no full-file buffering) without
  // the element needing to send our normal Authorization header.
  viewToken: (path) =>
    request('/files/view-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    }),

  search: (basePath, query) =>
    request(`/files/search?path=${encodeURIComponent(basePath)}&q=${encodeURIComponent(query)}`),

  diskUsage: () => request('/files/disk-usage'),

  // Fetches a file through the normal authenticated request (Authorization
  // header, never in the URL) and hands back a local blob URL the browser
  // can use as an <img>/<iframe> src. Caller must call URL.revokeObjectURL()
  // on it once no longer needed. Used for images/PDFs, which are small
  // enough that buffering the whole thing up front is fine; video/audio use
  // viewToken() + a direct <video>/<audio> src instead, for real streaming.
  getPreviewUrl: async (path) => {
    const res = await request(`/files/view?path=${encodeURIComponent(path)}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  // Downloads a file the same authenticated way, then triggers a normal
  // browser "save as" via a throwaway link — no token ever appears in a URL,
  // browser history, or server access logs.
  download: async (path, filename) => {
    const res = await request(`/files/view?path=${encodeURIComponent(path)}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // For text preview we read the body as text instead of JSON.
  viewText: (path) => request(`/files/view?path=${encodeURIComponent(path)}`).then((res) => res.text()),

  upload: (path, file, onProgress) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/files/upload?path=${encodeURIComponent(path)}`);
      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Upload failed'));

      const formData = new FormData();
      formData.append('file', file);
      // The file's own last-modified date on the device it came from (e.g. a
      // phone's photo timestamp) — the backend uses it, or EXIF data when
      // present, to keep that date instead of stamping the upload time.
      if (file.lastModified) formData.append('lastModified', String(file.lastModified));
      xhr.send(formData);
    })
};

export { getToken };
