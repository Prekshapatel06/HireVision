const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../config/db");

require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const FRONTEND_URL = (
  process.env.FRONTEND_URL || "http://localhost:3000"
).replace(/\/$/, "");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:5000/api/auth/google/callback";

const MICROSOFT_CLIENT_ID =
  process.env.MICROSOFT_CLIENT_ID || "";
const MICROSOFT_CLIENT_SECRET =
  process.env.MICROSOFT_CLIENT_SECRET || "";
const MICROSOFT_REDIRECT_URI =
  process.env.MICROSOFT_REDIRECT_URI ||
  "http://localhost:5000/api/auth/microsoft/callback";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is missing. Please add JWT_SECRET to backend/.env"
  );
}

const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();

const normalizeRole = (role) =>
  role === "recruiter" ? "recruiter" : "candidate";

const sanitizeUser = (user) => {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: normalizeRole(user.role),
  };
};

const createAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: normalizeRole(user.role),
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      algorithm: "HS256",
    }
  );
};

const createOAuthState = (role) => {
  return jwt.sign(
    {
      role: normalizeRole(role),
      nonce: crypto.randomBytes(32).toString("hex"),
    },
    JWT_SECRET,
    {
      expiresIn: "10m",
      algorithm: "HS256",
    }
  );
};

const verifyOAuthState = (state) => {
  if (!state) {
    return {
      valid: false,
      role: "candidate",
    };
  }

  try {
    const decoded = jwt.verify(
      String(state),
      JWT_SECRET,
      {
        algorithms: ["HS256"],
      }
    );

    return {
      valid: true,
      role: normalizeRole(decoded.role),
    };
  } catch {
    return {
      valid: false,
      role: "candidate",
    };
  }
};

const redirectToLoginError = (res, message) => {
  return res.redirect(
    `${FRONTEND_URL}/login?error=${encodeURIComponent(
      String(message || "Authentication failed.")
    )}`
  );
};

const createCandidateProfile = async (
  user,
  profilePhoto = null
) => {
  try {
    await db.query(
      `
      INSERT INTO profiles
        (
          user_id,
          full_name,
          profile_photo,
          skills,
          social_profiles
        )
      VALUES
        (
          $1,
          $2,
          $3,
          $4::jsonb,
          $5::jsonb
        )
      ON CONFLICT (user_id) DO NOTHING
      `,
      [
        user.id,
        user.username,
        profilePhoto,
        JSON.stringify({
          programming_languages: [],
          frameworks: [],
          libraries: [],
          databases: [],
          developer_tools: [],
          soft_skills: [],
        }),
        JSON.stringify({
          linkedin: "",
          github: "",
          portfolio: "",
          leetcode: "",
          codechef: "",
          hackerrank: "",
        }),
      ]
    );
  } catch (error) {
    console.error(
      "CANDIDATE PROFILE CREATION ERROR:",
      error.message
    );
  }
};

const createRecruiterProfile = async (user) => {
  try {
    await db.query(
      `
      INSERT INTO recruiter_profiles
        (
          user_id,
          company_name,
          industry
        )
      VALUES
        (
          $1,
          'HireVision Organization',
          'Technology'
        )
      ON CONFLICT (user_id) DO NOTHING
      `,
      [user.id]
    );
  } catch (error) {
    console.error(
      "RECRUITER PROFILE CREATION ERROR:",
      error.message
    );
  }
};

const ensureRoleProfile = async (
  user,
  profilePhoto = null
) => {
  if (normalizeRole(user.role) === "candidate") {
    await createCandidateProfile(
      user,
      profilePhoto
    );
  } else {
    await createRecruiterProfile(user);
  }
};

const generateOAuthPasswordHash = async () => {
  const randomSecret = crypto
    .randomBytes(64)
    .toString("hex");

  return bcrypt.hash(randomSecret, 12);
};

