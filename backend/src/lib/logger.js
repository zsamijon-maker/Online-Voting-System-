/**
 * logger.js — structured server-side logger.
 *
 * Always writes full error details (including stack traces) to the server
 * console.  NEVER used to build HTTP responses — that is errorHandler's job.
 *
 * Usage:
 *   import { logger } from '../lib/logger.js';
 *   logger.info('Server started on port 5000');
 *   logger.error('DB query failed:', err);
 */

const ts = () => new Date().toISOString();
const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  info:  (...a) => console.log (`[${ts()}] INFO `, ...a),
  warn:  (...a) => console.warn(`[${ts()}] WARN `, ...a),
  error: (...a) => console.error(`[${ts()}] ERROR`, ...a),
  /** Only printed in development — silent in production. */
  debug: (...a) => { if (isDev) console.debug(`[${ts()}] DEBUG`, ...a); },
};
