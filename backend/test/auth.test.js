const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const TEST_AUTH_DB = path.resolve(__dirname, 'auth_test.db');
process.env.DATABASE_PATH = TEST_AUTH_DB;
process.env.PORT = '5098';
process.env.JWT_SECRET = 'test-suite-secure-jwt-secret-key-32chars';
process.env.ENABLE_DEMO_SWITCH = 'true';

function cleanup() {
  if (fs.existsSync(TEST_AUTH_DB)) fs.unlinkSync(TEST_AUTH_DB);
  if (fs.existsSync(TEST_AUTH_DB + '-wal')) fs.unlinkSync(TEST_AUTH_DB + '-wal');
  if (fs.existsSync(TEST_AUTH_DB + '-shm')) fs.unlinkSync(TEST_AUTH_DB + '-shm');
}

cleanup();

const { initDb, closeDb } = require('../db');
initDb(TEST_AUTH_DB);

const app = require('../server');
let server;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 5098,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
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

function extractCookie(cookieHeaders) {
  if (!cookieHeaders || !cookieHeaders.length) return null;
  const cookieStr = cookieHeaders[0];
  const match = cookieStr.match(/examvault_token=([^;]+)/);
  return match ? match[1] : null;
}

async function runAuthTests() {
  console.log('====================================================');
  console.log(' Running Phase 2 Authentication & Protection Tests');
  console.log('====================================================\n');

  await new Promise((resolve) => {
    server = app.listen(5098, resolve);
  });

  try {
    // ----------------------------------------------------
    // 1. Password Verification & Login
    // ----------------------------------------------------
    console.log('Test 1: Correct credentials succeed and issue token/cookie...');
    const rAdminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@examvault.local',
      password: 'admin123'
    });
    assert.strictEqual(rAdminLogin.status, 200);
    assert.strictEqual(rAdminLogin.data.user.email, 'admin@examvault.local');
    assert.strictEqual(rAdminLogin.data.user.role, 'Administrator');
    assert.strictEqual(rAdminLogin.data.user.passwordHash, undefined, 'Password hash must never be returned');
    assert.ok(rAdminLogin.data.token, 'Token must be returned');
    assert.ok(rAdminLogin.cookies, 'Set-Cookie header must be present');
    assert.ok(rAdminLogin.cookies[0].includes('HttpOnly'), 'Cookie must be HttpOnly');
    const adminToken = rAdminLogin.data.token;
    console.log('  ✓ Admin login verified with HTTP-only cookie and safe profile');

    console.log('\nTest 2: All 5 demo personas authenticate with admin123...');
    const demoEmails = [
      'admin@examvault.local',
      'priya.sharma@university.edu',
      'akash.g@university.edu',
      'rahul.kumar@university.edu',
      'anitha.rao@university.edu'
    ];
    for (const email of demoEmails) {
      const res = await request('POST', '/api/auth/login', { email, password: 'admin123' });
      assert.strictEqual(res.status, 200, `Login should succeed for demo user ${email}`);
      assert.strictEqual(res.data.user.passwordHash, undefined);
    }
    console.log('  ✓ All 5 seeded demo accounts successfully authenticate with admin123');

    console.log('\nTest 3: Incorrect password fails...');
    const rBadPass = await request('POST', '/api/auth/login', {
      email: 'admin@examvault.local',
      password: 'wrongpassword'
    });
    assert.strictEqual(rBadPass.status, 401);
    assert.ok(rBadPass.data.message.includes('Invalid email or password'));
    console.log('  ✓ Incorrect password rejected with 401 Unauthorized');

    console.log('\nTest 4: Unknown email fails...');
    const rBadEmail = await request('POST', '/api/auth/login', {
      email: 'intruder@hacker.io',
      password: 'admin123'
    });
    assert.strictEqual(rBadEmail.status, 401);
    assert.ok(rBadEmail.data.message.includes('Invalid email or password'));
    console.log('  ✓ Unknown email rejected with 401 Unauthorized');

    // ----------------------------------------------------
    // 2. Protected Routes (Missing / Invalid / Expired Tokens)
    // ----------------------------------------------------
    console.log('\nTest 5: Missing token cannot access protected endpoints...');
    const protectedPaths = [
      ['GET', '/api/documents'],
      ['GET', '/api/users'],
      ['GET', '/api/policies'],
      ['GET', '/api/audit'],
      ['GET', '/api/security/events'],
      ['POST', '/api/access/check']
    ];
    for (const [m, p] of protectedPaths) {
      const r = await request(m, p);
      assert.strictEqual(r.status, 401, `Endpoint ${m} ${p} must reject unauthenticated requests`);
      assert.ok(r.data.message.includes('Authentication required'));
    }
    console.log('  ✓ All sensitive endpoints reject unauthenticated requests with 401');

    console.log('\nTest 6: Invalid and expired tokens are rejected...');
    const rForged = await request('GET', '/api/documents', null, {
      'Authorization': 'Bearer forged.tampered.token'
    });
    assert.strictEqual(rForged.status, 401);
    assert.ok(rForged.data.message.includes('Invalid authentication token'));

    // Create an expired token (expired 10 seconds ago)
    const expiredToken = jwt.sign(
      { id: 'USR-001', name: 'System Admin', email: 'admin@examvault.local', role: 'Administrator' },
      process.env.JWT_SECRET,
      { expiresIn: '-10s' }
    );
    const rExpired = await request('GET', '/api/documents', null, {
      'Authorization': `Bearer ${expiredToken}`
    });
    assert.strictEqual(rExpired.status, 401);
    assert.ok(rExpired.data.message.includes('Session expired'));
    console.log('  ✓ Forged and expired tokens correctly rejected with 401');

    // ----------------------------------------------------
    // 3. Identity Enforcement (Cannot Spoof in Request Body)
    // ----------------------------------------------------
    console.log('\nTest 7: Server-side identity enforcement prevents identity spoofing...');
    // Log in as Dr. Priya Sharma (Exam Coordinator)
    const rPriyaLogin = await request('POST', '/api/auth/login', {
      email: 'priya.sharma@university.edu',
      password: 'admin123'
    });
    const priyaToken = rPriyaLogin.data.token;

    // Try to spoof owner as System Admin in request body
    const rUpload = await request('POST', '/api/documents', {
      name: 'Advanced Security Paper.pdf',
      subject: 'Cybersecurity',
      sensitivity: 'High',
      owner: 'ATTACKER_SPOOFED_ADMIN',
      ownerRole: 'Administrator'
    }, {
      'Authorization': `Bearer ${priyaToken}`
    });

    assert.strictEqual(rUpload.status, 201);
    assert.strictEqual(rUpload.data.document.owner, 'Dr. Priya Sharma', 'Owner must resolve from authenticated token');
    assert.strictEqual(rUpload.data.document.ownerRole, 'Exam Coordinator', 'OwnerRole must resolve from authenticated token');
    console.log('  ✓ Request body owner spoofing ignored; identity strictly resolved from server token');

    // ----------------------------------------------------
    // 4. Role-Based Access Control (RBAC)
    // ----------------------------------------------------
    console.log('\nTest 8: RBAC enforces role permissions (Staff cannot perform Admin actions)...');
    // Log in as Akash G (Staff)
    const rStaffLogin = await request('POST', '/api/auth/login', {
      email: 'akash.g@university.edu',
      password: 'admin123'
    });
    const staffToken = rStaffLogin.data.token;

    // Staff tries to create a policy -> 403 Forbidden
    const rStaffPolicy = await request('POST', '/api/policies', {
      documentId: 'DOC-001',
      allowedRoles: ['Staff'],
      allowedActions: ['VIEW']
    }, {
      'Authorization': `Bearer ${staffToken}`
    });
    assert.strictEqual(rStaffPolicy.status, 403, 'Staff must be blocked from creating policies');

    // Staff tries to review security event -> 403 Forbidden
    const rStaffReview = await request('PUT', '/api/security/events/SEC-001/review', {
      status: 'Reviewed'
    }, {
      'Authorization': `Bearer ${staffToken}`
    });
    assert.strictEqual(rStaffReview.status, 403, 'Staff must be blocked from reviewing security events');

    // Staff tries to tamper with document -> 403 Forbidden
    const rStaffTamper = await request('POST', '/api/documents/DOC-001/tamper', null, {
      'Authorization': `Bearer ${staffToken}`
    });
    assert.strictEqual(rStaffTamper.status, 403, 'Staff must be blocked from tampering simulation');

    // Staff tries to restore document -> 403 Forbidden
    const rStaffRestore = await request('POST', '/api/documents/DOC-001/restore', null, {
      'Authorization': `Bearer ${staffToken}`
    });
    assert.strictEqual(rStaffRestore.status, 403, 'Staff must be blocked from restoring documents');

    // Admin CAN review security event -> 200 OK
    const rAdminReview = await request('PUT', '/api/security/events/SEC-001/review', {
      status: 'Reviewed'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rAdminReview.status, 200, 'Admin can review security events');
    console.log('  ✓ Role-based permissions strictly enforced (Staff blocked from admin actions, Admin allowed)');

    // ----------------------------------------------------
    // 5. Demo Account Switching Controls
    // ----------------------------------------------------
    console.log('\nTest 9: Demo account switcher controls...');
    // Switch to Rahul Kumar (USR-004)
    const rSwitch = await request('POST', '/api/auth/switch-demo', {
      userId: 'USR-004'
    });
    assert.strictEqual(rSwitch.status, 200);
    assert.strictEqual(rSwitch.data.user.name, 'Prof. Rahul Kumar');
    assert.strictEqual(rSwitch.data.user.role, 'Course Instructor');
    assert.strictEqual(rSwitch.data.user.passwordHash, undefined);
    assert.ok(rSwitch.data.token);

    // Attempt to switch to an unauthorized non-demo persona ID
    const rBadSwitch = await request('POST', '/api/auth/switch-demo', {
      userId: 'USR-999-HACKER'
    });
    assert.strictEqual(rBadSwitch.status, 400);
    assert.ok(rBadSwitch.data.message.includes('Invalid demo persona request'));

    // Test disabling demo switcher
    process.env.ENABLE_DEMO_SWITCH = 'false';
    const rDisabledSwitch = await request('POST', '/api/auth/switch-demo', {
      userId: 'USR-001'
    });
    assert.strictEqual(rDisabledSwitch.status, 403);
    assert.ok(rDisabledSwitch.data.message.includes('disabled in this environment'));
    process.env.ENABLE_DEMO_SWITCH = 'true';
    console.log('  ✓ Demo persona switcher works for permitted personas and rejects invalid personas / disabled mode');

    // ----------------------------------------------------
    // 6. Current User Profile (/api/auth/me) & Logout
    // ----------------------------------------------------
    console.log('\nTest 10: Current user profile (/api/auth/me) and logout...');
    const rMe = await request('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rMe.status, 200);
    assert.strictEqual(rMe.data.user.email, 'admin@examvault.local');
    assert.strictEqual(rMe.data.user.passwordHash, undefined);

    const rLogout = await request('POST', '/api/auth/logout');
    assert.strictEqual(rLogout.status, 200);
    assert.ok(rLogout.cookies, 'Set-Cookie header should be sent to clear cookie');
    console.log('  ✓ /api/auth/me returns clean profile and logout clears session cookie');

    console.log('\n====================================================');
    console.log(' ALL 10 AUTHENTICATION & SECURITY TESTS PASSED!');
    console.log('====================================================');
  } finally {
    if (server) server.close();
    closeDb();
    cleanup();
  }
}

runAuthTests().catch((err) => {
  console.error('\n❌ Auth Test Failure:', err);
  if (server) server.close();
  closeDb();
  cleanup();
  process.exit(1);
});
