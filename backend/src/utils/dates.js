/**
 * Timezone and Date Helper Utilities
 * Provides accurate day-boundary calculations and streak determination
 * using standard native Intl API (zero external dependency required).
 */

/**
 * Returns the current date formatted as 'YYYY-MM-DD' in the given IANA timezone.
 * @param {string} [timezone='UTC']
 * @returns {string}
 */
function getLocalDateString(timezone = 'UTC', date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  } catch (e) {
    // Fallback to UTC if timezone is invalid
    return date.toISOString().split('T')[0];
  }
}

/**
 * Computes ISO start and end UTC boundary strings for a specific local calendar date and timezone.
 * @param {string} dateString 'YYYY-MM-DD'
 * @param {string} [timezone='UTC']
 * @returns {{ startIso: string, endIso: string }}
 */
function getDayBoundaries(dateString, timezone = 'UTC') {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    dateString = getLocalDateString(timezone);
  }

  // To support any IANA timezone accurately without luxon/moment:
  // We determine the UTC timestamp corresponding to local 00:00:00 and 23:59:59.999
  try {
    // Construct local midnight string
    const targetDate = new Date(`${dateString}T12:00:00Z`);
    
    // Get difference between UTC and local timezone at that point
    const localParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23'
    }).formatToParts(targetDate);

    const partMap = {};
    for (const p of localParts) partMap[p.type] = p.value;

    const localYear = parseInt(partMap.year, 10);
    const localMonth = parseInt(partMap.month, 10) - 1;
    const localDay = parseInt(partMap.day, 10);
    const localHour = parseInt(partMap.hour, 10);
    const localMin = parseInt(partMap.minute, 10);

    const localAsUtc = Date.UTC(localYear, localMonth, localDay, localHour, localMin, 0);
    const offsetMs = localAsUtc - targetDate.getTime();

    // Local 00:00:00 in UTC
    const [y, m, d] = dateString.split('-').map(Number);
    const midnightUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offsetMs;
    const endOfDayUtcMs = midnightUtcMs + (24 * 60 * 60 * 1000) - 1;

    return {
      startIso: new Date(midnightUtcMs).toISOString(),
      endIso: new Date(endOfDayUtcMs).toISOString()
    };
  } catch (err) {
    // Fallback standard day in UTC
    return {
      startIso: `${dateString}T00:00:00.000Z`,
      endIso: `${dateString}T23:59:59.999Z`
    };
  }
}

/**
 * Returns an array of 'YYYY-MM-DD' strings for the last N calendar days in the given timezone.
 * @param {number} days
 * @param {string} [timezone='UTC']
 * @param {string} [endDateStr]
 * @returns {Array<string>}
 */
function getLastNDays(days = 7, timezone = 'UTC', endDateStr = null) {
  const currentStr = endDateStr || getLocalDateString(timezone);
  const [y, m, d] = currentStr.split('-').map(Number);
  const baseDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const list = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayDate = new Date(baseDate.getTime() - (i * 24 * 60 * 60 * 1000));
    list.push(dayDate.toISOString().split('T')[0]);
  }
  return list;
}

/**
 * Calculates current active streak of days where intake reached at least 90% of daily target.
 * Streak checks backwards from today (or yesterday if today is still in progress and not yet 90%).
 * 
 * @param {Array<{ date: string, total_protein: number }>} dailyTotals Map of YYYY-MM-DD -> protein_g
 * @param {number} dailyTarget
 * @param {string} [todayStr]
 * @returns {number}
 */
function calculateStreak(dailyTotals, dailyTarget, todayStr) {
  if (!dailyTarget || dailyTarget <= 0) return 0;
  const threshold = 0.90 * dailyTarget;

  const totalMap = {};
  for (const item of dailyTotals) {
    totalMap[item.date] = Number(item.total_protein) || 0;
  }

  const [y, m, d] = todayStr.split('-').map(Number);
  let streak = 0;

  // Check today first: if today hit target, it counts!
  const todayVal = totalMap[todayStr] || 0;
  let checkDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  if (todayVal >= threshold) {
    streak++;
    checkDate = new Date(checkDate.getTime() - (24 * 60 * 60 * 1000));
  } else {
    // If today hasn't hit target yet, check if yesterday was part of an active streak
    checkDate = new Date(checkDate.getTime() - (24 * 60 * 60 * 1000));
  }

  // Iterate backwards up to 365 days
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const val = totalMap[dateStr] || 0;

    if (val >= threshold) {
      streak++;
      checkDate = new Date(checkDate.getTime() - (24 * 60 * 60 * 1000));
    } else {
      break;
    }
  }

  return streak;
}

module.exports = {
  getLocalDateString,
  getDayBoundaries,
  getLastNDays,
  calculateStreak
};
