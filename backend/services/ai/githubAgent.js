const db = require("../../config/db");

const {
  callLLM,
} = require("./openaiService");

const {
  githubGet,
} = require(
  "../../integrations/github/github_client"
);

const {
  normalizeAgentResponse,
} = require(
  "./agentResponseSchema"
);

function createSafeId(value) {
  return String(
    value || "item"
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    )
    .slice(0, 80);
}

function cleanText(value) {
  return String(
    value || ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function getNormalizedSkillList(
  skills
) {
  if (!skills) {
    return [];
  }

  if (
    Array.isArray(skills)
  ) {
    return skills
      .map((skill) => {
        if (
          typeof skill ===
          "string"
        ) {
          return cleanText(
            skill
          ).toLowerCase();
        }

        return cleanText(
          skill?.name ||
          skill?.skill ||
          skill?.title
        ).toLowerCase();
      })
      .filter(Boolean);
  }

  if (
    typeof skills ===
    "object"
  ) {
    return Object
      .values(skills)
      .flat(Infinity)
      .map((skill) => {
        if (
          typeof skill ===
          "string"
        ) {
          return cleanText(
            skill
          ).toLowerCase();
        }

        return cleanText(
          skill?.name ||
          skill?.skill ||
          skill?.title
        ).toLowerCase();
      })
      .filter(Boolean);
  }

  return [];
}

function extractGithubUsername(
  githubUrl
) {
  const input =
    cleanText(
      githubUrl
    );

  if (!input) {
    throw new Error(
      "GitHub profile URL is required."
    );
  }

  let normalized =
    input;

  if (
    !/^https?:\/\//i.test(
      normalized
    )
  ) {
    normalized =
      `https://${normalized}`;
  }

  let parsedUrl;

  try {
    parsedUrl =
      new URL(
        normalized
      );
  } catch {
    throw new Error(
      "Please provide a valid public GitHub profile URL."
    );
  }

  const hostname =
    parsedUrl.hostname
      .toLowerCase();

  if (
    hostname !==
      "github.com" &&
    hostname !==
      "www.github.com"
  ) {
    throw new Error(
      "Please provide a valid GitHub profile URL."
    );
  }

  const parts =
    parsedUrl.pathname
      .split("/")
      .map(
        (part) =>
          part.trim()
      )
      .filter(Boolean);

  if (!parts[0]) {
    throw new Error(
      "A GitHub username is required in the profile URL."
    );
  }

  const username =
    parts[0];

  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(
      username
    )
  ) {
    throw new Error(
      "The GitHub username in the provided URL is invalid."
    );
  }

  return {
    username,
    url:
      `https://github.com/${username}`,
  };
}

function normalizeRepository(
  repo
) {
  return {
    id:
      repo?.id || null,

    name:
      cleanText(
        repo?.name
      ),

    full_name:
      cleanText(
        repo?.full_name
      ),

    description:
      cleanText(
        repo?.description
      ),

    html_url:
      cleanText(
        repo?.html_url
      ),

    language:
      cleanText(
        repo?.language
      ),

    default_branch:
      cleanText(
        repo?.default_branch
      ),

    stars:
      Number(
        repo?.stargazers_count ||
        0
      ),

    forks:
      Number(
        repo?.forks_count ||
        0
      ),

    watchers:
      Number(
        repo?.watchers_count ||
        0
      ),

    open_issues:
      Number(
        repo?.open_issues_count ||
        0
      ),

    updated_at:
      repo?.updated_at ||
      null,

    created_at:
      repo?.created_at ||
      null,

    fork:
      Boolean(
        repo?.fork
      ),

    archived:
      Boolean(
        repo?.archived
      ),

    topics:
      Array.isArray(
        repo?.topics
      )
        ? repo.topics
            .map(cleanText)
            .filter(Boolean)
        : [],
  };
}

