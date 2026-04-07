import { verifyAccessToken } from '../modules/auth/auth.service.js';
import { getPrismaClient } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../config/logger.js';

const prisma = getPrismaClient();

/**
 * CORE AUTH (merged)
 * - supports guest
 * - supports DB user fetch
 */
const baseAuth = async (req, allowGuest = false) => {
  const header = req.headers.authorization;

  // No token case
  if (!header || !header.startsWith('Bearer ')) {
    if (allowGuest) {
      req.isGuest = true;
      return;
    }
    throw new ApiError(401, 'Missing or invalid token');
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    if (allowGuest) {
      req.isGuest = true;
      return;
    }
    throw new ApiError(401, 'Invalid or expired token');
  }

  // Guest handling (old system support)
  if (decoded.isGuest) {
    if (allowGuest) {
      req.isGuest = true;
      return;
    }
    throw new ApiError(401, 'Authentication required');
  }

  // DB lookup (new system)
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
  });

  if (!user) throw new ApiError(401, 'User not found');
  if (user.isBlocked) throw new ApiError(403, 'User blocked');

  req.user = user;
  req.isGuest = false;
};

/**
 * requireAuth (old compatible)
 */
export const requireAuth = async (req, res, next) => {
  try {
    await baseAuth(req, false);
    next();
  } catch (err) {
    return next(err);
  }
};

/**
 * allowGuest (old compatible)
 */
export const allowGuest = async (req, res, next) => {
  try {
    await baseAuth(req, true);
    next();
  } catch (err) {
    return next(err);
  }
};

/**
 * authMiddleware (new system compatible)
 */
export const authMiddleware = requireAuth;

/**
 * policyMiddleware (unchanged)
 */
export const policyMiddleware = (allowedPolicies = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'User not authenticated');
      }

      const user = req.user;

      const hasAccess = allowedPolicies.some(policy => {
        if (policy === 'ADMIN') return user.role === 'ADMIN';
        if (policy === 'FREE') return user.role === 'USER' && user.plan === 'FREE';
        if (policy === 'MEMBER') return user.role === 'USER' && user.plan === 'MEMBER';
      });

      if (!hasAccess) {
        throw new ApiError(403, 'Access denied');
      }

      next();
    } catch (err) {
      return next(err);
    }
  };
};