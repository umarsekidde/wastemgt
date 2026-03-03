# Waste Management and Billing System (WMBS)

Production-ready Waste Management and Billing System with Node.js, Express, MySQL, EJS, Google Maps, and Flutterwave (Mobile Money Uganda).

## Stack

- **Backend:** Node.js, Express.js, MySQL, Sequelize ORM, JWT, Helmet, CORS, rate limiting, Joi, bcrypt, CSRF
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (Fetch API), EJS
- **Maps:** Google Maps JavaScript API, live truck tracking (geolocation, 5s updates)
- **Payments:** Flutterwave (Mobile Money Uganda – MTN & Airtel)

## Roles

1. **Super Admin** – Divisions, companies, admins, broadcast, audit logs, export, settings, live map
2. **Company Admin** – Collectors, requests, assign routes, live truck map, revenue, invoices, performance
3. **Collector** – Assigned jobs, start/end route, GPS tracking (5s), complete job with proof image, emergency report
4. **Customer** – Request pickup, subscriptions (Monthly/Weekly/On-demand), pay via Flutterwave, complaints, notifications

## Setup

### 1. Clone and install

```bash
cd finalmgt
npm install
npm run audit:fix
```

**Fixing vulnerabilities:** After `npm install`, run `npm run audit:fix` (or `npm audit fix`) to address low-severity issues. The project uses an `overrides` entry for the `cookie` dependency used by CSRF so that a patched version is used.

### 2. Environment

Copy `.env.example` to `.env` and set:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (MySQL)
- `JWT_SECRET`, `COOKIE_SECRET` (use strong random values in production)
- `GOOGLE_MAPS_API_KEY` (Maps & tracking)
- `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY`, `FLW_ENCRYPTION_KEY`, `FLW_WEBHOOK_SECRET` (Flutterwave)
- Optional: SMTP for password reset and payment emails

### 3. Database

**Option A – Sequelize sync (development):**

```bash
npm run db:sync
npm run db:seed
```

**Option B – Manual schema:**

Create the database, then run `npm run db:sync` so Sequelize creates all tables (User, Division, Company, Collector, WasteRequest, Payment, TruckLocation, Notification, AuditLog, SubscriptionPlan, Complaint, Broadcast). Alternatively, use the schema in `database/schema.sql` if you prefer to run SQL by hand.

### 4. Run

```bash
npm start
# or
npm run dev
```

Open `http://localhost:3000`. Default Super Admin (after seed): `superadmin@wmbs.com` / `SuperAdmin@123`.

## Flutterwave

1. Create an account at [Flutterwave](https://flutterwave.com) and get keys.
2. In dashboard, set webhook URL to: `https://your-domain.com/webhooks/flutterwave`.
3. Webhook verifies signature using `FLW_WEBHOOK_SECRET` (or secret key). On `charge.completed`, payment is marked success and invoice can be generated.

## Google Maps

1. Enable “Maps JavaScript API” (and optionally “Geolocation”) in Google Cloud Console.
2. Create an API key and restrict by HTTP referrer or IP as needed.
3. Set `GOOGLE_MAPS_API_KEY` in `.env`.

## Project structure

```
/server
  /config       database, flutterwave
  /controllers  auth, superadmin, admin, collector, customer, payment, webhook
  /models       User, Division, Company, Collector, WasteRequest, Payment, TruckLocation, Notification, AuditLog, etc.
  /routes       auth, superadmin, admin, collector, customer, payment, webhook
  /middleware   auth, roleCheck, validate, csrf, rateLimit, auditLog
  /services     flutterwaveService, emailService
  app.js, server.js
/public
  /css          style.css, dashboard.css, responsive.css
  /js           common.js, maps.js, collector-tracking.js, payments.js
  /uploads      proof images (collector)
/views
  /layouts, /partials
  /auth         login, register, forgot-password, reset-password
  /superadmin   dashboard, divisions, companies, admins, broadcast, audit-logs, settings
  /admin        dashboard, collectors, requests, revenue, customers, performance
  /collector    dashboard (mobile-friendly, GPS)
  /customer     dashboard, complaints, notifications, payment-history
  /errors       404, 403, 500
```

## Security

- Helmet, CORS, rate limiting (general + auth + webhook)
- Joi validation on inputs
- bcrypt password hashing
- CSRF protection on form/UI routes; webhooks and `/api/` excluded where appropriate
- Secure webhook validation (Flutterwave signature)
- Role-based middleware and protected routes per role

## Deployment

1. Set `NODE_ENV=production`.
2. Use a process manager (e.g. PM2): `pm2 start server/server.js --name wmbs`.
3. Put the app behind HTTPS (e.g. Nginx reverse proxy).
4. Ensure MySQL is reachable and `.env` is set on the server.
5. Configure Flutterwave webhook URL and Google Maps key for the production domain.

## License

MIT.
