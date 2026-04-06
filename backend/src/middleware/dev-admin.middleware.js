const { verifyAccessToken } = require('../utils/jwt');
const { prisma } = require('../prisma/client');
const config = require('../config');

// In development mode, if no token is provided, inject the seeded admin user
// In production, this falls through to the real requireAdmin check
function devAdmin(section = null) {
  return async (req, res, next) => {
    const header = req.headers.authorization;

    // If token is provided, verify it normally
    if (header && header.startsWith('Bearer ')) {
      try {
        const token = header.split(' ')[1];
        const decoded = verifyAccessToken(token);
        if (decoded.role !== 'admin' && decoded.role !== 'sub_admin') {
          return res.status(403).json({ error: 'Admin access required' });
        }
        req.admin = decoded;
        return next();
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    // No token — in development, auto-inject admin
    if (config.nodeEnv === 'development') {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      if (admin) {
        req.admin = { id: admin.id, email: admin.email, role: admin.role };
        return next();
      }
    }

    return res.status(401).json({ error: 'Missing token' });
  };
}

module.exports = { devAdmin };
