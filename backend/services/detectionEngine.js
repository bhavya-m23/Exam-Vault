/**
 * ExamVault Threat Detection Engine & Incident Management Service
 * Phase 4: Deterministic, configurable detection rules, idempotent incident correlation,
 * and immutable investigation audit trails.
 */

const { getDb } = require('../db');
const config = require('../config');

/**
 * Generate sequential unique IDs (e.g. INC-001, NOTE-001)
 */
function getNextSequenceId(prefix, tableName) {
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
 * Deserializers
 */
function deserializeIncident(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    status: row.status,
    ruleId: row.ruleId || null,
    correlationKey: row.correlationKey || null,
    firstDetectedAt: row.firstDetectedAt,
    lastActivityAt: row.lastActivityAt,
    assignedTo: row.assignedTo || null,
    resolutionSummary: row.resolutionSummary || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isSimulated: Boolean(row.isSimulated)
  };
}

function deserializeIncidentNote(row) {
  if (!row) return null;
  return {
    id: row.id,
    incidentId: row.incidentId,
    author: row.author,
    authorRole: row.authorRole,
    note: row.note,
    action: row.action,
    timestamp: row.timestamp
  };
}

function deserializeRuleState(row) {
  if (!row) return null;
  let parsedConfig = {};
  try {
    parsedConfig = typeof row.thresholdConfig === 'string' ? JSON.parse(row.thresholdConfig) : row.thresholdConfig;
  } catch {
    parsedConfig = {};
  }
  return {
    ruleId: row.ruleId,
    name: row.name,
    description: row.description,
    severity: row.severity,
    thresholdConfig: parsedConfig,
    enabled: Boolean(row.enabled),
    lastTriggeredAt: row.lastTriggeredAt || null,
    triggerCount: Number(row.triggerCount || 0)
  };
}

// ==========================================
// DETECTION RULE MANAGEMENT
// ==========================================

function getDetectionRules() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM detection_rules_state ORDER BY ruleId ASC;').all();
  return rows.map(deserializeRuleState);
}

function getDetectionRuleById(ruleId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM detection_rules_state WHERE ruleId = ?;').get(ruleId);
  return deserializeRuleState(row);
}

function updateDetectionRule(ruleId, { enabled, thresholdConfig }) {
  const db = getDb();
  const existing = getDetectionRuleById(ruleId);
  if (!existing) return null;

  const newEnabled = enabled !== undefined ? (enabled ? 1 : 0) : (existing.enabled ? 1 : 0);
  const newConfig = thresholdConfig !== undefined
    ? (typeof thresholdConfig === 'string' ? thresholdConfig : JSON.stringify(thresholdConfig))
    : JSON.stringify(existing.thresholdConfig);

  db.prepare(`
    UPDATE detection_rules_state
    SET enabled = ?, thresholdConfig = ?
    WHERE ruleId = ?;
  `).run(newEnabled, newConfig, ruleId);

  return getDetectionRuleById(ruleId);
}

