const express = require('express');
const router = express.Router();
const { auditLogs, addAuditLog } = require('../data/store');

// GET /api/audit
router.get('/', (req, res) => {
  const { filter, documentId } = req.query;
  let logs = auditLogs;

  if (filter && filter !== 'ALL' && filter !== 'All') {
    logs = logs.filter(l => l.result.toUpperCase() === filter.toUpperCase());
  }

  if (documentId) {
    logs = logs.filter(l => l.documentId === documentId);
  }

  res.json(logs);
});

// POST /api/audit
router.post('/', (req, res) => {
  const { user, userRole, action, document, documentId, purpose, result, reason, ip } = req.body;

  if (!user || !action || !document) {
    return res.status(400).json({ message: 'User, action, and document are required' });
  }

  const newLog = addAuditLog({
    user,
    userRole: userRole || "Staff",
    action,
    document,
    documentId: documentId || "DOC-CUSTOM",
    purpose: purpose || "General Access",
    result: result || "ALLOWED",
    reason: reason || "Manual audit entry recorded",
    ip
  });

  res.status(201).json(newLog);
});

module.exports = router;
