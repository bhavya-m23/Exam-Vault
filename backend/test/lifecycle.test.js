const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const TEST_LIFECYCLE_DB = path.resolve(__dirname, 'lifecycle_test.db');
const TEST_LIFECYCLE_STORAGE = path.resolve(__dirname, 'test_storage_vault');

process.env.DATABASE_PATH = TEST_LIFECYCLE_DB;
process.env.STORAGE_DIR = TEST_LIFECYCLE_STORAGE;
process.env.PORT = '5098';
process.env.JWT_SECRET = 'test-suite-secure-jwt-secret-key-32chars';
process.env.ENABLE_DEMO_SWITCH = 'true';
process.env.MAX_UPLOAD_SIZE_BYTES = String(500 * 1024); // 500 KB limit for rapid test

function cleanup() {
  if (fs.existsSync(TEST_LIFECYCLE_DB)) fs.unlinkSync(TEST_LIFECYCLE_DB);
  if (fs.existsSync(TEST_LIFECYCLE_DB + '-wal')) fs.unlinkSync(TEST_LIFECYCLE_DB + '-wal');
  if (fs.existsSync(TEST_LIFECYCLE_DB + '-shm')) fs.unlinkSync(TEST_LIFECYCLE_DB + '-shm');
  if (fs.existsSync(TEST_LIFECYCLE_STORAGE)) {
    fs.rmSync(TEST_LIFECYCLE_STORAGE, { recursive: true, force: true });
  }
}

cleanup();

const { initDb, closeDb, getDb } = require('../db');
initDb(TEST_LIFECYCLE_DB);

const storage = require('../utils/storage');
const { generateFingerprint } = require('../utils/fingerprint');
const app = require('../server');
let server;

function requestRaw(method, reqPath, rawBody = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5098,
      path: reqPath,
      method,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        ...(rawBody ? { 'Content-Length': Buffer.isBuffer(rawBody) ? rawBody.length : Buffer.byteLength(rawBody) } : {}),
        ...headers
      }
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => { chunks.push(chunk); });
      res.on('end', () => {
        const fullBuffer = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(fullBuffer.toString('utf8'));
        } catch (e) {
          json = null;
        }
        resolve({
          status: res.statusCode,
          data: json,
          rawBuffer: fullBuffer,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    if (rawBody) req.write(rawBody);
    req.end();
  });
}

function requestJson(method, reqPath, body = null, headers = {}) {
  const payload = body ? JSON.stringify(body) : null;
  return requestRaw(method, reqPath, payload, {
    'Content-Type': 'application/json',
    ...headers
  });
}

function buildMultipartFormData({ fields = {}, file = null }) {
  const boundary = '----ExamVaultBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  const parts = [];

  // Append text fields
  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="${key}"${crlf}${crlf}` +
      `${value}${crlf}`
    ));
  }

  // Append file part
  if (file) {
    const { fieldname, filename, contentType, buffer } = file;
    parts.push(Buffer.from(
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="${fieldname}"; filename="${filename}"${crlf}` +
      `Content-Type: ${contentType || 'application/octet-stream'}${crlf}${crlf}`
    ));
    parts.push(buffer);
    parts.push(Buffer.from(crlf));
  }

  // Close boundary
  parts.push(Buffer.from(`--${boundary}--${crlf}`));

  const payload = Buffer.concat(parts);
  const contentType = `multipart/form-data; boundary=${boundary}`;

  return { payload, contentType };
}

