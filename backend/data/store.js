const { getDb } = require('../db');
const { generateFingerprint, formatShortFingerprint } = require('../utils/fingerprint');
const storage = require('../utils/storage');

/**
 * Generate sequential unique IDs (e.g. DOC-006, POL-006, LOG-009, SEC-004)
 */
function getNextId(prefix, tableName) {
  const db = getDb();
  let count = (db.prepare('SELECT count(*) as count FROM ' + tableName).get()?.count || 0) + 1;
  let candidate = prefix + '-' + String(count).padStart(3, '0');
  while (db.prepare('SELECT 1 FROM ' + tableName + ' WHERE id = ?').get(candidate)) {
    count++;
    candidate = prefix + '-' + String(count).padStart(3, '0');
  }
  return candidate;
}

/**
 * Entity Deserializers
 */
function deserializeDocument(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    owner: row.owner,
    ownerRole: row.ownerRole,
    uploadedAt: row.uploadedAt,
    version: Number(row.version),
    content: row.content,
    fingerprint: row.fingerprint,
    originalFingerprint: row.originalFingerprint,
    status: row.status,
    sensitivity: row.sensitivity,
    fileSize: row.fileSize,
    isTampered: Boolean(row.isTampered),
    storageKey: row.storageKey || null,
    mimeType: row.mimeType || 'text/plain',
    originalFileName: row.originalFileName || row.name
  };
}

function deserializeDocumentSummary(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    owner: row.owner,
    ownerRole: row.ownerRole,
    uploadedAt: row.uploadedAt,
    version: Number(row.version),
    fingerprint: row.fingerprint,
    originalFingerprint: row.originalFingerprint,
    status: row.status,
    sensitivity: row.sensitivity,
    fileSize: row.fileSize,
    isTampered: Boolean(row.isTampered),
    mimeType: row.mimeType || 'text/plain'
  };
}

function deserializePolicy(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentId: row.documentId,
    documentName: row.documentName,
    allowedRoles: typeof row.allowedRoles === 'string' ? JSON.parse(row.allowedRoles) : row.allowedRoles,
    allowedActions: typeof row.allowedActions === 'string' ? JSON.parse(row.allowedActions) : row.allowedActions,
    purpose: row.purpose,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
    createdAt: row.createdAt
  };
}

function deserializeAuditLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    user: row.user,
    userRole: row.userRole,
    action: row.action,
    document: row.document,
    documentId: row.documentId,
    purpose: row.purpose,
    timestamp: row.timestamp,
    result: row.result,
    reason: row.reason,
    ip: row.ip
  };
}

function deserializeSecurityEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    severity: row.severity,
    type: row.type,
    user: row.user,
    userRole: row.userRole,
    document: row.document,
    documentId: row.documentId,
    message: row.message,
    timestamp: row.timestamp,
    status: row.status,
    ip: row.ip,
    reviewedBy: row.reviewedBy || undefined,
    reviewedAt: row.reviewedAt || undefined,
    // Phase 4 normalized fields
    actorId: row.actorId || undefined,
    actorRole: row.actorRole || row.userRole || 'Staff',
    resourceType: row.resourceType || (row.documentId && row.documentId.startsWith('DOC-') ? 'DOCUMENT' : 'SYSTEM'),
    resourceId: row.resourceId || row.documentId || 'SYS',
    resourceName: row.resourceName || row.document || 'System',
    correlationId: row.correlationId || undefined,
    outcome: row.outcome || (row.severity === 'CRITICAL' || row.severity === 'HIGH' ? 'DENIED' : 'ALLOWED'),
    ruleId: row.ruleId || undefined,
    explanation: row.explanation || row.message,
    incidentId: row.incidentId || undefined,
    isSimulated: Boolean(row.isSimulated),
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined
  };
}

// ==========================================
// USER OPERATIONS
// ==========================================

function getUsers() {
  const db = getDb();
  return db.prepare('SELECT id, name, email, role, department, tokenVersion FROM users;').all();
}

function getUserById(userId) {
  const db = getDb();
  return db.prepare('SELECT id, name, email, role, department, tokenVersion FROM users WHERE id = ? OR name = ? OR email = ?;').get(userId, userId, userId);
}

function getUserByEmailWithPassword(email) {
  if (!email) return null;
  const db = getDb();
  return db.prepare('SELECT id, name, email, role, department, passwordHash, tokenVersion FROM users WHERE LOWER(email) = LOWER(?);').get(email);
}

// ==========================================
// DOCUMENT OPERATIONS
// ==========================================

function getDocuments() {
  const db = getDb();
  const rows = db.prepare('SELECT id, name, subject, owner, ownerRole, uploadedAt, version, fingerprint, originalFingerprint, status, sensitivity, fileSize, isTampered, mimeType FROM documents ORDER BY uploadedAt DESC, rowid DESC;').all();
  return rows.map(deserializeDocumentSummary);
}

function getDocumentById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM documents WHERE id = ? OR name = ?;').get(id, id);
  return deserializeDocument(row);
}

