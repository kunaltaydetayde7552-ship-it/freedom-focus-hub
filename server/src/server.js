const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer } = require('ws');
const { db } = require('./db');
const { wsHub } = require('./wsHub');
const { startScheduler } = require('./scheduler');

const PORT = process.env.PORT || 5050;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  const json = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  const readBody = () => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });

  // REST API Routes
  if (pathname.startsWith('/api/')) {
    const userId = 'default_user_1';
    try {
      // 1. User info
      if (pathname === '/api/user' && req.method === 'GET') {
        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        return json({ user });
      }

      // 2. Devices list
      if (pathname === '/api/devices' && req.method === 'GET') {
        const devices = await db.all('SELECT * FROM devices WHERE user_id = ? ORDER BY last_seen DESC', [userId]);
        return json({ devices });
      }

      // 3. Blocklists
      if (pathname === '/api/blocklists' && req.method === 'GET') {
        const lists = await db.all('SELECT * FROM blocklists WHERE user_id = ?', [userId]);
        const parsedLists = lists.map(l => ({
          ...l,
          domains: JSON.parse(l.domains || '[]'),
          desktop_apps: JSON.parse(l.desktop_apps || '[]'),
          mobile_apps: JSON.parse(l.mobile_apps || '[]'),
        }));
        return json({ blocklists: parsedLists });
      }

      if (pathname === '/api/blocklists' && req.method === 'POST') {
        const data = await readBody();
        const { id, name, domains, desktop_apps, mobile_apps } = data;
        const listId = id || `bl_${Date.now()}`;
        
        const existing = await db.get('SELECT id FROM blocklists WHERE id = ?', [listId]);
        if (existing) {
          await db.run(`
            UPDATE blocklists 
            SET name = ?, domains = ?, desktop_apps = ?, mobile_apps = ? 
            WHERE id = ?
          `, [name, JSON.stringify(domains || []), JSON.stringify(desktop_apps || []), JSON.stringify(mobile_apps || []), listId]);
        } else {
          await db.run(`
            INSERT INTO blocklists (id, user_id, name, domains, desktop_apps, mobile_apps, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [listId, userId, name, JSON.stringify(domains || []), JSON.stringify(desktop_apps || []), JSON.stringify(mobile_apps || []), Date.now()]);
        }
        return json({ success: true, id: listId });
      }

      // 4. Routines (Schedules)
      if (pathname === '/api/routines' && req.method === 'GET') {
        const routines = await db.all('SELECT * FROM routines WHERE user_id = ?', [userId]);
        const parsed = routines.map(r => ({
          ...r,
          days_of_week: JSON.parse(r.days_of_week || '[]'),
        }));
        return json({ routines: parsed });
      }

      if (pathname === '/api/routines' && req.method === 'POST') {
        const data = await readBody();
        const { name, start_time, end_time, days_of_week, blocklist_id, locked_mode } = data;
        const routineId = `rt_${Date.now()}`;
        await db.run(`
          INSERT INTO routines (id, user_id, name, start_time, end_time, days_of_week, blocklist_id, locked_mode, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [routineId, userId, name, start_time, end_time, JSON.stringify(days_of_week || []), blocklist_id, locked_mode ? 1 : 0]);
        return json({ success: true, id: routineId });
      }

      if (pathname.startsWith('/api/routines/') && req.method === 'DELETE') {
        const routineId = pathname.replace('/api/routines/', '');
        await db.run('DELETE FROM routines WHERE id = ? AND user_id = ?', [routineId, userId]);
        return json({ success: true });
      }

      // 5. Active Session
      if (pathname === '/api/session/active' && req.method === 'GET') {
        const session = await db.get("SELECT * FROM sessions WHERE user_id = ? AND status = 'active' AND end_time > ?", [userId, Date.now()]);
        if (!session) return json({ active: false });

        const blocklist = await db.get('SELECT * FROM blocklists WHERE id = ?', [session.blocklist_id]);
        return json({
          active: true,
          session,
          remaining_seconds: Math.max(0, Math.round((session.end_time - Date.now()) / 1000)),
          blocklist: {
            domains: JSON.parse(blocklist.domains || '[]'),
            desktop_apps: JSON.parse(blocklist.desktop_apps || '[]'),
            mobile_apps: JSON.parse(blocklist.mobile_apps || '[]'),
          },
        });
      }

      // 6. Start Session ("Start Now")
      if (pathname === '/api/session/start' && req.method === 'POST') {
        const data = await readBody();
        const { name, duration_minutes, blocklist_id, locked_mode } = data;
        const duration = Number(duration_minutes) || 30;
        const startTime = Date.now();
        const endTime = startTime + (duration * 60 * 1000);
        const sessionId = `sess_${startTime}`;

        await db.run("UPDATE sessions SET status = 'completed' WHERE user_id = ? AND status = 'active'", [userId]);

        await db.run(`
          INSERT INTO sessions (id, user_id, name, start_time, end_time, duration_minutes, locked_mode, blocklist_id, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `, [sessionId, userId, name || 'Focus Session', startTime, endTime, duration, locked_mode ? 1 : 0, blocklist_id]);

        const session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
        const blocklist = await db.get('SELECT * FROM blocklists WHERE id = ?', [blocklist_id]);

        console.log(`[API] Manual session started: "${name}" for ${duration} mins. Broadcasting to devices...`);
        wsHub.notifySessionStart(userId, session, blocklist);

        return json({ success: true, session });
      }

      // 7. Stop Session
      if (pathname === '/api/session/stop' && req.method === 'POST') {
        const session = await db.get("SELECT * FROM sessions WHERE user_id = ? AND status = 'active' AND end_time > ?", [userId, Date.now()]);

        if (!session) return json({ error: 'No active session' }, 404);

        if (session.locked_mode === 1) {
          return json({
            error: 'LOCKED_MODE_ACTIVE',
            message: 'Locked Mode is active! You cannot stop this session until the timer expires.',
          }, 403);
        }

        await db.run("UPDATE sessions SET status = 'cancelled' WHERE id = ?", [session.id]);
        wsHub.notifySessionEnd(userId, session.id);
        console.log(`[API] Session ${session.id} stopped by user.`);
        return json({ success: true });
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('[API Error]:', err);
      return json({ error: 'Internal Server Error', details: err.message }, 500);
    }
  }

  // Static files handler
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Setup WebSocket Server attached to HTTP Server
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  wsHub.handleConnection(ws);
});

// Start scheduler
startScheduler();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` Freedom Sync Server running on port ${PORT}`);
  console.log(` Web Dashboard available at http://localhost:${PORT}`);
  console.log(` WebSocket URL: ws://localhost:${PORT}/ws`);
  console.log(`====================================================`);
});
