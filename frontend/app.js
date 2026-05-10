const API_BASE = "";

function makeQuestions(rows) {
  return rows.map(([difficulty, text, choices, answer, explanation]) => ({
    difficulty,
    text,
    choices,
    answer,
    explanation
  }));
}

function makeCodingQuestions(rows) {
  return rows.map(([difficulty, text, sampleSolution, keywords, explanation]) => ({
    type: "coding",
    difficulty,
    text,
    sampleSolution,
    keywords,
    explanation
  }));
}

const subjects = [
  {
    id: "ai-engineering",
    name: "AI Engineering",
    desc: "LLM, RAG, 프롬프트, 평가, MLOps, 안전성",
    questions: makeQuestions([
      ["하", "RAG 시스템에서 검색 단계의 주된 목적은 무엇인가?", ["모델 파라미터 압축", "외부 근거 문서 제공", "GPU 온도 제어", "CSS 최적화"], 2, "RAG는 검색된 근거를 생성 입력에 포함해 최신성, 근거성, 정확도를 높입니다."],
      ["중", "임베딩 모델을 사용하는 가장 일반적인 이유는 무엇인가?", ["문서를 벡터로 표현해 유사도 검색하기 위해", "API 키를 암호화하기 위해", "이미지 해상도를 줄이기 위해", "서버 시간을 동기화하기 위해"], 1, "임베딩은 텍스트 의미를 벡터 공간에 배치해 의미 기반 검색과 군집화에 활용됩니다."],
      ["중", "LLM 출력이 JSON 스키마를 반드시 따라야 할 때 가장 적절한 통제는 무엇인가?", ["온도만 높인다", "구조화 출력과 검증을 적용한다", "프롬프트를 제거한다", "로그를 끈다"], 2, "스키마 기반 구조화 출력과 후단 검증을 함께 적용해야 안정적인 기계 처리 결과를 얻습니다."],
      ["상", "LLM-as-Judge를 사용할 때 가장 중요한 운영 원칙은 무엇인가?", ["항상 정답으로 신뢰한다", "평가 기준과 샘플을 고정하고 품질을 모니터링한다", "모든 규칙 검증을 제거한다", "점수만 저장하고 이유는 버린다"], 2, "Judge도 모델 출력이므로 명확한 기준, 샘플 검증, 로그, 규칙 기반 검증과 함께 사용해야 합니다."],
      ["중", "프롬프트 인젝션 방어에 가장 직접적으로 필요한 것은 무엇인가?", ["사용자 입력과 시스템 지시의 우선순위 분리", "버튼 색상 변경", "응답 길이 무제한", "DB 인덱스 삭제"], 1, "신뢰할 수 없는 입력이 시스템 지시를 덮어쓰지 못하도록 경계와 우선순위를 설계해야 합니다."],
      ["하", "파인튜닝보다 RAG가 더 적합한 경우는 무엇인가?", ["자주 바뀌는 사내 문서 기반 답변", "모델 아키텍처 연구", "GPU 드라이버 설치", "브라우저 캐시 삭제"], 1, "자주 바뀌는 지식은 모델에 학습시키기보다 검색으로 주입하는 편이 관리하기 쉽습니다."],
      ["중", "환각을 줄이기 위한 응답 정책으로 가장 적절한 것은 무엇인가?", ["모르면 모른다고 답하고 근거를 요구한다", "항상 자신 있게 답한다", "출처를 숨긴다", "검색 결과를 무시한다"], 1, "불확실성 표현, 근거 인용, 답변 거절 정책은 환각 리스크를 줄입니다."],
      ["중", "MLOps에서 모델 모니터링 대상이 아닌 것은 무엇인가?", ["입력 데이터 분포", "응답 품질", "지연 시간", "모니터 색상"], 4, "모델 운영에서는 품질, 지연, 비용, 오류율, 데이터 드리프트 등을 모니터링합니다."],
      ["상", "벡터 검색에서 청크 크기를 너무 크게 잡으면 생길 수 있는 문제는 무엇인가?", ["근거가 넓어져 노이즈가 증가한다", "문서가 자동 삭제된다", "GPU가 반드시 필요 없다", "HTML이 깨진다"], 1, "큰 청크는 관련 없는 내용까지 포함해 검색 정밀도와 생성 근거성을 떨어뜨릴 수 있습니다."],
      ["중", "temperature 값을 낮추는 효과로 가장 가까운 것은 무엇인가?", ["응답이 더 결정적이고 보수적으로 변한다", "항상 더 창의적이다", "토큰 비용이 0이 된다", "모델 크기가 줄어든다"], 1, "낮은 temperature는 샘플링 다양성을 줄여 일관된 응답을 유도합니다."],
      ["중", "AI Agent의 도구 호출 설계에서 중요한 점은 무엇인가?", ["도구 입력을 검증하고 권한을 제한한다", "모든 도구를 관리자 권한으로 실행한다", "실패 로그를 남기지 않는다", "사용자 확인을 모두 생략한다"], 1, "도구 호출은 외부 부작용을 만들 수 있어 입력 검증, 권한 제한, 감사 로그가 필요합니다."],
      ["하", "Few-shot prompting의 목적은 무엇인가?", ["예시로 원하는 출력 패턴을 알려준다", "서버를 재시작한다", "모델을 삭제한다", "네트워크를 차단한다"], 1, "몇 개의 예시는 모델이 형식과 판단 기준을 더 잘 따르도록 돕습니다."],
      ["상", "평가 데이터셋을 만들 때 가장 피해야 할 것은 무엇인가?", ["운영 입력과 무관한 쉬운 예시만 포함", "정답과 기준 명시", "실패 사례 포함", "회귀 테스트에 재사용"], 1, "평가셋은 실제 운영 난도와 실패 패턴을 반영해야 의미 있는 품질 측정이 됩니다."],
      ["중", "토큰 컨텍스트가 부족할 때 적절한 대응은 무엇인가?", ["관련 문서만 선별해 넣는다", "모든 원문을 무조건 넣는다", "출력을 JSON이 아닌 이미지로 바꾼다", "질문을 무시한다"], 1, "검색, 요약, 재순위화를 통해 필요한 근거만 컨텍스트에 넣어야 합니다."],
      ["하", "LLM 응답 로그를 남기는 주된 이유는 무엇인가?", ["품질 분석과 장애 추적", "화면 밝기 조절", "브라우저 자동 업데이트", "키보드 입력 차단"], 1, "입출력, 모델, 지연, 오류 로그는 품질 개선과 장애 대응에 필요합니다."],
      ["중", "모델 선택 시 우선 고려할 요소가 아닌 것은 무엇인가?", ["정확도", "지연 시간", "비용", "개발자 생일"], 4, "모델 선택은 정확도, 비용, 지연, 컨텍스트, 안전성 요구를 기준으로 합니다."],
      ["중", "RAG 검색 결과 재순위화의 목적은 무엇인가?", ["가장 관련 높은 근거를 상위에 배치", "문서 확장자를 바꾸기", "모델 온도 고정", "API 서버 종료"], 1, "재순위화는 초기 검색 결과 중 질문과 가장 관련 높은 청크를 앞에 배치합니다."],
      ["상", "AI 시스템에서 human-in-the-loop가 필요한 상황은 무엇인가?", ["고위험 판단이나 낮은 신뢰도 결과", "단순 CSS 색상 선택", "정적 이미지 로딩", "로컬 시간 표시"], 1, "고위험 결정이나 모델 신뢰도가 낮은 경우 사람 검토 절차가 필요합니다."],
      ["중", "출력 검증 실패 시 적절한 복구 정책은 무엇인가?", ["제한된 횟수로 재시도하고 실패 로그를 남긴다", "무한 반복한다", "검증을 끈다", "성공으로 처리한다"], 1, "무한 재시도는 비용과 장애를 키우므로 제한된 복구와 명확한 실패 처리가 필요합니다."],
      ["하", "AI 서비스의 비용을 추적할 때 중요한 지표는 무엇인가?", ["입출력 토큰과 호출 수", "버튼 개수", "CSS 줄 수", "모니터 해상도"], 1, "LLM 비용은 보통 호출 수, 입력 토큰, 출력 토큰, 모델 단가에 의해 결정됩니다."]
    ])
  },
  {
    id: "cloud-developer",
    name: "Cloud for Developer",
    desc: "개발자를 위한 클라우드 배포, API, 컨테이너, 운영",
    questions: makeQuestions([
      ["하", "컨테이너 이미지를 사용하는 주된 이유는 무엇인가?", ["실행 환경을 일관되게 배포하기 위해", "코드를 자동으로 작성하기 위해", "DB 정규화를 생략하기 위해", "모니터 밝기를 높이기 위해"], 1, "컨테이너 이미지는 애플리케이션과 의존성을 묶어 환경 차이를 줄입니다."],
      ["중", "환경변수로 관리하기에 적절한 값은 무엇인가?", ["배포 환경별 API 엔드포인트", "소스코드 함수명", "HTML 태그명", "Git 커밋 메시지"], 1, "환경별 설정과 비밀 값 참조는 코드와 분리해 환경변수나 시크릿으로 관리합니다."],
      ["중", "CI/CD 파이프라인의 핵심 목적은 무엇인가?", ["빌드, 테스트, 배포 자동화", "개발자 권한 제거", "네트워크 장비 구매", "PDF 압축"], 1, "CI/CD는 변경 사항을 자동 검증하고 일관되게 배포하는 흐름입니다."],
      ["하", "REST API에서 404 상태코드는 일반적으로 무엇을 의미하는가?", ["리소스를 찾을 수 없음", "요청 성공", "서버 내부 오류", "인증 필요"], 1, "404는 요청한 리소스가 존재하지 않거나 찾을 수 없음을 의미합니다."],
      ["중", "클라우드 로그 수집의 주된 목적은 무엇인가?", ["장애 분석과 운영 추적", "코드 줄 수 증가", "UI 색상 변경", "CPU 제거"], 1, "로그는 장애 원인 파악, 감사, 성능 분석, 사용자 요청 추적에 필요합니다."],
      ["중", "API 호출에서 idempotency가 중요한 이유는 무엇인가?", ["재시도 시 중복 처리를 줄이기 위해", "응답을 느리게 하기 위해", "모든 요청을 실패시키기 위해", "프론트 폰트를 바꾸기 위해"], 1, "멱등성은 같은 요청이 여러 번 수행되어도 결과가 중복 손상되지 않게 합니다."],
      ["하", "Dockerfile에서 COPY 명령의 역할은 무엇인가?", ["파일을 이미지 안으로 복사", "컨테이너 삭제", "포트 차단", "CPU 할당"], 1, "COPY는 빌드 컨텍스트의 파일을 컨테이너 이미지 파일시스템에 복사합니다."],
      ["중", "개발 서버와 운영 서버 설정을 분리하는 이유는 무엇인가?", ["환경별 보안과 자원 설정이 다르기 때문", "코드가 반드시 달라야 해서", "HTML을 숨기기 위해", "브라우저를 바꾸기 위해"], 1, "개발과 운영은 DB, 키, 로그 수준, CORS, 자원 제한 등이 다릅니다."],
      ["상", "장애 발생 시 롤백 가능한 배포가 중요한 이유는 무엇인가?", ["서비스 복구 시간을 줄이기 위해", "배포 기록을 삭제하기 위해", "테스트를 생략하기 위해", "비용을 무한대로 늘리기 위해"], 1, "롤백 전략은 문제 버전 배포 후 빠르게 안정 버전으로 되돌리는 데 필요합니다."],
      ["중", "CORS 설정이 필요한 대표 상황은 무엇인가?", ["브라우저에서 다른 오리진 API 호출", "서버 내부 함수 호출", "로컬 변수 선언", "CSS hover 적용"], 1, "브라우저 보안 정책 때문에 다른 오리진 API 호출은 서버의 CORS 허용이 필요합니다."],
      ["하", "HTTP 500 상태코드는 무엇을 의미하는가?", ["서버 내부 오류", "요청 성공", "리소스 이동", "캐시 사용"], 1, "500은 서버가 요청 처리 중 예기치 않은 오류를 만났음을 나타냅니다."],
      ["중", "애플리케이션 헬스 체크 엔드포인트의 목적은 무엇인가?", ["서비스 생존 여부 확인", "사용자 비밀번호 출력", "CSS 파일 압축", "PDF 삭제"], 1, "헬스 체크는 배포, 모니터링, 재시작 판단에서 서비스 상태를 확인하는 데 쓰입니다."],
      ["중", "시크릿을 Git에 커밋하면 안 되는 이유는 무엇인가?", ["노출 시 계정과 서비스가 침해될 수 있어서", "파일 크기가 항상 커져서", "컴파일이 불가능해서", "브라우저가 꺼져서"], 1, "API 키와 비밀번호는 저장소 이력에 남으면 회수가 어렵고 보안 사고로 이어질 수 있습니다."],
      ["상", "무중단 배포에 가까운 방식은 무엇인가?", ["새 버전을 준비한 뒤 트래픽을 전환", "서버를 끄고 수동 복사", "운영 DB 삭제", "테스트 없이 덮어쓰기"], 1, "블루/그린이나 롤링 배포는 새 버전을 준비하고 점진적으로 트래픽을 전환합니다."],
      ["중", "클라우드 비용을 개발자가 줄이는 습관으로 적절한 것은 무엇인가?", ["불필요한 리소스 종료와 로그 보존 기간 관리", "모든 인스턴스를 최대 사양으로 고정", "캐시 제거", "모니터링 중지"], 1, "사용하지 않는 자원, 과도한 로그, 과대 프로비저닝은 비용 증가의 흔한 원인입니다."],
      ["하", "컨테이너 포트 매핑이 필요한 이유는 무엇인가?", ["호스트에서 컨테이너 서비스에 접근하기 위해", "소스코드를 암호화하기 위해", "이미지를 삭제하기 위해", "메모리를 포맷하기 위해"], 1, "컨테이너 내부 포트를 호스트 포트와 연결해야 외부에서 서비스에 접근할 수 있습니다."],
      ["중", "API rate limit의 목적은 무엇인가?", ["과도한 요청으로부터 서비스 보호", "정상 요청 모두 차단", "응답 본문 삭제", "DB 테이블 이름 변경"], 1, "Rate limit은 남용, 장애 전파, 비용 폭증을 막기 위한 요청 제한 정책입니다."],
      ["중", "서버리스보다 단일 VM 운영이 더 단순할 수 있는 경우는 무엇인가?", ["소규모 서비스와 제한된 운영 범위", "초당 수백만 이벤트 처리", "완전한 무상태 분산 처리", "전 세계 엣지 캐싱 필수"], 1, "작은 서비스는 VM 하나와 Docker로 운영하는 편이 구조와 비용을 단순하게 만들 수 있습니다."],
      ["상", "장애 대응에서 correlation id가 유용한 이유는 무엇인가?", ["분산 로그에서 같은 요청 흐름을 추적", "CSS 선택자를 줄임", "이미지 품질 향상", "DB 정규화 자동화"], 1, "상관 ID는 여러 서비스 로그 사이에서 하나의 요청 경로를 추적하게 해줍니다."],
      ["중", "백엔드 API 타임아웃 설정이 필요한 이유는 무엇인가?", ["응답 지연이 전체 서비스 장애로 번지는 것을 막기 위해", "항상 요청을 무한 대기시키기 위해", "로그를 숨기기 위해", "프론트 색상을 고정하기 위해"], 1, "타임아웃은 느린 외부 호출이나 장애가 자원 고갈로 이어지지 않게 제한합니다."]
    ])
  },
  {
    id: "cloud-architecture",
    name: "Cloud for Architecture",
    desc: "아키텍처 설계, 가용성, 네트워크, 보안, 비용",
    questions: makeQuestions([
      ["하", "고가용성 설계의 핵심 목표는 무엇인가?", ["장애 시에도 서비스 지속", "서버 수를 항상 1대로 유지", "로그를 제거", "사용자 입력 금지"], 1, "고가용성은 일부 구성 요소 장애에도 서비스가 계속 동작하도록 설계하는 것입니다."],
      ["중", "VPC의 주된 역할은 무엇인가?", ["격리된 가상 네트워크 제공", "코드 자동 생성", "데이터 모델링", "PDF 추출"], 1, "VPC는 클라우드 리소스를 논리적으로 격리된 네트워크 안에 배치합니다."],
      ["중", "퍼블릭 서브넷과 프라이빗 서브넷을 나누는 이유는 무엇인가?", ["인터넷 노출 범위를 통제하기 위해", "CPU 종류를 바꾸기 위해", "HTML을 압축하기 위해", "테스트를 생략하기 위해"], 1, "외부 노출이 필요한 자원과 내부 전용 자원을 분리해 보안 경계를 만듭니다."],
      ["상", "단일 장애점(SPOF)을 줄이는 방법으로 적절한 것은 무엇인가?", ["중요 구성 요소를 이중화", "모든 트래픽을 한 서버에 고정", "백업 삭제", "모니터링 중지"], 1, "이중화와 분산 배치는 하나의 구성 요소 장애가 전체 장애가 되는 것을 줄입니다."],
      ["중", "오토스케일링 정책의 기준으로 적절한 것은 무엇인가?", ["CPU 사용률과 요청 수", "버튼 색상", "문서 제목 길이", "파일 확장자"], 1, "부하 지표를 기준으로 인스턴스 수를 자동 조절해 성능과 비용을 균형화합니다."],
      ["중", "로드밸런서의 역할은 무엇인가?", ["여러 서버로 트래픽 분산", "DB 스키마 생성", "코드 포맷팅", "브라우저 캐시 삭제"], 1, "로드밸런서는 요청을 여러 대상에 나누고 장애 대상을 제외할 수 있습니다."],
      ["하", "백업 전략에서 RPO는 무엇을 의미하는가?", ["허용 가능한 데이터 손실 시간", "복구 서버 수", "요청 처리 속도", "암호 길이"], 1, "RPO는 장애 시점에서 얼마나 과거 데이터까지 손실을 허용하는지 나타냅니다."],
      ["중", "RTO는 무엇을 의미하는가?", ["서비스 복구까지 허용되는 시간", "백업 파일 크기", "네트워크 대역폭", "비밀번호 만료일"], 1, "RTO는 장애 후 서비스를 정상화하는 데 허용되는 최대 시간을 의미합니다."],
      ["상", "멀티 AZ 구성이 유리한 이유는 무엇인가?", ["가용 영역 장애에 대한 내성 확보", "모든 비용 제거", "데이터 검증 제거", "로그 저장 금지"], 1, "멀티 AZ는 하나의 가용 영역 장애가 전체 서비스 장애가 되지 않도록 돕습니다."],
      ["중", "보안 그룹의 특징으로 올바른 것은 무엇인가?", ["인스턴스 단위의 상태 저장 방화벽", "소스코드 저장소", "이미지 압축 도구", "DB 백업 파일"], 1, "보안 그룹은 인스턴스나 ENI에 적용되는 상태 저장 네트워크 접근 제어입니다."],
      ["중", "NACL의 특징으로 적절한 것은 무엇인가?", ["서브넷 단위의 네트워크 ACL", "애플리케이션 로그", "컨테이너 이미지", "프론트 라우터"], 1, "NACL은 서브넷 경계에서 인바운드와 아웃바운드 규칙을 평가합니다."],
      ["상", "캐시 계층을 두는 주된 이유는 무엇인가?", ["반복 조회 지연과 원본 부하 감소", "데이터 정확도 무조건 향상", "모든 쓰기 제거", "권한 검증 생략"], 1, "캐시는 자주 읽는 데이터를 빠르게 제공해 지연 시간과 원본 부하를 줄입니다."],
      ["중", "비용 최적화 관점에서 태깅이 중요한 이유는 무엇인가?", ["리소스별 소유자와 비용 추적", "네트워크 암호화", "CPU 속도 증가", "로그 자동 삭제"], 1, "태그는 비용 배분, 소유자 식별, 수명주기 관리에 활용됩니다."],
      ["중", "Zero Trust 보안의 기본 관점은 무엇인가?", ["항상 검증하고 최소 권한을 적용", "내부망은 항상 신뢰", "암호화 불필요", "로그 수집 금지"], 1, "Zero Trust는 위치와 관계없이 요청마다 인증, 인가, 검증을 수행합니다."],
      ["하", "CDN의 주된 효과는 무엇인가?", ["정적 콘텐츠 전송 지연 감소", "DB 트랜잭션 보장", "소스코드 컴파일", "서버 SSH 접속"], 1, "CDN은 사용자와 가까운 엣지에서 콘텐츠를 제공해 지연 시간을 줄입니다."],
      ["상", "데이터베이스 읽기 부하가 큰 시스템의 일반적 확장 방식은 무엇인가?", ["읽기 복제본 활용", "기본키 제거", "모든 인덱스 삭제", "백업 중지"], 1, "읽기 복제본은 조회 트래픽을 분산해 주 데이터베이스의 부하를 줄입니다."],
      ["중", "비동기 메시지 큐를 사용하는 이유는 무엇인가?", ["서비스 간 결합도와 순간 부하 완화", "모든 처리를 동기화", "데이터 유실 유도", "프론트 CSS 대체"], 1, "큐는 생산자와 소비자를 분리하고 피크 트래픽을 완충합니다."],
      ["중", "관측성(Observability)의 주요 구성 요소가 아닌 것은 무엇인가?", ["메트릭", "로그", "트레이스", "배경색"], 4, "관측성은 메트릭, 로그, 트레이스 등을 통해 시스템 내부 상태를 추론합니다."],
      ["상", "DR 전략을 설계할 때 가장 먼저 정해야 할 것은 무엇인가?", ["업무별 RTO/RPO 목표", "버튼 모양", "개발자 자리 배치", "HTML 줄 수"], 1, "업무 중요도에 따라 복구 시간과 데이터 손실 허용 범위를 먼저 정의해야 합니다."],
      ["중", "아키텍처 의사결정 기록(ADR)의 목적은 무엇인가?", ["설계 선택의 배경과 트레이드오프 보존", "코드 자동 실행", "비밀번호 저장", "이미지 압축"], 1, "ADR은 왜 특정 구조를 선택했는지 후속 개발자가 이해하도록 돕습니다."]
    ])
  },
  {
    id: "data-engineering",
    name: "Data Engineering",
    desc: "ETL/ELT, 파이프라인, 모델링, 품질, 배치와 스트림",
    questions: makeQuestions([
      ["하", "ETL에서 T는 무엇을 의미하는가?", ["Transform", "Transfer", "Template", "Timeout"], 1, "ETL은 Extract, Transform, Load의 약자이며 T는 변환을 의미합니다."],
      ["중", "데이터 파이프라인에서 idempotent 처리가 중요한 이유는 무엇인가?", ["재실행 시 중복 적재를 막기 위해", "항상 데이터를 삭제하기 위해", "스키마를 숨기기 위해", "네트워크를 끊기 위해"], 1, "파이프라인은 실패 후 재실행될 수 있으므로 중복 없이 같은 결과가 나와야 합니다."],
      ["중", "파티셔닝의 주요 목적은 무엇인가?", ["조회와 적재 범위 축소", "모든 데이터를 한 파일에 저장", "정규화 금지", "로그 삭제"], 1, "날짜나 키 기준 파티션은 필요한 범위만 읽게 해 성능과 비용을 줄입니다."],
      ["상", "데이터 레이크와 웨어하우스의 차이로 적절한 것은 무엇인가?", ["레이크는 원천/다양한 형식 저장, 웨어하우스는 분석 최적화 구조", "둘은 완전히 같은 개념", "웨어하우스는 파일 저장 불가", "레이크는 데이터 저장 불가"], 1, "데이터 레이크는 원천과 비정형을 폭넓게 저장하고, 웨어하우스는 정형 분석에 최적화됩니다."],
      ["하", "배치 처리의 특징은 무엇인가?", ["정해진 주기마다 묶어서 처리", "이벤트마다 즉시 처리", "항상 수동 처리", "데이터 저장 금지"], 1, "배치는 일정 시간 단위로 데이터를 모아 처리합니다."],
      ["중", "스트림 처리의 대표적인 장점은 무엇인가?", ["실시간에 가까운 이벤트 처리", "항상 비용 0원", "정확도 검증 불필요", "DB 없이 영구 저장"], 1, "스트림 처리는 이벤트 발생 직후 처리해야 하는 모니터링, 알림, 실시간 분석에 적합합니다."],
      ["중", "데이터 품질 검증 항목으로 적절하지 않은 것은 무엇인가?", ["NULL 비율", "중복", "스키마 일치", "버튼 색상"], 4, "데이터 품질은 완전성, 유일성, 유효성, 일관성 등을 점검합니다."],
      ["중", "스키마 드리프트란 무엇인가?", ["데이터 구조가 예상과 다르게 변하는 현상", "서버 시간이 늦어지는 현상", "로그 파일 압축", "모델 응답 지연"], 1, "원천 시스템 변경으로 컬럼, 타입, 구조가 달라지면 파이프라인 실패나 품질 저하가 생깁니다."],
      ["상", "SCD Type 2의 목적은 무엇인가?", ["차원 데이터 변경 이력을 보존", "데이터를 항상 덮어쓰기", "중복 검사를 제거", "파일을 암호화"], 1, "SCD Type 2는 유효기간이나 버전 컬럼으로 과거 속성 변경 이력을 유지합니다."],
      ["하", "데이터 카탈로그의 역할은 무엇인가?", ["데이터 자산의 위치와 의미 관리", "CPU 할당", "이미지 편집", "방화벽 설정"], 1, "카탈로그는 데이터셋의 메타데이터, 소유자, 설명, 스키마를 관리합니다."],
      ["중", "라인리지(Lineage)가 중요한 이유는 무엇인가?", ["데이터 출처와 변환 흐름 추적", "화면 전환 속도 향상", "비밀번호 길이 제한", "브라우저 탭 정리"], 1, "라인리지는 데이터가 어디서 와서 어떻게 변했는지 추적해 영향 분석과 감사에 도움을 줍니다."],
      ["상", "Exactly-once 처리가 어려운 이유는 무엇인가?", ["분산 시스템의 재시도와 장애 상황에서 중복/누락을 동시에 막아야 해서", "SQL이 없어서", "HTML이 정적이라서", "파일명이 길어서"], 1, "정확히 한 번 처리는 체크포인트, 트랜잭션, 멱등 쓰기 등 복합 설계가 필요합니다."],
      ["중", "데이터 모델링에서 팩트 테이블은 주로 무엇을 담는가?", ["측정 가능한 이벤트와 수치", "사용자 인터페이스 색상", "서버 비밀번호", "소스코드 주석"], 1, "팩트 테이블은 주문, 클릭, 매출처럼 분석 대상이 되는 측정값을 담습니다."],
      ["중", "차원 테이블의 역할은 무엇인가?", ["분석 기준이 되는 설명 속성 제공", "로그 삭제", "네트워크 라우팅", "모델 파라미터 저장"], 1, "차원은 시간, 고객, 상품처럼 팩트를 설명하고 집계 기준이 되는 속성입니다."],
      ["하", "CSV보다 Parquet이 분석에 유리한 대표 이유는 무엇인가?", ["컬럼 기반 저장과 압축", "항상 사람이 더 읽기 쉬움", "텍스트 편집만 가능", "스키마가 절대 없음"], 1, "Parquet은 컬럼 단위 읽기와 압축으로 대규모 분석 쿼리에 효율적입니다."],
      ["중", "데이터 파이프라인 오케스트레이션 도구의 역할은 무엇인가?", ["작업 순서, 의존성, 재시도 관리", "UI 색상 자동 선택", "DB 인덱스 제거", "모든 작업 수동 실행"], 1, "오케스트레이터는 DAG 실행, 스케줄, 의존성, 실패 재시도를 관리합니다."],
      ["상", "Watermark가 스트림 처리에서 필요한 이유는 무엇인가?", ["늦게 도착한 이벤트를 고려해 윈도우 완료 시점을 판단", "모든 데이터를 삭제", "서버 IP 변경", "컬럼명 암호화"], 1, "워터마크는 이벤트 시간 기준 처리에서 지연 이벤트를 어느 정도까지 기다릴지 정합니다."],
      ["중", "데이터 마트의 특징은 무엇인가?", ["특정 부서나 주제 중심 분석 데이터", "원천 로그만 무제한 저장", "네트워크 방화벽", "프론트 빌드 산출물"], 1, "데이터 마트는 특정 업무 영역에 맞게 정제된 분석용 데이터 집합입니다."],
      ["중", "CDC(Change Data Capture)의 목적은 무엇인가?", ["원천 데이터 변경분을 추적해 반영", "전체 데이터를 매번 삭제", "사용자 세션 종료", "CSS 변경 감지"], 1, "CDC는 삽입, 수정, 삭제 변경 이벤트를 추적해 하위 시스템에 동기화합니다."],
      ["하", "데이터 품질 실패 시 가장 먼저 해야 할 일은 무엇인가?", ["실패 로그와 원천 변경 여부 확인", "무조건 성공 처리", "검증 코드 삭제", "모든 데이터 공개"], 1, "원인 파악을 위해 실패 항목, 입력 데이터, 스키마 변경, 파이프라인 로그를 확인해야 합니다."]
    ])
  },
  {
    id: "software-engineering",
    name: "소프트웨어공학",
    desc: "요구사항, 설계, 테스트, 형상관리, 유지보수",
    questions: makeQuestions([
      ["하", "소프트웨어 생명주기에서 요구사항 분석의 목적은 무엇인가?", ["사용자와 시스템 요구를 명확히 정의", "코드 난독화", "서버 구매", "색상 선택"], 1, "요구사항 분석은 무엇을 만들어야 하는지 명확히 해 이후 설계와 검증 기준을 제공합니다."],
      ["중", "폭포수 모델의 특징은 무엇인가?", ["단계가 순차적으로 진행", "항상 동시에 모든 단계 수행", "테스트가 불가능", "요구사항이 필요 없음"], 1, "폭포수 모델은 요구분석, 설계, 구현, 테스트, 유지보수 단계가 순차적으로 이어집니다."],
      ["중", "애자일 방법론의 핵심 가치에 가까운 것은 무엇인가?", ["변화 대응과 짧은 반복", "문서 완전 제거", "고객 피드백 금지", "배포 불가"], 1, "애자일은 짧은 주기, 피드백, 변화 대응, 동작하는 소프트웨어를 중시합니다."],
      ["하", "단위 테스트의 목적은 무엇인가?", ["작은 코드 단위의 동작 검증", "운영 서버 삭제", "UI 디자인 확정", "네트워크 장비 교체"], 1, "단위 테스트는 함수나 클래스 같은 작은 단위가 기대대로 동작하는지 확인합니다."],
      ["중", "통합 테스트가 필요한 이유는 무엇인가?", ["모듈 간 인터페이스와 상호작용 검증", "코드 줄 수 측정", "폰트 변경", "문서 제목 설정"], 1, "개별 모듈이 통과해도 결합 과정에서 데이터 형식, 호출 순서, 예외 처리 문제가 생길 수 있습니다."],
      ["상", "회귀 테스트의 목적은 무엇인가?", ["변경으로 기존 기능이 깨졌는지 확인", "새 기능만 수동 확인", "테스트 삭제", "배포 속도만 증가"], 1, "회귀 테스트는 수정 후 기존 동작이 유지되는지 검증합니다."],
      ["중", "형상관리 도구가 제공하는 핵심 기능은 무엇인가?", ["변경 이력과 버전 관리", "CPU 냉각", "데이터 압축만 수행", "로그인 우회"], 1, "Git 같은 형상관리 도구는 변경 추적, 협업, 브랜치, 복구를 지원합니다."],
      ["중", "코드 리뷰의 주된 목적은 무엇인가?", ["결함 발견과 설계 품질 개선", "개발자 평가만 수행", "코드 실행 금지", "테스트 생략"], 1, "코드 리뷰는 버그, 보안, 유지보수성, 일관성을 동료 관점에서 점검합니다."],
      ["상", "기술 부채가 누적될 때 발생하기 쉬운 문제는 무엇인가?", ["변경 비용 증가와 품질 저하", "개발 속도 영구 증가", "장애 완전 제거", "테스트 자동 생성"], 1, "단기 편의를 위한 구조적 타협이 쌓이면 수정과 확장이 어려워집니다."],
      ["하", "응집도가 높은 모듈의 특징은 무엇인가?", ["관련 책임이 한곳에 모여 있음", "무관한 기능이 섞여 있음", "외부 의존이 매우 많음", "테스트가 불가능함"], 1, "높은 응집도는 모듈이 하나의 명확한 책임에 집중한다는 뜻입니다."],
      ["중", "결합도가 낮은 설계가 좋은 이유는 무엇인가?", ["변경 영향 범위가 줄어듦", "모든 모듈이 서로 직접 의존", "재사용이 불가능", "테스트가 느려짐"], 1, "낮은 결합도는 모듈 간 의존을 줄여 변경과 테스트를 쉽게 합니다."],
      ["중", "요구사항 추적성이 중요한 이유는 무엇인가?", ["요구부터 설계, 구현, 테스트까지 연결 확인", "색상 팔레트 관리", "서버 시간 설정", "파일 삭제"], 1, "추적성은 요구사항이 제대로 구현되고 검증되었는지 확인하게 해줍니다."],
      ["상", "리팩터링의 올바른 설명은 무엇인가?", ["외부 동작은 유지하고 내부 구조를 개선", "기능을 무조건 제거", "테스트 없이 전체 재작성", "배포 로그 삭제"], 1, "리팩터링은 기능 변화 없이 코드 구조와 이해도를 개선하는 작업입니다."],
      ["중", "프로토타이핑 모델이 유용한 경우는 무엇인가?", ["요구사항이 불명확해 빠른 피드백이 필요할 때", "요구가 완전히 고정됐을 때만", "사용자 피드백이 금지될 때", "화면이 필요 없을 때"], 1, "프로토타입은 초기 요구를 구체화하고 사용자 피드백을 빠르게 얻는 데 좋습니다."],
      ["하", "유지보수 유형 중 오류를 수정하는 것은 무엇인가?", ["수정 유지보수", "완전 유지보수", "적응 유지보수", "예방 유지보수"], 1, "수정 유지보수는 발견된 결함을 고치는 활동입니다."],
      ["중", "성능 테스트에서 확인하는 주요 항목은 무엇인가?", ["응답 시간과 처리량", "버튼 이름", "문서 제목", "주석 수"], 1, "성능 테스트는 부하 상황에서 지연, 처리량, 자원 사용량을 확인합니다."],
      ["상", "테스트 더블을 사용하는 이유는 무엇인가?", ["외부 의존성을 대체해 격리 테스트", "운영 DB 삭제", "사용자 계정 공개", "코드 리뷰 제거"], 1, "Mock, Stub 같은 테스트 더블은 외부 시스템 없이 대상 로직을 검증하게 해줍니다."],
      ["중", "소프트웨어 품질 속성이 아닌 것은 무엇인가?", ["유지보수성", "신뢰성", "사용성", "책상 높이"], 4, "품질 속성에는 신뢰성, 성능, 사용성, 보안성, 유지보수성 등이 포함됩니다."],
      ["하", "버전 번호에서 major 변경이 의미하는 경우는 무엇인가?", ["호환성이 깨지는 큰 변경", "오타 수정만", "문서 줄바꿈", "로그 파일 이동"], 1, "SemVer에서 major 버전 증가는 하위 호환성이 깨지는 변경을 나타냅니다."],
      ["중", "인수 테스트의 목적은 무엇인가?", ["사용자 요구사항 충족 여부 확인", "개발자 PC 성능 측정", "코드 포맷 확인만", "서버 포트 변경"], 1, "인수 테스트는 시스템이 비즈니스 요구와 사용자 기대를 만족하는지 검증합니다."]
    ])
  },
  {
    id: "security",
    name: "정보보호",
    desc: "보안 원칙, 인증, 암호, 네트워크, 취약점",
    questions: makeQuestions([
      ["하", "정보보호의 3요소가 아닌 것은 무엇인가?", ["기밀성", "무결성", "가용성", "장식성"], 4, "정보보호의 기본 3요소는 기밀성, 무결성, 가용성입니다."],
      ["중", "비밀번호 저장 시 적절한 방식은 무엇인가?", ["솔트를 포함한 안전한 해시", "평문 저장", "Base64만 적용", "파일명으로 저장"], 1, "비밀번호는 복호화가 어려운 해시와 사용자별 솔트를 적용해 저장해야 합니다."],
      ["중", "XSS 공격은 주로 무엇을 노리는가?", ["브라우저에서 악성 스크립트 실행", "DB 테이블 정규화", "서버 팬 속도", "이미지 압축"], 1, "XSS는 신뢰되지 않은 스크립트가 사용자 브라우저에서 실행되게 하는 공격입니다."],
      ["상", "SQL Injection을 방어하는 대표 방법은 무엇인가?", ["파라미터 바인딩 사용", "문자열 연결로 쿼리 생성", "오류 메시지 공개", "입력 검증 제거"], 1, "Prepared Statement와 파라미터 바인딩은 입력이 쿼리 구조로 해석되지 않게 합니다."],
      ["하", "HTTPS가 제공하는 주요 보안 효과는 무엇인가?", ["전송 구간 암호화와 서버 인증", "서버 비용 제거", "DB 자동 백업", "코드 자동 테스트"], 1, "HTTPS는 TLS로 통신을 암호화하고 인증서를 통해 서버 신뢰성을 검증합니다."],
      ["중", "최소 권한 원칙의 의미는 무엇인가?", ["필요한 권한만 부여", "모든 사용자에게 관리자 권한", "인증 제거", "로그 삭제"], 1, "최소 권한은 계정과 서비스에 필요한 범위의 권한만 주는 보안 원칙입니다."],
      ["중", "MFA를 사용하는 이유는 무엇인가?", ["인증 요소를 추가해 계정 탈취 위험 감소", "비밀번호를 공개하기 위해", "네트워크 속도 증가", "로그인 화면 삭제"], 1, "MFA는 비밀번호 외 추가 인증을 요구해 단일 인증 요소 유출 위험을 줄입니다."],
      ["상", "CSRF 공격의 방어 방법으로 적절한 것은 무엇인가?", ["CSRF 토큰과 SameSite 쿠키 적용", "모든 요청 GET 사용", "인증 쿠키 공개", "Origin 검증 제거"], 1, "CSRF는 사용자의 인증 상태를 악용하므로 토큰, SameSite, Origin 검증이 필요합니다."],
      ["중", "대칭키 암호화의 특징은 무엇인가?", ["암호화와 복호화에 같은 키 사용", "공개키만 사용", "키가 필요 없음", "해시와 동일"], 1, "대칭키 방식은 같은 비밀키로 암호화와 복호화를 수행합니다."],
      ["중", "해시 함수의 특징으로 올바른 것은 무엇인가?", ["일방향 요약값 생성", "항상 복호화 가능", "키 교환 프로토콜", "네트워크 라우팅"], 1, "해시는 입력에서 고정 길이 요약값을 만들며 원문 복원이 어렵습니다."],
      ["상", "보안 로그에서 탐지해야 할 이상 징후는 무엇인가?", ["짧은 시간의 반복 로그인 실패", "정상 페이지 조회", "CSS 파일 로딩", "이미지 캐시"], 1, "반복 실패, 비정상 위치 접속, 권한 상승 시도 등은 침해 징후일 수 있습니다."],
      ["하", "방화벽의 기본 역할은 무엇인가?", ["네트워크 접근 제어", "코드 컴파일", "DB 설계", "이미지 생성"], 1, "방화벽은 규칙에 따라 트래픽을 허용하거나 차단합니다."],
      ["중", "제로데이 취약점이란 무엇인가?", ["패치가 나오기 전 알려지거나 악용되는 취약점", "오래된 백업", "정상 인증", "암호화된 로그"], 1, "제로데이는 공급자의 공식 패치가 준비되기 전에 악용 가능한 취약점을 말합니다."],
      ["중", "보안 패치를 미루면 생기는 위험은 무엇인가?", ["이미 알려진 취약점에 노출", "성능이 항상 향상", "권한이 자동 축소", "로그가 자동 정리"], 1, "공개된 취약점은 공격자가 쉽게 악용할 수 있어 신속한 패치가 필요합니다."],
      ["상", "API 키를 클라이언트 코드에 넣으면 안 되는 이유는 무엇인가?", ["사용자에게 노출되어 남용될 수 있음", "화면이 느려져서만", "HTML이 커져서만", "색상이 바뀌어서"], 1, "프론트 코드의 키는 사용자가 볼 수 있으므로 서버나 시크릿 저장소에서 보호해야 합니다."],
      ["중", "권한 상승 취약점은 무엇을 의미하는가?", ["낮은 권한 사용자가 더 높은 권한을 얻는 문제", "로그인이 느린 문제", "이미지가 깨지는 문제", "쿼리가 빠른 문제"], 1, "권한 상승은 접근 통제 결함으로 허용되지 않은 권한을 얻는 취약점입니다."],
      ["하", "백업 데이터도 암호화해야 하는 이유는 무엇인가?", ["백업 유출 시 정보 노출을 줄이기 위해", "복구를 불가능하게 하려고", "파일명을 짧게 하려고", "CPU를 늘리려고"], 1, "백업도 민감 정보를 포함하므로 저장과 전송 단계에서 보호해야 합니다."],
      ["중", "보안 취약점 스캐닝의 목적은 무엇인가?", ["알려진 취약 구성과 패키지 탐지", "문서 자동 번역", "UI 확대", "서버 종료"], 1, "취약점 스캔은 패키지, 설정, 이미지 등에서 알려진 위험을 찾는 데 사용합니다."],
      ["상", "위협 모델링의 목적은 무엇인가?", ["시스템 자산과 공격 경로를 식별해 대응 설계", "코드 줄 수 줄이기", "배포 자동화만 수행", "디자인 색상 선택"], 1, "위협 모델링은 보호 대상, 공격자, 경로, 통제를 체계적으로 분석합니다."],
      ["중", "세션 탈취를 줄이는 쿠키 설정으로 적절한 것은 무엇인가?", ["HttpOnly, Secure, SameSite 적용", "쿠키를 평문 로그에 기록", "만료 시간 무제한", "모든 도메인 허용"], 1, "보안 쿠키 속성은 스크립트 접근, 비암호 통신, CSRF 위험을 줄이는 데 도움을 줍니다."]
    ])
  },
  {
    id: "pccp",
    name: "PCCP",
    desc: "실전형 Python 코딩 테스트, 구현, 탐색, 해시, DP",
    questions: makeCodingQuestions([
      ["중", "문제: 할인 쿠폰\n정수 리스트 prices와 정수 discount가 주어집니다. 각 가격에 discount% 할인을 적용한 뒤 소수점 이하는 버리고, 최종 결제 금액의 합을 반환하는 solution(prices, discount)를 작성하세요.\n\n제한사항\n- 1 <= len(prices) <= 100,000\n- 0 <= discount <= 100\n\n입출력 예\nprices=[10000, 25000, 3300], discount=20 -> 30640", "def solution(prices, discount):\n    rate = 100 - discount\n    return sum(price * rate // 100 for price in prices)", ["def solution", "sum", "//"], "각 가격을 정수 나눗셈으로 할인 처리한 뒤 합산합니다. O(n)으로 충분합니다."],
      ["중", "문제: 가장 많이 주문된 메뉴\n문자열 리스트 orders가 주어집니다. 가장 많이 등장한 메뉴명을 반환하세요. 동률이면 사전순으로 가장 앞선 메뉴를 반환합니다.\n\n입출력 예\norders=['latte','americano','latte','mocha','americano'] -> 'americano'", "from collections import Counter\n\ndef solution(orders):\n    counter = Counter(orders)\n    max_count = max(counter.values())\n    return min(menu for menu, count in counter.items() if count == max_count)", ["Counter", "max", "min"], "빈도는 Counter로 세고, 최대 빈도 후보 중 사전순 최소값을 선택합니다."],
      ["중", "문제: 연속 출석\n0과 1로 이루어진 리스트 attendance가 주어집니다. 1은 출석, 0은 결석입니다. 가장 긴 연속 출석 일수를 반환하세요.\n\n입출력 예\nattendance=[1,1,0,1,1,1,0] -> 3", "def solution(attendance):\n    best = 0\n    current = 0\n    for value in attendance:\n        if value == 1:\n            current += 1\n            best = max(best, current)\n        else:\n            current = 0\n    return best", ["for", "max", "current"], "연속 구간 길이를 누적하고 0을 만나면 현재 길이를 초기화합니다."],
      ["상", "문제: 두 수의 합\n정수 리스트 numbers와 target이 주어집니다. 서로 다른 두 원소의 합이 target이 되는 쌍이 존재하면 True, 없으면 False를 반환하세요.\n\n제한사항\n- 1 <= len(numbers) <= 200,000\n\n입출력 예\nnumbers=[4,1,7,9], target=8 -> True", "def solution(numbers, target):\n    seen = set()\n    for number in numbers:\n        if target - number in seen:\n            return True\n        seen.add(number)\n    return False", ["set", "target -", "return True"], "이미 본 값의 집합을 이용하면 각 원소마다 보수 값을 O(1)에 확인할 수 있습니다."],
      ["상", "문제: 기능 배포\n각 기능의 현재 진도 progresses와 하루 개발 속도 speeds가 주어집니다. 앞 기능이 완료되어야 뒤 기능도 함께 배포됩니다. 배포마다 몇 개 기능이 배포되는지 리스트로 반환하세요.\n\n입출력 예\nprogresses=[93,30,55], speeds=[1,30,5] -> [2,1]", "import math\n\ndef solution(progresses, speeds):\n    days = [math.ceil((100 - p) / s) for p, s in zip(progresses, speeds)]\n    answer = []\n    current = days[0]\n    count = 0\n    for day in days:\n        if day <= current:\n            count += 1\n        else:\n            answer.append(count)\n            current = day\n            count = 1\n    answer.append(count)\n    return answer", ["ceil", "zip", "answer.append"], "각 기능 완료 일수를 구하고 앞 기능 완료일보다 늦어지는 순간 새 배포 묶음을 시작합니다."],
      ["중", "문제: 문자열 압축\n문자열 s가 주어집니다. 연속해서 같은 문자가 나오면 문자와 개수를 붙여 압축합니다. 단, 개수가 1이면 개수는 생략합니다.\n\n입출력 예\ns='aaabbc' -> 'a3b2c'", "def solution(s):\n    if not s:\n        return ''\n    answer = []\n    prev = s[0]\n    count = 1\n    for ch in s[1:]:\n        if ch == prev:\n            count += 1\n        else:\n            answer.append(prev + (str(count) if count > 1 else ''))\n            prev = ch\n            count = 1\n    answer.append(prev + (str(count) if count > 1 else ''))\n    return ''.join(answer)", ["for", "append", "join"], "이전 문자와 현재 문자를 비교하며 연속 개수를 기록합니다."],
      ["상", "문제: 네트워크 개수\nn개의 컴퓨터와 연결 정보 computers가 주어집니다. computers[i][j]가 1이면 i와 j가 연결되어 있습니다. 전체 네트워크 개수를 반환하세요.\n\n입출력 예\nn=3, computers=[[1,1,0],[1,1,0],[0,0,1]] -> 2", "def solution(n, computers):\n    visited = [False] * n\n    def dfs(node):\n        visited[node] = True\n        for nxt in range(n):\n            if computers[node][nxt] and not visited[nxt]:\n                dfs(nxt)\n    answer = 0\n    for i in range(n):\n        if not visited[i]:\n            dfs(i)\n            answer += 1\n    return answer", ["visited", "dfs", "answer += 1"], "방문하지 않은 노드마다 DFS/BFS를 시작하면 연결 요소 개수를 셀 수 있습니다."],
      ["상", "문제: 가장 먼 노드\n무방향 그래프의 노드 수 n과 간선 리스트 edge가 주어집니다. 1번 노드에서 최단 거리가 가장 먼 노드의 개수를 반환하세요.\n\n입출력 예\nn=6, edge=[[3,6],[4,3],[3,2],[1,3],[1,2],[2,4],[5,2]] -> 3", "from collections import deque\n\ndef solution(n, edge):\n    graph = [[] for _ in range(n + 1)]\n    for a, b in edge:\n        graph[a].append(b)\n        graph[b].append(a)\n    dist = [-1] * (n + 1)\n    dist[1] = 0\n    q = deque([1])\n    while q:\n        node = q.popleft()\n        for nxt in graph[node]:\n            if dist[nxt] == -1:\n                dist[nxt] = dist[node] + 1\n                q.append(nxt)\n    far = max(dist)\n    return dist.count(far)", ["deque", "dist", "count"], "간선 가중치가 모두 1이므로 BFS로 최단 거리를 구한 뒤 최대 거리 개수를 셉니다."],
      ["중", "문제: 신고 결과\n문자열 리스트 report에는 '신고자 피신고자' 형식의 기록이 들어 있습니다. 같은 신고자가 같은 사람을 여러 번 신고해도 1회로 처리합니다. k번 이상 신고된 사용자를 신고한 사람별 알림 횟수를 id_list 순서대로 반환하세요.", "from collections import defaultdict\n\ndef solution(id_list, report, k):\n    reports = set(report)\n    reported_by = defaultdict(set)\n    for row in reports:\n        user, target = row.split()\n        reported_by[target].add(user)\n    mail = dict.fromkeys(id_list, 0)\n    for users in reported_by.values():\n        if len(users) >= k:\n            for user in users:\n                mail[user] += 1\n    return [mail[user] for user in id_list]", ["set", "defaultdict", "split"], "중복 신고 제거 후 피신고자별 신고자 집합을 만들고 기준 이상이면 신고자에게 알림을 더합니다."],
      ["상", "문제: 최소 피로도\n던전 정보 dungeons는 [필요 피로도, 소모 피로도]입니다. 현재 피로도 k로 탐험할 수 있는 최대 던전 수를 반환하세요. 던전 수는 최대 8개입니다.", "def solution(k, dungeons):\n    visited = [False] * len(dungeons)\n    best = 0\n    def backtrack(energy, count):\n        nonlocal best\n        best = max(best, count)\n        for i, (need, cost) in enumerate(dungeons):\n            if not visited[i] and energy >= need:\n                visited[i] = True\n                backtrack(energy - cost, count + 1)\n                visited[i] = False\n    backtrack(k, 0)\n    return best", ["backtrack", "visited", "nonlocal"], "던전 수가 작으므로 백트래킹으로 가능한 순서를 탐색합니다."],
      ["상", "문제: 귤 고르기\n귤 크기 리스트 tangerine과 필요한 개수 k가 주어집니다. k개를 고를 때 서로 다른 크기의 수를 최소로 하려면 몇 종류가 필요한지 반환하세요.", "from collections import Counter\n\ndef solution(k, tangerine):\n    counts = sorted(Counter(tangerine).values(), reverse=True)\n    total = 0\n    answer = 0\n    for count in counts:\n        total += count\n        answer += 1\n        if total >= k:\n            return answer", ["Counter", "sorted", "reverse=True"], "개수가 많은 크기부터 선택하면 종류 수를 최소화할 수 있습니다."],
      ["중", "문제: 카드 뭉치\ncards1, cards2, goal이 주어집니다. 두 카드 뭉치의 앞에서부터 순서대로 카드를 사용해 goal을 만들 수 있으면 'Yes', 아니면 'No'를 반환하세요.", "def solution(cards1, cards2, goal):\n    i = j = 0\n    for word in goal:\n        if i < len(cards1) and cards1[i] == word:\n            i += 1\n        elif j < len(cards2) and cards2[j] == word:\n            j += 1\n        else:\n            return 'No'\n    return 'Yes'", ["for", "elif", "return 'No'"], "각 뭉치의 현재 포인터를 유지하며 goal 단어를 순서대로 소비합니다."],
      ["상", "문제: 괄호 변환\n문자열 p가 균형잡힌 괄호 문자열로 주어집니다. 문제 조건에 따라 올바른 괄호 문자열로 변환하는 solution(p)를 작성하세요. 빈 문자열이면 빈 문자열을 반환합니다.", "def is_correct(s):\n    stack = []\n    for ch in s:\n        if ch == '(':\n            stack.append(ch)\n        elif stack:\n            stack.pop()\n        else:\n            return False\n    return not stack\n\ndef solution(p):\n    if not p:\n        return ''\n    balance = 0\n    for i, ch in enumerate(p):\n        balance += 1 if ch == '(' else -1\n        if balance == 0:\n            u, v = p[:i + 1], p[i + 1:]\n            break\n    if is_correct(u):\n        return u + solution(v)\n    return '(' + solution(v) + ')' + ''.join('(' if ch == ')' else ')' for ch in u[1:-1])", ["is_correct", "solution(v)", "u[1:-1]"], "재귀로 균형잡힌 u와 v를 분리하고 조건에 따라 변환합니다."],
      ["상", "문제: 보석 쇼핑\n보석 배열 gems가 주어집니다. 모든 종류의 보석을 하나 이상 포함하는 가장 짧은 구간의 시작과 끝 인덱스를 1부터 시작해 반환하세요.", "from collections import defaultdict\n\ndef solution(gems):\n    need = len(set(gems))\n    counter = defaultdict(int)\n    left = 0\n    best = [0, len(gems) - 1]\n    for right, gem in enumerate(gems):\n        counter[gem] += 1\n        while len(counter) == need:\n            if right - left < best[1] - best[0]:\n                best = [left, right]\n            counter[gems[left]] -= 1\n            if counter[gems[left]] == 0:\n                del counter[gems[left]]\n            left += 1\n    return [best[0] + 1, best[1] + 1]", ["defaultdict", "while", "left"], "슬라이딩 윈도우로 모든 종류를 포함하는 최소 구간을 갱신합니다."],
      ["중", "문제: 대기실 거리두기\n5x5 대기실 places가 주어집니다. 각 대기실에서 응시자 P 사이의 맨해튼 거리가 2 이하일 때 파티션 X로 막혀 있지 않으면 위반입니다. 각 대기실별 준수 여부를 1 또는 0으로 반환하세요.", "from collections import deque\n\ndef check(place):\n    for r in range(5):\n        for c in range(5):\n            if place[r][c] != 'P':\n                continue\n            q = deque([(r, c, 0)])\n            visited = {(r, c)}\n            while q:\n                x, y, d = q.popleft()\n                if d == 2:\n                    continue\n                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):\n                    nx, ny = x + dx, y + dy\n                    if 0 <= nx < 5 and 0 <= ny < 5 and (nx, ny) not in visited:\n                        if place[nx][ny] == 'X':\n                            continue\n                        if place[nx][ny] == 'P':\n                            return 0\n                        visited.add((nx, ny))\n                        q.append((nx, ny, d + 1))\n    return 1\n\ndef solution(places):\n    return [check(place) for place in places]", ["deque", "check", "return [check"], "각 P에서 거리 2까지만 BFS로 확인하면 됩니다."],
      ["상", "문제: 순위 검색\n지원자 정보 info와 쿼리 query가 주어집니다. 언어/직군/경력/음식 조건과 점수 기준을 만족하는 지원자 수를 각 쿼리마다 반환하세요.", "from collections import defaultdict\nfrom itertools import combinations\nfrom bisect import bisect_left\n\ndef solution(info, query):\n    table = defaultdict(list)\n    for row in info:\n        parts = row.split()\n        attrs, score = parts[:-1], int(parts[-1])\n        for r in range(5):\n            for comb in combinations(range(4), r):\n                key = attrs[:]\n                for idx in comb:\n                    key[idx] = '-'\n                table[tuple(key)].append(score)\n    for scores in table.values():\n        scores.sort()\n    answer = []\n    for q in query:\n        q = q.replace(' and ', ' ').split()\n        key, score = tuple(q[:-1]), int(q[-1])\n        scores = table[key]\n        answer.append(len(scores) - bisect_left(scores, score))\n    return answer", ["combinations", "bisect_left", "defaultdict"], "모든 '-' 조합 키를 미리 만들고 점수 리스트를 정렬해 쿼리는 이분 탐색으로 처리합니다."],
      ["중", "문제: 주차 요금 계산\nfees=[기본시간, 기본요금, 단위시간, 단위요금], records는 'HH:MM 차량번호 IN/OUT' 형식입니다. 차량별 누적 주차 시간에 따른 요금을 차량번호 오름차순으로 반환하세요.", "import math\n\ndef to_minute(time):\n    h, m = map(int, time.split(':'))\n    return h * 60 + m\n\ndef solution(fees, records):\n    base_time, base_fee, unit_time, unit_fee = fees\n    in_time = {}\n    total = {}\n    for record in records:\n        time, car, action = record.split()\n        if action == 'IN':\n            in_time[car] = to_minute(time)\n        else:\n            total[car] = total.get(car, 0) + to_minute(time) - in_time.pop(car)\n    end = to_minute('23:59')\n    for car, start in in_time.items():\n        total[car] = total.get(car, 0) + end - start\n    answer = []\n    for car in sorted(total):\n        minutes = total[car]\n        fee = base_fee\n        if minutes > base_time:\n            fee += math.ceil((minutes - base_time) / unit_time) * unit_fee\n        answer.append(fee)\n    return answer", ["to_minute", "sorted", "math.ceil"], "입출차 시간을 분 단위로 누적하고 출차 기록이 없는 차량은 23:59 출차로 처리합니다."],
      ["중", "문제: 숫자 문자열 변환\n문자열 s에는 숫자와 영단어 zero~nine이 섞여 있습니다. 모든 영단어를 숫자로 바꾼 정수를 반환하세요.", "def solution(s):\n    words = ['zero','one','two','three','four','five','six','seven','eight','nine']\n    for number, word in enumerate(words):\n        s = s.replace(word, str(number))\n    return int(s)", ["replace", "enumerate", "int"], "각 영단어를 대응 숫자로 치환한 뒤 정수로 변환합니다."],
      ["상", "문제: 합승 택시 요금\n지점 수 n, 출발 s, 도착 a/b, 간선 fares가 주어집니다. 둘이 함께 이동하다가 갈라질 수 있을 때 최저 택시 요금을 반환하세요.", "def solution(n, s, a, b, fares):\n    INF = 10**9\n    dist = [[INF] * (n + 1) for _ in range(n + 1)]\n    for i in range(1, n + 1):\n        dist[i][i] = 0\n    for x, y, cost in fares:\n        dist[x][y] = cost\n        dist[y][x] = cost\n    for k in range(1, n + 1):\n        for i in range(1, n + 1):\n            for j in range(1, n + 1):\n                dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])\n    answer = INF\n    for mid in range(1, n + 1):\n        answer = min(answer, dist[s][mid] + dist[mid][a] + dist[mid][b])\n    return answer", ["dist", "for k", "mid"], "모든 지점 간 최단거리를 구한 뒤 합승 종료 지점을 전부 시도합니다."],
      ["중", "문제: 개인정보 수집 유효기간\n오늘 날짜 today, 약관별 유효기간 terms, 개인정보 privacies가 주어집니다. 만료된 개인정보 번호를 오름차순으로 반환하세요. 한 달은 28일로 계산합니다.", "def to_days(date):\n    y, m, d = map(int, date.split('.'))\n    return y * 12 * 28 + m * 28 + d\n\ndef solution(today, terms, privacies):\n    term_map = {}\n    for term in terms:\n        key, month = term.split()\n        term_map[key] = int(month) * 28\n    now = to_days(today)\n    answer = []\n    for idx, privacy in enumerate(privacies, 1):\n        date, key = privacy.split()\n        if to_days(date) + term_map[key] <= now:\n            answer.append(idx)\n    return answer", ["to_days", "term_map", "enumerate"], "날짜를 모두 일수로 변환하면 만료 여부를 단순 비교로 판단할 수 있습니다."]
    ])
  },
  {
    id: "pcce",
    name: "PCCE",
    desc: "기초 프로그래밍, Python 문법, 조건문, 반복문, 함수",
    questions: makeQuestions([
      ["하", "다음 코드의 출력은?\n\nprint(3 + 5)", ["8", "35", "2", "Error"], 1, "정수 3과 5를 더하므로 8이 출력됩니다."],
      ["하", "Python에서 문자열을 나타내는 값은?", ["123", "'hello'", "True", "[1,2]"], 2, "따옴표로 감싼 값은 문자열입니다."],
      ["중", "다음 코드의 출력은?\n\nx = 10\nif x > 5:\n    print('A')\nelse:\n    print('B')", ["A", "B", "AB", "출력 없음"], 1, "x가 5보다 크므로 if 블록의 A가 출력됩니다."],
      ["하", "리스트의 길이를 구하는 함수는?", ["len()", "sum()", "str()", "int()"], 1, "len(list)는 리스트 원소 개수를 반환합니다."],
      ["중", "다음 반복문은 몇 번 실행되는가?\n\nfor i in range(3):\n    print(i)", ["2번", "3번", "4번", "무한 반복"], 2, "range(3)은 0, 1, 2 세 값을 만듭니다."],
      ["하", "나머지를 구하는 연산자는?", ["%", "//", "**", "=="], 1, "%는 나눗셈의 나머지를 구하는 연산자입니다."],
      ["중", "다음 코드의 출력은?\n\nname = 'KB'\nprint(name + 'DT')", ["KBDT", "KB DT", "Error", "DTKB"], 1, "문자열 + 연산은 두 문자열을 이어 붙입니다."],
      ["중", "리스트에 값을 추가하는 메서드는?", ["append", "split", "strip", "lower"], 1, "append는 리스트 끝에 새 원소를 추가합니다."],
      ["하", "불리언 값이 아닌 것은?", ["True", "False", "3.14", "1 > 0"], 3, "3.14는 실수이며 불리언 값이 아닙니다."],
      ["중", "다음 코드의 출력은?\n\narr = [10, 20, 30]\nprint(arr[0])", ["10", "20", "30", "0"], 1, "리스트 인덱스는 0부터 시작하므로 arr[0]은 10입니다."],
      ["중", "함수를 정의할 때 사용하는 키워드는?", ["def", "for", "if", "classify"], 1, "Python에서 함수 정의는 def 키워드를 사용합니다."],
      ["하", "정수형으로 변환하는 함수는?", ["int()", "str()", "list()", "print()"], 1, "int()는 가능한 값을 정수로 변환합니다."],
      ["중", "다음 코드의 출력은?\n\nfor i in range(1, 4):\n    print(i)", ["0 1 2", "1 2 3", "1 2 3 4", "4"], 2, "range(1,4)는 1 이상 4 미만인 1, 2, 3을 생성합니다."],
      ["중", "조건이 참일 때만 반복하는 문은?", ["while", "import", "return", "breakpoint"], 1, "while문은 조건식이 참인 동안 반복합니다."],
      ["하", "같다를 비교하는 연산자는?", ["=", "==", "!=", ">="], 2, "=는 대입이고 ==는 동등 비교입니다."],
      ["중", "다음 코드의 결과는?\n\nx = 7\nprint(x // 2)", ["3", "3.5", "4", "14"], 1, "//는 몫 연산이므로 7 // 2는 3입니다."],
      ["중", "문자열을 리스트로 나눌 때 사용하는 메서드는?", ["split", "append", "pop", "sort"], 1, "split은 구분자를 기준으로 문자열을 나눠 리스트를 만듭니다."],
      ["하", "반복문을 즉시 종료하는 키워드는?", ["break", "continue", "pass", "returning"], 1, "break는 가장 가까운 반복문을 종료합니다."],
      ["중", "다음 코드의 출력은?\n\nanswer = []\nanswer.append(1)\nanswer.append(2)\nprint(answer)", ["[]", "[1]", "[1, 2]", "[2, 1]"], 3, "append를 두 번 호출해 1과 2가 순서대로 추가됩니다."],
      ["중", "PCCE 문제를 풀 때 코드 빈칸 채우기에서 가장 먼저 확인할 것은?", ["변수의 타입과 앞뒤 문맥", "폰트 크기", "파일 이름", "브라우저 종류"], 1, "기초 코딩 문제는 변수 타입, 조건, 반복 범위를 문맥에서 파악하는 것이 중요합니다."]
    ])
  }
];

