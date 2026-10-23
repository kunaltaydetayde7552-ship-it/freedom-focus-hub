@echo off
:: Batch script to run Freedom Windows Agent with Administrative privileges
title Freedom for Windows - Desktop Agent

:: Check for administrative rights
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Running with Administrator permissions.
    cd /d "%~dp0"
    node freedom_agent.js
) else (
    echo [Notice] Requesting Administrator permissions...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb runAs"
    exit /b
)
pause
