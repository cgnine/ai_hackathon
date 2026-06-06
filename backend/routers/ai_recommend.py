from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
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
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to fill pool: member_id=%s", request.member_id)
        raise HTTPException(status_code=500, detail="AI_RECOMMEND_FILL_FAILED")


@router.post("/answer")
async def submit_answer(request: AnswerRequest):
    try:
        return svc.submit_answer(request.question_id, request.member_id, request.selected_option_no)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to submit recommendation answer: question_id=%s member_id=%s", request.question_id, request.member_id)
        raise HTTPException(status_code=500, detail="AI_RECOMMEND_ANSWER_FAILED")
