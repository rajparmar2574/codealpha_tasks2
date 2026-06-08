#!/bin/bash
# SocialSpark — Start Django Backend
echo "🚀 Starting SocialSpark Backend..."
cd "$(dirname "$0")/backend"

# Check venv
if [ ! -d "venv" ]; then
  echo "📦 Creating virtual environment..."
  python3 -m venv venv
fi

# Activate venv
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null

# Install deps
echo "📦 Installing dependencies..."
pip install -r requirements.txt -q

# Run migrations
echo "🗄️  Running migrations..."
python manage.py migrate --run-syncdb

# Create superuser if not exists
echo "from django.contrib.auth.models import User; User.objects.filter(username='admin').exists() or User.objects.create_superuser('admin','admin@example.com','admin123')" | python manage.py shell -q 2>/dev/null

echo ""
echo "✅ Backend ready!"
echo "   API:   http://localhost:8000/api/"
echo "   Admin: http://localhost:8000/admin/  (admin / admin123)"
echo ""

# Start server
python manage.py runserver 0.0.0.0:8000
