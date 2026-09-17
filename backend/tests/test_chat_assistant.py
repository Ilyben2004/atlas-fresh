"""Assistant boundary tests: grounded answers + unsupported / provider failure."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from api.v1 import chat as chat_mod
from chat_tools import get_clients_at_risk, known_entity_ids
from engine import calculate_plan
from main import app
from tests.builders import make_client, make_farm, make_station


@pytest.fixture
def sample_plan() -> dict[str, Any]:
    farms = [
        make_farm(
            "F01",
            farm_name="North Orchard",
            expected_daily_capacity=40.0,
            actual_A=10.0,
            actual_B=0.0,
            actual_C=0.0,
            actual_D=0.0,
        ),
        make_farm(
            "F02",
            farm_name="South Orchard",
            expected_daily_capacity=40.0,
            actual_A=0.0,
            actual_B=0.0,
            actual_C=0.0,
            actual_D=0.0,
        ),
    ]
    clients = [
        make_client(
            "C01",
            client_name="Acme Fresh",
            acceptance_mode="EXACT",
            requested_segment="A",
            demand=10.0,
            export_price_per_eur=3.0,
        ),
        make_client(
            "C99",
            client_name="Beta Export",
            acceptance_mode="EXACT",
            requested_segment="A",
            demand=10.0,
            export_price_per_eur=1.0,
        ),
    ]
    station = make_station(export_conditioning_capacity=100.0)
    return calculate_plan(farms, clients, station)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    return TestClient(app)


def test_grounded_answer_cites_real_client_ids(
    client: TestClient,
    sample_plan: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Supported answer keeps real IDs and strips invented ones."""
    tool_slice = get_clients_at_risk(sample_plan)
    real_ids = {row["client_id"] for row in tool_slice["clients"]}
    assert "C99" in real_ids

    async def fake_post(*, api_key: str, body: dict[str, Any]) -> dict[str, Any]:
        del api_key, body
        return {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": (
                                    "1 clients still need fruit today:\n"
                                    "1. Beta Export (C99) — not served at all; "
                                    "wanted 10 t, received 0 t, still needs 10 t; "
                                    "quality A (exact quality only); because "
                                    "there was not enough fruit of the quality "
                                    "grade this client accepts.\n"
                                    "Also mentions invented farm ZX99 and client C404."
                                )
                            }
                        ]
                    },
                    "finishReason": "STOP",
                }
            ]
        }

    monkeypatch.setattr(chat_mod, "_gemini_post", fake_post)

    response = client.post(
        "/api/v1/chat",
        json={
            "question": "Which clients are at risk and why?",
            "tool": "get_clients_at_risk",
            "context": sample_plan,
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["tool"] == "get_clients_at_risk"
    answer = payload["answer"] or ""
    assert "C99" in answer
    assert "C404" not in answer
    assert "ZX99" not in answer
    assert "unavailable" in answer

    allowed = known_entity_ids(sample_plan, tool_slice)
    grounded = chat_mod.ground_answer(
        "Client C99 is short; ignore FAKE99 and C404.",
        sample_plan,
        tool_slice,
    )
    assert "C99" in grounded
    assert "FAKE99" not in grounded
    assert "C404" not in grounded
    assert "C99" in allowed


def test_unsupported_question_is_rejected(
    client: TestClient,
    sample_plan: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Free-text off-topic questions are rejected via tool routing."""

    async def fake_post(*, api_key: str, body: dict[str, Any]) -> dict[str, Any]:
        del api_key
        assert "tools" in body
        return {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "functionCall": {
                                    "name": "reject_question",
                                    "args": {"reason": "Off-topic poem request"},
                                }
                            }
                        ]
                    }
                }
            ]
        }

    monkeypatch.setattr(chat_mod, "_gemini_post", fake_post)

    response = client.post(
        "/api/v1/chat",
        json={
            "question": "Write a poem about apples",
            "context": sample_plan,
        },
    )
    assert response.status_code == 400
    detail = str(response.json().get("detail") or "")
    assert "not allowed" in detail.lower()


def test_provider_failure_is_honest(
    client: TestClient,
    sample_plan: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Provider errors surface as 503, never a fake AI answer."""

    async def boom(*, api_key: str, body: dict[str, Any]) -> dict[str, Any]:
        del api_key, body
        raise RuntimeError("Gemini HTTP 503: upstream unavailable")

    monkeypatch.setattr(chat_mod, "_gemini_post", boom)

    response = client.post(
        "/api/v1/chat",
        json={
            "question": "Which clients are at risk and why?",
            "tool": "get_clients_at_risk",
            "context": sample_plan,
        },
    )
    assert response.status_code == 503
    detail = str(response.json().get("detail") or "")
    assert "provider" in detail.lower() or "gemini" in detail.lower()
    assert "C99" not in detail


def test_no_key_status_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "")
    # Force re-read via empty key
    with TestClient(app) as client:
        status = client.get("/api/v1/chat/status")
        assert status.status_code == 200
        assert status.json()["status"] == "no_key"

        response = client.post(
            "/api/v1/chat",
            json={"question": "Which clients are at risk and why?", "context": {}},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "no_key"
        assert response.json()["answer"] is None
