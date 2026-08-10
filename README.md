# Game Back-Logger

A video game backlog tracker you install on your phone. All five status lists — **In-Progress, Up Next, Backlog, Beat, Abandoned** — on a single page, with search and status filters.

**Live app:** https://a-wacker.github.io/Game-Back-Logger/

It's a PWA: open the link in Chrome on Android and choose **Install app** (or "Add to Home Screen") to get a home-screen icon that opens full-screen and works fully offline.

## Features

- Games grouped into collapsible sections (In-Progress → Up Next → Backlog → Beat → Abandoned) with counts
- Live title search and status filter chips
- Quick status dropdown on every row; tap a row to edit details
- Per-game rating (for beaten games), started/finished dates (In-Progress and Beat), and notes
- Works 100% offline — data lives on your device (localStorage)
- JSON backup: **⋮ menu → Export…** downloads your list; **Import…** restores it (merge or replace)

> Your data is stored in the browser on the device you use. It does not sync between devices — use Export/Import to move it.

## Development

```sh
npm install
npm run dev       # local dev server
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build locally
```

Built with Vite + TypeScript (no framework) and [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) for the service worker and manifest.

## Deployment

Pushes to `main` deploy automatically to GitHub Pages via `.github/workflows/deploy.yml`.

One-time setup: repo **Settings → Pages → Source = "GitHub Actions"**.
