const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const dbName = process.env.DB_NAME || "hirevision";

if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
  throw new Error(
    "Invalid DB_NAME. Use only letters, numbers, and underscores."
  );
}

const config = {
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  host: process.env.DB_HOST || "localhost",
  port: Number.parseInt(process.env.DB_PORT || "5432", 10),
};

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
      max: Number.parseInt(process.env.DB_POOL_MAX || "10", 10),
      idleTimeoutMillis: Number.parseInt(
        process.env.DB_IDLE_TIMEOUT || "30000",
        10
      ),
      connectionTimeoutMillis: Number.parseInt(
        process.env.DB_CONNECTION_TIMEOUT || "10000",
        10
      ),
      maxUses: Number.parseInt(
        process.env.DB_MAX_USES || "7500",
        10
      ),
      allowExitOnIdle: false,
    }
  : {
      ...config,
      database: dbName,
      max: Number.parseInt(process.env.DB_POOL_MAX || "10", 10),
      idleTimeoutMillis: Number.parseInt(
        process.env.DB_IDLE_TIMEOUT || "30000",
        10
      ),
      connectionTimeoutMillis: Number.parseInt(
        process.env.DB_CONNECTION_TIMEOUT || "10000",
        10
      ),
      maxUses: Number.parseInt(
        process.env.DB_MAX_USES || "7500",
        10
      ),
      allowExitOnIdle: false,
    };

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("[HireVision Database Pool Error]:", err.message);
});

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function databaseExists() {
  const adminPool = new Pool({
    ...config,
    database: "postgres",
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    const result = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    return result.rowCount > 0;
  } finally {
    await adminPool.end();
  }
}

async function createDatabase() {
  const adminPool = new Pool({
    ...config,
    database: "postgres",
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await adminPool.end();
  }
}

async function ensureDatabase() {
  const exists = await databaseExists();

  if (exists) {
    console.log(`[HireVision DB] Database "${dbName}" verified.`);
    return;
  }

  console.log(
    `[HireVision DB] Database "${dbName}" not found. Creating database...`
  );

  await createDatabase();

  console.log(
    `[HireVision DB] Database "${dbName}" created successfully.`
  );
}

async function runSchemaInitialization() {
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'profiles'
    );
  `);

  if (tableCheck.rows[0].exists) {
    console.log("[HireVision DB] Database tables verified.");
    return;
  }

  console.log(
    "[HireVision DB] Tables do not exist. Running schema.sql initialization..."
  );

  const schemaPath = path.join(
    __dirname,
    "..",
    "schema.sql"
  );

  if (!fs.existsSync(schemaPath)) {
    throw new Error(
      `Schema file not found at ${schemaPath}.`
    );
  }

  const schemaSql = fs.readFileSync(
    schemaPath,
    "utf8"
  );

  if (!schemaSql.trim()) {
    throw new Error("schema.sql is empty.");
  }

  await pool.query(schemaSql);

  console.log(
    "[HireVision DB] Database tables successfully initialized."
  );
}

async function runAuthenticationMigrations() {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(50)
    DEFAULT 'candidate';
  `);

  await pool.query(`
    UPDATE users
    SET role = 'candidate'
    WHERE role IS NULL
       OR TRIM(role) = '';
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20)
    NOT NULL DEFAULT 'local';
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS microsoft_id VARCHAR(255);
  `);

  await pool.query(`
    UPDATE users
    SET auth_provider = 'local'
    WHERE auth_provider IS NULL
       OR TRIM(auth_provider) = '';
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_users_google_id_unique
    ON users (google_id)
    WHERE google_id IS NOT NULL;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_users_microsoft_id_unique
    ON users (microsoft_id)
    WHERE microsoft_id IS NOT NULL;
  `);

  await pool.query(`
    ALTER TABLE candidate_job_matches
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP DEFAULT NULL;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_role VARCHAR(50) DEFAULT NULL;
  `);

  // Backfill last_login_at for existing candidates who have genuinely stored profile data
  await pool.query(`
    UPDATE users u
    SET last_login_at = COALESCE(p.updated_at, p.created_at, u.created_at),
        last_login_role = 'candidate'
    FROM profiles p
    WHERE u.id = p.user_id
      AND u.role IN ('candidate', 'user')
      AND u.last_login_at IS NULL
      AND (
        (p.career_objective IS NOT NULL AND TRIM(p.career_objective) != '')
        OR (p.resume_url IS NOT NULL AND TRIM(p.resume_url) != '')
        OR (jsonb_typeof(p.projects) = 'array' AND jsonb_array_length(p.projects) > 0)
        OR (jsonb_typeof(p.experience) = 'array' AND jsonb_array_length(p.experience) > 0)
        OR (jsonb_typeof(p.internships) = 'array' AND jsonb_array_length(p.internships) > 0)
        OR (jsonb_typeof(p.education) = 'array' AND jsonb_array_length(p.education) > 0)
        OR (jsonb_typeof(p.certifications) = 'array' AND jsonb_array_length(p.certifications) > 0)
        OR (jsonb_typeof(p.skills) = 'array' AND jsonb_array_length(p.skills) > 0)
        OR (
          jsonb_typeof(p.skills) = 'object'
          AND EXISTS (
            SELECT 1 FROM jsonb_each(p.skills) kv
            WHERE (jsonb_typeof(kv.value) = 'array' AND jsonb_array_length(kv.value) > 0)
               OR (jsonb_typeof(kv.value) = 'string' AND TRIM(kv.value::text, '"') != '')
          )
        )
      );
  `);

  // Purge matches for candidates who have never logged in or have zero stored profile data
  await pool.query(`
    DELETE FROM candidate_job_matches
    WHERE candidate_id IN (
      SELECT u.id FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.role IN ('candidate', 'user')
        AND (
          u.last_login_at IS NULL
          OR NOT (
            (p.career_objective IS NOT NULL AND TRIM(p.career_objective) != '')
            OR (p.resume_url IS NOT NULL AND TRIM(p.resume_url) != '')
            OR (jsonb_typeof(p.projects) = 'array' AND jsonb_array_length(p.projects) > 0)
            OR (jsonb_typeof(p.experience) = 'array' AND jsonb_array_length(p.experience) > 0)
            OR (jsonb_typeof(p.internships) = 'array' AND jsonb_array_length(p.internships) > 0)
            OR (jsonb_typeof(p.education) = 'array' AND jsonb_array_length(p.education) > 0)
            OR (jsonb_typeof(p.certifications) = 'array' AND jsonb_array_length(p.certifications) > 0)
            OR (jsonb_typeof(p.skills) = 'array' AND jsonb_array_length(p.skills) > 0)
            OR (
              jsonb_typeof(p.skills) = 'object'
              AND EXISTS (
                SELECT 1 FROM jsonb_each(p.skills) kv
                WHERE (jsonb_typeof(kv.value) = 'array' AND jsonb_array_length(kv.value) > 0)
                   OR (jsonb_typeof(kv.value) = 'string' AND TRIM(kv.value::text, '"') != '')
              )
            )
          )
        )
    );
  `);

  console.log(
    "[HireVision DB] Authentication migrations and real-candidate verification completed successfully."
  );
}

