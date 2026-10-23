const path = require('node:path');
let pool = null;
let sqliteDb = null;

const DATABASE_URL = process.env.DATABASE_URL;

if (DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  console.log('[DB] Connected to Neon PostgreSQL.');
} else {
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = path.join(__dirname, '..', 'freedom_data.sqlite');
  sqliteDb = new DatabaseSync(dbPath);
  console.log('[DB] Using local SQLite database at:', dbPath);
}

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

  // Ensure default user exists
  let user = await db.get('SELECT id FROM users WHERE id = ?', ['default_user_1']);
  if (!user) {
    await db.run(
      'INSERT INTO users (id, email, name, avatar, created_at) VALUES (?, ?, ?, ?, ?)',
      ['default_user_1', 'user@freedom.local', 'Kunal (Freedom User)', 'https://api.dicebear.com/7.x/bottts/svg?seed=freedom', Date.now()]
    );
  }

  // Seed Pre-Curated Categories (YouTube, Social Media, Gaming, Messaging)
  const preCuratedLists = [
    {
      id: 'cat_youtube_streaming',
      name: '📺 YouTube & Video Streaming',
      domains: ['youtube.com', 'youtu.be', 'm.youtube.com', 'ytimg.com', 'youtube-nocookie.com', 'netflix.com', 'twitch.tv', 'primevideo.com', 'hotstar.com'],
      desktop: ['youtube.exe'],
      mobile: ['com.google.android.youtube']
    },
    {
      id: 'cat_social_media',
      name: '📸 Social Media (Instagram, TikTok, FB, X)',
      domains: ['instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'tiktok.com', 'reddit.com', 'threads.net', 'snapchat.com'],
      desktop: ['telegram.exe'],
      mobile: ['com.instagram.android', 'com.zhiliaoapp.musically', 'com.facebook.katana', 'com.twitter.android', 'com.reddit.frontpage']
    },
    {
      id: 'cat_gaming',
      name: '🎮 Gaming & Discord',
      domains: ['discord.com', 'steamcommunity.com', 'roblox.com', 'epicgames.com', 'riotgames.com'],
      desktop: ['discord.exe', 'steam.exe', 'epicgameslauncher.exe', 'riotclientservices.exe'],
      mobile: ['com.discord']
    },
    {
      id: 'cat_all_distractions',
      name: '🔥 Full Lockdown (YouTube + Social + Gaming)',
      domains: [
        'youtube.com', 'youtu.be', 'm.youtube.com', 'ytimg.com', 'netflix.com', 'twitch.tv',
        'instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'tiktok.com', 'reddit.com',
        'discord.com', 'steamcommunity.com', 'amazon.in', 'amazon.com', 'flipkart.com'
      ],
      desktop: ['discord.exe', 'steam.exe', 'spotify.exe', 'epicgameslauncher.exe'],
      mobile: ['com.google.android.youtube', 'com.instagram.android', 'com.zhiliaoapp.musically', 'com.twitter.android']
    }
  ];

  for (const item of preCuratedLists) {
    const existing = await db.get('SELECT id FROM blocklists WHERE id = ?', [item.id]);
    if (!existing) {
      await db.run(
        'INSERT INTO blocklists (id, user_id, name, domains, desktop_apps, mobile_apps, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.id, 'default_user_1', item.name, JSON.stringify(item.domains), JSON.stringify(item.desktop), JSON.stringify(item.mobile), Date.now()]
      );
    }
  }

  // Ensure default routine exists
  const existingRoutine = await db.get('SELECT id FROM routines WHERE id = ?', ['rt_daily_deepwork']);
  if (!existingRoutine) {
    await db.run(
      'INSERT INTO routines (id, user_id, name, start_time, end_time, days_of_week, blocklist_id, locked_mode, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['rt_daily_deepwork', 'default_user_1', 'Daily Deep Work (Mon-Fri 09:00 - 12:00)', '09:00', '12:00', JSON.stringify([1, 2, 3, 4, 5]), 'cat_youtube_streaming', 1, 1]
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

initSchema().catch(err => {
  console.error('[DB] Schema initialization failed:', err);
});

module.exports = { db };
