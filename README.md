# Developer Competency Agent

PDF 교재 기반 문제 생성 · Harness 검증 AI Agent

## 프로젝트 구조

```
developer-competency-agent/
├── backend/              # Python FastAPI 백엔드
│   ├── main.py
│   ├── routers/
│   ├── services/
│   ├── models/
│   ├── logs/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/             # 순수 HTML/CSS/JS 프론트엔드
│   ├── index.html
│   ├── style.css
│   └── app.js
├── getdesign/            # 디자인 참고 문서
├── Practice Books/       # PDF 교재 원본
├── docker-compose.yml
├── AGENTS.md
├── CLAUDE.md
└── plan.md
```

---

## 사전 준비

### 1. AWS 자격증명 설정

루트 디렉토리에 `.env` 파일을 생성합니다.

```bash
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
BEDROCK_MODEL_ID=global.anthropic.claude-opus-4-8
```

> AWS IAM 계정에 `AmazonBedrockFullAccess` 권한이 필요합니다.  
> Bedrock 콘솔에서 해당 모델의 **Model access**를 활성화해야 합니다.

---

## 실행 방법

### 방법 A — 로컬 직접 실행 (개발용)

```bash
# 1. 의존성 설치
pip install -r backend/requirements.txt

# 2. 서버 실행 (프로젝트 루트에서)
uvicorn backend.main:app --reload --port 8000
```

### 방법 B — Docker Compose

```bash
docker compose up --build
```

---

## API 테스트

서버가 실행 중이면 아래 방법으로 테스트합니다.

### 1. 헬스체크

```bash
curl http://localhost:8000/health
```

**응답:**
```json
{"status": "ok"}
```

### 2. 문제 생성 (기본 — PDF 전체에서 1~15페이지)

```bash
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 3. 문제 생성 (페이지 범위 지정)

```bash
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"page_start": 10, "page_end": 30}'
```

### 4. Swagger UI (브라우저)

```
http://localhost:8000/docs
```

FastAPI 내장 Swagger UI에서 직접 요청을 보내고 응답을 확인할 수 있습니다.

---

## 응답 예시

```json
{
  "run_id": "a1b2c3d4-...",
  "final_status": "PASS",
  "question": "다음 중 머신러닝에서 과적합을 방지하는 방법으로 옳은 것은?",
  "choices": [
    "학습 데이터를 늘린다",
    "모델의 복잡도를 높인다",
    "에포크 수를 무한히 늘린다",
    "검증 데이터를 사용하지 않는다",
    "모든 특성을 그대로 사용한다"
  ],
  "answer": 1,
  "explanation": "학습 데이터를 늘리면 모델이 더 일반화된 패턴을 학습할 수 있어 과적합을 방지할 수 있다...",
  "difficulty": "medium",
  "tags": ["머신러닝", "과적합", "정규화"],
  "source_summary": "교재 XX페이지: 과적합 방지 기법 설명",
  "rule_validation_result": {
    "passed": true,
    "errors": []
  },
  "judge_result": {
    "passed": true,
    "score": 0.8,
    "checks": {
      "grounded_in_source": true,
      "single_correct_answer": true,
      "choices_are_valid": true,
      "explanation_is_sufficient": true,
      "no_hallucination": false
    },
    "reasons": []
  },
  "recovery_used": false,
  "retry_count": 0,
  "log_ref": "backend/logs/run_a1b2c3d4-....json"
}
```

---

## Harness 파이프라인

```
PDF 추출 → Bedrock 호출 → JSON 파싱 → 스키마 검증
→ Rule Validation → LLM-as-Judge → Recovery(최대 1회) → 로그 저장 → 응답
```

| 단계 | 설명 |
|------|------|
| PDF 추출 | PyMuPDF로 지정 페이지 텍스트 추출 |
| Bedrock 호출 | Claude Opus로 5지선다 문제 생성 |
| Rule Validation | 선택지 5개, 정답 범위, 해설 길이 등 규칙 검사 |
| LLM-as-Judge | 원문 근거·단일정답·선택지 유효성 등 5개 항목 평가 |
| Recovery | Rule/Judge 실패 시 최대 1회 재시도 |
| 로그 저장 | `backend/logs/run_<uuid>.json` |

---

## 프론트엔드 실행

별도 서버 없이 브라우저에서 바로 열 수 있습니다.

```
frontend/index.html  →  브라우저로 열기
```

버튼 클릭 시 `http://localhost:8000/generate`를 호출하고 결과를 화면에 표시합니다.

---

## 앞으로의 방향

### 단기 (다음 구현)
- **문제은행 저장** — 생성·검증 통과한 문제를 SQLite에 누적 저장
- **문제 풀기 화면** — 저장된 문제를 화면에 출제하고 정답 선택
- **채점 및 즉시 피드백** — 제출 시 정오 여부와 해설 표시

### 중기
- **랜덤 출제 & 중복 방지** — 문제은행에서 태그·난이도 기반 랜덤 추출, 이미 푼 문제 제외
- **오답노트** — 틀린 문제 자동 저장 및 재출제
- **약점 분석** — 태그별 정답률 집계, 취약 영역 리포트

### 장기
- **대시보드** — 학습 이력·정답률·진도 시각화
- **다중 PDF 지원** — 교재 여러 권 등록 및 선택 출제
- **S3 백업** — 문제은행·로그 주기적 백업

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 백엔드 | Python 3.12, FastAPI |
| PDF 추출 | PyMuPDF |
| LLM | Amazon Bedrock (Claude Opus) |
| AWS SDK | boto3 |
| 실행 환경 | Docker / EC2 |
| 프론트엔드 | HTML, CSS, JavaScript |
