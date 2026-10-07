const db = require('../db/database');
const { calculateProteinPlan } = require('../utils/calculator');

/**
 * Public Protein Target Calculator with optional profile sync
 */
async function calculate(req, res, next) {
  try {
    const {
      weight_kg,
      height_cm,
      age = 25,
      sex = 'male',
      goal = 'maintain',
      activity_level = 'moderate',
      training_type = 'hypertrophy',
      meals_per_day = 4,
      save_as_my_target = false
    } = req.body;

    const plan = calculateProteinPlan({
      weight_kg,
      goal,
      activity_level,
      training_type,
      meals_per_day
    });

    let savedToProfile = false;

    // Optional save to profile if user is authenticated
    if (save_as_my_target && req.user) {
      await db.execute(`
        UPDATE users SET
          daily_protein_target_g = ?,
          weight_kg = COALESCE(?, weight_kg),
          height_cm = COALESCE(?, height_cm),
          age = COALESCE(?, age),
          sex = COALESCE(?, sex),
          goal = COALESCE(?, goal),
          activity_level = COALESCE(?, activity_level),
          training_type = COALESCE(?, training_type),
          meals_per_day = COALESCE(?, meals_per_day)
        WHERE id = ?
      `, [
        plan.total_daily_g,
        weight_kg,
        height_cm,
        age,
        sex,
        goal,
        activity_level,
        training_type,
        meals_per_day,
        req.user.id
      ]);
      savedToProfile = true;
    }

    res.json({
      ...plan,
      saved_to_profile: savedToProfile
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  calculate
};
