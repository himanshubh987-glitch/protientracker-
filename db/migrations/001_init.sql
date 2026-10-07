-- 001_init.sql: Core schema with strict constraints and referential integrity

-- Track schema migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Users: Core athlete profiles and target configurations
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  age INTEGER CHECK (age IS NULL OR (age >= 13 AND age <= 120)),
  sex TEXT NOT NULL CHECK (sex IN ('male', 'female', 'other')),
  height_cm REAL CHECK (height_cm IS NULL OR height_cm > 0),
  weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg > 0),
  activity_level TEXT NOT NULL CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'very_active', 'heavy')),
  training_type TEXT NOT NULL CHECK (training_type IN ('strength', 'hypertrophy', 'endurance', 'hybrid')),
  goal TEXT NOT NULL CHECK (goal IN ('cut', 'maintain', 'bulk')),
  daily_protein_target_g REAL NOT NULL CHECK (daily_protein_target_g >= 0),
  meals_per_day INTEGER NOT NULL DEFAULT 4 CHECK (meals_per_day >= 1 AND meals_per_day <= 10),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Foods: Laboratory nutritional catalog & custom athlete items
CREATE TABLE IF NOT EXISTS foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('meat', 'fish', 'dairy', 'eggs', 'legumes', 'grains', 'nuts', 'supplements', 'plant_protein', 'other')),
  serving_label TEXT NOT NULL,
  serving_g REAL NOT NULL CHECK (serving_g > 0),
  calories REAL NOT NULL CHECK (calories >= 0),
  protein_g REAL NOT NULL CHECK (protein_g >= 0),
  carbs_g REAL NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  fat_g REAL NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  protein_density REAL NOT NULL DEFAULT 0 CHECK (protein_density >= 0),
  is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0, 1)),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Food Logs: Snapshot historical logs (permanent macro preservation)
CREATE TABLE IF NOT EXISTS food_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'snacks')),
  quantity REAL NOT NULL CHECK (quantity > 0),
  protein_g REAL NOT NULL CHECK (protein_g >= 0),
  calories REAL NOT NULL CHECK (calories >= 0),
  logged_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Supplements: Catalog of bio-available sports supplements
CREATE TABLE IF NOT EXISTS supplements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  serving_label TEXT NOT NULL,
  protein_g REAL NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  notes TEXT
);

-- User Supplements: User active toggles and default dosages
CREATE TABLE IF NOT EXISTS user_supplements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplement_id INTEGER NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  default_servings REAL NOT NULL DEFAULT 1.0 CHECK (default_servings > 0),
  PRIMARY KEY (user_id, supplement_id)
);

-- Supplement Logs: Timestamped supplement servings taken
CREATE TABLE IF NOT EXISTS supplement_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplement_id INTEGER NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  servings REAL NOT NULL CHECK (servings > 0),
  protein_g REAL NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  taken_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Newsletter Subscribers: Telemetry Dispatch subscriptions with deduplication
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  source TEXT NOT NULL CHECK (source IN ('hero', 'footer', 'cta', 'web', 'other')),
  subscribed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Testimonials: Clinical community proof for Home landing page
CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  quote TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  is_featured INTEGER NOT NULL DEFAULT 1 CHECK (is_featured IN (0, 1))
);

-- FAQs: Evidence-based nutritional guidance accordion
CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
