const db = require("../config/db");

const profileAgent = require("../services/ai/profileAgent");
const skillAgent = require("../services/ai/skillAgent");
const projectAgent = require("../services/ai/projectAgent");
const careerAgent = require("../services/ai/careerAgent");
const skillGapAgent = require("../services/ai/skillGapAgent");
const readinessAgent = require("../services/ai/readinessAgent");
const resumeAgent = require("../services/ai/resumeAgent");
const githubAgent = require("../services/ai/githubAgent");
const linkedinAgent = require("../services/ai/linkedinAgent");
const orchestrator = require("../services/ai/orchestrator");
const liveResumeAgent = require("../services/ai/liveResumeAgent");

const linkedinClient = require(
  "../integrations/linkedin/linkedin_client"
);


/* ============================================================
   BASIC HELPERS
============================================================ */

function getUserId(req) {
  return (
    req.user?.id ||
    req.user?.userId ||
    null
  );
}


function requireUserId(req, res) {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
      code: "AUTHENTICATION_REQUIRED",
    });

    return null;
  }

  return userId;
}


function safeArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}


function json(value) {
  return JSON.stringify(
    value ?? []
  );
}


function unwrapResult(value) {
  if (
    value &&
    typeof value === "object" &&
    Object.prototype.hasOwnProperty.call(
      value,
      "result"
    )
  ) {
    return value.result;
  }

  return value;
}


function normalizeHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item) =>
        item &&
        (
          item.role === "user" ||
          item.role === "assistant"
        ) &&
        typeof item.content === "string" &&
        item.content.trim()
    )
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }))
    .slice(-40);
}


function extractAIText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (
    typeof value.response === "string"
  ) {
    return value.response.trim();
  }

  if (
    typeof value.reply === "string"
  ) {
    return value.reply.trim();
  }

  if (
    typeof value.answer === "string"
  ) {
    return value.answer.trim();
  }

  if (
    typeof value.summary === "string"
  ) {
    return value.summary.trim();
  }

  if (
    typeof value.message === "string"
  ) {
    return value.message.trim();
  }

  if (
    typeof value.result === "string"
  ) {
    return value.result.trim();
  }

  if (
    value.result &&
    typeof value.result === "object"
  ) {
    return extractAIText(
      value.result
    );
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}


function generateChatTitle(message) {
  return (
    String(message || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) ||
    "New conversation"
  );
}


