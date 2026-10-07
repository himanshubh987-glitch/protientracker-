# ProteinTrack Backend

Production-ready backend API service for **ProteinTrack**, an evidence-based bio-nutritional protein tracking web platform.

---

## 1. Architecture & Tech Stack

- **Runtime & Framework**: Node.js, Express 4
- **Database**: SQLite via `better-sqlite3` with WAL mode enabled. Architected with an asynchronous data-access layer (`src/db/database.js`) that is **100% drop-in swappable to PostgreSQL** (`pg.Pool`) without refactoring any controllers.
- **Authentication**: Stateless JSON Web Tokens (JWT) stored in secure, `httpOnly`, `SameSite=Lax` cookies, with password hashing via `bcryptjs` (salt rounds: 12).
- **Validation**: Schema-driven request body and query parameter validation using `zod`.
- **Security & Hardening**: `helmet` security headers, CORS origin verification with credential sharing, and IP-based rate limiting on sensitive routes (`express-rate-limit`).
- **Standardized Error Format**: Every single failure response strictly returns:
  ```json
  {
    "error": {
      "code": "ERROR_CODE_STRING",
      "message": "Human-readable explanation"
    }
  }
  ```

---

## 2. Directory Structure

```
backend/
├── .env                  # Environment configuration
├── .env.example          # Sample environment configuration
├── package.json          # Node dependencies and npm scripts
├── README.md             # Complete documentation and API curl reference
└── src/
    ├── app.js            # Express application configuration & middleware stack
    ├── server.js         # HTTP server entry point with startup migrations
    ├── config/
    │   └── env.js        # Environment loader and fallback defaults
    ├── controllers/
    │   ├── authController.js        # Register, login, logout, me
    │   ├── calculatorController.js  # Evidence-based protein calculator
    │   ├── dashboardController.js   # Aggregated dashboard metrics & timeline
    │   ├── foodsController.js       # Search, filter, pagination, custom food
    │   ├── homeController.js        # Real-time stats, testimonials, FAQs
    │   ├── logsController.js        # Food intake snapshot logging & history
    │   ├── newsletterController.js  # Deduplicated email dispatch subscription
    │   ├── profileController.js     # User body stats & automatic target recalibration
    │   └── supplementsController.js # Catalog, user toggles, intake logging
    ├── db/
    │   ├── database.js   # Universal DB abstraction adapter (SQLite / PostgreSQL)
    │   ├── migrate.js    # DDL schema runner
    │   ├── schema.sql    # Relational database schema with indexes
    │   └── seed.js       # Laboratory-verified seed dataset (62 foods, 11 supplements, etc.)
    ├── middleware/
    │   ├── auth.js          # authenticate & optionalAuth JWT verifiers
    │   ├── errorHandler.js  # Uniform error response formatter & 404 handler
    │   ├── rateLimiter.js   # Brute-force & spam rate limiters
    │   └── validate.js      # Zod schema validation middleware
    ├── routes/
    │   ├── authRoutes.js
    │   ├── calculatorRoutes.js
    │   ├── dashboardRoutes.js
    │   ├── foodsRoutes.js
    │   ├── homeRoutes.js
    │   ├── logsRoutes.js
    │   ├── newsletterRoutes.js
    │   ├── profileRoutes.js
    │   └── supplementsRoutes.js
    └── utils/
        ├── calculator.js # Exercise science formulas & leucine thresholds
        ├── dates.js      # Timezone-aware date boundaries & streak algorithms
        ├── errors.js     # Custom AppError hierarchy with HTTP status codes
        └── token.js      # JWT signing & cookie management
```

---

## 3. Evidence-Based Nutritional Rules & Formulas

### Daily Target Calculation (`src/utils/calculator.js`)
1. **Base Requirement**: Baseline set to **1.6 g/kg** of body weight (Morton et al., *Br J Sports Med*, 2018).
2. **Goal Adjustments**:
   - `cut` (caloric deficit, lean mass sparing): `+0.4 g/kg` (Helms et al., 2014)
   - `maintain`: `+0.0 g/kg`
   - `bulk` (hypertrophy surplus): `+0.2 g/kg`