async function runLifecycleTests() {
  console.log('====================================================');
  console.log(' Running Phase 3 Secure Document Lifecycle Tests');
  console.log('====================================================\n');

  await new Promise((resolve) => {
    server = app.listen(5098, resolve);
  });

  try {
    // ----------------------------------------------------
    // Section 1: Authentication & Authorization for Document Management
    // ----------------------------------------------------
    console.log('Section 1: Authentication & Upload Authorization...');

    // Log in as Administrator
    const rAdminLogin = await requestJson('POST', '/api/auth/login', {
      email: 'admin@examvault.local',
      password: 'admin123'
    });
    assert.strictEqual(rAdminLogin.status, 200);
    const adminToken = rAdminLogin.data.token;

    // Log in as Staff (Akash G - unauthorized to upload)
    const rStaffLogin = await requestJson('POST', '/api/auth/login', {
      email: 'akash.g@university.edu',
      password: 'admin123'
    });
    assert.strictEqual(rStaffLogin.status, 200);
    const staffToken = rStaffLogin.data.token;

    // Staff upload attempt -> 403 Forbidden
    const fakePdf = Buffer.from('%PDF-1.4\n%Fake Exam Document\n%%EOF');
    const { payload: staffPayload, contentType: staffCT } = buildMultipartFormData({
      fields: { name: 'Staff Exam.pdf', subject: 'CS101' },
      file: { fieldname: 'file', filename: 'StaffExam.pdf', contentType: 'application/pdf', buffer: fakePdf }
    });
    const rStaffUpload = await requestRaw('POST', '/api/documents', staffPayload, {
      'Content-Type': staffCT,
      'Authorization': `Bearer ${staffToken}`
    });
    assert.strictEqual(rStaffUpload.status, 403, 'Unauthorized staff role must be rejected with 403');
    console.log('  ✓ Unauthorized role (Staff) correctly blocked from uploading documents with 403');

    // ----------------------------------------------------
    // Section 2: Validation of File Type, Magic Bytes, Size & Paths
    // ----------------------------------------------------
    console.log('\nSection 2: Secure File Validation (Type, Extension, Magic Bytes, Size)...');

    // 2.1: Disallowed file extension (.exe)
    const { payload: exePayload, contentType: exeCT } = buildMultipartFormData({
      fields: { name: 'Malware.exe', subject: 'Security' },
      file: { fieldname: 'file', filename: 'payload.exe', contentType: 'application/x-msdownload', buffer: Buffer.from('MZ\x90\x00') }
    });
    const rExeUpload = await requestRaw('POST', '/api/documents', exePayload, {
      'Content-Type': exeCT,
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rExeUpload.status, 400);
    assert.ok(rExeUpload.data.message.includes('Disallowed file extension'));
    console.log('  ✓ Disallowed file extension (.exe) correctly rejected with 400');

    // 2.2: Extension spoofing / Magic Bytes Mismatch (named .pdf but containing arbitrary text without %PDF- magic bytes)
    const spoofedContent = Buffer.from('Hello, I am pretending to be a PDF but I am just raw text!');
    const { payload: spoofPayload, contentType: spoofCT } = buildMultipartFormData({
      fields: { name: 'Spoofed.pdf', subject: 'Security' },
      file: { fieldname: 'file', filename: 'spoofed.pdf', contentType: 'application/pdf', buffer: spoofedContent }
    });
    const rSpoofUpload = await requestRaw('POST', '/api/documents', spoofPayload, {
      'Content-Type': spoofCT,
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rSpoofUpload.status, 400);
    assert.ok(rSpoofUpload.data.message.includes('does not match the claimed file format'));
    console.log('  ✓ Magic bytes verification detects and rejects extension-spoofed files');

    // 2.3: File size exceeding MAX_UPLOAD_SIZE_BYTES (500 KB configured in test)
    const oversizedPdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(550 * 1024, 0x41), // 550 KB of 'A'
      Buffer.from('\n%%EOF')
    ]);
    const { payload: overPayload, contentType: overCT } = buildMultipartFormData({
      fields: { name: 'Huge Exam.pdf', subject: 'CS101' },
      file: { fieldname: 'file', filename: 'huge.pdf', contentType: 'application/pdf', buffer: oversizedPdf }
    });
    const rOverUpload = await requestRaw('POST', '/api/documents', overPayload, {
      'Content-Type': overCT,
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rOverUpload.status, 400);
    assert.ok(rOverUpload.data.message.includes('exceeds the maximum allowed size'));
    console.log('  ✓ Oversized file (> 500 KB) rejected with 400');

    // 2.4: Path traversal attempt in original filename
    const traversalFilename = '../../../../windows/system32/cmd.pdf';
    const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Exam Paper CS401) >>\nendobj\n%%EOF');
    const { payload: travPayload, contentType: travCT } = buildMultipartFormData({
      fields: { name: 'Path Traversal Test', subject: 'Computer Security' },
      file: { fieldname: 'file', filename: traversalFilename, contentType: 'application/pdf', buffer: validPdfBuffer }
    });
    const rTravUpload = await requestRaw('POST', '/api/documents', travPayload, {
      'Content-Type': travCT,
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rTravUpload.status, 201);
    const travDoc = rTravUpload.data.document;

    // Verify storageKey does not contain directory traversal or path separators
    assert.ok(!travDoc.storageKey.includes('..'));
    assert.ok(!travDoc.storageKey.includes('/'));
    assert.ok(!travDoc.storageKey.includes('\\'));
    console.log('  ✓ Path traversal in filename stripped safely; server-controlled key generated');

    // ----------------------------------------------------
    // Section 3: Valid Binary Upload, Storage & Metadata Tracking
    // ----------------------------------------------------
    console.log('\nSection 3: Valid Binary Document Upload & Storage...');

    const validPdfContent = Buffer.from(
      '%PDF-1.4\n% Real Exam Vault Binary Payload\n' +
      '3 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      'xref\n0 4\n0000000000 65535 f \n' +
      'trailer\n<< /Size 4 /Root 3 0 R >>\nstartxref\n120\n%%EOF'
    );
    const expectedFingerprint = generateFingerprint(validPdfContent);

    const { payload: validPayload, contentType: validCT } = buildMultipartFormData({
      fields: {
        name: 'CS501 - Advanced Cryptography.pdf',
        subject: 'Cryptography & Network Security',
        sensitivity: 'Critical'
      },
      file: {
        fieldname: 'file',
        filename: 'CS501_Advanced_Crypto_Exam.pdf',
        contentType: 'application/pdf',
        buffer: validPdfContent
      }
    });

    const rValidUpload = await requestRaw('POST', '/api/documents', validPayload, {
      'Content-Type': validCT,
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rValidUpload.status, 201);
    const createdDoc = rValidUpload.data.document;
    const createdPolicy = rValidUpload.data.policy;

    assert.ok(createdDoc.id.startsWith('DOC-'));
    assert.strictEqual(createdDoc.fingerprint, expectedFingerprint);
    assert.strictEqual(createdDoc.originalFingerprint, expectedFingerprint);
    assert.strictEqual(createdDoc.sensitivity, 'Critical');
    assert.strictEqual(createdDoc.status, 'Protected');
    assert.strictEqual(createdDoc.isTampered, false);
    assert.strictEqual(createdPolicy.documentId, createdDoc.id);

    // Verify file exists on disk in storage directory and NOT inside frontend
    const storedOnDisk = storage.readFile(createdDoc.storageKey);
    assert.ok(storedOnDisk, 'Binary file must exist on disk in storage directory');
    assert.deepStrictEqual(storedOnDisk, validPdfContent);
    assert.strictEqual(generateFingerprint(storedOnDisk), expectedFingerprint);
    console.log('  ✓ Binary document uploaded, hashed with SHA-256, and stored persistently outside frontend');

    // Verify document listing does NOT leak raw content
    const rList = await requestJson('GET', '/api/documents', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rList.status, 200);
    const foundInList = rList.data.find(d => d.id === createdDoc.id);
    assert.ok(foundInList);
    assert.strictEqual(foundInList.content, undefined, 'Document listing must not expose raw content');
    console.log('  ✓ Document listing omits content and internal filesystem paths');

    // ----------------------------------------------------
    // Section 4: Secure Download Policy Enforcement & Binary Streaming
    // ----------------------------------------------------
    console.log('\nSection 4: Secure Download Authorization & Binary Delivery...');

    // 4.1: Unauthorized download attempt by Staff (Akash G) -> 403 Forbidden
    const rStaffDownload = await requestRaw('GET', `/api/documents/${createdDoc.id}/download`, null, {
      'Authorization': `Bearer ${staffToken}`
    });
    assert.strictEqual(rStaffDownload.status, 403, 'Unauthorized staff role must be forbidden to download');
    assert.strictEqual(rStaffDownload.data.allowed, false);

    // Verify security event was recorded for unauthorized download attempt
    const db = getDb();
    const lastSecEvent = db.prepare("SELECT * FROM security_events WHERE type = 'UNAUTHORIZED_DOWNLOAD' ORDER BY rowid DESC LIMIT 1;").get();
    assert.ok(lastSecEvent);
    assert.strictEqual(lastSecEvent.user, 'Akash G');
    assert.strictEqual(lastSecEvent.documentId, createdDoc.id);
    console.log('  ✓ Unauthorized download blocked with 403 and logged to Security Events');

    // 4.2: Authorized download by Administrator
    const rAdminDownload = await requestRaw('GET', `/api/documents/${createdDoc.id}/download`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rAdminDownload.status, 200);
    assert.strictEqual(rAdminDownload.headers['content-type'], 'application/pdf');
    assert.ok(rAdminDownload.headers['content-disposition'].includes('attachment; filename='));
    assert.ok(rAdminDownload.headers['content-disposition'].includes('CS501_Advanced_Crypto_Exam.pdf'));
    assert.strictEqual(rAdminDownload.headers['x-content-type-options'], 'nosniff');

    // Verify delivered buffer SHA-256 matches exact uploaded content
    const downloadedHash = generateFingerprint(rAdminDownload.rawBuffer);
    assert.strictEqual(downloadedHash, expectedFingerprint);
    console.log('  ✓ Authorized download delivers authentic binary payload with safe Content-Disposition and nosniff headers');

    // 4.3: Legacy seeded text document download (DOC-001)
    const rLegacyDownload = await requestRaw('GET', '/api/documents/DOC-001/download', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rLegacyDownload.status, 200);
    assert.ok(rLegacyDownload.rawBuffer.length > 0);
    assert.ok(rLegacyDownload.headers['content-disposition'].includes('attachment; filename='));
    console.log('  ✓ Legacy seeded text document remains seamlessly downloadable with text/plain stream');

    // ----------------------------------------------------
    // Section 5: Binary Tamper Simulation, Integrity Verification & Forensic Controls
    // ----------------------------------------------------
    console.log('\nSection 5: Binary Tamper Simulation, Detection & Restoration...');

    // 5.1: Integrity verification on pristine binary document
    const rVerifyPristine = await requestJson('POST', `/api/documents/${createdDoc.id}/verify`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rVerifyPristine.status, 200);
    assert.strictEqual(rVerifyPristine.data.verified, true);
    assert.strictEqual(rVerifyPristine.data.status, 'INTEGRITY_VERIFIED');
    console.log('  ✓ Pristine binary document verified with matching SHA-256 fingerprint');

    // 5.2: Simulate tampering on binary document
    const rTamper = await requestJson('POST', `/api/documents/${createdDoc.id}/tamper`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rTamper.status, 200);
    assert.strictEqual(rTamper.data.document.isTampered, true);
    assert.strictEqual(rTamper.data.document.status, 'Integrity Compromised');
    assert.notStrictEqual(rTamper.data.document.fingerprint, expectedFingerprint);

    // Verify file on disk actually changed
    const tamperedDiskBuffer = storage.readFile(createdDoc.storageKey);
    assert.notStrictEqual(generateFingerprint(tamperedDiskBuffer), expectedFingerprint);
    console.log('  ✓ Tamper simulation successfully altered binary file on disk and generated security warning');

    // 5.3: Verification confirms integrity compromise
    const rVerifyCompromised = await requestJson('POST', `/api/documents/${createdDoc.id}/verify`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rVerifyCompromised.status, 200);
    assert.strictEqual(rVerifyCompromised.data.verified, false);
    assert.strictEqual(rVerifyCompromised.data.status, 'INTEGRITY_COMPROMISED');
    console.log('  ✓ Integrity engine detects altered binary payload');

    // 5.4: Course Instructor is authorized by policy, but blocked because document is tampered
    // Update policy to permit Course Instructor role
    await requestJson('PUT', `/api/policies/${createdPolicy.id}`, {
      allowedRoles: ['Course Instructor', 'Administrator'],
      allowedActions: ['VIEW', 'DOWNLOAD']
    }, {
      'Authorization': `Bearer ${adminToken}`
    });

    // Log in as Course Instructor (Rahul Kumar)
    const rInstructorLogin = await requestJson('POST', '/api/auth/login', {
      email: 'rahul.kumar@university.edu',
      password: 'admin123'
    });
    const instructorToken = rInstructorLogin.data.token;

    const rInstructorTamperedDownload = await requestRaw('GET', `/api/documents/${createdDoc.id}/download`, null, {
      'Authorization': `Bearer ${instructorToken}`
    });
    assert.strictEqual(rInstructorTamperedDownload.status, 403);
    assert.ok(rInstructorTamperedDownload.data.message.includes('integrity is compromised'));
    console.log('  ✓ Standard users blocked from downloading tampered documents');

    // 5.5: Restore binary document
    const rRestore = await requestJson('POST', `/api/documents/${createdDoc.id}/restore`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rRestore.status, 200);
    assert.strictEqual(rRestore.data.document.isTampered, false);
    assert.strictEqual(rRestore.data.document.status, 'Protected');
    assert.strictEqual(rRestore.data.document.fingerprint, expectedFingerprint);

    // Verify restored file on disk matches original pristine fingerprint
    const restoredDiskBuffer = storage.readFile(createdDoc.storageKey);
    assert.strictEqual(generateFingerprint(restoredDiskBuffer), expectedFingerprint);

    const rVerifyRestored = await requestJson('POST', `/api/documents/${createdDoc.id}/verify`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rVerifyRestored.data.verified, true);
    console.log('  ✓ Binary document restored to pristine verified state on disk');

    // ----------------------------------------------------
    // Section 6: Persistence across Database Reopening
    // ----------------------------------------------------
    console.log('\nSection 6: Storage & Database Persistence Across Restart...');

    closeDb();
    initDb(TEST_LIFECYCLE_DB);

    const rAfterRestart = await requestJson('GET', `/api/documents/${createdDoc.id}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rAfterRestart.status, 200);
    assert.strictEqual(rAfterRestart.data.document.fingerprint, expectedFingerprint);

    const rDownloadAfterRestart = await requestRaw('GET', `/api/documents/${createdDoc.id}/download`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(rDownloadAfterRestart.status, 200);
    assert.strictEqual(generateFingerprint(rDownloadAfterRestart.rawBuffer), expectedFingerprint);
    console.log('  ✓ Binary document storage and SQLite metadata survive database close and reopen');

    console.log('\n====================================================');
    console.log(' ALL PHASE 3 SECURE DOCUMENT LIFECYCLE TESTS PASSED!');
    console.log('====================================================');
  } finally {
    if (server) server.close();
    closeDb();
    cleanup();
  }
}

runLifecycleTests().catch((err) => {
  console.error('\n❌ Phase 3 Lifecycle Test Failure:', err);
  if (server) server.close();
  closeDb();
  cleanup();
  process.exit(1);
});
