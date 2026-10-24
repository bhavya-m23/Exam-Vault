const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const TEST_MONITORING_DB = path.resolve(__dirname, 'monitoring_test.db');
const TEST_MONITORING_STORAGE = path.resolve(__dirname, 'test_monitoring_storage');

process.env.DATABASE_PATH = TEST_MONITORING_DB;
process.env.STORAGE_DIR = TEST_MONITORING_STORAGE;
process.env.PORT = '5095';
process.env.JWT_SECRET = 'test-suite-secure-jwt-secret-key-32chars';
process.env.ENABLE_DEMO_SWITCH = 'true';
process.env.DETECTION_AUTH_FAIL_THRESHOLD = '3';
process.env.DETECTION_DOC_UNAUTH_THRESHOLD = '3';
process.env.ALLOW_DEMO_SIMULATION = 'true';

function cleanup() {
  if (fs.existsSync(TEST_MONITORING_DB)) fs.unlinkSync(TEST_MONITORING_DB);
  if (fs.existsSync(TEST_MONITORING_DB + '-wal')) fs.unlinkSync(TEST_MONITORING_DB + '-wal');
  if (fs.existsSync(TEST_MONITORING_DB + '-shm')) fs.unlinkSync(TEST_MONITORING_DB + '-shm');
  if (fs.existsSync(TEST_MONITORING_STORAGE)) {
    fs.rmSync(TEST_MONITORING_STORAGE, { recursive: true, force: true });
  }
}

cleanup();

const { initDb, closeDb, getDb } = require('../db');
initDb(TEST_MONITORING_DB);

const app = require('../server');
let server;