const findUserByEmail = async (email) => {
  const result = await db.query(
    `
    SELECT
      id,
      username,
      email,
      password,
      role,
      created_at,
      auth_provider,
      google_id,
      microsoft_id
    FROM users
    WHERE LOWER(TRIM(email)) = $1
    LIMIT 1
    `,
    [normalizeEmail(email)]
  );

  return result.rows[0] || null;
};

exports.signup = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      confirmPassword,
      role,
    } = req.body || {};

    if (
      !username ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        message: "All fields are required.",
      });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = normalizeEmail(email);
    const cleanPassword = String(password);
    const cleanConfirmPassword =
      String(confirmPassword);
    const userRole = normalizeRole(role);

    if (
      cleanUsername.length < 3 ||
      cleanUsername.length > 100
    ) {
      return res.status(400).json({
        message:
          "Username must be between 3 and 100 characters.",
      });
    }

    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        message:
          "Please enter a valid email address.",
      });
    }

    if (cleanPassword.length < 8) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long.",
      });
    }

    if (cleanPassword.length > 128) {
      return res.status(400).json({
        message: "Password is too long.",
      });
    }

    if (
      cleanPassword !== cleanConfirmPassword
    ) {
      return res.status(400).json({
        message: "Passwords do not match.",
      });
    }

    const existingUser =
      await findUserByEmail(cleanEmail);

    if (existingUser) {
      return res.status(409).json({
        message:
          "An account with this email already exists. Please login instead.",
      });
    }

    const hashedPassword = await bcrypt.hash(
      cleanPassword,
      12
    );

    const result = await db.query(
      `
      INSERT INTO users
        (
          username,
          email,
          password,
          role,
          auth_provider
        )
      VALUES
        ($1, $2, $3, $4, 'local')
      RETURNING
        id,
        username,
        email,
        role,
        created_at
      `,
      [
        cleanUsername,
        cleanEmail,
        hashedPassword,
        userRole,
      ]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(500).json({
        message: "User registration failed.",
      });
    }

    await ensureRoleProfile(user);

    if (userRole === "candidate") {
      await db.query(
        "UPDATE users SET last_login_at = CURRENT_TIMESTAMP, last_login_role = 'candidate' WHERE id = $1",
        [user.id]
      );
    }

    const token = createAccessToken(user);

    return res.status(201).json({
      message: "User registered successfully.",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error(
      "SIGNUP ERROR:",
      error.message
    );

    if (error?.code === "23505") {
      return res.status(409).json({
        message:
          "An account with these details already exists.",
      });
    }

    return res.status(500).json({
      message:
        "Server error during user registration.",
    });
  }
};

