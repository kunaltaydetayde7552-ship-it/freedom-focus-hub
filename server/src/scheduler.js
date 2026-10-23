const { db } = require('./db');
const { wsHub } = require('./wsHub');

async function checkRoutinesAndSessions() {
  try {
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHours}:${currentMinutes}`;
    const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const nowMs = now.getTime();

    // 1. Check expired active sessions
    const expiredSessions = await db.all("SELECT * FROM sessions WHERE status = 'active' AND end_time <= ?", [nowMs]);
    for (const session of expiredSessions) {
      await db.run("UPDATE sessions SET status = 'completed' WHERE id = ?", [session.id]);
      console.log(`[Scheduler] Session ${session.id} (${session.name}) completed.`);
      wsHub.notifySessionEnd(session.user_id, session.id);
    }

    // 2. Check routines to trigger
    const routines = await db.all('SELECT * FROM routines WHERE is_active = 1');
    for (const rt of routines) {
      let days = [];
      try {
        days = JSON.parse(rt.days_of_week);
      } catch (e) {
        days = [];
      }

      if (days.includes(currentDay) && rt.start_time === currentTime) {
        const existing = await db.get(`
          SELECT id FROM sessions 
          WHERE user_id = ? AND name = ? AND start_time > ?
        `, [rt.user_id, `Routine: ${rt.name}`, nowMs - 120000]);

        if (!existing) {
          const [sH, sM] = rt.start_time.split(':').map(Number);
          const [eH, eM] = rt.end_time.split(':').map(Number);
          let durationMinutes = (eH * 60 + eM) - (sH * 60 + sM);
          if (durationMinutes <= 0) durationMinutes = 60;

          const sessionId = `sess_rt_${Date.now()}`;
          const endTimeMs = nowMs + (durationMinutes * 60 * 1000);

          await db.run(`
            INSERT INTO sessions (id, user_id, name, start_time, end_time, duration_minutes, locked_mode, blocklist_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
          `, [sessionId, rt.user_id, `Routine: ${rt.name}`, nowMs, endTimeMs, durationMinutes, rt.locked_mode, rt.blocklist_id]);

          const blocklist = await db.get('SELECT * FROM blocklists WHERE id = ?', [rt.blocklist_id]);
          const session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);

          console.log(`[Scheduler] Auto-started routine session "${rt.name}" until ${rt.end_time}.`);
          wsHub.notifySessionStart(rt.user_id, session, blocklist);
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error in checkRoutinesAndSessions:', err.message);
  }
}

function startScheduler() {
  setInterval(checkRoutinesAndSessions, 15000);
  console.log('[Scheduler] Routine and Session engine started.');
}

module.exports = { startScheduler };
