"""Shared builders for allocation and validation tests."""

from __future__ import annotations

from typing import Any


def make_farm(
    farm_id: str = "F01",
    *,
    farm_name: str | None = None,
    expected_daily_capacity: float = 40.0,
    expected_A_pct: float = 0.25,
    expected_B_pct: float = 0.25,
    expected_C_pct: float = 0.25,
    expected_D_pct: float = 0.25,
    actual_A: float = 0.0,
    actual_B: float = 0.0,
    actual_C: float = 0.0,
    actual_D: float = 0.0,
) -> dict[str, Any]:
    return {
        "farm_id": farm_id,
        "farm_name": farm_name or f"Farm {farm_id}",
        "expected_daily_capacity": expected_daily_capacity,
        "expected_A_pct": expected_A_pct,
        "expected_B_pct": expected_B_pct,
        "expected_C_pct": expected_C_pct,
        "expected_D_pct": expected_D_pct,
        "actual_A": actual_A,
        "actual_B": actual_B,
        "actual_C": actual_C,
        "actual_D": actual_D,
    }


def make_client(
    client_id: str = "C01",
    *,
    client_name: str | None = None,
    acceptance_mode: str = "EXACT",
    requested_segment: str = "A",
    demand: float = 10.0,
    export_price_per_eur: float = 1.0,
) -> dict[str, Any]:
    return {
        "client_id": client_id,
        "client_name": client_name or f"Client {client_id}",
        "acceptance_mode": acceptance_mode,
        "requested_segment": requested_segment,
        "demand": demand,
        "export_price_per_eur": export_price_per_eur,
    }


def make_station(
    *,
    station_id: str = "S01",
    export_conditioning_capacity: float = 100.0,
    local_market_ratio: float = 0.5,
    segment_prices: dict[str, float] | None = None,
) -> dict[str, Any]:
    prices = segment_prices or {"A": 2.0, "B": 1.5, "C": 1.0, "D": 0.5}
    return {
        "station_id": station_id,
        "export_conditioning_capacity": export_conditioning_capacity,
        "local_market_ratio": local_market_ratio,
        "segment_prices": [
            {
                "segment": segment,
                "reference_export_price_per_eur": price,
            }
            for segment, price in prices.items()
        ],
    }


def commercial_by_id(plan: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {row["client_id"]: row for row in plan["commercial_view"]}
