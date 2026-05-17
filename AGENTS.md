# AGENTS.md — developer-competency-agent 프로젝트 지침

> AGENTS.md와 CLAUDE.md는 항상 동일한 내용을 유지한다. 지침이 바뀌면 두 파일을 함께 수정한다.

---

## 1. 프로젝트 목적

- 개발자의 자기 역량평가 진단 시험 대비용 AI Agent를 만든다.
- 최종 목표: PDF/교재 기반 문제 생성 → 문제 검증 → 문제은행 저장 → 출제 → 채점 → 피드백 → 약점 분석

---

## 2. 현재 폴더 역할

| 폴더 | 역할 |
|------|------|
| `backend/` | Python FastAPI 백엔드 코드 |
| `frontend/` | 프론트엔드 화면 코드 |
| `getdesign/` | 프론트엔드 디자인 참고용 md 파일 |
| `Practice Books/` | 문제 생성에 사용할 PDF 교재 원본 |

---

## 3. 기술 조건

- 백엔드: Python FastAPI
- PDF 텍스트 추출: PyMuPDF
- LLM 호출: Amazon Bedrock Runtime
- AWS SDK: boto3
- 실행 환경: Docker
- 운영: EC2 1대

---

## 4. AWS 사용 제약

- EC2와 Bedrock API 호출 중심으로 운영한다.
- S3는 나중에 백업 용도로만 고려한다.
- **사용 금지**: RDS, ECS, Lambda, ALB, API Gateway, DynamoDB, OpenSearch, CloudFront

---

## 5. 현재 구현 범위

- DB 청크 기반 문제 생성 Harness 파이프라인을 만든다.
- **frontend**: "문제 생성 및 Harness 실행" 버튼 + 결과 화면
- **backend**: DB 청크 조회 → Bedrock 호출 → 문제 생성 → Harness 검증 → 로그 저장 → API 응답
- 교재 원문은 EC2 호스트 PostgreSQL의 `ai_course_chunks` 테이블에서 가져온다.

---

## 6. 현재 제외할 기능

- 사용자 직접 텍스트 입력
- 랜덤 출제
- 중복 방지
- 문제 풀이
- 채점
- 사용자 풀이 기록
- 문제은행 DB 저장
- 로그인
- 오답노트
- 대시보드
- S3 백업

---

## 7. Harness Engineering 방향

Harness Engineering은 단순 JSON 검증이 아니다.
AI 문제 생성기를 안정적으로 운영하기 위한 **입력 통제, 출력 통제, 스키마 검증, 규칙 기반 검증, LLM-as-Judge 평가, 제한된 복구, 실행 로그 체계**로 본다.

- 생성된 문제는 Harness 검증을 통과해야 한다.
- 원문 근거가 약하거나 정답이 애매하면 실패 처리한다.
- Bedrock 무한 재시도는 금지한다.
- 실패 시 재시도는 최대 2회까지만 허용한다.

---

## 8. 개발 주의사항

- `frontend/`와 `backend/` 역할을 섞지 않는다.
- `getdesign/`의 md 파일은 프론트엔드 디자인 참고용으로만 사용한다.
- 문제 생성 소스는 DB(`ai_course_chunks`)를 기본으로 사용한다. PDF 직접 추출은 예외적 경우에만 허용한다.
- 비용을 늘리는 AWS Managed Service를 추가하지 않는다.
- Bedrock LLM 모델은 현재 Claude Sonnet 4.5만 사용한다. 기본값은 `global.anthropic.claude-sonnet-4-5-20250929-v1:0`이며, Haiku, Sonnet 4.6, Opus 등으로 임의 변경하지 않는다.
- Bedrock 응답을 그대로 신뢰하지 않는다.
- 실행 로그를 반드시 남긴다.

---