async function getFullProfile(userId) {
  const result = await db.query(
    `
    SELECT *
    FROM profiles
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    throw new Error(
      "Candidate profile not found."
    );
  }

  return result.rows[0];
}


function getFunction(
  moduleObject,
  names,
  label
) {
  for (const name of names) {
    if (
      typeof moduleObject?.[name] ===
      "function"
    ) {
      return moduleObject[name];
    }
  }

  throw new Error(
    `${label} function is unavailable.`
  );
}


/* ============================================================
   AGENT FUNCTIONS
============================================================ */

function analyzeProfile(profile) {
  return getFunction(
    profileAgent,
    [
      "analyzeProfile",
      "analyze",
      "execute",
    ],
    "Profile agent"
  )(profile);
}


function analyzeSkills(profile) {
  return getFunction(
    skillAgent,
    [
      "analyzeSkills",
      "analyze",
      "execute",
    ],
    "Skill agent"
  )(profile);
}


function analyzeProjects(profile) {
  return getFunction(
    projectAgent,
    [
      "analyzeProjects",
      "analyze",
      "execute",
    ],
    "Project agent"
  )(profile);
}


function recommendCareers(
  profile,
  skills
) {
  return getFunction(
    careerAgent,
    [
      "recommendCareers",
      "analyzeCareer",
      "execute",
    ],
    "Career agent"
  )(
    profile,
    skills
  );
}


function analyzeSkillGaps(
  profile,
  targetRole
) {
  return getFunction(
    skillGapAgent,
    [
      "analyzeSkillGaps",
      "analyze",
      "execute",
    ],
    "Skill gap agent"
  )(
    profile,
    targetRole
  );
}


function calculateReadiness(
  profile,
  profileAnalysis,
  skills,
  projects,
  careers
) {
  return getFunction(
    readinessAgent,
    [
      "calculateReadiness",
      "analyzeReadiness",
      "execute",
    ],
    "Readiness agent"
  )(
    profile,
    profileAnalysis,
    skills,
    projects,
    careers
  );
}


function generateResumeSuggestions(
  profile
) {
  return getFunction(
    resumeAgent,
    [
      "generateResumeSuggestions",
      "analyzeResume",
      "execute",
    ],
    "Resume agent"
  )(profile);
}


/* ============================================================
   CHAT HELPERS
============================================================ */

async function verifyChatOwnership(
  chatId,
  userId
) {
  if (!chatId || !userId) {
    return false;
  }

  const result = await db.query(
    `
    SELECT id
    FROM ai_chats
    WHERE id = $1
      AND user_id = $2
      AND COALESCE(
        deleted,
        false
      ) = false
      AND COALESCE(
        is_deleted,
        false
      ) = false
    LIMIT 1
    `,
    [
      chatId,
      userId,
    ]
  );

  return result.rowCount > 0;
}


async function createChatForUser(
  userId,
  title = "New conversation"
) {
  const result = await db.query(
    `
    INSERT INTO ai_chats
    (
      user_id,
      title,
      deleted,
      is_deleted,
      created_at,
      updated_at
    )
    VALUES
    (
      $1,
      $2,
      false,
      false,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING *
    `,
    [
      userId,
      title,
    ]
  );

  return result.rows[0];
}


async function resolveChat(
  userId,
  chatId,
  title
) {
  if (chatId) {
    const ownsChat =
      await verifyChatOwnership(
        chatId,
        userId
      );

    if (ownsChat) {
      return String(chatId);
    }
  }

  const chat =
    await createChatForUser(
      userId,
      title
    );

  return String(chat.id);
}


async function saveChatMessages(
  chatId,
  userMessage,
  assistantMessage
) {
  await db.query(
    `
    INSERT INTO ai_chat_messages
    (
      chat_id,
      sender,
      role,
      content,
      created_at
    )
    VALUES
    (
      $1,
      'user',
      'user',
      $2,
      CURRENT_TIMESTAMP
    )
    `,
    [
      chatId,
      userMessage,
    ]
  );

  await db.query(
    `
    INSERT INTO ai_chat_messages
    (
      chat_id,
      sender,
      role,
      content,
      created_at
    )
    VALUES
    (
      $1,
      'agent',
      'assistant',
      $2,
      CURRENT_TIMESTAMP
    )
    `,
    [
      chatId,
      assistantMessage,
    ]
  );

  await db.query(
    `
    UPDATE ai_chats
    SET
      updated_at =
        CURRENT_TIMESTAMP
    WHERE id = $1
    `,
    [chatId]
  );
}


/* ============================================================
   LINKEDIN HELPERS
============================================================ */

function getFrontendBaseUrl() {
  return String(
    process.env.FRONTEND_URL ||
    "http://localhost:3000"
  )
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");
}


function buildLinkedinFrontendRedirect(
  params = {}
) {
  const configured =
    String(
      process.env
        .LINKEDIN_FRONTEND_RETURN_URL ||
      ""
    ).trim();

  const target =
    configured ||
    `${getFrontendBaseUrl()}/dashboard`;

  const url = new URL(target);

  if (!url.searchParams.has("tab")) {
    url.searchParams.set("tab", "ai-insights");
  }

  for (
    const [key, value]
    of Object.entries(params)
  ) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      url.searchParams.set(
        key,
        String(value)
      );
    }
  }

  return url.toString();
}


function normalizeLinkedinProfileUrl(
  value
) {
  return getFunction(
    linkedinClient,
    [
      "normalizeLinkedInUrl",
      "normalizeLinkedinUrl",
    ],
    "LinkedIn URL normalizer"
  )(value);
}


function buildLinkedinAuthorizationUrl(
  userId,
  linkedinUrl
) {
  return getFunction(
    linkedinClient,
    [
      "buildAuthorizationUrl",
    ],
    "LinkedIn authorization"
  )(
    userId,
    linkedinUrl
  );
}


function verifyLinkedinStatePayload(
  state
) {
  return getFunction(
    linkedinClient,
    [
      "verifyStatePayload",
    ],
    "LinkedIn OAuth state verification"
  )(state);
}


function exchangeLinkedinAuthorizationCode(
  code
) {
  return getFunction(
    linkedinClient,
    [
      "exchangeAuthorizationCode",
    ],
    "LinkedIn token exchange"
  )(code);
}


function fetchAuthorizedLinkedInProfile(
  accessToken,
  linkedinUrl
) {
  return getFunction(
    linkedinClient,
    [
      "fetchAuthorizedLinkedInProfile",
    ],
    "LinkedIn profile fetch"
  )(
    accessToken,
    linkedinUrl
  );
}


function encryptLinkedinToken(token) {
  return getFunction(
    linkedinClient,
    [
      "encryptToken",
    ],
    "LinkedIn token encryption"
  )(token);
}


function decryptLinkedinToken(token) {
  return getFunction(
    linkedinClient,
    [
      "decryptToken",
    ],
    "LinkedIn token decryption"
  )(token);
}


function linkedinTokenExpiryDate(
  seconds
) {
  return getFunction(
    linkedinClient,
    [
      "tokenExpiryDate",
    ],
    "LinkedIn token expiry"
  )(seconds);
}


function getLinkedinConfig() {
  return getFunction(
    linkedinClient,
    [
      "getRequiredConfig",
    ],
    "LinkedIn configuration"
  )();
}


async function getLinkedinConnection(
  userId
) {
  const result = await db.query(
    `
    SELECT *
    FROM linkedin_connections
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}


function linkedinConnectionExpired(
  connection
) {
  if (!connection?.expires_at) {
    return false;
  }

  const expiresAt =
    new Date(
      connection.expires_at
    ).getTime();

  return (
    Number.isFinite(expiresAt) &&
    expiresAt <=
      Date.now() + 30000
  );
}


async function saveLinkedinConnection({
  userId,
  linkedinUrl,
  tokenData,
  profileData,
}) {
  const accessToken =
    tokenData?.access_token;

  if (!accessToken) {
    throw new Error(
      "LinkedIn access token was not returned."
    );
  }

  const encryptedAccessToken =
    encryptLinkedinToken(
      accessToken
    );

  const encryptedRefreshToken =
    tokenData?.refresh_token
      ? encryptLinkedinToken(
          tokenData.refresh_token
        )
      : null;

  const expiresAt =
    linkedinTokenExpiryDate(
      tokenData?.expires_in
    );

  const refreshExpiresAt =
    linkedinTokenExpiryDate(
      tokenData
        ?.refresh_token_expires_in
    );

  const scopes =
    String(
      tokenData?.scope ||
      process.env
        .LINKEDIN_SCOPES ||
      ""
    )
      .split(/[ ,]+/)
      .map(
        (value) =>
          value.trim()
      )
      .filter(Boolean);

  const result = await db.query(
    `
    INSERT INTO linkedin_connections
    (
      user_id,
      linkedin_member_id,
      profile_url,
      access_token_encrypted,
      refresh_token_encrypted,
      scopes,
      expires_at,
      refresh_token_expires_at,
      profile_data,
      last_synced_at,
      updated_at
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )

    ON CONFLICT (user_id)

    DO UPDATE SET
      linkedin_member_id =
        EXCLUDED.linkedin_member_id,

      profile_url =
        EXCLUDED.profile_url,

      access_token_encrypted =
        EXCLUDED.access_token_encrypted,

      refresh_token_encrypted =
        COALESCE(
          EXCLUDED.refresh_token_encrypted,
          linkedin_connections
            .refresh_token_encrypted
        ),

      scopes =
        EXCLUDED.scopes,

      expires_at =
        EXCLUDED.expires_at,

      refresh_token_expires_at =
        COALESCE(
          EXCLUDED.refresh_token_expires_at,
          linkedin_connections
            .refresh_token_expires_at
        ),

      profile_data =
        EXCLUDED.profile_data,

      last_synced_at =
        CURRENT_TIMESTAMP,

      updated_at =
        CURRENT_TIMESTAMP

    RETURNING *
    `,
    [
      userId,

      profileData?.member_id ||
      null,

      linkedinUrl,

      encryptedAccessToken,

      encryptedRefreshToken,

      JSON.stringify(scopes),

      expiresAt,

      refreshExpiresAt,

      JSON.stringify(
        profileData || {}
      ),
    ]
  );

  return result.rows[0];
}


async function updateLinkedinConnectionProfile(
  userId,
  linkedinUrl,
  profileData
) {
  await db.query(
    `
    UPDATE linkedin_connections
    SET
      linkedin_member_id =
        COALESCE(
          $2,
          linkedin_member_id
        ),

      profile_url = $3,

      profile_data = $4,

      last_synced_at =
        CURRENT_TIMESTAMP,

      updated_at =
        CURRENT_TIMESTAMP

    WHERE user_id = $1
    `,
    [
      userId,

      profileData?.member_id ||
      null,

      linkedinUrl,

      JSON.stringify(
        profileData || {}
      ),
    ]
  );
}


async function updateProfileLinkedinUrl(
  userId,
  linkedinUrl
) {
  const result = await db.query(
    `
    SELECT social_profiles
    FROM profiles
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    return;
  }

  const current =
    result.rows[0]
      ?.social_profiles;

  const socialProfiles =
    current &&
    typeof current === "object" &&
    !Array.isArray(current)
      ? {
          ...current,
        }
      : {};

  socialProfiles.linkedin =
    linkedinUrl;

  await db.query(
    `
    UPDATE profiles
    SET
      social_profiles = $1,
      updated_at =
        CURRENT_TIMESTAMP
    WHERE user_id = $2
    `,
    [
      JSON.stringify(
        socialProfiles
      ),

      userId,
    ]
  );
}


/* ============================================================
   IMPORT HELPERS
============================================================ */

function normalizeScanItems(scan) {
  if (Array.isArray(scan)) {
    return scan.filter(
      (item) =>
        String(
          item?.status ||
          "PENDING"
        ).toUpperCase() ===
        "PENDING"
    );
  }

  const possible = [
    scan?.items,
    scan?.pendingImports,
    scan?.pending_items,
    scan?.pending_imports,
  ];

  for (const value of possible) {
    if (Array.isArray(value)) {
      return value.filter(
        (item) =>
          String(
            item?.status ||
            "PENDING"
          ).toUpperCase() ===
          "PENDING"
      );
    }
  }

  return [];
}


function normalizeMetadata(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  return {};
}


async function applyApprovedItemToProfile(
  item,
  userId,
  client
) {
  const executor =
    client || db;

  if (!item?.id) {
    throw new Error(
      "Invalid import request."
    );
  }

  const profileResult =
    await executor.query(
      `
      SELECT *
      FROM profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

  if (
    profileResult.rowCount ===
    0
  ) {
    throw new Error(
      "Candidate profile not found."
    );
  }

  const profile =
    profileResult.rows[0];

  const metadata =
    normalizeMetadata(
      item.metadata
    );

  const type =
    String(
      item.item_type || ""
    )
      .trim()
      .toLowerCase();

  const title =
    String(
      item.title || ""
    ).trim();

  const importedAt =
    new Date().toISOString();


  if (type === "project") {
    const projects =
      safeArray(
        profile.projects
      ).map(
        (project) => ({
          ...project,
        })
      );

    const exists =
      projects.some(
        (project) =>
          String(
            project?.title ||
            project?.name ||
            ""
          )
            .trim()
            .toLowerCase() ===
          title.toLowerCase()
      );

    if (!exists) {
      projects.push({
        title,

        description:
          item.description ||
          "",

        technologies:
          metadata.technologies ||
          metadata.languages ||
          "",

        github_link:
          metadata.github_link ||
          metadata.source_url ||
          "",

        live_link:
          metadata.live_link ||
          "",

        role:
          metadata.role ||
          "",

        duration:
          metadata.duration ||
          "",

        source:
          item.source ||
          "linkedin",

        source_url:
          metadata.source_url ||
          "",

        imported_at:
          importedAt,

        approved_by_user:
          true,

        approval_timestamp:
          importedAt,
      });

      await executor.query(
        `
        UPDATE profiles
        SET
          projects = $1,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE user_id = $2
        `,
        [
          JSON.stringify(
            projects
          ),

          userId,
        ]
      );
    }
  }

  else if (type === "skill") {
    let skills;

    if (
      Array.isArray(
        profile.skills
      )
    ) {
      skills = [
        ...profile.skills,
      ];

      const exists =
        skills.some(
          (skill) => {
            const value =
              typeof skill ===
                "string"
                ? skill
                : skill?.name ||
                  skill?.skill ||
                  skill?.title ||
                  "";

            return (
              String(value)
                .trim()
                .toLowerCase() ===
              title.toLowerCase()
            );
          }
        );

      if (!exists) {
        if (
          skills.length > 0 &&
          typeof skills[0] === "object" &&
          skills[0] !== null
        ) {
          skills.push({
            name: title,
            category:
              metadata.category ||
              "Developer Tools",
            level:
              metadata.level ||
              "Intermediate",
            source:
              item.source ||
              "linkedin",
            source_url:
              metadata.source_url ||
              "",
            approved_by_user:
              true,
            approval_timestamp:
              importedAt,
          });
        } else {
          skills.push(title);
        }
      }
    } else {
      skills =
        profile.skills &&
        typeof profile.skills ===
          "object"
          ? JSON.parse(
              JSON.stringify(
                profile.skills
              )
            )
          : {};

      const category =
        String(
          metadata.category ||
          "developer_tools"
        ).trim() ||
        "developer_tools";

      if (
        !Array.isArray(
          skills[category]
        )
      ) {
        skills[category] = [];
      }

      const exists =
        skills[category].some(
          (skill) =>
            String(
              typeof skill === "object"
                ? skill?.name || skill?.skill
                : skill
            )
              .trim()
              .toLowerCase() ===
            title.toLowerCase()
        );

      if (!exists) {
        skills[category].push(
          title
        );
      }
    }

    await executor.query(
      `
      UPDATE profiles
      SET
        skills = $1,
        updated_at =
          CURRENT_TIMESTAMP
      WHERE user_id = $2
      `,
      [
        JSON.stringify(skills),
        userId,
      ]
    );
  }

  else if (
    type === "certification"
  ) {
    const certifications =
      safeArray(
        profile.certifications
      ).map(
        (item) => ({
          ...item,
        })
      );

    const exists =
      certifications.some(
        (cert) =>
          String(
            cert
              ?.certificate_name ||
            cert?.name ||
            cert?.title ||
            ""
          )
            .trim()
            .toLowerCase() ===
          title.toLowerCase()
      );

    if (!exists) {
      certifications.push({
        certificate_name:
          title,

        platform:
          metadata.issuer ||
          metadata.platform ||
          "",

        issue_date:
          metadata.issue_date ||
          metadata.passing_year ||
          "",

        passing_year:
          metadata.issue_date ||
          metadata.passing_year ||
          "",

        credential_id:
          metadata.credential_id ||
          "",

        credential_link:
          metadata.credential_link ||
          metadata.credential_url ||
          metadata.source_url ||
          "",

        source:
          item.source ||
          "linkedin",

        source_url:
          metadata.source_url ||
          "",

        imported_at:
          importedAt,

        approved_by_user:
          true,

        approval_timestamp:
          importedAt,
      });

      await executor.query(
        `
        UPDATE profiles
        SET
          certifications = $1,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE user_id = $2
        `,
        [
          JSON.stringify(
            certifications
          ),

          userId,
        ]
      );
    }
  }

  else if (
    type === "experience"
  ) {
    const experience =
      safeArray(
        profile.experience
      ).map(
        (entry) => ({
          ...entry,
        })
      );

    const company =
      String(
        metadata.company ||
        ""
      ).trim();

    const role =
      String(
        metadata.role ||
        title
      ).trim();

    const exists =
      experience.some(
        (entry) =>
          String(
            entry?.company ||
            ""
          )
            .trim()
            .toLowerCase() ===
            company.toLowerCase() &&
          String(
            entry?.role ||
            ""
          )
            .trim()
            .toLowerCase() ===
            role.toLowerCase()
      );

    if (!exists) {
      experience.push({
        company:
          company ||
          title,

        role,

        location:
          metadata.location ||
          "",

        joining_date:
          metadata.start_date ||
          "",

        ending_date:
          metadata.end_date ||
          (
            metadata.current
              ? "Present"
              : ""
          ),

        description:
          item.description ||
          "",

        source:
          item.source ||
          "linkedin",

        source_url:
          metadata.source_url ||
          "",

        imported_at:
          importedAt,

        approved_by_user:
          true,

        approval_timestamp:
          importedAt,
      });

      await executor.query(
        `
        UPDATE profiles
        SET
          experience = $1,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE user_id = $2
        `,
        [
          JSON.stringify(
            experience
          ),
          userId,
        ]
      );
    }
  }

  else if (type === "education") {
    const education =
      safeArray(
        profile.education
      ).map(
        (entry) => ({
          ...entry,
        })
      );

    const institution =
      String(
        metadata.institution ||
        title
      ).trim();

    const exists =
      education.some(
        (entry) =>
          String(
            entry?.college_name ||
            entry?.institution ||
            ""
          )
            .trim()
            .toLowerCase() ===
          institution.toLowerCase()
      );

    if (!exists) {
      education.push({
        type: "college",

        college_name:
          institution,

        institution,

        degree:
          metadata.degree ||
          "",

        branch:
          metadata
            .field_of_study ||
          "",

        field_of_study:
          metadata
            .field_of_study ||
          "",

        start_year:
          metadata.start_year ||
          "",

        end_year:
          metadata.end_year ||
          "",

        college_passing_year:
          metadata.end_year ||
          "",

        cgpa:
          metadata.grade ||
          "",

        source:
          item.source ||
          "linkedin",

        source_url:
          metadata.source_url ||
          "",

        imported_at:
          importedAt,

        approved_by_user:
          true,

        approval_timestamp:
          importedAt,
      });

      await executor.query(
        `
        UPDATE profiles
        SET
          education = $1,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE user_id = $2
        `,
        [
          JSON.stringify(
            education
          ),

          userId,
        ]
      );
    }
  }

  else if (type === "language") {
    const languages =
      safeArray(
        profile.languages
      ).map(
        (entry) => ({
          ...entry,
        })
      );

    const langName =
      String(
        metadata.language ||
        title
      ).trim();

    const proficiency =
      String(
        metadata.proficiency ||
        "Professional / Fluent"
      ).trim();

    const exists =
      languages.some(
        (entry) =>
          String(
            entry?.language ||
            entry?.name ||
            ""
          )
            .trim()
            .toLowerCase() ===
          langName.toLowerCase()
      );

    if (!exists && langName) {
      languages.push({
        language: langName,

        proficiency,

        source:
          item.source ||
          "linkedin",

        source_url:
          metadata.source_url ||
          "",

        imported_at:
          importedAt,

        approved_by_user:
          true,

        approval_timestamp:
          importedAt,
      });

      await executor.query(
        `
        UPDATE profiles
        SET
          languages = $1,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE user_id = $2
        `,
        [
          JSON.stringify(
            languages
          ),

          userId,
        ]
      );
    }
  }

  else if (
    type === "achievement" ||
    type === "honor"
  ) {
    const achievements =
      safeArray(
        profile.achievements
      ).map((entry) =>
        typeof entry === "string"
          ? entry
          : entry?.title ||
            entry?.name ||
            entry?.description ||
            ""
      );

    const achText =
      String(
        item.description ||
        metadata.description ||
        metadata.achievement ||
        title
      ).trim();

    const exists =
      achievements.some((entry) => {
        const eNorm = String(entry)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        const aNorm = achText
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        return (
          eNorm === aNorm ||
          (eNorm.length > 20 && aNorm.includes(eNorm)) ||
          (aNorm.length > 20 && eNorm.includes(aNorm))
        );
      });

    if (!exists && achText) {
      achievements.push(achText);

      await executor.query(
        `
        UPDATE profiles
        SET
          achievements = $1,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE user_id = $2
        `,
        [
          JSON.stringify(
            achievements
          ),

          userId,
        ]
      );
    }
  }

  else if (type === "bio") {
    const bio =
      String(
        item.description ||
        metadata.bio ||
        item.title ||
        ""
      ).trim();

    if (!bio) {
      throw new Error(
        "Bio content is empty."
      );
    }

    await executor.query(
      `
      UPDATE profiles
      SET
        career_objective = $1,
        updated_at =
          CURRENT_TIMESTAMP
      WHERE user_id = $2
      `,
      [
        bio,
        userId,
      ]
    );
  }

  else {
    throw new Error(
      `Unsupported import type: ${type}`
    );
  }


  const result =
    await executor.query(
      `
      UPDATE external_import_requests
      SET
        status = 'APPROVED',
        updated_at =
          CURRENT_TIMESTAMP
      WHERE id = $1
        AND user_id = $2
        AND status =
          'PENDING'
      RETURNING *
      `,
      [
        item.id,
        userId,
      ]
    );

  if (
    result.rowCount ===
    0
  ) {
    throw new Error(
      "Import request is no longer pending or is unauthorized."
    );
  }

  return result.rows[0];
}


/* ============================================================
   CHAT ROUTES
============================================================ */

async function getChats(req, res) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  try {
    const result =
      await db.query(
        `
        SELECT
          id,
          title,
          created_at,
          updated_at,
          deleted,
          is_deleted
        FROM ai_chats
        WHERE user_id = $1
          AND COALESCE(
            deleted,
            false
          ) = false
          AND COALESCE(
            is_deleted,
            false
          ) = false
        ORDER BY
          COALESCE(
            updated_at,
            created_at
          ) DESC
        `,
        [userId]
      );

    return res.status(200).json({
      chats: result.rows,
    });
  } catch (error) {
    console.error(
      "[AI Controller] getChats:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to load chat history.",

      code:
        "CHAT_LIST_FAILED",
    });
  }
}


async function createChat(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const title =
    typeof req.body?.title ===
      "string" &&
    req.body.title.trim()
      ? req.body.title
          .trim()
          .slice(0, 80)
      : "New conversation";

  try {
    const chat =
      await createChatForUser(
        userId,
        title
      );

    return res.status(201).json({
      chat,
    });
  } catch (error) {
    console.error(
      "[AI Controller] createChat:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to create chat.",

      code:
        "CHAT_CREATE_FAILED",
    });
  }
}


