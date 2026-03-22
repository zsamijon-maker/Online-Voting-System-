/**
 * Middleware: Role-based access control.
 * Usage: authorize('admin', 'election_committee')
 *
 * NOTE: The inner variable is named `r` (not `role`) to avoid shadowing
 * the outer `allowedRoles` rest parameter, which could silently mask bugs.
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const userRoles = req.user.roles || [];
    // Admins implicitly pass every role check.
    const permitted = userRoles.some(
      (r) => allowedRoles.includes(r) || r === 'admin'
    );

    if (!permitted) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    next();
  };
};

/** Shorthand for routes restricted to admins only. */
export const requireAdmin = authorize('admin');
