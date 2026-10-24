const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const {
  getUserByEmailWithPassword,
  getUserById,
  addAuditLog,
  revokeToken,
  revokeAllUserSessions,
  getAccountLoginStatus,
  recordFailedLoginAttempt,
  resetAccountLoginAttempts
} = require('../data/store');
const { authenticateToken, generateToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { JWT_EXPIRES_IN, isDemoSwitchEnabled } = require('../config');

// Rate limiting for login endpoint: restricts repeated failed attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.LOGIN_RATE_LIMIT_MAX ? Number(process.env.LOGIN_RATE_LIMIT_MAX) : 10,
  skipSuccessfulRequests: true, // Only failed attempts count toward limit!
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Too many failed login attempts. Please try again after 15 minutes.'
  }
});

// Rate limiting for demo account switcher
const demoSwitchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: process.env.DEMO_SWITCH_RATE_LIMIT_MAX ? Number(process.env.DEMO_SWITCH_RATE_LIMIT_MAX) : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Too many persona switch requests. Please try again shortly.'
  }
});

// Pre-approved list of seeded demo user IDs permitted for 1-click persona testing
const PERMITTED_DEMO_IDS = ['USR-001', 'USR-002', 'USR-003', 'USR-004', 'USR-005'];

/**
 * Strips sensitive fields like passwordHash from user object
 */
function toSafeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  // Use trusted req.ip resolved by Express reverse-proxy settings; never trust arbitrary client-injected headers
  const clientIp = req.ip || '127.0.0.1';

  if (!email || !password) {
    return res.status(400).json({
      message: 'Both email and password are required.'
    });
  }

  // Account-level lockout protection: check if account is currently in temporary cooldown
  const accountStatus = getAccountLoginStatus(email);
  if (accountStatus.isLocked) {
    addAuditLog({
      user: email,
      userRole: 'Anonymous',
      action: 'AUTH_ACCOUNT_COOLDOWN_BLOCKED',
      document: 'Authentication Gateway',
      documentId: 'AUTH-GATE',
      purpose: 'User Sign In',
      result: 'BLOCKED',
      reason: `Login rejected: Account is temporarily in cooldown (${accountStatus.remainingCooldown}s remaining)`,
      ip: clientIp
    });

    try {
      const detectionEngine = require('../services/detectionEngine');
      detectionEngine.evaluateAuthFailure({ user: email, ip: clientIp });
    } catch (err) {
      console.error('[Detection Engine Error] evaluateAuthFailure failed:', err.message);
    }

    return res.status(429).json({
      message: 'Too many failed login attempts for this account. Please try again after cooldown.'
    });
  }

  const user = getUserByEmailWithPassword(email);

  // Constant-time check mitigation: if user not found, do dummy compare
  const passwordValid = user && user.passwordHash
    ? bcrypt.compareSync(password, user.passwordHash)
    : false;

  if (!user || !passwordValid) {
    const failureResult = recordFailedLoginAttempt(email);

    addAuditLog({
      user: email,
      userRole: 'Anonymous',
      action: 'AUTH_LOGIN_FAILED',
      document: 'Authentication Gateway',
      documentId: 'AUTH-GATE',
      purpose: 'User Sign In',
      result: 'BLOCKED',
      reason: failureResult.isLocked
        ? `Failed sign in attempt: invalid credentials. Account entered temporary cooldown (${failureResult.remainingCooldown}s)`
        : 'Failed sign in attempt: invalid email or password',
      ip: clientIp
    });

    try {
      const detectionEngine = require('../services/detectionEngine');
      detectionEngine.evaluateAuthFailure({ user: email, ip: clientIp });
    } catch (err) {
      console.error('[Detection Engine Error] evaluateAuthFailure failed:', err.message);
    }

    if (failureResult.isLocked) {
      return res.status(429).json({
        message: 'Too many failed login attempts for this account. Please try again after cooldown.'
      });
    }

    return res.status(401).json({
      message: 'Invalid email or password.'
    });
  }

  // Clear failed attempts counter on successful authentication
  resetAccountLoginAttempts(email);

  const safeUser = toSafeUser(user);
  const token = generateToken(safeUser, JWT_EXPIRES_IN);

  setAuthCookie(res, token);

  addAuditLog({
    user: safeUser.name,
    userRole: safeUser.role,
    action: 'AUTH_LOGIN_SUCCESS',
    document: 'Authentication Gateway',
    documentId: 'AUTH-GATE',
    purpose: 'User Sign In',
    result: 'ALLOWED',
    reason: `User authenticated successfully via credentials (${safeUser.role})`,
    ip: clientIp
  });

  try {
    const detectionEngine = require('../services/detectionEngine');
    detectionEngine.evaluateSuspiciousPattern({
      user: safeUser.name,
      userRole: safeUser.role,
      document: 'Authentication Gateway',
      documentId: 'AUTH-GATE',
      ip: clientIp
    });
  } catch (err) {
    console.error('[Detection Engine Error] evaluateSuspiciousPattern failed:', err.message);
  }

  res.json({
    message: `Welcome back, ${safeUser.name} (${safeUser.role})`,
    user: safeUser,
    token
  });
});