async function getChat(req, res) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const chatId =
    req.params?.chatId;

  if (!chatId) {
    return res.status(400).json({
      message:
        "Chat ID is required.",

      code:
        "CHAT_ID_REQUIRED",
    });
  }

  try {
    const chatResult =
      await db.query(
        `
        SELECT *
        FROM ai_chats
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
        `,
        [
          chatId,
          userId,
        ]
      );

    if (
      chatResult.rowCount ===
      0
    ) {
      return res.status(404).json({
        message:
          "Conversation not found.",

        code:
          "CHAT_NOT_FOUND",
      });
    }

    const messages =
      await db.query(
        `
        SELECT *
        FROM ai_chat_messages
        WHERE chat_id = $1
        ORDER BY
          created_at ASC,
          id ASC
        `,
        [chatId]
      );

    return res.status(200).json({
      chat:
        chatResult.rows[0],

      messages:
        messages.rows,
    });
  } catch (error) {
    console.error(
      "[AI Controller] getChat:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to load conversation.",

      code:
        "CHAT_FETCH_FAILED",
    });
  }
}


async function deleteChat(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const chatId =
    req.params?.chatId;

  try {
    const result =
      await db.query(
        `
        UPDATE ai_chats
        SET
          deleted = true,
          is_deleted = true,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = $1
          AND user_id = $2
        RETURNING *
        `,
        [
          chatId,
          userId,
        ]
      );

    if (
      result.rowCount ===
      0
    ) {
      return res.status(404).json({
        message:
          "Conversation not found.",
      });
    }

    return res.status(200).json({
      message:
        "Conversation deleted successfully.",

      chat:
        result.rows[0],
    });
  } catch (error) {
    console.error(
      "[AI Controller] deleteChat:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to delete conversation.",
    });
  }
}


