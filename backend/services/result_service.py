from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from psycopg2.extras import RealDictCursor

from backend.services import bedrock_client, question_parser
from backend.services.db import get_conn

_MONTHLY_RANKING_CACHE: dict[str, Any] = {
    "expires_at": None,
    "data": None,
    "limit": None,
}
_MONTHLY_RANKING_CACHE_SECONDS = 30
_ANALYSIS_CACHE: dict[str, dict[str, Any]] = {}
_ANALYSIS_CACHE_SECONDS = 60
_ANALYSIS_COMMENTARY_CACHE_SECONDS = 180
_ANALYSIS_SUBJECT_COMMENTARY_CACHE_SECONDS = 300
_RANKING_GOAL_CACHE: dict[str, dict[str, Any]] = {}
_RANKING_GOAL_CACHE_SECONDS = 60
_RANKING_GOAL_COMMENTARY_CACHE_SECONDS = 300
_RESULT_RADAR_LABEL_CACHE: dict[str, str] = {}


def _clear_analysis_cache(member_id: str) -> None:
    prefix = f"{member_id}:"
    for key in list(_ANALYSIS_CACHE):
        if key.startswith(prefix):
            _ANALYSIS_CACHE.pop(key, None)
    for key in list(_RANKING_GOAL_CACHE):
        if key.startswith(prefix):
            _RANKING_GOAL_CACHE.pop(key, None)
    _MONTHLY_RANKING_CACHE.update({
        "expires_at": None,
        "data": None,
        "limit": None,
    })


def _to_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _question_text(row: dict[str, Any]) -> str:
    return (row.get("question_content") or "").strip()


def _question_scenario(row: dict[str, Any]) -> str:
    return (row.get("question_content2") or "").strip()


def _question_type(row: dict[str, Any]) -> str:
    return "실무형" if _question_scenario(row) else "이론형"


def _score(correct: int, total: int) -> int:
    return round((correct / total) * 100) if total else 0


def _parse_bedrock_commentary(text: str) -> list[str]:
    lines = [line.strip(" -\n\t") for line in text.splitlines()]
    cleaned = [line for line in lines if line]
    if not cleaned and text.strip():
        cleaned = [text.strip()]
    return cleaned[:4]


RESULT_COMMENTARY_SYSTEM_PROMPT = """
너는 개발자 역량평가 결과를 분석하는 전문 학습 코치다.
응시 결과 데이터를 근거로 수험자에게 제공할 결과 코멘트를 작성한다.
입력 데이터에 없는 사실은 추측하지 않는다.
사용자를 비난하지 않고, 실무적이며 바로 실행 가능한 학습 방향을 제안한다.
""".strip()


