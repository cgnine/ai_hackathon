from __future__ import annotations

from collections import Counter, defaultdict
from copy import deepcopy

from fastapi import HTTPException


DIAGNOSIS_AREAS = [
    "RAG / 검색",
    "프롬프트 설계",
    "출력 검증",
    "LLM 평가",
    "운영 안정성",
]

AREA_GUIDANCE = {
    "RAG / 검색": {
        "strong": "검색 근거를 생성 입력에 연결하는 흐름을 안정적으로 이해하고 있습니다.",
        "weak": "검색 품질, chunk 설계, 재랭킹의 역할을 다시 정리할 필요가 있습니다.",
        "recommend": "chunking → embedding → retrieval → reranking 순서로 RAG 검색 흐름을 복습하세요.",
    },
    "프롬프트 설계": {
        "strong": "역할, 제약 조건, 출력 형식을 프롬프트에 구조화하는 감각이 좋습니다.",
        "weak": "프롬프트의 제한 조건과 복구 지시를 명확히 설계하는 연습이 필요합니다.",
        "recommend": "시스템 역할, 금지 사항, JSON 출력 형식, 복구 조건을 한 묶음으로 정리하세요.",
    },
    "출력 검증": {
        "strong": "스키마 검증과 규칙 기반 검증의 필요성을 잘 이해하고 있습니다.",
        "weak": "정답 범위, 보기 개수, 해설 근거처럼 출력 품질을 막는 검증 기준을 보완해야 합니다.",
        "recommend": "JSON Schema 검증 항목과 rule validation 항목을 분리해서 체크리스트로 만들어보세요.",
    },
    "LLM 평가": {
        "strong": "LLM-as-Judge를 운영할 때 기준과 로그가 필요하다는 점을 잘 파악하고 있습니다.",
        "weak": "Judge 결과를 해석하고 오판 가능성을 통제하는 운영 원칙 복습이 필요합니다.",
        "recommend": "평가 기준, 실패 이유, 샘플 검증, 모니터링 지표를 함께 정리하세요.",
    },
    "운영 안정성": {
        "strong": "재시도 제한, 로그 관리, EC2 운영 제약을 안정적으로 이해하고 있습니다.",
        "weak": "비용 통제, 실패 로그, 제한된 복구 전략을 더 구체적으로 정리해야 합니다.",
        "recommend": "Bedrock 호출 실패 시나리오별로 retry, fail, log 정책을 표로 정리하세요.",
    },
}


def _item(
    question_id: str,
    area: str,
    question_text: str,
    choices: list[str],
    answer: int,
    selected: int | None,
    explanation: str,
    difficulty: str = "중",
    question_type: str = "실무형",
) -> dict:
    return {
        "questionId": question_id,
        "questionText": question_text,
        "choices": choices,
        "difficulty": difficulty,
        "questionType": question_type,
        "diagnosisArea": area,
        "selected": selected,
        "answer": answer,
        "correct": selected == answer,
        "explanation": explanation,
    }


