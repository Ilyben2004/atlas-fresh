"""Allocation engine tests: ordering, compatibility, capacity, local residual."""

from __future__ import annotations

import pytest

from engine import calculate_plan
from tests.builders import commercial_by_id, make_client, make_farm, make_station


def test_ordering_serves_higher_price_client_first():
    """Scarce A fruit goes to the higher-priced client first."""
    farms = [make_farm(actual_A=10.0)]
    clients = [
        make_client(
            "C_LO",
            acceptance_mode="EXACT",
            requested_segment="A",
            demand=10.0,
            export_price_per_eur=1.0,
        ),
        make_client(
            "C_HI",
            acceptance_mode="EXACT",
            requested_segment="A",
            demand=10.0,
            export_price_per_eur=3.0,
        ),
    ]
    station = make_station(export_conditioning_capacity=100.0)

    plan = calculate_plan(farms, clients, station)
    by_id = commercial_by_id(plan)

    assert by_id["C_HI"]["status"] == "COMPLETE"
    assert by_id["C_HI"]["allocated_t"] == 10.0
    assert by_id["C_LO"]["status"] == "UNSERVED"
    assert by_id["C_LO"]["allocated_t"] == 0.0
    assert by_id["C_LO"]["shortage_reason"] == "INSUFFICIENT_COMPATIBLE_SEGMENT"


def test_exact_rejects_incompatible_segments():
    """EXACT A cannot take B (or any other) grade."""
    farms = [make_farm(actual_A=0.0, actual_B=20.0)]
    clients = [
        make_client(
            "C_EXACT",
            acceptance_mode="EXACT",
            requested_segment="A",
            demand=10.0,
            export_price_per_eur=2.0,
        ),
    ]
    station = make_station(export_conditioning_capacity=100.0)

    plan = calculate_plan(farms, clients, station)
    row = commercial_by_id(plan)["C_EXACT"]

    assert row["status"] == "UNSERVED"
    assert row["allocated_t"] == 0.0
    assert row["shortage_reason"] == "INSUFFICIENT_COMPATIBLE_SEGMENT"
    assert plan["traceability_ledger"] == []
    assert plan["kpis"]["total_exported_t"] == 0.0


def test_minimum_consumes_lowest_acceptable_grade_first():
    """MINIMUM B should take B before A when both are available."""
    farms = [make_farm(actual_A=10.0, actual_B=10.0)]
    clients = [
        make_client(
            "C_MIN",
            acceptance_mode="MINIMUM",
            requested_segment="B",
            demand=10.0,
            export_price_per_eur=2.0,
        ),
    ]
    station = make_station(export_conditioning_capacity=100.0)

    plan = calculate_plan(farms, clients, station)
    row = commercial_by_id(plan)["C_MIN"]
    ledger = plan["traceability_ledger"]

    assert row["status"] == "COMPLETE"
    assert row["allocated_t"] == 10.0
    assert len(ledger) == 1
    assert ledger[0]["segment"] == "B"
    assert ledger[0]["tonnes_allocated"] == 10.0
    assert ledger[0]["client_id"] == "C_MIN"
    assert ledger[0]["quality_upgrade"] == 0

    production = {r["farm_id"]: r for r in plan["production_view"]}
    assert production["F01"]["local_residual_t"] == 10.0


def test_price_tie_breaks_by_client_id():
    """Equal prices: lower client_id is served first."""
    farms = [make_farm(actual_A=10.0)]
    clients = [
        make_client("C_B", demand=10.0, export_price_per_eur=2.0, requested_segment="A"),
        make_client("C_A", demand=10.0, export_price_per_eur=2.0, requested_segment="A"),
    ]
    plan = calculate_plan(farms, clients, make_station())
    by_id = commercial_by_id(plan)
    assert by_id["C_A"]["status"] == "COMPLETE"
    assert by_id["C_B"]["status"] == "UNSERVED"


