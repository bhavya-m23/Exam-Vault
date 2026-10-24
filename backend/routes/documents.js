const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getDocuments,
  getDocumentById,
  addDocument,
  verifyDocument,
  tamperDocument,
  restoreDocument,
  getPolicyByDocumentId,
  getAuditLogs,
  addAuditLog,
  addSecurityEvent,
  getDocumentBinary
} = require('../data/store');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const storage = require('../utils/storage');
const { MAX_UPLOAD_SIZE_BYTES } = require('../config');

// In-memory multer storage so validation occurs prior to persistent disk write
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES
  }
});

// Middleware wrapper to handle file size and multipart errors safely
function handleUploadMiddleware(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: `File upload exceeds the maximum allowed size of ${storage.formatFileSize(MAX_UPLOAD_SIZE_BYTES)}.`
        });
      }
      return res.status(400).json({
        message: err.message || 'File upload parsing error.'
      });
    }
    next();
  });
}

// All document vault routes require authentication
router.use(authenticateToken);

// GET /api/documents - Safe metadata listing (omits raw content)
router.get('/', (req, res) => {
  res.json(getDocuments());
});

// GET /api/documents/:id - Object-level authorization enforced
router.get('/:id', (req, res) => {
  const doc = getDocumentById(req.params.id);
  if (!doc) {
    return res.status(404).json({ message: 'Document not found' });
  }

  const policy = getPolicyByDocumentId(doc.id);
  const userRole = req.user.role;
  const clientIp = req.ip || '127.0.0.1';

  // 1. Policy Authorization Check
  const isRoleAllowed = userRole === 'Administrator' || (policy && policy.allowedRoles && policy.allowedRoles.includes(userRole));

  // 2. Tamper check: Only Administrator and Exam Coordinator can access tampered documents for investigation/restoration
  const isTamperAllowed = !doc.isTampered || userRole === 'Administrator' || userRole === 'Exam Coordinator';

  if (!isRoleAllowed || !isTamperAllowed) {
    const reason = !isRoleAllowed
      ? `Role '${userRole}' is not authorized to access document '${doc.name}'. Permitted: [${policy ? policy.allowedRoles.join(', ') : 'None'}]`
      : `Access blocked: Document '${doc.name}' integrity is compromised.`;

    addAuditLog({
      user: req.user.name,
      userRole,
      action: 'DOCUMENT_VIEW',
      document: doc.name,
      documentId: doc.id,
      purpose: req.query.purpose || 'Document Access',
      result: 'BLOCKED',
      reason,
      ip: clientIp
    });

    addSecurityEvent({
      severity: doc.sensitivity === 'Critical' ? 'CRITICAL' : 'HIGH',
      type: 'UNAUTHORIZED_ACCESS',
      user: req.user.name,
      userRole,
      document: doc.name,
      documentId: doc.id,
      message: reason,
      ip: clientIp
    });

    return res.status(403).json({
      message: `Access forbidden: ${reason}`,
      allowed: false
    });
  }

  // Access Granted - log audit trail
  addAuditLog({
    user: req.user.name,
    userRole,
    action: 'DOCUMENT_VIEW',
    document: doc.name,
    documentId: doc.id,
    purpose: req.query.purpose || (policy ? policy.purpose : 'Document Inspection'),
    result: 'ALLOWED',
    reason: `Document retrieved under policy ${policy ? policy.id : 'ADMIN_DIRECT'}`,
    ip: clientIp
  });

  const allLogs = getAuditLogs();
  const docAuditLogs = allLogs.filter(a => a.documentId === doc.id || a.document === doc.name);

  res.json({
    document: doc,
    policy: policy || null,
    auditTrail: docAuditLogs
  });
});

