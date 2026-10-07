const db = require('../db/database');
const AppError = require('../utils/errors');
const { getDayBoundaries, getLocalDateString } = require('../utils/dates');

/**
 * Get catalog of supplements with athlete's personalized active status and today's intake.
 */
async function getSupplements(req, res, next) {
  try {
    const userId = req.user.id;
    const userTz = req.user.timezone || 'UTC';
    const targetDate = req.query.date || getLocalDateString(userTz);
    const { startIso, endIso } = getDayBoundaries(targetDate, userTz);

    // Query supplements, left joining user preferences and today's logs
    const sql = `
      SELECT s.id, s.name, s.type, s.serving_label, s.protein_g, s.notes,
             COALESCE(us.is_active, 1) as is_active,
             COALESCE(us.default_servings, 1.0) as default_servings,
             COUNT(sl.id) as times_taken_today,
             COALESCE(SUM(sl.servings), 0) as total_servings_today,
             CASE WHEN COUNT(sl.id) > 0 THEN 1 ELSE 0 END as taken_today
      FROM supplements s
      LEFT JOIN user_supplements us ON s.id = us.supplement_id AND us.user_id = ?
      LEFT JOIN supplement_logs sl ON s.id = sl.supplement_id AND sl.user_id = ? AND sl.taken_at >= ? AND sl.taken_at <= ?
      GROUP BY s.id
      ORDER BY is_active DESC, s.name ASC
    `;

    const supplements = await db.query(sql, [userId, userId, startIso, endIso]);

    res.json({
      date: targetDate,
      supplements: supplements.map(s => ({
        ...s,
        is_active: Boolean(s.is_active),
        taken_today: Boolean(s.taken_today),
        total_servings_today: Number(s.total_servings_today),
        times_taken_today: Number(s.times_taken_today)
      }))
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Toggle active status of a supplement in user's daily tracking stack.
 */
async function toggleSupplement(req, res, next) {
  try {
    const suppId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    const supplement = await db.queryOne('SELECT id, name FROM supplements WHERE id = ?', [suppId]);
    if (!supplement) {
      throw AppError.notFound('Supplement not found in catalog.', 'SUPPLEMENT_NOT_FOUND');
    }

    const existing = await db.queryOne(
      'SELECT is_active FROM user_supplements WHERE user_id = ? AND supplement_id = ?',
      [userId, suppId]
    );

    let newStatus = 1;
    if (existing) {
      newStatus = existing.is_active ? 0 : 1;
      await db.execute(
        'UPDATE user_supplements SET is_active = ? WHERE user_id = ? AND supplement_id = ?',
        [newStatus, userId, suppId]
      );
    } else {
      // If toggled when not yet explicitly recorded, toggle to 0 (since default was active 1)
      newStatus = 0;
      await db.execute(
        'INSERT INTO user_supplements (user_id, supplement_id, is_active, default_servings) VALUES (?, ?, ?, 1.0)',
        [userId, suppId, newStatus]
      );
    }

    res.json({
      message: `Supplement ${supplement.name} is now ${newStatus ? 'active' : 'inactive'} in your cockpit`,
      supplement_id: suppId,
      is_active: Boolean(newStatus)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Log a supplement serving intake.
 */
async function logSupplement(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      supplement_id,
      servings = 1.0,
      taken_at
    } = req.body;

    const supplement = await db.queryOne('SELECT id, name, protein_g FROM supplements WHERE id = ?', [supplement_id]);
    if (!supplement) {
      throw AppError.notFound('Referenced supplement does not exist.', 'SUPPLEMENT_NOT_FOUND');
    }

    const qty = Math.max(0.1, Number(servings) || 1.0);
    const proteinAdded = Math.round(supplement.protein_g * qty * 10) / 10;
    const timestamp = taken_at || new Date().toISOString();

    const result = await db.execute(`
      INSERT INTO supplement_logs (user_id, supplement_id, servings, protein_g, taken_at)
      VALUES (?, ?, ?, ?, ?)
    `, [
      userId,
      supplement.id,
      qty,
      proteinAdded,
      timestamp
    ]);

    // Ensure it is marked active in athlete's stack
    await db.execute(`
      INSERT INTO user_supplements (user_id, supplement_id, is_active, default_servings)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(user_id, supplement_id) DO UPDATE SET is_active = 1
    `, [userId, supplement.id, qty]);

    const createdLog = await db.queryOne(`
      SELECT sl.id, sl.user_id, sl.supplement_id, sl.servings, sl.protein_g, sl.taken_at,
             s.name as supplement_name, s.serving_label
      FROM supplement_logs sl
      JOIN supplements s ON sl.supplement_id = s.id
      WHERE sl.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({
      message: `Logged ${supplement.name} (+${proteinAdded}g protein)`,
      log: createdLog
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSupplements,
  toggleSupplement,
  logSupplement
};
