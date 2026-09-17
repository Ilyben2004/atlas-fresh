from __future__ import annotations

import math
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

NonNegativeFloat = Annotated[float, Field(allow_inf_nan=False)]
MIX_SUM_TOLERANCE = 1e-9
FIVE_T_TOLERANCE = 1e-9
SEGMENTS = ("A", "B", "C", "D")
ACCEPTANCE_MODES = ("EXACT", "MINIMUM")


def _is_multiple_of_five(value: float) -> bool:
    scaled = value / 5.0
    return math.isclose(scaled, round(scaled), rel_tol=0.0, abs_tol=FIVE_T_TOLERANCE)


def _require_multiple_of_five(value: float, field_name: str) -> float:
    if not _is_multiple_of_five(value):
        raise ValueError(f"{field_name} must be a non-negative multiple of 5 t (got {value})")
    return value


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

    @field_validator(
        "expected_A_pct",
        "expected_B_pct",
        "expected_C_pct",
        "expected_D_pct",
    )
    @classmethod
    def mix_fraction_bounds(cls, value: float, info: ValidationInfo) -> float:
        if value > 1.0:
            raise ValueError(f"{info.field_name} must be between 0 and 1 (got {value})")
        return value

    @field_validator("actual_A", "actual_B", "actual_C", "actual_D")
    @classmethod
    def actual_multiple_of_five(cls, value: float, info: ValidationInfo) -> float:
        return _require_multiple_of_five(value, info.field_name or "actual")

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
    requested_segment: str = Field(min_length=1)
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
        return str(value).strip().upper()

    @field_validator("client_name", "requested_segment", mode="before")
    @classmethod
    def coerce_optional_text(cls, value: object) -> object:
        return _coerce_optional_text(value)

    @field_validator("acceptance_mode")
    @classmethod
    def validate_acceptance_mode(cls, value: str) -> str:
        mode = str(value).strip().upper()
        if mode not in ACCEPTANCE_MODES:
            raise ValueError(
                f"acceptance_mode must be EXACT or MINIMUM (got {value!r})"
            )
        return mode

    @field_validator("requested_segment")
    @classmethod
    def validate_requested_segment(cls, value: str) -> str:
        segment = str(value).strip().upper()
        if segment not in SEGMENTS:
            raise ValueError(
                f"requested_segment must be one of A, B, C, D (got {value!r})"
            )
        return segment

    @field_validator("demand", "export_price_per_eur")
    @classmethod
    def reject_negative(cls, value: float, info: ValidationInfo) -> float:
        return _reject_negative(value, info)

    @field_validator("demand")
    @classmethod
    def demand_multiple_of_five(cls, value: float) -> float:
        return _require_multiple_of_five(value, "demand")


class SegmentLocalPrice(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    segment: str = Field(min_length=1)
    reference_export_price_per_eur: NonNegativeFloat

    @field_validator("segment", mode="before")
    @classmethod
    def coerce_segment(cls, value: object) -> object:
        text = _coerce_optional_text(value)
        return str(text).upper() if text is not None else value

    @field_validator("segment")
    @classmethod
    def validate_segment(cls, value: str) -> str:
        segment = str(value).strip().upper()
        if segment not in SEGMENTS:
            raise ValueError(f"segment must be one of A, B, C, D (got {value!r})")
        return segment

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

    @field_validator("export_conditioning_capacity")
    @classmethod
    def capacity_multiple_of_five(cls, value: float) -> float:
        return _require_multiple_of_five(value, "export_conditioning_capacity")

    @field_validator("local_market_ratio")
    @classmethod
    def ratio_must_be_at_most_one(cls, value: float) -> float:
        if value > 1.0:
            raise ValueError("local_market_ratio cannot be greater than 1.0")
        return value

    @model_validator(mode="after")
    def require_complete_segment_prices(self) -> StationInput:
        found = {
            row.segment.upper(): row.reference_export_price_per_eur
            for row in self.segment_prices
        }
        missing = [segment for segment in SEGMENTS if segment not in found]
        if missing:
            raise ValueError(
                "segment reference-price table must include A, B, C and D; "
                f"missing: {', '.join(missing)}"
            )
        duplicates = []
        seen: set[str] = set()
        for row in self.segment_prices:
            key = row.segment.upper()
            if key in seen and key not in duplicates:
                duplicates.append(key)
            seen.add(key)
        if duplicates:
            raise ValueError(
                "segment reference-price table has duplicate segments: "
                + ", ".join(duplicates)
            )
        return self


class PlanIngestResponse(BaseModel):
    filename: str | None
    farms: list[FarmInput]
    clients: list[ClientInput]
    station: StationInput


class PlanKpis(BaseModel):
    total_expected_t: float = 0
    total_exported_t: float
    export_capacity_t: float
    export_rate_pct: float
    total_export_revenue_eur: float
    total_local_residual_t: float
    total_local_revenue_eur: float
    total_value_eur: float = 0
    total_actual_received_t: float
    at_risk_client_count: int = 0
    farm_count: int
    client_count: int


class ProductionViewRow(BaseModel):
    farm_id: str
    farm_name: str | None = None
    expected_daily_capacity: float
    actual_delivered: float
    expected_A: float = 0
    expected_B: float = 0
    expected_C: float = 0
    expected_D: float = 0
    actual_A: float = 0
    actual_B: float = 0
    actual_C: float = 0
    actual_D: float = 0
    variance_A: float = 0
    variance_B: float = 0
    variance_C: float = 0
    variance_D: float = 0
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
    remaining_t: float = 0
    export_revenue_eur: float = 0
    status: str
    shortage_reason: str | None = None


class TraceabilityLedgerRow(BaseModel):
    farm_id: str
    segment: str
    client_id: str
    tonnes_allocated: float
    export_revenue_eur: float
    quality_upgrade: int = 0


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
