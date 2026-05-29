from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services import result_service

router = APIRouter(prefix="/results", tags=["results"])


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
async def get_saved_wrong_notes():
    return result_service.get_saved_wrong_notes()


@router.post("")
async def save_result(request: ExamResultSaveRequest):
    return result_service.save_exam_result(
        member_id=request.member_id,
        subject_code=request.subject_code,
        answers=[answer.model_dump() for answer in request.answers],
    )


@router.get("/latest")
async def get_latest_result(profile_name: str | None = None):
    return result_service.get_latest_result(profile_name)


@router.get("/{attempt_id}")
async def get_result(attempt_id: str):
    return result_service.get_result(attempt_id)


@router.get("/{attempt_id}/wrong")
async def get_wrong_items(attempt_id: str):
    return result_service.get_wrong_items(attempt_id)


@router.put("/{attempt_id}/wrong-note")
async def save_wrong_note(attempt_id: str, request: WrongNoteSaveRequest):
    return result_service.save_wrong_note(attempt_id, request.question_ids)
