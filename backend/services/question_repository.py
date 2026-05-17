from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import psycopg2.extras

from backend.services.db import get_conn

_Q = "questions"
_H = "question_solve_history"

_Q_COLS = """
    id, category, sub_category, source_type, source_id,
    question_text, option_1, option_2, option_3, option_4,
    correct_option_no, explanation, difficulty, tags,
    solved_count, correct_count, is_active, created_at, updated_at
"""


@dataclass
class QuestionRow:
    id: int
    category: str
    sub_category: Optional[str]
    source_type: str
    source_id: Optional[int]
    question_text: str
    option_1: str
    option_2: str
    option_3: str
    option_4: str
    correct_option_no: int
    explanation: str
    difficulty: str
    tags: Optional[list[str]]
    solved_count: int
    correct_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @property
    def options(self) -> list[str]:
        return [self.option_1, self.option_2, self.option_3, self.option_4]


def _row_to_question(row: tuple) -> QuestionRow:
    return QuestionRow(
        id=row[0],
        category=row[1],
        sub_category=row[2],
        source_type=row[3],
        source_id=row[4],
        question_text=row[5],
        option_1=row[6],
        option_2=row[7],
        option_3=row[8],
        option_4=row[9],
        correct_option_no=row[10],
        explanation=row[11],
        difficulty=row[12],
        tags=list(row[13]) if row[13] else [],
        solved_count=row[14],
        correct_count=row[15],
        is_active=row[16],
        created_at=row[17],
        updated_at=row[18],
    )


def get_question_by_id(question_id: int) -> Optional[QuestionRow]:
    sql = f"SELECT {_Q_COLS} FROM {_Q} WHERE id = %s AND is_active = TRUE"
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (question_id,))
            row = cur.fetchone()
    return _row_to_question(row) if row else None


def get_random_active_question(
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
) -> Optional[QuestionRow]:
    """is_active=TRUE인 문제 중 조건에 맞는 랜덤 1건을 반환한다."""
    where_parts = ["is_active = TRUE"]
    params: list = []

    if category:
        where_parts.append("category = %s")
        params.append(category)
    if difficulty:
        where_parts.append("difficulty = %s")
        params.append(difficulty)

    where = " AND ".join(where_parts)
    sql = f"SELECT {_Q_COLS} FROM {_Q} WHERE {where} ORDER BY RANDOM() LIMIT 1"
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
    return _row_to_question(row) if row else None


def get_least_solved_question(
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
) -> Optional[QuestionRow]:
    """solved_count 최소 문제를 반환한다 (균등 출제용)."""
    where_parts = ["is_active = TRUE"]
    params: list = []

    if category:
        where_parts.append("category = %s")
        params.append(category)
    if difficulty:
        where_parts.append("difficulty = %s")
        params.append(difficulty)

    where = " AND ".join(where_parts)
    sql = f"""
        SELECT {_Q_COLS} FROM {_Q}
        WHERE {where}
        ORDER BY solved_count ASC, RANDOM()
        LIMIT 1
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
    return _row_to_question(row) if row else None


def submit_solve(
    user_id: str,
    question_id: int,
    selected_option_no: int,
    is_correct: bool,
    elapsed_seconds: Optional[int] = None,
) -> None:
    """stats 업데이트와 history 저장을 단일 트랜잭션으로 처리한다."""
    update_sql = f"""
        UPDATE {_Q}
        SET solved_count = solved_count + 1,
            correct_count = correct_count + %s,
            updated_at = NOW()
        WHERE id = %s
    """
    insert_sql = f"""
        INSERT INTO {_H} (user_id, question_id, selected_option_no, is_correct, elapsed_seconds)
        VALUES (%s, %s, %s, %s, %s)
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(update_sql, (1 if is_correct else 0, question_id))
            cur.execute(insert_sql, (user_id, question_id, selected_option_no, is_correct, elapsed_seconds))


def get_user_history(user_id: str, limit: int = 20) -> list[dict]:
    sql = f"""
        SELECT
            h.id, h.question_id, h.selected_option_no, h.is_correct,
            h.elapsed_seconds, h.created_at,
            q.question_text, q.category, q.difficulty, q.correct_option_no
        FROM {_H} h
        JOIN {_Q} q ON q.id = h.question_id
        WHERE h.user_id = %s
        ORDER BY h.created_at DESC
        LIMIT %s
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, (user_id, limit))
            return [dict(r) for r in cur.fetchall()]


def get_category_list() -> list[str]:
    sql = f"SELECT DISTINCT category FROM {_Q} WHERE is_active = TRUE ORDER BY category"
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            return [row[0] for row in cur.fetchall()]
