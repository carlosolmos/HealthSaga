# HealthSaga

A personal health tracking PWA with biometrics logging, meditation tracking, nutrition guides, and trend visualization.

## Features

- **Daily health tracking**: Log blood pressure, heart rate, weight, respiratory rate, hydration, and meditation check-ins.
- **Reminders**: Polling-based reminders with in-app banner notifications (walks, hydration, health metrics, mindfulness). Polls on app launch and every 60 minutes; gracefully falls back to cached reminders when offline.
- **Sync dashboard**: Real-time sync status badge showing connection state to backend server.
- **Trends & Analytics**: 
  - Summary cards with latest value, average, and trend direction for each metric.
  - Line charts for Blood Pressure (systolic/diastolic), Heart Rate, Respiratory Rate, and Weight.
  - Date-range filtering (7 days, 30 days, all) for both summary and chart views.
- **Local-first architecture**: All data persists to localStorage and syncs to optional SQLite backend.
- **PWA**: Installable on iOS (Safari only) and Android; works offline.

## Commands
```bash
npm run dev      # Vite dev server with HMR
npm run build    # tsc type-check + vite build → dist/
npm run preview  # Serve production build locally
npm run start    # Serve built UI + API (Node + SQLite)
```

## Build and deploy (iPhone/iPad)

### 1) Build a production bundle
```bash
npm install
npm run build
```
This creates a static site in `dist/`.

### 2) Deploy the `dist/` folder
Host the `dist/` output on any static host (Netlify, Vercel, GitHub Pages, S3, etc.).
The app should be served over HTTPS for PWA features to work.

### 3) Install on iPhone/iPad
1. Open the deployed URL in **Safari** (not Chrome).
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Launch the app from the home screen (this enables the PWA experience).

### Reminders (iOS-optimized polling)
The app fetches reminders via polling on startup and every 60 minutes. Defaults include:
- **Walks**: 10:00 AM, 2:00 PM, 4:30 PM
- **Hydration**: Eight 2-hour intervals (8am–6pm)
- **Health metrics**: 8:00 PM
- **Mindfulness**: 6:00 AM, 9:00 PM

When a reminder is due (within ±5 mins of scheduled time), a golden in-app banner appears. Users can dismiss individually or mark all due reminders done at once. Completion state syncs to the backend.

### Notes
- iOS requires Safari for Add to Home Screen.
- Web Push API is not used (iOS Safari doesn't support it). Polling serves as the iOS-compatible reminder mechanism.

## Docker + Traefik deployment

### 1) Build and run the container (on the server)
```bash
cd /opt/healthsaga
mkdir -p /opt/healthsaga/data
docker compose -f traefik/docker-compose.yml up -d --build
```

### 2) Requirements
- A running Traefik instance on the `traefik-network` external network.
- DNS pointing `healthsaga.iotitlan.com` to your server.
- A writable host directory mounted at `/opt/healthsaga/data` for SQLite persistence.

### 3) Notes
- If your Traefik is in a different network, update the network name in [traefik/docker-compose.yml](traefik/docker-compose.yml).
- If you want a different domain, change the Host rules in [traefik/docker-compose.yml](traefik/docker-compose.yml).
- The database lives at `/opt/healthsaga/data/healthsaga.db` on the host; back it up with a simple tar/rsync.

