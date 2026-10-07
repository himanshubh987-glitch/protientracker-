-- ==============================================================================
-- ProteinTrack Core Database Schema
-- Compatible with SQLite & PostgreSQL ANSI SQL standards
-- ==============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  age INTEGER,
  sex TEXT CHECK(sex IN ('male', 'female', 'other')),
  height_cm REAL,
  weight_kg REAL,
  activity_level TEXT CHECK(activity_level IN ('sedentary', 'light', 'moderate', 'heavy', 'very_heavy')),
  training_type TEXT CHECK(training_type IN ('hypertrophy', 'strength', 'endurance', 'general_fitness', 'none')),
  goal TEXT CHECK(goal IN ('cut', 'maintain', 'bulk')),
  daily_protein_target_g REAL,
  meals_per_day INTEGER DEFAULT 4,
  timezone TEXT DEFAULT 'UTC',
  created_at TEXT DEFAULT (datetime('now'))
);

-- 2. Foods Table
CREATE TABLE IF NOT EXISTS foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  serving_label TEXT NOT NULL,
  serving_g REAL NOT NULL,
  calories REAL NOT NULL,
  protein_g REAL NOT NULL,
  carbs_g REAL NOT NULL DEFAULT 0,
  fat_g REAL NOT NULL DEFAULT 0,
  is_custom INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Food Logs Table (historical snapshot values preserved at logging time)
CREATE TABLE IF NOT EXISTS food_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
  meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  quantity REAL NOT NULL DEFAULT 1.0,
  protein_g REAL NOT NULL,
  calories REAL NOT NULL,
  logged_at TEXT NOT NULL
);

-- 4. Supplements Table
CREATE TABLE IF NOT EXISTS supplements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  serving_label TEXT NOT NULL,
  protein_g REAL NOT NULL DEFAULT 0,
  notes TEXT
);

-- 5. User Supplements Preference Table
CREATE TABLE IF NOT EXISTS user_supplements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplement_id INTEGER NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  is_active INTEGER NOT NULL DEFAULT 1,
  default_servings REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY (user_id, supplement_id)
);

-- 6. Supplement Logs Table
CREATE TABLE IF NOT EXISTS supplement_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplement_id INTEGER NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  servings REAL NOT NULL DEFAULT 1.0,
  protein_g REAL NOT NULL DEFAULT 0,
  taken_at TEXT NOT NULL
);

-- 7. Newsletter Subscribers Table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  subscribed_at TEXT DEFAULT (datetime('now')),
  source TEXT CHECK(source IN ('hero', 'footer', 'cta', 'other')) DEFAULT 'footer'
);

-- 8. Testimonials Table (editable via database without code redeploy)
CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar_url TEXT,
  quote TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  display_order INTEGER DEFAULT 0
);

-- 9. FAQs Table (editable via database without code redeploy)
CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  display_order INTEGER DEFAULT 0
);

-- Indexes for high-throughput queries and temporal range scans
CREATE INDEX IF NOT EXISTS idx_food_logs_user_logged ON food_logs(user_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_taken ON supplement_logs(user_id, taken_at);
CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);
CREATE INDEX IF NOT EXISTS idx_foods_category ON foods(category);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
