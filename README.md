# The Royal Nile Residence — website, booking planner & admin

Built by **Nino Techy**. Next.js 15 · Turso (libSQL) · Vercel.

## What's inside

**Website (for guests)**
- `/` home · `/stay` the apartment · `/experiences` Aswan experiences at local prices · `/getting-here` · `/terms` · `/privacy`
- `/book` — 3-step booking planner: pick dates (booked nights are crossed out) → plan your Aswan (a suggested plan per day, change anything) → details & confirm
- `/trip/<private link>` — the guest's own trip page: deposit details (InstaPay / bank), receipt upload, their days, arrival info once confirmed
- Prices shown in USD, EUR or EGP (rates set by the owner). Floating WhatsApp button everywhere.

**Admin (`/admin`)**
- **Today** — nights booked this month, what needs action, arrivals this week, experiences still to arrange (one-tap WhatsApp to the captain/driver)
- **Bookings** — every booking; open one to confirm receipts, record cash, add/remove experiences, change dates or price, message the guest (ready-made WhatsApp messages)
- **Calendar** — month view of every stay + block dates (maintenance, family use, bookings from elsewhere)
- **Experiences** — prices, what you pay partners (owner only), pictures, show/hide
- **Local partners** — captains, drivers, guides
- **Settings & prices** (owner only) — nightly price, deposit %, hold time, currency rates, InstaPay/bank details, arrival info, house rules

**How a website booking flows**
1. Guest books → dates are **held** for 24 h (changeable) → owner gets an email (if set up) and it shows in *Needs your action*.
2. Guest pays the deposit by InstaPay / transfer and **uploads the receipt** on their trip page → status *Receipt sent — check it*.
3. Owner opens the booking → *View receipt* → **Confirm** → booking confirmed, the guest's page shows arrival info.
4. If nobody pays in time, the hold ends by itself and the dates are free again.

## Set up (one time, ~15 minutes)

1. **Database — Turso** (free): create a database, copy its URL (`libsql://…`) and create a token.
2. **Vercel**: import this GitHub repo → add these Environment Variables (Production *and* Preview):

| Name | Value |
|---|---|
| `DATABASE_URL` | `libsql://your-db.turso.io` |
| `DATABASE_AUTH_TOKEN` | the Turso token |
| `AUTH_SECRET` | any long random text (32+ characters) |
| `ADMIN_EMAIL` | the owner's login email |
| `ADMIN_PASSWORD` | the owner's password (10+ characters) |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` (no slash at the end) |
| `RESEND_API_KEY`, `EMAIL_FROM` | *optional* — email alerts for new bookings and receipts |

3. Deploy. The database tables and the starting experiences are created automatically on the first visit.
4. Sign in at `/admin` → **Settings & prices**: set the real nightly price, InstaPay/bank details, currency rates, arrival info. Then **Experiences** and **Local partners**: real prices, costs and phone numbers.
5. Connect the domain in Vercel (Settings → Domains).

> The starting prices ($85/night, experience prices) are placeholders — change them before going live.

## Develop locally

```bash
npm install
cp .env.example .env.local   # fill in at least AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run dev                  # http://localhost:3000 (uses a local dev.db file)
npm test                     # pricing, dates, money and availability tests
```
