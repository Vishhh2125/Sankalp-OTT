/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */

import { verifyAccessToken } from '../modules/auth/auth.service.js';
import { getPrismaClient } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../config/logger.js';

const prisma = getPrismaClient();

/**
 * Auth middleware - Verify token and attach user to req
 * Usage: app.use('/protected-route', authMiddleware)
 */
export const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new ApiError(401, 'Authorization header missing');
    }

    // Check Bearer format
    if (!authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Invalid authorization header format. Use: Bearer <token>');
    }

    // Extract token
    const token = authHeader.slice(7); // Remove "Bearer "

    if (!token || token.trim().length === 0) {
      throw new ApiError(401, 'Token is empty');
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      throw new ApiError(401, 'Invalid or expired token');
    }

    if (!decoded || !decoded.id) {
      throw new ApiError(401, 'Token payload is invalid');
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        coins: true,
        isBlocked: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    // Check if user is blocked
    if (user.isBlocked) {
      throw new ApiError(403, 'User account is blocked');
    }

    // Attach user to request
    req.user = user;

    logger.debug(`[Auth] User authenticated`, { userId: user.id, email: user.email });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', { 
      error: error.message,
      authHeader: req.headers.authorization ? 'present' : 'missing'
    });

    // If already an ApiError, pass it through
    if (error instanceof ApiError) {
      return next(error);
    }

    // Generic error
    return next(new ApiError(401, 'Authentication failed'));
  }
};

export default authMiddleware;

/**
 * Policy-Based Role Middleware
 * Checks if user's role/plan matches allowed policies
 * 
 * Allowed values:
 * - 'ADMIN': User with ADMIN role
 * - 'FREE': USER with FREE plan
 * - 'MEMBER': USER with MEMBER plan
 * 
 * Usage:
 * router.get('/content', authMiddleware, policyMiddleware(['ADMIN', 'MEMBER']), handler)
 */
export const policyMiddleware = (allowedPolicies = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'User not authenticated');
      }

      const user = req.user;

      // Check if user's role/plan matches allowed policies
      let hasAccess = false;

      for (const policy of allowedPolicies) {
        if (policy === 'ADMIN' && user.role === 'ADMIN') {
          hasAccess = true;
          break;
        }

        if (policy === 'FREE' && user.role === 'USER' && user.plan === 'FREE') {
          hasAccess = true;
          break;
        }

        if (policy === 'MEMBER' && user.role === 'USER' && user.plan === 'MEMBER') {
          hasAccess = true;
          break;
        }
      }

      if (!hasAccess) {
        logger.warn('Access denied by policy', {
          userId: user.id,
          userRole: user.role,
          userPlan: user.plan,
          allowedPolicies,
          path: req.path,
          method: req.method
        });
        throw new ApiError(403, `Access denied. Required policies: ${allowedPolicies.join(', ')}`);
      }

      // Find matched policy
      const matchedPolicy = allowedPolicies.find(p => {
        if (p === 'ADMIN') return user.role === 'ADMIN';
        if (p === 'FREE') return user.role === 'USER' && user.plan === 'FREE';
        if (p === 'MEMBER') return user.role === 'USER' && user.plan === 'MEMBER';
      });

      // Attach to request
      req.userRole = user.role;
      req.userPlan = user.plan;
      req.matchedPolicy = matchedPolicy;

      logger.debug('Policy check passed', {
        userId: user.id,
        userRole: user.role,
        userPlan: user.plan,
        matchedPolicy
      });

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        return next(error);
      }
      return next(new ApiError(403, 'Access denied'));
    }
  };
};
