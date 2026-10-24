/**
 * Schema migrations manager.
 * Safely tracks applied migration versions in SQLite.
 */

const migrations = [
  {
    version: 1,
    name: 'initial_examvault_schema',
    up: (db) => {
      // 1. Users Table
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          role TEXT NOT NULL,
          department TEXT NOT NULL,
          createdAt TEXT NOT NULL
        );
      `);

      // 2. Documents Table
      db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          subject TEXT NOT NULL,
          owner TEXT NOT NULL,
          ownerRole TEXT NOT NULL,
          uploadedAt TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          content TEXT NOT NULL,
          fingerprint TEXT NOT NULL,
          originalFingerprint TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Protected',
          sensitivity TEXT NOT NULL DEFAULT 'High',
          fileSize TEXT NOT NULL DEFAULT '2.0 MB',
          isTampered INTEGER NOT NULL DEFAULT 0
        );
      `);

      // 3. Access Policies Table (Foreign Key references documents.id)
      db.exec(`
        CREATE TABLE IF NOT EXISTS access_policies (
          id TEXT PRIMARY KEY,
          documentId TEXT NOT NULL,
          documentName TEXT NOT NULL,
          allowedRoles TEXT NOT NULL,
          allowedActions TEXT NOT NULL,
          purpose TEXT NOT NULL,
          startTime TEXT NOT NULL DEFAULT '08:00',
          endTime TEXT NOT NULL DEFAULT '20:00',
          status TEXT NOT NULL DEFAULT 'Active',
          createdAt TEXT NOT NULL,
          FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE
        );
      `);

      // 4. Audit Logs Table
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          user TEXT NOT NULL,
          userRole TEXT NOT NULL,
          action TEXT NOT NULL,
          document TEXT NOT NULL,
          documentId TEXT,
          purpose TEXT,
          timestamp TEXT NOT NULL,
          result TEXT NOT NULL,
          reason TEXT NOT NULL,
          ip TEXT
        );
      `);

      // 5. Security Events Table
      db.exec(`
        CREATE TABLE IF NOT EXISTS security_events (
          id TEXT PRIMARY KEY,
          severity TEXT NOT NULL,
          type TEXT NOT NULL,
          user TEXT NOT NULL,
          userRole TEXT NOT NULL,
          document TEXT NOT NULL,
          documentId TEXT,
          message TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Active',
          ip TEXT,
          reviewedBy TEXT,
          reviewedAt TEXT
        );
      `);

      // Indexes for performance & query filtering
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner);
        CREATE INDEX IF NOT EXISTS idx_policies_doc ON access_policies(documentId);
        CREATE INDEX IF NOT EXISTS idx_policies_status ON access_policies(status);
        CREATE INDEX IF NOT EXISTS idx_audit_doc ON audit_logs(documentId);
        CREATE INDEX IF NOT EXISTS idx_audit_result ON audit_logs(result);
        CREATE INDEX IF NOT EXISTS idx_security_status ON security_events(status);
      `);
    }
  },
  {
    version: 2,
    name: 'add_password_hash_to_users',
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(users);").all();
      const hasPassword = columns.some(c => c.name === 'passwordHash');
      if (!hasPassword) {
        db.exec("ALTER TABLE users ADD COLUMN passwordHash TEXT;");
      }
    }
  },
  {
    version: 3,
    name: 'create_revoked_tokens_table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS revoked_tokens (
          jti TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          revokedAt TEXT NOT NULL,
          expiresAt INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expiresAt);
      `);
    }
  },
  {
    version: 4,
    name: 'add_token_version_to_users',
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(users);").all();
      const hasTokenVersion = columns.some(c => c.name === 'tokenVersion');
      if (!hasTokenVersion) {
        db.exec("ALTER TABLE users ADD COLUMN tokenVersion INTEGER NOT NULL DEFAULT 1;");
      }
    }
  },
  {
    version: 5,
    name: 'create_account_login_attempts_table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS account_login_attempts (
          accountKey TEXT PRIMARY KEY,
          failedAttempts INTEGER NOT NULL DEFAULT 0,
          firstFailedAt INTEGER NOT NULL,
          lastFailedAt INTEGER NOT NULL,
          cooldownUntil INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_account_cooldown ON account_login_attempts(cooldownUntil);
      `);
    }
  },
  {
    version: 6,
    name: 'add_storage_fields_to_documents',
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(documents);").all();
      const colNames = new Set(columns.map(c => c.name));
      if (!colNames.has('storageKey')) {
        db.exec("ALTER TABLE documents ADD COLUMN storageKey TEXT;");
      }
      if (!colNames.has('mimeType')) {
        db.exec("ALTER TABLE documents ADD COLUMN mimeType TEXT DEFAULT 'text/plain';");
      }
      if (!colNames.has('originalFileName')) {
        db.exec("ALTER TABLE documents ADD COLUMN originalFileName TEXT;");
      }
    }
  },
  {
    version: 7,
    name: 'add_threat_detection_and_incidents',
    up: (db) => {
      // 1. Extend security_events with normalized fields
      const secColumns = db.prepare("PRAGMA table_info(security_events);").all();
      const secColNames = new Set(secColumns.map(c => c.name));

      const newSecCols = [
        ['actorId', 'TEXT'],
        ['actorRole', 'TEXT'],
        ['resourceType', 'TEXT'],
        ['resourceId', 'TEXT'],
        ['resourceName', 'TEXT'],
        ['correlationId', 'TEXT'],
        ['outcome', 'TEXT'],
        ['ruleId', 'TEXT'],
        ['explanation', 'TEXT'],
        ['incidentId', 'TEXT'],
        ['isSimulated', 'INTEGER NOT NULL DEFAULT 0'],
        ['metadata', 'TEXT']
      ];

      for (const [col, colType] of newSecCols) {
        if (!secColNames.has(col)) {
          db.exec(`ALTER TABLE security_events ADD COLUMN ${col} ${colType};`);
        }
      }

      // 2. Extend audit_logs with correlation & simulation tracking
      const auditCols = db.prepare("PRAGMA table_info(audit_logs);").all();
      const auditColNames = new Set(auditCols.map(c => c.name));
      if (!auditColNames.has('correlationId')) {
        db.exec("ALTER TABLE audit_logs ADD COLUMN correlationId TEXT;");
      }
      if (!auditColNames.has('actorId')) {
        db.exec("ALTER TABLE audit_logs ADD COLUMN actorId TEXT;");
      }
      if (!auditColNames.has('isSimulated')) {
        db.exec("ALTER TABLE audit_logs ADD COLUMN isSimulated INTEGER NOT NULL DEFAULT 0;");
      }

      // 3. Create incidents table
      db.exec(`
        CREATE TABLE IF NOT EXISTS incidents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          severity TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Open',
          ruleId TEXT,
          correlationKey TEXT,
          firstDetectedAt TEXT NOT NULL,
          lastActivityAt TEXT NOT NULL,
          assignedTo TEXT,
          resolutionSummary TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          isSimulated INTEGER NOT NULL DEFAULT 0
        );
      `);

      // 4. Create incident_notes table
      db.exec(`
        CREATE TABLE IF NOT EXISTS incident_notes (
          id TEXT PRIMARY KEY,
          incidentId TEXT NOT NULL,
          author TEXT NOT NULL,
          authorRole TEXT NOT NULL,
          note TEXT NOT NULL,
          action TEXT NOT NULL DEFAULT 'NOTE_ADDED',
          timestamp TEXT NOT NULL,
          FOREIGN KEY (incidentId) REFERENCES incidents(id) ON DELETE CASCADE
        );
      `);

      // 5. Create detection_rules_state table for tracking rule stats
      db.exec(`
        CREATE TABLE IF NOT EXISTS detection_rules_state (
          ruleId TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          severity TEXT NOT NULL,
          thresholdConfig TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          lastTriggeredAt TEXT,
          triggerCount INTEGER NOT NULL DEFAULT 0
        );
      `);

      // 6. Pre-populate detection rules if table is empty
      const existingRulesCount = db.prepare('SELECT count(*) as c FROM detection_rules_state;').get().c;
      if (existingRulesCount === 0) {
        const insertRule = db.prepare(`
          INSERT INTO detection_rules_state (ruleId, name, description, severity, thresholdConfig, enabled, lastTriggeredAt, triggerCount)
          VALUES (?, ?, ?, ?, ?, 1, NULL, 0);
        `);
        insertRule.run(
          'RULE-AUTH-FAILED',
          'Repeated Failed Authentication',
          'Detects repeated failed login attempts within a configurable evaluation window',
          'HIGH',
          JSON.stringify({ threshold: 3, windowMinutes: 15 })
        );
        insertRule.run(
          'RULE-DOC-UNAUTHORIZED',
          'Repeated Unauthorized Document Access',
          'Detects repeated access-denied attempts targeting confidential examination documents',
          'HIGH',
          JSON.stringify({ threshold: 3, windowMinutes: 10 })
        );
        insertRule.run(
          'RULE-SUSPICIOUS-PATTERN',
          'Suspicious Access Pattern',
          'Detects bursts of access attempts or denied attempts followed by sudden successful access',
          'MEDIUM',
          JSON.stringify({ burstThreshold: 8, burstWindowSeconds: 30, sequenceWindowMinutes: 5 })
        );
        insertRule.run(
          'RULE-INTEGRITY-TAMPER',
          'Document Integrity Failure',
          'Detects cryptographic hash mismatches, unauthorized document modifications, and payload corruption',
          'CRITICAL',
          JSON.stringify({ immediateAlert: true })
        );
        insertRule.run(
          'RULE-ADMIN-CHANGE',
          'Administrative and Policy Changes',
          'Monitors sensitive administrative actions including policy changes, session revocations, and document restorations',
          'MEDIUM',
          JSON.stringify({ monitorActions: ['POLICY_UPDATE', 'POLICY_CREATE', 'REVOKE_ALL_SESSIONS', 'DOCUMENT_RESTORE'] })
        );
      }

      // 7. Performance & Filtering Indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_security_rule ON security_events(ruleId);
        CREATE INDEX IF NOT EXISTS idx_security_incident ON security_events(incidentId);
        CREATE INDEX IF NOT EXISTS idx_security_timestamp ON security_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_security_severity ON security_events(severity);
        CREATE INDEX IF NOT EXISTS idx_security_type ON security_events(type);
        CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
        CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
        CREATE INDEX IF NOT EXISTS idx_incidents_corr ON incidents(correlationKey);
        CREATE INDEX IF NOT EXISTS idx_incident_notes_inc ON incident_notes(incidentId);
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
      `);
    }
  }
];

/**
 * Runs all pending migrations idempotently.
 * @param {import('node:sqlite').DatabaseSync} db
 */
function runMigrations(db) {
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations;').all();
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      db.exec('BEGIN TRANSACTION;');
      try {
        migration.up(db);
        const stmt = db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);');
        stmt.run(migration.version, migration.name, new Date().toISOString());
        db.exec('COMMIT;');
        console.log(`[Database Migration] Applied migration v${migration.version}: ${migration.name}`);
      } catch (err) {
        db.exec('ROLLBACK;');
        console.error(`[Database Migration Error] Failed to apply migration v${migration.version}:`, err);
        throw err;
      }
    }
  }
}

module.exports = {
  migrations,
  runMigrations
};
