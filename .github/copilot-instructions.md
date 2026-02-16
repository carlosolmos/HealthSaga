# Copilot instructions for HealthSaga

## Project overview
- Vite + React (TypeScript) single-page PWA. Entry: [src/main.tsx](src/main.tsx#L1) -> [src/App.tsx](src/App.tsx#L1) -> [src/components/HealthSaga.tsx](src/components/HealthSaga.tsx#L1).
- The app is mostly a single, large component; prefer extending existing sections in `HealthSaga` rather than creating many new components unless necessary.
- Data is static, not fetched: meditation content in [src/data/meditation_exercises.json](src/data/meditation_exercises.json#L1) and nutrition references in [src/data/nutrition_guide.ts](src/data/nutrition_guide.ts#L1).
- PWA setup: Vite plugin config in [vite.config.ts](vite.config.ts#L1), service worker registration in [src/pwa.ts](src/pwa.ts#L1), and manifest in [public/manifest.webmanifest](public/manifest.webmanifest).

## State and persistence patterns
- Client state is persisted to `localStorage`. The helper `useLocalStorage` is defined inside [src/components/HealthSaga.tsx](src/components/HealthSaga.tsx#L16) and used for shared storage behavior.
- Key storage names used today: `healthsaga-today`, `healthsaga-metrics`, `healthsaga-metrics-history`, `healthsaga-reminders`, `healthsaga-mindfulness`, `healthsaga-sync-meta` (see `loadTodayData` and `useLocalStorage`). Keep new data consistent with these conventions.
- `today` data is date-scoped and reset daily via `getToday()` and `loadTodayData()`; follow that pattern if adding new day-specific fields.
- Client-server sync: `syncWithServer()` fetches snapshot from `/api/snapshot` and pushes local state on changes. Conflict resolution uses "newest wins" based on `updated_at` timestamps. Metrics entries are posted to `/api/metrics` on save. Sync status badge in header shows state: `Syncing`, `Synced`, `Sync issue`, or `Local` (clickable to manual sync).

## UI conventions
- Styles are mostly inline in `HealthSaga` (no component library). Keep new UI blocks consistent with the current inline-style approach.
- Global CSS in [src/index.css](src/index.css) is minimal and only sets resets; do not rely on global classes.
- Icons use `lucide-react`; import from `lucide-react` as in [src/components/HealthSaga.tsx](src/components/HealthSaga.tsx#L1).
- Charting uses `recharts` for line charts in trends visualization. Charts are client-side only; no server-side aggregation needed.
- Trends feature: Tabbed interface in Metrics section with "Summary" (mini-cards) and "Charts" (line plots) views. Both respect `trendDateRange` state ('week', 'month', 'all') for client-side filtering.

## Dev workflows
- Local dev/build: `npm run dev`, `npm run build`, `npm run preview` (see [README.md](README.md#L1)).
- Backend server: `npm run start` serves the built UI and API from Node + SQLite (see [server/index.js](server/index.js#L1)).
- Docker build: [Dockerfile](Dockerfile) produces a Node image serving UI + API; [Makefile](Makefile#L1) has `build-docker`.
- Traefik deployment uses [traefik/docker-compose.yml](traefik/docker-compose.yml#L1) and expects an external `traefik-network`.
- Production deploy typically runs `docker compose -f traefik/docker-compose.yml up -d --build` from the server checkout (see [README.md](README.md#L1)).
- iOS install flow is Safari-only and PWA needs HTTPS; push notifications are not enabled (see [README.md](README.md#L1)).

## Notes and boundaries
- Backend storage is implemented as a single-user Node + SQLite service in [server/index.js](server/index.js#L1) using snapshot sync and metrics history (see [backendstorage.md](backendstorage.md#L1)).
- The legacy/prototype UI lives in [app/zen-health-tracker.tsx](app/zen-health-tracker.tsx#L1) and is not wired into the app.
