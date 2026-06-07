from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

load_dotenv(PROJECT_ROOT / ".env")

from backend.services import bedrock_client  # noqa: E402


SYSTEM_PROMPT = """
너는 개발자 역량평가 결과를 분석하는 전문 학습 코치다.
응시 결과 데이터를 근거로 수험자에게 제공할 결과 코멘트를 작성한다.
입력 데이터에 없는 사실은 추측하지 않는다.
사용자를 비난하지 않고, 실무적이며 바로 실행 가능한 학습 방향을 제안한다.
""".strip()


USER_PROMPT_TEMPLATE = """
아래 응시 결과 데이터를 바탕으로 결과 코멘트를 작성하라.

작성 항목:
1. 종합 진단
2. 강점 분석
3. 보완 포인트
4. 다음 학습 전략

작성 규칙:
- 각 항목은 1~2문장으로 작성한다.
- 총점, 합격 여부, 영역별 점수, 오답 정보를 근거로 작성한다.
- 가능한 경우 영역명과 점수를 언급한다.
- 같은 표현을 반복하지 않는다.
- 한국어로 자연스럽게 작성한다.
- 줄바꿈은 사용하지 않는다.

길이 제한:
- overall은 공백 포함 160자 이내로 작성한다.
- strength는 공백 포함 140자 이내로 작성한다.
- weakness는 공백 포함 160자 이내로 작성한다.
- strategy는 공백 포함 180자 이내로 작성한다.

출력 규칙:
- 반드시 JSON만 출력한다.
- 마크다운 코드블록을 사용하지 않는다.
- JSON key는 반드시 overall, strength, weakness, strategy만 사용한다.
- 각 value는 문자열이어야 한다.

출력 형식:
{
  "overall": "종합 진단 내용",
  "strength": "강점 분석 내용",
  "weakness": "보완 포인트 내용",
  "strategy": "다음 학습 전략 내용"
}

응시 결과 데이터:
{result_data}
""".strip()


SAMPLE_RESULT_DATA: dict[str, Any] = {
    "examId": "00000001",
    "memberId": "d170241",
    "memberName": "이상미",
    "subjectCode": "CD",
    "subjectName": "Cloud for Developer(Pro)",
    "examDate": "20260607",
    "examRound": "1",
    "score": 60,
    "passScore": 60,
    "passStatus": "합격",
    "totalCount": 20,
    "correctCount": 12,
    "wrongCount": 8,
    "areaScores": [
        {
            "areaName": "클라우드 인프라 설계",
            "totalCount": 4,
            "correctCount": 3,
            "wrongCount": 1,
            "score": 75,
        },
        {
            "areaName": "고가용성 및 장애대응 전략",
            "totalCount": 4,
            "correctCount": 1,
            "wrongCount": 3,
            "score": 25,
        },
        {
            "areaName": "보안 및 접근제어",
            "totalCount": 4,
            "correctCount": 4,
            "wrongCount": 0,
            "score": 100,
        },
        {
            "areaName": "모니터링 및 운영 자동화",
            "totalCount": 4,
            "correctCount": 2,
            "wrongCount": 2,
            "score": 50,
        },
        {
            "areaName": "비용 최적화",
            "totalCount": 4,
            "correctCount": 2,
            "wrongCount": 2,
            "score": 50,
        },
    ],
    "wrongQuestions": [
        {
            "areaName": "고가용성 및 장애대응 전략",
            "question": "트래픽 집중 상황에서 고가용성을 확보하는 설계 방식은?",
            "selectedAnswer": "캐싱",
            "correctAnswer": "로드 밸런싱",
            "explanation": "로드 밸런싱은 트래픽을 여러 서버로 분산하고 장애 시 다른 서버로 우회 처리해 가용성을 높인다.",
        },
        {
            "areaName": "모니터링 및 운영 자동화",
            "question": "장애 징후를 조기에 파악하기 위해 우선 구축해야 하는 체계는?",
            "selectedAnswer": "수동 로그 점검",
            "correctAnswer": "지표 기반 모니터링과 알림",
            "explanation": "지표 기반 모니터링과 알림은 이상 징후를 자동으로 탐지하고 빠른 대응을 가능하게 한다.",
        },
    ],
}


def build_user_prompt(result_data: dict[str, Any]) -> str:
    return USER_PROMPT_TEMPLATE.replace(
        "{result_data}",
        json.dumps(result_data, ensure_ascii=False, indent=2),
    )


def extract_json_object(text: str) -> dict[str, Any]:
    decoder = json.JSONDecoder()
    stripped = text.strip()
    for index, char in enumerate(stripped):
        if char != "{":
            continue
        try:
            parsed, _ = decoder.raw_decode(stripped[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed
    raise ValueError("JSON object was not found in the model response")


def validate_commentary(payload: dict[str, Any]) -> dict[str, str]:
    required = ("overall", "strength", "weakness", "strategy")
    missing = [key for key in required if key not in payload]
    if missing:
        raise ValueError(f"Missing required keys: {', '.join(missing)}")

    limits = {
        "overall": 200,
        "strength": 180,
        "weakness": 200,
        "strategy": 220,
    }
    return {key: truncate_text(str(payload[key]), limits[key]) for key in required}


def truncate_text(value: str, limit: int) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "…"


def main() -> None:
    parser = argparse.ArgumentParser(description="Test result commentary prompt with sample exam data.")
    parser.add_argument("--print-prompt", action="store_true", help="Only print prompts without calling Bedrock.")
    parser.add_argument("--max-tokens", type=int, default=1200, help="Max tokens for Bedrock response.")
    args = parser.parse_args()

    user_prompt = build_user_prompt(SAMPLE_RESULT_DATA)

    if args.print_prompt:
        print("=== SYSTEM PROMPT ===")
        print(SYSTEM_PROMPT)
        print("\n=== USER PROMPT ===")
        print(user_prompt)
        return

    raw = bedrock_client.invoke(SYSTEM_PROMPT, user_prompt, max_tokens=args.max_tokens)
    parsed = validate_commentary(extract_json_object(raw))

    print("=== RAW RESPONSE ===")
    print(raw)
    print("\n=== PARSED JSON ===")
    print(json.dumps(parsed, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
