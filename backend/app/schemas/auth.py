from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class FarmProfileStatusRequest(BaseModel):
    email: EmailStr
    has_farm_profile: bool = True


class AuthUser(BaseModel):
    full_name: str
    email: str
    has_farm_profile: bool


class AuthResponse(BaseModel):
    success: bool
    message: str
    user: AuthUser | None = None
