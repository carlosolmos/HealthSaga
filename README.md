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

