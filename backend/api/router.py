from fastapi import APIRouter

from api.v1.plan import router as plan_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(plan_router)
