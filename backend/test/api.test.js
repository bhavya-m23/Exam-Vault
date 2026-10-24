const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const TEST_API_DB = path.resolve(__dirname, 'api_test.db');
process.env.DATABASE_PATH = TEST_API_DB;
process.env.PORT = '5099';

function cleanup() {
  if (fs.existsSync(TEST_API_DB)) fs.unlinkSync(TEST_API_DB);
  if (fs.existsSync(TEST_API_DB + '-wal')) fs.unlinkSync(TEST_API_DB + '-wal');
  if (fs.existsSync(TEST_API_DB + '-shm')) fs.unlinkSync(TEST_API_DB + '-shm');
}

cleanup();

// Require app without listening directly or listen on 5099
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDb, closeDb } = require('../db');

initDb(TEST_API_DB);

const authRoute = require('../routes/auth');
const documentsRoute = require('../routes/documents');
const policiesRoute = require('../routes/policies');
const auditRoute = require('../routes/audit');
const securityRoute = require('../routes/security');
const accessRoute = require('../routes/access');
const usersRoute = require('../routes/users');

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoute);
app.use('/api/documents', documentsRoute);
app.use('/api/policies', policiesRoute);
app.use('/api/audit', auditRoute);
app.use('/api/security', securityRoute);
app.use('/api/access', accessRoute);
app.use('/api/users', usersRoute);
app.get('/', (req, res) => res.json({ status: "Running" }));

