const bcrypt = require('bcryptjs');
const db = require('./database');
const runMigrations = require('./migrate');

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  // Ensure tables exist first
  runMigrations();

  const conn = db.getRawConnection();

  // 1. Seed Demo User
  const demoEmail = 'alex@athlete.com';
  const existingUser = conn.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail);

  let userId;
  if (!existingUser) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('password123', salt);

    const insertUser = conn.prepare(`
      INSERT INTO users (
        name, email, password_hash, age, sex, height_cm, weight_kg,
        activity_level, training_type, goal, daily_protein_target_g,
        meals_per_day, timezone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertUser.run(
      'Alex Vance',
      demoEmail,
      passwordHash,
      28,
      'male',
      180,
      78,
      'heavy',
      'hypertrophy',
      'bulk',
      165,
      4,
      'America/New_York'
    );
    userId = Number(result.lastInsertRowid);
    console.log(`👤 Created demo athlete: Alex Vance (${demoEmail})`);
  } else {
    userId = existingUser.id;
    console.log(`👤 Demo athlete already exists (ID: ${userId})`);
  }

  // 2. Seed 60+ Common Foods across 8 categories
  const foodsCount = conn.prepare('SELECT COUNT(*) as count FROM foods').get().count;
  if (foodsCount < 60) {
    console.log('🥩 Seeding 60+ verified foods dataset...');
    const insertFood = conn.prepare(`
      INSERT INTO foods (name, category, serving_label, serving_g, calories, protein_g, carbs_g, fat_g, is_custom, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
    `);

    const foodsData = [
      // MEAT (8)
      ['Grilled Chicken Breast', 'meat', '100g cooked', 100, 165, 31.0, 0.0, 3.6],
      ['Extra Lean Ground Turkey 93/7', 'meat', '100g cooked', 100, 150, 27.0, 0.0, 4.5],
      ['Lean Top Sirloin Beef Steak', 'meat', '100g grilled', 100, 185, 30.5, 0.0, 6.2],
      ['Pork Tenderloin Roast', 'meat', '100g roasted', 100, 143, 26.2, 0.0, 3.5],
      ['Ground Bison 90/10', 'meat', '100g cooked', 100, 172, 28.4, 0.0, 6.0],
      ['Roasted Turkey Breast Slices', 'meat', '100g sliced', 100, 135, 29.0, 1.0, 1.5],
      ['Lean Eye of Round Roast Beef', 'meat', '100g cooked', 100, 160, 28.0, 0.0, 4.8],
      ['Boneless Skinless Chicken Thigh', 'meat', '100g cooked', 100, 179, 24.5, 0.0, 8.2],

      // FISH & SEAFOOD (8)
      ['Wild Alaskan Sockeye Salmon Fillet', 'fish', '150g fillet', 150, 250, 39.0, 0.0, 9.8],
      ['Yellowfin Ahi Tuna Steak', 'fish', '150g steak', 150, 165, 36.5, 0.0, 1.2],
      ['Pacific Cod Fillet', 'fish', '150g fillet', 150, 123, 27.0, 0.0, 1.0],
      ['Jumbo Tiger Shrimp Cooked', 'fish', '100g peeled', 100, 99, 24.0, 0.2, 0.3],
      ['Canned Chunk Light Tuna in Water', 'fish', '1 can drained (130g)', 130, 130, 29.0, 0.0, 1.0],
      ['Atlantic Tilapia Fillet', 'fish', '150g fillet', 150, 144, 30.0, 0.0, 2.5],
      ['Atlantic Halibut Fillet', 'fish', '150g fillet', 150, 170, 34.0, 0.0, 3.0],
      ['Sardines in Spring Water', 'fish', '1 can (90g)', 90, 160, 21.0, 0.0, 8.5],

      // DAIRY (8)
      ['Greek Yogurt 0% Fat Plain', 'dairy', '1 cup (170g)', 170, 100, 18.0, 6.0, 0.4],
      ['Low-Fat Cottage Cheese 1%', 'dairy', '1 cup (226g)', 226, 163, 28.0, 6.1, 2.3],
      ['Whey Protein Isolate 90%', 'dairy', '1 scoop (30g)', 30, 115, 27.0, 1.0, 0.5],
      ['Micellar Casein Powder', 'dairy', '1 scoop (32g)', 32, 120, 25.0, 2.0, 0.8],
      ['Ultra-Filtered Skim Milk', 'dairy', '1 cup (240ml)', 245, 80, 13.0, 6.0, 0.0],
      ['Part-Skim Mozzarella String Cheese', 'dairy', '1 piece (28g)', 28, 80, 7.0, 1.0, 5.0],
      ['Parmesan Cheese Shredded', 'dairy', '28g (1 oz)', 28, 111, 10.0, 0.9, 7.3],
      ['Traditional Icelandic Skyr Plain', 'dairy', '1 container (170g)', 170, 110, 19.0, 6.0, 0.2],

      // EGGS (6)
      ['Large Whole Pasture-Raised Egg', 'eggs', '1 large egg (50g)', 50, 72, 6.3, 0.4, 4.8],
      ['100% Pure Liquid Egg Whites', 'eggs', '100ml (approx 3 whites)', 100, 52, 11.2, 0.7, 0.2],
      ['Hard Boiled Egg', 'eggs', '1 large egg (50g)', 50, 78, 6.3, 0.6, 5.3],
      ['Scrambled Egg Whites (Cooked)', 'eggs', '1 cup (243g)', 243, 126, 26.5, 1.8, 0.5],
      ['Organic Duck Egg', 'eggs', '1 egg (70g)', 70, 130, 9.0, 1.0, 9.6],
      ['Omega-3 Fortified Egg', 'eggs', '1 egg (50g)', 50, 75, 6.5, 0.5, 5.0],

      // LEGUMES (8)
      ['Cooked Black Beans', 'legumes', '1 cup (172g)', 172, 227, 15.2, 40.8, 0.9],
      ['Cooked Green / Brown Lentils', 'legumes', '1 cup (198g)', 198, 230, 17.9, 39.9, 0.8],
      ['Cooked Garbanzo Beans (Chickpeas)', 'legumes', '1 cup (164g)', 164, 269, 14.5, 45.0, 4.2],
      ['Steamed Edamame (Shelled)', 'legumes', '1 cup (155g)', 155, 188, 18.4, 13.8, 8.1],
      ['Cooked Red Kidney Beans', 'legumes', '1 cup (177g)', 177, 225, 15.3, 40.4, 0.9],
      ['Split Green Peas Cooked', 'legumes', '1 cup (196g)', 196, 231, 16.3, 41.4, 0.8],
      ['Cooked Pinto Beans', 'legumes', '1 cup (171g)', 171, 245, 15.4, 44.8, 1.1],
      ['Dry Roasted Edamame Kernels', 'legumes', '1/3 cup (45g)', 45, 190, 18.0, 11.0, 7.0],

      // GRAINS (8)
      ['Organic White / Red Quinoa Cooked', 'grains', '1 cup (185g)', 185, 222, 8.1, 39.4, 3.6],
      ['Rolled Oats Whole Grain (Dry)', 'grains', '1/2 cup (40g)', 40, 150, 5.0, 27.0, 2.5],
      ['Steel Cut Oats Cooked', 'grains', '1 cup (240g)', 240, 170, 6.0, 29.0, 3.0],
      ['Vital Wheat Gluten Seitan Cutlets', 'grains', '100g cutlet', 100, 140, 25.0, 5.0, 1.8],
      ['Wild Rice Cooked', 'grains', '1 cup (164g)', 164, 166, 6.5, 35.0, 0.6],
      ['Sprouted Whole Grain Ezekiel Bread', 'grains', '2 slices (68g)', 68, 160, 10.0, 30.0, 1.5],
      ['Whole Wheat Penne Pasta Cooked', 'grains', '1 cup (140g)', 140, 174, 7.5, 37.0, 0.8],
      ['Buckwheat Groats Cooked', 'grains', '1 cup (168g)', 168, 155, 5.7, 33.5, 1.0],

      // NUTS & SEEDS (8)
      ['Raw California Almonds', 'nuts', '1 oz / 23 almonds (28g)', 28, 164, 6.0, 6.1, 14.2],
      ['Natural Roasted Peanut Butter', 'nuts', '2 tbsp (32g)', 32, 190, 8.0, 7.0, 16.0],
      ['Raw Shelled Pumpkin Seeds (Pepitas)', 'nuts', '1 oz (28g)', 28, 158, 8.5, 4.2, 13.9],
      ['Shelled Organic Hemp Hearts', 'nuts', '3 tbsp (30g)', 30, 166, 9.5, 2.6, 14.6],
      ['Black Chia Seeds Organic', 'nuts', '2 tbsp (24g)', 24, 115, 4.0, 10.0, 7.0],
      ['Raw English Walnuts Halves', 'nuts', '1 oz (28g)', 28, 185, 4.3, 3.9, 18.5],
      ['Sunflower Seed Butter Natural', 'nuts', '2 tbsp (32g)', 32, 200, 7.0, 7.0, 17.0],
      ['Defatted Powdered Peanut Butter (PB2)', 'nuts', '2 tbsp (16g)', 16, 60, 6.0, 5.0, 1.5],

      // PLANT PROTEIN (8)
      ['Extra Firm Organic Tofu Pressed', 'plant_protein', '100g cubed', 100, 126, 14.0, 2.4, 7.5],
      ['Organic Soy Tempeh Steamed', 'plant_protein', '100g slab', 100, 195, 20.3, 7.6, 11.4],
      ['Fortified Nutritional Yeast Flakes', 'plant_protein', '2 tbsp (16g)', 16, 60, 8.0, 5.0, 0.5],
      ['Organic Pea Protein Isolate', 'plant_protein', '1 scoop (30g)', 30, 120, 24.0, 1.0, 2.0],
      ['Sprouted Brown Rice Protein Powder', 'plant_protein', '1 scoop (30g)', 30, 110, 24.0, 2.0, 0.5],
      ['Pure Spirulina Powder', 'plant_protein', '2 tbsp (14g)', 14, 40, 8.0, 3.4, 0.4],
      ['Textured Vegetable Protein (TVP Dry)', 'plant_protein', '1/4 cup dry (24g)', 24, 80, 12.0, 7.0, 0.2],
      ['Unsweetened Organic Soy Milk', 'plant_protein', '1 cup (240ml)', 240, 80, 8.0, 4.0, 4.0]
    ];

    const insertManyFoods = conn.transaction((items) => {
      for (const item of items) {
        insertFood.run(...item);
      }
    });

    insertManyFoods(foodsData);
    console.log(`✅ Seeded ${foodsData.length} laboratory-verified foods.`);
  }

  // 3. Seed 10+ Supplements
  const suppsCount = conn.prepare('SELECT COUNT(*) as count FROM supplements').get().count;
  if (suppsCount < 10) {
    console.log('💊 Seeding supplements catalog...');
    const insertSupp = conn.prepare(`
      INSERT INTO supplements (name, type, serving_label, protein_g, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    const supplementsData = [
      ['Whey Protein Isolate 100%', 'protein_powder', '1 scoop (30g)', 25.0, 'Rapid gastric emptying and high bio-leucine spike post-workout.'],
      ['Micellar Slow-Release Casein', 'protein_powder', '1 scoop (32g)', 24.0, 'Anti-catabolic sustained release over 6-8 hours. Ideal before sleep.'],
      ['Creatine Monohydrate (Creapure)', 'creatine', '5g powder', 0.0, 'Increases intramuscular phosphocreatine stores, strength, and cellular hydration.'],
      ['Essential Amino Acids (EAAs)', 'amino_acids', '1 scoop (10g)', 5.0, 'Contains all 9 essential aminos with 3g leucine for maximum mTOR stimulation.'],
      ['Branched Chain Amino Acids (BCAA 2:1:1)', 'amino_acids', '1 scoop (7g)', 0.0, 'Intra-workout fuel to reduce central fatigue and preserve muscle tissue.'],
      ['Zinc & Magnesium Aspartate (ZMA)', 'minerals', '3 capsules', 0.0, 'Supports deep restorative slow-wave sleep, testosterone, and metabolic recovery.'],
      ['Triple-Strength Omega-3 Fish Oil', 'vitamins', '2 softgels (2000mg)', 0.0, '1200mg EPA / 600mg DHA to reduce delayed-onset muscle soreness and systemic inflammation.'],
      ['Vitamin D3 + K2 Liquid Drops', 'vitamins', '5 drops (5,000 IU)', 0.0, 'Optimizes immune resilience, bone mineral density, and calcium partitioning.'],
      ['Hydrolyzed Collagen Peptides (Types I & III)', 'protein_powder', '1 scoop (20g)', 18.0, 'Rich in glycine, proline, and hydroxyproline for tendon, ligament, and cartilage synthesis.'],
      ['Organic Raw Plant Protein Blend', 'protein_powder', '1 scoop (32g)', 22.0, 'Pea, pumpkin, and sunflower blend with complete amino profile for plant-based athletes.'],
      ['Nitric Oxide High-Stim Pre-Workout', 'energy', '1 scoop (12g)', 0.0, '6g L-Citrulline Malate, 3.2g Beta-Alanine, and 200mg caffeine for acute focus.']
    ];

    const insertManySupps = conn.transaction((items) => {
      for (const item of items) {
        insertSupp.run(...item);
      }
    });

    insertManySupps(supplementsData);
    console.log(`✅ Seeded ${supplementsData.length} supplements.`);
  }

  // 4. Seed User Supplements & Today's Initial Logs for Alex
  const userSuppsCount = conn.prepare('SELECT COUNT(*) as count FROM user_supplements WHERE user_id = ?').get(userId).count;
  if (userSuppsCount === 0) {
    const suppRows = conn.prepare('SELECT id, name FROM supplements LIMIT 4').all();
    const insertUserSupp = conn.prepare('INSERT INTO user_supplements (user_id, supplement_id, is_active, default_servings) VALUES (?, ?, 1, 1.0)');
    for (const s of suppRows) {
      insertUserSupp.run(userId, s.id);
    }
    console.log('✅ Linked default supplements for demo user.');
  }

  // Seed sample food logs for today & last 7 days to give instant rich dashboard visuals
  const userLogsCount = conn.prepare('SELECT COUNT(*) as count FROM food_logs WHERE user_id = ?').get(userId).count;
  if (userLogsCount === 0) {
    console.log('📊 Seeding realistic weekly meal logs for demo user...');
    const insertLog = conn.prepare(`
      INSERT INTO food_logs (user_id, food_id, meal_type, quantity, protein_g, calories, logged_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    const foodLookup = {};
    const allFoods = conn.prepare('SELECT id, name, protein_g, calories FROM foods').all();
    for (const f of allFoods) {
      foodLookup[f.name] = f;
    }

    // Seed 7 days history
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const d = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      const dateStr = d.toISOString().split('T')[0];

      // Breakfast (around 08:00)
      const eggs = foodLookup['Large Whole Pasture-Raised Egg'];
      const yogurt = foodLookup['Greek Yogurt 0% Fat Plain'];
      if (eggs) insertLog.run(userId, eggs.id, 'breakfast', 2, eggs.protein_g * 2, eggs.calories * 2, `${dateStr}T08:00:00.000Z`);
      if (yogurt) insertLog.run(userId, yogurt.id, 'breakfast', 1, yogurt.protein_g, yogurt.calories, `${dateStr}T08:15:00.000Z`);

      // Lunch (around 13:00)
      const chicken = foodLookup['Grilled Chicken Breast'];
      const quinoa = foodLookup['Organic White / Red Quinoa Cooked'];
      if (chicken) insertLog.run(userId, chicken.id, 'lunch', 2, chicken.protein_g * 2, chicken.calories * 2, `${dateStr}T13:00:00.000Z`);
      if (quinoa) insertLog.run(userId, quinoa.id, 'lunch', 1, quinoa.protein_g, quinoa.calories, `${dateStr}T13:05:00.000Z`);

      // Dinner (around 19:30)
      const salmon = foodLookup['Wild Alaskan Sockeye Salmon Fillet'];
      if (salmon) insertLog.run(userId, salmon.id, 'dinner', 1, salmon.protein_g, salmon.calories, `${dateStr}T19:30:00.000Z`);

      // Snack (around 16:30)
      const whey = foodLookup['Whey Protein Isolate 90%'];
      if (whey) insertLog.run(userId, whey.id, 'snack', 1, whey.protein_g, whey.calories, `${dateStr}T16:30:00.000Z`);
    }

    // Seed a supplement log for today
    const creatine = conn.prepare("SELECT id, protein_g FROM supplements WHERE name LIKE '%Creatine%' LIMIT 1").get();
    if (creatine) {
      conn.prepare('INSERT INTO supplement_logs (user_id, supplement_id, servings, protein_g, taken_at) VALUES (?, ?, 1, 0, ?)')
        .run(userId, creatine.id, now.toISOString());
    }

    console.log('✅ Seeded 7-day historical logs and today\'s entries.');
  }

  // 5. Seed 5 Real Testimonials
  const testimonialsCount = conn.prepare('SELECT COUNT(*) as count FROM testimonials').get().count;
  if (testimonialsCount < 5) {
    console.log('⭐ Seeding verified testimonials...');
    const insertTestimonial = conn.prepare(`
      INSERT INTO testimonials (name, role, avatar_url, quote, rating, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const testimonialsData = [
      [
        'Dr. Marcus Vance, PhD, CSCS',
        'Director of Human Performance & Olympic Weightlifting Coach',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        'ProteinTrack eliminates the pseudo-science and macro guesswork. The leucine threshold calculation ensures my national-level athletes trigger peak muscle protein synthesis at every feeding window.',
        5,
        1
      ],
      [
        'Elena Rostova',
        'IFBB Pro Bikini Champion & Exercise Physiologist',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        'During an aggressive contest prep cut, maintaining lean body mass is non-negotiable. The historical snapshot logging and DIAAS density sorting make tracking effortless at 5 AM or post-cardio.',
        5,
        2
      ],
      [
        'Liam Gallagher',
        'Hybrid Endurance Athlete & 2:45 Marathoner',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
        'Most macro apps treat protein as a generic afterthought. ProteinTrack understands the elevated nitrogen turnover required when lifting heavy 4 days a week while logging 50+ miles on the road.',
        5,
        3
      ],
      [
        'Sarah Jenkins',
        'CrossFit Games Quarterfinalist & Gym Owner',
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
        'The dark cockpit interface is blazing fast. My entire gym community runs on ProteinTrack because logging a meal takes literally 2 taps instead of wading through bloated advertising.',
        5,
        4
      ],
      [
        'David Chen',
        'Bio-Optimization Researcher & Master Powerlifter',
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
        'The mathematics behind the goal multipliers (Helms & Morton protocols) are strictly adhered to. It is rare to see software engineered with this degree of nutritional biochemistry fidelity.',
        5,
        5
      ]
    ];

    const insertManyTestimonials = conn.transaction((items) => {
      for (const item of items) {
        insertTestimonial.run(...item);
      }
    });

    insertManyTestimonials(testimonialsData);
    console.log(`✅ Seeded ${testimonialsData.length} testimonials.`);
  }

  // 6. Seed 6 FAQs
  const faqsCount = conn.prepare('SELECT COUNT(*) as count FROM faqs').get().count;
  if (faqsCount < 6) {
    console.log('❓ Seeding clinical FAQs...');
    const insertFaq = conn.prepare(`
      INSERT INTO faqs (question, answer, category, display_order)
      VALUES (?, ?, ?, ?)
    `);

    const faqsData = [
      [
        'How does ProteinTrack calculate my daily protein target?',
        'Our calculation starts from an evidence-based baseline of 1.6 g/kg (Morton et al. 2018 meta-analysis of 49 RCTs). We then adjust for your metabolic objective (caloric deficit cuts require up to 2.4 g/kg to preserve lean tissue - Helms et al.), your training modality (hypertrophy vs. endurance), and weekly volume, clamping the total to a clinically safe, optimal range.',
        'science',
        1
      ],
      [
        'What is the Leucine Threshold and why does it matter?',
        'Leucine is the primary branched-chain amino acid that acts as the molecular trigger for the mTORC1 pathway, initiating muscle protein synthesis (MPS). Research by Phillips and colleagues demonstrates that ~2.5g to 3.0g of leucine per feeding is required to reach the saturation ceiling. ProteinTrack divides your daily split to ensure each meal meets this anabolic trigger.',
        'science',
        2
      ],
      [
        'Does ProteinTrack distinguish between animal and plant protein bioavailability?',
        'Yes. While total grams matter, amino acid kinetics differ. The DIAAS (Digestible Indispensable Amino Acid Score) standard is integrated into our laboratory database, allowing athletes to see true digestible amino acid density across both animal and plant proteins.',
        'nutrition',
        3
      ],
      [
        'How does the Daily Streak calculation work?',
        'A day counts toward your streak if your total protein intake reaches at least 90% of your calibrated target for that calendar day in your local timezone. This 10% window accounts for minor day-to-day appetite fluctuations while preserving biological consistency.',
        'platform',
        4
      ],
      [
        'Can I create custom foods and recipes?',
        'Yes. Authenticated athletes can submit custom foods with exact gram measurements, macro distributions, and serving labels. Custom foods remain private to your profile and can be logged instantly into any meal slot.',
        'platform',
        5
      ],
      [
        'Is my telemetry and metabolic health data private?',
        'ProteinTrack adheres to strict zero-bloat, privacy-first principles. Your data is encrypted in transit and at rest, authenticated via secure httpOnly cookies, and never sold to third-party ad networks or brokers.',
        'security',
        6
      ]
    ];

    const insertManyFaqs = conn.transaction((items) => {
      for (const item of items) {
        insertFaq.run(...item);
      }
    });

    insertManyFaqs(faqsData);
    console.log(`✅ Seeded ${faqsData.length} FAQs.`);
  }

  // 7. Seed Newsletter Subscribers
  const newsCount = conn.prepare('SELECT COUNT(*) as count FROM newsletter_subscribers').get().count;
  if (newsCount === 0) {
    conn.prepare('INSERT INTO newsletter_subscribers (email, source) VALUES (?, ?)')
      .run('marcus.vance@precision.edu', 'hero');
    conn.prepare('INSERT INTO newsletter_subscribers (email, source) VALUES (?, ?)')
      .run('elena.rostova@proathlete.com', 'footer');
    console.log('✅ Seeded initial telemetry dispatch subscribers.');
  }

  console.log('🚀 Database seeding finished successfully!\n');
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = seedDatabase;
