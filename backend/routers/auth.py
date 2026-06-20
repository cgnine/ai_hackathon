from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.models.schemas import (
    LoginRequest,
    LoginResponse,
    MemberProfileResponse,
    MemberProfileUpdateRequest,
    PasswordResetRequest,
    PasswordResetResponse,
    SignupRequest,
    SignupResponse,
)
from backend.services import member_repository

router = APIRouter()


@router.get("/auth/member", response_model=MemberProfileResponse)
async def member_profile(member_id: str):
    member = member_repository.get_member_profile(member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="등록된 사번이 없습니다.")

    return MemberProfileResponse(
        member_id=member["member_id"],
        member_name=member["member_name"],
        email=member.get("email"),
        affiliate=member.get("affiliate"),
    )


@router.put("/auth/member", response_model=MemberProfileResponse)
async def update_member_profile(request: MemberProfileUpdateRequest):
    member = member_repository.update_member_profile(
        request.member_id,
        member_name=request.member_name,
        email=request.email,
        affiliate=request.affiliate,
    )
    if member is None:
        raise HTTPException(status_code=404, detail="등록된 사번이 없습니다.")

    return MemberProfileResponse(
        member_id=member["member_id"],
        member_name=member["member_name"],
        email=member.get("email"),
        affiliate=member.get("affiliate"),
    )


@router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    result = member_repository.authenticate_member(
        request.member_id,
        request.password,
    )
    if result["status"] == "not_found":
        raise HTTPException(status_code=404, detail="등록된 사번이 없습니다.")
    if result["status"] != "ok":
        raise HTTPException(status_code=401, detail="사번 또는 비밀번호가 올바르지 않습니다.")

    return LoginResponse(
        member_id=str(result["member_id"]),
        member_name=str(result["member_name"]),
    )


@router.post("/auth/signup", response_model=SignupResponse)
async def signup(request: SignupRequest):
    member = member_repository.create_member(
        request.member_id,
        request.member_name,
        request.password,
    )
    if member is None:
        raise HTTPException(status_code=409, detail="이미 등록된 사번입니다.")

    return SignupResponse(
        member_id=member["member_id"],
        member_name=member["member_name"],
    )


@router.post("/auth/reset-password", response_model=PasswordResetResponse)
async def reset_password(request: PasswordResetRequest):
    updated = member_repository.reset_member_password(
        request.member_id,
        request.password,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="등록된 사번이 없습니다.")

    return PasswordResetResponse(member_id=request.member_id)
