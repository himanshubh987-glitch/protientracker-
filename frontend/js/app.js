/**
 * ProteinTrack Core Application Logic & State Controller
 * Manages cross-screen state, telemetry calculation, dynamic charts, authentication modal, and interaction
 */

// Default State Blueprint
const DEFAULT_STATE = {
  goalGrams: 165,
  currentGrams: 128,
  user: {
    name: "Alex Vance",
    email: "alex@athlete.com",
    loggedIn: true,
    goal: "bulk"
  },
  profile: {
    age: 28,
    gender: 'male',
    unitHeight: 'cm',
    heightCm: 180,
    unitWeight: 'kg',
    weightKg: 78,
    training: 'heavy', // sedentary, light, moderate, heavy, endurance, strength
    objective: 'bulk', // cut, maintain, bulk
    mealsPerDay: 4
  },
  meals: {
    breakfast: {
      title: "Breakfast",
      subtitle: "07:45 AM • Morning Recovery Matrix",
      items: [
        { id: "b1", name: "2 Large Pasture Eggs", cal: 140, carb: 1.2, fat: 9.8, protein: 12.6 },
        { id: "b2", name: "1 Cup Greek Yogurt 0%", cal: 130, carb: 6.0, fat: 0.2, protein: 18.0 },
        { id: "b3", name: "Oats with Organic Chia", cal: 210, carb: 32.0, fat: 4.5, protein: 8.0 }
      ]
    },
    lunch: {
      title: "Lunch",
      tag: "Peak Anabolic",
      subtitle: "01:15 PM • High Bioavailability",
      items: [
        { id: "l1", name: "Grilled Chicken Breast 200g", cal: 330, carb: 0, fat: 7.2, protein: 62.0 },
        { id: "l2", name: "Steamed Quinoa 150g", cal: 180, carb: 32.0, fat: 2.8, protein: 6.5 }
      ]
    },
    dinner: {
      title: "Dinner",
      tag: "Omega-Rich",
      subtitle: "07:30 PM • Slow Release Digestion",
      items: [
        { id: "d1", name: "Wild Salmon Fillet 150g", cal: 310, carb: 0, fat: 18.0, protein: 34.5 },
        { id: "d2", name: "Steamed Broccoli Florets", cal: 55, carb: 11.0, fat: 0.6, protein: 3.0 }
      ]
    },
    snacks: {
      title: "Snacks & Supplements",
      tag: "Post-Lift",
      subtitle: "04:30 PM • Rapid Uptake",
      items: [
        { id: "s1", name: "Whey Protein Shake (1 scoop)", cal: 120, carb: 2.0, fat: 1.0, protein: 25.0 },
        { id: "s2", name: "Roasted Almonds (20g)", cal: 115, carb: 4.0, fat: 10.0, protein: 4.0 }
      ]
    }
  },
  supplements: [
    { id: "creatine", name: "Creatine Monohydrate", dose: "5g · Taken at 08:00 AM", logged: true },
    { id: "whey-shaker", name: "Whey Isolate Shaker", dose: "25g protein · Post-workout", logged: true },
    { id: "zma", name: "Zinc & Magnesium (ZMA)", dose: "1 Dose · Scheduled 10:30 PM", logged: false }
  ],
  weeklyHistory: [
    { day: "Mon", grams: 172, status: "complete" },
    { day: "Tue", grams: 168, status: "complete" },
    { day: "Wed", grams: 165, status: "complete" },
    { day: "Thu", grams: 128, status: "today" },
    { day: "Fri", grams: 0, status: "upcoming" },
    { day: "Sat", grams: 0, status: "upcoming" },
    { day: "Sun", grams: 0, status: "upcoming" }
  ]
};

