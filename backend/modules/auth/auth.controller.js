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
  initiateRegistration,
  verifyOtpAndCreateUser,
  resendOTP,
  requestForgotPassword,
  resendForgotOtp,
  verifyForgotOtpAndResetPassword,
  googleOAuthLogin,
} from './auth.service.js';
import {
  validateRegister,
  validateLogin,
  validateClientType,
  validateForgotPasswordEmail,
  validateResetPassword,
  validateSessionId,
} from './auth.validation.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import logger from '../../config/logger.js';
import { getPrismaClient } from '../../config/db.js';
import { getAdminProfile } from '../admin/subadmin.service.js';
import {
  activeMembershipWhere,
  formatMembershipResponse,
  membershipPlanInclude,
} from '../membership/membership.helpers.js';

const prisma = getPrismaClient();

/**
 * Register user controller - Step 1: Initiate OTP verification
 * Body: { name, email, password }
 * Returns: { sessionId, email (masked), expiresAt, otpExpiresAt }
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

  // Initiate registration - generates OTP and sends email
  const result = await initiateRegistration({
    name: sanitizedName,
    email: sanitizedEmail,
    password: sanitizedPassword
  });

  logger.info('Registration initiated - OTP sent', { 
    sessionId: result.sessionId, 
    email: result.email
  });

  // Return sessionId and masked email (user hasn't been created yet)
  return res.status(201).json(
    new ApiResponse(201, result, 'OTP sent to your email. Please verify to complete registration.')
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
  
  const isAdminPanel = req.headers['x-admin-panel'] === 'true';

  // Login user
  const result = await loginUser({
    email: sanitizedEmail,
    password
  });

  // Admin panel: only ADMIN and SUB_ADMIN may sign in
  if (isAdminPanel) {
    if (result.user.role !== 'ADMIN' && result.user.role !== 'SUB_ADMIN' && result.user.role !== 'TEACHER') {
      throw new ApiError(403, 'Admin panel access denied');
    }
    if (result.user.isBlocked) {
      throw new ApiError(403, 'Your admin account has been deactivated');
    }
  }

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

  // Format user for admin panel (role + sections)
  let userPayload = result.user;
  if (isAdminPanel) {
    const { password: _, refreshToken: __, sub_admin_access, ...rest } = result.user;
    const profile = await getAdminProfile(rest.id, rest.role);
    userPayload = profile;
  }

  // Response with tokens
  const responseData = {
    user: userPayload,
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
 * Verify OTP controller - Step 2: Create user after OTP verification
 * Body: { sessionId, otp }
 * Returns: { user, message }
 */
export const verifyOtp = asyncHandler(async (req, res, next) => {
  const { sessionId, otp } = req.body;

  // Validate input
  if (!sessionId || typeof sessionId !== 'string') {
    throw new ApiError(400, 'Validation failed', ['sessionId is required']);
  }

  if (!otp || typeof otp !== 'string' || otp.length !== 6 || !/^\d+$/.test(otp)) {
    throw new ApiError(400, 'Validation failed', ['OTP must be a 6-digit number']);
  }

  // Verify OTP and create user
  const result = await verifyOtpAndCreateUser({
    sessionId,
    otp
  });

  logger.info('User account created after OTP verification', { 
    userId: result.user.id, 
    email: result.user.email
  });

  return res.status(201).json(
    new ApiResponse(201, {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }, result.message)
  );
});

/**
 * Resend OTP controller
 * Body: { sessionId }
 * Returns: { message, nextResendAt, otpExpiresAt, remainingResends }
 */
export const resendOtpController = asyncHandler(async (req, res, next) => {
  const { sessionId } = req.body;

  // Validate input
  if (!sessionId || typeof sessionId !== 'string') {
    throw new ApiError(400, 'Validation failed', ['sessionId is required']);
  }

  // Resend OTP
  const result = await resendOTP(sessionId);

  logger.info('OTP resent', { sessionId });

  return res.status(200).json(
    new ApiResponse(200, result, result.message)
  );
});

/**
 * Forgot password - Step 1: send OTP to registered email
 * Body: { email }
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const validation = validateForgotPasswordEmail({ email });
  if (!validation.isValid) {
    throw new ApiError(400, 'Validation failed', validation.errors);
  }

  const sanitizedEmail = String(email).toLowerCase().trim();
  const result = await requestForgotPassword(sanitizedEmail);

  logger.info('Forgot password OTP sent', { sessionId: result.sessionId });

  return res.status(200).json(
    new ApiResponse(200, result, 'OTP sent to your email. Enter the code and your new password.')
  );
});

/**
 * Resend OTP for forgot-password session
 * Body: { sessionId }
 */
export const resendForgotOtpController = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;

  const sessionValidation = validateSessionId(sessionId);
  if (!sessionValidation.isValid) {
    throw new ApiError(400, 'Validation failed', sessionValidation.errors);
  }

  const result = await resendForgotOtp(sessionId);

  return res.status(200).json(new ApiResponse(200, result, result.message));
});

