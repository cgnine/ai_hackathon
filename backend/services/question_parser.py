from __future__ import annotations

import json
import re
from typing import Any


def extract_json(raw: str) -> dict[str, Any]:
    """LLM 응답에서 JSON 블록을 추출한다."""
    # ```json ... ``` 블록 우선 탐색
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fence:
        candidate = fence.group(1)
    else:
        # 중괄호로 둘러싸인 첫 번째 JSON 객체 탐색
        brace = re.search(r"(\{.*\})", raw, re.DOTALL)
        if brace:
            candidate = brace.group(1)
        else:
            raise ValueError("LLM 응답에서 JSON을 찾을 수 없습니다.")

    try:
        return json.loads(candidate)
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON 파싱 실패: {e}\n원문: {candidate[:300]}")
