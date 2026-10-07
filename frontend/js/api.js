/**
 * ProteinTrack API Client & Screen Integration Layer
 * Connects frontend screens to Express backend using fetch(..., { credentials: 'include' })
 */

const API_BASE = window.PROTEINTRACK_API_BASE || 'https://web-production-9a5ea8.up.railway.app/api';
const TOKEN_STORAGE_KEY = 'pt_auth_token';

/**
 * Universal JSON Fetch Helper with credentials: 'include' + Bearer fallback
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const headers = {
    'Content-Type': 'application/json',
    ...(savedToken ? { 'Authorization': `Bearer ${savedToken}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    method: options.method || 'GET',
    ...options,
    headers,
    credentials: 'include' // Sends & receives httpOnly session cookie
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const err = (data && data.error) ? data.error : { code: 'HTTP_ERROR', message: `Request failed with status ${res.status}` };
      throw err;
    }

    if (data && data.token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    }

    return data;
  } catch (err) {
    console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, err);
    throw err;
  }
}

// ==========================================
// API CLIENT SDK
// ==========================================
window.API = {
  // Auth
  auth: {
    me: () => apiRequest('/auth/me'),
    login: (email, password) => apiRequest('/auth/login', { method: 'POST', body: { email, password } }),
    register: (userData) => apiRequest('/auth/register', { method: 'POST', body: userData }),
    logout: async () => {
      try {
        return await apiRequest('/auth/logout', { method: 'POST' });
      } finally {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    },
  },

  // Profile
  profile: {
    get: () => apiRequest('/profile'),
    update: (data) => apiRequest('/profile', { method: 'PUT', body: data }),
  },

  // Calculator
  calculator: {
    calculate: (params, saveAsTarget = false) => apiRequest('/calculator', {
      method: 'POST',
      body: { ...params, save_as_target: saveAsTarget }
    }),
  },

  // Foods Catalog
  foods: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiRequest(`/foods${query ? `?${query}` : ''}`);
    },
    get: (id) => apiRequest(`/foods/${id}`),
    create: (data) => apiRequest('/foods', { method: 'POST', body: data }),
  },

  // Food Logs
  logs: {
    list: (date) => apiRequest(`/logs${date ? `?date=${date}` : ''}`),
    create: (food_id, meal_type, quantity = 1) => apiRequest('/logs/food', {
      method: 'POST',
      body: { food_id, meal_type, quantity }
    }),
    update: (id, data) => apiRequest(`/logs/food/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/logs/food/${id}`, { method: 'DELETE' }),
  },

  // Supplements
  supplements: {
    list: () => apiRequest('/supplements'),
    toggle: (id, is_active, default_servings = 1) => apiRequest(`/supplements/${id}/toggle`, {
      method: 'PUT',
      body: { is_active, default_servings }
    }),
    log: (supplement_id, servings = 1) => apiRequest('/logs/supplement', {
      method: 'POST',
      body: { supplement_id, servings }
    }),
  },

  // Dashboard
  dashboard: {
    get: (date) => apiRequest(`/dashboard${date ? `?date=${date}` : ''}`),
  },

  // Home Landing Content
  home: {
    getStats: () => apiRequest('/home/stats'),
    getTestimonials: () => apiRequest('/home/testimonials'),
    getFaqs: () => apiRequest('/faqs'),
  },

  // Newsletter
  newsletter: {
    subscribe: (email, source = 'web') => apiRequest('/newsletter/subscribe', {
      method: 'POST',
      body: { email, source }
    }),
  }
};

// ==========================================
// SCREEN 1: HOME PAGE INTEGRATION
// ==========================================
async function initHomeScreen() {
  // 1. Fetch Real-time Platform Statistics
  try {
    const stats = await API.home.getStats();
    const athleteCountEl = document.getElementById('stat-athletes-count');
    const logsCountEl = document.getElementById('stat-logs-count');
    const goalRateEl = document.getElementById('stat-goal-rate');

    if (athleteCountEl) athleteCountEl.textContent = stats.athlete_count_label || `${(stats.athlete_count / 1000).toFixed(1)}k+`;
    if (logsCountEl) logsCountEl.textContent = stats.total_logs_label || `${(stats.total_logs / 1000000).toFixed(1)}M+`;
    if (goalRateEl) goalRateEl.textContent = stats.goal_hit_rate_label || `${stats.goal_hit_rate_pct}%`;
  } catch (e) {
    console.warn('Could not load dynamic platform statistics:', e.message);
  }

  // 2. Fetch Dynamic Testimonials
  try {
    const { testimonials } = await API.home.getTestimonials();
    const container = document.getElementById('testimonials-container');
    if (container && testimonials && testimonials.length > 0) {
      container.innerHTML = testimonials.map(t => `
        <div class="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div class="flex items-center gap-1 text-amber-400">
            ${'★'.repeat(t.rating || 5)}
          </div>
          <p class="text-slate-300 text-sm italic">"${t.content}"</p>
          <div class="flex items-center gap-3 pt-2 border-t border-slate-800">
            <img src="${t.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}" class="w-9 h-9 rounded-full object-cover border border-slate-700" alt="${t.author_name}">
            <div>
              <div class="text-white text-xs font-bold">${t.author_name}</div>
              <div class="text-slate-500 text-[11px] font-mono">${t.author_title}</div>
            </div>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.warn('Could not load dynamic testimonials:', e.message);
  }

  // 3. Connect Newsletter Subscription Handlers
  document.querySelectorAll('form[data-newsletter="true"], form[onsubmit*="handleSubscribe"]').forEach(form => {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      if (!input || !input.value) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Subscribing...'; }

      try {
        const res = await API.newsletter.subscribe(input.value.trim(), 'home_footer');
        if (window.PT_APP && PT_APP.showToast) {
          PT_APP.showToast(res.message || "Subscribed to Telemetry Dispatch!");
        } else {
          alert(res.message);
        }
        form.reset();
      } catch (err) {
        if (window.PT_APP && PT_APP.showToast) {
          PT_APP.showToast(err.message || "Subscription failed", "✕");
        } else {
          alert(err.message || 'Subscription failed');
        }
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
      }
    };
  });

  // 4. Check Auth Status for Navbar
  try {
    const { user } = await API.auth.me();
    if (user) {
      const signInBtns = document.querySelectorAll('button[onclick*="openAuthModal"]');
      signInBtns.forEach(btn => {
        btn.innerHTML = `<span class="truncate max-w-[100px]">${user.name}</span>`;
        btn.onclick = () => window.location.href = 'dashboard.html';
      });
    }
  } catch (e) {
    // Guest user
  }
}

// ==========================================
// SCREEN 2: CALCULATOR PAGE INTEGRATION
// ==========================================
async function initCalculatorScreen() {
  const calcBtn = document.getElementById('btn-run-calculation');
  const saveBtn = document.getElementById('btn-save-target');

  async function calculateWithBackend(saveAsTarget = false) {
    const age = parseInt(document.getElementById('input-age')?.textContent || '28', 10);
    const weightVal = parseFloat(document.getElementById('input-weight')?.value || '78');
    const heightVal = parseFloat(document.getElementById('input-height')?.value || '180');
    
    // Retrieve training & objective from window.calcState if available
    const state = window.calcState || {};
    const training = state.training || 'heavy';
    const goal = state.objective || 'bulk';
    const mealsPerDay = state.mealsPerDay || 4;
    const sex = state.sex || 'male';

    try {
      const res = await API.calculator.calculate({
        age,
        sex,
        weight_kg: weightVal,
        height_cm: heightVal,
        activity_level: 'moderate',
        training_type: training,
        goal: goal,
        meals_per_day: mealsPerDay
      }, saveAsTarget);

      const t = res.target;
      // Populate UI elements
      const targetEl = document.getElementById('res-target-grams');
      const ratioEl = document.getElementById('res-target-ratio');
      const linkEl = document.getElementById('res-link-grams');
      const contextEl = document.getElementById('res-context-text');

      if (targetEl) targetEl.textContent = t.daily_protein_target_g;
      if (ratioEl) ratioEl.textContent = `${t.g_per_kg.toFixed(2)} g / kg`;
      if (linkEl) linkEl.textContent = `${t.daily_protein_target_g}g`;

      if (contextEl) {
        contextEl.innerHTML = `
          Target: <strong class="text-cyan-400 font-bold">${t.daily_protein_target_g}g / day</strong> 
          (${t.per_meal_protein_g}g across ${t.meals_per_day} meals). 
          Leucine threshold: <span class="text-emerald-400 font-semibold">${t.leucine_threshold_g}g/meal</span>.
        `;
      }

      // Render per-meal split grid
      renderMealSplitCards(t.meals_per_day, t.per_meal_protein_g, t.leucine_threshold_g);

      if (saveAsTarget) {
        if (window.PT_APP && PT_APP.showToast) {
          PT_APP.showToast(`Saved target: ${t.daily_protein_target_g}g! Redirecting to Dashboard...`);
        }
        setTimeout(() => window.location.href = 'dashboard.html', 800);
      }
    } catch (err) {
      console.error('Calculation error:', err);
      if (window.PT_APP && PT_APP.showToast) {
        PT_APP.showToast(err.message || 'Calculation failed', '✕');
      }
    }
  }

  function renderMealSplitCards(count, gramsPerMeal, leucine) {
    const grid = document.getElementById('meals-distribution-grid');
    if (!grid) return;

    let html = '';
    for (let i = 1; i <= count; i++) {
      html += `
        <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div class="text-[9px] font-mono uppercase text-slate-400">FEEDING WINDOW 0${i}</div>
          <div class="text-base font-bold font-mono text-cyan-400">${gramsPerMeal}g</div>
          <div class="text-[10px] text-emerald-400 font-mono">≥${leucine}g Leucine</div>
        </div>
      `;
    }
    grid.innerHTML = html;
  }

  if (calcBtn) {
    calcBtn.onclick = () => calculateWithBackend(false);
  }

  if (saveBtn) {
    saveBtn.onclick = () => calculateWithBackend(true);
  }
}

// ==========================================
// SCREEN 3: FOODS DATABASE INTEGRATION
// ==========================================
function mapDbCategoryToUiCategory(dbCategory) {
  const cat = (dbCategory || '').toLowerCase();
  if (cat === 'meat' || cat === 'poultry') return 'poultry';
  if (cat === 'fish' || cat === 'seafood') return 'seafood';
  if (cat === 'dairy') return 'dairy';
  if (cat === 'eggs' || cat === 'vegetarian') return 'vegetarian';
  if (cat === 'legumes') return 'legumes';
  if (cat === 'nuts') return 'nuts';
  if (cat === 'plant_protein' || cat === 'grains' || cat === 'plant-based') return 'plant-based';
  return cat || 'other';
}

function mapDbCategoryToIcon(dbCategory) {
  const cat = (dbCategory || '').toLowerCase();
  if (cat === 'meat' || cat === 'poultry') return 'drumstick';
  if (cat === 'fish' || cat === 'seafood') return 'fish';
  if (cat === 'dairy') return 'milk';
  if (cat === 'eggs') return 'egg';
  if (cat === 'legumes') return 'bean';
  if (cat === 'nuts') return 'nut';
  if (cat === 'grains') return 'wheat';
  if (cat === 'plant_protein') return 'leaf';
  return 'Flame';
}

async function initFoodsScreen() {
  // Wrap logFromFood so clicking "+ Add to Log" also persists to the backend database when logged in
  const originalLogFromFood = window.logFromFood;
  window.logFromFood = async (foodName, grams, foodId) => {
    if (typeof originalLogFromFood === 'function') {
      originalLogFromFood(foodName, grams);
    }
    const numericId = Number(foodId);
    if (numericId && !Number.isNaN(numericId)) {
      try {
        await API.logs.create(numericId, 'lunch', 1.0);
      } catch (e) {
        // Guest user or offline: already saved in local state via originalLogFromFood
      }
    }
  };

  try {
    const data = await API.foods.list({ limit: 100, sort: 'protein_g', order: 'desc' });
    const foods = data && Array.isArray(data.foods) ? data.foods : [];
    if (foods.length > 0 && typeof FOODS_DATA !== 'undefined' && Array.isArray(FOODS_DATA)) {
      const mappedFoods = foods.map(f => {
        const servingG = Number(f.serving_g) || 100;
        const proteinG = Number(f.protein_g) || 0;
        const calories = Number(f.calories) || 0;
        const carbsG = Number(f.carbs_g) || 0;
        const fatG = Number(f.fat_g) || 0;
        const proteinPer100g = Number(f.protein_density_pct) || Number(((proteinG / servingG) * 100).toFixed(1));
        const caloriesPer100g = Math.round((calories / servingG) * 100);

        return {
          id: String(f.id),
          dbId: f.id,
          name: f.name,
          subtext: `${f.serving_label} · ${calories} kcal · ${carbsG}g C / ${fatG}g F`,
          category: mapDbCategoryToUiCategory(f.category),
          categoryLabel: (f.category || 'FOOD').replace('_', ' ').toUpperCase(),
          proteinPer100g,
          caloriesPer100g,
          carbsPer100g: Number(((carbsG / servingG) * 100).toFixed(1)),
          fatPer100g: Number(((fatG / servingG) * 100).toFixed(1)),
          commonServing: f.serving_label,
          servingWeightG: servingG,
          proteinPerServe: proteinG,
          caloriesPerServe: calories,
          carbsPerServe: carbsG,
          fatPerServe: fatG,
          leucinePerServe: Number((proteinG * 0.088).toFixed(2)),
          diaasScore: 1.05,
          icon: mapDbCategoryToIcon(f.category)
        };
      });

      FOODS_DATA.splice(0, FOODS_DATA.length, ...mappedFoods);
      if (typeof window.renderDatabase === 'function') {
        window.renderDatabase();
      }
    }
  } catch (err) {
    console.warn('Using built-in verified foods catalog fallback:', err.message);
    if (typeof window.renderDatabase === 'function') {
      window.renderDatabase();
    }
  }
}

// ==========================================
// SCREEN 4: DASHBOARD INTEGRATION
// ==========================================
async function initDashboardScreen() {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const data = await API.dashboard.get(todayStr);

    // 1. User Greeting & Summary
    const greetingEl = document.getElementById('dash-user-greeting');
    if (greetingEl) greetingEl.textContent = `Hi, ${data.user.name} 👋`;

    const curGrams = data.today.consumed_g;
    const targetGrams = data.today.target_g;
    const remaining = data.today.remaining_g;
    const pct = data.today.percent;

    const curEl = document.getElementById('dash-current-grams');
    const targetEl = document.getElementById('dash-goal-grams');
    const leftEl = document.getElementById('dash-left-badge');
    const pctEl = document.getElementById('dash-pct-label');

    if (curEl) curEl.textContent = curGrams;
    if (targetEl) targetEl.textContent = targetGrams;
    if (leftEl) leftEl.textContent = `${remaining}g Left`;
    if (pctEl) pctEl.textContent = `${pct}%`;

    // 2. Circular SVG Progress Ring (circumference = 402.1)
    const ring = document.getElementById('dash-donut-ring');
    if (ring) {
      const circum = 402.1;
      const offset = circum * (1 - Math.min(1, curGrams / targetGrams));
      ring.style.strokeDashoffset = offset;
    }

    // 3. Render Grouped Meal Timeline
    renderDashboardMeals(data.meals_timeline);

    // 4. Render Supplements Tracker
    renderDashboardSupplements(data.supplements);

    // 5. Render 7-Day Chart & Streak
    renderDashboardHistory(data.last_7_days, data.streak_days);

  } catch (err) {
    console.error('Failed to load dashboard:', err);
    if (err.code === 'UNAUTHORIZED') {
      window.location.href = 'index.html#signin';
    }
  }
}

function renderDashboardMeals(timeline) {
  const container = document.getElementById('meal-cards-container');
  if (!container || !timeline) return;

  const categories = [
    { key: 'breakfast', title: 'Breakfast', tag: 'Morning Recovery' },
    { key: 'lunch', title: 'Lunch', tag: 'Peak Anabolic' },
    { key: 'dinner', title: 'Dinner', tag: 'Slow Release' },
    { key: 'snack', title: 'Snacks & Supplements', tag: 'Pre/Post Lift' }
  ];

  container.innerHTML = categories.map(cat => {
    const items = timeline[cat.key] || [];
    const totalMealProtein = items.reduce((sum, item) => sum + (item.protein_g || 0), 0);

    return `
      <div class="pt-card p-5 rounded-2xl border border-slate-800 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h4 class="font-bold text-white text-sm">${cat.title}</h4>
            <span class="text-[10px] font-mono text-cyan-400">${cat.tag}</span>
          </div>
          <span class="px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-mono font-bold">
            ${totalMealProtein.toFixed(1)}g
          </span>
        </div>

        <div class="space-y-2">
          ${items.length === 0 ? `<div class="text-xs text-slate-500 italic py-2">No food logged for this meal window.</div>` : items.map(item => `
            <div class="flex items-center justify-between py-1.5 border-b border-slate-800/40 text-xs">
              <div>
                <span class="text-white font-medium">${item.food_name}</span>
                <span class="text-slate-500 text-[11px] ml-1">(${item.quantity}x serving)</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="font-mono text-slate-300 font-semibold">${item.protein_g.toFixed(1)}g</span>
                <button onclick="deleteMealLog(${item.id})" class="text-slate-600 hover:text-rose-400 transition-colors" title="Delete">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderDashboardSupplements(supplements) {
  const container = document.getElementById('supplements-list-container');
  if (!container || !supplements) return;

  container.innerHTML = supplements.map(sup => `
    <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
      <div>
        <div class="font-bold text-white">${sup.name}</div>
        <div class="text-slate-400 text-[11px] font-mono">${sup.protein_g}g protein per dose</div>
      </div>
      <div class="flex items-center gap-3">
        <button onclick="logSupplementIntake(${sup.id})" class="px-2.5 py-1 rounded-lg ${sup.logged_today ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'} font-semibold text-xs">
          ${sup.logged_today ? '✓ Taken Today' : '+ Take Dose'}
        </button>
      </div>
    </div>
  `).join('');
}

function renderDashboardHistory(history, streakDays) {
  const streakEl = document.getElementById('dash-streak-badge');
  if (streakEl) streakEl.textContent = `🔥 ${streakDays} Day Streak`;

  const chartContainer = document.getElementById('dash-weekly-chart');
  if (!chartContainer || !history) return;

  chartContainer.innerHTML = history.map(day => {
    const heightPct = Math.min(100, Math.round((day.total_protein_g / 200) * 100));
    const isGoalMet = day.hit_goal;

    return `
      <div class="flex flex-col items-center gap-2 flex-1">
        <div class="text-[10px] font-mono text-slate-400">${day.total_protein_g}g</div>
        <div class="w-full h-32 bg-slate-800/80 rounded-t-lg relative flex items-end">
          <div class="w-full ${isGoalMet ? 'bg-emerald-400' : 'bg-cyan-400'} rounded-t-lg transition-all" style="height: ${heightPct}%"></div>
        </div>
        <div class="text-[11px] font-mono text-slate-300 font-bold">${day.day_label}</div>
      </div>
    `;
  }).join('');
}

window.deleteMealLog = async (logId) => {
  if (!confirm('Remove this food entry from your log?')) return;
  try {
    await API.logs.delete(logId);
    if (window.PT_APP && PT_APP.showToast) PT_APP.showToast('Log entry removed.');
    initDashboardScreen();
  } catch (err) {
    alert(`Failed to delete: ${err.message}`);
  }
};

window.logSupplementIntake = async (supplementId) => {
  try {
    await API.supplements.log(supplementId, 1.0);
    if (window.PT_APP && PT_APP.showToast) PT_APP.showToast('Supplement logged!');
    initDashboardScreen();
  } catch (err) {
    alert(`Failed to log supplement: ${err.message}`);
  }
};

// Automatic screen initialization based on pathname
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.endsWith('index.html') || path === '/' || path.endsWith('/')) {
    initHomeScreen();
  } else if (path.endsWith('calculator.html')) {
    initCalculatorScreen();
  } else if (path.endsWith('foods.html')) {
    initFoodsScreen();
  } else if (path.endsWith('dashboard.html')) {
    initDashboardScreen();
  }
});
