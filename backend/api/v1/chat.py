from __future__ import annotations

import json
import os
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from chat_tools import (
    ALLOWED_TOOL_NAMES,
    REJECT_TOOL_NAME,
    gemini_tool_declarations,
    run_tool,
)

ROUTE_SYSTEM_PROMPT = """You are the Atlas Fresh Supply Chain AI router.
You analyze daily apple allocation dashboards in read-only mode.

You MUST call exactly one tool:
- get_clients_at_risk
- get_farm_segment_gaps
- get_local_residual_value
- reject_question

Map paraphrases and different numbers to the matching intent tool.
Examples:
- "why are 55t going local?" → get_local_residual_value
- "which clients were shorted?" → get_clients_at_risk
- "biggest orchard shortages today?" → get_farm_segment_gaps
- "write a poem" → reject_question

Do not invent data. Do not answer in plain text on this turn — call a tool."""

ANSWER_SYSTEM_PROMPT = """You are the Atlas Fresh Supply Chain AI writing for non-technical planners.

Rules:
- Read-only: do not invent numbers or IDs. Use only the tool result JSON.
- Write in plain English a business user can understand in under 30 seconds.
- Never show technical codes like PARTIAL, UNSERVED, INSUFFICIENT_COMPATIBLE_SEGMENT, STATION_CAPACITY_REACHED, variance_t, or snake_case field names.
- Prefer the plain-language fields already in the tool result (service_level, plain_reason, short_by_tonnes, etc.).
- For local residual: use station_is_full, exported_tonnes, and station_limit_tonnes to explain why fruit goes local.
- Always mention real Client IDs / Farm IDs when present (for example C02, F13).

Required answer shape (plain text, not markdown tables):
1) One short opening sentence with the headline.
2) Then a simple numbered list, one item per client or farm.
3) Each list item: Name (ID) — what happened — why, in everyday words.
4) Optional one-line closing tip.

Do not use markdown headings, bold markers like **, or code backticks.
If the tool result is empty, say clearly that nothing is at risk / no gaps / no local volume today."""

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
GEMINI_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "30"))

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    question: str = Field(min_length=1)
    context: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    status: str
    question: str | None = None
    answer: str | None = None
    tool: str | None = None


class ChatStatusResponse(BaseModel):
    status: str


def _gemini_api_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or "").strip()


def _gemini_url() -> str:
    return (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent"
    )


@router.get("/chat/status", response_model=ChatStatusResponse)
def chat_status() -> ChatStatusResponse:
    return ChatStatusResponse(status="ready" if _gemini_api_key() else "no_key")


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    api_key = _gemini_api_key()
    if not api_key:
        return ChatResponse(status="no_key", question=question, answer=None, tool=None)

    try:
        tool_name, tool_args = await _route_with_tools(api_key=api_key, question=question)
        if tool_name == REJECT_TOOL_NAME:
            reason = str(tool_args.get("reason") or "Question is outside approved intents.")
            raise HTTPException(
                status_code=400,
                detail=(
                    "Question is not allowed. Ask about clients at risk, "
                    f"farm/segment gaps, or local residual value. ({reason})"
                ),
            )
        if tool_name not in ALLOWED_TOOL_NAMES:
            raise HTTPException(
                status_code=400,
                detail="Question is not allowed. No approved analytical tool was selected.",
            )

        tool_result = run_tool(tool_name, payload.context)
        answer = await _answer_from_tool(
            api_key=api_key,
            question=question,
            tool_name=tool_name,
            tool_result=tool_result,
        )
    except HTTPException:
        raise
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=503,
            detail="Gemini provider timed out. Try again shortly.",
        ) from exc
    except Exception as exc:
        detail = _public_provider_error(exc)
        raise HTTPException(status_code=503, detail=detail) from exc

    return ChatResponse(
        status="ok",
        question=question,
        answer=answer,
        tool=tool_name,
    )


