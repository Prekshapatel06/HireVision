import secrets
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException

from ..core.config import settings
from .user_service import create_oauth_user


_oauth_states = {}


def _create_state(provider: str, role: str) -> str:
    state = secrets.token_urlsafe(32)

    _oauth_states[state] = {
        "provider": provider,
        "role": role,
    }

    return state


def _consume_state(
    state: str | None,
    provider: str,
    role: str | None = None,
) -> str:
    if not state:
        raise ValueError("OAuth state is missing.")

    state_data = _oauth_states.pop(state, None)

    if not state_data:
        raise ValueError("Invalid or expired OAuth state.")

    if state_data["provider"] != provider:
        raise ValueError("Invalid OAuth provider.")

    saved_role = state_data["role"]

    if role and saved_role != role:
        raise ValueError("Invalid OAuth role.")

    return saved_role


def get_google_authorization_url(role: str) -> str:
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth is not configured.",
        )

    state = _create_state(
        provider="google",
        role=role,
    )

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }

    return (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        + urlencode(params)
    )


def handle_google_callback(
    db,
    code: str,
    state: str | None,
):
    role = _consume_state(
        state=state,
        provider="google",
    )

    if not settings.GOOGLE_CLIENT_ID:
        raise ValueError(
            "Google OAuth Client ID is not configured."
        )

    if not settings.GOOGLE_CLIENT_SECRET:
        raise ValueError(
            "Google OAuth Client Secret is not configured."
        )

    token_url = "https://oauth2.googleapis.com/token"

    token_data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            token_response = client.post(
                token_url,
                data=token_data,
            )

            token_response.raise_for_status()

            token_json = token_response.json()

            access_token = token_json.get("access_token")

            if not access_token:
                raise ValueError(
                    "Google did not return an access token."
                )

            user_response = client.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={
                    "Authorization": f"Bearer {access_token}"
                },
            )

            user_response.raise_for_status()

            google_user = user_response.json()

    except httpx.HTTPStatusError as exc:
        print("GOOGLE OAUTH HTTP ERROR:", repr(exc))
        raise ValueError(
            "Unable to authenticate with Google."
        ) from exc

    except httpx.RequestError as exc:
        print("GOOGLE OAUTH REQUEST ERROR:", repr(exc))
        raise ValueError(
            "Unable to connect to Google."
        ) from exc

    email = google_user.get("email")
    google_id = google_user.get("sub")

    username = (
        google_user.get("name")
        or google_user.get("given_name")
        or (
            email.split("@")[0]
            if email
            else ""
        )
    )

    if not email:
        raise ValueError(
            "Google account does not have a usable email address."
        )

    if not google_id:
        raise ValueError(
            "Google account did not provide a valid account ID."
        )

    result = create_oauth_user(
        conn=db,
        email=email,
        username=username,
        role=role,
        auth_provider="google",
        provider_id=google_id,
    )

    result["frontend_url"] = settings.FRONTEND_URL

    return result


def _microsoft_authority() -> str:
    tenant = settings.MICROSOFT_TENANT_ID or "common"

    return (
        "https://login.microsoftonline.com/"
        f"{tenant}"
    )


def get_microsoft_authorization_url(role: str) -> str:
    if not settings.MICROSOFT_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Microsoft OAuth is not configured.",
        )

    state = _create_state(
        provider="microsoft",
        role=role,
    )

    params = {
        "client_id": settings.MICROSOFT_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
        "response_mode": "query",
        "scope": "openid profile email User.Read",
        "state": state,
        "prompt": "select_account",
    }

    authorization_endpoint = (
        _microsoft_authority()
        + "/oauth2/v2.0/authorize"
    )

    return (
        authorization_endpoint
        + "?"
        + urlencode(params)
    )


def handle_microsoft_callback(
    db,
    code: str,
    state: str | None,
):
    role = _consume_state(
        state=state,
        provider="microsoft",
    )

    if not settings.MICROSOFT_CLIENT_ID:
        raise ValueError(
            "Microsoft OAuth Client ID is not configured."
        )

    if not settings.MICROSOFT_CLIENT_SECRET:
        raise ValueError(
            "Microsoft OAuth Client Secret is not configured."
        )

    token_endpoint = (
        _microsoft_authority()
        + "/oauth2/v2.0/token"
    )

    token_data = {
        "client_id": settings.MICROSOFT_CLIENT_ID,
        "client_secret": settings.MICROSOFT_CLIENT_SECRET,
        "code": code,
        "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
        "grant_type": "authorization_code",
        "scope": "openid profile email User.Read",
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            token_response = client.post(
                token_endpoint,
                data=token_data,
            )

            token_response.raise_for_status()

            token_json = token_response.json()

            access_token = token_json.get("access_token")

            if not access_token:
                raise ValueError(
                    "Microsoft did not return an access token."
                )

            user_response = client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={
                    "Authorization": f"Bearer {access_token}"
                },
                params={
                    "$select": (
                        "id,displayName,mail,"
                        "userPrincipalName,givenName"
                    )
                },
            )

            user_response.raise_for_status()

            microsoft_user = user_response.json()

    except httpx.HTTPStatusError as exc:
        print("MICROSOFT OAUTH HTTP ERROR:", repr(exc))
        raise ValueError(
            "Unable to authenticate with Microsoft."
        ) from exc

    except httpx.RequestError as exc:
        print("MICROSOFT OAUTH REQUEST ERROR:", repr(exc))
        raise ValueError(
            "Unable to connect to Microsoft."
        ) from exc

    email = (
        microsoft_user.get("mail")
        or microsoft_user.get("userPrincipalName")
    )

    microsoft_id = microsoft_user.get("id")

    username = (
        microsoft_user.get("displayName")
        or microsoft_user.get("givenName")
        or (
            email.split("@")[0]
            if email
            else ""
        )
    )

    if not email:
        raise ValueError(
            "Microsoft account does not have a usable email address."
        )

    if not microsoft_id:
        raise ValueError(
            "Microsoft account did not provide a valid account ID."
        )

    result = create_oauth_user(
        conn=db,
        email=email,
        username=username,
        role=role,
        auth_provider="microsoft",
        provider_id=microsoft_id,
    )

    result["frontend_url"] = settings.FRONTEND_URL

    return result