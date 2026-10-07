-- 002_indexes.sql: High-performance composite and lookup indexes

-- Log temporal querying and streak calculation indexes
CREATE INDEX IF NOT EXISTS idx_food_logs_user_logged ON food_logs (user_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_taken ON supplement_logs (user_id, taken_at);

-- Catalog fast search and category filtering indexes
CREATE INDEX IF NOT EXISTS idx_foods_name ON foods (name);
CREATE INDEX IF NOT EXISTS idx_foods_category ON foods (category);
CREATE INDEX IF NOT EXISTS idx_foods_protein_g ON foods (protein_g);

-- Fast credential lookups and unique constraint enforcement
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers (email);
