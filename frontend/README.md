# ProteinTrack Frontend UI

Responsive, dark/light-theme bio-nutritional cockpit interface for **ProteinTrack**.

---

## Directory Structure

```
frontend/
├── index.html          # Screen 1: Home Landing Page & Telemetry Dispatch
├── calculator.html     # Screen 2: Scientific Daily Protein Target Calculator
├── foods.html          # Screen 3: Verified Food & Protein Density Database
├── dashboard.html      # Screen 4: Athlete Telemetry Cockpit & Progress Ring
├── css/
│   └── styles.css      # Custom theme variables, light/dark modes, animations
└── js/
    ├── app.js          # Core state controller, theme toggle, unified auth modal
    ├── api.js          # Backend API SDK & screen-by-screen fetch connectors
    └── foods-data.js   # Local fallback verified nutritional catalog
```

---

## Key Features
- **4 Integrated Screens**: Home, Calculator, Foods Database, and Dashboard.
- **Unified Authentication Modal**: Single "Sign In" button launching the athlete login and registration popup with 1-click demo access.
- **Light / Dark Theme Switcher**: Cutted-moon button next to the profile avatar toggling full light/dark themes across all pages with persistent storage.
- **Live Backend Integration (`js/api.js`)**: Automatically connects to the Express backend (`http://localhost:4000/api`) using `fetch` with `credentials: "include"`.
