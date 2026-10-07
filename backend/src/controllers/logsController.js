const db = require('../db/database');
const AppError = require('../utils/errors');
const { getDayBoundaries, getLocalDateString } = require('../utils/dates');

/**
 * Log a food entry to a specific meal slot.
 * Preserves snapshot of protein_g and calories at logging time.
 */
async function createFoodLog(req, res, next) {
  try {
    const {
      food_id,
      quantity = 1.0,
      meal_type,
      logged_at
    } = req.body;

    const food = await db.queryOne('SELECT id, name, protein_g, calories, serving_label FROM foods WHERE id = ?', [food_id]);
    if (!food) {
      throw AppError.notFound('Referenced food item was not found.', 'FOOD_NOT_FOUND');
    }

    const qty = Math.max(0.01, Number(quantity) || 1.0);
    const computedProtein = Math.round(food.protein_g * qty * 10) / 10;
    const computedCalories = Math.round(food.calories * qty * 10) / 10;
    const timestamp = logged_at || new Date().toISOString();

    const result = await db.execute(`
      INSERT INTO food_logs (user_id, food_id, meal_type, quantity, protein_g, calories, logged_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.id,
      food.id,
      meal_type,
      qty,
      computedProtein,
      computedCalories,
      timestamp
    ]);

    const createdLog = await db.queryOne(`
      SELECT fl.id, fl.user_id, fl.food_id, fl.meal_type, fl.quantity,
             fl.protein_g, fl.calories, fl.logged_at,
             f.name as food_name, f.serving_label
      FROM food_logs fl
      LEFT JOIN foods f ON fl.food_id = f.id
      WHERE fl.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({
      message: 'Meal log entry created successfully',
      log: createdLog
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update an existing food log entry (quantity, meal_type, or custom protein/cal override).
 */
async function updateFoodLog(req, res, next) {
  try {
    const logId = parseInt(req.params.id, 10);
    const existing = await db.queryOne(
      'SELECT id, user_id, food_id, quantity, protein_g, calories, meal_type FROM food_logs WHERE id = ?',
      [logId]
    );

    if (!existing) {
      throw AppError.notFound('Food log entry not found.', 'LOG_NOT_FOUND');
    }

    if (existing.user_id !== req.user.id) {
      throw AppError.forbidden('You are not authorized to update this log entry.', 'FORBIDDEN');
    }

    const {
      quantity,
      meal_type = existing.meal_type,
      protein_g,
      calories
    } = req.body;

    let updatedQty = existing.quantity;
    let updatedProtein = existing.protein_g;
    let updatedCalories = existing.calories;

    if (quantity !== undefined) {
      updatedQty = Math.max(0.01, Number(quantity));
      // Recompute based on base food if available
      if (existing.food_id) {
        const food = await db.queryOne('SELECT protein_g, calories FROM foods WHERE id = ?', [existing.food_id]);
        if (food) {
          updatedProtein = Math.round(food.protein_g * updatedQty * 10) / 10;
          updatedCalories = Math.round(food.calories * updatedQty * 10) / 10;
        }
      }
    }

    // Direct manual override if provided
    if (protein_g !== undefined) updatedProtein = Number(protein_g);
    if (calories !== undefined) updatedCalories = Number(calories);

    await db.execute(`
      UPDATE food_logs SET
        quantity = ?,
        meal_type = ?,
        protein_g = ?,
        calories = ?
      WHERE id = ?
    `, [
      updatedQty,
      meal_type,
      updatedProtein,
      updatedCalories,
      logId
    ]);

    const updated = await db.queryOne(`
      SELECT fl.id, fl.user_id, fl.food_id, fl.meal_type, fl.quantity,
             fl.protein_g, fl.calories, fl.logged_at,
             f.name as food_name, f.serving_label
      FROM food_logs fl
      LEFT JOIN foods f ON fl.food_id = f.id
      WHERE fl.id = ?
    `, [logId]);

    res.json({
      message: 'Meal log updated successfully',
      log: updated
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a food log entry.
 */
async function deleteFoodLog(req, res, next) {
  try {
    const logId = parseInt(req.params.id, 10);
    const existing = await db.queryOne(
      'SELECT id, user_id FROM food_logs WHERE id = ?',
      [logId]
    );

    if (!existing) {
      throw AppError.notFound('Food log entry not found.', 'LOG_NOT_FOUND');
    }

    if (existing.user_id !== req.user.id) {
      throw AppError.forbidden('You are not authorized to delete this log entry.', 'FORBIDDEN');
    }

    await db.execute('DELETE FROM food_logs WHERE id = ?', [logId]);

    res.json({
      success: true,
      message: 'Meal log entry deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get all logs for a specific local calendar date.
 */
async function getLogs(req, res, next) {
  try {
    const userTz = req.user.timezone || 'UTC';
    const targetDate = req.query.date || getLocalDateString(userTz);
    const { startIso, endIso } = getDayBoundaries(targetDate, userTz);

    const logs = await db.query(`
      SELECT fl.id, fl.user_id, fl.food_id, fl.meal_type, fl.quantity,
             fl.protein_g, fl.calories, fl.logged_at,
             f.name as food_name, f.category, f.serving_label
      FROM food_logs fl
      LEFT JOIN foods f ON fl.food_id = f.id
      WHERE fl.user_id = ? AND fl.logged_at >= ? AND fl.logged_at <= ?
      ORDER BY fl.logged_at ASC
    `, [req.user.id, startIso, endIso]);

    // Group logs by meal type
    const grouped = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: []
    };

    let totalProtein = 0;
    let totalCalories = 0;

    for (const log of logs) {
      totalProtein += Number(log.protein_g) || 0;
      totalCalories += Number(log.calories) || 0;
      if (grouped[log.meal_type]) {
        grouped[log.meal_type].push(log);
      } else {
        grouped.snack.push(log);
      }
    }

    totalProtein = Math.round(totalProtein * 10) / 10;
    totalCalories = Math.round(totalCalories);

    res.json({
      date: targetDate,
      total_protein_g: totalProtein,
      total_calories: totalCalories,
      target_protein_g: req.user.daily_protein_target_g,
      remaining_protein_g: Math.max(0, Math.round((req.user.daily_protein_target_g - totalProtein) * 10) / 10),
      percent_of_target: req.user.daily_protein_target_g > 0
        ? Math.min(100, Math.round((totalProtein / req.user.daily_protein_target_g) * 100))
        : 0,
      meals: grouped,
      raw_logs: logs
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createFoodLog,
  updateFoodLog,
  deleteFoodLog,
  getLogs
};
