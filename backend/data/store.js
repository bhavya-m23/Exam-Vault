const { generateFingerprint, formatShortFingerprint } = require('../utils/fingerprint');

// In-memory data structures
const users = [
  {
    id: "USR-001",
    name: "System Admin",
    email: "admin@examvault.local",
    role: "Administrator",
    department: "Cyber Security & IT"
  },
  {
    id: "USR-002",
    name: "Dr. Priya Sharma",
    email: "priya.sharma@university.edu",
    role: "Exam Coordinator",
    department: "Computer Science"
  },
  {
    id: "USR-003",
    name: "Akash G",
    email: "akash.g@university.edu",
    role: "Staff",
    department: "Academic Office"
  },
  {
    id: "USR-004",
    name: "Prof. Rahul Kumar",
    email: "rahul.kumar@university.edu",
    role: "Course Instructor",
    department: "Computer Science"
  },
  {
    id: "USR-005",
    name: "Dr. Anitha Rao",
    email: "anitha.rao@university.edu",
    role: "Exam Evaluator",
    department: "Information Technology"
  }
];

// Seed initial documents with realistic SHA-256 fingerprints
const initialDocContents = {
  "DOC-001": "CONFIDENTIAL: Data Structures End Semester Question Paper 2026. Version 3. Approved by Dr. Priya Sharma.",
  "DOC-002": "CONFIDENTIAL: Computer Networks Mid-Term Examination Paper 2026. Version 2. Sealed by Prof. Rahul Kumar.",
  "DOC-003": "CONFIDENTIAL: Operating Systems Model Question Paper 2026. Version 1. Prepared by Dr. Anitha Rao.",
  "DOC-004": "CONFIDENTIAL: Cybersecurity & Cryptography Final Exam Answer Key 2026. Version 4. Strictly Restricted.",
  "DOC-005": "CONFIDENTIAL: Advanced Algorithms Comprehensive Evaluation Sheet 2026. Version 2."
};

const documents = [
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
    isTampered: false
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
    isTampered: false
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
    isTampered: false
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
    isTampered: false
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
    isTampered: false
  }
];

