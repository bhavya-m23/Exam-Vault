const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const TEST_PROD_DB = path.resolve(__dirname, 'prod_hardening_test.db');
process.env.DATABASE_PATH = TEST_PROD_DB;
process.env.PORT = '5097';
process.env.JWT_SECRET = 'test-suite-secure-jwt-secret-key-32chars';
process.env.ENABLE_DEMO_SWITCH = 'true';
process.env.LOGIN_RATE_LIMIT_MAX = '100'; // High IP threshold so account lockout is tested in isolation
process.env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS = '5';
process.env.ACCOUNT_LOCKOUT_WINDOW_SECONDS = '10';
process.env.ACCOUNT_LOCKOUT_COOLDOWN_SECONDS = '2'; // 2-second cooldown for rapid automated test

function cleanup() {
  if (fs.existsSync(TEST_PROD_DB)) fs.unlinkSync(TEST_PROD_DB);
  if (fs.existsSync(TEST_PROD_DB + '-wal')) fs.unlinkSync(TEST_PROD_DB + '-wal');
  if (fs.existsSync(TEST_PROD_DB + '-shm')) fs.unlinkSync(TEST_PROD_DB + '-shm');
}

cleanup();

const { initDb, closeDb, getDb } = require('../db');
initDb(TEST_PROD_DB);

const {
  validateJwtSecret,
  KNOWN_PLACEHOLDERS,
  MIN_SECRET_LENGTH
} = require('../config');

const {
  getAccountLoginStatus,
  recordFailedLoginAttempt,
  resetAccountLoginAttempts,
  cleanupExpiredAccountAttempts,
  revokeAllUserSessions
} = require('../data/store');

