const express = require('express');
const router = express.Router();
const { securityEvents, auditLogs, documents, accessPolicies, addAuditLog } = require('../data/store');

// GET /api/security/events
router.get('/events', (req, res) => {
  res.json(securityEvents);
});

// GET /api/security/stats
router.get('/stats', (req, res) => {
  const blockedAttempts = auditLogs.filter(a => a.result === "BLOCKED").length;
  const suspiciousActivities = securityEvents.length;
  const activeAlerts = securityEvents.filter(s => s.status === "Active").length;
  const integrityWarnings = documents.filter(d => d.isTampered).length + 
    auditLogs.filter(a => a.result === "WARNING" || a.action === "TAMPER_DETECTED").length;

  const totalDocs = documents.length;
  const tamperedDocs = documents.filter(d => d.isTampered).length;
  const integrityPercentage = totalDocs > 0 ? (((totalDocs - tamperedDocs) / totalDocs) * 100).toFixed(1) : "100.0";

  res.json({
    protectedDocuments: totalDocs,
    activePolicies: accessPolicies.filter(p => p.status === "Active").length,
    blockedAttempts,
    suspiciousActivities,
    activeAlerts,
    integrityWarnings,
    integrityPercentage: `${integrityPercentage}%`,
    totalAuditEntries: auditLogs.length
  });
});

// PUT /api/security/events/:id/review
router.put('/events/:id/review', (req, res) => {
  const event = securityEvents.find(e => e.id === req.params.id);
  if (!event) {
    return res.status(404).json({ message: 'Security event not found' });
  }

  event.status = req.body.status || "Reviewed";
  event.reviewedBy = req.body.user || "Administrator";
  event.reviewedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

  addAuditLog({
    user: req.body.user || "Administrator",
    userRole: "Administrator",
    action: "SECURITY_EVENT_REVIEW",
    document: event.document || "System",
    documentId: event.documentId || "SYS",
    purpose: "Threat Management",
    result: "ALLOWED",
    reason: `Marked security alert ${event.id} (${event.type}) as ${event.status}`
  });

  res.json({
    message: `Security event ${event.id} marked as ${event.status}`,
    event
  });
});

module.exports = router;
