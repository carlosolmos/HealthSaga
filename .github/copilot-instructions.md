# HealthSaga Copilot Instructions

## Architecture Overview
Single-page React 19 PWA for personal health tracking with client-side localStorage persistence. Main component `HealthSaga.tsx` (~1756 lines) follows monolithic pattern containing all UI, state, and business logic. Backend SQLite integration is planned (see `backendstorage.md`) but not yet implemented.

## State Management Pattern
Custom `useLocalStorage` hook wraps React useState with automatic localStorage sync. All state keys prefixed `healthsaga-*`:
- `healthsaga-today`: Daily data (resets each date) - supplements, hydration, meals, walks, morningWater
- `healthsaga-metrics`: Current form input state
- `healthsaga-metrics-history`: Array of saved entries (max 50)
- `healthsaga-reminders`: Walk reminder configuration
- `healthsaga-mindfulness`: Date+slot-based exercise queue

**Critical:** Daily data tied to ISO date string via `getToday()`. State automatically resets at date change. See `defaultTodayData` for schema.

## Mindfulness Exercise System
Time-slot based (morning 5-12, evening otherwise) meditation suggestions with randomized rotation:
1. `getMindfulnessSlot()` determines current slot from hour
2. `getMindfulnessPool()` filters exercises by timeOfDay preferences from `meditation_exercises.json`
3. `buildMindfulnessQueue()` shuffles exercises into persistent queue
4. Queue survives until date or slot changes, then regenerates

Exercise data in `src/data/meditation_exercises.json` includes traditions, durations, goals, instructions, physiological effects.

## Development Workflow
```bash
npm run dev     # Vite HMR dev server
npm run build   # TypeScript check + Vite production build → dist/
npm run preview # Serve production build locally
```

## Deployment Architecture
Multi-stage Docker build (Node → Nginx) in `Dockerfile`. Deploy via Docker Compose in `traefik/` directory:
```bash
docker compose -f traefik/docker-compose.yml up -d --build
```

Requires external Traefik on `traefik-network` with Let's Encrypt resolver. Domain configured: `healthsaga.iotitlan.com`. Static files served by Nginx on container port 80.

## PWA Configuration
Vite PWA plugin in `vite.config.ts` with autoUpdate registration. iOS requires Safari for "Add to Home Screen" installation. Service worker registered in `src/pwa.ts`.

## Data Export/Backup
`exportLocalData()` function creates JSON snapshot of all localStorage keys with timestamp. No server sync yet - relies on client-side export for backup.

## Component Patterns
- Inline styles throughout (no CSS modules or styled-components)
- Tab navigation: 'today' | 'meals' | 'metrics' | 'mindfulness'
- lucide-react for icons
- Color palette: primary `#5492a3`, secondary `#3d7a8a`, background `#f5f3f0`

## Key Files
- `src/components/HealthSaga.tsx`: Main application logic
- `src/data/nutrition_guide.ts`: Protein/fiber/hydration reference data
- `app/zen-health-tracker.tsx`: Earlier prototype version (not in build)
- `backendstorage.md`: Future backend implementation plan
