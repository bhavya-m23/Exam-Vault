const bcrypt = require('bcryptjs');
const { generateFingerprint } = require('../utils/fingerprint');

// Standard known development-only password for demo personas
const DEFAULT_DEMO_PASSWORD = 'admin123';
const DEFAULT_DEMO_HASH = bcrypt.hashSync(DEFAULT_DEMO_PASSWORD, 10);

const initialDocContents = {
  "DOC-001": "CONFIDENTIAL: Data Structures End Semester Question Paper 2026. Version 3. Approved by Dr. Priya Sharma.",
  "DOC-002": "CONFIDENTIAL: Computer Networks Mid-Term Examination Paper 2026. Version 2. Sealed by Prof. Rahul Kumar.",
  "DOC-003": "CONFIDENTIAL: Operating Systems Model Question Paper 2026. Version 1. Prepared by Dr. Anitha Rao.",
  "DOC-004": "CONFIDENTIAL: Cybersecurity & Cryptography Final Exam Answer Key 2026. Version 4. Strictly Restricted.",
  "DOC-005": "CONFIDENTIAL: Advanced Algorithms Comprehensive Evaluation Sheet 2026. Version 2."
};

const seedUsers = [
  {
    id: "USR-001",
    name: "System Admin",
    email: "admin@examvault.local",
    role: "Administrator",
    department: "Cyber Security & IT",
    passwordHash: DEFAULT_DEMO_HASH
  },
  {
    id: "USR-002",
    name: "Dr. Priya Sharma",
    email: "priya.sharma@university.edu",
    role: "Exam Coordinator",
    department: "Computer Science",
    passwordHash: DEFAULT_DEMO_HASH
  },
  {
    id: "USR-003",
    name: "Akash G",
    email: "akash.g@university.edu",
    role: "Staff",
    department: "Academic Office",
    passwordHash: DEFAULT_DEMO_HASH
  },
  {
    id: "USR-004",
    name: "Prof. Rahul Kumar",
    email: "rahul.kumar@university.edu",
    role: "Course Instructor",
    department: "Computer Science",
    passwordHash: DEFAULT_DEMO_HASH
  },
  {
    id: "USR-005",
    name: "Dr. Anitha Rao",
    email: "anitha.rao@university.edu",
    role: "Exam Evaluator",
    department: "Information Technology",
    passwordHash: DEFAULT_DEMO_HASH
  }
];

const seedDocuments = [
  {
    id: "DOC-001",
    name: "Data Structures - End Semester.pdf",
    subject: "Data Structures",
    owner: "Dr. Priya Sharma",
    ownerRole: "Exam Coordinator",
    uploadedAt: "2026-10-01T10:30:00",
    version: 3,
    content: initialDocContents["DOC-001"],
    fingerprint: generateFingerprint(initialDocContents["DOC-001"]),
    originalFingerprint: generateFingerprint(initialDocContents["DOC-001"]),
    status: "Protected",
    sensitivity: "Critical",
    fileSize: "2.4 MB",
    isTampered: 0
  },
  {
    id: "DOC-002",
    name: "Computer Networks - Internal.pdf",
    subject: "Computer Networks",
    owner: "Prof. Rahul Kumar",
    ownerRole: "Course Instructor",
    uploadedAt: "2026-10-02T09:15:00",
    version: 2,
    content: initialDocContents["DOC-002"],
    fingerprint: generateFingerprint(initialDocContents["DOC-002"]),
    originalFingerprint: generateFingerprint(initialDocContents["DOC-002"]),
    status: "Protected",
    sensitivity: "High",
    fileSize: "1.8 MB",
    isTampered: 0
  },
  {
    id: "DOC-003",
    name: "Operating Systems - Model Paper.pdf",
    subject: "Operating Systems",
    owner: "Dr. Anitha Rao",
    ownerRole: "Exam Evaluator",
    uploadedAt: "2026-10-02T14:20:00",
    version: 1,
    content: initialDocContents["DOC-003"],
    fingerprint: generateFingerprint(initialDocContents["DOC-003"]),
    originalFingerprint: generateFingerprint(initialDocContents["DOC-003"]),
    status: "Protected",
    sensitivity: "High",
    fileSize: "3.1 MB",
    isTampered: 0
  },
  {
    id: "DOC-004",
    name: "Cybersecurity - Answer Key.pdf",
    subject: "Cybersecurity",
    owner: "Dr. Priya Sharma",
    ownerRole: "Exam Coordinator",
    uploadedAt: "2026-10-03T08:00:00",
    version: 4,
    content: initialDocContents["DOC-004"],
    fingerprint: generateFingerprint(initialDocContents["DOC-004"]),
    originalFingerprint: generateFingerprint(initialDocContents["DOC-004"]),
    status: "Protected",
    sensitivity: "Critical",
    fileSize: "1.2 MB",
    isTampered: 0
  },
  {
    id: "DOC-005",
    name: "Advanced Algorithms - Final Key.pdf",
    subject: "Algorithms",
    owner: "Prof. Rahul Kumar",
    ownerRole: "Course Instructor",
    uploadedAt: "2026-10-03T11:45:00",
    version: 2,
    content: initialDocContents["DOC-005"],
    fingerprint: generateFingerprint(initialDocContents["DOC-005"]),
    originalFingerprint: generateFingerprint(initialDocContents["DOC-005"]),
    status: "Protected",
    sensitivity: "Medium",
    fileSize: "4.0 MB",
    isTampered: 0
  }
];

