# TOMO: your study buddy on Telegram

**Live demo (AI Lodge):** https://ail-ay2627-s1-bianca-tomo.vercel.app  ·  **API:** https://ail-ay2627-s1-bianca-tomo-464725632804.asia-southeast3.run.app

TOMO is a website that sets up a personal study buddy inside Telegram. You say what you want to learn, and the bot sends you
lessons and quizzes whenever you ask for the next one (`/next`), grades your answers, listens to your spoken replies in language
courses, and brings back what you found hard. It is built for the AI Lodge Hackathon (track: Productivity & Workflows).

---

## 1. Problem Statement
**What problem?** Most people who want to learn something (a university course, a language, a skill) do not fail for lack of material.
They fail at *doing a little, regularly, with feedback*. Slides and textbooks are passive. Reading them feels like studying but
testing yourself is what makes things stick. Language learners have it worst: they can read and listen, but almost never get to
*speak* and be corrected.

**Who experiences it?** University students facing slides, outlines and past papers; self-learners who want to "just keep learning
finance" or a language and who stall the moment they have to set up a routine again; anyone without a tutor.

**Why is it worth solving?** The best-supported learning habits are retrieval practice (being tested), spacing (coming back to
things over time), and for languages, producing speech and getting corrective feedback. A general chatbot does none of that on its
own: it does not remember what you got wrong, does not keep your place in a course, and does not know what the lesson actually covered.

## 2. Solution Overview
A two-part product:

1. **The website** (a short wizard): choose what to learn (an SMU course from your slides, outline and past papers; a language; or any
   topic), how you like to study (teach-then-test or test-only, lesson size, kinds of questions) and how many lessons
   (5, 10, 20, any number, or **no end**). Slides and PDFs are read in your browser; only their text is sent.
2. **The Telegram bot (TOMO):** each time you send `/next` it sends a lesson, then a quiz on exactly what the lesson taught. It grades each
   answer, coaches before it reveals, remembers your weak spots, and mixes them back into later rounds. Everything can be changed
   by chatting (`/settings`, `/feedback`).

## 3. Key Features
- **Setup wizard** for SMU courses (outline + slides + optional past papers), languages, or any topic. Optional notes such as "I'm
  revising weeks 3 to 6" change which lessons exist.
- **Teach, then test** at your own pace (`/next` for the next session), or tests only.
- **Plan length:** 5, 10, 20 or any number of lessons, or **keep going with no end** (new lessons are written as you go, building on
  what you covered and what you found hard). At the end you can add ten more lessons or keep going.
- **Question types you choose:** multiple choice, true/false, open-ended, fill in the blank, and calculations when a topic is numeric.
  Multiple choice and true/false are answered with taps and graded instantly.
- **Quizzes only test what the lesson taught** (the lesson text and phrases are remembered and given to the quiz writer).
- **Coaching, not just marking:** a wrong answer gets the method, not the final answer; retry, skip, or move on. A correct answer
  gets a one-line *why*.
- **Weakness tracking:** missed questions come back as fresh variants in later quizzes and extra practice (spaced retrieval).
- **Language courses are speaking-first:** each lesson has a can-do goal, a mini-dialogue played as audio, key phrases, one pattern
  and a speaking task. Quizzes are *conversation* (reply out loud or type), *repeat after me*, and *listening*. Send a voice note
  and the bot listens and coaches pronunciation.
- **Buttons everywhere:** "Quiz me on this", "Tell me more", settings, hear again, skip. Repeated taps are handled once.
- **Chat commands:** `/next /quiz /more /review /progress /plan /status /settings /feedback /plans /switch /say …`

## 4. AI Integration
AI is used in these places (all through OpenRouter; see section 5):

| Where | What the AI does |
|---|---|
| Building a plan | Reads the outline and slide text and cuts them into an ordered syllabus (or, for a topic or language, writes one) |
| Lessons | Writes each lesson from the material at the chosen size and depth. Language lessons follow a fixed speaking-first structure |
| Quizzes | Writes questions *from what the lesson actually taught*, in the types you chose, plus spaced-review questions from earlier mistakes |
| Grading | Judges typed answers (accepting different wording), gives coaching hints without the answer, and a one-line "why" when right |
| Speech | An audio-output model reads phrases, dialogues and listening questions aloud |
| Voice | An audio-capable model **first transcribes the speech blind** (without being told the target), then compares it with the target phrase or the conversation situation and coaches tones, words and grammar |
| Chat | Answers questions about the current topic and merges "make it harder" style feedback into standing preferences |
| Ongoing courses | Writes the next batch of lessons, using what was covered and what you found hard |

