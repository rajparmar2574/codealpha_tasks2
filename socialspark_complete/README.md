# SocialSpark 🚀

A full-stack social media app — Django REST API + Vanilla JS frontend.

## Quick Start

### Step 1 — Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
API runs at: http://localhost:8000

### Step 2 — Frontend
Open a new terminal:
```bash
cd frontend
python3 -m http.server 3000
```
Open http://localhost:3000 in your browser.

### OR use the scripts:
```bash
./start_backend.sh    # terminal 1
./start_frontend.sh   # terminal 2
```

## Features
- ✅ Register / Login (JWT auth)
- ✅ User Profiles with avatar upload
- ✅ Create Posts (text + image)
- ✅ Like / Unlike posts
- ✅ Comments
- ✅ Follow / Unfollow users
- ✅ Feed (All posts / Following only)
- ✅ Explore & search users
- ✅ Notifications (likes, comments, follows)
- ✅ Edit profile
- ✅ Admin panel at /admin (admin / admin123)

## Stack
- **Backend**: Django 4.2 + Django REST Framework + JWT
- **Frontend**: HTML + CSS + Vanilla JS
- **Database**: SQLite (built-in, zero config)
- **Theme**: Light — cream & coral, Playfair Display + DM Sans
