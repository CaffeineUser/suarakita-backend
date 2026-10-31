import { BadRequestError } from '../utils/errors.js';

export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues?.[0];
      const message = firstIssue?.message || 'Data input tidak valid.';
      return next(new BadRequestError(message, result.error.format()));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const firstIssue = result.error.issues?.[0];
      const message = firstIssue?.message || 'Query parameter tidak valid.';
      return next(new BadRequestError(message, result.error.format()));
    }
    req.query = result.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const firstIssue = result.error.issues?.[0];
      const message = firstIssue?.message || 'Parameter URL tidak valid.';
      return next(new BadRequestError(message, result.error.format()));
    }
    req.params = result.data;
    next();
  };
}