// Storage Helpers
function getAppState() {
  try {
    const raw = localStorage.getItem('proteintrack_state');
    if (!raw) {
      saveAppState(DEFAULT_STATE);
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    const state = JSON.parse(raw);
    if (!state.user) {
      state.user = { name: "Alex Vance", email: "alex@athlete.com", loggedIn: true, goal: "bulk" };
      saveAppState(state);
    }
    return state;
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function saveAppState(state) {
  try {
    localStorage.setItem('proteintrack_state', JSON.stringify(state));
  } catch (e) {
    console.error("Storage error:", e);
  }
}

// Toast System
function showToast(message, icon = "✓") {
  const existing = document.querySelector('.pt-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'pt-toast';
  toast.innerHTML = `
    <span class="flex items-center justify-center w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-sm border border-cyan-500/40">${icon}</span>
    <span class="text-slate-100 text-sm font-medium tracking-wide">${message}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

// Target Calculation Engine
function calculateProteinTarget(profile) {
  const weightKg = Number(profile.weightKg) || 78;
  
  let multiplier = 2.0;
  if (profile.training === 'sedentary') multiplier = 1.2;
  else if (profile.training === 'light') multiplier = 1.4;
  else if (profile.training === 'moderate') multiplier = 1.7;
  else if (profile.training === 'heavy') multiplier = 2.1;
  else if (profile.training === 'endurance') multiplier = 1.8;
  else if (profile.training === 'strength') multiplier = 2.3;

  if (profile.objective === 'cut') multiplier += 0.2;
  else if (profile.objective === 'bulk') multiplier += 0.0;
  else if (profile.objective === 'maintain') multiplier -= 0.1;

  multiplier = Math.round(multiplier * 100) / 100;
  const targetGrams = Math.round(weightKg * multiplier);
  const targetLbs = (multiplier / 2.20462).toFixed(2);

  const numMeals = Number(profile.mealsPerDay) || 4;
  const gramsPerMeal = (targetGrams / numMeals).toFixed(1);

  return {
    targetGrams,
    multiplier,
    targetLbs,
    gramsPerMeal,
    numMeals
  };
}

// Viewport Switcher Controller
function initViewportSwitcher() {
  const btns = document.querySelectorAll('[data-viewport-btn]');
  const container = document.querySelector('#viewport-container');
  if (!container || !btns.length) return;

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.viewportBtn;
      btns.forEach(b => {
        b.classList.remove('bg-cyan-500', 'text-slate-950', 'font-semibold');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('bg-cyan-500', 'text-slate-950', 'font-semibold');
      btn.classList.remove('text-slate-400');

      container.classList.remove('mode-desktop', 'mode-tablet', 'mode-mobile');
      container.classList.add(`mode-${mode}`);

      showToast(`Viewport set to ${mode.toUpperCase()} preview`);
    });
  });
}

// Mobile Menu Toggle
function initMobileMenu() {
  const toggleBtn = document.querySelector('#mobile-menu-btn');
  const menu = document.querySelector('#mobile-menu-drawer');
  if (!toggleBtn || !menu) return;

  toggleBtn.addEventListener('click', () => {
    menu.classList.toggle('hidden');
  });
}

// ==========================================
// AUTHENTICATION MODAL (LOGIN & SIGN UP)
// ==========================================

let currentAuthMode = 'login';
let selectedGoal = 'bulk';

function initAuthModal() {
  if (document.getElementById('pt-auth-modal')) return;

  const modalHtml = `
    <div id="pt-auth-modal" class="fixed inset-0 z-[10000] hidden items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-all duration-300">
      <div id="pt-auth-modal-card" class="relative w-full max-w-md bg-[#0C1222] border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-500/20 p-6 sm:p-8 text-slate-100 overflow-hidden transform scale-95 transition-transform duration-200">
        
        <!-- Glowing Top Bar -->
        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-500"></div>

        <!-- Close Button -->
        <button type="button" onclick="PT_APP.closeAuthModal()" class="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors" title="Close">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <!-- Brand & Badge -->
        <div class="flex items-center gap-2 mb-2">
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span id="auth-badge-label" class="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">ATHLETE SIGN IN</span>
        </div>

        <h3 id="auth-title" class="text-2xl font-extrabold text-white tracking-tight">Sign In to Cockpit</h3>
        <p id="auth-subtitle" class="text-xs text-slate-400 mt-1 mb-5 leading-relaxed">
          Access your personal bio-nutritional telemetry, DIAAS scoring, and logged meals.
        </p>

        <!-- Tab Toggle -->
        <div class="flex bg-slate-900 border border-slate-800 rounded-xl p-1 mb-6">
          <button type="button" id="auth-tab-login" onclick="PT_APP.switchAuthMode('login')" class="flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-cyan-400 text-slate-950 shadow">
            Sign In
          </button>
          <button type="button" id="auth-tab-signup" onclick="PT_APP.switchAuthMode('signup')" class="flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-400 hover:text-white">
            New Athlete Register
          </button>
        </div>

        <!-- SIGN UP FORM -->
        <form id="auth-signup-form" onsubmit="PT_APP.handleAuthSubmit(event, 'signup')" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Full Name / Alias</label>
            <input type="text" id="signup-name" required placeholder="e.g. Alex Vance" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-sm">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Email Address</label>
            <input type="email" id="signup-email" required placeholder="alex@athlete.com" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-sm">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Password</label>
            <div class="relative">
              <input type="password" id="signup-password" required placeholder="••••••••" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-sm pr-16">
              <button type="button" onclick="PT_APP.togglePasswordVisibility('signup-password')" class="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-cyan-400 font-mono">
                Show
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Primary Goal</label>
            <div class="grid grid-cols-3 gap-2">
              <button type="button" onclick="PT_APP.selectGoal(this, 'bulk')" class="auth-goal-btn px-2 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-xs font-semibold text-center transition-all">
                Hypertrophy
              </button>
              <button type="button" onclick="PT_APP.selectGoal(this, 'cut')" class="auth-goal-btn px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 text-xs font-semibold text-center transition-all hover:border-slate-500">
                Lean Cut
              </button>
              <button type="button" onclick="PT_APP.selectGoal(this, 'maintain')" class="auth-goal-btn px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 text-xs font-semibold text-center transition-all hover:border-slate-500">
                Maintenance
              </button>
            </div>
          </div>

          <button type="submit" id="signup-submit-btn" class="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-extrabold text-sm tracking-wide shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2">
            <span>Create Athlete Account</span>
            <span>→</span>
          </button>
        </form>

        <!-- LOG IN FORM -->
        <form id="auth-login-form" onsubmit="PT_APP.handleAuthSubmit(event, 'login')" class="space-y-4 hidden">
          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Email Address</label>
            <input type="email" id="login-email" required placeholder="alex@athlete.com" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-sm">
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
              <a href="#" onclick="PT_APP.showToast('Reset verification token sent to your email'); return false;" class="text-[11px] text-cyan-400 hover:underline">Forgot?</a>
            </div>
            <div class="relative">
              <input type="password" id="login-password" required placeholder="••••••••" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-sm pr-16">
              <button type="button" onclick="PT_APP.togglePasswordVisibility('login-password')" class="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-cyan-400 font-mono">
                Show
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" id="login-remember" checked class="rounded bg-slate-900 border-slate-700 text-cyan-400 focus:ring-0">
            <label for="login-remember">Remember this telemetry device</label>
          </div>

          <button type="submit" id="login-submit-btn" class="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-sm tracking-wide shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2">
            <span>Authenticate & Enter Cockpit</span>
            <span>→</span>
          </button>
        </form>

        <!-- QUICK DEMO GUEST ACCESS -->
        <div class="mt-5 pt-4 border-t border-slate-800">
          <button type="button" onclick="PT_APP.handleGuestLogin()" class="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-300 hover:text-white font-medium flex items-center justify-between transition-all group">
            <span class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>1-Click Demo: <strong>Alex Vance</strong> (165g Goal)</span>
            </span>
            <span class="text-cyan-400 group-hover:translate-x-1 transition-transform font-bold">Log In →</span>
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Backdrop close handler
  const modalEl = document.getElementById('pt-auth-modal');
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) {
      closeAuthModal();
    }
  });

  // Escape key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) {
      closeAuthModal();
    }
  });
}

