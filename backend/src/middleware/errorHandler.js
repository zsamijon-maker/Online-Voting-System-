/**
 * errorHandler.js — global Express error-handling middleware.
 *
 * Mount LAST in index.js after all routes:
 *   import { errorHandler } from './middleware/errorHandler.js';
 *   app.use(errorHandler);
 *
 * Security contract:
 *  • Logs the FULL error (message + stack trace) server-side only.
 *  • Sends a GENERIC, information-free response to the client for 5xx errors.
 *  • Passes through meaningful 4xx messages (bad input, auth failures, etc.)
 *    because those are expected operational errors that help the user.
 *  • In development NODE_ENV attaches `details` to 5xx responses for easier
 *    local debugging only — this field is NEVER sent in production.
 */

import { logger } from '../lib/logger.js';

const isDev = process.env.NODE_ENV !== 'production';

export const errorHandler = (err, req, res, next) => {
  // If response streaming has already started, delegate to Express default.
  if (res.headersSent) return next(err);

  // Determine status code –– prefer explicit code set on the error object.
  const status = err.statusCode ?? err.status ?? 500;

  // ── Server-side: log everything ──────────────────────────────────────────
  logger.error(
    `[${req.method} ${req.originalUrl}] ${status} — ${err.message}`,
    '\n',
    err.stack ?? '(no stack)',
  );

  // ── Client-side: never expose internals for server errors ────────────────
  const isServerError = status >= 500;
  const body = {
    error: isServerError
      ? 'An unexpected error occurred. Please try again later.'
      : err.message,
  };

  // Development-only detail block (never reaches production clients).
  if (isDev && isServerError) {
    body.details = err.message;
    body.stack   = err.stack;
  }

  res.status(status).json(body);
};
