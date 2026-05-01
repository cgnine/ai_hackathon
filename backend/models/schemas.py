from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class GenerateRequest(BaseModel):
    pdf_filename: Optional[str] = None
    page_start: int = Field(default=1, ge=1)
    page_end: int = Field(default=10, ge=1)

    @field_validator("page_end")
    @classmethod
    def end_after_start(cls, v, info):
        if "page_start" in info.data and v < info.data["page_start"]:
            raise ValueError("page_end must be >= page_start")
        return v


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
    rule_validation_result: Optional[RuleValidationResult] = None
    judge_result: Optional[JudgeResult] = None
    recovery_used: bool = False
    retry_count: int = 0
    log_ref: str = ""
    error: Optional[str] = None
