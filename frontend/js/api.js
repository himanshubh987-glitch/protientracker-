/**
 * ProteinTrack API Client & Screen Integration Layer
 * Connects frontend screens to Express backend using fetch(..., { credentials: 'include' })
 */

const API_BASE = window.PROTEINTRACK_API_BASE || (
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '8080'
    ? 'http://localhost:4000/api'
    : '/api'
);

/**
 * Universal JSON Fetch Helper with credentials: 'include'
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    credentials: 'include', // Sends & receives httpOnly session cookie
    ...options
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
    logout: () => apiRequest('/auth/logout', { method: 'POST' }),
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
let currentFoodsPage = 1;
let currentCategory = 'all';
let currentSearch = '';
let currentSort = 'protein_g';
let currentOrder = 'desc';

async function initFoodsScreen() {
  const tableBody = document.getElementById('food-table-body');
  const searchInput = document.getElementById('food-search-input');
  const countBadge = document.getElementById('food-count-badge');

  async function loadFoods() {
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">Loading bio-verified nutrition database...</td></tr>`;

    try {
      const params = {
        page: currentFoodsPage,
        limit: 15,
        sort: currentSort,
        order: currentOrder
      };
      if (currentSearch) params.search = currentSearch;
      if (currentCategory && currentCategory !== 'all') params.category = currentCategory;

      const data = await API.foods.list(params);
      const foods = data.foods;
      const pagination = data.pagination;

      if (countBadge) countBadge.textContent = `${pagination.total} VERIFIED ITEMS`;

      if (!foods || foods.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">No matching food records found.</td></tr>`;
        return;
      }

      tableBody.innerHTML = foods.map(food => {
        const pct100 = Math.min(100, Math.round((food.protein_g / 40) * 100));
        return `
          <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors group">
            <td class="py-4 px-4">
              <div class="font-bold text-white text-xs sm:text-sm group-hover:text-cyan-400 transition-colors">${food.name}</div>
              <div class="text-[11px] text-slate-400 font-mono">${food.serving_label} (${food.calories} kcal)</div>
            </td>
            <td class="py-4 px-3">
              <span class="inline-block text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                ${food.category}
              </span>
            </td>
            <td class="py-4 px-3 font-mono">
              <div class="space-y-1 w-28">
                <div class="flex justify-between text-[11px]">
                  <span class="font-bold text-white">${food.protein_g}g</span>
                  <span class="text-slate-500">${pct100}%</span>
                </div>
                <div class="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-cyan-400" style="width: ${pct100}%"></div>
                </div>
              </div>
            </td>
            <td class="py-4 px-3 text-slate-300 font-sans text-xs">
              ${food.serving_label}
            </td>
            <td class="py-4 px-3">
              <span class="inline-block px-2.5 py-1 rounded-md bg-lime-400/10 text-lime-400 border border-lime-400/30 font-mono font-bold text-xs">
                ${food.protein_g}g
              </span>
            </td>
            <td class="py-4 px-4 text-right">
              <button onclick="logFoodItem(${food.id}, '${food.name}')" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-cyan-400 border border-slate-700 text-xs font-semibold transition-all">
                + Add to Log
              </button>
            </td>
          </tr>
        `;
      }).join('');

      renderPaginationControls(pagination);
    } catch (err) {
      console.error('Failed to load foods:', err);
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-rose-400">Failed to load foods catalog: ${err.message}</td></tr>`;
    }
  }

  function renderPaginationControls(pagination) {
    const container = document.getElementById('food-pagination-container');
    if (!container) return;

    container.innerHTML = `
      <div class="flex items-center justify-between py-4 text-xs font-mono text-slate-400">
        <div>Showing Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)</div>
        <div class="flex items-center gap-2">
          <button ${pagination.page <= 1 ? 'disabled' : ''} onclick="changeFoodPage(${pagination.page - 1})" class="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white">Previous</button>
          <button ${pagination.page >= pagination.totalPages ? 'disabled' : ''} onclick="changeFoodPage(${pagination.page + 1})" class="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white">Next</button>
        </div>
      </div>
    `;
  }

  window.changeFoodPage = (newPage) => {
    currentFoodsPage = newPage;
    loadFoods();
  };

  window.logFoodItem = async (foodId, foodName) => {
    const mealType = prompt(`Add "${foodName}" to which meal?\n(breakfast / lunch / dinner / snack)`, 'lunch');
    if (!mealType) return;

    try {
      await API.logs.create(foodId, mealType.toLowerCase().trim(), 1.0);
      if (window.PT_APP && PT_APP.showToast) {
        PT_APP.showToast(`Logged "${foodName}" to ${mealType}!`);
      } else {
        alert(`Logged "${foodName}" to ${mealType}!`);
      }
    } catch (err) {
      alert(`Error logging food: ${err.message}`);
    }
  };

  // Search input debouncer
  let searchTimeout;
  if (searchInput) {
    searchInput.oninput = (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentSearch = e.target.value.trim();
        currentFoodsPage = 1;
        loadFoods();
      }, 300);
    };
  }

  // Category filter tabs
  document.querySelectorAll('[data-category-filter]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('[data-category-filter]').forEach(b => b.classList.remove('active', 'bg-cyan-500', 'text-slate-950'));
      btn.classList.add('active', 'bg-cyan-500', 'text-slate-950');
      currentCategory = btn.getAttribute('data-category-filter');
      currentFoodsPage = 1;
      loadFoods();
    };
  });

  loadFoods();
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
