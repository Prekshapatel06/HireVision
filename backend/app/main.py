import os
import sys

import uvicorn  # type: ignore

from fastapi import FastAPI  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from fastapi.staticfiles import StaticFiles  # type: ignore


BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

sys.path.append(BASE_DIR)
sys.path.append(
    os.path.abspath(
        os.path.join(BASE_DIR, "..")
    )
)


from app.api.core.config import settings
from app.api.db.database import init_db

from app.api.routers.auth_router import (
    router as auth_router
)

from app.api.routers.candidate_profile_router import (
    router as candidate_profile_router
)

from app.api.routers.education_router import (
    router as education_router
)


app = FastAPI(
    title="HireVision AI REST API",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Content-Type",
        "Authorization",
    ],
)


uploads_dir = os.path.abspath(
    os.path.join(
        BASE_DIR,
        "..",
        "uploads",
    )
)

os.makedirs(
    uploads_dir,
    exist_ok=True,
)


app.mount(
    "/uploads",
    StaticFiles(
        directory=uploads_dir
    ),
    name="uploads",
)


@app.get("/")
def read_root():
    return {
        "message": "Welcome to HireVision AI REST API"
    }


app.include_router(auth_router)

app.include_router(
    candidate_profile_router
)

app.include_router(
    education_router
)


@app.on_event("startup")
def startup_event():
    init_db()


if __name__ == "__main__":
    port = settings.PORT

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )