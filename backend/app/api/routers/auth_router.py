from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from psycopg2.extensions import connection

from ..db.database import get_db
from ..schemas.user_schema import (
    UserSignupRequest,
    UserLoginRequest,
    SignupResponse,
    LoginResponse,
    MeResponse,
)
from ..services.user_service import (
    signup_user,
    login_user,
    get_user_me,
)
from ..middleware.auth_middleware import get_current_user


router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
)


@router.post(
    "/signup",
    response_model=SignupResponse,
    status_code=201,
)
def signup(
    req: UserSignupRequest,
    db: connection = Depends(get_db),
):
    return signup_user(db, req)


@router.post(
    "/login",
    response_model=LoginResponse,
)
def login(
    req: UserLoginRequest,
    db: connection = Depends(get_db),
):
    return login_user(db, req)


@router.get(
    "/me",
    response_model=MeResponse,
)
def me(
    current_user: dict = Depends(get_current_user),
    db: connection = Depends(get_db),
):
    return get_user_me(
        db,
        current_user["id"],
    )


@router.get("/google/url")
def google_login_url(
    role: str = Query(default="candidate"),
):
    from ..services.oauth_service import get_google_authorization_url

    if role not in {"candidate", "recruiter"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid role.",
        )

    try:
        authorization_url = get_google_authorization_url(role)

        return {
            "url": authorization_url,
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(
            "GOOGLE OAUTH URL ERROR:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to initialize Google authentication.",
        )


@router.get("/google/callback")
def google_callback(
    code: str = Query(...),
    state: str | None = Query(default=None),
    db: connection = Depends(get_db),
):
    from ..services.oauth_service import handle_google_callback

    try:
        result = handle_google_callback(
            db=db,
            code=code,
            state=state,
        )

        frontend_url = result["frontend_url"]
        token = result["token"]
        role = result["user"]["role"]
        username = result["user"]["username"]

        query_params = urlencode(
            {
                "token": token,
                "role": role,
                "user": username,
            }
        )

        redirect_url = (
            f"{frontend_url}/login?"
            f"{query_params}"
        )

        return RedirectResponse(
            url=redirect_url,
            status_code=302,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except HTTPException:
        raise

    except Exception as exc:
        print(
            "GOOGLE AUTHENTICATION ERROR:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Google authentication failed.",
        )


@router.get("/microsoft/url")
def microsoft_login_url(
    role: str = Query(default="candidate"),
):
    from ..services.oauth_service import get_microsoft_authorization_url

    if role not in {"candidate", "recruiter"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid role.",
        )

    try:
        authorization_url = get_microsoft_authorization_url(role)

        return {
            "url": authorization_url,
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(
            "MICROSOFT OAUTH URL ERROR:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to initialize Microsoft authentication.",
        )


@router.get("/microsoft/callback")
def microsoft_callback(
    code: str = Query(...),
    state: str | None = Query(default=None),
    db: connection = Depends(get_db),
):
    from ..services.oauth_service import handle_microsoft_callback

    try:
        result = handle_microsoft_callback(
            db=db,
            code=code,
            state=state,
        )

        frontend_url = result["frontend_url"]
        token = result["token"]
        role = result["user"]["role"]
        username = result["user"]["username"]

        query_params = urlencode(
            {
                "token": token,
                "role": role,
                "user": username,
            }
        )

        redirect_url = (
            f"{frontend_url}/login?"
            f"{query_params}"
        )

        return RedirectResponse(
            url=redirect_url,
            status_code=302,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except HTTPException:
        raise

    except Exception as exc:
        print(
            "MICROSOFT AUTHENTICATION ERROR:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Microsoft authentication failed.",
        )