function openAuthModal(mode = 'signup', prefillEmail = '') {
  initAuthModal();
  const modal = document.getElementById('pt-auth-modal');
  const card = document.getElementById('pt-auth-modal-card');
  if (!modal) return;

  switchAuthMode(mode);

  if (prefillEmail) {
    const signupEmail = document.getElementById('signup-email');
    const loginEmail = document.getElementById('login-email');
    if (signupEmail) signupEmail.value = prefillEmail;
    if (loginEmail) loginEmail.value = prefillEmail;
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    if (card) {
      card.classList.remove('scale-95');
      card.classList.add('scale-100');
    }
  }, 10);

  // Focus primary input
  setTimeout(() => {
    if (mode === 'signup') {
      const el = document.getElementById('signup-name');
      if (el) el.focus();
    } else {
      const el = document.getElementById('login-email');
      if (el) el.focus();
    }
  }, 100);
}

function closeAuthModal() {
  const modal = document.getElementById('pt-auth-modal');
  const card = document.getElementById('pt-auth-modal-card');
  if (!modal) return;

  if (card) {
    card.classList.remove('scale-100');
    card.classList.add('scale-95');
  }

  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 150);
}

function switchAuthMode(mode) {
  currentAuthMode = mode;
  const tabSignup = document.getElementById('auth-tab-signup');
  const tabLogin = document.getElementById('auth-tab-login');
  const formSignup = document.getElementById('auth-signup-form');
  const formLogin = document.getElementById('auth-login-form');
  const title = document.getElementById('auth-title');
  const subtitle = document.getElementById('auth-subtitle');
  const badge = document.getElementById('auth-badge-label');

  if (mode === 'signup') {
    tabSignup.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-cyan-400 text-slate-950 shadow";
    tabLogin.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-400 hover:text-white";
    formSignup.classList.remove('hidden');
    formLogin.classList.add('hidden');
    if (title) title.textContent = "Create Athlete Account";
    if (subtitle) subtitle.textContent = "Access real-time DIAAS protein scoring, macro telemetry, and custom metabolic plans.";
    if (badge) badge.textContent = "NEW ATHLETE REGISTRATION";
  } else {
    tabSignup.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-400 hover:text-white";
    tabLogin.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-cyan-400 text-slate-950 shadow";
    formSignup.classList.add('hidden');
    formLogin.classList.remove('hidden');
    if (title) title.textContent = "Athlete Telemetry Login";
    if (subtitle) subtitle.textContent = "Authenticate your bio-cockpit credentials to resume tracking.";
    if (badge) badge.textContent = "ATHLETE AUTHENTICATION";
  }
}

