import { verifyAccessToken } from '../modules/auth/auth.service.js';
import { getPrismaClient } from '../config/db.js';

const prisma = getPrismaClient();

/**
 * optionalAuth — same flow as requireAuth, but calls next() without error
 * if no token is present.  Sets req.user when a valid token exists,
 * otherwise req.user remains undefined (guest).
 */
export const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;

  // No token → guest, continue without error
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    // Invalid / expired token → treat as guest
    return next();
  }

  // Guest-flagged token → treat as guest
  if (decoded.isGuest) {
    return next();
  }

  // Lookup real user
  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (user && !user.isBlocked) {
      req.user = user;
    }
  } catch {
    // DB error → treat as guest, don't block the request
  }

  next();
};