const state = {
  screen: "subjects",
  subjectId: null,
  mode: null,
  index: 0,
  selected: null,
  singleAnswers: {},
  mockAnswers: {},
  wrongNotes: new Map()
};

const $ = (id) => document.getElementById(id);

const els = {
  screens: document.querySelectorAll(".screen"),
  navBtns: document.querySelectorAll(".nav-btn"),
  subjectGrid: $("subjectGrid"),
  selectedSubjectEyebrow: $("selectedSubjectEyebrow"),
  selectedSubjectTitle: $("selectedSubjectTitle"),
  startSingleBtn: $("startSingleBtn"),
  startMockBtn: $("startMockBtn"),
  singleSubject: $("singleSubject"),
  singleProgress: $("singleProgress"),
  singleQuestionGrid: $("singleQuestionGrid"),
  singleQuestionNumber: $("singleQuestionNumber"),
  singleDifficulty: $("singleDifficulty"),
  singleQuestionText: $("singleQuestionText"),
  singleChoices: $("singleChoices"),
  singleSubmitBtn: $("singleSubmitBtn"),
  singleWrongBtn: $("singleWrongBtn"),
  singlePrevBtn: $("singlePrevBtn"),
  singleNextBtn: $("singleNextBtn"),
  singleResultBadge: $("singleResultBadge"),
  singleFeedbackTitle: $("singleFeedbackTitle"),
  singleExplanation: $("singleExplanation"),
  mockSubject: $("mockSubject"),
  mockProgress: $("mockProgress"),
  mockQuestionGrid: $("mockQuestionGrid"),
  mockQuestionNumber: $("mockQuestionNumber"),
  mockDifficulty: $("mockDifficulty"),
  mockQuestionText: $("mockQuestionText"),
  mockChoices: $("mockChoices"),
  mockPrevBtn: $("mockPrevBtn"),
  mockNextBtn: $("mockNextBtn"),
  gradeMockBtn: $("gradeMockBtn"),
  resultScore: $("resultScore"),
  resultSummary: $("resultSummary"),
  resultList: $("resultList"),
  wrongList: $("wrongList"),
  wrongTopCount: $("wrongTopCount"),
  todayCount: $("todayCount"),
  homeLink: $("homeLink"),
  toast: $("toast"),
  generateBtn: $("generateBtn"),
  loading: $("loading"),
  apiResult: $("apiResult")
};

