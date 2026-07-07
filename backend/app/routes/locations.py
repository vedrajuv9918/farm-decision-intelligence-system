from fastapi import APIRouter, HTTPException, Query

from app.schemas.common import Location
from app.services.location_service import LocationService
from app.utils.http import ExternalServiceError

router = APIRouter()


@router.get("/locations", response_model=list[Location])
async def locations(q: str = Query(min_length=2)) -> list[Location]:
    try:
        return await LocationService().search(q)
    except ExternalServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