DEMO_ITEMS = [
    _item("ai-rag-001", "RAG / 검색", "RAG 시스템에서 검색 단계의 주된 목적은 무엇인가요?", ["모델 파라미터를 수정한다", "관련 근거 문서를 제공한다", "GPU 온도를 제어한다", "CSS를 최적화한다"], 2, 2, "검색 단계는 생성 모델이 답변에 활용할 근거 문서를 찾아 입력에 포함시키는 역할을 합니다.", question_type="자격증연계형"),
    _item("ai-rag-002", "RAG / 검색", "검색 품질을 높이기 위한 방법으로 가장 적절한 것은 무엇인가요?", ["문서를 무작위로 섞는다", "쿼리 확장과 메타데이터 필터를 활용한다", "검색 결과를 항상 1개만 쓴다", "해설을 삭제한다"], 2, 1, "쿼리 확장, 메타데이터 필터, 재랭킹은 질문과 더 관련 있는 근거를 찾는 데 도움을 줍니다."),
    _item("ai-rag-003", "RAG / 검색", "임베딩 기반 검색에서 chunk 크기를 조절하는 주된 이유는 무엇인가요?", ["근거 단위의 맥락과 검색 정확도의 균형을 맞추기 위해", "모델 호출을 완전히 없애기 위해", "브라우저 캐시를 지우기 위해", "정답 번호를 숨기기 위해"], 1, 1, "chunk가 너무 작으면 맥락이 부족하고 너무 크면 검색 정밀도가 떨어질 수 있어 균형이 중요합니다."),
    _item("ai-rag-004", "RAG / 검색", "재랭킹 reranking을 사용하는 목적은 무엇인가요?", ["후보 문서의 관련도 순서를 다시 정교하게 정렬하기 위해", "JSON 문법을 제거하기 위해", "EC2 인스턴스를 늘리기 위해", "사용자 로그인을 처리하기 위해"], 1, 3, "재랭킹은 1차 검색 후보를 더 정교한 기준으로 다시 정렬해 최종 근거 품질을 높입니다.", difficulty="상"),
    _item("ai-prompt-001", "프롬프트 설계", "문제 생성 프롬프트에 출력 JSON 형식을 명시하는 이유는 무엇인가요?", ["응답 구조를 안정적으로 후처리하기 위해", "모든 보기를 정답으로 만들기 위해", "PDF 추출을 생략하기 위해", "네트워크 비용을 없애기 위해"], 1, 1, "출력 구조를 명시하면 파서와 스키마 검증이 쉬워지고 후속 처리 안정성이 높아집니다."),
    _item("ai-prompt-002", "프롬프트 설계", "좋은 시스템 프롬프트에 포함될 내용으로 적절한 것은 무엇인가요?", ["역할, 제한 조건, 출력 형식, 금지 사항", "사용자 비밀번호", "무한 재시도 지시", "임의의 외부 서비스 추가"], 1, 1, "시스템 프롬프트는 모델의 역할과 출력 제약, 안전 규칙을 명확하게 고정해야 합니다.", question_type="이론형"),
    _item("ai-prompt-003", "프롬프트 설계", "프롬프트에 원문 근거만 사용하라고 지시하는 이유는 무엇인가요?", ["환각과 임의 추론을 줄이기 위해", "문항 수를 0개로 만들기 위해", "CSS 스타일을 고정하기 위해", "로그 저장을 방지하기 위해"], 1, 2, "원문 근거 중심 지시는 모델이 교재 밖 내용을 섞어 문제를 만드는 위험을 줄입니다."),
    _item("ai-prompt-004", "프롬프트 설계", "복구 프롬프트를 사용할 때 적절한 방식은 무엇인가요?", ["실패 원인을 알려주고 제한된 횟수만 재생성한다", "성공할 때까지 무한 반복한다", "검증을 모두 끈다", "정답을 랜덤으로 바꾼다"], 1, 1, "복구는 실패 원인을 반영하되 비용과 장애 확산을 막기 위해 제한된 횟수만 수행해야 합니다.", difficulty="상"),
    _item("ai-output-001", "출력 검증", "LLM 출력을 JSON 스키마로 검증해야 하는 이유는 무엇인가요?", ["속도만 높이기 위해", "구조화된 출력과 후처리 안정성을 확보하기 위해", "프롬프트를 제거하기 위해", "로그를 없애기 위해"], 2, 2, "스키마 검증은 불완전한 모델 응답이 시스템에 그대로 들어가는 것을 막습니다."),
    _item("ai-output-002", "출력 검증", "문제 생성 결과에서 정답 번호가 1~5 범위를 벗어나면 어떻게 처리해야 하나요?", ["실패 처리하고 복구 대상에 포함한다", "무조건 1번으로 바꾼다", "사용자에게 숨긴다", "채점에서 제외하지 않고 통과시킨다"], 1, 1, "정답 번호 범위 오류는 채점 신뢰성을 깨뜨리므로 실패로 보고 제한된 복구를 시도해야 합니다."),
    _item("ai-output-003", "출력 검증", "보기 개수가 요구 형식과 다를 때 필요한 검증은 무엇인가요?", ["스키마 또는 규칙 기반 검증", "이미지 압축", "로그 삭제", "랜덤 출제"], 1, 4, "보기 개수는 문제 형식의 핵심 조건이므로 스키마와 규칙 검증에서 반드시 확인해야 합니다."),
    _item("ai-output-004", "출력 검증", "해설이 너무 짧거나 원문 근거가 없을 때 적절한 판단은 무엇인가요?", ["근거 부족으로 실패 처리한다", "무조건 합격 처리한다", "선택지를 삭제한다", "정답을 숨긴다"], 1, 1, "해설은 정답 근거를 설명해야 하며 근거가 약하면 문제 품질을 신뢰하기 어렵습니다.", question_type="자격증연계형"),
    _item("ai-judge-001", "LLM 평가", "LLM-as-Judge를 사용할 때 중요한 운영 원칙은 무엇인가요?", ["평가 기준을 고정하고 결과를 모니터링한다", "항상 통과시킨다", "규칙 검증을 제거한다", "점수만 저장하고 이유는 버린다"], 1, 1, "Judge도 모델이므로 고정된 기준, 이유 기록, 샘플 검증, 모니터링이 함께 필요합니다."),
    _item("ai-judge-002", "LLM 평가", "Judge 결과를 그대로 맹신하면 안 되는 이유는 무엇인가요?", ["Judge도 오판할 수 있기 때문에", "항상 비용이 0원이기 때문에", "정답이 자동으로 사라지기 때문에", "PDF 추출이 불가능하기 때문에"], 1, 2, "LLM-as-Judge 역시 모델 출력이므로 오류 가능성을 전제로 규칙 검증과 로그 확인을 병행해야 합니다."),
    _item("ai-judge-003", "LLM 평가", "문제의 원문 근거성을 평가할 때 확인해야 할 것은 무엇인가요?", ["문제와 해설이 제공된 원문 내용에 기반하는지", "버튼 색상이 노란색인지", "EC2 리전이 어디인지", "사용자 이름이 긴지"], 1, 1, "원문 근거성 평가는 생성된 문제와 해설이 실제 추출 텍스트에 기반하는지 확인합니다."),
    _item("ai-judge-004", "LLM 평가", "Judge 평가 로그에 남기면 좋은 정보는 무엇인가요?", ["평가 점수, 통과 여부, 실패 이유", "브라우저 확대 비율", "CSS 클래스 전체", "사용자 마우스 위치"], 1, 3, "평가 점수와 실패 이유를 남겨야 문제 생성 품질을 추적하고 개선할 수 있습니다.", difficulty="상"),
    _item("ai-ops-001", "운영 안정성", "Bedrock 호출 실패 시 적절한 복구 전략은 무엇인가요?", ["무한 재시도한다", "제한된 횟수만 재시도하고 실패 로그를 남긴다", "성공으로 처리한다", "검증을 건너뛴다"], 2, 2, "무한 재시도는 비용과 장애를 키우므로 제한된 복구와 명확한 실패 처리가 필요합니다."),
    _item("ai-ops-002", "운영 안정성", "실행 로그를 남겨야 하는 주된 이유는 무엇인가요?", ["실패 원인과 생성 과정을 추적하기 위해", "문제를 숨기기 위해", "PDF를 삭제하기 위해", "네트워크를 차단하기 위해"], 1, 1, "로그는 입력, 검증 결과, 복구 횟수, 최종 상태를 추적해 운영 안정성을 높입니다."),
    _item("ai-ops-003", "운영 안정성", "AI 문제 생성 파이프라인에서 비용 폭증을 막는 방법은 무엇인가요?", ["재시도 횟수와 입력 범위를 제한한다", "모든 PDF 전체를 매번 호출한다", "실패를 성공으로 처리한다", "로그를 남기지 않는다"], 1, 4, "입력 범위와 재시도 횟수를 제한해야 LLM 호출 비용과 지연 시간을 통제할 수 있습니다."),
    _item("ai-ops-004", "운영 안정성", "EC2 1대 운영 환경에서 우선 고려할 사항은 무엇인가요?", ["애플리케이션 로그와 프로세스 재시작 전략", "RDS 클러스터 추가", "CloudFront 배포 필수화", "DynamoDB 저장소 전환"], 1, 1, "현재 제약에서는 EC2 중심 운영이므로 로그, 프로세스 관리, 장애 시 재시작 전략이 중요합니다.", question_type="운영형"),
]


