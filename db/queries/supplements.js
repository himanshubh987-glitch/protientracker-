/**
 * queries/supplements.js: Supplements catalog, user active toggles, and intake logging
 */

const { getDb } = require('../connection');
const { getTimezoneDayBounds } = require('./logs');

function list(userId = null, dbInstance = null) {
  const db = dbInstance || getDb();

  if (!userId) {
    return db.prepare('SELECT * FROM supplements ORDER BY name ASC').all();
  }

  const stmt = db.prepare(`
    SELECT 
      s.*,
      COALESCE(us.is_active, 1) AS is_active,
      COALESCE(us.default_servings, 1.0) AS default_servings
    FROM supplements s
    LEFT JOIN user_supplements us 
      ON s.id = us.supplement_id AND us.user_id = ?
    ORDER BY s.name ASC
  `);

  return stmt.all(userId);
}

function toggleForUser(userId, supplementId, isActive, defaultServings = 1.0, dbInstance = null) {
  const db = dbInstance || getDb();
  const activeInt = isActive ? 1 : 0;
  const servings = Number(defaultServings) || 1.0;

  const stmt = db.prepare(`
    INSERT INTO user_supplements (user_id, supplement_id, is_active, default_servings)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, supplement_id) DO UPDATE SET
      is_active = excluded.is_active,
      default_servings = excluded.default_servings
  `);

  stmt.run(userId, supplementId, activeInt, servings);

  return db.prepare(`
    SELECT * FROM user_supplements WHERE user_id = ? AND supplement_id = ?
  `).get(userId, supplementId);
}

function logIntake(userId, supplementId, servings = 1.0, dbInstance = null) {
  const db = dbInstance || getDb();

  const supplement = db.prepare('SELECT * FROM supplements WHERE id = ?').get(supplementId);
  if (!supplement) {
    throw new Error(`Supplement with id ${supplementId} not found`);
  }

  const sCount = Number(servings) || 1.0;
  const protein_g = Number(((supplement.protein_g || 0) * sCount).toFixed(1));
  const taken_at = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO supplement_logs (user_id, supplement_id, servings, protein_g, taken_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(userId, supplementId, sCount, protein_g, taken_at);

  return db.prepare(`
    SELECT sl.*, s.name AS supplement_name, s.serving_label
    FROM supplement_logs sl
    JOIN supplements s ON sl.supplement_id = s.id
    WHERE sl.id = ?
  `).get(result.lastInsertRowid);
}

function getTodayStatus(userId, dateStr, tz = 'UTC', dbInstance = null) {
  const db = dbInstance || getDb();
  const { startUtc, endUtc } = getTimezoneDayBounds(dateStr, tz);

  const stmt = db.prepare(`
    SELECT 
      s.id,
      s.name,
      s.type,
      s.serving_label,
      s.protein_g,
      COALESCE(us.is_active, 1) AS is_active,
      COALESCE(us.default_servings, 1.0) AS default_servings,
      CASE WHEN sl.today_servings > 0 THEN 1 ELSE 0 END AS taken_today,
      COALESCE(sl.today_servings, 0) AS servings_taken_today
    FROM supplements s
    LEFT JOIN user_supplements us 
      ON s.id = us.supplement_id AND us.user_id = ?
    LEFT JOIN (
      SELECT supplement_id, SUM(servings) AS today_servings
      FROM supplement_logs
      WHERE user_id = ? AND taken_at >= ? AND taken_at <= ?
      GROUP BY supplement_id
    ) sl ON s.id = sl.supplement_id
    ORDER BY s.name ASC
  `);

  return stmt.all(userId, userId, startUtc, endUtc);
}

module.exports = {
  list,
  toggleForUser,
  logIntake,
  getTodayStatus
};
