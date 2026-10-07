const express = require('express');
const { z } = require('zod');
const foodsController = require('../controllers/foodsController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const querySchema = {
  query: z.object({
    search: z.string().optional(),
    category: z.string().optional(),
    sort: z.enum(['name', 'category', 'protein_g', 'calories', 'carbs_g', 'fat_g', 'serving_g']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional()
  })
};

const createFoodSchema = {
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(150),
    category: z.string().min(2).max(50),
    serving_label: z.string().min(1, 'Serving label is required').max(100),
    serving_g: z.number().positive('Serving grams must be positive'),
    calories: z.number().nonnegative('Calories must be non-negative'),
    protein_g: z.number().nonnegative('Protein must be non-negative'),
    carbs_g: z.number().nonnegative().optional(),
    fat_g: z.number().nonnegative().optional()
  })
};

router.get('/', optionalAuth, validate(querySchema), foodsController.getFoods);
router.get('/:id', optionalAuth, foodsController.getFoodById);
router.post('/', authenticate, validate(createFoodSchema), foodsController.createCustomFood);

module.exports = router;
