import jwt

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional

from ..core.config import settings


JWT_ALGORITHM = settings.JWT_ALGORITHM
JWT_SECRET = settings.JWT_SECRET


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:

    if not JWT_SECRET:
        raise RuntimeError(
            "JWT_SECRET is not configured."
        )

    if not JWT_ALGORITHM:
        raise RuntimeError(
            "JWT_ALGORITHM is not configured."
        )

    if not isinstance(data, dict):
        raise TypeError(
            "JWT payload must be a dictionary."
        )

    to_encode = data.copy()

    if expires_delta is not None:
        expire = (
            datetime.now(timezone.utc)
            + expires_delta
        )
    else:
        expire = (
            datetime.now(timezone.utc)
            + timedelta(days=7)
        )

    to_encode["exp"] = expire

    encoded_jwt = jwt.encode(
        to_encode,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )

    return encoded_jwt


def decode_access_token(
    token: str,
) -> Optional[Dict[str, Any]]:

    if not token or not isinstance(token, str):
        return None

    if not JWT_SECRET or not JWT_ALGORITHM:
        return None

    try:
        decoded_payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )

        if not isinstance(decoded_payload, dict):
            return None

        return decoded_payload

    except jwt.ExpiredSignatureError:
        return None

    except jwt.InvalidSignatureError:
        return None

    except jwt.DecodeError:
        return None

    except jwt.InvalidTokenError:
        return None

    except Exception:
        return None