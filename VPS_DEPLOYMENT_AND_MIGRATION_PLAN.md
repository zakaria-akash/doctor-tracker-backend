# 🩺 Doctor Tracker · VPS deployment & data migration blueprint

![Status](https://img.shields.io/badge/status-planning_only-F59E0B?style=flat-square) ![Hosting](https://img.shields.io/badge/hosting-Hostinger_VPS-673DE6?style=flat-square) ![Web](https://img.shields.io/badge/web-Next.js_16-111827?style=flat-square) ![API](https://img.shields.io/badge/API-Express_5-2E7D32?style=flat-square) ![Data](https://img.shields.io/badge/data-MongoDB_8-47A248?style=flat-square)

> [!IMPORTANT]
> **This is a plan, not a deployment record.** The VPS audit was read-only on **22 October 2026 (Asia/Dhaka)**. No server, DNS, database, or existing website was changed. Every execution step below requires your separate permission. The recently taken VPS snapshot was reported by the owner; its identity and restore readiness still need verification.

**The promise:** deploy Doctor Tracker as a new, isolated guest on the shared VPS. Never reuse an existing site's domain, application folder, database, service, PHP pool, or Nginx file. Before and after the one necessary _graceful Nginx reload_, prove that every existing site still works.

**The practical limit:** a shared VPS can never offer an absolute zero-impact guarantee: CPU, RAM, disk, Nginx, and MongoDB are shared. This plan minimizes and tests that risk. If _strict_ isolation is mandatory, a second VPS is the only reliable boundary.

## 🌍 Public addresses and launch gate

| Purpose                       | Planned address                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------- |
| 🖥️ Staff web app              | [doctor-tracker.58def4e4.nip.io](https://doctor-tracker.58def4e4.nip.io)         |
| 🔌 REST API and documentation | [doctor-tracker-api.58def4e4.nip.io](https://doctor-tracker-api.58def4e4.nip.io) |

Both names use the hexadecimal encoding of the VPS public IPv4, **88.222.244.228**. The replacement hostnames' A records resolved correctly through **Cloudflare (1.1.1.1)** and **Google (8.8.8.8)** during this documentation update. The hex form does not hide the public IP from DNS lookups. `nip.io` needs no zone edits to any existing website domain. Nginx will serve the new names on the already-open public ports **80/443**; the applications and MongoDB remain bound to loopback.

> [!WARNING]
> DNS resolution is not proof of worldwide availability. HTTPS certificates, real requests from at least two external networks/regions, and renewal must pass before announcing the site. Some networks may block dynamic-IP DNS names. `nip.io` is a third-party dependency, and an IP change changes both hostnames and requires new certificates. Never advertise the HTTP version: secure login cookies require HTTPS.

**Fast visual route:** 🟦 Audit → 🟨 Isolated staging → 🟪 Trial restore → 🟧 Write freeze → 🟩 HTTPS launch → 🛟 Observe/rollback.

## 🏠 What is already on the VPS — protect it

The read-only audit found **Ubuntu 24.04.5**, **4 vCPU**, **15 GiB RAM**, about **164 GiB free disk**, **Nginx 1.24**, **Node 24.21**, and **MongoDB 8.0.32**. UFW permits only SSH/HTTP/HTTPS; Fail2Ban protects SSH. MongoDB authorization is enabled and it listens only on the loopback interface, port **27017**. There is no detected Docker or PM2 deployment to imitate. Ports **3100** and **4100** were unused at audit time; recheck them immediately before use.

| Existing estate           | Current separation                                                             | Protected boundary                                                                           |
| ------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `www.carebangla.com.bd`   | Next.js via `carebangla.service`, loopback port `3000`, release/current layout | Do not edit its service, releases, environment, or Nginx vhost.                              |
| Seven WordPress/PHP sites | Separate document roots and PHP-FPM pools                                      | Do not edit site roots, pools, PHP settings, or MySQL data.                                  |
| Shared platform           | Nginx, MongoDB, MySQL, Certbot, UFW, Fail2Ban, backup timers                   | Add only Doctor Tracker-scoped resources; never reconfigure another application's resources. |

The seven PHP sites are **greenoxygenbd.com**, **imranhomecare.com**, **medicalshop.com.bd**, **www.nursinghomecarebd.com**, **www.oxygencylinderbd.com**, **billing.imranhomecare.com**, and a **baby-care temporary `nip.io` site**. The new `doctor-tracker` names must not match any of their server names.

The existing `carebangla-mongodb-backup.timer` and `kvm4-restic-backup.timer` are active. Their coverage of a _new_ Doctor Tracker database is **unverified**; do not assume the new data is backed up by them. Certbot's renewal timer is active, and `/var/www/certbot` is already the ACME webroot.

### 🔒 Non-negotiable no-touch rules

1. **Files:** create only new Doctor Tracker directories and new, uniquely named Nginx/systemd files. No edits in `/srv/www/*`, the CareBangla app tree, or existing Nginx vhost files.
2. **Services:** add `doctor-tracker-web.service` and `doctor-tracker-api.service`; never restart `carebangla.service`, PHP-FPM, MySQL, or MongoDB merely to deploy this app.
3. **Data:** restore into newly named databases only. Do not run `mongorestore --drop`, the application's destructive `npm run seed`, a whole-server database restore, or unreviewed `npm run db:indexes` (`syncIndexes()` may drop indexes).
4. **Traffic:** keep the existing default/unknown-host rejection and all old vhosts intact. Validate _all_ Nginx configuration with `nginx -t`, then use a graceful reload, not a restart.
5. **Capacity:** build one repo at a time during a quiet window; set measured memory/CPU limits for the new services; watch free RAM, swap, MongoDB load, and site latency before proceeding.
6. **Proof:** capture HTTP responses for every existing site before the change and compare them after Nginx reload, cutover, and the observation window. Stop and roll back the new vhosts if any baseline regresses.

## 🧱 Proposed isolated layout

| New component           | Proposed location or binding                              | Why                                                                       |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| Dedicated Unix identity | `doctortracker`                                           | App processes cannot write another site's files.                          |
| Frontend releases       | `/srv/doctor-tracker/web/releases/<release>/` → `current` | Build separately and switch releases atomically.                          |
| Backend releases        | `/srv/doctor-tracker/api/releases/<release>/` → `current` | Independent API rollback.                                                 |
| Private configuration   | `/etc/doctor-tracker/web.env` and `api.env`               | Keep secrets outside Git and public files; root-owned, app-readable only. |
| Web process             | loopback port `3100`                                      | One `next start` process behind Nginx.                                    |
| API process             | loopback port `4100`                                      | One Express process behind Nginx.                                         |
| Production database     | `doctor_tracker` on existing loopback MongoDB             | Dedicated database and least-privilege `doctor_tracker_app` user.         |
| Trial database          | `doctor_tracker_stage`                                    | Rehearsal never touches production or other databases.                    |
| New Nginx vhosts        | `doctor-tracker-web` and `doctor-tracker-api`             | Exact `nip.io` server names; no edits to old files.                       |
| Migration/backup area   | `/var/backups/doctor-tracker/`                            | Private, separate from site roots and app releases.                       |

The browser should use **the web hostname** and its existing same-origin `/api/*` bridge. Nginx must send **all web-host paths, including `/api/*`, to Next.js**; routing that prefix directly to Express would bypass the frontend's session bridge and origin checks. Next.js calls the API privately over the loopback interface on port **4100**, under `/api/v1`. The API hostname is for direct API clients, health checks, and Swagger at `/api/docs`; the browser does not depend on it for normal app use.

For both vhosts, preserve `Host`, the real client IP, and `X-Forwarded-Proto`; the web bridge compares the request origin with these values. Disable proxy buffering for the Next.js vhost so streamed pages arrive promptly. Do **not** add a shared Nginx cache for authenticated pages or API responses. Keep public exposure to **80/443** only; do not open 3100, 4100, or 27017 in UFW.

## 🪜 Execution plan, with stop/go gates

### 0 · 🧭 Preflight and baseline — no changes

- Record the exact Git commits of both repositories, VPS snapshot identifier, current free resources, service status, listening ports, Nginx config test, and certificate/backup timer status.
- From outside the VPS, record HTTP status, redirect destination, TLS validity, and a representative page for **each of the eight existing sites**. Save this as the before/after baseline.
- Recheck that both proposed `nip.io` names resolve to `88.222.244.228` through multiple public resolvers; check there are no conflicting Nginx `server_name` entries and that 3100/4100 remain free.
- Inventory Atlas `doctor_tracker_dev`: source MongoDB version/feature compatibility, size, every collection and index, record counts, roles, photos/files, and any extra custom fields. Confirm there is enough disk for **two archives, trial data, final data, and normal headroom**.
- Before public launch, decide whether `/` should be a public landing page: the current frontend `next.config.mjs` redirects it to `/dashboard`. Browser-local Settings are not shared server settings.

**Gate:** if the old-site baseline is already failing, capacity is tight, Atlas cannot be read safely, or the snapshot/backup cannot be verified, pause rather than deploying into uncertainty.

### 1 · 🔐 Prepare production identity and secrets

- Create a dedicated Unix user and only the new directories/files above. Restrict release writes to that user; keep migration archives and secrets inaccessible to the web server and other site users.
- Generate a **new production JWT secret**. The development MongoDB URI and JWT material previously shared in chat must not be copied into this document, commits, logs, or screenshots. A new JWT signs future sessions; old sessions will need to sign in again.
- Configure the web with server-only `API_URL` pointing to the private API v1 endpoint on loopback port **4100**, plus matching `JWT_SECRET`, `JWT_ISSUER`, and `JWT_AUDIENCE` values. Do not put any of them in `NEXT_PUBLIC_*` variables.
- Configure the API with `NODE_ENV=production`, `HOST` bound to loopback only, `PORT=4100`, a **new local** `MONGODB_URI` for `doctor_tracker`, matching JWT fields, `CORS_ORIGINS` set to the HTTPS web `nip.io` origin, `APP_TIMEZONE=Asia/Dhaka`, and deliberate bcrypt/log settings.
- Use a MongoDB user with only the permissions this app needs on `doctor_tracker`. Create it separately from the data restore; do not reuse an existing site's MongoDB identity.

**Gate:** secrets are readable only by the new app identity, not present in Git or public responses, and the two applications agree on issuer/audience/signing key.

### 2 · 📦 Build isolated releases, then trial-run the data

- Pin both repos to reviewed commits. Install from their lockfiles (`npm ci`), run frontend lint/build and backend lint/tests, and build the frontend **off-peak and one repo at a time**. The backend is a Node service; it does not have a Next-style build step.
- Keep frontend `public/images/` and all WebP doctor portraits in each web release. Identify any photo URL that points outside the repo; copy/retain its actual file or confirm its external host remains available. A database row alone does not migrate a photo binary.
- Take a **BSON** dump of the _entire_ Atlas `doctor_tracker_dev` database from a trusted client using MongoDB Database Tools. Use a private config file, compressed archive, restricted permissions, and checksums; avoid putting the Atlas URI/password in a shell command or log. Prefer transferring the archive over SSH rather than opening Atlas access to the VPS unless needed.
- Dry-run namespace mapping from `doctor_tracker_dev.*` to **empty** `doctor_tracker_stage.*`, then restore to that trial database. Preserve `_id` values, BSON dates, indexes, and all collections; do not import CSV/JSON as a substitute and do not use `--drop`.
- Compare counts per collection, important sample records and hashes, unique indexes, roles/password-hash presence, doctor↔patient references, missing images, search/filter behavior, and analytics totals. Specifically check for orphan `patients.doctor` references and any custom collections beyond users/doctors/patients.
- Rotate/remove fixed demo credentials before exposing the restored users to the internet. If test users must remain, give them non-privileged roles and unique secrets.

**Gate:** the trial restore and app checks pass without changing any existing MongoDB database. Fix source-data or app compatibility issues before scheduling cutover.

### 3 · 🌐 Add only new vhosts and obtain HTTPS

- Add two **new** exact-name HTTP vhosts with an ACME challenge location using existing `/var/www/certbot`; do not use a catch-all that could intercept another site. Keep the current unknown-host rejection intact.
- Run `nginx -t`. Only after it passes, gracefully reload Nginx and immediately compare all existing site baseline checks. If any old site regresses, disable only the new vhosts and reload after another config test.
- Obtain a Let's Encrypt certificate covering both `nip.io` names using HTTP-01. Start with a staging/dry-run validation to avoid unnecessary issuance attempts; verify production issuance, HTTPS redirects, chain, and renewal dry-run. `nip.io` has shared-domain issuance limits, so issuance is a **gate**, not an assumption.
- Point the web vhost to 3100 and API vhost to 4100. Retain security headers and sensible body/time limits; do not alter global settings or old vhosts merely to support this app.

**Gate:** both hostnames show valid HTTPS, Nginx serves the intended application, and all old sites still match baseline. Do not cut over data on HTTP-only hosting.

### 4 · 🟧 Final Atlas → VPS cutover

1. Announce a short maintenance/write-freeze window. Block writes to the **source Doctor Tracker app only**; do not place other VPS sites into maintenance. Atlas shared/free deployments may not support an oplog-based zero-downtime export, so plan for a real freeze.
2. Take a new final, compressed BSON dump of _all_ `doctor_tracker_dev` collections. Verify archive integrity and preserve the untouched source as the immediate rollback source.
3. Restore with namespace mapping into a **new, empty** `doctor_tracker` database. Do not run `--drop`; if a retry is needed, stop and inspect exactly what was written before choosing a safe recovery path.
4. Re-run count, index, reference, account, media, and analytics checks against the final target. Confirm the dedicated database user can read/write only `doctor_tracker`.
5. Start the API service first, then the web service, each as a single instance with auto-restart and conservative resource limits. Check local health before allowing public traffic: API `/api/v1/health`, then web `/api/health` (which checks API plus DB).
6. Enable the final HTTPS routing and run external sign-in, dashboard, doctor/patient read-and-write, search/filter, and role-permission checks. End the freeze only after the final source/target counts and user workflows agree.

**Gate:** no public launch until final reconciliation, secure HTTPS, correct roles, and the old-site baseline all pass. Keep the source Atlas database untouched through the observation period.

### 5 · ✅ Public reach and no-regression acceptance

Use a browser and HTTP probes from **at least two independent external networks/regions**, not only from the VPS itself. Confirm:

- 🌍 Both `nip.io` hostnames resolve to the VPS and respond through HTTPS, with valid certificates and redirects; test mobile as well as desktop.
- 🩺 Web `/api/health` and API `/api/v1/health` are healthy; API `/api/docs` is reachable only as intentionally configured.
- 🔐 Sign-in and sign-out work over secure cookies; a viewer cannot mutate records, while an admin can perform a controlled create/edit/delete test without touching real patient data.
- 🧾 Atlas→VPS record counts, IDs, relationships, images, search, analytics, and timezone-sensitive dates match the approved migration report.
- 🏘️ **Every existing website** still matches its before-state for TLS, redirects, representative pages, and latency. `carebangla.service`, PHP pools, MySQL, MongoDB, and backup timers remain healthy.
- 📉 New app CPU/RAM and MongoDB connections stay within a measured budget; no port other than 22/80/443 became public. Inspect only the two new service logs for app errors, without logging secrets or personal records.

If a network cannot resolve `nip.io`, document the region/resolver and test another resolver. The plan can make the app publicly reachable worldwide in ordinary conditions, but no operator can guarantee access from _every_ network because third-party DNS, local filtering, and internet routing are outside the VPS's control.

## 🛟 Backups, operations, and rollback

**Before launch:** verify the owner-reported VPS snapshot and an independent, encrypted offsite backup. A full-VPS snapshot is a last-resort disaster tool: restoring it would also roll back **other sites**, so never use it as the routine Doctor Tracker rollback.

**After launch:** add a _Doctor Tracker-only_ database backup and encrypted offsite copy, scheduled away from the existing MongoDB/Restic backup windows. Monitor backup success, certificate expiry/renewal, disk free space, memory, service restarts, `/api/health`, and all existing sites. Periodically restore a backup to a temporary, separately named database and prove that it works. Verify whether the existing Restic job covers the new `/srv/doctor-tracker` and `/etc/doctor-tracker` paths; do not assume it does or edit its job without a separate review.

**Rollback by layer:**

| Failure                                | Least disruptive response                                                                                                                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bad web or API release                 | Switch **only that app's** `current` symlink back to its last healthy release and restart only its systemd unit. Keep old release assets available long enough for active browsers to refresh. |
| Bad new Nginx routing/certificate      | Disable or correct **only** Doctor Tracker's two vhosts, test full Nginx config, then gracefully reload. Recheck all old sites.                                                                |
| Data migration issue before new writes | Keep the Doctor Tracker app closed, correct the target from the protected Atlas export, then revalidate; the Atlas source remains available.                                                   |
| Data issue after new writes            | **Do not blindly switch back to Atlas**: that would lose new records. Freeze writes, export/reconcile the VPS delta, choose a verified recovery point, then reopen.                            |
| Shared VPS pressure                    | Stop the two new units and remove their new vhosts from traffic; leave all pre-existing services and data alone.                                                                               |

## 🔭 Future-proofing, without premature complexity

- Keep **one Next.js process and one API process** at first. Next's default cache is per instance; the API's login limiter and analytics cache are in memory. Horizontal scaling needs shared cache/rate-limit state and coordinated Next deployment IDs/encryption keys—not just another process.
- Preserve release history and a machine-readable migration checklist. Add monitoring and a separate backup/restore drill before optimizing for scale.
- If the VPS public IP changes, update both encoded hostnames, certificates, and API CORS origin together. If long-term brand stability becomes important, move later to a **new domain chosen by the owner**; this plan deliberately does not borrow any domain/subdomain from existing VPS sites.
- Treat Doctor Tracker as a coordination app containing sensitive records: minimum-access accounts, encrypted backups, no real patient data in screenshots/logs, and an explicit retention/privacy policy are required before real-world use.

## 📚 Reference and scope notes

- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting) — reverse proxy, `next start`, streaming, and single-instance cache behavior. The installed Next.js 16.4.2 local guide was also checked.
- [MongoDB `mongodump`](https://www.mongodb.com/docs/database-tools/mongodump/) and [`mongorestore`](https://www.mongodb.com/docs/database-tools/mongorestore/) — BSON archive, namespace mapping, dry-run, and restore cautions.
- [`nip.io` operation and HTTPS guidance](https://nip.io/) and [Let's Encrypt rate limits](https://letsencrypt.org/docs/rate-limits/) — public DNS and certificate constraints.
- [systemd service management](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html) — isolated, supervised processes.

> [!NOTE]
> Earlier versions of the frontend/backend `RUNBOOK.md` files described a fresh VPS with PM2 and different ports. Their deployment sections now point here. **Use this audited, additive plan as the deployment-specific guide** until the owner approves execution. No deployment command in this document has been run.
