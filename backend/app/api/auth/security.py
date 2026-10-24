# pyrefly: ignore [missing-import]

import bcrypt


# ============================================================
# PASSWORD HASHING
# ============================================================

def hash_password(password: str) -> str:

    if not isinstance(password, str):
        raise TypeError(
            "Password must be a string."
        )

    if not password:
        raise ValueError(
            "Password cannot be empty."
        )

    salt = bcrypt.gensalt(
        rounds=12
    )

    hashed = bcrypt.hashpw(
        password.encode("utf-8"),
        salt,
    )

    return hashed.decode("utf-8")


# ============================================================
# PASSWORD VERIFICATION
# ============================================================

def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:

    try:
        if not isinstance(
            plain_password,
            str
        ):
            return False

        if not isinstance(
            hashed_password,
            str
        ):
            return False

        if (
            not plain_password
            or not hashed_password
        ):
            return False

        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )

    except (
        ValueError,
        TypeError,
        UnicodeError
    ):
        return False

    except Exception:
        return False