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
- **Reminders**: Polling-based system optimized for iOS. `GET /api/reminders?date=YYYY-MM-DD` returns reminder list with `due` (±5 min window) and `completed` status. Frontend polls on mount and every 60 mins via `fetchReminders()` hook. Completion state stored in `todayData.reminders` (object keyed by reminder id). In-app banner shows when reminders are due; users mark done via `toggleReminder(id)`. Offline: cached reminders from localStorage are used.

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

## Backend API endpoints
- **GET /api/snapshot** – Fetch full app state (today, mindfulness, metricsHistory); reminders stored in today.data.reminders as completion state.
- **POST /api/snapshot** – Upsert full app state with updated_at timestamp.
- **POST /api/metrics** – Append single metric entry (blood pressure, heart rate, weight, respiratory rate).
- **GET /api/reminders?date=YYYY-MM-DD** – Fetch daily reminders with due/completed status. Seeded defaults: walks (10:00, 14:00, 16:30), hydration (08:00–18:00 every 2hrs), metrics (20:00), mindfulness (06:00, 21:00).

## Backend database
- **snapshot table**: `id (PRIMARY), payload (JSON), updated_at (ISO string)`. Single row; upserted on sync.
- **metrics table**: `id (AUTOINCREMENT), recorded_at, systolic, diastolic, heart_rate, weight, respiratory_rate`. Append-only history.
- **reminders table**: `id (AUTOINCREMENT), type (walk|hydration|metrics|mindfulness), time (HH:MM), enabled_by_default, description`. Seeded on first run. Completion state lives in snapshot.today.data.reminders.

## Notes and boundaries
- Backend storage is implemented as a single-user Node + SQLite service in [server/index.js](server/index.js#L1) using snapshot sync, metrics history, and reminders polling (see [backendstorage.md](backendstorage.md#L1)).
- Reminders are iOS-centric; no Web Push API. Polling every 60 mins with offline fallback to localStorage.
- The legacy/prototype UI lives in [app/zen-health-tracker.tsx](app/zen-health-tracker.tsx#L1) and is not wired into the app.
