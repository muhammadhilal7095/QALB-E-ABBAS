# Qalb-E-Abbas — Secure Payments

A small Next.js app that takes payments for the Qalb-E-Abbas website and emails you the details. It has **no database, no logins and no admin panel**:

1. A visitor fills in a form on the website — **Book a Consultation** (`book-consultation.html`), the **cart** (`cart.html`), or the **Seller Readiness Assessment** (`assessment.html`, free — no payment).
2. For bookings and the cart, they pay by card on **Stripe**'s secure page. The form details travel with the payment.
3. **Only after a successful payment**, the details are emailed to you (`ADMIN_EMAIL`) and a confirmation goes to the client. Reply to your email to reach the client directly.

## Quick start (local)

Requirements: Node.js 20+.

```bash
cd booking
npm install
cp .env.example .env     # defaults work for local testing
npm run dev              # http://localhost:3000
# in another terminal, from the website folder:
python3 -m http.server 8080   # http://localhost:8080
```

Without Stripe keys, checkout shows a **test payment** page (Pay / Cancel, no real money). Without a Resend key, emails are saved as HTML files in `booking/.emails/` so you can open and check them.

## Going live — what you need

| Item | Where |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → add endpoint `{APP_URL}/api/webhooks/stripe` with events `checkout.session.completed` and `checkout.session.async_payment_succeeded` |
| `RESEND_API_KEY`, `EMAIL_FROM` | resend.com → API Keys; verify your domain so you can send from e.g. `bookings@qalbeabbas.com` |
| `ADMIN_EMAIL` | The inbox that receives bookings, orders and assessments |
| `APP_URL`, `MAIN_SITE_URL` | Public addresses of this app and of the website |

Then set `links.bookingApp` in `../assets/js/site-config.js` to this app's public URL. See `docs/DEPLOYMENT.md`.

## Prices

All prices — services in the cart and consultation types on the booking form — live in `src/lib/service-catalog.json`. The server always charges the catalog price, never a price sent by the browser.

To change a price: edit the catalog, run `npm run pricing:build` (updates the price sections and the booking form on the website), then `npm test` (checks every button on the site matches the catalog).

## How it works

| Concern | Where |
|---|---|
| Validate, price, start Stripe Checkout, emails after payment | `src/lib/checkout.ts` |
| Booking form / cart → payment | `POST /api/checkout` |
| Payment confirmed → emails | `POST /api/webhooks/stripe` (and the thank-you page as a backup — each email is only ever sent once) |
| Assessment → emails | `POST /api/assessments` |
| Thank-you page | `/thank-you` |
| Email sending (Resend) | `src/lib/email.ts` |

Only the website (`MAIN_SITE_URL` / `ALLOWED_ORIGINS`) can submit forms to this app.
