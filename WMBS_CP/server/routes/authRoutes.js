const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { optionalAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.get('/login', optionalAuth, authController.getLogin);
router.post('/login', validate(schemas.login), authController.postLogin);
router.get('/register', optionalAuth, authController.getRegister);
router.post('/register', validate(schemas.register), authController.postRegister);
router.get('/logout', optionalAuth, authController.logout);
router.get('/forgot-password', authController.getForgotPassword);
router.post('/forgot-password', validate(schemas.resetPasswordRequest), authController.postForgotPassword);
router.get('/reset-password', authController.getResetPassword);
router.post('/reset-password', validate(schemas.resetPassword), authController.postResetPassword);

module.exports = router;
