from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, TypedDict

import psycopg2.extras

from backend.services.db import get_conn


class MemberInfo(TypedDict):
    member_id: str
    member_name: str


class LoginResult(TypedDict):
    status: Literal["ok", "not_found", "wrong_password"]
    member_id: Optional[str]
    member_name: Optional[str]


def normalize_member_id(member_id: str) -> str:
    return member_id.strip()


def _has_member_pwd_column(conn) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'member_tb'
              AND column_name = 'member_pwd'
            LIMIT 1
            """
        )
        return cur.fetchone() is not None


def get_member(member_id: str) -> Optional[MemberInfo]:
    normalized_member_id = normalize_member_id(member_id)
    if not normalized_member_id:
        return None

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT member_id, COALESCE(member_name, member_id) AS member_name
                FROM member_tb
                WHERE LOWER(member_id) = LOWER(%s)
                LIMIT 1
                """,
                (normalized_member_id,),
            )
            row = cur.fetchone()

    if row is None:
        return None
    return {
        "member_id": str(row["member_id"]),
        "member_name": str(row["member_name"]),
    }


def authenticate_member(member_id: str, password: str) -> LoginResult:
    normalized_member_id = normalize_member_id(member_id)
    normalized_password = password.strip()
    if not normalized_member_id or not normalized_password:
        return {
            "status": "wrong_password",
            "member_id": None,
            "member_name": None,
        }

    with get_conn() as conn:
        has_password_column = _has_member_pwd_column(conn)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if has_password_column:
                cur.execute(
                    """
                    SELECT
                        member_id,
                        COALESCE(member_name, member_id) AS member_name,
                        member_pwd
                    FROM member_tb
                    WHERE LOWER(member_id) = LOWER(%s)
                    LIMIT 1
                    """,
                    (normalized_member_id,),
                )
            else:
                cur.execute(
                    """
                    SELECT
                        member_id,
                        COALESCE(member_name, member_id) AS member_name
                    FROM member_tb
                    WHERE LOWER(member_id) = LOWER(%s)
                    LIMIT 1
                    """,
                    (normalized_member_id,),
                )
            row = cur.fetchone()

    if row is None:
        return {
            "status": "not_found",
            "member_id": None,
            "member_name": None,
        }

    if has_password_column and str(row["member_pwd"] or "") != normalized_password:
        return {
            "status": "wrong_password",
            "member_id": None,
            "member_name": None,
        }

    return {
        "status": "ok",
        "member_id": str(row["member_id"]),
        "member_name": str(row["member_name"]),
    }


def create_member(member_id: str, member_name: str, password: str) -> Optional[MemberInfo]:
    normalized_member_id = normalize_member_id(member_id)
    normalized_member_name = member_name.strip()
    normalized_password = password.strip()
    if not normalized_member_id or not normalized_member_name or not normalized_password:
        return None

    with get_conn() as conn:
        has_password_column = _has_member_pwd_column(conn)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT member_id
                FROM member_tb
                WHERE LOWER(member_id) = LOWER(%s)
                LIMIT 1
                """,
                (normalized_member_id,),
            )
            existing = cur.fetchone()
            if existing is not None:
                return None

            if has_password_column:
                cur.execute(
                    """
                    INSERT INTO member_tb (
                        member_id,
                        member_name,
                        member_pwd,
                        evaluation_content,
                        created_at
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        normalized_member_id,
                        normalized_member_name,
                        normalized_password,
                        "self-registered member",
                        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    ),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO member_tb (
                        member_id,
                        member_name,
                        evaluation_content,
                        created_at
                    )
                    VALUES (%s, %s, %s, %s)
                    """,
                    (
                        normalized_member_id,
                        normalized_member_name,
                        "self-registered member",
                        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    ),
                )

    return {
        "member_id": normalized_member_id,
        "member_name": normalized_member_name,
    }


def reset_member_password(member_id: str, password: str) -> bool:
    normalized_member_id = normalize_member_id(member_id)
    normalized_password = password.strip()
    if not normalized_member_id or not normalized_password:
        return False

    with get_conn() as conn:
        has_password_column = _has_member_pwd_column(conn)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if has_password_column:
                cur.execute(
                    """
                    UPDATE member_tb
                    SET member_pwd = %s
                    WHERE LOWER(member_id) = LOWER(%s)
                    RETURNING member_id
                    """,
                    (normalized_password, normalized_member_id),
                )
            else:
                cur.execute(
                    """
                    SELECT member_id
                    FROM member_tb
                    WHERE LOWER(member_id) = LOWER(%s)
                    LIMIT 1
                    """,
                    (normalized_member_id,),
                )
            row = cur.fetchone()

    return row is not None
