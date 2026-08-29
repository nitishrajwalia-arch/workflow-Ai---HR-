# Deployment

Written for the person putting this on a server. It assumes Ubuntu 24.04 and a
domain, and it does not assume you have seen this codebase before.

Two routes: **Docker** (fewer moving parts) or **systemd** (no container
runtime). Both end up in the same place.

---

## Before anything else

|               |                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| A server      | 2 vCPU / 4 GB RAM is comfortable for 200 people. 1 GB is enough but leaves no headroom for a `pg_dump` while the app is busy. |
| A domain      | e.g. `hr.marbellagroup.in`, pointed at the server                                                                             |
| Ports open    | 80 and 443 only. **Not 4000, not 5432.**                                                                                      |
| PostgreSQL 16 | Local, or a managed instance                                                                                                  |

The API and the database should not be reachable from the internet. Only nginx
should be.

---

## 1. The database

```bash
sudo -u postgres psql
```

```sql
CREATE USER marbella WITH PASSWORD 'use-a-long-random-one';
CREATE DATABASE marbella OWNER marbella;
\c marbella
GRANT ALL ON SCHEMA public TO marbella;
```

**Do not make this user a superuser.** A superuser can drop the append-only
triggers that protect the ledger, which is most of what makes the ledger worth
having. The application never needs that power.

Confirm the triggers exist after your first migration:

```sql
\c marbella
SELECT tgname FROM pg_trigger WHERE tgrelid = 'ledger_entry'::regclass AND NOT tgisinternal;
-- expect: ledger_entry_no_update, ledger_entry_no_delete, ledger_entry_no_truncate
```

If that returns nothing, migrations have not been applied. Stop and fix it
before anyone starts entering real records.

---

## 2. Configuration

```bash
sudo mkdir -p /etc/marbella /var/lib/marbella/uploads
sudo cp .env.example /etc/marbella/hr.env
sudo chmod 600 /etc/marbella/hr.env
```

Edit `/etc/marbella/hr.env`. The four that matter:

```dotenv
DATABASE_URL="postgresql://marbella:the-password@localhost:5432/marbella?schema=public"
JWT_SECRET="<openssl rand -base64 48>"
CORS_ORIGINS=https://hr.marbellagroup.in
TRUST_PROXY=true
UPLOAD_DIR=/var/lib/marbella/uploads
```

- **`JWT_SECRET`** must be genuinely random and at least 32 characters. Changing
  it later signs everyone out, which is exactly what you want if it ever leaks.
- **`TRUST_PROXY=true`** is required behind nginx. Without it every request looks
  to the rate limiter like it came from the proxy, so the whole company shares
  one budget and one person hammering a page locks out everyone else.
- **`UPLOAD_DIR`** must be a **persistent** path. A container filesystem is not
  one: photos written there vanish on the next deploy.

---

## Route A — Docker

```bash
cd /opt/marbella-hr
git clone <repo> . && cd /opt/marbella-hr

# The compose file reads these from the environment.
export POSTGRES_PASSWORD='...'
export JWT_SECRET="$(openssl rand -base64 48)"
export BOOTSTRAP_ADMIN_PASSWORD='a-strong-first-password'

docker compose up -d --build
docker compose logs -f api          # watch it come up
docker compose exec api npx tsx prisma/seed.ts
```

