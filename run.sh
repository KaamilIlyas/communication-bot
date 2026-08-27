#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "========================================================"
echo "  🎙️  Starting Real-Time English Voice AI Bot"
echo "========================================================"

# Clean up any stale processes on ports 3001 and 5173
lsof -ti :3001 | xargs kill -9 2>/dev/null || true
lsof -ti :5173 | xargs kill -9 2>/dev/null || true

# Trap SIGINT to cleanly terminate children
trap 'kill 0' SIGINT SIGTERM EXIT

# Start backend server
echo "🚀 Starting Node.js backend (Port 3001)..."
npm --prefix server run dev &
BACKEND_PID=$!

# Wait briefly for backend to initialize
sleep 2

# Start frontend Vite dev server
echo "✨ Starting React frontend (Port 5173)..."
npm --prefix client run dev &
FRONTEND_PID=$!

echo "========================================================"
echo "🟢 App is running!"
echo "🌐 Frontend: http://localhost:5173"
echo "🔊 Backend:  http://localhost:3001"
echo "Press Ctrl+C to stop both servers."
echo "========================================================"

wait
