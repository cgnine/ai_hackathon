from __future__ import annotations

import json
import logging
from collections import defaultdict
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException
from psycopg2.extras import RealDictCursor

from backend.services import bedrock_client, question_parser
from backend.services.db import get_conn
from backend.services import ai_recommend_repository as repo
from backend.services.ai_recommend_repository import MAX_POOL

logger = logging.getLogger(__name__)


def _to_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _question_type(row: dict[str, Any]) -> str:
    return "실무형" if str(row.get("question_content2") or "").strip() else "이론형"


def _format_question(row: dict[str, Any]) -> dict[str, Any]:
    opts = [row.get(f"option_{i}") for i in range(1, 6)]
    opts = [o for o in opts if o]
    base = {
        "id": row["id"],
        "weakArea": row.get("weak_area") or "",
        "subjectCode": row.get("subject_code") or "",
        "reason": row.get("reason") or "",
        "questionText": row["question_text"],
        "scenario": row.get("scenario") or "",
        "options": opts,
        "difficulty": row.get("difficulty") or "medium",
        "selectedOptionNo": row.get("selected_option_no"),
        "isCorrect": row.get("is_correct"),
    }
    if row.get("is_correct") is False:
        base["correctOptionNo"] = row.get("correct_option_no")
        base["explanation"] = row.get("explanation") or ""
    return base


def _get_member_name(member_id: str) -> str:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT COALESCE(member_name, member_id) AS member_name FROM member_tb WHERE member_id = %s LIMIT 1",
                (member_id,),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Member not found")
    return str(row["member_name"])