function currentSubject() {
  return subjects.find((subject) => subject.id === state.subjectId) || subjects[0];
}

function currentQuestions() {
  return currentSubject().questions;
}

function showScreen(name) {
  state.screen = name;
  els.screens.forEach((screen) => screen.classList.toggle("active", screen.id === `${name}Screen`));
  els.navBtns.forEach((button) => button.classList.toggle("active", button.dataset.screen === name));
  if (name === "wrong") renderWrongNotes();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSubjects() {
  els.subjectGrid.innerHTML = "";
  subjects.forEach((subject) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "subject-card";
    card.innerHTML = `
      <span class="subject-meta">${subject.questions.length}문항</span>
      <strong>${subject.name}</strong>
      <small>${subject.desc}</small>
    `;
    card.addEventListener("click", () => selectSubject(subject.id));
    els.subjectGrid.appendChild(card);
  });
}

function selectSubject(subjectId) {
  state.subjectId = subjectId;
  state.index = 0;
  state.selected = null;
  state.singleAnswers = {};
  state.mockAnswers = {};
  const subject = currentSubject();
  els.selectedSubjectEyebrow.textContent = "Selected Subject";
  els.selectedSubjectTitle.textContent = subject.name;
  showScreen("mode");
}

function startSingle() {
  state.mode = "single";
  state.index = 0;
  state.selected = null;
  renderSingle();
  showScreen("single");
}