function recordRuleTrigger(ruleId) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE detection_rules_state
    SET triggerCount = triggerCount + 1, lastTriggeredAt = ?
    WHERE ruleId = ?;
  `).run(now, ruleId);
}

// ==========================================
// INCIDENT MANAGEMENT
// ==========================================

/**
 * Retrieves or creates an active incident based on correlation key.
 * If an Open or Investigating incident exists with this correlation key, it groups the new activity
 * into the existing incident without creating duplicates.
 */
function getOrCreateIncident({
  title,
  description,
  severity,
  ruleId,
  correlationKey,
  isSimulated = false
}) {
  const db = getDb();
  const now = new Date().toISOString();

  if (correlationKey) {
    const existing = db.prepare(`
      SELECT * FROM incidents
      WHERE correlationKey = ? AND status IN ('Open', 'Investigating')
      ORDER BY rowid DESC LIMIT 1;
    `).get(correlationKey);

    if (existing) {
      db.prepare(`
        UPDATE incidents
        SET lastActivityAt = ?, updatedAt = ?
        WHERE id = ?;
      `).run(now, now, existing.id);

      return {
        incident: deserializeIncident({ ...existing, lastActivityAt: now, updatedAt: now }),
        isNew: false
      };
    }
  }

  // Create new incident
  const id = getNextSequenceId('INC', 'incidents');
  const sim = isSimulated ? 1 : 0;

  db.prepare(`
    INSERT INTO incidents (
      id, title, description, severity, status, ruleId, correlationKey,
      firstDetectedAt, lastActivityAt, assignedTo, resolutionSummary, createdAt, updatedAt, isSimulated
    ) VALUES (?, ?, ?, ?, 'Open', ?, ?, ?, ?, NULL, NULL, ?, ?, ?);
  `).run(
    id, title, description, severity, ruleId, correlationKey,
    now, now, now, now, sim
  );

  // Add initial note
  const noteId = getNextSequenceId('NOTE', 'incident_notes');
  db.prepare(`
    INSERT INTO incident_notes (id, incidentId, author, authorRole, note, action, timestamp)
    VALUES (?, ?, 'Detection Engine', 'System', ?, 'INCIDENT_OPENED', ?);
  `).run(
    noteId, id,
    `Incident automatically created by detection rule ${ruleId || 'SYSTEM'}: ${description}`,
    now
  );

  const created = db.prepare('SELECT * FROM incidents WHERE id = ?;').get(id);
  return {
    incident: deserializeIncident(created),
    isNew: true
  };
}

function getIncidents({
  status,
  severity,
  assignedTo,
  search,
  page = 1,
  limit = 20
} = {}) {
  const db = getDb();
  let baseQuery = 'FROM incidents WHERE 1=1';
  const params = [];

  if (status && status !== 'all' && status !== 'ALL') {
    baseQuery += ' AND status = ?';
    params.push(status);
  }

  if (severity && severity !== 'all' && severity !== 'ALL') {
    baseQuery += ' AND severity = ?';
    params.push(severity);
  }

  if (assignedTo) {
    baseQuery += ' AND assignedTo = ?';
    params.push(assignedTo);
  }

  if (search) {
    baseQuery += ' AND (id LIKE ? OR title LIKE ? OR description LIKE ? OR correlationKey LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  const countRow = db.prepare(`SELECT count(*) as total ${baseQuery};`).get(...params);
  const total = countRow ? countRow.total : 0;

  const validLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
  const validPage = Math.max(1, Number(page) || 1);
  const offset = (validPage - 1) * validLimit;

  const dataQuery = `SELECT * ${baseQuery} ORDER BY rowid DESC LIMIT ? OFFSET ?;`;
  const rows = db.prepare(dataQuery).all(...params, validLimit, offset);

  // Enrich with event count and notes count
  const incidents = rows.map(r => {
    const inc = deserializeIncident(r);
    const eventCount = db.prepare('SELECT count(*) as c FROM security_events WHERE incidentId = ?;').get(inc.id)?.c || 0;
    const noteCount = db.prepare('SELECT count(*) as c FROM incident_notes WHERE incidentId = ?;').get(inc.id)?.c || 0;
    return {
      ...inc,
      eventCount,
      noteCount
    };
  });

  return {
    incidents,
    pagination: {
      total,
      page: validPage,
      limit: validLimit,
      totalPages: Math.ceil(total / validLimit) || 1
    }
  };
}

function getIncidentById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM incidents WHERE id = ?;').get(id);
  if (!row) return null;

  const incident = deserializeIncident(row);
  const events = db.prepare('SELECT * FROM security_events WHERE incidentId = ? ORDER BY rowid ASC;').all(id);
  const notes = db.prepare('SELECT * FROM incident_notes WHERE incidentId = ? ORDER BY rowid ASC;').all(id);

  return {
    ...incident,
    events: events.map(r => {
      // Lazy require to avoid circular dependency
      const { deserializeSecurityEvent } = require('../data/store');
      return deserializeSecurityEvent(r);
    }),
    notes: notes.map(deserializeIncidentNote)
  };
}

function addIncidentNote(id, { author, authorRole, note }) {
  const db = getDb();
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?;').get(id);
  if (!incident) return null;

  if (!note || typeof note !== 'string' || note.trim().length === 0) {
    throw new Error('Note content cannot be empty.');
  }

  const noteId = getNextSequenceId('NOTE', 'incident_notes');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO incident_notes (id, incidentId, author, authorRole, note, action, timestamp)
    VALUES (?, ?, ?, ?, ?, 'NOTE_ADDED', ?);
  `).run(noteId, id, author || 'Investigator', authorRole || 'Administrator', note.trim(), now);

  db.prepare('UPDATE incidents SET updatedAt = ? WHERE id = ?;').run(now, id);

  return getIncidentById(id);
}

