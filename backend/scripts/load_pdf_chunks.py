from __future__ import annotations

import argparse
import os
import re
from pathlib import Path

from dotenv import load_dotenv
import fitz
import psycopg2


ROOT_DIR = Path(__file__).resolve().parents[2]
BOOKS_DIR = ROOT_DIR / "Practice Books"
DEFAULT_MAX_CHARS = 2500


def _db_config() -> dict:
    return {
        "host": os.getenv("CHUNK_DB_HOST", os.getenv("DB_HOST", "cgnine.site")),
        "port": int(os.getenv("CHUNK_DB_PORT", os.getenv("DB_PORT", "5432"))),
        "dbname": os.getenv("CHUNK_DB_NAME", "ai_question_db"),
        "user": os.getenv("CHUNK_DB_USER", os.getenv("DB_USER", "cgnine")),
        "password": os.getenv("CHUNK_DB_PASSWORD", os.getenv("DB_PASSWORD", "")),
    }


def _clean_text(text: str) -> str:
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def _split_text(text: str, max_chars: int) -> list[str]:
    paragraphs = re.split(r"\n{2,}", text)
    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue

        if len(paragraph) > max_chars:
            if current:
                chunks.append(current.strip())
                current = ""
            for start in range(0, len(paragraph), max_chars):
                chunks.append(paragraph[start : start + max_chars].strip())
            continue

        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) > max_chars and current:
            chunks.append(current.strip())
            current = paragraph
        else:
            current = candidate

    if current:
        chunks.append(current.strip())

    return chunks


def load_chunks(pdf_path: Path, max_chars: int, reset: bool) -> int:
    conn = psycopg2.connect(**_db_config())
    inserted = 0

    try:
        with conn:
            with conn.cursor() as cur:
                if reset:
                    cur.execute("TRUNCATE TABLE ai_course_chunks RESTART IDENTITY")

                doc = fitz.open(str(pdf_path))
                chunk_no = 1
                for page_index in range(len(doc)):
                    page_no = page_index + 1
                    text = _clean_text(doc[page_index].get_text("text"))
                    if len(text) < 80:
                        continue

                    for part_no, chunk_text in enumerate(_split_text(text, max_chars), start=1):
                        cur.execute(
                            """
                            INSERT INTO ai_course_chunks (
                                chapter_no, chapter_title,
                                section_no, section_title,
                                chunk_no, chunk_title, chunk_content,
                                page_start, page_end, tags
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (chapter_no, section_no, chunk_no)
                            DO UPDATE SET
                                chunk_title = EXCLUDED.chunk_title,
                                chunk_content = EXCLUDED.chunk_content,
                                page_start = EXCLUDED.page_start,
                                page_end = EXCLUDED.page_end,
                                tags = EXCLUDED.tags,
                                updated_at = NOW()
                            """,
                            (
                                1,
                                "AI Engineering",
                                page_no,
                                f"Page {page_no}",
                                part_no,
                                f"Page {page_no} Chunk {part_no}",
                                chunk_text,
                                page_no,
                                page_no,
                                ["AI", "course", f"page:{page_no}"],
                            ),
                        )
                        inserted += 1
                        chunk_no += 1
                doc.close()
    finally:
        conn.close()

    return inserted


def main() -> None:
    load_dotenv(ROOT_DIR / ".env")

    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", default=None)
    parser.add_argument("--max-chars", type=int, default=DEFAULT_MAX_CHARS)
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    pdf_path = BOOKS_DIR / args.pdf if args.pdf else next(BOOKS_DIR.glob("*.pdf"))
    count = load_chunks(pdf_path, args.max_chars, args.reset)
    print(f"loaded_chunks={count}")


if __name__ == "__main__":
    main()