3. **Training Type Adjustments**:
   - `strength` / `hypertrophy`: `+0.2 g/kg`
   - `endurance`: `+0.0 g/kg` (aerobic mitochondrial adaptations)
   - `hybrid`: `+0.1 g/kg`
4. **Activity Multipliers**:
   - `sedentary`: `0.95x`
   - `light`: `1.00x`
   - `moderate`: `1.05x`
   - `very_active`: `1.10x`
5. **Safety Clamping**: Enforced physiological limits between **1.2 g/kg** and **3.3 g/kg** (Antonio et al., 2016).

### Per-Meal Distribution & Leucine Threshold
- **Even Distribution**: Daily target is partitioned evenly across `meals_per_day` (default: 4 feedings/day).
- **Leucine Threshold**: Each feeding window targets **~2.5 g – 3.0 g of L-leucine** (the trigger for mTORC1 phosphorylation and muscle protein synthesis).
- **Intake Spacing**: Recommended every 3 to 4.5 hours throughout the wake cycle.

### Timezone & Streak Logic (`src/utils/dates.js`)
- Daily boundaries are computed using the user's specific IANA timezone (e.g. `America/New_York`, `Asia/Kolkata`, `UTC`) using native `Intl.DateTimeFormat`.
- A calendar day counts as completed toward the streak if **total protein consumed $\ge 90\%$ of the daily target**.
- Historical streak scans backward consecutively from yesterday/today.

### Historical Snapshot Integrity
- When a food entry is logged (`food_logs`), `protein_g` and `calories` are calculated from the current food data and **permanently stored on the log record**. Subsequent edits or deletions of the food item will never mutate historical intake logs.

---

## 4. Swapping SQLite for PostgreSQL

The database layer in `src/db/database.js` abstracts all queries behind four asynchronous methods:
- `db.query(sql, params)`
- `db.queryOne(sql, params)`
- `db.execute(sql, params)`
- `db.transaction(fn)`

To switch to PostgreSQL:
1. Install `pg`:
   ```bash
   npm install pg
   ```
2. Replace `src/db/database.js` with:
   ```javascript
   const { Pool } = require('pg');
   const env = require('../config/env');

   const pool = new Pool({
     connectionString: env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/proteintrack',
   });

   // Convert SQLite ? parameter placeholders to PostgreSQL $1, $2, ...
   function convertPlaceholders(sql) {
     let i = 1;
     return sql.replace(/\?/g, () => `$${i++}`);
   }

   module.exports = {
     async query(sql, params = []) {
       const res = await pool.query(convertPlaceholders(sql), params);
       return res.rows;
     },
     async queryOne(sql, params = []) {
       const res = await pool.query(convertPlaceholders(sql), params);
       return res.rows[0] || null;
     },
     async execute(sql, params = []) {
       const res = await pool.query(convertPlaceholders(sql), params);
       return { changes: res.rowCount, lastInsertRowid: res.rows[0]?.id };
     },
     async transaction(fn) {
       const client = await pool.connect();
       try {
         await client.query('BEGIN');
         const result = await fn(client);
         await client.query('COMMIT');
         return result;
       } catch (err) {
         await client.query('ROLLBACK');
         throw err;
       } finally {
         client.release();
       }
     }
   };
   ```
3. Update `src/db/schema.sql` to use PostgreSQL syntax (`SERIAL PRIMARY KEY`, `TIMESTAMPTZ`, etc.). **Zero controller or route changes are needed.**

---

## 5. Quick Start

### Prerequisites
- Node.js version 18.0.0 or higher
- npm or pnpm

### Installation
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Initialize database schema and laboratory seed data
npm run setup

# Start development server with auto-reload
npm run dev

# Or start production server
npm start
```
The server will boot on `http://localhost:4000` (or `PORT` defined in `.env`).

