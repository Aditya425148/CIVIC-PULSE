import asyncio
import httpx
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.complaints import router as complaints_router
from routes.stats import router as stats_router
from routes.uploads import router as uploads_router
from routes.leaderboard import router as leaderboard_router
from routes.users import router as users_router
from routes.config import router as config_router
from routes.workers import router as workers_router
import threading
from cron_job import setup_cron
from config import BACKEND_URL

# ── API Keys ─────────────────────────────────────────────────────────────────
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

app = FastAPI(title="CivicPulse Backend", version="1.0.0")

# ── Keep-Alive for Render free tier ──────────────────────────────────────────
async def keep_alive():
    """Pings the server every 5 minutes to prevent Render from sleeping."""
    url = f"{BACKEND_URL}/health"
    await asyncio.sleep(60)
    async with httpx.AsyncClient() as client:
        while True:
            try:
                await client.get(url, timeout=10)
            except Exception:
                pass
            await asyncio.sleep(300)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(keep_alive())
    cron_thread = threading.Thread(target=setup_cron, daemon=True)
    cron_thread.start()

    # Log active Appwrite users and their details to the terminal
    try:
        from appwrite_client import users as aw_users
        from appwrite.query import Query
        res = aw_users.list(queries=[Query.limit(100)])
        print("\n=== ACTIVE APPWRITE USERS & GOVT IDs ===")
        for u in res.get("users", []):
            prefs = u.get("prefs", {})
            print(f"ID: {u['$id']} | Name: {u.get('name', 'N/A')} | Email: {u.get('email', 'N/A')} | Role: {prefs.get('role', 'N/A')} | Prefs: {prefs}")
        print("========================================\n")
    except Exception as e:
        print(f"[Startup] Failed to query active users: {e}")


# ── CORS ─────────────────────────────────────────────────────────────────────
# Read allowed origins from env and combine with local dev defaults
_raw_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
_env_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
_default_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    BACKEND_URL,
]
ALLOWED_ORIGINS = list(set(_env_origins + _default_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(complaints_router)
app.include_router(stats_router)
app.include_router(uploads_router)
app.include_router(leaderboard_router)
app.include_router(users_router)
app.include_router(config_router)
app.include_router(workers_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