function updateIncidentStatus(id, { status, resolutionSummary, note, author, authorRole }) {
  const db = getDb();
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?;').get(id);
  if (!incident) return null;

  const validStatuses = ['Open', 'Investigating', 'Resolved', 'False Positive'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid incident status '${status}'. Must be one of: ${validStatuses.join(', ')}`);
  }

  if ((status === 'Resolved' || status === 'False Positive') && !resolutionSummary && !note) {
    throw new Error(`Resolving or closing an incident requires a resolution summary or note.`);
  }

  const now = new Date().toISOString();
  const noteId = getNextSequenceId('NOTE', 'incident_notes');
  const action = status === 'Resolved' ? 'RESOLVED' : (status === 'False Positive' ? 'FALSE_POSITIVE' : 'STATUS_CHANGED');
  const noteText = note || (resolutionSummary ? `Status changed to ${status}. Summary: ${resolutionSummary}` : `Status changed to ${status}`);

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      UPDATE incidents
      SET status = ?, resolutionSummary = COALESCE(?, resolutionSummary), updatedAt = ?
      WHERE id = ?;
    `).run(status, resolutionSummary || null, now, id);

    db.prepare(`
      INSERT INTO incident_notes (id, incidentId, author, authorRole, note, action, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `).run(noteId, id, author || 'Investigator', authorRole || 'Administrator', noteText, action, now);

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return getIncidentById(id);
}