const seedPolicies = [
  {
    id: "POL-001",
    documentId: "DOC-001",
    documentName: "Data Structures - End Semester.pdf",
    allowedRoles: ["Exam Coordinator", "Administrator"],
    allowedActions: ["VIEW", "DOWNLOAD"],
    purpose: "Exam Preparation",
    startTime: "08:00",
    endTime: "23:59",
    status: "Active",
    createdAt: "2026-10-01T10:35:00"
  },
  {
    id: "POL-002",
    documentId: "DOC-002",
    documentName: "Computer Networks - Internal.pdf",
    allowedRoles: ["Course Instructor", "Exam Coordinator"],
    allowedActions: ["VIEW", "DOWNLOAD", "EDIT"],
    purpose: "Internal Review",
    startTime: "09:00",
    endTime: "17:00",
    status: "Active",
    createdAt: "2026-10-02T09:20:00"
  },
  {
    id: "POL-003",
    documentId: "DOC-003",
    documentName: "Operating Systems - Model Paper.pdf",
    allowedRoles: ["Exam Evaluator", "Exam Coordinator"],
    allowedActions: ["VIEW"],
    purpose: "Evaluation",
    startTime: "10:00",
    endTime: "16:00",
    status: "Active",
    createdAt: "2026-10-02T14:30:00"
  },
  {
    id: "POL-004",
    documentId: "DOC-004",
    documentName: "Cybersecurity - Answer Key.pdf",
    allowedRoles: ["Administrator"],
    allowedActions: ["VIEW", "DOWNLOAD"],
    purpose: "Secure Archival",
    startTime: "09:00",
    endTime: "18:00",
    status: "Active",
    createdAt: "2026-10-03T08:15:00"
  },
  {
    id: "POL-005",
    documentId: "DOC-005",
    documentName: "Advanced Algorithms - Final Key.pdf",
    allowedRoles: ["Course Instructor", "Exam Evaluator"],
    allowedActions: ["VIEW"],
    purpose: "Evaluation",
    startTime: "08:00",
    endTime: "19:00",
    status: "Active",
    createdAt: "2026-10-03T11:50:00"
  }
];

