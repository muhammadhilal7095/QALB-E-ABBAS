# Deploying the payment app

The app needs no database, so any Node.js host works. Vercel is the simplest.

## 1. Host the app (Vercel)

1. Import the GitHub repository into Vercel and set **Root Directory** to `booking`.
2. Add the environment variables below (Project → Settings → Environment Variables).
3. Deploy, then note the URL (e.g. `https://pay.qalbeabbas.com` after adding a custom domain).

| Variable | Value |
|---|---|
| `APP_URL` | This app's public URL, e.g. `https://pay.qalbeabbas.com` |
| `MAIN_SITE_URL` | The website, e.g. `https://www.qalbeabbas.com` |
| `ALLOWED_ORIGINS` | Other website addresses that may submit, comma-separated (e.g. `https://qalbeabbas.com`) |
| `ADMIN_EMAIL` | Inbox that receives bookings, orders and assessments |
| `STRIPE_SECRET_KEY` | `sk_live_…` (or `sk_test_…` while testing) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from step 2 |
| `RESEND_API_KEY` | From resend.com |
| `EMAIL_FROM` | An address on your verified domain, e.g. `bookings@qalbeabbas.com` |

Leave `PAYMENT_MOCK_ENABLED` unset in production (the test payment page is always off in production).

## 2. Stripe webhook

Stripe Dashboard → Developers → Webhooks → **Add endpoint**:

- URL: `{APP_URL}/api/webhooks/stripe`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy. This is what triggers the emails after a successful payment.

## 3. Resend

Create an account at resend.com, add and verify your domain (DNS records), create an API key and set `RESEND_API_KEY` and `EMAIL_FROM`.

## 4. Point the website at the app

In `assets/js/site-config.js` set `links.bookingApp` to `APP_URL`, then publish the website.

## 5. Test

Use Stripe test mode (`sk_test_…`) and card `4242 4242 4242 4242`: book a consultation, pay, and check that both emails arrive. Then switch to live keys.
