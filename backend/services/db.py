from __future__ import annotations

import os
from contextlib import contextmanager
from threading import Lock
from typing import Generator

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

_DB_CONFIG = {
    "host": os.getenv("DB_HOST", "cgnine.site"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "dbname": os.getenv("DB_NAME", "ai_question_db"),
    "user": os.getenv("DB_USER", "ai_user"),
    "password": os.getenv("DB_PASSWORD", "1234"),
    "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "5")),
}

_CHUNK_DB_CONFIG = {
    "host": os.getenv("CHUNK_DB_HOST", os.getenv("DB_HOST", "cgnine.site")),
    "port": int(os.getenv("CHUNK_DB_PORT", os.getenv("DB_PORT", "5432"))),
    "dbname": os.getenv("CHUNK_DB_NAME", "ai_question_db"),
    "user": os.getenv("CHUNK_DB_USER", os.getenv("DB_USER", "cgnine")),
    "password": os.getenv("CHUNK_DB_PASSWORD", os.getenv("DB_PASSWORD", "")),
    "connect_timeout": int(os.getenv("CHUNK_DB_CONNECT_TIMEOUT", os.getenv("DB_CONNECT_TIMEOUT", "5"))),
}

_DB_POOL_MIN = int(os.getenv("DB_POOL_MIN", "1"))
_DB_POOL_MAX = int(os.getenv("DB_POOL_MAX", "8"))
_CHUNK_DB_POOL_MIN = int(os.getenv("CHUNK_DB_POOL_MIN", os.getenv("DB_POOL_MIN", "1")))
_CHUNK_DB_POOL_MAX = int(os.getenv("CHUNK_DB_POOL_MAX", os.getenv("DB_POOL_MAX", "8")))

_pool_lock = Lock()
_db_pool: ThreadedConnectionPool | None = None
_chunk_db_pool: ThreadedConnectionPool | None = None


def _get_db_pool() -> ThreadedConnectionPool:
    global _db_pool
    if _db_pool is None:
        with _pool_lock:
            if _db_pool is None:
                _db_pool = ThreadedConnectionPool(_DB_POOL_MIN, _DB_POOL_MAX, **_DB_CONFIG)
    return _db_pool


def _get_chunk_db_pool() -> ThreadedConnectionPool:
    global _chunk_db_pool
    if _chunk_db_pool is None:
        with _pool_lock:
            if _chunk_db_pool is None:
                _chunk_db_pool = ThreadedConnectionPool(_CHUNK_DB_POOL_MIN, _CHUNK_DB_POOL_MAX, **_CHUNK_DB_CONFIG)
    return _chunk_db_pool


@contextmanager
def get_conn() -> Generator[psycopg2.extensions.connection, None, None]:
    pool = _get_db_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn, close=bool(conn.closed))


@contextmanager
def get_chunk_conn() -> Generator[psycopg2.extensions.connection, None, None]:
    pool = _get_chunk_db_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn, close=bool(conn.closed))


def check_connection() -> bool:
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return True
    except Exception:
        return False
