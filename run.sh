#!/usr/bin/env bash
set -e

echo "=== Project Q — Starting Up ==="

export PYTHONPATH="/home/runner/workspace:$PYTHONPATH"

# 1. Install Python dependencies (if needed)
pip install -q -r requirements.txt 2>/dev/null || true

# 2. Build the React frontend (if not already built)
if [ ! -d "api/static" ]; then
  echo "Building frontend..."
  cd frontend
  npm install
  npm run build
  cd ..
fi

# 3. Start the FastAPI server
echo "Starting server on port 5000..."
uvicorn api.main:app --host 0.0.0.0 --port 5000
