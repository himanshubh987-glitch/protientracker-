const express = require('express');
const { z } = require('zod');
const supplementsController = require('../controllers/supplementsController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const logSupplementSchema = {
  body: z.object({
    supplement_id: z.number().int().positive('Valid supplement ID is required'),
    servings: z.number().positive('Servings must be positive').optional(),
    taken_at: z.string().optional()
  })
};

router.use(authenticate);

router.get('/', supplementsController.getSupplements);
router.put('/:id/toggle', supplementsController.toggleSupplement);
// Log supplement route mounted at /api/logs/supplement or /api/supplements/log
router.post('/log', validate(logSupplementSchema), supplementsController.logSupplement);

module.exports = router;
