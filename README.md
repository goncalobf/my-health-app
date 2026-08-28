# Fitlog

A personal, iPhone-first health & fitness tracker. Built with Next.js and
deployed on Vercel.

- **Workouts** — build routines (exercises + target sets/reps/rest), then run a
  live session: log weight & reps per set, with a **manual rest timer** that
  counts your rest and waits for you to end it. Rep ranges, per-exercise weight
  increments, progressive-overload suggestions, deload detection, a fixed
  weekly schedule, and post-workout summaries are built in.
- **Nutrition** — native food logging via [Open Food Facts](https://world.openfoodfacts.org/)
  (barcode scan + search, no API key needed) plus manual macro entry. Daily
  totals vs. your targets. Recent foods, favourites, gram/serving quantities,
  reusable meals, and recipes make repeat logging fast.
- **Adaptive targets** — enter Garmin total calories daily; after enough food,
  expenditure, and weight data, Fitlog proposes a conservative two-week target
  update for a recomposition goal.
- **Fitlog Coach** — optional private AI guidance using aggregated workout,
  nutrition, bodyweight, and Garmin data: daily insights, weekly reviews,
  post-workout analysis, macro-aware meal ideas, and chat. Suggestions never
  change routines or targets without your review. Progress photos and private
  measurement notes are not sent to the model.
- **Progress** — bodyweight, measurements, private progress photos, workout
  volume, and per-exercise PRs (estimated 1RM) over time.
- **PWA** — installable on your iPhone home screen, fullscreen, offline shell.
- Single-password unlock. Everything in **kg**.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Drizzle ORM · Vercel Postgres
(Neon) · Recharts · ZXing (barcode).

## Deploy to Vercel

1. **Push this repo to GitHub** and import it in Vercel (New Project).
2. **Add a database:** in the Vercel project → **Storage** → create a
   **Postgres (Neon)** database and connect it. This injects `DATABASE_URL`
   automatically.
3. **Add environment variables** (Project → Settings → Environment Variables):
   - `APP_PASSWORD` — the password you'll type to unlock the app.
   - `AUTH_SECRET` — a long random string. Generate one with:
     `openssl rand -base64 32`
   - `OPENAI_API_KEY` — optional; enables Fitlog Coach. Keep this server-only.
   - `OPENAI_MODEL` — optional model override (defaults to `gpt-5-mini`).
4. **Create the tables.** From your machine, with the DB URL available locally:
   ```bash
   npm install
   vercel link           # link to the Vercel project
   vercel env pull .env.local   # pulls DATABASE_URL etc.
   npm run db:push       # creates all tables from the schema
   npm run seed          # optional: starter exercise library
   ```
5. **Deploy** (Vercel builds automatically on push). Open the URL on your
   iPhone → Share → **Add to Home Screen**.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, APP_PASSWORD, AUTH_SECRET
npm run db:push              # create tables
npm run seed                 # optional starter exercises
npm run dev
```

Open http://localhost:3000. The camera-based barcode scanner needs `localhost`
or HTTPS (Vercel provides HTTPS in production).

## Notes on MyFitnessPal

MyFitnessPal no longer offers a public API, so this app does **not** connect to
it. Instead it has its own food logging backed by Open Food Facts, which gives
you barcode scanning and search for free and keeps all your data in your own
database.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run db:push` | Sync schema → database (create/update tables) |
| `npm run db:studio` | Drizzle Studio (browse your data) |
| `npm run seed` | Insert a starter exercise library |
| `npm run icons` | Regenerate PWA icons from the SVG mark |
