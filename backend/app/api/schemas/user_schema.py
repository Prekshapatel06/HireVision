from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class UserSignupRequest(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=100
    )

    email: EmailStr

    password: str = Field(
        ...,
        min_length=8
    )

    confirmPassword: str = Field(
        ...,
        min_length=8
    )

    role: Literal["candidate", "recruiter"] = "candidate"


class UserLoginRequest(BaseModel):
    email: EmailStr

    password: str = Field(
        ...,
        min_length=1
    )


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str


class SignupResponse(BaseModel):
    message: str
    token: str
    user: UserResponse


class LoginResponse(BaseModel):
    message: str
    token: str
    user: UserResponse


class MeUserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    created_at: datetime


class MeResponse(BaseModel):
    user: MeUserResponse