"""Production entry point (gunicorn on Cloud Run): create the tables, register the Telegram webhook, then serve the API.

Both start-up steps are idempotent and never stop the server from starting; they are retried lazily (the schema on the
first API request, the webhook on the next start).
"""
import app as tomo
import db

try:
    db.ensure_schema()
except Exception as e:  # the database may be waking up: _before() in app.py tries again on the first request
    print("schema bootstrap deferred:", e, flush=True)

try:
    tomo.register_webhook()
except Exception as e:
    print("webhook registration failed:", e, flush=True)

app = tomo.app
