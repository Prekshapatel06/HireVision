const crypto = require("crypto");
const zlib = require("zlib");

const LINKEDIN_AUTHORIZATION_URL =
  "https://www.linkedin.com/oauth/v2/authorization";

const LINKEDIN_TOKEN_URL =
  "https://www.linkedin.com/oauth/v2/accessToken";

const LINKEDIN_USERINFO_URL =
  "https://api.linkedin.com/v2/userinfo";

const LINKEDIN_ME_URL =
  "https://api.linkedin.com/v2/me";

const REQUEST_TIMEOUT_MS = Math.max(
  3000,
  Number.parseInt(
    process.env.LINKEDIN_TIMEOUT_MS || "15000",
    10
  ) || 15000
);

/**
 * Convert any text-like value to a clean single-line string.
 */
function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validate and normalize a LinkedIn profile URL.
 *
 * Supported format:
 * https://www.linkedin.com/in/profile-name
 */
function normalizeLinkedInUrl(value) {
  const input = cleanText(value);

  if (!input) {
    throw new Error(
      "LinkedIn profile URL is required."
    );
  }

  const normalized =
    /^https?:\/\//i.test(input)
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

  const hostname =
    parsed.hostname.toLowerCase();

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

  const profileSlug = parts[1];

  return {
    url:
      `https://www.linkedin.com/in/${profileSlug}`,
    profileSlug,
  };
}

/**
 * Read required LinkedIn OAuth configuration.
 */
function getRequiredConfig() {
  const clientId =
    cleanText(
      process.env.LINKEDIN_CLIENT_ID
    );

  const clientSecret =
    cleanText(
      process.env.LINKEDIN_CLIENT_SECRET
    );

  const redirectUri =
    cleanText(
      process.env.LINKEDIN_REDIRECT_URI
    );

  return {
    clientId,
    clientSecret,
    redirectUri,

    configured:
      Boolean(
        clientId &&
        clientSecret &&
        redirectUri
      ),
  };
}

/**
 * Secret used to sign OAuth state.
 *
 * We allow JWT_SECRET as a fallback so development
 * does not silently become insecure when a separate
 * LinkedIn state secret is not yet configured.
 */
function getStateSecret() {
  const secret =
    cleanText(
      process.env.LINKEDIN_OAUTH_STATE_SECRET
    ) ||
    cleanText(
      process.env.JWT_SECRET
    );

  if (!secret) {
    throw new Error(
      "LINKEDIN_OAUTH_STATE_SECRET or JWT_SECRET must be configured."
    );
  }

  return secret;
}

/**
 * Key used for AES-256-GCM encryption of LinkedIn tokens.
 */
function getEncryptionKey() {
  const raw =
    cleanText(
      process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY
    ) ||
    cleanText(
      process.env.JWT_SECRET
    );

  if (!raw) {
    throw new Error(
      "LINKEDIN_TOKEN_ENCRYPTION_KEY or JWT_SECRET must be configured."
    );
  }

  return crypto
    .createHash("sha256")
    .update(raw)
    .digest();
}

function base64UrlEncode(value) {
  return Buffer
    .from(value)
    .toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer
    .from(
      String(value || ""),
      "base64url"
    )
    .toString("utf8");
}

/**
 * Create signed state payload for LinkedIn OAuth.
 *
 * This ensures somebody cannot simply modify userId
 * or profile URL in the OAuth callback.
 */
function signStatePayload(payload) {
  const encoded =
    base64UrlEncode(
      JSON.stringify(payload)
    );

  const signature =
    crypto
      .createHmac(
        "sha256",
        getStateSecret()
      )
      .update(encoded)
      .digest("base64url");

  return `${encoded}.${signature}`;
}

/**
 * Verify OAuth state signature and expiry.
 */
function verifyStatePayload(state) {
  const parts =
    String(state || "")
      .split(".");

  if (
    parts.length !== 2 ||
    !parts[0] ||
    !parts[1]
  ) {
    throw new Error(
      "Invalid LinkedIn authorization state."
    );
  }

  const expected =
    crypto
      .createHmac(
        "sha256",
        getStateSecret()
      )
      .update(parts[0])
      .digest("base64url");

  const providedBuffer =
    Buffer.from(parts[1]);

  const expectedBuffer =
    Buffer.from(expected);

  if (
    providedBuffer.length !==
      expectedBuffer.length ||
    !crypto.timingSafeEqual(
      providedBuffer,
      expectedBuffer
    )
  ) {
    throw new Error(
      "Invalid LinkedIn authorization state."
    );
  }

  let payload;

  try {
    payload =
      JSON.parse(
        base64UrlDecode(
          parts[0]
        )
      );
  } catch {
    throw new Error(
      "Invalid LinkedIn authorization state payload."
    );
  }

  const issuedAt =
    Number(
      payload?.iat || 0
    );

  const maxAgeSeconds =
    Math.max(
      60,
      Number.parseInt(
        process.env.LINKEDIN_STATE_MAX_AGE_SECONDS ||
          "600",
        10
      ) || 600
    );

  if (
    !issuedAt ||
    Date.now() / 1000 - issuedAt >
      maxAgeSeconds
  ) {
    throw new Error(
      "LinkedIn authorization request has expired."
    );
  }

  if (
    !payload?.userId ||
    !payload?.linkedinUrl
  ) {
    throw new Error(
      "LinkedIn authorization state is incomplete."
    );
  }

  return payload;
}