// GET /api/documents/:id/download - Secure Document Binary Download
router.get('/:id/download', (req, res) => {
  const doc = getDocumentById(req.params.id);
  if (!doc) {
    return res.status(404).json({ message: 'Document not found' });
  }

  const policy = getPolicyByDocumentId(doc.id);
  const userRole = req.user.role;
  const clientIp = req.ip || '127.0.0.1';

  // 1. Role & Policy Authorization Check for DOWNLOAD action
  const isRoleAllowed = userRole === 'Administrator' || (
    policy &&
    policy.allowedRoles &&
    policy.allowedRoles.includes(userRole) &&
    policy.allowedActions &&
    policy.allowedActions.includes('DOWNLOAD')
  );

  // 2. Tamper check: Only Administrator and Exam Coordinator can download tampered documents for investigation
  const isTamperAllowed = !doc.isTampered || userRole === 'Administrator' || userRole === 'Exam Coordinator';

  if (!isRoleAllowed || !isTamperAllowed) {
    const reason = !isRoleAllowed
      ? `Role '${userRole}' is not authorized to download document '${doc.name}'. Permitted: [${policy ? policy.allowedRoles.join(', ') : 'None'}]`
      : `Download blocked: Document '${doc.name}' integrity is compromised.`;

    addAuditLog({
      user: req.user.name,
      userRole,
      action: 'DOCUMENT_DOWNLOAD',
      document: doc.name,
      documentId: doc.id,
      purpose: req.query.purpose || 'Document Download',
      result: 'BLOCKED',
      reason,
      ip: clientIp
    });

    addSecurityEvent({
      severity: doc.sensitivity === 'Critical' ? 'CRITICAL' : 'HIGH',
      type: 'UNAUTHORIZED_DOWNLOAD',
      user: req.user.name,
      userRole,
      document: doc.name,
      documentId: doc.id,
      message: reason,
      ip: clientIp
    });

    return res.status(403).json({
      message: `Access forbidden: ${reason}`,
      allowed: false
    });
  }

  // 3. Retrieve binary payload safely
  const binaryResult = getDocumentBinary(doc.id);
  if (!binaryResult || binaryResult.missing) {
    addAuditLog({
      user: req.user.name,
      userRole,
      action: 'DOCUMENT_DOWNLOAD',
      document: doc.name,
      documentId: doc.id,
      purpose: 'Document Retrieval',
      result: 'ERROR',
      reason: 'Stored document binary file is missing from secure storage',
      ip: clientIp
    });

    return res.status(404).json({
      message: 'Document file content is missing from secure storage.'
    });
  }

  // 4. Log successful download audit entry
  addAuditLog({
    user: req.user.name,
    userRole,
    action: 'DOCUMENT_DOWNLOAD',
    document: doc.name,
    documentId: doc.id,
    purpose: req.query.purpose || 'Document Download',
    result: 'ALLOWED',
    reason: `Document downloaded securely under policy ${policy ? policy.id : 'ADMIN_DIRECT'}`,
    ip: clientIp
  });

  // 5. Stream binary with sanitized headers and safe Content-Disposition
  const safeFilename = storage.sanitizeFilename(binaryResult.filename);
  res.setHeader('Content-Type', binaryResult.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('Content-Length', binaryResult.buffer.length);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  res.send(binaryResult.buffer);
});

// POST /api/documents - Upload document (Administrator, Exam Coordinator, Course Instructor)
router.post('/', requireRole('Administrator', 'Exam Coordinator', 'Course Instructor'), handleUploadMiddleware, (req, res) => {
  const owner = req.user.name;
  const ownerRole = req.user.role;

  // Case 1: Binary Multipart File Upload
  if (req.file) {
    let savedFile;
    try {
      savedFile = storage.saveFile({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype
      });
    } catch (err) {
      return res.status(err.status || 400).json({
        message: err.message || 'File validation failed.'
      });
    }

    const docName = (req.body && req.body.name ? req.body.name.trim() : '') || savedFile.originalFileName;
    const subject = (req.body && req.body.subject ? req.body.subject.trim() : '') || 'General Examination';
    const sensitivity = (req.body && req.body.sensitivity) || 'High';

    try {
      const { document: newDoc, policy: defaultPolicy } = addDocument({
        name: docName,
        subject,
        owner,
        ownerRole,
        sensitivity,
        fileSize: savedFile.fileSize,
        storageKey: savedFile.storageKey,
        mimeType: savedFile.mimeType,
        originalFileName: savedFile.originalFileName,
        buffer: req.file.buffer
      });

      return res.status(201).json({
        message: "Document secured successfully. Integrity fingerprint created.",
        document: newDoc,
        policy: defaultPolicy
      });
    } catch (err) {
      // Clean up orphaned stored file if database transaction fails
      storage.deleteFile(savedFile.storageKey);
      throw err;
    }
  }

  // Case 2: JSON Body Text Simulation (Backward Compatibility for Seeded/API Tests)
  const { name, subject, sensitivity, content, fileSize } = req.body || {};

  if (!name || !subject) {
    return res.status(400).json({ message: 'Name and Subject are required' });
  }

  const { document: newDoc, policy: defaultPolicy } = addDocument({
    name,
    subject,
    owner,
    ownerRole,
    sensitivity,
    content,
    fileSize
  });

  res.status(201).json({
    message: "Document secured successfully. Integrity fingerprint created.",
    document: newDoc,
    policy: defaultPolicy
  });
});

// POST /api/documents/:id/verify - Verify Document Integrity
router.post('/:id/verify', (req, res) => {
  const result = verifyDocument(
    req.params.id,
    req.user.name,
    req.user.role
  );

  if (!result) {
    return res.status(404).json({ message: 'Document not found' });
  }

  res.json(result);
});

// POST /api/documents/:id/tamper - Simulate Tampering (Administrator, Exam Coordinator only)
router.post('/:id/tamper', requireRole('Administrator', 'Exam Coordinator'), (req, res) => {
  const result = tamperDocument(req.params.id);

  if (!result) {
    return res.status(404).json({ message: 'Document not found' });
  }

  res.json({
    message: "Tampering simulated. Document fingerprint modified.",
    document: result.document,
    securityEvent: result.securityEvent
  });
});

// POST /api/documents/:id/restore - Restore Tampered Document (Administrator, Exam Coordinator only)
router.post('/:id/restore', requireRole('Administrator', 'Exam Coordinator'), (req, res) => {
  const restoredDoc = restoreDocument(
    req.params.id,
    req.user.name
  );

  if (!restoredDoc) {
    return res.status(404).json({ message: 'Document not found' });
  }

  res.json({
    message: "Document restored to pristine state.",
    document: restoredDoc
  });
});

module.exports = router;
