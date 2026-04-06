const bcrypt = require('bcrypt');
const config = require('../config');

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, config.bcryptRounds);
}

async function comparePassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

module.exports = { hashPassword, comparePassword };