---

## 6. Comprehensive API Reference & cURL Examples

All examples assume the server is running on `http://localhost:4000`.
Cookies are saved to and read from `cookies.txt` using cURL's `-c` and `-b` flags.

---

### 1. Authentication Endpoints

#### Register a New User
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "name": "Sarah Connor",
    "email": "sarah@resistance.org",
    "password": "StrongPassword123!",
    "age": 29,
    "sex": "female",
    "height_cm": 168,
    "weight_kg": 62.5,
    "activity_level": "very_active",
    "training_type": "strength",
    "goal": "cut",
    "meals_per_day": 4,
    "timezone": "America/Los_Angeles"
  }'
```
*Response (201 Created) — sets `token` in `httpOnly` cookie:*
```json
{
  "user": {
    "id": 2,
    "name": "Sarah Connor",
    "email": "sarah@resistance.org",
    "age": 29,
    "sex": "female",
    "height_cm": 168,
    "weight_kg": 62.5,
    "activity_level": "very_active",
    "training_type": "strength",
    "goal": "cut",
    "daily_protein_target_g": 151,
    "meals_per_day": 4,
    "timezone": "America/Los_Angeles"
  }
}
```

#### Login (Pre-seeded Demo User)
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "alex@athlete.com",
    "password": "password123"
  }'
```

#### Get Current Authenticated User (`/me`)
```bash
curl -X GET http://localhost:4000/api/auth/me \
  -b cookies.txt
```

#### Logout
```bash
curl -X POST http://localhost:4000/api/auth/logout \
  -b cookies.txt \
  -c cookies.txt
```

---

### 2. Profile Endpoints

#### Get Profile
```bash
curl -X GET http://localhost:4000/api/profile \
  -b cookies.txt
```

#### Update Profile (Recalibrates Protein Target)
```bash
curl -X PUT http://localhost:4000/api/profile \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "weight_kg": 76.5,
    "goal": "cut",
    "training_type": "hypertrophy",
    "meals_per_day": 4
  }'
```
*Response (200 OK):*
```json
{
  "message": "Profile updated and target recalculated successfully",
  "user": {
    "id": 1,
    "name": "Alex Vance",
    "email": "alex@athlete.com",
    "weight_kg": 76.5,
    "goal": "cut",
    "training_type": "hypertrophy",
    "daily_protein_target_g": 177,
    "meals_per_day": 4
  }
}
```

---

### 3. Calculator Endpoint

#### Public Target Calculation (Unauthenticated)
```bash
curl -X POST http://localhost:4000/api/calculator \
  -H "Content-Type: application/json" \
  -d '{
    "age": 28,
    "sex": "male",
    "weight_kg": 80,
    "height_cm": 182,
    "activity_level": "moderate",
    "training_type": "hypertrophy",
    "goal": "bulk",
    "meals_per_day": 4
  }'
```
*Response (200 OK):*
```json
{
  "target": {
    "daily_protein_target_g": 151,
    "g_per_kg": 1.89,
    "meals_per_day": 4,
    "per_meal_protein_g": 38,
    "leucine_threshold_g": 2.5,
    "timing_guidance": "Distribute protein evenly every 3 to 4 hours...",
    "notes": "Hypertrophy bulk phase: target calibrated to maximize muscle protein synthesis."
  }
}
```

#### Calculate and Save Directly as User Target (Authenticated)
```bash
curl -X POST http://localhost:4000/api/calculator \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "age": 28,
    "sex": "male",
    "weight_kg": 80,
    "height_cm": 182,
    "activity_level": "moderate",
    "training_type": "hypertrophy",
    "goal": "bulk",
    "meals_per_day": 4,
    "save_as_target": true
  }'
```

---

### 4. Foods & Catalog Endpoints

