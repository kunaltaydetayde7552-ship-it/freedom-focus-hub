// Freedom Web Dashboard Client
let socket = null;
let activeSessionInterval = null;
let currentRemainingSeconds = 0;
let currentBlocklists = [];
let selectedCategoryId = 'cat_youtube_streaming';
let audioContext = null;
let currentAudioNode = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupWebSocket();
  loadUserInfo();
  loadDevices();
  loadBlocklists();
  loadRoutines();
  checkActiveSession();
  setupUIHandlers();
});

// WebSocket Connection
function setupWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}/ws`;
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    socket.send(JSON.stringify({
      type: 'REGISTER_DEVICE',
      deviceId: 'web_dashboard_' + Math.random().toString(36).substring(7),
      name: 'Web Dashboard',
      platform: 'web',
      userId: 'default_user_1',
    }));
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'SESSION_START') {
        renderActiveSession(msg.session);
      } else if (msg.type === 'SESSION_END') {
        clearActiveSession();
      } else if (msg.type === 'DEVICE_STATUS_CHANGED') {
        loadDevices();
      }
    } catch (e) {
      console.error('WS Error:', e);
    }
  };

  socket.onclose = () => {
    setTimeout(setupWebSocket, 3000);
  };
}

// Load User info
async function loadUserInfo() {
  try {
    const res = await fetch('/api/user');
    const data = await res.json();
    if (data.user) {
      document.getElementById('userName').textContent = data.user.name;
      document.getElementById('userAvatar').src = data.user.avatar;
    }
  } catch (e) {}
}

// Load Devices
async function loadDevices() {
  try {
    const res = await fetch('/api/devices');
    const data = await res.json();
    const list = document.getElementById('devicesList');
    const totalBadge = document.getElementById('devicesCountBadge');
    const onlineIndicator = document.getElementById('onlineDevicesCount');

    if (!data.devices || data.devices.length === 0) {
      list.innerHTML = '<div class="empty-state">No devices connected yet. Launch the Windows or Android client.</div>';
      totalBadge.textContent = '0 Total';
      onlineIndicator.textContent = '0 Devices Online';
      return;
    }

    totalBadge.textContent = `${data.devices.length} Total`;
    const onlineCount = data.devices.filter(d => d.is_online).length;
    onlineIndicator.textContent = `${onlineCount} Online`;

    list.innerHTML = data.devices.map(d => `
      <div class="device-item">
        <div class="device-info">
          <strong>${escapeHtml(d.name)}</strong>
          <span>Platform: ${escapeHtml(d.platform)}</span>
        </div>
        <span class="status-pill ${d.is_online ? 'status-online' : 'status-offline'}">
          ${d.is_online ? '● Online' : 'Offline'}
        </span>
      </div>
    `).join('');
  } catch (e) {}
}

// Load Blocklists & Populate Categories Grid
async function loadBlocklists() {
  try {
    const res = await fetch('/api/blocklists');
    const data = await res.json();
    currentBlocklists = data.blocklists || [];

    const categoryGrid = document.getElementById('categoryGrid');
    const routineSelect = document.getElementById('routineBlocklistSelect');
    const listDiv = document.getElementById('blocklistsList');

    routineSelect.innerHTML = currentBlocklists.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');

    // Render Categories
    categoryGrid.innerHTML = currentBlocklists.map((b, idx) => {
      const isSel = (b.id === selectedCategoryId) || (!selectedCategoryId && idx === 0);
      if (isSel) selectedCategoryId = b.id;
      return `
        <div class="category-card ${isSel ? 'selected' : ''}" data-id="${b.id}" onclick="selectCategory('${b.id}')">
          <strong>${escapeHtml(b.name)}</strong>
          <span>${b.domains.length} Sites • ${b.desktop_apps.length} Apps • ${b.mobile_apps.length} Mobile</span>
        </div>
      `;
    }).join('');

    listDiv.innerHTML = currentBlocklists.map(b => `
      <div class="blocklist-item">
        <div>
          <strong>${escapeHtml(b.name)}</strong>
          <div class="blocklist-meta">${b.domains.length} Sites • ${b.desktop_apps.length} Desktop Apps • ${b.mobile_apps.length} Mobile Apps</div>
        </div>
        <button class="btn-sm btn-outline" onclick="editBlocklist('${b.id}')">Edit</button>
      </div>
    `).join('');
  } catch (e) {}
}

window.selectCategory = function(id) {
  selectedCategoryId = id;
  document.querySelectorAll('.category-card').forEach(c => {
    if (c.getAttribute('data-id') === id) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  });
};

// Load Routines
async function loadRoutines() {
  try {
    const res = await fetch('/api/routines');
    const data = await res.json();
    const listDiv = document.getElementById('routinesList');
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    if (!data.routines || data.routines.length === 0) {
      listDiv.innerHTML = '<div class="empty-state">No routines yet. Click + New to schedule.</div>';
      return;
    }

    listDiv.innerHTML = data.routines.map(r => {
      const daysStr = r.days_of_week.map(d => dayNames[d]).join(', ');
      return `
        <div class="routine-item">
          <div>
            <strong>${escapeHtml(r.name)}</strong>
            <div class="routine-meta">⏰ ${r.start_time} - ${r.end_time} • ${daysStr} ${r.locked_mode ? '• 🔒 Locked' : ''}</div>
          </div>
          <button class="btn-sm btn-outline" onclick="deleteRoutine('${r.id}')">Delete</button>
        </div>
      `;
    }).join('');
  } catch (e) {}
}

// Active Session Check
async function checkActiveSession() {
  try {
    const res = await fetch('/api/session/active');
    const data = await res.json();
    if (data.active) {
      renderActiveSession(data.session, data.remaining_seconds);
    } else {
      clearActiveSession();
    }
  } catch (e) {}
}

function renderActiveSession(session, remainingSec = null) {
  document.getElementById('activeSessionCard').style.display = 'block';
  document.getElementById('startSessionCard').style.display = 'none';
  document.getElementById('activeSessionTitle').textContent = session.name;

  const lockedBadge = document.getElementById('lockedBadge');
  const stopBtn = document.getElementById('btnStopSession');

  if (session.locked_mode) {
    lockedBadge.style.display = 'inline-block';
    stopBtn.disabled = true;
    stopBtn.textContent = '🔒 Locked Mode Active';
    stopBtn.title = 'Session cannot be stopped until timer finishes';
  } else {
    lockedBadge.style.display = 'none';
    stopBtn.disabled = false;
    stopBtn.textContent = 'End Session';
  }

  if (remainingSec === null) {
    remainingSec = Math.max(0, Math.round((session.end_time - Date.now()) / 1000));
  }
  currentRemainingSeconds = remainingSec;

  updateTimerDisplay();
  clearInterval(activeSessionInterval);
  activeSessionInterval = setInterval(() => {
    currentRemainingSeconds--;
    if (currentRemainingSeconds <= 0) {
      clearInterval(activeSessionInterval);
      clearActiveSession();
    } else {
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(currentRemainingSeconds / 60);
  const secs = currentRemainingSeconds % 60;
  document.getElementById('timerMinutes').textContent = String(mins).padStart(2, '0');
  document.getElementById('timerSeconds').textContent = String(secs).padStart(2, '0');
}

function clearActiveSession() {
  clearInterval(activeSessionInterval);
  document.getElementById('activeSessionCard').style.display = 'none';
  document.getElementById('startSessionCard').style.display = 'block';
}

// UI Handlers
function setupUIHandlers() {
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('customDurationInput').value = '';
    });
  });

  document.getElementById('customDurationInput').addEventListener('input', () => {
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
  });

  // Start Session Button
  document.getElementById('btnStartSession').addEventListener('click', async () => {
    const name = document.getElementById('sessionNameInput').value.trim() || 'Focused Sprint';
    let duration = 25;
    const customVal = Number(document.getElementById('customDurationInput').value);
    if (customVal && customVal > 0) {
      duration = customVal;
    } else {
      const activePill = document.querySelector('.pill-btn.active');
      if (activePill) duration = Number(activePill.getAttribute('data-min'));
    }

    const lockedMode = document.getElementById('lockedModeToggle').checked;

    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        duration_minutes: duration,
        blocklist_id: selectedCategoryId || 'cat_youtube_streaming',
        locked_mode: lockedMode,
      }),
    });
    const data = await res.json();
    if (data.session) {
      renderActiveSession(data.session);
    }
  });

  // Stop Session Button
  document.getElementById('btnStopSession').addEventListener('click', async () => {
    const res = await fetch('/api/session/stop', { method: 'POST' });
    const data = await res.json();
    if (data.error === 'LOCKED_MODE_ACTIVE') {
      alert('🔒 Locked Mode is Active! This session cannot be cancelled early.');
    } else {
      clearActiveSession();
    }
  });

  // Modals
  document.getElementById('btnOpenNewRoutineModal').addEventListener('click', () => {
    document.getElementById('routineModal').style.display = 'flex';
  });
  document.getElementById('btnCloseRoutineModal').addEventListener('click', () => {
    document.getElementById('routineModal').style.display = 'none';
  });

  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
  });

  // Save Routine
  document.getElementById('btnSaveRoutine').addEventListener('click', async () => {
    const name = document.getElementById('routineNameInput').value.trim() || 'Daily Focus';
    const startTime = document.getElementById('routineStartTime').value;
    const endTime = document.getElementById('routineEndTime').value;
    const blocklistId = document.getElementById('routineBlocklistSelect').value;
    const selectedDays = Array.from(document.querySelectorAll('.day-btn.selected'))
      .map(b => Number(b.getAttribute('data-day')));

    await fetch('/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        start_time: startTime,
        end_time: endTime,
        days_of_week: selectedDays.length ? selectedDays : [1, 2, 3, 4, 5],
        blocklist_id: blocklistId,
        locked_mode: 1,
      }),
    });
    document.getElementById('routineModal').style.display = 'none';
    loadRoutines();
  });

  // Blocklist Modal
  document.getElementById('btnOpenNewBlocklistModal').addEventListener('click', () => {
    document.getElementById('editBlocklistId').value = '';
    document.getElementById('blocklistNameInput').value = '';
    document.getElementById('blocklistDomainsInput').value = '';
    document.getElementById('blocklistDesktopAppsInput').value = '';
    document.getElementById('blocklistMobileAppsInput').value = '';
    document.getElementById('blocklistModal').style.display = 'flex';
  });
  document.getElementById('btnCloseBlocklistModal').addEventListener('click', () => {
    document.getElementById('blocklistModal').style.display = 'none';
  });

  document.getElementById('btnSaveBlocklist').addEventListener('click', async () => {
    const id = document.getElementById('editBlocklistId').value;
    const name = document.getElementById('blocklistNameInput').value.trim() || 'Custom Blocklist';
    const domains = document.getElementById('blocklistDomainsInput').value.split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const desktopApps = document.getElementById('blocklistDesktopAppsInput').value.split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const mobileApps = document.getElementById('blocklistMobileAppsInput').value.split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);

    await fetch('/api/blocklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, domains, desktop_apps: desktopApps, mobile_apps: mobileApps }),
    });
    document.getElementById('blocklistModal').style.display = 'none';
    loadBlocklists();
  });

  // Focus Audio
  document.querySelectorAll('.audio-btn[data-sound]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sound = btn.getAttribute('data-sound');
      playSynthesizedSound(sound, btn);
    });
  });
  document.getElementById('btnStopAudio').addEventListener('click', stopAudio);
}

window.editBlocklist = function(id) {
  const b = currentBlocklists.find(x => x.id === id);
  if (!b) return;
  document.getElementById('editBlocklistId').value = b.id;
  document.getElementById('blocklistNameInput').value = b.name;
  document.getElementById('blocklistDomainsInput').value = b.domains.join(', ');
  document.getElementById('blocklistDesktopAppsInput').value = b.desktop_apps.join(', ');
  document.getElementById('blocklistMobileAppsInput').value = b.mobile_apps.join(', ');
  document.getElementById('blocklistModal').style.display = 'flex';
};

window.deleteRoutine = async function(id) {
  if (confirm('Delete this routine?')) {
    await fetch(`/api/routines/${id}`, { method: 'DELETE' });
    loadRoutines();
  }
};

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}

function playSynthesizedSound(type, btn) {
  stopAudio();
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  const bufferSize = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const whiteNoise = audioContext.createBufferSource();
  whiteNoise.buffer = buffer;
  whiteNoise.loop = true;

  const filter = audioContext.createBiquadFilter();
  if (type === 'rain') {
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, audioContext.currentTime);
  } else if (type === 'waves') {
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, audioContext.currentTime);
    filter.Q.setValueAtTime(1.5, audioContext.currentTime);
  } else {
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, audioContext.currentTime);
  }

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.15, audioContext.currentTime);

  whiteNoise.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);

  whiteNoise.start();
  currentAudioNode = { whiteNoise, audioContext };

  document.querySelectorAll('.audio-btn').forEach(b => b.classList.remove('playing'));
  btn.classList.add('playing');
  document.getElementById('btnStopAudio').style.display = 'inline-block';
}

function stopAudio() {
  if (currentAudioNode) {
    try {
      currentAudioNode.whiteNoise.stop();
      currentAudioNode.audioContext.close();
    } catch (e) {}
    currentAudioNode = null;
  }
  document.querySelectorAll('.audio-btn').forEach(b => b.classList.remove('playing'));
  document.getElementById('btnStopAudio').style.display = 'none';
}