/**
 * Build LinkedIn OAuth authorization URL.
 */
function buildAuthorizationUrl(
  userId,
  linkedinUrl
) {
  const config =
    getRequiredConfig();

  if (!config.configured) {
    const error =
      new Error(
        "LinkedIn integration is not configured. Add LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and LINKEDIN_REDIRECT_URI to backend/.env."
      );

    error.code =
      "LINKEDIN_NOT_CONFIGURED";

    throw error;
  }

  if (!userId) {
    throw new Error(
      "Authenticated HireVision user is required."
    );
  }

  const normalized =
    normalizeLinkedInUrl(
      linkedinUrl
    );

  const state =
    signStatePayload({
      userId:
        String(userId),

      linkedinUrl:
        normalized.url,

      profileSlug:
        normalized.profileSlug,

      iat:
        Math.floor(
          Date.now() / 1000
        ),

      nonce:
        crypto
          .randomBytes(16)
          .toString("hex"),
    });

  const configuredScopes =
    cleanText(
      process.env.LINKEDIN_SCOPES
    );

  const scopes =
    configuredScopes ||
    "openid profile email";

  const params =
    new URLSearchParams({
      response_type:
        "code",

      client_id:
        config.clientId,

      redirect_uri:
        config.redirectUri,

      state,

      scope:
        scopes,
    });

  return {
    authorizationUrl:
      `${LINKEDIN_AUTHORIZATION_URL}?${params.toString()}`,

    normalizedUrl:
      normalized.url,

    profileSlug:
      normalized.profileSlug,
  };
}

/**
 * Encrypt an OAuth access/refresh token before
 * storing it in PostgreSQL.
 */
function encryptToken(value) {
  const token =
    cleanText(value);

  if (!token) {
    return null;
  }

  const iv =
    crypto.randomBytes(12);

  const cipher =
    crypto.createCipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      iv
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        token,
        "utf8"
      ),
      cipher.final(),
    ]);

  const tag =
    cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/**
 * Decrypt a previously encrypted OAuth token.
 */
function decryptToken(value) {
  if (!value) {
    return null;
  }

  const parts =
    String(value)
      .split(".");

  if (
    parts.length !== 4 ||
    parts[0] !== "v1"
  ) {
    throw new Error(
      "Stored LinkedIn token format is invalid."
    );
  }

  const iv =
    Buffer.from(
      parts[1],
      "base64url"
    );

  const tag =
    Buffer.from(
      parts[2],
      "base64url"
    );

  const encrypted =
    Buffer.from(
      parts[3],
      "base64url"
    );

  const decipher =
    crypto.createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      iv
    );

  decipher.setAuthTag(tag);

  return Buffer
    .concat([
      decipher.update(
        encrypted
      ),
      decipher.final(),
    ])
    .toString("utf8");
}

/**
 * Timeout helper compatible with supported Node versions.
 */
function createTimeoutSignal(
  timeoutMs =
    REQUEST_TIMEOUT_MS
) {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return AbortSignal.timeout(
      timeoutMs
    );
  }

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  timer.unref?.();

  return controller.signal;
}

/**
 * Parse LinkedIn API response and normalize API errors.
 */
async function readJsonResponse(
  response,
  fallbackMessage
) {
  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error_description ||
      data?.error ||
      fallbackMessage ||
      `LinkedIn request failed with status ${response.status}.`;

    const error =
      new Error(
        String(message)
      );

    error.status =
      response.status;

    error.code =
      "LINKEDIN_API_ERROR";

    error.linkedinResponse =
      data;

    throw error;
  }

  return data || {};
}

/**
 * Exchange LinkedIn authorization code for OAuth token.
 */
async function exchangeAuthorizationCode(
  code
) {
  const config =
    getRequiredConfig();

  if (!config.configured) {
    const error =
      new Error(
        "LinkedIn integration is not configured."
      );

    error.code =
      "LINKEDIN_NOT_CONFIGURED";

    throw error;
  }

  if (!code) {
    throw new Error(
      "LinkedIn authorization code is required."
    );
  }

  const response =
    await fetch(
      LINKEDIN_TOKEN_URL,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",

          Accept:
            "application/json",
        },

        body:
          new URLSearchParams({
            grant_type:
              "authorization_code",

            code:
              String(code),

            client_id:
              config.clientId,

            client_secret:
              config.clientSecret,

            redirect_uri:
              config.redirectUri,
          }),

        signal:
          createTimeoutSignal(),
      }
    );

  return readJsonResponse(
    response,
    "Unable to exchange LinkedIn authorization code."
  );
}

/**
 * Standard OpenID Connect UserInfo endpoint.
 *
 * This only returns data LinkedIn has authorized
 * for the current application/scopes.
 */
async function fetchLinkedInUserInfo(
  accessToken
) {
  if (!accessToken) {
    throw new Error(
      "LinkedIn access token is required."
    );
  }

  const response =
    await fetch(
      LINKEDIN_USERINFO_URL,
      {
        method:
          "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          Accept:
            "application/json",
        },

        signal:
          createTimeoutSignal(),
      }
    );

  return readJsonResponse(
    response,
    "Unable to retrieve LinkedIn member information."
  );
}

