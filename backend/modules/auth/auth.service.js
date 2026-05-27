import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getPrismaClient } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import logger from '../../config/logger.js';
import { 
  generateOTP, 
  hashOTP, 
  compareOTP, 
  checkResendRateLimit, 
  clearResendRateLimit 
} from '../../utils/otp.js';
import { sendOtpEmail } from '../../config/email.js';

const prisma = getPrismaClient();

// JWT configuration
const JWT_CONFIG = {
  access: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production-abc123xyz',
    expiresIn: '15m'
  },
  refresh: {
    secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production-789def',
    expiresIn: '7d'
  }
};

/**
 * Hash password using bcrypt (industry standard)
 */
export const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(12); // 12 rounds - industry standard
    return await bcrypt.hash(password, salt);
  } catch (error) {
    logger.error('Error hashing password', { error: error.message });
    throw new ApiError(500, 'Failed to hash password');
  }
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password, hash) => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error('Error comparing password', { error: error.message });
    throw new ApiError(500, 'Failed to compare password');
  }
};

/**
 * Generate access token
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_CONFIG.access.secret,
    { expiresIn: JWT_CONFIG.access.expiresIn }
  );
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    JWT_CONFIG.refresh.secret,
    { expiresIn: JWT_CONFIG.refresh.expiresIn }
  );
};

/**
 * Hash refresh token for secure storage
 */
export const hashRefreshToken = async (token) => {
  try {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(token, salt);
  } catch (error) {
    logger.error('Error hashing refresh token', { error: error.message });
    throw new ApiError(500, 'Failed to hash refresh token');
  }
};

/**
 * Verify stored refresh token matches the provided token
 * @param {string} token - Plain refresh token from request
 * @param {string} storedHash - Hashed refresh token from database
 * @returns {Promise<boolean>} true if tokens match
 */
export const verifyStoredRefreshToken = async (token, storedHash) => {
  try {
    return await bcrypt.compare(token, storedHash);
  } catch (error) {
    logger.error('Error verifying stored refresh token', { error: error.message });
    throw new ApiError(500, 'Failed to verify refresh token');
  }
};

/**
 * Register new user
 */
export const registerUser = async (userData) => {
  try {
    const { name, email, password } = userData;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new ApiError(409, 'Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user with default values: coins=0, plan=FREE, role=USER
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role: 'USER',
        plan: 'FREE',
        coins: 0,
        isBlocked: false
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        coins: true
      }
    });

    logger.info('User registered successfully', { userId: user.id, email: user.email });

    // Return user (tokens will be generated only during login)
    return {
      user
    };
  } catch (error) {
    logger.error('Registration error', { error: error.message });
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to register user', [error.message]);
  }
};

/**
 * Verify JWT token
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.access.secret);
  } catch (error) {
    logger.error('Token verification failed', { error: error.message });
    throw new ApiError(401, 'Invalid or expired access token');
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.refresh.secret);
  } catch (error) {
    logger.error('Refresh token verification failed', { error: error.message });
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
};

/**
 * Login user
 */
export const loginUser = async (userData) => {
  try {
    const { email, password } = userData;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    // Check if user is blocked
    if (user.isBlocked) {
      throw new ApiError(403, 'Your account has been blocked');
    }

    // Compare passwords
    const isPasswordMatch = await comparePassword(password, user.password);
    if (!isPasswordMatch) {
      throw new ApiError(401, 'Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Hash refresh token for storage
    const refreshTokenHash = await hashRefreshToken(refreshToken);

    // Store refresh token hash in DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshTokenHash
      }
    });

    logger.info('User login successful', { userId: user.id, email: user.email });

    // Return user without password and tokens
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken
    };
  } catch (error) {
    logger.error('Login error', { error: error.message });
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to login', [error.message]);
  }
};

/**
 * Register admin user
 */
export const registerAdmin = async (adminData) => {
  try {
    const { name, email, password } = adminData;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new ApiError(409, 'Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create admin user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role: 'ADMIN',
        plan: null,
        coins: 0,
        isBlocked: false
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        coins: true
      }
    });

    logger.info('Admin user registered successfully', { userId: user.id, email: user.email });

    // Return user (no tokens - admin must login to get tokens)
    return {
      user
    };
  } catch (error) {
    logger.error('Admin registration error', { error: error.message });
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to register admin', [error.message]);
  }
};

/**
 * Logout user - null refresh token in database
 */
export const logoutUserService = async (userId) => {
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true }
    });

    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    // Null refresh token in DB
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null }
    });

    logger.info('User logged out successfully', { userId, email: user.email });
    return user;
  } catch (error) {
    logger.error('Logout service error', { error: error.message });
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to logout', [error.message]);
  }
};

// ============================================
// OTP REGISTRATION FLOW
// ============================================

/**
 * Step 1: Initiate registration - Generate OTP and send email
 * Does NOT create user yet
 * @param {Object} userData - { name, email, password }
 * @returns {Promise<Object>} - { sessionId, email (masked), expiresAt }
 */
