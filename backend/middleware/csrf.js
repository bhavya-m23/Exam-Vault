/**
 * CSRF Protection Middleware for Cookie-based sessions.
 * 
 * Protects state-changing endpoints (POST, PUT, DELETE, PATCH) against Cross-Site Request Forgery.
 * Requires custom request headers ('X-Requested-With' or 'X-ExamVault-CSRF') or JSON Content-Type,
 * which standard cross-origin HTML forms cannot forge without triggering a CORS preflight.
 */
function csrfProtection(req, res, next) {
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  // Safe read-only methods (GET, HEAD, OPTIONS) do not require CSRF validation
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  // Authorization: Bearer <token> is inherently immune to browser CSRF (not auto-attached by browsers)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // If request uses cookie authentication, verify custom request header or API content-type
  const hasAuthCookie = req.cookies && req.cookies['examvault_token'];
  if (hasAuthCookie) {
    const hasCustomHeader = req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                            req.headers['x-examvault-csrf'] === '1';
    const contentType = req.headers['content-type'] || '';
    const isJson = contentType.toLowerCase().includes('application/json');

    // Reject simple form types (application/x-www-form-urlencoded, multipart/form-data, text/plain)
    // unless accompanied by an explicit custom header verified by CORS
    if (!hasCustomHeader && !isJson) {
      return res.status(403).json({
        message: 'CSRF validation failed: State-changing requests authenticated via cookie must include custom request header or application/json content type.'
      });
    }
  }

  next();
}

module.exports = {
  csrfProtection
};
