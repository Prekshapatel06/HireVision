const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/auth');
const requireCandidateRole = require('../middleware/requireCandidateRole');

router.get('/', authMiddleware, profileController.getProfile);
router.put('/', authMiddleware, requireCandidateRole, profileController.updateProfile);
router.post('/upload-resume', authMiddleware, requireCandidateRole, profileController.uploadResume);
router.get('/public/:userId', profileController.getPublicProfile);

module.exports = router;