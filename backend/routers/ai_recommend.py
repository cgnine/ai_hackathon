from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services import ai_recommend_service as svc

router = APIRouter(prefix="/ai-recommend", tags=["ai-recommend"])
logger = logging.getLogger(__name__)


class FillRequest(BaseModel):
    member_id: str = Field(min_length=1)


class AnswerRequest(BaseModel):
    question_id: int
    member_id: str = Field(min_length=1)
    selected_option_no: int = Field(ge=1, le=5)


@router.get("/pool")
async def get_pool(member_id: str):
    return svc.get_pool(member_id)


@router.post("/fill")
async def fill_pool(request: FillRequest):
    try:
        return svc.fill_one(request.member_id)
    except Exception:
        logger.exception("Failed to fill pool: member_id=%s", request.member_id)
        raise


@router.post("/answer")
async def submit_answer(request: AnswerRequest):
    return svc.submit_answer(request.question_id, request.member_id, request.selected_option_no)
