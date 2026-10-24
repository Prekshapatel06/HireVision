const jwt = require("jsonwebtoken");

require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    "[HireVision Auth] ERROR: JWT_SECRET is not configured in .env"
  );
}

function sendAuthError(res, status, message, code) {
  return res.status(status).json({
    success: false,
    message,
    code,
  });
}

function extractBearerToken(req) {
  const authorization =
    typeof req.get === "function"
      ? req.get("Authorization")
      : req.headers?.authorization;

  if (!authorization || typeof authorization !== "string") {
    return null;
  }

  let value = authorization.trim();

  if (!value) {
    return null;
  }

  // Strip 'Bearer ' prefix if present (case-insensitive)
  if (value.toLowerCase().startsWith("bearer ")) {
    value = value.substring(7).trim();
  } else if (value.toLowerCase() === "bearer") {
    return null;
  }

  // Strip surrounding quotes if present
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  // If client serialized token inside an object like {"token": "..."}
  if (value.startsWith("{") && value.endsWith("}")) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        const inner =
          parsed.token ||
          parsed.accessToken ||
          parsed.access_token ||
          parsed.hirevision_token;
        if (typeof inner === "string") {
          value = inner.trim();
        }
      }
    } catch {
      // not valid JSON object, keep as is
    }
  }

  if (
    !value ||
    value.toLowerCase() === "undefined" ||
    value.toLowerCase() === "null" ||
    value === "[object Object]"
  ) {
    return null;
  }

  return value;
}

function getUserId(decoded) {
  if (!decoded || typeof decoded !== "object") {
    return null;
  }

  const payload = decoded;

  const candidates = [
    payload.id,
    payload.userId,
    payload.user_id,
    payload.sub,
  ];

  for (const candidate of candidates) {
    if (
      candidate !== undefined &&
      candidate !== null &&
      String(candidate).trim()
    ) {
      return String(candidate).trim();
    }
  }

  return null;
}

function normalizeRole(role) {
  const normalized = String(role || "")
    .trim()
    .toLowerCase();

  if (normalized === "recruiter") {
    return "recruiter";
  }

  return "candidate";
}

module.exports = function authMiddleware(req, res, next) {
  try {
    if (!JWT_SECRET) {
      return sendAuthError(
        res,
        500,
        "Authentication service is not configured correctly.",
        "AUTH_CONFIGURATION_ERROR"
      );
    }

    const token = extractBearerToken(req);

    if (!token) {
      return sendAuthError(
        res,
        401,
        "No authorization token, access denied. Please log in to continue.",
        "AUTH_TOKEN_MISSING"
      );
    }

    let decoded;

    try {
      decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ["HS256"],
      });
    } catch (error) {
      if (error?.name === "TokenExpiredError") {
        return sendAuthError(
          res,
          401,
          "Session expired. Please log in again.",
          "AUTH_TOKEN_EXPIRED"
        );
      }

      if (error?.name === "JsonWebTokenError") {
        return sendAuthError(
          res,
          401,
          "Token is invalid.",
          "AUTH_TOKEN_INVALID"
        );
      }

      if (error?.name === "NotBeforeError") {
        return sendAuthError(
          res,
          401,
          "Authentication token is not active yet.",
          "AUTH_TOKEN_NOT_ACTIVE"
        );
      }

      throw error;
    }

    const userId = getUserId(decoded);

    if (!userId) {
      return sendAuthError(
        res,
        401,
        "Token payload is invalid or does not contain a user ID.",
        "AUTH_TOKEN_PAYLOAD_INVALID"
      );
    }

    req.user = {
      id: userId,
      userId,
      username:
        typeof decoded.username === "string"
          ? decoded.username
          : null,
      email:
        typeof decoded.email === "string"
          ? decoded.email
          : null,
      role: normalizeRole(decoded.role),
    };

    req.auth = {
      authenticated: true,
      tokenIssuedAt: decoded.iat || null,
      tokenExpiresAt: decoded.exp || null,
    };

    return next();
  } catch (error) {
    console.error(
      "[HireVision Auth Middleware] ERROR:",
      error
    );

    return sendAuthError(
      res,
      401,
      "Authentication failed.",
      "AUTHENTICATION_FAILED"
    );
  }
};