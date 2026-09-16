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
    expected_capacity: NonNegativeFloat
    actual_a: NonNegativeFloat
    actual_b: NonNegativeFloat
    actual_c: NonNegativeFloat
    actual_d: NonNegativeFloat
    mix_a: NonNegativeFloat
    mix_b: NonNegativeFloat
    mix_c: NonNegativeFloat
    mix_d: NonNegativeFloat

    @field_validator("farm_id", mode="before")
    @classmethod
    def coerce_farm_id(cls, value: object) -> object:
        return _coerce_identifier(value)

    @field_validator("farm_name", mode="before")
    @classmethod
    def coerce_farm_name(cls, value: object) -> object:
        return _coerce_optional_text(value)

    @field_validator(
        "expected_capacity",
        "actual_a",
        "actual_b",
        "actual_c",
        "actual_d",
        "mix_a",
        "mix_b",
        "mix_c",
        "mix_d",
    )
    @classmethod
    def reject_negative(cls, value: float, info: ValidationInfo) -> float:
        return _reject_negative(value, info)

    @model_validator(mode="after")
    def mixes_must_sum_to_one(self) -> FarmInput:
        total = self.mix_a + self.mix_b + self.mix_c + self.mix_d
        if not math.isclose(total, 1.0, rel_tol=0.0, abs_tol=MIX_SUM_TOLERANCE):
            raise ValueError(
                f"mix_a, mix_b, mix_c, and mix_d must exactly equal 1.0 (got {total})"
            )
        return self


class ClientInput(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    client_id: str = Field(min_length=1)
    client_name: str | None = None
    rule: str = Field(min_length=1)
    requested_segment: str | None = None
    demand: NonNegativeFloat
    reference_price: NonNegativeFloat

    @field_validator("client_id", mode="before")
    @classmethod
    def coerce_client_id(cls, value: object) -> object:
        return _coerce_identifier(value)

    @field_validator("rule", mode="before")
    @classmethod
    def coerce_rule(cls, value: object) -> object:
        if value is None:
            return value
        return str(value).strip()

    @field_validator("client_name", "requested_segment", mode="before")
    @classmethod
    def coerce_optional_text(cls, value: object) -> object:
        return _coerce_optional_text(value)

    @field_validator("demand", "reference_price")
    @classmethod
    def reject_negative(cls, value: float, info: ValidationInfo) -> float:
        return _reject_negative(value, info)


class PlanIngestResponse(BaseModel):
    filename: str | None
    farms: list[FarmInput]
    clients: list[ClientInput]


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
