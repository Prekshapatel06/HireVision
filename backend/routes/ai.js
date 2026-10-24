const express = require("express");

const router = express.Router();

const aiController = require(
  "../controllers/aiController"
);

const authMiddleware = require(
  "../middleware/auth"
);

const multer = require("multer");

const archiveUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});


/* ============================================================
   LINKEDIN OAUTH CALLBACK

   LinkedIn redirect JWT header ke saath nahi aata,
   therefore callback auth middleware se pehle hona chahiye.
============================================================ */

router.get(
  "/linkedin/callback",
  aiController.linkedinOAuthCallback
);


/* ============================================================
   AUTHENTICATION
============================================================ */

router.use(
  authMiddleware
);


/* ============================================================
   CHAT
============================================================ */

router.get(
  "/chats",
  aiController.getChats
);

router.post(
  "/chats",
  aiController.createChat
);

router.get(
  "/chats/:chatId",
  aiController.getChat
);

router.delete(
  "/chats/:chatId",
  aiController.deleteChat
);

router.post(
  "/chats/:chatId/restore",
  aiController.restoreChat
);

router.post(
  "/chats/:chatId/reset",
  aiController.resetChat
);

router.post(
  "/chat",
  aiController.chat
);


/* ============================================================
   AI ANALYSIS
============================================================ */

router.get(
  "/analysis",
  aiController.getAIAnalysis
);

router.post(
  "/analyze",
  aiController.triggerAIAnalysis
);

router.get(
  "/gaps",
  aiController.getSkillGaps
);

router.get(
  "/verify-agents",
  aiController.verifyAllAgents
);


/* ============================================================
   GITHUB
============================================================ */

router.post(
  "/github/scan",
  aiController.scanGithub
);


/* ============================================================
   LINKEDIN
============================================================ */

router.post(
  "/linkedin/connect",
  aiController.getLinkedinAuthorization
);

router.get(
  "/linkedin/status",
  aiController.getLinkedinConnectionStatus
);

router.delete(
  "/linkedin/connection",
  aiController.disconnectLinkedin
);

router.post(
  "/linkedin/scan",
  aiController.scanLinkedin
);

router.post(
  "/linkedin/import-archive",
  archiveUpload.any(),
  aiController.importLinkedinArchive
);


/* ============================================================
   EXTERNAL IMPORT APPROVAL
============================================================ */

router.get(
  "/import/pending",
  aiController.getPendingImports
);

router.post(
  "/import/approve",
  aiController.approveImport
);

router.post(
  "/import/reject",
  aiController.rejectImport
);

router.post(
  "/import/decline",
  aiController.rejectImport
);

router.post(
  "/import/batch-approve",
  aiController.batchApproveImports
);

router.post(
  "/import/batch-reject",
  aiController.batchRejectImports
);

router.post(
  "/import/batch-decline",
  aiController.batchRejectImports
);


/* ============================================================
   RESUME
============================================================ */

router.get(
  "/resume/suggestions",
  aiController.getResumeSuggestions
);

router.post(
  "/resume/suggestions/apply",
  aiController.applyResumeSuggestion
);


/* ============================================================
   LIVE RESUME
============================================================ */

router.get(
  "/live-resume",
  aiController.getLiveResume
);

router.post(
  "/live-resume",
  aiController.generateLiveResume
);

router.get(
  "/resume/live",
  aiController.getLiveResume
);

router.post(
  "/resume/live",
  aiController.generateLiveResume
);


/* ============================================================
   EXPORT
============================================================ */

module.exports = router;