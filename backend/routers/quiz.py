from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.models.schemas import QuizRequest, QuizResponse, SolveRequest, SolveResponse
from backend.services import question_repository

router = APIRouter()


@router.post("/quiz", response_model=QuizResponse)
async def get_quiz(request: QuizRequest = QuizRequest()):
    if request.question_id is not None:
        q = question_repository.get_question_by_id(request.question_id)
        if q is None:
            raise HTTPException(status_code=404, detail=f"question_id={request.question_id} 가 없거나 비활성 상태입니다.")
    else:
        q = question_repository.get_least_solved_question(
            category=request.category,
            difficulty=request.difficulty,
        )
        if q is None:
            raise HTTPException(status_code=404, detail="조건에 맞는 문제가 없습니다.")

    return QuizResponse(
        question_id=q.id,
        category=q.category,
        sub_category=q.sub_category,
        question_text=q.question_text,
        options=q.options,
        difficulty=q.difficulty,
        tags=q.tags,
    )


@router.post("/solve", response_model=SolveResponse)
async def solve(request: SolveRequest):
    q = question_repository.get_question_by_id(request.question_id)
    if q is None:
        raise HTTPException(status_code=404, detail=f"question_id={request.question_id} 가 없거나 비활성 상태입니다.")

    is_correct = request.selected_option_no == q.correct_option_no

    question_repository.submit_solve(
        user_id=request.user_id,
        question_id=q.id,
        selected_option_no=request.selected_option_no,
        is_correct=is_correct,
        elapsed_seconds=request.elapsed_seconds,
    )

    return SolveResponse(
        is_correct=is_correct,
        correct_option_no=q.correct_option_no,
        explanation=q.explanation,
        solved_count=q.solved_count + 1,
        correct_count=q.correct_count + (1 if is_correct else 0),
    )