/**
 * Resolve localized LinkedIn API fields.
 */
function localizedValue(value) {
  if (!value) {
    return "";
  }

  if (
    typeof value ===
    "string"
  ) {
    return cleanText(
      value
    );
  }

  if (
    typeof value !==
    "object"
  ) {
    return "";
  }

  if (
    typeof value.localized ===
      "object" &&
    value.localized
  ) {
    const first =
      Object
        .values(
          value.localized
        )
        .find(Boolean);

    return cleanText(
      first
    );
  }

  return cleanText(
    value.name ||
    value.title ||
    value.value
  );
}

/**
 * LinkedIn endpoints often wrap collections inside
 * an `elements` property.
 */
function unwrapElements(value) {
  if (
    Array.isArray(value)
  ) {
    return value;
  }

  if (
    Array.isArray(
      value?.elements
    )
  ) {
    return value.elements;
  }

  if (
    Array.isArray(
      value?.values
    )
  ) {
    return value.values;
  }

  return [];
}

/**
 * Normalize LinkedIn API data to the structure used
 * by HireVision's linkedinAgent.
 *
 * Important:
 * No missing value is fabricated.
 */
function normalizePartnerProfile(
  raw = {}
) {
  const profile =
    raw?.data &&
    typeof raw.data ===
      "object"
      ? raw.data
      : raw;

  const firstName =
    cleanText(
      profile.given_name
    ) ||
    cleanText(
      profile.localizedFirstName
    ) ||
    localizedValue(
      profile.firstName
    );

  const lastName =
    cleanText(
      profile.family_name
    ) ||
    cleanText(
      profile.localizedLastName
    ) ||
    localizedValue(
      profile.lastName
    );

  const name =
    cleanText(
      profile.name
    ) ||
    cleanText(
      `${firstName} ${lastName}`
    );

  const vanityName =
    cleanText(
      profile.vanityName ||
      profile.vanity_name ||
      profile.publicIdentifier
    );

  const experience =
    unwrapElements(
      profile.experience ||
      profile.positions ||
      profile.position
    )
      .map((item) => ({
        company:
          cleanText(
            item?.companyName
          ) ||
          cleanText(
            item?.company
          ) ||
          localizedValue(
            item?.company?.name
          ) ||
          localizedValue(
            item?.organizationName
          ),

        role:
          cleanText(
            item?.title
          ) ||
          cleanText(
            item?.role
          ) ||
          localizedValue(
            item?.positionTitle
          ),

        location:
          cleanText(
            item?.locationName ||
            item?.location
          ),

        start_date:
          cleanText(
            item?.startDate ||
            item?.start_date ||
            item?.timePeriod
              ?.startDate
          ),

        end_date:
          cleanText(
            item?.endDate ||
            item?.end_date ||
            item?.timePeriod
              ?.endDate
          ),

        current:
          Boolean(
            item?.current ||
            item?.isCurrent
          ),

        description:
          cleanText(
            item?.description
          ) ||
          localizedValue(
            item?.description
          ),
      }))
      .filter(
        (item) =>
          item.company ||
          item.role ||
          item.description
      );

  const education =
    unwrapElements(
      profile.education ||
      profile.educations
    )
      .map((item) => ({
        institution:
          cleanText(
            item?.schoolName
          ) ||
          cleanText(
            item?.institution
          ) ||
          localizedValue(
            item?.school?.name
          ),

        degree:
          cleanText(
            item?.degreeName ||
            item?.degree
          ),

        field_of_study:
          cleanText(
            item?.fieldOfStudy ||
            item?.field_of_study
          ),

        start_year:
          cleanText(
            item?.startYear ||
            item?.start_year ||
            item?.timePeriod
              ?.startDate
              ?.year
          ),

        end_year:
          cleanText(
            item?.endYear ||
            item?.end_year ||
            item?.timePeriod
              ?.endDate
              ?.year
          ),

        grade:
          cleanText(
            item?.grade
          ),
      }))
      .filter(
        (item) =>
          item.institution ||
          item.degree ||
          item.field_of_study
      );

  const projects =
    unwrapElements(
      profile.projects
    )
      .map((item) => ({
        title:
          cleanText(
            item?.title ||
            item?.name
          ),

        description:
          cleanText(
            item?.description
          ) ||
          localizedValue(
            item?.description
          ),

        technologies:
          Array.isArray(
            item?.technologies
          )
            ? item.technologies
                .map(
                  (
                    technology
                  ) =>
                    cleanText(
                      typeof technology ===
                        "string"
                        ? technology
                        : technology?.name
                    )
                )
                .filter(Boolean)
            : unwrapElements(
                item?.technologies
              )
                .map(
                  (
                    technology
                  ) =>
                    cleanText(
                      technology?.name ||
                      technology
                    )
                )
                .filter(Boolean),

        role:
          cleanText(
            item?.role
          ),

        duration:
          cleanText(
            item?.duration
          ),
      }))
      .filter(
        (item) =>
          item.title ||
          item.description
      );

  const skills =
    unwrapElements(
      profile.skills
    )
      .map((item) =>
        cleanText(
          item?.name ||
          item?.skill?.name ||
          item?.skill ||
          item
        )
      )
      .filter(Boolean);

  const certifications =
    unwrapElements(
      profile.certifications ||
      profile.certificates ||
      profile.licenses
    )
      .map((item) => ({
        name:
          cleanText(
            item?.name ||
            item?.title
          ),

        issuer:
          cleanText(
            item?.issuer ||
            item?.authority ||
            item?.organization
          ),

        issue_date:
          cleanText(
            item?.issueDate ||
            item?.issue_date
          ),

        expiration_date:
          cleanText(
            item?.expirationDate ||
            item?.expiration_date
          ),

        credential_id:
          cleanText(
            item?.credentialId ||
            item?.credential_id
          ),

        credential_url:
          cleanText(
            item?.credentialUrl ||
            item?.credential_url
          ),
      }))
      .filter(
        (item) =>
          item.name ||
          item.issuer
      );

  return {
    member_id:
      cleanText(
        profile.sub ||
        profile.id ||
        profile.memberId
      ),

    name,

    first_name:
      firstName,

    last_name:
      lastName,

    email:
      cleanText(
        profile.email
      ),

    picture:
      cleanText(
        profile.picture
      ),

    headline:
      cleanText(
        profile.headline
      ) ||
      cleanText(
        profile.localizedHeadline
      ),

    bio:
      cleanText(
        profile.summary ||
        profile.about ||
        profile.bio
      ),

    vanity_name:
      vanityName,

    profile_url:
      cleanText(
        profile.profile_url ||
        profile.profileUrl ||
        (
          vanityName
            ? `https://www.linkedin.com/in/${vanityName}`
            : ""
        )
      ),

    experience,

    education,

    projects,

    skills,

    certifications,
  };
}

