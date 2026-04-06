const { verifyAccessToken } = require('../utils/jwt');

// Requires valid JWT. Rejects guests. Sets req.user
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (decoded.isGuest) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

// Allows both JWT and guest tokens. Sets req.user or req.isGuest
function allowGuest(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.isGuest = true;
    return next();
  }
  try {
    const token = header.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (decoded.isGuest) {
      req.isGuest = true;
    } else {
      req.user = decoded;
      req.isGuest = false;
    }
    next();
  } catch (err) {
    req.isGuest = true;
    next();
  }
}

module.exports = { requireAuth, allowGuest };