async function initializeAiDatabase() {
  const initAiDatabase = require("./init_ai_db");

  await initAiDatabase();

  console.log(
    "[HireVision DB] AI database initialization completed successfully."
  );
}

async function verifyConnection(retries = 5) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query("SELECT 1");

      console.log(
        `[HireVision DB] PostgreSQL connection established on attempt ${attempt}.`
      );

      return true;
    } catch (err) {
      lastError = err;

      console.error(
        `[HireVision DB] Connection attempt ${attempt}/${retries} failed:`,
        err.message
      );

      if (attempt < retries) {
        await sleep(Math.min(attempt * 1000, 5000));
      }
    }
  }

  throw lastError;
}

async function initDb() {
  try {
    if (!process.env.DATABASE_URL) {
      await ensureDatabase();
    }

    await verifyConnection();

    await runSchemaInitialization();

    await runAuthenticationMigrations();

    await initializeAiDatabase();

    console.log(
      "[HireVision DB] Database initialization completed successfully."
    );
  } catch (err) {
    console.error(
      "[HireVision DB] Initialization failed:",
      err.message
    );

    throw err;
  }
}

const query = async (text, params = []) => {
  return pool.query(text, params);
};

const getPool = () => pool;

initDb().catch((err) => {
  console.error(
    "[HireVision DB] Fatal initialization error:",
    err.message
  );
});

module.exports = {
  query,
  pool,
  getPool,
};