/**
 * Retrieve additional Profile API data only when
 * the HireVision LinkedIn application has received
 * permission for the configured API.
 *
 * It is intentionally disabled by default.
 */
async function fetchLinkedInProfileApi(
  accessToken
) {
  const enabled =
    String(
      process.env.LINKEDIN_ENABLE_PROFILE_API ||
      "false"
    ).toLowerCase() ===
    "true";

  const configuredUrl =
    cleanText(
      process.env.LINKEDIN_PROFILE_API_URL
    );

  if (
    !enabled &&
    !configuredUrl
  ) {
    return null;
  }

  const url =
    configuredUrl ||
    LINKEDIN_ME_URL;

  let parsed;

  try {
    parsed =
      new URL(url);
  } catch {
    throw new Error(
      "LINKEDIN_PROFILE_API_URL is invalid."
    );
  }

  /*
   * Never send OAuth token to an arbitrary host.
   */
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !==
      "api.linkedin.com"
  ) {
    throw new Error(
      "LINKEDIN_PROFILE_API_URL must use https://api.linkedin.com so the member token is never sent to an untrusted host."
    );
  }

  const headers = {
    Authorization:
      `Bearer ${accessToken}`,

    Accept:
      "application/json",

    "X-Restli-Protocol-Version":
      "2.0.0",
  };

  const linkedInVersion =
    cleanText(
      process.env.LINKEDIN_API_VERSION
    );

  if (
    linkedInVersion
  ) {
    headers[
      "LinkedIn-Version"
    ] = linkedInVersion;
  }

  const response =
    await fetch(
      parsed.toString(),
      {
        method:
          "GET",

        headers,

        signal:
          createTimeoutSignal(),
      }
    );

  return readJsonResponse(
    response,
    "Unable to retrieve the authorized LinkedIn profile."
  );
}

/**
 * Merge OIDC user data and optional extended profile data.
 *
 * Extended data always takes precedence where available.
 */
function mergeStructuredProfile(
  userInfo,
  profileApiData,
  requestedUrl
) {
  const basic =
    normalizePartnerProfile(
      userInfo || {}
    );

  const extended =
    normalizePartnerProfile(
      profileApiData || {}
    );

  const requested =
    normalizeLinkedInUrl(
      requestedUrl
    );

  const merged = {
    ...basic,
    ...extended,

    name:
      extended.name ||
      basic.name,

    first_name:
      extended.first_name ||
      basic.first_name,

    last_name:
      extended.last_name ||
      basic.last_name,

    email:
      extended.email ||
      basic.email,

    picture:
      extended.picture ||
      basic.picture,

    headline:
      extended.headline ||
      basic.headline,

    bio:
      extended.bio ||
      basic.bio,

    member_id:
      extended.member_id ||
      basic.member_id,

    vanity_name:
      extended.vanity_name ||
      basic.vanity_name,

    profile_url:
      extended.profile_url ||
      basic.profile_url ||
      requested.url,

    experience:
      extended.experience
        ?.length > 0
        ? extended.experience
        : basic.experience ||
          [],

    education:
      extended.education
        ?.length > 0
        ? extended.education
        : basic.education ||
          [],

    projects:
      extended.projects
        ?.length > 0
        ? extended.projects
        : basic.projects ||
          [],

    skills:
      extended.skills
        ?.length > 0
        ? extended.skills
        : basic.skills ||
          [],

    certifications:
      extended.certifications
        ?.length > 0
        ? extended.certifications
        : basic.certifications ||
          [],
  };

  /*
   * If LinkedIn actually supplies the member's public/vanity
   * identifier, verify it matches the URL entered by candidate.
   *
   * When LinkedIn does not expose the vanity identifier under
   * the app's current permission set, HireVision does NOT claim
   * the URL itself was independently verified. The data is still
   * marked as coming from the member who authorized OAuth.
   */
  if (
    merged.vanity_name
  ) {
    if (
      merged.vanity_name
        .toLowerCase() !==
      requested.profileSlug
        .toLowerCase()
    ) {
      const error =
        new Error(
          "The LinkedIn account you authorized does not match the profile URL entered in HireVision. Please authorize the same LinkedIn account."
        );

      error.code =
        "LINKEDIN_PROFILE_MISMATCH";

      throw error;
    }
  }

  return {
    ...merged,

    source:
      profileApiData
        ? "linkedin_authorized_profile_api"
        : "linkedin_oidc",

    /*
     * Means the returned data came from the member
     * who completed LinkedIn OAuth.
     */
    verified_member:
      true,

    requested_profile_url:
      requested.url,

    /*
     * Do not pretend richer data exists.
     */
    extraction_available:
      Boolean(
        merged.bio ||
        merged.headline ||
        merged.experience
          .length ||
        merged.education
          .length ||
        merged.projects
          .length ||
        merged.skills
          .length ||
        merged.certifications
          .length
      ),
  };
}