function startMock() {
  state.mode = "mock";
  state.index = 0;
  state.selected = state.mockAnswers[0] || null;
  renderMock();
  showScreen("mock");
}

function renderSingle() {
  const subject = currentSubject();
  const questions = currentQuestions();
  const question = questions[state.index];
  const answered = state.singleAnswers[state.index];

  els.singleSubject.textContent = subject.name;
  els.singleProgress.textContent = `${Object.keys(state.singleAnswers).length} / ${questions.length}`;
  els.singleQuestionNumber.textContent = `Q${state.index + 1}`;
  els.singleDifficulty.textContent = question.difficulty;
  els.singleQuestionText.textContent = question.text;
  els.singlePrevBtn.disabled = state.index === 0;
  els.singleNextBtn.disabled = state.index === questions.length - 1;
  renderChoices(els.singleChoices, question, answered, (choiceNumber) => {
    state.selected = choiceNumber;
    renderSingle();
  });
  renderSingleFeedback(question, answered);
  renderQuestionGrid(els.singleQuestionGrid, questions, state.singleAnswers, state.index, moveSingle);
}

function renderSingleFeedback(question, answered) {
  els.singleResultBadge.className = "result-badge";
  if (!answered) {
    els.singleResultBadge.textContent = "대기";
    els.singleFeedbackTitle.textContent = question.type === "coding" ? "코드를 입력하면 채점 힌트가 표시됩니다." : "답안을 선택하면 결과가 표시됩니다.";
    els.singleExplanation.textContent = question.type === "coding" ? "현재 화면에서는 브라우저 안에서 코드를 실행하지 않고, 핵심 구현 키워드 기반으로 간단히 확인합니다." : "한 문제씩 풀기에서는 정답 확인 즉시 채점과 해설을 볼 수 있습니다.";
    return;
  }

  if (question.type === "coding") {
    els.singleResultBadge.classList.add(answered.correct ? "correct" : "wrong");
    els.singleResultBadge.textContent = answered.correct ? "제출 확인" : "보완 필요";
    els.singleFeedbackTitle.textContent = answered.correct ? "핵심 구현 요소가 포함되어 있습니다." : "코드를 조금 더 보완해보세요.";
    els.singleExplanation.textContent = `${question.explanation}\n\n모범답안\n${question.sampleSolution}`;
  } else if (answered.correct) {
    els.singleResultBadge.classList.add("correct");
    els.singleResultBadge.textContent = "정답";
    els.singleFeedbackTitle.textContent = "맞았습니다.";
  } else {
    els.singleResultBadge.classList.add("wrong");
    els.singleResultBadge.textContent = "오답";
    els.singleFeedbackTitle.textContent = `선택 ${answered.selected}번, 정답 ${question.answer}번`;
  }
  els.singleExplanation.textContent = question.explanation;
}

