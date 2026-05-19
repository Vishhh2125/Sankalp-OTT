import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  loginUser,
  logoutUserService,
  registerAdmin,
  registerUser,
  verifyRefreshToken,
  verifyStoredRefreshToken,
} from './auth.service.js';
import { validateRegister, validateLogin, validateClientType } from './auth.validation.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import logger from '../../config/logger.js';
import { getPrismaClient } from '../../config/db.js';

const prisma = getPrismaClient();

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

/**
 * Refresh token controller
 *
 * Header: x-client-type: mobile | web
 *
 * - mobile: expects refresh token in Authorization header: Bearer <refreshToken>
 * - web: expects refresh token in cookie: refreshToken=<token>
 */
export const refreshToken = asyncHandler(async (req, res) => {
  try {
    const clientTypeHeader = req.headers['x-client-type'];
    logger.debug(`[refreshToken] clientTypeHeader: ${clientTypeHeader}`);

    // Validate client type
    const clientTypeValidation = validateClientType(clientTypeHeader);
    if (!clientTypeValidation.isValid) {
      logger.warn(`[refreshToken] Invalid client type: ${clientTypeHeader}`);
      throw new ApiError(400, clientTypeValidation.error);
    }

    const clientType = clientTypeValidation.value; // 'web' | 'mobile'
    logger.debug(`[refreshToken] clientType: ${clientType}`);

    let refreshTokenValue = null;

    if (clientType === 'web') {
      refreshTokenValue = req.cookies?.refreshToken;
      logger.debug(`[refreshToken] web client - cookie refreshToken: ${refreshTokenValue ? 'present' : 'missing'}`);
    } else {
      const authHeader = req.headers.authorization;
      logger.debug(`[refreshToken] mobile client - authHeader present: ${!!authHeader}`);
      if (authHeader && authHeader.startsWith('Bearer ')) {
        refreshTokenValue = authHeader.slice(7);
      }
    }

    if (!refreshTokenValue || String(refreshTokenValue).trim().length === 0) {
      logger.warn(`[refreshToken] Refresh token missing or empty`);
      throw new ApiError(401, 'Refresh token missing or empty');
    }

    logger.debug(`[refreshToken] Verifying refresh token...`);
    // 1) Verify refresh token signature + expiry
    const decoded = verifyRefreshToken(refreshTokenValue);
    logger.debug(`[refreshToken] Token decoded successfully, userId: ${decoded?.id}`);
    
    if (!decoded?.id) {
      logger.warn(`[refreshToken] Invalid token payload - no userId`);
      throw new ApiError(401, 'Invalid refresh token payload');
    }

    logger.debug(`[refreshToken] Fetching user from database...`);
    // 2) Verify token matches the one stored (hashed) in DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      logger.warn(`[refreshToken] User not found for id: ${decoded.id}`);
      throw new ApiError(401, 'User not found');
    }

    logger.debug(`[refreshToken] User found: ${user.email}`);

    if (!user.refreshToken) {
      logger.warn(`[refreshToken] No refresh token stored for user: ${user.email}`);
      throw new ApiError(401, 'No refresh token stored for user');
    }

    logger.debug(`[refreshToken] Comparing stored refresh token...`);
    const matches = await verifyStoredRefreshToken(refreshTokenValue, user.refreshToken);
    if (!matches) {
      logger.warn(`[refreshToken] Refresh token mismatch for user: ${user.email}`);
      throw new ApiError(401, 'Refresh token is invalid');
    }

    logger.debug(`[refreshToken] Token match successful, generating new tokens...`);
    // 3) Rotate tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);

    logger.debug(`[refreshToken] Updating user refresh token in database...`);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshTokenHash },
    });

    logger.info('Refresh token rotated successfully', {
      userId: user.id,
      email: user.email,
      clientType,
    });

    // For web clients: set refresh token as secure http-only cookie
    if (clientType === 'web') {
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    const responseData = {
      accessToken: newAccessToken,
    };

    // For mobile clients: include refresh token in response body
    if (clientType !== 'web') {
      responseData.refreshToken = newRefreshToken;
    }

    return res
      .status(200)
      .json(new ApiResponse(200, responseData, 'Token refreshed successfully'));
  } catch (error) {
    logger.error('[refreshToken] Error in refresh token controller:', {
      error: error.message,
      stack: error.stack,
      statusCode: error.statusCode
    });
    throw error;
  }
});


/**
 * Logout user controller
 * Middleware already verified token and attached req.user
 * Just pass userId to logout service
 */
export const logout = asyncHandler(async (req, res) => {
  const clientTypeHeader = req.headers['x-client-type'];

  // Validate client type
  const clientTypeValidation = validateClientType(clientTypeHeader);
  if (!clientTypeValidation.isValid) {
    throw new ApiError(400, clientTypeValidation.error);
  }

  const clientType = clientTypeValidation.value; // 'web' | 'mobile'

  // Get userId from already-authenticated req.user (middleware verified it)
  const userId = req.user.id;

  // Call logout service to handle business logic
  const user = await logoutUserService(userId);

  logger.info('Logout controller: User logged out successfully', {
    userId: userId,
    email: user.email,
    clientType,
  });

  // ✅ Clear refresh token cookie for web clients
  if (clientType === 'web') {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, 'Logout successful'));
});

/**
 * Get current authenticated user profile
 * Middleware: requireAuth (verifies accessToken)
 * Returns: User profile including coins, plan, role
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        coins: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return res.json(new ApiResponse(200, user, 'User profile fetched'));
  } catch (e) {
    if (e instanceof ApiError) {
      throw e;
    }
    throw new ApiError(500, 'Failed to fetch user profile');
  }
});