"""Rate-limit adapter for TOMO, on the shared AI Lodge engine (rate_limit_engine.py, copied unmodified).

The engine brings central config, event mode, the kill switch and fail-open. This file only supplies the project slug and
one bucket per kind of AI work, and turns the engine's status into Flask responses (the engine's own enforce() raises
FastAPI errors, so it is not used here):

  plan     building a study plan on the website            keyed on the visitor's IP (first X-Forwarded-For entry)
  session  a lesson or quiz written for a Telegram learner  keyed on "tg:<telegram user id>"
  reply    an AI-graded answer, voice note or tutor reply    keyed on "tg:<telegram user id>"

Without UPSTASH_REDIS_REST_URL / _TOKEN the engine allows everything (local development).
"""
import os

from flask import jsonify, request

from rate_limit_engine import RateLimiter, RateLimitStatus

PROJECT = "ail-ay2627-s1-bianca-tomo"


def _int(name, default):
    try:
        return int(os.getenv(name, "") or default)
    except ValueError:
        return default


limiter = RateLimiter(
    project=PROJECT,
    buckets={
        "plan": _int("RATE_LIMIT_PLAN_MAX", 5),
        "session": _int("RATE_LIMIT_SESSION_MAX", 15),
        "reply": _int("RATE_LIMIT_REPLY_MAX", 60),
    },
    redis_url=os.getenv("UPSTASH_REDIS_REST_URL") or os.getenv("UPSTASH_REDIS_URL", ""),
    redis_token=os.getenv("UPSTASH_REDIS_REST_TOKEN") or os.getenv("UPSTASH_REDIS_TOKEN", ""),
    default_window=_int("RATE_LIMIT_WINDOW_SECONDS", 432000),
)


def client_ip():
    """The real visitor: Cloud Run sits in front of the app, so the leftmost X-Forwarded-For entry, not the socket peer."""
    xff = request.headers.get("X-Forwarded-For", "")
    return xff.split(",")[0].strip() if xff else (request.remote_addr or "unknown")


def check_web(bucket):
    """For a Flask route that calls the AI: None when allowed, otherwise the response to return
    (503 when the demo is paused by the kill switch, 429 with queries_used when over the limit)."""
    state, value = limiter.status(client_ip(), bucket)
    if state == "killed":
        return jsonify(detail={"message": "This demo is temporarily paused. Check back soon."}), 503
    if state == "limited":
        return jsonify(detail={"message": "Rate limit exceeded.", "queries_used": value}), 429
    return None


def check_telegram(user_id, bucket) -> RateLimitStatus:
    """For the bot: no request IP, so the Telegram user is the identity."""
    return limiter.status(f"tg:{user_id}", bucket)
