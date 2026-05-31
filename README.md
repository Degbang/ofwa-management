# OFWA Operations

Standalone internal operations web app for a small team, built as an MVP with room to scale. The app covers:

- Google OAuth sign-in with approved email allow-listing
- Role-based dashboards and access control
- Multi-step request approvals
- Email notification hooks
- Private file uploads
- Inventory and vendor tracking
- Camera and equipment rentals

## Stack

- `Next.js` with the App Router
- `TypeScript`
- `Prisma`
- `PostgreSQL`
- `Supabase Auth` with Google OAuth
- Local private-file storage adapter
- SMTP-based email adapter

## Roles

- `STAFF`: submit requests and view only their own records
- `BRIAN`: finance/admin review, payment marking, inventory management
- `JAEL`: final approval
- `DICKSON`: first reviewer for Hub Fund Requests
- `EDMOND`: equipment and rental operations

## Modules

- Requests
- Approvals and audit trail
- Attachments
- Inventory items
- Vendors
- Damage / missing reports
- Rentals
- Notifications

## Approval flows

- `Cash Disbursement`, `Reimbursement`, `General`
  Brian reviews first, then forwards to Jael for final approval.
- `Hub Fund`
  Dickson reviews first, then forwards to Jael.
- `Leave`
  Jael reviews directly, while Brian is notified.
- Payable approved requests stay with `paymentStatus=PENDING` until Brian marks them paid.

## Security notes

- Login is Google OAuth only.
- Supabase Auth manages the signed-in session in cookies.
- Only approved users seeded in the database can sign in.
- Company email domain can be enforced with `COMPANY_EMAIL_DOMAIN`.
- Private uploads are stored outside the public web root.
- File downloads go through an authenticated route.
- Submitted requests are immutable through the UI.
- Approval actions and key mutations write audit logs.

## Local setup

1. Copy `.env.example` to `.env`.
2. Fill in Supabase project values and email addresses for Brian, Jael, Dickson, Edmond, and staff.
3. Set `DATABASE_URL` to a PostgreSQL database.
4. Install dependencies:

```bash
npm install
```

5. Generate Prisma client and run a migration:

```bash
npm run prisma:generate
npm run prisma:migrate
```

6. Seed approved users and role assignments:

```bash
npm run prisma:seed
```

7. Start the app:

```bash
npm run dev
```

## Google OAuth setup

- Create a Google OAuth client in Google Cloud.
- In the Google client, set the redirect URI to your Supabase Auth callback URL.
  You can copy this from `Supabase Dashboard -> Authentication -> Providers -> Google`.
- In Supabase Auth, enable the Google provider and paste the Google client ID and secret there.
- In `Supabase Dashboard -> Authentication -> URL Configuration`, add:
  - `http://localhost:3000/auth/callback`
  - `https://your-domain.com/auth/callback`
- The app completes sign-in at:
  - `http://localhost:3000/auth/callback`
  - `https://your-domain.com/auth/callback`

## Email setup

The app uses SMTP. If SMTP env vars are missing, the app logs notifications instead of sending them.

Good low-cost/free options:

- Brevo SMTP
- Google Workspace SMTP relay
- Resend SMTP-compatible setup if preferred

## Recommended production setup

For a clean handover and mostly free MVP:

- Database: `Supabase Postgres`
- Auth: `Supabase Auth`
- Private file storage: `Supabase Storage` or keep the current local adapter until you switch
- Hosting: `Vercel`, `Railway`, or any Node host with persistent env vars
- Email: `Brevo SMTP` or `Google Workspace SMTP relay`
- Scheduled alerts: call `GET /api/jobs/alerts?secret=...` from a cron service

## Important environment variables

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `COMPANY_EMAIL_DOMAIN`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `BRIAN_EMAIL`
- `JAEL_EMAIL`
- `DICKSON_EMAIL`
- `EDMOND_EMAIL`
- `STAFF_EMAILS`
- `ALERT_CRON_SECRET`

## Handover notes

- The workflow rules live mainly in [lib/actions.ts](/Users/alfreddomegil/Desktop/OFWA/management/lib/actions.ts) and [lib/request-flow.ts](/Users/alfreddomegil/Desktop/OFWA/management/lib/request-flow.ts).
- Authentication rules live in [lib/session.ts](/Users/alfreddomegil/Desktop/OFWA/management/lib/session.ts), [lib/auth-user.ts](/Users/alfreddomegil/Desktop/OFWA/management/lib/auth-user.ts), and [lib/supabase](/Users/alfreddomegil/Desktop/OFWA/management/lib/supabase).
- The schema is in [prisma/schema.prisma](/Users/alfreddomegil/Desktop/OFWA/management/prisma/schema.prisma).
- The alert endpoint is [app/api/jobs/alerts/route.ts](/Users/alfreddomegil/Desktop/OFWA/management/app/api/jobs/alerts/route.ts).
- The Supabase OAuth completion route is [app/auth/callback/route.ts](/Users/alfreddomegil/Desktop/OFWA/management/app/auth/callback/route.ts).

## MVP limitations to know

- Vendors can be edited, but inventory items do not yet have a dedicated edit form.
- Damage report status can be updated, but item repair workflows are still simple.
- The storage adapter is local/private by default; production object storage should replace it.
- Notifications are email-first and do not yet include in-app inbox UI.
