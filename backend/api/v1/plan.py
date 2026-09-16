from fastapi import APIRouter, File, HTTPException, UploadFile

from ingestion import IngestionError, ingest_plan_workbook
from schemas import PlanIngestResponse

router = APIRouter(tags=["plan"])


@router.post("/plan", response_model=PlanIngestResponse)
async def create_plan(file: UploadFile = File(...)) -> PlanIngestResponse:
    content = await file.read()
    try:
        farms, clients = ingest_plan_workbook(content)
    except IngestionError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc

    return PlanIngestResponse(filename=file.filename, farms=farms, clients=clients)