async function restoreChat(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const chatId =
    req.params?.chatId;

  try {
    const result =
      await db.query(
        `
        UPDATE ai_chats
        SET
          deleted = false,
          is_deleted = false,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = $1
          AND user_id = $2
        RETURNING *
        `,
        [
          chatId,
          userId,
        ]
      );

    if (
      result.rowCount ===
      0
    ) {
      return res.status(404).json({
        message:
          "Conversation not found.",
      });
    }

    return res.status(200).json({
      message:
        "Conversation restored successfully.",

      chat:
        result.rows[0],
    });
  } catch (error) {
    console.error(
      "[AI Controller] restoreChat:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to restore conversation.",
    });
  }
}


async function resetChat(req, res) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const chatId =
    req.params?.chatId;

  if (!chatId) {
    return res.status(400).json({
      success: false,
      message: "Chat ID is required.",
    });
  }

  try {
    const ownsChat =
      await verifyChatOwnership(
        chatId,
        userId
      );

    if (!ownsChat) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or access denied.",
      });
    }

    await db.query(
      `DELETE FROM ai_chat_messages WHERE chat_id = $1`,
      [chatId]
    );

    await db.query(
      `UPDATE ai_chats
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [chatId, userId]
    );

    return res.status(200).json({
      success: true,
      message: "Chat session reset successfully.",
      chatId,
    });
  } catch (error) {
    console.error(
      "[AI Controller] resetChat:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to reset conversation.",
    });
  }
}


async function chat(req, res) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const {
    message: directMessage,
    query: queryMessage,
    text: textMessage,
    history,
    conversation,
    chatId,
    language,
    responseLanguage,
  } = req.body || {};

  const message = (directMessage || queryMessage || textMessage || "").trim();

  if (!message) {
    return res.status(400).json({
      message:
        "Message is required.",

      code:
        "MESSAGE_REQUIRED",
    });
  }

  const cleanMessage =
    message.trim();

  const normalizedHistory =
    normalizeHistory(
      Array.isArray(history)
        ? history
        : conversation
    );

  try {
    const isRecruiter =
      String(
        req.user?.role ||
        ""
      )
        .trim()
        .toLowerCase() ===
      "recruiter";

    const activeChatId =
      await resolveChat(
        userId,
        chatId,
        isRecruiter
          ? "Recruiter Session"
          : "New conversation"
      );

    let result;

    if (isRecruiter) {
      const recruiterOrchestrator =
        require(
          "../services/ai/recruiterOrchestrator"
        );

      const processRecruiterQuery =
        getFunction(
          recruiterOrchestrator,
          [
            "processRecruiterQuery",
            "processQuery",
            "execute",
          ],
          "Recruiter orchestrator"
        );

      result =
        await processRecruiterQuery(
          userId,
          cleanMessage,
          normalizedHistory,
          {
            language: language || "auto",
            responseLanguage: responseLanguage || language || "auto",
            chatId: activeChatId,
            source: req.body?.source || "hirevision-recruiter-ai",
            targetJobId: req.body?.targetJobId || req.body?.jobId || null,
            targetCandidateId: req.body?.targetCandidateId || req.body?.candidateId || null,
          }
        );
    } else {
      const profile =
        await getFullProfile(
          userId
        );

      const processUserQuery =
        getFunction(
          orchestrator,
          [
            "processUserQuery",
            "processQuery",
            "execute",
          ],
          "Candidate orchestrator"
        );

      result =
        await processUserQuery(
          profile,
          cleanMessage,
          {
            history:
              normalizedHistory,

            conversation:
              normalizedHistory,

            language:
              language ||
              "auto",

            responseLanguage:
              responseLanguage ||
              language ||
              "auto",

            userId,

            chatId:
              activeChatId,
          }
        );
    }

    const reply =
      extractAIText(result);

    if (!reply) {
      throw new Error(
        "AI returned an empty response."
      );
    }

    await saveChatMessages(
      activeChatId,
      cleanMessage,
      reply
    );

    await db.query(
      `
      UPDATE ai_chats
      SET
        title =
          CASE
            WHEN title IS NULL
              OR title = ''
              OR title =
                'New conversation'
              OR title =
                'Recruiter Session'
            THEN $1
            ELSE title
          END,

        updated_at =
          CURRENT_TIMESTAMP

      WHERE id = $2
        AND user_id = $3
      `,
      [
        generateChatTitle(
          cleanMessage
        ),

        activeChatId,

        userId,
      ]
    );

    return res.status(200).json({
      reply,

      response:
        reply,

      chatId:
        activeChatId,

      language:
        language ||
        "auto",

      responseLanguage:
        responseLanguage ||
        language ||
        "auto",

      agentRouted:
        result?.agentRouted ||
        result?.agent ||
        result?.agent_name ||
        null,

      intent:
        result?.intent ||
        null,

      confidence:
        result?.confidence ??
        null,

      agents:
        result?.agents ||
        [],

      agentResults:
        result?.agentResults ||
        null,

      routing:
        result?.routing ||
        (result?.agentRouted || result?.intent || result?.workflow
          ? {
              primaryAgent: result?.agentRouted,
              intent: result?.intent,
              workflow: result?.workflow,
              confidence: result?.confidence,
            }
          : null),

      targetJobId:
        result?.targetJobId ||
        null,

      targetCandidateId:
        result?.targetCandidateId ||
        null,

      data:
        result?.data ??
        result?.result ??
        null,

      actions:
        result?.actions ||
        [],

      sources:
        result?.sources ||
        [],

      status:
        result?.status ||
        "completed",
    });
  } catch (error) {
    console.error(
      "[AI Controller] chat:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "AI agent failed to process query.",

      code:
        "AI_CHAT_FAILED",
    });
  }
}


/* ============================================================
   AI ANALYSIS
============================================================ */

async function getAIAnalysis(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  try {
    const [
      readiness,
      profile,
      skills,
      projects,
      career,
    ] =
      await Promise.all([
        db.query(
          `
          SELECT *
          FROM ai_career_readiness
          WHERE user_id = $1
          LIMIT 1
          `,
          [userId]
        ),

        db.query(
          `
          SELECT *
          FROM ai_profile_analysis
          WHERE user_id = $1
          LIMIT 1
          `,
          [userId]
        ),

        db.query(
          `
          SELECT *
          FROM ai_skill_analysis
          WHERE user_id = $1
          ORDER BY
            proficiency_score DESC
          `,
          [userId]
        ),

        db.query(
          `
          SELECT *
          FROM ai_project_analysis
          WHERE user_id = $1
          ORDER BY
            quality_score DESC
          `,
          [userId]
        ),

        db.query(
          `
          SELECT *
          FROM ai_career_recommendation
          WHERE user_id = $1
          ORDER BY
            match_score DESC
          `,
          [userId]
        ),
      ]);

    return res.status(200).json({
      readiness:
        readiness.rows[0] ||
        null,

      profile:
        profile.rows[0] ||
        null,

      skills:
        skills.rows,

      projects:
        projects.rows,

      career:
        career.rows,

      generatedAt:
        readiness.rows[0]
          ?.updated_at ||
        null,
    });
  } catch (error) {
    console.error(
      "[AI Controller] getAIAnalysis:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to retrieve AI analysis.",

      code:
        "AI_ANALYSIS_FETCH_FAILED",
    });
  }
}


async function triggerAIAnalysis(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  try {
    const profile =
      await getFullProfile(
        userId
      );

    const [
      profileRaw,
      skillsRaw,
      projectsRaw,
    ] =
      await Promise.all([
        analyzeProfile(
          profile
        ),

        analyzeSkills(
          profile
        ),

        analyzeProjects(
          profile
        ),
      ]);

    const profileAnalysis =
      unwrapResult(
        profileRaw
      ) || {};

    const skillAnalysis =
      unwrapResult(
        skillsRaw
      ) || [];

    const projectAnalysis =
      unwrapResult(
        projectsRaw
      ) || [];

    const careerRaw =
      await recommendCareers(
        profile,
        skillAnalysis
      );

    const careerAnalysis =
      unwrapResult(
        careerRaw
      ) || [];

    const readinessRaw =
      await calculateReadiness(
        profile,
        profileAnalysis,
        skillAnalysis,
        projectAnalysis,
        careerAnalysis
      );

    const readinessAnalysis =
      unwrapResult(
        readinessRaw
      ) || {};

    const client =
      await db.pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      await client.query(
        `
        INSERT INTO ai_profile_analysis
        (
          user_id,
          profile_score,
          strengths,
          weaknesses,
          improvements,
          updated_at
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          CURRENT_TIMESTAMP
        )

        ON CONFLICT (user_id)

        DO UPDATE SET
          profile_score =
            EXCLUDED.profile_score,

          strengths =
            EXCLUDED.strengths,

          weaknesses =
            EXCLUDED.weaknesses,

          improvements =
            EXCLUDED.improvements,

          updated_at =
            CURRENT_TIMESTAMP
        `,
        [
          userId,

          profileAnalysis
            ?.profile_score ??
          profileAnalysis
            ?.profileScore ??
          profileAnalysis
            ?.score ??
          0,

          json(
            profileAnalysis
              ?.strengths
          ),

          json(
            profileAnalysis
              ?.weaknesses
          ),

          json(
            profileAnalysis
              ?.improvements
          ),
        ]
      );

      await client.query(
        `
        DELETE FROM ai_skill_analysis
        WHERE user_id = $1
        `,
        [userId]
      );

      for (
        const skill
        of safeArray(
          skillAnalysis
        )
      ) {
        const name =
          String(
            skill?.skill_name ||
            skill?.skillName ||
            skill?.name ||
            skill?.skill ||
            ""
          ).trim();

        if (!name) {
          continue;
        }

        await client.query(
          `
          INSERT INTO ai_skill_analysis
          (
            user_id,
            skill_name,
            proficiency_score,
            level,
            evidence
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5
          )
          `,
          [
            userId,

            name,

            skill
              ?.proficiency_score ??
            skill
              ?.proficiencyScore ??
            skill?.score ??
            0,

            skill?.level ||
            "Unknown",

            json(
              skill?.evidence
            ),
          ]
        );
      }

      await client.query(
        `
        DELETE FROM ai_project_analysis
        WHERE user_id = $1
        `,
        [userId]
      );

      for (
        const project
        of safeArray(
          projectAnalysis
        )
      ) {
        const title =
          String(
            project
              ?.project_title ||
            project
              ?.projectTitle ||
            project?.title ||
            project?.name ||
            ""
          ).trim();

        if (!title) {
          continue;
        }

        await client.query(
          `
          INSERT INTO ai_project_analysis
          (
            user_id,
            project_title,
            quality_score,
            technical_depth,
            career_relevance,
            description_quality,
            suggestions
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
          )
          `,
          [
            userId,

            title,

            project
              ?.quality_score ??
            project
              ?.qualityScore ??
            0,

            project
              ?.technical_depth ??
            project
              ?.technicalDepth ??
            0,

            project
              ?.career_relevance ??
            project
              ?.careerRelevance ??
            0,

            project
              ?.description_quality ??
            project
              ?.descriptionQuality ??
            0,

            json(
              project?.suggestions
            ),
          ]
        );
      }

      await client.query(
        `
        DELETE FROM ai_career_recommendation
        WHERE user_id = $1
        `,
        [userId]
      );

      for (
        const recommendation
        of safeArray(
          careerAnalysis
        )
      ) {
        const roleName =
          String(
            recommendation
              ?.role_name ||
            recommendation
              ?.roleName ||
            recommendation?.role ||
            recommendation?.title ||
            ""
          ).trim();

        if (!roleName) {
          continue;
        }

        await client.query(
          `
          INSERT INTO ai_career_recommendation
          (
            user_id,
            role_name,
            match_score,
            explanation
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4
          )
          `,
          [
            userId,

            roleName,

            recommendation
              ?.match_score ??
            recommendation
              ?.matchScore ??
            recommendation?.score ??
            0,

            recommendation
              ?.explanation ||
            "",
          ]
        );
      }

      await client.query(
        `
        INSERT INTO ai_career_readiness
        (
          user_id,
          readiness_score,
          profile_quality,
          skill_strength,
          project_strength,
          resume_quality,
          career_fit,
          strengths,
          weaknesses,
          top_improvements,
          next_actions,
          updated_at
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          CURRENT_TIMESTAMP
        )

        ON CONFLICT (user_id)

        DO UPDATE SET
          readiness_score =
            EXCLUDED.readiness_score,

          profile_quality =
            EXCLUDED.profile_quality,

          skill_strength =
            EXCLUDED.skill_strength,

          project_strength =
            EXCLUDED.project_strength,

          resume_quality =
            EXCLUDED.resume_quality,

          career_fit =
            EXCLUDED.career_fit,

          strengths =
            EXCLUDED.strengths,

          weaknesses =
            EXCLUDED.weaknesses,

          top_improvements =
            EXCLUDED.top_improvements,

          next_actions =
            EXCLUDED.next_actions,

          updated_at =
            CURRENT_TIMESTAMP
        `,
        [
          userId,

          readinessAnalysis
            ?.readiness_score ??
          readinessAnalysis
            ?.readinessScore ??
          readinessAnalysis?.score ??
          0,

          readinessAnalysis
            ?.profile_quality ??
          readinessAnalysis
            ?.profileQuality ??
          readinessAnalysis
            ?.breakdown?.profile ??
          0,

          readinessAnalysis
            ?.skill_strength ??
          readinessAnalysis
            ?.skillStrength ??
          readinessAnalysis
            ?.breakdown?.skills ??
          0,

          readinessAnalysis
            ?.project_strength ??
          readinessAnalysis
            ?.projectStrength ??
          readinessAnalysis
            ?.breakdown?.projects ??
          0,

          readinessAnalysis
            ?.resume_quality ??
          readinessAnalysis
            ?.resumeQuality ??
          0,

          readinessAnalysis
            ?.career_fit ??
          readinessAnalysis
            ?.careerFit ??
          0,

          json(
            readinessAnalysis
              ?.strengths
          ),

          json(
            readinessAnalysis
              ?.weaknesses
          ),

          json(
            readinessAnalysis
              ?.top_improvements ??
            readinessAnalysis
              ?.topImprovements
          ),

          json(
            readinessAnalysis
              ?.next_actions ??
            readinessAnalysis
              ?.nextActions
          ),
        ]
      );

      await client.query(
        "COMMIT"
      );
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}

      throw error;
    } finally {
      client.release();
    }

    const [
      readiness,
      profileResult,
      skillsResult,
      projectsResult,
      careerResult,
    ] =
      await Promise.all([
        db.query(
          `
          SELECT *
          FROM ai_career_readiness
          WHERE user_id = $1
          LIMIT 1
          `,
          [userId]
        ),

        db.query(
          `
          SELECT *
          FROM ai_profile_analysis
          WHERE user_id = $1
          LIMIT 1
          `,
          [userId]
        ),

        db.query(
          `
          SELECT *
          FROM ai_skill_analysis
          WHERE user_id = $1
          ORDER BY
            proficiency_score DESC
          `,
          [userId]
        ),

        db.query(
          `
          SELECT *
          FROM ai_project_analysis
          WHERE user_id = $1
          ORDER BY
            quality_score DESC
          `,
          [userId]
        ),

        db.query(
          `
          SELECT *
          FROM ai_career_recommendation
          WHERE user_id = $1
          ORDER BY
            match_score DESC
          `,
          [userId]
        ),
      ]);

    return res.status(200).json({
      success: true,

      message:
        "AI profile analysis completed successfully.",

      readiness:
        readiness.rows[0] ||
        null,

      profile:
        profileResult.rows[0] ||
        null,

      skills:
        skillsResult.rows,

      projects:
        projectsResult.rows,

      career:
        careerResult.rows,
    });
  } catch (error) {
    console.error(
      "[AI Controller] triggerAIAnalysis:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Unable to generate AI analysis.",

      code:
        "AI_ANALYSIS_TRIGGER_FAILED",
    });
  }
}


async function getSkillGaps(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  try {
    const profile =
      await getFullProfile(
        userId
      );

    const targetRole =
      typeof req.query
        ?.targetRole ===
        "string"
        ? req.query
            .targetRole
            .trim()
        : "";

    const result =
      await analyzeSkillGaps(
        profile,
        targetRole ||
        undefined
      );

    return res.status(200).json(
      result
    );
  } catch (error) {
    console.error(
      "[AI Controller] getSkillGaps:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Unable to analyze skill gaps.",

      code:
        "SKILL_GAP_ANALYSIS_FAILED",
    });
  }
}


/* ============================================================
   GITHUB
============================================================ */

async function scanGithub(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const githubUrl =
    String(
      req.body?.githubUrl ||
      ""
    ).trim();

  if (!githubUrl) {
    return res.status(400).json({
      message:
        "GitHub URL is required.",

      code:
        "GITHUB_URL_REQUIRED",
    });
  }

  try {
    const analyzeGithub =
      getFunction(
        githubAgent,
        [
          "analyzeGithub",
          "analyzeGitHub",
          "scanGithub",
        ],
        "GitHub agent"
      );

    const scan =
      await analyzeGithub(
        userId,
        githubUrl
      );

    const items =
      normalizeScanItems(
        scan
      );

    return res.status(200).json({
      success:
        scan?.success !== false,

      message:
        scan?.message ||
        "GitHub scan completed.",

      source:
        scan?.source ||
        "github",

      profile:
        scan?.profile ||
        null,

      repositories:
        scan?.repositories ||
        scan?.repos ||
        [],

      counts:
        scan?.counts ||
        {},

      metadata:
        scan?.metadata ||
        {},

      items,

      pendingImports:
        items,

      pending_items:
        items,

      pending_imports:
        items,
    });
  } catch (error) {
    console.error(
      "[AI Controller] scanGithub:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Failed to scan GitHub profile.",

      code:
        "GITHUB_SCAN_FAILED",
    });
  }
}


/* ============================================================
   LINKEDIN
============================================================ */

async function getLinkedinAuthorization(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const linkedinUrl =
    String(
      req.body?.linkedinUrl ||
      req.query?.linkedinUrl ||
      ""
    ).trim();

  if (!linkedinUrl) {
    return res.status(400).json({
      success: false,

      message:
        "LinkedIn URL is required.",

      code:
        "LINKEDIN_URL_REQUIRED",
    });
  }

  try {
    const result =
      buildLinkedinAuthorizationUrl(
        userId,
        linkedinUrl
      );

    return res.status(200).json({
      success: true,

      authorizationUrl:
        result.authorizationUrl,

      linkedinUrl:
        result.normalizedUrl ||
        normalizeLinkedinProfileUrl(
          linkedinUrl
        ).url,
    });
  } catch (error) {
    console.error(
      "[AI Controller] LinkedIn authorization:",
      error
    );

    return res
      .status(
        error.code ===
          "LINKEDIN_NOT_CONFIGURED"
          ? 503
          : 400
      )
      .json({
        success: false,

        message:
          error.message,

        code:
          error.code ||
          "LINKEDIN_AUTHORIZATION_START_FAILED",
      });
  }
}


async function linkedinOAuthCallback(
  req,
  res
) {
  const {
    code,
    state,
    error,
    error_description:
      errorDescription,
  } = req.query || {};

  if (error) {
    return res.redirect(
      buildLinkedinFrontendRedirect({
        linkedin:
          "error",

        linkedin_error:
          errorDescription ||
          error,
      })
    );
  }

  if (
    !code ||
    !state
  ) {
    return res.redirect(
      buildLinkedinFrontendRedirect({
        linkedin:
          "error",

        linkedin_error:
          "LinkedIn authorization response was incomplete.",
      })
    );
  }

  try {
    const stateData =
      verifyLinkedinStatePayload(
        state
      );

    const userId =
      stateData.userId;

    if (!userId) {
      throw new Error(
        "LinkedIn OAuth state does not contain a valid user."
      );
    }

    const normalized =
      normalizeLinkedinProfileUrl(
        stateData.linkedinUrl
      );

    const tokenData =
      await exchangeLinkedinAuthorizationCode(
        code
      );

    const profileData =
      await fetchAuthorizedLinkedInProfile(
        tokenData.access_token,
        normalized.url
      );

    await saveLinkedinConnection({
      userId,

      linkedinUrl:
        normalized.url,

      tokenData,

      profileData,
    });

    await updateProfileLinkedinUrl(
      userId,
      normalized.url
    );

    const analyzeLinkedin =
      getFunction(
        linkedinAgent,
        [
          "analyzeLinkedin",
          "analyzeLinkedIn",
        ],
        "LinkedIn agent"
      );

    const scan =
      await analyzeLinkedin(
        userId,
        normalized.url,
        profileData
      );

    const items =
      normalizeScanItems(scan);

    return res.redirect(
      buildLinkedinFrontendRedirect({
        linkedin:
          "connected",

        linkedin_imports:
          items.length,
      })
    );
  } catch (error) {
    console.error(
      "[AI Controller] LinkedIn OAuth callback:",
      error
    );

    return res.redirect(
      buildLinkedinFrontendRedirect({
        linkedin:
          "error",

        linkedin_error:
          error.message ||
          "LinkedIn authorization failed.",
      })
    );
  }
}


async function getLinkedinConnectionStatus(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  try {
    const connection =
      await getLinkedinConnection(
        userId
      );

    const config =
      getLinkedinConfig();

    return res.status(200).json({
      success: true,

      configured:
        Boolean(
          config?.configured
        ),

      connected:
        Boolean(
          connection &&
          !linkedinConnectionExpired(
            connection
          )
        ),

      profileUrl:
        connection?.profile_url ||
        null,

      memberId:
        connection
          ?.linkedin_member_id ||
        null,

      expiresAt:
        connection?.expires_at ||
        null,

      lastSyncedAt:
        connection
          ?.last_synced_at ||
        null,
    });
  } catch (error) {
    console.error(
      "[AI Controller] LinkedIn status:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Unable to read LinkedIn connection status.",

      code:
        "LINKEDIN_STATUS_FAILED",
    });
  }
}


async function disconnectLinkedin(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  try {
    await db.query(
      `
      DELETE FROM linkedin_connections
      WHERE user_id = $1
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,

      message:
        "LinkedIn connection removed from HireVision.",
    });
  } catch (error) {
    console.error(
      "[AI Controller] disconnectLinkedin:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Unable to disconnect LinkedIn.",

      code:
        "LINKEDIN_DISCONNECT_FAILED",
    });
  }
}