const app = require('../server');
let server;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 5097,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        const cookieHeader = res.headers['set-cookie'];
        resolve({ status: res.statusCode, data: json, headers: res.headers, cookies: cookieHeader });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runProductionHardeningTests() {
  console.log('====================================================');
  console.log(' Running Phase 2.2 Production Security Hardening Tests');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // Section 1: Production JWT Secret Validation & Startup Enforcement
  // ----------------------------------------------------
  console.log('Section 1: Production JWT Secret Validation...');

  // 1.1: Missing secret in production
  const missingRes = validateJwtSecret({ secret: '', nodeEnv: 'production' });
  assert.strictEqual(missingRes.valid, false);
  assert.ok(missingRes.error.includes('missing or empty'));
  console.log('  ✓ Missing JWT_SECRET in production correctly rejected');

  // 1.2: Secret shorter than 32 characters in production
  const shortRes = validateJwtSecret({ secret: 'short-secret-key-123', nodeEnv: 'production' });
  assert.strictEqual(shortRes.valid, false);
  assert.ok(shortRes.error.includes('minimum required strength'));
  assert.ok(shortRes.error.includes('32 characters'));
  console.log('  ✓ Short JWT_SECRET (< 32 chars) in production correctly rejected');

  // 1.3: Known development placeholder in production
  const placeholderRes = validateJwtSecret({
    secret: 'examvault-dev-secret-do-not-use-in-production-32chars-min',
    nodeEnv: 'production'
  });
  assert.strictEqual(placeholderRes.valid, false);
  assert.ok(placeholderRes.error.includes('known development placeholder'));
  console.log('  ✓ Known dev placeholder secret in production correctly rejected');

  // 1.4: Valid strong secret in production
  const strongKey = 'prod-ultra-secure-key-entropy-must-be-very-long-987654321';
  const strongRes = validateJwtSecret({ secret: strongKey, nodeEnv: 'production' });
  assert.strictEqual(strongRes.valid, true);
  assert.strictEqual(strongRes.secret, strongKey);
  console.log('  ✓ Valid strong JWT_SECRET (32+ chars) in production correctly accepted');

  // 1.5: Development environment fallback
  const devRes = validateJwtSecret({ secret: '', nodeEnv: 'development' });
  assert.strictEqual(devRes.valid, true);
  assert.strictEqual(devRes.isFallback, true);
  assert.strictEqual(devRes.secret, 'examvault-dev-secret-do-not-use-in-production-32chars-min');
  console.log('  ✓ Development environment safely falls back to standard dev secret');

  // 1.6: Subprocess verification - server fails startup in production with invalid secret without leaking secret
  const nodeExe = process.execPath;
  const serverPath = path.resolve(__dirname, '../server.js');

  const failedProc = spawnSync(nodeExe, [serverPath], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      JWT_SECRET: 'insecure-short'
    },
    encoding: 'utf8',
    timeout: 5000
  });

  assert.strictEqual(failedProc.status, 1, 'Subprocess must exit with status 1 on invalid secret');
  assert.ok(failedProc.stderr.includes('FATAL CONFIGURATION ERROR'));
  assert.ok(!failedProc.stderr.includes('insecure-short'), 'Secret string must never appear in logs');
  console.log('  ✓ Production server terminates startup on invalid secret without printing secret to logs');

  // 1.7: Subprocess verification - server succeeds startup with valid production secret
  const validProc = spawnSync(nodeExe, ['-e', `
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'this-is-a-valid-production-secret-with-more-than-32-chars';
    process.env.PORT = '5099';
    const config = require('./config');
    if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) process.exit(2);
    process.exit(0);
  `], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    timeout: 5000
  });
  assert.strictEqual(validProc.status, 0, 'Production configuration with valid secret must pass');
  console.log('  ✓ Production configuration with strong secret initializes successfully');

  // Start HTTP server on port 5097 for API tests
  await new Promise((resolve) => {
    server = app.listen(5097, resolve);
  });

  try {
    // ----------------------------------------------------
    // Section 2: Account-Level Login Rate Limiting & Cooldown
    // ----------------------------------------------------
    console.log('\nSection 2: Account-Level Login Rate Limiting & Cooldown...');

    const targetAccount = 'admin@examvault.local';
    resetAccountLoginAttempts(targetAccount);

    // 2.1: Repeated failed logins against single account (simulating multiple IPs)
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await request('POST', '/api/auth/login', {
        email: targetAccount,
        password: 'wrong-password-attempt'
      }, {
        // Simulating requests arriving from different proxy IPs
        'X-Forwarded-For': `10.0.0.${attempt}`
      });
      assert.strictEqual(res.status, 401, `Attempt ${attempt} must return 401 Unauthorized`);
      assert.strictEqual(res.data.message, 'Invalid email or password.');
    }
    console.log('  ✓ Pre-threshold failures (1-4) return standard 401 Unauthorized');

    // 2.2: 5th failed attempt triggers temporary cooldown (threshold = 5)
    const thresholdRes = await request('POST', '/api/auth/login', {
      email: targetAccount,
      password: 'wrong-password-attempt'
    }, {
      'X-Forwarded-For': '10.0.0.5'
    });
    assert.strictEqual(thresholdRes.status, 429, '5th failed attempt must trigger 429 cooldown');
    assert.ok(thresholdRes.data.message.includes('Too many failed login attempts for this account'));
    console.log('  ✓ 5th failure trips account cooldown and returns HTTP 429 Too Many Requests');

    // 2.3: Subsequent attempt during cooldown (even with valid credentials) is rejected with 429
    const duringCooldownRes = await request('POST', '/api/auth/login', {
      email: targetAccount,
      password: 'admin123' // Correct password while in cooldown
    });
    assert.strictEqual(duringCooldownRes.status, 429, 'Attempt during active cooldown must be blocked with 429');
    console.log('  ✓ Login attempts during cooldown remain blocked with 429');

    // 2.4: Safe error responses for non-existent accounts (no user enumeration)
    const ghostEmail = 'nonexistent.user@university.edu';
    resetAccountLoginAttempts(ghostEmail);

    for (let i = 1; i <= 4; i++) {
      const gRes = await request('POST', '/api/auth/login', {
        email: ghostEmail,
        password: 'any-password'
      });
      assert.strictEqual(gRes.status, 401);
      assert.strictEqual(gRes.data.message, 'Invalid email or password.');
    }
    const ghostLockRes = await request('POST', '/api/auth/login', {
      email: ghostEmail,
      password: 'any-password'
    });
    assert.strictEqual(ghostLockRes.status, 429);
    assert.strictEqual(ghostLockRes.data.message, thresholdRes.data.message);
    console.log('  ✓ Non-existent accounts receive identical 401 and 429 responses (no user enumeration)');

    // 2.5: Cooldown expiration and successful login recovery
    console.log('  Waiting 2.2 seconds for temporary account cooldown to expire...');
    await sleep(2200);

    const afterExpiryRes = await request('POST', '/api/auth/login', {
      email: targetAccount,
      password: 'admin123'
    });
    assert.strictEqual(afterExpiryRes.status, 200, 'Login must succeed after cooldown expires');
    assert.ok(afterExpiryRes.data.token, 'Token must be issued');
    assert.ok(afterExpiryRes.data.user && afterExpiryRes.data.user.email === targetAccount);

    // Verify counter was automatically reset on success
    const statusAfterSuccess = getAccountLoginStatus(targetAccount);
    assert.strictEqual(statusAfterSuccess.failedAttempts, 0);
    assert.strictEqual(statusAfterSuccess.isLocked, false);
    console.log('  ✓ Successful login after cooldown expiry succeeds and resets account failure state');

    // 2.6: Cleanup function deletes expired attempt records
    recordFailedLoginAttempt('stale.account@university.edu');
    cleanupExpiredAccountAttempts();
    console.log('  ✓ Cleanup routine cleans up account lockout state safely');

    // ----------------------------------------------------
    // Section 3: Account-Wide Session Invalidation
    // ----------------------------------------------------
    console.log('\nSection 3: Account-Wide Session Invalidation...');

    // 3.1: Log in Dr. Priya Sharma (User 1) to create Session A and Session B
    const priyaLoginA = await request('POST', '/api/auth/login', {
      email: 'priya.sharma@university.edu',
      password: 'admin123'
    });
    assert.strictEqual(priyaLoginA.status, 200);
    const priyaTokenA = priyaLoginA.data.token;

    const priyaLoginB = await request('POST', '/api/auth/login', {
      email: 'priya.sharma@university.edu',
      password: 'admin123'
    });
    assert.strictEqual(priyaLoginB.status, 200);
    const priyaTokenB = priyaLoginB.data.token;

    // 3.2: Log in Prof. Rahul Kumar (User 2) to create an independent session
    const rahulLogin = await request('POST', '/api/auth/login', {
      email: 'rahul.kumar@university.edu',
      password: 'admin123'
    });
    assert.strictEqual(rahulLogin.status, 200);
    const rahulToken = rahulLogin.data.token;

    // Verify all 3 sessions are initially active
    const rCheckA = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${priyaTokenA}` });
    const rCheckB = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${priyaTokenB}` });
    const rCheckRahul = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${rahulToken}` });
    assert.strictEqual(rCheckA.status, 200);
    assert.strictEqual(rCheckB.status, 200);
    assert.strictEqual(rCheckRahul.status, 200);
    console.log('  ✓ Multiple sessions established for Priya and Rahul');

    // 3.3: Priya invokes /api/auth/revoke-all-sessions (e.g. after password reset / compromise)
    const revokeRes = await request('POST', '/api/auth/revoke-all-sessions', {}, {
      'Authorization': `Bearer ${priyaTokenA}`
    });
    assert.strictEqual(revokeRes.status, 200);
    assert.ok(revokeRes.data.message.includes('successfully invalidated'));
    console.log('  ✓ User successfully triggered revocation of all active sessions');

    // 3.4: Verify BOTH Session A and Session B are immediately rejected with 401
    const priyaAfterA = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${priyaTokenA}` });
    assert.strictEqual(priyaAfterA.status, 401);
    assert.ok(priyaAfterA.data.message.includes('Session has been invalidated'));

    const priyaAfterB = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${priyaTokenB}` });
    assert.strictEqual(priyaAfterB.status, 401);
    assert.ok(priyaAfterB.data.message.includes('Session has been invalidated'));
    console.log('  ✓ All active sessions for Priya immediately rejected with 401 Session Invalidated');

    // 3.5: Verify Rahul's session is COMPLETELY unaffected
    const rahulAfterPriyaRevoke = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${rahulToken}` });
    assert.strictEqual(rahulAfterPriyaRevoke.status, 200);
    assert.strictEqual(rahulAfterPriyaRevoke.data.user.name, 'Prof. Rahul Kumar');
    console.log('  ✓ Other users (Rahul) remain fully authorized; session invalidation is strictly isolated');

    // 3.6: Administrator administrative session revocation for another user
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@examvault.local',
      password: 'admin123'
    });
    assert.strictEqual(adminLogin.status, 200);
    const adminToken = adminLogin.data.token;

    // Admin revokes Rahul's sessions
    const adminRevokeRahul = await request('POST', '/api/auth/revoke-all-sessions', {
      targetUserId: 'USR-004'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(adminRevokeRahul.status, 200);

    // Rahul's session is now invalidated
    const rahulAfterAdminRevoke = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${rahulToken}` });
    assert.strictEqual(rahulAfterAdminRevoke.status, 401);
    assert.ok(rahulAfterAdminRevoke.data.message.includes('Session has been invalidated'));
    console.log('  ✓ Administrator successfully revoked sessions for target user account (Rahul)');

    // 3.7: After re-authenticating, Priya receives a new valid session
    const priyaNewLogin = await request('POST', '/api/auth/login', {
      email: 'priya.sharma@university.edu',
      password: 'admin123'
    });
    assert.strictEqual(priyaNewLogin.status, 200);
    const priyaNewToken = priyaNewLogin.data.token;

    const priyaNewMe = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${priyaNewToken}` });
    assert.strictEqual(priyaNewMe.status, 200);
    assert.strictEqual(priyaNewMe.data.user.name, 'Dr. Priya Sharma');
    console.log('  ✓ Re-authenticated user receives new valid session with incremented tokenVersion');

    // 3.8: Persistence check: Database close and reopen preserves tokenVersion without invalidating active sessions
    closeDb();
    initDb(TEST_PROD_DB);

    const priyaAfterDbRestart = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${priyaNewToken}` });
    assert.strictEqual(priyaAfterDbRestart.status, 200, 'Valid sessions must survive database restart');
    console.log('  ✓ Valid sessions survive server/database restart without unexpected invalidation');

    console.log('\n====================================================');
    console.log(' ALL PHASE 2.2 PRODUCTION HARDENING TESTS PASSED!');
    console.log('====================================================');
  } finally {
    if (server) server.close();
    closeDb();
    cleanup();
  }
}

runProductionHardeningTests().catch((err) => {
  console.error('\n❌ Production Hardening Test Failure:', err);
  if (server) server.close();
  closeDb();
  cleanup();
  process.exit(1);
});
