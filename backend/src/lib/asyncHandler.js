/**
 * asyncHandler.js
 *
 * Wraps an async Express route handler so that any unhandled thrown error
 * (or rejected promise) is forwarded to Express's error-handling middleware
 * via next(err), instead of causing an unhandled promise rejection.
 *
 * Without this wrapper, Express 4 silently swallows async errors.
 *
 * Usage (in route files):
 *   import { asyncHandler } from '../lib/asyncHandler.js';
 *   router.get('/', authenticate, asyncHandler(getUsers));
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