async function scanLinkedin(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const linkedinUrl =
    String(
      req.body?.linkedinUrl ||
      ""
    ).trim();

  if (!linkedinUrl) {
    return res.status(400).json({
      message:
        "LinkedIn URL is required.",

      code:
        "LINKEDIN_URL_REQUIRED",
    });
  }

  try {
    const normalized =
      normalizeLinkedinProfileUrl(
        linkedinUrl
      );

    let linkedinData =
      req.body?.linkedinData ||
      req.body
        ?.linkedinProfileData ||
      req.body
        ?.rawLinkedInData ||
      null;

    if (!linkedinData) {
      const connection =
        await getLinkedinConnection(
          userId
        );

      if (
        !connection ||
        linkedinConnectionExpired(
          connection
        )
      ) {
        const auth =
          buildLinkedinAuthorizationUrl(
            userId,
            normalized.url
          );

        return res.status(409).json({
          success: false,

          status:
            "authorization_required",

          message:
            "LinkedIn authorization is required before profile data can be read.",

          code:
            "LINKEDIN_AUTHORIZATION_REQUIRED",

          authorizationUrl:
            auth.authorizationUrl,
        });
      }

      if (
        connection.profile_url
      ) {
        const stored =
          normalizeLinkedinProfileUrl(
            connection.profile_url
          );

        if (
          stored.profileSlug
            .toLowerCase() !==
          normalized.profileSlug
            .toLowerCase()
        ) {
          const auth =
            buildLinkedinAuthorizationUrl(
              userId,
              normalized.url
            );

          return res.status(409).json({
            success: false,

            status:
              "authorization_required",

            message:
              "The entered LinkedIn URL does not match the currently connected LinkedIn profile.",

            code:
              "LINKEDIN_PROFILE_REAUTHORIZATION_REQUIRED",

            authorizationUrl:
              auth.authorizationUrl,
          });
        }
      }

      try {
        const token =
          decryptLinkedinToken(
            connection
              .access_token_encrypted
          );

        linkedinData =
          await fetchAuthorizedLinkedInProfile(
            token,
            normalized.url
          );

        await updateLinkedinConnectionProfile(
          userId,
          normalized.url,
          linkedinData
        );
      } catch (error) {
        if (
          error?.status === 401 ||
          error?.status === 403
        ) {
          const auth =
            buildLinkedinAuthorizationUrl(
              userId,
              normalized.url
            );

          return res.status(409).json({
            success: false,

            status:
              "authorization_required",

            message:
              "LinkedIn authorization has expired. Please authorize again.",

            code:
              "LINKEDIN_REAUTHORIZATION_REQUIRED",

            authorizationUrl:
              auth.authorizationUrl,
          });
        }

        throw error;
      }
    }

    await updateProfileLinkedinUrl(
      userId,
      normalized.url
    );

    const analyzeLinkedin =
      getFunction(
        linkedinAgent,
        [
          "analyzeLinkedin",
          "analyzeLinkedIn",
        ],
        "LinkedIn agent"
      );

    const scan =
      await analyzeLinkedin(
        userId,
        normalized.url,
        linkedinData
      );

    const items =
      normalizeScanItems(scan);

    const status =
      scan?.status ||
      (items.length > 0
        ? "pending_approval"
        : (scan?.data_available === false
            ? "limited_access"
            : "no_new_data"));

    return res.status(200).json({
      success:
        scan?.success !== false,

      status,

      message:
        scan?.message ||
        "LinkedIn scan completed.",

      source:
        scan?.source ||
        "linkedin",

      profile:
        scan?.profile ||
        null,

      extracted:
        scan?.extracted ||
        null,

      counts:
        scan?.counts ||
        {},

      dataAvailable:
        scan?.data_available !==
        false,

      data_available:
        scan?.data_available !==
        false,

      newItemsCount:
        items.length,

      new_items_count:
        items.length,

      items,

      pendingImports:
        items,

      pending_items:
        items,

      pending_imports:
        items,

      metadata:
        scan?.metadata ||
        {},
    });
  } catch (error) {
    console.error(
      "[AI Controller] scanLinkedin:",
      error
    );

    return res
      .status(
        error.code ===
          "LINKEDIN_NOT_CONFIGURED"
          ? 503
          : error.code ===
              "LINKEDIN_PROFILE_MISMATCH"
            ? 409
            : 500
      )
      .json({
        success: false,

        message:
          error.message ||
          "Failed to scan LinkedIn profile.",

        code:
          error.code ||
          "LINKEDIN_SCAN_FAILED",
      });
  }
}


