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


@dataclass
class SubjectQuestionRow:
    question_id: str
    subject_code: str
    major_unit: Optional[str]
    minor_unit: Optional[str]
    question_type: Optional[str]
    question_content: str
    question_content2: Optional[str]
    option_1: Optional[str]
    option_2: Optional[str]
    option_3: Optional[str]
    option_4: Optional[str]
    option_5: Optional[str]
    answer_number: int
    explanation: str

    @property
    def options(self) -> list[str]:
        return [
            option for option in [
                self.option_1,
                self.option_2,
                self.option_3,
                self.option_4,
                self.option_5,
            ]
            if option
        ]


@dataclass
class AvailableSubjectRow:
    subject_code: str
    subject_name: str
    subject_description: Optional[str]
    question_count: int


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


def _row_to_subject_question(row: tuple) -> SubjectQuestionRow:
    return SubjectQuestionRow(
        question_id=row[0],
        subject_code=row[1],
        major_unit=row[2],
        minor_unit=row[3],
        question_type=row[4],
        question_content=row[5],
        question_content2=row[6],
        option_1=row[7],
        option_2=row[8],
        option_3=row[9],
        option_4=row[10],
        option_5=row[11],
        answer_number=int(row[12]),
        explanation=row[13],
    )


def get_question_by_id(question_id: int) -> Optional[QuestionRow]:
    sql = f"SELECT {_Q_COLS} FROM {_Q} WHERE id = %s AND is_active = TRUE"
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (question_id,))
            row = cur.fetchone()
    return _row_to_question(row) if row else None


def get_questions_by_category(category: str) -> list[QuestionRow]:
    sql = f"""
        SELECT {_Q_COLS} FROM {_Q}
        WHERE category = %s AND is_active = TRUE
        ORDER BY id ASC
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (category,))
            rows = cur.fetchall()
    return [_row_to_question(row) for row in rows]


def get_questions_by_subject_code(subject_code: str, count: int) -> list[SubjectQuestionRow]:
    if count == 20:
        sql = """
            SELECT
                question_id, subject_code, major_unit, minor_unit, question_type,
                question_content, question_content2,
                option_1, option_2, option_3, option_4, option_5,
                answer_number, explanation
            FROM question_tb
            WHERE subject_code = %s
            ORDER BY RANDOM()
        """
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (subject_code,))
                rows = cur.fetchall()

        if not rows:
            return []

        grouped_rows: dict[str, list[tuple]] = {}
        for row in rows:
            major_unit = (row[2] or "").strip()
            if major_unit:
                grouped_rows.setdefault(major_unit, []).append(row)

        selected_rows: list[tuple] = []
        selected_ids: set[str] = set()
        selected_units = list(grouped_rows.keys())[:5]

        if selected_units:
            base_quota = count // len(selected_units)
            extra_quota = count % len(selected_units)
            for idx, unit in enumerate(selected_units):
                quota = base_quota + (1 if idx < extra_quota else 0)
                for row in grouped_rows[unit][:quota]:
                    selected_rows.append(row)
                    selected_ids.add(str(row[0]))

        fill_candidates: list[tuple] = []
        for unit in selected_units:
            fill_candidates.extend(grouped_rows[unit])

        for row in fill_candidates:
            if len(selected_rows) >= count:
                break
            question_id = str(row[0])
            if question_id in selected_ids:
                continue
            selected_rows.append(row)
            selected_ids.add(question_id)

        return [_row_to_subject_question(row) for row in selected_rows[:count]]
    else:
        sql = """
            SELECT
                question_id, subject_code, major_unit, minor_unit, question_type,
                question_content, question_content2,
                option_1, option_2, option_3, option_4, option_5,
                answer_number, explanation
            FROM question_tb
            WHERE subject_code = %s
            ORDER BY RANDOM()
            LIMIT %s
        """
        params = (subject_code, count)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
    return [_row_to_subject_question(row) for row in rows]


def get_available_subjects() -> list[AvailableSubjectRow]:
    sql = """
        SELECT
            s.subject_code,
            s.subject_name,
            s.subject_description,
            COUNT(q.question_id) AS question_count
        FROM subject_tb s
        LEFT JOIN question_tb q
            ON q.subject_code = s.subject_code
        GROUP BY s.subject_code, s.subject_name, s.subject_description
        ORDER BY s.subject_code ASC
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
    return [
        AvailableSubjectRow(
            subject_code=row[0],
            subject_name=row[1],
            subject_description=row[2],
            question_count=int(row[3]),
        )
        for row in rows
    ]


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
