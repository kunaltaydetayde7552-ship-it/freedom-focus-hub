@echo off
title Freedom Windows Desktop Agent

:: Check for administrative rights
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Running with Administrator permissions.
    cd /d "%~dp0clients\windows"
    node freedom_agent.js
) else (
    echo [Notice] Elevating to Administrator...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb runAs"
    exit /b
)
pause
