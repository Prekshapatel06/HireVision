from fastapi import Header, HTTPException

from ..auth.token import decode_access_token


def get_current_user(
    authorization: str | None = Header(default=None),
):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization token is required."
        )

    parts = authorization.strip().split()

    if (
        len(parts) != 2
        or parts[0].lower() != "bearer"
    ):
        raise HTTPException(
            status_code=401,
            detail=(
                "Invalid authorization format. "
                "Use Bearer <token>."
            )
        )

    token = parts[1].strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authorization token is missing."
        )

    decoded = decode_access_token(token)

    if not decoded:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authorization token."
        )

    user_id = decoded.get("id")

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid token payload."
        )

    username = decoded.get("username")
    email = decoded.get("email")
    role = decoded.get("role")

    if not username or not email:
        raise HTTPException(
            status_code=401,
            detail="Invalid token payload."
        )

    if role not in {"candidate", "recruiter"}:
        raise HTTPException(
            status_code=401,
            detail="Invalid user role in token."
        )

    return {
        "id": user_id,
        "username": username,
        "email": email,
        "role": role,
    }