async function importLinkedinArchive(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const uploadFiles =
    Array.isArray(req.files) && req.files.length > 0
      ? req.files
      : req.file
      ? [req.file]
      : [];

  if (uploadFiles.length === 0) {
    return res.status(400).json({
      success: false,
      message:
        "Please upload a LinkedIn data export archive (.zip) or CSV file(s) (e.g., Positions.csv, Skills.csv).",
      code: "LINKEDIN_ARCHIVE_FILE_REQUIRED",
    });
  }

  try {
    const parseArchive =
      getFunction(
        linkedinClient,
        [
          "parseLinkedInArchive",
          "parseArchive",
        ],
        "LinkedIn client archive parser"
      );

    const parsedResult =
      parseArchive(
        uploadFiles.length === 1 ? uploadFiles[0].buffer : uploadFiles,
        uploadFiles.length === 1 ? uploadFiles[0].originalname : "linkedin_export"
      );

    const archiveData =
      parsedResult?.data ||
      (parsedResult?.extraction_available ? parsedResult : null);

    if (
      !parsedResult ||
      (!parsedResult.success && !parsedResult.extraction_available) ||
      !archiveData
    ) {
      return res.status(400).json({
        success: false,
        message:
          parsedResult?.message ||
          "Unable to read LinkedIn archive file. Please ensure it is a valid ZIP archive or CSV export containing career data (e.g. Positions.csv, Skills.csv).",
        code: "LINKEDIN_ARCHIVE_PARSE_FAILED",
      });
    }

    let profileUrl = String(
      req.body?.linkedinUrl || ""
    ).trim();

    if (!profileUrl) {
      try {
        const profile =
          await getFullProfile(userId);
        profileUrl =
          profile?.social_profiles?.linkedin || "";
      } catch {}
    }

    const analyzeLinkedin =
      getFunction(
        linkedinAgent,
        [
          "analyzeLinkedin",
          "analyzeLinkedIn",
        ],
        "LinkedIn agent"
      );

    const scan =
      await analyzeLinkedin(
        userId,
        profileUrl ||
          "https://www.linkedin.com/in/me",
        archiveData
      );

    const items =
      normalizeScanItems(scan);

    const status =
      scan?.status ||
      (items.length > 0
        ? "pending_approval"
        : "no_new_data");

    return res.status(200).json({
      success: true,

      status,

      message:
        scan?.message ||
        `Found ${items.length} new profile item(s) from LinkedIn archive pending your approval.`,

      source:
        "linkedin_archive",

      extracted:
        scan?.extracted ||
        parsedResult.data,

      counts:
        scan?.counts ||
        {},

      dataAvailable: true,

      data_available: true,

      newItemsCount:
        items.length,

      new_items_count:
        items.length,

      items,

      pendingImports:
        items,

      pending_items:
        items,

      pending_imports:
        items,

      metadata:
        scan?.metadata ||
        {},
    });
  } catch (error) {
    console.error(
      "[AI Controller] importLinkedinArchive:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to process LinkedIn archive import.",
      code: "LINKEDIN_ARCHIVE_IMPORT_FAILED",
    });
  }
}


