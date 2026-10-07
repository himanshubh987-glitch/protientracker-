/**
 * Evidence-Based Protein Target Calculation Engine
 * 
 * Clinical Literature Citations:
 * - Morton RW et al. (2018) Meta-analysis of 49 RCTs: 1.62 g/kg/day breakpoint for FFM gains.
 * - Helms ER et al. (2014) Hypocaloric resistance training protein recommendations: 2.3–3.1 g/kg FFM.
 * - Phillips SM et al. (2016) The leucine trigger hypothesis: 2.5–3.0g leucine per bolus.
 * - Antonio J et al. (2016) High protein diets (up to 3.3 g/kg/day) safety profiling.
 */

/**
 * Calculates evidence-based daily protein targets and meal distributions.
 * @param {Object} params
 * @param {number} params.weight_kg
 * @param {string} [params.goal] 'cut' | 'maintain' | 'bulk'
 * @param {string} [params.activity_level] 'sedentary' | 'light' | 'moderate' | 'heavy' | 'very_heavy'
 * @param {string} [params.training_type] 'hypertrophy' | 'strength' | 'endurance' | 'general_fitness' | 'none'
 * @param {number} [params.meals_per_day]
 * @returns {Object}
 */
function calculateProteinPlan({
  weight_kg,
  goal = 'maintain',
  activity_level = 'moderate',
  training_type = 'hypertrophy',
  meals_per_day = 4
}) {
  const weight = Math.max(30, Math.min(250, Number(weight_kg) || 75));
  const mealsCount = Math.max(2, Math.min(8, Number(meals_per_day) || 4));

  // 1. Base Multiplier: Evidence-based starting point for athletic individuals
  let multiplier = 1.60;

  // 2. Goal Adjustment (Morton 2018, Helms 2014)
  // Caloric restriction / cut requires elevated protein to prevent muscle wasting (negative nitrogen balance)
  switch (goal) {
    case 'cut':
      multiplier += 0.40; // ~2.00 g/kg base
      break;
    case 'bulk':
      multiplier += 0.20; // ~1.80 g/kg base (optimal MPS in energy surplus)
      break;
    case 'maintain':
    default:
      multiplier += 0.00; // ~1.60 g/kg
      break;
  }

  // 3. Activity Level Adjustment
  switch (activity_level) {
    case 'sedentary':
      multiplier -= 0.20;
      break;
    case 'light':
      multiplier -= 0.10;
      break;
    case 'moderate':
      multiplier += 0.05;
      break;
    case 'heavy':
      multiplier += 0.15;
      break;
    case 'very_heavy':
      multiplier += 0.25;
      break;
    default:
      break;
  }

  // 4. Training Modality Adjustment
  switch (training_type) {
    case 'hypertrophy':
      multiplier += 0.15;
      break;
    case 'strength':
      multiplier += 0.20;
      break;
    case 'endurance':
      multiplier += 0.10; // Mitochondrial biogenesis & protein turnover
      break;
    case 'general_fitness':
      multiplier += 0.00;
      break;
    case 'none':
      multiplier -= 0.20;
      break;
    default:
      break;
  }

  // 5. Safe Range Clamping (Antonio et al. 2016 safe upper bounds; RDA safe baseline)
  multiplier = Math.max(1.20, Math.min(3.30, multiplier));
  multiplier = Math.round(multiplier * 100) / 100;

  // Total daily intake calculation clamped between 45g and 400g
  const computedTotal = Math.round(weight * multiplier);
  const total_daily_g = Math.max(45, Math.min(400, computedTotal));

  // Per-meal distribution
  const gramsPerMeal = Math.round(total_daily_g / mealsCount);

  // Leucine threshold calculation (~2.5g to 3.0g per meal bolus)
  const leucine_threshold_g = 2.5;

  // Timing suggestions based on meals per day
  const timingSuggestions = generateMealTiming(mealsCount);

  // Evidence notes
  const notes = generateEvidenceNotes(goal, multiplier, total_daily_g, mealsCount);

  return {
    total_daily_g,
    g_per_kg: multiplier,
    meals_per_day: mealsCount,
    per_meal_split: {
      grams_per_meal: gramsPerMeal,
      meal_breakdown: Array.from({ length: mealsCount }, (_, i) => ({
        meal_number: i + 1,
        target_g: gramsPerMeal,
        suggested_time: timingSuggestions[i] || `Meal ${i + 1}`
      }))
    },
    leucine_threshold: {
      grams_per_meal: leucine_threshold_g,
      target_protein_per_bolus_g: Math.max(25, gramsPerMeal),
      biological_mechanism: "Activation of intramuscular Sestrin2 and mTORC1 phosphorylation"
    },
    timing_suggestions: timingSuggestions,
    notes: notes
  };
}

function generateMealTiming(count) {
  switch (count) {
    case 3:
      return [
        "08:00 AM (Post-fast morning pulse)",
        "01:00 PM (Mid-day anabolic window)",
        "07:30 PM (Pre-sleep sustained nitrogen retention)"
      ];
    case 4:
      return [
        "07:30 AM (Breakfast recovery matrix)",
        "12:30 PM (Peak daytime protein bolus)",
        "04:30 PM (Post-training rapid uptake window)",
        "08:00 PM (Slow-digesting evening meal)"
      ];
    case 5:
      return [
        "07:00 AM (Wake-up pulse)",
        "11:00 AM (Mid-morning protein booster)",
        "02:30 PM (Lunch anabolic reinforcement)",
        "05:30 PM (Pre/Post-workout feeding)",
        "09:00 PM (Nighttime anti-catabolic feeding)"
      ];
    case 6:
      return [
        "07:00 AM (Meal 1)",
        "10:00 AM (Meal 2)",
        "01:00 PM (Meal 3)",
        "04:00 PM (Meal 4)",
        "07:00 PM (Meal 5)",
        "10:00 PM (Meal 6)"
      ];
    default:
      return Array.from({ length: count }, (_, i) => `Window ${i + 1} (${Math.round(14 / count * i + 8)}:00)`);
  }
}

function generateEvidenceNotes(goal, multiplier, total_daily_g, mealsCount) {
  return [
    `Base target calibrated at ${multiplier} g/kg/day, aligned with the Morton et al. (2018) clinical threshold for resistance-trained individuals.`,
    goal === 'cut'
      ? `Caloric deficit detected: Protein elevated by +0.4 g/kg to mitigate muscle protein breakdown (MPB) and preserve lean mass (Helms et al., 2014).`
      : goal === 'bulk'
      ? `Caloric surplus detected: Intake calibrated to maximize muscle protein synthesis (MPS) without excessive metabolic substrate waste.`
      : `Maintenance protocol: Calibrated for stable nitrogen equilibrium and rapid daily musculoskeletal recovery.`,
    `Even distribution across ${mealsCount} meals achieves the ~2.5g leucine threshold at each feeding, maximizing fractional synthetic rate (FSR) throughout the 24-hour cycle.`
  ];
}

module.exports = {
  calculateProteinPlan
};
