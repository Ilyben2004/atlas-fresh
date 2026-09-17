"""JSON plan endpoint tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import app
from tests.builders import make_client, make_farm, make_station


client = TestClient(app)


def _payload() -> dict:
    farm = make_farm(actual_A=10.0)
    buyer = make_client(
        "C01",
        acceptance_mode="EXACT",
        requested_segment="A",
        demand=10.0,
        export_price_per_eur=2.0,
    )
    station = make_station(export_conditioning_capacity=100.0)
    return {"farms": [farm], "clients": [buyer], "station": station}


def test_json_plan_happy_path():
    response = client.post("/api/v1/plan/json", json=_payload())
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["kpis"]["total_exported_t"] == 10.0
    assert body["inputs"] is not None
    assert body["inputs"]["farms"][0]["farm_id"] == "F01"
    assert body["commercial_view"][0]["status"] == "COMPLETE"


def test_json_plan_validation_failure():
    payload = _payload()
    payload["clients"][0]["demand"] = 7  # not a multiple of 5
    response = client.post("/api/v1/plan/json", json=payload)
    assert response.status_code == 400
    detail = str(response.json().get("detail") or "")
    assert "Clients sheet" in detail
    assert "multiple of 5" in detail.lower()
    assert "demand" in detail.lower()
    assert "clients.0.demand" not in detail
    assert "Value error" not in detail


def test_json_plan_negative_actual_is_plain_english():
    payload = _payload()
    payload["farms"][0]["actual_B"] = -5
    response = client.post("/api/v1/plan/json", json=payload)
    assert response.status_code == 400
    detail = str(response.json().get("detail") or "")
    assert "Farms sheet" in detail
    assert "row 1" in detail
    assert "actual b tonnes" in detail.lower()
    assert "cannot be negative" in detail.lower()
    assert "farms.0.actual_B" not in detail
    assert "Value error" not in detail
