#!/usr/bin/env bash
# build.sh — Render build script for the GetQuiz monorepo
# Runs from the repository root.
set -e  # exit immediately on any error

echo "━━━ [1/3] Installing frontend npm packages ━━━"
cd frontend
npm install

echo "━━━ [2/3] Building Vite/React frontend ━━━"
# VITE_API_URL is intentionally empty so all fetch() calls use
# a relative path (same origin as the FastAPI server).
npm run build

echo "━━━ [2/3] Copying dist/ → backend/static/ ━━━"
cd ..
rm -rf backend/static
cp -r frontend/dist backend/static

echo "━━━ [3/3] Installing Python dependencies ━━━"
cd backend
pip install --only-binary :all: -r requirements.txt

echo "✓  Build complete — backend/static/ is ready."
