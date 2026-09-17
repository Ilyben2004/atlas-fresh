"""Schema validation tests mirroring ingestion rules."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from schemas import ClientInput, FarmInput, StationInput


def _valid_farm(**overrides):
    base = {
        "farm_id": "F01",
        "farm_name": "Farm",
        "expected_daily_capacity": 40.0,
        "expected_A_pct": 0.25,
        "expected_B_pct": 0.25,
        "expected_C_pct": 0.25,
        "expected_D_pct": 0.25,
        "actual_A": 10.0,
        "actual_B": 0.0,
        "actual_C": 0.0,
        "actual_D": 0.0,
    }
    base.update(overrides)
    return base


def _valid_client(**overrides):
    base = {
        "client_id": "C01",
        "client_name": "Client",
        "acceptance_mode": "EXACT",
        "requested_segment": "A",
        "demand": 10.0,
        "export_price_per_eur": 1.0,
    }
    base.update(overrides)
    return base


def _valid_station(**overrides):
    base = {
        "station_id": "S01",
        "export_conditioning_capacity": 100.0,
        "local_market_ratio": 0.1,
        "segment_prices": [
            {"segment": "A", "reference_export_price_per_eur": 2.0},
            {"segment": "B", "reference_export_price_per_eur": 1.5},
            {"segment": "C", "reference_export_price_per_eur": 1.0},
            {"segment": "D", "reference_export_price_per_eur": 0.5},
        ],
    }
    base.update(overrides)
    return base


def test_farm_mix_must_sum_to_one():
    with pytest.raises(ValidationError) as exc_info:
        FarmInput.model_validate(_valid_farm(expected_D_pct=0.05))
    message = str(exc_info.value).lower()
    assert "1.0" in message or "must exactly equal" in message


def test_client_negative_demand_rejected():
    with pytest.raises(ValidationError):
        ClientInput.model_validate(_valid_client(demand=-5.0))


def test_actual_tonnes_must_be_multiple_of_five():
    with pytest.raises(ValidationError) as exc_info:
        FarmInput.model_validate(_valid_farm(actual_A=12.0))
    assert "multiple of 5" in str(exc_info.value).lower()


def test_demand_must_be_multiple_of_five():
    with pytest.raises(ValidationError) as exc_info:
        ClientInput.model_validate(_valid_client(demand=7.0))
    assert "multiple of 5" in str(exc_info.value).lower()


def test_invalid_acceptance_mode_rejected():
    with pytest.raises(ValidationError) as exc_info:
        ClientInput.model_validate(_valid_client(acceptance_mode="ANY"))
    assert "exact" in str(exc_info.value).lower() or "minimum" in str(exc_info.value).lower()


def test_invalid_requested_segment_rejected():
    with pytest.raises(ValidationError):
        ClientInput.model_validate(_valid_client(requested_segment="Z"))


def test_station_requires_complete_segment_prices():
    with pytest.raises(ValidationError) as exc_info:
        StationInput.model_validate(
            _valid_station(
                segment_prices=[
                    {"segment": "A", "reference_export_price_per_eur": 2.0},
                    {"segment": "B", "reference_export_price_per_eur": 1.5},
                ]
            )
        )
    assert "missing" in str(exc_info.value).lower()


def test_station_capacity_must_be_multiple_of_five():
    with pytest.raises(ValidationError):
        StationInput.model_validate(_valid_station(export_conditioning_capacity=502.0))
