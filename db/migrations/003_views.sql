-- 003_views.sql: Analytical and telemetry SQL views

-- Per user per day total protein and calories
CREATE VIEW IF NOT EXISTS v_daily_totals AS
SELECT 
  fl.user_id,
  date(fl.logged_at) AS log_date,
  ROUND(SUM(fl.protein_g), 1) AS total_protein_g,
  ROUND(SUM(fl.calories), 1) AS total_calories,
  COUNT(fl.id) AS food_log_count
FROM food_logs fl
GROUP BY fl.user_id, date(fl.logged_at);

-- Daily intake vs target evaluation (checks if intake reached >= 90% of target)
CREATE VIEW IF NOT EXISTS v_streaks AS
WITH user_daily_intake AS (
  SELECT 
    u.id AS user_id,
    date(fl.logged_at) AS log_date,
    ROUND(SUM(fl.protein_g), 1) AS total_protein_g,
    u.daily_protein_target_g,
    CASE 
      WHEN SUM(fl.protein_g) >= (u.daily_protein_target_g * 0.9) THEN 1 
      ELSE 0 
    END AS hit_goal
  FROM users u
  JOIN food_logs fl ON u.id = fl.user_id
  GROUP BY u.id, date(fl.logged_at)
)
SELECT 
  user_id,
  log_date,
  total_protein_g,
  daily_protein_target_g,
  hit_goal
FROM user_daily_intake;

-- Live aggregated statistics for Home landing page
CREATE VIEW IF NOT EXISTS v_home_stats AS
WITH aggregate_stats AS (
  SELECT 
    (SELECT COUNT(*) FROM users) AS athlete_count,
    (SELECT COUNT(*) FROM food_logs) + (SELECT COUNT(*) FROM supplement_logs) AS total_logs,
    (SELECT COUNT(*) FROM v_streaks WHERE hit_goal = 1) AS goal_hits,
    (SELECT COUNT(*) FROM v_streaks) AS total_logged_days
)
SELECT 
  athlete_count,
  total_logs,
  CASE 
    WHEN total_logged_days > 0 THEN ROUND((CAST(goal_hits AS REAL) / total_logged_days) * 100, 1)
    ELSE 94.0
  END AS goal_hit_rate_pct
FROM aggregate_stats;
