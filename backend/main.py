from __future__ import annotations

from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import generate, quiz, results
from backend.services.db import check_connection

app = FastAPI(title="Developer Competency Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate.router)
app.include_router(quiz.router)
app.include_router(results.router)


@app.get("/health")
async def health():
    db_ok = check_connection()
    return {"status": "ok", "db": "ok" if db_ok else "unavailable"}
