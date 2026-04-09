import express from 'express';
import { register, login, registerAdminController, refreshToken, logout } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * POST /auth/register
 * Register new user
 * Body: { name, email, password }
 */
router.post('/register', register);

/**
 * POST /auth/login
 * Login user
 * Body: { email, password }
 */
router.post('/login', login);

/**
 * POST /auth/register-admin
 * Register new admin user
 * Body: { name, email, password, adminSecret }
 */
router.post('/register-admin', registerAdminController);

router.get("/refresh-token", refreshToken);

/**
 * POST /auth/logout
 * Logout user (invalidate refresh token in DB)
 * 
 * Middleware: requireAuth (verifies accessToken)
 * Expects: accessToken in Authorization header
 * Mobile: Authorization: Bearer <accessToken>
 * Web: Authorization: Bearer <accessToken> + Cookie: refreshToken (to clear)
 * 
 * Controller uses req.user (attached by middleware)
 */
router.post("/logout", requireAuth, logout);

export default router;