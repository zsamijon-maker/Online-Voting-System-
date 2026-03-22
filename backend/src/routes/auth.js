import { Router } from 'express';
import {
  register,
  verifyRegistrationTotp,
  login,
  verifyLoginTotp,
  setupStaffTotp,
  googleCallback,
  googleSetup,
  logout,
  refresh,
} from '../controllers/authController.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

// Registration (two-step)
router.post('/register',                asyncHandler(register));
router.post('/register/verify-totp',    asyncHandler(verifyRegistrationTotp));

// Login (two-step with 2FA)
router.post('/login',                   asyncHandler(login));
router.post('/verify-totp',             asyncHandler(verifyLoginTotp));

// Staff first-login forced 2FA setup
router.post('/setup-staff-totp',        asyncHandler(setupStaffTotp));

// Google OAuth (two-step)
router.post('/google-callback',         asyncHandler(googleCallback));
router.post('/google-setup',            asyncHandler(googleSetup));

// Session management
router.post('/logout',                  asyncHandler(logout));
router.post('/refresh',                 asyncHandler(refresh));

export default router;