function submitSingle() {
  if (!state.selected) {
    els.singleFeedbackTitle.textContent = "먼저 답안을 선택해주세요.";
    els.singleExplanation.textContent = "보기 또는 코드 답안을 입력한 다음 정답 확인을 누르면 바로 확인됩니다.";
    return;
  }

  const question = currentQuestions()[state.index];
  const correct = question.type === "coding" ? evaluateCodingAnswer(question, state.selected) : state.selected === question.answer;
  state.singleAnswers[state.index] = { selected: state.selected, correct };
  if (!correct) addWrongNote(state.index, false);
  renderTopStats();
  renderSingle();
}

function moveSingle(index) {
  state.index = Math.max(0, Math.min(index, currentQuestions().length - 1));
  state.selected = state.singleAnswers[state.index]?.selected || null;
  renderSingle();
}

function renderMock() {
  const subject = currentSubject();
  const questions = currentQuestions();
  const question = questions[state.index];
  const answered = state.mockAnswers[state.index];

  els.mockSubject.textContent = subject.name;
  els.mockProgress.textContent = `${Object.keys(state.mockAnswers).length} / ${questions.length}`;
  els.mockQuestionNumber.textContent = `Q${state.index + 1}`;
  els.mockDifficulty.textContent = question.difficulty;
  els.mockQuestionText.textContent = question.text;
  els.mockPrevBtn.disabled = state.index === 0;
  els.mockNextBtn.disabled = state.index === questions.length - 1;
  renderChoices(els.mockChoices, question, null, (choiceNumber) => {
    state.mockAnswers[state.index] = choiceNumber;
    state.selected = choiceNumber;
    renderTopStats();
    renderMock();
  }, answered);
  renderQuestionGrid(els.mockQuestionGrid, questions, state.mockAnswers, state.index, moveMock);
}

