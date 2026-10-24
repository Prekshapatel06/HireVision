import os

from dotenv import load_dotenv  # type: ignore


# ============================================================
# ENVIRONMENT CONFIGURATION
# ============================================================

ENV_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "..",
        ".env",
    )
)

load_dotenv(dotenv_path=ENV_PATH)


# ============================================================
# ENVIRONMENT HELPERS
# ============================================================

def get_required_env(name: str) -> str:
    """
    Read a required environment variable.

    Raises an error if the variable is missing or empty.
    """

    value = os.getenv(name)

    if value is None or not value.strip():
        raise RuntimeError(
            f"Required environment variable '{name}' is not configured."
        )

    return value.strip()


def get_int_env(name: str, default: int) -> int:
    """
    Read an integer environment variable.
    """

    value = os.getenv(name, str(default))

    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(
            f"Environment variable '{name}' must be a valid integer."
        ) from exc


# ============================================================
# SETTINGS
# ============================================================

class Settings:

    # --------------------------------------------------------
    # SERVER
    # --------------------------------------------------------

    PORT: int = get_int_env(
        "PORT",
        5000,
    )

    FRONTEND_URL: str = os.getenv(
        "FRONTEND_URL",
        "http://localhost:3000",
    ).strip()

    # --------------------------------------------------------
    # JWT
    # --------------------------------------------------------

    JWT_SECRET: str = get_required_env(
        "JWT_SECRET"
    )

    JWT_ALGORITHM: str = os.getenv(
        "JWT_ALGORITHM",
        "HS256",
    ).strip()

    # --------------------------------------------------------
    # POSTGRESQL
    # --------------------------------------------------------

    DB_USER: str = os.getenv(
        "DB_USER",
        "postgres",
    ).strip()

    DB_PASSWORD: str = os.getenv(
        "DB_PASSWORD",
        "postgres",
    )

    DB_HOST: str = os.getenv(
        "DB_HOST",
        "localhost",
    ).strip()

    DB_PORT: str = os.getenv(
        "DB_PORT",
        "5432",
    ).strip()

    DB_NAME: str = os.getenv(
        "DB_NAME",
        "hirevision",
    ).strip()

    # --------------------------------------------------------
    # GOOGLE OAUTH
    # --------------------------------------------------------

    GOOGLE_CLIENT_ID: str = os.getenv(
        "GOOGLE_CLIENT_ID",
        "",
    ).strip()

    GOOGLE_CLIENT_SECRET: str = os.getenv(
        "GOOGLE_CLIENT_SECRET",
        "",
    ).strip()

    GOOGLE_REDIRECT_URI: str = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/api/auth/google/callback",
    ).strip()

    # --------------------------------------------------------
    # MICROSOFT OAUTH
    # --------------------------------------------------------

    MICROSOFT_CLIENT_ID: str = os.getenv(
        "MICROSOFT_CLIENT_ID",
        "",
    ).strip()

    MICROSOFT_CLIENT_SECRET: str = os.getenv(
        "MICROSOFT_CLIENT_SECRET",
        "",
    ).strip()

    MICROSOFT_TENANT_ID: str = os.getenv(
        "MICROSOFT_TENANT_ID",
        "common",
    ).strip()

    MICROSOFT_REDIRECT_URI: str = os.getenv(
        "MICROSOFT_REDIRECT_URI",
        "http://localhost:8000/api/auth/microsoft/callback",
    ).strip()


# ============================================================
# GLOBAL SETTINGS INSTANCE
# ============================================================

settings = Settings()