**More than a generic LLM wrapper:** the model is wrapped in state and rules a chat window does not have. Each plan keeps its
position, scores, missed questions and what each lesson taught in Postgres; multiple-choice and true/false are graded **without** the
AI; JSON answers are requested in strict mode, repaired if slightly broken, and re-asked once; and busy or slow models fall back to a
second model after a short timeout.

## 5. External Tools & Datasets
- **AI:** [OpenRouter](https://openrouter.ai). Defaults: `google/gemini-3.1-flash-lite` (text) with `google/gemini-2.5-flash-lite`
  as fallback; `google/gemini-3.5-flash-lite` / `google/gemini-2.5-flash` (listening to voice notes); `openai/gpt-audio-mini`
  (speech). Configurable with `MODEL_NAME`, `FALLBACK_MODEL_NAME`, `AUDIO_MODEL_NAME`, `AUDIO_FALLBACK_MODEL_NAME`, `TTS_MODEL_NAME`.
- **Platform:** Telegram Bot API (webhook), Google Cloud Run (Flask API), Vercel (website), Neon (serverless Postgres), Upstash
  Redis (the AI Lodge rate limiter).
- **Backend:** Flask, gunicorn, requests, psycopg, python-dotenv, [json-repair](https://pypi.org/project/json-repair/), lameenc
  (MP3 encoding of the speech), upstash-redis.
- **Optional free voices:** `edge-tts` (Microsoft's voices) and Google Translate's text-to-speech, the original free voices. They
  are unofficial endpoints, so they are off unless `UNOFFICIAL_TTS_ENABLED=true`.
- **Frontend:** Vite, vanilla JavaScript, [pdf.js](https://mozilla.github.io/pdf.js/) and [JSZip](https://stuk.github.io/jszip/)
  (loaded from cdnjs) to read PDFs and PowerPoints in the browser.
- **Datasets:** none. The bot only uses material the learner uploads. The language-teaching design follows published research (see
  [docs/LANGUAGE_TEACHING.md](docs/LANGUAGE_TEACHING.md)).

## 6. Installation & Setup
You need Python 3.11+, Node 20+, a Telegram bot token from [@BotFather](https://t.me/BotFather) (use a separate test bot locally),
and an [OpenRouter](https://openrouter.ai) API key.

```bash
python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
cp backend/.env.example .env      # fill in TELEGRAM_BOT_TOKEN and API_KEY; leave DATABASE_URL and WEBHOOK_URL empty
cd backend && ../.venv/bin/python app.py    # API + bot (polling) at http://localhost:5050, local SQLite database
cd frontend && npm install && npm run dev   # the website at http://localhost:5173 (calls http://localhost:5050)
```
- To try only the website without a bot: `LOCAL_NO_TELEGRAM=1 .venv/bin/python backend/app.py`.
- **Never commit `.env`.** It is git-ignored. Only `.env.example` (placeholders) is in the repo.

### Deployment (AI Lodge stack)
- **Backend → Google Cloud Run**, built from `backend/Dockerfile` (gunicorn on `0.0.0.0:$PORT`) by
  `.github/workflows/deploy.yml` on every push to `main`. Its environment is the repo's `DOTENV` secret (all variables are documented in
  `backend/.env.example`). On start-up it creates its tables in Neon and registers the Telegram webhook from `WEBHOOK_URL`, so there
  are no manual setup steps. API only: `/api/health`, `/api/plans…`, `/api/biws`, `/api/telegram`.
- **Website → Vercel**, root directory `frontend/` (Vite preset, `frontend/vercel.json`), with `VITE_API_BASE` set to the Cloud Run URL.
- **Database → Neon** (`DATABASE_URL`, `sslmode=require`). **AI → OpenRouter.** **Rate limits →** the shared AI Lodge engine on Upstash
  Redis: plan building per visitor, and lessons/quizzes and AI-checked replies per Telegram user.
- More detail: [DEPLOY.md](DEPLOY.md).

**Tests**
```bash
.venv/bin/python tests/smoke.py        # API, webhook, sessions, quizzes, voice, rate limits (AI and Telegram stubbed, free)
.venv/bin/python tests/smoke.py pg     # the same against a real embedded Postgres (pip install pgserver)
.venv/bin/python tests/redteam.py      # safety attacks against the REAL AI (costs a few cents)
```

```
frontend/   the website (Vite). Reads PDFs/PPTX in the browser and sends only their text
backend/    Flask API + the Telegram bot (webhook), served by gunicorn on Cloud Run
  app.py      everything the bot and API do        db.py      Postgres (Neon) or a local SQLite file
  wsgi.py     production entry point               schema.sql the tables (created automatically)
  rate_limit.py / rate_limit_engine.py  the AI Lodge rate limiter
  biws.py     optional private guide mode (not in this repo's data)
tests/      smoke tests and the red-team script    docs/      the language-teaching research notes
```

## 7. AI Safety & Limitations

### Risks we identified, what we did, and what we tested
| Risk | Safeguard | Tested how |
|---|---|---|
| **Prompt injection** hidden in uploaded slides ("ignore your instructions…") | Material and answers are labelled as *data, not instructions* in every AI call; the student answer is fenced in tags for grading | Red-team: slides containing an injected command; the lesson stayed on topic |
| **A learner talking the grader into full marks** (even with fake grader JSON) | Fenced answer plus safety rules; grading is judged on key ideas only | Red-team found a **real failure** (fake-JSON answer got full marks). Fixed, re-tested: now refused |
| **Leaking the system prompt or keys**, jailbreaks ("you are DAN"), harmful requests | Safety rules on every call; replies are steered back to the topic. Keys live only in server environment variables | Red-team: all three refused or ignored |
| **Spoken-answer hallucination:** an AI told the target phrase tends to "hear" it | Two steps: transcribe *blind*, then compare. The learner sees what was heard | Tested with real audio: right phrase 5/5, a different phrase 1/5 with "I heard X, not Y", one swapped word 3/5 |
| **Handing out answers** | Grader coaches the method and keeps the answer back until the learner gives up | Red-team: a wrong answer got coaching without the model answer |
| **Garbled AI output** (broken JSON) | Strict JSON mode, automatic repair, one re-ask, then a plain-language message | Unit tests, plus a real incident that was fixed |
| **Provider busy, slow or out of allowance** | Short timeouts, a second model, quiet retries. The bot says honestly whether the AI is *busy* or the *limit is reached*, and keeps the question if it is only busy | Unit tests for both cases |
| **Cost abuse** (anyone can open the site) | AI Lodge rate limits (plan builds per visitor; lessons, quizzes and AI replies per Telegram user), a daily spend cap (`DAILY_BUDGET_USD`), 20 plans per visitor per day, request size limits | Unit tests |
| **Someone taking over another person's plan** | A plan code links to the *first* Telegram chat only; later attempts are refused | Unit tests |
| **Unauthorised calls** | Telegram webhook secret header (`TELEGRAM_WEBHOOK_SECRET`), CORS limited to the site (`CORS_ORIGINS`) | Unit tests |
| **Copyrighted material** | Nothing copyrighted is in the repository; the optional private guide mode needs the user's own copy and an access code | n/a |

### Limitations (please read)
- **The AI can be wrong.** Lessons and answers are generated; check important facts against your slides and textbook.
- **Pronunciation feedback is approximate.** It is an AI listening to a phone recording. It can miss subtle tone differences and says so.
- **The red-team results are a spot check, not a proof.** AI behaviour is probabilistic; eight attacks passing does not mean none can succeed.
- **No accounts or login.** Anyone with the website address can create plans (this uses the AI allowance, hence the limits above). A plan's
  secret is its random link, and only the first chat to use it can claim it.
- **Privacy:** uploaded course text is stored in the database so lessons can be written from it, and your messages and voice notes
  are sent to the AI provider. Do not upload anything you would not want a third-party AI service to see. Deleting a plan deletes its text.
- **The teaching design rests on research that is mixed and often small-scale**; it is a sensible design, not a guaranteed result.
- **This is a rate-limited public demo.** Each visitor and Telegram user gets a small free allowance, and the demo can be paused.
- **Voice output** comes from a general audio model reading the text aloud; pronunciation of less common languages can be imperfect.
- **Telegram only** (no WhatsApp, no mobile app), and the interface is in English.
