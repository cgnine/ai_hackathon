from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from fastapi import HTTPException
from psycopg2.extras import RealDictCursor

from backend.services import bedrock_client, question_parser
from backend.services.db import get_conn


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


def _compact_analysis_headline(value: str) -> str:
    text = " ".join(str(value or "").replace("…", "").split()).rstrip(".。!?！？")
    if len(text) <= 25:
        return text
    return "강점 유지, 취약 보완"


def _compact_analysis_comment(value: str) -> str:
    text = " ".join(str(value or "").replace("…", "").split())
    if len(text) <= 70:
        return text
    sentences = []
    for chunk in text.replace("!", ".").replace("?", ".").split("."):
        sentence = chunk.strip()
        if sentence:
            sentences.append(sentence)
    compact = ". ".join(sentences[:2])
    if compact:
        compact = compact.rstrip(".") + "."
    if len(compact) <= 70:
        return compact
    return "강점 과목은 유지하세요. 취약 과목은 핵심 개념과 오답 단원을 복습하세요."


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
        "AI 총평 작성 규칙\n"
        "1. aiOverview.headline은 25자 이내의 짧은 1문장으로 작성\n"
        "2. aiOverview.comment는 정확히 2문장, 총 70자 이내로 작성\n"
        "3. 긴 과목명은 쓰지 말고 subjectCode만 사용\n"
        "4. 강점, 보완점, 향후 방향만 간결히 작성\n"
        "5. 과목은 최대 2개까지만 언급\n"
        "6. 점수 나열 금지\n"
        "7. headline은 명사형 요약으로 작성하고 마침표와 말줄임표를 쓰지 않음\n"
        "8. comment는 두 문장 모두 완결된 짧은 문장으로 작성하고 말줄임표를 쓰지 않음\n\n"
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
    subject_stats = []
    for item in subject_map.values():
        item["score"] = _score(item["correct"], item["answered"])
        item["accuracy"] = item["score"]
        item["overallAverageScore"] = subject_average_map.get(item["subjectCode"], 0)
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

    attempted_subject_stats = [
        item for item in subject_stats
        if int(item.get("answered") or 0) > 0
    ]
    weak_subject = min(
        attempted_subject_stats,
        key=lambda item: (item["score"], -item["answered"]),
        default=None,
    )
    weakness_analysis = None
    if weak_subject:
        weak_subject_code = weak_subject["subjectCode"]
        weak_subject_type_stats = []
        for (subject_code, question_type), item in subject_type_map.items():
            if subject_code != weak_subject_code:
                continue
            score = _score(item["correct"], item["answered"])
            weak_subject_type_stats.append(
                {
                    "type": question_type,
                    "answered": item["answered"],
                    "correct": item["correct"],
                    "wrong": item["answered"] - item["correct"],
                    "score": score,
                }
            )
        weak_subject_type_stats.sort(key=lambda item: (item["score"], -item["wrong"]))
        weak_units = [
            item for item in unit_stats
            if item["subjectCode"] == weak_subject_code
        ][:3]
        weak_question_type = weak_subject_type_stats[0]["type"] if weak_subject_type_stats else None
        weak_unit = weak_units[0]["unit"] if weak_units else None
        expected_gain = max(5, min(15, round((100 - weak_subject["score"]) * 0.28)))
        weakness_payload = {
            "weakSubject": weak_subject,
            "weakSubjectTypeStats": weak_subject_type_stats,
            "weakUnits": weak_units,
            "weakQuestionType": weak_question_type,
            "weakUnit": weak_unit,
            "expectedGain": expected_gain,
        }
        weakness_commentary = _bedrock_analysis_weakness(weakness_payload, include_commentary)
        weakness_analysis = {
            "weakArea": weak_subject["subjectName"],
            "subjectCode": weak_subject_code,
            "accuracy": weak_subject["score"],
            "practicalAccuracy": next(
                (item["score"] for item in weak_subject_type_stats if item["type"] == "실무형"),
                None,
            ),
            "theoryAccuracy": next(
                (item["score"] for item in weak_subject_type_stats if item["type"] == "이론형"),
                None,
            ),
            "weakQuestionType": weak_question_type,
            "weakUnit": weak_unit,
            "analysis1": weakness_commentary["analysis1"],
            "analysis2": weakness_commentary["analysis2"],
            "expectedGain": expected_gain,
        }

    ai_summary = (
        _bedrock_analysis_ai_summary(summary, subject_stats, type_stats, unit_stats, recent_exam_stats)
        if include_commentary
        else _fallback_analysis_ai_summary(summary, subject_stats)
    )

    return {
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


def get_analysis_commentary(member_id: str) -> dict[str, Any]:
    analysis = get_analysis(member_id, include_commentary=True)
    return {
        "aiOverview": analysis.get("aiOverview"),
        "aiComment": analysis.get("aiComment"),
        "commentary": analysis["commentary"],
    }


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
    items = []
    for row in rows:
        selected = _to_int(row["selected_number"])
        answer = _to_int(row["answer_number"])
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
                "diagnosisArea": row["major_unit"] or "-",
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
                FROM exam_tb e
                JOIN subject_tb s ON s.subject_code = e.subject_code
                WHERE e.member_id = %s
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
                SELECT COUNT(*) AS total_count
                FROM exam_tb e
                WHERE e.member_id = %s
                  {subject_filter}
                """,
                tuple(filter_params),
            )
            total_count = int(cur.fetchone()["total_count"] or 0)

            cur.execute(
                f"""
                SELECT
                    e.exam_id,
                    e.exam_round,
                    e.exam_date,
                    e.exam_time,
                    e.created_at AS exam_created_at,
                    s.subject_code,
                    COALESCE(s.subject_name, s.subject_description, s.subject_code) AS subject_name,
                    COUNT(h.exam_question_id) AS total,
                    COUNT(h.exam_question_id) FILTER (
                        WHERE h.selected_number::text ~ '^[0-9]+$'
                          AND q.answer_number::text ~ '^[0-9]+$'
                          AND h.selected_number::integer = q.answer_number::integer
                    ) AS correct_count
                FROM exam_tb e
                JOIN subject_tb s ON s.subject_code = e.subject_code
                JOIN exam_history_tb h ON h.exam_id = e.exam_id
                JOIN question_tb q
                    ON q.question_id = h.question_id
                   AND q.subject_code = e.subject_code
                WHERE e.member_id = %s
                  {subject_filter}
                GROUP BY
                    e.exam_id, e.exam_round, e.exam_date, e.exam_time, e.created_at,
                    s.subject_code, s.subject_name, s.subject_description
                ORDER BY
                    e.exam_date DESC NULLS LAST,
                    e.exam_time DESC NULLS LAST,
                    e.created_at DESC NULLS LAST,
                    e.exam_id DESC
                LIMIT %s
                OFFSET %s
                """,
                tuple(filter_params + [safe_page_size, offset]),
            )
            rows = cur.fetchall()

    items = []
    for row in rows:
        total = int(row["total"] or 0)
        correct_count = int(row["correct_count"] or 0)
        items.append(
            {
                "examId": row["exam_id"],
                "roundTitle": f"{row['exam_round']}회차" if row["exam_round"] else "응시 결과",
                "subjectCode": row["subject_code"],
                "subjectName": row["subject_name"],
                "total": total,
                "correctCount": correct_count,
                "wrongCount": total - correct_count,
                "score": _score(correct_count, total),
                "createdAt": _created_at(row),
                "examDate": row["exam_date"],
                "examTime": row["exam_time"],
            }
        )

    total_pages = max(1, (total_count + safe_page_size - 1) // safe_page_size)
    return {
        "memberId": normalized_member_id,
        "items": items,
        "page": safe_page,
        "pageSize": safe_page_size,
        "total": total_count,
        "totalPages": total_pages,
        "subjectCode": normalized_subject_code or None,
        "subjectFilters": subject_filters,
    }


def get_monthly_ranking(limit: int = 5) -> dict[str, Any]:
    safe_limit = max(1, min(limit, 20))
    now = datetime.now()
    month_start = now.replace(day=1)
    next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    start_date = month_start.strftime("%Y%m%d")
    end_date = (next_month - timedelta(days=1)).strftime("%Y%m%d")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    e.member_id,
                    COALESCE(m.member_name, e.member_id) AS member_name,
                    ROUND(AVG(e.exam_score::numeric), 1) AS average_score,
                    COUNT(*) AS exam_count
                FROM exam_tb e
                LEFT JOIN member_tb m ON m.member_id = e.member_id
                WHERE e.exam_date BETWEEN %s AND %s
                  AND e.exam_score IS NOT NULL
                  AND e.exam_score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                GROUP BY e.member_id, COALESCE(m.member_name, e.member_id)
                ORDER BY AVG(e.exam_score::numeric) DESC, COUNT(*) DESC, e.member_id ASC
                LIMIT %s
                """,
                (start_date, end_date, safe_limit),
            )
            rows = cur.fetchall()

    return {
        "month": now.month,
        "monthLabel": f"{now.month}월",
        "startDate": start_date,
        "endDate": end_date,
        "items": [
            {
                "rank": index,
                "memberId": row["member_id"],
                "memberName": row["member_name"],
                "averageScore": float(row["average_score"] or 0),
                "examCount": int(row["exam_count"] or 0),
            }
            for index, row in enumerate(rows, start=1)
        ],
    }


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
    with get_conn() as conn:
        with conn.cursor() as cur:
            if question_ids:
                cur.execute(
                    """
                    UPDATE exam_history_tb
                    SET wrong_note_saved = 'Y'
                    WHERE exam_id = %s
                      AND question_id = ANY(%s)
                    """,
                    (attempt_id, question_ids),
                )
            else:
                cur.execute(
                    """
                    UPDATE exam_history_tb
                    SET wrong_note_saved = 'Y'
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


def get_saved_wrong_notes() -> dict[str, Any]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
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

            cur.execute(
                """
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
                    h.selected_number,
                    h.answer_number AS selected_answer_number,
                    h.is_correct,
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
                FROM exam_history_tb h
                JOIN exam_tb e ON e.exam_id = h.exam_id
                JOIN member_tb m ON m.member_id = e.member_id
                JOIN subject_tb s ON s.subject_code = e.subject_code
                JOIN question_tb q
                    ON q.question_id = h.question_id
                   AND q.subject_code = e.subject_code
                WHERE h.wrong_note_saved = 'Y'
                ORDER BY s.subject_code, e.exam_date DESC, e.exam_time DESC, e.exam_round, h.exam_question_id
                """
            )
            rows = cur.fetchall()

    notes = []
    for index, row in enumerate(rows):
        notes.append(
            {
                "source": "db",
                "profileName": row["member_name"],
                "subjectId": row["subject_code"],
                "subjectName": row["subject_name"] or row["subject_description"],
                "attemptId": row["exam_id"],
                "roundTitle": f"{row['exam_round']}회차" if row["exam_round"] else "응시 결과",
                "createdAt": _created_at(row),
                "index": index,
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
