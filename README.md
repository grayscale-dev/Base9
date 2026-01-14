**Welcome to base25, go to www.base25.app to learn more**

## Stripe Billing Setup

This project ships with Stripe billing, usage tracking, and a reporting pipeline. Follow the steps below for initial setup.

### 1) Create Stripe Products + Prices

Create 6 prices in Stripe (Test mode first):

- 5 service prices at **$10/month** (recurring):
  - Feedback
  - Roadmap
  - Changelog
  - Docs
  - Support
- 1 usage-based (metered) price at **$0.003 per interaction**

Copy the **price IDs** for each service and the metered price.

### 2) Configure Stripe Customer Portal

In Stripe Dashboard → Billing → Customer portal:
- Enable the portal
- Allow subscription + payment method management

### 3) Create a Stripe Webhook

Add a webhook endpoint:

- Prod: `https://<project-ref>.supabase.co/functions/v1/stripeWebhook`
- Local: `http://127.0.0.1:54321/functions/v1/stripeWebhook`

Subscribe to events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded`

Copy the **Webhook signing secret**.

### 4) Supabase Secrets

Set these secrets for Edge Functions:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_METERED_ID`
- `STRIPE_PRICE_SERVICE_IDS` (JSON map or comma-delimited)
- `USAGE_REPORTING_SECRET` (optional but recommended)

Example for `STRIPE_PRICE_SERVICE_IDS`:
```json
{
  "feedback": "price_...",
  "roadmap": "price_...",
  "changelog": "price_...",
  "docs": "price_...",
  "support": "price_..."
}
```

### 5) Deploy Edge Functions

Deploy the billing-related functions:
```
supabase functions deploy createCheckoutSession
supabase functions deploy createBillingPortal
supabase functions deploy stripeWebhook
supabase functions deploy recordInteraction
supabase functions deploy getBillingSummary
supabase functions deploy reportUsage
supabase functions deploy setBetaAccess
```

### 6) Schedule Usage Reporting

This repo includes a GitHub Actions cron that calls the `reportUsage` function daily.

Set these GitHub repo secrets:
- `REPORT_USAGE_URL` (example: `https://<project-ref>.supabase.co/functions/v1/reportUsage`)
- `USAGE_REPORTING_SECRET` (must match the Supabase secret if set)

The workflow lives at: `.github/workflows/report-usage.yml`.

### 7) Beta Access Gate

Billing checkout is gated behind `beta_access_granted_at` on `billing_customers`.
Admins can toggle this in the Billing UI (switch added in `src/pages/Billing.jsx`).

