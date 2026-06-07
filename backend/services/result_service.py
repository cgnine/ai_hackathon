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


def _build_diagnosis(items: list[dict[str, Any]], summary: str | None) -> dict[str, Any]:
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

    subject_map: dict[str, dict[str, Any]] = {}
    type_map: dict[str, dict[str, Any]] = {}
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

        unit_stat = unit_map.setdefault(
            (subject_code, unit),
            {"subjectCode": subject_code, "subjectName": subject_name, "unit": unit, "answered": 0, "correct": 0},
        )
        unit_stat["answered"] += 1
        unit_stat["correct"] += 1 if is_correct else 0

    subject_stats = []
    for item in subject_map.values():
        item["score"] = _score(item["correct"], item["answered"])
        item["accuracy"] = item["score"]
        subject_stats.append(item)
    subject_stats.sort(key=lambda item: item["subjectCode"])

    type_stats = []
    for item in type_map.values():
        item["score"] = _score(item["correct"], item["answered"])
        type_stats.append(item)
    type_stats.sort(key=lambda item: item["type"])

    unit_stats = []
    for item in unit_map.values():
        item["score"] = _score(item["correct"], item["answered"])
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
        "memberId": normalized_member_id,
        "memberName": member["member_name"],
        "examCount": exam_count,
        "answeredTotal": answered_total,
        "correctTotal": correct_total,
        "wrongTotal": answered_total - correct_total,
        "averageScore": _score(correct_total, answered_total),
        "latestExamAt": latest_exam_at,
    }

    return {
        "summary": summary,
        "subjectStats": subject_stats,
        "typeStats": type_stats,
        "unitStats": unit_stats[:8],
        "examTrend": recent_exam_stats,
        "examHighlights": {
            "bestExam": best_exam,
            "weakestExam": weakest_exam,
        },
        "commentary": _bedrock_analysis_commentary(summary, subject_stats, type_stats) if include_commentary else [],
        "recommendations": [],
    }


def get_analysis_commentary(member_id: str) -> dict[str, Any]:
    analysis = get_analysis(member_id, include_commentary=True)
    return {"commentary": analysis["commentary"]}


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


def get_exam_history(member_id: str, limit: int = 20) -> dict[str, Any]:
    normalized_member_id = member_id.strip()
    if not normalized_member_id:
        raise HTTPException(status_code=400, detail="member_id is required")

    safe_limit = max(1, min(limit, 100))
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
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
                GROUP BY
                    e.exam_id, e.exam_round, e.exam_date, e.exam_time, e.created_at,
                    s.subject_code, s.subject_name, s.subject_description
                ORDER BY
                    e.exam_date DESC NULLS LAST,
                    e.exam_time DESC NULLS LAST,
                    e.created_at DESC NULLS LAST,
                    e.exam_id DESC
                LIMIT %s
                """,
                (normalized_member_id, safe_limit),
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

    return {"memberId": normalized_member_id, "items": items}


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
