/**
 * Custom Operational Application Error
 * Encapsulates HTTP status code and standard ProteinTrack error code
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Invalid request parameters', code = 'BAD_REQUEST', details = null) {
    return new AppError(message, 400, code, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }

  static forbidden(message = 'Access forbidden', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }

  static conflict(message = 'Resource already exists', code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }

  static unprocessable(message = 'Validation failed', code = 'VALIDATION_ERROR', details = null) {
    return new AppError(message, 422, code, details);
  }

  static rateLimit(message = 'Too many requests. Please try again later.', code = 'RATE_LIMIT_EXCEEDED') {
    return new AppError(message, 429, code);
  }
}

module.exports = AppError;
