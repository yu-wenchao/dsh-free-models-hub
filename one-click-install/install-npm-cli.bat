@echo off
chcp 65001 >nul
title install dsh-free-models-hub (npm/CLI)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-npm-cli.ps1"
