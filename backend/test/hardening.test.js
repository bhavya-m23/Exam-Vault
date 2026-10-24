const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const TEST_HARDENING_DB = path.resolve(__dirname, 'hardening_test.db');
process.env.DATABASE_PATH = TEST_HARDENING_DB;
process.env.PORT = '5096';
process.env.JWT_SECRET = 'test-suite-secure-jwt-secret-key-32chars';
process.env.ENABLE_DEMO_SWITCH = 'true';
process.env.LOGIN_RATE_LIMIT_MAX = '5'; // Trigger rate limit on 5th failed attempt

function cleanup() {
  if (fs.existsSync(TEST_HARDENING_DB)) fs.unlinkSync(TEST_HARDENING_DB);
  if (fs.existsSync(TEST_HARDENING_DB + '-wal')) fs.unlinkSync(TEST_HARDENING_DB + '-wal');
  if (fs.existsSync(TEST_HARDENING_DB + '-shm')) fs.unlinkSync(TEST_HARDENING_DB + '-shm');
}

cleanup();

const { initDb, closeDb, getDb } = require('../db');
initDb(TEST_HARDENING_DB);

const app = require('../server');
let server;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 5096,
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

function extractCookie(cookieHeaders) {
  if (!cookieHeaders || !cookieHeaders.length) return null;
  const cookieStr = cookieHeaders[0];
  const match = cookieStr.match(/examvault_token=([^;]+)/);
  return match ? match[1] : null;
}

