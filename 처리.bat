@echo off
chcp 65001 >nul
cd /d "%~dp0"
claude -p "로컬 처리"
pause
