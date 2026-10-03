const express = require('express');
const router = express.Router();
const { documents, accessPolicies, auditLogs, addAuditLog, addSecurityEvent } = require('../data/store');
const { generateFingerprint } = require('../utils/fingerprint');

// GET /api/documents
router.get('/', (req, res) => {
  res.json(documents);
});

// GET /api/documents/:id
router.get('/:id', (req, res) => {
  const doc = documents.find(d => d.id === req.params.id);
  if (!doc) {
    return res.status(404).json({ message: 'Document not found' });
  }

  const policy = accessPolicies.find(p => p.documentId === doc.id);
  const docAuditLogs = auditLogs.filter(a => a.documentId === doc.id || a.document === doc.name);

  res.json({
    document: doc,
    policy: policy || null,
    auditTrail: docAuditLogs
  });
});

// POST /api/documents - Simulate Document Upload
router.post('/', (req, res) => {
  const { name, subject, owner, ownerRole, sensitivity, content, fileSize } = req.body;

  if (!name || !subject || !owner) {
    return res.status(400).json({ message: 'Name, Subject, and Owner are required' });
  }

  const id = `DOC-00${documents.length + 1}`.replace(/00(\d{3,})/, '$1');
  const uploadedAt = new Date().toISOString();
  const docContent = content || `SECURE EXAM CONTENT FOR ${name.toUpperCase()} (ID: ${id}). Subject: ${subject}. Sealed at ${uploadedAt}`;
  const fingerprint = generateFingerprint(docContent);

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
    isTampered: false
  };

  documents.unshift(newDoc);

  // Automatically create a default policy for new document
  const defaultPolicy = {
    id: `POL-00${accessPolicies.length + 1}`.replace(/00(\d{3,})/, '$1'),
    documentId: id,
    documentName: name,
    allowedRoles: [ownerRole || "Exam Coordinator", "Administrator"],
    allowedActions: ["VIEW", "DOWNLOAD"],
    purpose: "Exam Preparation",
    startTime: "08:00",
    endTime: "20:00",
    status: "Active",
    createdAt: uploadedAt
  };
  accessPolicies.unshift(defaultPolicy);

  // Add audit log
  addAuditLog({
    user: owner,
    userRole: ownerRole || "Exam Coordinator",
    action: "DOCUMENT_UPLOAD",
    document: name,
    documentId: id,
    purpose: "Exam Creation & Archival",
    result: "ALLOWED",
    reason: `Document uploaded and SHA-256 fingerprint generated (${fingerprint.substring(0, 8)}...)`
  });

  res.status(201).json({
    message: "Document secured successfully. Integrity fingerprint created.",
    document: newDoc,
    policy: defaultPolicy
  });
});

// POST /api/documents/:id/verify - Verify Document Integrity
router.post('/:id/verify', (req, res) => {
  const doc = documents.find(d => d.id === req.params.id);
  if (!doc) {
    return res.status(404).json({ message: 'Document not found' });
  }

  const calculatedFingerprint = generateFingerprint(doc.content);
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

  // Add audit log
  addAuditLog({
    user: req.body.user || "Current User",
    userRole: req.body.userRole || "Administrator",
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
      user: req.body.user || "System Auditor",
      userRole: req.body.userRole || "Administrator",
      document: doc.name,
      documentId: doc.id,
      message: `Fingerprint mismatch detected! Recorded: ${doc.originalFingerprint.substring(0, 10)}... Current: ${calculatedFingerprint.substring(0, 10)}...`
    });
  }

  res.json(result);
});

// POST /api/documents/:id/tamper - Simulate Tampering (Hackathon Demo Feature)
router.post('/:id/tamper', (req, res) => {
  const doc = documents.find(d => d.id === req.params.id);
  if (!doc) {
    return res.status(404).json({ message: 'Document not found' });
  }

  // Mutate content artificially to corrupt fingerprint
  doc.content += " [UNAUTHORIZED ALTERATION ADDED BY TAMPER SIMULATION]";
  doc.fingerprint = generateFingerprint(doc.content);
  doc.isTampered = true;
  doc.status = "Integrity Compromised";

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
    reason: `Document fingerprint altered from ${doc.originalFingerprint.substring(0, 8)}... to ${doc.fingerprint.substring(0, 8)}...`
  });

  res.json({
    message: "Tampering simulated. Document fingerprint modified.",
    document: doc,
    securityEvent
  });
});

// POST /api/documents/:id/restore - Restore Tampered Document
router.post('/:id/restore', (req, res) => {
  const doc = documents.find(d => d.id === req.params.id);
  if (!doc) {
    return res.status(404).json({ message: 'Document not found' });
  }

  // Restore content and original fingerprint
  if (doc.content.includes(" [UNAUTHORIZED ALTERATION ADDED BY TAMPER SIMULATION]")) {
    doc.content = doc.content.replace(" [UNAUTHORIZED ALTERATION ADDED BY TAMPER SIMULATION]", "");
  }
  doc.fingerprint = doc.originalFingerprint;
  doc.isTampered = false;
  doc.status = "Protected";

  addAuditLog({
    user: req.body.user || "Administrator",
    userRole: "Administrator",
    action: "DOCUMENT_RESTORE",
    document: doc.name,
    documentId: doc.id,
    purpose: "Remediation",
    result: "ALLOWED",
    reason: "Document fingerprint restored to verified state from secure backup."
  });

  res.json({
    message: "Document restored to pristine state.",
    document: doc
  });
});

module.exports = router;
