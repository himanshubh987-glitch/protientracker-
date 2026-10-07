/**
 * queries/logs.js: Food intake logging with snapshot macro preservation
 * Supports client timezone-aware date querying and meal-slot grouping
 */

const { getDb } = require('../connection');

/**
 * Calculates UTC start and end bounds for a given calendar date in a target IANA timezone
 */
function getTimezoneDayBounds(dateStr, timeZone = 'UTC') {
  // Fallback to UTC if timezone is invalid
  let tz = timeZone || 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
  } catch (e) {
    tz = 'UTC';
  }

  // If UTC, simple direct string bounds
  if (tz === 'UTC') {
    return {
      startUtc: `${dateStr}T00:00:00.000Z`,
      endUtc: `${dateStr}T23:59:59.999Z`
    };
  }

  // Parse YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number);
  // Estimate UTC midnight
  const approx = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  // Offset formatter
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });

  function getLocalTime(utcMs) {
    const parts = formatter.formatToParts(new Date(utcMs));
    const p = {};
    for (const part of parts) p[part.type] = part.value;
    return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)).getTime();
  }

  const targetStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).getTime();
  const targetEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)).getTime();

  // Offset delta
  const localAtApprox = getLocalTime(approx.getTime());
  const offset = approx.getTime() - localAtApprox;

  const startUtcMs = targetStart + offset;
  const endUtcMs = targetEnd + offset;

  return {
    startUtc: new Date(startUtcMs).toISOString(),
    endUtc: new Date(endUtcMs).toISOString()
  };
}

function addFood(data, dbInstance = null) {
  const db = dbInstance || getDb();

  const user_id = data.user_id;
  const food_id = data.food_id;
  const meal_type = (data.meal_type || 'lunch').toLowerCase();
  const quantity = Number(data.quantity) || 1.0;
  const logged_at = data.logged_at || new Date().toISOString();

  // Lookup food to compute snapshot macros
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(food_id);
  if (!food) {
    throw new Error(`Food with id ${food_id} not found`);
  }

  const protein_g = Number((food.protein_g * quantity).toFixed(1));
  const calories = Number((food.calories * quantity).toFixed(1));

  const stmt = db.prepare(`
    INSERT INTO food_logs (
      user_id, food_id, meal_type, quantity, protein_g, calories, logged_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(user_id, food_id, meal_type, quantity, protein_g, calories, logged_at);

  return db.prepare(`
    SELECT fl.*, f.name AS food_name, f.serving_label, f.category
    FROM food_logs fl
    JOIN foods f ON fl.food_id = f.id
    WHERE fl.id = ?
  `).get(result.lastInsertRowid);
}

function updateFood(logId, updates, dbInstance = null) {
  const db = dbInstance || getDb();
  const existing = db.prepare('SELECT * FROM food_logs WHERE id = ?').get(logId);
  if (!existing) return null;

  const meal_type = updates.meal_type ? updates.meal_type.toLowerCase() : existing.meal_type;
  const quantity = updates.quantity !== undefined ? Number(updates.quantity) : existing.quantity;

  let protein_g = existing.protein_g;
  let calories = existing.calories;

  // If quantity changed, recalculate snapshot based on linked food
  if (updates.quantity !== undefined && quantity !== existing.quantity) {
    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(existing.food_id);
    if (food) {
      protein_g = Number((food.protein_g * quantity).toFixed(1));
      calories = Number((food.calories * quantity).toFixed(1));
    }
  }

  const stmt = db.prepare(`
    UPDATE food_logs SET
      meal_type = ?, quantity = ?, protein_g = ?, calories = ?
    WHERE id = ?
  `);

  stmt.run(meal_type, quantity, protein_g, calories, logId);

  return db.prepare(`
    SELECT fl.*, f.name AS food_name, f.serving_label, f.category
    FROM food_logs fl
    JOIN foods f ON fl.food_id = f.id
    WHERE fl.id = ?
  `).get(logId);
}

function deleteFood(logId, dbInstance = null) {
  const db = dbInstance || getDb();
  const result = db.prepare('DELETE FROM food_logs WHERE id = ?').run(logId);
  return result.changes > 0;
}

function getByDate(userId, dateStr, tz = 'UTC', dbInstance = null) {
  const db = dbInstance || getDb();
  const { startUtc, endUtc } = getTimezoneDayBounds(dateStr, tz);

  const stmt = db.prepare(`
    SELECT fl.*, f.name AS food_name, f.serving_label, f.category
    FROM food_logs fl
    JOIN foods f ON fl.food_id = f.id
    WHERE fl.user_id = ?
      AND fl.logged_at >= ?
      AND fl.logged_at <= ?
    ORDER BY fl.logged_at ASC
  `);

  const rows = stmt.all(userId, startUtc, endUtc);

  // Group into standard slots
  const grouped = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: []
  };

  for (const row of rows) {
    const slot = (row.meal_type === 'snacks') ? 'snack' : row.meal_type;
    if (grouped[slot]) {
      grouped[slot].push(row);
    } else {
      grouped.snack.push(row);
    }
  }

  return grouped;
}

module.exports = {
  addFood,
  updateFood,
  deleteFood,
  getByDate,
  getTimezoneDayBounds
};
