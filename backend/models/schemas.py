from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class GenerateRequest(BaseModel):
    # DB 청크 소스
    chunk_id: Optional[int] = None
    chapter_no: Optional[int] = None
    section_no: Optional[int] = None
    # PDF 소스 (chunk_id 미지정 시 fallback)
    pdf_filename: Optional[str] = None
    page_start: int = Field(default=1, ge=1)
    page_end: int = Field(default=10, ge=1)

    @field_validator("page_end")
    @classmethod
    def end_after_start(cls, v, info):
        if "page_start" in info.data and v < info.data["page_start"]:
            raise ValueError("page_end must be >= page_start")
        return v



class ChunkInfo(BaseModel):
    id: int
    chapter_no: int
    chapter_title: str
    section_no: Optional[int] = None
    section_title: Optional[str] = None
    chunk_no: int
    chunk_title: Optional[str] = None
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    tags: Optional[List[str]] = None
    question_count: int = 0
    last_question_at: Optional[datetime] = None


class QuestionOutput(BaseModel):
    question: str
    choices: List[str] = Field(min_length=5, max_length=5)
    answer: int = Field(ge=1, le=5)
    explanation: str
    difficulty: str = Field(pattern="^(easy|medium|hard)$")
    tags: List[str]
    source_summary: str


class RuleValidationResult(BaseModel):
    passed: bool
    errors: List[str] = Field(default_factory=list)


class JudgeChecks(BaseModel):
    grounded_in_source: bool
    single_correct_answer: bool
    choices_are_valid: bool
    explanation_is_sufficient: bool
    no_hallucination: bool


class JudgeResult(BaseModel):
    passed: bool
    score: float = Field(ge=0.0, le=1.0)
    checks: JudgeChecks
    reasons: List[str] = Field(default_factory=list)


class GenerateResponse(BaseModel):
    run_id: str
    final_status: str = Field(pattern="^(PASS|FAIL)$")
    question: Optional[str] = None
    choices: Optional[List[str]] = None
    answer: Optional[int] = None
    explanation: Optional[str] = None
    difficulty: Optional[str] = None
    tags: Optional[List[str]] = None
    source_summary: Optional[str] = None
    chunk_info: Optional[ChunkInfo] = None
    rule_validation_result: Optional[RuleValidationResult] = None
    judge_result: Optional[JudgeResult] = None
    recovery_used: bool = False
    retry_count: int = 0
    log_ref: str = ""
    error: Optional[str] = None


# --- Quiz (문제 조회 및 풀이) ---

class QuizRequest(BaseModel):
    question_id: Optional[int] = None   # 특정 문제 지정
    category: Optional[str] = None     # 없으면 전체
    difficulty: Optional[str] = None   # medium | hard | None


class QuizResponse(BaseModel):
    question_id: int
    category: str
    sub_category: Optional[str] = None
    question_text: str
    options: List[str]                 # [option_1, option_2, option_3, option_4]
    difficulty: str
    tags: Optional[List[str]] = None


class SolveRequest(BaseModel):
    question_id: int
    user_id: str
    selected_option_no: int = Field(ge=1, le=4)
    elapsed_seconds: Optional[int] = Field(default=None, ge=0)


class SolveResponse(BaseModel):
    is_correct: bool
    correct_option_no: int
    explanation: str
    solved_count: int
    correct_count: int
