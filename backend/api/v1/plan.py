from fastapi import APIRouter, File, HTTPException, UploadFile

from engine import calculate_plan
from ingestion import IngestionError, ingest_plan_workbook
from schemas import PlanResultResponse

router = APIRouter(tags=["plan"])


@router.post("/plan", response_model=PlanResultResponse)
async def create_plan(file: UploadFile = File(...)) -> PlanResultResponse:
    content = await file.read()
    try:
        farms, clients, station = ingest_plan_workbook(content)
    except IngestionError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc

    plan = calculate_plan(farms, clients, station)
    return PlanResultResponse(filename=file.filename, **plan)
