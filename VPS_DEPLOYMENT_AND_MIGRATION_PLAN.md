# 🩺 Doctor Tracker · VPS deployment & data migration record

![Status](https://img.shields.io/badge/status-live-16A34A?style=flat-square) ![Hosting](https://img.shields.io/badge/hosting-Hostinger_KVM_4_VPS-673DE6?style=flat-square) ![Web](https://img.shields.io/badge/web-Next.js_16-111827?style=flat-square) ![API](https://img.shields.io/badge/API-Express_5-2E7D32?style=flat-square) ![Data](https://img.shields.io/badge/data-MongoDB_8-47A248?style=flat-square)

> [!NOTE]
> **Implemented on 22 October 2026 (Asia/Dhaka).** This document started as the deployment plan and now records what was built and verified. The file name is unchanged so existing links keep working. The plan's central promise held: every existing website on the shared VPS matched its pre-deployment baseline at every checkpoint, and no existing service was restarted.

**The approach:** Doctor Tracker runs as an isolated guest on a shared VPS. It reuses no existing site's domain, application folder, database, service, PHP pool or Nginx file. The only shared-platform action was a tested, graceful Nginx reload.

## 🌍 Live addresses

| Purpose              | Address                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| 🖥️ Staff web app     | [doctor-tracker.58def4e4.nip.io](https://doctor-tracker.58def4e4.nip.io)                              |
| 🔌 REST API          | [doctor-tracker-api.58def4e4.nip.io/api/v1](https://doctor-tracker-api.58def4e4.nip.io/api/v1/health) |
| 📖 API documentation | [doctor-tracker-api.58def4e4.nip.io/api/docs](https://doctor-tracker-api.58def4e4.nip.io/api/docs)    |
| 🩺 Health checks     | Web `/api/health` (checks the API and database) · API `/api/v1/health`                                |

Both names encode the VPS public IPv4, **88.222.244.228**, in hexadecimal through `nip.io`, so no existing website's DNS zone was edited. Before launch they resolved correctly through Cloudflare, Google, Quad9 and OpenDNS. One Let's Encrypt ECDSA certificate covers both names and renews automatically; the next expiry is **20 January 2027**. HTTP redirects to HTTPS (308), and both hosts negotiate HTTP/2 over TLS 1.2/1.3.

> [!IMPORTANT]
> **This is a public demo on synthetic data.** At the owner's request the demo accounts remain public: the sign-in page's **Use admin demo** and **Use viewer demo** buttons fill them. Anyone can therefore change demo records; nightly backups make a restore possible. Never enter real patient data on this deployment.

## 🏗️ What runs where

```text
Browser
  │ HTTPS · TLS 1.2/1.3 · HTTP/2
  ▼
Nginx · two new vhosts, own logs and limits
  ├─▶ Next.js 16 · 127.0.0.1:3100
  │     │ server-only API_URL over loopback
  └─▶ Express 5 · 127.0.0.1:4100
        │
        ▼
MongoDB 8 · loopback + auth · doctor_tracker
```

| Component     | Implementation                                                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server        | Hostinger KVM 4 · Ubuntu 24.04.5 · 4 vCPU · 15 GiB RAM · Nginx 1.24 · Node.js 24.21 · MongoDB 8.0                                                                                |
| App identity  | System user `doctortracker` with no shell or password. Release code is root-owned and read-only to it; only Next.js's `.next/cache` is writable.                                 |
| Releases      | `/srv/doctor-tracker/{web,api}/releases/<UTC time>-<commit>/` with an atomically switched `current` symlink; the last five releases are kept                                     |
| Configuration | `/etc/doctor-tracker/{web,api}.env`, root-owned and readable by the app group only. Secrets were generated on the server and are never stored in Git.                            |
| Services      | `doctor-tracker-web` (`next start`, ≤ 2 CPUs, ≤ 1 GiB) and `doctor-tracker-api` (`node src/server.js`, ≤ 1 CPU, ≤ 512 MiB), each sandboxed by systemd (exposure score 1.5, "OK") |
| Nginx         | `doctor-tracker-web.conf`, `doctor-tracker-api.conf` and `snippets/doctor-tracker-proxy.conf`; exact server names only, and unknown hosts are still rejected                     |
| Database      | `doctor_tracker` on the existing loopback MongoDB. `doctor_tracker_app` may read and write only this database; `doctor_tracker_backup` may only read it.                         |
| Backups       | `doctor-tracker-mongodb-backup.timer` daily at about 04:10, clear of the existing backup windows; 14-day retention with a SHA-256 file per archive                               |

**Routing.** The web host sends every path, including `/api/*`, to Next.js. Its same-origin bridge attaches the session token and calls Express over loopback. Nginx passes `Host` and `X-Forwarded-Proto` exactly, because the bridge's origin check depends on them. Proxy buffering is off for the web host so streamed pages arrive promptly, and no shared cache stores authenticated pages or API responses. The API host serves direct clients, health checks and Swagger; its `/` redirects to `/api/docs/`.

**Protection.** Only ports 22, 80 and 443 are public; 3100, 4100 and 27017 are unreachable from the internet. Sign-in POSTs are limited to 10 per minute per IP (burst 10) on both hosts, in addition to the API's per-email login limiter. Both hosts send HSTS (Nginx for the web app, Helmet for the API) and `X-Robots-Tag: noindex`. The API logs only warnings and errors; request lines live in each vhost's Nginx access log.

## 🪜 What was done, gate by gate

### 0 · Audit and baseline — no changes ✅

- **Server:** a read-only audit found about 13 GiB free RAM, 164 GiB free disk, a load of about 0.5 and a clean `nginx -t`. Ports 3100 and 4100 were free, and nothing named Doctor Tracker existed yet. UFW allowed only 22/80/443; SSH accepted keys only, with root login disabled; Fail2Ban and unattended upgrades were active.
- **Existing estate:** an existing Next.js site and seven WordPress/PHP sites, 24 hostnames in total. The baseline was 50 external probes pinned to the VPS IP: every hostname over HTTP and HTTPS, plus the unknown-host rejection. Each probe recorded status, redirect target, certificate validity, page title and latency.
- **Source data:** Atlas `doctor_tracker_dev` ran MongoDB 8.0.34 and held three collections (48 doctors, 1,500 patients, 2 users) with 15 indexes, 683,759 bytes in total. There were no orphan patients, and all eight photo URLs point to WebP files in the frontend's `public/` folder.
- **Quality gates:** backend lint and all five tests passed. Frontend lint reported one existing style finding in the Settings view with no runtime effect.

### 1 · Identity and secrets ✅

- Created the `doctortracker` user, the directories and the root-owned environment files.
- Generated a **new** production JWT secret; the development secret was not reused.
- Created the MongoDB users through the server's administrator account and confirmed that the app's privileges are limited to `doctor_tracker`.

### 2 · Builds and trial migration ✅

- **Pinned code:** web `fb2e9c0` and API `be1ffe5`, shipped as `git archive` tarballs whose SHA-256 was verified on the server. The private task PDF was excluded.
- **Builds:** each ran as the app user in a capped transient systemd unit with `npm ci --ignore-scripts`. The web build took 52 s; the API needed production dependencies only (3 s). During the build, live sites kept their normal response times; load peaked at about 3 on 4 vCPUs, with at least 11.6 GiB RAM free.
- **Trial restore:** a compressed BSON dump was taken on the developer PC, using a private config file so the URI never appeared on a command line, then copied over SSH. A `mongorestore --dryRun` came first, followed by the restore into an empty `doctor_tracker_stage` database, with namespace mapping, `--stopOnError` and no `--drop`.
- **Trial result:** 1,550 documents with 0 failures and all 15 indexes. Each collection's SHA-256 over its raw BSON in `_id` order matched Atlas byte for byte.

### 3 · Nginx and HTTPS ✅

- Added HTTP-only vhosts (ACME challenge and redirect), passed `nginx -t` and reloaded gracefully. All 50 baseline probes were unchanged.
- Ran a Let's Encrypt staging dry run, then issued the certificate through the existing `/var/www/certbot` webroot. The server's existing renewal hook reloads Nginx after each renewal.
- Added the HTTPS vhosts, passed `nginx -t` and reloaded gracefully. All 50 probes were unchanged.

### 4 · Final cutover ✅

- **Freeze:** no local process was writing to Atlas, and fingerprints taken before and after the final dump were identical.
- **Final restore:** the dump went into a new, empty `doctor_tracker` database and matched Atlas byte for byte: the same counts, BSON hashes, indexes and integrity checks.
- **Demo passwords:** they were rotated before launch as planned, then restored at the owner's request so the public demo buttons work.
- **Start-up:** the API started first, then the web app, each gated by a health check. Twenty-seven loopback checks passed:
  - health, sign-in, search, filters, analytics and roles;
  - creating, editing and deleting a disposable record;
  - the bridge's verification of API-signed sessions, its CSRF origin guard, and the image optimizer.

### 5 · Acceptance ✅

- **From outside the VPS:**
  - a valid certificate over TLS 1.3, HTTP-to-HTTPS redirects, and signed-out redirects;
  - 401 responses without a session, and CORS limited to the web origin;
  - Swagger online, and internal ports closed.

  A second, independent network also reached both hosts.

- **Real browser:** 15 checks in headless Chrome with a fresh profile:
  - sign-in through the Server Action, with an HttpOnly, Secure, SameSite=Lax cookie;
  - the dashboard showing 48 doctors and 1.5K patients;
  - the doctor directory, a doctor portrait, filtered patients and settings;
  - origin-checked writes, a 390 px mobile layout without horizontal scrolling, and sign-out;
  - no console errors throughout.
- **Existing estate:** at the final checkpoint, all 50 probes still matched the baseline. Nginx, the existing Next.js service, PHP-FPM, MySQL, MongoDB and Fail2Ban were never restarted, and no unit failed.
- **Resources:** peak memory was 151 MiB for the web app and 51 MiB for the API; about 12 GiB of RAM remained available after launch.
- **Backups:** the first archive from the nightly job was verified, and a restore drill into a scratch database matched live data byte for byte. The staging database, the drill database and the temporary migration identity were then removed. The final Atlas export is kept on the server, and the Atlas source remains untouched.

## 🔁 Operating the deployment

Only committed code is deployed. On the developer PC (Git Bash):

```bash
# Frontend repository
git archive --format=tar.gz -o web.tar.gz HEAD -- . ':(exclude)*.pdf'
# Backend repository
git archive --format=tar.gz -o api.tar.gz HEAD
scp web.tar.gz api.tar.gz <ssh-user>@<vps>:
```

On the VPS (deploy the API first when both change):

```bash
sudo doctor-tracker-release deploy api ~/api.tar.gz
sudo doctor-tracker-release deploy web ~/web.tar.gz
sudo doctor-tracker-release list web       # * marks the live release
sudo doctor-tracker-release rollback web   # previous release of this component only
```

`doctor-tracker-release` builds as the app user inside a capped unit (2 CPUs, 3 GB), seals the release read-only and switches `current` atomically. It restarts only that component and waits for its health check, rolling back automatically if the check fails. The JWT settings in `web.env` and `api.env` must stay identical; changing `JWT_SECRET` signs everyone out.

| Routine check | Command                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Health        | `curl -s https://doctor-tracker-api.58def4e4.nip.io/api/v1/health`                               |
| Services      | `systemctl status doctor-tracker-web doctor-tracker-api`                                         |
| Logs          | `journalctl -u doctor-tracker-web -u doctor-tracker-api` · `/var/log/nginx/doctor-tracker-*.log` |
| Backups       | `systemctl list-timers doctor-tracker-mongodb-backup.timer`                                      |

### 🛟 Rollback by layer

| Failure                    | Least disruptive response                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bad web or API release     | `sudo doctor-tracker-release rollback web` (or `api`). Only that component's `current` link and unit change.                                         |
| Bad routing or certificate | Remove only the two Doctor Tracker links from `sites-enabled`, run `nginx -t`, reload gracefully, then recheck the other sites                       |
| Data problem               | Restore a nightly backup into a **scratch** database first and compare. Never run `mongorestore --drop` or the demo seeder against `doctor_tracker`. |
| Shared VPS pressure        | `sudo systemctl stop doctor-tracker-web doctor-tracker-api` and disable the two vhosts; every other site keeps running                               |

A whole-VPS snapshot is a last resort only: restoring it would also roll back every other site.

### 🔒 Isolation rules that remain in force

1. Change only Doctor Tracker's own files, units, vhosts and databases. Never edit another site's folders, services, PHP pools, Nginx files or data.
2. Validate every Nginx change with `nginx -t`, then reload gracefully instead of restarting.
3. Never restart the existing Next.js service, PHP-FPM, MySQL or MongoDB to deploy Doctor Tracker.
4. Never run `npm run seed`, `--drop` restores or unreviewed `npm run db:indexes` against `doctor_tracker`; `syncIndexes()` can drop indexes.
5. After any shared-platform change, probe every existing website and compare the results with its baseline.

## 📌 Open items

- **Offsite backups:** add an encrypted offsite copy of the Doctor Tracker backups, which currently live only on the VPS.
- **Landing page:** decide whether `/` should show the public landing page; `next.config.mjs` still redirects it to `/dashboard`.
- **Screenshots:** commit desktop and mobile screenshots for both READMEs.
- **Address stability:** if the VPS IP changes, both `nip.io` names, the certificate and the API's CORS origin must change together. A custom domain would make the address permanent.
- **Scaling:** each app runs as a single instance by design. Scaling out needs shared cache and rate-limit state, plus coordinated Next.js deployment IDs and encryption keys.

## 📚 References

- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting) — reverse proxy, `next start`, streaming and single-instance caching.
- [MongoDB `mongodump`](https://www.mongodb.com/docs/database-tools/mongodump/) and [`mongorestore`](https://www.mongodb.com/docs/database-tools/mongorestore/) — BSON archives, namespace mapping and dry runs.
- [`nip.io`](https://nip.io/) and [Let's Encrypt rate limits](https://letsencrypt.org/docs/rate-limits/) — public DNS and certificate constraints.
- [systemd service management](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html) and [`systemd.exec` sandboxing](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html).
