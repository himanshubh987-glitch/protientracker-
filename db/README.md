# ProteinTrack Database & Data-Access Layer

A production-grade, zero-ORM SQLite database layer powered by `better-sqlite3`. Written with portable SQL and a clean data-access module (`db/queries/*`) ready to be imported directly into any Express API service or standalone Node.js process.

---

## 1. Setup & Commands

### Prerequisites
- Node.js version 18.0.0 or higher (v20+ recommended)
- npm or pnpm

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration:
```ini
DB_PATH=proteintrack.db
NODE_ENV=development
```

### Database Management Commands
```bash
# 1. Apply all pending migrations sequentially (tracked in schema_migrations)
npm run migrate

# 2. Seed verified catalog (62 foods, 11 supplements, FAQs, testimonials, and 30-day demo athlete)
npm run seed

# 3. Clean reset (drops DB files, applies migrations, seeds freshly)
npm run reset

# 4. Run automated test suite (verifies migrations, CHECK constraints, search, streak, timezones, cascades)
npm test
```

---

## 2. Directory Structure

```
/db
  /migrations
    001_init.sql         # Base tables, strict CHECK and FK constraints
    002_indexes.sql      # High-performance composite and lookup indexes
    003_views.sql        # Analytical views: v_daily_totals, v_streaks, v_home_stats
  /seeds
    foods.json           # 62 laboratory-verified foods across 8 categories
    supplements.json     # 11 bioavailable sports supplements
    testimonials.json    # 5 athlete testimonials
    faqs.json            # 6 sports nutrition FAQs
    seed.js              # Idempotent seeder with 30-day demo athlete logs
  /queries
    index.js             # Unified module exports
    users.js             # create, getByEmail, getById, updateProfile (auto-target)
    foods.js             # search (search, filter, sort, paginate), getById, createCustom
    logs.js              # addFood (snapshot), updateFood, deleteFood, getByDate (tz-aware)
    supplements.js       # list, toggleForUser, logIntake, getTodayStatus
    dashboard.js         # getDashboard (target, consumed, streak, 7d history, 30d avg)
    newsletter.js        # subscribe (deduplication)
    home.js              # getStats, getTestimonials, getFaqs
  connection.js          # better-sqlite3 connection manager (WAL mode, foreign keys ON)
  migrate.js             # Versioned schema migration runner
/tests
  database.test.js       # Comprehensive test suite covering all constraints & queries
```

---

## 3. Entity-Relationship (ER) Table Summary

```
+---------------------------------------------------------------------------------------------------+
|                                               USERS                                               |
+---------------------------------------------------------------------------------------------------+
| id                      INTEGER PRIMARY KEY AUTOINCREMENT                                         |
| name                    TEXT NOT NULL                                                             |
| email                   TEXT NOT NULL UNIQUE (NOCASE)                                             |
| password_hash           TEXT NOT NULL                                                             |
| age                     INTEGER CHECK (age >= 13 AND age <= 120)                                  |
| sex                     TEXT CHECK (sex IN ('male', 'female', 'other'))                           |
| height_cm               REAL CHECK (height_cm > 0)                                                |
| weight_kg               REAL CHECK (weight_kg > 0)                                                |
| activity_level          TEXT CHECK (activity_level IN ('sedentary','light','moderate',...))       |
| training_type           TEXT CHECK (training_type IN ('strength','hypertrophy','endurance',...))  |
| goal                    TEXT CHECK (goal IN ('cut','maintain','bulk'))                            |
| daily_protein_target_g  REAL CHECK (daily_protein_target_g >= 0)                                  |
| meals_per_day           INTEGER DEFAULT 4 CHECK (meals_per_day >= 1 AND meals_per_day <= 10)      |
| timezone                TEXT DEFAULT 'UTC'                                                        |
| created_at, updated_at  TEXT NOT NULL (ISO 8601 UTC)                                              |
+---------------------------------------------------------------------------------------------------+
           | 1                                     | 1                                     | 1
           |                                       |                                       |
           | 0..* (CASCADE)                        | 0..* (CASCADE)                        | 0..* (CASCADE)
           v                                       v                                       v
+-----------------------+               +-----------------------+               +-----------------------+
|       FOOD_LOGS       |               |    USER_SUPPLEMENTS   |               |    SUPPLEMENT_LOGS    |
+-----------------------+               +-----------------------+               +-----------------------+
| id          INTEGER PK|               | user_id        FK (PK)|               | id          INTEGER PK|
| user_id     INTEGER FK|               | supplement_id  FK (PK)|               | user_id     INTEGER FK|
| food_id     INTEGER FK|               | is_active      INT    |               | supplement_id  FK    |
| meal_type   TEXT CHECK|               | default_servings REAL |               | servings    REAL CHECK|
| quantity    REAL > 0  |               +-----------------------+               | protein_g   REAL >= 0 |
| protein_g   SNAPSHOT  |                                  ^                    | taken_at    TIMESTAMP |
| calories    SNAPSHOT  |                                  |                    +-----------------------+
| logged_at   TIMESTAMP |                                  |                                |
+-----------------------+                                  |                                |
           |                                               |                                |
           | 0..*                                          | 0..*                           | 0..*
           v (RESTRICT)                                    |                                v
+-----------------------+               +---------------------------------------------------------------+
|         FOODS         |               |                          SUPPLEMENTS                          |
+-----------------------+               +---------------------------------------------------------------+
| id          INTEGER PK|               | id             INTEGER PRIMARY KEY AUTOINCREMENT              |
| name        TEXT      |               | name           TEXT NOT NULL                                  |
| category    TEXT CHECK|               | type           TEXT NOT NULL                                  |
| serving_label TEXT    |               | serving_label  TEXT NOT NULL                                  |
| serving_g   REAL > 0  |               | protein_g      REAL NOT NULL DEFAULT 0                        |
| calories    REAL >= 0 |               | notes          TEXT                                           |
| protein_g   REAL >= 0 |               +---------------------------------------------------------------+
| carbs_g     REAL >= 0 |
| fat_g       REAL >= 0 |
| protein_density REAL  |
| is_custom   0 or 1    |
| created_by  FK (SET NULL)
+-----------------------+

+-------------------------------------+  +-------------------------------------+  +-------------------------+
|        NEWSLETTER_SUBSCRIBERS       |  |             TESTIMONIALS            |  |           FAQS          |
+-------------------------------------+  +-------------------------------------+  +-------------------------+
| id            INTEGER PK            |  | id           INTEGER PK             |  | id          INTEGER PK  |
| email         TEXT UNIQUE (NOCASE)  |  | author_name  TEXT NOT NULL          |  | question    TEXT NOT    |
| source        TEXT ('hero','cta'..) |  | author_role  TEXT NOT NULL          |  | answer      TEXT NOT    |
| subscribed_at TIMESTAMP             |  | quote        TEXT NOT NULL          |  | sort_order  INTEGER     |
+-------------------------------------+  | rating       INT CHECK (1..5)       |  +-------------------------+
                                         | is_featured  0 or 1                 |
                                         +-------------------------------------+
```

