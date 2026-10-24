import re
import json

from fastapi import HTTPException  # type: ignore

from ..auth.security import hash_password, verify_password
from ..auth.token import create_access_token
from ..db.database import query


EMAIL_REGEX = re.compile(
    r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
)


def _build_auth_response(user, message):
    token_payload = {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
    }

    token = create_access_token(token_payload)

    return {
        "message": message,
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
        },
    }


def _create_role_profile(conn, user, full_name=None):
    role = user["role"]

    if role == "candidate":
        default_skills = {
            "programming_languages": [],
            "frameworks": [],
            "libraries": [],
            "databases": [],
            "developer_tools": [],
            "soft_skills": [],
        }

        default_socials = {
            "linkedin": "",
            "github": "",
            "portfolio": "",
            "leetcode": "",
            "codechef": "",
            "hackerrank": "",
        }

        profile_name = (
            full_name.strip()
            if isinstance(full_name, str) and full_name.strip()
            else user["username"]
        )

        query(
            conn,
            """
            INSERT INTO profiles
            (
                user_id,
                full_name,
                skills,
                social_profiles
            )
            VALUES
            (
                %s,
                %s,
                %s::jsonb,
                %s::jsonb
            )
            ON CONFLICT (user_id) DO NOTHING
            """,
            (
                user["id"],
                profile_name,
                json.dumps(default_skills),
                json.dumps(default_socials),
            ),
            commit=False,
        )

    elif role == "recruiter":
        query(
            conn,
            """
            INSERT INTO recruiter_profiles
            (
                user_id
            )
            VALUES
            (
                %s
            )
            ON CONFLICT (user_id) DO NOTHING
            """,
            (user["id"],),
            commit=False,
        )


def _sync_candidate_google_profile(conn, user, google_name):
    if user["role"] != "candidate":
        return

    if not google_name or not google_name.strip():
        return

    google_name = google_name.strip()[:100]

    query(
        conn,
        """
        UPDATE profiles
        SET
            full_name = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = %s
        """,
        (
            google_name,
            user["id"],
        ),
        commit=False,
    )


def signup_user(conn, req_body):
    username = req_body.username.strip()
    email = req_body.email.strip().lower()
    password = req_body.password
    confirm_password = req_body.confirmPassword
    role = req_body.role

    if not username:
        raise HTTPException(
            status_code=400,
            detail="Username is required.",
        )

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Email is required.",
        )

    if not password:
        raise HTTPException(
            status_code=400,
            detail="Password is required.",
        )

    if not confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Confirm password is required.",
        )

    if len(username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Username must be at least 3 characters long.",
        )

    if len(username) > 100:
        raise HTTPException(
            status_code=400,
            detail="Username cannot exceed 100 characters.",
        )

    if not EMAIL_REGEX.match(email):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid email address.",
        )

    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long.",
        )

    if password != confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match.",
        )

    if role not in ["candidate", "recruiter"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid user role.",
        )

    existing_user = query(
        conn,
        """
        SELECT id
        FROM users
        WHERE LOWER(email) = %s
        """,
        (email,),
    )

    if existing_user.rowCount > 0:
        raise HTTPException(
            status_code=409,
            detail="Email is already registered.",
        )

    hashed_password = hash_password(password)

    try:
        new_user_result = query(
            conn,
            """
            INSERT INTO users
            (
                username,
                email,
                password,
                role
            )
            VALUES
            (
                %s,
                %s,
                %s,
                %s
            )
            RETURNING
                id,
                username,
                email,
                role,
                created_at
            """,
            (
                username,
                email,
                hashed_password,
                role,
            ),
            commit=False,
        )

        if not new_user_result.rows:
            raise HTTPException(
                status_code=500,
                detail="Unable to create user account.",
            )

        new_user = new_user_result.rows[0]

        _create_role_profile(
            conn,
            new_user,
        )

        conn.commit()

    except HTTPException:
        conn.rollback()
        raise

    except Exception as exc:
        conn.rollback()

        print(
            "SIGNUP DATABASE ERROR:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Server error during user registration.",
        )

    return _build_auth_response(
        new_user,
        "Registration successful.",
    )


