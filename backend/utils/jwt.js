import jwt from 'jsonwebtoken';
import config from '../config/index.js';

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtAccessTtl }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: '30d' }
  );
}

function generateGuestToken() {
  return jwt.sign(
    { isGuest: true },
    config.jwtSecret,
    { expiresIn: '24h' }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwtRefreshSecret);
}

export {
  generateAccessToken,
  generateRefreshToken,
  generateGuestToken,
  verifyAccessToken,
  verifyRefreshToken,
};
