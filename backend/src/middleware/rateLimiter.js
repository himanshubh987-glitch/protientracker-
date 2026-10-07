const rateLimit = require('express-rate-limit');

/**
 * Custom rate limit handler returning standard ProteinTrack error format
 */
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP address. Please wait a few minutes before trying again.'
    }
  });
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 subscriptions per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

module.exports = {
  authLimiter,
  newsletterLimiter
};
