-- ==========================================
-- HIREVISION DATABASE SCHEMA
-- ==========================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'candidate',
    auth_provider VARCHAR(20) NOT NULL DEFAULT 'local',
    google_id VARCHAR(255),
    microsoft_id VARCHAR(255),
    last_login_at TIMESTAMP DEFAULT NULL,
    last_login_role VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,

    user_id INT UNIQUE
        REFERENCES users(id)
        ON DELETE CASCADE,

    full_name VARCHAR(150),

    phone VARCHAR(20),

    dob DATE,

    gender VARCHAR(20),

    address TEXT,

    city VARCHAR(100),

    state VARCHAR(100),

    country VARCHAR(100),

    profile_photo TEXT,

    career_objective TEXT,

    education JSONB
        DEFAULT '[]'::jsonb,

    skills JSONB
        DEFAULT '{
            "programming_languages": [],
            "frameworks": [],
            "libraries": [],
            "databases": [],
            "developer_tools": [],
            "soft_skills": []
        }'::jsonb,

    projects JSONB
        DEFAULT '[]'::jsonb,

    internships JSONB
        DEFAULT '[]'::jsonb,

    experience JSONB
        DEFAULT '[]'::jsonb,

    certifications JSONB
        DEFAULT '[]'::jsonb,

    achievements JSONB
        DEFAULT '[]'::jsonb,

    languages JSONB
        DEFAULT '[]'::jsonb,

    social_profiles JSONB
        DEFAULT '{
            "linkedin": "",
            "github": "",
            "portfolio": "",
            "leetcode": "",
            "codechef": "",
            "hackerrank": ""
        }'::jsonb,

    resume_url TEXT,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- AI PROFILE ANALYSIS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_profile_analysis (
    id SERIAL PRIMARY KEY,

    user_id INT UNIQUE
        REFERENCES users(id)
        ON DELETE CASCADE,

    profile_score INT NOT NULL
        DEFAULT 0,

    strengths JSONB
        DEFAULT '[]'::jsonb,

    weaknesses JSONB
        DEFAULT '[]'::jsonb,

    improvements JSONB
        DEFAULT '[]'::jsonb,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- AI SKILL ANALYSIS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_skill_analysis (
    id SERIAL PRIMARY KEY,

    user_id INT
        REFERENCES users(id)
        ON DELETE CASCADE,

    skill_name VARCHAR(100)
        NOT NULL,

    proficiency_score INT NOT NULL
        DEFAULT 0,

    level VARCHAR(50)
        NOT NULL
        DEFAULT 'Unknown',

    evidence JSONB
        DEFAULT '[]'::jsonb,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        user_id,
        skill_name
    )
);

-- ==========================================
-- AI PROJECT ANALYSIS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_project_analysis (
    id SERIAL PRIMARY KEY,

    user_id INT
        REFERENCES users(id)
        ON DELETE CASCADE,

    project_title VARCHAR(150)
        NOT NULL,

    quality_score INT NOT NULL
        DEFAULT 0,

    technical_depth INT NOT NULL
        DEFAULT 0,

    career_relevance INT NOT NULL
        DEFAULT 0,

    description_quality INT NOT NULL
        DEFAULT 0,

    suggestions JSONB
        DEFAULT '[]'::jsonb,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        user_id,
        project_title
    )
);

-- ==========================================
-- AI CAREER RECOMMENDATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_career_recommendation (
    id SERIAL PRIMARY KEY,

    user_id INT
        REFERENCES users(id)
        ON DELETE CASCADE,

    role_name VARCHAR(150)
        NOT NULL,

    match_score INT NOT NULL
        DEFAULT 0,

    explanation TEXT
        NOT NULL
        DEFAULT '',

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        user_id,
        role_name
    )
);

-- ==========================================
-- AI CAREER READINESS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_career_readiness (
    id SERIAL PRIMARY KEY,

    user_id INT UNIQUE
        REFERENCES users(id)
        ON DELETE CASCADE,

    readiness_score INT NOT NULL
        DEFAULT 0,

    profile_quality INT NOT NULL
        DEFAULT 0,

    skill_strength INT NOT NULL
        DEFAULT 0,

    project_strength INT NOT NULL
        DEFAULT 0,

    resume_quality INT NOT NULL
        DEFAULT 0,

    career_fit INT NOT NULL
        DEFAULT 0,

    strengths JSONB
        DEFAULT '[]'::jsonb,

    weaknesses JSONB
        DEFAULT '[]'::jsonb,

    top_improvements JSONB
        DEFAULT '[]'::jsonb,

    next_actions JSONB
        DEFAULT '[]'::jsonb,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- EXTERNAL IMPORT REQUESTS
-- ==========================================
--
-- GitHub / LinkedIn se detect hua data
-- direct candidate profile me add nahi hota.
--
-- Pehle PENDING request create hoti hai.
--
-- Candidate APPROVE kare tab hi profile me add hota hai.
-- Candidate REJECT kare to profile unchanged rehta hai.
-- ==========================================

CREATE TABLE IF NOT EXISTS external_import_requests (
    id SERIAL PRIMARY KEY,

    user_id INT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    source VARCHAR(50)
        NOT NULL,

    item_type VARCHAR(50)
        NOT NULL,

    external_id VARCHAR(255)
        NOT NULL,

    title VARCHAR(255)
        NOT NULL,

    description TEXT,

    metadata JSONB
        DEFAULT '{}'::jsonb,

    status VARCHAR(50)
        NOT NULL
        DEFAULT 'PENDING',

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        user_id,
        source,
        item_type,
        external_id
    )
);

