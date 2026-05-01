from __future__ import annotations

from backend.models.schemas import QuestionOutput, RuleValidationResult

MIN_EXPLANATION_LEN = 30
MIN_TAGS = 1
VALID_DIFFICULTIES = {"easy", "medium", "hard"}


def validate(q: QuestionOutput) -> RuleValidationResult:
    errors: list[str] = []

    if len(q.choices) != 5:
        errors.append(f"선택지는 5개여야 합니다. 현재: {len(q.choices)}개")

    if not (1 <= q.answer <= 5):
        errors.append(f"answer는 1~5 범위여야 합니다. 현재: {q.answer}")

    if len(q.explanation.strip()) < MIN_EXPLANATION_LEN:
        errors.append(
            f"explanation이 너무 짧습니다 (최소 {MIN_EXPLANATION_LEN}자). "
            f"현재: {len(q.explanation.strip())}자"
        )

    if q.difficulty not in VALID_DIFFICULTIES:
        errors.append(f"difficulty 값이 올바르지 않습니다: {q.difficulty!r}")

    if not q.tags or len(q.tags) < MIN_TAGS:
        errors.append("tags가 비어 있습니다.")

    empty_choices = [i + 1 for i, c in enumerate(q.choices) if not c.strip()]
    if empty_choices:
        errors.append(f"비어 있는 선택지: {empty_choices}")

    if not q.question.strip():
        errors.append("question이 비어 있습니다.")

    if not q.source_summary.strip():
        errors.append("source_summary가 비어 있습니다.")

    return RuleValidationResult(passed=len(errors) == 0, errors=errors)
