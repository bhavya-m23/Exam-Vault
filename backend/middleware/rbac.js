const { addSecurityEvent, addAuditLog } = require('../data/store');

/**
 * Role-Based Access Control (RBAC) middleware.
 * Ensures the authenticated user possesses one of the required roles.
 * Administrator role automatically satisfies all role requirements.
 * @param  {...string} allowedRoles - List of authorized roles.
 */
function requireRole(...allowedRoles) {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const isAuthorized = roles.length === 0 || 
                         userRole === 'Administrator' || 
                         roles.includes(userRole);

    if (isAuthorized) {
      return next();
    }

    // Log forbidden attempt
    const actionDesc = `${req.method} ${req.originalUrl}`;
    addAuditLog({
      user: req.user.name,
      userRole: req.user.role,
      action: 'UNAUTHORIZED_API_CALL',
      document: 'System Access Control',
      documentId: 'SYS-AUTH',
      purpose: 'API Protection',
      result: 'BLOCKED',
      reason: `Role '${userRole}' lacks permission. Permitted: [${allowedRoles.join(', ')}]`,
      ip: req.ip || '127.0.0.1'
    });

    addSecurityEvent({
      severity: 'HIGH',
      type: 'FORBIDDEN_OPERATION',
      user: req.user.name,
      userRole: req.user.role,
      document: actionDesc,
      documentId: 'SYS',
      message: `User '${req.user.name}' (${userRole}) attempted unauthorized action '${actionDesc}'. Allowed: [${allowedRoles.join(', ')}]`
    });

    return res.status(403).json({
      message: `Access forbidden: Role '${userRole}' does not possess required permissions. Permitted roles: [${allowedRoles.join(', ')}]`
    });
  };
}

module.exports = {
  requireRole
};
