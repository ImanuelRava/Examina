# Deploying Examina to Vercel

The app is fully serverless-ready: stateless HMAC admin auth, no disk writes,
client-side PDF export. The only structural change from local dev is the
database — **SQLite is not supported on Vercel** (the filesystem is ephemeral),
so the app uses PostgreSQL in production. A free [Neon](https://neon.tech)
database takes about 2 minutes to set up.

## Step 1 — Push the project to GitHub

```bash
cd examina-project   # the unzipped folder
git init             # if not already a repo
git add -A
git commit -m "Examina: exam platform"
```

Create a new **empty** repository on GitHub (e.g. `examina`), then:

```bash
git remote add origin https://github.com/<your-username>/examina.git
git branch -M main
git push -u origin main
```

> `.env` and the SQLite file are git-ignored — secrets never leave your machine.

## Step 2 — Create a free PostgreSQL database (Neon)

1. Sign up at [neon.tech](https://neon.tech) (no credit card needed).
2. Create a project — any name, e.g. `examina`.
3. Copy the **pooled connection string** (it contains `-pooler` in the host),
   e.g. `postgresql://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require`

<details>
<summary>Supabase / Railway work too</summary>

Any Postgres provider is fine. Use the standard connection string and add
`?sslmode=require` if it isn't already there. On Supabase, choose the
"Transaction pooler" string (port 6543) for serverless.
</details>

## Step 3 — Create the tables (one-time)

From your machine, with the Neon URL:

```bash
echo 'DATABASE_URL="postgresql://...neon..." ' > .env
bun install
bun run db:deploy          # prisma migrate deploy — creates Exam/Question/Attempt/Answer
```

Optional — seed the demo exam:

```bash
bun scripts/seed.ts
```

> On Vercel this step also runs automatically during the first build
> (`vercel-build` script runs `prisma migrate deploy`). Doing it locally once
> simply confirms the connection works before you deploy.

## Step 4 — Import the project into Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New… → Project**.
2. Install the GitHub integration (if asked) and select your `examina` repo.
3. Framework preset is detected automatically (Next.js). Leave the build
   command and output settings at their defaults.
4. Before pressing **Deploy**, open **Environment Variables** and add:

   | Key              | Value                                  | Notes                                      |
   | ---------------- | -------------------------------------- | ------------------------------------------ |
   | `DATABASE_URL`   | your Neon **pooled** URL               | required                                   |
   | `ADMIN_PASSWORD` | a strong password of your choice       | required — this is the admin gate password |
   | `ADMIN_SECRET`   | any long random string (`openssl rand -hex 32`) | required — signs the admin cookie |

5. Click **Deploy**. First build takes ~1–2 minutes.

You're live at `https://<your-project>.vercel.app`.

## Step 5 — Verify the deployment

- Open the site → student portal should list exams (seeded demo exam if you
  ran the seed in step 3).
- Click **Admin** → enter `ADMIN_PASSWORD` → create an exam, add a question
  with LaTeX (`$x^2 + y^2 = z^2$`), and check the results dashboard.
- Take the exam end-to-end and export the PDF report card.

## How the environment differs from local dev

| Concern            | Local dev                     | Vercel                                   |
| ------------------ | ----------------------------- | ---------------------------------------- |
| Database           | Same Neon DB (via `.env`)     | `DATABASE_URL` env var                   |
| Admin password     | `ADMIN_PASSWORD` in `.env`    | Environment Variables in the dashboard   |
| Tables             | `bun run db:deploy`           | Auto-applied on build (`vercel-build`)   |
| Static/output mode | `output: "standalone"`        | Standard Vercel build (auto-detected)    |

## Troubleshooting

| Symptom                                                     | Fix                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| API returns 500 with Prisma error `P2021` (table missing)    | Run `bun run db:deploy` with `DATABASE_URL` set, then redeploy                       |
| Build fails with "Can't reach database server"               | The migration step couldn't connect — check the URL, redeploy                        |
| Prisma engine binary error (`libquery_engine…`)              | Redeploy once; if it persists ensure `serverExternalPackages: ["@prisma/client"]` is in `next.config.ts` |
| Admin login rejects the correct password                     | `ADMIN_PASSWORD` env var mismatch — check the exact value in Vercel → Settings → Environment Variables |
| Too many connections errors                                  | Use the Neon **pooled** connection string (`-pooler` host)                            |
