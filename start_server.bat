@echo off
title Freedom Central Sync Server
cd /d "%~dp0server"
echo ========================================================
echo  Starting Freedom Central Sync Server...
echo  Dashboard: http://localhost:5050
echo ========================================================
node src/server.js
pause