/**
 * Fetch all LinkedIn information HireVision is legally
 * and technically allowed to access for the authorized member.
 */
async function fetchAuthorizedLinkedInProfile(
  accessToken,
  requestedUrl
) {
  if (!accessToken) {
    throw new Error(
      "LinkedIn access token is required."
    );
  }

  const userInfo =
    await fetchLinkedInUserInfo(
      accessToken
    );

  let profileApiData =
    null;

  try {
    profileApiData =
      await fetchLinkedInProfileApi(
        accessToken
      );
  } catch (error) {
    const profileApiRequired =
      String(
        process.env.LINKEDIN_PROFILE_API_REQUIRED ||
        "false"
      ).toLowerCase() ===
      "true";

    if (
      profileApiRequired
    ) {
      throw error;
    }

    console.warn(
      "[LinkedIn Client] Extended Profile API unavailable; continuing with authorized OIDC profile:",
      error.message
    );
  }

  return mergeStructuredProfile(
    userInfo,
    profileApiData,
    requestedUrl
  );
}

/**
 * Convert LinkedIn token expiry seconds to Date.
 */
function tokenExpiryDate(
  expiresInSeconds
) {
  const seconds =
    Number(
      expiresInSeconds ||
      0
    );

  if (
    !Number.isFinite(
      seconds
    ) ||
    seconds <= 0
  ) {
    return null;
  }

  return new Date(
    Date.now() +
    seconds * 1000
  );
}

/**
 * Robust CSV parser that handles quotes, newlines inside fields, and commas.
 */
function parseCSV(text) {
  if (!text || typeof text !== "string") return [];
  
  // Strip BOM if present
  let cleanInput = text;
  if (cleanInput.charCodeAt(0) === 0xfeff) {
    cleanInput = cleanInput.slice(1);
  }

  const rows = [];
  let currentRow = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i];
    const nextChar = cleanInput[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      currentField = "";
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) =>
    cleanText(h)
      .replace(/^\uFEFF/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/^_+|_+$/g, "")
  );

  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = cleanText(row[index] || "");
    });
    return obj;
  });
}

/**
 * Extract files from a zip buffer using standard Node zlib with Central Directory support.
 */
function extractZipFiles(buffer) {
  const files = {};
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    return files;
  }

  // 1. Try reading via End of Central Directory (EOCD) - handles streaming/descriptors accurately
  let eocdOffset = -1;
  const maxSearch = Math.min(buffer.length, 65557);
  for (let i = buffer.length - 22; i >= buffer.length - maxSearch; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    try {
      const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
      const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
      let entryOffset = cdOffset;

      for (let i = 0; i < totalEntries && entryOffset < buffer.length - 46; i++) {
        if (buffer.readUInt32LE(entryOffset) !== 0x02014b50) break;
        const compression = buffer.readUInt16LE(entryOffset + 10);
        const compressedSize = buffer.readUInt32LE(entryOffset + 20);
        const fileNameLen = buffer.readUInt16LE(entryOffset + 28);
        const extraLen = buffer.readUInt16LE(entryOffset + 30);
        const commentLen = buffer.readUInt16LE(entryOffset + 32);
        const localHeaderOffset = buffer.readUInt32LE(entryOffset + 42);

        const fileName = buffer.toString(
          "utf8",
          entryOffset + 46,
          entryOffset + 46 + fileNameLen
        );
        entryOffset += 46 + fileNameLen + extraLen + commentLen;

        if (localHeaderOffset + 30 <= buffer.length && buffer.readUInt32LE(localHeaderOffset) === 0x04034b50) {
          const localFileNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
          const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
          const dataOffset = localHeaderOffset + 30 + localFileNameLen + localExtraLen;

          if (dataOffset + compressedSize <= buffer.length) {
            const compData = buffer.subarray(dataOffset, dataOffset + compressedSize);
            let content = "";
            try {
              if (compression === 0) {
                content = compData.toString("utf8");
              } else if (compression === 8) {
                content = zlib.inflateRawSync(compData).toString("utf8");
              }
            } catch {
              content = "";
            }

            const baseName = fileName.split(/[/\\]/).pop();
            if (baseName && content) {
              files[baseName.toLowerCase()] = content;
            }
          }
        }
      }
      if (Object.keys(files).length > 0) {
        return files;
      }
    } catch {}
  }

  // 2. Fallback to sequential local file headers
  let offset = 0;
  while (offset < buffer.length - 30) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      break;
    }

    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const fileName = buffer.toString(
      "utf8",
      offset + 30,
      offset + 30 + fileNameLen
    );
    const dataOffset = offset + 30 + fileNameLen + extraLen;

    if (compressedSize > 0 && dataOffset + compressedSize <= buffer.length) {
      const compressedData = buffer.subarray(
        dataOffset,
        dataOffset + compressedSize
      );

      let content = "";
      try {
        if (compression === 0) {
          content = compressedData.toString("utf8");
        } else if (compression === 8) {
          content = zlib.inflateRawSync(compressedData).toString("utf8");
        }
      } catch {
        content = "";
      }

      const baseName = fileName.split(/[/\\]/).pop();
      if (baseName && content) {
        files[baseName.toLowerCase()] = content;
      }

      offset = dataOffset + compressedSize;
    } else {
      break;
    }
  }

  return files;
}

