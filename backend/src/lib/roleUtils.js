/**
 * roleUtils.js
 *
 * Reusable, synchronous helpers for server-side role checks.
 * Call these inside controllers as a second line of defence —
 * even after the route-level `authorize()` middleware has already
 * passed — so that a misconfigured route never silently exposes a
 * privileged operation.
 *
 * All helpers read from `req.user` which is populated by the
 * `authenticate` middleware (verified from the Supabase DB).
 *
 * Usage:
 *   import { isAdmin, hasRole, assertAdmin, assertRole } from '../lib/roleUtils.js';
 *
 *   // Boolean helpers — use when you need conditional logic:
 *   if (!isAdmin(req)) return res.status(403).json({ error: '...' });
 *
 *   // Guard helpers — use for early-return one-liners:
 *   if (assertAdmin(req, res)) return;
 */

/**
 * Returns true when the authenticated user has the 'admin' role.
 * @param {import('express').Request} req
 */
export const isAdmin = (req) =>
  Array.isArray(req.user?.roles) && req.user.roles.includes('admin');

/**
 * Returns true when the authenticated user has at least one of the
 * supplied roles.  Admins implicitly pass every role check.
 * @param {import('express').Request} req
 * @param {...string} roles
 */
export const hasRole = (req, ...roles) => {
  const userRoles = req.user?.roles ?? [];
  return userRoles.includes('admin') || roles.some((r) => userRoles.includes(r));
};

/**
 * Returns true when the caller is operating on their own resource
 * (i.e. req.user.id === targetId).
 * @param {import('express').Request} req
 * @param {string} targetId
 */
export const isSelf = (req, targetId) => req.user?.id === targetId;

/**
 * Sends a 403 response and returns true if the user is NOT an admin.
 * Designed for use as a one-liner guard at the top of a controller:
 *
 *   if (assertAdmin(req, res)) return;
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @returns {boolean} true → response was sent, caller should return immediately
 */
export const assertAdmin = (req, res) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return true;
  }
  return false;
};

/**
 * Sends a 403 response and returns true if the user does NOT have at
 * least one of the supplied roles.
 *
 *   if (assertRole(req, res, 'election_committee')) return;
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {...string} roles
 * @returns {boolean}
 */
export const assertRole = (req, res, ...roles) => {
  if (!hasRole(req, ...roles)) {
    res
      .status(403)
      .json({ error: `Required role(s): ${roles.join(', ')}.` });
    return true;
  }
  return false;
};