-- ==========================================
-- LINKEDIN CONNECTIONS
-- ==========================================
--
-- LinkedIn OAuth access token plain text me
-- store nahi hota.
--
-- Application layer AES-256-GCM encryption
-- use karke encrypted token save karti hai.
-- ==========================================

CREATE TABLE IF NOT EXISTS linkedin_connections (
    id SERIAL PRIMARY KEY,

    user_id INT UNIQUE NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    linkedin_member_id VARCHAR(255),

    profile_url TEXT
        NOT NULL,

    access_token_encrypted TEXT
        NOT NULL,

    refresh_token_encrypted TEXT,

    scopes JSONB
        DEFAULT '[]'::jsonb,

    expires_at TIMESTAMP NULL,

    refresh_token_expires_at TIMESTAMP NULL,

    profile_data JSONB
        DEFAULT '{}'::jsonb,

    last_synced_at TIMESTAMP NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- RECRUITER PROFILES
-- ==========================================

CREATE TABLE IF NOT EXISTS recruiter_profiles (
    id SERIAL PRIMARY KEY,

    user_id INT UNIQUE
        REFERENCES users(id)
        ON DELETE CASCADE,

    company_name VARCHAR(150),

    industry VARCHAR(100),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- JOBS
-- ==========================================

CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,

    recruiter_id INT
        REFERENCES users(id)
        ON DELETE CASCADE,

    title VARCHAR(150)
        NOT NULL,

    description TEXT,

    requirements JSONB
        DEFAULT '{
            "must_have": [],
            "preferred": [],
            "optional": []
        }'::jsonb,

    status VARCHAR(50)
        DEFAULT 'Active',

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- CANDIDATE JOB MATCHES
-- ==========================================

CREATE TABLE IF NOT EXISTS candidate_job_matches (
    id SERIAL PRIMARY KEY,

    candidate_id INT
        REFERENCES users(id)
        ON DELETE CASCADE,

    job_id INT
        REFERENCES jobs(id)
        ON DELETE CASCADE,

    match_score INT
        DEFAULT 0,

    explanation TEXT,

    status VARCHAR(50)
        DEFAULT 'Awaiting Review',

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        candidate_id,
        job_id
    )
);

-- ==========================================
-- AI CHAT CONVERSATIONS
-- ==========================================

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

-- ==========================================
-- AI CHAT MESSAGES
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id SERIAL PRIMARY KEY,

    chat_id INT NOT NULL
        REFERENCES ai_chats(id)
        ON DELETE CASCADE,

    sender VARCHAR(50)
        NOT NULL,

    role VARCHAR(50)
        NOT NULL,

    content TEXT
        NOT NULL,

    metadata JSONB
        DEFAULT '{}'::jsonb,

    created_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- LIVE RESUME
-- ==========================================

CREATE TABLE IF NOT EXISTS live_resumes (
    id SERIAL PRIMARY KEY,

    user_id INT UNIQUE
        REFERENCES users(id)
        ON DELETE CASCADE,

    content TEXT
        NOT NULL
        DEFAULT '',

    missing_data JSONB
        DEFAULT '[]'::jsonb,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- HIRING PIPELINE
-- ==========================================

CREATE TABLE IF NOT EXISTS hiring_pipeline_stages (
    id SERIAL PRIMARY KEY,

    match_id INT
        REFERENCES candidate_job_matches(id)
        ON DELETE CASCADE,

    stage VARCHAR(50)
        NOT NULL
        DEFAULT 'Applied',

    notes TEXT,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_users_email
ON users (
    email
);

CREATE INDEX IF NOT EXISTS idx_users_role
ON users (
    role
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id
ON profiles (
    user_id
);

CREATE INDEX IF NOT EXISTS idx_ai_profile_analysis_user_id
ON ai_profile_analysis (
    user_id
);

CREATE INDEX IF NOT EXISTS idx_ai_skill_analysis_user_id
ON ai_skill_analysis (
    user_id
);

CREATE INDEX IF NOT EXISTS idx_ai_project_analysis_user_id
ON ai_project_analysis (
    user_id
);

CREATE INDEX IF NOT EXISTS idx_ai_career_recommendation_user_id
ON ai_career_recommendation (
    user_id
);

CREATE INDEX IF NOT EXISTS idx_ai_career_readiness_user_id
ON ai_career_readiness (
    user_id
);

CREATE INDEX IF NOT EXISTS idx_external_import_user_status
ON external_import_requests (
    user_id,
    status
);

CREATE INDEX IF NOT EXISTS idx_external_import_source
ON external_import_requests (
    user_id,
    source
);

CREATE INDEX IF NOT EXISTS idx_external_import_item_type
ON external_import_requests (
    user_id,
    item_type
);

CREATE INDEX IF NOT EXISTS idx_linkedin_connections_member
ON linkedin_connections (
    linkedin_member_id
);

CREATE INDEX IF NOT EXISTS idx_linkedin_connections_user
ON linkedin_connections (
    user_id
);

CREATE INDEX IF NOT EXISTS idx_jobs_recruiter_id
ON jobs (
    recruiter_id
);

CREATE INDEX IF NOT EXISTS idx_matches_job_id
ON candidate_job_matches (
    job_id
);

CREATE INDEX IF NOT EXISTS idx_matches_candidate_id
ON candidate_job_matches (
    candidate_id
);

CREATE INDEX IF NOT EXISTS idx_ai_chats_user_id
ON ai_chats (
    user_id
);

CREATE INDEX IF NOT EXISTS idx_ai_chats_user_updated
ON ai_chats (
    user_id,
    updated_at DESC
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_chat_id
ON ai_chat_messages (
    chat_id
);

CREATE INDEX IF NOT EXISTS idx_hiring_pipeline_match_id
ON hiring_pipeline_stages (
    match_id
);