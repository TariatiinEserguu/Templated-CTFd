# VOID//CTF

**ENTER THE VOID. CAPTURE THE FLAG.**

A local, self-hosted Capture The Flag platform built on the official open-source
[CTFd](https://github.com/CTFd/CTFd) (3.8.9), with a custom terminal-style theme,
a small read-only companion plugin and a starter challenge pack.

Nothing here replaces CTFd. Registration, login, teams, challenge permissions,
flag checking, hints, scoring, the scoreboard and the admin panel are all CTFd's
own code. The VOID theme changes how participant pages look and adds
presentation features (command palette, filters, landing page, podium).

---

## Contents

1. [What you get](#what-you-get)
2. [Architecture](#architecture)
3. [Prerequisites (Windows 11)](#prerequisites-windows-11)
4. [Quick start](#quick-start)
5. [First-time admin setup](#first-time-admin-setup)
6. [Load the starter challenge pack](#load-the-starter-challenge-pack)
7. [Everyday operations](#everyday-operations)
8. [Data, backups and reset](#data-backups-and-reset)
9. [Running an event & creating challenges](#running-an-event--creating-challenges)
10. [Customizing brand and theme](#customizing-brand-and-theme)
11. [Theme development](#theme-development)
12. [Security notes](#security-notes)
13. [Testing checklist](#testing-checklist)
14. [Troubleshooting](#troubleshooting)
15. [Known limitations](#known-limitations)
16. [Project structure](#project-structure)

---

## What you get

| Area | Highlights |
|------|-----------|
| **Landing page** | `VOID//CTF` wordmark, `ACCESS THE CHALLENGE NETWORK`, live status (upcoming / live / paused / ended) from CTFd's start/end/paused config, countdown, real counters (challenges, players, teams, flags captured), featured challenges, top-5 preview, admin-editable briefing |
| **Navigation** | Terminal nav with `>` active-page prompts, score/rank/team chip, user menu, mobile menu |
| **Command palette** | `Ctrl+K` (or `/` when not typing). Commands: `help`, `challenges [search]`, `scoreboard`, `teams`, `players`, `rules`, `profile`, `team`, `settings`, `notifications`, `admin`, `login`, `register`, `logout`, `clear`. Every command is a link to a real CTFd page — nothing is executed |
| **Challenge board** | Category filter chips with solved counts, search (name / category / `#tag`), sort (category, points, solves, name), solved/unsolved filter, progress bar, difficulty bars from tags, solved / open / locked states with icons + text |
| **Challenge window** | Markdown description, attachments, connection info, hints with unlock cost, attempt counter, `ACCESS GRANTED` / `ACCESS DENIED` feedback, solves list with first blood, own attempt history, ratings |
| **Scoreboard** | Top-3 podium, score progression chart (top 10), search, pagination (25/page), solves column, "you" highlight + jump-to-me, brackets; respects hidden/frozen/private scoreboards |
| **Auth & accounts** | Styled login, registration, password reset, error pages; team/user/settings pages restyled through the shared design system |
| **Starter pack** | 6 fictional/synthetic training challenges across Crypto, Forensics, OSINT, Web, Misc and Reverse Engineering, with a sandboxed local web target |
| **Ops** | Docker Compose (CTFd + MariaDB + Redis), generated secrets, one-command start, backup/restore/reset scripts, loopback-only by default |

---

## Architecture

```
            browser ──► 127.0.0.1:8000
                          │
                ┌─────────▼──────────┐
                │ ctfd/ctfd:3.8.9    │  official image, unmodified
                │  themes/void  (ro) │◄── ./theme/void        (this repo)
                │  plugins/void_ctf  │◄── ./plugins/void_ctf  (this repo)
                └───┬───────────┬────┘
            internal│network    │
              ┌─────▼───┐  ┌────▼────┐
              │ MariaDB │  │  Redis  │     named Docker volumes: db, uploads, logs, redis
              └─────────┘  └─────────┘

   optional:  web-training (python:3.12-alpine, read-only, no caps) ──► 127.0.0.1:8081
```

**Key decisions**

* **Official CTFd image, mounted theme.** The theme and plugin are bind-mounted
  read-only into the stock `ctfd/ctfd` image, so upgrading CTFd is a version bump
  and no CTFd code is forked.
* **Theme = fork of CTFd's `core` theme.** Same template names, blocks and
  Alpine.js components, so CTFd's challenge types, hint unlocking, submissions,
  ratings, team management and notifications keep working. Built with CTFd's own
  toolchain (Vite + Bootstrap 5 + Alpine.js).
* **One small optional plugin (`void_ctf`).** CTFd's public API has no endpoint
  for event-wide totals and only returns solve history for the top 50 accounts.
  The plugin adds two **read-only GET** endpoints that reuse CTFd's own
  visibility checks (`/void/api/summary`, `/void/api/solve-counts`). The theme
  works without it (falls back to public API data and hides the solves column).
* **Content through supported channels.** The starter pack is loaded through
  CTFd's REST API with an admin token — the same calls the admin panel makes —
  never by writing to the database.
* **Private by default.** Ports bind to `127.0.0.1`; the database and cache sit on
  an internal Docker network with no published ports.

---

## Prerequisites (Windows 11)

1. **Docker Desktop** — <https://docs.docker.com/desktop/setup/install/windows-install/>
   * During install keep **"Use WSL 2 instead of Hyper-V"** selected.
   * If prompted, enable virtualization in BIOS/UEFI and run `wsl --install` in an
     *administrator* PowerShell, then reboot.
   * Start Docker Desktop and wait until the status bar says **Engine running**.
   * Check from PowerShell: `docker version` and `docker compose version`.
2. **Git** (to clone this project) — <https://git-scm.com/download/win>
3. *Optional:* **Python 3.10+** — only for `load-pack` and `tools\smoke_test.py`
   (`winget install Python.Python.3.12`).
4. *Optional:* **Node.js 20+** — only to rebuild the theme. Without Node,
   `voidctf build-theme` builds inside a Docker container.

No paid service, cloud account or API key is needed.

macOS/Linux: install Docker Desktop or Docker Engine + compose plugin and use
`./scripts/voidctf.sh` instead of `voidctf.cmd`.

---

## Quick start

From the project folder in **PowerShell** or **Command Prompt**:

```bat
.\voidctf.cmd up
```

(macOS/Linux/WSL: `./scripts/voidctf.sh up`)

On the first run this creates `.env` with freshly generated random secrets,
pulls the images, starts CTFd + MariaDB + Redis and waits until CTFd is healthy.

Open **<http://localhost:8000>**.

> PowerShell may block scripts by default; `voidctf.cmd` already runs the script
> with `-ExecutionPolicy Bypass` for that single process only, so you do not need
> to change system settings.

---

## First-time admin setup

1. Open <http://localhost:8000>. CTFd shows its **setup wizard** (still in CTFd's
   default look — the theme is chosen inside the wizard).
2. **General:** Event name `VOID//CTF` (the `//` is highlighted in the wordmark) and a description.
3. **Mode:** *Team Mode* or *User Mode*. The theme supports both.
4. **Settings:** challenge/account/score visibility and registration. Defaults are fine.
5. **Administration:** create **your** admin account (choose a strong password; CTFd stores it hashed).
6. **Style → Theme:** select **`void`**.
7. **Date & Time:** optional start/end — the landing page countdown and status use these.
8. Finish. You are logged in as admin; the **Admin Panel** is in the user menu (top right) and at `/admin`.

If you skipped the theme step: Admin Panel → Config → Theme → `void` (the
starter-pack loader also sets it).

---

## Load the starter challenge pack

1. Log in as admin → user menu → **Settings** → **Access Tokens** → *Generate*.
   Copy the token (it starts with `ctfd_`).
2. Run:

   ```bat
   .\voidctf.cmd load-pack
   ```

   Paste the token when asked (input is hidden). Or non-interactively:
   `python tools\load_pack.py --url http://localhost:8000 --token ctfd_...`
3. For the web challenge (**Staff Only**) start its local target:

   ```bat
   .\voidctf.cmd training-up
   ```

The loader creates the 6 challenges with flags, tags, hints and attachments,
locks *Deep Signal* behind *Signal in the Noise* (preview mode), creates a
`/rules` page and replaces CTFd's placeholder home page with a briefing. It is
idempotent — existing challenges/pages are skipped. Organizer solutions are in
[`challenges/starter-pack/SOLUTIONS.md`](challenges/starter-pack/SOLUTIONS.md)
and are **never uploaded**.

| Challenge | Category | Pts | Difficulty |
|-----------|----------|----:|-----------|
| Signal in the Noise | Cryptography | 100 | easy |
| Ghost in the Metadata | Digital Forensics | 150 | easy |
| The Lighthouse Keeper | OSINT (fictional dossier) | 200 | medium |
| Staff Only | Web Exploitation (local target) | 200 | medium |
| Dial Tone | Miscellaneous | 100 | easy |
| Deep Signal | Reverse Engineering | 250 | medium, locked until #1 |

All flags are clearly labeled samples (`flag{example_...}`). Delete or replace
them before a real event.

---

## Everyday operations

| Task | Windows | macOS / Linux |
|------|---------|---------------|
| Start | `.\voidctf.cmd up` | `./scripts/voidctf.sh up` |
| Stop (keeps data) | `.\voidctf.cmd down` | `./scripts/voidctf.sh down` |
| Restart CTFd | `.\voidctf.cmd restart` | `./scripts/voidctf.sh restart` |
| Status | `.\voidctf.cmd status` | `./scripts/voidctf.sh status` |
| Logs | `.\voidctf.cmd logs` | `./scripts/voidctf.sh logs` |
| Backup | `.\voidctf.cmd backup` | `./scripts/voidctf.sh backup` |
| Restore | `.\voidctf.cmd restore backups\file.zip` | `./scripts/voidctf.sh restore backups/file.zip` |
| Reset demo | `.\voidctf.cmd reset` | `./scripts/voidctf.sh reset` |
| Rebuild theme | `.\voidctf.cmd build-theme` | `./scripts/voidctf.sh build-theme` |
| Web target on/off | `training-up` / `training-down` | same |

Plain Docker works too: `docker compose up -d`, `docker compose down`,
`docker compose logs -f ctfd`.

Containers use `restart: unless-stopped`: after a reboot they come back when
Docker Desktop starts, unless you stopped them with `down`.

### Configuration (`.env`)

| Variable | Default | Meaning |
|----------|---------|---------|
| `CTFD_VERSION` | `3.8.9` | Official CTFd image tag |
| `SECRET_KEY` | generated | Session signing key. Changing it logs everyone out |
| `CTFD_WORKERS` | `1` | Gunicorn workers (raise for large events) |
| `BIND_ADDRESS` | `127.0.0.1` | `0.0.0.0` exposes the platform to your LAN — only do this on purpose |
| `CTFD_PORT` | `8000` | Host port |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD` | generated | MariaDB credentials (internal network only) |
| `TRAINING_WEB_PORT` | `8081` | Port of the web training target (always loopback) |
| `TRAINING_WEB_FLAG` | sample flag | Must match the *Staff Only* flag in CTFd |

`.env` is git-ignored. `.env.example` contains no secrets.

---

## Data, backups and reset

**Persistence.** All event data lives in Docker named volumes —
`voidctf_db` (MariaDB), `voidctf_uploads` (challenge files), `voidctf_logs`,
`voidctf_redis`. They survive `down`, restarts and reboots.

**Backup / export.** `voidctf backup` runs CTFd's own exporter
(`python manage.py export_ctf`) and writes `backups\voidctf-YYYYMMDD-HHMMSS.zip`
containing the database tables **and** uploaded files. You can also export from
Admin Panel → Config → Backup → *Export*.

**Restore / import.** `voidctf restore <zip>` runs CTFd's importer; or use
Admin Panel → Config → Backup → *Import*. Importing replaces the current event.

**Reset the demo.** `voidctf reset` asks you to type `RESET`, then removes the
containers **and volumes** (`docker compose down -v`). `.env` is kept, so the next
`up` starts a fresh setup wizard with the same secrets. Back up first if in doubt.

---

## Running an event & creating challenges

Everything below happens in the **Admin Panel** (`/admin`) — no code edits.

**Event settings** (Admin → Config)
* *General*: event name, description.
* *Start and End Time*: competition window; landing page countdown/status follow it. *Freeze time* freezes the scoreboard for players.
* *Accounts / Visibility*: user vs team mode, team size, challenge/account/score visibility (public / private / admins / hidden), registration (public / private), email verification.
* *Pause*: Admin → Config → Start and End Time → *Paused* (landing page shows **PAUSED**).
* *Theme*: theme selection, logo, small icon, banner, header/footer injection, **Theme Settings** JSON.
* *Backup*: export / import / reset.

**Create a challenge** (Admin → Challenges → **+**)
1. Choose type: *standard* (fixed points) or *dynamic* (value decays with solves).
2. Name, **category** (free text — a new category appears automatically on the board), Markdown description, points.
3. Next screen: **flag** (static or regex, case-sensitive/insensitive), **files**, **state** (*Hidden* while drafting, *Visible* to publish).
4. Open the challenge to add: more flags, **hints** (with point cost), **tags**, **requirements** (prerequisites; *Hidden*, *Anonymized* or *Preview* while locked), **max attempts**, connection info, next challenge, solution.

**Tags the VOID theme understands**

| Tag | Effect |
|-----|--------|
| `easy` / `medium` / `hard` / `insane` (or `difficulty:easy` …) | difficulty bars on cards and in the challenge window |
| `featured` | shown in *Featured challenges* on the landing page (otherwise the newest challenges are shown) |
| anything else | shown as `#tag`, searchable on the board |

**Users & teams:** Admin → Users / Teams (create, edit, hide, ban, award points).
**Pages:** Admin → Pages. Route `index` is the landing-page briefing; a page with
route `rules` appears as **rules** in the navbar; other non-hidden pages appear
in the navbar and footer.
**Announcements:** Admin → Notifications (players see toasts / the bell badge).

**Your own challenge packs:** copy `challenges/starter-pack` (format: `pack.json`
+ files + pages) and load it with `python tools\load_pack.py --pack path\to\pack.json`.
For larger collections CTFd's official [`ctfcli`](https://github.com/CTFd/ctfcli)
is also compatible with this setup.

---

## Customizing brand and theme

| Change | How |
|--------|-----|
| Event name | Admin → Config → General (a `//` gets the green accent) |
| Logo | Admin → Config → Theme → Logo (replaces the `>_` mark) |
| Favicon | Admin → Config → Theme → Small Icon |
| Tagline, intro, label, featured tag | Admin → Config → Theme → **Theme Settings**, e.g. below |
| Landing briefing | Admin → Pages → `index` (Markdown) |
| Colors | `theme/void/assets/scss/main.scss` (`$void-*`) **and** `theme/void/assets/scss/includes/void/_tokens.scss` (`--void-*`), then `build-theme` |
| Fonts | `theme/void/assets/scss/includes/void/_fonts.scss` (self-hosted JetBrains Mono + Inter) |
| Templates | `theme/void/templates/*.html` (no build needed) |

```json
{
  "tagline": "ENTER THE VOID. CAPTURE THE FLAG.",
  "event_label": "cyber range // season 01",
  "intro": "A hands-on cybersecurity competition ...",
  "featured_tag": "featured",
  "challenge_window_size": "lg"
}
```

CTFd's standard theme settings `challenge_category_order` and `challenge_order`
(JavaScript sort functions) are still honoured.

---

## Theme development

```bat
cd theme\void
npm ci
npm run dev        :: rebuilds static\ on every save
```

Then refresh the browser (`Ctrl+F5`). Template changes need no rebuild.
The built `theme/void/static` folder is committed so Docker users never need Node.js.

**Without Docker (theme development only):** `.\voidctf.cmd native` clones CTFd
3.8.9 into `.ctfd\`, creates a Python **3.11** venv (via `uv` or `py -3.11`),
links the theme and plugin in, and runs CTFd's development server with SQLite in
`data\native\` on <http://localhost:8000>. This mode is single-user, has no Redis
and runs Flask's debug server — use Docker for real events.

---

## Security notes

* Flags are validated only server-side by CTFd (`/api/v1/challenges/attempt`);
  the theme never receives expected flags. `/api/v1/flags` is admin-only.
* CTFd's authentication, password hashing, CSRF nonces, sessions and
  authorization are untouched. The plugin is GET-only, read-only and applies
  CTFd's visibility checks (and scoreboard freeze) before returning anything.
* Theme templates use Jinja auto-escaping; JSON for scripts is emitted with
  `tojson`; client-side rendering escapes user-controlled text. Admin-authored
  page/challenge Markdown is rendered by CTFd as usual.
* Secrets are generated locally by `voidctf init` and live only in `.env`
  (git-ignored). No default passwords ship with the project.
* Everything binds to `127.0.0.1`. MariaDB and Redis have no published ports.
* The web training target is opt-in, stores nothing, executes nothing, and runs
  read-only as an unprivileged user with all Linux capabilities dropped, memory
  and process limits, on its own network.
* No service executes player-submitted code.
* Starter-pack data is fictional/synthetic and targets nothing outside your machine.

---

## Testing checklist

Automated smoke test (after creating a player account):

```bat
python tools\smoke_test.py --user <player> --password <password> --expect-hidden "<a hidden challenge>" --attempt "Dial Tone" "flag{wrong}"
```

It checks health, theme assets, login, the challenge list, hidden-challenge
visibility, that the flags API is admin-only, the plugin, and a real flag attempt.

Manual walkthrough:

- [ ] `voidctf up` → <http://localhost:8000> loads
- [ ] Setup wizard completed, theme `void` active
- [ ] Starter pack loaded (`load-pack`), board shows 6 challenges, *Deep Signal* locked
- [ ] Register a player; create or join a team (team mode)
- [ ] Open a challenge, submit a wrong flag → **ACCESS DENIED**
- [ ] Submit the correct sample flag → **ACCESS GRANTED**; card shows *solved*; navbar score/rank update; *Deep Signal* unlocks
- [ ] Refresh → still solved
- [ ] Scoreboard shows the team, solves, chart; "you" highlighted
- [ ] As admin: create a *Hidden* challenge → not visible to the player; set *Visible* → appears
- [ ] Command palette: `Ctrl+K`, `help`, `challenges crypto`
- [ ] Mobile width (375px): no horizontal scroll, menu opens
- [ ] `voidctf backup` produces a zip; `voidctf down` / `up` keeps data

### What was verified while building this project

Verified on Windows 11 with CTFd 3.8.9 running **natively** (Python 3.11,
SQLite, `voidctf native`-style setup), in the browser:

* Setup wizard → `void` theme; theme build (`npm ci && npm run build`).
* Starter pack loader (twice — second run skipped everything as expected).
* Registration, team creation, challenge board (filters, search, sort, locked/solved states).
* Wrong flag → *Incorrect*; correct flag → *Correct*; solve persisted after refresh;
  navbar rank/score; prerequisite unlock; scoreboard podium/table/chart/solves column.
* Admin panel: created a challenge (hidden) → invisible to the player; made visible → listed.
* Players get `403` from `/api/v1/flags`; challenge detail JSON contains no flags.
* Attachment download, web-training target (robots.txt → cookie → flag), theme settings JSON,
  command palette, mobile (375px) layout with no horizontal overflow, all participant pages
  return 200 (no template errors), CTFd export (`manage.py export_ctf`).
* `smoke_test.py`: all checks pass.

**Not verified here:** the Docker Compose stack itself (Docker was not installed
on the build machine) and import/restore (CTFd cannot import into SQLite; it works
on the MariaDB-backed Docker stack). The compose file was validated as YAML and
follows CTFd's official compose layout; run the checklist above after your first
`voidctf up`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Docker was not found` / `not running` | Start Docker Desktop; wait for *Engine running*; reopen the terminal |
| Port 8000 already in use | Set `CTFD_PORT=8080` in `.env`, then `voidctf up` |
| Page looks like plain CTFd | Admin → Config → Theme → select `void` |
| Theme changes not visible | `voidctf build-theme`, then hard refresh (`Ctrl+F5`); for templates `voidctf restart` |
| `SECRET_KEY is missing` | Run `voidctf init` (creates `.env`) |
| CTFd keeps restarting, DB errors in logs | `voidctf logs`; first MariaDB start can take ~30 s. If you changed `DB_PASSWORD` after the first start, the database still has the old one — restore the old value or `reset` |
| Landing counters show `—` | That value is hidden by your visibility settings, or the `void_ctf` plugin is not mounted (`voidctf logs` should show `Loaded module ... void_ctf`) |
| *Staff Only* target unreachable | `voidctf training-up`; it listens on <http://localhost:8081> |
| `load-pack`: *did not return JSON* | Wrong URL or token; tokens must belong to an **admin** |
| WSL 2 / virtualization errors | Enable virtualization in BIOS, run `wsl --install` as admin, reboot |
| `native` fails with odd import errors on Windows | Path too long (>260 chars). Move the project to a short path such as `C:\voidctf` or enable Windows long paths |

---

## Known limitations

* **Admin panel styling** is CTFd's standard admin theme (by design, to avoid breaking it).
* **Setup wizard** renders in CTFd's default theme until `void` is selected.
* **Profile/team pages** use CTFd's core markup with the VOID design system applied, not bespoke layouts.
* **Attachments on board cards:** CTFd's challenge list API does not include files, so attachments show in the challenge window only.
* **Difficulty** is tag-based; CTFd has no native difficulty field.
* **Score progression** shows the top 10 accounts (CTFd API limit for detailed solve history).
* **Solves column / landing totals** require the optional `void_ctf` plugin.
* **Native mode** has no Redis/event stream (live notifications and import need the Docker stack). Its browser console shows an EventSource warning; that is expected there.
* **CTFd import into SQLite is unsupported upstream**, so restore works only with the Docker (MariaDB) stack.

---

## Project structure

```
.
├─ docker-compose.yml          CTFd + MariaDB + Redis (+ optional web-training)
├─ .env.example                configuration template (no secrets)
├─ voidctf.cmd                 Windows launcher -> scripts/voidctf.ps1
├─ scripts/
│  ├─ voidctf.ps1              Windows management commands
│  └─ voidctf.sh               macOS / Linux / WSL management commands
├─ theme/void/                 the VOID//CTF CTFd theme (see theme/void/README.md)
├─ plugins/void_ctf/           optional read-only stats plugin
├─ challenges/starter-pack/
│  ├─ pack.json                challenges, flags, hints, tags, files, pages
│  ├─ files/                   synthetic attachments
│  ├─ pages/                   rules + briefing Markdown
│  ├─ web-training/server.py   deliberately vulnerable local target (stdlib only)
│  ├─ build_assets.py          regenerates the synthetic attachments
│  └─ SOLUTIONS.md             organizer-only walkthroughs (never uploaded)
├─ tools/
│  ├─ load_pack.py             loads a pack through the CTFd REST API
│  └─ smoke_test.py            end-to-end HTTP smoke test
└─ backups/ , data/            created at runtime, git-ignored
```

CTFd is © CTFd LLC, Apache-2.0. The VOID theme derives from CTFd's core theme
under the same license.
