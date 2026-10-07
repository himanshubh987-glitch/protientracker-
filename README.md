# ProteinTrack Web Platform

A high-performance bio-nutritional web platform precision-engineered for athletes, bodybuilders, and fitness enthusiasts. Built from the **Google Stitch** design project `18006381912984570538`.

---

## 📱 Stitch Project & Screens Catalog

| # | Screen ID | Title | Downloaded Asset | Responsive Web Page |
|---|---|---|---|---|
| 1 | `edb36da5593042c4b2653ab82dd8b4cb` | **Home Landing Page** | [`stitch_screens/images/landing.png`](stitch_screens/images/landing.png) | [`index.html`](index.html) |
| 2 | `256eda4f3d3d46e0bd73b3e85348ce94` | **Protein Calculator & Target Plan** | [`stitch_screens/images/calculator.png`](stitch_screens/images/calculator.png) | [`calculator.html`](calculator.html) |
| 3 | `3ad9a660a5dc4b42a9fd4f04e3f4a757` | **Foods Protein Database** | [`stitch_screens/images/food_database.png`](stitch_screens/images/food_database.png) | [`foods.html`](foods.html) |
| 4 | `53a58aab10f44133bf5f81065dd6de51` | **Dashboard (Logged-In View)** | [`stitch_screens/images/dashboard.png`](stitch_screens/images/dashboard.png) | [`dashboard.html`](dashboard.html) |

---

## 🚀 Key Features

### 1. Home Landing Page (`index.html`)
- **Bio-Nutritional Cockpit**: Real-time telemetry dashboard preview.
- **Interactive Daily Target Status**: Live radial progress ring showing target completion (e.g. 142g / 160g), macronutrient distribution bar (Protein 40%, Carbs 35%, Fats 25%), and one-click quick log buttons (`+5g`, `+15g`, `+30g`).
- **Engine Architecture Grid**: Algorithmic Caliper, Curated Lab Data, 1-Tap Interface, and Adaptive Analytics.
- **Protocol Execution**: 3-step scientific onboarding workflow.
- **Social Proof**: CSCS scientific review and athlete metrics (10k+ athletes, 4.8M meals verified).

### 2. Scientific Protein Target Calculator (`calculator.html`)
- **Athlete Parameter Calibration**: Chronological age stepper, biological profile toggles, stature (cm/ft), and body mass (kg/lbs).
- **METS-Scaled Training Intensity**: 6 modes (Sedentary, Light Activity, Moderate Gym, Heavy Gym, Endurance Sport, Strength Sport).
- **Physiological Objectives**: Fat Loss (Cut / deficit), Weight Maintenance (eu-caloric), and Muscle Gain (Bulk / surplus).
- **Live Output**: Computes personalized daily gram requirement down to single grams, g/kg and g/lb ratios, and meal distribution matrix (3, 4, or 5 feeding windows with leucine threshold spikes).
- **One-Click Sync**: "Save Target & Launch Dashboard" transfers the calibrated target directly into the user dashboard.

### 3. Verified Food & Telemetry Database (`foods.html`)
- **Clinical Telemetry Matrix**: Verified against USDA FoodData Central and DIAAS/PDCAAS bioavailability scoring standards.
- **Live Search & Category Filtering**: Filter by Vegetarian, Poultry & Seafood, Dairy & Whey, Legumes & Pulses, Nuts & Seeds, High-Protein (>20g/100g), and Lean Low-Calorie (<150 kcal).
- **Dual View Modes**: Dense table view and tactile card view.
- **Interactive Logging**: Tap "+ Add to Log" to instantly append any food to today's dashboard intake with toast confirmation.
- **BCAA & Leucine Ratio Inspector**: Evaluates food against the 2.7g per-meal mTOR activation threshold.

### 4. Athlete Telemetry Dashboard (`dashboard.html`)
- **Glowing Donut Progress Meter**: Displays current intake, daily goal, remaining grams, and target percentage.
- **Secondary Macronutrient Progress Bars**: Carbs (180/220g), Fats (52/65g), and Energy (1,840/2,200 kcal).
- **7-Day Protein Vector**: Bar chart showing weekly consistency against the target baseline.
- **1-Tap Precision Increment Chips**: Quick logging for Whey Isolate (+25g), Boiled Eggs (+13g), Chicken (+46g), Greek Yogurt (+18g), and Lentils (+14g).
- **Meal Chronology**: Detailed meal tracking (Breakfast, Lunch, Dinner, Snacks) with delete/edit actions and macronutrient subtotals.
- **Supplement Telemetry**: Check off daily supplements (Creatine, Whey Shaker, ZMA).
- **Quick Add Modal**: Add custom food items and protein grams on the fly.

---

## 🛠️ Viewport Preview Switcher
All pages include an integrated **Viewport Mode Switcher** located on the sub-header:
- **Desktop (1440px)**: Full widescreen layout
- **Tablet (768px)**: Centered tablet container
- **Mobile (375px)**: Mobile device container demonstrating responsive single-column layouts and touch-friendly controls.

---

## 💻 How to Run Locally

You can open any of the HTML files directly in your web browser, or serve them locally:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve .
```

Then visit `http://localhost:8000` in your browser.

---

## 🗄️ Database & Data-Access Layer

The project includes a standalone production SQLite database layer using `better-sqlite3` and versioned plain SQL migrations:

```bash
# Apply migrations sequentially
npm run migrate

# Seed 62 foods, 11 supplements, FAQs, testimonials, and 30-day demo athlete
npm run seed

# Full clean reset
npm run reset

# Run test suite (18 unit and constraint tests)
npm test
```

See [`db/README.md`](file:///c:/Users/HIMANSHU/Documents/protien/db/README.md) for full ER diagrams, data integrity rules, and PostgreSQL migration instructions.
