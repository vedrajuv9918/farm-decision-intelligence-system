from __future__ import annotations

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.schemas.auth import AuthResponse, FarmProfileStatusRequest, LoginRequest, RegisterRequest
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
_svc = AuthService()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest) -> AuthResponse | JSONResponse:
    user = _svc.register(
        full_name=payload.full_name,
        email=str(payload.email),
        password=payload.password,
    )
    if not user:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"success": False, "message": "Email already registered", "user": None},
        )
    return AuthResponse(success=True, message="Account created successfully", user=user)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest) -> AuthResponse | JSONResponse:
    outcome, user = _svc.login(email=str(payload.email), password=payload.password)
    if outcome == "not_found":
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "No account found with that email", "user": None},
        )
    if outcome == "wrong_password":
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"success": False, "message": "Incorrect password", "user": None},
        )
    return AuthResponse(success=True, message="Login successful", user=user)


@router.post("/farm-profile", response_model=AuthResponse)
async def update_farm_profile(payload: FarmProfileStatusRequest) -> AuthResponse | JSONResponse:
    user = _svc.set_farm_profile_status(
        email=str(payload.email),
        has_farm_profile=payload.has_farm_profile,
    )
    if not user:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Account not found", "user": None},
        )
    return AuthResponse(success=True, message="Farm profile updated", user=user)
