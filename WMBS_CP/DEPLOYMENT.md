# WMBS Deployment Guide

## InfinityFree and static hosts

WMBS is a **Node.js application**. It cannot run on **InfinityFree** or other hosts that only support static files or PHP. InfinityFree will not execute `node server/server.js`.

- **index.html** in the project root is there so InfinityFree can “detect” a default page if you upload the project; it only explains that the app needs a Node host and where the login page will be (`/auth/login`).
- To run the full app (login, dashboards, payments, etc.), use a host that supports Node.js (see below).

## Free Node.js hosting (to run the full app)

Deploy the project to a service that runs Node.js and provides a MySQL database (or use an external free MySQL host):

- **[Render](https://render.com)** – Free tier: Node app + free PostgreSQL (you can keep MySQL and use an external DB).
- **[Railway](https://railway.app)** – Free tier: Node + MySQL add-on.
- **[Cyclic](https://www.cyclic.sh)** – Free Node hosting; use an external MySQL (e.g. FreeMySQLHosting) and set `DATABASE_URL` or your DB vars in the dashboard.

After deployment, the **login page** is: `https://your-app-url/auth/login`.

## Prerequisites

- Node.js 18+
- MySQL 8+
- HTTPS domain (for Flutterwave webhook and secure cookies)

## Steps

1. **Server setup**
   - Install Node and MySQL.
   - Create database: `CREATE DATABASE wmbs_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`

2. **Code**
   - Clone/copy the project and run `npm install --production`.
   - Copy `.env.example` to `.env` and set all variables for production (see README).

3. **Database**
   - Run `npm run db:sync` then `npm run db:seed` (or use your migrations).
   - Ensure `DB_ALTER` is not set in production to avoid accidental schema changes.

4. **Process manager (PM2)**
   ```bash
   pm2 start server/server.js --name wmbs
   pm2 save
   pm2 startup
   ```

5. **Reverse proxy (Nginx)**
   - Point your domain to the server and proxy to `http://127.0.0.1:3000` (or your PORT).
   - Enable SSL (e.g. Let's Encrypt).
   - Example location block:
   ```nginx
   location / {
     proxy_pass http://127.0.0.1:3000;
     proxy_http_version 1.1;
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

6. **Flutterwave**
   - In Flutterwave dashboard set webhook URL to `https://your-domain.com/webhooks/flutterwave`.
   - Set `FLW_WEBHOOK_SECRET` in `.env` (per Flutterwave docs).

7. **Google Maps**
   - Restrict the API key by HTTP referrer to your domain(s).

8. **Security**
   - Use strong `JWT_SECRET` and `COOKIE_SECRET`.
   - Keep `NODE_ENV=production`.
   - Do not expose `.env` or uploads directory.