const seedAuditLogs = [
  {
    id: "LOG-001",
    user: "Dr. Priya Sharma",
    userRole: "Exam Coordinator",
    action: "DOCUMENT_VIEW",
    document: "Data Structures - End Semester.pdf",
    documentId: "DOC-001",
    purpose: "Exam Preparation",
    timestamp: "2026-10-03 09:42:10",
    result: "ALLOWED",
    reason: "Policy POL-001 satisfied (Role & Time window valid)",
    ip: "192.168.1.21"
  },
  {
    id: "LOG-002",
    user: "Akash G",
    userRole: "Staff",
    action: "DOCUMENT_ACCESS",
    document: "Computer Networks - Internal.pdf",
    documentId: "DOC-002",
    purpose: "Exam Preparation",
    timestamp: "2026-10-03 10:15:33",
    result: "BLOCKED",
    reason: "Role 'Staff' is not in allowed roles: [Course Instructor, Exam Coordinator]",
    ip: "192.168.1.45"
  },
  {
    id: "LOG-003",
    user: "Prof. Rahul Kumar",
    userRole: "Course Instructor",
    action: "DOCUMENT_DOWNLOAD",
    document: "Computer Networks - Internal.pdf",
    documentId: "DOC-002",
    purpose: "Internal Review",
    timestamp: "2026-10-03 11:05:12",
    result: "ALLOWED",
    reason: "Policy POL-002 satisfied",
    ip: "192.168.1.34"
  },
  {
    id: "LOG-004",
    user: "Akash G",
    userRole: "Staff",
    action: "DOCUMENT_VIEW",
    document: "Cybersecurity - Answer Key.pdf",
    documentId: "DOC-004",
    purpose: "Internal Review",
    timestamp: "2026-10-03 12:30:00",
    result: "BLOCKED",
    reason: "Role 'Staff' unauthorized for Critical sensitivity document",
    ip: "192.168.1.45"
  },
  {
    id: "LOG-005",
    user: "Dr. Anitha Rao",
    userRole: "Exam Evaluator",
    action: "DOCUMENT_VIEW",
    document: "Operating Systems - Model Paper.pdf",
    documentId: "DOC-003",
    purpose: "Evaluation",
    timestamp: "2026-10-03 14:10:05",
    result: "ALLOWED",
    reason: "Policy POL-003 satisfied",
    ip: "192.168.1.88"
  },
  {
    id: "LOG-006",
    user: "System Admin",
    userRole: "Administrator",
    action: "POLICY_CREATE",
    document: "Cybersecurity - Answer Key.pdf",
    documentId: "DOC-004",
    purpose: "Policy Configuration",
    timestamp: "2026-10-03 14:45:00",
    result: "ALLOWED",
    reason: "Administrator created policy POL-004",
    ip: "127.0.0.1"
  },
  {
    id: "LOG-007",
    user: "System Admin",
    userRole: "Administrator",
    action: "INTEGRITY_VERIFICATION",
    document: "Data Structures - End Semester.pdf",
    documentId: "DOC-001",
    purpose: "Routine Audit",
    timestamp: "2026-10-03 15:00:22",
    result: "ALLOWED",
    reason: "Fingerprint verified successfully (SHA-256 match)",
    ip: "127.0.0.1"
  },
  {
    id: "LOG-008",
    user: "Akash G",
    userRole: "Staff",
    action: "DOCUMENT_DOWNLOAD",
    document: "Data Structures - End Semester.pdf",
    documentId: "DOC-001",
    purpose: "Exam Preparation",
    timestamp: "2026-10-03 16:22:15",
    result: "BLOCKED",
    reason: "Role 'Staff' is not authorized to download this document",
    ip: "192.168.1.45"
  }
];

const seedSecurityEvents = [
  {
    id: "SEC-001",
    severity: "HIGH",
    type: "UNAUTHORIZED_ACCESS",
    user: "Akash G",
    userRole: "Staff",
    document: "Computer Networks - Internal.pdf",
    documentId: "DOC-002",
    message: "Access attempted with unauthorized role 'Staff'. Permitted: [Course Instructor, Exam Coordinator]",
    timestamp: "2026-10-03 10:15:33",
    status: "Active",
    ip: "192.168.1.45",
    reviewedBy: null,
    reviewedAt: null
  },
  {
    id: "SEC-002",
    severity: "CRITICAL",
    type: "RESTRICTED_ACCESS_ATTEMPT",
    user: "Akash G",
    userRole: "Staff",
    document: "Cybersecurity - Answer Key.pdf",
    documentId: "DOC-004",
    message: "Multiple access violations detected on Critical sensitivity file",
    timestamp: "2026-10-03 12:30:00",
    status: "Active",
    ip: "192.168.1.45",
    reviewedBy: null,
    reviewedAt: null
  },
  {
    id: "SEC-003",
    severity: "MEDIUM",
    type: "OUT_OF_HOURS_ACCESS",
    user: "Prof. Rahul Kumar",
    userRole: "Course Instructor",
    document: "Advanced Algorithms - Final Key.pdf",
    documentId: "DOC-005",
    message: "Access request registered near policy deadline",
    timestamp: "2026-10-03 18:55:00",
    status: "Reviewed",
    ip: "192.168.1.34",
    reviewedBy: "System Auditor",
    reviewedAt: "2026-10-03 19:10:00"
  }
];