Migrations run automatically on container start (`prisma migrate deploy` in the
image's `CMD`). That command only ever applies migrations that already exist —
it never generates one and never drops anything, which is what makes it safe to
run unattended.

The web container serves the built app on port 80 and proxies `/api` to the API
container. Put the host's nginx (below) in front of that, or map it to 443
directly with a TLS terminator.

**Upgrading:**

```bash
git pull
docker compose up -d --build
```

---

## Route B — systemd, no containers

```bash
sudo useradd --system --home /opt/marbella-hr --shell /usr/sbin/nologin marbella
sudo mkdir -p /opt/marbella-hr && sudo chown marbella:marbella /opt/marbella-hr
sudo chown -R marbella:marbella /var/lib/marbella

sudo -u marbella git clone <repo> /opt/marbella-hr
cd /opt/marbella-hr
sudo -u marbella npm ci
sudo -u marbella npm run build

set -a; . /etc/marbella/hr.env; set +a
sudo -u marbella --preserve-env npm run db:deploy   # apply migrations
sudo -u marbella --preserve-env npm run db:seed     # FIRST TIME ONLY
```

`/etc/systemd/system/marbella-api.service`:

```ini
[Unit]
Description=Marbella HR API
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=marbella
Group=marbella
WorkingDirectory=/opt/marbella-hr/apps/api
EnvironmentFile=/etc/marbella/hr.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5

# The server handles SIGTERM: it stops accepting connections, finishes what it
# is doing, closes the database pool, then exits. Give it room to do that.
KillSignal=SIGTERM
TimeoutStopSec=20

# It needs to read its code and write uploads. Nothing else.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/marbella
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now marbella-api
sudo systemctl status marbella-api
curl -s localhost:4000/health/ready     # {"status":"ready","database":"ok"}
```

Serve the built front end from `/opt/marbella-hr/apps/web/dist`.

---

## 3. nginx and TLS

`/etc/nginx/sites-available/marbella-hr`:

```nginx
server {
  listen 80;
  server_name hr.marbellagroup.in;
  # certbot rewrites this block to redirect to 443.
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name hr.marbellagroup.in;

  # certbot fills these in.
  ssl_certificate     /etc/letsencrypt/live/hr.marbellagroup.in/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/hr.marbellagroup.in/privkey.pem;

  server_tokens off;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  root /opt/marbella-hr/apps/web/dist;
  index index.html;

  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;

  # Asset filenames contain a content hash, so they can be cached for ever.
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # index.html must NEVER be cached: it is what points at the current asset
  # hashes. A cached one sends returning users to files that no longer exist,
  # and the symptom is a blank page after every deploy.
  location = /index.html {
    add_header Cache-Control "no-store, must-revalidate";
  }

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    # Required: the API rate-limits per IP and TRUST_PROXY=true makes it read
    # this header. Omit it and everyone shares one budget.
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m;    # photo uploads
    proxy_read_timeout 60s;
  }

  location /uploads/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    expires 7d;
  }

  # Single-page app: an unknown path is a route, not a missing file.
  location / { try_files $uri $uri/ /index.html; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/marbella-hr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d hr.marbellagroup.in
```

**Serve the app and the API from the same origin**, as above. The refresh token
is a `SameSite=Strict` cookie; splitting them across origins means weakening
that, and there is nothing to gain from it here.

---

## 4. First-run checklist

Work through all of it before handing over.

- [ ] `curl https://hr.marbellagroup.in/api/v1/health/ready` returns
      `{"status":"ready","database":"ok"}`
- [ ] The three `ledger_entry` triggers exist (query in section 1)
- [ ] Sign in as the bootstrap administrator and **change the password**
- [ ] Create a real account for each person who needs one, with the lowest role
      that lets them do their job. `ADMIN` is for whoever administers the system,
      not for everyone in HR.
- [ ] Confirm a `VIEWER` account cannot reach `/api/v1/salaries` (expect 403)
- [ ] `/api/v1/ledger/verify` returns `{"ok":true, ...}`
- [ ] Upload one photo and confirm the file lands in `UPLOAD_DIR` and survives a
      restart
- [ ] Take a backup, **restore it into a scratch database, and confirm it
      opens.** A backup you have never restored is a hope, not a backup.
- [ ] Tell whoever uses this that "email a letter" **records** the letter and
      does not send it. That is on the screen, but say it out loud too.

---

## 5. Backups

```bash
sudo mkdir -p /var/backups/marbella && sudo chown postgres /var/backups/marbella
```

`/etc/cron.d/marbella-backup`:

```cron
# Nightly at 02:15. -Fc is the compressed custom format, restored with pg_restore.
15 2 * * * postgres pg_dump -Fc marbella > /var/backups/marbella/marbella-$(date +\%F).dump 2>>/var/log/marbella-backup.log
# Keep 30 days.
30 3 * * * postgres find /var/backups/marbella -name '*.dump' -mtime +30 -delete
```

Back up `/var/lib/marbella/uploads` too — photos are not in the database.

**Copy both off the server.** A backup that lives only on the machine it is
backing up does nothing for the failure that actually happens.

Restoring:

```bash
sudo -u postgres createdb marbella_restore_test
sudo -u postgres pg_restore -d marbella_restore_test /var/backups/marbella/marbella-2026-08-29.dump
sudo -u postgres psql -d marbella_restore_test -c 'SELECT count(*) FROM person;'
```

---

## 6. Upgrading

```bash
cd /opt/marbella-hr
sudo -u marbella git pull
sudo -u marbella npm ci
sudo -u marbella npm run build
set -a; . /etc/marbella/hr.env; set +a
sudo -u marbella --preserve-env npm run db:deploy
sudo systemctl restart marbella-api
```

Order matters: migrations before the restart. `migrate deploy` never drops
anything, so it is safe to run against a live database — but take the backup
first anyway.

---

## 7. When something is wrong

| Symptom                             | Look here                                                                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server will not start               | It prints the missing settings **by name**. Read that first — it is usually the whole answer.                                                                        |
| `/health/ready` returns 503         | The database is unreachable. Check `DATABASE_URL` and that Postgres is running.                                                                                      |
| Everyone is rate limited at once    | `TRUST_PROXY` is not `true`, or nginx is not sending `X-Forwarded-For`.                                                                                              |
| Blank page after a deploy           | `index.html` is being cached. See the nginx block above.                                                                                                             |
| Signed out on every page refresh    | The refresh cookie is not reaching `/api/v1/auth`. Check that the app and API share an origin, and that the site is on HTTPS (the cookie is `Secure` in production). |
| A user quotes an error id           | `journalctl -u marbella-api \| grep req-xxxxxxxx`. Every error response carries one and it finds the full stack trace.                                               |
| "ledger is append-only" in the logs | Something tried to modify the ledger. **Investigate it.** Nothing in this codebase does that.                                                                        |

Logs: `journalctl -u marbella-api -f`, or `docker compose logs -f api`.
They are JSON in production — pipe through `jq` if you want them readable.

---

## What is deliberately not set up

Say these to whoever is paying, rather than letting them assume otherwise.

- **No mail gateway.** "Email a letter" records the letter and does not send it.
  The API returns `delivered: false` and says why. Wire it up in
  `apps/api/src/modules/documents.routes.ts` — there is one clearly marked place.
- **No object storage.** Photos go to local disk. To move to S3 or R2, replace
  `storeFile` in `apps/api/src/modules/uploads.routes.ts`. Nothing else changes.
- **No SSO or two-factor authentication.** Email and password only.
- **Salary is not encrypted at the column level.** Anyone with database access
  reads it. Keep database access short and use an encrypted volume.
- **One API instance.** It will scale to several without change (it holds no
  session state in memory), but nothing here sets that up.
