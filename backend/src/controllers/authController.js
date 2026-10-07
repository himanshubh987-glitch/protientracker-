const bcrypt = require('bcryptjs');
const db = require('../db/database');
const AppError = require('../utils/errors');
const { signToken, getAuthCookieOptions, COOKIE_NAME } = require('../utils/token');
const { calculateProteinPlan } = require('../utils/calculator');

/**
 * Register a new athlete account.
 */
async function register(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      age = 25,
      sex = 'male',
      height_cm = 175,
      weight_kg = 75,
      activity_level = 'moderate',
      training_type = 'hypertrophy',
      goal = 'maintain',
      meals_per_day = 4,
      timezone = 'UTC'
    } = req.body;

    const normalizedEmail = email.toLowerCase().trim();

    // Check unique email
    const existing = await db.queryOne('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      throw AppError.conflict('An account with this email address already exists.', 'EMAIL_ALREADY_EXISTS');
    }

    // Compute tailored initial protein target
    const plan = calculateProteinPlan({
      weight_kg,
      goal,
      activity_level,
      training_type,
      meals_per_day
    });

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const result = await db.execute(`
      INSERT INTO users (
        name, email, password_hash, age, sex, height_cm, weight_kg,
        activity_level, training_type, goal, daily_protein_target_g,
        meals_per_day, timezone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name.trim(),
      normalizedEmail,
      passwordHash,
      age,
      sex,
      height_cm,
      weight_kg,
      activity_level,
      training_type,
      goal,
      plan.total_daily_g,
      meals_per_day,
      timezone
    ]);

    const userId = result.lastInsertRowid;

    // Link default supplements for athlete convenience
    const defaultSupps = await db.query('SELECT id FROM supplements LIMIT 3');
    for (const supp of defaultSupps) {
      await db.execute(
        'INSERT INTO user_supplements (user_id, supplement_id, is_active, default_servings) VALUES (?, ?, 1, 1.0)',
        [userId, supp.id]
      );
    }

    const user = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      age,
      sex,
      height_cm,
      weight_kg,
      activity_level,
      training_type,
      goal,
      daily_protein_target_g: plan.total_daily_g,
      meals_per_day,
      timezone
    };

    // Issue JWT cookie
    const token = signToken({ id: user.id, email: user.email, name: user.name });
    res.cookie(COOKIE_NAME, token, getAuthCookieOptions());

    res.status(201).json({
      message: 'Athlete account registered successfully',
      token,
      user,
      initial_plan: plan
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Log in to existing account.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await db.queryOne(
      'SELECT id, name, email, password_hash, age, sex, height_cm, weight_kg, activity_level, training_type, goal, daily_protein_target_g, meals_per_day, timezone, created_at FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (!user) {
      throw AppError.unauthorized('Invalid email or password credentials.', 'INVALID_CREDENTIALS');
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password credentials.', 'INVALID_CREDENTIALS');
    }

    // Do not leak password hash
    delete user.password_hash;

    const token = signToken({ id: user.id, email: user.email, name: user.name });
    res.cookie(COOKIE_NAME, token, getAuthCookieOptions());

    res.json({
      message: 'Authenticated successfully',
      token,
      user
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Log out and invalidate httpOnly cookie.
 */
function logout(req, res) {
  const options = getAuthCookieOptions();
  res.clearCookie(COOKIE_NAME, options);
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}

/**
 * Get current authenticated user profile.
 */
function getMe(req, res) {
  res.json({
    user: req.user
  });
}

module.exports = {
  register,
  login,
  logout,
  getMe
};
