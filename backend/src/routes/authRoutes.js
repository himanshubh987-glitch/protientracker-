const express = require('express');
const { z } = require('zod');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const registerSchema = {
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Please provide a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    age: z.number().int().min(12).max(120).optional(),
    sex: z.enum(['male', 'female', 'other']).optional(),
    height_cm: z.number().positive().max(300).optional(),
    weight_kg: z.number().positive().max(400).optional(),
    activity_level: z.enum(['sedentary', 'light', 'moderate', 'heavy', 'very_heavy']).optional(),
    training_type: z.enum(['hypertrophy', 'strength', 'endurance', 'general_fitness', 'none']).optional(),
    goal: z.enum(['cut', 'maintain', 'bulk']).optional(),
    meals_per_day: z.number().int().min(2).max(8).optional(),
    timezone: z.string().optional()
  })
};

const loginSchema = {
  body: z.object({
    email: z.string().email('Please provide a valid email address'),
    password: z.string().min(1, 'Password is required')
  })
};

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
