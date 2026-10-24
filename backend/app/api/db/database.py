import os

import psycopg2  # type: ignore
from psycopg2 import sql  # type: ignore
from psycopg2.pool import SimpleConnectionPool  # type: ignore
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT  # type: ignore

from ..core.config import settings


_pool = None

DB_CONNECT_TIMEOUT = 5


def _connection_params(database: str | None = None) -> dict:
    params = {
        "user": settings.DB_USER,
        "password": settings.DB_PASSWORD,
        "host": settings.DB_HOST,
        "port": settings.DB_PORT,
        "connect_timeout": DB_CONNECT_TIMEOUT,
    }

    if database:
        params["database"] = database

    return params


def init_db():
    global _pool

    print("\n==========================================")
    print("HIREVISION DATABASE INITIALIZATION")
    print("==========================================")

    print("DB HOST :", settings.DB_HOST)
    print("DB PORT :", settings.DB_PORT)
    print("DB NAME :", settings.DB_NAME)
    print("DB USER :", settings.DB_USER)

    conn = None

    try:
        print(
            f"Connecting to PostgreSQL with {DB_CONNECT_TIMEOUT}s timeout..."
        )

        conn = psycopg2.connect(
            database="postgres",
            **_connection_params(),
        )

        conn.set_isolation_level(
            ISOLATION_LEVEL_AUTOCOMMIT
        )

        cur = conn.cursor()

        cur.execute(
            """
            SELECT 1
            FROM pg_database
            WHERE datname = %s
            """,
            (settings.DB_NAME,),
        )

        if cur.fetchone() is None:
            print(
                f'Database "{settings.DB_NAME}" not found. Creating...'
            )

            cur.execute(
                sql.SQL("CREATE DATABASE {}").format(
                    sql.Identifier(settings.DB_NAME)
                )
            )

            print(
                f'Database "{settings.DB_NAME}" created successfully.'
            )
        else:
            print(
                f'Database "{settings.DB_NAME}" verified.'
            )

        cur.close()

    except psycopg2.OperationalError as exc:
        print(
            "\nPOSTGRESQL CONNECTION FAILED:"
        )
        print(
            "Host:",
            settings.DB_HOST,
        )
        print(
            "Port:",
            settings.DB_PORT,
        )
        print(
            "Database:",
            settings.DB_NAME,
        )
        print(
            "Error:",
            repr(exc),
        )

        raise RuntimeError(
            "Unable to connect to PostgreSQL. "
            f"Please make sure PostgreSQL is running on "
            f"{settings.DB_HOST}:{settings.DB_PORT} "
            f"and that the database credentials in backend/.env are correct."
        ) from exc

    except Exception as exc:
        print(
            "\nDATABASE VERIFICATION FAILED:",
            repr(exc),
        )

        raise

    finally:
        if conn:
            conn.close()

    try:
        print("Creating PostgreSQL connection pool...")

        _pool = SimpleConnectionPool(
            1,
            20,
            **_connection_params(
                settings.DB_NAME
            ),
        )

        print(
            "PostgreSQL connection pool created."
        )

    except psycopg2.OperationalError as exc:
        print(
            "\nCONNECTION POOL CREATION FAILED:",
            repr(exc),
        )

        raise RuntimeError(
            "Unable to create the PostgreSQL connection pool. "
            "Please verify that PostgreSQL is running and the "
            "database configuration is correct."
        ) from exc

    except Exception as exc:
        print(
            "\nCONNECTION POOL CREATION FAILED:",
            repr(exc),
        )

        raise

    conn = None
    cur = None

    try:
        conn = _pool.getconn()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'users'
            );
            """
        )

        users_exists = cur.fetchone()[0]

        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'profiles'
            );
            """
        )

        profiles_exists = cur.fetchone()[0]

        if not users_exists or not profiles_exists:
            print(
                "Required tables are missing. Running schema.sql..."
            )

            schema_path = os.path.abspath(
                os.path.join(
                    os.path.dirname(__file__),
                    "..",
                    "..",
                    "..",
                    "schema.sql",
                )
            )

            if not os.path.exists(schema_path):
                raise FileNotFoundError(
                    f"schema.sql not found at: {schema_path}"
                )

            with open(
                schema_path,
                "r",
                encoding="utf-8",
            ) as file:
                schema_sql = file.read()

            cur.execute(schema_sql)
            conn.commit()

            print(
                "Database schema executed successfully."
            )

        else:
            print(
                "Users and profiles tables verified."
            )

        cur.execute(
            """
            ALTER TABLE users
            ALTER COLUMN password DROP NOT NULL;
            """
        )

        cur.execute(
            """
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS auth_provider
            VARCHAR(20) NOT NULL DEFAULT 'local';
            """
        )

        cur.execute(
            """
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS google_id
            VARCHAR(255);
            """
        )

        cur.execute(
            """
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS microsoft_id
            VARCHAR(255);
            """
        )

        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS
            idx_users_google_id_unique
            ON users(google_id)
            WHERE google_id IS NOT NULL;
            """
        )

        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS
            idx_users_microsoft_id_unique
            ON users(microsoft_id)
            WHERE microsoft_id IS NOT NULL;
            """
        )

        cur.execute(
            """
            UPDATE users
            SET auth_provider = 'local'
            WHERE auth_provider IS NULL
               OR TRIM(auth_provider) = '';
            """
        )

        conn.commit()

        cur.execute(
            """
            SELECT
                column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'users'
              AND column_name IN (
                  'id',
                  'username',
                  'email',
                  'password',
                  'role',
                  'auth_provider',
                  'google_id',
                  'microsoft_id',
                  'created_at'
              )
            ORDER BY column_name;
            """
        )

        user_columns = {
            row[0]
            for row in cur.fetchall()
        }

        required_user_columns = {
            "id",
            "username",
            "email",
            "password",
            "role",
            "auth_provider",
            "google_id",
            "microsoft_id",
            "created_at",
        }

        missing_columns = (
            required_user_columns - user_columns
        )

        if missing_columns:
            raise RuntimeError(
                "Required users columns are missing: "
                + ", ".join(sorted(missing_columns))
            )

        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'profiles'
            );
            """
        )

        if not cur.fetchone()[0]:
            raise RuntimeError(
                "profiles table does not exist."
            )

        print("users table: OK")
        print("profiles table: OK")
        print("Authentication columns: OK")

        print(
            "\nDATABASE INITIALIZATION SUCCESSFUL."
        )

        print(
            "==========================================\n"
        )

    except Exception as exc:
        if conn:
            conn.rollback()

        print(
            "\nDATABASE TABLE INITIALIZATION FAILED:",
            repr(exc),
        )

        raise

    finally:
        if cur:
            cur.close()

        if conn and _pool:
            _pool.putconn(conn)


def get_db():
    global _pool

    if _pool is None:
        raise RuntimeError(
            "Database pool not initialized."
        )

    conn = _pool.getconn()

    try:
        yield conn

    finally:
        _pool.putconn(conn)


def query(
    conn,
    text,
    params=None,
    commit=True,
):
    cur = conn.cursor()

    try:
        cur.execute(
            text,
            params or (),
        )

        rows = []
        row_count = cur.rowcount

        if cur.description:
            column_names = [
                description[0]
                for description in cur.description
            ]

            rows = [
                dict(
                    zip(
                        column_names,
                        row,
                    )
                )
                for row in cur.fetchall()
            ]

        if commit:
            conn.commit()

        class DBResult:
            def __init__(
                self,
                rows,
                row_count,
            ):
                self.rows = rows
                self.rowCount = (
                    len(rows)
                    if rows
                    else row_count
                )

        return DBResult(
            rows,
            row_count,
        )

    except Exception as exc:
        conn.rollback()

        print(
            "\nDATABASE QUERY ERROR:",
            repr(exc),
        )

        raise

    finally:
        cur.close()