# ProteinTrack — Full-Stack Bio-Nutritional Platform

A high-performance bio-nutritional protein tracking platform engineered for athletes, bodybuilders, and fitness enthusiasts. Built from the **Google Stitch** design project `18006381912984570538`.

---

## 📁 Repository Structure

```
protientracker-/
├── frontend/          # Complete Frontend Web UI (HTML, CSS, JS, API SDK)
│   ├── index.html     # Home Landing Page
│   ├── calculator.html# Daily Protein Target Calculator
│   ├── foods.html     # Verified Food & Protein Density Database
│   ├── dashboard.html # Athlete Telemetry Cockpit & Progress Ring
│   ├── css/           # Theme stylesheets (Dark & Light modes)
│   └── js/            # State management, auth modal, and backend API connectors
├── backend/           # Complete Node.js + Express REST API Service
│   ├── src/           # Controllers, routes, middlewares, JWT auth, Zod validation
│   └── README.md      # Full API documentation & cURL reference
├── db/                # Standalone SQLite Database & Data-Access Layer
│   ├── migrations/    # Numbered SQL migrations (001_init, 002_indexes, 003_views)
│   ├── seeds/         # 62 verified foods, 11 supplements, FAQs, 30-day demo logs
│   ├── queries/       # Parameterized data-access modules
│   └── README.md      # ER diagrams & PostgreSQL migration guide
├── tests/             # Automated Database & Constraint Test Suite (18 tests)
└── stitch_screens/    # Original Stitch UI Design Screens & Assets
```

---

## 📱 Stitch Screens Catalog

| # | Screen ID | Title | Design Asset | Frontend Screen |
|---|---|---|---|---|
| 1 | `edb36da5593042c4b2653ab82dd8b4cb` | **Home Landing Page** | [`stitch_screens/images/landing.png`](stitch_screens/images/landing.png) | [`frontend/index.html`](frontend/index.html) |
| 2 | `256eda4f3d3d46e0bd73b3e85348ce94` | **Protein Calculator & Target Plan** | [`stitch_screens/images/calculator.png`](stitch_screens/images/calculator.png) | [`frontend/calculator.html`](frontend/calculator.html) |
| 3 | `3ad9a660a5dc4b42a9fd4f04e3f4a757` | **Foods Protein Database** | [`stitch_screens/images/food_database.png`](stitch_screens/images/food_database.png) | [`frontend/foods.html`](frontend/foods.html) |
| 4 | `53a58aab10f44133bf5f81065dd6de51` | **Dashboard (Logged-In View)** | [`stitch_screens/images/dashboard.png`](stitch_screens/images/dashboard.png) | [`frontend/dashboard.html`](frontend/dashboard.html) |

---

## 🚀 Quick Start

### 1. Database Layer & Automated Tests
```bash
npm install
npm run migrate   # Applies 001_init.sql, 002_indexes.sql, 003_views.sql
npm run seed      # Seeds 62 foods, 11 supplements, FAQs, and 30-day demo athlete
npm test          # Runs all 18 automated database & integrity tests
```

### 2. Backend API Server (`backend/`)
```bash
cd backend
npm install
npm run setup     # Initializes database and seeds catalog
npm start         # Boots Express API on http://localhost:4000
```

### 3. Frontend UI (`frontend/`)
Serve the `frontend/` directory using the included PowerShell server or any static server:
```bash
powershell -ExecutionPolicy Bypass -File ./server.ps1
# Or using npx:
npx serve frontend
```
Then open `http://localhost:8080` in your browser.
