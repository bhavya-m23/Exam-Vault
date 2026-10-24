const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { getUserById, isTokenRevoked } = require('../data/store');

/**
 * Authentication middleware.
 * Verifies JWT signature & expiration from HTTP-only cookie or Authorization header.
 * Attaches the verified user profile to req.user.
 */
function authenticateToken(req, res, next) {
  let token = null;

  // 1. Check HTTP-only cookie
  if (req.cookies && req.cookies['examvault_token']) {
    token = req.cookies['examvault_token'];
  }

  // 2. Check Authorization: Bearer <token> header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (!token) {
    return res.status(401).json({
      message: 'Authentication required. No session token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if token has been revoked on server
    if (decoded.jti && isTokenRevoked(decoded.jti)) {
      return res.status(401).json({
        message: 'Session has been invalidated. Please sign in again.'
      });
    }

    // Verify user still exists in database
    const user = getUserById(decoded.id || decoded.userId);
    if (!user) {
      return res.status(401).json({
        message: 'Invalid session: user account not found.'
      });
    }

    // Check if all sessions for user were invalidated (user-wide revocation)
    const tokenVer = decoded.tokenVersion || 1;
    const userVer = user.tokenVersion || 1;
    if (tokenVer < userVer) {
      return res.status(401).json({
        message: 'Session has been invalidated. Please sign in again.'
      });
    }

    // Attach server-resolved authenticated identity to req.user
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      jti: decoded.jti,
      tokenVersion: userVer
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Session expired. Please sign in again.'
      });
    }
    return res.status(401).json({
      message: 'Invalid authentication token.'
    });
  }
}

/**
 * Helper to generate JWT token for a user.
 */
function generateToken(user, expiresIn = '8h') {
  return jwt.sign(
    {
      jti: crypto.randomUUID(),
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      tokenVersion: user.tokenVersion || 1
    },
    JWT_SECRET,
    { expiresIn }
  );
}

/**
 * Helper to set HTTP-only authentication cookie on response.
 */
function setAuthCookie(res, token) {
  res.cookie('examvault_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  });
}

/**
 * Helper to clear HTTP-only authentication cookie on response.
 */
function clearAuthCookie(res) {
  res.clearCookie('examvault_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
}

module.exports = {
  authenticateToken,
  generateToken,
  setAuthCookie,
  clearAuthCookie
};