const accessPolicies = [
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

const auditLogs = [
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

const securityEvents = [
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
    ip: "192.168.1.45"
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
    ip: "192.168.1.45"
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
    ip: "192.168.1.34"
  }
];

// Helper functions for logging & security triggers
function addAuditLog(entry) {
  const log = {
    id: `LOG-00${auditLogs.length + 1}`.replace(/00(\d{3,})/, '$1'),
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    ip: entry.ip || "192.168.1." + Math.floor(Math.random() * 200 + 10),
    ...entry
  };
  auditLogs.unshift(log);
  return log;
}

function addSecurityEvent(event) {
  const sec = {
    id: `SEC-00${securityEvents.length + 1}`.replace(/00(\d{3,})/, '$1'),
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    status: "Active",
    ip: event.ip || "192.168.1.45",
    ...event
  };
  securityEvents.unshift(sec);
  return sec;
}

/**
 * Context-aware Access Verification Engine
 */
function checkAccess({ userId, documentId, action = "VIEW", purpose = "Exam Preparation" }) {
  const user = users.find(u => u.id === userId || u.name === userId || u.email === userId);
  if (!user) {
    const reason = "User profile not found in directory";
    addAuditLog({
      user: userId || "Unknown User",
      userRole: "Unknown",
      action: `DOCUMENT_${action}`,
      document: documentId,
      documentId,
      purpose,
      result: "BLOCKED",
      reason
    });
    return { allowed: false, reason };
  }

  const document = documents.find(d => d.id === documentId || d.name === documentId);
  if (!document) {
    const reason = "Document not found in vault";
    addAuditLog({
      user: user.name,
      userRole: user.role,
      action: `DOCUMENT_${action}`,
      document: documentId,
      documentId,
      purpose,
      result: "BLOCKED",
      reason
    });
    return { allowed: false, reason };
  }

  // Administrators bypass for emergency management if needed, but let's evaluate policies
  const policy = accessPolicies.find(p => p.documentId === document.id && p.status === "Active");

  if (!policy) {
    const reason = "No active access policy configured for this document";
    addAuditLog({
      user: user.name,
      userRole: user.role,
      action: `DOCUMENT_${action}`,
      document: document.name,
      documentId: document.id,
      purpose,
      result: "BLOCKED",
      reason
    });

    addSecurityEvent({
      severity: "MEDIUM",
      type: "UNPOLICY_ACCESS_ATTEMPT",
      user: user.name,
      userRole: user.role,
      document: document.name,
      documentId: document.id,
      message: `Attempted ${action} on document without active security policy`
    });

    return { allowed: false, reason };
  }

  // 1. Role Authorization Check
  const isRoleAllowed = policy.allowedRoles.includes(user.role) || user.role === "Administrator";
  if (!isRoleAllowed) {
    const reason = `Role '${user.role}' is not in allowed policy roles: [${policy.allowedRoles.join(', ')}]`;
    
    addAuditLog({
      user: user.name,
      userRole: user.role,
      action: `DOCUMENT_${action}`,
      document: document.name,
      documentId: document.id,
      purpose,
      result: "BLOCKED",
      reason
    });

    addSecurityEvent({
      severity: document.sensitivity === "Critical" ? "CRITICAL" : "HIGH",
      type: "UNAUTHORIZED_ACCESS",
      user: user.name,
      userRole: user.role,
      document: document.name,
      documentId: document.id,
      message: reason
    });

    return { allowed: false, reason, policy };
  }

  // 2. Action Authorization Check
  const isActionAllowed = policy.allowedActions.includes(action.toUpperCase());
  if (!isActionAllowed) {
    const reason = `Action '${action}' is not permitted by policy. Allowed: [${policy.allowedActions.join(', ')}]`;

    addAuditLog({
      user: user.name,
      userRole: user.role,
      action: `DOCUMENT_${action}`,
      document: document.name,
      documentId: document.id,
      purpose,
      result: "BLOCKED",
      reason
    });

    addSecurityEvent({
      severity: "MEDIUM",
      type: "ACTION_VIOLATION",
      user: user.name,
      userRole: user.role,
      document: document.name,
      documentId: document.id,
      message: reason
    });

    return { allowed: false, reason, policy };
  }

  // 3. Time Window Check
  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (policy.startTime && policy.endTime) {
    if (currentHHMM < policy.startTime || currentHHMM > policy.endTime) {
      const reason = `Access attempted outside permitted time window (${policy.startTime} - ${policy.endTime}). Current time: ${currentHHMM}`;

      addAuditLog({
        user: user.name,
        userRole: user.role,
        action: `DOCUMENT_${action}`,
        document: document.name,
        documentId: document.id,
        purpose,
        result: "BLOCKED",
        reason
      });

      addSecurityEvent({
        severity: "HIGH",
        type: "TIME_POLICY_VIOLATION",
        user: user.name,
        userRole: user.role,
        document: document.name,
        documentId: document.id,
        message: reason
      });

      return { allowed: false, reason, policy };
    }
  }

  // 4. Purpose Check (if policy mandates explicit purpose match)
  if (policy.purpose && purpose && policy.purpose.toLowerCase() !== purpose.toLowerCase()) {
    // Note: We can log a warning or allow if purpose matches closely, but let's check
    const reason = `Requested purpose '${purpose}' does not match policy purpose '${policy.purpose}'`;
    
    addAuditLog({
      user: user.name,
      userRole: user.role,
      action: `DOCUMENT_${action}`,
      document: document.name,
      documentId: document.id,
      purpose,
      result: "BLOCKED",
      reason
    });

    addSecurityEvent({
      severity: "LOW",
      type: "PURPOSE_MISMATCH",
      user: user.name,
      userRole: user.role,
      document: document.name,
      documentId: document.id,
      message: reason
    });

    return { allowed: false, reason, policy };
  }

  // If document is tampered, warn/block!
  if (document.isTampered) {
    const reason = "ACCESS BLOCKED: Document integrity compromise detected! SHA-256 fingerprint mismatch.";
    addAuditLog({
      user: user.name,
      userRole: user.role,
      action: `DOCUMENT_${action}`,
      document: document.name,
      documentId: document.id,
      purpose,
      result: "BLOCKED",
      reason
    });

    addSecurityEvent({
      severity: "CRITICAL",
      type: "INTEGRITY_ALERT",
      user: user.name,
      userRole: user.role,
      document: document.name,
      documentId: document.id,
      message: "Attempted access to a tampered document!"
    });

    return { allowed: false, reason, policy };
  }

  // All checks passed!
  const reason = `Access granted under policy ${policy.id}`;
  addAuditLog({
    user: user.name,
    userRole: user.role,
    action: `DOCUMENT_${action}`,
    document: document.name,
    documentId: document.id,
    purpose,
    result: "ALLOWED",
    reason
  });

  return { allowed: true, reason, policy };
}

module.exports = {
  users,
  documents,
  accessPolicies,
  auditLogs,
  securityEvents,
  addAuditLog,
  addSecurityEvent,
  checkAccess
};
