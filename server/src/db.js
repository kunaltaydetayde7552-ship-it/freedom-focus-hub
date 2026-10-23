const path = require('node:path');
let pool = null;
let sqliteDb = null;

const DATABASE_URL = process.env.DATABASE_URL;

if (DATABASE_URL) {
  // Use Neon PostgreSQL
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  console.log('[DB] Connected to Neon PostgreSQL.');
} else {
  // Use Built-in Node SQLite
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = path.join(__dirname, '..', 'freedom_data.sqlite');
  sqliteDb = new DatabaseSync(dbPath);
  console.log('[DB] Using local SQLite database at:', dbPath);
}

// Convert SQLite '?' placeholders to Postgres '$1, $2, ...' if in Postgres mode
function formatSql(sql) {
  if (!pool) return sql;
  let counter = 1;
  return sql.replace(/\?/g, () => `$${counter++}`);
}

async function initSchema() {
  const schemaQueries = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT,
      avatar TEXT,
      created_at BIGINT
    );`,
    `CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      platform TEXT,
      last_seen BIGINT,
      is_online INTEGER DEFAULT 0
    );`,
    `CREATE TABLE IF NOT EXISTS blocklists (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      domains TEXT,
      desktop_apps TEXT,
      mobile_apps TEXT,
      created_at BIGINT
    );`,
    `CREATE TABLE IF NOT EXISTS routines (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      start_time TEXT,
      end_time TEXT,
      days_of_week TEXT,
      blocklist_id TEXT,
      locked_mode INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      start_time BIGINT,
      end_time BIGINT,
      duration_minutes INTEGER,
      locked_mode INTEGER DEFAULT 0,
      blocklist_id TEXT,
      status TEXT DEFAULT 'active'
    );`
  ];

  for (const q of schemaQueries) {
    await db.exec(q);
  }

  // Seed default data if empty
  const user = await db.get('SELECT id FROM users WHERE email = ?', ['user@freedom.local']);
  if (!user) {
    await db.run(
      'INSERT INTO users (id, email, name, avatar, created_at) VALUES (?, ?, ?, ?, ?)',
      ['default_user_1', 'user@freedom.local', 'Default User', 'https://api.dicebear.com/7.x/bottts/svg?seed=freedom', Date.now()]
    );

    await db.run(
      'INSERT INTO blocklists (id, user_id, name, domains, desktop_apps, mobile_apps, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        'bl_default',
        'default_user_1',
        'Social & Entertainment Block',
        JSON.stringify(['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'reddit.com', 'youtube.com', 'netflix.com', 'tiktok.com']),
        JSON.stringify(['discord.exe', 'steam.exe', 'spotify.exe', 'epicgameslauncher.exe', 'telegram.exe']),
        JSON.stringify(['com.instagram.android', 'com.zhiliaoapp.musically', 'com.twitter.android', 'com.reddit.frontpage', 'com.google.android.youtube']),
        Date.now()
      ]
    );

    await db.run(
      'INSERT INTO routines (id, user_id, name, start_time, end_time, days_of_week, blocklist_id, locked_mode, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'rt_daily_deepwork',
        'default_user_1',
        'Daily Deep Work (Mon-Fri 09:00 - 12:00)',
        '09:00',
        '12:00',
        JSON.stringify([1, 2, 3, 4, 5]),
        'bl_default',
        1,
        1
      ]
    );
  }
}

const db = {
  async exec(sql) {
    if (pool) {
      await pool.query(sql);
    } else {
      sqliteDb.exec(sql);
    }
  },

  async query(sql, params = []) {
    const formatted = formatSql(sql);
    if (pool) {
      const res = await pool.query(formatted, params);
      return res.rows;
    } else {
      const stmt = sqliteDb.prepare(formatted);
      return stmt.all(...params);
    }
  },

  async all(sql, params = []) {
    return this.query(sql, params);
  },

  async get(sql, params = []) {
    const formatted = formatSql(sql);
    if (pool) {
      const res = await pool.query(formatted, params);
      return res.rows[0] || null;
    } else {
      const stmt = sqliteDb.prepare(formatted);
      return stmt.get(...params) || null;
    }
  },

  async run(sql, params = []) {
    const formatted = formatSql(sql);
    if (pool) {
      const res = await pool.query(formatted, params);
      return { changes: res.rowCount };
    } else {
      const stmt = sqliteDb.prepare(formatted);
      const res = stmt.run(...params);
      return res;
    }
  }
};

// Initialize schema on load
initSchema().catch(err => {
  console.error('[DB] Schema initialization failed:', err);
});

module.exports = { db };
