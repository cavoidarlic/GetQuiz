# GetQuiz — Developer Setup Guide

A full-stack AI quiz platform. The backend is a **FastAPI** Python server, the frontend is a **Vite + React** app, the database is **Supabase (PostgreSQL)**, and authentication is handled by **Clerk**.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Python** | 3.11+ | [python.org](https://www.python.org/downloads/) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **Git** | any | [git-scm.com](https://git-scm.com/) |

You also need accounts on three external services (all have free tiers):

| Service | Purpose | Sign up |
|---------|---------|---------|
| **Supabase** | PostgreSQL database | [supabase.com](https://supabase.com) |
| **Clerk** | User authentication | [clerk.com](https://clerk.com) |
| **OpenRouter** | Gemini AI model access | [openrouter.ai](https://openrouter.ai) |

---

## Project Structure

```
GetQuiz/
├── backend/              # FastAPI Python server
│   ├── core/
│   │   └── config.py     # Settings and env-var loading
│   ├── models/
│   │   ├── database.py   # SQLModel table definitions
│   │   └── schemas.py    # Pydantic request/response schemas
│   ├── routers/
│   │   └── quizzes.py    # All quiz API endpoints
│   ├── services/
│   │   ├── ai_service.py # OpenRouter / Gemini quiz generation
│   │   └── db_service.py # Database CRUD helpers
│   ├── main.py           # FastAPI entry point
│   ├── requirements.txt
│   └── .env              # ← you create this
│
└── frontend/             # Vite + React app
    ├── src/
    │   ├── api/          # API client + per-resource helpers
    │   ├── components/   # Shared UI (Navbar, etc.)
    │   ├── context/      # ThemeContext
    │   └── pages/        # Dashboard, Landing, History, etc.
    ├── package.json
    └── .env              # ← you create this
```

---

## Step 1 — Clone the Repository

```bash
git clone <your-repo-url>
cd GetQuiz
```

---

## Step 2 — Supabase Setup

### 2.1 Create a project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region and set a strong database password.

### 2.2 Get the connection string

In your Supabase project: **Settings → Database → Connection string → URI**

Copy the URI — it looks like:
```
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### 2.3 Run the database migration

The backend auto-creates **new** tables on startup, but it cannot add columns to **existing** tables. If this is a completely fresh Supabase project, skip this. If the tables already exist (joining an existing project), run the following SQL in **Supabase → SQL Editor**:

```sql
-- Add columns introduced after initial table creation
ALTER TABLE questions ADD COLUMN IF NOT EXISTS type        TEXT DEFAULT 'mcq';
ALTER TABLE quizzes   ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE quizzes   ADD COLUMN IF NOT EXISTS tags        TEXT DEFAULT '[]';

-- Make email optional (Clerk owns the full user profile)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
```

> [!NOTE]
> On a completely fresh Supabase project the backend creates all tables automatically on first startup. You don't need to run any SQL manually in that case.

---

## Step 3 — Clerk Setup

### 3.1 Create a Clerk application

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com/) and create a new application.
2. Choose your preferred sign-in methods (Email, Google, GitHub, etc.).

### 3.2 Get your keys

In the Clerk dashboard go to **API Keys**.

| Key | Starts with | Used in |
|-----|------------|---------|
| **Publishable Key** | `pk_test_...` | `frontend/.env` |
| **Secret Key** | `sk_test_...` | Backend (reserved for future JWT verification) |

> [!CAUTION]
> **Never** put the Secret Key (`sk_test_...`) in the frontend — it gets bundled into publicly accessible JavaScript.

### 3.3 Configure redirect paths

In the Clerk dashboard under **Paths**, set:

| Setting | Value |
|---------|-------|
| Sign-in URL | `/sign-in` |
| Sign-up URL | `/sign-up` |
| After sign-in redirect | `/dashboard` |
| After sign-up redirect | `/dashboard` |

---

## Step 4 — OpenRouter Setup

1. Go to [openrouter.ai](https://openrouter.ai) and create an account.
2. Navigate to **Keys** and create a new API key.
3. The project uses **Google Gemini 2.0 Flash** (`google/gemini-2.0-flash-001`). Verify you have credits or a free allocation on your account.

---

## Step 5 — Backend Setup

### 5.1 Create the virtual environment

```bash
cd backend
python -m venv venv
```

Activate it:

```bash
# Windows (PowerShell)
.\venv\Scripts\Activate.ps1

# macOS / Linux
source venv/bin/activate
```

### 5.2 Install dependencies

```bash
pip install -r requirements.txt

# Also install these (add them to requirements.txt if they are missing):
pip install sqlmodel psycopg2-binary httpx python-dotenv
```

### 5.3 Create `backend/.env`

Create a file named `.env` inside the `backend/` folder:

```env
# OpenRouter — AI quiz generation via Gemini
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase PostgreSQL connection string (from Step 2.2)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# Optional — direct Gemini API key (currently unused; OpenRouter is used instead)
GEMINI_API_KEY=
```

> [!WARNING]
> `.env` files must never be committed to Git. The `.gitignore` should already exclude them — verify with `git status` before pushing.

### 5.4 Start the backend server

```bash
# Confirm your virtual environment is active (you should see "(venv)" in your prompt)
uvicorn main:app --reload
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Started reloader process
```

> [!TIP]
> On first startup the backend automatically creates all database tables in Supabase. Check the Supabase **Table Editor** to confirm the `users`, `quizzes`, `questions`, `options`, `attempts`, and `user_answer_history` tables appeared.

Visit **[http://localhost:8000/docs](http://localhost:8000/docs)** for the interactive Swagger API documentation.

---

## Step 6 — Frontend Setup

### 6.1 Install dependencies

```bash
cd frontend
npm install
```

### 6.2 Create `frontend/.env`

Create a file named `.env` inside the `frontend/` folder:

```env
# Clerk Publishable Key (from Step 3.2) — must start with pk_test_ or pk_live_
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Backend API base URL
VITE_API_URL=http://localhost:8000
```

### 6.3 Start the frontend dev server

```bash
npm run dev
```

Expected output:
```
  VITE v8.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## Step 7 — Verify Everything Works

Work through this checklist end to end:

- [ ] Landing page loads at `http://localhost:5173`
- [ ] Click **Get Started Free** → Clerk sign-up modal appears
- [ ] Create an account → automatically redirected to `/dashboard`
- [ ] Click **Quiz with AI**, enter a topic (e.g. `"World War II"`), click **Generate Quiz**
- [ ] Quiz appears on the dashboard — **reload the page** and the quiz is still there ✅
- [ ] Click the avatar in the top-right → Clerk **UserButton** menu appears (manage account / sign out)
- [ ] Sign out → navbar reverts to **Log in / Get Started Free**
- [ ] Navigating to `/dashboard` while signed out redirects to Clerk sign-in ✅

---

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/quizzes/?user_id=xxx` | List all quizzes for a user |
| `GET` | `/quizzes/{id}` | Get a single quiz with all questions and options |
| `POST` | `/quizzes/generate` | Generate an AI quiz via OpenRouter and save it |
| `POST` | `/quizzes/` | Save a manually created quiz |
| `DELETE` | `/quizzes/{id}?user_id=xxx` | Delete a quiz |

Full interactive docs: **[http://localhost:8000/docs](http://localhost:8000/docs)**

---

## Environment Variables Reference

### `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | ✅ | API key for OpenRouter (AI generation) |
| `DATABASE_URL` | ✅ | Supabase PostgreSQL connection string |
| `GEMINI_API_KEY` | ❌ | Direct Gemini key (not currently used) |

### `frontend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key (starts with `pk_test_`) |
| `VITE_API_URL` | ❌ | Backend URL — defaults to `http://localhost:8000` |

---

## Common Issues & Fixes

### Backend won't start — `ModuleNotFoundError`
Your virtual environment is not active. Run the activate command first:
```bash
.\venv\Scripts\Activate.ps1   # Windows PowerShell
source venv/bin/activate       # macOS / Linux
```

### Frontend error — `Missing VITE_CLERK_PUBLISHABLE_KEY`
`frontend/.env` is missing or the wrong key was used. Confirm the value starts with `pk_test_` (not `sk_test_`).

### `422 Unprocessable Content` on quiz generation
The request payload is malformed. Confirm `topic` is a non-empty string and `count` is a number between 1 and 20.

### `column "type" of relation "questions" does not exist`
The `questions` table existed before the `type` column was added. Run in Supabase SQL Editor:
```sql
ALTER TABLE questions ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'mcq';
```

### `503 Service Unavailable` from the API
`DATABASE_URL` is missing from `backend/.env`. Add the Supabase connection string.

### Quizzes disappear after page reload
The backend is not running, or `DATABASE_URL` is misconfigured. Open the browser DevTools → Network tab and look for failed requests to `localhost:8000`.

### Clerk redirect loop on `/dashboard`
The **After sign-in redirect URL** in the Clerk dashboard is not set to `/dashboard`. Check Step 3.3.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 19 + Vite 8 |
| Routing | React Router v7 |
| Styling | Vanilla CSS |
| Icons | Lucide React |
| Authentication | Clerk (`@clerk/clerk-react`) |
| Backend framework | FastAPI 0.110 |
| ORM | SQLModel (SQLAlchemy + Pydantic) |
| Database | Supabase (PostgreSQL) |
| AI model | Google Gemini 2.0 Flash via OpenRouter |
| HTTP client (backend) | HTTPX (async) |