function selectGoal(btn, goal) {
  selectedGoal = goal;
  document.querySelectorAll('.auth-goal-btn').forEach(b => {
    b.className = "auth-goal-btn px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 text-xs font-semibold text-center transition-all hover:border-slate-500";
  });
  btn.className = "auth-goal-btn px-2 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-xs font-semibold text-center transition-all";
}

function togglePasswordVisibility(fieldId) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  const btn = event.target;
  if (btn) btn.textContent = isPass ? 'Hide' : 'Show';
}

function handleAuthSubmit(e, mode) {
  e.preventDefault();
  
  let name = "Alex Vance";
  let email = "alex@athlete.com";
  const state = getAppState();

  if (mode === 'signup') {
    name = document.getElementById('signup-name').value.trim() || "Alex Vance";
    email = document.getElementById('signup-email').value.trim() || "alex@athlete.com";
    state.profile.objective = selectedGoal;
  } else {
    email = document.getElementById('login-email').value.trim() || "alex@athlete.com";
    name = email.split('@')[0];
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  // Show authenticating button state
  const submitBtn = mode === 'signup' ? document.getElementById('signup-submit-btn') : document.getElementById('login-submit-btn');
  const originalHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
      <span>Authenticating Biometrics...</span>
    `;
  }

  state.user = {
    name: name,
    email: email,
    loggedIn: true,
    goal: selectedGoal
  };
  saveAppState(state);

  setTimeout(() => {
    closeAuthModal();
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }

    showToast(`Welcome, ${name}! Bio-cockpit verified.`);

    // If currently not on dashboard, redirect to dashboard.html
    if (!window.location.pathname.endsWith('dashboard.html')) {
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
    } else {
      // If already on dashboard, trigger re-render
      if (typeof window.renderDashboard === 'function') {
        window.renderDashboard();
      }
    }
  }, 600);
}

function handleGuestLogin() {
  const state = getAppState();
  state.user = {
    name: "Alex Vance",
    email: "alex@athlete.com",
    loggedIn: true,
    goal: "bulk"
  };
  saveAppState(state);

  closeAuthModal();
  showToast("Demo Athlete verified! Opening Cockpit...");

  if (!window.location.pathname.endsWith('dashboard.html')) {
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 600);
  } else {
    if (typeof window.renderDashboard === 'function') {
      window.renderDashboard();
    }
  }
}

function handleLogout() {
  const state = getAppState();
  state.user.loggedIn = false;
  saveAppState(state);
  showToast("Logged out of telemetry session.");
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 500);
}

// ==========================================
// LIGHT / DARK MODE THEME CONTROLLER
// ==========================================

function initTheme() {
  const savedTheme = localStorage.getItem('proteintrack_theme') || 'dark';
  applyTheme(savedTheme, false);
}

function applyTheme(theme, notify = true) {
  const isLight = (theme === 'light');
  if (isLight) {
    document.documentElement.classList.add('light-theme');
    document.body.classList.add('light-theme');
  } else {
    document.documentElement.classList.remove('light-theme');
    document.body.classList.remove('light-theme');
  }
  localStorage.setItem('proteintrack_theme', isLight ? 'light' : 'dark');
  updateThemeIcons(isLight);
  if (notify) {
    showToast(isLight ? 'Light mode enabled' : 'Dark mode enabled');
  }
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light-theme');
  applyTheme(isLight ? 'dark' : 'light', true);
}

function updateThemeIcons(isLight) {
  document.querySelectorAll('.theme-icon').forEach(icon => {
    icon.setAttribute('data-lucide', isLight ? 'sun' : 'moon');
  });
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Global Click Delegation to catch ANY Sign In or Sign Up button
function initGlobalAuthTriggers() {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('a, button');
    if (!trigger) return;

    // Skip if element is inside the auth modal itself
    if (trigger.closest('#pt-auth-modal')) return;

    const explicit = trigger.getAttribute('data-auth-trigger');
    const text = (trigger.textContent || '').trim().toLowerCase();
    const href = (trigger.getAttribute('href') || '').toLowerCase();

    if (explicit === 'signin' || explicit === 'login' || text === 'sign in' || text.startsWith('sign in') || text === 'log in' || href === '#signin') {
      e.preventDefault();
      openAuthModal('login');
    } else if (explicit === 'signup' || text === 'sign up' || text.startsWith('sign up') || text === 'get started free' || href === '#signup') {
      e.preventDefault();
      openAuthModal('signup');
    }
  });
}

// Export global helpers
window.PT_APP = {
  getAppState,
  saveAppState,
  showToast,
  calculateProteinTarget,
  initViewportSwitcher,
  initMobileMenu,
  initAuthModal,
  openAuthModal,
  closeAuthModal,
  switchAuthMode,
  selectGoal,
  togglePasswordVisibility,
  handleAuthSubmit,
  handleGuestLogin,
  handleLogout,
  initTheme,
  applyTheme,
  toggleTheme
};

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  initAuthModal();
  initGlobalAuthTriggers();
});
