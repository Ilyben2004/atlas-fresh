from __future__ import annotations

import json
import os
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

ALLOWED_QUESTIONS: tuple[str, ...] = (
    "Which clients are at risk and why?",
    "Which farm/segment gaps matter most today?",
    "Why are 60 t going local and what is their estimated value?",
)

SYSTEM_PROMPT = """You are the Atlas Fresh Supply Chain AI. You analyze daily apple allocations.
Read-only boundary: You cannot calculate allocations or change data.
You MUST base your answer strictly on the provided JSON context. Do not hallucinate.
You MUST cite resolvable, real Client IDs (e.g., C02) and Farm IDs (e.g., F05) in your answer.
If the answer is not in the data, explicitly state it is unavailable.
Keep answers concise, operational, and grounded in the dashboard JSON only."""

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "30"))

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    question: str = Field(min_length=1)
    context: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    status: str
    question: str | None = None
    answer: str | None = None


class ChatStatusResponse(BaseModel):
    status: str


def _gemini_api_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or "").strip()


@router.get("/chat/status", response_model=ChatStatusResponse)
def chat_status() -> ChatStatusResponse:
    return ChatStatusResponse(status="ready" if _gemini_api_key() else "no_key")


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    question = payload.question.strip()
    if question not in ALLOWED_QUESTIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Question is not allowed. Use one of the three approved Plan Assistant prompts."
            ),
        )

    api_key = _gemini_api_key()
    if not api_key:
        return ChatResponse(status="no_key", question=question, answer=None)

    try:
        answer = await _ask_gemini(api_key=api_key, question=question, context=payload.context)
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=503,
            detail="Gemini provider timed out. Try again shortly.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Gemini provider failed. The assistant is temporarily unavailable.",
        ) from exc

    return ChatResponse(status="ok", question=question, answer=answer)


async def _ask_gemini(*, api_key: str, question: str, context: dict[str, Any]) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent"
    )
    body = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "Dashboard JSON context (authoritative):\n"
                            f"{json.dumps(context, default=str)}\n\n"
                            f"Approved question:\n{question}"
                        )
                    }
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 800,
        },
    }

    async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT_SECONDS) as client:
        response = await client.post(url, params={"key": api_key}, json=body)

    if response.status_code >= 400:
        raise RuntimeError(f"Gemini HTTP {response.status_code}: {response.text[:300]}")

    data = response.json()
    parts = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [])
    )
    text = "".join(str(part.get("text", "")) for part in parts).strip()
    if not text:
        raise RuntimeError("Gemini returned an empty answer.")
    return text
