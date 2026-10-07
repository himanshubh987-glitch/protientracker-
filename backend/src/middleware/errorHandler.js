const AppError = require('../utils/errors');
const config = require('../config/env');

/**
 * Global Centralized Error Handling Middleware
 * Guarantees strict adherence to the ProteinTrack error specification:
 * { error: { code, message } }
 */
function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected internal server error occurred.';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
  } else if (err.name === 'SyntaxError' && err.status === 400 && 'body' in err) {
    // Malformed JSON payload
    statusCode = 400;
    code = 'MALFORMED_JSON';
    message = 'Request body contains invalid JSON syntax.';
  } else if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = 'A record with this unique identifier already exists.';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Authentication token signature is invalid.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired. Please log in again.';
  } else {
    // Unhandled exception - log stack trace in non-production
    if (!config.isProduction) {
      console.error('Unhandled Server Exception:', err);
      message = err.message || message;
    } else {
      console.error('Unhandled Server Exception:', err.message);
    }
  }

  res.status(statusCode).json({
    error: {
      code,
      message
    }
  });
}

/**
 * 404 Route Not Found Catch-All Handler
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`
    }
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
