const { verifyAccessToken } = require('../utils/jwt');
const { prisma } = require('../prisma/client');

// Requires admin or sub_admin role. For sub_admins, checks section access.
function requireAdmin(section = null) {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }
    try {
      const token = header.split(' ')[1];
      const decoded = verifyAccessToken(token);

      if (decoded.role !== 'admin' && decoded.role !== 'sub_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Admin has full access
      if (decoded.role === 'admin') {
        req.admin = decoded;
        return next();
      }

      // Sub-admin: check section access if section is specified
      if (section) {
        const access = await prisma.subAdminAccess.findFirst({
          where: { user_id: decoded.id, section },
        });
        if (!access) {
          return res.status(403).json({ error: `No access to ${section} section` });
        }
      }

      req.admin = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
  };
}

module.exports = { requireAdmin };
