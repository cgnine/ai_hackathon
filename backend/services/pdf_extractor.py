from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

BOOKS_DIR = Path(__file__).parent.parent.parent / "Practice Books"


def _open_pdf(path: Path):
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise RuntimeError(
            "PyMuPDF를 불러오지 못했습니다. PDF 직접 추출을 사용하려면 "
            "Python 3.12 환경에서 backend/requirements.txt 의존성을 다시 설치하세요."
        ) from exc

    return fitz.open(str(path))


def list_pdfs() -> list[str]:
    return [f for f in os.listdir(BOOKS_DIR) if f.lower().endswith(".pdf")]


def resolve_pdf_path(filename: Optional[str]) -> Path:
    pdfs = list_pdfs()
    if not pdfs:
        raise FileNotFoundError("Practice Books/ 에 PDF 파일이 없습니다.")

    if filename is None:
        if len(pdfs) != 1:
            raise ValueError(
                f"PDF 파일이 여러 개입니다. pdf_filename을 지정하세요: {pdfs}"
            )
        filename = pdfs[0]

    path = BOOKS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"PDF를 찾을 수 없습니다: {filename}")
    return path


def extract_text(filename: Optional[str], page_start: int, page_end: int) -> str:
    path = resolve_pdf_path(filename)

    doc = _open_pdf(path)
    total_pages = len(doc)

    # PyMuPDF 페이지 인덱스는 0-based
    start_idx = max(0, page_start - 1)
    end_idx = min(total_pages - 1, page_end - 1)

    if start_idx > end_idx:
        raise ValueError(
            f"유효하지 않은 페이지 범위: {page_start}~{page_end} (총 {total_pages}페이지)"
        )

    parts: list[str] = []
    for i in range(start_idx, end_idx + 1):
        text = doc[i].get_text("text")
        if text.strip():
            parts.append(text)

    doc.close()

    if not parts:
        raise ValueError(f"지정 페이지({page_start}~{page_end})에서 텍스트를 추출하지 못했습니다.")

    return "\n".join(parts)