/**
 * Idempotently seeds database with default demonstration records.
 * Uses INSERT OR IGNORE to prevent duplicate creation on repeated runs.
 * @param {import('node:sqlite').DatabaseSync} db
 */
function seedDatabase(db) {
  const hasPasswordCol = db.prepare("PRAGMA table_info(users);").all().some(c => c.name === 'passwordHash');

  const insertUserWithPass = db.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, role, department, passwordHash, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `);

  const insertUserNoPass = db.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, role, department, createdAt)
    VALUES (?, ?, ?, ?, ?, ?);
  `);

  const updateMissingPass = db.prepare(`
    UPDATE users SET passwordHash = ? WHERE id = ? AND (passwordHash IS NULL OR passwordHash = '');
  `);

  const insertDoc = db.prepare(`
    INSERT OR IGNORE INTO documents (
      id, name, subject, owner, ownerRole, uploadedAt, version,
      content, fingerprint, originalFingerprint, status, sensitivity, fileSize, isTampered
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  const insertPolicy = db.prepare(`
    INSERT OR IGNORE INTO access_policies (
      id, documentId, documentName, allowedRoles, allowedActions,
      purpose, startTime, endTime, status, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  const insertAudit = db.prepare(`
    INSERT OR IGNORE INTO audit_logs (
      id, user, userRole, action, document, documentId, purpose, timestamp, result, reason, ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  const insertSecurity = db.prepare(`
    INSERT OR IGNORE INTO security_events (
      id, severity, type, user, userRole, document, documentId, message, timestamp, status, ip, reviewedBy, reviewedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  db.exec('BEGIN TRANSACTION;');
  try {
    const now = new Date().toISOString();

    for (const u of seedUsers) {
      if (hasPasswordCol) {
        insertUserWithPass.run(u.id, u.name, u.email, u.role, u.department, u.passwordHash, now);
        updateMissingPass.run(u.passwordHash, u.id);
      } else {
        insertUserNoPass.run(u.id, u.name, u.email, u.role, u.department, now);
      }
    }

    for (const d of seedDocuments) {
      insertDoc.run(
        d.id, d.name, d.subject, d.owner, d.ownerRole, d.uploadedAt,
        d.version, d.content, d.fingerprint, d.originalFingerprint,
        d.status, d.sensitivity, d.fileSize, d.isTampered
      );
    }

    for (const p of seedPolicies) {
      insertPolicy.run(
        p.id, p.documentId, p.documentName,
        JSON.stringify(p.allowedRoles),
        JSON.stringify(p.allowedActions),
        p.purpose, p.startTime, p.endTime, p.status, p.createdAt
      );
    }

    for (const a of seedAuditLogs) {
      insertAudit.run(
        a.id, a.user, a.userRole, a.action, a.document,
        a.documentId, a.purpose, a.timestamp, a.result, a.reason, a.ip
      );
    }

    for (const s of seedSecurityEvents) {
      insertSecurity.run(
        s.id, s.severity, s.type, s.user, s.userRole, s.document,
        s.documentId, s.message, s.timestamp, s.status, s.ip,
        s.reviewedBy, s.reviewedAt
      );
    }

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('[Database Seed Error] Failed to seed records:', err);
    throw err;
  }
}

module.exports = {
  seedDatabase,
  seedUsers,
  seedDocuments,
  seedPolicies,
  seedAuditLogs,
  seedSecurityEvents
};
