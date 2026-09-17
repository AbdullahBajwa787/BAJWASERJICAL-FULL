@echo off
title BAJWA SERJICAL - Admin/Store Server
cd /d "%~dp0"
echo ============================================
echo   BAJWA SERJICAL - Server starting...
echo   Store:  http://127.0.0.1:3000
echo   Admin:  http://127.0.0.1:3000/admin
echo   Close this window to stop the server
echo ============================================
node admin-server.js
pause