export const initiateRegistration = async (userData) => {
  try {
    const { name, email, password } = userData;

    // Check if email already in RegistrationSession (user started signup)
    const existingSession = await prisma.registrationSession.findUnique({
      where: { email }
    });

    if (existingSession) {
      if (new Date() > existingSession.expires_at) {
        await prisma.registrationSession.delete({ where: { id: existingSession.id } });
      } else {
        throw new ApiError(409, 'Registration already in progress for this email. Check your inbox for OTP.');
      }
    }

    // Check if user already exists (completed registration)
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new ApiError(409, 'Email already registered. Please login or use a different email.');
    }

    // Hash password temporarily (stored in session, not in User model yet)
    const passwordHash = await hashPassword(password);

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);

    // Create registration session (expires in 24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const session = await prisma.registrationSession.create({
      data: {
        email,
        name,
        password_hash: passwordHash,
        expires_at: expiresAt
      }
    });

    // Create OTP token (expires in 10 minutes)
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    // Delete any existing OTP for this email (cleanup old ones)
    await prisma.otpToken.deleteMany({
      where: { email }
    });

    const otpToken = await prisma.otpToken.create({
      data: {
        email,
        otp_hash: otpHash,
        attempts: 0,
        expires_at: otpExpiresAt
      }
    });

    // Send OTP email (async, don't block response)
    setImmediate(async () => {
      try {
        await sendOtpEmail(email, otp);
      } catch (error) {
        logger.error('Failed to send OTP email (user can retry)', { email, error: error.message });
      }
    });

    logger.info('Registration initiated', { 
      sessionId: session.id, 
      email, 
      otpExpiresAt: otpExpiresAt.toISOString() 
    });

    // Return sessionId and masked email to frontend
    const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    
    return {
      sessionId: session.id,
      email: maskedEmail,
      originalEmail: email,
      expiresAt: expiresAt.toISOString(),
      otpExpiresAt: otpExpiresAt.toISOString()
    };
  } catch (error) {
    logger.error('Registration initiation failed', { error: error.message });
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to initiate registration', [error.message]);
  }
};

/**
 * Step 2: Verify OTP and create user account
 * @param {Object} verificationData - { sessionId, otp }
 * @returns {Promise<Object>} - { user: {...}, message }
 */
export const verifyOtpAndCreateUser = async (verificationData) => {
  try {
    const { sessionId, otp } = verificationData;

    // Fetch registration session
    const session = await prisma.registrationSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new ApiError(404, 'Registration session not found. Please register again.');
    }

    // Check if session expired
    if (new Date() > session.expires_at) {
      await prisma.registrationSession.delete({ where: { id: sessionId } });
      throw new ApiError(400, 'Registration session expired. Please register again.');
    }

    // Fetch OTP token
    const otpToken = await prisma.otpToken.findUnique({
      where: { email: session.email }
    });

    if (!otpToken) {
      throw new ApiError(400, 'OTP not found. Please request a new OTP.');
    }

    // Check if OTP expired
    if (new Date() > otpToken.expires_at) {
      await prisma.otpToken.delete({ where: { id: otpToken.id } });
      throw new ApiError(400, 'OTP expired. Please request a new OTP.');
    }

    // Check attempt limit
    if (otpToken.attempts >= otpToken.max_attempts) {
      await prisma.otpToken.delete({ where: { id: otpToken.id } });
      throw new ApiError(429, 'Too many failed attempts. Please request a new OTP.');
    }

    // Verify OTP
    const isOtpValid = await compareOTP(otp, otpToken.otp_hash);

    if (!isOtpValid) {
      // Increment attempts
      await prisma.otpToken.update({
        where: { id: otpToken.id },
        data: { attempts: otpToken.attempts + 1 }
      });

      const attemptsLeft = otpToken.max_attempts - otpToken.attempts - 1;
      throw new ApiError(400, `Invalid OTP. ${attemptsLeft} attempts remaining.`);
    }

    // OTP is valid! Create user account
    const user = await prisma.user.create({
      data: {
        name: session.name,
        email: session.email,
        password: session.password_hash,
        role: 'USER',
        plan: 'FREE',
        coins: 0,
        isBlocked: false
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        coins: true,
        createdAt: true
      }
    });

    // Cleanup: Delete OTP and session records
    await prisma.otpToken.delete({ where: { id: otpToken.id } });
    await prisma.registrationSession.delete({ where: { id: sessionId } });

    // Clear rate limiting
    await clearResendRateLimit(session.email);

    logger.info('User account created after OTP verification', { 
      userId: user.id, 
      email: user.email 
    });

    return {
      user,
      message: 'Email verified successfully. You can now login.'
    };
  } catch (error) {
    logger.error('OTP verification failed', { error: error.message });
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to verify OTP', [error.message]);
  }
};

/**
 * Resend OTP with rate limiting
 * @param {string} sessionId
 * @returns {Promise<Object>} - { message, nextResendAt, remainingResends }
 */
export const resendOTP = async (sessionId) => {
  try {
    // Fetch registration session
    const session = await prisma.registrationSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new ApiError(404, 'Registration session not found.');
    }

    if (new Date() > session.expires_at) {
      await prisma.registrationSession.delete({ where: { id: sessionId } });
      throw new ApiError(400, 'Registration session expired.');
    }

    // Check rate limit
    const rateLimit = await checkResendRateLimit(session.email);
    
    if (!rateLimit.allowed) {
      throw new ApiError(429, rateLimit.error || 'Too many resend requests');
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Delete old OTP and create new one
    await prisma.otpToken.deleteMany({ where: { email: session.email } });
    
    const otpToken = await prisma.otpToken.create({
      data: {
        email: session.email,
        otp_hash: otpHash,
        attempts: 0,
        expires_at: otpExpiresAt
      }
    });

    // Send email
    setImmediate(async () => {
      try {
        await sendOtpEmail(session.email, otp);
      } catch (error) {
        logger.error('Failed to resend OTP email', { email: session.email, error: error.message });
      }
    });

    logger.info('OTP resent', { sessionId, email: session.email });

    return {
      message: 'New OTP sent to your email',
      nextResendAt: rateLimit.nextResendAt,
      otpExpiresAt: otpExpiresAt.toISOString(),
      remainingResends: rateLimit.remainingResends
    };
  } catch (error) {
    logger.error('OTP resend failed', { error: error.message });
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to resend OTP', [error.message]);
  }
};