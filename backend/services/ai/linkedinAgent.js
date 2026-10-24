const db = require("../../config/db");
const { callLLM } = require("./openaiService");
const { normalizeAgentResponse } = require("./agentResponseSchema");

function createSafeId(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStringKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[.\-_/\\,():;'"[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDegreeKey(degree) {
  const norm = normalizeStringKey(degree);
  if (!norm) return "";
  if (/b\s*tech|bachelor.*tech|b\s*e\b|bachelor.*eng/i.test(norm)) return "btech";
  if (/m\s*tech|master.*tech|m\s*e\b|master.*eng/i.test(norm)) return "mtech";
  if (/b\s*sc|bachelor.*science/i.test(norm)) return "bsc";
  if (/m\s*sc|master.*science/i.test(norm)) return "msc";
  if (/bca|bachelor.*computer\s*app/i.test(norm)) return "bca";
  if (/mca|master.*computer\s*app/i.test(norm)) return "mca";
  if (/mba|master.*business/i.test(norm)) return "mba";
  if (/bba|bachelor.*business/i.test(norm)) return "bba";
  return norm;
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.filter(Boolean)
    : [];
}

function getNormalizedSkillList(skills) {
  if (!skills) {
    return [];
  }

  if (Array.isArray(skills)) {
    return skills
      .map((skill) => {
        if (typeof skill === "string") {
          return cleanText(skill).toLowerCase();
        }

        return cleanText(
          skill?.name ||
            skill?.skill ||
            skill?.title
        ).toLowerCase();
      })
      .filter(Boolean);
  }

  if (typeof skills === "object") {
    return Object.values(skills)
      .flat(Infinity)
      .map((skill) => {
        if (typeof skill === "string") {
          return cleanText(skill).toLowerCase();
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

function normalizeLinkedInUrl(linkedinUrl) {
  const input = cleanText(linkedinUrl);

  if (!input) {
    throw new Error(
      "LinkedIn profile URL is required."
    );
  }

  const normalized = /^https?:\/\//i.test(input)
    ? input
    : `https://${input}`;

  let parsed;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(
      "Please provide a valid LinkedIn profile URL."
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname !== "linkedin.com" &&
    hostname !== "www.linkedin.com"
  ) {
    throw new Error(
      "Please provide a valid LinkedIn profile URL."
    );
  }

  const parts = parsed.pathname
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (
    parts.length < 2 ||
    parts[0].toLowerCase() !== "in" ||
    !parts[1]
  ) {
    throw new Error(
      "Please provide a valid LinkedIn profile URL in the format https://www.linkedin.com/in/your-profile."
    );
  }

  return {
    url: `https://www.linkedin.com/in/${parts[1]}`,
    profileSlug: parts[1],
  };
}

function normalizeExperience(items) {
  return normalizeArray(items)
    .map((item) => ({
      company: cleanText(
        item?.company ||
          item?.company_name ||
          item?.organization ||
          item?.employer
      ),

      role: cleanText(
        item?.role ||
          item?.title ||
          item?.position
      ),

      location: cleanText(
        item?.location
      ),

      start_date: cleanText(
        item?.start_date ||
          item?.startDate ||
          item?.started_on ||
          item?.from
      ),

      end_date: cleanText(
        item?.end_date ||
          item?.endDate ||
          item?.finished_on ||
          item?.to
      ),

      current: Boolean(
        item?.current ||
          (!item?.end_date && !item?.finished_on && (item?.start_date || item?.started_on))
      ),

      description: cleanText(
        item?.description ||
          item?.summary
      ),
    }))
    .filter(
      (item) =>
        item.company ||
        item.role ||
        item.description
    );
}

function normalizeEducation(items) {
  return normalizeArray(items)
    .map((item) => ({
      institution: cleanText(
        item?.institution ||
          item?.school_name ||
          item?.school ||
          item?.college_name ||
          item?.college ||
          item?.university
      ),

      degree: cleanText(
        item?.degree ||
          item?.degree_name
      ),

      field_of_study: cleanText(
        item?.field_of_study ||
          item?.notes ||
          item?.activities ||
          item?.field ||
          item?.branch ||
          item?.specialization
      ),

      start_year: cleanText(
        item?.start_year ||
          item?.startYear ||
          (item?.start_date ? String(item.start_date).split("/").pop() : "")
      ),

      end_year: cleanText(
        item?.end_year ||
          item?.endYear ||
          item?.passing_year ||
          (item?.end_date ? String(item.end_date).split("/").pop() : "")
      ),

      grade: cleanText(
        item?.grade
      ),
    }))
    .filter(
      (item) =>
        item.institution ||
        item.degree ||
        item.field_of_study
    );
}

function normalizeCertifications(items) {
  return normalizeArray(items)
    .map((item) => ({
      name: cleanText(
        item?.name ||
          item?.certificate_name ||
          item?.title
      ),

      issuer: cleanText(
        item?.issuer ||
          item?.platform ||
          item?.organization
      ),

      issue_date: cleanText(
        item?.issue_date ||
          item?.issueDate
      ),

      expiration_date: cleanText(
        item?.expiration_date ||
          item?.expirationDate
      ),

      credential_id: cleanText(
        item?.credential_id ||
          item?.credentialId
      ),

      credential_url: cleanText(
        item?.credential_url ||
          item?.credentialUrl
      ),
    }))
    .filter(
      (item) =>
        item.name ||
        item.issuer
    );
}

function normalizeProjects(items) {
  return normalizeArray(items)
    .map((item) => ({
      title: cleanText(
        item?.title ||
          item?.name
      ),

      description: cleanText(
        item?.description ||
          item?.summary
      ),

      technologies: Array.isArray(
        item?.technologies
      )
        ? item.technologies
            .map((technology) =>
              cleanText(
                typeof technology === "string"
                  ? technology
                  : technology?.name
              )
            )
            .filter(Boolean)
            .join(", ")
        : cleanText(
            item?.technologies
          ),

      role: cleanText(
        item?.role
      ),

      duration: cleanText(
        item?.duration
      ),
    }))
    .filter(
      (item) =>
        item.title ||
        item.description
    );
}

function normalizeSkills(skills) {
  return normalizeArray(skills)
    .map((skill) => {
      if (typeof skill === "string") {
        return cleanText(skill);
      }

      return cleanText(
        skill?.name ||
          skill?.skill ||
          skill?.title
      );
    })
    .filter(Boolean);
}

function normalizeLanguages(items) {
  return normalizeArray(items)
    .map((item) => ({
      language: cleanText(
        typeof item === "string" ? item : (item?.language || item?.name)
      ),
      proficiency: cleanText(
        typeof item === "object" ? (item?.proficiency || item?.level || "Professional / Fluent") : "Professional / Fluent"
      ),
    }))
    .filter((item) => item.language);
}

function normalizeAchievements(items) {
  return normalizeArray(items)
    .map((item) => {
      if (typeof item === "string") return cleanText(item);
      return cleanText(item?.title || item?.name || item?.description);
    })
    .filter(Boolean);
}

function hasStructuredLinkedInData(rawData) {
  if (
    !rawData ||
    typeof rawData !== "object"
  ) {
    return false;
  }

  return Boolean(
    rawData.verified_member ||
      rawData.member_id ||
      rawData.name ||
      rawData.bio ||
      rawData.about ||
      rawData.summary ||
      rawData.headline ||
      rawData.profile ||
      rawData.experience ||
      rawData.positions ||
      rawData.work_experience ||
      rawData.skills ||
      rawData.certifications ||
      rawData.projects ||
      rawData.education ||
      rawData.languages ||
      rawData.achievements ||
      rawData.honors
  );
}

function normalizeExtractedData(
  linkedinUrl,
  profileSlug,
  data = {}
) {
  return {
    profileSlug,

    url: linkedinUrl,

    bio: cleanText(
      data.bio ||
        data.about ||
        data.summary ||
        data.profile?.summary ||
        data.profile?.bio ||
        data.profile?.about
    ),

    headline: cleanText(
      data.headline ||
        data.profile?.headline
    ),

    experience: normalizeExperience(
      data.experience ||
        data.positions ||
        data.work_experience
    ),

    education: normalizeEducation(
      data.education
    ),

    certifications: normalizeCertifications(
      data.certifications
    ),

    projects: normalizeProjects(
      data.projects
    ),

    skills: normalizeSkills(
      data.skills
    ),

    languages: normalizeLanguages(
      data.languages
    ),

    achievements: normalizeAchievements(
      data.achievements || data.honors
    ),

    source:
      data.source ||
      "linkedin_provided_data",

    verified_member:
      data.verified_member === true,

    member_id: cleanText(
      data.member_id ||
        data.memberId ||
        data.sub
    ),

    name: cleanText(
      data.name
    ),

    email: cleanText(
      data.email
    ),

    picture: cleanText(
      data.picture
    ),

    extraction_available:
      data.extraction_available !== false,
  };
}

async function extractLinkedInProfileData(
  linkedinUrl,
  rawData = null,
  profile = {}
) {
  const {
    url: normalizedUrl,
    profileSlug,
  } = normalizeLinkedInUrl(
    linkedinUrl
  );

  if (
    hasStructuredLinkedInData(
      rawData
    )
  ) {
    return normalizeExtractedData(
      normalizedUrl,
      profileSlug,
      rawData
    );
  }

  const suppliedProfileContext = {
    name:
      profile?.full_name ||
      "",

    career_objective:
      profile?.career_objective ||
      "",

    skills:
      getNormalizedSkillList(
        profile?.skills
      ),

    projects:
      normalizeArray(
        profile?.projects
      ),

    experience:
      normalizeArray(
        profile?.experience
      ),

    education:
      normalizeArray(
        profile?.education
      ),

    certifications:
      normalizeArray(
        profile?.certifications
      ),
  };

  return {
    profileSlug,

    url:
      normalizedUrl,

    bio:
      "",

    headline:
      "",

    experience:
      [],

    education:
      [],

    certifications:
      [],

    projects:
      [],

    skills:
      [],

    source:
      "linkedin_url_only",

    extraction_available:
      false,

    message:
      "A LinkedIn URL was provided, but structured LinkedIn profile data was not supplied. The URL alone is not sufficient to extract profile information reliably.",

    profile_context:
      suppliedProfileContext,
  };
}

async function verifyProfileOwnership(
  userId,
  profileSlug,
  profile,
  extracted = null
) {
  if (!userId) {
    return {
      verified:
        false,

      reason:
        "Authentication is required.",
    };
  }

  if (extracted?.vanity_name && profileSlug) {
    if (
      normalizeStringKey(extracted.vanity_name) !==
      normalizeStringKey(profileSlug)
    ) {
      return {
        verified: false,
        reason:
          "The authorized LinkedIn account does not match the profile URL entered in HireVision. Please authorize the matching LinkedIn account.",
      };
    }
  }

  if (
    extracted?.verified_member === true
  ) {
    return {
      verified:
        true,

      reason:
        "LinkedIn data belongs to the member who explicitly authorized HireVision through LinkedIn OAuth.",

      method:
        "linkedin_oauth",
    };
  }

  const currentLinkedIn =
    cleanText(
      profile?.social_profiles?.linkedin ||
        profile?.linkedin
    );

  if (!currentLinkedIn) {
    return {
      verified:
        false,

      reason:
        "LinkedIn profile is not currently connected to the HireVision profile.",
    };
  }

  try {
    const current =
      normalizeLinkedInUrl(
        currentLinkedIn
      );

    const verified =
      current.profileSlug.toLowerCase() ===
      String(profileSlug).toLowerCase();

    return {
      verified,

      reason:
        verified
          ? "LinkedIn URL matches the connected profile."
          : "Provided LinkedIn URL does not match the connected profile.",
    };
  } catch {
    return {
      verified:
        false,

      reason:
        "The currently stored LinkedIn URL could not be validated.",
    };
  }
}

async function createImportRequest(
  userId,
  itemType,
  externalId,
  title,
  description,
  metadata
) {
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
        'linkedin',
        $2,
        $3,
        $4,
        $5,
        $6,
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
        itemType,
        externalId,
        title,
        description || "",
        JSON.stringify(
          metadata
        ),
      ]
    );

  return (
    result.rows[0]?.status ===
    "PENDING"
  )
    ? result.rows[0]
    : null;
}

async function analyzeLinkedin(
  userId,
  linkedinUrl,
  rawData = null
) {
  if (!userId) {
    throw new Error(
      "Authentication required to analyze LinkedIn profile."
    );
  }

  if (
    !linkedinUrl ||
    typeof linkedinUrl !== "string"
  ) {
    throw new Error(
      "LinkedIn profile URL is required."
    );
  }

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
    profileResult.rowCount === 0
  ) {
    throw new Error(
      "Candidate profile not found."
    );
  }

  const profile =
    profileResult.rows[0];

  const extracted =
    await extractLinkedInProfileData(
      linkedinUrl,
      rawData,
      profile
    );

  const ownership =
    await verifyProfileOwnership(
      userId,
      extracted.profileSlug,
      profile,
      extracted
    );

  const pendingResults =
    [];

  const existingProjects =
    normalizeArray(
      profile.projects
    );

  const existingCertifications =
    normalizeArray(
      profile.certifications
    );

  const existingExperience =
    normalizeArray(
      profile.experience
    );

  const existingEducation =
    normalizeArray(
      profile.education
    );

  const existingSkills =
    getNormalizedSkillList(
      profile.skills
    );

  const existingBio =
    cleanText(
      profile.career_objective
    );

  const existingLanguages =
    normalizeArray(
      profile.languages
    );

  const existingAchievements =
    normalizeArray(
      profile.achievements
    );

  const hasImportedData =
    extracted.experience.length > 0 ||
    extracted.education.length > 0 ||
    extracted.certifications.length > 0 ||
    extracted.projects.length > 0 ||
    extracted.skills.length > 0 ||
    extracted.languages.length > 0 ||
    extracted.achievements.length > 0 ||
    Boolean(
      extracted.bio
    );

  if (!hasImportedData) {
    return {
      success: true,
      status: "limited_access",
      source: "linkedin",
      profile: {
        url: extracted.url,
        profile_slug: extracted.profileSlug,
        ownership,
      },
      extracted,
      items: [],
      pending_items: [],
      pendingImports: [],
      counts: {
        projects: 0,
        certifications: 0,
        experience: 0,
        education: 0,
        skills: 0,
        bio: 0,
        total: 0,
      },
      data_available: false,
      dataAvailable: false,
      message: extracted.verified_member
        ? "LinkedIn connected successfully, but the currently authorized LinkedIn API access did not return additional professional profile information to import."
        : "No structured LinkedIn profile data was supplied. A LinkedIn URL alone cannot be used as reliable evidence for importing profile information.",
    };
  }

  if (!ownership.verified) {
    throw new Error(
      ownership.reason ||
        "The supplied LinkedIn profile does not match the LinkedIn profile currently connected to this HireVision account."
    );
  }

  const socialProfiles =
    profile.social_profiles &&
    typeof profile.social_profiles === "object"
      ? {
          ...profile.social_profiles,
        }
      : {};

  if (socialProfiles.linkedin !== extracted.url) {
    socialProfiles.linkedin = extracted.url;

    await db.query(
      `
      UPDATE profiles
      SET
        social_profiles = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
      `,
      [JSON.stringify(socialProfiles), userId]
    );
  }

  const existingImportsResult = await db.query(
    `
    SELECT id, item_type, external_id, title, description, metadata, status
    FROM external_import_requests
    WHERE user_id = $1
      AND source = 'linkedin'
    `,
    [userId]
  );

  const existingImports = existingImportsResult.rows;

  /*
   * ============================================================
   * PROJECTS
   * ============================================================
   */

  for (const item of extracted.projects) {
    if (!item.title) {
      continue;
    }

    const normTitle = normalizeStringKey(item.title);

    const existsInProfile = existingProjects.some(
      (project) =>
        normalizeStringKey(project?.title || project?.name) === normTitle
    );

    if (existsInProfile) {
      continue;
    }

    const externalId = `linkedin-project-${userId}-${createSafeId(item.title)}`;

    const existingReq = existingImports.find(
      (r) =>
        r.item_type === "project" &&
        (r.external_id === externalId ||
          normalizeStringKey(r.title) === normTitle)
    );

    if (existingReq) {
      if (existingReq.status === "PENDING") {
        pendingResults.push(existingReq);
      }
      continue;
    }

    const metadata = {
      title: item.title,
      description: item.description || "",
      technologies: item.technologies || "",
      role: item.role || "",
      duration: item.duration || "",
      source_url: extracted.url,
      source_type: extracted.source,
      imported_at: new Date().toISOString(),
    };

    const request = await createImportRequest(
      userId,
      "project",
      externalId,
      item.title,
      item.description || "",
      metadata
    );

    if (request) {
      pendingResults.push(request);
    }
  }

  /*
   * ============================================================
   * CERTIFICATIONS
   * ============================================================
   */

  for (const item of extracted.certifications) {
    if (!item.name) {
      continue;
    }

    const normName = normalizeStringKey(item.name);
    const normIssuer = normalizeStringKey(item.issuer);

    const existsInProfile = existingCertifications.some((cert) => {
      const cName = normalizeStringKey(
        cert?.certificate_name || cert?.name || cert?.title
      );
      const cIssuer = normalizeStringKey(
        cert?.platform || cert?.issuer || cert?.organization
      );

      return (
        cName === normName ||
        (normIssuer && cName.includes(normName) && cIssuer === normIssuer)
      );
    });

    if (existsInProfile) {
      continue;
    }

    const externalId = `linkedin-cert-${userId}-${createSafeId(item.name)}`;

    const existingReq = existingImports.find(
      (r) =>
        r.item_type === "certification" &&
        (r.external_id === externalId ||
          normalizeStringKey(r.title) === normName)
    );

    if (existingReq) {
      if (existingReq.status === "PENDING") {
        pendingResults.push(existingReq);
      }
      continue;
    }

    const metadata = {
      certificate_name: item.name,
      issuer: item.issuer || "",
      platform: item.issuer || "",
      issue_date: item.issue_date || "",
      expiration_date: item.expiration_date || "",
      credential_id: item.credential_id || "",
      credential_link: item.credential_url || "",
      source_url: extracted.url,
      source_type: extracted.source,
      imported_at: new Date().toISOString(),
    };

    const request = await createImportRequest(
      userId,
      "certification",
      externalId,
      item.name,
      item.issuer || "Certification from LinkedIn profile data.",
      metadata
    );

    if (request) {
      pendingResults.push(request);
    }
  }

  /*
   * ============================================================
   * EXPERIENCE
   * ============================================================
   */

  for (const item of extracted.experience) {
    if (!item.company || !item.role) {
      continue;
    }

    const normCompany = normalizeStringKey(item.company);
    const normRole = normalizeStringKey(item.role);

    const existsInProfile = existingExperience.some((exp) => {
      const eCompany = normalizeStringKey(exp?.company || exp?.employer);
      const eRole = normalizeStringKey(exp?.role || exp?.title);
      return eCompany === normCompany && eRole === normRole;
    });

    if (existsInProfile) {
      continue;
    }

    const externalId = `linkedin-exp-${userId}-${createSafeId(
      item.company
    )}-${createSafeId(item.role)}`;

    const existingReq = existingImports.find(
      (r) =>
        r.item_type === "experience" &&
        (r.external_id === externalId ||
          (normalizeStringKey(r.metadata?.company) === normCompany &&
            normalizeStringKey(r.metadata?.role) === normRole))
    );

    if (existingReq) {
      if (existingReq.status === "PENDING") {
        pendingResults.push(existingReq);
      }
      continue;
    }

    const metadata = {
      company: item.company,
      role: item.role,
      location: item.location || "",
      start_date: item.start_date || "",
      end_date: item.end_date || "",
      current: Boolean(item.current),
      description: item.description || "",
      source_url: extracted.url,
      source_type: extracted.source,
      imported_at: new Date().toISOString(),
    };

    const request = await createImportRequest(
      userId,
      "experience",
      externalId,
      `${item.role} at ${item.company}`,
      item.description || "",
      metadata
    );

    if (request) {
      pendingResults.push(request);
    }
  }

  /*
   * ============================================================
   * EDUCATION
   * ============================================================
   */

  for (const item of extracted.education) {
    if (!item.institution) {
      continue;
    }

    const normInst = normalizeStringKey(item.institution);
    const normDegree = normalizeDegreeKey(item.degree);

    const existsInProfile = existingEducation.some((edu) => {
      const eduInst = normalizeStringKey(
        edu?.institution ||
          edu?.college_name ||
          edu?.college ||
          edu?.university ||
          edu?.school_name ||
          edu?.school
      );
      const eduDeg = normalizeDegreeKey(edu?.degree);
      const instMatch =
        eduInst &&
        normInst &&
        (eduInst === normInst ||
          eduInst.includes(normInst) ||
          normInst.includes(eduInst));
      return (
        instMatch && (!normDegree || !eduDeg || eduDeg === normDegree)
      );
    });

    if (existsInProfile) {
      continue;
    }

    const externalId = `linkedin-edu-${userId}-${createSafeId(
      item.institution
    )}`;

    const existingReq = existingImports.find(
      (r) =>
        r.item_type === "education" &&
        (r.external_id === externalId ||
          normalizeStringKey(r.metadata?.institution || r.title).includes(
            normInst
          ))
    );

    if (existingReq) {
      if (existingReq.status === "PENDING") {
        pendingResults.push(existingReq);
      }
      continue;
    }

    const metadata = {
      institution: item.institution,
      degree: item.degree || "",
      field_of_study: item.field_of_study || "",
      start_year: item.start_year || "",
      end_year: item.end_year || "",
      grade: item.grade || "",
      source_url: extracted.url,
      source_type: extracted.source,
      imported_at: new Date().toISOString(),
    };

    const request = await createImportRequest(
      userId,
      "education",
      externalId,
      `${item.degree || "Education"} - ${item.institution}`,
      item.field_of_study || "",
      metadata
    );

    if (request) {
      pendingResults.push(request);
    }
  }

  /*
   * ============================================================
   * SKILLS
   * ============================================================
   */

  for (const skill of extracted.skills) {
    const cleanSkill = cleanText(skill);

    if (!cleanSkill) {
      continue;
    }

    const normSkill = normalizeStringKey(cleanSkill);

    const existsInProfile = existingSkills.some(
      (s) => normalizeStringKey(s) === normSkill
    );

    if (existsInProfile) {
      continue;
    }

    const externalId = `linkedin-skill-${userId}-${createSafeId(cleanSkill)}`;

    const existingReq = existingImports.find(
      (r) =>
        r.item_type === "skill" &&
        (r.external_id === externalId ||
          normalizeStringKey(r.title) === normSkill)
    );

    if (existingReq) {
      if (existingReq.status === "PENDING") {
        pendingResults.push(existingReq);
      }
      continue;
    }

    const metadata = {
      skill_name: cleanSkill,
      category: "Developer Tools",
      source_url: extracted.url,
      source_type: extracted.source,
      imported_at: new Date().toISOString(),
    };

    const request = await createImportRequest(
      userId,
      "skill",
      externalId,
      cleanSkill,
      "Skill supplied from authorized LinkedIn profile data.",
      metadata
    );

    if (request) {
      pendingResults.push(request);
    }
  }

  /*
   * ============================================================
   * LANGUAGES
   * ============================================================
   */

  for (const item of extracted.languages) {
    if (!item.language) {
      continue;
    }

    const cleanLang = cleanText(item.language);
    const normLang = normalizeStringKey(cleanLang);

    const existsInProfile = existingLanguages.some(
      (l) => normalizeStringKey(l?.language || l?.name || l) === normLang
    );

    if (existsInProfile) {
      continue;
    }

    const externalId = `linkedin-lang-${userId}-${createSafeId(cleanLang)}`;

    const existingReq = existingImports.find(
      (r) =>
        r.item_type === "language" &&
        (r.external_id === externalId ||
          normalizeStringKey(r.title) === normLang)
    );

    if (existingReq) {
      if (existingReq.status === "PENDING") {
        pendingResults.push(existingReq);
      }
      continue;
    }

    const metadata = {
      language: cleanLang,
      proficiency: item.proficiency || "Professional / Fluent",
      source_url: extracted.url,
      source_type: extracted.source,
      imported_at: new Date().toISOString(),
    };

    const request = await createImportRequest(
      userId,
      "language",
      externalId,
      cleanLang,
      `Language proficiency: ${item.proficiency || "Professional / Fluent"}`,
      metadata
    );

    if (request) {
      pendingResults.push(request);
    }
  }

  /*
   * ============================================================
   * ACHIEVEMENTS / HONORS
   * ============================================================
   */

  for (const item of extracted.achievements) {
    const achText = cleanText(item);

    if (!achText || achText.length < 5) {
      continue;
    }

    const normAch = normalizeStringKey(achText);

    const existsInProfile = existingAchievements.some((a) => {
      const existingText = typeof a === "string" ? a : a?.title || a?.name || "";
      const normExisting = normalizeStringKey(existingText);
      const bothMentionScetathon =
        normAch.includes("scetathon") && normExisting.includes("scetathon");
      const bothMentionHackathon =
        normAch.includes("hackathon") &&
        normExisting.includes("hackathon") &&
        (normAch.includes("scet") || normExisting.includes("scet"));
      return (
        normExisting === normAch ||
        (normExisting.length > 20 && normAch.includes(normExisting)) ||
        (normAch.length > 20 && normExisting.includes(normAch)) ||
        bothMentionScetathon ||
        bothMentionHackathon
      );
    });

    if (existsInProfile) {
      continue;
    }

    const externalId = `linkedin-ach-${userId}-${createSafeId(
      achText.slice(0, 30)
    )}`;

    const existingReq = existingImports.find(
      (r) =>
        (r.item_type === "achievement" || r.item_type === "honor") &&
        (r.external_id === externalId ||
          normalizeStringKey(r.title).slice(0, 40) === normAch.slice(0, 40))
    );

    if (existingReq) {
      if (existingReq.status === "PENDING") {
        pendingResults.push(existingReq);
      }
      continue;
    }

    const metadata = {
      achievement: achText,
      description: achText,
      source_url: extracted.url,
      source_type: extracted.source,
      imported_at: new Date().toISOString(),
    };

    const request = await createImportRequest(
      userId,
      "achievement",
      externalId,
      achText.length > 70 ? `${achText.slice(0, 67)}...` : achText,
      achText,
      metadata
    );

    if (request) {
      pendingResults.push(request);
    }
  }

  /*
   * ============================================================
   * BIO
   * ============================================================
   */

  if (
    extracted.bio &&
    extracted.bio.length > 20 &&
    normalizeStringKey(extracted.bio) !== normalizeStringKey(existingBio)
  ) {
    const externalId = `linkedin-bio-${userId}-${createSafeId(
      extracted.profileSlug
    )}`;

    const existingReq = existingImports.find(
      (r) => r.item_type === "bio" && r.external_id === externalId
    );

    if (existingReq) {
      if (existingReq.status === "PENDING") {
        pendingResults.push(existingReq);
      }
    } else {
      const metadata = {
        bio: extracted.bio,
        headline: extracted.headline || "",
        source_url: extracted.url,
        source_type: extracted.source,
        imported_at: new Date().toISOString(),
      };

      const request = await createImportRequest(
        userId,
        "bio",
        externalId,
        "LinkedIn Professional Bio",
        extracted.bio,
        metadata
      );

      if (request) {
        pendingResults.push(request);
      }
    }
  }

  const status =
    pendingResults.length > 0 ? "pending_approval" : "no_new_data";

  return {
    success: true,
    status,
    source: "linkedin",
    profile: {
      url: extracted.url,
      profile_slug: extracted.profileSlug,
      ownership,
    },
    extracted,
    newItemsCount: pendingResults.length,
    items: pendingResults,
    pending_items: pendingResults,
    pendingImports: pendingResults,
    counts: {
      projects: pendingResults.filter((item) => item.item_type === "project")
        .length,
      certifications: pendingResults.filter(
        (item) => item.item_type === "certification"
      ).length,
      experience: pendingResults.filter(
        (item) => item.item_type === "experience"
      ).length,
      education: pendingResults.filter((item) => item.item_type === "education")
        .length,
      skills: pendingResults.filter((item) => item.item_type === "skill")
        .length,
      languages: pendingResults.filter((item) => item.item_type === "language")
        .length,
      achievements: pendingResults.filter(
        (item) => item.item_type === "achievement" || item.item_type === "honor"
      ).length,
      bio: pendingResults.filter((item) => item.item_type === "bio").length,
      total: pendingResults.length,
    },
    data_available: true,
    dataAvailable: true,
    message:
      pendingResults.length > 0
        ? `LinkedIn scan completed. ${pendingResults.length} new item(s) require your approval before being added to your HireVision profile.`
        : "Your LinkedIn profile was scanned successfully. No new information was found to import.",
  };
}

function buildFallbackResponse(scan) {
  const pending =
    scan.pending_items ||
    [];

  const sections =
    [];

  sections.push(
    "### LinkedIn Profile Analysis"
  );

  sections.push(
    `**Profile:** ${scan.profile.url}`
  );

  if (!scan.data_available) {
    sections.push(
      scan.message
    );

    return sections.join(
      "\n\n"
    );
  }

  sections.push(
    `I compared the authorized LinkedIn profile data with the existing HireVision profile. **${pending.length} item(s)** are pending approval.`
  );

  const groups = {
    project: "Projects",
    certification: "Certifications",
    experience: "Experience",
    education: "Education",
    skill: "Skills",
    language: "Languages",
    achievement: "Achievements & Honors",
    bio: "Professional Bio",
  };

  for (
    const [
      type,
      label,
    ]
    of Object.entries(
      groups
    )
  ) {
    const items =
      pending.filter(
        (item) =>
          item.item_type ===
          type
      );

    if (!items.length) {
      continue;
    }

    sections.push(
      `#### ${label} (${items.length})`
    );

    sections.push(
      items
        .map(
          (item) =>
            `- **${item.title}**${
              item.description
                ? ` — ${item.description}`
                : ""
            }`
        )
        .join("\n")
    );
  }

  sections.push(
    "**Approval required:** These items are only pending import requests. Nothing is added to the candidate profile until the candidate approves it."
  );

  return sections.join(
    "\n\n"
  );
}

async function handleQuery(
  profile = {},
  query = "",
  context = {}
) {
  const userId =
    context.userId ||
    profile?.user_id ||
    profile?.id;

  let linkedinUrl =
    profile?.social_profiles?.linkedin ||
    profile?.linkedin ||
    "";

  const queryMatch =
    String(query).match(
      /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_%\-]+)/i
    );

  if (queryMatch) {
    linkedinUrl =
      `https://www.linkedin.com/in/${queryMatch[1]}`;
  }

  if (!linkedinUrl) {
    return normalizeAgentResponse(
      "linkedin_agent",
      {
        result: {
          status:
            "connection_required",

          message:
            "Please provide your LinkedIn profile URL.",

          required_input:
            "linkedin_profile_url",
        },

        missing_data: [
          "LinkedIn profile URL",
        ],
      }
    );
  }

  if (!userId) {
    return normalizeAgentResponse(
      "linkedin_agent",
      {
        result: {
          status:
            "authentication_required",

          message:
            "Authentication is required before LinkedIn profile analysis can be performed.",
        },
      },
      {
        error: {
          code:
            "LINKEDIN_AUTHENTICATION_REQUIRED",

          message:
            "Authentication is required.",

          retryable:
            false,
        },
      }
    );
  }

  const rawLinkedInData =
    context.linkedinData ||
    context.linkedinProfileData ||
    context.rawLinkedInData ||
    null;

  let scan;

  try {
    scan =
      await analyzeLinkedin(
        userId,
        linkedinUrl,
        rawLinkedInData
      );
  } catch (error) {
    return normalizeAgentResponse(
      "linkedin_agent",
      {
        result: {
          status:
            "analysis_failed",

          message:
            error.message,
        },
      },
      {
        error: {
          code:
            "LINKEDIN_ANALYSIS_FAILED",

          message:
            error.message,

          retryable:
            true,
        },
      }
    );
  }

  const pending =
    scan.pending_items ||
    [];

  if (!scan.data_available) {
    return normalizeAgentResponse(
      "linkedin_agent",
      {
        result: {
          status:
            "data_required",

          message:
            scan.message,

          linkedin_profile:
            scan.profile,

          extraction:
            scan.extracted,

          next_step:
            "Authorize LinkedIn through the supported HireVision LinkedIn integration so available profile data can be compared with your HireVision profile.",
        },

        missing_data: [
          "Authorized LinkedIn profile data",
        ],

        metadata: {
          source:
            scan.extracted.source,

          profile_url:
            scan.profile.url,
        },
      }
    );
  }

  const systemPrompt = `
You are HireVision's professional LinkedIn Intelligence Agent.

Analyze structured LinkedIn profile data that has been supplied by an authenticated LinkedIn integration.

Rules:
- Use only supplied LinkedIn data.
- Never invent companies, roles, projects, education, certifications, skills, dates, achievements, metrics, or credentials.
- Do not infer professional facts from only a LinkedIn URL or profile slug.
- Distinguish LinkedIn information from HireVision profile information.
- Pending imports are proposals only and require explicit candidate approval.
- Do not claim that pending items have already been imported.
- Do not fabricate credential IDs or credential URLs.
- Do not create fake ATS scores.
- Give concise and professional analysis.
- Return valid JSON only.

Return:
{
  "summary": "",
  "highlights": [],
  "profile_gaps": [],
  "recommendations": [],
  "evidence_notes": []
}
`;

  const payload = {
    user_query:
      String(
        query || ""
      ).trim(),

    linkedin_profile:
      scan.extracted,

    hirevision_profile: {
      full_name:
        profile.full_name ||
        "",

      career_objective:
        profile.career_objective ||
        "",

      skills:
        getNormalizedSkillList(
          profile.skills
        ),

      projects:
        normalizeArray(
          profile.projects
        ),

      experience:
        normalizeArray(
          profile.experience
        ),

      education:
        normalizeArray(
          profile.education
        ),

      certifications:
        normalizeArray(
          profile.certifications
        ),
    },

    pending_imports:
      pending.map(
        (item) => ({
          item_type:
            item.item_type,

          title:
            item.title,

          external_id:
            item.external_id,
        })
      ),
  };

  try {
    const aiResult =
      await callLLM(
        systemPrompt,
        JSON.stringify(
          payload
        ),
        true,
        {
          conversation:
            context.conversation ||
            [],

          temperature:
            0.2,
        }
      );

    const parsed =
      aiResult?.result &&
      typeof aiResult.result === "object"
        ? aiResult.result
        : aiResult;

    return normalizeAgentResponse(
      "linkedin_agent",
      {
        result: {
          ...parsed,

          linkedin_profile:
            scan.extracted,

          pending_imports:
            pending,

          import_requires_approval:
            true,
        },

        missing_data:
          Array.isArray(
            parsed?.profile_gaps
          )
            ? parsed.profile_gaps
            : [],

        metadata: {
          source:
            scan.extracted.source,

          profile_url:
            scan.profile.url,

          pending_import_count:
            pending.length,

          approval_required:
            true,
        },
      }
    );
  } catch (error) {
    const fallback =
      buildFallbackResponse(
        scan
      );

    return normalizeAgentResponse(
      "linkedin_agent",
      {
        result: {
          response:
            fallback,

          pending_imports:
            pending,

          import_requires_approval:
            true,
        },

        metadata: {
          source:
            scan.extracted.source,

          fallback:
            "deterministic",

          pending_import_count:
            pending.length,
        },
      },
      {
        error: {
          code:
            "LINKEDIN_AI_ANALYSIS_UNAVAILABLE",

          message:
            "LinkedIn data was processed successfully, but AI interpretation is temporarily unavailable.",

          retryable:
            true,
        },
      }
    );
  }
}

module.exports = {
  analyzeLinkedin,
  handleQuery,
  extractLinkedInProfileData,
};