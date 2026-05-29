from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.models.schemas import LoginRequest, LoginResponse
from backend.services import member_repository

router = APIRouter()


@router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    member = member_repository.get_member(request.member_id)
    if member is None:
        raise HTTPException(status_code=401, detail="등록되지 않은 사번입니다.")

    return LoginResponse(
        member_id=member["member_id"],
        member_name=member["member_name"],
    )
