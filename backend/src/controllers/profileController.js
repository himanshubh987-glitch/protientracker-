const db = require('../db/database');
const { calculateProteinPlan } = require('../utils/calculator');

/**
 * Get current athlete profile.
 */
async function getProfile(req, res, next) {
  try {
    const user = await db.queryOne(`
      SELECT id, name, email, age, sex, height_cm, weight_kg,
             activity_level, training_type, goal, daily_protein_target_g,
             meals_per_day, timezone, created_at
      FROM users WHERE id = ?
    `, [req.user.id]);

    const plan = calculateProteinPlan({
      weight_kg: user.weight_kg,
      goal: user.goal,
      activity_level: user.activity_level,
      training_type: user.training_type,
      meals_per_day: user.meals_per_day
    });

    res.json({
      user,
      plan
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update athlete profile stats.
 * Automatically recalculates daily protein target when body or training stats change.
 */
async function updateProfile(req, res, next) {
  try {
    const current = req.user;
    const {
      name = current.name,
      age = current.age,
      sex = current.sex,
      height_cm = current.height_cm,
      weight_kg = current.weight_kg,
      activity_level = current.activity_level,
      training_type = current.training_type,
      goal = current.goal,
      meals_per_day = current.meals_per_day,
      timezone = current.timezone,
      custom_target_g
    } = req.body;

    // Recalculate target unless explicit custom override is passed
    let newTargetG;
    let plan;

    if (custom_target_g && Number(custom_target_g) > 0) {
      newTargetG = Math.round(Number(custom_target_g));
      plan = calculateProteinPlan({
        weight_kg,
        goal,
        activity_level,
        training_type,
        meals_per_day
      });
      plan.total_daily_g = newTargetG;
    } else {
      plan = calculateProteinPlan({
        weight_kg,
        goal,
        activity_level,
        training_type,
        meals_per_day
      });
      newTargetG = plan.total_daily_g;
    }

    await db.execute(`
      UPDATE users SET
        name = ?,
        age = ?,
        sex = ?,
        height_cm = ?,
        weight_kg = ?,
        activity_level = ?,
        training_type = ?,
        goal = ?,
        daily_protein_target_g = ?,
        meals_per_day = ?,
        timezone = ?
      WHERE id = ?
    `, [
      name.trim(),
      age,
      sex,
      height_cm,
      weight_kg,
      activity_level,
      training_type,
      goal,
      newTargetG,
      meals_per_day,
      timezone,
      current.id
    ]);

    const updatedUser = await db.queryOne(`
      SELECT id, name, email, age, sex, height_cm, weight_kg,
             activity_level, training_type, goal, daily_protein_target_g,
             meals_per_day, timezone, created_at
      FROM users WHERE id = ?
    `, [current.id]);

    res.json({
      message: 'Athlete profile updated and target recalculated successfully',
      user: updatedUser,
      plan
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile
};
