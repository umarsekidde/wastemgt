# Deploy WMBS to GitHub + Render

## 1. Push your project to GitHub

In your project folder (where `package.json` is):

```bash
git init
git add .
git commit -m "Initial WMBS - ready for Render"
git branch -M main
```

Create a **new repository** on GitHub (github.com → New repository). Do **not** add a README or .gitignore there. Then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your GitHub username and repo name.

**Important:** Your `.env` file is in `.gitignore`, so it will **not** be pushed. You will add those values in Render’s dashboard instead.

---

## 2. Create a MySQL database (Render has no built-in MySQL)

Render does not provide MySQL. Use one of these **free** options:

- **[PlanetScale](https://planetscale.com)** – free tier, MySQL-compatible.
- **[FreeMySQLHosting.net](https://www.freemysqlhosting.net)** – free MySQL.
- **[Railway](https://railway.app)** – create a MySQL service, get connection details.

After you create the database, note: **host**, **port**, **user**, **password**, and **database name**.

---

## 3. Create the Web Service on Render

1. Go to **[render.com](https://render.com)** and sign up / log in.
2. Click **New +** → **Web Service**.
3. Connect your **GitHub** account if needed, then select your **WMBS repository**.
4. Use these settings:

   | Field | Value |
   |-------|--------|
   | **Name** | `wmbs` (or any name) |
   | **Region** | Choose closest to you |
   | **Branch** | `main` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Instance Type** | Free |

5. Click **Advanced** and add **Environment Variables**. Add every variable you have in `.env`, for example:

   | Key | Value |
   |----|--------|
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` (Render sets this automatically; 3000 is fine) |
   | `APP_URL` | `https://wmbs-xxxx.onrender.com` (replace with your service URL after first deploy) |
   | `DB_HOST` | your MySQL host |
   | `DB_PORT` | `3306` (or your DB port) |
   | `DB_USER` | your MySQL user |
   | `DB_PASSWORD` | your MySQL password |
   | `DB_NAME` | your database name |
   | `DB_LOGGING` | `false` |
   | `DB_ALTER` | `false` |
   | `JWT_SECRET` | a long random string (e.g. 32+ characters) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `COOKIE_SECRET` | another long random string |
   | `CORS_ORIGIN` | leave empty or set to your front-end URL if different |

   Add `FLW_*` and optional `GOOGLE_MAPS_API_KEY`, `SMTP_*` etc. if you use them.

6. Click **Create Web Service**. Render will clone the repo, run `npm install`, then `npm start`.

---

## 4. Run database setup on Render

After the first deploy, the app may fail until the database has tables. You can:

**Option A – Run sync/seed via Render Shell**

1. In Render dashboard, open your service → **Shell** tab.
2. Run:
   ```bash
   npm run db:sync
   npm run db:seed
   ```
3. Redeploy if needed (Deploy → Manual Deploy).

**Option B – Run sync/seed locally against the production DB**

1. Copy your production DB vars from Render into a temporary `.env.production` (or set them in your terminal).
2. From your project folder run:
   ```bash
   npm run db:sync
   npm run db:seed
   ```
   (Your local app will use the env that points to the production MySQL.)

**Option C – One-time seed URL (no Shell; e.g. Render free tier)**

1. In Render dashboard → your service → **Environment**, add a variable: **Key** `SEED_SECRET`, **Value** a long random string (e.g. `mySecretSeedKey2024`).
2. Save and wait for the service to redeploy.
3. In your browser, visit: `https://YOUR-SERVICE-NAME.onrender.com/api/seed?secret=mySecretSeedKey2024` (use the same value you set for `SEED_SECRET`).
4. You should see JSON like `{"ok":true,"message":"Seed completed. Super Admin: superadmin@wmbs.com / SuperAdmin@123"}`. Then log in at `/auth/login` with **superadmin@wmbs.com** / **SuperAdmin@123**.
5. (Recommended) Remove `SEED_SECRET` from Render Environment and redeploy so the endpoint no longer works.

---

## 5. Your live URLs

- **Home / redirect:** `https://YOUR-SERVICE-NAME.onrender.com/`
- **Login page:** `https://YOUR-SERVICE-NAME.onrender.com/auth/login`

Update `APP_URL` in Render Environment to this URL so emails and redirects use the correct domain.

---

## 6. After first deploy

- **Free tier:** The service may sleep after ~15 minutes of no traffic; the first request can take 30–60 seconds to wake up.
- **Flutterwave:** In the Flutterwave dashboard, set the webhook URL to  
  `https://YOUR-SERVICE-NAME.onrender.com/webhooks/flutterwave`.
- **HTTPS:** Render provides HTTPS by default; use the `https://` URL everywhere.

---

## Quick checklist

- [ ] `.env` is in `.gitignore` (do not commit it).
- [ ] Code pushed to GitHub.
- [ ] MySQL database created and connection details ready.
- [ ] Render Web Service created, repo connected, Build: `npm install`, Start: `npm start`.
- [ ] All env vars added in Render (DB_*, JWT_SECRET, COOKIE_SECRET, APP_URL, etc.).
- [ ] `db:sync` and `db:seed` run (via Shell or locally against prod DB).
- [ ] `APP_URL` set to your Render URL.
- [ ] Login tested at `https://YOUR-SERVICE.onrender.com/auth/login`.