function moveMock(index) {
  state.index = Math.max(0, Math.min(index, currentQuestions().length - 1));
  state.selected = state.mockAnswers[state.index] || null;
  renderMock();
}

function gradeMock() {
  const questions = currentQuestions();
  let correctCount = 0;
  els.resultList.innerHTML = "";

  questions.forEach((question, index) => {
    const selected = state.mockAnswers[index];
    const correct = question.type === "coding" ? evaluateCodingAnswer(question, selected) : selected === question.answer;
    if (correct) correctCount += 1;
    if (!correct) addWrongNote(index, false);

    const item = document.createElement("article");
    const status = document.createElement("span");
    const body = document.createElement("div");
    const title = document.createElement("div");
    const sub = document.createElement("div");
    const result = document.createElement("strong");
    item.className = "result-item";
    status.className = `status-dot ${correct ? "" : "wrong"}`;
    status.textContent = correct ? "O" : "X";
    title.className = "item-title";
    title.textContent = `Q${index + 1}. ${question.text}`;
    sub.className = "item-sub";
    sub.textContent = question.type === "coding"
      ? `제출 ${selected ? "완료" : "없음"} · ${question.explanation}`
      : `선택 ${selected || "-"}번 · 정답 ${question.answer}번 · ${question.explanation}`;
    result.textContent = correct ? "정답" : "오답";
    body.append(title, sub);
    item.append(status, body, result);
    els.resultList.appendChild(item);
  });

  const score = Math.round((correctCount / questions.length) * 100);
  els.resultScore.textContent = `${score}점`;
  els.resultSummary.textContent = `${currentSubject().name} ${questions.length}문항 중 ${correctCount}문항을 맞혔습니다. 오답은 자동으로 오답노트에 저장됩니다.`;
  renderTopStats();
  showScreen("result");
}

