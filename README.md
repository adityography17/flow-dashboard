# Flow by Anecdote — Agency Management Dashboard

A full-featured agency management platform with client management, content pipeline, team chat, HR, AI assessment, and Indian festival content calendar.

---

## 🚀 Deploy in 4 Steps (~20 minutes, free forever)

### Step 1 — Set up Supabase (your database)

1. Go to **[supabase.com](https://supabase.com)** → Sign up free
2. Click **New Project** → name it `flow-anecdote` → set a password → click Create
3. Wait ~2 minutes for it to spin up
4. Go to **SQL Editor** (left sidebar) → **New Query**
5. Open the file `supabase-setup.sql` from this folder
6. Copy the entire contents → paste into SQL Editor → click **Run**
7. You should see "Success. No rows returned"
8. Go to **Settings → API** → copy:
   - `Project URL` (looks like `https://xxxx.supabase.co`)
   - `anon public` key (long string starting with `eyJ...`)

---

### Step 2 — Push to GitHub

1. Go to **[github.com](https://github.com)** → sign up / log in
2. Click **+** → **New repository** → name it `flow-dashboard` → **Public** → **Create**
3. Open terminal in this folder and run:

```bash
git init
git add .
git commit -m "Initial commit — Flow by Anecdote"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/flow-dashboard.git
git push -u origin main
```

*(Replace YOUR_USERNAME with your GitHub username)*

---

### Step 3 — Deploy on Vercel

1. Go to **[vercel.com](https://vercel.com)** → Sign up with GitHub
2. Click **Add New → Project**
3. Import your `flow-dashboard` repo → click **Import**
4. Before clicking Deploy, click **Environment Variables** and add:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | your Project URL from Step 1 |
| `VITE_SUPABASE_ANON_KEY` | your anon key from Step 1 |

5. Click **Deploy** → wait ~2 minutes
6. ✅ Your app is live at `flow-dashboard.vercel.app`

---

### Step 4 — Add a custom domain (optional)

In Vercel → your project → **Settings → Domains** → add your domain.

For a free domain: **[freenom.com](https://freenom.com)** gives free `.tk`, `.ml`, `.ga` domains.
For a professional domain: **[namecheap.com](https://namecheap.com)** → `.com` for ~₹800/year.

---

## 🔄 Updating the app after changes

```bash
git add .
git commit -m "describe your change"
git push
```

Vercel auto-deploys every push. Live in ~60 seconds.

---

## 🧪 Running locally

```bash
# Install Node.js from nodejs.org first, then:
npm install

# Create your local env file
cp .env.example .env.local
# Edit .env.local and add your Supabase URL and key

npm run dev
# Open http://localhost:5173
```

---

## 👤 Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `SuperAdmin` | `super123` |
| Admin | `Admin` | `admin123` |
| Executive 1 | `Executive_1` | `exec123` |
| Executive 2 | `Executive_2` | `exec456` |

*Change passwords in the app: Super Admin → User Logins → Edit*

---

## 📦 What's stored in Supabase

| Table | What it holds |
|-------|---------------|
| `users` | Team member accounts, names, roles, passwords |
| `clients` | Client profiles, services, social handles |
| `content` | Posts, captions, media, approval status |
| `calendar` | Content calendar plans per client per month |
| `leaves` | Leave applications and approvals |
| `attendance` | Punch-in/out records |
| `messages` | Team chat messages (realtime) |
| `planner_events` | Personal calendar blocks per user |

---

## ⚙️ Tech Stack

- **Frontend:** React 18 + Vite
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **AI:** Anthropic Claude API (for captions & assessments)
- **Realtime:** Supabase Realtime (live chat)

---

## 🆘 Troubleshooting

**"Offline mode" banner showing:**
→ Your Supabase env variables aren't set. Check Vercel → Settings → Environment Variables.

**Data not saving:**
→ Make sure you ran `supabase-setup.sql` completely. Check Supabase → Table Editor — you should see all 8 tables.

**Login not working:**
→ Check if users table has data in Supabase → Table Editor → users.

**Build failing on Vercel:**
→ Make sure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are added as environment variables, not just in `.env.local`.
