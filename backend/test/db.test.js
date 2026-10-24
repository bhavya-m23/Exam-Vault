const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { initDb, closeDb, getDb } = require('../db');
const store = require('../data/store');

const TEST_DB_PATH = path.resolve(__dirname, 'test_examvault.db');

function cleanupTestDb() {
  closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal');
  if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm');
}

async function runTests() {
  console.log('====================================================');
  console.log(' Running ExamVault SQLite Database Foundation Tests');
  console.log('====================================================\n');

  cleanupTestDb();

  // Test 1: Database Initialization
  console.log('Test 1: Database Initialization...');
  process.env.DATABASE_PATH = TEST_DB_PATH;
  const db = initDb(TEST_DB_PATH);
  assert.ok(db, 'Database instance should be created');

  const users = store.getUsers();
  assert.strictEqual(users.length, 5, 'Should have 5 seeded users');
  const docs = store.getDocuments();
  assert.strictEqual(docs.length, 5, 'Should have 5 seeded documents');
  const policies = store.getPolicies();
  assert.strictEqual(policies.length, 5, 'Should have 5 seeded policies');
  const logs = store.getAuditLogs();
  assert.strictEqual(logs.length, 8, 'Should have 8 seeded audit logs');
  const events = store.getSecurityEvents();
  assert.strictEqual(events.length, 3, 'Should have 3 seeded security events');
  console.log('  ✓ Database initialized with all tables, indexes, and seeded records');

  // Test 2: Repeated Initialization Without Duplicate Seed Records
  console.log('\nTest 2: Idempotent Re-initialization...');
  initDb(TEST_DB_PATH);
  assert.strictEqual(store.getUsers().length, 5, 'User count should remain 5');
  assert.strictEqual(store.getDocuments().length, 5, 'Doc count should remain 5');
  assert.strictEqual(store.getPolicies().length, 5, 'Policy count should remain 5');
  assert.strictEqual(store.getAuditLogs().length, 8, 'Log count should remain 8');
  assert.strictEqual(store.getSecurityEvents().length, 3, 'Event count should remain 3');
  console.log('  ✓ Re-initialization is completely idempotent with no duplicates');

  // Test 3: Creating and Retrieving Records
  console.log('\nTest 3: Creating and Retrieving Records...');
  const newDocResult = store.addDocument({
    name: 'Distributed Systems - Final.pdf',
    subject: 'Distributed Systems',
    owner: 'Dr. Priya Sharma',
    ownerRole: 'Exam Coordinator',
    sensitivity: 'Critical',
    content: 'TOP SECRET EXAM CONTENT 2026',
    fileSize: '3.5 MB'
  });

  assert.ok(newDocResult.document.id.startsWith('DOC-'), 'Document ID should follow format DOC-XXX');
  assert.strictEqual(newDocResult.document.name, 'Distributed Systems - Final.pdf');
  assert.strictEqual(newDocResult.document.sensitivity, 'Critical');
  assert.strictEqual(newDocResult.document.version, 1);
  assert.strictEqual(newDocResult.document.isTampered, false);

  const retrievedDoc = store.getDocumentById(newDocResult.document.id);
  assert.strictEqual(retrievedDoc.id, newDocResult.document.id);
  assert.strictEqual(retrievedDoc.content, 'TOP SECRET EXAM CONTENT 2026');
  assert.strictEqual(typeof retrievedDoc.fingerprint, 'string');
  assert.strictEqual(retrievedDoc.fingerprint.length, 64, 'SHA-256 fingerprint should be 64 hex characters');

  // Check that default policy was created
  const docPolicy = store.getPolicyByDocumentId(newDocResult.document.id);
  assert.ok(docPolicy, 'Default policy should be created for new document');
  assert.deepStrictEqual(docPolicy.allowedRoles, ['Exam Coordinator', 'Administrator']);
  assert.deepStrictEqual(docPolicy.allowedActions, ['VIEW', 'DOWNLOAD']);

  // Check that audit log was generated
  const latestLogs = store.getAuditLogs();
  assert.strictEqual(latestLogs[0].action, 'DOCUMENT_UPLOAD');
  assert.strictEqual(latestLogs[0].documentId, newDocResult.document.id);
  console.log('  ✓ Successfully created and retrieved records with automated default policy and audit trail');

  // Test 4: Tampering & Restoring Document Lifecycle
  console.log('\nTest 4: Tampering & Restoring Document Lifecycle...');
  const tamperResult = store.tamperDocument(newDocResult.document.id);
  assert.strictEqual(tamperResult.document.isTampered, true);
  assert.strictEqual(tamperResult.document.status, 'Integrity Compromised');
  assert.notStrictEqual(tamperResult.document.fingerprint, tamperResult.document.originalFingerprint);

  // Access check should now be blocked due to tampering
  const accessWhileTampered = store.checkAccess({
    userId: 'USR-001',
    documentId: newDocResult.document.id,
    action: 'VIEW'
  });
  assert.strictEqual(accessWhileTampered.allowed, false);
  assert.ok(accessWhileTampered.reason.includes('Document integrity compromise detected'));

  // Restore document
  const restoredDoc = store.restoreDocument(newDocResult.document.id);
  assert.strictEqual(restoredDoc.isTampered, false);
  assert.strictEqual(restoredDoc.status, 'Protected');
  assert.strictEqual(restoredDoc.fingerprint, restoredDoc.originalFingerprint);

  // Access check should now be allowed
  const accessAfterRestore = store.checkAccess({
    userId: 'USR-001',
    documentId: newDocResult.document.id,
    action: 'VIEW'
  });
  assert.strictEqual(accessAfterRestore.allowed, true);
  console.log('  ✓ Tampering flags document, blocks access, and safe restoration returns pristine state');

  // Test 5: Persistence Across Closing and Reopening Database
  console.log('\nTest 5: Persistence Across Closing and Reopening Database...');
  closeDb();

  // Re-open from disk without calling migrations/seed
  const reopenedDb = getDb(TEST_DB_PATH);
  assert.ok(reopenedDb, 'Database successfully reopened');

  const persistedDoc = store.getDocumentById(newDocResult.document.id);
  assert.ok(persistedDoc, 'Newly created document must persist after database close/reopen');
  assert.strictEqual(persistedDoc.name, 'Distributed Systems - Final.pdf');
  assert.strictEqual(persistedDoc.status, 'Protected');
  console.log('  ✓ Data persists across database close and reopen');

  // Test 6: Foreign Key Enforcement
  console.log('\nTest 6: Foreign Key Enforcement...');
  let fkErrorCaught = false;
  try {
    reopenedDb.prepare(`
      INSERT INTO access_policies (
        id, documentId, documentName, allowedRoles, allowedActions, purpose, startTime, endTime, status, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `).run(
      'POL-TEST-FK', 'NON_EXISTENT_DOC_ID', 'Ghost Document',
      JSON.stringify(['Administrator']), JSON.stringify(['VIEW']),
      'Test', '08:00', '20:00', 'Active', new Date().toISOString()
    );
  } catch (err) {
    fkErrorCaught = true;
    assert.ok(err.message.includes('FOREIGN KEY constraint failed'), 'Should trigger SQLite FOREIGN KEY error');
  }
  assert.ok(fkErrorCaught, 'Foreign key constraint must prevent orphan policy creation');
  console.log('  ✓ Foreign key constraints actively enforced by SQLite engine');

  // Test 7: Context-Aware Access Engine (Demo Scenarios 1 & 2)
  console.log('\nTest 7: Context-Aware Access Engine Scenarios...');
  // Scenario 1: Akash G (Staff) -> Computer Networks (DOC-002) -> BLOCKED
  const s1 = store.checkAccess({
    userId: 'USR-003',
    documentId: 'DOC-002',
    action: 'VIEW',
    purpose: 'Exam Preparation'
  });
  assert.strictEqual(s1.allowed, false, 'Staff should be blocked for Computer Networks');
  assert.ok(s1.reason.includes("Role 'Staff' is not in allowed policy roles"));

  // Scenario 2: Dr. Priya Sharma (Exam Coordinator) -> Data Structures (DOC-001) -> ALLOWED
  const s2 = store.checkAccess({
    userId: 'USR-002',
    documentId: 'DOC-001',
    action: 'VIEW',
    purpose: 'Exam Preparation'
  });
  assert.strictEqual(s2.allowed, true, 'Exam Coordinator should be allowed for Data Structures');
  console.log('  ✓ Core demo presentation scenarios 1 & 2 evaluated correctly');

  // Cleanup
  cleanupTestDb();
  delete process.env.DATABASE_PATH;

  console.log('\n====================================================');
  console.log(' ALL 7 TEST SUITES PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  cleanupTestDb();
  process.exit(1);
});
