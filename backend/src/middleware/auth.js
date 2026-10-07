const db = require('../db/database');
const { verifyToken, COOKIE_NAME } = require('../utils/token');
const AppError = require('../utils/errors');

/**
 * Enforces mandatory JWT authentication from httpOnly cookie or Authorization header.
 */
async function authenticate(req, res, next) {
  try {
    let token = req.cookies ? req.cookies[COOKIE_NAME] : null;

    // Optional Bearer token header fallback
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw AppError.unauthorized('Authentication token missing. Please sign in.', 'AUTH_TOKEN_MISSING');
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      throw AppError.unauthorized('Session expired or invalid token. Please sign in again.', 'AUTH_TOKEN_INVALID');
    }

    // Load fresh user data
    const user = await db.queryOne(
      'SELECT id, name, email, age, sex, height_cm, weight_kg, activity_level, training_type, goal, daily_protein_target_g, meals_per_day, timezone, created_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      throw AppError.unauthorized('User associated with this session no longer exists.', 'USER_NOT_FOUND');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional authentication middleware.
 * If token is present and valid, attaches req.user; otherwise leaves req.user as null.
 */
async function optionalAuth(req, res, next) {
  try {
    let token = req.cookies ? req.cookies[COOKIE_NAME] : null;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = verifyToken(token);
      const user = await db.queryOne(
        'SELECT id, name, email, daily_protein_target_g, meals_per_day, timezone FROM users WHERE id = ?',
        [decoded.id]
      );
      req.user = user || null;
    } catch (err) {
      req.user = null;
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  authenticate,
  optionalAuth
};
