@echo off
chcp 65001 >nul
title uninstall dsh-free-models-hub
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