#### Search, Filter by Category, Sort & Paginate Foods
```bash
curl -X GET "http://localhost:4000/api/foods?search=chicken&category=meat&sort=protein_g&order=desc&page=1&limit=10"
```
*Response (200 OK):*
```json
{
  "foods": [
    {
      "id": 1,
      "name": "Chicken Breast (Cooked, Skinless)",
      "category": "meat",
      "serving_label": "100g cooked",
      "serving_g": 100,
      "calories": 165,
      "protein_g": 31,
      "carbs_g": 0,
      "fat_g": 3.6,
      "protein_density_pct": 75.2,
      "is_custom": 0
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

#### Get Single Food Details
```bash
curl -X GET http://localhost:4000/api/foods/1
```

#### Create a Custom Food (Authenticated)
```bash
curl -X POST http://localhost:4000/api/foods \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Artisanal High-Protein Sourdough",
    "category": "grains",
    "serving_label": "2 slices (80g)",
    "serving_g": 80,
    "calories": 190,
    "protein_g": 14.5,
    "carbs_g": 30,
    "fat_g": 1.5
  }'
```

---

### 5. Food Intake Logs Endpoints

#### Log a Food Entry (Snapshot Saved)
```bash
curl -X POST http://localhost:4000/api/logs/food \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "food_id": 1,
    "meal_type": "lunch",
    "quantity": 1.5
  }'
```
*Response (201 Created):*
```json
{
  "log": {
    "id": 35,
    "food_id": 1,
    "meal_type": "lunch",
    "quantity": 1.5,
    "protein_g": 46.5,
    "calories": 247.5,
    "food_name": "Chicken Breast (Cooked, Skinless)",
    "serving_label": "100g cooked"
  }
}
```

#### Get Food Logs for a Specific Date
```bash
curl -X GET "http://localhost:4000/api/logs?date=2026-10-06" \
  -b cookies.txt
```

#### Update an Existing Food Log
```bash
curl -X PUT http://localhost:4000/api/logs/food/35 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "quantity": 2.0,
    "meal_type": "dinner"
  }'
```

#### Delete a Food Log
```bash
curl -X DELETE http://localhost:4000/api/logs/food/35 \
  -b cookies.txt
```

---

### 6. Supplements Endpoints

#### Get All Supplements with User Status
```bash
curl -X GET http://localhost:4000/api/supplements \
  -b cookies.txt
```

#### Toggle a Supplement Active/Inactive
```bash
curl -X PUT http://localhost:4000/api/supplements/1/toggle \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "is_active": true,
    "default_servings": 1.0
  }'
```

#### Log Supplement Intake
```bash
curl -X POST http://localhost:4000/api/logs/supplement \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "supplement_id": 1,
    "servings": 1.0
  }'
```

---

### 7. Dashboard Endpoint

#### Get Full Dashboard Analytics
```bash
curl -X GET "http://localhost:4000/api/dashboard?date=2026-10-06" \
  -b cookies.txt