async function fetchGithubData(
  username
) {
  const userResponse =
    await githubGet(
      `https://api.github.com/users/${encodeURIComponent(
        username
      )}`
    );

  if (
    !userResponse?.ok
  ) {
    const status =
      userResponse
        ?.status || 0;

    if (
      status === 404
    ) {
      throw new Error(
        "The GitHub profile could not be found."
      );
    }

    throw new Error(
      `GitHub profile request failed${
        status
          ? ` with status ${status}`
          : ""
      }.`
    );
  }

  const githubUser =
    await userResponse.json();

  const reposResponse =
    await githubGet(
      `https://api.github.com/users/${encodeURIComponent(
        username
      )}/repos?per_page=100&sort=updated`
    );

  if (
    !reposResponse?.ok
  ) {
    const status =
      reposResponse
        ?.status || 0;

    throw new Error(
      `GitHub repository request failed${
        status
          ? ` with status ${status}`
          : ""
      }.`
    );
  }

  const repos =
    await reposResponse.json();

  const ownRepositories =
    (
      Array.isArray(repos)
        ? repos
        : []
    )
      .filter(
        (repo) =>
          repo &&
          !repo.fork
      )
      .map(
        normalizeRepository
      )
      .slice(
        0,
        30
      );

  return {
    user:
      githubUser,

    repositories:
      ownRepositories,
  };
}

async function fetchRepositoryDetails(
  username,
  repo
) {
  const languages = {};

  try {
    const response =
      await githubGet(
        `https://api.github.com/repos/${encodeURIComponent(
          username
        )}/${encodeURIComponent(
          repo.name
        )}/languages`
      );

    if (
      response?.ok
    ) {
      const data =
        await response.json();

      if (
        data &&
        typeof data ===
          "object"
      ) {
        Object.assign(
          languages,
          data
        );
      }
    }
  } catch {}

  let readmeStatus =
    "not_available";

  let readmePreview =
    "";

  try {
    const response =
      await githubGet(
        `https://api.github.com/repos/${encodeURIComponent(
          username
        )}/${encodeURIComponent(
          repo.name
        )}/readme`
      );

    if (
      response?.ok
    ) {
      const data =
        await response.json();

      if (
        data?.content
      ) {
        const rawContent =
          Buffer
            .from(
              data.content,
              "base64"
            )
            .toString(
              "utf8"
            );

        if (
          rawContent.trim()
        ) {
          readmeStatus =
            "available";

          readmePreview =
            rawContent
              .replace(
                /\s+/g,
                " "
              )
              .trim()
              .slice(
                0,
                1000
              );
        }
      }
    }
  } catch {}

  const detectedLanguages =
    Object.keys(
      languages
    );

  if (
    repo.language
  ) {
    detectedLanguages.unshift(
      repo.language
    );
  }

  const uniqueLanguages =
    Array.from(
      new Set(
        detectedLanguages
          .map(cleanText)
          .filter(Boolean)
      )
    );

  return {
    ...repo,

    languages:
      uniqueLanguages,

    readme_status:
      readmeStatus,

    readme_preview:
      readmePreview,
  };
}

function projectAlreadyExists(
  projects,
  repository
) {
  const repoName =
    cleanText(
      repository.name
    ).toLowerCase();

  const repoUrl =
    cleanText(
      repository.html_url
    ).toLowerCase();

  return projects.some(
    (project) => {
      const title =
        cleanText(
          project?.title ||
          project?.name
        ).toLowerCase();

      const githubLink =
        cleanText(
          project
            ?.github_link ||
          project?.github ||
          project?.repository
        ).toLowerCase();

      return (
        (
          repoName &&
          title ===
            repoName
        ) ||
        (
          repoUrl &&
          githubLink ===
            repoUrl
        ) ||
        (
          repoName &&
          githubLink.includes(
            "/" + repoName
          )
        )
      );
    }
  );
}