def login_user(conn, req_body):
    email = req_body.email.strip().lower()
    password = req_body.password

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Email is required.",
        )

    if not password:
        raise HTTPException(
            status_code=400,
            detail="Password is required.",
        )

    if not EMAIL_REGEX.match(email):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid email address.",
        )

    user_result = query(
        conn,
        """
        SELECT
            id,
            username,
            email,
            password,
            role,
            created_at
        FROM users
        WHERE LOWER(email) = %s
        """,
        (email,),
    )

    if user_result.rowCount == 0:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    user = user_result.rows[0]

    if not user.get("password"):
        raise HTTPException(
            status_code=401,
            detail="This account does not support password login.",
        )

    if not verify_password(
        password,
        user["password"],
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    return _build_auth_response(
        user,
        "Login successful.",
    )


def create_oauth_user(
    conn,
    email,
    username,
    role,
    auth_provider,
    provider_id,
):
    email = email.strip().lower()
    username = username.strip()

    if not email:
        raise HTTPException(
            status_code=400,
            detail="OAuth account did not provide an email address.",
        )

    if not EMAIL_REGEX.match(email):
        raise HTTPException(
            status_code=400,
            detail="OAuth provider returned an invalid email address.",
        )

    if role not in ["candidate", "recruiter"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid user role.",
        )

    if auth_provider not in ["google", "microsoft"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid OAuth provider.",
        )

    if not provider_id or not str(provider_id).strip():
        raise HTTPException(
            status_code=400,
            detail="OAuth provider did not return a valid account ID.",
        )

    provider_id = str(provider_id).strip()

    if not username:
        username = email.split("@")[0]

    username = username[:100]

    try:
        provider_column = (
            "google_id"
            if auth_provider == "google"
            else "microsoft_id"
        )

        provider_user_result = query(
            conn,
            f"""
            SELECT
                id,
                username,
                email,
                role,
                password,
                auth_provider,
                google_id,
                microsoft_id,
                created_at
            FROM users
            WHERE {provider_column} = %s
            """,
            (provider_id,),
        )

        if provider_user_result.rowCount > 0:
            user = provider_user_result.rows[0]

            if user["role"] != role:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"This OAuth account is already registered as a "
                        f"{user['role']} account."
                    ),
                )

            if auth_provider == "google":
                query(
                    conn,
                    """
                    UPDATE users
                    SET
                        email = %s,
                        username = %s,
                        auth_provider = 'google',
                        google_id = %s
                    WHERE id = %s
                    """,
                    (
                        email,
                        username,
                        provider_id,
                        user["id"],
                    ),
                    commit=False,
                )
            else:
                query(
                    conn,
                    """
                    UPDATE users
                    SET
                        email = %s,
                        username = %s,
                        auth_provider = 'microsoft',
                        microsoft_id = %s
                    WHERE id = %s
                    """,
                    (
                        email,
                        username,
                        provider_id,
                        user["id"],
                    ),
                    commit=False,
                )

            user["email"] = email
            user["username"] = username
            user["auth_provider"] = auth_provider

            if auth_provider == "google":
                user["google_id"] = provider_id
                _sync_candidate_google_profile(
                    conn,
                    user,
                    username,
                )
            else:
                user["microsoft_id"] = provider_id

            _create_role_profile(
                conn,
                user,
                full_name=username,
            )

            conn.commit()

            return _build_auth_response(
                user,
                "OAuth login successful.",
            )

        existing_user = query(
            conn,
            """
            SELECT
                id,
                username,
                email,
                role,
                password,
                auth_provider,
                google_id,
                microsoft_id,
                created_at
            FROM users
            WHERE LOWER(email) = %s
            """,
            (email,),
        )

        if existing_user.rowCount > 0:
            user = existing_user.rows[0]

            if user["role"] != role:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"This email is already registered as a "
                        f"{user['role']} account."
                    ),
                )

            existing_provider = user.get("auth_provider") or "local"

            existing_google_id = user.get("google_id")
            existing_microsoft_id = user.get("microsoft_id")

            if auth_provider == "google":
                if existing_google_id and existing_google_id != provider_id:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "This email is already linked to a different "
                            "Google account."
                        ),
                    )

            if auth_provider == "microsoft":
                if existing_microsoft_id and existing_microsoft_id != provider_id:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "This email is already linked to a different "
                            "Microsoft account."
                        ),
                    )

            if existing_provider not in [
                "local",
                auth_provider,
            ]:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "This email is already linked to a different "
                        "OAuth provider."
                    ),
                )

            if auth_provider == "google":
                query(
                    conn,
                    """
                    UPDATE users
                    SET
                        auth_provider = 'google',
                        google_id = %s,
                        username = %s,
                        email = %s
                    WHERE id = %s
                    """,
                    (
                        provider_id,
                        username,
                        email,
                        user["id"],
                    ),
                    commit=False,
                )

                user["auth_provider"] = "google"
                user["google_id"] = provider_id
                user["username"] = username
                user["email"] = email

                _sync_candidate_google_profile(
                    conn,
                    user,
                    username,
                )

            else:
                query(
                    conn,
                    """
                    UPDATE users
                    SET
                        auth_provider = 'microsoft',
                        microsoft_id = %s,
                        username = %s,
                        email = %s
                    WHERE id = %s
                    """,
                    (
                        provider_id,
                        username,
                        email,
                        user["id"],
                    ),
                    commit=False,
                )

                user["auth_provider"] = "microsoft"
                user["microsoft_id"] = provider_id
                user["username"] = username
                user["email"] = email

            _create_role_profile(
                conn,
                user,
                full_name=username,
            )

            conn.commit()

            return _build_auth_response(
                user,
                "OAuth login successful.",
            )

        username_result = query(
            conn,
            """
            SELECT id
            FROM users
            WHERE LOWER(username) = LOWER(%s)
            """,
            (username,),
        )

        if username_result.rowCount > 0:
            email_username = email.split("@")[0]
            username = (
                f"{username[:80]}_{email_username[:19]}"
            )[:100]

        if auth_provider == "google":
            new_user_result = query(
                conn,
                """
                INSERT INTO users
                (
                    username,
                    email,
                    password,
                    role,
                    auth_provider,
                    google_id
                )
                VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                RETURNING
                    id,
                    username,
                    email,
                    password,
                    role,
                    auth_provider,
                    google_id,
                    microsoft_id,
                    created_at
                """,
                (
                    username,
                    email,
                    None,
                    role,
                    "google",
                    provider_id,
                ),
                commit=False,
            )

        else:
            new_user_result = query(
                conn,
                """
                INSERT INTO users
                (
                    username,
                    email,
                    password,
                    role,
                    auth_provider,
                    microsoft_id
                )
                VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                RETURNING
                    id,
                    username,
                    email,
                    password,
                    role,
                    auth_provider,
                    google_id,
                    microsoft_id,
                    created_at
                """,
                (
                    username,
                    email,
                    None,
                    role,
                    "microsoft",
                    provider_id,
                ),
                commit=False,
            )

        if not new_user_result.rows:
            raise HTTPException(
                status_code=500,
                detail="Unable to create OAuth account.",
            )

        new_user = new_user_result.rows[0]

        _create_role_profile(
            conn,
            new_user,
            full_name=username,
        )

        conn.commit()

    except HTTPException:
        conn.rollback()
        raise

    except Exception as exc:
        conn.rollback()

        print(
            "OAUTH DATABASE ERROR:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Server error while creating OAuth account.",
        )

    return _build_auth_response(
        new_user,
        "OAuth account created successfully.",
    )


def get_user_me(conn, user_id):
    user_result = query(
        conn,
        """
        SELECT
            id,
            username,
            email,
            role,
            created_at
        FROM users
        WHERE id = %s
        """,
        (user_id,),
    )

    if user_result.rowCount == 0:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    return {
        "user": user_result.rows[0]
    }