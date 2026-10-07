/**
 * queries/users.js: Data-access layer for athlete users
 * Includes automatic target recalibration on anthropometric updates
 */

const bcrypt = require('bcryptjs');
const { getDb } = require('../connection');

/**
 * Scientific target calculation formula
 */
function calculateProteinTarget({ weight_kg, goal = 'bulk', training_type = 'hypertrophy', activity_level = 'moderate' }) {
  const weight = Number(weight_kg) || 75;
  let gPerKg = 1.6; // Baseline (Morton et al., 2018)

  if (goal === 'cut') gPerKg += 0.4;
  else if (goal === 'bulk') gPerKg += 0.2;

  if (training_type === 'strength' || training_type === 'hypertrophy') gPerKg += 0.2;
  else if (training_type === 'hybrid') gPerKg += 0.1;

  let activityMultiplier = 1.0;
  if (activity_level === 'sedentary') activityMultiplier = 0.95;
  else if (activity_level === 'moderate') activityMultiplier = 1.05;
  else if (activity_level === 'very_active' || activity_level === 'heavy') activityMultiplier = 1.10;

  let finalTargetPerKg = gPerKg * activityMultiplier;
  // Safety physiological clamp [1.2, 3.3] g/kg
  finalTargetPerKg = Math.max(1.2, Math.min(3.3, finalTargetPerKg));

  return Math.round(weight * finalTargetPerKg);
}

function create(userData, dbInstance = null) {
  const db = dbInstance || getDb();

  const name = userData.name;
  const email = userData.email.toLowerCase().trim();
  const passwordHash = userData.password_hash || (userData.password ? bcrypt.hashSync(userData.password, 10) : 'hash');
  const age = userData.age || null;
  const sex = userData.sex || 'male';
  const height_cm = userData.height_cm || null;
  const weight_kg = userData.weight_kg || 75;
  const activity_level = userData.activity_level || 'moderate';
  const training_type = userData.training_type || 'hypertrophy';
  const goal = userData.goal || 'bulk';
  const meals_per_day = userData.meals_per_day || 4;
  const timezone = userData.timezone || 'UTC';

  const daily_protein_target_g = userData.daily_protein_target_g !== undefined
    ? Number(userData.daily_protein_target_g)
    : calculateProteinTarget({ weight_kg, goal, training_type, activity_level });

  const stmt = db.prepare(`
    INSERT INTO users (
      name, email, password_hash, age, sex, height_cm, weight_kg,
      activity_level, training_type, goal, daily_protein_target_g,
      meals_per_day, timezone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    name, email, passwordHash, age, sex, height_cm, weight_kg,
    activity_level, training_type, goal, daily_protein_target_g,
    meals_per_day, timezone
  );

  return getById(result.lastInsertRowid, db);
}

function getById(id, dbInstance = null) {
  const db = dbInstance || getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

function getByEmail(email, dbInstance = null) {
  const db = dbInstance || getDb();
  return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email.trim()) || null;
}

function updateProfile(id, updates, dbInstance = null) {
  const db = dbInstance || getDb();
  const current = getById(id, db);
  if (!current) return null;

  const name = updates.name !== undefined ? updates.name : current.name;
  const age = updates.age !== undefined ? updates.age : current.age;
  const sex = updates.sex !== undefined ? updates.sex : current.sex;
  const height_cm = updates.height_cm !== undefined ? updates.height_cm : current.height_cm;
  const weight_kg = updates.weight_kg !== undefined ? updates.weight_kg : current.weight_kg;
  const activity_level = updates.activity_level !== undefined ? updates.activity_level : current.activity_level;
  const training_type = updates.training_type !== undefined ? updates.training_type : current.training_type;
  const goal = updates.goal !== undefined ? updates.goal : current.goal;
  const meals_per_day = updates.meals_per_day !== undefined ? updates.meals_per_day : current.meals_per_day;
  const timezone = updates.timezone !== undefined ? updates.timezone : current.timezone;

  // Recalculate target if body stats/goals change and no explicit target is passed
  let daily_protein_target_g = updates.daily_protein_target_g;
  if (daily_protein_target_g === undefined) {
    if (
      updates.weight_kg !== undefined ||
      updates.goal !== undefined ||
      updates.training_type !== undefined ||
      updates.activity_level !== undefined
    ) {
      daily_protein_target_g = calculateProteinTarget({ weight_kg, goal, training_type, activity_level });
    } else {
      daily_protein_target_g = current.daily_protein_target_g;
    }
  }

  const stmt = db.prepare(`
    UPDATE users SET
      name = ?, age = ?, sex = ?, height_cm = ?, weight_kg = ?,
      activity_level = ?, training_type = ?, goal = ?,
      daily_protein_target_g = ?, meals_per_day = ?, timezone = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `);

  stmt.run(
    name, age, sex, height_cm, weight_kg,
    activity_level, training_type, goal,
    daily_protein_target_g, meals_per_day, timezone,
    id
  );

  return getById(id, db);
}

module.exports = {
  create,
  getById,
  getByEmail,
  updateProfile,
  calculateProteinTarget
};
