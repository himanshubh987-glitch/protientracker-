const express = require('express');
const homeController = require('../controllers/homeController');

const router = express.Router();

router.get('/stats', homeController.getHomeStats);
router.get('/testimonials', homeController.getTestimonials);
router.get('/faqs', homeController.getFaqs);

module.exports = router;
