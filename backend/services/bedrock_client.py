from __future__ import annotations

import json
import os

import boto3
from botocore.config import Config

MODEL_ID = os.environ.get(
    "BEDROCK_MODEL_ID", "anthropic.claude-sonnet-4-20250514-v1:0"
)
AWS_REGION = os.environ.get("AWS_REGION", "ap-northeast-2")

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "bedrock-runtime",
            region_name=AWS_REGION,
            config=Config(
                connect_timeout=10,
                read_timeout=60,
                retries={"max_attempts": 1},
            ),
        )
    return _client


def invoke(system_prompt: str, user_prompt: str, max_tokens: int = 2048) -> str:
    client = _get_client()

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }

    response = client.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body, ensure_ascii=False).encode("utf-8"),
    )

    result = json.loads(response["body"].read())
    return result["content"][0]["text"]