function request(method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 5095,
      path: reqPath,
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
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({
          status: res.statusCode,
          data: json,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function extractCookie(res) {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return '';
  const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return first.split(';')[0];
}

async function runTests() {
  console.log('\n====================================================');
  console.log(' Running Phase 4 Advanced Security Monitoring Tests');
  console.log('====================================================\n');

  server = app.listen(5095);
  await new Promise(r => setTimeout(r, 400));

  try {
    // -------------------------------------------------------------------------
    // Section 1: Schema Migration v7 & Initial Rules Setup
    // -------------------------------------------------------------------------
    console.log('Section 1: Database Migration v7 & Security Event Normalization...');
    const db = getDb();

    // Verify incidents and incident_notes tables exist
    const incidentTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='incidents';").get();
    assert.ok(incidentTable, 'incidents table must exist');

    const notesTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='incident_notes';").get();
    assert.ok(notesTable, 'incident_notes table must exist');

    const rulesTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='detection_rules_state';").get();
    assert.ok(rulesTable, 'detection_rules_state table must exist');

    const rulesCount = db.prepare('SELECT count(*) as c FROM detection_rules_state;').get().c;
    assert.strictEqual(rulesCount, 5, 'Must pre-populate all 5 deterministic detection rules');
    console.log('  ✓ Migration v7 created incidents, incident_notes, and detection_rules_state tables');

    // Verify existing security_events table extended with normalized fields
    const secCols = db.prepare("PRAGMA table_info(security_events);").all();
    const secColNames = new Set(secCols.map(c => c.name));
    assert.ok(secColNames.has('actorId'), 'Must have actorId');
    assert.ok(secColNames.has('ruleId'), 'Must have ruleId');
    assert.ok(secColNames.has('outcome'), 'Must have outcome');
    assert.ok(secColNames.has('incidentId'), 'Must have incidentId');
    assert.ok(secColNames.has('isSimulated'), 'Must have isSimulated');
    console.log('  ✓ Security event model normalized with actor, ruleId, outcome, and incident tracking');

    // -------------------------------------------------------------------------
    // Setup Test User Sessions
    // -------------------------------------------------------------------------
    const rAdminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@examvault.local',
      password: 'admin123'
    });
    const adminCookie = extractCookie(rAdminLogin);

    const rStaffLogin = await request('POST', '/api/auth/login', {
      email: 'akash.g@university.edu',
      password: 'admin123'
    });
    const staffCookie = extractCookie(rStaffLogin);

    const rCoordinatorLogin = await request('POST', '/api/auth/login', {
      email: 'priya.sharma@university.edu',
      password: 'admin123'
    });
    const coordinatorCookie = extractCookie(rCoordinatorLogin);

    // -------------------------------------------------------------------------
    // Section 2: Detection Rule A — Repeated Failed Authentication
    // -------------------------------------------------------------------------
    console.log('\nSection 2: Detection Rule A — Repeated Failed Authentication...');

    // Attempt 1: Single failed login (below threshold)
    const rFail1 = await request('POST', '/api/auth/login', {
      email: 'test.attacker@threat.local',
      password: 'wrongpassword'
    });
    assert.strictEqual(rFail1.status, 401);

    const incBefore = db.prepare("SELECT count(*) as c FROM incidents WHERE ruleId = 'RULE-AUTH-FAILED';").get().c;
    assert.strictEqual(incBefore, 0, 'Below-threshold attempts must NOT trigger incident');
    console.log('  ✓ Below-threshold failed login does not trigger alert or incident');

    // Attempt 2 and 3: Reach threshold (threshold = 3)
    await request('POST', '/api/auth/login', { email: 'test.attacker@threat.local', password: 'wrongpassword' });
    await request('POST', '/api/auth/login', { email: 'test.attacker@threat.local', password: 'wrongpassword' });

    const authAlerts = db.prepare("SELECT * FROM security_events WHERE ruleId = 'RULE-AUTH-FAILED';").all();
    assert.ok(authAlerts.length >= 1, 'Must create security alert when failure threshold reached');
    assert.strictEqual(authAlerts[0].severity, 'HIGH');
    assert.strictEqual(authAlerts[0].outcome, 'FAILED');
    console.log('  ✓ Reaching threshold triggers RULE-AUTH-FAILED security alert with HIGH severity');

    const authIncident = db.prepare("SELECT * FROM incidents WHERE ruleId = 'RULE-AUTH-FAILED';").get();
    assert.ok(authIncident, 'Must create or link incident for repeated failed authentication');
    assert.strictEqual(authIncident.severity, 'HIGH');
    assert.strictEqual(authIncident.status, 'Open');
    console.log('  ✓ Detection engine created linked incident with status Open');

    // Attempt 4: Burst attempt within debounce window -> should update incident activity without duplicate alert
    const alertCountBeforeBurst = authAlerts.length;
    await request('POST', '/api/auth/login', { email: 'test.attacker@threat.local', password: 'wrongpassword' });
    const alertCountAfterBurst = db.prepare("SELECT count(*) as c FROM security_events WHERE ruleId = 'RULE-AUTH-FAILED';").get().c;
    assert.strictEqual(alertCountAfterBurst, alertCountBeforeBurst, 'Debounce must prevent duplicate alerts in same burst');
    console.log('  ✓ Subsequent request in same burst debounced without duplicate alert');

    // -------------------------------------------------------------------------
    // Section 3: Detection Rule B — Repeated Unauthorized Document Access
    // -------------------------------------------------------------------------
    console.log('\nSection 3: Detection Rule B — Repeated Unauthorized Document Access...');

    // Akash (Staff) requests access to protected documents (unauthorized role)
    for (let i = 0; i < 3; i++) {
      await request('POST', '/api/access/check', {
        documentId: 'DOC-001',
        action: 'DOWNLOAD',
        purpose: 'Unauthorized Probe'
      }, { Cookie: staffCookie });
    }

    const docUnauthAlert = db.prepare("SELECT * FROM security_events WHERE ruleId = 'RULE-DOC-UNAUTHORIZED';").get();
    assert.ok(docUnauthAlert, 'Repeated access denials must trigger RULE-DOC-UNAUTHORIZED');
    assert.strictEqual(docUnauthAlert.severity, 'HIGH');
    assert.strictEqual(docUnauthAlert.outcome, 'DENIED');
    console.log('  ✓ Repeated unauthorized document access detected and logged as HIGH severity');

    const docIncident = db.prepare("SELECT * FROM incidents WHERE ruleId = 'RULE-DOC-UNAUTHORIZED';").get();
    assert.ok(docIncident, 'Must create incident for repeated unauthorized document access');
    console.log('  ✓ Correlated incident created for unauthorized document access actor');

    // -------------------------------------------------------------------------
    // Section 4: Detection Rule D — Document Integrity Failure
    // -------------------------------------------------------------------------
    console.log('\nSection 4: Detection Rule D — Document Integrity Failure...');

    // Simulate tampering on DOC-002
    const rTamper = await request('POST', '/api/documents/DOC-002/tamper', null, { Cookie: adminCookie });
    assert.strictEqual(rTamper.status, 200);

    const integrityAlert = db.prepare("SELECT * FROM security_events WHERE ruleId = 'RULE-INTEGRITY-TAMPER' AND documentId = 'DOC-002';").get();
    assert.ok(integrityAlert, 'Tampering must trigger RULE-INTEGRITY-TAMPER');
    assert.strictEqual(integrityAlert.severity, 'CRITICAL');
    assert.strictEqual(integrityAlert.outcome, 'DENIED');
    console.log('  ✓ Cryptographic tampering triggers RULE-INTEGRITY-TAMPER with CRITICAL severity');

    const integrityIncident = db.prepare("SELECT * FROM incidents WHERE ruleId = 'RULE-INTEGRITY-TAMPER' AND correlationKey = 'tamper:doc:DOC-002';").get();
    assert.ok(integrityIncident, 'Must create CRITICAL incident for document integrity failure');
    assert.strictEqual(integrityIncident.severity, 'CRITICAL');
    console.log('  ✓ Critical incident automatically registered for tampered document');

    // Restore document
    await request('POST', '/api/documents/DOC-002/restore', null, { Cookie: adminCookie });

    // -------------------------------------------------------------------------
    // Section 5: Detection Rule E — Administrative & Policy Changes
    // -------------------------------------------------------------------------
    console.log('\nSection 5: Detection Rule E — Administrative Operations Monitoring...');

    // Admin updates a policy
    const rUpdatePolicy = await request('PUT', '/api/policies/POL-001', {
      status: 'Active',
      purpose: 'End-term Audit Revision'
    }, { Cookie: adminCookie });
    assert.strictEqual(rUpdatePolicy.status, 200);

    const adminAlert = db.prepare("SELECT * FROM security_events WHERE ruleId = 'RULE-ADMIN-CHANGE';").get();
    assert.ok(adminAlert, 'Administrative operation must trigger RULE-ADMIN-CHANGE');
    console.log('  ✓ Sensitive administrative policy update detected and audited');

    // -------------------------------------------------------------------------
    // Section 6: Incident Management Workflow & Access Control
    // -------------------------------------------------------------------------
    console.log('\nSection 6: Incident Management Workflow & Authorization...');

    // 6.1 Unauthorized user (Staff) cannot view or modify incidents
    const rStaffIncidents = await request('GET', '/api/security/incidents', null, { Cookie: staffCookie });
    assert.strictEqual(rStaffIncidents.status, 403, 'Staff must be blocked from reading incidents');

    const rStaffIncidentDetail = await request('GET', `/api/security/incidents/${authIncident.id}`, null, { Cookie: staffCookie });
    assert.strictEqual(rStaffIncidentDetail.status, 403, 'Staff must be blocked from reading incident detail');
    console.log('  ✓ Least-privilege enforced: Staff role blocked with 403 from incident management');

    // 6.2 Authorized investigator (Exam Coordinator) can view incidents
    const rCoordIncidents = await request('GET', '/api/security/incidents', null, { Cookie: coordinatorCookie });
    assert.strictEqual(rCoordIncidents.status, 200);
    assert.ok(Array.isArray(rCoordIncidents.data.incidents));
    assert.ok(rCoordIncidents.data.incidents.length >= 2);
    console.log('  ✓ Authorized investigator successfully retrieved paginated incidents list');

    // 6.3 Add investigation note
    const rAddNote = await request('POST', `/api/security/incidents/${authIncident.id}/notes`, {
      note: 'Investigating potential IP origin from university proxy subnet.'
    }, { Cookie: coordinatorCookie });
    assert.strictEqual(rAddNote.status, 201);
    assert.strictEqual(rAddNote.data.incident.notes.length >= 2, true);
    const lastNote = rAddNote.data.incident.notes[rAddNote.data.incident.notes.length - 1];
    assert.strictEqual(lastNote.author, 'Dr. Priya Sharma');
    assert.strictEqual(lastNote.authorRole, 'Exam Coordinator');
    console.log('  ✓ Investigation note added and investigator identity preserved');

    // 6.4 Reject empty note
    const rEmptyNote = await request('POST', `/api/security/incidents/${authIncident.id}/notes`, {
      note: '   '
    }, { Cookie: coordinatorCookie });
    assert.strictEqual(rEmptyNote.status, 400);
    console.log('  ✓ Malformed / empty note rejected with 400');

    // 6.5 Assign incident
    const rAssign = await request('PUT', `/api/security/incidents/${authIncident.id}/assign`, {
      assignedTo: 'Dr. Priya Sharma'
    }, { Cookie: adminCookie });
    assert.strictEqual(rAssign.status, 200);
    assert.strictEqual(rAssign.data.incident.assignedTo, 'Dr. Priya Sharma');
    assert.strictEqual(rAssign.data.incident.status, 'Investigating');
    console.log('  ✓ Incident assignment updated and status automatically moved to Investigating');

    // 6.6 Invalid status rejected
    const rInvalidStatus = await request('PUT', `/api/security/incidents/${authIncident.id}/status`, {
      status: 'NonExistentStatus'
    }, { Cookie: adminCookie });
    assert.strictEqual(rInvalidStatus.status, 400);
    console.log('  ✓ Invalid incident status transition rejected with 400');

    // 6.7 Resolve incident with summary
    const rResolve = await request('PUT', `/api/security/incidents/${authIncident.id}/status`, {
      status: 'Resolved',
      resolutionSummary: 'Source IP verified as security scanner test. Target account credentials intact.'
    }, { Cookie: adminCookie });
    assert.strictEqual(rResolve.status, 200);
    assert.strictEqual(rResolve.data.incident.status, 'Resolved');
    assert.ok(rResolve.data.incident.resolutionSummary.includes('security scanner test'));
    console.log('  ✓ Incident resolved with resolution summary and recorded in timeline');

    // -------------------------------------------------------------------------
    // Section 7: Security Metrics, Filtering & Least-Privilege Redaction
    // -------------------------------------------------------------------------
    console.log('\nSection 7: Metrics, Filtering & Least-Privilege Redaction...');

    // 7.1 Security stats with incident metrics
    const rStats = await request('GET', '/api/security/stats?range=all', null, { Cookie: adminCookie });
    assert.strictEqual(rStats.status, 200);
    assert.ok(typeof rStats.data.openIncidents === 'number');
    assert.ok(typeof rStats.data.resolvedIncidents === 'number');
    assert.ok(rStats.data.resolvedIncidents >= 1);
    assert.ok(rStats.data.eventsBySeverity.HIGH >= 1);
    console.log('  ✓ /api/security/stats returns accurate metrics including open/resolved incidents');

    // 7.2 Event Explorer pagination & filtering
    const rFilter = await request('GET', '/api/security/events?severity=HIGH&paginate=true&page=1&limit=5', null, { Cookie: adminCookie });
    assert.strictEqual(rFilter.status, 200);
    assert.ok(Array.isArray(rFilter.data.events));
    assert.ok(rFilter.data.events.every(e => e.severity === 'HIGH'));
    assert.ok(rFilter.data.pagination.total >= 1);
    console.log('  ✓ /api/security/events pagination and severity filtering verified');

    // 7.3 Least-privilege redaction for ordinary users (Staff)
    const rStaffEvents = await request('GET', '/api/security/events', null, { Cookie: staffCookie });
    assert.strictEqual(rStaffEvents.status, 200);
    assert.ok(Array.isArray(rStaffEvents.data));
    assert.ok(rStaffEvents.data.every(e => e.ip === 'REDACTED'), 'IP addresses must be redacted for ordinary staff');
    console.log('  ✓ Sensitive forensic data (source IP addresses) redacted for non-investigator roles');

    // -------------------------------------------------------------------------
    // Section 8: Controlled Security Simulation Endpoint
    // -------------------------------------------------------------------------
    console.log('\nSection 8: Controlled Security Simulation...');

    // 8.1 Staff blocked from running simulation
    const rStaffSim = await request('POST', '/api/security/simulate', { scenario: 'AUTH_BURST' }, { Cookie: staffCookie });
    assert.strictEqual(rStaffSim.status, 403);
    console.log('  ✓ Simulation execution blocked with 403 for non-administrators');

    // 8.2 Admin runs controlled simulation
    const rAdminSim = await request('POST', '/api/security/simulate', { scenario: 'DOC_UNAUTH' }, { Cookie: adminCookie });
    assert.strictEqual(rAdminSim.status, 201);
    assert.strictEqual(rAdminSim.data.isSimulated, true);
    console.log('  ✓ Controlled simulation executed and marked with isSimulated flag');

    console.log('\n====================================================');
    console.log(' ALL PHASE 4 ADVANCED SECURITY MONITORING TESTS PASSED!');
    console.log('====================================================\n');

  } finally {
    if (server) {
      await new Promise(r => server.close(r));
    }
    closeDb();
    cleanup();
  }
}

runTests().catch(err => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  if (server) server.close();
  closeDb();
  cleanup();
  process.exit(1);
});
