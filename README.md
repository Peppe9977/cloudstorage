# Personal Cloud Storage — Demo

A local demo of a personal cloud storage app: React frontend, Node/Express backend,
MySQL for authentication, and files served straight off disk (point it at your
external HDD later on the Raspberry Pi).

```
cloud-storage/
├── backend/     Express API: auth (JWT + bcrypt) + file browser/upload/download
└── frontend/    React (Vite) UI: login, tree sidebar, file list, drag-and-drop upload
```

**Features:** authentication, browse/upload/download, inline preview for images/video/audio/PDF/text with swipe/arrow navigation between files, rename, recursive search within a folder and its subfolders, recursive folder-size display, responsive layout (mobile drawer sidebar, adaptive columns), per-user storage roots, and a live disk-usage indicator.

**Requirements:** Node.js **18.15+** (the disk-usage indicator uses `fs.statfsSync`, added in that version). Check with `node -v`; if it's older, install a newer Node via [nvm](https://github.com/nvm-sh/nvm) rather than relying on Ubuntu's default `apt` package, which is often behind.

## 1. Install MySQL in WSL

```bash
sudo apt update
sudo apt install mysql-server
sudo service mysql start
```

Then create the database, table, and app user:

```bash
sudo mysql < backend/db/init.sql
```

Open `backend/db/init.sql` first and change the `'change_me'` password to
something real — use the same value in the next step.

## 2. Configure and start the backend

```bash
cd backend
cp .env.example .env
# edit .env: set DB_PASSWORD to match what you put in init.sql,
# and set JWT_SECRET to a long random string.
npm install
```

Create your first login user (this hashes the password with bcrypt and stores it):

```bash
node create-user.js alice "a-strong-password"
```

By default a new user's root folder is `/`, meaning the entire storage disk.
To confine a user to one folder (and everything under it), pass it as a
third argument — it's a path relative to `STORAGE_ROOT`, created
automatically if it doesn't exist yet:

```bash
node create-user.js bob "another-strong-password" bob
# bob can now only see/upload inside STORAGE_ROOT/bob — nothing else on the disk

node create-user.js alice "a-strong-password" /
# alice keeps full access to everything
```

A user's root folder is baked into their login token, so changing it in the
database only takes effect the next time that user logs in.

Start the API:

```bash
npm run dev
```

You should see `Cloud storage backend listening on http://localhost:4000`.
By default it stores files under `backend/storage/` — drop a few test
files/folders in there to see them show up in the UI, or just upload
through the browser once it's running.

## 3. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**, log in with the user you created, and you
should see the file browser. Vite's dev server proxies `/api` requests to
the backend on port 4000 (see `vite.config.js`), so both need to be running.

## Moving to the Raspberry Pi later- Change `STORAGE_ROOT` in `backend/.env` to the mount point of your external
  HDD (e.g. `/mnt/hdd/storage`).
- Run `npm run build` in `frontend/` to produce static files, and serve them
  either from Express (`express.static`) or behind Nginx/Caddy in front of
  the API.
- Access from outside your LAN via Tailscale or Cloudflare Tunnel, as
  discussed separately — no port forwarding needed.
- Dockerize once this is all confirmed working natively: one image for the
  backend (Node + connects out to MySQL, or bundle MySQL as a sidecar
  container with a docker-compose volume for the HDD mount) and one for the
  frontend (static build served by Nginx, or skip a separate frontend
  container entirely and have Express serve the built files).

## Security notes for this demo

- **SQL injection**: every query uses `mysql2`'s parameterized placeholders
  (`?`), never string-concatenated SQL — the driver escapes values, so
  user input is always treated as data, never as part of the query.
- **XSS**: the frontend is React, which escapes all rendered text by
  default (filenames, breadcrumbs, the text-file preview) — nothing is
  inserted via `dangerouslySetInnerHTML`. Uploaded files are served with
  `X-Content-Type-Options: nosniff` (via `helmet`) so a browser can't be
  tricked into executing a renamed file as a different content type, and
  images (including SVGs, which can contain script) are rendered through
  `<img>`, a context browsers don't execute scripts in.
- **CSRF**: the app authenticates via a `Bearer` token your own JS code
  attaches to each request, not a cookie — a malicious site can't make the
  browser send that token automatically, so there's no CSRF surface here.
- **Password storage**: bcrypt, cost factor 12, unique salt per password
  (embedded in the hash itself).
- **Path traversal**: every file operation resolves the request path
  against `STORAGE_ROOT` and rejects anything that would escape it.
- **Per-user scoping**: each user is confined to their own `root_folder`
  (set via `create-user.js`, stored in MySQL, baked into their JWT). Every
  file route resolves paths relative to that folder and rejects anything
  that would escape it — a user with `root_folder = "bob"` can never see,
  list, search, or write to anything outside `STORAGE_ROOT/bob`, even by
  crafting requests directly. Set a user's `root_folder` to `/` to give
  them the whole disk.
- **Brute force**: `/api/auth/login` is now rate-limited (10 attempts per
  15 minutes per IP) via `express-rate-limit`, on top of bcrypt already
  making each individual guess slow to compute.
- There's no public self-registration endpoint on purpose — users are
  created via `create-user.js` on the server, since this is meant to be
  *your* personal storage, not a public sign-up app.

What's still worth adding before this is reachable from the open internet:
HTTPS (Cloudflare Tunnel or Caddy give you this for free), restricting CORS
to your actual frontend origin instead of `*`, and a shorter JWT expiry with
refresh if you want tighter session control.
