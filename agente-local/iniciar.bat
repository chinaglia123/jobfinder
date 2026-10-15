@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Agente do JobFinder

where python >nul 2>nul
if errorlevel 1 (
  echo Python nao encontrado. Instale o Python 3.10 ou mais novo em https://www.python.org/downloads/
  echo Marque a opcao "Add python.exe to PATH" durante a instalacao.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Preparando o agente pela primeira vez, isso leva 1 ou 2 minutos...
  python -m venv .venv || (pause & exit /b 1)
  ".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
  ".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt || (pause & exit /b 1)
)

".venv\Scripts\python.exe" agente.py
pause
