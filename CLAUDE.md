# CLAUDE.md — developer-competency-agent 프로젝트 지침

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

- PDF 기반 문제 생성 Harness 파이프라인을 만든다.
- **frontend**: "PDF 기반 문제 생성 및 Harness 실행" 버튼 + 결과 화면
- **backend**: PDF 추출 → Bedrock 호출 → 문제 생성 → Harness 검증 → 로그 저장 → API 응답

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
- 실패 시 재시도는 최대 1회까지만 허용한다.

---

## 8. 개발 주의사항

- `frontend/`와 `backend/` 역할을 섞지 않는다.
- `getdesign/`의 md 파일은 프론트엔드 디자인 참고용으로만 사용한다.
- `Practice Books/`의 PDF를 문제 생성 소스로 사용한다.
- 비용을 늘리는 AWS Managed Service를 추가하지 않는다.
- Bedrock LLM 모델은 반드시 Claude Sonnet 4만 사용한다. 기본값은 `apac.anthropic.claude-sonnet-4-20250514-v1:0`이며, Haiku, Sonnet 4.5, Sonnet 4.6, Opus 등으로 임의 변경하지 않는다.
- Bedrock 응답을 그대로 신뢰하지 않는다.
- 실행 로그를 반드시 남긴다.
