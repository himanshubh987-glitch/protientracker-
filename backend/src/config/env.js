const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:8080',
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_key_for_development_only_123456789',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieSecret: process.env.COOKIE_SECRET || 'cookie_secret_key_for_development_only_12345',
  databaseFile: process.env.DATABASE_FILE || 'data/proteintrack.db',
  databaseUrl: process.env.DATABASE_URL || null,
};

module.exports = config;
