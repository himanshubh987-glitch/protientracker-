/**
 * seed.js: Idempotent database seeder for ProteinTrack
 * Seeds verified foods, supplements, testimonials, FAQs, and a 30-day demo athlete
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getDb } = require('../connection');

function seedDatabase(dbInstance = null) {
  const db = dbInstance || getDb();

  console.log('--- Starting ProteinTrack Database Seeding ---');

  // Load JSON datasets
  const foods = JSON.parse(fs.readFileSync(path.join(__dirname, 'foods.json'), 'utf8'));
  const supplements = JSON.parse(fs.readFileSync(path.join(__dirname, 'supplements.json'), 'utf8'));
  const testimonials = JSON.parse(fs.readFileSync(path.join(__dirname, 'testimonials.json'), 'utf8'));
  const faqs = JSON.parse(fs.readFileSync(path.join(__dirname, 'faqs.json'), 'utf8'));

  const seedTransaction = db.transaction(() => {
    // 1. Seed Foods (Idempotent: skip existing by name)
    const checkFoodStmt = db.prepare('SELECT id FROM foods WHERE name = ?');
    const insertFoodStmt = db.prepare(`
      INSERT INTO foods (name, category, serving_label, serving_g, calories, protein_g, carbs_g, fat_g, protein_density, is_custom)
      VALUES (@name, @category, @serving_label, @serving_g, @calories, @protein_g, @carbs_g, @fat_g, @protein_density, 0)
    `);

    let foodsAdded = 0;
    for (const food of foods) {
      if (!checkFoodStmt.get(food.name)) {
        insertFoodStmt.run(food);
        foodsAdded++;
      }
    }
    console.log(`✓ Foods seeded: ${foodsAdded} added (${foods.length} total verified foods)`);

    // 2. Seed Supplements (Idempotent: skip existing by name)
    const checkSupStmt = db.prepare('SELECT id FROM supplements WHERE name = ?');
    const insertSupStmt = db.prepare(`
      INSERT INTO supplements (name, type, serving_label, protein_g, notes)
      VALUES (@name, @type, @serving_label, @protein_g, @notes)
    `);

    let supsAdded = 0;
    for (const sup of supplements) {
      if (!checkSupStmt.get(sup.name)) {
        insertSupStmt.run(sup);
        supsAdded++;
      }
    }
    console.log(`✓ Supplements seeded: ${supsAdded} added (${supplements.length} total supplements)`);

    // 3. Seed Testimonials (Idempotent)
    const checkTestimonialStmt = db.prepare('SELECT id FROM testimonials WHERE author_name = ?');
    const insertTestimonialStmt = db.prepare(`
      INSERT INTO testimonials (author_name, author_role, quote, rating, is_featured)
      VALUES (@author_name, @author_role, @quote, @rating, @is_featured)
    `);

    let testimonialsAdded = 0;
    for (const t of testimonials) {
      if (!checkTestimonialStmt.get(t.author_name)) {
        insertTestimonialStmt.run(t);
        testimonialsAdded++;
      }
    }
    console.log(`✓ Testimonials seeded: ${testimonialsAdded} added`);

    // 4. Seed FAQs (Idempotent)
    const checkFaqStmt = db.prepare('SELECT id FROM faqs WHERE question = ?');
    const insertFaqStmt = db.prepare(`
      INSERT INTO faqs (question, answer, sort_order)
      VALUES (@question, @answer, @sort_order)
    `);

    let faqsAdded = 0;
    for (const f of faqs) {
      if (!checkFaqStmt.get(f.question)) {
        insertFaqStmt.run(f);
        faqsAdded++;
      }
    }
    console.log(`✓ FAQs seeded: ${faqsAdded} added`);

    // 5. Seed Demo User: Alex Vance (alex@athlete.com / password123)
    const demoEmail = 'alex@athlete.com';
    let demoUser = db.prepare('SELECT * FROM users WHERE email = ?').get(demoEmail);

    if (!demoUser) {
      const passwordHash = bcrypt.hashSync('password123', 10);
      const userRes = db.prepare(`
        INSERT INTO users (
          name, email, password_hash, age, sex, height_cm, weight_kg,
          activity_level, training_type, goal, daily_protein_target_g,
          meals_per_day, timezone
        ) VALUES (
          'Alex Vance', 'alex@athlete.com', ?, 28, 'male', 180.0, 78.0,
          'very_active', 'hypertrophy', 'bulk', 165.0, 4, 'UTC'
        )
      `).run(passwordHash);

      demoUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userRes.lastInsertRowid);
      console.log(`✓ Created demo user: ${demoUser.name} (${demoUser.email})`);
    } else {
      console.log(`- Demo user already exists: ${demoUser.name} (${demoUser.email})`);
    }

    const userId = demoUser.id;

    // 6. Connect User Supplements
    const allSupplements = db.prepare('SELECT id, name, protein_g FROM supplements').all();
    const insertUserSupStmt = db.prepare(`
      INSERT OR IGNORE INTO user_supplements (user_id, supplement_id, is_active, default_servings)
      VALUES (?, ?, 1, 1.0)
    `);

    for (const sup of allSupplements) {
      insertUserSupStmt.run(userId, sup.id);
    }

    // 7. Seed 30 Days of Logs for Demo User (Idempotent: check if logs exist)
    const existingLogsCount = db.prepare('SELECT COUNT(*) AS cnt FROM food_logs WHERE user_id = ?').get(userId).cnt;

    if (existingLogsCount === 0) {
      console.log('Generating 30 days of historical nutrition telemetry for demo user...');
      const allFoods = db.prepare('SELECT * FROM foods').all();

      const chicken = allFoods.find(f => f.name.includes('Chicken Breast')) || allFoods[0];
      const eggs = allFoods.find(f => f.name.includes('Whole Egg')) || allFoods[1];
      const greekYogurt = allFoods.find(f => f.name.includes('Greek Yogurt')) || allFoods[2];
      const salmon = allFoods.find(f => f.name.includes('Salmon')) || allFoods[3];
      const oats = allFoods.find(f => f.name.includes('Oats')) || allFoods[4];
      const whey = allFoods.find(f => f.name.includes('Whey Protein')) || allFoods[5];
      const beef = allFoods.find(f => f.name.includes('Beef')) || allFoods[6];
      const rice = allFoods.find(f => f.name.includes('Rice')) || allFoods[7];

      const insertFoodLogStmt = db.prepare(`
        INSERT INTO food_logs (user_id, food_id, meal_type, quantity, protein_g, calories, logged_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const insertSupLogStmt = db.prepare(`
        INSERT INTO supplement_logs (user_id, supplement_id, servings, protein_g, taken_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      const now = new Date();

      // Generate 30 consecutive days (day 29 down to 0)
      for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
        const dateObj = new Date(now);
        dateObj.setUTCDate(dateObj.getUTCDate() - dayOffset);
        const ymd = dateObj.toISOString().split('T')[0];

        // Breakfast (07:30 UTC)
        const bTime = `${ymd}T07:30:00.000Z`;
        insertFoodLogStmt.run(userId, eggs.id, 'breakfast', 3.0, Number((eggs.protein_g * 3.0).toFixed(1)), Number((eggs.calories * 3.0).toFixed(1)), bTime);
        insertFoodLogStmt.run(userId, greekYogurt.id, 'breakfast', 1.0, greekYogurt.protein_g, greekYogurt.calories, bTime);
        insertFoodLogStmt.run(userId, oats.id, 'breakfast', 1.5, Number((oats.protein_g * 1.5).toFixed(1)), Number((oats.calories * 1.5).toFixed(1)), bTime);

        // Lunch (12:45 UTC)
        const lTime = `${ymd}T12:45:00.000Z`;
        insertFoodLogStmt.run(userId, chicken.id, 'lunch', 1.8, Number((chicken.protein_g * 1.8).toFixed(1)), Number((chicken.calories * 1.8).toFixed(1)), lTime);
        insertFoodLogStmt.run(userId, rice.id, 'lunch', 1.5, Number((rice.protein_g * 1.5).toFixed(1)), Number((rice.calories * 1.5).toFixed(1)), lTime);

        // Snack / Post-Lift (16:30 UTC)
        const sTime = `${ymd}T16:30:00.000Z`;
        insertFoodLogStmt.run(userId, whey.id, 'snack', 1.0, whey.protein_g, whey.calories, sTime);

        // Dinner (19:30 UTC)
        const dTime = `${ymd}T19:30:00.000Z`;
        const dinnerFood = dayOffset % 2 === 0 ? salmon : beef;
        insertFoodLogStmt.run(userId, dinnerFood.id, 'dinner', 1.5, Number((dinnerFood.protein_g * 1.5).toFixed(1)), Number((dinnerFood.calories * 1.5).toFixed(1)), dTime);

        // Supplement logs
        const creatine = allSupplements.find(s => s.name.includes('Creatine'));
        const wheySup = allSupplements.find(s => s.name.includes('Whey'));
        if (creatine) insertSupLogStmt.run(userId, creatine.id, 1.0, creatine.protein_g, bTime);
        if (wheySup) insertSupLogStmt.run(userId, wheySup.id, 1.0, wheySup.protein_g, sTime);
      }
      console.log('✓ Successfully seeded 30 days of food and supplement logs for demo user!');
    } else {
      console.log(`- Demo user already has ${existingLogsCount} logs. Skipping log re-generation.`);
    }

    // 8. Seed sample newsletter subscriber
    db.prepare(`
      INSERT OR IGNORE INTO newsletter_subscribers (email, source)
      VALUES ('alex@athlete.com', 'hero'), ('coach.dan@telemetry.io', 'footer')
    `).run();
  });

  seedTransaction();
  console.log('--- Database Seeding Completed Successfully ---');
}

// Allow direct CLI execution
if (require.main === module) {
  try {
    seedDatabase();
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

module.exports = { seedDatabase };