RESULT_COMMENTARY_USER_PROMPT_TEMPLATE = """
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


def _extract_json_object(text: str) -> dict[str, Any]:
    decoder = json.JSONDecoder()
    stripped = str(text or "").strip()
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


def _validate_result_commentary(payload: dict[str, Any]) -> dict[str, str]:
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
    return {
        key: _truncate_commentary_text(str(payload[key]), limits[key])
        for key in required
    }


def _truncate_commentary_text(value: str, limit: int) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "…"


def _truncate_commentary_sentence(value: str, limit: int) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    sentence_marks = ".!?。！？"
    cut_at = max(text.rfind(mark, 0, limit + 1) for mark in sentence_marks)
    if cut_at >= max(12, limit // 2):
        return text[: cut_at + 1].rstrip()
    return _truncate_commentary_text(text, limit)


def _complete_commentary_sentences(value: str, limit: int) -> str:
    text = _truncate_commentary_sentence(value, limit)
    if not text:
        return ""
    sentence_marks = ".!?。！？"
    if text[-1] in sentence_marks:
        return text
    cut_at = max(text.rfind(mark) for mark in sentence_marks)
    return text[: cut_at + 1].rstrip() if cut_at >= 0 else ""


def _fallback_ranking_goal_coach(
    my_rank: int,
    target_rank: int,
    gap_score: float,
    subject_targets: list[dict[str, Any]],
) -> str:
    subjects = [
        str(item.get("subjectName") or item.get("subjectCode") or "").strip()
        for item in subject_targets[:2]
        if str(item.get("subjectName") or item.get("subjectCode") or "").strip()
    ]
    gap = int(gap_score) if float(gap_score).is_integer() else gap_score
    if subjects:
        subject_text = "와 ".join(subjects)
        message = f"현재 {target_rank}위까지 {gap}점 차이입니다. {subject_text} 강화해 보세요."
    else:
        message = f"현재 {target_rank}위까지 {gap}점 차이입니다. 핵심 과목을 보완해 보세요."
    return message if len(message) <= 40 else f"목표 순위까지 {gap}점 남았습니다."


def _bedrock_ranking_goal_coach(
    ranking_goal: dict[str, Any],
    subject_targets: list[dict[str, Any]],
) -> str:
    my_rank = int(ranking_goal["my_rank"])
    target_rank = int(ranking_goal["target_rank"])
    gap_score = float(ranking_goal["gap_score"] or 0)
    fallback = _fallback_ranking_goal_coach(my_rank, target_rank, gap_score, subject_targets)
    prompt_subjects = [
        {
            "subjectName": item.get("subjectName"),
            "subjectCode": item.get("subjectCode"),
            "expectedUpScore": item.get("expectedUpScore"),
        }
        for item in subject_targets[:2]
    ]
    system_prompt = "당신은 KB Masters의 AI 성장 코치입니다."
    user_prompt = (
        "사용자의 현재 순위, 목표 순위, 점수 차이, 추천 과목을 분석하여\n"
        "목표 달성을 위한 학습 전략을 작성하세요.\n\n"
        "규칙\n\n"
        "- 정확히 2문장 이하\n"
        "- 전체 40자 이내\n"
        "- 현재 순위 또는 목표 순위를 포함\n"
        "- 점수 차이를 포함\n"
        "- 추천 과목은 최대 2개\n"
        "- 자연스럽게 문장을 마무리\n"
        "- 문장 중간에 끊기지 않도록 작성\n"
        "- 과장된 표현 금지\n"
        "- 제목 없이 문장만 출력\n\n"
        "예시\n\n"
        "현재 20위까지 3점 차이입니다.\n"
        "SW와 Cloud 학습을 강화해 보세요.\n\n"
        "목표 순위까지 2점 남았습니다. AI 과목을 집중 학습해 보세요.\n\n"
        "데이터\n"
        + json.dumps(
            {
                "myRank": my_rank,
                "myScore": float(ranking_goal["my_score"] or 0),
                "targetRank": target_rank,
                "targetScore": float(ranking_goal["target_score"] or 0),
                "gapScore": gap_score,
                "successRate": int(ranking_goal["success_rate"] or 0),
                "recommendedSubjects": prompt_subjects,
            },
            ensure_ascii=False,
        )
    )
    try:
        raw = bedrock_client.invoke(system_prompt, user_prompt, max_tokens=120)
    except Exception:
        return fallback

    text = " ".join(str(raw or "").replace('"', "").split())
    if not text:
        return fallback
    if ("위" not in text) or ("점" not in text):
        return fallback
    return text if len(text) <= 40 else fallback


def _fallback_ranking_goal_actions(subject_targets: list[dict[str, Any]]) -> list[dict[str, str]]:
    actions = []
    for item in subject_targets[:2]:
        subject = str(item.get("subjectName") or item.get("subjectCode") or "과목").strip()
        expected = item.get("expectedUpScore") or 0
        expected_text = "평균 보완" if expected > 0 else "강점 유지"
        if subject == "SW":
            title = "SW 실무 문제 집중 학습"
        elif subject == "Cloud":
            title = "Cloud 개념 문제 학습"
        else:
            title = f"{subject} 집중 학습"
        actions.append({
            "title": title[:18],
            "expected": expected_text,
        })

    while len(actions) < 2:
        actions.append({
            "title": "핵심 과목 집중 학습",
            "expected": "+1점 예상",
        })
    return actions[:2]


def format_ranking_expected_score(value: Any) -> str:
    numeric = float(value or 0)
    score = int(numeric) if numeric.is_integer() else numeric
    return f"+{score}점 예상"


def format_ranking_number(value: Any) -> str:
    numeric = float(value or 0)
    return str(int(numeric)) if numeric.is_integer() else f"{numeric:.1f}"


def format_ranking_integer(value: Any) -> str:
    return str(int(float(value or 0)))


def _compact_ranking_subject_name(value: Any) -> str:
    text = " ".join(str(value or "").split())
    normalized = text.lower()
    if "cloud for architect" in normalized:
        return "CA"
    if "cloud for developer" in normalized:
        return "CD"
    if "ai engineering" in normalized:
        return "AI"
    if "data engineering" in normalized:
        return "DE"
    if "software engineering" in normalized:
        return "SW"
    return text


def _normalize_learning_recommendation(value: Any) -> str:
    text = " ".join(str(value or "").split())
    replacements = {
        "Cloud for Architect(Pro)": "CA",
        "Cloud for Architect(": "CA",
        "Cloud for Architect": "CA",
        "Cloud for Developer(Pro)": "CD",
        "Cloud for Developer(": "CD",
        "Cloud for Developer": "CD",
        "AI Engineering": "AI",
        "Data Engineering": "DE",
        "Software Engineering": "SW",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    if len(text) <= 20:
        return text
    return text[:20].rstrip(" (")


def _extract_json_array(text: str) -> list[Any]:
    decoder = json.JSONDecoder()
    stripped = str(text or "").strip()
    for index, char in enumerate(stripped):
        if char != "[":
            continue
        try:
            parsed, _ = decoder.raw_decode(stripped[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, list):
            return parsed
    raise ValueError("JSON array was not found in the model response")


def _validate_ranking_goal_actions(payload: list[Any], fallback: list[dict[str, str]]) -> list[dict[str, str]]:
    actions = []
    for item in payload[:2]:
        if not isinstance(item, dict):
            continue
        title = " ".join(str(item.get("title") or "").split())
        expected = " ".join(str(item.get("expected") or "").split())
        if not title or not expected:
            continue
        if "(" in title or ")" in title or "Pro" in title or "Chapter" in title:
            continue
        if len(title) > 18:
            title = title[:18]
        if not (expected.startswith("+") and expected.endswith("점 예상")):
            continue
        actions.append({"title": title, "expected": expected})
    return actions if len(actions) == 2 else fallback


def _bedrock_ranking_goal_actions(
    ranking_goal: dict[str, Any],
    subject_targets: list[dict[str, Any]],
) -> list[dict[str, str]]:
    fallback = _fallback_ranking_goal_actions(subject_targets)
    subjects = [
        {
            "subjectName": item.get("subjectName"),
            "expectedUpScore": item.get("expectedUpScore"),
        }
        for item in subject_targets[:2]
    ]
    system_prompt = "당신은 KB Masters의 AI 학습 추천 코치입니다."
    user_prompt = (
        "사용자의 목표 순위와 추천 과목 데이터를 바탕으로\n"
        "AI 추격 목표 추천 카드에 표시할 학습 액션 2개를 작성하세요.\n\n"
        "입력 데이터\n\n"
        + json.dumps(
            {
                "myRank": int(ranking_goal["my_rank"]),
                "myScore": float(ranking_goal["my_score"] or 0),
                "targetRank": int(ranking_goal["target_rank"]),
                "targetScore": float(ranking_goal["target_score"] or 0),
                "gapScore": float(ranking_goal["gap_score"] or 0),
                "successRate": int(ranking_goal["success_rate"] or 0),
                "subjects": subjects,
            },
            ensure_ascii=False,
        )
        + "\n\n"
        "규칙\n\n"
        "- 정확히 2개만 작성\n"
        "- 각 title은 18자 이내\n"
        "- 과목명은 입력된 짧은 과목명 그대로 사용\n"
        "- expected는 \"+N점 예상\" 형식\n"
        "- 긴 과목명, 괄호, Pro, Chapter 문구 사용 금지\n"
        "- 설명 문장 금지\n"
        "- JSON 배열만 출력\n\n"
        "출력 예시\n\n"
        "[\n"
        "  {\n"
        "    \"title\": \"SW 실무 문제 집중 학습\",\n"
        "    \"expected\": \"+3점 예상\"\n"
        "  },\n"
        "  {\n"
        "    \"title\": \"Cloud 개념 문제 학습\",\n"
        "    \"expected\": \"+2점 예상\"\n"
        "  }\n"
        "]"
    )
    try:
        raw = bedrock_client.invoke(system_prompt, user_prompt, max_tokens=220)
        return _validate_ranking_goal_actions(_extract_json_array(raw), fallback)
    except Exception:
        return fallback


def _fallback_ranking_rival_coach(
    rival_row: dict[str, Any],
    subject_rows: list[dict[str, Any]],
) -> str:
    gap = float(rival_row["score_gap"] or 0)
    gap_text = int(gap) if gap.is_integer() else gap
    subject = ""
    for row in subject_rows:
        my_score = float(row["my_score"] or 0)
        rival_score = float(row["rival_score"] or 0)
        if rival_score > my_score:
            subject = str(row.get("subject_code") or row.get("subject_name") or "").strip()
            break
    if subject:
        message = f"현재 {gap_text}점 차이의 라이벌입니다. {subject} 보완으로 추격 가능합니다."
    else:
        message = f"현재 {gap_text}점 차이의 라이벌입니다. 꾸준히 추격해 보세요."
    return message if len(message) <= 40 else f"현재 {gap_text}점 차이의 라이벌입니다."


def _bedrock_ranking_rival_coach(
    ranking_goal: dict[str, Any],
    rival_row: dict[str, Any],
    subject_rows: list[dict[str, Any]],
) -> str:
    fallback = _fallback_ranking_rival_coach(rival_row, subject_rows)
    comparisons = [
        {
            "subjectCode": row.get("subject_code"),
            "subjectName": row.get("subject_name"),
            "myScore": float(row["my_score"] or 0),
            "rivalScore": float(row["rival_score"] or 0),
        }
        for row in subject_rows
    ]
    system_prompt = "당신은 KB Masters의 AI 경쟁 분석가입니다."
    user_prompt = (
        "사용자와 라이벌의 순위 및 점수 차이를 분석하여\n"
        "라이벌 추천 이유를 작성하세요.\n\n"
        "규칙\n\n"
        "- 정확히 2문장 이하\n"
        "- 전체 40자 이내\n"
        "- 점수 차이를 반드시 포함\n"
        "- 자연스럽게 문장을 마무리\n"
        "- 문장 중간에 끊기지 않도록 작성\n"
        "- 경쟁 의식을 유발하되 긍정적 표현 사용\n"
        "- 제목 없이 문장만 출력\n\n"
        "예시\n\n"
        "현재 2점 차이의 라이벌입니다.\n"
        "SW 보완으로 추격 가능합니다.\n\n"
        "현재 가장 가까운 경쟁자입니다.\n"
        "AI 학습을 우선 추천합니다.\n\n"
        "데이터\n"
        + json.dumps(
            {
                "myRank": int(ranking_goal["my_rank"]),
                "myScore": float(ranking_goal["my_score"] or 0),
                "rivalRank": int(rival_row["rival_rank"]),
                "rivalScore": float(rival_row["rival_score"] or 0),
                "scoreGap": float(rival_row["score_gap"] or 0),
                "subjectComparisons": comparisons,
            },
            ensure_ascii=False,
        )
    )
    try:
        raw = bedrock_client.invoke(system_prompt, user_prompt, max_tokens=120)
    except Exception:
        return fallback

    text = " ".join(str(raw or "").replace('"', "").split())
    if not text:
        return fallback
    gap_text = format_ranking_number(float(rival_row["score_gap"] or 0))
    if gap_text not in text:
        return fallback
    return text if len(text) <= 40 else fallback


def _fallback_ranking_learning_recommendations(pattern: dict[str, Any]) -> list[str]:
    exam_count = format_ranking_integer(pattern["avg_exam_count"])
    practical_rate = format_ranking_integer(pattern["avg_practical_rate"])
    wrong_note_count = format_ranking_integer(pattern["avg_wrong_note_saved_count"])
    weak_subject = str(pattern["weak_subject"] or "취약 과목").strip()
    weak_subject = _compact_ranking_subject_name(weak_subject)
    practical_text = "실무형 판단 연습" if float(pattern["avg_practical_rate"] or 0) <= 0 else f"실무형 {practical_rate}%까지 확대"
    return [
        f"{exam_count}회 이상 응시하기"[:20],
        f"{weak_subject} 문제 풀기"[:20],
        practical_text[:20],
        f"오답노트 {wrong_note_count}문항 복습"[:20],
    ]


def _validate_ranking_learning_recommendations(
    payload: list[Any],
    fallback: list[str],
) -> list[str]:
    items = []
    blocked_words = ("복습했다", "먼저 풀었다", "반복 학습했다", "저장", "저장 활용", "0%")
    for item in payload[:4]:
        text = " ".join(str(item or "").split())
        if not text or any(word in text for word in blocked_words):
            continue
        items.append(_normalize_learning_recommendation(text))
    return items if len(items) == 4 else fallback


def _bedrock_ranking_learning_recommendations(pattern: dict[str, Any]) -> list[str]:
    fallback = _fallback_ranking_learning_recommendations(pattern)
    system_prompt = "당신은 KB Masters의 AI 학습 추천 코치입니다."
    user_prompt = (
        "상위권 학습자들의 학습 패턴과 사용자의 취약 과목을 분석하여\n"
        "실천 가능한 학습 추천을 작성하세요.\n\n"
        "규칙\n\n"
        "- 정확히 4개 작성\n"
        "- 각 항목은 20자 이내\n"
        "- 명사형보다 행동 중심 문구 사용\n"
        "- DB에 있는 수치는 필요할 때만 사용\n"
        "- 모든 숫자는 소수점 없이 정수로 표현\n"
        "- DB에서 확인할 수 없는 내용 작성 금지\n"
        "- \"저장\", \"저장 활용\" 표현 금지\n"
        "- \"0%\", \"100%\"처럼 수치만 강조하는 문구 금지\n"
        "- 실무형 비율이 낮으면 \"실무형 판단 연습\", \"상황형 문제 보강\"처럼 행동으로 표현\n"
        "- 오답노트 저장 수는 \"오답노트 N문항 복습\" 또는 \"오답 N문항 재풀이\"로 표현\n"
        "- \"복습했다\", \"먼저 풀었다\", \"반복 학습했다\" 등의 표현 금지\n"
        "- 추천 문구만 출력\n"
        "- JSON 배열만 출력\n\n"
        "출력 예시\n\n"
        "[\n"
        "  \"주 3회 이상 응시\",\n"
        "  \"Cloud 문제 늘리기\",\n"
        "  \"실무형 판단 연습\",\n"
        "  \"오답노트 45문항 복습\"\n"
        "]\n\n"
        "나쁜 예시\n\n"
        "[\n"
        "  \"실무형 0%\",\n"
        "  \"오답노트 저장 활용\",\n"
        "  \"450개 저장\",\n"
        "  \"복습했다\"\n"
        "]\n\n"
        "데이터\n"
        + json.dumps(
            {
                "avgExamCount": int(float(pattern["avg_exam_count"] or 0)),
                "avgSubjectCount": int(float(pattern["avg_subject_count"] or 0)),
                "avgPracticalRate": int(float(pattern["avg_practical_rate"] or 0)),
                "avgWrongNoteSavedCount": int(float(pattern["avg_wrong_note_saved_count"] or 0)),
                "weakSubject": _compact_ranking_subject_name(pattern["weak_subject"]),
                "weakSubjectScore": int(float(pattern["weak_subject_score"] or 0)),
            },
            ensure_ascii=False,
        )
    )
    try:
        raw = bedrock_client.invoke(system_prompt, user_prompt, max_tokens=180)
        return _validate_ranking_learning_recommendations(_extract_json_array(raw), fallback)
    except Exception:
        return fallback


def _compact_analysis_headline(value: str) -> str:
    text = " ".join(str(value or "").replace("…", "").split()).rstrip(".。!?！？")
    if len(text) <= 15:
        return text
    return "강점 유지"


def _compact_analysis_comment(value: str) -> str:
    text = " ".join(str(value or "").replace("…", "").split())
    if len(text) <= 60:
        return text
    sentences = []
    for chunk in text.replace("!", ".").replace("?", ".").split("."):
        sentence = chunk.strip()
        if sentence:
            sentences.append(sentence)
    compact = ". ".join(sentences[:2])
    if compact:
        compact = compact.rstrip(".") + "."
    if len(compact) <= 60:
        return compact
    return "강점 과목은 유지하고 취약 과목은 핵심 개념부터 보완하세요."


def _build_analysis_comment_report(
    comment: str,
    details: dict[str, str],
    min_length: int = 350,
    max_length: int = 1200,
) -> str:
    text = _truncate_commentary_sentence(comment, max_length)
    detail_text = " ".join(value for value in details.values() if value)
    if len(text) >= min_length:
        return text
    merged = " ".join(part for part in [text, detail_text] if part).strip()
    if len(merged) >= min_length:
        return _truncate_commentary_sentence(merged, max_length)
    supplement = (
        "강점으로 확인된 과목은 현재 학습 흐름을 유지하되, 정답률이 낮은 과목은 기본 개념과 자주 틀린 단원을 먼저 다시 정리하는 것이 좋습니다. "
        "최근 점수 추이와 실무형·이론형 정답률 차이를 함께 보면서 어느 유형에서 판단이 흔들리는지 확인하세요. "
        "다음 학습에서는 취약 단원 개념을 짧게 복습한 뒤 맞춤 문제를 풀고, 틀린 문항은 오답노트로 다시 점검하는 순서가 효과적입니다."
    )
    separator = "\n\n" if merged else ""
    return _truncate_commentary_sentence(f"{merged}{separator}{supplement}", max_length)


def _validate_analysis_weakness(payload: dict[str, Any]) -> dict[str, str]:
    analysis1 = _truncate_commentary_sentence(str(payload.get("analysis1") or ""), 60)
    analysis2 = _truncate_commentary_sentence(str(payload.get("analysis2") or ""), 60)
    if not analysis1:
        analysis1 = "오답이 집중된 유형부터 원인을 점검해야 합니다."
    if not analysis2:
        analysis2 = "취약 단원 개념을 복습한 뒤 맞춤 문제를 풀어보세요."
    return {"analysis1": analysis1, "analysis2": analysis2}


def _fallback_analysis_weakness_commentary(payload: dict[str, Any]) -> dict[str, str]:
    weak_type = payload.get("weakQuestionType") or "오답 유형"
    weak_unit = payload.get("weakUnit") or "취약 단원"
    weak_unit_label = weak_unit if len(str(weak_unit)) <= 18 else "취약 단원"
    return {
        "analysis1": f"{weak_type} 오답 비율이 높아 원인 점검이 필요합니다.",
        "analysis2": f"{weak_unit_label} 중심으로 개념 복습과 재풀이를 진행하세요.",
    }


def _bedrock_analysis_weakness(payload: dict[str, Any], include_commentary: bool = True) -> dict[str, str]:
    fallback = _fallback_analysis_weakness_commentary(payload)
    if not include_commentary:
        return fallback

    system_prompt = (
        "당신은 KB Masters의 AI 학습 코치입니다. "
        "사용자의 취약 과목과 오답 패턴을 분석하여 취약 영역 분석 결과를 작성합니다. "
        "입력 데이터에 없는 사실은 추측하지 않습니다. 반드시 JSON만 출력합니다."
    )
    user_prompt = (
        "작성 규칙\n"
        "1. analysis1은 취약 원인과 오답 집중 유형을 설명한다.\n"
        "2. analysis2는 우선 학습 행동을 제안한다.\n"
        "3. 각 값은 1문장으로 작성한다.\n"
        "4. 각 문장은 45자 이내로 작성한다.\n"
        "5. 과목명은 길면 subjectCode를 사용한다.\n"
        "6. 점수를 단순 나열하지 않는다.\n"
        "7. 입력 데이터에 없는 사실은 추측하지 않는다.\n"
        "8. JSON만 반환한다.\n"
        "9. 마크다운 코드블록을 사용하지 않는다.\n\n"
        f"입력 데이터\n{json.dumps(payload, ensure_ascii=False, indent=2)}\n\n"
        "출력 형식\n"
        "{\n"
        '  "analysis1": "",\n'
        '  "analysis2": ""\n'
        "}"
    )
    try:
        raw = bedrock_client.invoke(system_prompt, user_prompt, max_tokens=500)
        return _validate_analysis_weakness(_extract_json_object(raw))
    except Exception:
        return fallback


def _fallback_modal_keyword(value: Any) -> str:
    weak_minor_units = {"도입 효과", "개요", "활용 사례", "정의", "특징"}
    if isinstance(value, dict):
        major = str(value.get("majorUnit") or value.get("major_unit") or "").strip()
        minor = str(value.get("minorUnit") or value.get("minor_unit") or value.get("keyword") or "").strip()
        minor = re.sub(r"^SECTION\s*\d+\.\s*", "", minor, flags=re.IGNORECASE).strip()
        minor = re.sub(r"^Chapter\s*\d+\.\s*", "", minor, flags=re.IGNORECASE).strip()
        minor = re.sub(r"^\d+\.\s*", "", minor).strip()
        text = major if minor in weak_minor_units and major else minor or major
    else:
        text = str(value or "").strip()
    if not text:
        return "미분류"
    text = re.sub(r"^SECTION\s*\d+\.\s*", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"^Chapter\s*\d+\.\s*", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"^\d+\.\s*", "", text).strip()
    replacements = (
        ("하이브리드 및 멀티 클라우드", "하이브리드 클라우드"),
        ("하이브리드 및 멀티클라우드", "하이브리드 클라우드"),
        ("에 대한 이해", ""),
        ("이해하기", ""),
        ("의 종류 및 정형 데이터와의 비교", ""),
        ("의 이해", ""),
        ("개요 및 활용법", ""),
        ("개요", ""),
    )
    for source, target in replacements:
        text = text.replace(source, target)
    text = re.sub(r"\s+", " ", text).strip(" -_/")
    if len(text) > 15:
        words = text.split()
        take = 3 if len(words) >= 3 and words[1] in {"및", "와", "과", "또는"} else 2
        compact = " ".join(words[:take]) if len(words) >= 2 else text[:15]
        compact = re.sub(r"\s+(및|와|과|또는)$", "", compact).strip()
        text = compact if len(compact) <= 15 else text[:15]
    return text or "미분류"


def _unique_modal_keywords(values: list[Any]) -> list[str]:
    keywords: list[str] = []
    seen: set[str] = set()
    for value in values:
        keyword = _fallback_modal_keyword(value)
        if keyword in seen:
            continue
        seen.add(keyword)
        keywords.append(keyword)
        if len(keywords) >= 3:
            break
    return keywords


def _validate_modal_keywords(payload: dict[str, Any], fallback: dict[str, list[str]]) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for key in ("strengths", "weaknesses"):
        values = payload.get(key)
        if not isinstance(values, list):
            result[key] = fallback[key]
            continue
        keywords: list[str] = []
        seen: set[str] = set()
        for index, fallback_keyword in enumerate(fallback[key]):
            keyword = str(values[index] or "").strip() if index < len(values) else ""
            if len(keyword) < 2 or keyword in seen or len(keyword) > 15:
                keyword = fallback_keyword
            if keyword in seen:
                continue
            seen.add(keyword)
            keywords.append(keyword)
        result[key] = keywords or fallback[key]
    return result


def _apply_modal_keywords(items: list[dict[str, Any]], keywords: list[str]) -> None:
    for index, item in enumerate(items):
        keyword = str(keywords[index] or "").strip() if index < len(keywords) else ""
        item["keyword"] = keyword or _fallback_modal_keyword(item)


def _fallback_result_radar_label(value: dict[str, Any]) -> str:
    current = str(value.get("current_label") or "").strip()
    major = str(value.get("major_unit") or "").strip()
    label = _fallback_modal_keyword({
        "major_unit": current or major,
        "minor_unit": "",
    })
    label = re.sub(r"\([^)]*$", "", label).strip()
    return label or "미분류"


def _validate_result_radar_labels(payload: Any, inputs: list[dict[str, Any]]) -> dict[str, str]:
    if not isinstance(payload, list):
        return {}

    result: dict[str, str] = {}
    seen: set[str] = set()
    by_index = {int(item["index"]): item for item in inputs}
    for item in payload:
        if not isinstance(item, dict):
            continue
        try:
            index = int(item.get("index"))
        except (TypeError, ValueError):
            continue
        source = by_index.get(index)
        if not source:
            continue
        label = str(item.get("label") or "").strip()
        if len(label) < 2 or len(label) > 15 or label in seen:
            continue
        seen.add(label)
        result[source["key"]] = label
    return result


def _bedrock_result_radar_labels(inputs: list[dict[str, Any]]) -> dict[str, str]:
    uncached = [item for item in inputs if item["key"] not in _RESULT_RADAR_LABEL_CACHE]
    if not uncached:
        return {item["key"]: _RESULT_RADAR_LABEL_CACHE[item["key"]] for item in inputs}

    fallback = {item["key"]: _fallback_result_radar_label(item) for item in uncached}
    system_prompt = "당신은 KB Masters의 AI 역량 분석기입니다."
    prompt_items = [
        {
            "index": index,
            "major_unit": item.get("major_unit") or "",
            "minor_unit": item.get("minor_unit") or "",
            "current_label": item.get("current_label") or "",
        }
        for index, item in enumerate(uncached)
    ]
    indexed_inputs = [
        {
            **item,
            "index": index,
        }
        for index, item in enumerate(uncached)
    ]
    user_prompt = (
        "입력된 진단리포트 레이더 축 후보를\n"
        "사용자 화면에 표시할 짧은 학습 영역 라벨로 변환하세요.\n\n"
        "규칙\n\n"
        "1. SECTION, Chapter, 번호, 점(.) 문구는 제거한다.\n"
        "2. 핵심 의미를 유지한다.\n"
        "3. 구현, 이론, 실무, 운영, 설계, 보안, 평가, 튜닝 등\n"
        "   학습 영역을 구분하는 단어는 유지한다.\n"
        "4. 서로 다른 학습 영역을 하나로 합치지 않는다.\n"
        "5. 레이더 축은 major_unit 또는 current_label 기준으로 만든다.\n"
        "6. minor_unit은 의미 파악용 참고 정보로만 사용하고,\n"
        "   같은 Chapter를 여러 축으로 나누지 않는다.\n"
        "7. 출력 라벨은 2~15자 이내.\n"
        "8. 설명문 작성 금지.\n"
        "9. 중복 라벨 생성 금지.\n\n"
        "예시\n\n"
        "입력\n"
        "major_unit: 클라우드 보안\n"
        "minor_unit: 도입 효과\n\n"
        "출력\n"
        "클라우드 보안\n\n"
        "입력\n"
        "major_unit: 클라우드\n"
        "minor_unit: 클라우드 실무\n\n"
        "출력\n"
        "클라우드 실무\n\n"
        f"입력 데이터\n{json.dumps(prompt_items, ensure_ascii=False, indent=2)}\n\n"
        "JSON 배열로 반환\n"
        '[{"index":0,"label":"라벨"}]'
    )

    try:
        raw = bedrock_client.invoke(system_prompt, user_prompt, max_tokens=400)
        normalized = _validate_result_radar_labels(_extract_json_array(raw), indexed_inputs)
    except Exception:
        normalized = {}

    for item in uncached:
        _RESULT_RADAR_LABEL_CACHE[item["key"]] = normalized.get(item["key"]) or fallback[item["key"]]
    return {item["key"]: _RESULT_RADAR_LABEL_CACHE[item["key"]] for item in inputs}


def _bedrock_modal_keywords(
    strengths: list[dict[str, Any]],
    weaknesses: list[dict[str, Any]],
    include_commentary: bool = True,
) -> dict[str, list[str]]:
    strength_units = [
        {
            "major_unit": item.get("majorUnit") or "",
            "minor_unit": item.get("minorUnit") or item.get("sourceKeyword") or item.get("keyword") or "",
        }
        for item in strengths
    ]
    weakness_units = [
        {
            "major_unit": item.get("majorUnit") or "",
            "minor_unit": item.get("minorUnit") or item.get("sourceKeyword") or item.get("keyword") or "",
        }
        for item in weaknesses
    ]
    fallback = {
        "strengths": _unique_modal_keywords(strength_units),
        "weaknesses": _unique_modal_keywords(weakness_units),
    }
    if not include_commentary:
        return fallback

    system_prompt = "당신은 KB Masters의 AI 역량 분석기입니다."
    payload = {
        "strengths": strength_units,
        "weaknesses": weakness_units,
    }
    user_prompt = (
        "입력된 강점 영역과 취약 영역을\n"
        "사용자 화면에 표시할 분석 키워드로 변환하세요.\n\n"
        "규칙\n\n"
        "1. SECTION 번호는 제거된 상태이다.\n"
        "2. 핵심 의미를 유지한다.\n"
        "3. 구현, 이론, 실무, 운영, 설계, 보안, 평가, 튜닝 등\n"
        "   학습 영역을 구분하는 단어는 유지한다.\n"
        "4. 서로 다른 학습 영역을 하나로 합치지 않는다.\n"
        "5. minor_unit이 충분히 의미를 가지면 minor_unit을 사용한다.\n"
        "6. minor_unit이 \"도입 효과\", \"개요\", \"활용 사례\",\n"
        "   \"정의\", \"특징\" 처럼 의미가 약한 경우에는\n"
        "   major_unit을 사용한다.\n"
        "7. 출력은 2~15자 이내.\n"
        "8. 설명문 작성 금지.\n"
        "9. 중복 키워드 생성 금지.\n\n"
        "예시\n\n"
        "입력\n"
        "major_unit: 클라우드 보안\n"
        "minor_unit: 도입 효과\n\n"
        "출력\n"
        "클라우드 보안\n\n"
        "입력\n"
        "major_unit: 클라우드\n"
        "minor_unit: 클라우드 실무\n\n"
        "출력\n"
        "클라우드 실무\n\n"
        "입력\n"
        "major_unit: 머신러닝\n"
        "minor_unit: 회귀모델에 대한 이해\n\n"
        "출력\n"
        "회귀모델\n\n"
        f"입력 데이터\n{json.dumps(payload, ensure_ascii=False, indent=2)}\n\n"
        "JSON 형식으로 반환\n"
        "{\n"
        '  "strengths":[\n'
        '    "",\n'
        '    "",\n'
        '    ""\n'
        "  ],\n"
        '  "weaknesses":[\n'
        '    "",\n'
        '    "",\n'
        '    ""\n'
        "  ]\n"
        "}"
    )
    try:
        raw = bedrock_client.invoke(system_prompt, user_prompt, max_tokens=220)
        return _validate_modal_keywords(_extract_json_object(raw), fallback)
    except Exception:
        return fallback


def _fallback_modal_comment(payload: dict[str, Any]) -> str:
    subject_name = str(payload.get("subjectName") or "이 과목")
    strengths = payload.get("strengths") if isinstance(payload.get("strengths"), list) else []
    weaknesses = payload.get("weaknesses") if isinstance(payload.get("weaknesses"), list) else []
    strength = str((strengths[0] or {}).get("keyword") or "기본 개념") if strengths else "기본 개념"
    weak_labels = [
        str(item.get("keyword") or "").strip()
        for item in weaknesses[:2]
        if str(item.get("keyword") or "").strip()
    ]
    weak_text = ", ".join(weak_labels) if weak_labels else "취약 영역"
    return _complete_commentary_sentences(
        f"{subject_name}에서는 {strength}에서 강점이 보입니다. 보완할 영역은 {weak_text}입니다. 지금 흐름을 유지하며 쉬운 문제부터 다시 풀면 점수를 안정적으로 올릴 수 있어요.",
        120,
    )


def _bedrock_modal_comment(payload: dict[str, Any], include_commentary: bool = True) -> str:
    fallback = _fallback_modal_comment(payload)
    if not include_commentary:
        return fallback

    system_prompt = "당신은 KB Masters의 AI 학습 코치입니다."
    user_prompt = (
        "사용자의 과목 분석 결과를 바탕으로\n"
        "개인 맞춤형 코멘트를 작성하세요.\n\n"
        "규칙\n\n"
        "- 2~3개의 완결된 문장\n"
        "- 전체 120자 이내\n"
        "- 긍정적인 어조\n"
        "- 강점 1개, 취약 영역 1개, 학습 행동 1개만 언급\n"
        "- 점수와 정답률 수치는 최대 1개만 사용\n"
        "- 괄호를 사용한 수치 나열 금지\n"
        "- 모든 문장은 반드시 마침표로 끝냄\n"
        "- 길이가 초과되면 마지막 문장 전체를 제거\n"
        "- 문장이나 단어를 중간에서 자르지 않음\n"
        "- 과장 금지\n"
        "- 한국어\n\n"
        "출력은 순수 텍스트만 반환\n\n"
        f"입력 데이터\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )
    try:
        raw = bedrock_client.invoke(system_prompt, user_prompt, max_tokens=220)
        text = str(raw or "").strip().strip('"')
        return _complete_commentary_sentences(text, 120) or fallback
    except Exception:
        return fallback


def _parse_diagnosis_content(value: Any) -> tuple[str | None, dict[str, str] | None]:
    if not value:
        return None, None
    if isinstance(value, dict):
        payload = value
    else:
        text = str(value).strip()
        if not text:
            return None, None
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            return text, None

    if isinstance(payload, dict) and {"overall", "strength", "weakness", "strategy"}.issubset(payload):
        commentary = _validate_result_commentary(payload)
        return commentary["overall"], commentary
    return str(value), None


def _created_at(row: dict[str, Any]) -> str:
    exam_date = str(row.get("exam_date") or "").strip()
    exam_time = str(row.get("exam_time") or "").strip()
    if len(exam_date) == 8:
        date = f"{exam_date[:4]}-{exam_date[4:6]}-{exam_date[6:8]}"
        time = exam_time if exam_time else "00:00"
        if len(time) == 5:
            time = f"{time}:00"
        return f"{date}T{time}"
    return row.get("exam_created_at") or row.get("created_at") or ""


def _as_browser_datetime(value: Any) -> str:
    if not value:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value).replace(" ", "T", 1)


def _choices_from_row(row: dict[str, Any]) -> list[str]:
    return [
        choice
        for choice in [
            row.get("option_1"),
            row.get("option_2"),
            row.get("option_3"),
            row.get("option_4"),
            row.get("option_5"),
        ]
        if choice
    ]


def _choice_text(choices: list[str], number: int | None) -> str:
    if number is None or number < 1 or number > len(choices):
        return ""
    return choices[number - 1]


def _build_diagnosis(items: list[dict[str, Any]], diagnosis_content: str | None) -> dict[str, Any]:
    summary, commentary = _parse_diagnosis_content(diagnosis_content)
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        buckets[item["questionType"] or "이론형"].append(item)

    axes = []
    for name, rows in buckets.items():
        total = len(rows)
        correct = sum(1 for row in rows if row["correct"])
        axes.append(
            {
                "name": f"{name} 문항",
                "score": round((correct / total) * 100) if total else 0,
                "correct": correct,
                "total": total,
            }
        )

    radar_buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        area = item.get("diagnosisArea") or "미분류"
        radar_buckets[area].append(item)

    radar_axes = []
    for name, rows in radar_buckets.items():
        total = len(rows)
        correct = sum(1 for row in rows if row["correct"])
        radar_axes.append(
            {
                "name": name,
                "score": round((correct / total) * 100) if total else 0,
                "correct": correct,
                "total": total,
            }
        )

    return {
        "axes": axes,
        "radarAxes": radar_axes,
        "summary": summary or "진단 내용이 아직 없습니다.",
        "commentary": commentary,
    }


def save_exam_result(member_id: str, subject_code: str, answers: list[dict[str, Any]]) -> dict[str, Any]:
    normalized_member_id = member_id.strip()
    normalized_subject_code = subject_code.strip()
    question_ids = [str(answer["question_id"]).strip() for answer in answers]
    selected_by_question = {
        str(answer["question_id"]).strip(): answer.get("selected_number")
        for answer in answers
    }

    if not normalized_member_id:
        raise HTTPException(status_code=400, detail="member_id is required")
    if not normalized_subject_code:
        raise HTTPException(status_code=400, detail="subject_code is required")
    if any(not question_id for question_id in question_ids):
        raise HTTPException(status_code=400, detail="question_id is required")

    now = datetime.now()
    exam_date = now.strftime("%Y%m%d")
    exam_time = now.strftime("%H:%M:%S")
    created_at = now.strftime("%Y-%m-%d %H:%M:%S")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT question_id, answer_number
                FROM question_tb
                WHERE subject_code = %s
                  AND question_id = ANY(%s)
                """,
                (normalized_subject_code, question_ids),
            )
            question_rows = cur.fetchall()

            answer_by_question = {
                str(row["question_id"]): _to_int(row["answer_number"])
                for row in question_rows
            }
            missing_question_ids = [
                question_id for question_id in question_ids
                if question_id not in answer_by_question
            ]
            if missing_question_ids:
                raise HTTPException(
                    status_code=400,
                    detail=f"유효하지 않은 question_id가 있습니다: {', '.join(missing_question_ids)}",
                )

            cur.execute(
                """
                SELECT LPAD((COALESCE(MAX(exam_id::integer), 0) + 1)::text, 8, '0') AS next_exam_id
                FROM exam_tb
                WHERE exam_id ~ '^[0-9]+$'
                """
            )
            next_exam_id = str(cur.fetchone()["next_exam_id"] or "00000001")

            cur.execute(
                """
                SELECT COALESCE(MAX(RIGHT(exam_question_id, 4)::integer), 0) AS last_exam_question_seq
                FROM exam_history_tb
                WHERE exam_question_id ~ '^[0-9]{12}$'
                  AND LEFT(exam_question_id, 8) = %s
                """,
                (exam_date,),
            )
            last_exam_question_seq = int(cur.fetchone()["last_exam_question_seq"] or 0)

            correct_count = 0
            history_rows = []
            for index, question_id in enumerate(question_ids, start=1):
                selected = _to_int(selected_by_question.get(question_id))
                answer_number = answer_by_question[question_id]
                is_correct = selected == answer_number
                if is_correct:
                    correct_count += 1
                history_rows.append(
                    (
                        f"{exam_date}{last_exam_question_seq + index:04d}",
                        question_id,
                        normalized_subject_code,
                        str(selected) if selected is not None else None,
                        str(answer_number) if answer_number is not None else None,
                        "Y" if is_correct else "N",
                        created_at,
                    )
                )

            total = len(question_ids)
            score = round((correct_count / total) * 100) if total else 0

            cur.execute(
                """
                SELECT COALESCE(MAX(exam_round), 0) + 1 AS next_round
                FROM (
                    SELECT
                        CASE
                            WHEN exam_round ~ '^[0-9]+$' THEN exam_round::integer
                            ELSE NULL
                        END AS exam_round
                    FROM exam_tb
                    WHERE member_id = %s
                      AND subject_code = %s
                      AND exam_date = %s
                ) rounds
                """,
                (normalized_member_id, normalized_subject_code, exam_date),
            )
            next_round = int(cur.fetchone()["next_round"] or 1)

            cur.execute(
                """
                INSERT INTO exam_tb (
                    exam_id, member_id, subject_code, exam_date, exam_time,
                    exam_round, exam_score, diagnosis_content, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING exam_id
                """,
                (
                    next_exam_id,
                    normalized_member_id,
                    normalized_subject_code,
                    exam_date,
                    exam_time,
                    str(next_round),
                    str(score),
                    None,
                    created_at,
                ),
            )
            exam_id = str(cur.fetchone()["exam_id"])

            exam_question_ids = [history_row[0] for history_row in history_rows]
            cur.executemany(
                """
                INSERT INTO exam_history_tb (
                    exam_question_id, exam_id, question_id, subject_code,
                    selected_number, answer_number, is_correct, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                [(history_row[0], exam_id, *history_row[1:]) for history_row in history_rows],
            )

    _clear_analysis_cache(normalized_member_id)
    return {
        "examId": exam_id,
        "attemptId": exam_id,
        "memberId": normalized_member_id,
        "questionIds": question_ids,
        "examHistoryIds": exam_question_ids,
        "roundTitle": f"{next_round}회차",
        "score": score,
        "correctCount": correct_count,
        "total": len(question_ids),
        "createdAt": now.isoformat(),
    }


def _fallback_analysis_commentary(summary: dict[str, Any], subject_stats: list[dict[str, Any]]) -> list[str]:
    if not subject_stats:
        return ["아직 응시 기록이 없습니다. 모의고사를 한 번 완료하면 과목별 분석과 추천 문제가 생성됩니다."]

    best = max(subject_stats, key=lambda item: item["score"])
    weak = min(subject_stats, key=lambda item: item["score"])
    avg_score = summary["averageScore"]
    return [
        f"전체 평균은 {avg_score}점이며 총 {summary['examCount']}회 응시, {summary['answeredTotal']}문항을 풀이했습니다.",
        f"가장 안정적인 과목은 {best['subjectName']}({best['score']}점)입니다. 현재 강점은 유지하면서 풀이 속도와 실수를 함께 점검하세요.",
        f"우선 보완할 과목은 {weak['subjectName']}({weak['score']}점)입니다. 오답이 반복된 단원과 유형을 중심으로 짧게 재풀이하는 방식이 좋습니다.",
        "실무형 문항은 상황 조건을 먼저 표시하고, 이론형 문항은 핵심 개념과 보기 간 차이를 비교하며 복습하세요.",
    ]


def _bedrock_analysis_commentary(summary: dict[str, Any], subject_stats: list[dict[str, Any]], type_stats: list[dict[str, Any]]) -> list[str]:
    if not subject_stats:
        return _fallback_analysis_commentary(summary, subject_stats)

    system_prompt = (
        "당신은 KB 디지털 역량진단 CBT 학습 코치입니다. "
        "응시자의 DB 기반 풀이 통계를 보고 한국어로 짧고 구체적인 AI총평을 작성합니다. "
        "과장하지 말고, 점수와 취약 과목을 근거로 3~4문장만 출력하세요. "
        "과목을 언급할 때는 subjectStats의 subjectName 값을 그대로 사용하세요."
    )
    user_prompt = (
        "다음 JSON 통계를 바탕으로 AI총평을 작성하세요.\n"
        f"summary={summary}\n"
        f"subjectStats={subject_stats}\n"
        f"typeStats={type_stats}\n"
        "출력은 번호 없는 문장 목록으로만 작성하세요."
    )

    try:
        return _parse_bedrock_commentary(bedrock_client.invoke(system_prompt, user_prompt, max_tokens=700))
    except Exception:
        return _fallback_analysis_commentary(summary, subject_stats)


def _fallback_analysis_ai_summary(summary: dict[str, Any], subject_stats: list[dict[str, Any]]) -> dict[str, Any]:
    attempted_subject_stats = [item for item in subject_stats if int(item.get("answered") or 0) > 0]
    if not attempted_subject_stats:
        return {
            "aiOverview": {
                "headline": "아직 종합평가를 만들 응시 기록이 충분하지 않습니다.",
                "comment": "모의고사를 완료하면 과목별 강점과 보완 영역을 분석해 드릴게요.",
            },
            "aiComment": {
                "comment": "응시 기록이 쌓이면 강점 과목과 취약 유형을 더 정확히 확인할 수 있습니다. 먼저 한 과목 이상 응시한 뒤 종합평가를 확인해 보세요.",
                "strengthAnalysis": "",
                "weaknessCause": "",
                "trendInsight": "",
                "nextAction": "",
            },
            "aiCommentary": ["응시 기록이 쌓이면 강점 과목과 취약 유형을 더 정확히 확인할 수 있습니다. 먼저 한 과목 이상 응시한 뒤 종합평가를 확인해 보세요."],
        }

    best = max(attempted_subject_stats, key=lambda item: item["score"])
    weak = min(attempted_subject_stats, key=lambda item: item["score"])
    total_score = summary.get("totalScore") or summary.get("averageScore") or 0
    average_score = summary.get("overallAverageScore") or 0
    percentile = summary.get("percentileTop") or 0
    comparison = "전체 평균보다 안정적인" if total_score >= average_score else "보완이 필요한"
    position = f"상위 {percentile}%" if percentile else "현재 흐름"
    best_code = best.get("subjectCode") or best.get("subjectName")
    weak_code = weak.get("subjectCode") or weak.get("subjectName")
    fallback_comment = (
        f"{best['subjectName']}은 정답 흐름이 비교적 안정적으로 나타나 강점으로 볼 수 있습니다. "
        f"반면 {weak['subjectName']}은 보완 우선순위가 높아 오답 단원과 문제 유형을 함께 점검해야 합니다. "
        "최근 점수 흐름을 확인하면서 실무형·이론형 중 흔들리는 유형을 먼저 정리하고, 짧은 개념 복습 후 맞춤 문제로 이해도를 확인하세요."
    )
    return {
        "aiOverview": {
            "headline": f"{comparison} 성과입니다.",
            "comment": (
                f"{best_code}는 강점, {weak_code}는 보완점입니다. "
                f"{position} 기준으로 핵심 복습과 맞춤 문제를 병행하세요."
            ),
        },
        "aiComment": {
            "comment": fallback_comment,
            "strengthAnalysis": f"{best['subjectName']}은 정답 흐름이 비교적 안정적으로 나타나 강점으로 볼 수 있습니다.",
            "weaknessCause": f"{weak['subjectName']}은 보완 우선순위가 높아 오답 단원과 문제 유형을 함께 점검해야 합니다.",
            "trendInsight": "최근 점수 흐름과 실무형·이론형 정답률을 함께 보면 흔들리는 유형을 더 정확히 찾을 수 있습니다.",
            "nextAction": "짧은 개념 복습 후 맞춤 문제로 이해도를 확인하고, 반복 오답 단원을 우선 재풀이하세요.",
        },
        "aiCommentary": [fallback_comment],
    }


def _validate_analysis_ai_summary(payload: dict[str, Any]) -> dict[str, Any]:
    overview = payload.get("aiOverview") if isinstance(payload.get("aiOverview"), dict) else payload
    ai_comment = payload.get("aiComment") if isinstance(payload.get("aiComment"), dict) else {}
    comments = payload.get("aiCommentary") or payload.get("comments") or []
    headline = _compact_analysis_headline(str(overview.get("headline") or ""))
    comment = _compact_analysis_comment(str(overview.get("comment") or ""))
    detail_keys = ("strengthAnalysis", "weaknessCause", "trendInsight", "nextAction")
    details = {
        key: _truncate_commentary_sentence(str(ai_comment.get(key) or ""), 500)
        for key in detail_keys
    }
    report_comment = str(ai_comment.get("comment") or payload.get("comment") or "").strip()
    if not headline or not comment:
        raise ValueError("headline and comment are required")
    if not report_comment:
        detail_text = " ".join(value for value in details.values() if value)
        if detail_text:
            report_comment = detail_text
        elif isinstance(comments, list):
            report_comment = " ".join(str(item).strip() for item in comments if str(item or "").strip())
        else:
            report_comment = str(comments or "").strip()
        report_comment = _truncate_commentary_sentence(report_comment, 1200)
    if not report_comment:
        raise ValueError("ai comment is required")
    report_comment = _build_analysis_comment_report(report_comment, details)
    return {
        "aiOverview": {
            "headline": headline,
            "comment": comment,
        },
        "aiComment": {
            "comment": report_comment,
            **details,
        },
        "aiCommentary": [report_comment],
    }


def _bedrock_analysis_ai_summary(
    summary: dict[str, Any],
    subject_stats: list[dict[str, Any]],
    type_stats: list[dict[str, Any]],
    unit_stats: list[dict[str, Any]],
    exam_trend: list[dict[str, Any]],
) -> dict[str, Any]:
    fallback = _fallback_analysis_ai_summary(summary, subject_stats)
    attempted_subject_stats = [item for item in subject_stats if int(item.get("answered") or 0) > 0]
    if not attempted_subject_stats:
        return fallback

    system_prompt = (
        "당신은 KB Masters의 AI 학습 코치입니다. "
        "사용자의 시험 결과, 과목별 성적, 응시 이력, 오답 패턴을 분석하여 학습 총평과 코멘트를 작성합니다. "
        "입력 데이터에 없는 사실은 추측하지 않습니다. 반드시 JSON만 출력합니다."
    )
    payload = {
        "summary": summary,
        "subjectStats": subject_stats,
        "attemptedSubjectStats": attempted_subject_stats,
        "strongSubjectStats": sorted(attempted_subject_stats, key=lambda item: item.get("score", 0), reverse=True)[:3],
        "weakSubjectStats": sorted(attempted_subject_stats, key=lambda item: item.get("score", 0))[:3],
        "unattemptedSubjectStats": [item for item in subject_stats if int(item.get("answered") or 0) == 0],
        "typeStats": type_stats,
        "wrongTypeStats": [
            {
                "type": item.get("type"),
                "answered": item.get("answered"),
                "correct": item.get("correct"),
                "wrong": item.get("wrong"),
                "score": item.get("score"),
            }
            for item in type_stats
        ],
        "weakUnitStats": unit_stats[:5],
        "scoreSpread": {
            "highestSubject": max(attempted_subject_stats, key=lambda item: item.get("score", 0), default=None),
            "lowestSubject": min(attempted_subject_stats, key=lambda item: item.get("score", 0), default=None),
        },
        "recentScoreTrend": [
            {
                "roundTitle": item.get("roundTitle"),
                "subjectName": item.get("subjectName"),
                "score": item.get("score"),
                "scoreDelta": item.get("scoreDelta"),
                "createdAt": item.get("createdAt"),
            }
            for item in exam_trend[-5:]
        ],
    }
    user_prompt = (
        "AI 총평(aiOverview) 작성 규칙\n"
        "1. headline은 15자 이내로 작성\n"
        "2. comment는 최대 2문장으로 작성\n"
        "3. comment는 60자 이내로 작성\n"
        "4. 강점 과목을 반드시 언급\n"
        "5. 취약 과목을 반드시 언급\n"
        "6. 전체 평균 또는 백분위 정보를 반영\n"
        "7. 점수를 단순 나열하지 않음\n"
        "8. 과도한 칭찬 금지\n"
        "9. 줄바꿈 없이 작성\n"
        "10. 자연스럽고 긍정적인 어조 사용\n"
        "11. aiOverview는 JSON 객체 안의 headline, comment에만 작성\n\n"
        "AI 코멘트 작성 규칙\n"
        "1. aiComment는 comment, strengthAnalysis, weaknessCause, trendInsight, nextAction을 모두 작성\n"
        "2. strengthAnalysis는 강점 과목과 안정적인 이유를 2문장으로 작성\n"
        "3. weaknessCause는 취약 과목, 취약 단원, 오답 유형을 연결해 원인을 2~3문장으로 분석\n"
        "4. trendInsight는 최근 점수 추이와 실무형/이론형 정답률 차이를 함께 반영해 2문장으로 작성\n"
        "5. nextAction은 다음 학습 행동을 구체적으로 2~3문장으로 제안\n"
        "6. 점수를 단순 나열하지 않음\n"
        "7. 과도한 칭찬 금지\n"
        "8. 제공된 실제 학습 데이터만 근거로 분석\n"
        "9. 근거 없는 추측 금지\n"
        "10. aiComment.comment는 위 4개 세부 내용을 자연스럽게 합친 6~9문장 리포트로 작성\n"
        "11. aiComment.comment는 최소 350자 이상, 최대 900자 이하로 작성\n"
        "12. 사용자를 격려하는 긍정적인 어조 사용\n"
        "13. JSON 외 텍스트를 출력하지 않음\n"
        "14. 마크다운 코드블록 사용 금지\n"
        "15. 각 값은 문자열만 사용\n\n"
        "16. AI 총평의 문장과 같은 표현을 반복하지 않음\n"
        "17. 현재 수준 요약보다 원인 분석과 다음 행동 제안에 집중\n"
        "18. 오답 유형, 최근 점수 추이, 실무형/이론형 정답률 중 최소 2개 근거를 활용\n"
        "19. 강점·취약점·최근 변화·다음 학습 행동이 모두 드러나게 작성\n"
        "20. AI 총평은 결론 중심, AI 코멘트는 근거·원인·행동 중심으로 차별화\n\n"
        "21. 모든 문장은 완결된 문장으로 끝내며 단어 중간에서 끊지 않음\n"
        "22. 문장을 줄여야 하면 마지막 문장 전체를 제거하고, 말줄임표를 사용하지 않음\n\n"
        "23. comment에는 강점, 취약 원인, 최근 추이, 실무형·이론형 차이, 다음 행동을 각각 최소 1문장씩 포함\n"
        "24. 데이터가 부족한 항목은 부족하다고 설명하되 학습 행동 제안으로 보완\n"
        "25. comment는 2~3개 문단으로 나누고 문단 사이는 반드시 \\n\\n으로 구분\n\n"
        f"입력 데이터\n{json.dumps(payload, ensure_ascii=False, indent=2)}\n\n"
        "출력 형식\n"
        "{\n"
        '  "aiOverview": {\n'
        '    "headline": "",\n'
        '    "comment": ""\n'
        "  },\n"
        '  "aiComment": {\n'
        '    "comment": "",\n'
        '    "strengthAnalysis": "",\n'
        '    "weaknessCause": "",\n'
        '    "trendInsight": "",\n'
        '    "nextAction": ""\n'
        "  }\n"
        "}"
    )

    try:
        raw = bedrock_client.invoke(system_prompt, user_prompt, max_tokens=1400)
        return _validate_analysis_ai_summary(_extract_json_object(raw))
    except Exception:
        return fallback


def _weakness_key(row: dict[str, Any]) -> tuple[str, str, str, str]:
    subject_code = str(row["subject_code"])
    subject_name = str(row["subject_name"] or row["subject_description"] or subject_code)
    major_unit = str(row["major_unit"] or "미분류 단원")
    return subject_code, subject_name, major_unit, _question_type(row)


def _build_ai_recommendation_prompt(
    member_name: str,
    weakness: dict[str, Any],
    examples: list[dict[str, Any]],
) -> tuple[str, str]:
    target_type = weakness["questionType"]
    scenario_rule = (
        "실무형 문제이므로 scenario를 1~3문장으로 작성하고, 실제 업무 상황 판단이 필요하도록 만드세요."
        if target_type == "실무형"
        else "이론형 문제이므로 scenario는 빈 문자열로 두고, 개념·정의·목적·차이를 묻는 질문으로 만드세요."
    )
    system_prompt = (
        "당신은 KB 디지털 역량진단 CBT의 AI 맞춤형 문제 생성 Agent입니다. "
        "사용자의 실제 오답 이력을 근거로 부족한 부분을 판단하고, 해당 약점을 보완할 5지선다 문제 1개를 생성합니다. "
        "이론형과 실무형은 사용자의 취약 유형에 맞춰 분배합니다. "
        "기존 문제를 복사하거나 보기만 바꾸지 말고, 같은 개념을 새 문항으로 재구성하세요. "
        "정답은 반드시 하나여야 하며, 보기 5개는 모두 완전한 문장이어야 합니다. "
        "JSON 객체 하나만 출력하세요."
    )
    payload = {
        "memberName": member_name,
        "weakness": weakness,
        "wrongExamples": examples,
    }
    user_prompt = (
        "다음 사용자의 오답 이력을 바탕으로 AI 맞춤형 추천문제 1개를 생성하세요.\n"
        f"{json.dumps(payload, ensure_ascii=False)}\n\n"
        "생성 규칙:\n"
        f"- 대상 과목은 {weakness['subjectName']}입니다.\n"
        f"- 대상 단원은 {weakness['majorUnit']}입니다.\n"
        f"- 대상 유형은 {target_type}입니다.\n"
        f"- {scenario_rule}\n"
        "- question은 1문장으로 작성하세요.\n"
        "- choices는 정확히 5개입니다.\n"
        "- answer는 1~5 사이 정수입니다.\n"
        "- explanation은 정답 근거와 오답이 틀린 핵심 이유를 짧게 설명하세요.\n"
        "- reason은 사용자의 어떤 부분이 부족해 보여서 이 문제를 냈는지 한 줄로 작성하세요.\n"
        "- source_summary에는 어떤 오답 이력을 근거로 삼았는지 요약하세요.\n\n"
        "출력 JSON 형식:\n"
        "{\n"
        '  "reason": "AI Engineering의 모델 평가 단원에서 실무형 판단이 부족해 보여요.",\n'
        '  "question_type": "이론형",\n'
        '  "question": "문제 질문",\n'
        '  "scenario": "",\n'
        '  "choices": ["보기 1", "보기 2", "보기 3", "보기 4", "보기 5"],\n'
        '  "answer": 1,\n'
        '  "difficulty": "medium",\n'
        '  "tags": ["태그"],\n'
        '  "source_summary": "오답 이력 근거 요약",\n'
        '  "explanation": "해설"\n'
        "}"
    )
    return system_prompt, user_prompt


def _normalize_ai_question(obj: dict[str, Any], weakness: dict[str, Any]) -> dict[str, Any]:
    choices = obj.get("choices")
    if not isinstance(choices, list):
        raise ValueError("choices must be a list")
    choices = [str(choice).strip() for choice in choices if str(choice or "").strip()]
    if len(choices) != 5:
        raise ValueError("choices must contain exactly 5 items")

    answer = _to_int(obj.get("answer"))
    if answer is None or answer < 1 or answer > 5:
        raise ValueError("answer must be between 1 and 5")

    question = str(obj.get("question") or "").strip()
    if not question:
        raise ValueError("question is required")

    return {
        "subjectCode": weakness["subjectCode"],
        "subjectName": weakness["subjectName"],
        "majorUnit": weakness["majorUnit"],
        "minorUnit": weakness.get("minorUnit") or "-",
        "questionType": str(obj.get("question_type") or weakness["questionType"]),
        "questionText": question,
        "questionScenario": str(obj.get("scenario") or "").strip(),
        "choices": choices,
        "answer": answer,
        "difficulty": str(obj.get("difficulty") or "medium"),
        "tags": obj.get("tags") if isinstance(obj.get("tags"), list) else [],
        "sourceSummary": str(obj.get("source_summary") or "").strip(),
        "explanation": str(obj.get("explanation") or "").strip(),
    }


def get_ai_recommendation(member_id: str) -> dict[str, Any]:
    normalized_member_id = member_id.strip()
    if not normalized_member_id:
        raise HTTPException(status_code=400, detail="member_id is required")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT COALESCE(member_name, member_id) AS member_name
                FROM member_tb
                WHERE member_id = %s
                LIMIT 1
                """,
                (normalized_member_id,),
            )
            member = cur.fetchone()
            if member is None:
                raise HTTPException(status_code=404, detail="Member not found")

            cur.execute(
                """
                SELECT
                    e.exam_id,
                    e.exam_date,
                    e.exam_time,
                    e.created_at AS exam_created_at,
                    s.subject_code,
                    s.subject_name,
                    s.subject_description,
                    q.question_id,
                    q.major_unit,
                    q.minor_unit,
                    q.question_content,
                    q.question_content2,
                    q.option_1,
                    q.option_2,
                    q.option_3,
                    q.option_4,
                    q.option_5,
                    q.answer_number,
                    q.explanation,
                    h.selected_number
                FROM exam_tb e
                JOIN subject_tb s ON s.subject_code = e.subject_code
                JOIN exam_history_tb h ON h.exam_id = e.exam_id
                JOIN question_tb q
                    ON q.question_id = h.question_id
                   AND q.subject_code = e.subject_code
                WHERE e.member_id = %s
                ORDER BY e.exam_date DESC, e.exam_time DESC, e.exam_id DESC, h.exam_question_id
                LIMIT 120
                """,
                (normalized_member_id,),
            )
            rows = cur.fetchall()

    if not rows:
        return {
            "status": "NO_HISTORY",
            "message": "아직 풀이 기록이 없어 AI 맞춤형 추천문제를 만들지 않았습니다.",
            "reason": "",
            "weakness": None,
            "question": None,
        }

    wrong_rows = [
        row for row in rows
        if _to_int(row["selected_number"]) != _to_int(row["answer_number"])
    ]
    if not wrong_rows:
        return {
            "status": "NO_WEAKNESS",
            "message": "최근 풀이 기록에서 뚜렷한 오답 약점이 없어 AI 맞춤형 추천문제를 만들지 않았습니다.",
            "reason": "",
            "weakness": None,
            "question": None,
        }

    grouped: dict[tuple[str, str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in wrong_rows:
        grouped[_weakness_key(row)].append(row)

    weak_key, weak_rows = max(
        grouped.items(),
        key=lambda item: (len(item[1]), item[1][0]["exam_date"] or "", item[1][0]["exam_time"] or ""),
    )
    subject_code, subject_name, major_unit, question_type = weak_key
    minor_units = [
        str(row["minor_unit"])
        for row in weak_rows
        if row.get("minor_unit")
    ]
    minor_unit = minor_units[0] if minor_units else "-"
    weakness = {
        "subjectCode": subject_code,
        "subjectName": subject_name,
        "majorUnit": major_unit,
        "minorUnit": minor_unit,
        "questionType": question_type,
        "wrongCount": len(weak_rows),
        "totalWrongCount": len(wrong_rows),
    }
    reason = f"{subject_name}의 {major_unit} 영역에서 {question_type} 오답이 반복되어 보강이 필요해 보여요."

    examples = []
    for row in weak_rows[:6]:
        choices = _choices_from_row(row)
        selected_number = _to_int(row["selected_number"])
        answer_number = _to_int(row["answer_number"])
        examples.append(
            {
                "question": _question_text(row),
                "scenario": _question_scenario(row),
                "choices": choices,
                "selectedNumber": selected_number,
                "selectedChoice": _choice_text(choices, selected_number),
                "answerNumber": answer_number,
                "answerChoice": _choice_text(choices, answer_number),
                "explanation": str(row.get("explanation") or "")[:700],
            }
        )

    system_prompt, user_prompt = _build_ai_recommendation_prompt(
        member_name=str(member["member_name"]),
        weakness=weakness,
        examples=examples,
    )

    try:
        raw = bedrock_client.invoke(system_prompt, user_prompt, max_tokens=1800)
        parsed = question_parser.extract_json(raw)
        question = _normalize_ai_question(parsed, weakness)
        return {
            "status": "READY",
            "message": "AI 맞춤형 추천문제가 준비되었습니다.",
            "reason": str(parsed.get("reason") or reason).strip(),
            "weakness": weakness,
            "question": question,
        }
    except Exception as exc:
        return {
            "status": "FAILED",
            "message": "AI 맞춤형 추천문제를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.",
            "reason": reason,
            "weakness": weakness,
            "question": None,
            "error": str(exc),
        }


def get_analysis(member_id: str, include_commentary: bool = True) -> dict[str, Any]:
    normalized_member_id = member_id.strip()
    if not normalized_member_id:
        raise HTTPException(status_code=400, detail="member_id is required")
    now = datetime.now()
    cache_key = f"{normalized_member_id}:{'commentary' if include_commentary else 'stats'}"
    cached = _ANALYSIS_CACHE.get(cache_key)
    if cached and cached.get("expires_at") and now < cached["expires_at"]:
        return cached["data"]

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT COALESCE(member_name, member_id) AS member_name
                FROM member_tb
                WHERE member_id = %s
                LIMIT 1
                """,
                (normalized_member_id,),
            )
            member = cur.fetchone()
            if member is None:
                raise HTTPException(status_code=404, detail="Member not found")

            cur.execute(
                """
                SELECT
                    e.exam_id,
                    e.exam_round,
                    e.exam_score,
                    e.exam_date,
                    e.exam_time,
                    e.created_at AS exam_created_at,
                    s.subject_code,
                    COALESCE(s.subject_name, s.subject_description, s.subject_code) AS subject_name,
                    CASE
                        WHEN COALESCE(BTRIM(q.question_content2), '') <> '' THEN '실무형'
                        ELSE '이론형'
                    END AS question_type,
                    COALESCE(NULLIF(q.major_unit, ''), '미분류') AS unit,
                    CASE
                        WHEN h.selected_number::text ~ '^[0-9]+$'
                         AND q.answer_number::text ~ '^[0-9]+$'
                         AND h.selected_number::integer = q.answer_number::integer
                        THEN TRUE ELSE FALSE
                    END AS is_correct,
                    COALESCE(e.created_at, e.exam_date || 'T' || COALESCE(e.exam_time, '00:00:00')) AS latest_exam_at
                FROM exam_tb e
                JOIN subject_tb s ON s.subject_code = e.subject_code
                JOIN exam_history_tb h ON h.exam_id = e.exam_id
                JOIN question_tb q
                    ON q.question_id = h.question_id
                   AND q.subject_code = e.subject_code
                WHERE e.member_id = %s
                ORDER BY e.exam_date, e.exam_time, e.exam_id, h.exam_question_id
                """,
                (normalized_member_id,),
            )
            analysis_rows = cur.fetchall()

            cur.execute(
                """
                SELECT COUNT(DISTINCT exam_id) AS exam_count
                FROM exam_tb
                WHERE member_id = %s
                """,
                (normalized_member_id,),
            )
            exam_count = int(cur.fetchone()["exam_count"] or 0)

            cur.execute(
                """
                SELECT ROUND(AVG(exam_score::numeric)) AS overall_average_score
                FROM exam_tb
                WHERE exam_score IS NOT NULL
                  AND exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                """
            )
            overall_average_score = int(cur.fetchone()["overall_average_score"] or 0)

            cur.execute(
                """
                SELECT
                    member_id,
                    AVG(exam_score::numeric) AS average_score
                FROM exam_tb
                WHERE exam_score IS NOT NULL
                  AND exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                GROUP BY member_id
                """
            )
            member_score_rows = cur.fetchall()

            cur.execute(
                """
                SELECT
                    subject_code,
                    COALESCE(subject_name, subject_description, subject_code) AS subject_name
                FROM subject_tb
                ORDER BY subject_code
                """
            )
            subject_rows = cur.fetchall()

            cur.execute(
                """
                SELECT
                    e.subject_code,
                    ROUND(
                        COUNT(h.exam_question_id) FILTER (
                            WHERE h.selected_number::text ~ '^[0-9]+$'
                              AND q.answer_number::text ~ '^[0-9]+$'
                              AND h.selected_number::integer = q.answer_number::integer
                        )::numeric
                        / NULLIF(COUNT(h.exam_question_id), 0)
                        * 100
                    ) AS average_score
                FROM exam_tb e
                JOIN exam_history_tb h ON h.exam_id = e.exam_id
                JOIN question_tb q
                    ON q.question_id = h.question_id
                   AND q.subject_code = e.subject_code
                GROUP BY e.subject_code
                """
            )
            subject_average_rows = cur.fetchall()

            cur.execute(
                """
                WITH member_subject_avg AS (
                    SELECT
                        member_id,
                        subject_code,
                        ROUND(AVG(CAST(exam_score AS DECIMAL(5,2))), 1) AS avg_score,
                        COUNT(*) AS exam_count
                    FROM exam_tb
                    WHERE exam_score IS NOT NULL
                      AND exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                    GROUP BY member_id, subject_code
                ),
                ranked AS (
                    SELECT
                        member_id,
                        subject_code,
                        avg_score,
                        exam_count,
                        RANK() OVER (
                            PARTITION BY subject_code
                            ORDER BY avg_score DESC
                        ) AS rank_no,
                        COUNT(*) OVER (PARTITION BY subject_code) AS total_member_count
                    FROM member_subject_avg
                ),
                subject_avg AS (
                    SELECT
                        subject_code,
                        ROUND(AVG(CAST(exam_score AS DECIMAL(5,2))), 1) AS total_avg_score
                    FROM exam_tb
                    WHERE exam_score IS NOT NULL
                      AND exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                    GROUP BY subject_code
                )
                SELECT
                    r.subject_code,
                    subj.subject_name,
                    r.avg_score AS my_score,
                    s.total_avg_score AS total_avg_score,
                    r.exam_count AS exam_count,
                    r.rank_no,
                    r.total_member_count,
                    ROUND((r.rank_no::numeric / NULLIF(r.total_member_count, 0)) * 100, 0) AS top_percent,
                    CASE
                        WHEN r.avg_score >= 90 OR ROUND((r.rank_no::numeric / NULLIF(r.total_member_count, 0)) * 100, 0) <= 15
                            THEN '우수'
                        WHEN r.avg_score >= 80 OR ROUND((r.rank_no::numeric / NULLIF(r.total_member_count, 0)) * 100, 0) <= 30
                            THEN '양호'
                        WHEN r.avg_score >= 70 OR ROUND((r.rank_no::numeric / NULLIF(r.total_member_count, 0)) * 100, 0) <= 50
                            THEN '보통'
                        ELSE '보완 필요'
                    END AS grade_badge,
                    CASE
                        WHEN r.avg_score >= 90 OR ROUND((r.rank_no::numeric / NULLIF(r.total_member_count, 0)) * 100, 0) <= 15
                            THEN CONCAT(subj.subject_name, ' 역량이 매우 우수해요!')
                        WHEN r.avg_score >= 80 OR ROUND((r.rank_no::numeric / NULLIF(r.total_member_count, 0)) * 100, 0) <= 30
                            THEN CONCAT(subj.subject_name, ' 역량이 안정적이에요!')
                        WHEN r.avg_score >= 70 OR ROUND((r.rank_no::numeric / NULLIF(r.total_member_count, 0)) * 100, 0) <= 50
                            THEN CONCAT(subj.subject_name, ' 기본기가 갖춰져 있어요!')
                        ELSE CONCAT(subj.subject_name, ' 보완 학습이 필요해요!')
                    END AS summary_title
                FROM ranked r
                JOIN subject_avg s
                  ON s.subject_code = r.subject_code
                JOIN subject_tb subj
                  ON subj.subject_code = r.subject_code
                WHERE r.member_id = %s
                """,
                (normalized_member_id,),
            )
            subject_summary_rows = cur.fetchall()

            cur.execute(
                """
                SELECT
                    e.subject_code,
                    CASE
                        WHEN COALESCE(q.question_type, '') LIKE '%%실무%%'
                          OR COALESCE(BTRIM(q.question_content2), '') <> '' THEN '실무형'
                        ELSE '이론형'
                    END AS question_type,
                    ROUND(
                        AVG(
                            CASE
                                WHEN h.selected_number::text ~ '^[0-9]+$'
                                  AND q.answer_number::text ~ '^[0-9]+$'
                                  AND h.selected_number::integer = q.answer_number::integer THEN 100
                                ELSE 0
                            END
                        ),
                        1
                    ) AS correct_rate
                FROM exam_history_tb h
                JOIN exam_tb e
                  ON h.exam_id = e.exam_id
                JOIN question_tb q
                  ON h.question_id = q.question_id
                 AND q.subject_code = e.subject_code
                WHERE e.member_id = %s
                GROUP BY
                    e.subject_code,
                    CASE
                        WHEN COALESCE(q.question_type, '') LIKE '%%실무%%'
                          OR COALESCE(BTRIM(q.question_content2), '') <> '' THEN '실무형'
                        ELSE '이론형'
                    END
                """,
                (normalized_member_id,),
            )
            subject_detail_rows = cur.fetchall()

            cur.execute(
                """
                WITH ranked_exam AS (
                    SELECT
                        subject_code,
                        exam_round,
                        CAST(exam_score AS DECIMAL(5,2)) AS exam_score,
                        exam_date,
                        exam_time,
                        created_at,
                        ROW_NUMBER() OVER (
                            PARTITION BY subject_code
                            ORDER BY
                                exam_date DESC NULLS LAST,
                                exam_time DESC NULLS LAST,
                                created_at DESC NULLS LAST,
                                exam_id DESC
                        ) AS row_no
                    FROM exam_tb
                    WHERE member_id = %s
                      AND exam_score IS NOT NULL
                      AND exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                )
                SELECT subject_code, exam_round, exam_score, exam_date
                FROM ranked_exam
                WHERE row_no <= 5
                ORDER BY subject_code, row_no DESC
                """,
                (normalized_member_id,),
            )
            subject_trend_rows = cur.fetchall()

            cur.execute(
                """
                WITH unit_rates AS (
                    SELECT
                        e.subject_code,
                        COALESCE(NULLIF(q.major_unit, ''), '미분류') AS major_unit,
                        TRIM(
                            REGEXP_REPLACE(
                                REGEXP_REPLACE(
                                    COALESCE(NULLIF(q.minor_unit, ''), '미분류'),
                                    '^SECTION[[:space:]]*[0-9]+\\.[[:space:]]*',
                                    ''
                                ),
                                '^[0-9]+\\.[[:space:]]*',
                                ''
                            )
                        ) AS minor_unit,
                        ROUND(
                            AVG(
                                CASE
                                    WHEN h.is_correct = 'Y' THEN 100
                                    ELSE 0
                                END
                            ),
                            1
                        ) AS correct_rate,
                        COUNT(*) AS answer_count
                    FROM exam_history_tb h
                    JOIN exam_tb e
                      ON h.exam_id = e.exam_id
                    JOIN question_tb q
                      ON h.question_id = q.question_id
                     AND q.subject_code = e.subject_code
                    WHERE e.member_id = %s
                    GROUP BY e.subject_code, q.major_unit, q.minor_unit
                    HAVING COUNT(*) >= 2
                ),
                strong_units AS (
                    SELECT
                        subject_code,
                        major_unit,
                        minor_unit,
                        correct_rate,
                        ROW_NUMBER() OVER (
                            PARTITION BY subject_code
                            ORDER BY correct_rate DESC, answer_count DESC, major_unit, minor_unit
                        ) AS row_no
                    FROM unit_rates
                    WHERE correct_rate > 0
                ),
                weak_units AS (
                    SELECT
                        u.subject_code,
                        u.major_unit,
                        u.minor_unit,
                        u.correct_rate,
                        ROW_NUMBER() OVER (
                            PARTITION BY u.subject_code
                            ORDER BY u.correct_rate ASC, u.answer_count DESC, u.major_unit, u.minor_unit
                        ) AS row_no
                    FROM unit_rates u
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM strong_units s
                        WHERE s.subject_code = u.subject_code
                          AND s.row_no <= 3
                          AND s.major_unit IS NOT DISTINCT FROM u.major_unit
                          AND s.minor_unit IS NOT DISTINCT FROM u.minor_unit
                    )
                )
                SELECT 'strong' AS list_type, subject_code, major_unit, minor_unit, correct_rate, row_no
                FROM strong_units
                WHERE row_no <= 3
                UNION ALL
                SELECT 'weak' AS list_type, subject_code, major_unit, minor_unit, correct_rate, row_no
                FROM weak_units
                WHERE row_no <= 3
                ORDER BY subject_code, list_type, row_no
                """,
                (normalized_member_id,),
            )
            subject_unit_rows = cur.fetchall()

            cur.execute(
                """
                WITH unit_stats AS (
                    SELECT
                        q.subject_code,
                        CASE
                            WHEN q.subject_code = 'AI' THEN 'AI'
                            WHEN q.subject_code = 'CA' THEN 'Cloud'
                            WHEN q.subject_code = 'DE' THEN 'Data'
                            WHEN q.subject_code = 'CD' THEN 'Cloud Dev'
                            WHEN q.subject_code = 'SA' THEN 'SW'
                            ELSE COALESCE(s.subject_name, q.subject_code)
                        END AS subject_name,
                        q.minor_unit,
                        TRIM(
                            REGEXP_REPLACE(
                                SPLIT_PART(
                                    REPLACE(
                                        REPLACE(
                                            REGEXP_REPLACE(
                                                COALESCE(NULLIF(q.minor_unit, ''), '미분류'),
                                                '^SECTION [0-9]+\\.\\s*',
                                                ''
                                            ),
                                            '의 이해',
                                            ''
                                        ),
                                        '개요 및 활용법',
                                        ''
                                    ),
                                    '/',
                                    1
                                ),
                                '^[0-9]+\\.\\s*',
                                ''
                            )
                        ) AS display_keyword,
                        COUNT(*) AS total_count,
                        SUM(
                            CASE
                                WHEN h.is_correct = 'Y'
                                THEN 1
                                ELSE 0
                            END
                        ) AS correct_count,
                        ROUND(
                            SUM(
                                CASE
                                    WHEN h.is_correct = 'Y'
                                    THEN 1
                                    ELSE 0
                                END
                            )::numeric / NULLIF(COUNT(*), 0) * 100,
                            1
                        ) AS correct_rate
                    FROM exam_tb e
                    JOIN exam_history_tb h
                      ON e.exam_id = h.exam_id
                    JOIN question_tb q
                      ON h.question_id = q.question_id
                    LEFT JOIN subject_tb s
                      ON q.subject_code = s.subject_code
                    WHERE e.member_id = %s
                    GROUP BY q.subject_code, s.subject_name, q.minor_unit
                ),
                strong_unit AS (
                    SELECT
                        subject_code AS strong_subject_code,
                        subject_name AS strong_subject_name,
                        display_keyword AS strong_keyword
                    FROM unit_stats
                    WHERE total_count >= 2
                    ORDER BY correct_rate DESC, total_count DESC
                    LIMIT 1
                ),
                weak_unit AS (
                    SELECT
                        subject_code AS weak_subject_code,
                        subject_name AS weak_subject_name,
                        display_keyword AS weak_keyword
                    FROM unit_stats
                    WHERE total_count >= 2
                    ORDER BY correct_rate ASC, total_count DESC
                    LIMIT 1
                )
                SELECT
                    strong_unit.strong_subject_code,
                    strong_unit.strong_subject_name,
                    strong_unit.strong_keyword,
                    weak_unit.weak_subject_code,
                    weak_unit.weak_subject_name,
                    weak_unit.weak_keyword
                FROM strong_unit
                CROSS JOIN weak_unit
                """,
                (normalized_member_id,),
            )
            strength_keyword_row = cur.fetchone()

    subject_map: dict[str, dict[str, Any]] = {}
    type_map: dict[str, dict[str, Any]] = {}
    subject_type_map: dict[tuple[str, str], dict[str, Any]] = {}
    unit_map: dict[tuple[str, str], dict[str, Any]] = {}
    exam_map: dict[str, dict[str, Any]] = {}

    for row in analysis_rows:
        exam_id = row["exam_id"]
        subject_code = row["subject_code"]
        subject_name = row["subject_name"] or subject_code
        question_type = row["question_type"]
        unit = row["unit"] or "미분류"
        is_correct = bool(row["is_correct"])
        latest_exam_at = row["latest_exam_at"] or ""

        exam = exam_map.setdefault(
            exam_id,
            {
                "examId": exam_id,
                "roundTitle": f"{row['exam_round']}회차" if row.get("exam_round") else "응시 결과",
                "subjectCode": subject_code,
                "subjectName": subject_name,
                "answered": 0,
                "correct": 0,
                "wrong": 0,
                "examDate": row.get("exam_date"),
                "examTime": row.get("exam_time"),
                "createdAt": _created_at(row),
            },
        )
        exam["answered"] += 1
        exam["correct"] += 1 if is_correct else 0
        exam["wrong"] += 0 if is_correct else 1

        subject = subject_map.setdefault(
            subject_code,
            {
                "subjectCode": subject_code,
                "subjectName": subject_name,
                "answered": 0,
                "correct": 0,
                "wrong": 0,
                "latestExamAt": "",
            },
        )
        subject["answered"] += 1
        subject["correct"] += 1 if is_correct else 0
        subject["wrong"] += 0 if is_correct else 1
        if latest_exam_at and str(latest_exam_at) > str(subject["latestExamAt"]):
            subject["latestExamAt"] = latest_exam_at

        type_stat = type_map.setdefault(question_type, {"type": question_type, "answered": 0, "correct": 0})
        type_stat["answered"] += 1
        type_stat["correct"] += 1 if is_correct else 0

        subject_type_stat = subject_type_map.setdefault(
            (subject_code, question_type),
            {"type": question_type, "answered": 0, "correct": 0},
        )
        subject_type_stat["answered"] += 1
        subject_type_stat["correct"] += 1 if is_correct else 0

        unit_stat = unit_map.setdefault(
            (subject_code, unit),
            {"subjectCode": subject_code, "subjectName": subject_name, "unit": unit, "answered": 0, "correct": 0},
        )
        unit_stat["answered"] += 1
        unit_stat["correct"] += 1 if is_correct else 0

    for row in subject_rows:
        subject_code = str(row["subject_code"])
        subject_map.setdefault(
            subject_code,
            {
                "subjectCode": subject_code,
                "subjectName": row["subject_name"] or subject_code,
                "answered": 0,
                "correct": 0,
                "wrong": 0,
                "latestExamAt": "",
            },
        )

    subject_order = {
        str(row["subject_code"]): index
        for index, row in enumerate(subject_rows)
    }
    subject_average_map = {
        str(row["subject_code"]): int(row["average_score"] or 0)
        for row in subject_average_rows
    }
    subject_summary_map = {
        str(row["subject_code"]): {
            "myScore": float(row["my_score"]) if row.get("my_score") is not None else None,
            "avgScore": float(row["total_avg_score"]) if row.get("total_avg_score") is not None else None,
            "totalAvgScore": float(row["total_avg_score"]) if row.get("total_avg_score") is not None else None,
            "examCount": int(row["exam_count"] or 0),
            "rankNo": int(row["rank_no"] or 0),
            "totalCount": int(row["total_member_count"] or 0),
            "totalMemberCount": int(row["total_member_count"] or 0),
            "percentile": int(row["top_percent"] or 0),
            "topPercent": int(row["top_percent"] or 0),
            "gradeBadge": row["grade_badge"] or "",
            "summaryTitle": row["summary_title"] or "",
        }
        for row in subject_summary_rows
    }
    subject_detail_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in subject_detail_rows:
        subject_detail_map[str(row["subject_code"])].append(
            {
                "questionType": row["question_type"] or "미분류",
                "correctRate": float(row["correct_rate"] or 0),
            }
        )
    subject_trend_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in subject_trend_rows:
        subject_trend_map[str(row["subject_code"])].append(
            {
                "examRound": row["exam_round"],
                "examScore": float(row["exam_score"] or 0),
                "examDate": row["exam_date"].isoformat() if hasattr(row["exam_date"], "isoformat") else row["exam_date"],
            }
        )
    subject_strong_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    subject_weak_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in subject_unit_rows:
        target_map = subject_strong_map if row["list_type"] == "strong" else subject_weak_map
        major_unit = row["major_unit"] or "미분류"
        minor_unit = row["minor_unit"] or major_unit
        target_map[str(row["subject_code"])].append(
            {
                "keyword": minor_unit,
                "sourceKeyword": minor_unit,
                "majorUnit": major_unit,
                "minorUnit": minor_unit,
                "correctRate": float(row["correct_rate"] or 0),
            }
        )
    for subject_code in set(subject_strong_map) | set(subject_weak_map):
        keyword_payload = _bedrock_modal_keywords(
            subject_strong_map.get(subject_code, []),
            subject_weak_map.get(subject_code, []),
            include_commentary=False,
        )
        _apply_modal_keywords(subject_strong_map.get(subject_code, []), keyword_payload["strengths"])
        _apply_modal_keywords(subject_weak_map.get(subject_code, []), keyword_payload["weaknesses"])
    subject_modal_ai_map: dict[str, dict[str, Any]] = {}
    for subject_code in set(subject_strong_map) | set(subject_weak_map) | set(subject_detail_map) | set(subject_trend_map):
        subject_item = subject_map.get(subject_code, {})
        modal_payload = {
            "subjectCode": subject_code,
            "subjectName": subject_item.get("subjectName") or subject_code,
            "summary": subject_summary_map.get(subject_code),
            "detail": subject_detail_map.get(subject_code, []),
            "trend": subject_trend_map.get(subject_code, []),
            "strengths": subject_strong_map.get(subject_code, []),
            "weaknesses": subject_weak_map.get(subject_code, []),
        }
        subject_modal_ai_map[subject_code] = {
            "comment": _bedrock_modal_comment(modal_payload, include_commentary=False),
        }
    subject_stats = []
    for item in subject_map.values():
        item["score"] = _score(item["correct"], item["answered"])
        item["accuracy"] = item["score"]
        item["overallAverageScore"] = subject_average_map.get(item["subjectCode"], 0)
        item["summary"] = subject_summary_map.get(item["subjectCode"])
        item["modal"] = {
            "detail": subject_detail_map.get(item["subjectCode"], []),
            "trend": subject_trend_map.get(item["subjectCode"], []),
            "strongUnits": subject_strong_map.get(item["subjectCode"], []),
            "weakUnits": subject_weak_map.get(item["subjectCode"], []),
            "comment": subject_modal_ai_map.get(item["subjectCode"], {}).get("comment"),
        }
        subject_stats.append(item)
    subject_stats.sort(key=lambda item: subject_order.get(item["subjectCode"], len(subject_order)))

    type_stats = []
    for item in type_map.values():
        item["score"] = _score(item["correct"], item["answered"])
        item["wrong"] = item["answered"] - item["correct"]
        type_stats.append(item)
    type_stats.sort(key=lambda item: item["type"])

    unit_stats = []
    for item in unit_map.values():
        item["score"] = _score(item["correct"], item["answered"])
        item["wrong"] = item["answered"] - item["correct"]
        unit_stats.append(item)
    unit_stats.sort(key=lambda item: (item["score"], -item["answered"]))

    exam_stats = []
    for item in exam_map.values():
        item["score"] = _score(item["correct"], item["answered"])
        exam_stats.append(item)
    exam_stats.sort(key=lambda item: str(item.get("createdAt") or ""))
    recent_exam_stats = exam_stats[-8:]
    previous_score = None
    for item in recent_exam_stats:
        item["scoreDelta"] = None if previous_score is None else item["score"] - previous_score
        previous_score = item["score"]

    best_exam = max(exam_stats, key=lambda item: item["score"], default=None)
    weakest_exam = min(exam_stats, key=lambda item: item["score"], default=None)

    answered_total = sum(item["answered"] for item in subject_stats)
    correct_total = sum(item["correct"] for item in subject_stats)
    latest_exam_at = max(
        (str(item.get("latestExamAt") or "") for item in subject_stats),
        default="",
    )
    summary = {
        "totalScore": _score(correct_total, answered_total),
        "memberId": normalized_member_id,
        "memberName": member["member_name"],
        "examCount": exam_count,
        "answeredTotal": answered_total,
        "correctTotal": correct_total,
        "wrongTotal": answered_total - correct_total,
        "averageScore": _score(correct_total, answered_total),
        "overallAverageScore": overall_average_score,
        "percentileTop": 0,
        "latestExamAt": latest_exam_at,
        "strengthKeywords": {
            "strongKeyword": strength_keyword_row["strong_keyword"],
            "weakKeyword": strength_keyword_row["weak_keyword"],
        } if strength_keyword_row else None,
    }

    if member_score_rows:
        score_values = [
            float(row["average_score"])
            for row in member_score_rows
            if row.get("average_score") is not None
        ]
        member_exam_score = next(
            (
                float(row["average_score"])
                for row in member_score_rows
                if str(row.get("member_id")) == normalized_member_id
                and row.get("average_score") is not None
            ),
            None,
        )
        user_score = summary["averageScore"] if answered_total else member_exam_score
        if score_values and user_score is not None:
            higher_count = sum(1 for score_value in score_values if score_value > float(user_score))
            summary["percentileTop"] = max(
                1,
                min(100, round(((higher_count + 1) / len(score_values)) * 100)),
            )

    recent_analysis_rows = list(analysis_rows)[-200:]
    wrong_recent_rows = [row for row in recent_analysis_rows if not bool(row["is_correct"])]
    target_recent_rows = wrong_recent_rows or recent_analysis_rows
    weak_area_map: dict[tuple[str, str], dict[str, Any]] = {}
    for row in target_recent_rows:
        subject_code = str(row["subject_code"] or "-")
        unit = str(row["unit"] or "미분류")
        area = weak_area_map.setdefault(
            (subject_code, unit),
            {
                "subjectCode": subject_code,
                "subjectName": row["subject_name"] or subject_code,
                "unit": unit,
                "questionType": row["question_type"],
                "totalCount": 0,
                "wrongCount": 0,
            },
        )
        area["totalCount"] += 1
        area["wrongCount"] += 0 if bool(row["is_correct"]) else 1

    weak_area = max(
        weak_area_map.values(),
        key=lambda item: (item["wrongCount"], item["totalCount"]),
        default=None,
    )
    weakness_analysis = None
    if weak_area:
        wrong_repeat_count = int(weak_area["wrongCount"] or 0)
        if wrong_repeat_count >= 5:
            priority = "높음"
        elif wrong_repeat_count >= 2:
            priority = "보통"
        else:
            priority = "낮음"
        weak_area_keyword = _fallback_modal_keyword({
            "majorUnit": weak_area["unit"],
            "minorUnit": weak_area["unit"],
        })
        weak_area_label = f"{weak_area['subjectCode']} · {weak_area_keyword}"
        analysis1 = (
            "최근 응시에서 해당 영역의 오답이 가장 많이 반복되었습니다."
            if wrong_repeat_count > 0
            else "최근 응시 이력을 기준으로 보완할 영역을 선정했습니다."
        )
        weakness_analysis = {
            "weakArea": weak_area_label,
            "subjectCode": weak_area["subjectCode"],
            "subjectName": weak_area["subjectName"],
            "weakKeyword": weak_area_keyword,
            "wrongRepeatCount": wrong_repeat_count,
            "priority": priority,
            "recommendBasis": "최근 오답 반복",
            "weakQuestionType": weak_area["questionType"],
            "weakUnit": weak_area["unit"],
            "analysis1": analysis1,
            "analysis2": "AI 맞춤형 추천문제는 이 영역을 기준으로 생성됩니다.",
        }

    ai_summary = (
        _bedrock_analysis_ai_summary(summary, subject_stats, type_stats, unit_stats, recent_exam_stats)
        if include_commentary
        else _fallback_analysis_ai_summary(summary, subject_stats)
    )

    result = {
        "summary": summary,
        "aiOverview": ai_summary["aiOverview"],
        "aiComment": ai_summary["aiComment"],
        "weaknessAnalysis": weakness_analysis,
        "subjectStats": subject_stats,
        "typeStats": type_stats,
        "unitStats": unit_stats[:8],
        "examTrend": recent_exam_stats,
        "examHighlights": {
            "bestExam": best_exam,
            "weakestExam": weakest_exam,
        },
        "commentary": ai_summary["aiCommentary"],
        "recommendations": [],
    }
    _ANALYSIS_CACHE[cache_key] = {
        "expires_at": now + timedelta(
            seconds=_ANALYSIS_COMMENTARY_CACHE_SECONDS if include_commentary else _ANALYSIS_CACHE_SECONDS
        ),
        "data": result,
    }
    return result


def get_analysis_commentary(member_id: str) -> dict[str, Any]:
    normalized_member_id = member_id.strip()
    if not normalized_member_id:
        raise HTTPException(status_code=400, detail="member_id is required")
    now = datetime.now()
    cache_key = f"{normalized_member_id}:commentary_only"
    cached = _ANALYSIS_CACHE.get(cache_key)
    if cached and cached.get("expires_at") and now < cached["expires_at"]:
        return cached["data"]

    analysis = get_analysis(normalized_member_id, include_commentary=True)
    result = {
        "aiOverview": analysis.get("aiOverview"),
        "aiComment": analysis.get("aiComment"),
        "commentary": analysis["commentary"],
    }
    _ANALYSIS_CACHE[cache_key] = {
        "expires_at": now + timedelta(seconds=_ANALYSIS_COMMENTARY_CACHE_SECONDS),
        "data": result,
    }
    return result


def get_analysis_subject_commentary(member_id: str, subject_code: str) -> dict[str, Any]:
    normalized_member_id = member_id.strip()
    normalized_subject_code = subject_code.strip()
    if not normalized_member_id:
        raise HTTPException(status_code=400, detail="member_id is required")
    if not normalized_subject_code:
        raise HTTPException(status_code=400, detail="subject_code is required")

    now = datetime.now()
    cache_key = f"{normalized_member_id}:subject_commentary:{normalized_subject_code}"
    cached = _ANALYSIS_CACHE.get(cache_key)
    if cached and cached.get("expires_at") and now < cached["expires_at"]:
        return cached["data"]

    analysis = get_analysis(normalized_member_id, include_commentary=False)
    subject = next(
        (
            item for item in analysis.get("subjectStats", [])
            if str(item.get("subjectCode") or "") == normalized_subject_code
        ),
        None,
    )
    if not subject:
        raise HTTPException(status_code=404, detail="Subject analysis not found")
    if int(subject.get("answered") or 0) <= 0:
        raise HTTPException(status_code=422, detail="NO_HISTORY")

    modal = subject.get("modal") if isinstance(subject.get("modal"), dict) else {}
    strengths = [dict(item) for item in modal.get("strongUnits", []) if isinstance(item, dict)]
    weaknesses = [dict(item) for item in modal.get("weakUnits", []) if isinstance(item, dict)]
    keyword_payload = _bedrock_modal_keywords(strengths, weaknesses, include_commentary=True)
    _apply_modal_keywords(strengths, keyword_payload["strengths"])
    _apply_modal_keywords(weaknesses, keyword_payload["weaknesses"])

    modal_payload = {
        "subjectCode": normalized_subject_code,
        "subjectName": subject.get("subjectName") or normalized_subject_code,
        "summary": subject.get("summary"),
        "detail": modal.get("detail", []),
        "trend": modal.get("trend", []),
        "strengths": strengths,
        "weaknesses": weaknesses,
    }
    result = {
        "subjectCode": normalized_subject_code,
        "subjectName": subject.get("subjectName") or normalized_subject_code,
        "comment": _bedrock_modal_comment(modal_payload, include_commentary=True),
        "strongUnits": strengths,
        "weakUnits": weaknesses,
    }
    _ANALYSIS_CACHE[cache_key] = {
        "expires_at": now + timedelta(seconds=_ANALYSIS_SUBJECT_COMMENTARY_CACHE_SECONDS),
        "data": result,
    }
    return result


def _build_result_commentary_prompt_data(
    attempt_id: str,
    exam_question_ids: list[str] | None = None,
) -> dict[str, Any]:
    history_filter = ""
    params: list[Any] = [attempt_id]
    if exam_question_ids:
        history_filter = "AND h.exam_question_id = ANY(%s)"
        params.append(exam_question_ids)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"""
                SELECT
                    e.exam_id,
                    e.member_id,
                    COALESCE(m.member_name, e.member_id) AS member_name,
                    e.subject_code,
                    COALESCE(s.subject_name, s.subject_description, e.subject_code) AS subject_name,
                    e.exam_date,
                    e.exam_round,
                    e.exam_score,
                    h.exam_question_id,
                    h.question_id,
                    h.selected_number,
                    h.answer_number,
                    h.is_correct,
                    COALESCE(NULLIF(TRIM(q.major_unit), ''), '미분류') AS area_name,
                    q.question_content,
                    q.question_content2,
                    q.explanation
                FROM exam_tb e
                JOIN member_tb m ON m.member_id = e.member_id
                JOIN subject_tb s ON s.subject_code = e.subject_code
                JOIN exam_history_tb h ON h.exam_id = e.exam_id
                JOIN question_tb q
                    ON q.question_id = h.question_id
                   AND q.subject_code = e.subject_code
                WHERE e.exam_id = %s
                  {history_filter}
                ORDER BY h.exam_question_id
                """,
                tuple(params),
            )
            rows = [dict(row) for row in cur.fetchall()]

    if not rows:
        raise HTTPException(status_code=404, detail="Result not found")

    first = rows[0]
    total_count = len(rows)
    correct_count = sum(1 for row in rows if str(row.get("is_correct") or "").upper() == "Y")
    wrong_count = total_count - correct_count
    score = _to_int(first.get("exam_score"))
    if score is None:
        score = _score(correct_count, total_count)

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[str(row.get("area_name") or "미분류")].append(row)

    area_scores = []
    for area_name, area_rows in grouped.items():
        area_total = len(area_rows)
        area_correct = sum(1 for row in area_rows if str(row.get("is_correct") or "").upper() == "Y")
        area_wrong = area_total - area_correct
        area_scores.append(
            {
                "areaName": area_name,
                "totalCount": area_total,
                "correctCount": area_correct,
                "wrongCount": area_wrong,
                "score": _score(area_correct, area_total),
            }
        )
    area_scores.sort(key=lambda item: (item["score"], -item["wrongCount"], item["areaName"]))

    wrong_questions = []
    for row in rows:
        if str(row.get("is_correct") or "").upper() != "N":
            continue
        question_parts = [
            str(row.get("question_content") or "").strip(),
            str(row.get("question_content2") or "").strip(),
        ]
        wrong_questions.append(
            {
                "areaName": row.get("area_name") or "미분류",
                "question": " ".join(part for part in question_parts if part)[:500],
                "selectedAnswer": row.get("selected_number"),
                "correctAnswer": row.get("answer_number"),
                "explanation": str(row.get("explanation") or "").strip()[:700],
            }
        )

    return {
        "examId": first["exam_id"],
        "memberId": first["member_id"],
        "memberName": first["member_name"],
        "subjectCode": first["subject_code"],
        "subjectName": first["subject_name"],
        "examDate": first["exam_date"],
        "examRound": first["exam_round"],
        "score": score,
        "passScore": 60,
        "passStatus": "합격" if score >= 60 else "불합격",
        "totalCount": total_count,
        "correctCount": correct_count,
        "wrongCount": wrong_count,
        "areaScores": area_scores,
        "wrongQuestions": wrong_questions[:8],
    }


def generate_result_commentary(
    attempt_id: str,
    exam_question_ids: list[str] | None = None,
) -> dict[str, Any]:
    result_data = _build_result_commentary_prompt_data(attempt_id, exam_question_ids)
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT diagnosis_content
                FROM exam_tb
                WHERE exam_id = %s
                  AND member_id = %s
                """,
                (attempt_id, result_data["memberId"]),
            )
            existing = cur.fetchone()
    existing_summary, existing_commentary = _parse_diagnosis_content(
        existing["diagnosis_content"] if existing else None
    )
    if existing_commentary:
        return {
            "examId": attempt_id,
            "memberId": result_data["memberId"],
            "diagnosisContent": existing_commentary,
        }

    user_prompt = RESULT_COMMENTARY_USER_PROMPT_TEMPLATE.replace(
        "{result_data}",
        json.dumps(result_data, ensure_ascii=False, indent=2),
    )

    try:
        raw = bedrock_client.invoke(
            RESULT_COMMENTARY_SYSTEM_PROMPT,
            user_prompt,
            max_tokens=1200,
        )
        commentary = _validate_result_commentary(_extract_json_object(raw))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to generate result commentary: {exc}") from exc

    diagnosis_content = json.dumps(commentary, ensure_ascii=False)
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE exam_tb
                SET diagnosis_content = %s
                WHERE exam_id = %s
                  AND member_id = %s
                RETURNING exam_id
                """,
                (diagnosis_content, attempt_id, result_data["memberId"]),
            )
            if cur.fetchone() is None:
                raise HTTPException(status_code=404, detail="Result not found")

    return {
        "examId": attempt_id,
        "memberId": result_data["memberId"],
        "diagnosisContent": commentary,
    }


def get_result(attempt_id: str, exam_question_ids: list[str] | None = None) -> dict[str, Any]:
    history_filter = ""
    params: tuple[Any, ...] = (attempt_id,)
    if exam_question_ids:
        history_filter = "AND h.exam_question_id = ANY(%s)"
        params = (attempt_id, exam_question_ids)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"""
                SELECT
                    e.exam_id,
                    e.exam_round,
                    e.exam_score,
                    e.exam_date,
                    e.exam_time,
                    e.diagnosis_content,
                    e.created_at AS exam_created_at,
                    m.member_id,
                    m.member_name,
                    s.subject_code,
                    s.subject_name,
                    s.subject_description,
                    h.exam_question_id,
                    h.selected_number,
                    h.answer_number AS selected_answer_number,
                    h.is_correct,
                    h.wrong_note_saved,
                    q.question_id,
                    q.major_unit,
                    TRIM(
                        REPLACE(
                            REPLACE(
                                regexp_replace(
                                    COALESCE(q.major_unit, ''),
                                    '^.*\\.',
                                    ''
                                ),
                                'SECTION ',
                                ''
                            ),
                            'Chapter ',
                            ''
                        )
                    ) AS radar_label,
                    q.minor_unit,
                    q.question_type,
                    q.question_content,
                    q.question_content2,
                    q.option_1,
                    q.option_2,
                    q.option_3,
                    q.option_4,
                    q.option_5,
                    q.answer_number,
                    q.explanation
                FROM exam_tb e
                JOIN member_tb m ON m.member_id = e.member_id
                JOIN subject_tb s ON s.subject_code = e.subject_code
                JOIN exam_history_tb h ON h.exam_id = e.exam_id
                JOIN question_tb q
                    ON q.question_id = h.question_id
                   AND q.subject_code = e.subject_code
                WHERE e.exam_id = %s
                  {history_filter}
                ORDER BY h.exam_question_id
                """,
                params,
            )
            rows = cur.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="Result not found")

    first = rows[0]
    radar_label_inputs = []
    seen_radar_keys: set[str] = set()
    for row in rows:
        radar_key = "\u001f".join([
            str(row.get("major_unit") or ""),
            str(row.get("radar_label") or ""),
        ])
        if radar_key in seen_radar_keys:
            continue
        seen_radar_keys.add(radar_key)
        radar_label_inputs.append(
            {
                "key": radar_key,
                "major_unit": row.get("major_unit") or "",
                "minor_unit": row.get("minor_unit") or "",
                "current_label": row.get("radar_label") or "",
            }
        )
    radar_label_map = _bedrock_result_radar_labels(radar_label_inputs) if radar_label_inputs else {}

    items = []
    for row in rows:
        selected = _to_int(row["selected_number"])
        answer = _to_int(row["answer_number"])
        radar_key = "\u001f".join([
            str(row.get("major_unit") or ""),
            str(row.get("radar_label") or ""),
        ])
        items.append(
            {
                "questionId": row["question_id"],
                "examHistoryId": row["exam_question_id"],
                "questionText": _question_text(row),
                "questionScenario": _question_scenario(row),
                "choices": [
                    row["option_1"],
                    row["option_2"],
                    row["option_3"],
                    row["option_4"],
                    row["option_5"],
                ],
                "difficulty": row["minor_unit"] or "-",
                "questionType": _question_type(row),
                "majorUnit": row["major_unit"] or "-",
                "diagnosisArea": radar_label_map.get(radar_key) or row["radar_label"] or row["major_unit"] or "-",
                "minorUnit": row["minor_unit"] or "-",
                "selected": selected,
                "answer": answer,
                "correct": selected == answer,
                "wrongNoteSaved": str(row["wrong_note_saved"] or "").upper() == "Y",
                "explanation": row["explanation"] or "",
            }
        )

    total = len(items)
    correct_count = sum(1 for item in items if item["correct"])
    score = round((correct_count / total) * 100) if total else 0

    return {
        "attemptId": first["exam_id"],
        "profileName": first["member_name"],
        "memberId": first["member_id"],
        "subjectId": first["subject_code"],
        "subjectName": first["subject_name"] or first["subject_description"],
        "roundTitle": f"{first['exam_round']}회차" if first["exam_round"] else "응시 결과",
        "score": score,
        "correctCount": correct_count,
        "total": total,
        "createdAt": first["exam_created_at"],
        "examDate": first["exam_date"],
        "examTime": first["exam_time"],
        "diagnosis": _build_diagnosis(items, first["diagnosis_content"]),
        "items": items,
    }


def get_latest_result(profile_name: str | None = None) -> dict[str, Any]:
    where_clause = "WHERE m.member_name = %s" if profile_name else ""
    params = (profile_name,) if profile_name else ()
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"""
                SELECT e.exam_id
                FROM exam_tb e
                JOIN member_tb m ON m.member_id = e.member_id
                {where_clause}
                ORDER BY
                    e.exam_date DESC NULLS LAST,
                    e.exam_time DESC NULLS LAST,
                    e.exam_round DESC NULLS LAST,
                    e.created_at DESC NULLS LAST,
                    e.exam_id DESC
                LIMIT 1
                """,
                params,
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Latest result not found")
    return get_result(row["exam_id"])


def get_exam_history(
    member_id: str,
    page: int = 1,
    page_size: int = 10,
    subject_code: str | None = None,
) -> dict[str, Any]:
    normalized_member_id = member_id.strip()
    if not normalized_member_id:
        raise HTTPException(status_code=400, detail="member_id is required")

    safe_page = max(1, page)
    safe_page_size = max(1, min(page_size, 50))
    offset = (safe_page - 1) * safe_page_size
    normalized_subject_code = (subject_code or "").strip()
    if normalized_subject_code.upper() == "ALL":
        normalized_subject_code = ""
    subject_filter = "AND e.subject_code = %s" if normalized_subject_code else ""
    filter_params: list[Any] = [normalized_member_id]
    if normalized_subject_code:
        filter_params.append(normalized_subject_code)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    s.subject_code,
                    COALESCE(s.subject_name, s.subject_description, s.subject_code) AS subject_name,
                    COUNT(e.exam_id) AS exam_count
                FROM subject_tb s
                LEFT JOIN exam_tb e
                  ON e.subject_code = s.subject_code
                 AND LOWER(e.member_id) = LOWER(%s)
                GROUP BY s.subject_code, s.subject_name, s.subject_description
                ORDER BY s.subject_code
                """,
                (normalized_member_id,),
            )
            subject_filters = [
                {
                    "subjectCode": row["subject_code"],
                    "subjectName": row["subject_name"],
                    "count": int(row["exam_count"] or 0),
                }
                for row in cur.fetchall()
            ]

            cur.execute(
                f"""
                WITH exam_scores AS (
                    SELECT
                        e.exam_id,
                        e.subject_code,
                        CASE
                            WHEN e.exam_score IS NOT NULL
                             AND e.exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                            THEN CAST(e.exam_score AS DECIMAL(5,2))
                            ELSE NULL
                        END AS score
                    FROM exam_tb e
                ),
                ranked_exam AS (
                    SELECT
                        es.exam_id,
                        CASE
                            WHEN es.score IS NULL THEN 100
                            ELSE LEAST(
                                100,
                                CEIL(
                                    (
                                        RANK() OVER (
                                            PARTITION BY es.subject_code
                                            ORDER BY es.score DESC NULLS LAST
                                        ) - 1
                                    ) * 100.0
                                    / NULLIF(
                                        COUNT(es.score) OVER (
                                            PARTITION BY es.subject_code
                                        ),
                                        0
                                    )
                                ) + 1
                            )
                        END AS percentile
                    FROM exam_scores es
                ),
                exam_base AS (
                    SELECT
                        e.exam_id,
                        e.exam_round,
                        e.exam_date,
                        e.exam_time,
                        e.created_at AS exam_created_at,
                        e.created_at,
                        s.subject_code,
                        COALESCE(s.subject_name, s.subject_description, s.subject_code) AS subject_name,
                        CASE
                            WHEN e.exam_score IS NOT NULL
                             AND e.exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                            THEN CAST(e.exam_score AS DECIMAL(5,2))
                            ELSE NULL
                        END AS score,
                        COUNT(h.exam_question_id) AS total,
                        COUNT(h.exam_question_id) FILTER (
                            WHERE h.selected_number::text ~ '^[0-9]+$'
                              AND q.answer_number::text ~ '^[0-9]+$'
                              AND h.selected_number::integer = q.answer_number::integer
                        ) AS correct_count,
                        ROUND(
                            COUNT(h.exam_question_id) FILTER (
                                WHERE COALESCE(q.question_type, '') LIKE '%%실무%%'
                                   OR COALESCE(q.question_content2, '') <> ''
                            )::numeric
                            / NULLIF(COUNT(h.exam_question_id), 0)
                            * 100,
                            0
                        ) AS practical_rate
                    FROM exam_tb e
                    JOIN subject_tb s ON s.subject_code = e.subject_code
                    LEFT JOIN exam_history_tb h ON h.exam_id = e.exam_id
                    LEFT JOIN question_tb q
                        ON q.question_id = h.question_id
                       AND q.subject_code = e.subject_code
                    WHERE LOWER(e.member_id) = LOWER(%s)
                      {subject_filter}
                    GROUP BY
                        e.exam_id, e.exam_round, e.exam_score, e.exam_date, e.exam_time, e.created_at,
                        s.subject_code, s.subject_name, s.subject_description
                )
                SELECT
                    b.*,
                    COALESCE(r.percentile, 0) AS percentile,
                    COUNT(*) OVER() AS total_exam_count,
                    ROUND(AVG(b.score) OVER(), 1) AS avg_score,
                    MAX(b.score) OVER() AS max_score,
                    MIN(b.score) OVER() AS min_score
                FROM exam_base b
                LEFT JOIN ranked_exam r
                  ON r.exam_id = b.exam_id
                ORDER BY
                    b.exam_date DESC NULLS LAST,
                    b.exam_time DESC NULLS LAST,
                    b.created_at DESC NULLS LAST,
                    b.exam_id DESC
                LIMIT %s
                OFFSET %s
                """,
                tuple(filter_params + [safe_page_size, offset]),
            )
            rows = cur.fetchall()

    items = []
    first_row = rows[0] if rows else {}
    total_count = int(first_row.get("total_exam_count") or 0)
    for row in rows:
        total = int(row["total"] or 0)
        correct_count = int(row["correct_count"] or 0)
        exam_score = row.get("score")
        numeric_exam_score = (
            float(exam_score)
            if exam_score is not None and str(exam_score).replace(".", "", 1).isdigit()
            else None
        )
        items.append(
            {
                "examId": row["exam_id"],
                "roundTitle": f"{row['exam_round']}회차" if row["exam_round"] else "응시 결과",
                "subjectCode": row["subject_code"],
                "subjectName": row["subject_name"],
                "total": total,
                "correctCount": correct_count,
                "wrongCount": total - correct_count,
                "score": numeric_exam_score if numeric_exam_score is not None else _score(correct_count, total),
                "percentile": float(row["percentile"] or 0),
                "practicalRate": float(row["practical_rate"] or 0),
                "createdAt": _created_at(row),
                "examDate": row["exam_date"],
                "examTime": row["exam_time"],
            }
        )

    total_pages = max(1, (total_count + safe_page_size - 1) // safe_page_size)
    result = {
        "memberId": normalized_member_id,
        "items": items,
        "page": safe_page,
        "pageSize": safe_page_size,
        "total": total_count,
        "totalPages": total_pages,
        "subjectCode": normalized_subject_code or None,
        "subjectFilters": subject_filters,
        "summary": {
            "totalExamCount": total_count,
            "avgScore": float(first_row["avg_score"]) if first_row.get("avg_score") is not None else 0,
            "maxScore": float(first_row["max_score"]) if first_row.get("max_score") is not None else 0,
            "minScore": float(first_row["min_score"]) if first_row.get("min_score") is not None else 0,
        },
    }
    return result


def get_monthly_ranking(limit: int = 10) -> dict[str, Any]:
    safe_limit = max(1, min(limit, 50))
    now = datetime.now()
    cached_data = _MONTHLY_RANKING_CACHE.get("data")
    cached_limit = _MONTHLY_RANKING_CACHE.get("limit")
    cached_expires_at = _MONTHLY_RANKING_CACHE.get("expires_at")
    if (
        cached_data
        and cached_limit is not None
        and int(cached_limit) >= safe_limit
        and cached_expires_at
        and now < cached_expires_at
    ):
        return {
            "monthLabel": cached_data["monthLabel"],
            "items": cached_data["items"][:safe_limit],
        }

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                WITH member_avg AS (
                    SELECT
                        e.member_id,
                        m.member_name,
                        ROUND(AVG(CAST(e.exam_score AS DECIMAL(5,2))), 1) AS avg_score
                    FROM exam_tb e
                    JOIN member_tb m
                      ON e.member_id = m.member_id
                    WHERE e.exam_score IS NOT NULL
                      AND e.exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                    GROUP BY e.member_id, m.member_name
                )
                SELECT
                    RANK() OVER (ORDER BY avg_score DESC) AS rank_no,
                    member_id,
                    member_name,
                    avg_score
                FROM member_avg
                ORDER BY avg_score DESC
                LIMIT %s
                """,
                (safe_limit,),
            )
            rows = cur.fetchall()

    result = {
        "monthLabel": f"{now.month}월",
        "items": [
            {
                "rank": int(row["rank_no"] or index),
                "memberId": row["member_id"],
                "memberName": row["member_name"],
                "averageScore": float(row["avg_score"] or 0),
            }
            for index, row in enumerate(rows, start=1)
        ],
    }
    _MONTHLY_RANKING_CACHE.update({
        "expires_at": now + timedelta(seconds=_MONTHLY_RANKING_CACHE_SECONDS),
        "data": result,
        "limit": safe_limit,
    })
    return result


def get_main_stats() -> dict[str, int]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    (SELECT COUNT(*) FROM question_tb) AS question_count,
                    (SELECT COUNT(*) FROM exam_tb) AS exam_count,
                    (SELECT COUNT(*)
                       FROM exam_tb
                      WHERE diagnosis_content IS NOT NULL
                        AND diagnosis_content <> '') AS report_count
                """
            )
            row = cur.fetchone() or {}
            cur.execute("SELECT to_regclass('public.pdf_tb') AS pdf_table")
            pdf_table = (cur.fetchone() or {}).get("pdf_table")
            if pdf_table:
                cur.execute("SELECT COUNT(*) AS pdf_count FROM pdf_tb")
                pdf_count = int((cur.fetchone() or {}).get("pdf_count") or 0)
            else:
                pdf_count = 0

    return {
        "questionCount": int(row.get("question_count") or 0),
        "pdfCount": pdf_count,
        "examCount": int(row.get("exam_count") or 0),
        "reportCount": int(row.get("report_count") or 0),
    }