exports.login = async (req, res) => {
  try {
    const {
      email,
      username,
      password,
      role,
    } = req.body || {};

    const identifier = String(
      email || username || ""
    ).trim();

    const cleanPassword = String(
      password || ""
    );

    if (!identifier || !cleanPassword) {
      return res.status(400).json({
        message:
          "Email or username, and password are required.",
      });
    }

    const cleanIdentifier =
      identifier.toLowerCase();

    const userResult = await db.query(
      `
      SELECT
        id,
        username,
        email,
        password,
        role,
        auth_provider
      FROM users
      WHERE
        LOWER(TRIM(email)) = $1
        OR LOWER(TRIM(username)) = $1
      LIMIT 1
      `,
      [cleanIdentifier]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const user = userResult.rows[0];

    if (!user.password) {
      return res.status(401).json({
        message:
          "This account does not support password login.",
      });
    }

    let passwordMatch = false;

    try {
      passwordMatch = await bcrypt.compare(
        cleanPassword,
        user.password
      );
    } catch (error) {
      console.error(
        "PASSWORD VERIFICATION ERROR:",
        error.message
      );

      return res.status(500).json({
        message:
          "Unable to verify your password.",
      });
    }

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const actualRole = normalizeRole(user.role);

    if (
      role &&
      normalizeRole(role) !== actualRole
    ) {
      return res.status(403).json({
        message:
          `This account is registered as ${actualRole}. Please use the correct login option.`,
      });
    }

    await ensureRoleProfile(user);

    if (actualRole === "candidate") {
      await db.query(
        "UPDATE users SET last_login_at = CURRENT_TIMESTAMP, last_login_role = 'candidate' WHERE id = $1",
        [user.id]
      );
    }

    const token = createAccessToken(user);

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error(
      "LOGIN BACKEND ERROR:",
      error.message
    );

    return res.status(500).json({
      message:
        "Server error during authentication.",
    });
  }
};

exports.getMe = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        message: "Unauthorized.",
      });
    }

    const userResult = await db.query(
      `
      SELECT
        id,
        username,
        email,
        role,
        created_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    return res.status(200).json({
      user: sanitizeUser(
        userResult.rows[0]
      ),
    });
  } catch (error) {
    console.error(
      "GET ME ERROR:",
      error.message
    );

    return res.status(500).json({
      message:
        "Server error retrieving current user info.",
    });
  }
};

exports.getGoogleAuthUrl = (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        message:
          "Google OAuth is not configured. Add GOOGLE_CLIENT_ID to backend/.env.",
        configured: false,
      });
    }

    if (!GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({
        message:
          "Google OAuth is not configured. Add GOOGLE_CLIENT_SECRET to backend/.env.",
        configured: false,
      });
    }

    const role = normalizeRole(
      req.query.role
    );

    const state = createOAuthState(role);

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "select_account",
    });

    const url =
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return res.status(200).json({
      url,
      configured: true,
    });
  } catch (error) {
    console.error(
      "GOOGLE AUTH URL ERROR:",
      error.message
    );

    return res.status(500).json({
      message:
        "Unable to start Google authentication.",
    });
  }
};

exports.googleCallback = async (
  req,
  res
) => {
  const {
    code,
    state,
    error,
  } = req.query;

  if (error) {
    return redirectToLoginError(
      res,
      `Google authentication cancelled: ${error}`
    );
  }

  if (!code) {
    return redirectToLoginError(
      res,
      "Google authorization code is missing."
    );
  }

  const stateData =
    verifyOAuthState(state);

  if (!stateData.valid) {
    return redirectToLoginError(
      res,
      "Invalid or expired Google authentication request."
    );
  }

  try {
    if (
      !GOOGLE_CLIENT_ID ||
      !GOOGLE_CLIENT_SECRET
    ) {
      throw new Error(
        "Google OAuth credentials are not configured."
      );
    }

    const tokenRes = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code: String(code),
          client_id: GOOGLE_CLIENT_ID,
          client_secret:
            GOOGLE_CLIENT_SECRET,
          redirect_uri:
            GOOGLE_REDIRECT_URI,
          grant_type:
            "authorization_code",
        }),
      }
    );

    const tokenData =
      await tokenRes.json();

    if (
      !tokenRes.ok ||
      !tokenData.access_token
    ) {
      throw new Error(
        tokenData.error_description ||
          "Failed to exchange Google authorization code."
      );
    }

    const userRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization:
            `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const googleUser =
      await userRes.json();

    if (
      !userRes.ok ||
      !googleUser.email
    ) {
      throw new Error(
        "Unable to obtain your Google email."
      );
    }

    if (
      googleUser.email_verified !== true
    ) {
      throw new Error(
        "Your Google email address is not verified."
      );
    }

    if (!googleUser.sub) {
      throw new Error(
        "Unable to verify your Google account."
      );
    }

    const cleanEmail =
      normalizeEmail(
        googleUser.email
      );

    const googleId =
      String(googleUser.sub).trim();

    const googleName =
      String(
        googleUser.name ||
          cleanEmail.split("@")[0]
      )
        .trim()
        .slice(0, 100);

    const role =
      stateData.role;

    const existingResult =
      await db.query(
        `
        SELECT
          id,
          username,
          email,
          password,
          role,
          auth_provider,
          google_id
        FROM users
        WHERE
          LOWER(TRIM(email)) = $1
          OR google_id = $2
        LIMIT 1
        `,
        [
          cleanEmail,
          googleId,
        ]
      );

    let user =
      existingResult.rows[0];

    if (user) {
      const actualRole =
        normalizeRole(user.role);

      if (actualRole !== role) {
        return redirectToLoginError(
          res,
          `This email is already registered as a ${actualRole}. Please use the ${actualRole} login.`
        );
      }

      if (
        user.google_id &&
        user.google_id !== googleId
      ) {
        return redirectToLoginError(
          res,
          "This Google account cannot be linked to this existing email."
        );
      }

      await db.query(
        `
        UPDATE users
        SET google_id = $1
        WHERE id = $2
        `,
        [
          googleId,
          user.id,
        ]
      );

      user.google_id =
        googleId;

      await ensureRoleProfile(
        user,
        googleUser.picture || null
      );
    } else {
      const randomPasswordHash =
        await generateOAuthPasswordHash();

      const insertResult =
        await db.query(
          `
          INSERT INTO users
            (
              username,
              email,
              password,
              role,
              auth_provider,
              google_id
            )
          VALUES
            (
              $1,
              $2,
              $3,
              $4,
              'google',
              $5
            )
          RETURNING
            id,
            username,
            email,
            role,
            auth_provider,
            google_id
          `,
          [
            googleName,
            cleanEmail,
            randomPasswordHash,
            role,
            googleId,
          ]
        );

      user =
        insertResult.rows[0];

      if (!user) {
        throw new Error(
          "Unable to create HireVision account."
        );
      }

      await ensureRoleProfile(
        user,
        googleUser.picture || null
      );
    }

    const token =
      createAccessToken(user);

    const safeUser =
      sanitizeUser(user);

    if (safeUser.role === "candidate") {
      await db.query(
        "UPDATE users SET last_login_at = CURRENT_TIMESTAMP, last_login_role = 'candidate' WHERE id = $1",
        [user.id]
      );
    }

    const redirectPath =
      safeUser.role === "recruiter"
        ? "/recruiter-dashboard"
        : "/dashboard";

    const params =
      new URLSearchParams({
        token,
        role: safeUser.role,
        user: JSON.stringify(
          safeUser
        ),
      });

    return res.redirect(
      `${FRONTEND_URL}${redirectPath}?${params.toString()}`
    );
  } catch (error) {
    console.error(
      "GOOGLE OAUTH CALLBACK ERROR:",
      error.message
    );

    return redirectToLoginError(
      res,
      error.message ||
        "Google authentication failed."
    );
  }
};

