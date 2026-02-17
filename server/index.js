import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const app = express();
app.use(express.json({ limit: '1mb' }));

const dbPath = process.env.DB_PATH ?? '/data/healthsaga/healthsaga.db';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const schema = `
  CREATE TABLE IF NOT EXISTS snapshot (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_at TEXT NOT NULL,
    systolic TEXT,
    diastolic TEXT,
    heart_rate TEXT,
    weight TEXT,
    respiratory_rate TEXT
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    time TEXT NOT NULL,
    enabled_by_default INTEGER DEFAULT 1,
    description TEXT
  );
`;

db.exec(schema);

// Seed default reminders if table is empty
const countReminders = db.prepare('SELECT COUNT(*) as count FROM reminders');
const reminderCount = countReminders.get().count;

if (reminderCount === 0) {
  const insertReminder = db.prepare(`
    INSERT INTO reminders (type, time, enabled_by_default, description)
    VALUES (?, ?, ?, ?)
  `);

  const defaultReminders = [
    ['walk', '10:00', 1, 'Morning walk'],
    ['walk', '14:00', 1, 'Afternoon walk'],
    ['walk', '16:30', 1, 'Evening walk'],
    ['hydration', '08:00', 1, 'Drink water'],
    ['hydration', '10:00', 1, 'Drink water'],
    ['hydration', '12:00', 1, 'Drink water'],
    ['hydration', '14:00', 1, 'Drink water'],
    ['hydration', '16:00', 1, 'Drink water'],
    ['hydration', '18:00', 1, 'Drink water'],
    ['metrics', '20:00', 1, 'Record health metrics'],
    ['mindfulness', '06:00', 1, 'Morning mindfulness'],
    ['mindfulness', '21:00', 1, 'Evening mindfulness']
  ];

  defaultReminders.forEach(reminder => {
    insertReminder.run(...reminder);
  });
}

const selectSnapshot = db.prepare('SELECT payload, updated_at FROM snapshot WHERE id = 1');
const upsertSnapshot = db.prepare(`
  INSERT INTO snapshot (id, payload, updated_at)
  VALUES (1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    payload = excluded.payload,
    updated_at = excluded.updated_at
`);
const insertMetric = db.prepare(`
  INSERT INTO metrics (recorded_at, systolic, diastolic, heart_rate, weight, respiratory_rate)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const selectReminders = db.prepare('SELECT id, type, time, description FROM reminders ORDER BY time ASC');

app.get('/api/snapshot', (req, res) => {
  const row = selectSnapshot.get();
  if (!row) {
    res.json({ updatedAt: '', data: null });
    return;
  }

  let data = null;
  try {
    data = JSON.parse(row.payload);
  } catch {
    data = null;
  }

  res.json({ updatedAt: row.updated_at, data });
});

app.post('/api/snapshot', (req, res) => {
  const { updatedAt, data } = req.body ?? {};
  if (!data) {
    res.status(400).json({ error: 'Snapshot data required' });
    return;
  }

  const stamp = typeof updatedAt === 'string' && updatedAt ? updatedAt : new Date().toISOString();
  upsertSnapshot.run(JSON.stringify(data), stamp);
  res.json({ updatedAt: stamp });
});

app.post('/api/metrics', (req, res) => {
  const entry = req.body ?? {};
  const recordedAt = entry.recordedAt ?? new Date().toISOString();
  const systolic = entry?.bloodPressure?.systolic ?? null;
  const diastolic = entry?.bloodPressure?.diastolic ?? null;
  const heartRate = entry?.heartRate ?? null;
  const weight = entry?.weight ?? null;
  const respiratoryRate = entry?.respiratoryRate ?? null;

  insertMetric.run(recordedAt, systolic, diastolic, heartRate, weight, respiratoryRate);
  res.json({ ok: true });
});

app.get('/api/reminders', (req, res) => {
  const date = req.query.date;
  if (!date) {
    res.status(400).json({ error: 'date query parameter required (YYYY-MM-DD format)' });
    return;
  }

  const reminders = selectReminders.all();
  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;

  // Get reminder completion state from snapshot
  let completedReminders = {};
  const snapshotRow = selectSnapshot.get();
  if (snapshotRow) {
    try {
      const snapshotData = JSON.parse(snapshotRow.payload);
      const todayData = snapshotData?.today?.data;
      if (todayData?.reminders) {
        completedReminders = todayData.reminders;
      }
    } catch {
      // Ignore parse errors
    }
  }

  const remindersWithStatus = reminders.map(reminder => {
    const [rh, rm] = reminder.time.split(':');
    const [ch, cm] = currentTime.split(':');
    const reminderMinutes = parseInt(rh) * 60 + parseInt(rm);
    const currentMinutes = parseInt(ch) * 60 + parseInt(cm);
    const diffMins = Math.abs(currentMinutes - reminderMinutes);
    
    return {
      id: reminder.id,
      type: reminder.type,
      time: reminder.time,
      description: reminder.description,
      due: diffMins <= 5,
      completed: completedReminders[reminder.id] ?? false
    };
  });

  res.json(remindersWithStatus);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');

app.use(express.static(distPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`HealthSaga server running on port ${port}`);
});
