# Deploying TOMO (AI Lodge stack)

```
 browser ──► Website (Vercel, Vite, frontend/) ──► API (Cloud Run, Flask, backend/) ──► Neon (Postgres)
 Telegram ──► POST /api/telegram (webhook) ─────────┘     ├──► OpenRouter (text, voice notes, speech)
                                                          └──► Upstash Redis (AI Lodge rate limits)
```

Everything is on demand: the website builds a plan, and the bot sends the next lesson or quiz when the learner sends `/next`.
There is no scheduler and nothing runs between requests, so the Cloud Run service can scale to zero.

| | |
|---|---|
| Cloud Run service | `ail-ay2627-s1-bianca-tomo` → `https://ail-ay2627-s1-bianca-tomo-464725632804.asia-southeast3.run.app` |
| Vercel project | `ail-ay2627-s1-bianca-tomo` → `https://ail-ay2627-s1-bianca-tomo.vercel.app` (root directory `frontend/`) |
| Rate-limit slug | `ail-ay2627-s1-bianca-tomo`, buckets `plan`, `session`, `reply` |

## 1. Backend (Cloud Run, via GitHub Actions)
1. Create an empty Neon database and copy its pooled connection string (`...?sslmode=require`). No SQL to run: the backend creates
   its tables at start-up (`backend/schema.sql`, idempotent).
2. Create the club's bot with @BotFather and pick a long random `TELEGRAM_WEBHOOK_SECRET`.
3. Copy `backend/.env.example` to `.env`, fill it in (every variable is described there), then:
   ```bash
   gh secret set DOTENV --repo smubia-projects/ail-ay2627-s1-bianca-tomo < .env
   gh workflow run deploy.yml && gh run watch
   ```
   The workflow builds `backend/` with its Dockerfile (gunicorn on `0.0.0.0:$PORT`), pushes the image to Docker Hub and deploys
   it. Make the Docker Hub repository public after the first push.
4. On start-up the service registers the Telegram webhook (`WEBHOOK_URL`, with the secret header). Nothing to open by hand.
   Check: `GET /api/health` → `{"status": "ok", "ai": true, "bot": true, "database": "postgres"}`.

## 2. Website (Vercel)
Import the repo, root directory `frontend/` (Vite; `frontend/vercel.json`), environment variable
`VITE_API_BASE=https://ail-ay2627-s1-bianca-tomo-464725632804.asia-southeast3.run.app`, deploy. `CORS_ORIGINS` in `.env` must be
the Vercel address (re-upload `DOTENV` and re-run the workflow if it changes).

## 3. Rate limits
Add the project to the central rate-limit sheet (rows for `plan`, `session`, `reply`, plus `window` and a `Status` row), then sync.
Until then the `RATE_LIMIT_*` values in `.env` apply. Over the limit, the website shows the AI Lodge CTA (HTTP 429) and the bot
replies with the AI Lodge links; a paused demo returns 503 / a "paused" message.

## Running it on your computer
```bash
python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
cp backend/.env.example .env      # a TEST bot token and an OpenRouter key; leave DATABASE_URL and WEBHOOK_URL empty
cd backend && ../.venv/bin/python app.py   # API on :5050 + the bot by polling, SQLite database
cd frontend && npm install && npm run dev  # website on :5173
```
Polling refuses to start when `WEBHOOK_URL` is set, so a local run can't knock the deployed bot off its webhook.

## Voice
- **Listening to voice notes** (pronunciation coaching, spoken replies): `AUDIO_MODEL_NAME` (default `gemini-3.5-flash-lite`), sent as `input_audio`.
- **Speech** (phrases, dialogues, listening questions): `TTS_MODEL_NAME`, an audio-output model, streamed as PCM and encoded
  to MP3. Unset by default because apiyi has no such model; listening questions then show the line behind a spoiler.
- The original free voices (Microsoft Edge read-aloud via `edge-tts`, Google Translate TTS) are unofficial endpoints and stay off
  unless `UNOFFICIAL_TTS_ENABLED=true`.

## Optional: the Wall Street guide (private)
This mode reads a private copy of the Breaking Into Wall Street IB Interview Guide that the owner loads into the database with
`backend/import_guide.py`, and shows it only to someone who enters `BIWS_ACCESS_CODE`. **The guide is copyrighted by Breaking Into
Wall Street and is not in this repository.** Leave `BIWS_ACCESS_CODE` empty (the default) on a public deployment unless the rights
to share it are confirmed; with no code and no imported guide, the option never appears.

```bash
cd backend && DATABASE_URL=... ../.venv/bin/python import_guide.py --src ~/ibig-study-bot
```

## If something doesn't work
| Problem | Check |
|---|---|
| The bot doesn't answer | Cloud Run logs for `Telegram webhook registered` / `setWebhook failed`; `WEBHOOK_URL` must end in `/api/telegram`. |
| "Conflict: terminated by other getUpdates" | Something is polling with the same token (a local run with the club's bot). Use a separate test bot. |
| The website can't reach the server | `VITE_API_BASE` (rebuild after changing it) and `CORS_ORIGINS` (must match the Vercel address exactly). |
| `/api/health` says `"ai": false` | `API_KEY` is missing from `DOTENV`. |
| No audio clips | Expected: `TTS_MODEL_NAME` is unset (apiyi has no voice model). If it is set, the model failed (logs: `voice failed`). |
| "daily AI limit" message | The day's estimated spend hit `DAILY_BUDGET_USD`. |