async def _route_with_tools(*, api_key: str, question: str) -> tuple[str, dict[str, Any]]:
    body = {
        "system_instruction": {"parts": [{"text": ROUTE_SYSTEM_PROMPT}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "Classify this user question into exactly one tool call.\n"
                            f"Question: {question}"
                        )
                    }
                ],
            }
        ],
        "tools": [{"function_declarations": gemini_tool_declarations()}],
        "toolConfig": {
            "functionCallingConfig": {
                "mode": "ANY",
                "allowedFunctionNames": [
                    "get_clients_at_risk",
                    "get_farm_segment_gaps",
                    "get_local_residual_value",
                    "reject_question",
                ],
            }
        },
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 256,
        },
    }

    data = await _gemini_post(api_key=api_key, body=body)
    call = _extract_function_call(data)
    if call is None:
        raise HTTPException(
            status_code=400,
            detail="Question is not allowed. The assistant could not route it to an approved tool.",
        )
    name = str(call.get("name") or "")
    args = call.get("args") or {}
    if not isinstance(args, dict):
        args = {}
    return name, args


async def _answer_from_tool(
    *,
    api_key: str,
    question: str,
    tool_name: str,
    tool_result: dict[str, Any],
) -> str:
    body = {
        "system_instruction": {"parts": [{"text": ANSWER_SYSTEM_PROMPT}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            f"User question:\n{question}\n\n"
                            f"Tool used: {tool_name}\n\n"
                            "Tool result JSON (authoritative — answer only from this):\n"
                            f"{json.dumps(tool_result, default=str)}\n\n"
                            "Write the full answer now. Cover every client or farm in the "
                            "tool result. Do not stop mid-sentence."
                        )
                    }
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            # Thinking tokens count against this budget on Gemini 3 — keep it roomy.
            "maxOutputTokens": 4096,
            "thinkingConfig": {
                "thinkingLevel": "minimal",
            },
        },
    }
    data = await _gemini_post(api_key=api_key, body=body)
    text = _extract_text(data)
    finish = _finish_reason(data)
    if not text:
        raise RuntimeError(
            f"Gemini returned an empty answer (finishReason={finish or 'unknown'})."
        )
    if finish == "MAX_TOKENS":
        # Rare with 4096 + minimal thinking; surface clearly rather than a clipped reply.
        raise RuntimeError(
            "Gemini ran out of output tokens before finishing the answer. Try again."
        )
    return text


async def _gemini_post(*, api_key: str, body: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT_SECONDS) as client:
        response = await client.post(_gemini_url(), params={"key": api_key}, json=body)
    if response.status_code >= 400:
        # Older models reject thinkingLevel — retry once without thinkingConfig.
        message = _extract_gemini_error_message(response.text)
        if (
            response.status_code == 400
            and "thinking" in message.lower()
            and "thinkingConfig" in (body.get("generationConfig") or {})
        ):
            retry_body = json.loads(json.dumps(body))
            retry_body["generationConfig"].pop("thinkingConfig", None)
            return await _gemini_post(api_key=api_key, body=retry_body)
        raise RuntimeError(
            f"Gemini HTTP {response.status_code}: {message or response.text[:300]}"
        )
    return response.json()


def _extract_gemini_error_message(raw: str) -> str:
    try:
        payload = json.loads(raw)
        error = payload.get("error") or {}
        message = str(error.get("message") or "").strip()
        status = str(error.get("status") or "").strip()
        if message and status:
            return f"{status}: {message}"
        return message or status
    except Exception:
        return ""


def _public_provider_error(exc: Exception) -> str:
    text = str(exc).strip()
    if text.startswith("Gemini HTTP"):
        # Keep upstream reason visible (API key never included in Gemini bodies).
        return f"Gemini provider failed. {text}"
    return "Gemini provider failed. The assistant is temporarily unavailable."


def _extract_function_call(data: dict[str, Any]) -> dict[str, Any] | None:
    candidates = data.get("candidates") or []
    if not candidates:
        return None
    parts = (candidates[0].get("content") or {}).get("parts") or []
    for part in parts:
        call = part.get("functionCall") or part.get("function_call")
        if call and call.get("name"):
            return call
    return None


def _finish_reason(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    return str(candidates[0].get("finishReason") or candidates[0].get("finish_reason") or "")


def _extract_text(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = (candidates[0].get("content") or {}).get("parts") or []
    chunks: list[str] = []
    for part in parts:
        # Skip internal thought parts — only keep visible answer text.
        if part.get("thought") is True:
            continue
        text = part.get("text")
        if text:
            chunks.append(str(text))
    return "".join(chunks).strip()

