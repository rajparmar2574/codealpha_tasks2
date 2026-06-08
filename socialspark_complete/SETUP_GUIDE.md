# SocialSpark — Full Setup Guide
**Stack:** Django REST API + Vanilla JS Frontend  
**Theme:** Light (Cream & Coral, editorial aesthetic)

---

## Project Structure

```
socialspark/
├── backend/
│   ├── manage.py
│   ├── settings.py
│   ├── urls.py
│   ├── requirements.txt
│   └── socialapp/
│       ├── __init__.py
│       ├── apps.py
│       ├── models.py        ← Database models
│       ├── serializers.py   ← API data shapes
│       ├── views.py         ← All API endpoints
│       └── signals.py       ← Auto-create Profile
└── frontend/
    ├── index.html           ← Single-page app shell
    ├── styles.css           ← Full light theme
    └── app.js               ← All frontend logic
```

---

## STEP 1 — Install Python & Create Virtual Environment

```bash
# Make sure Python 3.10+ is installed
python --version

# Go to backend folder
cd socialspark/backend

# Create virtual environment
python -m venv venv

# Activate it:
# macOS / Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate
```

---

## STEP 2 — Install Django Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- **Django 4.2** — web framework
- **djangorestframework** — REST API
- **django-cors-headers** — allow frontend to call API
- **Pillow** — image uploads
- **djangorestframework-simplejwt** — JWT authentication

---

## STEP 3 — Set Up the Database

```bash
# Still inside backend/ with venv active:

# Create all database tables
python manage.py makemigrations socialapp
python manage.py migrate

# (Optional) Create an admin superuser
python manage.py createsuperuser
```

---

## STEP 4 — Start the Django Server

```bash
python manage.py runserver
```

✅ API is now live at: **http://localhost:8000**  
✅ Admin panel at: **http://localhost:8000/admin**

---

## STEP 5 — Open the Frontend

You have two options:

### Option A — Simple (open directly)
Just open `frontend/index.html` in your browser.  
*(Works for basic use, but some browsers block certain features)*

### Option B — Use Live Server (Recommended)
If you have VS Code, install the **Live Server** extension, right-click `index.html` → **Open with Live Server**.

Or use Python's built-in server:
```bash
cd socialspark/frontend
python -m http.server 3000
# Then open http://localhost:3000
```

---

## STEP 6 — Use the App

1. Open the frontend in browser
2. **Register** a new account (click "Create one →")
3. Create posts, explore users, follow people, like & comment!

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Create account |
| POST | `/api/auth/login/` | Login → get JWT |
| GET | `/api/me/` | Current user info |
| PATCH | `/api/me/` | Update profile |
| GET | `/api/users/` | List / search users |
| GET | `/api/users/:username/` | User profile |
| POST | `/api/users/:username/follow/` | Follow/unfollow toggle |
| GET | `/api/users/:username/posts/` | User's posts |
| GET | `/api/posts/` | All posts |
| GET | `/api/posts/?feed=true` | Following feed |
| POST | `/api/posts/` | Create post |
| DELETE | `/api/posts/:id/` | Delete own post |
| POST | `/api/posts/:id/like/` | Like/unlike toggle |
| GET | `/api/posts/:id/comments/` | Post comments |
| POST | `/api/posts/:id/comments/` | Add comment |

---

## Database Models

```
User (Django built-in)
  └── Profile (1-to-1)
        bio, avatar, website, location

Post
  author → User
  content, image, created_at

Comment
  author → User
  post → Post
  content, created_at

Like
  user → User
  post → Post
  [unique together: user + post]

Follow
  follower → User
  following → User
  [unique together: follower + following]
```

---

## Features Implemented

✅ **User Profiles** — name, bio, avatar, location, website  
✅ **Auth** — register, login, JWT tokens stored in localStorage  
✅ **Posts** — create, view, delete own posts  
✅ **Feed** — "All posts" or "Following only" tabs  
✅ **Likes** — toggle like on any post, live count updates  
✅ **Comments** — view & add comments in modal  
✅ **Follow System** — follow/unfollow, follower counts  
✅ **Explore** — search users by username  
✅ **Profile Page** — stats, edit own profile  
✅ **Suggestions** — right sidebar suggests users to follow  

---

## Production Checklist

Before deploying:
- [ ] Change `SECRET_KEY` in settings.py
- [ ] Set `DEBUG = False`
- [ ] Set `ALLOWED_HOSTS` to your domain
- [ ] Set `CORS_ALLOW_ALL_ORIGINS = False`, add your frontend domain
- [ ] Use PostgreSQL instead of SQLite
- [ ] Serve media files via nginx or S3
- [ ] Use environment variables for secrets

---

*Built with Django REST Framework + Vanilla JS. Light theme: Playfair Display + DM Sans.*
