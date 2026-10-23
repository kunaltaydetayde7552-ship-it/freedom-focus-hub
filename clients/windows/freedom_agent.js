/**
 * Freedom for Windows - Desktop Agent (Node.js native, 0 external dependencies)
 * Runs with elevated privileges to manage Hosts file & terminate distracting apps.
 */
const fs = require('node:fs');
const path = require('node:path');
const { exec, execSync } = require('node:child_process');
const os = require('node:os');

const SERVER_WS_URL = process.env.FREEDOM_SERVER_URL || 'wss://freedom-focus-hub.onrender.com/ws';
const HOSTS_PATH = process.env.SYSTEMROOT 
  ? path.join(process.env.SYSTEMROOT, 'System32', 'drivers', 'etc', 'hosts')
  : 'C:\\Windows\\System32\\drivers\\etc\\hosts';

const BLOCK_TAG_START = '# === FREEDOM_BLOCK_START ===';
const BLOCK_TAG_END = '# === FREEDOM_BLOCK_END ===';

let socket = null;
let activeSession = null;
let currentBlocklist = { domains: [], desktopApps: [] };
let processWatcherInterval = null;
let heartbeatInterval = null;

// Unique device ID for this Windows machine
const deviceId = `win_${os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
const deviceName = `${os.hostname()} (Windows PC)`;

console.log('========================================================');
console.log(' 🌿 Freedom for Windows - Core Desktop Agent');
console.log(` Machine: ${deviceName}`);
console.log(` Device ID: ${deviceId}`);
console.log(` Target Server: ${SERVER_WS_URL}`);
console.log('========================================================\n');

// 1. Clean hosts file on startup if leftover block exists
unblockHostsFile();

// 2. Connect to Central Sync Server
connectToServer();

function connectToServer() {
  console.log(`[Sync] Connecting to ${SERVER_WS_URL}...`);
  try {
    socket = new WebSocket(SERVER_WS_URL);
  } catch (err) {
    console.error(`[Sync] Connection error: ${err.message}. Retrying in 5s...`);
    setTimeout(connectToServer, 5000);
    return;
  }

  socket.onopen = () => {
    console.log('[Sync] Connected to Freedom Cloud Server!');
    // Register Windows device
    socket.send(JSON.stringify({
      type: 'REGISTER_DEVICE',
      deviceId,
      name: deviceName,
      platform: 'windows',
      userId: 'default_user_1',
    }));

    // Start heartbeat
    clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'HEARTBEAT' }));
      }
    }, 20000);
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch (err) {
      console.error('[Sync] Error processing server message:', err.message);
    }
  };

  socket.onerror = (err) => {
    console.error('[Sync] WebSocket error:', err.message || 'Connection failed');
  };

  socket.onclose = () => {
    console.log('[Sync] Disconnected from server. Reconnecting in 5 seconds...');
    clearInterval(heartbeatInterval);
    setTimeout(connectToServer, 5000);
  };
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'SESSION_START': {
      console.log(`\n🚨 [SESSION ACTIVATED] "${msg.session.name}"`);
      console.log(`   Duration: ${msg.session.duration_minutes} minutes`);
      console.log(`   Locked Mode: ${msg.session.locked_mode ? 'ENABLED 🔒' : 'Disabled'}`);
      console.log(`   Blocked Websites: ${msg.blocklist.domains.length} domains`);
      console.log(`   Blocked Apps: ${msg.blocklist.desktopApps.length} apps\n`);

      activeSession = msg.session;
      currentBlocklist = msg.blocklist;

      applyWebsiteBlocks(msg.blocklist.domains);
      startProcessWatcher(msg.blocklist.desktopApps);
      break;
    }

    case 'SESSION_END': {
      console.log('\n✨ [SESSION COMPLETED] Restoring all websites and apps...');
      activeSession = null;
      currentBlocklist = { domains: [], desktopApps: [] };

      unblockHostsFile();
      stopProcessWatcher();
      console.log('✅ All blocks lifted successfully. Enjoy your free time!\n');
      break;
    }
  }
}

// ----------------- HOSTS FILE CONTROLLER -----------------

function applyWebsiteBlocks(domains) {
  if (!domains || domains.length === 0) return;

  try {
    let hostsContent = fs.readFileSync(HOSTS_PATH, 'utf-8');

    // Remove existing block section if present
    hostsContent = removeBlockSection(hostsContent);

    // Build block entries
    let blockEntries = `\n${BLOCK_TAG_START}\n`;
    for (const d of domains) {
      const cleanDomain = d.trim().toLowerCase();
      if (!cleanDomain) continue;
      blockEntries += `127.0.0.1 ${cleanDomain}\n`;
      blockEntries += `::1 ${cleanDomain}\n`;
      if (!cleanDomain.startsWith('www.')) {
        blockEntries += `127.0.0.1 www.${cleanDomain}\n`;
        blockEntries += `::1 www.${cleanDomain}\n`;
      }
    }
    blockEntries += `${BLOCK_TAG_END}\n`;

    fs.writeFileSync(HOSTS_PATH, hostsContent + blockEntries, 'utf-8');
    flushDnsCache();
    console.log(`[WebBlocker] Successfully blocked ${domains.length} websites in hosts file.`);
  } catch (err) {
    console.error(`[WebBlocker] FAILED to edit hosts file: ${err.message}`);
    console.error('⚠️  NOTE: Run this script as Administrator (Right click -> Run as Administrator) to allow editing the hosts file.');
  }
}

function unblockHostsFile() {
  try {
    if (!fs.existsSync(HOSTS_PATH)) return;
    let hostsContent = fs.readFileSync(HOSTS_PATH, 'utf-8');
    if (hostsContent.includes(BLOCK_TAG_START)) {
      hostsContent = removeBlockSection(hostsContent);
      fs.writeFileSync(HOSTS_PATH, hostsContent, 'utf-8');
      flushDnsCache();
      console.log('[WebBlocker] Hosts file cleaned.');
    }
  } catch (err) {
    console.error(`[WebBlocker] Failed to restore hosts file: ${err.message}`);
  }
}

function removeBlockSection(content) {
  const startIndex = content.indexOf(BLOCK_TAG_START);
  const endIndex = content.indexOf(BLOCK_TAG_END);
  if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex + BLOCK_TAG_END.length);
    return (before + after).replace(/\n\n+/g, '\n');
  }
  return content;
}

function flushDnsCache() {
  try {
    execSync('ipconfig /flushdns', { stdio: 'ignore' });
  } catch (e) {}
}

// ----------------- PROCESS WATCHER (APP BLOCKER) -----------------

function startProcessWatcher(blockedApps) {
  stopProcessWatcher();
  if (!blockedApps || blockedApps.length === 0) return;

  const appSet = new Set(blockedApps.map(a => a.toLowerCase().trim()));

  console.log(`[AppBlocker] Monitoring processes for: ${Array.from(appSet).join(', ')}`);

  processWatcherInterval = setInterval(() => {
    // List running processes via tasklist
    exec('tasklist /NH /FO CSV', (err, stdout) => {
      if (err || !stdout) return;

      const lines = stdout.split('\r\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(/^"([^"]+)"/);
        if (match) {
          const procName = match[1].toLowerCase();
          if (appSet.has(procName)) {
            console.log(`⛔ [BLOCKED APP DETECTED] Closing "${procName}" to protect your session!`);
            try {
              execSync(`taskkill /F /IM "${procName}"`, { stdio: 'ignore' });
            } catch (e) {}
          }
        }
      }
    });
  }, 1200); // Check every 1.2 seconds
}

function stopProcessWatcher() {
  if (processWatcherInterval) {
    clearInterval(processWatcherInterval);
    processWatcherInterval = null;
  }
}

// Safe Exit Handler
function handleExit() {
  if (activeSession && activeSession.locked_mode) {
    console.log('\n⚠️  LOCKED MODE ACTIVE: Exit attempted during an active locked session.');
  }
  unblockHostsFile();
  stopProcessWatcher();
  process.exit(0);
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
