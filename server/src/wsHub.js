const { db } = require('./db');

class WebSocketHub {
  constructor() {
    this.clients = new Map();
  }

  handleConnection(ws) {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(ws, message);
      } catch (err) {
        console.error('Invalid message received:', err.message);
      }
    });

    ws.on('close', async () => {
      const client = this.clients.get(ws);
      if (client && client.deviceId) {
        try {
          await db.run('UPDATE devices SET is_online = 0, last_seen = ? WHERE id = ?', [Date.now(), client.deviceId]);
        } catch (e) {
          console.error('Failed to update device status:', e.message);
        }
        this.broadcastToUser(client.userId, {
          type: 'DEVICE_STATUS_CHANGED',
          deviceId: client.deviceId,
          isOnline: 0,
        });
      }
      this.clients.delete(ws);
    });
  }

  async handleMessage(ws, msg) {
    switch (msg.type) {
      case 'REGISTER_DEVICE': {
        const { deviceId, name, platform, userId } = msg;
        const uid = userId || 'default_user_1';
        this.clients.set(ws, { deviceId, name, platform, userId: uid });

        // Upsert device in DB
        const existingDevice = await db.get('SELECT id FROM devices WHERE id = ?', [deviceId]);
        if (existingDevice) {
          await db.run('UPDATE devices SET name = ?, platform = ?, last_seen = ?, is_online = 1 WHERE id = ?', [name, platform, Date.now(), deviceId]);
        } else {
          await db.run('INSERT INTO devices (id, user_id, name, platform, last_seen, is_online) VALUES (?, ?, ?, ?, ?, 1)', [deviceId, uid, name, platform, Date.now()]);
        }

        // Notify Web UI
        this.broadcastToUser(uid, {
          type: 'DEVICE_STATUS_CHANGED',
          deviceId,
          name,
          platform,
          isOnline: 1,
        });

        // Send current active session if any
        const activeSession = await db.get("SELECT * FROM sessions WHERE user_id = ? AND status = 'active' AND end_time > ?", [uid, Date.now()]);

        if (activeSession) {
          const blocklist = await db.get('SELECT * FROM blocklists WHERE id = ?', [activeSession.blocklist_id]);
          ws.send(JSON.stringify({
            type: 'SESSION_START',
            session: activeSession,
            blocklist: {
              domains: JSON.parse(blocklist.domains || '[]'),
              desktopApps: JSON.parse(blocklist.desktop_apps || '[]'),
              mobileApps: JSON.parse(blocklist.mobile_apps || '[]'),
            },
          }));
        }
        break;
      }

      case 'HEARTBEAT': {
        const client = this.clients.get(ws);
        if (client && client.deviceId) {
          await db.run('UPDATE devices SET last_seen = ?, is_online = 1 WHERE id = ?', [Date.now(), client.deviceId]);
        }
        break;
      }
    }
  }

  broadcastToUser(userId, message) {
    const payload = JSON.stringify(message);
    for (const [socket, info] of this.clients.entries()) {
      if (info.userId === userId && socket.readyState === 1 /* OPEN */) {
        socket.send(payload);
      }
    }
  }

  notifySessionStart(userId, session, blocklist) {
    this.broadcastToUser(userId, {
      type: 'SESSION_START',
      session,
      blocklist: {
        domains: JSON.parse(blocklist.domains || '[]'),
        desktopApps: JSON.parse(blocklist.desktop_apps || '[]'),
        mobileApps: JSON.parse(blocklist.mobile_apps || '[]'),
      },
    });
  }

  notifySessionEnd(userId, sessionId) {
    this.broadcastToUser(userId, {
      type: 'SESSION_END',
      sessionId,
    });
  }
}

const wsHub = new WebSocketHub();
module.exports = { wsHub };
