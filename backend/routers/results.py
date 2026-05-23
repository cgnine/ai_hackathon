from __future__ import annotations

from fastapi import APIRouter

from backend.services import result_service

router = APIRouter(prefix="/results", tags=["results"])


@router.get("/{attempt_id}")
async def get_result(attempt_id: str):
    return result_service.get_result(attempt_id)


@router.get("/{attempt_id}/wrong")
async def get_wrong_items(attempt_id: str):
    return result_service.get_wrong_items(attempt_id)
