# Deploying the booking system

## 1. Database

Use a managed PostgreSQL 14+ database (Neon, Supabase, Railway, AWS RDS, …). Set `DATABASE_URL`, then:

```bash
npm ci
npm run db:deploy      # applies migrations, incl. the double-booking exclusion constraint
npm run db:seed        # first deploy only — then edit/remove the demo accounts
```

## 2. Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Production database |
| `APP_URL` | yes | Public URL of this app, e.g. `https://book.qalbeabbas.com` (used in emails and Stripe redirects) |
| `MAIN_SITE_URL` | yes | e.g. `https://qalbeabbas.com` |
| `STRIPE_SECRET_KEY` | for card payments | `sk_live_…` (or `sk_test_…` on staging) |
| `STRIPE_WEBHOOK_SECRET` | for card payments | `whsec_…` from the webhook endpoint below |
| `RESEND_API_KEY` | for email | From resend.com |
| `EMAIL_FROM` | for email | Address on a domain verified in Resend |
| `CRON_SECRET` | yes | Long random string |
| `PAYMENT_MOCK_ENABLED` | no | Ignored in production |

Keep secrets in the host's secret store — never in the repository.

## 3. Stripe

1. Dashboard → Developers → Webhooks → **Add endpoint**: `{APP_URL}/api/webhooks/stripe`.
2. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Test end-to-end in **test mode** before switching to live keys.

Local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

## 4. Email

Verify your domain in Resend (SPF/DKIM DNS records), set `RESEND_API_KEY` and `EMAIL_FROM`. Check **Admin → Email log** — status should be `SENT`.

## 5. Scheduled jobs

Expired reservations are released and reminders sent by `runScheduledJobs`. Either:

- run `npm run worker` as a second always-on process, **or**
- call `GET {APP_URL}/api/cron` every minute with header `Authorization: Bearer $CRON_SECRET` (e.g. Vercel Cron, GitHub Actions, cron-job.org).

Holds are also filtered out of availability as soon as they expire, so a slow scheduler never blocks slots.

## 6. Hosting

Any Node.js host works (Vercel, Railway, Render, a VPS with `npm run build && npm start`).

- Uploaded attachments are stored in `uploads/` on local disk. On serverless hosts (Vercel) the disk is not persistent — mount a volume or move uploads to S3-compatible storage before relying on attachments.
- Rate limiting is stored in the database, so it works across multiple instances.
- Serve over HTTPS only.

## 7. Connect the main website

In `assets/js/site-config.js` set `links.bookingApp` to the production booking URL. The header button and every `book-consultation.html?topic=…` link then forward to the right meeting type. If you rename a meeting type's slug in the admin, update the topic map in `book-consultation.html`.

## 8. Go-live checklist

- [ ] Real prices, durations and descriptions in Admin → Meeting types
- [ ] Working hours, breaks and holidays in Admin → Availability
- [ ] Bank details (if bank transfer is enabled), policies, admin notification email in Settings
- [ ] Terms / privacy / cancellation wording reviewed
- [ ] Demo accounts removed; real admin created with a strong password
- [ ] Stripe live keys + webhook; a live £1 test booking refunded
- [ ] Email domain verified; confirmation and reminder received
- [ ] Cron/worker running (check reminders arrive)
- [ ] Database backups enabled
