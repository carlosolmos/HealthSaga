## Plan: SQLite Backend + LocalStorage Sync

You want a single-user backend (no auth), with history for metrics, and a simple push/pull snapshot sync, running in the same container. This means we will add a small Node API with SQLite, extend the Docker build to run both the API and the static frontend, and add client sync that can migrate existing localStorage into the server. We will keep the current local UI flow, but add a background sync button/flow so the app still works offline and uploads when online.

Steps
1. Inventory current client state shapes and keys in src/components/HealthSaga.tsx (today data, metrics, reminders, mindfulness state) and define a snapshot schema that mirrors the existing localStorage shapes.
2. Add a lightweight API service (Node + Express/Fastify) with SQLite, a single table for snapshots and a table for metrics history (append rows on "Save Metrics"). Place API code under a new folder (e.g., server/) and wire npm scripts.
3. Implement SQLite schema:
   - snapshot table (single row) storing JSON for today, reminders, mindfulness, updated_at.
   - metrics table with recorded_at, systolic, diastolic, heart_rate, weight for history.
4. Add API endpoints:
   - GET /api/snapshot to fetch latest snapshot.
   - POST /api/snapshot to save full state (client localStorage → server).
   - POST /api/metrics to append metric entries on save.
5. Add client sync helpers in src/components/HealthSaga.tsx:
   - On app load, fetch snapshot and merge into localStorage (if server is newer).
   - Add a "Sync now" action (or auto-sync on changes with debounce).
   - Migrate existing localStorage into server on first sync.
6. Update Docker build to serve both static assets and API (single container):
   - Node API listens on a port (e.g., 8080) and serves the built dist/.
   - Update Traefik labels to route to the API port.
7. Configure SQLite database storage for Docker deployment:
   - Use a Docker volume to persist data outside the container.
   - API code should read DB_PATH env var (default: /data/healthsaga/healthsaga.db).
   - In docker-compose.yml, mount a host path (e.g., /var/lib/healthsaga/data) to /data/healthsaga inside the container.
   - This keeps the database file on the host filesystem, making backups simple (just copy the directory).
   - Enable WAL mode in SQLite for better concurrency and crash recovery.
   - Document the volume mount and backup procedure in README.md.

Verification
- Run API locally and ensure GET /api/snapshot returns empty then updated JSON after POST.
- Build and run Docker image; verify both the UI and API are reachable.
- Confirm metrics history appends new rows and that daily data loads correctly after refresh.
- Verify that stopping and restarting the container preserves database data (check the mounted volume on host).

Docker Production Setup
- On the production server, create a data directory: `mkdir -p /opt/healthsaga/data`.
- docker-compose.yml volumes section should mount:
  ```yaml
  volumes:
    - /opt/healthsaga/data:/data/healthsaga
  ```
- Backup procedure: `tar -czf ~/backups/healthsaga-$(date +%Y%m%d).tar.gz /opt/healthsaga/data/`.
- For scheduled backups, add to crontab (e.g., daily at 2 AM).
- The database file (healthsaga.db) and WAL files (-wal, -shm) will all be in the mounted host directory for easy backup and inspection.

Decisions
- Single-user, no auth.
- Store metrics history.
- Snapshot-based sync (overwrite latest).
- Single container for API + static UI.
- Database persisted via Docker volume mount to host filesystem for easy backups.
- SQLite WAL mode for improved reliability in containerized environment.

If you want a different data folder path or port for the API, tell me and I will incorporate it.