async function createProjectImportRequest(
  userId,
  username,
  githubUser,
  repository
) {
  const sourceUrl =
    repository.html_url ||
    `https://github.com/${username}/${repository.name}`;

  const metadata = {
    username,

    repo_name:
      repository.name,

    github_name:
      cleanText(
        githubUser?.name
      ),

    languages:
      repository.languages ||
      [],

    technologies:
      (
        repository.languages ||
        []
      ).join(", "),

    readme_status:
      repository.readme_status,

    readme_preview:
      repository.readme_preview,

    stars:
      repository.stars,

    forks:
      repository.forks,

    source_url:
      sourceUrl,

    github_verified:
      true,

    imported_at:
      new Date()
        .toISOString(),
  };

  const result =
    await db.query(
      `
      INSERT INTO external_import_requests
      (
        user_id,
        source,
        item_type,
        external_id,
        title,
        description,
        metadata,
        status
      )
      VALUES
      (
        $1,
        'github',
        'project',
        $2,
        $3,
        $4,
        $5,
        'PENDING'
      )
      ON CONFLICT
      (
        user_id,
        source,
        item_type,
        external_id
      )
      DO UPDATE SET
        title =
          EXCLUDED.title,

        description =
          EXCLUDED.description,

        metadata =
          EXCLUDED.metadata,

        updated_at =
          CURRENT_TIMESTAMP

      RETURNING *
      `,
      [
        userId,
        sourceUrl,
        repository.name,
        repository.description ||
          `GitHub repository: ${repository.name}`,
        JSON.stringify(
          metadata
        ),
      ]
    );

  /*
   * Agar same item pehle APPROVED ya REJECTED ho chuka hai,
   * to usse dobara pending item ki tarah frontend par mat bhejo.
   */
  return (
    result.rows[0]
      ?.status ===
    "PENDING"
  )
    ? result.rows[0]
    : null;
}

async function createSkillImportRequest(
  userId,
  skill,
  sourceUrl
) {
  const cleanSkill =
    cleanText(skill);

  if (!cleanSkill) {
    return null;
  }

  const externalId =
    `github-skill-${userId}-${createSafeId(
      cleanSkill
    )}`;

  const metadata = {
    skill_name:
      cleanSkill,

    category:
      "programming_language",

    source_url:
      sourceUrl,

    github_verified:
      true,

    imported_at:
      new Date()
        .toISOString(),
  };

  const result =
    await db.query(
      `
      INSERT INTO external_import_requests
      (
        user_id,
        source,
        item_type,
        external_id,
        title,
        description,
        metadata,
        status
      )
      VALUES
      (
        $1,
        'github',
        'skill',
        $2,
        $3,
        $4,
        $5,
        'PENDING'
      )
      ON CONFLICT
      (
        user_id,
        source,
        item_type,
        external_id
      )
      DO UPDATE SET
        title =
          EXCLUDED.title,

        description =
          EXCLUDED.description,

        metadata =
          EXCLUDED.metadata,

        updated_at =
          CURRENT_TIMESTAMP

      RETURNING *
      `,
      [
        userId,
        externalId,
        cleanSkill,
        "Detected from a public GitHub repository language report.",
        JSON.stringify(
          metadata
        ),
      ]
    );

  return (
    result.rows[0]
      ?.status ===
    "PENDING"
  )
    ? result.rows[0]
    : null;
}

async function createBioImportRequest(
  userId,
  username,
  bio,
  sourceUrl
) {
  const cleanBio =
    cleanText(bio);

  if (!cleanBio) {
    return null;
  }

  const externalId =
    `github-bio-${userId}-${createSafeId(
      username
    )}`;

  const metadata = {
    bio:
      cleanBio,

    source_url:
      sourceUrl,

    github_verified:
      true,

    imported_at:
      new Date()
        .toISOString(),
  };

  const result =
    await db.query(
      `
      INSERT INTO external_import_requests
      (
        user_id,
        source,
        item_type,
        external_id,
        title,
        description,
        metadata,
        status
      )
      VALUES
      (
        $1,
        'github',
        'bio',
        $2,
        'GitHub Bio',
        $3,
        $4,
        'PENDING'
      )
      ON CONFLICT
      (
        user_id,
        source,
        item_type,
        external_id
      )
      DO UPDATE SET
        title =
          EXCLUDED.title,

        description =
          EXCLUDED.description,

        metadata =
          EXCLUDED.metadata,

        updated_at =
          CURRENT_TIMESTAMP

      RETURNING *
      `,
      [
        userId,
        externalId,
        cleanBio,
        JSON.stringify(
          metadata
        ),
      ]
    );

  return (
    result.rows[0]
      ?.status ===
    "PENDING"
  )
    ? result.rows[0]
    : null;
}

