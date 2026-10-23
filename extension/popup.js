chrome.storage.local.get(["sessionActive", "sessionName", "remainingSeconds", "lockedMode"], (data) => {
  const statusLabel = document.getElementById("statusLabel");
  const timerDisplay = document.getElementById("timerDisplay");
  const lockedBadge = document.getElementById("lockedBadge");

  if (data.sessionActive) {
    statusLabel.textContent = "● " + (data.sessionName || "Session Active");
    statusLabel.className = "status-text";
    
    let sec = data.remainingSeconds || 0;
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    timerDisplay.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

    if (data.lockedMode) {
      lockedBadge.style.display = "inline-block";
    }
  } else {
    statusLabel.textContent = "○ Standby (No active session)";
    statusLabel.className = "status-text status-inactive";
    timerDisplay.textContent = "00:00";
    lockedBadge.style.display = "none";
  }
});

// Trigger fresh sync on popup open
chrome.runtime.sendMessage({ type: "TRIGGER_SYNC" });