def _fetch_exam_history(member_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    s.subject_code,
                    s.subject_name,
                    s.subject_description,
                    q.major_unit,
                    q.minor_unit,
                    q.question_content,
                    q.question_content2,
                    h.selected_number,
                    q.answer_number
                FROM exam_tb e
                JOIN subject_tb s ON s.subject_code = e.subject_code
                JOIN exam_history_tb h ON h.exam_id = e.exam_id
                JOIN question_tb q
                    ON q.question_id = h.question_id
                   AND q.subject_code = e.subject_code
                WHERE e.member_id = %s
                ORDER BY e.exam_date DESC, e.exam_time DESC
                LIMIT 200
                """,
                (member_id,),
            )
            return [dict(r) for r in cur.fetchall()]


def _pick_weak_area(
    exam_rows: list[dict[str, Any]],
    exclude_weak_areas: set[str],
) -> dict[str, Any] | None:
    wrong_rows = [
        r for r in exam_rows
        if _to_int(r["selected_number"]) != _to_int(r["answer_number"])
    ]
    target_rows = wrong_rows or exam_rows

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in target_rows:
        key = f"{r['subject_code']}|{r['major_unit'] or '미분류'}"
        grouped[key].append(r)

    # 제외 영역 빼고 후보 선정, 없으면 전체에서 선택
    candidates = {k: v for k, v in grouped.items() if k not in exclude_weak_areas}
    if not candidates:
        candidates = grouped
    if not candidates:
        return None

    weak_area_key, weak_rows = max(candidates.items(), key=lambda item: len(item[1]))
    sample = weak_rows[0]
    subject_code, major_unit = weak_area_key.split("|", 1)
    subject_name = str(sample.get("subject_name") or sample.get("subject_description") or subject_code)
    minor_units = [str(r["minor_unit"]) for r in weak_rows if r.get("minor_unit")]

    return {
        "weak_area_key": weak_area_key,
        "subject_code": subject_code,
        "subject_name": subject_name,
        "major_unit": major_unit,
        "minor_unit": minor_units[0] if minor_units else "-",
        "question_type": _question_type(sample),
        "examples": weak_rows[:5],
        "based_on_wrong": bool(wrong_rows),
    }


def _build_prompt(member_name: str, target: dict[str, Any], difficulty: str) -> tuple[str, str]:
    target_type = target["question_type"]
    examples = [
        {"question": str(r.get("question_content") or "")[:200],
         "selectedNumber": _to_int(r["selected_number"]),
         "answerNumber": _to_int(r["answer_number"])}
        for r in target["examples"]
    ]
    system_prompt = (
        "당신은 KB 디지털 역량진단 CBT의 AI 맞춤형 문제 생성 Agent입니다.\n"
        "사용자의 오답 이력을 근거로 약점을 보완할 5지선다 문제 1개를 생성합니다.\n\n"
        "# 출제 원칙\n"
        "- choices 정확히 5개, 모두 완전한 문장\n"
        "- 정답은 반드시 하나\n"
        "- 기존 문제 복사 금지\n\n"
        "# 이론형일 때\n"
        "- scenario는 빈 문자열\n"
        "- question은 개념·정의·특징·목적·절차·차이를 묻는 형태\n"
        "- '이 상황에서', '다음 상황에서', '위 상황에서' 표현 금지\n\n"
        "# 실무형일 때\n"
        "- scenario에 구체적 상황을 2~3문장으로 작성 (회사명·담당자명 제외)\n"
        "- question은 반드시 scenario의 내용을 직접 언급하지 않고, 개념·판단 기준을 묻는 형태\n"
        "- question에 '이 상황에서', '다음 상황에서', '위 상황에서' 표현 금지\n\n"
        "# explanation 작성 규칙\n"
        "- 정답 번호·정답 선택지 내용을 절대 언급하지 않는다\n"
        "- '정답은', '정답 X번', '올바른 선택은' 등의 표현 금지\n"
        "- 오답을 고르기 쉬운 이유(오개념·혼동 포인트)와 핵심 개념 원리만 2~3문장으로 설명\n\n"
        "# JSON만 출력\n"
        '{"reason":"출제이유","question_type":"이론형또는실무형","question":"질문","scenario":"시나리오(이론형이면빈문자열)","choices":["1번","2번","3번","4번","5번"],"answer":1,"difficulty":"medium","explanation":"오답 이유 및 핵심 개념 설명(정답 번호 언급 금지)"}'
    )
    user_prompt = (
        f"회원: {member_name}\n"
        f"과목: {target['subject_name']}, 단원: {target['major_unit']}, 유형: {target_type}, 난이도: {difficulty}\n"
        f"추천 근거: {'오답 이력' if target.get('based_on_wrong') else '최근 응시 이력'}\n"
        f"참고 문제 예시:\n{json.dumps(examples, ensure_ascii=False)}\n\n"
        "위 정보를 바탕으로 해당 약점 영역의 5지선다 문제 1개를 JSON으로 생성하세요."
    )
    return system_prompt, user_prompt


def _parse_bedrock_question(raw: str) -> dict[str, Any]:
    obj = question_parser.extract_json(raw)
    choices = obj.get("choices")
    if not isinstance(choices, list):
        raise ValueError("choices must be a list")
    choices = [str(c).strip() for c in choices if str(c or "").strip()]
    if len(choices) != 5:
        raise ValueError(f"choices must have 5 items, got {len(choices)}")
    answer = _to_int(obj.get("answer"))
    if answer is None or not (1 <= answer <= 5):
        raise ValueError("answer must be 1-5")
    question = str(obj.get("question") or "").strip()
    if not question:
        raise ValueError("question is required")
    return {
        "question": question,
        "scenario": str(obj.get("scenario") or "").strip(),
        "choices": choices,
        "answer": answer,
        "reason": str(obj.get("reason") or "").strip(),
        "explanation": str(obj.get("explanation") or "").strip(),
        "difficulty": str(obj.get("difficulty") or "medium"),
    }


# ─── Public API ──────────────────────────────────────────────

def get_pool(member_id: str) -> dict[str, Any]:
    normalized = member_id.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="member_id is required")
    _get_member_name(normalized)  # 존재 확인

    questions = repo.get_active_pool(normalized)
    return {
        "poolSize": len(questions),
        "maxSize": MAX_POOL,
        "questions": [_format_question(q) for q in questions],
    }


def fill_one(member_id: str) -> dict[str, Any]:
    """풀에 문제 1개 생성·추가"""
    normalized = member_id.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="member_id is required")

    member_name = _get_member_name(normalized)

    pool_size = repo.get_pool_size(normalized)
    if pool_size >= MAX_POOL:
        raise HTTPException(status_code=400, detail="POOL_FULL")

    mastered = repo.get_mastered_weak_areas(normalized)
    pool_areas = repo.get_current_pool_weak_areas(normalized)
    exclude = mastered | pool_areas  # 맞춘 영역 + 이미 풀에 있는 영역 제외

    exam_rows = _fetch_exam_history(normalized)
    if not exam_rows:
        raise HTTPException(status_code=422, detail="NO_HISTORY")

    target = _pick_weak_area(exam_rows, exclude)
    if target is None:
        raise HTTPException(status_code=422, detail="NO_WEAKNESS")

    logger.info("Generating pool question: member=%s target=%s", normalized, target["weak_area_key"])

    system_prompt, user_prompt = _build_prompt(member_name, target, "medium")
    try:
        raw = bedrock_client.invoke(system_prompt, user_prompt, max_tokens=1800)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "BedrockClientError")
        logger.exception("Bedrock recommendation generation failed: member=%s code=%s", normalized, code)
        raise HTTPException(status_code=502, detail=f"BEDROCK_{code}") from exc
    except BotoCoreError as exc:
        logger.exception("Bedrock recommendation generation failed: member=%s", normalized)
        raise HTTPException(status_code=502, detail="BEDROCK_CLIENT_ERROR") from exc
    parsed = _parse_bedrock_question(raw)

    saved = repo.save_pool_question(
        member_id=normalized,
        weak_area=target["weak_area_key"],
        subject_code=target["subject_code"],
        reason=parsed["reason"],
        question_text=parsed["question"],
        scenario=parsed["scenario"],
        options=parsed["choices"],
        correct_option_no=parsed["answer"],
        explanation=parsed["explanation"],
        difficulty=parsed["difficulty"],
    )
    return _format_question(saved)


def submit_answer(question_id: int, member_id: str, selected_option_no: int) -> dict[str, Any]:
    normalized = member_id.strip()
    result = repo.record_answer(question_id, normalized, selected_option_no)
    pool_size = repo.get_pool_size(normalized)
    return {
        "isCorrect": result["is_correct"],
        "correctOptionNo": result["correct_option_no"],
        "explanation": result["explanation"],
        "poolSize": pool_size,
    }
