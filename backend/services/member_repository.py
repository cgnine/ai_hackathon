from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, TypedDict

import psycopg2.extras

from backend.services.db import get_conn


class MemberInfo(TypedDict):
    member_id: str
    member_name: str
    email: Optional[str]
    affiliate: Optional[str]


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


def _member_columns(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'member_tb'
            """
        )
        return {str(row[0]) for row in cur.fetchall()}


def _first_existing(columns: set[str], candidates: tuple[str, ...]) -> Optional[str]:
    for candidate in candidates:
        if candidate in columns:
            return candidate
    return None


def _profile_column_map(columns: set[str]) -> dict[str, Optional[str]]:
    return {
        "email": _first_existing(columns, ("email", "member_email")),
        "affiliate": _first_existing(
            columns,
            ("affiliate", "member_affiliate", "company", "company_name", "member_company"),
        ),
    }


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
        "email": None,
        "affiliate": None,
    }


def get_member_profile(member_id: str) -> Optional[MemberInfo]:
    normalized_member_id = normalize_member_id(member_id)
    if not normalized_member_id:
        return None

    with get_conn() as conn:
        columns = _member_columns(conn)
        mapped = _profile_column_map(columns)
        select_parts = [
            "member_id",
            "COALESCE(member_name, member_id) AS member_name",
        ]
        if mapped["email"]:
            select_parts.append(f"{mapped['email']} AS email")
        else:
            select_parts.append("NULL AS email")
        if mapped["affiliate"]:
            select_parts.append(f"{mapped['affiliate']} AS affiliate")
        else:
            select_parts.append("NULL AS affiliate")

        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"""
                SELECT {", ".join(select_parts)}
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
        "email": str(row["email"]) if row.get("email") else None,
        "affiliate": str(row["affiliate"]) if row.get("affiliate") else None,
    }


def update_member_profile(
    member_id: str,
    member_name: Optional[str] = None,
    email: Optional[str] = None,
    affiliate: Optional[str] = None,
) -> Optional[MemberInfo]:
    normalized_member_id = normalize_member_id(member_id)
    if not normalized_member_id:
        return None

    with get_conn() as conn:
        columns = _member_columns(conn)
        mapped = _profile_column_map(columns)
        updates: list[str] = []
        params: list[Optional[str]] = []

        if member_name is not None and "member_name" in columns:
            cleaned = member_name.strip()
            if cleaned:
                updates.append("member_name = %s")
                params.append(cleaned)

        if email is not None and mapped["email"]:
            updates.append(f"{mapped['email']} = %s")
            params.append(email.strip() or None)

        if affiliate is not None and mapped["affiliate"]:
            updates.append(f"{mapped['affiliate']} = %s")
            params.append(affiliate.strip() or None)

        if updates:
            params.append(normalized_member_id)
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    UPDATE member_tb
                    SET {", ".join(updates)}
                    WHERE LOWER(member_id) = LOWER(%s)
                    """,
                    tuple(params),
                )
                if cur.rowcount == 0:
                    return None

    return get_member_profile(normalized_member_id)


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
        "email": None,
        "affiliate": None,
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