```
*Response (200 OK):*
```json
{
  "user": {
    "id": 1,
    "name": "Alex Vance",
    "daily_protein_target_g": 164,
    "meals_per_day": 4
  },
  "date": "2026-10-06",
  "today": {
    "target_g": 164,
    "consumed_g": 168.0,
    "percent": 102.4,
    "remaining_g": 0,
    "calories": 1820
  },
  "meals_timeline": {
    "breakfast": [
      {
        "id": 10,
        "food_id": 15,
        "food_name": "Egg Whites (Liquid)",
        "quantity": 1.0,
        "protein_g": 26.0,
        "calories": 125,
        "logged_at": "2026-10-06T08:30:00Z"
      }
    ],
    "lunch": [],
    "dinner": [],
    "snack": []
  },
  "supplements": [
    {
      "id": 1,
      "name": "Whey Protein Isolate (90%)",
      "protein_g": 27.0,
      "is_active": 1,
      "logged_today": true,
      "servings_taken": 1.0
    }
  ],
  "last_7_days": [
    { "date": "2026-09-30", "day_label": "Wed", "total_protein_g": 165, "hit_goal": true },
    { "date": "2026-10-01", "day_label": "Thu", "total_protein_g": 170, "hit_goal": true },
    { "date": "2026-10-02", "day_label": "Fri", "total_protein_g": 162, "hit_goal": true },
    { "date": "2026-10-03", "day_label": "Sat", "total_protein_g": 175, "hit_goal": true },
    { "date": "2026-10-04", "day_label": "Sun", "total_protein_g": 158, "hit_goal": true },
    { "date": "2026-10-05", "day_label": "Mon", "total_protein_g": 166, "hit_goal": true },
    { "date": "2026-10-06", "day_label": "Tue", "total_protein_g": 168, "hit_goal": true }
  ],
  "streak_days": 14,
  "average_30d_protein_g": 164.2
}
```

---

### 8. Home Landing Page Content Endpoints

#### Dynamic Social Proof Statistics
```bash
curl -X GET http://localhost:4000/api/home/stats
```
*Response (200 OK):*
```json
{
  "athlete_count": 14280,
  "athlete_count_label": "14.3k+",
  "total_logs": 4825900,
  "total_logs_label": "4.8M+",
  "goal_hit_rate_pct": 94.6,
  "goal_hit_rate_label": "95%"
}
```

#### Testimonials
```bash
curl -X GET http://localhost:4000/api/home/testimonials
```

#### FAQs Accordion
```bash
curl -X GET http://localhost:4000/api/faqs
```

---

### 9. Newsletter Subscription Endpoint

#### Subscribe an Email Address
```bash
curl -X POST http://localhost:4000/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "email": "runner@endurance.com",
    "source": "cta"
  }'
```
*Response (200 OK):*
```json
{
  "message": "You have successfully subscribed to Telemetry Dispatch.",
  "status": "subscribed"
}
```
*(If already subscribed, returns 200 OK with `status: "already_subscribed"` and a friendly message).*

---

## 7. Error Handling Specification

All error responses from the API share this unified JSON signature:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email address format"
  }
}
```

### Standard Error Codes
| HTTP Status | Error Code | Description |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed parameters or unparseable payload |
| 400 | `VALIDATION_ERROR` | Failed Zod request schema validation |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT session cookie |
| 403 | `FORBIDDEN` | Insufficient permissions to access or edit resource |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Email already registered or resource conflict |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded |
| 500 | `INTERNAL_SERVER_ERROR` | Unhandled server error |


---

## 8. Frontend Integration Snippets (Screen-by-Screen)

All API calls from the frontend must include `{ credentials: "include" }` so that browsers automatically transmit and store the secure `httpOnly` JWT session cookie.

---

### Screen 1: HOME (`index.html`)

Integrates real-time social-proof statistics, dynamic testimonials, FAQ accordion, and Telemetry Dispatch newsletter subscription:

