const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/me', authMiddleware, authController.getMe);

// Real Google & Microsoft OAuth
router.get('/google/url', authController.getGoogleAuthUrl);
router.get('/google/callback', authController.googleCallback);
router.get('/microsoft/url', authController.getMicrosoftAuthUrl);
router.get('/microsoft/callback', authController.microsoftCallback);
router.post('/oauth/exchange', authController.oauthTokenExchange);

module.exports = router;