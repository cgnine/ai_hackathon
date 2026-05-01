from __future__ import annotations

from backend.models.schemas import JudgeChecks, JudgeResult, QuestionOutput
from backend.services import bedrock_client, question_parser

JUDGE_SYSTEM_PROMPT = """\
당신은 AI가 생성한 객관식 문제의 품질을 평가하는 전문 평가자입니다.
아래 5가지 기준으로 문제를 평가하고 반드시 JSON 형식으로만 응답하세요.

평가 기준:
1. grounded_in_source: 문제와 정답이 제공된 원문 텍스트에 근거하는가
2. single_correct_answer: 명확하게 하나의 정답만 존재하는가
3. choices_are_valid: 모든 선택지가 합리적이고 혼동을 줄 수 있는 오답인가
4. explanation_is_sufficient: 해설이 정답을 충분히 설명하는가
5. no_hallucination: 원문에 없는 내용을 임의로 추가하지 않았는가

응답 형식 (JSON만):
{
  "grounded_in_source": true/false,
  "single_correct_answer": true/false,
  "choices_are_valid": true/false,
  "explanation_is_sufficient": true/false,
  "no_hallucination": true/false,
  "reasons": ["실패한 항목에 대한 구체적 이유"]
}
"""

PASS_THRESHOLD = 0.6


def judge(q: QuestionOutput, source_text: str) -> JudgeResult:
    user_prompt = f"""[원문 텍스트]
{source_text[:3000]}

[생성된 문제]
문제: {q.question}
선택지:
{chr(10).join(f"{i+1}. {c}" for i, c in enumerate(q.choices))}
정답: {q.answer}번
해설: {q.explanation}
출처 요약: {q.source_summary}

위 문제를 5가지 기준으로 평가하세요."""

    raw = bedrock_client.invoke(JUDGE_SYSTEM_PROMPT, user_prompt, max_tokens=1024)
    data = question_parser.extract_json(raw)

    checks = JudgeChecks(
        grounded_in_source=bool(data.get("grounded_in_source", False)),
        single_correct_answer=bool(data.get("single_correct_answer", False)),
        choices_are_valid=bool(data.get("choices_are_valid", False)),
        explanation_is_sufficient=bool(data.get("explanation_is_sufficient", False)),
        no_hallucination=bool(data.get("no_hallucination", False)),
    )

    passed_count = sum([
        checks.grounded_in_source,
        checks.single_correct_answer,
        checks.choices_are_valid,
        checks.explanation_is_sufficient,
        checks.no_hallucination,
    ])
    score = round(passed_count / 5, 2)
    passed = score >= PASS_THRESHOLD

    reasons = data.get("reasons", [])
    if isinstance(reasons, str):
        reasons = [reasons]

    return JudgeResult(passed=passed, score=score, checks=checks, reasons=reasons)
