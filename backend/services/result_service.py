from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from psycopg2.extras import RealDictCursor

from backend.services import bedrock_client
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
        "응시자의 DB 기반 풀이 통계를 보고 한국어로 짧고 구체적인 총평을 작성합니다. "
        "과장하지 말고, 점수와 취약 과목을 근거로 3~4문장만 출력하세요."
    )
    user_prompt = (
        "다음 JSON 통계를 바탕으로 총평을 작성하세요.\n"
        f"summary={summary}\n"
        f"subjectStats={subject_stats}\n"
        f"typeStats={type_stats}\n"
        "출력은 번호 없는 문장 목록으로만 작성하세요."
    )

    try:
        return _parse_bedrock_commentary(bedrock_client.invoke(system_prompt, user_prompt, max_tokens=700))
    except Exception:
        return _fallback_analysis_commentary(summary, subject_stats)


def get_analysis(member_id: str) -> dict[str, Any]:
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
                ORDER BY e.exam_date, e.exam_time, e.exam_id, h.exam_question_id
                """,
                (normalized_member_id,),
            )
            rows = cur.fetchall()

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
    answered_question_ids = set()

    for row in rows:
        subject_code = row["subject_code"]
        subject_name = row["subject_name"] or row["subject_description"] or subject_code
        selected = _to_int(row["selected_number"])
        answer = _to_int(row["answer_number"])
        correct = selected == answer
        question_type = _question_type(row)
        major_unit = row["major_unit"] or "미분류"
        answered_question_ids.add(str(row["question_id"]))

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
        subject["correct"] += 1 if correct else 0
        subject["wrong"] += 0 if correct else 1
        subject["latestExamAt"] = _created_at(row)

        type_stat = type_map.setdefault(question_type, {"type": question_type, "answered": 0, "correct": 0})
        type_stat["answered"] += 1
        type_stat["correct"] += 1 if correct else 0

        unit_key = (subject_code, major_unit)
        unit_stat = unit_map.setdefault(
            unit_key,
            {"subjectCode": subject_code, "subjectName": subject_name, "unit": major_unit, "answered": 0, "correct": 0},
        )
        unit_stat["answered"] += 1
        unit_stat["correct"] += 1 if correct else 0

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

    answered_total = sum(item["answered"] for item in subject_stats)
    correct_total = sum(item["correct"] for item in subject_stats)
    summary = {
        "memberId": normalized_member_id,
        "memberName": member["member_name"],
        "examCount": exam_count,
        "answeredTotal": answered_total,
        "correctTotal": correct_total,
        "wrongTotal": answered_total - correct_total,
        "averageScore": _score(correct_total, answered_total),
    }

    recommendations = _recommended_questions(
        member_id=normalized_member_id,
        subject_stats=subject_stats,
        unit_stats=unit_stats,
        answered_question_ids=answered_question_ids,
    )

    return {
        "summary": summary,
        "subjectStats": subject_stats,
        "typeStats": type_stats,
        "unitStats": unit_stats[:8],
        "commentary": _bedrock_analysis_commentary(summary, subject_stats, type_stats),
        "recommendations": recommendations,
    }


def _recommended_questions(
    member_id: str,
    subject_stats: list[dict[str, Any]],
    unit_stats: list[dict[str, Any]],
    answered_question_ids: set[str],
) -> list[dict[str, Any]]:
    if not subject_stats:
        return []

    weak_subject = min(subject_stats, key=lambda item: (item["score"], -item["answered"]))
    weak_units = [item["unit"] for item in unit_stats if item["subjectCode"] == weak_subject["subjectCode"]]
    weak_unit = weak_units[0] if weak_units else None
    exclude_ids = list(answered_question_ids)

    conditions = ["q.subject_code = %s"]
    params: list[Any] = [weak_subject["subjectCode"]]
    if weak_unit:
        conditions.append("q.major_unit = %s")
        params.append(weak_unit)
    if exclude_ids:
        conditions.append("q.question_id <> ALL(%s)")
        params.append(exclude_ids)

    where = " AND ".join(conditions)
    sql = f"""
        SELECT
            q.question_id,
            q.subject_code,
            s.subject_name,
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
            q.explanation
        FROM question_tb q
        JOIN subject_tb s ON s.subject_code = q.subject_code
        WHERE {where}
        ORDER BY RANDOM()
        LIMIT 3
    """

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

            if not rows and exclude_ids:
                conditions = ["q.subject_code = %s"]
                params = [weak_subject["subjectCode"]]
                if weak_unit:
                    conditions.append("q.major_unit = %s")
                    params.append(weak_unit)
                cur.execute(sql.replace(where, " AND ".join(conditions)), tuple(params))
                rows = cur.fetchall()

    return [
        {
            "questionId": row["question_id"],
            "subjectCode": row["subject_code"],
            "subjectName": row["subject_name"] or row["subject_code"],
            "majorUnit": row["major_unit"] or "-",
            "minorUnit": row["minor_unit"] or "-",
            "questionType": _question_type(row),
            "questionText": _question_text(row),
            "questionScenario": _question_scenario(row),
            "choices": [row["option_1"], row["option_2"], row["option_3"], row["option_4"], row["option_5"]],
            "answer": _to_int(row["answer_number"]),
            "explanation": row["explanation"] or "",
        }
        for row in rows
    ]


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
