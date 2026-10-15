#!/usr/bin/env sh
# Inicia o agente local do JobFinder (Mac/Linux)
cd "$(dirname "$0")" || exit 1
if [ ! -x .venv/bin/python ]; then
  echo "Preparando o agente pela primeira vez, isso leva 1 ou 2 minutos..."
  python3 -m venv .venv && .venv/bin/python -m pip install --quiet --upgrade pip && .venv/bin/python -m pip install --quiet -r requirements.txt || exit 1
fi
exec .venv/bin/python agente.py
