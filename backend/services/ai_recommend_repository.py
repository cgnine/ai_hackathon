from __future__ import annotations

from typing import Any

from psycopg2.extras import RealDictCursor

from backend.services.db import get_conn

MAX_POOL = 5
_TABLE_READY = False


def ensure_table() -> None:
    global _TABLE_READY
    if _TABLE_READY:
        return
    expected_columns = {
        "session_id": "TEXT",
        "member_id": "VARCHAR(50)",
        "question_no": "INT",
        "weak_area": "TEXT",
        "subject_code": "VARCHAR(50)",
        "reason": "TEXT",
        "question_text": "TEXT",
        "scenario": "TEXT",
        "option_1": "TEXT",
        "option_2": "TEXT",
        "option_3": "TEXT",
        "option_4": "TEXT",
        "option_5": "TEXT",
        "correct_option_no": "INT",
        "explanation": "TEXT",
        "difficulty": "VARCHAR(20) DEFAULT 'medium'",
        "selected_option_no": "INT",
        "is_correct": "BOOLEAN",
        "created_at": "TIMESTAMP DEFAULT NOW()",
        "solved_at": "TIMESTAMP",
    }
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_recommend_question_tb (
                    id BIGSERIAL PRIMARY KEY,
                    session_id TEXT,
                    member_id VARCHAR(50) NOT NULL,
                    question_no INT NOT NULL,
                    weak_area TEXT,
                    subject_code VARCHAR(50),
                    reason TEXT,
                    question_text TEXT NOT NULL,
                    scenario TEXT,
                    option_1 TEXT,
                    option_2 TEXT,
                    option_3 TEXT,
                    option_4 TEXT,
                    option_5 TEXT,
                    correct_option_no INT NOT NULL,
                    explanation TEXT,
                    difficulty VARCHAR(20) DEFAULT 'medium',
                    selected_option_no INT,
                    is_correct BOOLEAN,
                    created_at TIMESTAMP DEFAULT NOW(),
                    solved_at TIMESTAMP
                )
                """
            )
            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'ai_recommend_question_tb'
                """
            )
            existing_columns = {row[0] for row in cur.fetchall()}
            missing_columns = [
                (column, definition)
                for column, definition in expected_columns.items()
                if column not in existing_columns
            ]
            for column, definition in missing_columns:
                cur.execute(f"ALTER TABLE ai_recommend_question_tb ADD COLUMN {column} {definition}")
    _TABLE_READY = True


def get_active_pool(member_id: str) -> list[dict[str, Any]]:
    """미답변 + 오답 문제 목록 (최대 MAX_POOL개)"""
    ensure_table()
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, member_id, question_no, weak_area, subject_code, reason,
                       question_text, scenario, option_1, option_2, option_3, option_4, option_5,
                       correct_option_no, explanation, difficulty,
                       selected_option_no, is_correct, created_at, solved_at
                FROM ai_recommend_question_tb
                WHERE member_id = %s
                  AND (is_correct IS NULL OR is_correct = FALSE)
                ORDER BY created_at ASC
                LIMIT %s
                """,
                (member_id, MAX_POOL),
            )
            return [dict(r) for r in cur.fetchall()]


def get_pool_size(member_id: str) -> int:
    ensure_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) FROM ai_recommend_question_tb
                WHERE member_id = %s AND (is_correct IS NULL OR is_correct = FALSE)
                """,
                (member_id,),
            )
            return int(cur.fetchone()[0])


def get_current_pool_weak_areas(member_id: str) -> set[str]:
    """현재 풀에 있는 weak_area (같은 영역 중복 출제 방지)"""
    ensure_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT weak_area FROM ai_recommend_question_tb
                WHERE member_id = %s
                  AND (is_correct IS NULL OR is_correct = FALSE)
                  AND weak_area IS NOT NULL
                """,
                (member_id,),
            )
            return {row[0] for row in cur.fetchall()}


def get_mastered_weak_areas(member_id: str) -> set[str]:
    """전체 이력 기준 정답 처리된 weak_area (재출제 금지)"""
    ensure_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT weak_area FROM ai_recommend_question_tb
                WHERE member_id = %s AND is_correct = TRUE AND weak_area IS NOT NULL
                """,
                (member_id,),
            )
            return {row[0] for row in cur.fetchall()}


def save_pool_question(
    member_id: str,
    weak_area: str,
    subject_code: str,
    reason: str,
    question_text: str,
    scenario: str,
    options: list[str],
    correct_option_no: int,
    explanation: str,
    difficulty: str,
) -> dict[str, Any]:
    ensure_table()
    opts = (options + ["", "", "", "", ""])[:5]
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT COALESCE(MAX(question_no), 0) + 1 AS next_no FROM ai_recommend_question_tb WHERE member_id = %s",
                (member_id,),
            )
            next_no = int(cur.fetchone()["next_no"])
            cur.execute(
                """
                INSERT INTO ai_recommend_question_tb
                (session_id, member_id, question_no, weak_area, subject_code, reason,
                 question_text, scenario, option_1, option_2, option_3, option_4, option_5,
                 correct_option_no, explanation, difficulty)
                VALUES (NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, question_no, weak_area, subject_code, reason,
                          question_text, scenario, option_1, option_2, option_3, option_4, option_5,
                          correct_option_no, explanation, difficulty, created_at,
                          selected_option_no, is_correct
                """,
                (
                    member_id, next_no, weak_area, subject_code, reason,
                    question_text, scenario, opts[0], opts[1], opts[2], opts[3], opts[4],
                    correct_option_no, explanation, difficulty,
                ),
            )
            return dict(cur.fetchone())


def record_answer(question_id: int, member_id: str, selected_option_no: int) -> dict[str, Any]:
    """오답 재도전 허용 (is_correct = FALSE인 경우도 UPDATE 가능)"""
    ensure_table()
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT correct_option_no, explanation
                FROM ai_recommend_question_tb
                WHERE id = %s AND member_id = %s
                  AND (selected_option_no IS NULL OR is_correct = FALSE)
                FOR UPDATE
                """,
                (question_id, member_id),
            )
            row = cur.fetchone()
            if row is None:
                raise ValueError("질문을 찾을 수 없거나 이미 정답 처리된 문제입니다.")

            is_correct = selected_option_no == int(row["correct_option_no"])
            cur.execute(
                """
                UPDATE ai_recommend_question_tb
                SET selected_option_no = %s,
                    is_correct = %s,
                    solved_at = CASE WHEN %s THEN NOW() ELSE solved_at END
                WHERE id = %s
                """,
                (selected_option_no, is_correct, is_correct, question_id),
            )

    return {
        "is_correct": is_correct,
        "correct_option_no": int(row["correct_option_no"]),
        "explanation": row["explanation"] or "",
    }
