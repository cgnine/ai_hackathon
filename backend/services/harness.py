from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from pydantic import ValidationError

from backend.models.schemas import (
    GenerateRequest,
    GenerateResponse,
    QuestionOutput,
    RuleValidationResult,
)
from backend.services import bedrock_client, llm_judge, pdf_extractor, question_parser
from backend.services import rule_validator

LOGS_DIR = Path(__file__).parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

GENERATE_SYSTEM_PROMPT = """\
당신은 IT 개발자 역량평가 시험 문제 출제 전문가입니다.
주어진 교재 원문을 바탕으로 객관식 5지선다 문제 1개를 생성하세요.

반드시 아래 JSON 형식만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "question": "문제 내용",
  "choices": ["선택지1", "선택지2", "선택지3", "선택지4", "선택지5"],
  "answer": 정답번호(1~5 정수),
  "explanation": "정답 해설 (원문 근거 포함)",
  "difficulty": "easy 또는 medium 또는 hard",
  "tags": ["태그1", "태그2"],
  "source_summary": "원문에서 문제의 근거가 된 내용 요약"
}

규칙:
- 원문에 명확하게 근거가 있는 내용만 출제한다.
- 정답은 반드시 하나여야 한다.
- 오답은 그럴듯하게 혼동을 줄 수 있어야 한다.
- 해설은 원문 근거를 포함해 30자 이상으로 작성한다.
- 임의로 정보를 추가하거나 추측하지 않는다.
"""


def _generate_question(source_text: str) -> tuple[QuestionOutput, str]:
    user_prompt = f"[교재 원문]\n{source_text[:4000]}\n\n위 내용을 바탕으로 문제를 생성하세요."
    raw = bedrock_client.invoke(GENERATE_SYSTEM_PROMPT, user_prompt)
    data = question_parser.extract_json(raw)
    return QuestionOutput(**data), raw


def run(request: GenerateRequest) -> GenerateResponse:
    run_id = str(uuid.uuid4())
    log: dict = {
        "run_id": run_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "request": request.model_dump(),
        "steps": [],
    }

    def step(name: str, result: dict):
        log["steps"].append({"step": name, **result})

    recovery_used = False
    retry_count = 0

    # 1. 입력 통제: PDF 추출
    try:
        source_text = pdf_extractor.extract_text(
            request.pdf_filename, request.page_start, request.page_end
        )
        step("pdf_extract", {"status": "ok", "chars": len(source_text)})
    except Exception as e:
        step("pdf_extract", {"status": "error", "error": str(e)})
        return _fail(run_id, log, f"PDF 추출 실패: {e}")

    # 2. 문제 생성 (최대 2회: 1차 + Recovery 1회)
    question: Optional[QuestionOutput] = None
    rule_result: Optional[RuleValidationResult] = None
    judge_result = None
    raw_response = ""

    for attempt in range(2):
        if attempt > 0:
            recovery_used = True
            retry_count = attempt

        # 2-1. Bedrock 호출
        try:
            question, raw_response = _generate_question(source_text)
            step(f"generate_attempt_{attempt+1}", {"status": "ok"})
        except (ValidationError, ValueError, Exception) as e:
            step(f"generate_attempt_{attempt+1}", {"status": "error", "error": str(e)})
            if attempt == 0:
                continue
            return _fail(run_id, log, f"문제 생성 실패: {e}", recovery_used, retry_count)

        # 2-2. Rule Validation
        rule_result = rule_validator.validate(question)
        step(f"rule_validation_attempt_{attempt+1}", rule_result.model_dump())

        if not rule_result.passed:
            if attempt == 0:
                continue
            break

        # 2-3. LLM-as-Judge
        try:
            judge_result = llm_judge.judge(question, source_text)
            step(f"judge_attempt_{attempt+1}", judge_result.model_dump())
        except Exception as e:
            step(f"judge_attempt_{attempt+1}", {"status": "error", "error": str(e)})
            if attempt == 0:
                continue
            break

        if judge_result.passed:
            break
        elif attempt == 0:
            continue

    # 3. 최종 판정
    final_status = "PASS"
    if question is None:
        final_status = "FAIL"
    elif rule_result is None or not rule_result.passed:
        final_status = "FAIL"
    elif judge_result is None or not judge_result.passed:
        final_status = "FAIL"

    log["final_status"] = final_status
    log["recovery_used"] = recovery_used
    log["retry_count"] = retry_count
    log_ref = _save_log(run_id, log)

    resp_kwargs: dict = dict(
        run_id=run_id,
        final_status=final_status,
        recovery_used=recovery_used,
        retry_count=retry_count,
        log_ref=log_ref,
        rule_validation_result=rule_result,
        judge_result=judge_result,
    )
    if question is not None:
        resp_kwargs.update(
            question=question.question,
            choices=question.choices,
            answer=question.answer,
            explanation=question.explanation,
            difficulty=question.difficulty,
            tags=question.tags,
            source_summary=question.source_summary,
        )

    return GenerateResponse(**resp_kwargs)


def _fail(
    run_id: str,
    log: dict,
    error: str,
    recovery_used: bool = False,
    retry_count: int = 0,
) -> GenerateResponse:
    log["final_status"] = "FAIL"
    log["error"] = error
    log_ref = _save_log(run_id, log)
    return GenerateResponse(
        run_id=run_id,
        final_status="FAIL",
        recovery_used=recovery_used,
        retry_count=retry_count,
        log_ref=log_ref,
        error=error,
    )


def _save_log(run_id: str, log: dict) -> str:
    log_path = LOGS_DIR / f"run_{run_id}.json"
    log_path.write_text(
        json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return str(log_path)
