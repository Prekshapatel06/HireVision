const DEFAULT_TIMEOUT = Number.parseInt(
  process.env.GITHUB_TIMEOUT_MS || "10000",
  10
);

const MAX_RETRIES = Number.parseInt(
  process.env.GITHUB_MAX_RETRIES || "2",
  10
);

const BASE_URL = "https://api.github.com";

function getGithubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent":
      process.env.GITHUB_USER_AGENT || "HireVision-AI",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

function normalizeGithubUrl(url) {
  if (!url) {
    throw new Error("GitHub API URL is required.");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Invalid GitHub API URL.");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== "api.github.com"
  ) {
    throw new Error(
      "GitHub client only allows requests to api.github.com."
    );
  }

  return parsedUrl.toString();
}

function isRetryableStatus(status) {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function getRetryDelay(response, attempt) {
  const retryAfter = response?.headers?.get("retry-after");

  if (retryAfter) {
    const seconds = Number.parseInt(
      retryAfter,
      10
    );

    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, 30000);
    }
  }

  return Math.min(
    1000 * 2 ** attempt,
    5000
  );
}

function createTimeoutSignal(timeoutMs) {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  timeout.unref?.();

  return controller.signal;
}

async function githubGet(url, options = {}) {
  const normalizedUrl = normalizeGithubUrl(url);

  const timeoutMs = Number.isFinite(
    Number(options.timeoutMs)
  )
    ? Math.max(1000, Number(options.timeoutMs))
    : DEFAULT_TIMEOUT;

  const retries = Number.isFinite(
    Number(options.retries)
  )
    ? Math.max(0, Number(options.retries))
    : MAX_RETRIES;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response;

    try {
      response = await fetch(normalizedUrl, {
        method: "GET",
        headers: getGithubHeaders(),
        signal: createTimeoutSignal(timeoutMs),
      });
    } catch (err) {
      lastError = err;

      const isAbort =
        err?.name === "AbortError" ||
        err?.name === "TimeoutError";

      if (attempt >= retries) {
        const error = new Error(
          isAbort
            ? "GitHub API request timed out."
            : "Unable to connect to GitHub API."
        );

        error.code = isAbort
          ? "GITHUB_TIMEOUT"
          : "GITHUB_NETWORK_ERROR";

        error.cause = err;

        throw error;
      }

      continue;
    }

    if (
      response.ok ||
      !isRetryableStatus(response.status) ||
      attempt >= retries
    ) {
      return response;
    }

    const delay = getRetryDelay(
      response,
      attempt
    );

    await new Promise((resolve) => {
      const timeout = setTimeout(
        resolve,
        delay
      );

      timeout.unref?.();
    });

    lastError = new Error(
      `GitHub API returned retryable status ${response.status}.`
    );
  }

  throw (
    lastError ||
    new Error("GitHub API request failed.")
  );
}

async function readGithubJson(response) {
  if (!response) {
    throw new Error(
      "GitHub response is required."
    );
  }

  let data;

  try {
    data = await response.json();
  } catch (err) {
    const error = new Error(
      "GitHub API returned an invalid JSON response."
    );

    error.code = "GITHUB_INVALID_JSON";
    error.cause = err;

    throw error;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      `GitHub API request failed with status ${response.status}.`;

    const error = new Error(message);

    error.status = response.status;
    error.code =
      response.status === 401
        ? "GITHUB_UNAUTHORIZED"
        : response.status === 403
          ? "GITHUB_FORBIDDEN"
          : response.status === 404
            ? "GITHUB_NOT_FOUND"
            : response.status === 429
              ? "GITHUB_RATE_LIMIT"
              : "GITHUB_API_ERROR";

    error.githubResponse = data;

    throw error;
  }

  return data;
}

function getGithubRateLimit(response) {
  if (!response?.headers) {
    return null;
  }

  const limit = Number.parseInt(
    response.headers.get("x-ratelimit-limit") || "",
    10
  );

  const remaining = Number.parseInt(
    response.headers.get("x-ratelimit-remaining") || "",
    10
  );

  const reset = Number.parseInt(
    response.headers.get("x-ratelimit-reset") || "",
    10
  );

  return {
    limit: Number.isFinite(limit)
      ? limit
      : null,
    remaining: Number.isFinite(remaining)
      ? remaining
      : null,
    resetAt: Number.isFinite(reset)
      ? new Date(reset * 1000).toISOString()
      : null,
  };
}

function isGithubUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (
        url.hostname === "github.com" ||
        url.hostname === "www.github.com"
      )
    );
  } catch {
    return false;
  }
}

function normalizeGithubProfileUrl(value) {
  if (!isGithubUrl(value)) {
    throw new Error(
      "A valid GitHub profile URL is required."
    );
  }

  const url = new URL(value);

  const parts = url.pathname
    .split("/")
    .filter(Boolean);

  if (parts.length !== 1) {
    throw new Error(
      "A valid GitHub profile URL must point to a user profile."
    );
  }

  return `https://github.com/${encodeURIComponent(
    parts[0]
  )}`;
}

function getGithubApiUrl(pathname) {
  if (!pathname) {
    throw new Error(
      "GitHub API path is required."
    );
  }

  const normalizedPath = pathname.startsWith("/")
    ? pathname
    : `/${pathname}`;

  return `${BASE_URL}${normalizedPath}`;
}

module.exports = {
  getGithubHeaders,
  githubGet,
  readGithubJson,
  getGithubRateLimit,
  isGithubUrl,
  normalizeGithubProfileUrl,
  getGithubApiUrl,
};