async function runHardeningTests() {
  console.log('====================================================');
  console.log(' Running Phase 2.1 Security Hardening Tests');
  console.log('====================================================\n');

  await new Promise((resolve) => {
    server = app.listen(5096, resolve);
  });

  try {
    // ----------------------------------------------------
    // Section A: Document Authorization & Data Leakage
    // ----------------------------------------------------
    console.log('Section A: Document Authorization & Data Leakage...');

    // Log in as Staff (Akash G) and Admin (System Admin)
    const rStaffLogin = await request('POST', '/api/auth/login', {
      email: 'akash.g@university.edu',
      password: 'admin123'
    });
    assert.strictEqual(rStaffLogin.status, 200);
    const staffToken = rStaffLogin.data.token;

    const rAdminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@examvault.local',
      password: 'admin123'
    });
    assert.strictEqual(rAdminLogin.status, 200);
    const adminToken = rAdminLogin.data.token;

    // A.1: Document listings do not expose raw confidential content
    const rDocList = await request('GET', '/api/documents', null, {
      'Authorization': `Bearer ${staffToken}`
    });
    assert.strictEqual(rDocList.status, 200);
    assert.ok(rDocList.data.length >= 5);
    for (const doc of rDocList.data) {
      assert.strictEqual(doc.content, undefined, `Document ${doc.id} listing must not expose raw content`);
      assert.ok(doc.id && doc.name && doc.fingerprint);
    }
    console.log('  ✓ Document listings return safe metadata and omit raw confidential content');

    // A.2: Unauthorized Staff cannot retrieve confidential document (DOC-004: Admin only)
    const rStaffDoc4 = await request('GET', '/api/documents/DOC-004', null, {
      'Authorization': `Bearer ${staffToken}`
    });
    assert.strictEqual(rStaffDoc4.status, 403, 'Staff must be blocked from DOC-004');
    assert.strictEqual(rStaffDoc4.data.document, undefined, 'Unauthorized response must not leak document object');
    assert.strictEqual(rStaffDoc4.data.policy, undefined, 'Unauthorized response must not leak policy object');
    assert.strictEqual(rStaffDoc4.data.auditTrail, undefined, 'Unauthorized response must not leak audit trail');
    console.log('  ✓ Unauthorized Staff blocked from DOC-004 with 403 (no content/policy/audit leak)');

    // A.3: Authorized Administrator can retrieve permitted document
    const rAdminDoc4 = await request('GET', '/api/documents/DOC-004', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rAdminDoc4.status, 200, 'Admin must be authorized for DOC-004');
    assert.ok(rAdminDoc4.data.document && rAdminDoc4.data.document.content, 'Authorized response contains document content');
    assert.ok(rAdminDoc4.data.policy, 'Authorized response contains policy');
    assert.ok(Array.isArray(rAdminDoc4.data.auditTrail), 'Authorized response contains audit trail');
    console.log('  ✓ Authorized Administrator can retrieve DOC-004 with full details');

    // A.4: Missing document returns 404
    const rMissing = await request('GET', '/api/documents/DOC-NONEXISTENT', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rMissing.status, 404);
    assert.ok(rMissing.data.message.includes('not found'));
    console.log('  ✓ Missing document returns 404 Not Found');

    // ----------------------------------------------------
    // Section B: Access-Check Identity Spoofing & Simulation Controls
    // ----------------------------------------------------
    console.log('\nSection B: Access-Check Identity Spoofing & Simulation Controls...');

    // B.1: Genuine check derives actor from authenticated token
    const rGenuineCheck = await request('POST', '/api/access/check', {
      documentId: 'DOC-001',
      action: 'VIEW'
    }, {
      'Authorization': `Bearer ${staffToken}`
    });
    assert.strictEqual(rGenuineCheck.status, 200);
    assert.strictEqual(rGenuineCheck.data.allowed, false, 'Staff should be blocked from DOC-001 under POL-001');

    // Verify audit log has Akash G as genuine actor
    const db = getDb();
    const lastAudit = db.prepare('SELECT * FROM audit_logs ORDER BY rowid DESC LIMIT 1;').get();
    assert.strictEqual(lastAudit.user, 'Akash G', 'Audit log must record authenticated user');
    assert.strictEqual(lastAudit.userRole, 'Staff');
    assert.strictEqual(lastAudit.action, 'DOCUMENT_VIEW');
    console.log('  ✓ Genuine access check attributes actual authenticated actor in audit log');

    // B.2: Non-operator (Staff) attempts simulation -> 403 Forbidden
    const rStaffSpoof = await request('POST', '/api/access/check', {
      userId: 'USR-001', // Trying to simulate or spoof System Admin
      documentId: 'DOC-001',
      action: 'VIEW'
    }, {
      'Authorization': `Bearer ${staffToken}`
    });
    assert.strictEqual(rStaffSpoof.status, 403, 'Staff must be blocked from running simulation');
    assert.ok(rStaffSpoof.data.message.includes('not permitted to execute access simulations'));
    console.log('  ✓ Non-operator (Staff) denied simulation capabilities with 403');

    // B.3: Authorized operator (Administrator) runs simulation
    const rAdminSim = await request('POST', '/api/access/check', {
      userId: 'USR-003', // Akash G
      documentId: 'DOC-002', // Computer Networks
      action: 'VIEW',
      purpose: 'Exam Preparation'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rAdminSim.status, 200);
    assert.strictEqual(rAdminSim.data.isSimulation, true);
    assert.strictEqual(rAdminSim.data.operator, 'System Admin');
    assert.strictEqual(rAdminSim.data.simulatedPersona, 'Akash G');

    // Verify simulation audit record is explicitly labeled
    const simAudit = db.prepare("SELECT * FROM audit_logs WHERE action = 'SIMULATION_ACCESS_CHECK' ORDER BY rowid DESC LIMIT 1;").get();
    assert.ok(simAudit, 'Simulation audit log must exist');
    assert.strictEqual(simAudit.user, 'System Admin', 'Audit actor must be the operator');
    assert.strictEqual(simAudit.userRole, 'Administrator');
    assert.ok(simAudit.reason.includes('[SIMULATION for Akash G'), 'Reason must explicitly note simulated persona');
    console.log('  ✓ Operator simulation explicitly labeled with operator identity and target persona');

    // B.4: Simulation unavailable when disabled
    process.env.ENABLE_DEMO_SWITCH = 'false';
    const rDisabledSim = await request('POST', '/api/access/check', {
      userId: 'USR-003',
      documentId: 'DOC-002'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rDisabledSim.status, 403);
    assert.ok(rDisabledSim.data.message.includes('disabled in this environment'));
    process.env.ENABLE_DEMO_SWITCH = 'true';
    console.log('  ✓ Simulation rejected when demo feature is disabled in environment');

    // ----------------------------------------------------
    // Section C: Session Security & Server-Side Token Revocation
    // ----------------------------------------------------
    console.log('\nSection C: Session Security & Server-Side Token Revocation...');

    // Log in user 1 (Dr. Priya Sharma) and user 2 (Prof. Rahul Kumar)
    const rPriyaLogin = await request('POST', '/api/auth/login', {
      email: 'priya.sharma@university.edu',
      password: 'admin123'
    });
    assert.strictEqual(rPriyaLogin.status, 200);
    const priyaToken = rPriyaLogin.data.token;

    const rRahulLogin = await request('POST', '/api/auth/login', {
      email: 'rahul.kumar@university.edu',
      password: 'admin123'
    });
    assert.strictEqual(rRahulLogin.status, 200);
    const rahulToken = rRahulLogin.data.token;

    // Both users can access /api/auth/me
    const rPriyaMe = await request('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${priyaToken}`
    });
    assert.strictEqual(rPriyaMe.status, 200);
    assert.strictEqual(rPriyaMe.data.user.name, 'Dr. Priya Sharma');

    const rRahulMe = await request('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${rahulToken}`
    });
    assert.strictEqual(rRahulMe.status, 200);
    assert.strictEqual(rRahulMe.data.user.name, 'Prof. Rahul Kumar');

    // Priya logs out
    const rPriyaLogout = await request('POST', '/api/auth/logout', null, {
      'Authorization': `Bearer ${priyaToken}`
    });
    assert.strictEqual(rPriyaLogout.status, 200);
    console.log('  ✓ Priya logged out successfully');

    // Priya's token MUST be rejected server-side even before JWT expiry!
    const rPriyaAfterLogout = await request('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${priyaToken}`
    });
    assert.strictEqual(rPriyaAfterLogout.status, 401, 'Revoked token must be rejected');
    assert.ok(rPriyaAfterLogout.data.message.includes('Session has been invalidated'));
    console.log('  ✓ Revoked token rejected with 401 Session Invalidated (server-side revocation active)');

    // Rahul's session MUST remain completely unaffected!
    const rRahulAfterPriyaLogout = await request('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${rahulToken}`
    });
    assert.strictEqual(rRahulAfterPriyaLogout.status, 200, "Other user's session must remain active");
    assert.strictEqual(rRahulAfterPriyaLogout.data.user.name, 'Prof. Rahul Kumar');
    console.log("  ✓ Rahul's session remains fully valid (revocation is isolated per session)");

    // ----------------------------------------------------
    // Section D: CSRF Protection Verification
    // ----------------------------------------------------
    console.log('\nSection D: CSRF Protection Verification...');

    // Attempt a state-changing POST with cookie auth but form content-type and missing custom header
    const rCsrfAttack = await request('POST', '/api/documents', {
      name: 'Forged CSRF Document',
      subject: 'CSRF'
    }, {
      'Cookie': `examvault_token=${adminToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': '' // Intentionally stripped
    });
    assert.strictEqual(rCsrfAttack.status, 403, 'Cross-origin simple form POST with cookie must be rejected');
    assert.ok(rCsrfAttack.data.message.includes('CSRF validation failed'));
    console.log('  ✓ Cross-origin form submission without custom header rejected by CSRF protection');

    // ----------------------------------------------------
    // Section E: Login Rate Limiting
    // ----------------------------------------------------
    console.log('\nSection E: Login Rate Limiting...');

    // Attempt repeated failed logins from client IP until 429
    let rateLimited = false;
    for (let i = 0; i < 7; i++) {
      const res = await request('POST', '/api/auth/login', {
        email: 'attacker@evil.com',
        password: 'wrongpassword'
      });
      if (res.status === 429) {
        rateLimited = true;
        assert.ok(res.data.message.includes('Too many failed login attempts'));
        break;
      }
    }
    assert.ok(rateLimited, 'Repeated failed login attempts must trigger HTTP 429');
    console.log('  ✓ Rate limiter triggers HTTP 429 Too Many Requests on repeated failed logins');

    console.log('\n====================================================');
    console.log(' ALL PHASE 2.1 SECURITY HARDENING TESTS PASSED!');
    console.log('====================================================');
  } finally {
    if (server) server.close();
    closeDb();
    cleanup();
  }
}

runHardeningTests().catch((err) => {
  console.error('\n❌ Hardening Test Failure:', err);
  if (server) server.close();
  closeDb();
  cleanup();
  process.exit(1);
});
