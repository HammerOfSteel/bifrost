import express from 'express';
import { login, register } from '../controllers/authController.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', login);

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', register);

export default router;
