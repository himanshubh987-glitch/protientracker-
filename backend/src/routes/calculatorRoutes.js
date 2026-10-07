const express = require('express');
const { z } = require('zod');
const calculatorController = require('../controllers/calculatorController');
const { optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const calculateSchema = {
  body: z.object({
    weight_kg: z.coerce.number().positive('Weight must be positive').max(400),
    height_cm: z.coerce.number().positive().max(300).optional(),
    age: z.coerce.number().int().min(12).max(120).optional(),
    sex: z.enum(['male', 'female', 'other']).optional(),
    goal: z.enum(['cut', 'maintain', 'bulk']).optional(),
    activity_level: z.enum(['sedentary', 'light', 'moderate', 'heavy', 'very_heavy', 'very_active']).optional(),
    training_type: z.enum(['hypertrophy', 'strength', 'endurance', 'hybrid', 'general_fitness', 'none', 'heavy', 'moderate', 'light', 'sedentary']).optional(),
    meals_per_day: z.coerce.number().int().min(1).max(10).optional(),
    save_as_my_target: z.boolean().optional(),
    save_as_target: z.boolean().optional()
  })
};

router.post('/', optionalAuth, validate(calculateSchema), calculatorController.calculate);

module.exports = router;
