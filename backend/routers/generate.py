from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.models.schemas import GenerateRequest, GenerateResponse
from backend.services import harness

router = APIRouter()


@router.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest = GenerateRequest()):
    result = harness.run(request)
    status_code = 200 if result.final_status == "PASS" else 422
    return JSONResponse(content=result.model_dump(), status_code=status_code)
