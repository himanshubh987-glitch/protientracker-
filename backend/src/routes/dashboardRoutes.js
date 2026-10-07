const express = require('express');
const { z } = require('zod');
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const dashboardQuerySchema = {
  query: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional()
  })
};

router.get('/', authenticate, validate(dashboardQuerySchema), dashboardController.getDashboard);

module.exports = router;