function addDocument({ name, subject, owner, ownerRole, sensitivity, content, fileSize, storageKey, mimeType, originalFileName, buffer }) {
  const db = getDb();
  const id = getNextId('DOC', 'documents');
  const uploadedAt = new Date().toISOString();

  let docContent = content;
  let fingerprint;

  if (buffer && Buffer.isBuffer(buffer)) {
    fingerprint = generateFingerprint(buffer);
    docContent = `[BINARY SECURED ENCRYPTED PAYLOAD: ${originalFileName || name} (${fileSize || 'Binary'})]`;
  } else if (storageKey) {
    const fileBuf = storage.readFile(storageKey);
    fingerprint = fileBuf ? generateFingerprint(fileBuf) : generateFingerprint(content || name);
    docContent = content || `[BINARY SECURED ENCRYPTED PAYLOAD: ${originalFileName || name}]`;
  } else {
    docContent = content || `SECURE EXAM CONTENT FOR ${name.toUpperCase()} (ID: ${id}). Subject: ${subject}. Sealed at ${uploadedAt}`;
    fingerprint = generateFingerprint(docContent);
  }

  const newDoc = {
    id,
    name,
    subject,
    owner,
    ownerRole: ownerRole || "Exam Coordinator",
    uploadedAt,
    version: 1,
    content: docContent,
    fingerprint,
    originalFingerprint: fingerprint,
    status: "Protected",
    sensitivity: sensitivity || "High",
    fileSize: fileSize || "2.0 MB",
    isTampered: 0,
    storageKey: storageKey || null,
    mimeType: mimeType || 'text/plain',
    originalFileName: originalFileName || name
  };

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      INSERT INTO documents (
        id, name, subject, owner, ownerRole, uploadedAt, version,
        content, fingerprint, originalFingerprint, status, sensitivity, fileSize, isTampered,
        storageKey, mimeType, originalFileName
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `).run(
      newDoc.id, newDoc.name, newDoc.subject, newDoc.owner, newDoc.ownerRole,
      newDoc.uploadedAt, newDoc.version, newDoc.content, newDoc.fingerprint,
      newDoc.originalFingerprint, newDoc.status, newDoc.sensitivity, newDoc.fileSize, newDoc.isTampered,
      newDoc.storageKey, newDoc.mimeType, newDoc.originalFileName
    );

    // Automatically create a default policy for new document
    const defaultPolicy = {
      id: getNextId('POL', 'access_policies'),
      documentId: id,
      documentName: name,
      allowedRoles: [ownerRole || "Exam Coordinator", "Administrator"],
      allowedActions: ["VIEW", "DOWNLOAD"],
      purpose: "Exam Preparation",
      startTime: "08:00",
      endTime: "23:59",
      status: "Active",
      createdAt: uploadedAt
    };

    db.prepare(`
      INSERT INTO access_policies (
        id, documentId, documentName, allowedRoles, allowedActions, purpose, startTime, endTime, status, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `).run(
      defaultPolicy.id, defaultPolicy.documentId, defaultPolicy.documentName,
      JSON.stringify(defaultPolicy.allowedRoles), JSON.stringify(defaultPolicy.allowedActions),
      defaultPolicy.purpose, defaultPolicy.startTime, defaultPolicy.endTime,
      defaultPolicy.status, defaultPolicy.createdAt
    );

    // Add audit log
    const auditLogId = getNextId('LOG', 'audit_logs');
    const timestamp = uploadedAt.replace('T', ' ').substring(0, 19);
    const ip = "127.0.0.1";
    const reason = `Document uploaded and SHA-256 fingerprint generated (${fingerprint.substring(0, 8)}...)`;

    db.prepare(`
      INSERT INTO audit_logs (id, user, userRole, action, document, documentId, purpose, timestamp, result, reason, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `).run(
      auditLogId, owner, ownerRole || "Exam Coordinator", "DOCUMENT_UPLOAD",
      name, id, "Exam Creation & Archival", timestamp, "ALLOWED", reason, ip
    );

    db.exec('COMMIT;');

    return {
      document: deserializeDocument(newDoc),
      policy: defaultPolicy
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function verifyDocument(id, user = "Current User", userRole = "Administrator") {
  const doc = getDocumentById(id);
  if (!doc) return null;

  let calculatedFingerprint;
  if (doc.storageKey) {
    const fileBuf = storage.readFile(doc.storageKey);
    if (!fileBuf) {
      calculatedFingerprint = "FILE_MISSING_ON_STORAGE";
    } else {
      calculatedFingerprint = generateFingerprint(fileBuf);
    }
  } else {
    calculatedFingerprint = generateFingerprint(doc.content);
  }

  const isMatch = calculatedFingerprint === doc.originalFingerprint;

  const result = {
    verified: isMatch,
    documentId: doc.id,
    documentName: doc.name,
    recordedFingerprint: doc.originalFingerprint,
    currentFingerprint: calculatedFingerprint,
    status: isMatch ? "INTEGRITY_VERIFIED" : "INTEGRITY_COMPROMISED",
    message: isMatch
      ? "Integrity Verified. Recorded fingerprint matches current fingerprint."
      : "INTEGRITY WARNING: Document fingerprint does not match the recorded version."
  };

  addAuditLog({
    user,
    userRole,
    action: "INTEGRITY_VERIFICATION",
    document: doc.name,
    documentId: doc.id,
    purpose: "Integrity Audit",
    result: isMatch ? "ALLOWED" : "WARNING",
    reason: result.message
  });

  if (!isMatch) {
    addSecurityEvent({
      severity: "CRITICAL",
      type: "INTEGRITY_MISMATCH",
      user,
      userRole,
      document: doc.name,
      documentId: doc.id,
      message: `Fingerprint mismatch detected! Recorded: ${doc.originalFingerprint.substring(0, 10)}... Current: ${calculatedFingerprint.substring(0, 10)}...`
    });

    try {
      const detectionEngine = require('../services/detectionEngine');
      detectionEngine.evaluateIntegrityTamper({
        documentId: doc.id,
        documentName: doc.name,
        expectedFingerprint: doc.originalFingerprint,
        actualFingerprint: calculatedFingerprint,
        user,
        userRole
      });
    } catch (err) {
      console.error('[Detection Engine Error] evaluateIntegrityTamper failed:', err.message);
    }
  }

  return result;
}

function tamperDocument(id) {
  const doc = getDocumentById(id);
  if (!doc) return null;

  let newContent = doc.content;
  let newFingerprint;

  if (doc.storageKey) {
    newFingerprint = storage.tamperStoredFile(doc.storageKey);
    newContent = doc.content + " [UNAUTHORIZED ALTERATION ADDED BY TAMPER SIMULATION]";
  } else {
    newContent = doc.content + " [UNAUTHORIZED ALTERATION ADDED BY TAMPER SIMULATION]";
    newFingerprint = generateFingerprint(newContent);
  }

  const newStatus = "Integrity Compromised";

  const db = getDb();
  db.prepare(`
    UPDATE documents
    SET content = ?, fingerprint = ?, isTampered = 1, status = ?
    WHERE id = ?;
  `).run(newContent, newFingerprint, newStatus, doc.id);

  const securityEvent = addSecurityEvent({
    severity: "CRITICAL",
    type: "UNAUTHORIZED_MODIFICATION",
    user: "UNKNOWN_INTRUDER",
    userRole: "Attacker",
    document: doc.name,
    documentId: doc.id,
    message: "Document payload modified! SHA-256 fingerprint integrity compromised."
  });

  addAuditLog({
    user: "System Integrity Monitor",
    userRole: "Automated System",
    action: "TAMPER_DETECTED",
    document: doc.name,
    documentId: doc.id,
    purpose: "Intrusion Detection",
    result: "WARNING",
    reason: `Document fingerprint altered from ${doc.originalFingerprint.substring(0, 8)}... to ${newFingerprint.substring(0, 8)}...`
  });

  try {
    const detectionEngine = require('../services/detectionEngine');
    detectionEngine.evaluateIntegrityTamper({
      documentId: doc.id,
      documentName: doc.name,
      expectedFingerprint: doc.originalFingerprint,
      actualFingerprint: newFingerprint,
      user: "UNKNOWN_INTRUDER",
      userRole: "Attacker"
    });
  } catch (err) {
    console.error('[Detection Engine Error] evaluateIntegrityTamper failed:', err.message);
  }

  return {
    document: getDocumentById(id),
    securityEvent
  };
}

function restoreDocument(id, user = "Administrator") {
  const doc = getDocumentById(id);
  if (!doc) return null;

  let restoredContent = doc.content;

  if (doc.storageKey) {
    const currentBuf = storage.readFile(doc.storageKey);
    if (currentBuf) {
      const tamperString = "\n[UNAUTHORIZED ALTERATION ADDED BY TAMPER SIMULATION]";
      const tamperBuf = Buffer.from(tamperString);
      const idx = currentBuf.lastIndexOf(tamperBuf);
      if (idx !== -1) {
        const cleanBuf = currentBuf.slice(0, idx);
        storage.restoreStoredFile(doc.storageKey, cleanBuf);
      }
    }
    restoredContent = doc.content.replace(" [UNAUTHORIZED ALTERATION ADDED BY TAMPER SIMULATION]", "");
  } else {
    if (restoredContent.includes(" [UNAUTHORIZED ALTERATION ADDED BY TAMPER SIMULATION]")) {
      restoredContent = restoredContent.replace(" [UNAUTHORIZED ALTERATION ADDED BY TAMPER SIMULATION]", "");
    }
  }

  const db = getDb();
  db.prepare(`
    UPDATE documents
    SET content = ?, fingerprint = originalFingerprint, isTampered = 0, status = 'Protected'
    WHERE id = ?;
  `).run(restoredContent, doc.id);

  addAuditLog({
    user,
    userRole: "Administrator",
    action: "DOCUMENT_RESTORE",
    document: doc.name,
    documentId: doc.id,
    purpose: "Remediation",
    result: "ALLOWED",
    reason: "Document fingerprint restored to verified state from secure backup."
  });

  try {
    const detectionEngine = require('../services/detectionEngine');
    detectionEngine.evaluateAdminChange({
      action: 'DOCUMENT_RESTORE',
      resourceType: 'DOCUMENT',
      resourceId: doc.id,
      resourceName: doc.name,
      user,
      userRole: 'Administrator',
      details: 'Document payload restored from pristine backup'
    });
  } catch (err) {
    console.error('[Detection Engine Error] evaluateAdminChange failed:', err.message);
  }

  return getDocumentById(id);
}

function getDocumentBinary(id) {
  const doc = getDocumentById(id);
  if (!doc) return null;

  let buffer;
  let mimeType = doc.mimeType || 'application/octet-stream';
  let filename = doc.originalFileName || doc.name;

  if (doc.storageKey) {
    buffer = storage.readFile(doc.storageKey);
    if (!buffer) {
      return { doc, missing: true };
    }
  } else {
    buffer = Buffer.from(doc.content, 'utf8');
    if (!filename.includes('.')) {
      filename = `${filename}.txt`;
    }
    mimeType = 'text/plain; charset=utf-8';
  }

  return {
    doc,
    buffer,
    mimeType,
    filename,
    missing: false
  };
}

// ==========================================
// POLICY OPERATIONS
// ==========================================

function getPolicies() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM access_policies ORDER BY createdAt DESC, rowid DESC;').all();
  return rows.map(deserializePolicy);
}

function getPolicyById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM access_policies WHERE id = ?;').get(id);
  return deserializePolicy(row);
}

function getPolicyByDocumentId(documentId) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM access_policies WHERE documentId = ? AND status = 'Active' ORDER BY createdAt DESC;").get(documentId);
  return deserializePolicy(row);
}

function addPolicy({ documentId, allowedRoles, allowedActions, purpose, startTime, endTime, user, userRole }) {
  const db = getDb();
  const doc = getDocumentById(documentId);
  const documentName = doc ? doc.name : documentId;

  const newPolicy = {
    id: getNextId('POL', 'access_policies'),
    documentId,
    documentName,
    allowedRoles: Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles],
    allowedActions: Array.isArray(allowedActions) ? allowedActions : [allowedActions],
    purpose: purpose || "Exam Preparation",
    startTime: startTime || "09:00",
    endTime: endTime || "18:00",
    status: "Active",
    createdAt: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO access_policies (
      id, documentId, documentName, allowedRoles, allowedActions, purpose, startTime, endTime, status, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).run(
    newPolicy.id, newPolicy.documentId, newPolicy.documentName,
    JSON.stringify(newPolicy.allowedRoles), JSON.stringify(newPolicy.allowedActions),
    newPolicy.purpose, newPolicy.startTime, newPolicy.endTime,
    newPolicy.status, newPolicy.createdAt
  );

  addAuditLog({
    user: user || "Administrator",
    userRole: userRole || "Administrator",
    action: "POLICY_CREATE",
    document: documentName,
    documentId,
    purpose: "Access Rule Creation",
    result: "ALLOWED",
    reason: `Created policy ${newPolicy.id} for roles [${newPolicy.allowedRoles.join(', ')}]`
  });

  try {
    const detectionEngine = require('../services/detectionEngine');
    detectionEngine.evaluateAdminChange({
      action: 'POLICY_CREATE',
      resourceType: 'POLICY',
      resourceId: newPolicy.id,
      resourceName: documentName,
      user: user || "Administrator",
      userRole: userRole || "Administrator",
      details: `Created policy for roles [${newPolicy.allowedRoles.join(', ')}]`
    });
  } catch (err) {
    console.error('[Detection Engine Error] evaluateAdminChange failed:', err.message);
  }

  return newPolicy;
}

function updatePolicy(id, updates, user = "Administrator", userRole = "Administrator") {
  const db = getDb();
  const existing = getPolicyById(id);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...updates,
    id: existing.id // keep ID invariant
  };

  db.prepare(`
    UPDATE access_policies
    SET documentName = ?, allowedRoles = ?, allowedActions = ?, purpose = ?,
        startTime = ?, endTime = ?, status = ?
    WHERE id = ?;
  `).run(
    updated.documentName,
    JSON.stringify(updated.allowedRoles),
    JSON.stringify(updated.allowedActions),
    updated.purpose,
    updated.startTime,
    updated.endTime,
    updated.status,
    id
  );

  addAuditLog({
    user,
    userRole,
    action: "POLICY_UPDATE",
    document: updated.documentName,
    documentId: updated.documentId,
    purpose: "Policy Modification",
    result: "ALLOWED",
    reason: `Updated policy ${updated.id} status to ${updated.status}`
  });

  try {
    const detectionEngine = require('../services/detectionEngine');
    detectionEngine.evaluateAdminChange({
      action: 'POLICY_UPDATE',
      resourceType: 'POLICY',
      resourceId: updated.id,
      resourceName: updated.documentName,
      user,
      userRole,
      details: `Updated policy status to ${updated.status}`
    });
  } catch (err) {
    console.error('[Detection Engine Error] evaluateAdminChange failed:', err.message);
  }

  return updated;
}

// ==========================================
// AUDIT LOG OPERATIONS
// ==========================================

function getAuditLogs({ filter, documentId } = {}) {
  const db = getDb();
  let query = 'SELECT * FROM audit_logs';
  const params = [];
  const whereClauses = [];

  if (filter && filter !== 'ALL' && filter !== 'All') {
    whereClauses.push('UPPER(result) = UPPER(?)');
    params.push(filter);
  }

  if (documentId) {
    whereClauses.push('documentId = ?');
    params.push(documentId);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ' ORDER BY rowid DESC;';

  const rows = db.prepare(query).all(...params);
  return rows.map(deserializeAuditLog);
}

function addAuditLog(entry) {
  const db = getDb();
  const id = getNextId('LOG', 'audit_logs');
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const ip = entry.ip || ("192.168.1." + Math.floor(Math.random() * 200 + 10));

  const log = {
    id,
    user: entry.user || "Unknown User",
    userRole: entry.userRole || "Staff",
    action: entry.action,
    document: entry.document,
    documentId: entry.documentId || "DOC-CUSTOM",
    purpose: entry.purpose || "General Access",
    timestamp,
    result: entry.result || "ALLOWED",
    reason: entry.reason || "Manual audit entry recorded",
    ip
  };

  db.prepare(`
    INSERT INTO audit_logs (id, user, userRole, action, document, documentId, purpose, timestamp, result, reason, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).run(
    log.id, log.user, log.userRole, log.action, log.document,
    log.documentId, log.purpose, log.timestamp, log.result, log.reason, log.ip
  );

  return log;
}

// ==========================================
// SECURITY EVENT OPERATIONS
// ==========================================

function getSecurityEvents(filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM security_events WHERE 1=1';
  const params = [];

  if (filters.severity && filters.severity !== 'ALL' && filters.severity !== 'all') {
    query += ' AND severity = ?';
    params.push(filters.severity);
  }

  if (filters.type && filters.type !== 'ALL' && filters.type !== 'all') {
    query += ' AND type = ?';
    params.push(filters.type);
  }

  if (filters.ruleId && filters.ruleId !== 'ALL' && filters.ruleId !== 'all') {
    query += ' AND ruleId = ?';
    params.push(filters.ruleId);
  }

  if (filters.outcome && filters.outcome !== 'ALL' && filters.outcome !== 'all') {
    query += ' AND outcome = ?';
    params.push(filters.outcome);
  }

  if (filters.incidentId) {
    query += ' AND incidentId = ?';
    params.push(filters.incidentId);
  }

  if (filters.isSimulated !== undefined) {
    query += ' AND isSimulated = ?';
    params.push(filters.isSimulated ? 1 : 0);
  }

  if (filters.startDate) {
    query += ' AND timestamp >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    query += ' AND timestamp <= ?';
    params.push(filters.endDate);
  }

  if (filters.search) {
    query += ' AND (id LIKE ? OR user LIKE ? OR document LIKE ? OR message LIKE ? OR ip LIKE ? OR ruleId LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term, term, term, term, term);
  }

  query += ' ORDER BY rowid DESC';

  if (filters.limit) {
    const limit = Math.min(Math.max(1, Number(filters.limit) || 20), 100);
    const offset = Math.max(0, ((Number(filters.page) || 1) - 1) * limit);
    query += ` LIMIT ${limit} OFFSET ${offset}`;
  }

  query += ';';

  const rows = db.prepare(query).all(...params);
  let events = rows.map(deserializeSecurityEvent);

  // Least-privilege redaction for ordinary users (e.g. Staff, Evaluator)
  if (filters.userRole && filters.userRole !== 'Administrator' && filters.userRole !== 'Exam Coordinator') {
    events = events.map(evt => ({
      ...evt,
      ip: 'REDACTED',
      correlationId: undefined,
      metadata: undefined
    }));
  }

  return events;
}

function getSecurityEventById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM security_events WHERE id = ?;').get(id);
  return deserializeSecurityEvent(row);
}

function addSecurityEvent(event) {
  const db = getDb();
  const id = getNextId('SEC', 'security_events');
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const ip = event.ip || "192.168.1.45";

  const sec = {
    id,
    severity: event.severity || "MEDIUM",
    type: event.type || "SECURITY_ALERT",
    user: event.user || "Unknown",
    userRole: event.userRole || "Staff",
    document: event.document || "System",
    documentId: event.documentId || "DOC-001",
    message: event.message,
    timestamp,
    status: event.status || "Active",
    ip,
    reviewedBy: event.reviewedBy || null,
    reviewedAt: event.reviewedAt || null,
    actorId: event.actorId || null,
    actorRole: event.actorRole || event.userRole || "Staff",
    resourceType: event.resourceType || (event.documentId && event.documentId.startsWith('DOC-') ? 'DOCUMENT' : 'SYSTEM'),
    resourceId: event.resourceId || event.documentId || "SYS",
    resourceName: event.resourceName || event.document || "System",
    correlationId: event.correlationId || null,
    outcome: event.outcome || (event.severity === 'CRITICAL' || event.severity === 'HIGH' ? 'DENIED' : 'ALLOWED'),
    ruleId: event.ruleId || null,
    explanation: event.explanation || event.message,
    incidentId: event.incidentId || null,
    isSimulated: event.isSimulated ? 1 : 0,
    metadata: event.metadata ? (typeof event.metadata === 'string' ? event.metadata : JSON.stringify(event.metadata)) : null
  };

  db.prepare(`
    INSERT INTO security_events (
      id, severity, type, user, userRole, document, documentId, message, timestamp, status, ip, reviewedBy, reviewedAt,
      actorId, actorRole, resourceType, resourceId, resourceName, correlationId, outcome, ruleId, explanation, incidentId, isSimulated, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).run(
    sec.id, sec.severity, sec.type, sec.user, sec.userRole, sec.document,
    sec.documentId, sec.message, sec.timestamp, sec.status, sec.ip, sec.reviewedBy, sec.reviewedAt,
    sec.actorId, sec.actorRole, sec.resourceType, sec.resourceId, sec.resourceName, sec.correlationId,
    sec.outcome, sec.ruleId, sec.explanation, sec.incidentId, sec.isSimulated, sec.metadata
  );

  return deserializeSecurityEvent(sec);
}

function reviewSecurityEvent(id, { user, status }) {
  const event = getSecurityEventById(id);
  if (!event) return null;

  const db = getDb();
  const reviewedStatus = status || "Reviewed";
  const reviewer = user || "Administrator";
  const reviewedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

  db.prepare(`
    UPDATE security_events
    SET status = ?, reviewedBy = ?, reviewedAt = ?
    WHERE id = ?;
  `).run(reviewedStatus, reviewer, reviewedAt, id);

  addAuditLog({
    user: reviewer,
    userRole: "Administrator",
    action: "SECURITY_EVENT_REVIEW",
    document: event.document || "System",
    documentId: event.documentId || "SYS",
    purpose: "Threat Management",
    result: "ALLOWED",
    reason: `Marked security alert ${event.id} (${event.type}) as ${reviewedStatus}`
  });

  return getSecurityEventById(id);
}

function getSecurityStats(timeRange = 'all') {
  const db = getDb();

  let timeFilter = '';
  const now = Date.now();
  if (timeRange === '1h') {
    const cut = new Date(now - 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    timeFilter = ` AND timestamp >= '${cut}'`;
  } else if (timeRange === '24h') {
    const cut = new Date(now - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    timeFilter = ` AND timestamp >= '${cut}'`;
  } else if (timeRange === '7d') {
    const cut = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    timeFilter = ` AND timestamp >= '${cut}'`;
  } else if (timeRange === '30d') {
    const cut = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    timeFilter = ` AND timestamp >= '${cut}'`;
  }

  const blockedAttempts = db.prepare(`SELECT count(*) as c FROM audit_logs WHERE result = 'BLOCKED'${timeFilter};`).get().c;
  const suspiciousActivities = db.prepare(`SELECT count(*) as c FROM security_events WHERE 1=1${timeFilter};`).get().c;
  const activeAlerts = db.prepare(`SELECT count(*) as c FROM security_events WHERE status = 'Active'${timeFilter};`).get().c;

  const tamperedCount = db.prepare('SELECT count(*) as c FROM documents WHERE isTampered = 1;').get().c;
  const auditWarnings = db.prepare(`SELECT count(*) as c FROM audit_logs WHERE (result = 'WARNING' OR action = 'TAMPER_DETECTED')${timeFilter};`).get().c;
  const integrityWarnings = tamperedCount + auditWarnings;

  const totalDocs = db.prepare('SELECT count(*) as c FROM documents;').get().c;
  const activePolicies = db.prepare("SELECT count(*) as c FROM access_policies WHERE status = 'Active';").get().c;
  const totalAuditEntries = db.prepare(`SELECT count(*) as c FROM audit_logs WHERE 1=1${timeFilter};`).get().c;

  const integrityPercentage = totalDocs > 0 ? (((totalDocs - tamperedCount) / totalDocs) * 100).toFixed(1) : "100.0";

  // Phase 4 incident metrics
  const openIncidents = db.prepare("SELECT count(*) as c FROM incidents WHERE status = 'Open';").get().c;
  const investigatingIncidents = db.prepare("SELECT count(*) as c FROM incidents WHERE status = 'Investigating';").get().c;
  const resolvedIncidents = db.prepare("SELECT count(*) as c FROM incidents WHERE status = 'Resolved';").get().c;
  const falsePositiveIncidents = db.prepare("SELECT count(*) as c FROM incidents WHERE status = 'False Positive';").get().c;

  const failedAuthCount = db.prepare(`SELECT count(*) as c FROM audit_logs WHERE action IN ('AUTH_LOGIN_FAILED', 'AUTH_ACCOUNT_COOLDOWN_BLOCKED')${timeFilter};`).get().c;

  // Severity distribution
  const severityRows = db.prepare(`SELECT severity, count(*) as count FROM security_events WHERE 1=1${timeFilter} GROUP BY severity;`).all();
  const eventsBySeverity = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0
  };
  for (const row of severityRows) {
    if (eventsBySeverity[row.severity] !== undefined) {
      eventsBySeverity[row.severity] = row.count;
    }
  }

  return {
    protectedDocuments: totalDocs,
    activePolicies,
    blockedAttempts,
    suspiciousActivities,
    activeAlerts,
    integrityWarnings,
    integrityPercentage: `${integrityPercentage}%`,
    totalAuditEntries,
    openIncidents,
    investigatingIncidents,
    resolvedIncidents,
    falsePositiveIncidents,
    failedAuthCount,
    eventsBySeverity,
    timeRange
  };
}

// ==========================================
// CONTEXT-AWARE ACCESS ENGINE
// ==========================================

function logAccessDecision({ user, document, documentId, action, purpose, result, reason, isSimulation = false, operator = null, severity = null, secType = null }) {
  const actorName = isSimulation && operator ? operator.name : (user ? user.name : "Unknown User");
  const actorRole = isSimulation && operator ? operator.role : (user ? user.role : "Unknown");
  const auditAction = isSimulation ? 'SIMULATION_ACCESS_CHECK' : `DOCUMENT_${action}`;
  const auditReason = isSimulation
    ? `[SIMULATION for ${user ? `${user.name} (${user.role})` : documentId}] ${reason}`
    : reason;

  addAuditLog({
    user: actorName,
    userRole: actorRole,
    action: auditAction,
    document: document ? document.name : documentId,
    documentId: document ? document.id : documentId,
    purpose: isSimulation ? `[SIMULATION] ${purpose}` : purpose,
    result,
    reason: auditReason
  });

  if (result === 'BLOCKED' && secType) {
    addSecurityEvent({
      severity: severity || (document && document.sensitivity === 'Critical' ? 'CRITICAL' : 'HIGH'),
      type: isSimulation ? 'SIMULATION_ACCESS_BLOCKED' : secType,
      user: actorName,
      userRole: actorRole,
      document: document ? document.name : documentId,
      documentId: document ? document.id : documentId,
      message: isSimulation
        ? `[SIMULATION by ${actorName}] Access check for ${user ? `${user.name} (${user.role})` : documentId} was BLOCKED: ${reason}`
        : reason
    });
  }

  // Phase 4: Threat Detection Evaluation
  try {
    const detectionEngine = require('../services/detectionEngine');
    if (result === 'BLOCKED') {
      detectionEngine.evaluateUnauthorizedAccess({
        user: actorName,
        userRole: actorRole,
        document: document ? document.name : documentId,
        documentId: document ? document.id : documentId,
        ip: null,
        isSimulated: Boolean(isSimulation)
      });
    } else if (result === 'ALLOWED') {
      detectionEngine.evaluateSuspiciousPattern({
        user: actorName,
        userRole: actorRole,
        document: document ? document.name : documentId,
        documentId: document ? document.id : documentId,
        ip: null,
        isSimulated: Boolean(isSimulation)
      });
    }
  } catch (err) {
    console.error('[Detection Engine Error] logAccessDecision evaluation failed:', err.message);
  }
}

function checkAccess({ userId, documentId, action = "VIEW", purpose = "Exam Preparation", isSimulation = false, operator = null }) {
  const user = getUserById(userId);
  if (!user) {
    const reason = "User profile not found in directory";
    logAccessDecision({
      user: null,
      document: null,
      documentId,
      action,
      purpose,
      result: "BLOCKED",
      reason,
      isSimulation,
      operator,
      severity: "MEDIUM",
      secType: "INVALID_USER_ACCESS"
    });
    return { allowed: false, reason, isSimulation, operator: operator ? operator.name : undefined };
  }

  const document = getDocumentById(documentId);
  if (!document) {
    const reason = "Document not found in vault";
    logAccessDecision({
      user,
      document: null,
      documentId,
      action,
      purpose,
      result: "BLOCKED",
      reason,
      isSimulation,
      operator,
      severity: "LOW",
      secType: "MISSING_DOC_ACCESS"
    });
    return { allowed: false, reason, isSimulation, operator: operator ? operator.name : undefined };
  }

  const policy = getPolicyByDocumentId(document.id);
  if (!policy) {
    const reason = "No active access policy configured for this document";
    logAccessDecision({
      user,
      document,
      documentId: document.id,
      action,
      purpose,
      result: "BLOCKED",
      reason,
      isSimulation,
      operator,
      severity: "MEDIUM",
      secType: "UNPOLICY_ACCESS_ATTEMPT"
    });
    return { allowed: false, reason, isSimulation, operator: operator ? operator.name : undefined };
  }

  // 1. Tamper Integrity Check
  if (document.isTampered) {
    const reason = "ACCESS BLOCKED: Document integrity compromise detected! SHA-256 fingerprint mismatch.";
    logAccessDecision({
      user,
      document,
      documentId: document.id,
      action,
      purpose,
      result: "BLOCKED",
      reason,
      isSimulation,
      operator,
      severity: "CRITICAL",
      secType: "INTEGRITY_ALERT"
    });
    return {
      allowed: false,
      reason,
      policy,
      isSimulation: Boolean(isSimulation),
      operator: operator ? operator.name : undefined,
      simulatedPersona: isSimulation ? user.name : undefined
    };
  }

  // 2. Role Authorization Check
  const isRoleAllowed = policy.allowedRoles.includes(user.role) || user.role === "Administrator";
  if (!isRoleAllowed) {
    const reason = `Role '${user.role}' is not in allowed policy roles: [${policy.allowedRoles.join(', ')}]`;
    logAccessDecision({
      user,
      document,
      documentId: document.id,
      action,
      purpose,
      result: "BLOCKED",
      reason,
      isSimulation,
      operator,
      severity: document.sensitivity === "Critical" ? "CRITICAL" : "HIGH",
      secType: "UNAUTHORIZED_ACCESS"
    });
    return {
      allowed: false,
      reason,
      policy,
      isSimulation: Boolean(isSimulation),
      operator: operator ? operator.name : undefined,
      simulatedPersona: isSimulation ? user.name : undefined
    };
  }

  // 3. Action Authorization Check
  const isActionAllowed = policy.allowedActions.includes(action.toUpperCase());
  if (!isActionAllowed) {
    const reason = `Action '${action}' is not permitted by policy. Allowed: [${policy.allowedActions.join(', ')}]`;
    logAccessDecision({
      user,
      document,
      documentId: document.id,
      action,
      purpose,
      result: "BLOCKED",
      reason,
      isSimulation,
      operator,
      severity: "MEDIUM",
      secType: "ACTION_VIOLATION"
    });
    return {
      allowed: false,
      reason,
      policy,
      isSimulation: Boolean(isSimulation),
      operator: operator ? operator.name : undefined,
      simulatedPersona: isSimulation ? user.name : undefined
    };
  }

  // 4. Time Window Check
  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (policy.startTime && policy.endTime) {
    if (currentHHMM < policy.startTime || currentHHMM > policy.endTime) {
      const reason = `Access attempted outside permitted time window (${policy.startTime} - ${policy.endTime}). Current time: ${currentHHMM}`;
      logAccessDecision({
        user,
        document,
        documentId: document.id,
        action,
        purpose,
        result: "BLOCKED",
        reason,
        isSimulation,
        operator,
        severity: "HIGH",
        secType: "TIME_POLICY_VIOLATION"
      });
      return {
        allowed: false,
        reason,
        policy,
        isSimulation: Boolean(isSimulation),
        operator: operator ? operator.name : undefined,
        simulatedPersona: isSimulation ? user.name : undefined
      };
    }
  }

  // 5. Purpose Check
  if (policy.purpose && purpose && policy.purpose.toLowerCase() !== purpose.toLowerCase()) {
    const reason = `Requested purpose '${purpose}' does not match policy purpose '${policy.purpose}'`;
    logAccessDecision({
      user,
      document,
      documentId: document.id,
      action,
      purpose,
      result: "BLOCKED",
      reason,
      isSimulation,
      operator,
      severity: "LOW",
      secType: "PURPOSE_MISMATCH"
    });
    return {
      allowed: false,
      reason,
      policy,
      isSimulation: Boolean(isSimulation),
      operator: operator ? operator.name : undefined,
      simulatedPersona: isSimulation ? user.name : undefined
    };
  }

  // All checks passed!
  const reason = `Access granted under policy ${policy.id}`;
  logAccessDecision({
    user,
    document,
    documentId: document.id,
    action,
    purpose,
    result: "ALLOWED",
    reason,
    isSimulation,
    operator
  });

  return {
    allowed: true,
    reason,
    policy,
    isSimulation: Boolean(isSimulation),
    operator: operator ? operator.name : undefined,
    simulatedPersona: isSimulation ? user.name : undefined
  };
}

// ==========================================
// TOKEN REVOCATION OPERATIONS
// ==========================================

function revokeToken({ jti, userId, expiresAt }) {
  if (!jti) return false;
  const db = getDb();
  cleanupExpiredRevokedTokens();
  const revokedAt = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO revoked_tokens (jti, userId, revokedAt, expiresAt)
    VALUES (?, ?, ?, ?);
  `).run(jti, userId || 'UNKNOWN', revokedAt, Number(expiresAt) || 0);
  return true;
}

function isTokenRevoked(jti) {
  if (!jti) return false;
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM revoked_tokens WHERE jti = ?;').get(jti);
  return Boolean(row);
}

function cleanupExpiredRevokedTokens() {
  try {
    const db = getDb();
    const nowEpoch = Math.floor(Date.now() / 1000);
    db.prepare('DELETE FROM revoked_tokens WHERE expiresAt < ?;').run(nowEpoch);
  } catch (err) {
    // Non-critical cleanup
  }
}

// ==========================================
// USER SESSION & ACCOUNT PROTECTION
// ==========================================

function revokeAllUserSessions(userId) {
  if (!userId) return false;
  const db = getDb();
  const stmt = db.prepare('UPDATE users SET tokenVersion = COALESCE(tokenVersion, 1) + 1 WHERE id = ? OR email = ?;');
  const result = stmt.run(userId, userId);
  return result.changes > 0;
}

const DEFAULT_ACCOUNT_LOCKOUT_MAX = 5;
const DEFAULT_ACCOUNT_LOCKOUT_WINDOW = 15 * 60; // 15 minutes
const DEFAULT_ACCOUNT_LOCKOUT_COOLDOWN = 60; // 60 seconds temporary cooldown

function getAccountLockoutConfig() {
  return {
    maxAttempts: process.env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS ? Number(process.env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS) : DEFAULT_ACCOUNT_LOCKOUT_MAX,
    windowSeconds: process.env.ACCOUNT_LOCKOUT_WINDOW_SECONDS ? Number(process.env.ACCOUNT_LOCKOUT_WINDOW_SECONDS) : DEFAULT_ACCOUNT_LOCKOUT_WINDOW,
    cooldownSeconds: process.env.ACCOUNT_LOCKOUT_COOLDOWN_SECONDS ? Number(process.env.ACCOUNT_LOCKOUT_COOLDOWN_SECONDS) : DEFAULT_ACCOUNT_LOCKOUT_COOLDOWN
  };
}

function getAccountLoginStatus(email) {
  if (!email || typeof email !== 'string') return { isLocked: false, remainingCooldown: 0, failedAttempts: 0 };
  const accountKey = email.trim().toLowerCase();
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const config = getAccountLockoutConfig();

  const row = db.prepare('SELECT failedAttempts, firstFailedAt, lastFailedAt, cooldownUntil FROM account_login_attempts WHERE accountKey = ?;').get(accountKey);
  if (!row) {
    return { isLocked: false, remainingCooldown: 0, failedAttempts: 0 };
  }

  // Active cooldown check
  if (row.cooldownUntil && row.cooldownUntil > now) {
    return {
      isLocked: true,
      remainingCooldown: row.cooldownUntil - now,
      failedAttempts: row.failedAttempts
    };
  }

  // If window has passed and not in cooldown, failure window has reset
  if (now - row.firstFailedAt > config.windowSeconds) {
    return { isLocked: false, remainingCooldown: 0, failedAttempts: 0 };
  }

  return {
    isLocked: false,
    remainingCooldown: 0,
    failedAttempts: row.failedAttempts
  };
}

function recordFailedLoginAttempt(email) {
  if (!email || typeof email !== 'string') return { isLocked: false, remainingCooldown: 0, failedAttempts: 0 };
  const accountKey = email.trim().toLowerCase();
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const config = getAccountLockoutConfig();

  const row = db.prepare('SELECT failedAttempts, firstFailedAt, lastFailedAt, cooldownUntil FROM account_login_attempts WHERE accountKey = ?;').get(accountKey);

  let newAttempts = 1;
  let firstFailedAt = now;
  let cooldownUntil = 0;

  if (row) {
    if (now - row.firstFailedAt > config.windowSeconds) {
      newAttempts = 1;
      firstFailedAt = now;
    } else {
      newAttempts = row.failedAttempts + 1;
      firstFailedAt = row.firstFailedAt;
    }
  }

  let isLocked = false;
  if (newAttempts >= config.maxAttempts) {
    cooldownUntil = now + config.cooldownSeconds;
    isLocked = true;
  }

  db.prepare(`
    INSERT INTO account_login_attempts (accountKey, failedAttempts, firstFailedAt, lastFailedAt, cooldownUntil)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(accountKey) DO UPDATE SET
      failedAttempts = excluded.failedAttempts,
      firstFailedAt = excluded.firstFailedAt,
      lastFailedAt = excluded.lastFailedAt,
      cooldownUntil = excluded.cooldownUntil;
  `).run(accountKey, newAttempts, firstFailedAt, now, cooldownUntil);

  return {
    isLocked,
    failedAttempts: newAttempts,
    cooldownUntil,
    remainingCooldown: isLocked ? config.cooldownSeconds : 0
  };
}

function resetAccountLoginAttempts(email) {
  if (!email || typeof email !== 'string') return;
  const accountKey = email.trim().toLowerCase();
  const db = getDb();
  db.prepare('DELETE FROM account_login_attempts WHERE accountKey = ?;').run(accountKey);
}

function cleanupExpiredAccountAttempts() {
  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const config = getAccountLockoutConfig();
    db.prepare(`
      DELETE FROM account_login_attempts 
      WHERE cooldownUntil < ? AND (lastFailedAt + ?) < ?;
    `).run(now, config.windowSeconds, now);
  } catch (err) {
    // Non-critical cleanup
  }
}

// Module Exports with backward-compatible array getters
module.exports = {
  // Functions
  getUsers,
  getUserById,
  getUserByEmailWithPassword,
  getDocuments,
  getDocumentById,
  addDocument,
  verifyDocument,
  tamperDocument,
  restoreDocument,
  getPolicies,
  getPolicyById,
  getPolicyByDocumentId,
  addPolicy,
  updatePolicy,
  getAuditLogs,
  addAuditLog,
  getSecurityEvents,
  getSecurityEventById,
  addSecurityEvent,
  reviewSecurityEvent,
  getSecurityStats,
  checkAccess,
  revokeToken,
  isTokenRevoked,
  cleanupExpiredRevokedTokens,
  revokeAllUserSessions,
  getAccountLoginStatus,
  recordFailedLoginAttempt,
  resetAccountLoginAttempts,
  cleanupExpiredAccountAttempts,
  getDocumentBinary,
  deserializeSecurityEvent,
  getNextId,

  // Backward-compatibility getters
  get users() { return getUsers(); },
  get documents() { return getDocuments(); },
  get accessPolicies() { return getPolicies(); },
  get auditLogs() { return getAuditLogs(); },
  get securityEvents() { return getSecurityEvents(); }
};

