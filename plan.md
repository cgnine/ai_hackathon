# plan.md — developer-competency-agent 현재 단계 계획

---

## 1. 프로젝트 최종 목표

개발자 자기 역량평가 진단 시험 대비용 AI Agent를 완성한다.

PDF/교재 기반 문제 생성 → 문제 검증 → 문제은행 저장 → 랜덤 출제 → 채점 → 피드백 → 약점 분석까지 단계적으로 확장한다.

---

## 2. 현재 단계 목표

**PDF 기반 문제 생성 Harness 파이프라인 MVP**를 완성한다.

- `Practice Books/` 안의 PDF에서 텍스트를 추출한다.
- Amazon Bedrock으로 객관식 5지선다 문제 1개를 생성한다.
- Harness 파이프라인(스키마 검증 → Rule Validation → LLM-as-Judge → Recovery)을 실행한다.
- 결과를 frontend 화면에 표시한다.
- 실행 로그를 파일로 저장한다.

---

## 3. frontend에서 만들 것

- `frontend/index.html` : 메인 화면
- `frontend/style.css` : 스타일
- `frontend/app.js` : fetch 호출 및 결과 렌더링

화면 구성:
- 헤더: 프로젝트 이름
- 버튼: "PDF 기반 문제 생성 및 Harness 실행"
- 로딩 상태 표시 (스피너)
- 결과 패널:
  - run_id, PASS/FAIL 뱃지
  - 문제 텍스트
  - 선택지 5개 (정답 강조)
  - 정답 번호, 해설
  - 난이도, 태그, source_summary
  - Rule Validation 결과
  - LLM Judge 결과 (점수, checks, reasons)
  - recovery_used, retry_count, log_ref

---

## 4. backend에서 만들 것

```
backend/
├── main.py
├── routers/
│   └── generate.py
├── services/
│   ├── pdf_extractor.py    # PyMuPDF 텍스트 추출
│   ├── bedrock_client.py   # boto3 Bedrock Runtime 호출
│   ├── question_parser.py  # LLM 응답 JSON 파싱
│   ├── rule_validator.py   # 규칙 기반 검증
│   ├── llm_judge.py        # LLM-as-Judge 평가
│   └── harness.py          # 파이프라인 조율
├── models/
│   └── schemas.py
├── logs/
├── requirements.txt
└── Dockerfile
```

API:
- `GET /health`
- `POST /generate`

---

## 5. 현재 만들지 않을 것

- 사용자 직접 텍스트 입력
- 랜덤 출제 / 중복 방지
- 문제 풀이 / 채점 / 풀이 기록
- 문제은행 DB 저장
- 로그인 / 오답노트 / 대시보드
- S3 백업

---

## 6. frontend ↔ backend 통신 방식

- frontend: `fetch('http://localhost:8000/generate', { method: 'POST', ... })`
- backend: FastAPI + `CORSMiddleware` (모든 origin 허용, 개발 단계)
- 요청 Content-Type: `application/json`
- 응답 Content-Type: `application/json`

POST /generate 요청 Body (선택):
```json
{
  "pdf_filename": "string",
  "page_start": 1,
  "page_end": 10
}
```

POST /generate 응답 Body:
```json
{
  "run_id": "uuid",
  "final_status": "PASS | FAIL",
  "question": "string",
  "choices": ["string", "string", "string", "string", "string"],
  "answer": 1,
  "explanation": "string",
  "difficulty": "easy | medium | hard",
  "tags": ["string"],
  "source_summary": "string",
  "rule_validation_result": { "passed": true, "errors": [] },
  "judge_result": {
    "passed": true,
    "score": 0.85,
    "checks": {
      "grounded_in_source": true,
      "single_correct_answer": true,
      "choices_are_valid": true,
      "explanation_is_sufficient": true,
      "no_hallucination": true
    },
    "reasons": []
  },
  "recovery_used": false,
  "retry_count": 0,
  "log_ref": "logs/run_<uuid>.json"
}
```

---

## 7. Harness 파이프라인 개요

```
[입력 통제]
  → PDF 존재 여부 확인
  → 페이지 범위 유효성 검사

[PDF 추출]
  → PyMuPDF로 지정 페이지 텍스트 추출

[Bedrock 호출 1차]
  → Claude Opus로 문제 생성 요청

[출력 파싱]
  → 응답에서 JSON 블록 추출

[스키마 검증]
  → Pydantic으로 필드 존재/타입 확인

[Rule Validation]
  → 선택지 5개 존재 여부
  → answer 범위 (1~5)
  → explanation 최소 길이
  → difficulty 유효값
  → tags 존재 여부

[LLM-as-Judge]
  → 별도 Bedrock 호출
  → grounded_in_source / single_correct_answer / choices_are_valid /
     explanation_is_sufficient / no_hallucination 5개 항목 평가
  → score 계산 (0.0 ~ 1.0)

[Recovery]
  → Rule 또는 Judge 실패 시 최대 1회 재시도
  → 재시도 후에도 실패하면 FAIL 확정

[로그 저장]
  → run_id 기준 JSON 로그 파일 (logs/run_<uuid>.json)

[응답 반환]
  → final_status: PASS | FAIL 포함 전체 결과 JSON
```

---

## 8. 문제 생성 결과 목표 Schema

```json
{
  "question": "string",
  "choices": ["string", "string", "string", "string", "string"],
  "answer": 1,
  "explanation": "string",
  "difficulty": "easy | medium | hard",
  "tags": ["string"],
  "source_summary": "string"
}
```

---

## 9. LLM Judge 결과 목표 Schema

```json
{
  "passed": true,
  "score": 0.0,
  "checks": {
    "grounded_in_source": true,
    "single_correct_answer": true,
    "choices_are_valid": true,
    "explanation_is_sufficient": true,
    "no_hallucination": true
  },
  "reasons": ["string"]
}
```

---

## 10. 이후 확장 후보

| 기능 | 비고 |
|------|------|
| 문제은행 DB 저장 | SQLite 또는 파일 기반으로 시작 |
| 랜덤 출제 | 문제은행 구축 후 |
| 중복 방지 | run_id 기반 해시 비교 |
| 문제 풀이 / 채점 | frontend 확장 |
| 약점 분석 | 태그 기반 오답 집계 |
| S3 백업 | 로그 파일 주기적 업로드 |
| 대시보드 | 통계 시각화 |

---

## 11. 개발 우선순위

1. 루트 문서 (AGENTS.md, CLAUDE.md, plan.md)
2. `backend/models/schemas.py`
3. `backend/services/pdf_extractor.py`
4. `backend/services/bedrock_client.py`
5. `backend/services/question_parser.py`
6. `backend/services/rule_validator.py`
7. `backend/services/llm_judge.py`
8. `backend/services/harness.py`
9. `backend/routers/generate.py` + `backend/main.py`
10. `backend/requirements.txt` + `backend/Dockerfile`
11. `frontend/index.html` + `frontend/style.css` + `frontend/app.js`