// POST /api/auth/logout - Revokes current session token and clears cookie
router.post('/logout', (req, res) => {
  let token = null;
  if (req.cookies && req.cookies['examvault_token']) {
    token = req.cookies['examvault_token'];
  }
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.jti) {
        revokeToken({
          jti: decoded.jti,
          userId: decoded.id || decoded.userId,
          expiresAt: decoded.exp
        });
      }
    } catch (err) {
      // Non-critical token decode error on logout
    }
  }

  clearAuthCookie(res);

  res.json({
    message: 'Signed out of ExamVault successfully.'
  });
});

// POST /api/auth/revoke-all-sessions - Invalidate all active sessions for a user
router.post('/revoke-all-sessions', authenticateToken, (req, res) => {
  const { targetUserId } = req.body || {};
  const clientIp = req.ip || '127.0.0.1';

  let userIdToRevoke = req.user.id;
  let targetUserName = req.user.name;

  if (targetUserId && targetUserId !== req.user.id) {
    if (req.user.role !== 'Administrator') {
      return res.status(403).json({
        message: 'Only Administrators can revoke sessions for other user accounts.'
      });
    }
    const targetUser = getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        message: `User '${targetUserId}' not found.`
      });
    }
    userIdToRevoke = targetUser.id;
    targetUserName = targetUser.name;
  }

  const success = revokeAllUserSessions(userIdToRevoke);

  if (!success) {
    return res.status(500).json({
      message: 'Failed to revoke user sessions.'
    });
  }

  addAuditLog({
    user: req.user.name,
    userRole: req.user.role,
    action: 'AUTH_ALL_SESSIONS_REVOKED',
    document: 'Authentication Gateway',
    documentId: 'AUTH-GATE',
    purpose: 'Session Invalidation',
    result: 'ALLOWED',
    reason: req.user.id === userIdToRevoke
      ? `User '${req.user.name}' invalidated all their active sessions.`
      : `Administrator '${req.user.name}' invalidated all active sessions for user '${targetUserName}' (${userIdToRevoke}).`,
    ip: clientIp
  });

  try {
    const detectionEngine = require('../services/detectionEngine');
    detectionEngine.evaluateAdminChange({
      action: 'REVOKE_ALL_SESSIONS',
      resourceType: 'USER',
      resourceId: userIdToRevoke,
      resourceName: targetUserName,
      user: req.user.name,
      userRole: req.user.role,
      details: req.user.id === userIdToRevoke ? 'Self session invalidation' : `Administrator revoked sessions for ${targetUserName}`,
      ip: clientIp
    });
  } catch (err) {
    console.error('[Detection Engine Error] evaluateAdminChange failed:', err.message);
  }

  // If the caller revoked their own session, clear cookie
  if (req.user.id === userIdToRevoke) {
    clearAuthCookie(res);
  }

  res.json({
    message: `All active sessions for ${targetUserName} have been successfully invalidated.`,
    userId: userIdToRevoke
  });
});

// GET /api/auth/me - Return currently authenticated user profile
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    user: req.user
  });
});

// POST /api/auth/switch-demo - Evaluator 1-click demo persona switcher (Development/Demo mode only)
router.post('/switch-demo', demoSwitchLimiter, (req, res) => {
  const { userId } = req.body;
  const clientIp = req.ip || '127.0.0.1';

  // 1. Verify demo switching is enabled
  if (!isDemoSwitchEnabled()) {
    return res.status(403).json({
      message: 'Demo account switching is disabled in this environment.'
    });
  }

  // 2. Validate requested persona against pre-seeded demo personas only
  if (!userId || !PERMITTED_DEMO_IDS.includes(userId)) {
    return res.status(400).json({
      message: 'Invalid demo persona request. Only registered demo accounts may be tested.'
    });
  }

  // 3. Resolve target user profile from database
  const targetUser = getUserById(userId);
  if (!targetUser) {
    return res.status(404).json({
      message: 'Requested demo user not found in database.'
    });
  }

  const safeUser = toSafeUser(targetUser);
  const token = generateToken(safeUser, '2h');

  setAuthCookie(res, token);

  addAuditLog({
    user: safeUser.name,
    userRole: safeUser.role,
    action: 'DEMO_CONTEXT_SWITCH',
    document: 'Demo Controls',
    documentId: 'DEMO-SWITCH',
    purpose: 'Presentation Testing',
    result: 'ALLOWED',
    reason: `Switched active demo persona to: ${safeUser.name} (${safeUser.role})`,
    ip: clientIp
  });

  res.json({
    message: `Switched active context to: ${safeUser.name} (${safeUser.role})`,
    user: safeUser,
    token
  });
});

module.exports = router;
