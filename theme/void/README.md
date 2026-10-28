# VOID//CTF theme for CTFd

A terminal-styled participant theme for CTFd 3.8.x. It is a fork of CTFd's
official `core` (core-beta) theme, so every page keeps CTFd's real Alpine.js
components, routes, forms and API calls; only markup and styling changed, plus a
few presentation-only features.

The admin panel keeps CTFd's own `admin` theme and is not modified.

## Layout

```
theme/void/
├─ templates/                 Jinja templates (same names as CTFd core)
│  ├─ base.html               page shell, skip link, footer
│  ├─ page.html               landing page for "/" + Markdown pages
│  ├─ challenges.html         board: filters, search, sort, progress
│  ├─ challenge.html          challenge window (challenge types extend this)
│  ├─ scoreboard.html         podium, chart, searchable/paginated table
│  ├─ login / register / reset_password.html
│  ├─ components/             navbar, command palette, footer, wordmark
│  ├─ macros/void.html        auth panel + error screen macros
│  └─ errors/*.html           terminal error screens
├─ assets/
│  ├─ scss/main.scss          Bootstrap 5 configured with the VOID palette
│  ├─ scss/includes/void/     design system partials (_tokens.scss = CSS variables)
│  └─ js/                     page entry points (Vite inputs)
│     ├─ home.js              landing page data loading
│     └─ components/          palette.js, void-ui.js, challenge-meta.js
├─ static/                    BUILD OUTPUT served by CTFd (committed)
└─ vite.config.js
```

## Build

```bash
npm ci
npm run build        # one-off build into ./static
npm run dev          # rebuild on every change
```

Or from the project root: `voidctf build-theme` (uses Docker if Node.js is not installed).
Templates are read from disk, so template-only edits need no build — refresh the
page (Docker: `voidctf restart` if caching gets in the way).

## Customizing

| What | Where |
|------|-------|
| Colors | `$void-*` variables in `assets/scss/main.scss` **and** `--void-*` tokens in `assets/scss/includes/void/_tokens.scss` |
| Fonts | `assets/scss/includes/void/_fonts.scss` (self-hosted, no CDN) |
| Event name / wordmark | Admin → Config → General → *Event Name*. A `//` in the name is highlighted |
| Logo | Admin → Config → Theme → *Logo* (replaces the `>_` mark) |
| Tagline, intro, label, featured tag | Admin → Config → Theme → *Theme Settings* JSON (see the project README) |
| Landing "briefing" text | Admin → Pages → `index` |
| Difficulty bars | add a tag `easy`, `medium`, `hard` or `insane` to a challenge |
| Featured challenges on the landing page | add the tag `featured` |

## Optional plugin

`plugins/void_ctf` adds two read-only endpoints for landing-page totals and the
scoreboard *solves* column. Without it the theme falls back to public API data
and hides the solves column.

## License

Derived from CTFd's core theme, Apache License 2.0 (see `LICENSE`).
