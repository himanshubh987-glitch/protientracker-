const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Import Route Handlers
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const calculatorRoutes = require('./routes/calculatorRoutes');
const foodsRoutes = require('./routes/foodsRoutes');
const logsRoutes = require('./routes/logsRoutes');
const supplementsRoutes = require('./routes/supplementsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const homeRoutes = require('./routes/homeRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');

// Import controllers for explicit route aliases
const supplementsController = require('./controllers/supplementsController');
const homeController = require('./controllers/homeController');
const { authenticate } = require('./middleware/auth');

const app = express();

// Trust Railway / cloud reverse proxy (required for express-rate-limit and secure cookies)
app.set('trust proxy', 1);

// 1. Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// 2. CORS configuration with credentials support
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, same-origin) or any web origin
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// 3. Body & Cookie Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(config.cookieSecret));

// 4. Health Check (used by Railway healthcheck)
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'ProteinTrack Backend API',
    version: '2.4.0',
    timestamp: new Date().toISOString()
  });
});

// 5. Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/calculator', calculatorRoutes);
app.use('/api/foods', foodsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/supplements', supplementsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/newsletter', newsletterRoutes);

// Explicit route aliases
app.post('/api/logs/supplement', authenticate, supplementsController.logSupplement);
app.get('/api/testimonials', homeController.getTestimonials);
app.get('/api/faqs', homeController.getFaqs);

// 6. Serve static frontend files if frontend/ directory exists
const frontendPath = path.resolve(__dirname, '../../frontend');
if (fs.existsSync(path.join(frontendPath, 'index.html'))) {
  app.use(express.static(frontendPath));
} else {
  // Root status response when deployed as standalone backend-only service
  app.get('/', (req, res) => {
    res.json({
      service: 'ProteinTrack API',
      status: 'operational',
      version: '2.4.0',
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        profile: '/api/profile',
        calculator: '/api/calculator',
        foods: '/api/foods',
        logs: '/api/logs',
        supplements: '/api/supplements',
        dashboard: '/api/dashboard',
        home: '/api/home/stats',
        testimonials: '/api/testimonials',
        faqs: '/api/faqs',
        newsletter: '/api/newsletter/subscribe'
      }
    });
  });
}

// 7. Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
