from __future__ import annotations

import math
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

NonNegativeFloat = Annotated[float, Field(allow_inf_nan=False)]
MIX_SUM_TOLERANCE = 1e-9


class FarmInput(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    farm_id: str = Field(min_length=1)
    farm_name: str | None = None
    expected_daily_capacity: NonNegativeFloat
    expected_A_pct: NonNegativeFloat
    expected_B_pct: NonNegativeFloat
    expected_C_pct: NonNegativeFloat
    expected_D_pct: NonNegativeFloat
    actual_A: NonNegativeFloat
    actual_B: NonNegativeFloat
    actual_C: NonNegativeFloat
    actual_D: NonNegativeFloat

    @field_validator("farm_id", mode="before")
    @classmethod
    def coerce_farm_id(cls, value: object) -> object:
        return _coerce_identifier(value)

    @field_validator("farm_name", mode="before")
    @classmethod
    def coerce_farm_name(cls, value: object) -> object:
        return _coerce_optional_text(value)

    @field_validator(
        "expected_daily_capacity",
        "expected_A_pct",
        "expected_B_pct",
        "expected_C_pct",
        "expected_D_pct",
        "actual_A",
        "actual_B",
        "actual_C",
        "actual_D",
    )
    @classmethod
    def reject_negative(cls, value: float, info: ValidationInfo) -> float:
        return _reject_negative(value, info)

    @model_validator(mode="after")
    def mixes_must_sum_to_one(self) -> FarmInput:
        total = (
            self.expected_A_pct
            + self.expected_B_pct
            + self.expected_C_pct
            + self.expected_D_pct
        )
        if not math.isclose(total, 1.0, rel_tol=0.0, abs_tol=MIX_SUM_TOLERANCE):
            raise ValueError(
                "expected_A_pct, expected_B_pct, expected_C_pct, and expected_D_pct "
                f"must exactly equal 1.0 (got {total})"
            )
        return self


class ClientInput(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    client_id: str = Field(min_length=1)
    client_name: str | None = None
    acceptance_mode: str = Field(min_length=1)
    requested_segment: str | None = None
    demand: NonNegativeFloat
    export_price_per_eur: NonNegativeFloat

    @field_validator("client_id", mode="before")
    @classmethod
    def coerce_client_id(cls, value: object) -> object:
        return _coerce_identifier(value)

    @field_validator("acceptance_mode", mode="before")
    @classmethod
    def coerce_acceptance_mode(cls, value: object) -> object:
        if value is None:
            return value
        return str(value).strip()

    @field_validator("client_name", "requested_segment", mode="before")
    @classmethod
    def coerce_optional_text(cls, value: object) -> object:
        return _coerce_optional_text(value)

    @field_validator("demand", "export_price_per_eur")
    @classmethod
    def reject_negative(cls, value: float, info: ValidationInfo) -> float:
        return _reject_negative(value, info)


class SegmentLocalPrice(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    segment: str = Field(min_length=1)
    reference_export_price_per_eur: NonNegativeFloat

    @field_validator("segment", mode="before")
    @classmethod
    def coerce_segment(cls, value: object) -> object:
        return _coerce_optional_text(value) or value

    @field_validator("reference_export_price_per_eur")
    @classmethod
    def reject_negative(cls, value: float, info: ValidationInfo) -> float:
        return _reject_negative(value, info)


class StationInput(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    station_id: str = Field(min_length=1)
    export_conditioning_capacity: NonNegativeFloat
    local_market_ratio: NonNegativeFloat
    segment_prices: list[SegmentLocalPrice] = Field(default_factory=list)

    @field_validator("station_id", mode="before")
    @classmethod
    def coerce_station_id(cls, value: object) -> object:
        return _coerce_identifier(value)

    @field_validator("export_conditioning_capacity", "local_market_ratio")
    @classmethod
    def reject_negative(cls, value: float, info: ValidationInfo) -> float:
        return _reject_negative(value, info)

    @field_validator("local_market_ratio")
    @classmethod
    def ratio_must_be_at_most_one(cls, value: float) -> float:
        if value > 1.0:
            raise ValueError("local_market_ratio cannot be greater than 1.0")
        return value


class PlanIngestResponse(BaseModel):
    filename: str | None
    farms: list[FarmInput]
    clients: list[ClientInput]
    station: StationInput


class PlanKpis(BaseModel):
    total_exported_t: float
    export_capacity_t: float
    export_rate_pct: float
    total_export_revenue_eur: float
    total_local_residual_t: float
    total_local_revenue_eur: float
    total_actual_received_t: float
    farm_count: int
    client_count: int


class ProductionViewRow(BaseModel):
    farm_id: str
    farm_name: str | None = None
    expected_daily_capacity: float
    actual_delivered: float
    actual_A: float = 0
    actual_B: float = 0
    actual_C: float = 0
    actual_D: float = 0
    local_residual_t: float
    variance_t: float


class CommercialViewRow(BaseModel):
    client_id: str
    client_name: str | None = None
    acceptance_mode: str
    requested_segment: str
    demand: float
    export_price_per_eur: float
    allocated_t: float
    status: str
    shortage_reason: str | None = None


class TraceabilityLedgerRow(BaseModel):
    farm_id: str
    segment: str
    client_id: str
    tonnes_allocated: float
    export_revenue_eur: float


class PlanResultResponse(BaseModel):
    filename: str | None = None
    kpis: PlanKpis
    production_view: list[ProductionViewRow]
    commercial_view: list[CommercialViewRow]
    traceability_ledger: list[TraceabilityLedgerRow]


def _coerce_identifier(value: object) -> object:
    if value is None:
        return value
    if isinstance(value, float):
        if math.isnan(value):
            return None
        if value.is_integer():
            return str(int(value))
    if isinstance(value, int):
        return str(value)
    return str(value).strip()


def _coerce_optional_text(value: object) -> object:
    if value is None:
        return value
    text = str(value).strip()
    return text or None


def _reject_negative(value: float, info: ValidationInfo) -> float:
    if value < 0:
        raise ValueError(f"{info.field_name} cannot be negative")
    return value
