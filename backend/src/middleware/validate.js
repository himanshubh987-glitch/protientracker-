const { ZodError } = require('zod');
const AppError = require('../utils/errors');

/**
 * Creates an Express middleware to validate req.body, req.query, or req.params using Zod.
 * @param {Object} schemas { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
 */
function validate(schemas) {
  return async (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errorMessages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return next(AppError.unprocessable(errorMessages, 'VALIDATION_ERROR', err.errors));
      }
      next(err);
    }
  };
}

module.exports = validate;