exports.getMicrosoftAuthUrl = (
  req,
  res
) => {
  try {
    if (
      !MICROSOFT_CLIENT_ID ||
      !MICROSOFT_CLIENT_SECRET
    ) {
      return res.status(503).json({
        message:
          "Microsoft OAuth is not configured. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to backend/.env.",
        configured: false,
      });
    }

    const role = normalizeRole(
      req.query.role
    );

    const state =
      createOAuthState(role);

    const params =
      new URLSearchParams({
        client_id:
          MICROSOFT_CLIENT_ID,
        response_type: "code",
        redirect_uri:
          MICROSOFT_REDIRECT_URI,
        response_mode: "query",
        scope:
          "openid profile email User.Read",
        state,
      });

    const url =
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

    return res.status(200).json({
      url,
      configured: true,
    });
  } catch (error) {
    console.error(
      "MICROSOFT AUTH URL ERROR:",
      error.message
    );

    return res.status(500).json({
      message:
        "Unable to start Microsoft authentication.",
    });
  }
};

exports.microsoftCallback = async (
  req,
  res
) => {
  const {
    code,
    state,
    error,
  } = req.query;

  if (error) {
    return redirectToLoginError(
      res,
      `Microsoft authentication cancelled: ${error}`
    );
  }

  if (!code) {
    return redirectToLoginError(
      res,
      "Microsoft authorization code is missing."
    );
  }

  const stateData =
    verifyOAuthState(state);

  if (!stateData.valid) {
    return redirectToLoginError(
      res,
      "Invalid or expired Microsoft authentication request."
    );
  }

  try {
    if (
      !MICROSOFT_CLIENT_ID ||
      !MICROSOFT_CLIENT_SECRET
    ) {
      throw new Error(
        "Microsoft OAuth credentials are not configured."
      );
    }

    const tokenRes = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id:
            MICROSOFT_CLIENT_ID,
          client_secret:
            MICROSOFT_CLIENT_SECRET,
          code: String(code),
          redirect_uri:
            MICROSOFT_REDIRECT_URI,
          grant_type:
            "authorization_code",
          scope:
            "openid profile email User.Read",
        }),
      }
    );

    const tokenData =
      await tokenRes.json();

    if (
      !tokenRes.ok ||
      !tokenData.access_token
    ) {
      throw new Error(
        tokenData.error_description ||
          "Failed to exchange Microsoft authorization code."
      );
    }

    const msRes = await fetch(
      "https://graph.microsoft.com/v1.0/me",
      {
        headers: {
          Authorization:
            `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const msUser =
      await msRes.json();

    if (!msRes.ok || !msUser.id) {
      throw new Error(
        "Unable to retrieve Microsoft profile."
      );
    }

    const email =
      msUser.mail ||
      msUser.userPrincipalName ||
      (
        Array.isArray(
          msUser.otherMails
        )
          ? msUser.otherMails[0]
          : null
      );

    if (!email) {
      throw new Error(
        "Unable to obtain email from Microsoft account."
      );
    }

    const cleanEmail =
      normalizeEmail(email);

    const username =
      String(
        msUser.displayName ||
          cleanEmail.split("@")[0]
      )
        .trim()
        .slice(0, 100);

    const microsoftId =
      String(msUser.id).trim();

    const role =
      stateData.role;

    const existingResult =
      await db.query(
        `
        SELECT
          id,
          username,
          email,
          password,
          role,
          auth_provider,
          microsoft_id
        FROM users
        WHERE
          LOWER(TRIM(email)) = $1
          OR microsoft_id = $2
        LIMIT 1
        `,
        [
          cleanEmail,
          microsoftId,
        ]
      );

    let user =
      existingResult.rows[0];

    if (user) {
      const actualRole =
        normalizeRole(user.role);

      if (actualRole !== role) {
        return redirectToLoginError(
          res,
          `This email is already registered as a ${actualRole}. Please use the ${actualRole} login.`
        );
      }

      if (
        user.microsoft_id &&
        user.microsoft_id !==
          microsoftId
      ) {
        return redirectToLoginError(
          res,
          "This Microsoft account cannot be linked to this existing email."
        );
      }

      await db.query(
        `
        UPDATE users
        SET microsoft_id = $1
        WHERE id = $2
        `,
        [
          microsoftId,
          user.id,
        ]
      );

      user.microsoft_id =
        microsoftId;

      await ensureRoleProfile(
        user
      );
    } else {
      const randomPasswordHash =
        await generateOAuthPasswordHash();

      const insertResult =
        await db.query(
          `
          INSERT INTO users
            (
              username,
              email,
              password,
              role,
              auth_provider,
              microsoft_id
            )
          VALUES
            (
              $1,
              $2,
              $3,
              $4,
              'microsoft',
              $5
            )
          RETURNING
            id,
            username,
            email,
            role,
            auth_provider,
            microsoft_id
          `,
          [
            username,
            cleanEmail,
            randomPasswordHash,
            role,
            microsoftId,
          ]
        );

      user =
        insertResult.rows[0];

      if (!user) {
        throw new Error(
          "Unable to create HireVision account."
        );
      }

      await ensureRoleProfile(
        user
      );
    }

    const token =
      createAccessToken(user);

    const safeUser =
      sanitizeUser(user);

    if (safeUser.role === "candidate") {
      await db.query(
        "UPDATE users SET last_login_at = CURRENT_TIMESTAMP, last_login_role = 'candidate' WHERE id = $1",
        [user.id]
      );
    }

    const redirectPath =
      safeUser.role === "recruiter"
        ? "/recruiter-dashboard"
        : "/dashboard";

    const params =
      new URLSearchParams({
        token,
        role: safeUser.role,
        user: JSON.stringify(
          safeUser
        ),
      });

    return res.redirect(
      `${FRONTEND_URL}${redirectPath}?${params.toString()}`
    );
  } catch (error) {
    console.error(
      "MICROSOFT OAUTH CALLBACK ERROR:",
      error.message
    );

    return redirectToLoginError(
      res,
      error.message ||
        "Microsoft authentication failed."
    );
  }
};

exports.oauthTokenExchange = async (
  req,
  res
) => {
  try {
    const {
      provider,
      credential,
      role: requestedRole,
    } = req.body || {};

    if (!provider || !credential) {
      return res.status(400).json({
        message:
          "Provider and credential token are required.",
      });
    }

    if (provider !== "google") {
      return res.status(400).json({
        message:
          "Unsupported OAuth provider.",
      });
    }

    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        message:
          "Google OAuth is not configured.",
      });
    }

    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
        credential
      )}`
    );

    const payload =
      await verifyRes.json();

    if (
      !verifyRes.ok ||
      !payload.email
    ) {
      return res.status(401).json({
        message:
          "Invalid Google ID token.",
      });
    }

    if (
      payload.aud !==
      GOOGLE_CLIENT_ID
    ) {
      return res.status(401).json({
        message:
          "Google token was not issued for HireVision.",
      });
    }

    if (
      payload.email_verified !== true &&
      payload.email_verified !== "true"
    ) {
      return res.status(401).json({
        message:
          "Your Google email is not verified.",
      });
    }

    if (!payload.sub) {
      return res.status(401).json({
        message:
          "Unable to verify your Google account.",
      });
    }

    const cleanEmail =
      normalizeEmail(payload.email);

    const googleId =
      String(payload.sub).trim();

    const name =
      String(
        payload.name ||
          cleanEmail.split("@")[0]
      )
        .trim()
        .slice(0, 100);

    const role =
      normalizeRole(requestedRole);

    const userResult =
      await db.query(
        `
        SELECT
          id,
          username,
          email,
          password,
          role,
          auth_provider,
          google_id
        FROM users
        WHERE
          LOWER(TRIM(email)) = $1
          OR google_id = $2
        LIMIT 1
        `,
        [
          cleanEmail,
          googleId,
        ]
      );

    let user =
      userResult.rows[0];

    if (!user) {
      const randomPasswordHash =
        await generateOAuthPasswordHash();

      const insertResult =
        await db.query(
          `
          INSERT INTO users
            (
              username,
              email,
              password,
              role,
              auth_provider,
              google_id
            )
          VALUES
            (
              $1,
              $2,
              $3,
              $4,
              'google',
              $5
            )
          RETURNING
            id,
            username,
            email,
            role,
            auth_provider,
            google_id
          `,
          [
            name,
            cleanEmail,
            randomPasswordHash,
            role,
            googleId,
          ]
        );

      user =
        insertResult.rows[0];

      await ensureRoleProfile(
        user,
        payload.picture || null
      );
    } else {
      const actualRole =
        normalizeRole(user.role);

      if (actualRole !== role) {
        return res.status(403).json({
          message:
            `This email is already registered as a ${actualRole}. Please use the ${actualRole} login.`,
        });
      }

      if (
        user.google_id &&
        user.google_id !== googleId
      ) {
        return res.status(403).json({
          message:
            "This Google account cannot be linked to this email.",
        });
      }

      await db.query(
        `
        UPDATE users
        SET google_id = $1
        WHERE id = $2
        `,
        [
          googleId,
          user.id,
        ]
      );

      user.google_id =
        googleId;

      await ensureRoleProfile(
        user,
        payload.picture || null
      );
    }

    const token =
      createAccessToken(user);

    return res.status(200).json({
      message:
        "OAuth login successful.",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error(
      "OAUTH TOKEN EXCHANGE ERROR:",
      error.message
    );

    return res.status(500).json({
      message:
        "Server error exchanging OAuth token.",
    });
  }
};