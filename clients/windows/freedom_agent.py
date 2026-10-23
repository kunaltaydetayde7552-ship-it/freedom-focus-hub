"""
Freedom for Windows - Python Desktop Agent
Runs in background to block websites (hosts file) & applications (tasklist/taskkill).
"""

import os
import sys
import time
import json
import socket
import platform
import subprocess
import threading

SERVER_HOST = os.environ.get("FREEDOM_SERVER_HOST", "localhost")
SERVER_PORT = int(os.environ.get("FREEDOM_SERVER_PORT", "5050"))
HOSTS_PATH = os.path.join(os.environ.get("SYSTEMROOT", "C:\\Windows"), "System32", "drivers", "etc", "hosts")

BLOCK_TAG_START = "# === FREEDOM_BLOCK_START ==="
BLOCK_TAG_END = "# === FREEDOM_BLOCK_END ==="

device_id = f"win_{socket.gethostname().lower()}"
device_name = f"{socket.gethostname()} (Windows PC)"

active_session = None
blocked_domains = []
blocked_desktop_apps = []
watcher_running = False

def is_admin():
    try:
        import ctypes
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except:
        return False

def flush_dns():
    try:
        subprocess.run(["ipconfig", "/flushdns"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except:
        pass

def unblock_hosts():
    if not os.path.exists(HOSTS_PATH):
        return
    try:
        with open(HOSTS_PATH, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        if BLOCK_TAG_START in content and BLOCK_TAG_END in content:
            start_idx = content.find(BLOCK_TAG_START)
            end_idx = content.find(BLOCK_TAG_END) + len(BLOCK_TAG_END)
            new_content = content[:start_idx] + content[end_idx:]
            with open(HOSTS_PATH, "w", encoding="utf-8") as f:
                f.write(new_content.strip() + "\n")
            flush_dns()
            print("[WebBlocker] Hosts file unblocked & restored.")
    except Exception as e:
        print(f"[WebBlocker] Warning restoring hosts: {e}")

def apply_hosts_block(domains):
    if not domains:
        return
    try:
        unblock_hosts()
        with open(HOSTS_PATH, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        
        block_lines = [f"\n{BLOCK_TAG_START}"]
        for d in domains:
            d = d.strip().lower()
            if not d:
                continue
            block_lines.append(f"127.0.0.1 {d}")
            block_lines.append(f"::1 {d}")
            if not d.startswith("www."):
                block_lines.append(f"127.0.0.1 www.{d}")
                block_lines.append(f"::1 www.{d}")
        block_lines.append(f"{BLOCK_TAG_END}\n")
        
        with open(HOSTS_PATH, "a", encoding="utf-8") as f:
            f.write("\n".join(block_lines))
        flush_dns()
        print(f"[WebBlocker] Blocked {len(domains)} websites in hosts file.")
    except PermissionError:
        print("⚠️  [ERROR] Administrative privileges required to write to hosts file!")
        print("    Please run this script as Administrator.")
    except Exception as e:
        print(f"[WebBlocker] Error writing to hosts: {e}")

def process_watcher_thread():
    global watcher_running, blocked_desktop_apps
    while watcher_running:
        if blocked_desktop_apps:
            try:
                out = subprocess.check_output(["tasklist", "/NH", "/FO", "CSV"], text=True, errors="ignore")
                for line in out.splitlines():
                    parts = line.strip().split('","')
                    if parts and len(parts) > 0:
                        proc_name = parts[0].replace('"', '').lower()
                        if proc_name in blocked_desktop_apps:
                            print(f"⛔ [BLOCKED APP] Closing '{proc_name}' to maintain focus!")
                            subprocess.run(["taskkill", "/F", "/IM", proc_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except:
                pass
        time.sleep(1.2)

def main():
    print("========================================================")
    print(" 🌿 Freedom for Windows - Python Desktop Agent")
    print(f" Machine: {device_name}")
    print(f" Admin status: {'Administrator ✅' if is_admin() else 'Standard User (Hosts edit may need Admin) ⚠️'}")
    print("========================================================")

    # Initial cleanup
    unblock_hosts()

    # Fallback to polling / WebSocket via Node agent recommended for zero-dependency live sync
    print("\n[Notice] For real-time sync with your Android phone and Web Dashboard,")
    print("launch the agent using:")
    print("   node clients/windows/freedom_agent.js")
    print("or run 'run_windows_agent.bat'\n")

if __name__ == "__main__":
    main()
