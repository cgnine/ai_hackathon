from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from backend.services import result_service

router = APIRouter(prefix="/results", tags=["results"])


class WrongNoteSaveRequest(BaseModel):
    question_ids: list[str] | None = None


@router.get("/wrong-notes/saved")
async def get_saved_wrong_notes():
    return result_service.get_saved_wrong_notes()


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
