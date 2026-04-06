import express from 'express';
import { register, login, registerAdminController } from './auth.controller.js';

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

export default router;