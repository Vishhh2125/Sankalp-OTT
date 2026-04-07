import { registerUser, loginUser, registerAdmin } from './auth.service.js';
import { validateRegister, validateLogin, validateClientType } from './auth.validation.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import logger from '../../config/logger.js';

/**
 * Register user controller
 */
export const register = asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body;

  // Validate input
  const validation = validateRegister({ name, email, password });
  if (!validation.isValid) {
    throw new ApiError(400, 'Validation failed', validation.errors);
  }

  // Sanitize inputs
  const sanitizedName = String(name).trim();
  const sanitizedEmail = String(email).toLowerCase().trim();
  const sanitizedPassword = String(password);

  // Register user
  const result = await registerUser({
    name: sanitizedName,
    email: sanitizedEmail,
    password: sanitizedPassword
  });

  logger.info('User registered successfully', { 
    userId: result.user.id, 
    email: result.user.email
  });

  // Return only user data (no tokens - user must login to get tokens)
  return res.status(201).json(
    new ApiResponse(201, result.user, 'User registered successfully. Please login to continue')
  );
});

/**
 * Login user controller
 */
export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const clientTypeHeader = req.headers['x-client-type'];

  // Validate client type
  const clientTypeValidation = validateClientType(clientTypeHeader);
  if (!clientTypeValidation.isValid) {
    throw new ApiError(400, clientTypeValidation.error);
  }

  const clientType = clientTypeValidation.value;

  // Validate login credentials
  const validation = validateLogin({ email, password });
  if (!validation.isValid) {
    throw new ApiError(400, 'Validation failed', validation.errors);
  }

  // Sanitize email
  const sanitizedEmail = String(email).toLowerCase().trim();
  
  // Login user
  const result = await loginUser({
    email: sanitizedEmail,
    password
  });

  logger.info('User login successful', { 
    userId: result.user.id, 
    email: result.user.email,
    clientType
  });

  // For web clients: set refresh token as secure http-only cookie
  if (clientType === 'web') {
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }

  // Response with tokens
  const responseData = {
    user: result.user,
    accessToken: result.accessToken
  };

  // For mobile clients: include refresh token in response body
  if (clientType !== 'web') {
    responseData.refreshToken = result.refreshToken;
  }

  return res.status(200).json(
    new ApiResponse(200, responseData, 'Login successful')
  );
});

/**
 * Register admin controller
 */
export const registerAdminController = asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body;

  // Validate input
  const validation = validateRegister({ name, email, password });
  if (!validation.isValid) {
    throw new ApiError(400, 'Validation failed', validation.errors);
  }

  // Sanitize inputs
  const sanitizedName = String(name).trim();
  const sanitizedEmail = String(email).toLowerCase().trim();
  const sanitizedPassword = String(password);

  // Register admin
  const result = await registerAdmin({
    name: sanitizedName,
    email: sanitizedEmail,
    password: sanitizedPassword
  });

  logger.info('Admin registered successfully', { 
    userId: result.user.id, 
    email: result.user.email
  });

  // Return only admin data (no tokens - admin must login to get tokens)
  return res.status(201).json(
    new ApiResponse(201, result.user, 'Admin registered successfully. Please login to continue')
  );
});