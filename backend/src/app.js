const express = require('express');
const path = require('path');
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

// Import supplement log handler for /api/logs/supplement
const supplementsController = require('./controllers/supplementsController');
const { authenticate } = require('./middleware/auth');

const app = express();

// 1. Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Allows flexible CDN font/script loading in development
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// 2. CORS configuration with credentials support
const allowedOrigins = [
  config.clientOrigin,
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.trycloudflare.com')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in dev, can restrict in production
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// 3. Body & Cookie Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(config.cookieSecret));

// 4. Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
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

// Explicit route alias: POST /api/logs/supplement
app.post('/api/logs/supplement', authenticate, supplementsController.logSupplement);

// 6. Optionally serve static frontend files from frontend/ directory
const frontendPath = path.resolve(__dirname, '../../frontend');
if (require('fs').existsSync(path.join(frontendPath, 'index.html'))) {
  app.use(express.static(frontendPath));
}

// 7. Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