---

## 4. Key Integrity & Architectural Rules

1. **Snapshot Macro Preservation**:
   `food_logs.protein_g` and `food_logs.calories` are computed and stored permanently at the exact moment of logging. Subsequent recipe changes or deletions to items in `foods` will never alter historical intake.
2. **Referential Integrity & Cascades**:
   - `ON DELETE CASCADE`: Deleting an athlete user removes all linked `food_logs`, `supplement_logs`, and `user_supplements`.
   - `ON DELETE SET NULL`: Deleting an athlete retains custom foods they authored, nulling `created_by`.
   - `ON DELETE RESTRICT`: Foods cannot be deleted while referenced by active `food_logs`.
3. **Timezone Day Boundaries**:
   All timestamps are stored in UTC ISO 8601. Date queries calculate UTC start and end bounds based on the user's specific IANA timezone (e.g. `America/New_York`, `Asia/Tokyo`, `UTC`) so midnight-to-midnight day groupings are clinically accurate.
4. **Streak Calculation**:
   Calculates consecutive daily compliance based on the sports science threshold: **intake $\ge 90\%$ of daily protein target**.

---

## 5. How to Switch to PostgreSQL

The database layer was specifically written in portable ANSI SQL to enable seamless migration to PostgreSQL.

### Step 1: Install PostgreSQL Client
```bash
npm install pg
```

### Step 2: Swap `db/connection.js`
Replace the `better-sqlite3` instance with a `pg.Pool`:
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/proteintrack'
});

module.exports = {
  getDb: () => pool,
  closeDb: () => pool.end()
};
```

### Step 3: Schema DDL Adjustments (SQLite vs PostgreSQL)
| SQLite Syntax | PostgreSQL Equivalent | Notes |
|---|---|---|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` or `GENERATED ALWAYS AS IDENTITY` | Auto-incrementing IDs |
| `TEXT` | `VARCHAR(255)` or `TEXT` | Native string types |
| `REAL` | `NUMERIC(6,2)` or `DOUBLE PRECISION` | Macro decimal numbers |
| `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` | `CURRENT_TIMESTAMP` or `NOW()` | Standard timestamp defaults |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` | Idempotent inserts |
| `?` placeholders | `$1, $2, ...` | Parameterized query placeholders |

---

## 6. How to Import in an Express API Service

```javascript
const { users, foods, logs, dashboard, supplements, newsletter, home } = require('./db/queries');

// Example Express Route
app.get('/api/dashboard', async (req, res) => {
  const userId = req.user.id;
  const dateStr = req.query.date || new Date().toISOString().split('T')[0];
  const tz = req.user.timezone || 'UTC';

  const data = dashboard.getDashboard(userId, dateStr, tz);
  res.json(data);
});
```