function assignIncident(id, { assignedTo, author, authorRole }) {
  const db = getDb();
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?;').get(id);
  if (!incident) return null;

  const now = new Date().toISOString();
  const noteId = getNextSequenceId('NOTE', 'incident_notes');

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      UPDATE incidents
      SET assignedTo = ?, status = CASE WHEN status = 'Open' THEN 'Investigating' ELSE status END, updatedAt = ?
      WHERE id = ?;
    `).run(assignedTo, now, id);

    db.prepare(`
      INSERT INTO incident_notes (id, incidentId, author, authorRole, note, action, timestamp)
      VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?);
    `).run(
      noteId, id,
      author || 'Administrator',
      authorRole || 'Administrator',
      `Incident assigned to ${assignedTo}. Status updated to Investigating.`,
      now
    );

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return getIncidentById(id);
}

// ==========================================
// DETERMINISTIC DETECTION RULES EVALUATION
// ==========================================

/**
 * RULE A: Repeated Failed Authentication
 * Detects multiple failed authentication events within a bounded evaluation window.
 */
function evaluateAuthFailure({ user, ip, isSimulated = false }) {
  const db = getDb();
  const rule = getDetectionRuleById('RULE-AUTH-FAILED');
  if (!rule || !rule.enabled) return { alertGenerated: false };

  const threshold = config.DETECTION_AUTH_FAIL_THRESHOLD;
  const windowMs = config.DETECTION_AUTH_FAIL_WINDOW_MS;
  const windowStart = new Date(Date.now() - windowMs).toISOString().replace('T', ' ').substring(0, 19);

  // Parameterized query over indexed audit_logs table
  const failCount = db.prepare(`
    SELECT count(*) as count
    FROM audit_logs
    WHERE action IN ('AUTH_LOGIN_FAILED', 'AUTH_ACCOUNT_COOLDOWN_BLOCKED')
      AND (user = ? OR ip = ?)
      AND timestamp >= ?;
  `).get(user || '', ip || '', windowStart)?.count || 0;

  if (failCount < threshold) {
    return { alertGenerated: false, count: failCount, threshold };
  }

  // Correlate by IP and user
  const correlationKey = `auth:burst:${ip || 'unknown'}:${user ? user.toLowerCase() : 'anon'}`;

  // Idempotency check: Debounce alerts in the same burst (5 min window)
  const debounceWindow = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
  const recentAlert = db.prepare(`
    SELECT id FROM security_events
    WHERE ruleId = 'RULE-AUTH-FAILED'
      AND (correlationId = ? OR ip = ?)
      AND timestamp >= ?
    LIMIT 1;
  `).get(correlationKey, ip || '', debounceWindow);

  // Associate or create incident
  const { incident } = getOrCreateIncident({
    title: `Repeated Failed Authentication Detected (${user || ip})`,
    description: `Multiple failed authentication attempts (${failCount} failures) detected within evaluation window (${Math.round(windowMs / 60000)}m). Indicates possible brute force or credential stuffing attack.`,
    severity: 'HIGH',
    ruleId: 'RULE-AUTH-FAILED',
    correlationKey,
    isSimulated
  });

  if (recentAlert) {
    // Alert already generated recently in this burst; incident activity updated without creating duplicate alert
    return { alertGenerated: false, debounced: true, incidentId: incident.id };
  }

  // Create high-severity security alert
  const { addSecurityEvent } = require('../data/store');
  const secEvent = addSecurityEvent({
    severity: 'HIGH',
    type: 'BRUTE_FORCE_BURST',
    ruleId: 'RULE-AUTH-FAILED',
    correlationId: correlationKey,
    incidentId: incident.id,
    user: user || 'Anonymous',
    userRole: 'Anonymous',
    document: 'Authentication Gateway',
    documentId: 'AUTH-GATE',
    resourceType: 'AUTH',
    resourceId: 'AUTH-GATE',
    resourceName: 'Authentication Gateway',
    outcome: 'FAILED',
    ip: ip || '127.0.0.1',
    message: `Repeated failed authentication attempts detected for ${user || ip} (${failCount} failures within 15 minutes).`,
    explanation: `Evaluation rule threshold exceeded (${failCount} >= ${threshold}). Multiple failed sign-ins in a bounded window indicates automated credential stuffing or brute force probing.`,
    isSimulated,
    metadata: { failCount, threshold, windowMinutes: Math.round(windowMs / 60000), targetAccount: user || 'Unknown' }
  });

  recordRuleTrigger('RULE-AUTH-FAILED');
  return { alertGenerated: true, ruleId: 'RULE-AUTH-FAILED', event: secEvent, incident };
}

/**
 * RULE B: Repeated Unauthorized Document Access
 * Detects repeated access denials targeting confidential documents.
 */
function evaluateUnauthorizedAccess({ user, userRole, document, documentId, ip, isSimulated = false }) {
  const db = getDb();
  const rule = getDetectionRuleById('RULE-DOC-UNAUTHORIZED');
  if (!rule || !rule.enabled) return { alertGenerated: false };

  const threshold = config.DETECTION_DOC_UNAUTH_THRESHOLD;
  const windowMs = config.DETECTION_DOC_UNAUTH_WINDOW_MS;
  const windowStart = new Date(Date.now() - windowMs).toISOString().replace('T', ' ').substring(0, 19);

  const stats = db.prepare(`
    SELECT count(*) as blockCount, count(distinct documentId) as distinctDocs
    FROM audit_logs
    WHERE result = 'BLOCKED'
      AND action IN ('ACCESS_BLOCKED', 'DOCUMENT_DOWNLOAD_BLOCKED', 'DOCUMENT_ACCESS_CHECK', 'DOCUMENT_DOWNLOAD')
      AND (user = ? OR ip = ?)
      AND timestamp >= ?;
  `).get(user || '', ip || '', windowStart);

  const blockCount = stats?.blockCount || 0;
  const distinctDocs = stats?.distinctDocs || 0;

  if (blockCount < threshold) {
    return { alertGenerated: false, count: blockCount, threshold };
  }

  const correlationKey = `doc_unauth:${user ? user.toLowerCase() : ip}`;

  // Debounce duplicate alerts within 5 minutes
  const debounceWindow = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
  const recentAlert = db.prepare(`
    SELECT id FROM security_events
    WHERE ruleId = 'RULE-DOC-UNAUTHORIZED'
      AND correlationId = ?
      AND timestamp >= ?
    LIMIT 1;
  `).get(correlationKey, debounceWindow);

  const { incident } = getOrCreateIncident({
    title: `Repeated Unauthorized Document Access by ${user || ip}`,
    description: `User ${user || 'Unknown'} (${userRole || 'Unknown'}) generated ${blockCount} access violations across ${distinctDocs} document(s) within evaluation window.`,
    severity: 'HIGH',
    ruleId: 'RULE-DOC-UNAUTHORIZED',
    correlationKey,
    isSimulated
  });

  if (recentAlert) {
    return { alertGenerated: false, debounced: true, incidentId: incident.id };
  }

  const { addSecurityEvent } = require('../data/store');
  const secEvent = addSecurityEvent({
    severity: 'HIGH',
    type: 'REPEATED_UNAUTHORIZED_ACCESS',
    ruleId: 'RULE-DOC-UNAUTHORIZED',
    correlationId: correlationKey,
    incidentId: incident.id,
    user: user || 'Unknown',
    userRole: userRole || 'Staff',
    document: document || 'Protected Examination Document',
    documentId: documentId || 'DOC-001',
    resourceType: 'DOCUMENT',
    resourceId: documentId || 'DOC-001',
    resourceName: document || 'Confidential Document',
    outcome: 'DENIED',
    ip: ip || '127.0.0.1',
    message: `Repeated unauthorized access attempts by ${user} (${userRole}) targeting ${distinctDocs > 1 ? distinctDocs + ' documents' : document} (${blockCount} blocked attempts).`,
    explanation: `Actor ${user} exceeded the access failure threshold with ${blockCount} blocked attempts across ${distinctDocs} confidential document(s). Indicates potential permission probing or unauthorized document discovery.`,
    isSimulated,
    metadata: { blockCount, distinctDocs, threshold, windowMinutes: Math.round(windowMs / 60000) }
  });

  recordRuleTrigger('RULE-DOC-UNAUTHORIZED');
  return { alertGenerated: true, ruleId: 'RULE-DOC-UNAUTHORIZED', event: secEvent, incident };
}

/**
 * RULE C: Suspicious Access Pattern
 * Detects an unusual burst of requests OR sequence of blocked attempts followed immediately by success.
 */
function evaluateSuspiciousPattern({ user, userRole, document, documentId, ip, isSimulated = false }) {
  const db = getDb();
  const rule = getDetectionRuleById('RULE-SUSPICIOUS-PATTERN');
  if (!rule || !rule.enabled) return { alertGenerated: false };

  // Heuristic Check 1: Denied attempts followed by success within 5 minutes
  const recentWindow = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
  const recentBlocks = db.prepare(`
    SELECT count(*) as count
    FROM audit_logs
    WHERE result = 'BLOCKED'
      AND (user = ? OR ip = ?)
      AND timestamp >= ?;
  `).get(user || '', ip || '', recentWindow)?.count || 0;

  if (recentBlocks >= 2) {
    const correlationKey = `pattern:denied_then_allowed:${user ? user.toLowerCase() : ip}`;
    const debounceWindow = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    const recentAlert = db.prepare(`
      SELECT id FROM security_events
      WHERE ruleId = 'RULE-SUSPICIOUS-PATTERN' AND correlationId = ? AND timestamp >= ? LIMIT 1;
    `).get(correlationKey, debounceWindow);

    const { incident } = getOrCreateIncident({
      title: `Suspicious Access Sequence: ${user || ip}`,
      description: `Actor ${user || 'Unknown'} achieved successful document access immediately following ${recentBlocks} rejected attempts within 5 minutes.`,
      severity: 'MEDIUM',
      ruleId: 'RULE-SUSPICIOUS-PATTERN',
      correlationKey,
      isSimulated
    });

    if (recentAlert) {
      return { alertGenerated: false, debounced: true, incidentId: incident.id };
    }

    const { addSecurityEvent } = require('../data/store');
    const secEvent = addSecurityEvent({
      severity: 'MEDIUM',
      type: 'PROBE_THEN_SUCCESS',
      ruleId: 'RULE-SUSPICIOUS-PATTERN',
      correlationId: correlationKey,
      incidentId: incident.id,
      user: user || 'Unknown',
      userRole: userRole || 'Staff',
      document: document || 'Protected Examination Document',
      documentId: documentId || 'DOC-001',
      resourceType: 'DOCUMENT',
      resourceId: documentId || 'DOC-001',
      resourceName: document || 'Confidential Document',
      outcome: 'ALLOWED',
      ip: ip || '127.0.0.1',
      message: `Suspicious access sequence: ${user} gained access to ${document} after ${recentBlocks} consecutive failed/blocked attempts.`,
      explanation: `Heuristic signal: Multiple failed access attempts followed shortly by successful authorization may indicate credential switching, policy boundary testing, or privilege probing.`,
      isSimulated,
      metadata: { priorBlockedAttempts: recentBlocks, targetDocument: documentId }
    });

    recordRuleTrigger('RULE-SUSPICIOUS-PATTERN');
    return { alertGenerated: true, ruleId: 'RULE-SUSPICIOUS-PATTERN', event: secEvent, incident };
  }

  // Heuristic Check 2: High burst within 30 seconds
  const burstWindow = new Date(Date.now() - config.DETECTION_BURST_WINDOW_MS).toISOString().replace('T', ' ').substring(0, 19);
  const burstCount = db.prepare(`
    SELECT count(*) as count
    FROM audit_logs
    WHERE (user = ? OR ip = ?)
      AND timestamp >= ?;
  `).get(user || '', ip || '', burstWindow)?.count || 0;

  if (burstCount >= config.DETECTION_BURST_THRESHOLD) {
    const correlationKey = `pattern:burst:${ip || 'unknown'}:${user ? user.toLowerCase() : 'anon'}`;
    const debounceWindow = new Date(Date.now() - 30 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    const recentAlert = db.prepare(`
      SELECT id FROM security_events
      WHERE ruleId = 'RULE-SUSPICIOUS-PATTERN' AND correlationId = ? AND timestamp >= ? LIMIT 1;
    `).get(correlationKey, debounceWindow);

    const { incident } = getOrCreateIncident({
      title: `High Velocity Access Burst: ${user || ip}`,
      description: `Rapid burst of ${burstCount} access operations in ${Math.round(config.DETECTION_BURST_WINDOW_MS / 1000)} seconds detected.`,
      severity: 'MEDIUM',
      ruleId: 'RULE-SUSPICIOUS-PATTERN',
      correlationKey,
      isSimulated
    });

    if (recentAlert) {
      return { alertGenerated: false, debounced: true, incidentId: incident.id };
    }

    const { addSecurityEvent } = require('../data/store');
    const secEvent = addSecurityEvent({
      severity: 'MEDIUM',
      type: 'HIGH_VELOCITY_BURST',
      ruleId: 'RULE-SUSPICIOUS-PATTERN',
      correlationId: correlationKey,
      incidentId: incident.id,
      user: user || 'Unknown',
      userRole: userRole || 'Staff',
      document: document || 'System Gateway',
      documentId: documentId || 'SYS',
      resourceType: 'SYSTEM',
      resourceId: documentId || 'SYS',
      resourceName: document || 'System Gateway',
      outcome: 'ALLOWED',
      ip: ip || '127.0.0.1',
      message: `Unusual burst of access operations detected (${burstCount} requests in 30 seconds) from ${user || ip}.`,
      explanation: `Heuristic signal: Rapid automated request frequency exceeding threshold (${burstCount} >= ${config.DETECTION_BURST_THRESHOLD}) indicates scripted interactions or aggressive polling.`,
      isSimulated,
      metadata: { burstCount, threshold: config.DETECTION_BURST_THRESHOLD }
    });

    recordRuleTrigger('RULE-SUSPICIOUS-PATTERN');
    return { alertGenerated: true, ruleId: 'RULE-SUSPICIOUS-PATTERN', event: secEvent, incident };
  }

  return { alertGenerated: false };
}

/**
 * RULE D: Document Integrity Failure
 * Detects cryptographic fingerprint mismatch and document tampering events.
 */
function evaluateIntegrityTamper({
  documentId,
  documentName,
  expectedFingerprint,
  actualFingerprint,
  user,
  userRole,
  ip,
  isSimulated = false
}) {
  const rule = getDetectionRuleById('RULE-INTEGRITY-TAMPER');
  if (!rule || !rule.enabled) return { alertGenerated: false };

  const correlationKey = `tamper:doc:${documentId}`;

  const { incident } = getOrCreateIncident({
    title: `Critical Integrity Compromise: ${documentName} (${documentId})`,
    description: `Cryptographic fingerprint verification failed for ${documentName}. The document payload has been modified or corrupted on storage. Expected SHA-256 does not match physical file content.`,
    severity: 'CRITICAL',
    ruleId: 'RULE-INTEGRITY-TAMPER',
    correlationKey,
    isSimulated
  });

  const { addSecurityEvent } = require('../data/store');
  const secEvent = addSecurityEvent({
    severity: 'CRITICAL',
    type: 'INTEGRITY_TAMPER_DETECTED',
    ruleId: 'RULE-INTEGRITY-TAMPER',
    correlationId: correlationKey,
    incidentId: incident.id,
    user: user || 'System Audit',
    userRole: userRole || 'System',
    document: documentName || 'Confidential Document',
    documentId: documentId,
    resourceType: 'DOCUMENT',
    resourceId: documentId,
    resourceName: documentName,
    outcome: 'DENIED',
    ip: ip || '127.0.0.1',
    message: `Cryptographic integrity verification failed for ${documentName} (${documentId}). Stored payload hash differs from original SHA-256 fingerprint.`,
    explanation: `Zero-trust intrusion detection: Physical document payload hash does not match original cryptographic fingerprint (${actualFingerprint ? actualFingerprint.substring(0, 16) + '...' : 'corrupt'} vs expected ${expectedFingerprint ? expectedFingerprint.substring(0, 16) + '...' : 'unknown'}). Stored document flagged as compromised.`,
    isSimulated,
    metadata: {
      documentId,
      expectedFingerprint: expectedFingerprint ? expectedFingerprint.substring(0, 32) + '...' : 'unknown',
      actualFingerprint: actualFingerprint ? actualFingerprint.substring(0, 32) + '...' : 'unknown'
    }
  });

  recordRuleTrigger('RULE-INTEGRITY-TAMPER');
  return { alertGenerated: true, ruleId: 'RULE-INTEGRITY-TAMPER', event: secEvent, incident };
}

/**
 * RULE E: Administrative and Policy Changes
 * Monitors sensitive administrative operations.
 */
function evaluateAdminChange({
  action,
  resourceType,
  resourceId,
  resourceName,
  user,
  userRole,
  details,
  ip,
  isSimulated = false
}) {
  const rule = getDetectionRuleById('RULE-ADMIN-CHANGE');
  if (!rule || !rule.enabled) return { alertGenerated: false };

  const monitoredActions = ['POLICY_UPDATE', 'POLICY_CREATE', 'REVOKE_ALL_SESSIONS', 'DOCUMENT_RESTORE', 'USER_ROLE_CHANGE'];
  if (!monitoredActions.includes(action)) return { alertGenerated: false };

  const severity = action === 'REVOKE_ALL_SESSIONS' ? 'HIGH' : 'MEDIUM';
  const correlationKey = `admin:${(resourceType || 'system').toLowerCase()}:${resourceId || 'sys'}`;

  const { incident } = getOrCreateIncident({
    title: `Administrative Operation: ${action} on ${resourceName || resourceId}`,
    description: `Operator ${user} (${userRole}) executed administrative operation ${action} on ${resourceType || 'resource'} ${resourceId}. Details: ${details || 'None provided'}`,
    severity,
    ruleId: 'RULE-ADMIN-CHANGE',
    correlationKey,
    isSimulated
  });

  const { addSecurityEvent } = require('../data/store');
  const secEvent = addSecurityEvent({
    severity,
    type: 'ADMIN_CONFIG_CHANGE',
    ruleId: 'RULE-ADMIN-CHANGE',
    correlationId: correlationKey,
    incidentId: incident.id,
    user: user || 'Administrator',
    userRole: userRole || 'Administrator',
    document: resourceName || 'System Policy',
    documentId: resourceId || 'SYS',
    resourceType: resourceType || 'SYSTEM',
    resourceId: resourceId || 'SYS',
    resourceName: resourceName || 'System Policy',
    outcome: 'ALLOWED',
    ip: ip || '127.0.0.1',
    message: `Administrative action recorded: ${action} performed on ${resourceName || resourceId} by ${user} (${userRole}).`,
    explanation: `Administrative audit event: High-privilege state change (${action}). Verified operator: ${user}.`,
    isSimulated,
    metadata: { action, resourceType, resourceId, details }
  });

  recordRuleTrigger('RULE-ADMIN-CHANGE');
  return { alertGenerated: true, ruleId: 'RULE-ADMIN-CHANGE', event: secEvent, incident };
}

module.exports = {
  getDetectionRules,
  getDetectionRuleById,
  updateDetectionRule,
  getOrCreateIncident,
  getIncidents,
  getIncidentById,
  addIncidentNote,
  updateIncidentStatus,
  assignIncident,
  evaluateAuthFailure,
  evaluateUnauthorizedAccess,
  evaluateSuspiciousPattern,
  evaluateIntegrityTamper,
  evaluateAdminChange
};
