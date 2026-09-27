# Personal Cloud Storage — Demo

A local demo of a personal cloud storage app: React frontend, Node/Express backend,
MySQL for authentication, and files served straight off disk (point it at your
external HDD later on the Raspberry Pi).

```
cloud-storage/
├── backend/     Express API: auth (JWT + bcrypt) + file browser/upload/download
└── frontend/    React (Vite) UI: login, tree sidebar, file list, drag-and-drop upload
```

**Features:** authentication, browse/upload/download, inline preview for images/video/audio/PDF/text with swipe/arrow navigation between files, rename, sorting by name/date/size, recursive search within a folder and its subfolders, recursive folder-size display, responsive layout (mobile drawer sidebar, adaptive columns), per-user storage roots, and a live disk-usage indicator. Uploaded files keep their original date (EXIF capture date for photos, otherwise the source file's own last-modified date) instead of being stamped with the upload time.

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

## Running on a Raspberry Pi (Docker + Tailscale)

On the Pi everything runs in Docker containers, started by
`docker-compose.yml`:

```
Your device (Tailscale) ──HTTPS :443──► tailscale serve (on the Pi, terminates TLS)
                                            │ HTTP → 127.0.0.1:8080
                                            ▼
                        web (nginx :80)  ── /      → React build (static)
                                         └─ /api/* → backend:4000
                        backend (Node :4000) ──► db (MariaDB :3306)
                        backend ──► /data  (= /mnt/hdd/storage on the HDD)
```

Only `127.0.0.1:8080` is published on the Pi, so the app is **not** reachable
from your LAN or the internet — only from devices in your Tailscale network.
No router port forwarding is needed. Files live on the HDD; user accounts live
in the `db_data` Docker volume.

### 1. Prepare the Pi

Use Raspberry Pi OS 64-bit, then install Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER      # log out and back in afterwards
docker compose version             # check it works
```

### 2. Format and mount the HDD (ext4)

This **erases the drive**. Check the device name with `lsblk` first (it is
usually `/dev/sda`, never `mmcblk0`, which is the SD card).

```bash
sudo umount /dev/sda1 2>/dev/null
sudo parted /dev/sda --script mklabel gpt mkpart storage ext4 0% 100%
sudo mkfs.ext4 -L storage /dev/sda1
sudo mkdir -p /mnt/hdd
sudo blkid /dev/sda1               # copy the UUID
```

Add to `/etc/fstab` (`nofail` lets the Pi boot even if the drive is missing):

```
UUID=<the-uuid>  /mnt/hdd  ext4  defaults,nofail  0  2
```

```bash
sudo systemctl daemon-reload
sudo mount -a
sudo mkdir -p /mnt/hdd/storage
sudo chown -R 1000:1000 /mnt/hdd/storage    # uid 1000 = the "node" user in the container
```

Make Docker wait for the drive at boot, so files are never written to the SD
card by mistake. Run `sudo systemctl edit docker` and add:

```ini
[Unit]
RequiresMountsFor=/mnt/hdd
```

### 3. Get the code and configure it

```bash
git clone https://github.com/Peppe9977/cloudstorage.git
cd cloudstorage
cp .env.example .env
nano .env
```

Set `DB_ROOT_PASSWORD`, `DB_PASSWORD` and `JWT_SECRET` to strong, different
values (`openssl rand -hex 32` generates a good one). `.env` is never
committed to git.

### 4. Build and start

```bash
docker compose up -d --build
docker compose ps                   # all three services running, db "healthy"
docker compose logs -f backend      # Ctrl+C to leave
```

The first build takes several minutes on a Pi. The `users` table is created
automatically on first start (`docker/db-init/01-schema.sql`).

Create your first user (see step 2 of the Ubuntu setup for the root-folder
option):

```bash
docker compose exec backend node create-user.js alice "a-strong-password"
```

### 5. HTTPS with Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo systemctl enable --now tailscaled
sudo tailscale up
```

In the Tailscale admin console (login.tailscale.com) enable **MagicDNS** and
**HTTPS Certificates** under DNS. Then publish the app on your tailnet:

```bash
sudo tailscale serve --bg --https=443 http://127.0.0.1:8080
tailscale serve status
```

Open `https://<your-pi>.<your-tailnet>.ts.net` from any device signed in to
your tailnet. Tailscale obtains and renews the Let's Encrypt certificate by
itself. Do **not** use `tailscale funnel`, which would publish the app to the
whole internet.

### 6. Start automatically after a power cut

Every service has `restart: unless-stopped`, so Docker brings the containers
back at every boot. Make sure Docker and Tailscale start at boot too:

```bash
sudo systemctl enable docker containerd tailscaled
```

Test with `sudo reboot`, then check `docker compose ps`, `df -h /mnt/hdd`
(it must show the HDD) and `tailscale serve status`.

### Updating the code

The code is baked into the Docker images, so editing files on the Pi has no
effect until you rebuild. The usual workflow:

1. Change and test on your PC (Ubuntu/WSL) with `npm run dev`.
2. Commit and push:
   ```bash
   git add .
   git commit -m "Describe the change"
   git push
   ```
3. On the Pi, pull and rebuild:
   ```bash
   cd ~/cloudstorage
   git pull
   docker compose up -d --build
   ```

Only images whose files changed are rebuilt, and only their containers are
recreated (a few seconds of downtime). Your database and files are untouched.
To rebuild a single service: `docker compose up -d --build backend` (API) or
`docker compose up -d --build web` (frontend).

Special cases:

- **Only `.env` changed:** run `docker compose up -d` (no rebuild needed).
- **Database schema changes:** `docker/db-init/*.sql` only runs when the
  database volume is empty, so editing it does not change an existing
  database. Apply the change by hand, e.g.
  `docker compose exec db mariadb -uroot -p cloudstorage -e "ALTER TABLE users ADD COLUMN ..."`,
  and update `01-schema.sql` so fresh installs match.
- **Disk space:** old images pile up on the SD card; clean them with
  `docker image prune -f`.
- **Something broke:** `docker compose logs -f backend`, or go back with
  `git checkout <previous-commit>` and rebuild.
- **Never run `docker compose down -v`** — `-v` deletes the database volume
  (and with it all users).

### Backing up the users

Files are on the HDD, but accounts are in the `db_data` volume on the SD card.
Dump them now and then:

```bash
docker compose exec db mariadb-dump -uroot -p cloudstorage > users.sql
```

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
- **Video/audio streaming**: `<video>`/`<audio>` elements fetch their own
  `src` and can't attach our normal `Authorization` header, so putting the
  real login JWT in that URL would have been a genuine downgrade. Instead,
  `POST /api/files/view-token` mints a short-lived (2h) capability token
  scoped to exactly one file (`purpose: 'view'`, that file's path baked in),
  accepted only by `GET /api/files/view`. It's rejected by every other route
  and by `/view` itself for any other path, so a leaked link only ever
  exposes the one file it was minted for, for a limited time — never account
  access.
- There's no public self-registration endpoint on purpose — users are
  created via `create-user.js` on the server, since this is meant to be
  *your* personal storage, not a public sign-up app.

What's still worth adding before this is reachable from the open internet:
HTTPS (the Raspberry Pi setup above gets it from Tailscale) and a shorter JWT expiry with
refresh if you want tighter session control.