/* ============================================================
   IMPORT APPROVAL
============================================================ */

async function getPendingImports(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  try {
    const result =
      await db.query(
        `
        SELECT *
        FROM external_import_requests
        WHERE user_id = $1
          AND status =
            'PENDING'
        ORDER BY
          created_at DESC
        `,
        [userId]
      );

    return res.status(200).json({
      items:
        result.rows,

      pendingImports:
        result.rows,

      pending_items:
        result.rows,

      pending_imports:
        result.rows,

      count:
        result.rowCount,
    });
  } catch (error) {
    console.error(
      "[AI Controller] getPendingImports:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to retrieve pending imports.",

      code:
        "IMPORTS_FETCH_FAILED",
    });
  }
}


async function approveImport(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const importId =
    req.body?.importId;

  if (!importId) {
    return res.status(400).json({
      message:
        "Import ID is required.",

      code:
        "IMPORT_ID_REQUIRED",
    });
  }

  const client =
    await db.pool.connect();

  try {
    await client.query(
      "BEGIN"
    );

    const result =
      await client.query(
        `
        SELECT *
        FROM external_import_requests
        WHERE id = $1
          AND user_id = $2
          AND status =
            'PENDING'
        LIMIT 1
        `,
        [
          importId,
          userId,
        ]
      );

    if (
      result.rowCount === 0
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(404).json({
        message:
          "Import request not found, already processed, or unauthorized.",

        code:
          "IMPORT_NOT_FOUND",
      });
    }

    const approved =
      await applyApprovedItemToProfile(
        result.rows[0],
        userId,
        client
      );

    await client.query(
      "COMMIT"
    );

    const profile =
      await getFullProfile(
        userId
      );

    return res.status(200).json({
      success: true,

      message:
        "Import approved and added to profile.",

      item:
        approved,

      profile,
    });
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    console.error(
      "[AI Controller] approveImport:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Unable to approve import.",

      code:
        "IMPORT_APPROVAL_FAILED",
    });
  } finally {
    client.release();
  }
}


async function rejectImport(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const importId =
    req.body?.importId;

  if (!importId) {
    return res.status(400).json({
      message:
        "Import ID is required.",

      code:
        "IMPORT_ID_REQUIRED",
    });
  }

  try {
    const result =
      await db.query(
        `
        UPDATE external_import_requests
        SET
          status =
            'REJECTED',

          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = $1
          AND user_id = $2
          AND status =
            'PENDING'

        RETURNING *
        `,
        [
          importId,
          userId,
        ]
      );

    if (
      result.rowCount === 0
    ) {
      return res.status(404).json({
        message:
          "Import request not found, already processed, or unauthorized.",

        code:
          "IMPORT_NOT_FOUND",
      });
    }

    return res.status(200).json({
      success: true,

      message:
        "Import rejected.",

      item:
        result.rows[0],
    });
  } catch (error) {
    console.error(
      "[AI Controller] rejectImport:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Unable to reject import.",

      code:
        "IMPORT_REJECTION_FAILED",
    });
  }
}


async function batchApproveImports(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const ids =
    Array.isArray(
      req.body?.importIds
    )
      ? req.body
          .importIds
          .filter(Boolean)
      : [];

  if (ids.length === 0) {
    return res.status(400).json({
      message:
        "Import IDs are required.",

      code:
        "IMPORT_IDS_REQUIRED",
    });
  }

  const client =
    await db.pool.connect();

  try {
    await client.query(
      "BEGIN"
    );

    const result =
      await client.query(
        `
        SELECT *
        FROM external_import_requests
        WHERE id = ANY($1)
          AND user_id = $2
          AND status =
            'PENDING'
        ORDER BY
          created_at ASC
        `,
        [
          ids,
          userId,
        ]
      );

    const approved = [];

    for (
      const item
      of result.rows
    ) {
      approved.push(
        await applyApprovedItemToProfile(
          item,
          userId,
          client
        )
      );
    }

    await client.query(
      "COMMIT"
    );

    return res.status(200).json({
      success: true,

      count:
        approved.length,

      items:
        approved,
    });
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    console.error(
      "[AI Controller] batchApproveImports:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Unable to approve imports.",

      code:
        "BATCH_IMPORT_APPROVAL_FAILED",
    });
  } finally {
    client.release();
  }
}