```javascript
// Screen 1: Home Page Dynamic Content & Newsletter
document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = 'http://localhost:4000/api';

  // 1. Fetch Dynamic Social-Proof Telemetry Stats
  try {
    const res = await fetch(`${API_BASE}/home/stats`, { credentials: 'include' });
    if (res.ok) {
      const stats = await res.json();
      const athletesEl = document.getElementById('stat-athletes-count');
      const logsEl = document.getElementById('stat-logs-count');
      const hitRateEl = document.getElementById('stat-goal-rate');

      if (athletesEl) athletesEl.textContent = stats.athlete_count_label; // e.g. "14.3k+"
      if (logsEl) logsEl.textContent = stats.total_logs_label;            // e.g. "4.8M+"
      if (hitRateEl) hitRateEl.textContent = stats.goal_hit_rate_label;    // e.g. "95%"
    }
  } catch (err) {
    console.error('Failed to load home statistics:', err);
  }

  // 2. Fetch Dynamic Testimonials
  try {
    const res = await fetch(`${API_BASE}/home/testimonials`, { credentials: 'include' });
    if (res.ok) {
      const { testimonials } = await res.json();
      const container = document.getElementById('testimonials-container');
      if (container && testimonials.length) {
        container.innerHTML = testimonials.map(t => `
          <div class="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div class="text-amber-400 font-bold">${'★'.repeat(t.rating)}</div>
            <p class="text-slate-300 text-sm italic">"${t.content}"</p>
            <div class="flex items-center gap-3 pt-2 border-t border-slate-800">
              <img src="${t.avatar_url}" class="w-8 h-8 rounded-full object-cover" alt="${t.author_name}">
              <div>
                <div class="text-white text-xs font-bold">${t.author_name}</div>
                <div class="text-slate-500 text-[10px] font-mono">${t.author_title}</div>
              </div>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load testimonials:', err);
  }

  // 3. Telemetry Dispatch Newsletter Subscription
  const newsletterForm = document.querySelector('form[data-newsletter="true"], form[onsubmit*="handleSubscribe"]');
  if (newsletterForm) {
    newsletterForm.onsubmit = async (e) => {
      e.preventDefault();
      const emailInput = newsletterForm.querySelector('input[type="email"]');
      if (!emailInput) return;

      try {
        const res = await fetch(`${API_BASE}/newsletter/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: emailInput.value.trim(), source: 'home_footer' })
        });
        const data = await res.json();
        if (res.ok) {
          alert(data.message || 'Subscribed successfully!');
          newsletterForm.reset();
        } else {
          alert(data.error?.message || 'Subscription failed');
        }
      } catch (err) {
        alert('Network error subscribing to newsletter');
      }
    };
  }
});
```

---

### Screen 2: CALCULATOR (`calculator.html`)

Submits user anthropometrics, computes daily target and leucine threshold, and saves directly to the user profile:

```javascript
// Screen 2: Macro Calculator Integration
async function submitCalculation(saveAsTarget = false) {
  const API_BASE = 'http://localhost:4000/api';

  const payload = {
    age: parseInt(document.getElementById('input-age').textContent, 10) || 28,
    sex: 'male',
    weight_kg: parseFloat(document.getElementById('input-weight').value) || 78,
    height_cm: parseFloat(document.getElementById('input-height').value) || 180,
    activity_level: 'moderate',
    training_type: window.calcState?.training || 'hypertrophy',
    goal: window.calcState?.objective || 'bulk',
    meals_per_day: window.calcState?.mealsPerDay || 4,
    save_as_target: saveAsTarget
  };

  try {
    const res = await fetch(`${API_BASE}/calculator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Calculation failed');

    const target = data.target;

    // Fill UI Elements
    document.getElementById('res-target-grams').textContent = target.daily_protein_target_g;
    document.getElementById('res-target-ratio').textContent = `${target.g_per_kg.toFixed(2)} g / kg`;
    document.getElementById('res-link-grams').textContent = `${target.daily_protein_target_g}g`;
    
    // Fill Context & Evidence-Based Notes
    const contextEl = document.getElementById('res-context-text');
    if (contextEl) {
      contextEl.innerHTML = `
        Target: <strong class="text-cyan-400 font-bold">${target.daily_protein_target_g}g/day</strong> 
        distributed as <span class="text-white font-semibold">${target.per_meal_protein_g}g</span> across 
        ${target.meals_per_day} meals. Leucine threshold: 
        <span class="text-emerald-400 font-semibold">${target.leucine_threshold_g}g/meal</span>.
      `;
    }

    // Render Meals Split Cards
    const grid = document.getElementById('meals-distribution-grid');
    if (grid) {
      grid.innerHTML = Array.from({ length: target.meals_per_day }, (_, i) => `
        <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div class="text-[9px] font-mono uppercase text-slate-400">MEAL 0${i + 1} WINDOW</div>
          <div class="text-base font-bold font-mono text-cyan-400">${target.per_meal_protein_g}g</div>
          <div class="text-[10px] text-emerald-400 font-mono">≥${target.leucine_threshold_g}g Leucine</div>
        </div>
      `).join('');
    }

    if (saveAsTarget) {
      alert(`Daily target of ${target.daily_protein_target_g}g saved to your profile!`);
      window.location.href = 'dashboard.html';
    }
  } catch (err) {
    alert(err.message);
  }
}
```

---

### Screen 3: FOODS DATABASE (`foods.html`)

Fetches paginated, sorted, and filtered catalog items with portion calculator and one-click log additions:

```javascript
// Screen 3: Food Database & Portion Logging
let foodsPage = 1;
let currentCategory = 'all';
let searchQuery = '';

async function fetchFoods() {
  const API_BASE = 'http://localhost:4000/api';
  const tableBody = document.getElementById('food-table-body');
  if (!tableBody) return;

  const params = new URLSearchParams({
    page: foodsPage,
    limit: 12,
    sort: 'protein_g',
    order: 'desc'
  });
  if (searchQuery) params.append('search', searchQuery);
  if (currentCategory !== 'all') params.append('category', currentCategory);

  try {
    const res = await fetch(`${API_BASE}/foods?${params.toString()}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message);

    // Update count badge
    const badge = document.getElementById('food-count-badge');
    if (badge) badge.textContent = `${data.pagination.total} VERIFIED ITEMS`;

    // Render Table Rows
    tableBody.innerHTML = data.foods.map(food => {
      const pct = Math.min(100, Math.round((food.protein_g / 40) * 100));
      return `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
          <td class="py-4 px-4 font-bold text-white text-sm">
            ${food.name}
            <div class="text-[11px] text-slate-400 font-mono font-normal">${food.serving_label} (${food.calories} kcal)</div>
          </td>
          <td class="py-4 px-3">
            <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">${food.category}</span>
          </td>
          <td class="py-4 px-3 font-mono">
            <div class="text-white font-bold text-xs">${food.protein_g}g</div>
            <div class="h-1.5 w-24 bg-slate-800 rounded-full mt-1 overflow-hidden">
              <div class="h-full bg-cyan-400" style="width: ${pct}%"></div>
            </div>
          </td>
          <td class="py-4 px-3 text-slate-300 text-xs">${food.serving_label}</td>
          <td class="py-4 px-3 font-mono font-bold text-lime-400 text-xs">${food.protein_g}g</td>
          <td class="py-4 px-4 text-right">
            <button onclick="logFood(${food.id}, '${food.name}')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-cyan-400 text-xs font-semibold transition-all">
              + Add to Log
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error fetching foods:', err);
  }
}

// Log Food directly from Foods Screen
async function logFood(foodId, foodName) {
  const API_BASE = 'http://localhost:4000/api';
  const mealType = prompt(`Add "${foodName}" to which meal? (breakfast/lunch/dinner/snack)`, 'lunch');
  if (!mealType) return;

  try {
    const res = await fetch(`${API_BASE}/logs/food`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ food_id: foodId, meal_type: mealType.toLowerCase().trim(), quantity: 1.0 })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message);
    alert(`Logged ${data.log.food_name} (${data.log.protein_g}g protein) to ${data.log.meal_type}!`);
  } catch (err) {
    alert(err.message);
  }
}
```

---

### Screen 4: DASHBOARD (`dashboard.html`)

Populates circular SVG progress ring, 7-day bar chart, meal timeline grouped by slots, supplements toggles, and streak counters:

```javascript
// Screen 4: Real-Time Dashboard Integration
document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = 'http://localhost:4000/api';
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const res = await fetch(`${API_BASE}/dashboard?date=${todayStr}`, { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = 'index.html#signin';
      return;
    }
    const data = await res.json();

    // 1. Greet User & Metric Cards
    document.getElementById('dash-user-greeting').textContent = `Hi, ${data.user.name} 👋`;
    document.getElementById('dash-current-grams').textContent = data.today.consumed_g;
    document.getElementById('dash-goal-grams').textContent = data.today.target_g;
    document.getElementById('dash-left-badge').textContent = `${data.today.remaining_g}g Left`;
    document.getElementById('dash-pct-label').textContent = `${data.today.percent}%`;
    document.getElementById('dash-streak-badge').textContent = `🔥 ${data.streak_days} Day Streak`;

    // 2. Circular SVG Progress Ring (circumference = 402.1)
    const ring = document.getElementById('dash-donut-ring');
    if (ring) {
      const circum = 402.1;
      const offset = circum * (1 - Math.min(1, data.today.consumed_g / data.today.target_g));
      ring.style.strokeDashoffset = offset;
    }

    // 3. Render 7-Day Bar Chart
    const chartContainer = document.getElementById('dash-weekly-chart');
    if (chartContainer && data.last_7_days) {
      chartContainer.innerHTML = data.last_7_days.map(d => {
        const heightPct = Math.min(100, Math.round((d.total_protein_g / 200) * 100));
        return `
          <div class="flex flex-col items-center gap-1.5 flex-1">
            <div class="text-[10px] font-mono text-slate-400">${d.total_protein_g}g</div>
            <div class="w-full h-28 bg-slate-800/80 rounded-t flex items-end">
              <div class="w-full ${d.hit_goal ? 'bg-emerald-400' : 'bg-cyan-400'} rounded-t transition-all" style="height: ${heightPct}%"></div>
            </div>
            <div class="text-[11px] font-mono text-slate-300 font-bold">${d.day_label}</div>
          </div>
        `;
      }).join('');
    }

    // 4. Grouped Meal Timeline with Delete Action
    const mealContainer = document.getElementById('meal-cards-container');
    if (mealContainer && data.meals_timeline) {
      const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
      mealContainer.innerHTML = mealTypes.map(type => {
        const items = data.meals_timeline[type] || [];
        const total = items.reduce((sum, item) => sum + item.protein_g, 0);
        return `
          <div class="p-5 rounded-2xl bg-[#0F1626] border border-slate-800 space-y-3">
            <div class="flex justify-between items-center pb-2 border-b border-slate-800">
              <h4 class="font-bold text-white capitalize text-sm">${type}</h4>
              <span class="font-mono text-cyan-400 font-bold text-xs">${total.toFixed(1)}g</span>
            </div>
            ${items.length === 0 ? '<div class="text-xs text-slate-500 italic">No food logged</div>' : items.map(item => `
              <div class="flex justify-between items-center text-xs py-1">
                <span class="text-white">${item.food_name} (${item.quantity}x)</span>
                <div class="flex items-center gap-2">
                  <span class="font-mono text-slate-300 font-semibold">${item.protein_g.toFixed(1)}g</span>
                  <button onclick="deleteFoodLog(${item.id})" class="text-slate-600 hover:text-rose-400 transition-colors">✕</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }).join('');
    }

    // 5. Supplements Tracker
    const supContainer = document.getElementById('supplements-list-container');
    if (supContainer && data.supplements) {
      supContainer.innerHTML = data.supplements.map(s => `
        <div class="flex justify-between items-center p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div>
            <div class="font-bold text-white">${s.name}</div>
            <div class="text-slate-400 font-mono text-[10px]">${s.protein_g}g protein</div>
          </div>
          <button onclick="logSupplement(${s.id})" class="px-3 py-1 rounded-lg ${s.logged_today ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-300'} font-semibold">
            ${s.logged_today ? '✓ Taken' : '+ Take'}
          </button>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
});

// Delete Food Log Handler
async function deleteFoodLog(id) {
  if (!confirm('Delete this entry?')) return;
  const res = await fetch(`http://localhost:4000/api/logs/food/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (res.ok) window.location.reload();
}

// Log Supplement Handler
async function logSupplement(id) {
  const res = await fetch(`http://localhost:4000/api/logs/supplement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ supplement_id: id, servings: 1.0 })
  });
  if (res.ok) window.location.reload();
}
```
