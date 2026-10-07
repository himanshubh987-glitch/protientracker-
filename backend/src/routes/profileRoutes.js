const express = require('express');
const { z } = require('zod');
const profileController = require('../controllers/profileController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const updateProfileSchema = {
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    age: z.coerce.number().int().min(12).max(120).optional(),
    sex: z.enum(['male', 'female', 'other']).optional(),
    height_cm: z.coerce.number().positive().max(300).optional(),
    weight_kg: z.coerce.number().positive().max(400).optional(),
    activity_level: z.enum(['sedentary', 'light', 'moderate', 'heavy', 'very_heavy', 'very_active']).optional(),
    training_type: z.enum(['hypertrophy', 'strength', 'endurance', 'hybrid', 'general_fitness', 'none', 'heavy', 'moderate', 'light', 'sedentary']).optional(),
    goal: z.enum(['cut', 'maintain', 'bulk']).optional(),
    meals_per_day: z.coerce.number().int().min(1).max(10).optional(),
    timezone: z.string().optional(),
    custom_target_g: z.coerce.number().positive().max(500).optional(),
    daily_protein_target_g: z.coerce.number().positive().max(500).optional()
  })
};

router.use(authenticate);
router.get('/', profileController.getProfile);
router.put('/', validate(updateProfileSchema), profileController.updateProfile);

module.exports = router;
