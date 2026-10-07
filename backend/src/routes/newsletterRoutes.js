const express = require('express');
const { z } = require('zod');
const newsletterController = require('../controllers/newsletterController');
const validate = require('../middleware/validate');
const { newsletterLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const subscribeSchema = {
  body: z.object({
    email: z.string().email('Please enter a valid email address'),
    source: z.enum(['hero', 'footer', 'cta', 'web', 'home_footer', 'other']).optional()
  })
};

router.post('/subscribe', newsletterLimiter, validate(subscribeSchema), newsletterController.subscribe);

module.exports = router;
