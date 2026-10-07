/**
 * tests/database.test.js: Comprehensive test suite for ProteinTrack database layer
 * Verifies migrations, constraints, queries, snapshots, timezones, streaks, and cascades
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { createConnection, closeDb } = require('../db/connection');
const { runMigrations } = require('../db/migrate');
const { seedDatabase } = require('../db/seeds/seed');

const { users, foods, logs, supplements, dashboard, newsletter, home } = require('../db/queries');

const TEST_DB_FILE = 'test_database.db';

describe('ProteinTrack Database Layer Verification', () => {
  let db;

  before(() => {
    // Clean up any old test database files
    ['test_database.db', 'test_database.db-wal', 'test_database.db-shm'].forEach(f => {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
    });

    db = createConnection(TEST_DB_FILE);
  });

  after(() => {
    closeDb(db);
    ['test_database.db', 'test_database.db-wal', 'test_database.db-shm'].forEach(f => {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
    });
  });

  // =========================================================================
  // 1. MIGRATIONS & IDEMPOTENCY
  // =========================================================================
  describe('1. Migrations & Schema Initialization', () => {
    it('applies all migrations cleanly on a fresh database', () => {
      const applied = runMigrations(db);
      assert.strictEqual(applied, 3, 'Expected 3 migrations applied on fresh DB');

      // Check schema_migrations table
      const rows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all();
      assert.deepStrictEqual(
        rows.map(r => r.version),
        ['001_init.sql', '002_indexes.sql', '003_views.sql']
      );
    });

    it('is completely re-runnable without errors (idempotent)', () => {
      const appliedAgain = runMigrations(db);
      assert.strictEqual(appliedAgain, 0, 'Re-running migrations should apply 0 additional files');
    });

    it('creates all expected tables and views', () => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')").all().map(r => r.name);
      
      const expected = [
        'schema_migrations',
        'users',
        'foods',
        'food_logs',
        'supplements',
        'user_supplements',
        'supplement_logs',
        'newsletter_subscribers',
        'testimonials',
        'faqs',
        'v_daily_totals',
        'v_streaks',
        'v_home_stats'
      ];

      for (const name of expected) {
        assert.ok(tables.includes(name), `Missing table or view: ${name}`);
      }
    });
  });

  // =========================================================================
  // 2. CONSTRAINTS & DATA INTEGRITY
  // =========================================================================
  describe('2. Constraints & Referential Integrity', () => {
    it('rejects an invalid goal (CHECK constraint)', () => {
      assert.throws(() => {
        users.create({
          name: 'Invalid Goal User',
          email: 'invalid.goal@test.com',
          password: 'pass',
          goal: 'super_bulk' // Not in ('cut', 'maintain', 'bulk')
        }, db);
      }, /CHECK constraint failed/i);
    });

    it('rejects an invalid sex value (CHECK constraint)', () => {
      assert.throws(() => {
        users.create({
          name: 'Invalid Sex User',
          email: 'invalid.sex@test.com',
          password: 'pass',
          sex: 'robot'
        }, db);
      }, /CHECK constraint failed/i);
    });

    it('rejects a duplicate user email (UNIQUE constraint)', () => {
      users.create({
        name: 'First User',
        email: 'duplicate@test.com',
        password: 'pass',
        goal: 'bulk'
      }, db);

      assert.throws(() => {
        users.create({
          name: 'Second User',
          email: 'duplicate@test.com', // Duplicate email
          password: 'pass2',
          goal: 'cut'
        }, db);
      }, /UNIQUE constraint failed/i);
    });

    it('rejects negative quantity in food_logs (CHECK constraint)', () => {
      const u = users.create({
        name: 'Log User',
        email: 'log.user@test.com',
        password: 'pass'
      }, db);

      const f = foods.createCustom({
        name: 'Test Protein Bar',
        serving_label: '1 bar',
        serving_g: 60,
        calories: 200,
        protein_g: 20
      }, db);

      assert.throws(() => {
        logs.addFood({
          user_id: u.id,
          food_id: f.id,
          quantity: -1.5, // Negative quantity
          meal_type: 'snack'
        }, db);
      }, /CHECK constraint failed/i);
    });
  });

  // =========================================================================
  // 3. SEEDING & CATALOG SEARCH
  // =========================================================================
  describe('3. Seeding & Food Catalog Operations', () => {
    before(() => {
      seedDatabase(db);
    });

    it('seeds 60+ verified foods across multiple categories', () => {
      const totalFoods = db.prepare('SELECT COUNT(*) AS c FROM foods').get().c;
      assert.ok(totalFoods >= 60, `Expected at least 60 foods, found ${totalFoods}`);

      const categories = db.prepare('SELECT DISTINCT category FROM foods').all().map(r => r.category);
      assert.ok(categories.includes('meat'));
      assert.ok(categories.includes('fish'));
      assert.ok(categories.includes('dairy'));
      assert.ok(categories.includes('eggs'));
      assert.ok(categories.includes('legumes'));
      assert.ok(categories.includes('grains'));
      assert.ok(categories.includes('nuts'));
      assert.ok(categories.includes('plant_protein'));
    });

    it('seeds 10+ supplements, 5 testimonials, and 6 FAQs', () => {
      const totalSups = db.prepare('SELECT COUNT(*) AS c FROM supplements').get().c;
      assert.ok(totalSups >= 10, `Expected >= 10 supplements, got ${totalSups}`);

      const totalTestimonials = db.prepare('SELECT COUNT(*) AS c FROM testimonials').get().c;
      assert.strictEqual(totalTestimonials, 5);

      const totalFaqs = db.prepare('SELECT COUNT(*) AS c FROM faqs').get().c;
      assert.strictEqual(totalFaqs, 6);
    });

    it('correctly filters, sorts, and paginates food searches', () => {
      // 1. Keyword search
      const salmonSearch = foods.search({ q: 'salmon' }, db);
      assert.ok(salmonSearch.rows.length > 0);
      assert.ok(salmonSearch.rows[0].name.toLowerCase().includes('salmon'));

      // 2. Category filter
      const meatOnly = foods.search({ category: 'meat' }, db);
      assert.ok(meatOnly.rows.length > 0);
      for (const row of meatOnly.rows) {
        assert.strictEqual(row.category, 'meat');
      }

      // 3. Sort descending by protein
      const sortedByProtein = foods.search({ sort: 'protein_g', order: 'desc', limit: 5 }, db);
      for (let i = 0; i < sortedByProtein.rows.length - 1; i++) {
        assert.ok(
          sortedByProtein.rows[i].protein_g >= sortedByProtein.rows[i + 1].protein_g,
          'Items should be in descending order of protein_g'
        );
      }

      // 4. Pagination
      const page1 = foods.search({ limit: 4, page: 1 }, db);
      const page2 = foods.search({ limit: 4, page: 2 }, db);
      assert.strictEqual(page1.rows.length, 4);
      assert.strictEqual(page2.rows.length, 4);
      assert.notStrictEqual(page1.rows[0].id, page2.rows[0].id);
      assert.ok(page1.total > 50);
    });

    it('allows creation of custom foods with computed protein density', () => {
      const custom = foods.createCustom({
        name: 'Homemade High-Protein Flapjacks',
        category: 'grains',
        serving_label: '2 pancakes',
        serving_g: 150,
        calories: 300,
        protein_g: 30, // 30 * 4 / 300 * 100 = 40%
        carbs_g: 35,
        fat_g: 5
      }, db);

      assert.ok(custom.id > 0);
      assert.strictEqual(custom.is_custom, 1);
      assert.strictEqual(custom.protein_density, 40.0);
    });
  });

  // =========================================================================
  // 4. SNAPSHOT INTEGRITY (PAST LOGS NEVER MUTATE)
  // =========================================================================
  describe('4. Historical Snapshot Integrity', () => {
    it('permanently preserves logged protein and calories when a food is later modified', () => {
      const u = users.create({
        name: 'Snapshot Athlete',
        email: 'snapshot@athlete.com',
        password: 'pass'
      }, db);

      // Create a specific food
      const mutableFood = foods.createCustom({
        name: 'Dynamic Whey Batch A',
        category: 'supplements',
        serving_label: '1 scoop',
        serving_g: 30,
        calories: 120,
        protein_g: 25.0
      }, db);

      // Log the food with quantity 2 (expected: 50.0g protein, 240.0 calories)
      const logEntry = logs.addFood({
        user_id: u.id,
        food_id: mutableFood.id,
        meal_type: 'lunch',
        quantity: 2.0
      }, db);

      assert.strictEqual(logEntry.protein_g, 50.0);
      assert.strictEqual(logEntry.calories, 240.0);

      // Now dramatically alter the food item's recipe in the database
      db.prepare('UPDATE foods SET protein_g = 99.0, calories = 999.0 WHERE id = ?').run(mutableFood.id);

      // Verify the food row updated
      const updatedFood = foods.getById(mutableFood.id, db);
      assert.strictEqual(updatedFood.protein_g, 99.0);

      // Query the historical log: MUST REMAIN UNCHANGED (50.0g protein, 240.0 calories)
      const historicalLog = db.prepare('SELECT * FROM food_logs WHERE id = ?').get(logEntry.id);
      assert.strictEqual(historicalLog.protein_g, 50.0, 'Historical log protein_g was unexpectedly mutated!');
      assert.strictEqual(historicalLog.calories, 240.0, 'Historical log calories was unexpectedly mutated!');
    });
  });

  // =========================================================================
  // 5. DASHBOARD, STREAKS, AND TIMEZONE DAY BOUNDARIES
  // =========================================================================
  describe('5. Dashboard Analytics, Streaks & Timezones', () => {
    it('calculates totals, percentage, remaining, and grouping accurately on known fixtures', () => {
      const u = users.create({
        name: 'Target Tester',
        email: 'target.tester@athlete.com',
        password: 'pass',
        weight_kg: 80,
        daily_protein_target_g: 160.0 // Known target: 160g
      }, db);

      const f1 = foods.createCustom({ name: 'Egg Whites', serving_label: '100g', serving_g: 100, calories: 50, protein_g: 10 }, db);
      const f2 = foods.createCustom({ name: 'Chicken', serving_label: '100g', serving_g: 100, calories: 160, protein_g: 30 }, db);

      const testDate = '2026-05-15';

      // Breakfast: 4 * 10g = 40g
      logs.addFood({
        user_id: u.id, food_id: f1.id, meal_type: 'breakfast', quantity: 4.0, logged_at: `${testDate}T08:00:00.000Z`
      }, db);

      // Lunch: 2.5 * 30g = 75g
      logs.addFood({
        user_id: u.id, food_id: f2.id, meal_type: 'lunch', quantity: 2.5, logged_at: `${testDate}T13:00:00.000Z`
      }, db);

      // Total logged: 40 + 75 = 115g
      const dash = dashboard.getDashboard(u.id, testDate, 'UTC', db);

      assert.strictEqual(dash.target, 160.0);
      assert.strictEqual(dash.consumed, 115.0);
      assert.strictEqual(dash.remaining, 45.0); // 160 - 115 = 45g
      assert.strictEqual(dash.percent, 71.9);    // (115 / 160) * 100 = 71.875% -> 71.9%

      // Check meal grouping
      assert.strictEqual(dash.meals_timeline.breakfast.length, 1);
      assert.strictEqual(dash.meals_timeline.lunch.length, 1);
      assert.strictEqual(dash.meals_timeline.dinner.length, 0);
    });

    it('correctly calculates consecutive streaks based on the 90% intake rule', () => {
      const u = users.create({
        name: 'Streak King',
        email: 'streak.king@athlete.com',
        password: 'pass',
        daily_protein_target_g: 100.0 // 90% threshold = 90.0g
      }, db);

      const f = foods.createCustom({ name: 'Protein Bar', serving_label: '1 bar', serving_g: 50, calories: 150, protein_g: 50 }, db);

      // Day 1 (2026-06-01): 95g (Hit goal >= 90g)
      logs.addFood({ user_id: u.id, food_id: f.id, quantity: 1.9, logged_at: '2026-06-01T12:00:00.000Z' }, db);

      // Day 2 (2026-06-02): 100g (Hit goal)
      logs.addFood({ user_id: u.id, food_id: f.id, quantity: 2.0, logged_at: '2026-06-02T12:00:00.000Z' }, db);

      // Day 3 (2026-06-03): 90g (Hit goal >= 90g)
      logs.addFood({ user_id: u.id, food_id: f.id, quantity: 1.8, logged_at: '2026-06-03T12:00:00.000Z' }, db);

      // Streak on 2026-06-03 should be exactly 3
      const streak3 = dashboard.calculateStreak(u.id, 100.0, '2026-06-03', 'UTC', db);
      assert.strictEqual(streak3, 3);

      // Day 4 (2026-06-04): 40g (Missed goal < 90g)
      logs.addFood({ user_id: u.id, food_id: f.id, quantity: 0.8, logged_at: '2026-06-04T12:00:00.000Z' }, db);

      // Day 5 (2026-06-05): 100g (Hit goal)
      logs.addFood({ user_id: u.id, food_id: f.id, quantity: 2.0, logged_at: '2026-06-05T12:00:00.000Z' }, db);

      // Streak on 2026-06-05 should be 1 (since day 4 broke the sequence)
      const streakAfterBreak = dashboard.calculateStreak(u.id, 100.0, '2026-06-05', 'UTC', db);
      assert.strictEqual(streakAfterBreak, 1);
    });

    it('respects timezone day boundaries for intake allocation', () => {
      const u = users.create({
        name: 'Timezone Traveler',
        email: 'tz.traveler@athlete.com',
        password: 'pass',
        timezone: 'Asia/Tokyo' // UTC+9
      }, db);

      const f = foods.createCustom({ name: 'Shoyu Chicken', serving_label: '1 serving', serving_g: 100, calories: 150, protein_g: 30 }, db);

      // 2026-07-10 at 22:30:00 UTC.
      // In Tokyo (UTC+9), this is 2026-07-11 at 07:30:00 AM (Next Day morning!)
      const timestamp = '2026-07-10T22:30:00.000Z';

      logs.addFood({
        user_id: u.id,
        food_id: f.id,
        meal_type: 'breakfast',
        quantity: 1.0,
        logged_at: timestamp
      }, db);

      // Querying with UTC sees it on 2026-07-10
      const utcLogs = logs.getByDate(u.id, '2026-07-10', 'UTC', db);
      assert.strictEqual(utcLogs.breakfast.length, 1);

      // Querying with Asia/Tokyo sees it correctly on 2026-07-11!
      const tokyoLogsJuly10 = logs.getByDate(u.id, '2026-07-10', 'Asia/Tokyo', db);
      assert.strictEqual(tokyoLogsJuly10.breakfast.length, 0);

      const tokyoLogsJuly11 = logs.getByDate(u.id, '2026-07-11', 'Asia/Tokyo', db);
      assert.strictEqual(tokyoLogsJuly11.breakfast.length, 1);
      assert.strictEqual(tokyoLogsJuly11.breakfast[0].food_name, 'Shoyu Chicken');
    });
  });

  // =========================================================================
  // 6. NEWSLETTER & DE-DUPLICATION
  // =========================================================================
  describe('6. Newsletter Subscription De-Duplication', () => {
    it('subscribes a new email and handles duplicate cleanly', () => {
      const email = 'athlete.dispatch@test.com';

      // First subscription
      const res1 = newsletter.subscribe(email, 'hero', db);
      assert.strictEqual(res1.status, 'subscribed');
      assert.ok(res1.subscriber.id > 0);

      // Second duplicate subscription
      const res2 = newsletter.subscribe(email, 'footer', db);
      assert.strictEqual(res2.status, 'already_subscribed');
      assert.strictEqual(res2.subscriber.id, res1.subscriber.id);
    });
  });

  // =========================================================================
  // 7. CASCADE DELETION
  // =========================================================================
  describe('7. Referential Integrity & Cascade Deletes', () => {
    it('deleting a user cascades and deletes all their food and supplement logs', () => {
      const u = users.create({
        name: 'Cascade Target',
        email: 'cascade.target@athlete.com',
        password: 'pass'
      }, db);

      const f = foods.createCustom({ name: 'Bar', serving_label: '1', serving_g: 50, calories: 100, protein_g: 20 }, db);
      const sup = db.prepare('SELECT id FROM supplements LIMIT 1').get();

      // Add a food log
      const fLog = logs.addFood({ user_id: u.id, food_id: f.id, meal_type: 'lunch', quantity: 1 }, db);
      // Add a supplement log
      const sLog = supplements.logIntake(u.id, sup.id, 1, db);
      // Add user supplement toggle
      supplements.toggleForUser(u.id, sup.id, true, 1, db);

      // Verify they exist
      assert.ok(db.prepare('SELECT id FROM food_logs WHERE id = ?').get(fLog.id));
      assert.ok(db.prepare('SELECT id FROM supplement_logs WHERE id = ?').get(sLog.id));

      // Delete the user
      db.prepare('DELETE FROM users WHERE id = ?').run(u.id);

      // Verify cascade
      const remainingFoodLogs = db.prepare('SELECT id FROM food_logs WHERE id = ?').get(fLog.id);
      const remainingSupLogs = db.prepare('SELECT id FROM supplement_logs WHERE id = ?').get(sLog.id);
      const remainingUserSups = db.prepare('SELECT * FROM user_supplements WHERE user_id = ?').all(u.id);

      assert.strictEqual(remainingFoodLogs, undefined, 'food_logs should be deleted by CASCADE');
      assert.strictEqual(remainingSupLogs, undefined, 'supplement_logs should be deleted by CASCADE');
      assert.strictEqual(remainingUserSups.length, 0, 'user_supplements should be deleted by CASCADE');
    });
  });

  // =========================================================================
  // 8. PROFILE UPDATE & AUTOMATIC TARGET RECALIBRATION
  // =========================================================================
  describe('8. Profile Update & Scientific Target Recalibration', () => {
    it('automatically recalculates target protein when body stats or goals change', () => {
      const u = users.create({
        name: 'Recalibrate User',
        email: 'recalibrate@athlete.com',
        password: 'pass',
        weight_kg: 70.0,
        goal: 'maintain',
        training_type: 'hypertrophy',
        activity_level: 'light'
      }, db);

      const initialTarget = u.daily_protein_target_g;

      // Update goal to 'cut' (requires higher protein sparing) and weight to 80kg
      const updated = users.updateProfile(u.id, {
        weight_kg: 80.0,
        goal: 'cut'
      }, db);

      assert.ok(updated.daily_protein_target_g > initialTarget, 'Target should increase for cut at 80kg');
      assert.strictEqual(updated.weight_kg, 80.0);
      assert.strictEqual(updated.goal, 'cut');
    });
  });
});
