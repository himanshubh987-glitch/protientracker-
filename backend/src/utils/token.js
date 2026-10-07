const jwt = require('jsonwebtoken');
const config = require('../config/env');

const COOKIE_NAME = 'pt_auth_token';

/**
 * Signs a JWT payload for an authenticated user.
 * @param {Object} payload { id, email, name }
 * @returns {string}
 */
function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Verifies and decodes a JWT token.
 * @param {string} token
 * @returns {Object} decoded payload
 */
function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

/**
 * Returns standard secure cookie options for httpOnly cookie transport.
 * @returns {Object}
 */
function getAuthCookieOptions() {
  const isProd = config.isProduction;
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
  };
}

module.exports = {
  COOKIE_NAME,
  signToken,
  verifyToken,
  getAuthCookieOptions,
};
