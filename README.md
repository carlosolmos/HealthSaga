# HealthSaga

## Commands
```bash
npm run dev      # Vite dev server with HMR
npm run build    # tsc type-check + vite build → dist/
npm run preview  # Serve production build locally
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

### Notes
- iOS requires Safari for Add to Home Screen.
- Push notifications are not enabled here yet.

## Docker + Traefik deployment

### 1) Build and run the container (on the server)
```bash
cd /opt/healthsaga
docker compose -f traefik/docker-compose.yml up -d --build
```

### 2) Requirements
- A running Traefik instance on the `traefik-network` external network.
- DNS pointing `healthsaga.iotitlan.com` to your server.

### 3) Notes
- If your Traefik is in a different network, update the network name in [traefik/docker-compose.yml](traefik/docker-compose.yml).
- If you want a different domain, change the Host rules in [traefik/docker-compose.yml](traefik/docker-compose.yml).