def test_compatible_supply_prefers_lower_farm_id():
    """Same upgrade: allocate from lower farm_id first."""
    farms = [
        make_farm("F02", actual_B=10.0),
        make_farm("F01", actual_B=10.0),
    ]
    clients = [
        make_client(
            "C1",
            acceptance_mode="EXACT",
            requested_segment="B",
            demand=10.0,
            export_price_per_eur=2.0,
        ),
    ]
    plan = calculate_plan(farms, clients, make_station())
    ledger = plan["traceability_ledger"]
    assert len(ledger) == 1
    assert ledger[0]["farm_id"] == "F01"


def test_minimum_records_quality_upgrade_when_using_better_grade():
    farms = [make_farm(actual_A=10.0, actual_B=0.0)]
    clients = [
        make_client(
            "C_MIN",
            acceptance_mode="MINIMUM",
            requested_segment="B",
            demand=10.0,
            export_price_per_eur=2.0,
        ),
    ]
    plan = calculate_plan(farms, clients, make_station())
    ledger = plan["traceability_ledger"]
    assert ledger[0]["segment"] == "A"
    assert ledger[0]["quality_upgrade"] == 1


def test_station_capacity_hard_limit():
    """Exports stop at station capacity; later clients are station-shorted."""
    farms = [make_farm(actual_A=50.0)]
    clients = [
        make_client(
            "C1",
            acceptance_mode="EXACT",
            requested_segment="A",
            demand=30.0,
            export_price_per_eur=3.0,
        ),
        make_client(
            "C2",
            acceptance_mode="EXACT",
            requested_segment="A",
            demand=30.0,
            export_price_per_eur=1.0,
        ),
    ]
    capacity = 40.0
    station = make_station(export_conditioning_capacity=capacity)

    plan = calculate_plan(farms, clients, station)
    by_id = commercial_by_id(plan)

    assert plan["kpis"]["total_exported_t"] == capacity
    assert by_id["C1"]["status"] == "COMPLETE"
    assert by_id["C1"]["allocated_t"] == 30.0
    assert by_id["C2"]["status"] == "PARTIAL"
    assert by_id["C2"]["allocated_t"] == 10.0
    assert by_id["C2"]["remaining_t"] == 20.0
    assert by_id["C2"]["export_revenue_eur"] == pytest.approx(10.0)
    assert by_id["C2"]["shortage_reason"] == "STATION_CAPACITY_REACHED"
    assert plan["kpis"]["total_expected_t"] == 40.0
    assert plan["kpis"]["at_risk_client_count"] == 1
    assert plan["kpis"]["total_value_eur"] == pytest.approx(
        plan["kpis"]["total_export_revenue_eur"]
        + plan["kpis"]["total_local_revenue_eur"]
    )
    prod = plan["production_view"][0]
    assert "expected_A" in prod and "variance_A" in prod
    assert prod["variance_A"] == pytest.approx(50.0 - 40.0 * 0.25)


def test_local_residual_valued_at_local_market_ratio():
    """Unexported inventory becomes local residual valued with ratio × segment price."""
    farms = [make_farm(actual_A=10.0, actual_B=5.0)]
    clients: list = []
    ratio = 0.5
    prices = {"A": 2.0, "B": 1.5, "C": 1.0, "D": 0.5}
    station = make_station(
        export_conditioning_capacity=100.0,
        local_market_ratio=ratio,
        segment_prices=prices,
    )

    plan = calculate_plan(farms, clients, station)

    expected_residual = 15.0
    expected_local_revenue = (10.0 * ratio * prices["A"]) + (5.0 * ratio * prices["B"])

    assert plan["kpis"]["total_exported_t"] == 0.0
    assert plan["kpis"]["total_local_residual_t"] == expected_residual
    assert plan["kpis"]["total_local_revenue_eur"] == pytest.approx(
        expected_local_revenue, abs=1e-6
    )
    assert plan["production_view"][0]["local_residual_t"] == expected_residual
