from __future__ import annotations

import logging

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import auth, generate, quiz, results, ai_recommend
from backend.services.db import check_connection

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

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
app.include_router(auth.router)
app.include_router(ai_recommend.router)


@app.get("/health")
async def health():
    db_ok = check_connection()
    return {"status": "ok", "db": "ok" if db_ok else "unavailable"}
