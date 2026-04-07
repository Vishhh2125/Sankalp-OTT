import bcrypt from 'bcrypt';
import config from '../config/index.js';

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, config.bcryptRounds);
}

async function comparePassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

export { hashPassword, comparePassword };
