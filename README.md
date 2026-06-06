# Rafa's Smart Transaction Helper

An AI-powered transaction failure analysis tool built for Común — a mobile banking app for immigrants in the United States. Given a Transaction ID, it fetches the transaction from Supabase, enriches it with BIN card issuer data, and generates a clear, empathetic explanation in Spanish and English using Claude.

**Live demo:** [smart-transaction-helper-rouge.vercel.app](https://smart-transaction-helper-rouge.vercel.app)

---

## What it does

- Looks up a transaction by ID from a Supabase database
- Enriches card data using a BIN lookup API (issuer name, brand, card type, country)
- Sends the full transaction context to Claude (`claude-sonnet-4-6`) with a structured prompt
- Returns a bilingual explanation (`es` / `en`) and an optional CTA action code
- Renders the result in three views: **Internal tool**, **Común app mockup**, and **WhatsApp Business mockup**

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Supabase (Postgres) |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| BIN Enrichment | API Ninjas BIN API |
| Deployment | Vercel |

---

## Project structure

```
app/
  api/explain/route.ts   — API route: Supabase lookup → BIN enrichment → Claude
  page.tsx               — UI: three-tab view (Común app, WhatsApp, Internal)
  globals.css            — Dark theme (Linear/Vercel-style with lime accent)
  layout.tsx             — Root layout with Plus Jakarta Sans font
lib/
  supabase.ts            — Supabase singleton client
  anthropic.ts           — Anthropic singleton client
supabase/
  schema.sql             — Transactions table definition
comun_prompt.md          — Source of truth for the Claude prompt
```

---

## Getting started

**1. Clone and install**

```bash
git clone https://github.com/rafaelbastidas/smart-transaction-helper.git
cd smart-transaction-helper
npm install
```

**2. Set up environment variables**

```bash
cp .env.local.example .env.local
```

Fill in your keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=your-anthropic-api-key
BIN_API_KEY=your-api-ninjas-key
```

**3. Set up the database**

Run `supabase/schema.sql` in your Supabase SQL editor to create the `transactions` table and import your CSV data.

**4. Run locally**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How the AI explanation works

Each request triggers this pipeline:

1. **Supabase** — fetch the transaction row by ID
2. **BIN API** — if a BIN is present, look up the card issuer (cached in memory)
3. **Claude** — send a structured prompt with all transaction fields and BIN data
4. **Parse** — extract `{ es, en, cta? }` from Claude's JSON response

The prompt lives in `comun_prompt.md` and is implemented in `app/api/explain/route.ts`. It defines error code rules, CTA triggers, ownership guidelines (when to apologize vs. not), and edge case handling for each transaction type.

**CTA actions returned by Claude:**

| Code | Label |
|---|---|
| `UNLOCK_CARD` | Desbloquear tarjeta |
| `ADD_FUNDS` | Agregar fondos |
| `TRY_AGAIN` | Intentar de nuevo |
| `CONTACT_SUPPORT` | Contactar soporte |
| `CONFIRM_TRANSACTION` | Confirmar transacción |
| `VERIFY_CARD_INFO` | Verificar datos de tarjeta |

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `BIN_API_KEY` | Yes | API Ninjas BIN lookup key |
