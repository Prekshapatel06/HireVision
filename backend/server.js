const express = require("express");
const cors = require("cors");
const path = require("path");

require("dotenv").config();

const db = require("./config/db");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const aiRoutes = require("./routes/ai");
const recruiterRoutes = require("./routes/recruiter");

const app = express();

app.disable("x-powered-by");

const PORT = Number(process.env.PORT || 5000);
const allowedOrigins = (
  process.env.FRONTEND_URL || "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const MAX_BODY_SIZE = process.env.MAX_BODY_SIZE || "20mb";

app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes("*")) {
        return callback(null, true);
      }

      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.endsWith(".onrender.com")
      ) {
        return callback(null, true);
      }

      const error = new Error("Origin not allowed by CORS.");
      error.status = 403;

      return callback(error);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

app.use(
  express.json({
    limit: MAX_BODY_SIZE,
    strict: true,
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: MAX_BODY_SIZE,
  })
);

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    fallthrough: true,
    index: false,
    dotfiles: "deny",
  })
);

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Welcome to HireVision AI REST API services.",
  });
});

app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");

    return res.status(200).json({
      success: true,
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[HireVision Health Check]:", err.message);

    return res.status(503).json({
      success: false,
      status: "unhealthy",
      database: "unavailable",
      timestamp: new Date().toISOString(),
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/recruiter", recruiterRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "API endpoint not found.",
    path: req.originalUrl,
    method: req.method,
  });
});

app.use((err, req, res, next) => {
  console.error("[HireVision Server Error]:", {
    message: err.message,
    method: req.method,
    path: req.originalUrl,
    status: err.status || 500,
  });

  if (res.headersSent) {
    return next(err);
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request payload is too large.",
    });
  }

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload.",
    });
  }

  const statusCode =
    Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status < 600
      ? err.status
      : 500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "An unexpected server error occurred."
        : err.message,
  });
});

const server = app.listen(PORT, () => {
  console.log(`[HireVision AI Server] running on port ${PORT}`);
});

const shutdown = async (signal) => {
  console.log(`[HireVision AI Server] ${signal} received. Shutting down...`);

  server.close(async () => {
    try {
      if (db.pool && typeof db.pool.end === "function") {
        await db.pool.end();
      }

      console.log("[HireVision AI Server] shutdown complete.");
      process.exit(0);
    } catch (err) {
      console.error(
        "[HireVision AI Server] shutdown error:",
        err.message
      );
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("[HireVision AI Server] forced shutdown.");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[HireVision Unhandled Rejection]:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[HireVision Uncaught Exception]:", error);

  shutdown("uncaughtException").catch(() => {
    process.exit(1);
  });
});

module.exports = app;