const db = require("./db");

async function initAiDatabase() {
  console.log(
    "[HireVision AI DB] Verifying AI intelligence tables..."
  );

  try {
    /*
     * ============================================================
     * AI PROFILE ANALYSIS
     * ============================================================
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_profile_analysis (
        id SERIAL PRIMARY KEY,

        user_id INT UNIQUE
          REFERENCES users(id)
          ON DELETE CASCADE,

        profile_score INT NOT NULL DEFAULT 0,

        strengths JSONB DEFAULT '[]'::jsonb,

        weaknesses JSONB DEFAULT '[]'::jsonb,

        improvements JSONB DEFAULT '[]'::jsonb,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    /*
     * ============================================================
     * AI SKILL ANALYSIS
     * ============================================================
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_skill_analysis (
        id SERIAL PRIMARY KEY,

        user_id INT
          REFERENCES users(id)
          ON DELETE CASCADE,

        skill_name VARCHAR(100) NOT NULL,

        proficiency_score INT NOT NULL DEFAULT 0,

        level VARCHAR(50) NOT NULL DEFAULT 'Unknown',

        evidence JSONB DEFAULT '[]'::jsonb,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(
          user_id,
          skill_name
        )
      );
    `);

    /*
     * ============================================================
     * AI PROJECT ANALYSIS
     * ============================================================
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_project_analysis (
        id SERIAL PRIMARY KEY,

        user_id INT
          REFERENCES users(id)
          ON DELETE CASCADE,

        project_title VARCHAR(150) NOT NULL,

        quality_score INT NOT NULL DEFAULT 0,

        technical_depth INT NOT NULL DEFAULT 0,

        career_relevance INT NOT NULL DEFAULT 0,

        description_quality INT NOT NULL DEFAULT 0,

        suggestions JSONB DEFAULT '[]'::jsonb,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(
          user_id,
          project_title
        )
      );
    `);

    /*
     * ============================================================
     * CAREER RECOMMENDATIONS
     * ============================================================
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_career_recommendation (
        id SERIAL PRIMARY KEY,

        user_id INT
          REFERENCES users(id)
          ON DELETE CASCADE,

        role_name VARCHAR(150) NOT NULL,

        match_score INT NOT NULL DEFAULT 0,

        explanation TEXT NOT NULL DEFAULT '',

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(
          user_id,
          role_name
        )
      );
    `);

    /*
     * ============================================================
     * CAREER READINESS
     * ============================================================
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_career_readiness (
        id SERIAL PRIMARY KEY,

        user_id INT UNIQUE
          REFERENCES users(id)
          ON DELETE CASCADE,

        readiness_score INT NOT NULL DEFAULT 0,

        profile_quality INT NOT NULL DEFAULT 0,

        skill_strength INT NOT NULL DEFAULT 0,

        project_strength INT NOT NULL DEFAULT 0,

        resume_quality INT NOT NULL DEFAULT 0,

        career_fit INT NOT NULL DEFAULT 0,

        strengths JSONB DEFAULT '[]'::jsonb,

        weaknesses JSONB DEFAULT '[]'::jsonb,

        top_improvements JSONB DEFAULT '[]'::jsonb,

        next_actions JSONB DEFAULT '[]'::jsonb,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    /*
     * ============================================================
     * EXTERNAL IMPORT APPROVAL WORKFLOW
     * ============================================================
     *
     * GitHub / LinkedIn scan se detected items
     * direct profile me add nahi honge.
     *
     * Pehle yahan PENDING request create hogi.
     *
     * Candidate approval ke baad hi actual profile update hoga.
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS external_import_requests (
        id SERIAL PRIMARY KEY,

        user_id INT NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        source VARCHAR(50) NOT NULL,

        item_type VARCHAR(50) NOT NULL,

        external_id VARCHAR(255) NOT NULL,

        title VARCHAR(255) NOT NULL,

        description TEXT,

        metadata JSONB DEFAULT '{}'::jsonb,

        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(
          user_id,
          source,
          item_type,
          external_id
        )
      );
    `);

    /*
     * Ensure existing databases also have required columns.
     */

    await db.query(`
      ALTER TABLE external_import_requests
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    `);

    await db.query(`
      ALTER TABLE external_import_requests
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING';
    `);

    await db.query(`
      ALTER TABLE external_import_requests
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await db.query(`
      ALTER TABLE external_import_requests
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    /*
     * ============================================================
     * LINKEDIN CONNECTIONS
     * ============================================================
     *
     * LinkedIn OAuth access token plain text me save nahi hota.
     * linkedin_client.js AES-256-GCM encryption use karta hai.
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS linkedin_connections (
        id SERIAL PRIMARY KEY,

        user_id INT UNIQUE NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        linkedin_member_id VARCHAR(255),

        profile_url TEXT NOT NULL,

        access_token_encrypted TEXT NOT NULL,

        refresh_token_encrypted TEXT,

        scopes JSONB DEFAULT '[]'::jsonb,

        expires_at TIMESTAMP NULL,

        refresh_token_expires_at TIMESTAMP NULL,

        profile_data JSONB DEFAULT '{}'::jsonb,

        last_synced_at TIMESTAMP NULL,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    /*
     * Existing database migration safety.
     */

    await db.query(`
      ALTER TABLE linkedin_connections
      ADD COLUMN IF NOT EXISTS linkedin_member_id VARCHAR(255);
    `);

    await db.query(`
      ALTER TABLE linkedin_connections
      ADD COLUMN IF NOT EXISTS profile_url TEXT;
    `);

    await db.query(`
      ALTER TABLE linkedin_connections
      ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT;
    `);

    await db.query(`
      ALTER TABLE linkedin_connections
      ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT;
    `);

    await db.query(`
      ALTER TABLE linkedin_connections
      ADD COLUMN IF NOT EXISTS scopes JSONB DEFAULT '[]'::jsonb;
    `);

    await db.query(`
      ALTER TABLE linkedin_connections
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL;
    `);

    await db.query(`
      ALTER TABLE linkedin_connections
      ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMP NULL;
    `);

    await db.query(`
      ALTER TABLE linkedin_connections
      ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}'::jsonb;
    `);

    await db.query(`
      ALTER TABLE linkedin_connections
      ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP NULL;
    `);

    await db.query(`
      ALTER TABLE linkedin_connections
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await db.query(`
      ALTER TABLE linkedin_connections
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    /*
     * ============================================================
     * RECRUITER PROFILE
     * ============================================================
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS recruiter_profiles (
        id SERIAL PRIMARY KEY,

        user_id INT UNIQUE
          REFERENCES users(id)
          ON DELETE CASCADE,

        company_name VARCHAR(150),

        industry VARCHAR(100),

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    /*
     * ============================================================
     * JOBS
     * ============================================================
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,

        recruiter_id INT
          REFERENCES users(id)
          ON DELETE CASCADE,

        title VARCHAR(150) NOT NULL,

        description TEXT,

        requirements JSONB DEFAULT '{
          "must_have": [],
          "preferred": [],
          "optional": []
        }'::jsonb,

        status VARCHAR(50) DEFAULT 'Active',

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    /*
     * ============================================================
     * CANDIDATE JOB MATCHES
     * ============================================================
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS candidate_job_matches (
        id SERIAL PRIMARY KEY,

        candidate_id INT
          REFERENCES users(id)
          ON DELETE CASCADE,

        job_id INT
          REFERENCES jobs(id)
          ON DELETE CASCADE,

        match_score INT DEFAULT 0,

        explanation TEXT,

        status VARCHAR(50) DEFAULT 'Awaiting Review',

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(
          candidate_id,
          job_id
        )
      );
    `);

    /*
     * ============================================================
     * AI CHATS
     * ============================================================
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_chats (
        id SERIAL PRIMARY KEY,

        user_id INT NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        title VARCHAR(255)
          NOT NULL
          DEFAULT 'New conversation',

        deleted BOOLEAN
          NOT NULL
          DEFAULT FALSE,

        is_deleted BOOLEAN
          NOT NULL
          DEFAULT FALSE,

        created_at TIMESTAMP
          NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        deleted_at TIMESTAMP NULL
      );
    `);

    /*
     * Support already-created ai_chats table.
     */

    await db.query(`
      ALTER TABLE ai_chats
      ADD COLUMN IF NOT EXISTS title VARCHAR(255)
      DEFAULT 'New conversation';
    `);

    await db.query(`
      ALTER TABLE ai_chats
      ADD COLUMN IF NOT EXISTS deleted BOOLEAN
      DEFAULT FALSE;
    `);

    await db.query(`
      ALTER TABLE ai_chats
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN
      DEFAULT FALSE;
    `);

    await db.query(`
      ALTER TABLE ai_chats
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
    `);

    await db.query(`
      ALTER TABLE ai_chats
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
      DEFAULT CURRENT_TIMESTAMP;
    `);

    await db.query(`
      ALTER TABLE ai_chats
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
      DEFAULT CURRENT_TIMESTAMP;
    `);

    /*
     * ============================================================
     * AI CHAT MESSAGES
     * ============================================================
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id SERIAL PRIMARY KEY,

        chat_id INT NOT NULL
          REFERENCES ai_chats(id)
          ON DELETE CASCADE,

        sender VARCHAR(50) NOT NULL,

        role VARCHAR(50) NOT NULL,

        content TEXT NOT NULL,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMP
          NOT NULL
          DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      ALTER TABLE ai_chat_messages
      ADD COLUMN IF NOT EXISTS sender VARCHAR(50);
    `);

    await db.query(`
      ALTER TABLE ai_chat_messages
      ADD COLUMN IF NOT EXISTS role VARCHAR(50);
    `);

    await db.query(`
      ALTER TABLE ai_chat_messages
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    `);

    await db.query(`
      ALTER TABLE ai_chat_messages
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
      DEFAULT CURRENT_TIMESTAMP;
    `);

    /*
     * ============================================================
     * LIVE RESUME
     * ============================================================
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS live_resumes (
        id SERIAL PRIMARY KEY,

        user_id INT UNIQUE
          REFERENCES users(id)
          ON DELETE CASCADE,

        content TEXT NOT NULL DEFAULT '',

        missing_data JSONB DEFAULT '[]'::jsonb,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    /*
     * ============================================================
     * HIRING PIPELINE
     * ============================================================
     */

    await db.query(`
      CREATE TABLE IF NOT EXISTS hiring_pipeline_stages (
        id SERIAL PRIMARY KEY,

        match_id INT
          REFERENCES candidate_job_matches(id)
          ON DELETE CASCADE,

        stage VARCHAR(50)
          NOT NULL
          DEFAULT 'Applied',

        notes TEXT,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    /*
     * ============================================================
     * INDEXES
     * ============================================================
     */

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_external_import_user_status
      ON external_import_requests(
        user_id,
        status
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_external_import_source
      ON external_import_requests(
        user_id,
        source
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_external_import_item_type
      ON external_import_requests(
        user_id,
        item_type
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_linkedin_connections_member
      ON linkedin_connections(
        linkedin_member_id
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_chats_user_id
      ON ai_chats(
        user_id
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_chats_user_updated
      ON ai_chats(
        user_id,
        updated_at DESC
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_chat_id
      ON ai_chat_messages(
        chat_id
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_recruiter
      ON jobs(
        recruiter_id
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_candidate_job_matches_candidate
      ON candidate_job_matches(
        candidate_id
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_candidate_job_matches_job
      ON candidate_job_matches(
        job_id
      );
    `);

    console.log(
      "[HireVision AI DB] AI intelligence tables verified successfully."
    );
  } catch (error) {
    console.error(
      "[HireVision AI DB] Error initializing AI tables:",
      error
    );

    throw error;
  }
}

module.exports = initAiDatabase;