import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getPrismaClient } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import logger from '../../config/logger.js';

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