## 9. LLM 코딩 실수 방지 가이드라인

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 9.1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 9.2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 9.3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 9.4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```text
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 10. PostgreSQL 실행 구조

- 현재 EC2 호스트(`ip-172-31-11-148.ap-northeast-2.compute.internal`)에는 PostgreSQL 17이 호스트 OS 서비스로 설치되어 있고 실행 중이다.
- 백엔드/LLM 애플리케이션은 같은 EC2 인스턴스에서 Docker 컨테이너로 실행된다.
- 현재 실행 컨테이너는 `ai_hackathon-frontend-1`, `ai_hackathon-backend-1`이다.
- 구조는 "Docker 컨테이너 내부 백엔드 → 같은 EC2 호스트 OS의 PostgreSQL" 연결이다.
- `docker-compose.yml`에 PostgreSQL 컨테이너를 새로 추가하지 않는다.
- RDS, DynamoDB 등 AWS Managed DB 서비스는 사용하지 않는다.
- PostgreSQL 관련 설정은 백엔드 컨테이너가 호스트 PostgreSQL에 접속할 수 있도록 환경변수 중심으로 관리한다.
- DB 연결 정보, 스키마 초기화, 마이그레이션, 저장소 계층을 개발할 때는 이 실행 구조를 기준으로 설계한다.

---

## 11. ai_course_chunks DB 스키마 및 접속

### 11.1 접속 정보

| 항목 | 기본값 | 환경변수 |
|---|---|---|
| Host | `localhost` (Docker 컨테이너 → EC2 호스트 OS) | `DB_HOST` |
| Port | `5432` | `DB_PORT` |
| Database | `ai_question_db` | `DB_NAME` |
| User | `ai_user` | `DB_USER` |
| Password | `1234` | `DB_PASSWORD` |

- Docker 컨테이너에서 호스트 PostgreSQL에 접속할 때는 `DB_HOST=host-gateway` 또는 EC2 내부 IP를 환경변수로 주입한다.
- psql 직접 접속: `PGPASSWORD=1234 psql -h localhost -p 5432 -U ai_user -d ai_question_db`

### 11.2 ai_course_chunks 테이블

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| `id` | `BIGSERIAL` | 청크 고유 ID (PK) |
| `chapter_no` | `INT` | Chapter 번호 |
| `chapter_title` | `VARCHAR(100)` | Chapter 제목 |
| `section_no` | `INT` | Section 번호 |
| `section_title` | `VARCHAR(150)` | Section 제목 |
| `chunk_no` | `INT` | Section 내 청크 순번 |
| `chunk_title` | `VARCHAR(200)` | 청크 제목 |
| `chunk_content` | `TEXT` | 문제 생성에 사용하는 교재 본문 |
| `page_start` | `INT` | PDF 기준 시작 페이지 |
| `page_end` | `INT` | PDF 기준 종료 페이지 |
| `tags` | `TEXT[]` | 청크 태그 배열 |
| `question_count` | `INT` | 해당 청크로 문제 생성한 횟수 (기본값 0) |
| `last_question_at` | `TIMESTAMP` | 마지막 문제 생성 시각 |
| `created_at` | `TIMESTAMP` | 생성 시각 |
| `updated_at` | `TIMESTAMP` | 수정 시각 |

- UNIQUE 제약: `(chapter_no, section_no, chunk_no)`
- 적재 현황: Section 24개, Chunk 266개

### 11.3 DB 접속 코드 위치

| 파일 | 역할 |
|---|---|
| `backend/services/db.py` | psycopg2 커넥션 관리, `get_conn()` context manager, `check_connection()` |
| `backend/services/chunk_repository.py` | `ai_course_chunks` CRUD 함수 전체 |
| `backend/models/schemas.py` | `ChunkInfo` Pydantic 모델 |

주요 함수:
- `get_chunk_by_id(chunk_id)` — ID로 청크 1건 조회
- `get_chunks_by_chapter(chapter_no)` — 챕터 전체 청크 목록
- `get_chunks_by_section(chapter_no, section_no)` — 섹션 청크 목록
- `get_least_used_chunk(chapter_no, section_no)` — `question_count` 최소 청크 선택 (균형 출제)
- `increment_question_count(chunk_id)` — PASS 후 카운터 및 `last_question_at` 갱신
- `get_chapter_list()` — 챕터 목록 + 청크 수
- `get_stats()` — 전체 통계

### 11.4 문제 생성 소스 우선순위

`POST /generate` 요청 시 소스 선택 우선순위:

| 우선순위 | 조건 | 동작 |
|---|---|---|
| 1 | `chunk_id` 지정 | 해당 청크 직접 사용 |
| 2 | `chapter_no` 지정 | 해당 챕터(+`section_no` 선택) 중 `question_count` 최소 청크 자동 선택 |
| 3 | 파라미터 없음 (기본값) | DB 전체에서 `question_count` 최소 청크 자동 선택 |
| 4 | `pdf_filename` 지정 | PDF 직접 추출 (예외적 사용) |

- PASS 판정 시 해당 청크의 `question_count` +1, `last_question_at` NOW()로 갱신
- DB 청크가 없는 경우 즉시 FAIL 처리 (무한 재시도 없음)

---

## 12. questions / question_solve_history 테이블 및 퀴즈 API

### 12.1 questions 테이블

생성된 객관식 문제를 저장한다. AI 교재 기반(`COURSE_CHUNK`) 외 `MANUAL`, `AWS` 등 다양한 출처의 문제를 통합 저장한다.

| 컬럼명 | 설명 |
|---|---|
| `id` | 문제 고유 ID |
| `category` | 대분류 (`AI`, `AWS`, `SQL`, `Python` 등) |
| `sub_category` | 세부 분류 |
| `source_type` | 출처 (`COURSE_CHUNK`, `MANUAL`, `AWS`) |
| `source_id` | 원천 데이터 ID (교재 기반이면 `ai_course_chunks.id`) |
| `question_text` | 문제 본문 |
| `option_1` ~ `option_4` | 보기 1~4번 |
| `correct_option_no` | 정답 번호 (1~4) |
| `explanation` | 해설 |
| `difficulty` | 난이도 (`medium`, `hard`) |
| `tags` | 태그 배열 |
| `solved_count` | 총 풀린 횟수 |
| `correct_count` | 총 정답 횟수 |
| `is_active` | 사용 여부 |
| `created_at` / `updated_at` | 생성/수정 시각 |

### 12.2 question_solve_history 테이블

| 컬럼명 | 설명 |
|---|---|
| `id` | 풀이 기록 고유 ID |
| `user_id` | 사용자 ID |
| `question_id` | `questions.id` 참조 |
| `selected_option_no` | 사용자 선택 번호 (1~4) |
| `is_correct` | 정답 여부 |
| `elapsed_seconds` | 풀이 소요 시간 |
| `created_at` | 기록 시각 |

### 12.3 퀴즈 API

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/quiz` | 문제 1건 조회 (정답 미포함). `question_id`, `category`, `difficulty` 선택 지정. 미지정 시 `solved_count` 최소 문제 자동 선택 |
| `POST` | `/solve` | 정답 제출. 채점 + `question_solve_history` 기록 + `questions` 통계 갱신 |

### 12.4 퀴즈 관련 코드 위치

| 파일 | 역할 |
|---|---|
| `backend/services/question_repository.py` | `questions`, `question_solve_history` CRUD |
| `backend/routers/quiz.py` | `/quiz`, `/solve` 엔드포인트 |
| `backend/models/schemas.py` | `QuizRequest`, `QuizResponse`, `SolveRequest`, `SolveResponse` |

- `get_question_by_id(question_id)` — ID로 특정 문제 조회
- `get_random_active_question(category, difficulty)` — 랜덤 문제 조회
- `get_least_solved_question(category, difficulty)` — `solved_count` 최소 문제 (균등 출제)
- `update_solve_stats(question_id, is_correct)` — 풀이 후 통계 갱신
- `record_solve_history(...)` — 풀이 기록 저장
- `get_user_history(user_id, limit)` — 사용자 풀이 이력 조회
- `get_category_list()` — 활성 카테고리 목록
