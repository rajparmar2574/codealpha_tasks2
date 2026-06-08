#!/bin/bash
# SocialSpark — Start Frontend Dev Server
echo "🌐 Starting SocialSpark Frontend..."
cd "$(dirname "$0")/frontend"

# Try python3, then python
if command -v python3 &>/dev/null; then
  echo "✅ Frontend at: http://localhost:3000"
  python3 -m http.server 3000
elif command -v python &>/dev/null; then
  echo "✅ Frontend at: http://localhost:3000"
  python -m http.server 3000
else
  echo "❌ Python not found. Open frontend/index.html directly in your browser."
fi
