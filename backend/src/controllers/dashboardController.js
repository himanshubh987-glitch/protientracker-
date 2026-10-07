const db = require('../db/database');
const { getDayBoundaries, getLocalDateString, getLastNDays, calculateStreak } = require('../utils/dates');

/**
 * Get comprehensive cockpit dashboard telemetry.
 * Computes:
 * - Current day progress (consumed, target, percent, remaining)
 * - Chronological meal timeline grouped by slot (breakfast, lunch, dinner, snack)
 * - Active supplements stack with completion state
 * - 7-day vector chart history
 * - Active streak (consecutive >=90% goal days)
 * - 30-day trailing intake average
 */
async function getDashboard(req, res, next) {
  try {
    const user = req.user;
    const userTz = user.timezone || 'UTC';
    const todayLocalStr = getLocalDateString(userTz);
    const targetDate = req.query.date || todayLocalStr;

    const { startIso, endIso } = getDayBoundaries(targetDate, userTz);

    // 1. Food logs for target date
    const foodLogs = await db.query(`
      SELECT fl.id, fl.food_id, fl.meal_type, fl.quantity, fl.protein_g, fl.calories, fl.logged_at,
             f.name as food_name, f.serving_label
      FROM food_logs fl
      LEFT JOIN foods f ON fl.food_id = f.id
      WHERE fl.user_id = ? AND fl.logged_at >= ? AND fl.logged_at <= ?
      ORDER BY fl.logged_at ASC
    `, [user.id, startIso, endIso]);

    // 2. Supplement logs for target date
    const suppLogs = await db.query(`
      SELECT sl.id, sl.supplement_id, sl.servings, sl.protein_g, sl.taken_at,
             s.name as supplement_name, s.serving_label
      FROM supplement_logs sl
      JOIN supplements s ON sl.supplement_id = s.id
      WHERE sl.user_id = ? AND sl.taken_at >= ? AND sl.taken_at <= ?
    `, [user.id, startIso, endIso]);

    // Calculate totals for target date
    let foodProtein = 0;
    let foodCalories = 0;
    const mealTimeline = {
      breakfast: { title: 'Breakfast', subtitle: '07:30 AM · Morning Anabolic Pulse', total_g: 0, items: [] },
      lunch: { title: 'Lunch', subtitle: '12:30 PM · Peak Bioavailability', total_g: 0, items: [] },
      dinner: { title: 'Dinner', subtitle: '07:30 PM · Slow-Release Digestion', total_g: 0, items: [] },
      snack: { title: 'Snacks & Supplements', subtitle: 'Mid-Day · Anabolic Bridge', total_g: 0, items: [] }
    };

    for (const log of foodLogs) {
      const p = Number(log.protein_g) || 0;
      foodProtein += p;
      foodCalories += Number(log.calories) || 0;

      const slot = mealTimeline[log.meal_type] || mealTimeline.snack;
      slot.total_g += p;
      slot.items.push({
        id: log.id,
        food_id: log.food_id,
        name: log.food_name || 'Logged Item',
        serving_label: log.serving_label,
        quantity: log.quantity,
        protein_g: p,
        calories: Math.round(log.calories || 0),
        logged_at: log.logged_at
      });
    }

    // Add supplement protein
    let suppProtein = 0;
    for (const sLog of suppLogs) {
      const sp = Number(sLog.protein_g) || 0;
      suppProtein += sp;
      if (sp > 0) {
        mealTimeline.snack.total_g += sp;
        mealTimeline.snack.items.push({
          id: `supp-${sLog.id}`,
          supplement_id: sLog.supplement_id,
          name: `${sLog.supplement_name} (${sLog.servings}x)`,
          serving_label: sLog.serving_label,
          quantity: sLog.servings,
          protein_g: sp,
          calories: 0,
          logged_at: sLog.taken_at
        });
      }
    }

    // Round slot totals
    for (const key of Object.keys(mealTimeline)) {
      mealTimeline[key].total_g = Math.round(mealTimeline[key].total_g * 10) / 10;
    }

    const consumed = Math.round((foodProtein + suppProtein) * 10) / 10;
    const target = user.daily_protein_target_g || 165;
    const remaining = Math.max(0, Math.round((target - consumed) * 10) / 10);
    const percent = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;

    // 3. User Supplements status for today
    const activeSupplements = await db.query(`
      SELECT s.id, s.name, s.type, s.serving_label, s.protein_g, s.notes,
             COALESCE(us.is_active, 1) as is_active,
             CASE WHEN sl.id IS NOT NULL THEN 1 ELSE 0 END as taken_today
      FROM supplements s
      LEFT JOIN user_supplements us ON s.id = us.supplement_id AND us.user_id = ?
      LEFT JOIN supplement_logs sl ON s.id = sl.supplement_id AND sl.user_id = ? AND sl.taken_at >= ? AND sl.taken_at <= ?
      WHERE COALESCE(us.is_active, 1) = 1
      GROUP BY s.id
      ORDER BY s.id ASC
    `, [user.id, user.id, startIso, endIso]);

    // 4. Last 7 Days Analytics & 30-Day Streak
    const last7Dates = getLastNDays(7, userTz, targetDate);
    const last30Dates = getLastNDays(30, userTz, todayLocalStr);

    const { startIso: start30Iso } = getDayBoundaries(last30Dates[0], userTz);
    const { endIso: end30Iso } = getDayBoundaries(todayLocalStr, userTz);

    // Fetch all logs across the 30-day window
    const logsHistory = await db.query(`
      SELECT fl.logged_at as date_col, fl.protein_g
      FROM food_logs fl
      WHERE fl.user_id = ? AND fl.logged_at >= ? AND fl.logged_at <= ?
      UNION ALL
      SELECT sl.taken_at as date_col, sl.protein_g
      FROM supplement_logs sl
      WHERE sl.user_id = ? AND sl.taken_at >= ? AND sl.taken_at <= ?
    `, [user.id, start30Iso, end30Iso, user.id, start30Iso, end30Iso]);

    // Aggregate protein per calendar day in user timezone
    const dayTotalsMap = {};
    for (const row of logsHistory) {
      const dayStr = getLocalDateString(userTz, new Date(row.date_col));
      dayTotalsMap[dayStr] = (dayTotalsMap[dayStr] || 0) + (Number(row.protein_g) || 0);
    }

    // Build 7-day array
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7DaysTotals = last7Dates.map(dStr => {
      const [y, m, d] = dStr.split('-').map(Number);
      const dayDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const dayLabel = dayNames[dayDate.getUTCDay()];
      const totalG = Math.round((dayTotalsMap[dStr] || 0) * 10) / 10;

      let status = 'upcoming';
      if (dStr === todayLocalStr) {
        status = 'today';
      } else if (dStr < todayLocalStr) {
        status = totalG >= (0.90 * target) ? 'complete' : 'missed';
      }

      return {
        date: dStr,
        day: dayLabel,
        grams: totalG,
        status,
        percent: target > 0 ? Math.min(100, Math.round((totalG / target) * 100)) : 0
      };
    });

    // 5. Calculate active consecutive streak
    const historyForStreak = Object.keys(dayTotalsMap).map(k => ({
      date: k,
      total_protein: dayTotalsMap[k]
    }));
    const streak = calculateStreak(historyForStreak, target, todayLocalStr);

    // 6. Calculate 30-Day Average
    let daysWithLogsCount = 0;
    let sum30Protein = 0;
    for (const dStr of last30Dates) {
      if (dayTotalsMap[dStr] && dayTotalsMap[dStr] > 0) {
        daysWithLogsCount++;
        sum30Protein += dayTotalsMap[dStr];
      }
    }
    const average30Day = daysWithLogsCount > 0
      ? Math.round((sum30Protein / daysWithLogsCount) * 10) / 10
      : (consumed > 0 ? consumed : 0);

    res.json({
      date: targetDate,
      user_name: user.name,
      target,
      consumed,
      percent,
      remaining,
      calories_consumed: Math.round(foodCalories),
      meals: mealTimeline,
      supplements: activeSupplements.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        dose: s.serving_label,
        notes: s.notes,
        protein_g: s.protein_g,
        is_active: Boolean(s.is_active),
        taken_today: Boolean(s.taken_today)
      })),
      last_7_days: last7DaysTotals,
      streak,
      average_30_day: average30Day
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboard
};
