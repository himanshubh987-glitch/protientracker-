const express = require('express');
const { z } = require('zod');
const logsController = require('../controllers/logsController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const createLogSchema = {
  body: z.object({
    food_id: z.number().int().positive('Valid food ID is required'),
    quantity: z.number().positive('Quantity must be greater than zero'),
    meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    logged_at: z.string().optional()
  })
};

const updateLogSchema = {
  body: z.object({
    quantity: z.number().positive().optional(),
    meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
    protein_g: z.number().nonnegative().optional(),
    calories: z.number().nonnegative().optional()
  })
};

const getLogsQuerySchema = {
  query: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional()
  })
};

router.use(authenticate);

router.post('/food', validate(createLogSchema), logsController.createFoodLog);
router.put('/food/:id', validate(updateLogSchema), logsController.updateFoodLog);
router.delete('/food/:id', logsController.deleteFoodLog);
router.get('/', validate(getLogsQuerySchema), logsController.getLogs);

module.exports = router;