async function analyzeGithub(
  userId,
  githubUrl
) {
  if (!userId) {
    throw new Error(
      "Authentication required to analyze GitHub profile."
    );
  }

  const {
    username,
    url:
      normalizedUrl,
  } =
    extractGithubUsername(
      githubUrl
    );

  const profileResult =
    await db.query(
      `
      SELECT *
      FROM profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

  if (
    profileResult
      .rowCount === 0
  ) {
    throw new Error(
      "Candidate profile not found."
    );
  }

  const profile =
    profileResult
      .rows[0];

  /*
   * Save GitHub URL in existing candidate social profile.
   * Scan itself still does not import projects/skills.
   */
  const socialProfiles =
    profile
      .social_profiles &&
    typeof profile
      .social_profiles ===
      "object"
      ? {
          ...profile
            .social_profiles,
        }
      : {};

  if (
    socialProfiles.github !==
    normalizedUrl
  ) {
    socialProfiles.github =
      normalizedUrl;

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

  const {
    user:
      githubUser,
    repositories,
  } =
    await fetchGithubData(
      username
    );

  const existingProjects =
    Array.isArray(
      profile.projects
    )
      ? profile.projects
      : [];

  const existingSkills =
    getNormalizedSkillList(
      profile.skills
    );

  const pendingResults =
    [];

  const detectedLanguages =
    new Set();

  const detailedRepositories =
    [];

  /*
   * Analyze repositories one by one.
   */
  for (
    const repository
    of repositories
  ) {
    try {
      const detailedRepository =
        await fetchRepositoryDetails(
          username,
          repository
        );

      detailedRepositories.push(
        detailedRepository
      );

      for (
        const language
        of detailedRepository
          .languages
      ) {
        detectedLanguages.add(
          language
        );
      }

      /*
       * Only create pending request when project
       * does not already exist in HireVision.
       */
      if (
        !projectAlreadyExists(
          existingProjects,
          detailedRepository
        )
      ) {
        const request =
          await createProjectImportRequest(
            userId,
            username,
            githubUser,
            detailedRepository
          );

        if (request) {
          pendingResults.push(
            request
          );
        }
      }
    } catch (error) {
      console.warn(
        `[GitHub Agent] Repository analysis failed for ${repository.name}:`,
        error.message
      );
    }
  }

  /*
   * Missing languages become pending skill requests.
   */
  for (
    const language
    of detectedLanguages
  ) {
    const normalizedLanguage =
      cleanText(
        language
      ).toLowerCase();

    if (
      !normalizedLanguage ||
      existingSkills.includes(
        normalizedLanguage
      )
    ) {
      continue;
    }

    try {
      const request =
        await createSkillImportRequest(
          userId,
          language,
          normalizedUrl
        );

      if (request) {
        pendingResults.push(
          request
        );
      }
    } catch (error) {
      console.warn(
        `[GitHub Agent] Skill import request failed for ${language}:`,
        error.message
      );
    }
  }

  /*
   * GitHub bio can also be proposed as an import,
   * but never applied without candidate approval.
   */
  const existingBio =
    cleanText(
      profile
        .career_objective
    );

  const githubBio =
    cleanText(
      githubUser?.bio
    );

  if (
    githubBio &&
    githubBio.length >
      15 &&
    githubBio !==
      existingBio
  ) {
    try {
      const request =
        await createBioImportRequest(
          userId,
          username,
          githubBio,
          normalizedUrl
        );

      if (request) {
        pendingResults.push(
          request
        );
      }
    } catch (error) {
      console.warn(
        "[GitHub Agent] Bio import request failed:",
        error.message
      );
    }
  }

  return {
    success:
      true,

    source:
      "github",

    profile: {
      login:
        cleanText(
          githubUser?.login ||
          username
        ),

      name:
        cleanText(
          githubUser?.name
        ),

      bio:
        githubBio,

      public_repositories:
        Number(
          githubUser
            ?.public_repos ||
          0
        ),

      profile_url:
        normalizedUrl,
    },

    repositories:
      detailedRepositories,

    detected_languages:
      Array.from(
        detectedLanguages
      ),

    /*
     * Different consumers in the current project
     * use different names. Return all aliases.
     */
    items:
      pendingResults,

    pending_items:
      pendingResults,

    pendingImports:
      pendingResults,

    counts: {
      repositories_analyzed:
        detailedRepositories
          .length,

      new_projects:
        pendingResults
          .filter(
            (item) =>
              item.item_type ===
              "project"
          )
          .length,

      new_skills:
        pendingResults
          .filter(
            (item) =>
              item.item_type ===
              "skill"
          )
          .length,

      new_bio:
        pendingResults
          .filter(
            (item) =>
              item.item_type ===
              "bio"
          )
          .length,

      total:
        pendingResults
          .length,
    },

    message:
      pendingResults.length
        ? `GitHub scan completed. ${pendingResults.length} new item(s) require your approval before being added to your profile.`
        : "GitHub scan completed. No new profile items were found.",
  };
}

function buildFallbackAnalysis(
  scan,
  profile,
  query
) {
  const repositories =
    scan.repositories ||
    [];

  const languages =
    scan.detected_languages ||
    [];

  const projects =
    repositories.map(
      (repository) => ({
        name:
          repository.name,

        description:
          repository.description,

        technologies:
          repository.languages,

        stars:
          repository.stars,

        forks:
          repository.forks,

        readme_status:
          repository
            .readme_status,

        url:
          repository.html_url,
      })
    );

  const missingData =
    [];

  if (
    !profile
      .career_objective
  ) {
    missingData.push(
      "Professional summary / career objective"
    );
  }

  if (
    !profile.skills ||
    !getNormalizedSkillList(
      profile.skills
    ).length
  ) {
    missingData.push(
      "Technical skills"
    );
  }

  if (
    !profile.projects
      ?.length
  ) {
    missingData.push(
      "Projects"
    );
  }

  return {
    summary:
      `GitHub analysis completed for ${scan.profile.login}.`,

    profile:
      scan.profile,

    repositories:
      projects,

    detected_languages:
      languages,

    pending_imports:
      scan.pending_items ||
      [],

    missing_data:
      missingData,

    user_query:
      query,

    limitations: [
      "AI interpretation was unavailable for this response.",
      "Repository metadata comes from the GitHub API and does not by itself prove code quality, authorship depth, or professional proficiency.",
    ],
  };
}

async function handleQuery(
  profile = {},
  query = "",
  context = {}
) {
  const userId =
    context.userId ||
    profile.user_id ||
    profile.id;

  let githubUrl =
    profile
      ?.social_profiles
      ?.github ||
    profile?.github ||
    "";

  /*
   * Allow user to paste GitHub URL directly in chat.
   */
  const queryMatch =
    String(query).match(
      /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9-]+)/i
    );

  if (queryMatch) {
    githubUrl =
      `https://github.com/${queryMatch[1]}`;
  }

  if (!githubUrl) {
    return normalizeAgentResponse(
      "github_agent",
      {
        result: {
          status:
            "connection_required",

          message:
            "Please provide your public GitHub profile URL so I can analyze your repositories and compare them with your HireVision profile.",

          required_input:
            "github_profile_url",
        },

        missing_data: [
          "GitHub profile URL",
        ],
      }
    );
  }

  let scan;

  try {
    scan =
      await analyzeGithub(
        userId,
        githubUrl
      );
  } catch (error) {
    return normalizeAgentResponse(
      "github_agent",
      {
        result: {
          status:
            "analysis_failed",

          message:
            error.message,

          source:
            "github_api",
        },

        missing_data:
          [],
      },
      {
        error: {
          code:
            "GITHUB_ANALYSIS_FAILED",

          message:
            error.message,

          retryable:
            true,
        },
      }
    );
  }

  const pendingItems =
    scan.pending_items ||
    [];

  const projectItems =
    pendingItems.filter(
      (item) =>
        item.item_type ===
        "project"
    );

  const skillItems =
    pendingItems.filter(
      (item) =>
        item.item_type ===
        "skill"
    );

  const bioItems =
    pendingItems.filter(
      (item) =>
        item.item_type ===
        "bio"
    );

  const systemPrompt = `
You are HireVision's professional GitHub Intelligence Agent.

Analyze GitHub data retrieved from the GitHub API and compare it with the candidate's existing HireVision profile.

Rules:
- Use only the supplied GitHub API data and candidate profile.
- Never invent repositories, technologies, commits, achievements, stars, employers, or skills.
- A repository language is evidence that the language is present in the repository, not proof of the candidate's proficiency.
- A repository URL does not prove code quality or authorship depth.
- Do not claim that source code was manually reviewed unless source-code content was actually supplied.
- Do not claim commits were analyzed unless commit data is supplied.
- Pending imports require candidate approval.
- Never say pending imports were already added.
- Return valid JSON only.

Return:
{
  "summary": "",
  "github_profile_highlights": [],
  "repository_highlights": [],
  "detected_technologies": [],
  "profile_gaps": [],
  "evidence_notes": [],
  "recommendations": []
}
`;

  const userPayload = {
    query,

    candidate_profile: {
      full_name:
        profile.full_name ||
        null,

      career_objective:
        profile
          .career_objective ||
        null,

      skills:
        getNormalizedSkillList(
          profile.skills
        ),

      projects:
        Array.isArray(
          profile.projects
        )
          ? profile.projects
          : [],
    },

    github: {
      profile:
        scan.profile,

      repositories:
        scan.repositories,

      detected_languages:
        scan.detected_languages,
    },

    pending_imports: {
      projects:
        projectItems.map(
          (item) => ({
            title:
              item.title,

            external_id:
              item.external_id,
          })
        ),

      skills:
        skillItems.map(
          (item) => ({
            title:
              item.title,

            external_id:
              item.external_id,
          })
        ),

      bio:
        bioItems.map(
          (item) => ({
            title:
              item.title,

            external_id:
              item.external_id,
          })
        ),
    },
  };

  try {
    const aiResult =
      await callLLM(
        systemPrompt,
        JSON.stringify(
          userPayload
        ),
        true,
        {
          conversation:
            context
              .conversation ||
            [],

          temperature:
            0.2,
        }
      );

    const parsed =
      aiResult?.result &&
      typeof aiResult
        .result ===
        "object"
        ? aiResult.result
        : aiResult;

    const result = {
      ...parsed,

      github_profile:
        scan.profile,

      repositories_analyzed:
        scan.repositories
          .length,

      detected_languages:
        scan.detected_languages,

      pending_imports: {
        projects:
          projectItems,

        skills:
          skillItems,

        bio:
          bioItems,
      },

      import_requires_approval:
        true,
    };

    return normalizeAgentResponse(
      "github_agent",
      {
        result,

        missing_data:
          Array.isArray(
            parsed
              ?.profile_gaps
          )
            ? parsed
                .profile_gaps
            : [],

        metadata: {
          source:
            "github_api",

          github_profile_verified:
            true,

          repositories_analyzed:
            scan
              .repositories
              .length,

          pending_import_count:
            pendingItems
              .length,
        },
      }
    );
  } catch (error) {
    const fallback =
      buildFallbackAnalysis(
        scan,
        profile,
        query
      );

    return normalizeAgentResponse(
      "github_agent",
      {
        result:
          fallback,

        missing_data:
          fallback
            .missing_data,

        metadata: {
          source:
            "github_api",

          fallback:
            "deterministic",

          github_profile_verified:
            true,

          repositories_analyzed:
            scan
              .repositories
              .length,
        },
      },
      {
        error: {
          code:
            "GITHUB_AI_ANALYSIS_UNAVAILABLE",

          message:
            "GitHub data was retrieved successfully, but AI interpretation is temporarily unavailable.",

          retryable:
            true,
        },
      }
    );
  }
}

module.exports = {
  analyzeGithub,
  handleQuery,
};