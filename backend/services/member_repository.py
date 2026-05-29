from __future__ import annotations

from typing import Optional, TypedDict

import psycopg2.extras

from backend.services.db import get_conn


class MemberInfo(TypedDict):
    member_id: str
    member_name: str


def get_member(member_id: str) -> Optional[MemberInfo]:
    normalized_member_id = member_id.strip()
    if not normalized_member_id:
        return None

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT member_id, COALESCE(member_name, member_id) AS member_name
                FROM member_tb
                WHERE member_id = %s
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