async function batchRejectImports(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const ids =
    Array.isArray(
      req.body?.importIds
    )
      ? req.body
          .importIds
          .filter(Boolean)
      : [];

  if (ids.length === 0) {
    return res.status(400).json({
      message:
        "Import IDs are required.",

      code:
        "IMPORT_IDS_REQUIRED",
    });
  }

  try {
    const result =
      await db.query(
        `
        UPDATE external_import_requests
        SET
          status =
            'REJECTED',

          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = ANY($1)
          AND user_id = $2
          AND status =
            'PENDING'

        RETURNING *
        `,
        [
          ids,
          userId,
        ]
      );

    return res.status(200).json({
      success: true,

      count:
        result.rowCount,

      items:
        result.rows,
    });
  } catch (error) {
    console.error(
      "[AI Controller] batchRejectImports:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Unable to reject imports.",

      code:
        "BATCH_IMPORT_REJECTION_FAILED",
    });
  }
}


/* ============================================================
   RESUME
============================================================ */

async function getResumeSuggestions(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  try {
    const profile =
      await getFullProfile(
        userId
      );

    const result =
      await generateResumeSuggestions(
        profile
      );

    return res.status(200).json(
      result
    );
  } catch (error) {
    console.error(
      "[AI Controller] getResumeSuggestions:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Unable to generate resume suggestions.",

      code:
        "RESUME_SUGGESTIONS_FAILED",
    });
  }
}


async function applyResumeSuggestion(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  const {
    type,
    payload,
  } = req.body || {};

  if (!type) {
    return res.status(400).json({
      message:
        "Suggestion type is required.",
    });
  }

  try {
    const profile =
      await getFullProfile(
        userId
      );

    const normalizedType =
      String(type)
        .trim()
        .toLowerCase();

    if (
      normalizedType ===
      "about_me"
    ) {
      const value =
        typeof payload ===
          "string"
          ? payload.trim()
          : String(
              payload?.value ||
              payload?.text ||
              ""
            ).trim();

      if (!value) {
        return res.status(400).json({
          message:
            "About Me text is required.",
        });
      }

      await db.query(
        `
        UPDATE profiles
        SET
          career_objective = $1,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE user_id = $2
        `,
        [
          value,
          userId,
        ]
      );
    }

    else if (
      normalizedType ===
      "project"
    ) {
      const title =
        String(
          payload?.title ||
          ""
        ).trim();

      const description =
        String(
          payload
            ?.improved_description ||
          payload
            ?.improvedDescription ||
          ""
        ).trim();

      if (
        !title ||
        !description
      ) {
        return res.status(400).json({
          message:
            "Project title and improved description are required.",
        });
      }

      const projects =
        safeArray(
          profile.projects
        ).map(
          (project) => ({
            ...project,
          })
        );

      const index =
        projects.findIndex(
          (project) =>
            String(
              project?.title ||
              project?.name ||
              ""
            )
              .trim()
              .toLowerCase() ===
            title.toLowerCase()
        );

      if (index === -1) {
        return res.status(404).json({
          message:
            "Project not found in profile.",

          code:
            "PROJECT_NOT_FOUND",
        });
      }

      projects[index] = {
        ...projects[index],
        description,
      };

      await db.query(
        `
        UPDATE profiles
        SET
          projects = $1,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE user_id = $2
        `,
        [
          JSON.stringify(
            projects
          ),

          userId,
        ]
      );
    }

    else if (
      normalizedType ===
      "experience"
    ) {
      const company =
        String(
          payload?.company ||
          ""
        ).trim();

      const role =
        String(
          payload?.role ||
          ""
        ).trim();

      const description =
        String(
          payload
            ?.improved_description ||
          payload
            ?.improvedDescription ||
          ""
        ).trim();

      if (
        !company ||
        !role ||
        !description
      ) {
        return res.status(400).json({
          message:
            "Company, role and improved description are required.",
        });
      }

      const experience =
        safeArray(
          profile.experience
        ).map(
          (item) => ({
            ...item,
          })
        );

      const index =
        experience.findIndex(
          (item) =>
            String(
              item?.company ||
              ""
            )
              .trim()
              .toLowerCase() ===
              company.toLowerCase() &&

            String(
              item?.role ||
              ""
            )
              .trim()
              .toLowerCase() ===
              role.toLowerCase()
        );

      if (index === -1) {
        return res.status(404).json({
          message:
            "Experience entry not found.",

          code:
            "EXPERIENCE_NOT_FOUND",
        });
      }

      experience[index] = {
        ...experience[index],
        description,
      };

      await db.query(
        `
        UPDATE profiles
        SET
          experience = $1,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE user_id = $2
        `,
        [
          JSON.stringify(
            experience
          ),

          userId,
        ]
      );
    }

    else {
      return res.status(400).json({
        message:
          `Unsupported suggestion type: ${type}`,

        code:
          "UNSUPPORTED_SUGGESTION_TYPE",
      });
    }

    return res.status(200).json({
      success: true,

      message:
        "Resume suggestion applied successfully.",

      profile:
        await getFullProfile(
          userId
        ),
    });
  } catch (error) {
    console.error(
      "[AI Controller] applyResumeSuggestion:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Unable to apply resume suggestion.",

      code:
        "RESUME_SUGGESTION_APPLY_FAILED",
    });
  }
}


/* ============================================================
   LIVE RESUME
============================================================ */

async function getLiveResume(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  try {
    const result =
      await db.query(
        `
        SELECT *
        FROM live_resumes
        WHERE user_id = $1
        LIMIT 1
        `,
        [userId]
      );

    if (
      result.rowCount >
      0
    ) {
      return res.status(200).json(
        result.rows[0]
      );
    }

    const profile =
      await getFullProfile(
        userId
      );

    const generateAndStore =
      getFunction(
        liveResumeAgent,
        [
          "generateAndStore",
          "generateLiveResume",
          "execute",
        ],
        "Live Resume agent"
      );

    const generated =
      await generateAndStore(
        userId,
        profile
      );

    return res.status(200).json(
      generated?.result ||
      generated
    );
  } catch (error) {
    console.error(
      "[AI Controller] getLiveResume:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Unable to load Live Resume.",

      code:
        "LIVE_RESUME_FETCH_FAILED",
    });
  }
}


async function generateLiveResume(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  try {
    const profile =
      await getFullProfile(
        userId
      );

    const generateAndStore =
      getFunction(
        liveResumeAgent,
        [
          "generateAndStore",
          "generateLiveResume",
          "execute",
        ],
        "Live Resume agent"
      );

    const generated =
      await generateAndStore(
        userId,
        profile
      );

    return res.status(200).json(
      generated?.result ||
      generated
    );
  } catch (error) {
    console.error(
      "[AI Controller] generateLiveResume:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Unable to generate Live Resume.",

      code:
        "LIVE_RESUME_GENERATION_FAILED",
    });
  }
}


/* ============================================================
   AGENT VERIFICATION
============================================================ */

async function verifyAllAgents(
  req,
  res
) {
  const userId =
    requireUserId(
      req,
      res
    );

  if (!userId) {
    return;
  }

  try {
    const profile =
      await getFullProfile(
        userId
      );

    const tests = {
      profileAgent:
        () =>
          analyzeProfile(
            profile
          ),

      skillAgent:
        () =>
          analyzeSkills(
            profile
          ),

      projectAgent:
        () =>
          analyzeProjects(
            profile
          ),

      careerAgent:
        () =>
          recommendCareers(
            profile
          ),

      readinessAgent:
        () =>
          calculateReadiness(
            profile
          ),

      skillGapAgent:
        () =>
          analyzeSkillGaps(
            profile,
            "Full Stack Developer"
          ),

      resumeAgent:
        () =>
          generateResumeSuggestions(
            profile
          ),
    };

    const agents = {};

    for (
      const [
        name,
        execute,
      ]
      of Object.entries(tests)
    ) {
      try {
        await execute();

        agents[name] = {
          status: "ok",
        };
      } catch (error) {
        agents[name] = {
          status: "error",
          error:
            error.message,
        };
      }
    }

    return res.status(200).json({
      success: true,

      candidateId:
        userId,

      agents,

      timestamp:
        new Date()
          .toISOString(),
    });
  } catch (error) {
    console.error(
      "[AI Controller] verifyAllAgents:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Agent verification failed.",
    });
  }
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  getChats,
  createChat,
  getChat,
  deleteChat,
  restoreChat,
  resetChat,
  chat,

  getAIAnalysis,
  triggerAIAnalysis,
  getSkillGaps,

  scanGithub,

  getLinkedinAuthorization,
  linkedinOAuthCallback,
  getLinkedinConnectionStatus,
  disconnectLinkedin,
  scanLinkedin,
  importLinkedinArchive,

  getPendingImports,
  approveImport,
  rejectImport,
  batchApproveImports,
  batchRejectImports,

  getResumeSuggestions,
  applyResumeSuggestion,

  getLiveResume,
  generateLiveResume,

  verifyAllAgents,
};