let server;
let authToken = null;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      ...headers
    };
    const req = http.request({
      hostname: 'localhost',
      port: 5099,
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runApiTests() {
  console.log('====================================================');
  console.log(' Running ExamVault HTTP API Integration Tests');
  console.log('====================================================\n');

  await new Promise((resolve) => {
    server = app.listen(5099, resolve);
  });

  try {
    // 1. Health check (Public)
    const rRoot = await request('GET', '/');
    assert.strictEqual(rRoot.status, 200);
    assert.strictEqual(rRoot.data.status, 'Running');
    console.log('✓ GET / -> Health check passed');

    // 1b. Authenticate as Administrator
    const rLogin = await request('POST', '/api/auth/login', {
      email: 'admin@examvault.local',
      password: 'admin123'
    });
    assert.strictEqual(rLogin.status, 200);
    authToken = rLogin.data.token;
    console.log('✓ POST /api/auth/login -> Administrator logged in');

    // 2. Users
    const rUsers = await request('GET', '/api/users');
    assert.strictEqual(rUsers.status, 200);
    assert.strictEqual(rUsers.data.length, 5);
    console.log('✓ GET /api/users -> 5 seeded users returned');

    // 3. Documents List & Details
    const rDocs = await request('GET', '/api/documents');
    assert.strictEqual(rDocs.status, 200);
    assert.strictEqual(rDocs.data.length, 5);

    const rDoc1 = await request('GET', '/api/documents/DOC-001');
    assert.strictEqual(rDoc1.status, 200);
    assert.strictEqual(rDoc1.data.document.id, 'DOC-001');
    assert.strictEqual(rDoc1.data.document.isTampered, false);
    assert.ok(rDoc1.data.policy);
    assert.ok(Array.isArray(rDoc1.data.auditTrail));
    console.log('✓ GET /api/documents and /:id -> Document metadata and policy returned');

    // 4. Create Document
    const rCreateDoc = await request('POST', '/api/documents', {
      name: 'Compiler Design - Test.pdf',
      subject: 'Compiler Design',
      owner: 'Dr. Priya Sharma',
      ownerRole: 'Exam Coordinator',
      sensitivity: 'High'
    });
    assert.strictEqual(rCreateDoc.status, 201);
    assert.strictEqual(rCreateDoc.data.document.name, 'Compiler Design - Test.pdf');
    const createdDocId = rCreateDoc.data.document.id;
    console.log(`✓ POST /api/documents -> Created document ${createdDocId}`);

    // 5. Verify Integrity
    const rVerify = await request('POST', `/api/documents/${createdDocId}/verify`, {
      user: 'Dr. Priya Sharma',
      userRole: 'Exam Coordinator'
    });
    assert.strictEqual(rVerify.status, 200);
    assert.strictEqual(rVerify.data.verified, true);
    assert.strictEqual(rVerify.data.status, 'INTEGRITY_VERIFIED');
    console.log('✓ POST /api/documents/:id/verify -> Integrity verified successfully');

    // 6. Simulate Tampering
    const rTamper = await request('POST', `/api/documents/${createdDocId}/tamper`);
    assert.strictEqual(rTamper.status, 200);
    assert.strictEqual(rTamper.data.document.isTampered, true);
    assert.strictEqual(rTamper.data.document.status, 'Integrity Compromised');
    console.log('✓ POST /api/documents/:id/tamper -> Tamper simulated');

    // 7. Verify Integrity on Tampered Document
    const rVerifyTampered = await request('POST', `/api/documents/${createdDocId}/verify`, {
      user: 'Dr. Priya Sharma',
      userRole: 'Exam Coordinator'
    });
    assert.strictEqual(rVerifyTampered.status, 200);
    assert.strictEqual(rVerifyTampered.data.verified, false);
    assert.strictEqual(rVerifyTampered.data.status, 'INTEGRITY_COMPROMISED');
    console.log('✓ POST /api/documents/:id/verify on tampered document -> Detected compromise');

    // 8. Restore Document
    const rRestore = await request('POST', `/api/documents/${createdDocId}/restore`, {
      user: 'System Admin'
    });
    assert.strictEqual(rRestore.status, 200);
    assert.strictEqual(rRestore.data.document.isTampered, false);
    assert.strictEqual(rRestore.data.document.status, 'Protected');
    console.log('✓ POST /api/documents/:id/restore -> Restored to pristine state');

    // 9. Policies: List & Create
    const rPolicies = await request('GET', '/api/policies');
    assert.strictEqual(rPolicies.status, 200);
    assert.ok(rPolicies.data.length >= 6); // 5 seeded + 1 created with doc

    const rCreatePolicy = await request('POST', '/api/policies', {
      documentId: 'DOC-001',
      allowedRoles: ['Exam Evaluator', 'Administrator'],
      allowedActions: ['VIEW'],
      purpose: 'Evaluation',
      startTime: '09:00',
      endTime: '17:00'
    });
    assert.strictEqual(rCreatePolicy.status, 201);
    assert.ok(rCreatePolicy.data.policy.id);
    const newPolicyId = rCreatePolicy.data.policy.id;
    console.log(`✓ POST /api/policies -> Created policy ${newPolicyId}`);

    // 10. Update Policy
    const rUpdatePolicy = await request('PUT', `/api/policies/${newPolicyId}`, {
      status: 'Suspended'
    });
    assert.strictEqual(rUpdatePolicy.status, 200);
    assert.strictEqual(rUpdatePolicy.data.policy.status, 'Suspended');
    console.log('✓ PUT /api/policies/:id -> Updated policy status');

    // 11. Access Check (Context Engine)
    const rCheckAllowed = await request('POST', '/api/access/check', {
      userId: 'USR-002', // Dr. Priya Sharma
      documentId: 'DOC-001',
      action: 'VIEW',
      purpose: 'Exam Preparation'
    });
    assert.strictEqual(rCheckAllowed.status, 200);
    assert.strictEqual(rCheckAllowed.data.allowed, true);

    const rCheckBlocked = await request('POST', '/api/access/check', {
      userId: 'USR-003', // Akash G (Staff)
      documentId: 'DOC-002', // Computer Networks
      action: 'VIEW',
      purpose: 'Exam Preparation'
    });
    assert.strictEqual(rCheckBlocked.status, 200);
    assert.strictEqual(rCheckBlocked.data.allowed, false);
    console.log('✓ POST /api/access/check -> Scenario 1 (Blocked) and Scenario 2 (Allowed) verified');

    // 12. Security Events & Stats
    const rEvents = await request('GET', '/api/security/events');
    assert.strictEqual(rEvents.status, 200);
    assert.ok(rEvents.data.length >= 3);

    const rStats = await request('GET', '/api/security/stats');
    assert.strictEqual(rStats.status, 200);
    assert.ok(typeof rStats.data.protectedDocuments === 'number');
    assert.ok(typeof rStats.data.blockedAttempts === 'number');
    assert.ok(typeof rStats.data.integrityPercentage === 'string');
    console.log('✓ GET /api/security/events and /stats -> Accurate metrics returned');

    // 13. Review Security Event
    const firstEventId = rEvents.data[0].id;
    const rReview = await request('PUT', `/api/security/events/${firstEventId}/review`, {
      user: 'System Admin',
      status: 'Reviewed'
    });
    assert.strictEqual(rReview.status, 200);
    assert.strictEqual(rReview.data.event.status, 'Reviewed');
    console.log(`✓ PUT /api/security/events/:id/review -> Event marked as Reviewed`);

    // 14. Audit Logs
    const rAudit = await request('GET', '/api/audit?filter=BLOCKED');
    assert.strictEqual(rAudit.status, 200);
    assert.ok(rAudit.data.every(l => l.result === 'BLOCKED'));
    console.log('✓ GET /api/audit?filter=BLOCKED -> Filtering verified');

    console.log('\n====================================================');
    console.log(' ALL 14 HTTP API INTEGRATION TESTS PASSED!');
    console.log('====================================================');
  } finally {
    if (server) server.close();
    closeDb();
    cleanup();
  }
}

runApiTests().catch((err) => {
  console.error('\n❌ API Test Failure:', err);
  if (server) server.close();
  closeDb();
  cleanup();
  process.exit(1);
});
