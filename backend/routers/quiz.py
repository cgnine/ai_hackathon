from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.models.schemas import (
    QuestionCategoryItem,
    QuizRequest,
    QuizResponse,
    SolveRequest,
    SolveResponse,
    SubjectListItem,
    SubjectListResponse,
    SubjectQuizItem,
    SubjectQuizListRequest,
    SubjectQuizListResponse,
)
from backend.services import question_repository

router = APIRouter()


@router.get("/quiz/subjects", response_model=SubjectListResponse)
async def get_quiz_subjects():
    subjects = question_repository.get_available_subjects()
    return SubjectListResponse(
        items=[
            SubjectListItem(
                subject_code=subject.subject_code,
                subject_name=subject.subject_name,
                subject_description=subject.subject_description,
                question_count=subject.question_count,
            )
            for subject in subjects
        ]
    )


@router.get("/questions", response_model=list[QuestionCategoryItem])
async def get_questions_by_category(category: str):
    questions = question_repository.get_questions_by_category(category)
    if not questions:
        raise HTTPException(status_code=404, detail=f"category={category} 에 해당하는 문제가 없습니다.")

    return [
        QuestionCategoryItem(
            question_text=q.question_text,
            option_1=q.option_1,
            option_2=q.option_2,
            option_3=q.option_3,
            option_4=q.option_4,
            difficulty=q.difficulty,
        )
        for q in questions
    ]


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


@router.post("/quiz/list", response_model=SubjectQuizListResponse)
async def get_quiz_list(request: SubjectQuizListRequest):
    questions = question_repository.get_questions_by_subject_code(
        subject_code=request.subject_code,
        count=request.count,
    )
    if not questions:
        raise HTTPException(
            status_code=404,
            detail=f"subject_code={request.subject_code} 에 해당하는 문제가 없습니다.",
        )

    return SubjectQuizListResponse(
        subject_code=request.subject_code,
        requested_count=request.count,
        returned_count=len(questions),
        items=[
            SubjectQuizItem(
                question_id=q.question_id,
                subject_code=q.subject_code,
                major_unit=q.major_unit,
                minor_unit=q.minor_unit,
                question_type=q.question_type,
                question_text=q.question_content,
                question_text_extra=q.question_content2,
                choices=q.options,
                answer_number=q.answer_number,
                explanation=q.explanation,
            )
            for q in questions
        ],
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