def _score_axes(items: list[dict]) -> list[dict]:
    axes = []
    for area in DIAGNOSIS_AREAS:
        area_items = [item for item in items if item["diagnosisArea"] == area]
        correct = sum(1 for item in area_items if item["correct"])
        total = len(area_items)
        score = round((correct / total) * 100) if total else 0
        axes.append({"name": area, "score": score, "correct": correct, "total": total})
    return axes


def _topic_marker(text: str) -> str:
    code = ord(text[-1])
    if 0xAC00 <= code <= 0xD7A3 and (code - 0xAC00) % 28 != 0:
        return "은"
    return "는"


def _build_diagnosis(items: list[dict]) -> dict:
    axes = _score_axes(items)
    weakest = min(axes, key=lambda axis: axis["score"])
    strongest = max(axes, key=lambda axis: axis["score"])
    wrong_items = [item for item in items if not item["correct"]]
    wrong_counts = Counter(item["diagnosisArea"] for item in wrong_items)
    wrong_questions_by_area: dict[str, list[str]] = defaultdict(list)
    for item in wrong_items:
        wrong_questions_by_area[item["diagnosisArea"]].append(item["questionText"])

    strengths = [
        f"{axis['name']}{_topic_marker(axis['name'])} {axis['score']}점({axis['correct']}/{axis['total']})으로 안정적입니다. "
        f"{AREA_GUIDANCE[axis['name']]['strong']}"
        for axis in axes
        if axis["score"] >= 75
    ]
    if not strengths:
        strengths = ["이번 응시는 뚜렷한 강점 영역보다 전반적인 기본기 보완이 더 중요합니다."]

    weaknesses = [
        f"{axis['name']}{_topic_marker(axis['name'])} {axis['score']}점({axis['correct']}/{axis['total']})입니다. "
        f"{AREA_GUIDANCE[axis['name']]['weak']}"
        for axis in axes
        if axis["score"] < 60
    ]
    if not weaknesses:
        weaknesses = ["60점 미만 영역은 없지만, 틀린 문항의 선택지를 다시 비교하면 점수를 더 안정화할 수 있습니다."]

    focus_areas = [area for area, _ in wrong_counts.most_common(2)]
    recommendations = []
    for area in focus_areas:
        samples = wrong_questions_by_area[area][:2]
        sample_text = " / ".join(samples)
        recommendations.append(
            f"{area}: {AREA_GUIDANCE[area]['recommend']} 오답 문항 예시는 {sample_text}입니다."
        )
    if not recommendations:
        recommendations = ["이번 시험은 오답이 없습니다. 같은 영역의 난도를 높여 실전 감각을 점검하세요."]

    return {
        "axes": axes,
        "summary": (
            f"이번 시험에서는 {strongest['name']} 영역이 {strongest['score']}점으로 가장 안정적이고, "
            f"{weakest['name']} 영역이 {weakest['score']}점으로 우선 복습 대상입니다. "
            f"오답은 총 {len(wrong_items)}문항이며, 오답이 많은 영역부터 복습하는 것이 효율적입니다."
        ),
        "strengths": strengths,
        "weaknesses": weaknesses,
        "recommendations": recommendations,
    }


def _build_demo_result() -> dict:
    correct_count = sum(1 for item in DEMO_ITEMS if item["correct"])
    total = len(DEMO_ITEMS)
    return {
        "attemptId": "demo-attempt",
        "profileName": "김우찬",
        "subjectId": "ai-engineering",
        "subjectName": "AI Engineering",
        "score": round((correct_count / total) * 100),
        "correctCount": correct_count,
        "total": total,
        "diagnosis": _build_diagnosis(DEMO_ITEMS),
        "items": DEMO_ITEMS,
    }


MOCK_RESULTS = {"demo-attempt": _build_demo_result()}


def get_result(attempt_id: str) -> dict:
    result = MOCK_RESULTS.get(attempt_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Result not found")
    return deepcopy(result)


def get_wrong_items(attempt_id: str) -> dict:
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