function renderChoices(target, question, checkedAnswer, onSelect, selectedOnly = state.selected) {
  target.innerHTML = "";
  if (question.type === "coding") {
    renderCodingAnswer(target, question, checkedAnswer, onSelect, selectedOnly);
    return;
  }
  question.choices.forEach((choice, index) => {
    const choiceNumber = index + 1;
    const li = document.createElement("li");
    const button = document.createElement("button");
    const num = document.createElement("span");
    const text = document.createElement("span");

    button.type = "button";
    button.className = "choice-btn";
    if (selectedOnly === choiceNumber) button.classList.add("selected");
    if (checkedAnswer) {
      if (choiceNumber === question.answer) button.classList.add("correct");
      if (choiceNumber === checkedAnswer.selected && !checkedAnswer.correct) button.classList.add("wrong");
    }
    num.className = "choice-num";
    num.textContent = choiceNumber;
    text.textContent = choice;
    button.append(num, text);
    button.addEventListener("click", () => onSelect(choiceNumber));
    li.appendChild(button);
    target.appendChild(li);
  });
}

function renderCodingAnswer(target, question, checkedAnswer, onSelect, selectedValue) {
  const li = document.createElement("li");
  const wrap = document.createElement("div");
  const label = document.createElement("label");
  const textarea = document.createElement("textarea");
  const guide = document.createElement("p");

  wrap.className = "coding-answer";
  label.className = "coding-label";
  label.textContent = "답안 코드";
  textarea.className = "code-input";
  textarea.spellcheck = false;
  textarea.value = selectedValue || checkedAnswer?.selected || "";
  textarea.placeholder = "def solution(...):\n    # 여기에 코드를 작성하세요";
  textarea.addEventListener("input", () => onSelect(textarea.value));
  guide.className = "coding-guide";
  guide.textContent = "실제 실행 채점 대신 핵심 구현 요소를 확인하고, 정답 확인 후 모범답안을 보여줍니다.";

  wrap.append(label, textarea, guide);
  li.appendChild(wrap);
  target.appendChild(li);
}

