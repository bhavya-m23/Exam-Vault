const express = require('express');
const router = express.Router();
const { getAuditLogs, addAuditLog } = require('../data/store');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All audit routes require authentication
router.use(authenticateToken);

// GET /api/audit
router.get('/', (req, res) => {
  const { filter, documentId } = req.query;
  const logs = getAuditLogs({ filter, documentId });
  res.json(logs);
});

// POST /api/audit - Manual audit log injection restricted to Administrators
router.post('/', requireRole('Administrator'), (req, res) => {
  const { action, document, documentId, purpose, result, reason, ip } = req.body;

  if (!action || !document) {
    return res.status(400).json({ message: 'Action and document are required' });
  }

  // Server-enforced identity from authenticated token
  const newLog = addAuditLog({
    user: req.user.name,
    userRole: req.user.role,
    action,
    document,
    documentId: documentId || "DOC-CUSTOM",
    purpose: purpose || "General Access",
    result: result || "ALLOWED",
    reason: reason || "Manual audit entry recorded by Administrator",
    ip: ip || req.ip || '127.0.0.1'
  });

  res.status(201).json(newLog);
});

module.exports = router;
