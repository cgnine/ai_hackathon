from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services import result_service

router = APIRouter(prefix="/results", tags=["results"])
logger = logging.getLogger(__name__)


class WrongNoteSaveRequest(BaseModel):
    question_ids: list[str] | None = None


class ExamAnswerRequest(BaseModel):
    question_id: str
    selected_number: int | None = Field(default=None, ge=1, le=5)


class ExamResultSaveRequest(BaseModel):
    member_id: str = Field(min_length=1, max_length=50)
    subject_code: str = Field(min_length=1, max_length=50)
    answers: list[ExamAnswerRequest] = Field(min_length=1)


@router.get("/wrong-notes/saved")
async def get_saved_wrong_notes(member_id: str | None = None):
    return result_service.get_saved_wrong_notes(member_id)


@router.post("")
async def save_result(request: ExamResultSaveRequest):
    try:
        return result_service.save_exam_result(
            member_id=request.member_id,
            subject_code=request.subject_code,
            answers=[answer.model_dump() for answer in request.answers],
        )
    except Exception:
        logger.exception(
            "Failed to save exam result: member_id=%s subject_code=%s answer_count=%s",
            request.member_id,
            request.subject_code,
            len(request.answers),
        )
        raise


@router.get("/latest")
async def get_latest_result(profile_name: str | None = None):
    return result_service.get_latest_result(profile_name)


@router.get("/history")
async def get_exam_history(
    member_id: str,
    page: int = 1,
    page_size: int = 10,
    subject_code: str | None = None,
):
    return result_service.get_exam_history(member_id, page, page_size, subject_code)


@router.get("/ranking/monthly")
async def get_monthly_ranking(limit: int = 10):
    return result_service.get_monthly_ranking(limit)


@router.get("/ranking/goal")
async def get_ranking_goal(member_id: str):
    return result_service.get_ranking_goal(member_id)


@router.get("/analysis")
async def get_analysis(member_id: str, include_commentary: bool = True):
    return result_service.get_analysis(member_id, include_commentary=include_commentary)


@router.get("/analysis/commentary")
async def get_analysis_commentary(member_id: str):
    return result_service.get_analysis_commentary(member_id)


@router.get("/ai-recommendation")
async def get_ai_recommendation(member_id: str):
    return result_service.get_ai_recommendation(member_id)


@router.get("/{attempt_id}")
async def get_result(attempt_id: str, history_ids: str | None = None):
    exam_question_ids = [
        history_id.strip()
        for history_id in (history_ids or "").split(",")
        if history_id.strip()
    ]
    return result_service.get_result(attempt_id, exam_question_ids or None)


@router.post("/{attempt_id}/commentary")
async def generate_result_commentary(attempt_id: str, history_ids: str | None = None):
    exam_question_ids = [
        history_id.strip()
        for history_id in (history_ids or "").split(",")
        if history_id.strip()
    ]
    return result_service.generate_result_commentary(attempt_id, exam_question_ids or None)


@router.get("/{attempt_id}/wrong")
async def get_wrong_items(attempt_id: str):
    return result_service.get_wrong_items(attempt_id)


@router.put("/{attempt_id}/wrong-note")
async def save_wrong_note(attempt_id: str, request: WrongNoteSaveRequest):
    return result_service.save_wrong_note(attempt_id, request.question_ids)
