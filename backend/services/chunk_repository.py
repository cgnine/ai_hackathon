from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import psycopg2.extras

from backend.services.db import get_conn

_TABLE = "ai_course_chunks"

_SELECT_ALL_COLS = """
    id, chapter_no, chapter_title, section_no, section_title,
    chunk_no, chunk_title, chunk_content,
    page_start, page_end, tags,
    question_count, last_question_at, created_at, updated_at
"""


@dataclass
class ChunkRow:
    id: int
    chapter_no: int
    chapter_title: str
    section_no: Optional[int]
    section_title: Optional[str]
    chunk_no: int
    chunk_title: Optional[str]
    chunk_content: str
    page_start: Optional[int]
    page_end: Optional[int]
    tags: Optional[list[str]]
    question_count: int
    last_question_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    @property
    def source_label(self) -> str:
        parts = [f"Chapter {self.chapter_no}"]
        if self.chapter_title:
            parts.append(self.chapter_title)
        if self.section_no is not None:
            parts.append(f"Section {self.section_no}")
        if self.section_title:
            parts.append(self.section_title)
        return " > ".join(parts)


def _row_to_chunk(row: tuple) -> ChunkRow:
    return ChunkRow(
        id=row[0],
        chapter_no=row[1],
        chapter_title=row[2],
        section_no=row[3],
        section_title=row[4],
        chunk_no=row[5],
        chunk_title=row[6],
        chunk_content=row[7],
        page_start=row[8],
        page_end=row[9],
        tags=list(row[10]) if row[10] else [],
        question_count=row[11],
        last_question_at=row[12],
        created_at=row[13],
        updated_at=row[14],
    )


def get_chunk_by_id(chunk_id: int) -> Optional[ChunkRow]:
    sql = f"SELECT {_SELECT_ALL_COLS} FROM {_TABLE} WHERE id = %s"
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (chunk_id,))
            row = cur.fetchone()
    return _row_to_chunk(row) if row else None


def get_chunks_by_chapter(chapter_no: int) -> list[ChunkRow]:
    sql = f"""
        SELECT {_SELECT_ALL_COLS} FROM {_TABLE}
        WHERE chapter_no = %s
        ORDER BY section_no NULLS FIRST, chunk_no
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (chapter_no,))
            rows = cur.fetchall()
    return [_row_to_chunk(r) for r in rows]


def get_chunks_by_section(chapter_no: int, section_no: int) -> list[ChunkRow]:
    sql = f"""
        SELECT {_SELECT_ALL_COLS} FROM {_TABLE}
        WHERE chapter_no = %s AND section_no = %s
        ORDER BY chunk_no
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (chapter_no, section_no))
            rows = cur.fetchall()
    return [_row_to_chunk(r) for r in rows]


def get_least_used_chunk(
    chapter_no: Optional[int] = None,
    section_no: Optional[int] = None,
) -> Optional[ChunkRow]:
    """question_count가 가장 낮은 청크를 반환한다 (균형 있는 문제 생성용)."""
    where_parts = []
    params: list = []

    if chapter_no is not None:
        where_parts.append("chapter_no = %s")
        params.append(chapter_no)
    if section_no is not None:
        where_parts.append("section_no = %s")
        params.append(section_no)

    where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
    sql = f"""
        SELECT {_SELECT_ALL_COLS} FROM {_TABLE}
        {where_clause}
        ORDER BY question_count ASC, created_at ASC
        LIMIT 1
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
    return _row_to_chunk(row) if row else None


def increment_question_count(chunk_id: int) -> None:
    sql = f"""
        UPDATE {_TABLE}
        SET question_count = question_count + 1,
            last_question_at = NOW(),
            updated_at = NOW()
        WHERE id = %s
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (chunk_id,))


def get_chapter_list() -> list[dict]:
    sql = f"""
        SELECT chapter_no, chapter_title, COUNT(*) AS chunk_count
        FROM {_TABLE}
        GROUP BY chapter_no, chapter_title
        ORDER BY chapter_no
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql)
            return [dict(r) for r in cur.fetchall()]


def get_stats() -> dict:
    sql = f"""
        SELECT
            COUNT(*) AS total_chunks,
            COUNT(DISTINCT chapter_no) AS total_chapters,
            COUNT(DISTINCT (chapter_no, section_no)) AS total_sections,
            SUM(question_count) AS total_questions_generated,
            COUNT(*) FILTER (WHERE question_count = 0) AS unused_chunks
        FROM {_TABLE}
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql)
            return dict(cur.fetchone())