def get_ranking_goal(member_id: str) -> dict[str, Any]:
    normalized_member_id = member_id.strip()
    if not normalized_member_id:
        raise HTTPException(status_code=400, detail="member_id is required")
    now = datetime.now()
    cache_key = f"{normalized_member_id}:goal"
    cached = _RANKING_GOAL_CACHE.get(cache_key)
    if cached and cached.get("expires_at") and now < cached["expires_at"]:
        return cached["data"]
    ranking_recommend_weak_row = None

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                WITH member_avg AS (
                    SELECT
                        member_id,
                        ROUND(AVG(CAST(exam_score AS DECIMAL(5,2))), 1) AS avg_score
                    FROM exam_tb
                    WHERE exam_score IS NOT NULL
                      AND exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                    GROUP BY member_id
                ),
                ranked AS (
                    SELECT
                        member_id,
                        avg_score,
                        RANK() OVER (
                            ORDER BY avg_score DESC
                        ) AS rank_no
                    FROM member_avg
                ),
                my_info AS (
                    SELECT
                        member_id,
                        rank_no,
                        avg_score,
                        CASE
                            WHEN rank_no = 1 THEN 1
                            WHEN rank_no <= 5 THEN 1
                            WHEN rank_no <= 10 THEN 5
                            WHEN rank_no <= 20 THEN 10
                            WHEN rank_no <= 50 THEN 20
                            ELSE GREATEST(
                                rank_no - CEIL(rank_no * 0.2),
                                1
                            )
                        END AS target_rank
                    FROM ranked
                    WHERE member_id = %s
                ),
                goal_info AS (
                    SELECT
                        m.rank_no AS my_rank,
                        m.avg_score AS my_score,
                        m.target_rank,
                        t.avg_score AS target_score,
                        GREATEST(
                            ROUND(
                                t.avg_score - m.avg_score,
                                1
                            ),
                            0
                        ) AS gap_score
                    FROM my_info m
                    JOIN ranked t
                      ON t.rank_no = m.target_rank
                )
                SELECT
                    my_rank,
                    my_score,
                    target_rank,
                    target_score,
                    gap_score,
                    CASE
                        WHEN gap_score = 0 THEN 100
                        WHEN gap_score <= 2 THEN 95
                        WHEN gap_score <= 5 THEN 85
                        WHEN gap_score <= 10 THEN 70
                        ELSE 50
                    END AS success_rate
                FROM goal_info
                """,
                (normalized_member_id,),
            )
            row = cur.fetchone()

            cur.execute(
                """
                WITH valid_exam AS (
                    SELECT
                        e.member_id,
                        e.subject_code,
                        CAST(e.exam_score AS DECIMAL(5,2)) AS score
                    FROM exam_tb e
                    WHERE e.exam_score IS NOT NULL
                      AND e.exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                ),
                subject_avg AS (
                    SELECT
                        e.subject_code,
                        CASE
                            WHEN e.subject_code = 'AI' THEN 'AI'
                            WHEN e.subject_code = 'CA' THEN 'Cloud'
                            WHEN e.subject_code = 'DE' THEN 'Data'
                            WHEN e.subject_code = 'CD' THEN 'Cloud Dev'
                            WHEN e.subject_code = 'SA' THEN 'SW'
                            ELSE s.subject_name
                        END AS subject_name,
                        ROUND(AVG(e.score), 1) AS current_score
                    FROM valid_exam e
                    JOIN subject_tb s
                      ON e.subject_code = s.subject_code
                    WHERE e.member_id = %s
                    GROUP BY e.subject_code, s.subject_name
                ),
                overall_subject_avg AS (
                    SELECT
                        subject_code,
                        ROUND(AVG(score), 1) AS overall_score
                    FROM valid_exam
                    GROUP BY subject_code
                ),
                ranked_subject AS (
                    SELECT
                        sa.*,
                        osa.overall_score,
                        ROUND(osa.overall_score - sa.current_score, 1) AS score_gap,
                        ROW_NUMBER() OVER (
                            ORDER BY GREATEST(osa.overall_score - sa.current_score, 0) DESC,
                                     sa.current_score ASC
                        ) AS subject_rank
                    FROM subject_avg sa
                    JOIN overall_subject_avg osa
                      ON sa.subject_code = osa.subject_code
                )
                SELECT
                    subject_code,
                    subject_name,
                    current_score,
                    overall_score,
                    score_gap,
                    GREATEST(score_gap, 0) AS expected_up_score,
                    overall_score AS target_subject_score,
                    CONCAT(subject_name, ' 집중 학습') AS recommend_title
                FROM ranked_subject
                WHERE subject_rank <= 2
                ORDER BY subject_rank
                """,
                (normalized_member_id,),
            )
            subject_rows = cur.fetchall()

            cur.execute(
                """
                WITH member_avg AS (
                    SELECT
                        e.member_id,
                        m.member_name,
                        ROUND(AVG(CAST(e.exam_score AS DECIMAL(5,2))), 1) AS avg_score
                    FROM exam_tb e
                    JOIN member_tb m
                      ON e.member_id = m.member_id
                    WHERE e.exam_score IS NOT NULL
                      AND e.exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                    GROUP BY e.member_id, m.member_name
                ),
                ranked AS (
                    SELECT
                        member_id,
                        member_name,
                        avg_score,
                        RANK() OVER (ORDER BY avg_score DESC) AS rank_no
                    FROM member_avg
                ),
                my_info AS (
                    SELECT
                        member_id,
                        rank_no,
                        avg_score
                    FROM ranked
                    WHERE member_id = %s
                )
                SELECT
                    r.member_id AS rival_id,
                    r.member_name AS rival_name,
                    r.rank_no AS rival_rank,
                    r.avg_score AS rival_score,
                    ABS(r.avg_score - m.avg_score) AS score_gap
                FROM ranked r
                JOIN my_info m
                  ON 1 = 1
                WHERE r.member_id <> %s
                  AND ABS(r.rank_no - m.rank_no) <= 5
                ORDER BY ABS(r.avg_score - m.avg_score), ABS(r.rank_no - m.rank_no)
                LIMIT 1
                """,
                (normalized_member_id, normalized_member_id),
            )
            rival_row = cur.fetchone()

            rival_subject_rows = []
            if rival_row:
                cur.execute(
                    """
                    WITH subject_avg AS (
                        SELECT
                            e.member_id,
                            e.subject_code,
                            s.subject_name,
                            ROUND(AVG(CAST(e.exam_score AS DECIMAL(5,2))), 1) AS avg_subject_score
                        FROM exam_tb e
                        JOIN subject_tb s
                          ON e.subject_code = s.subject_code
                        WHERE e.member_id IN (%s, %s)
                          AND e.exam_score IS NOT NULL
                          AND e.exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                        GROUP BY e.member_id, e.subject_code, s.subject_name
                    )
                    SELECT
                        subject_code,
                        subject_name,
                        MAX(CASE WHEN member_id = %s THEN avg_subject_score END) AS my_score,
                        MAX(CASE WHEN member_id = %s THEN avg_subject_score END) AS rival_score
                    FROM subject_avg
                    GROUP BY subject_code, subject_name
                    ORDER BY subject_code
                    """,
                    (
                        normalized_member_id,
                        rival_row["rival_id"],
                        normalized_member_id,
                        rival_row["rival_id"],
                    ),
                )
                rival_subject_rows = cur.fetchall()

            cur.execute(
                """
                WITH member_avg AS (
                    SELECT
                        member_id,
                        ROUND(AVG(CAST(exam_score AS DECIMAL(5,2))), 1) AS avg_score
                    FROM exam_tb
                    WHERE exam_score IS NOT NULL
                      AND exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                    GROUP BY member_id
                ),
                ranked AS (
                    SELECT
                        member_id,
                        avg_score,
                        RANK() OVER (ORDER BY avg_score DESC) AS rank_no
                    FROM member_avg
                ),
                top10 AS (
                    SELECT member_id
                    FROM ranked
                    WHERE rank_no <= 10
                ),
                top_pattern AS (
                    SELECT
                        ROUND(AVG(exam_count), 1) AS avg_exam_count,
                        ROUND(AVG(subject_count), 1) AS avg_subject_count,
                        ROUND(AVG(practical_rate), 1) AS avg_practical_rate,
                        ROUND(AVG(wrong_note_count), 1) AS avg_wrong_note_saved_count
                    FROM (
                        SELECT
                            e.member_id,
                            COUNT(DISTINCT e.exam_id) AS exam_count,
                            COUNT(DISTINCT e.subject_code) AS subject_count,
                            ROUND(
                                SUM(CASE WHEN q.question_type = '실무형' THEN 1 ELSE 0 END)::numeric
                                / NULLIF(COUNT(q.question_id), 0) * 100,
                                1
                            ) AS practical_rate,
                            SUM(CASE WHEN h.wrong_note_saved = 'Y' THEN 1 ELSE 0 END) AS wrong_note_count
                        FROM exam_tb e
                        LEFT JOIN exam_history_tb h
                          ON e.exam_id = h.exam_id
                        LEFT JOIN question_tb q
                          ON h.question_id = q.question_id
                        WHERE e.member_id IN (SELECT member_id FROM top10)
                        GROUP BY e.member_id
                    ) x
                ),
                my_weak_subject AS (
                    SELECT
                        s.subject_name,
                        ROUND(AVG(CAST(e.exam_score AS DECIMAL(5,2))), 1) AS avg_subject_score
                    FROM exam_tb e
                    JOIN subject_tb s
                      ON e.subject_code = s.subject_code
                    WHERE e.member_id = %s
                      AND e.exam_score IS NOT NULL
                      AND e.exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                    GROUP BY s.subject_name
                    ORDER BY avg_subject_score ASC
                    LIMIT 1
                )
                SELECT
                    tp.avg_exam_count,
                    tp.avg_subject_count,
                    tp.avg_practical_rate,
                    tp.avg_wrong_note_saved_count,
                    mws.subject_name AS weak_subject,
                    mws.avg_subject_score AS weak_subject_score
                FROM top_pattern tp
                CROSS JOIN my_weak_subject mws
                """,
                (normalized_member_id,),
            )
            learning_pattern_row = cur.fetchone()

            cur.execute(
                """
                WITH unit_stats AS (
                    SELECT
                        q.subject_code,
                        CASE
                            WHEN q.subject_code = 'AI' THEN 'AI'
                            WHEN q.subject_code = 'CA' THEN 'Cloud'
                            WHEN q.subject_code = 'DE' THEN 'Data'
                            WHEN q.subject_code = 'CD' THEN 'Cloud Dev'
                            WHEN q.subject_code = 'SA' THEN 'SW'
                            ELSE COALESCE(s.subject_name, q.subject_code)
                        END AS subject_name,
                        q.minor_unit,
                        TRIM(
                            REGEXP_REPLACE(
                                SPLIT_PART(
                                    REPLACE(
                                        REPLACE(
                                            REGEXP_REPLACE(
                                                COALESCE(NULLIF(q.minor_unit, ''), '미분류'),
                                                '^SECTION [0-9]+\\.\\s*',
                                                ''
                                            ),
                                            '의 이해',
                                            ''
                                        ),
                                        '개요 및 활용법',
                                        ''
                                    ),
                                    '/',
                                    1
                                ),
                                '^[0-9]+\\.\\s*',
                                ''
                            )
                        ) AS display_keyword,
                        COUNT(*) AS total_count,
                        SUM(CASE WHEN h.is_correct = 'Y' THEN 1 ELSE 0 END) AS correct_count,
                        ROUND(
                            SUM(CASE WHEN h.is_correct = 'Y' THEN 1 ELSE 0 END)::numeric
                            / NULLIF(COUNT(*), 0) * 100,
                            1
                        ) AS correct_rate
                    FROM exam_tb e
                    JOIN exam_history_tb h
                      ON e.exam_id = h.exam_id
                    JOIN question_tb q
                      ON h.question_id = q.question_id
                    LEFT JOIN subject_tb s
                      ON q.subject_code = s.subject_code
                    WHERE e.member_id = %s
                    GROUP BY q.subject_code, s.subject_name, q.minor_unit
                ),
                strong_unit AS (
                    SELECT
                        subject_code AS strong_subject_code,
                        subject_name AS strong_subject_name,
                        display_keyword AS strong_keyword
                    FROM unit_stats
                    WHERE total_count >= 2
                    ORDER BY correct_rate DESC, total_count DESC
                    LIMIT 1
                ),
                weak_unit AS (
                    SELECT
                        subject_code AS weak_subject_code,
                        subject_name AS weak_subject_name,
                        display_keyword AS weak_keyword
                    FROM unit_stats
                    WHERE total_count >= 2
                    ORDER BY correct_rate ASC, total_count DESC
                    LIMIT 1
                )
                SELECT
                    strong_unit.strong_subject_code,
                    strong_unit.strong_subject_name,
                    strong_unit.strong_keyword,
                    weak_unit.weak_subject_code,
                    weak_unit.weak_subject_name,
                    weak_unit.weak_keyword
                FROM strong_unit
                CROSS JOIN weak_unit
                """,
                (normalized_member_id,),
            )
            strength_keyword_row = cur.fetchone()

            cur.execute(
                """
                WITH recent_rows AS (
                    SELECT
                        q.subject_code,
                        COALESCE(NULLIF(q.major_unit, ''), '미분류') AS major_unit,
                        CASE
                            WHEN h.selected_number::text ~ '^[0-9]+$'
                             AND q.answer_number::text ~ '^[0-9]+$'
                             AND h.selected_number::integer = q.answer_number::integer
                            THEN TRUE ELSE FALSE
                        END AS is_correct
                    FROM exam_tb e
                    JOIN exam_history_tb h
                      ON e.exam_id = h.exam_id
                    JOIN question_tb q
                      ON q.question_id = h.question_id
                     AND q.subject_code = e.subject_code
                    WHERE e.member_id = %s
                    ORDER BY e.exam_date DESC, e.exam_time DESC, e.exam_id DESC, h.exam_question_id DESC
                    LIMIT 200
                ),
                wrong_exists AS (
                    SELECT EXISTS (SELECT 1 FROM recent_rows WHERE is_correct = FALSE) AS has_wrong
                ),
                target_rows AS (
                    SELECT r.*
                    FROM recent_rows r
                    CROSS JOIN wrong_exists w
                    WHERE (w.has_wrong = TRUE AND r.is_correct = FALSE)
                       OR (w.has_wrong = FALSE)
                )
                SELECT
                    subject_code AS weak_subject_code,
                    major_unit AS weak_unit,
                    COUNT(*) AS total_count,
                    SUM(CASE WHEN is_correct = FALSE THEN 1 ELSE 0 END) AS wrong_count
                FROM target_rows
                GROUP BY subject_code, major_unit
                ORDER BY wrong_count DESC, total_count DESC
                LIMIT 1
                """,
                (normalized_member_id,),
            )
            ranking_recommend_weak_row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Ranking goal not found")

    subject_target_items = [
        {
            "subjectCode": subject_row["subject_code"],
            "subjectName": subject_row["subject_name"],
            "currentScore": float(subject_row["current_score"] or 0),
            "overallAverageScore": float(subject_row["overall_score"] or 0),
            "scoreGap": float(subject_row["score_gap"] or 0),
            "expectedUpScore": float(subject_row["expected_up_score"] or 0),
            "targetSubjectScore": float(subject_row["target_subject_score"] or 0),
            "recommendTitle": subject_row["recommend_title"],
        }
        for subject_row in subject_rows
    ]
    gap_score = float(row["gap_score"] or 0)
    if int(row["my_rank"]) == 1:
        goal_coach_message = "현재 1위를 유지 중입니다."
        goal_actions = [
            {"title": "현재 순위 유지 학습", "expected": "선두 유지"},
            {"title": "취약 과목 보완 학습", "expected": "안정성 강화"},
        ]
    else:
        goal_coach_message = _fallback_ranking_goal_coach(
            int(row["my_rank"]),
            int(row["target_rank"]),
            gap_score,
            subject_target_items,
        )
        goal_actions = _fallback_ranking_goal_actions(subject_target_items)

    rival_coach_message = (
        _fallback_ranking_rival_coach(rival_row, rival_subject_rows)
        if rival_row
        else None
    )
    learning_recommendations = (
        _fallback_ranking_learning_recommendations(learning_pattern_row)
        if learning_pattern_row
        else []
    )
    weak_subject_code = (
        ranking_recommend_weak_row["weak_subject_code"]
        if ranking_recommend_weak_row
        else strength_keyword_row["weak_subject_code"] if strength_keyword_row else None
    )
    weak_keyword = (
        _fallback_modal_keyword({
            "majorUnit": ranking_recommend_weak_row["weak_unit"],
            "minorUnit": ranking_recommend_weak_row["weak_unit"],
        })
        if ranking_recommend_weak_row
        else strength_keyword_row["weak_keyword"] if strength_keyword_row else None
    )

    return {
        "memberId": normalized_member_id,
        "myRank": int(row["my_rank"]),
        "myScore": float(row["my_score"] or 0),
        "targetRank": int(row["target_rank"]),
        "targetScore": float(row["target_score"] or 0),
        "gapScore": gap_score,
        "successRate": int(row["success_rate"] or 0),
        "subjectTargets": subject_target_items,
        "goalCoachMessage": goal_coach_message,
        "goalActions": goal_actions,
        "rival": {
            "rivalId": rival_row["rival_id"],
            "rivalName": rival_row["rival_name"],
            "rivalRank": int(rival_row["rival_rank"]),
            "rivalScore": float(rival_row["rival_score"] or 0),
            "scoreGap": float(rival_row["score_gap"] or 0),
            "rivalCoachMessage": rival_coach_message,
            "subjectComparisons": [
                {
                    "subjectCode": subject_row["subject_code"],
                    "subjectName": subject_row["subject_name"],
                    "myScore": float(subject_row["my_score"] or 0),
                    "rivalScore": float(subject_row["rival_score"] or 0),
                }
                for subject_row in rival_subject_rows
            ],
        } if rival_row else None,
        "learningPattern": {
            "avgExamCount": float(learning_pattern_row["avg_exam_count"] or 0),
            "avgSubjectCount": float(learning_pattern_row["avg_subject_count"] or 0),
            "avgPracticalRate": float(learning_pattern_row["avg_practical_rate"] or 0),
            "avgWrongNoteSavedCount": float(learning_pattern_row["avg_wrong_note_saved_count"] or 0),
            "weakSubject": learning_pattern_row["weak_subject"],
            "weakSubjectScore": float(learning_pattern_row["weak_subject_score"] or 0),
            "recommendations": learning_recommendations,
        } if learning_pattern_row else None,
        "strengthKeywords": {
            "strongSubjectCode": strength_keyword_row["strong_subject_code"],
            "strongSubjectName": strength_keyword_row["strong_subject_name"],
            "strongKeyword": strength_keyword_row["strong_keyword"],
            "weakSubjectCode": weak_subject_code,
            "weakSubjectName": weak_subject_code,
            "weakKeyword": weak_keyword,
        } if strength_keyword_row else None,
    }
    _RANKING_GOAL_CACHE[cache_key] = {
        "expires_at": now + timedelta(seconds=_RANKING_GOAL_CACHE_SECONDS),
        "data": result,
    }
    return result


def get_ranking_goal_commentary(member_id: str) -> dict[str, Any]:
    normalized_member_id = member_id.strip()
    if not normalized_member_id:
        raise HTTPException(status_code=400, detail="member_id is required")

    now = datetime.now()
    cache_key = f"{normalized_member_id}:goal_commentary"
    cached = _RANKING_GOAL_CACHE.get(cache_key)
    if cached and cached.get("expires_at") and now < cached["expires_at"]:
        return cached["data"]

    goal = get_ranking_goal(normalized_member_id)
    ranking_goal = {
        "my_rank": goal["myRank"],
        "my_score": goal["myScore"],
        "target_rank": goal["targetRank"],
        "target_score": goal["targetScore"],
        "gap_score": goal["gapScore"],
        "success_rate": goal["successRate"],
    }
    subject_targets = [
        {
            "subjectCode": item.get("subjectCode"),
            "subjectName": item.get("subjectName"),
            "currentScore": item.get("currentScore"),
            "overallAverageScore": item.get("overallAverageScore"),
            "scoreGap": item.get("scoreGap"),
            "expectedUpScore": item.get("expectedUpScore"),
            "targetSubjectScore": item.get("targetSubjectScore"),
            "recommendTitle": item.get("recommendTitle"),
        }
        for item in goal.get("subjectTargets", [])
    ]
    rival = goal.get("rival") or {}
    rival_row = {
        "rival_id": rival.get("rivalId"),
        "rival_name": rival.get("rivalName"),
        "rival_rank": rival.get("rivalRank"),
        "rival_score": rival.get("rivalScore"),
        "score_gap": rival.get("scoreGap"),
    } if rival else None
    rival_subject_rows = [
        {
            "subject_code": item.get("subjectCode"),
            "subject_name": item.get("subjectName"),
            "my_score": item.get("myScore"),
            "rival_score": item.get("rivalScore"),
        }
        for item in rival.get("subjectComparisons", [])
    ] if rival else []
    learning_pattern = goal.get("learningPattern") or {}
    learning_pattern_row = {
        "avg_exam_count": learning_pattern.get("avgExamCount"),
        "avg_subject_count": learning_pattern.get("avgSubjectCount"),
        "avg_practical_rate": learning_pattern.get("avgPracticalRate"),
        "avg_wrong_note_saved_count": learning_pattern.get("avgWrongNoteSavedCount"),
        "weak_subject": learning_pattern.get("weakSubject"),
        "weak_subject_score": learning_pattern.get("weakSubjectScore"),
    } if learning_pattern else None

    gap_score = float(goal.get("gapScore") or 0)
    if int(goal.get("myRank") or 0) == 1:
        goal_coach_message = goal.get("goalCoachMessage")
        goal_actions = goal.get("goalActions") or []
    else:
        goal_coach_message = _bedrock_ranking_goal_coach(ranking_goal, subject_targets)
        goal_actions = _bedrock_ranking_goal_actions(ranking_goal, subject_targets)

    result = {
        "memberId": normalized_member_id,
        "goalCoachMessage": goal_coach_message,
        "goalActions": goal_actions,
        "rivalCoachMessage": (
            _bedrock_ranking_rival_coach(ranking_goal, rival_row, rival_subject_rows)
            if rival_row
            else None
        ),
        "learningRecommendations": (
            _bedrock_ranking_learning_recommendations(learning_pattern_row)
            if learning_pattern_row
            else []
        ),
    }
    _RANKING_GOAL_CACHE[cache_key] = {
        "expires_at": now + timedelta(seconds=_RANKING_GOAL_COMMENTARY_CACHE_SECONDS),
        "data": result,
    }
    return result


def get_wrong_items(attempt_id: str) -> dict[str, Any]:
    result = get_result(attempt_id)
    wrong_items = [item for item in result["items"] if not item["correct"]]
    return {
        "attemptId": result["attemptId"],
        "profileName": result["profileName"],
        "subjectId": result["subjectId"],
        "subjectName": result["subjectName"],
        "wrongCount": len(wrong_items),
        "items": wrong_items,
    }


def save_wrong_note(attempt_id: str, question_ids: list[str] | None = None) -> dict[str, Any]:
    saved_at = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M:%S")
    with get_conn() as conn:
        with conn.cursor() as cur:
            if question_ids:
                cur.execute(
                    """
                    UPDATE exam_history_tb
                    SET wrong_note_saved = 'Y',
                        created_at = %s
                    WHERE exam_id = %s
                      AND question_id = ANY(%s)
                    """,
                    (saved_at, attempt_id, question_ids),
                )
            else:
                cur.execute(
                    """
                    UPDATE exam_history_tb
                    SET wrong_note_saved = 'Y',
                        created_at = %s
                    WHERE exam_id = %s
                    """,
                    (saved_at, attempt_id),
                )
            updated_count = cur.rowcount

    return {
        "attemptId": attempt_id,
        "updatedCount": updated_count,
        "questionIds": question_ids or [],
        "savedAt": saved_at,
    }


def delete_wrong_note(attempt_id: str, question_ids: list[str] | None = None) -> dict[str, Any]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            if question_ids:
                cur.execute(
                    """
                    UPDATE exam_history_tb
                    SET wrong_note_saved = 'N'
                    WHERE exam_id = %s
                      AND question_id = ANY(%s)
                    """,
                    (attempt_id, question_ids),
                )
            else:
                cur.execute(
                    """
                    UPDATE exam_history_tb
                    SET wrong_note_saved = 'N'
                    WHERE exam_id = %s
                    """,
                    (attempt_id,),
                )
            updated_count = cur.rowcount

    return {
        "attemptId": attempt_id,
        "updatedCount": updated_count,
        "questionIds": question_ids or [],
    }


def get_saved_wrong_notes(member_id: str | None = None) -> dict[str, Any]:
    normalized_member_id = (member_id or "").strip()
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if normalized_member_id:
                cur.execute(
                    """
                    WITH my_exam AS (
                        SELECT
                            e.exam_id,
                            e.member_id,
                            e.subject_code,
                            s.subject_name,
                            s.subject_description,
                            e.exam_date,
                            e.exam_time,
                            e.exam_round,
                            e.exam_score,
                            COUNT(h.exam_question_id) AS question_count,
                            SUM(CASE WHEN h.is_correct = 'N' THEN 1 ELSE 0 END) AS wrong_count,
                            ROUND(
                                SUM(CASE WHEN h.is_correct = 'Y' THEN 1 ELSE 0 END)::numeric
                                / NULLIF(COUNT(h.exam_question_id), 0) * 100,
                                0
                            ) AS correct_rate
                        FROM exam_tb e
                        JOIN subject_tb s
                          ON e.subject_code = s.subject_code
                        JOIN exam_history_tb h
                          ON e.exam_id = h.exam_id
                        WHERE LOWER(e.member_id) = LOWER(%s)
                        GROUP BY
                            e.exam_id,
                            e.member_id,
                            e.subject_code,
                            s.subject_name,
                            s.subject_description,
                            e.exam_date,
                            e.exam_time,
                            e.exam_round,
                            e.exam_score
                    ),
                    ranked_exam AS (
                        SELECT
                            e.exam_id,
                            e.subject_code,
                            e.exam_score,
                            PERCENT_RANK() OVER (
                                PARTITION BY e.subject_code
                                ORDER BY
                                    CASE
                                        WHEN e.exam_score IS NOT NULL
                                         AND e.exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                                        THEN CAST(e.exam_score AS DECIMAL(10,2))
                                        ELSE NULL
                                    END DESC NULLS LAST
                            ) AS percent_rank_value
                        FROM exam_tb e
                    ),
                    weak_area AS (
                        SELECT
                            h.exam_id,
                            q.major_unit,
                            q.minor_unit,
                            COUNT(*) AS wrong_cnt,
                            ROW_NUMBER() OVER (
                                PARTITION BY h.exam_id
                                ORDER BY COUNT(*) DESC
                            ) AS rn
                        FROM exam_history_tb h
                        JOIN question_tb q
                          ON h.question_id = q.question_id
                        WHERE h.is_correct = 'N'
                        GROUP BY
                            h.exam_id,
                            q.major_unit,
                            q.minor_unit
                    ),
                    subject_summary AS (
                        SELECT
                            e.subject_code,
                            COUNT(DISTINCT e.exam_id) FILTER (
                                WHERE h.wrong_note_saved = 'Y'
                            ) AS wrong_set_count,
                            SUM(CASE WHEN h.wrong_note_saved = 'Y' THEN 1 ELSE 0 END) AS saved_question_count
                        FROM exam_tb e
                        JOIN exam_history_tb h
                          ON e.exam_id = h.exam_id
                        WHERE LOWER(e.member_id) = LOWER(%s)
                        GROUP BY e.subject_code
                    )
                    SELECT
                        m.subject_code,
                        m.subject_name,
                        m.subject_description,
                        ss.wrong_set_count,
                        ss.saved_question_count,
                        m.exam_id,
                        m.exam_date,
                        m.exam_time,
                        m.exam_round,
                        m.question_count,
                        m.correct_rate,
                        m.wrong_count,
                        CONCAT(
                            '상위 ',
                            ROUND((COALESCE(r.percent_rank_value, 0) * 100)::numeric, 1),
                            '%%'
                        ) AS top_percent,
                        COALESCE(w.minor_unit, w.major_unit, '-') AS weak_area
                    FROM my_exam m
                    LEFT JOIN ranked_exam r
                      ON m.exam_id = r.exam_id
                    LEFT JOIN weak_area w
                      ON m.exam_id = w.exam_id
                     AND w.rn = 1
                    LEFT JOIN subject_summary ss
                      ON m.subject_code = ss.subject_code
                    ORDER BY
                        m.exam_date DESC NULLS LAST,
                        m.exam_time DESC NULLS LAST,
                        m.exam_id DESC
                    """,
                    (normalized_member_id, normalized_member_id),
                )
                summary_rows = cur.fetchall()
            else:
                summary_rows = []

            if normalized_member_id:
                subject_acc: dict[str, dict[str, Any]] = {}
                for row in summary_rows:
                    code = row["subject_code"]
                    item = subject_acc.setdefault(
                        code,
                        {
                            "subjectId": code,
                            "subjectCode": code,
                            "subjectName": row["subject_name"] or code,
                            "subjectDescription": row["subject_description"] or row["subject_name"] or code,
                            "wrongCount": int(row["saved_question_count"] or 0),
                            "roundCount": int(row["wrong_set_count"] or 0),
                        },
                    )
                    item["wrongCount"] = int(row["saved_question_count"] or item["wrongCount"] or 0)
                    item["roundCount"] = int(row["wrong_set_count"] or item["roundCount"] or 0)
                subjects = list(subject_acc.values())
            else:
                cur.execute(
                    """
                    SELECT
                        s.subject_code,
                        s.subject_name,
                        s.subject_description,
                        COUNT(h.exam_question_id) FILTER (
                            WHERE h.wrong_note_saved = 'Y'
                        ) AS wrong_count,
                        COUNT(DISTINCT e.exam_id) FILTER (
                            WHERE h.wrong_note_saved = 'Y'
                        ) AS round_count
                    FROM subject_tb s
                    LEFT JOIN exam_tb e ON e.subject_code = s.subject_code
                    LEFT JOIN exam_history_tb h ON h.exam_id = e.exam_id
                    GROUP BY s.subject_code, s.subject_name, s.subject_description
                    ORDER BY s.subject_code
                    """
                )
                subjects = [
                    {
                        "subjectId": row["subject_code"],
                        "subjectCode": row["subject_code"],
                        "subjectName": row["subject_name"] or row["subject_code"],
                        "subjectDescription": row["subject_description"] or row["subject_name"] or row["subject_code"],
                        "wrongCount": int(row["wrong_count"] or 0),
                        "roundCount": int(row["round_count"] or 0),
                    }
                    for row in cur.fetchall()
                ]

            exam_summary_map = {
                row["exam_id"]: {
                    "questionCount": int(row["question_count"] or 0),
                    "wrongCount": int(row["wrong_count"] or 0),
                    "correctRate": float(row["correct_rate"] or 0),
                    "topPercent": row["top_percent"] or "",
                    "weakKeyword": row["weak_area"] or "-",
                }
                for row in summary_rows
            }

            detail_where = (
                "LOWER(e.member_id) = LOWER(%s) AND h.is_correct = 'N' AND h.wrong_note_saved = 'Y'"
                if normalized_member_id
                else "h.wrong_note_saved = 'Y'"
            )
            detail_params: tuple[Any, ...] = (normalized_member_id,) if normalized_member_id else ()
            cur.execute(
                f"""
                WITH numbered_history AS (
                    SELECT
                        h.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY h.exam_id
                            ORDER BY h.exam_question_id
                        ) AS question_number
                    FROM exam_history_tb h
                )
                SELECT
                    e.exam_id,
                    e.exam_round,
                    e.exam_date,
                    e.exam_time,
                    e.created_at AS exam_created_at,
                    m.member_name,
                    s.subject_code,
                    s.subject_name,
                    s.subject_description,
                    h.exam_question_id,
                    h.created_at AS history_created_at,
                    h.selected_number,
                    h.answer_number AS selected_answer_number,
                    h.is_correct,
                    h.question_number,
                    q.question_id,
                    q.major_unit,
                    q.minor_unit,
                    q.question_type,
                    q.question_content,
                    q.question_content2,
                    q.option_1,
                    q.option_2,
                    q.option_3,
                    q.option_4,
                    q.option_5,
                    q.answer_number,
                    q.explanation
                FROM numbered_history h
                JOIN exam_tb e ON e.exam_id = h.exam_id
                JOIN member_tb m ON m.member_id = e.member_id
                JOIN subject_tb s ON s.subject_code = e.subject_code
                JOIN question_tb q
                    ON q.question_id = h.question_id
                   AND q.subject_code = e.subject_code
                WHERE {detail_where}
                ORDER BY
                    s.subject_code,
                    h.created_at DESC NULLS LAST,
                    e.exam_date DESC NULLS LAST,
                    e.exam_time DESC NULLS LAST,
                    e.exam_round,
                    h.exam_question_id
                """,
                detail_params,
            )
            rows = cur.fetchall()

    notes = []
    for row in rows:
        exam_summary = exam_summary_map.get(row["exam_id"], {})
        notes.append(
            {
                "source": "db",
                "profileName": row["member_name"],
                "subjectId": row["subject_code"],
                "subjectName": row["subject_name"] or row["subject_description"],
                "attemptId": row["exam_id"],
                "roundTitle": f"{row['exam_round']}회차" if row["exam_round"] else "응시 결과",
                "createdAt": _as_browser_datetime(row["history_created_at"]) or _created_at(row),
                "total": exam_summary.get("questionCount"),
                "totalCount": exam_summary.get("questionCount"),
                "wrongCount": exam_summary.get("wrongCount"),
                "correctRate": exam_summary.get("correctRate"),
                "topPercent": exam_summary.get("topPercent"),
                "weakKeyword": exam_summary.get("weakKeyword"),
                "index": max(0, int(row["question_number"] or 1) - 1),
                "selected": _to_int(row["selected_number"]),
                "question": {
                    "id": row["question_id"],
                    "text": _question_text(row),
                    "scenario": _question_scenario(row),
                    "choices": [
                        row["option_1"],
                        row["option_2"],
                        row["option_3"],
                        row["option_4"],
                        row["option_5"],
                    ],
                    "answer": _to_int(row["answer_number"]),
                    "explanation": row["explanation"] or "",
                    "difficulty": row["minor_unit"] or "-",
                    "questionType": _question_type(row),
                    "majorUnit": row["major_unit"] or "-",
                },
            }
        )

    return {"subjects": subjects, "items": notes}