/**
 * Parse an official LinkedIn data archive export (zip Buffer, single CSV text, array of uploaded files, or a map of files).
 * Extracts strictly genuine data without any fabrication.
 */
function parseLinkedInArchive(input, originalFilename = "") {
  let fileMap = {};

  const processSingleFile = (bufOrStr, name = "") => {
    if (Buffer.isBuffer(bufOrStr)) {
      const cleanOrigName = String(name || "").toLowerCase();
      if (cleanOrigName.endsWith(".csv")) {
        const baseName = cleanOrigName.split(/[/\\]/).pop().toLowerCase();
        fileMap[baseName] = bufOrStr.toString("utf8");
      } else {
        const extracted = extractZipFiles(bufOrStr);
        if (Object.keys(extracted).length > 0) {
          Object.assign(fileMap, extracted);
        } else {
          const text = bufOrStr.toString("utf8");
          if (text.includes(",") && (text.includes("\n") || text.includes("\r"))) {
            fileMap[cleanOrigName || "data.csv"] = text;
          }
        }
      }
    } else if (typeof bufOrStr === "string") {
      const key = (name || "data.csv").toLowerCase();
      fileMap[key] = bufOrStr;
    }
  };

  if (Array.isArray(input)) {
    for (const item of input) {
      if (item && typeof item === "object") {
        const buf = item.buffer || item.content || item.data;
        const name = item.originalname || item.filename || item.name || "";
        processSingleFile(buf, name);
      }
    }
  } else if (typeof input === "object" && input !== null && !Buffer.isBuffer(input)) {
    fileMap = input;
  } else {
    processSingleFile(input, originalFilename);
  }

  // Flexible lookup helper for filenames inside fileMap
  const findContent = (...patterns) => {
    for (const pat of patterns) {
      const p = pat.toLowerCase().trim();
      for (const [key, content] of Object.entries(fileMap)) {
        const k = key.toLowerCase();
        const base = k.split(/[/\\]/).pop().replace(/\.csv$/, "");
        if (k === `${p}.csv` || k === p || base === p || base.includes(p)) {
          return content;
        }
      }
    }
    return "";
  };

  let positionsCSV = findContent("positions", "experience", "work_experience", "jobs");
  let educationCSV = findContent("education", "schools");
  let skillsCSV = findContent("skills", "skill");
  let certificationsCSV = findContent("certifications", "certificates", "licenses");
  let learningCSV = findContent("learning");
  let coursesCSV = findContent("courses", "course");
  let projectsCSV = findContent("projects", "project");
  let languagesCSV = findContent("languages", "language");
  let honorsCSV = findContent("honors", "awards", "honor", "award");
  let richMediaCSV = findContent("rich_media", "rich media", "media");
  let profileCSV = findContent("profile");
  let summaryCSV = findContent("profile_summary", "profile summary", "summary");

  // If a single CSV was uploaded with a generic or renamed filename, sniff its headers
  if (
    !positionsCSV &&
    !educationCSV &&
    !skillsCSV &&
    !certificationsCSV &&
    !projectsCSV &&
    !languagesCSV
  ) {
    for (const content of Object.values(fileMap)) {
      if (typeof content !== "string" || !content.trim()) continue;
      const firstLine = content.split(/[\r\n]+/)[0].toLowerCase();
      if (firstLine.includes("company") || (firstLine.includes("title") && firstLine.includes("started"))) {
        positionsCSV = content;
      } else if (firstLine.includes("school") || firstLine.includes("degree")) {
        educationCSV = content;
      } else if (firstLine.includes("authority") || firstLine.includes("license")) {
        certificationsCSV = content;
      } else if (firstLine.includes("proficiency") && firstLine.includes("name")) {
        languagesCSV = content;
      } else if (firstLine.includes("content title") || firstLine.includes("last watched")) {
        learningCSV = content;
      } else if (firstLine.includes("media description") || firstLine.includes("media link")) {
        richMediaCSV = content;
      } else if (firstLine.includes("skill") || (firstLine.startsWith("name") && !firstLine.includes(","))) {
        skillsCSV = content;
      } else if (firstLine.includes("headline") || firstLine.includes("summary")) {
        profileCSV = content;
      } else if (firstLine.includes("project") || (firstLine.includes("title") && firstLine.includes("description"))) {
        projectsCSV = content;
      }
    }
  }

  const positionsData = parseCSV(positionsCSV);
  const educationData = parseCSV(educationCSV);
  const skillsData = parseCSV(skillsCSV);
  const certificationsData = parseCSV(certificationsCSV);
  const learningData = parseCSV(learningCSV);
  const coursesData = parseCSV(coursesCSV);
  const projectsData = parseCSV(projectsCSV);
  const languagesData = parseCSV(languagesCSV);
  const honorsData = parseCSV(honorsCSV);
  const richMediaData = parseCSV(richMediaCSV);
  const profileDataRows = parseCSV(profileCSV);
  const summaryDataRows = parseCSV(summaryCSV);

  // 1. Work Experience / Positions
  const experience = positionsData
    .map((row) => ({
      company: cleanText(row.company_name || row.company || row.employer),
      role: cleanText(row.title || row.role || row.position),
      location: cleanText(row.location),
      start_date: cleanText(row.started_on || row.start_date),
      end_date: cleanText(row.finished_on || row.end_date),
      current: !row.finished_on && Boolean(row.started_on),
      description: cleanText(row.description),
    }))
    .filter((x) => x.company || x.role || x.description);

  // 2. Education
  const education = educationData
    .map((row) => ({
      institution: cleanText(
        row.school_name || row.institution || row.university
      ),
      degree: cleanText(row.degree_name || row.degree),
      field_of_study: cleanText(
        row.notes || row.activities || row.field_of_study || row.branch
      ),
      start_year: cleanText(
        row.start_date ? row.start_date.split("/").pop() : ""
      ),
      end_year: cleanText(row.end_date ? row.end_date.split("/").pop() : ""),
      grade: "",
    }))
    .filter((x) => x.institution || x.degree);

  // 3. Skills
  const skills = skillsData
    .map((row) => cleanText(row.name || row.skill || row.skill_name || row.title))
    .filter(Boolean);

  // 4. Certifications (combined from Certifications.csv, Learning.csv, Courses.csv, and verified Rich_Media.csv)
  const certifications = [];
  const seenCertKeys = new Set();

  for (const row of certificationsData) {
    const name = cleanText(row.name || row.title);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seenCertKeys.has(key)) continue;
    seenCertKeys.add(key);

    certifications.push({
      name,
      issuer: cleanText(row.authority || row.issuer || row.organization),
      issue_date: cleanText(row.started_on || row.issue_date),
      expiration_date: cleanText(row.finished_on || row.expiration_date),
      credential_id: cleanText(row.license_number || row.credential_id),
      credential_url: cleanText(row.url || row.credential_url),
    });
  }

  // Add completed courses from LinkedIn Learning
  for (const row of learningData) {
    const title = cleanText(row.content_title || row.title);
    if (!title) continue;
    const key = title.toLowerCase();
    if (seenCertKeys.has(key)) continue;
    seenCertKeys.add(key);

    const completedDate = cleanText(row.content_completed_at || row.content_last_watched_date);
    const dateFormatted = completedDate ? completedDate.split(" ")[0] : "";

    certifications.push({
      name: title,
      issuer: "LinkedIn Learning",
      issue_date: dateFormatted,
      expiration_date: "",
      credential_id: "",
      credential_url: "",
    });
  }

  // Add academic coursework
  for (const row of coursesData) {
    const title = cleanText(row.name || row.course_name);
    if (!title) continue;
    const key = title.toLowerCase();
    if (seenCertKeys.has(key)) continue;
    seenCertKeys.add(key);

    certifications.push({
      name: title,
      issuer: "Coursework",
      issue_date: "",
      expiration_date: "",
      credential_id: cleanText(row.number),
      credential_url: "",
    });
  }

  // 5. Projects (from Projects.csv and documented hackathons/projects in Rich_Media.csv)
  const projects = [];
  const seenProjKeys = new Set();

  for (const row of projectsData) {
    const title = cleanText(row.title || row.name);
    if (!title) continue;
    const key = title.toLowerCase();
    if (seenProjKeys.has(key)) continue;
    seenProjKeys.add(key);

    projects.push({
      title,
      description: cleanText(row.description),
      technologies: "",
      role: "",
      duration: cleanText(
        row.started_on
          ? `${row.started_on} - ${row.finished_on || "Present"}`
          : ""
      ),
      live_link: cleanText(row.url),
      github_link: "",
    });
  }

  // Extract certificates and hackathons from Rich_Media.csv if available
  for (const row of richMediaData) {
    const desc = cleanText(row.media_description);
    const link = cleanText(row.media_link);
    if (!desc || desc === "-" || desc.length < 15) continue;

    const isCert = /certificat|completed the|earned the|course/i.test(desc);
    const isHackathon = /hackathon|scetathon|idea pitching/i.test(desc);

    if (isCert) {
      let certName = "";
      let issuer = "";

      const nptelMatch = desc.match(/completed the NPTEL certification course [“"?'‘]([^”"?'’]+)[”"?'’]/i);
      if (nptelMatch) {
        certName = `NPTEL: ${nptelMatch[1].trim()}`;
        issuer = "NPTEL / IIT Madras";
      } else {
        const completedMatch = desc.match(/(?:completed|earned) the ([^.\n!]+? (?:certification|course|program))/i);
        if (completedMatch) {
          certName = completedMatch[1].replace(/^[“"?'‘]+|[”"?'’]+$/g, "").trim();
        }
      }

      if (!certName) {
        const certMatch = desc.match(/([A-Z][A-Za-z0-9\s,&-]+? (?:certification|certificate))/i);
        if (certMatch) certName = certMatch[1].trim();
      }

      const fromMatch = desc.match(/from ([A-Z][A-Za-z0-9\s&]+?)(?:\.|\n|#|!|In |$)/);
      if (fromMatch && !issuer) {
        issuer = fromMatch[1].trim();
      }

      if (certName) {
        const key = certName.toLowerCase();
        if (!seenCertKeys.has(key)) {
          seenCertKeys.add(key);
          certifications.push({
            name: certName,
            issuer: issuer || "Verified Credential",
            issue_date: "",
            expiration_date: "",
            credential_id: "",
            credential_url: link.startsWith("http") ? link : "",
          });
        }
      }
    }
  }

  // 6. Languages
  const languages = languagesData
    .map((row) => {
      const language = cleanText(row.name || row.language);
      if (!language) return null;

      const rawProf = cleanText(row.proficiency).toLowerCase();
      let proficiency = "Professional / Fluent";
      if (rawProf.includes("native") || rawProf.includes("bilingual")) {
        proficiency = "Native / Bilingual";
      } else if (rawProf.includes("professional") || rawProf.includes("fluent") || rawProf.includes("full")) {
        proficiency = "Professional / Fluent";
      } else if (rawProf.includes("intermediate") || rawProf.includes("working") || rawProf.includes("limited")) {
        proficiency = "Intermediate";
      } else if (rawProf.includes("elementary") || rawProf.includes("basic") || rawProf.includes("conversational")) {
        proficiency = "Conversational / Basic";
      }

      return { language, proficiency };
    })
    .filter(Boolean);

  // 7. Achievements / Honors (from Honors.csv and documented hackathons, competitions, awards in Rich_Media.csv)
  const achievements = honorsData
    .map((row) => {
      const title = cleanText(row.title || row.honor || row.award);
      if (!title) return "";
      const issuer = cleanText(row.issuer || row.organization);
      return issuer ? `${title} (${issuer})` : title;
    })
    .filter(Boolean);

  const seenAchKeys = new Set(
    achievements.map((a) => cleanText(a).toLowerCase().slice(0, 60))
  );

  // Extract hackathons, competitions, awards, and honors from Rich_Media.csv
  for (const row of richMediaData) {
    const desc = cleanText(row.media_description);
    if (!desc || desc === "-" || desc.length < 15) continue;

    const isAchievement =
      /hackathon|scetathon|idea pitching|competition|contest|award|honor|olympiad/i.test(desc);

    if (isAchievement) {
      const key = desc.toLowerCase().slice(0, 60);
      if (!seenAchKeys.has(key)) {
        seenAchKeys.add(key);
        achievements.push(desc);
      }
    }
  }

  // 8. Profile Details
  const profileRow = profileDataRows[0] || {};
  const firstName = cleanText(profileRow.first_name);
  const lastName = cleanText(profileRow.last_name);
  const name =
    firstName || lastName ? `${firstName} ${lastName}`.trim() : "";
  const headline = cleanText(profileRow.headline);
  const summaryRow = summaryDataRows[0] || {};
  const bio = cleanText(
    profileRow.summary ||
      summaryRow.profile_summary ||
      summaryRow.summary ||
      Object.values(summaryRow)[0]
  );

  const hasExtractedData = Boolean(
    experience.length ||
      education.length ||
      skills.length ||
      certifications.length ||
      projects.length ||
      languages.length ||
      achievements.length ||
      bio ||
      headline
  );

  const archivePayload = {
    source: "linkedin_archive_export",
    verified_member: true,
    extraction_available: hasExtractedData,
    name,
    first_name: firstName,
    last_name: lastName,
    headline,
    bio,
    experience,
    education,
    skills,
    certifications,
    projects,
    languages,
    achievements,
  };

  return {
    success: hasExtractedData,
    extraction_available: hasExtractedData,
    data: archivePayload,
    ...archivePayload,
    message: hasExtractedData
      ? "LinkedIn archive parsed successfully."
      : "The uploaded file was recognized, but no career records (positions, skills, education, certifications, projects, or languages) were found inside. Please make sure to upload your LinkedIn data export archive (.zip) or CSV files (e.g. Positions.csv, Skills.csv).",
  };
}

module.exports = {
  buildAuthorizationUrl,

  verifyStatePayload,

  exchangeAuthorizationCode,

  fetchLinkedInUserInfo,

  fetchAuthorizedLinkedInProfile,

  normalizeLinkedInUrl,

  normalizePartnerProfile,

  parseLinkedInArchive,

  encryptToken,

  decryptToken,

  tokenExpiryDate,

  getRequiredConfig,
};