/**
 * Reset password after OTP verification
 * Body: { sessionId, otp, newPassword }
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { sessionId, otp, newPassword } = req.body;

  const validation = validateResetPassword({ sessionId, otp, newPassword });
  if (!validation.isValid) {
    throw new ApiError(400, 'Validation failed', validation.errors);
  }

  const result = await verifyForgotOtpAndResetPassword({
    sessionId,
    otp: String(otp).trim(),
    newPassword: String(newPassword),
  });

  return res.status(200).json(new ApiResponse(200, null, result.message));
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

    if (user.isBlocked) {
      logger.warn(`[refreshToken] User is blocked: ${user.email}`);
      throw new ApiError(403, 'Your account has been blocked by the admin. Please contact support.');
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
        avatar_url: true,
        mobile_no: true,
        dob: true,
        gender: true,
        country: true,
        state: true,
        city: true,
        student_id: true,
        onboarded_by: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const activeMemberships = await prisma.userMembership.findMany({
      where: {
        user_id: userId,
        ...activeMembershipWhere(new Date()),
      },
      include: membershipPlanInclude,
      orderBy: [{ end_date: 'asc' }, { created_at: 'desc' }],
    });

    const memberships = activeMemberships.map(formatMembershipResponse);
    const hasAllAccess = activeMemberships.some((m) => m.plan.category_id === null);

    const profile = {
      ...user,
      memberships,
      has_all_access: hasAllAccess,
    };

    // If teacher, include teacher profile status
    if (user.role === 'TEACHER') {
      const tp = await prisma.teacherProfile.findUnique({ where: { user_id: userId } });
      profile.is_profile_complete = tp?.is_completed || false;
      profile.teacher_profile = tp || null;
    }

    return res.json(new ApiResponse(200, profile, 'User profile fetched'));
  } catch (e) {
    if (e instanceof ApiError) {
      throw e;
    }
    throw new ApiError(500, 'Failed to fetch user profile');
  }
});

/**
 * PATCH /auth/me
 * Partial update for authenticated user's profile details ("My Details")
 * Body: { name, mobile_no, dob, gender, country, state, city }
 */
export const updateMyDetails = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, mobile_no, dob, gender, country, state, city } = req.body;

  const updateData = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new ApiError(400, 'Name must be a non-empty string');
    }
    updateData.name = name.trim();
  }

  if (mobile_no !== undefined) {
    if (mobile_no === null || mobile_no === '') {
      updateData.mobile_no = null;
    } else {
      const str = String(mobile_no).trim();
      if (str.length > 20) {
        throw new ApiError(400, 'Mobile number cannot exceed 20 characters');
      }
      updateData.mobile_no = str;
    }
  }

  if (dob !== undefined) {
    if (dob === null || dob === '') {
      updateData.dob = null;
    } else {
      const parsedDate = new Date(dob);
      if (isNaN(parsedDate.getTime())) {
        throw new ApiError(400, 'Invalid date of birth format');
      }
      updateData.dob = parsedDate;
    }
  }

  if (gender !== undefined) {
    if (gender === null || gender === '') {
      updateData.gender = null;
    } else {
      const validGenders = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
      const upperGender = String(gender).toUpperCase().trim();
      if (!validGenders.includes(upperGender)) {
        throw new ApiError(
          400,
          `Invalid gender. Must be one of: ${validGenders.join(', ')}`
        );
      }
      updateData.gender = upperGender;
    }
  }

  if (country !== undefined) {
    updateData.country = country === null || country === '' ? null : String(country).trim();
  }

  if (state !== undefined) {
    updateData.state = state === null || state === '' ? null : String(state).trim();
  }

  if (city !== undefined) {
    updateData.city = city === null || city === '' ? null : String(city).trim();
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      plan: true,
      coins: true,
      avatar_url: true,
      mobile_no: true,
      dob: true,
      gender: true,
      country: true,
      state: true,
      city: true,
      student_id: true,
      onboarded_by: true,
    },
  });

  return res.json(new ApiResponse(200, updatedUser, 'Profile details updated successfully'));
});

/**
 * POST /auth/google
 * Body: { idToken: string }
 * Header: x-client-type: mobile
 */
export const googleLogin = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  const clientType = req.headers['x-client-type'] || 'web'; // fallback to web

  if (!idToken || typeof idToken !== 'string') {
    throw new ApiError(400, 'idToken is required');
  }

  const result = await googleOAuthLogin(idToken);

  // For web clients: set refresh token as secure http-only cookie
  if (clientType === 'web') {
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }

  const responseData = {
    user: result.user,
    accessToken: result.accessToken,
  };

  // For mobile clients: include refresh token in response body
  if (clientType !== 'web') {
    responseData.refreshToken = result.refreshToken;
  }

  return res.status(200).json(
    new ApiResponse(200, responseData, 'Google login successful')
  );
});