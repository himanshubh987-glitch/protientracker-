/**
 * queries/dashboard.js: High-performance aggregated analytics for the Athlete Cockpit
 * Computes consumed vs target, 7-day vector chart, 30-day average, and consecutive streaks
 */

const { getDb } = require('../connection');
const { getByDate, getTimezoneDayBounds } = require('./logs');
const { getTodayStatus } = require('./supplements');
const { getById } = require('./users');

/**
 * Computes consecutive days reaching >= 90% of daily target
 */
function calculateStreak(userId, targetGrams, referenceDateStr, tz = 'UTC', dbInstance = null) {
  const db = dbInstance || getDb();
  const threshold = targetGrams * 0.9;

  let streak = 0;
  const [y, m, d] = referenceDateStr.split('-').map(Number);
  const baseDate = new Date(Date.UTC(y, m - 1, d));

  // Check today first
  const todayBounds = getTimezoneDayBounds(referenceDateStr, tz);
  const todayIntake = db.prepare(`
    SELECT COALESCE(SUM(protein_g), 0) AS total
    FROM food_logs
    WHERE user_id = ? AND logged_at >= ? AND logged_at <= ?
  `).get(userId, todayBounds.startUtc, todayBounds.endUtc).total;

  let startOffset = 1;
  if (todayIntake >= threshold) {
    streak = 1;
  }

  // Scan backwards up to 365 days
  for (let offset = startOffset; offset < 365; offset++) {
    const prevDate = new Date(baseDate);
    prevDate.setUTCDate(prevDate.getUTCDate() - offset);
    const prevYmd = prevDate.toISOString().split('T')[0];

    const bounds = getTimezoneDayBounds(prevYmd, tz);
    const dayIntake = db.prepare(`
      SELECT COALESCE(SUM(protein_g), 0) AS total
      FROM food_logs
      WHERE user_id = ? AND logged_at >= ? AND logged_at <= ?
    `).get(userId, bounds.startUtc, bounds.endUtc).total;

    if (dayIntake >= threshold) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function getDashboard(userId, dateStr = null, timeZone = null, dbInstance = null) {
  const db = dbInstance || getDb();

  const user = getById(userId, db);
  if (!user) {
    throw new Error(`User with id ${userId} not found`);
  }

  const tz = timeZone || user.timezone || 'UTC';
  const queryDate = dateStr || new Date().toISOString().split('T')[0];
  const { startUtc, endUtc } = getTimezoneDayBounds(queryDate, tz);

  // 1. Today's Macros
  const todayFoods = db.prepare(`
    SELECT 
      COALESCE(SUM(protein_g), 0) AS protein_g,
      COALESCE(SUM(calories), 0) AS calories
    FROM food_logs
    WHERE user_id = ? AND logged_at >= ? AND logged_at <= ?
  `).get(userId, startUtc, endUtc);

  const consumed = Number(todayFoods.protein_g.toFixed(1));
  const calories = Number(todayFoods.calories.toFixed(1));
  const target = user.daily_protein_target_g;
  const percent = target > 0 ? Number(((consumed / target) * 100).toFixed(1)) : 0;
  const remaining = Math.max(0, Number((target - consumed).toFixed(1)));

  // 2. Meal Timeline
  const meals_timeline = getByDate(userId, queryDate, tz, db);

  // 3. Supplements
  const supplements = getTodayStatus(userId, queryDate, tz, db);

  // 4. Last 7 Days Telemetry
  const last_7_days = [];
  const [y, m, d] = queryDate.split('-').map(Number);
  const anchorDate = new Date(Date.UTC(y, m - 1, d));

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const cur = new Date(anchorDate);
    cur.setUTCDate(cur.getUTCDate() - i);
    const dayStr = cur.toISOString().split('T')[0];
    const bounds = getTimezoneDayBounds(dayStr, tz);

    const dayTotal = db.prepare(`
      SELECT COALESCE(SUM(protein_g), 0) AS total
      FROM food_logs
      WHERE user_id = ? AND logged_at >= ? AND logged_at <= ?
    `).get(userId, bounds.startUtc, bounds.endUtc).total;

    last_7_days.push({
      date: dayStr,
      day_label: dayLabels[cur.getUTCDay()],
      total_protein_g: Number(dayTotal.toFixed(1)),
      hit_goal: dayTotal >= (target * 0.9)
    });
  }

  // 5. 30-Day Average
  const thirtyDaysAgo = new Date(anchorDate);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);
  const thirtyDaysAgoBounds = getTimezoneDayBounds(thirtyDaysAgo.toISOString().split('T')[0], tz);

  const thirtyDayStats = db.prepare(`
    SELECT 
      COALESCE(SUM(protein_g), 0) AS total_protein,
      COUNT(DISTINCT substr(logged_at, 1, 10)) AS days_with_logs
    FROM food_logs
    WHERE user_id = ? AND logged_at >= ? AND logged_at <= ?
  `).get(userId, thirtyDaysAgoBounds.startUtc, endUtc);

  const average_30d = Number((thirtyDayStats.total_protein / 30).toFixed(1));

  // 6. Continuous Streak
  const streak = calculateStreak(userId, target, queryDate, tz, db);

  return {
    user: {
      id: user.id,
      name: user.name,
      daily_protein_target_g: target,
      meals_per_day: user.meals_per_day
    },
    date: queryDate,
    target,
    consumed,
    percent,
    remaining,
    calories,
    meals_timeline,
    supplements,
    last_7_days,
    average_30d,
    streak
  };
}

module.exports = {
  getDashboard,
  calculateStreak
};
