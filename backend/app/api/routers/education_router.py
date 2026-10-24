# pyrefly: ignore [missing-import]
from fastapi import APIRouter

router = APIRouter(prefix="/api/education", tags=["education"])
# Under standard Express system layout, education is embedded directly inside profiles table update.
# This router is registered to maintain the requested architecture.