function evaluateCodingAnswer(question, answer) {
  const normalized = String(answer || "").replace(/\s+/g, " ").toLowerCase();
  if (!normalized.trim()) return false;
  return question.keywords.every((keyword) => normalized.includes(String(keyword).toLowerCase()));
}

function renderQuestionGrid(target, questions, answers, activeIndex, onMove) {
  target.innerHTML = "";
  questions.forEach((question, index) => {
    const button = document.createElement("button");
    const answer = answers[index];
    button.type = "button";
    button.className = "question-jump";
    button.textContent = index + 1;
    if (index === activeIndex) button.classList.add("active");
    if (answer) {
      const isWrong = typeof answer === "object" && answer.correct === false;
      button.classList.add(isWrong ? "wrong" : "answered");
    }
    button.addEventListener("click", () => onMove(index));
    target.appendChild(button);
  });
}

function addWrongNote(index, notify = true) {
  const subject = currentSubject();
  const key = `${subject.id}-${index}`;
  const alreadySaved = state.wrongNotes.has(key);
  state.wrongNotes.set(key, {
    subjectId: subject.id,
    subjectName: subject.name,
    index,
    question: subject.questions[index]
  });
  renderTopStats();
  if (notify) {
    showToast(alreadySaved ? "이미 오답노트에 저장된 문제입니다." : "오답노트에 저장되었습니다.");
  }
}

let toastTimer;

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("show");
  }, 1800);
}

function renderWrongNotes() {
  els.wrongList.innerHTML = "";
  if (state.wrongNotes.size === 0) {
    const empty = document.createElement("article");
    const status = document.createElement("span");
    const body = document.createElement("div");
    const title = document.createElement("div");
    const sub = document.createElement("div");
    empty.className = "wrong-item";
    status.className = "status-dot";
    status.textContent = "-";
    title.className = "item-title";
    title.textContent = "저장된 오답이 없습니다.";
    sub.className = "item-sub";
    sub.textContent = "문제를 틀리거나 오답노트에 저장하면 이곳에 표시됩니다.";
    body.append(title, sub);
    empty.append(status, body);
    els.wrongList.appendChild(empty);
    return;
  }

  state.wrongNotes.forEach((note) => {
    const item = document.createElement("button");
    const status = document.createElement("span");
    const body = document.createElement("div");
    const title = document.createElement("div");
    const sub = document.createElement("div");
    const action = document.createElement("strong");
    item.type = "button";
    item.className = "wrong-item";
    status.className = "status-dot wrong";
    status.textContent = "!";
    title.className = "item-title";
    title.textContent = `${note.subjectName} Q${note.index + 1}`;
    sub.className = "item-sub";
    sub.textContent = note.question.text;
    action.textContent = "다시풀기";
    body.append(title, sub);
    item.append(status, body, action);
    item.addEventListener("click", () => {
      state.subjectId = note.subjectId;
      state.index = note.index;
      state.selected = null;
      renderSingle();
      showScreen("single");
    });
    els.wrongList.appendChild(item);
  });
}

function renderTopStats() {
  const totalSolved = Object.keys(state.singleAnswers).length + Object.keys(state.mockAnswers).length;
  els.todayCount.textContent = totalSolved;
  els.wrongTopCount.textContent = state.wrongNotes.size;
}

async function runHarness() {
  els.generateBtn.disabled = true;
  els.loading.style.display = "flex";
  els.apiResult.style.display = "none";
  els.apiResult.textContent = "";

  try {
    const response = await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_start: 1, page_end: 15 })
    });
    const data = await response.json();
    renderApiResult(data);
  } catch (error) {
    els.apiResult.style.display = "block";
    els.apiResult.textContent = `서버에 연결하지 못했습니다. backend 실행 상태를 확인해주세요. (${error.message})`;
  } finally {
    els.generateBtn.disabled = false;
    els.loading.style.display = "none";
  }
}

function renderApiResult(data) {
  const status = data.final_status || "UNKNOWN";
  const question = data.question || "문제 생성 결과가 없습니다.";
  const log = data.log_ref || "-";
  const retry = data.retry_count ?? 0;
  els.apiResult.style.display = "block";
  els.apiResult.textContent = `${status} · ${question} · retry: ${retry}회 · log: ${log}`;
}

document.querySelectorAll("[data-screen]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.screen));
});

els.homeLink.addEventListener("click", (event) => {
  event.preventDefault();
  showScreen("subjects");
});
els.startSingleBtn.addEventListener("click", startSingle);
els.startMockBtn.addEventListener("click", startMock);
els.singleSubmitBtn.addEventListener("click", submitSingle);
els.singleWrongBtn.addEventListener("click", () => addWrongNote(state.index));
els.singlePrevBtn.addEventListener("click", () => moveSingle(state.index - 1));
els.singleNextBtn.addEventListener("click", () => moveSingle(state.index + 1));
els.mockPrevBtn.addEventListener("click", () => moveMock(state.index - 1));
els.mockNextBtn.addEventListener("click", () => moveMock(state.index + 1));
els.gradeMockBtn.addEventListener("click", gradeMock);
els.generateBtn.addEventListener("click", runHarness);

renderSubjects();
renderTopStats();
