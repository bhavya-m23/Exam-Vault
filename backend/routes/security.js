const express = require('express');
const router = express.Router();
const {
  getSecurityEvents,
  getSecurityEventById,
  getSecurityStats,
  reviewSecurityEvent,
  addAuditLog
} = require('../data/store');
const detectionEngine = require('../services/detectionEngine');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const config = require('../config');

// All security routes require authentication
router.use(authenticateToken);

// ==========================================
// 1. SECURITY EVENTS & METRICS
// ==========================================

// GET /api/security/stats - Retrieve metrics over selectable time range
router.get('/stats', (req, res) => {
  const range = req.query.range || 'all';
  const validRanges = ['1h', '24h', '7d', '30d', 'all'];
  const selectedRange = validRanges.includes(range) ? range : 'all';

  const stats = getSecurityStats(selectedRange);
  res.json(stats);
});

// GET /api/security/events - Filter events with pagination and role-based redaction
router.get('/events', (req, res) => {
  const {
    severity,
    type,
    ruleId,
    outcome,
    startDate,
    endDate,
    search,
    incidentId,
    isSimulated,
    page,
    limit,
    paginate
  } = req.query;

  // Least-privilege role check: pass userRole to getSecurityEvents
  const userRole = req.user.role;

  const validLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
  const validPage = Math.max(1, Number(page) || 1);

  const filters = {
    severity,
    type,
    ruleId,
    outcome,
    startDate,
    endDate,
    search,
    incidentId,
    isSimulated: isSimulated !== undefined ? (isSimulated === 'true' || isSimulated === '1') : undefined,
    userRole
  };

  // If pagination requested explicitly via query param or page/limit supplied
  if (paginate === 'true' || page || (limit && limit !== 'all')) {
    filters.page = validPage;
    filters.limit = validLimit;

    // Get unpaginated total count for pagination metadata
    const allMatching = getSecurityEvents({ ...filters, page: undefined, limit: undefined });
    const paginatedEvents = getSecurityEvents(filters);

    return res.json({
      events: paginatedEvents,
      pagination: {
        total: allMatching.length,
        page: validPage,
        limit: validLimit,
        totalPages: Math.ceil(allMatching.length / validLimit) || 1
      }
    });
  }

  // Backward-compatible array response with pagination headers
  const events = getSecurityEvents(filters);
  res.setHeader('X-Total-Count', events.length);
  res.json(events);
});

// GET /api/security/events/:id - Single security event details
router.get('/events/:id', (req, res) => {
  const event = getSecurityEventById(req.params.id);
  if (!event) {
    return res.status(404).json({ message: 'Security event not found' });
  }

  // Least-privilege redaction for ordinary users
  if (req.user.role !== 'Administrator' && req.user.role !== 'Exam Coordinator') {
    return res.json({
      ...event,
      ip: 'REDACTED',
      correlationId: undefined,
      metadata: undefined
    });
  }

  res.json(event);
});

// PUT /api/security/events/:id/review - Review & resolve security alert
router.put('/events/:id/review', requireRole('Administrator'), (req, res) => {
  const reviewer = req.user.name;
  const status = req.body.status || "Reviewed";

  const updatedEvent = reviewSecurityEvent(req.params.id, {
    user: reviewer,
    status
  });

  if (!updatedEvent) {
    return res.status(404).json({ message: 'Security event not found' });
  }

  res.json({
    message: `Security event ${updatedEvent.id} marked as ${updatedEvent.status}`,
    event: updatedEvent
  });
});

// ==========================================
// 2. DETECTION RULES
// ==========================================

// GET /api/security/rules - List configured detection rules
router.get('/rules', (req, res) => {
  const rules = detectionEngine.getDetectionRules();
  res.json(rules);
});

// PUT /api/security/rules/:ruleId - Update rule configuration (Administrator only)
router.put('/rules/:ruleId', requireRole('Administrator'), (req, res) => {
  const { ruleId } = req.params;
  const { enabled, thresholdConfig } = req.body;

  const existingRule = detectionEngine.getDetectionRuleById(ruleId);
  if (!existingRule) {
    return res.status(404).json({ message: `Detection rule '${ruleId}' not found.` });
  }

  const updated = detectionEngine.updateDetectionRule(ruleId, { enabled, thresholdConfig });

  addAuditLog({
    user: req.user.name,
    userRole: req.user.role,
    action: 'DETECTION_RULE_UPDATE',
    document: updated.name,
    documentId: ruleId,
    purpose: 'Security Configuration',
    result: 'ALLOWED',
    reason: `Updated detection rule ${ruleId} configuration (Enabled: ${updated.enabled})`,
    ip: req.ip || '127.0.0.1'
  });

  res.json({
    message: `Detection rule ${ruleId} updated successfully.`,
    rule: updated
  });
});

// ==========================================
// 3. INCIDENT MANAGEMENT
// ==========================================

const requireInvestigatorRole = requireRole(['Administrator', 'Exam Coordinator']);

// GET /api/security/incidents - List incidents with filtering and pagination
router.get('/incidents', requireInvestigatorRole, (req, res) => {
  const { status, severity, assignedTo, search, page, limit } = req.query;
  const result = detectionEngine.getIncidents({
    status,
    severity,
    assignedTo,
    search,
    page,
    limit
  });
  res.json(result);
});

// GET /api/security/incidents/:id - Incident details with related events and notes
router.get('/incidents/:id', requireInvestigatorRole, (req, res) => {
  const incident = detectionEngine.getIncidentById(req.params.id);
  if (!incident) {
    return res.status(404).json({ message: `Incident '${req.params.id}' not found.` });
  }
  res.json(incident);
});

// POST /api/security/incidents/:id/notes - Add investigation note
router.post('/incidents/:id/notes', requireInvestigatorRole, (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  if (!note || typeof note !== 'string' || note.trim().length === 0) {
    return res.status(400).json({ message: 'Investigation note content cannot be empty.' });
  }

  if (note.length > 2000) {
    return res.status(400).json({ message: 'Investigation note exceeds maximum length of 2000 characters.' });
  }

  try {
    const updated = detectionEngine.addIncidentNote(id, {
      author: req.user.name,
      authorRole: req.user.role,
      note: note.trim()
    });

    if (!updated) {
      return res.status(404).json({ message: `Incident '${id}' not found.` });
    }

    addAuditLog({
      user: req.user.name,
      userRole: req.user.role,
      action: 'INCIDENT_NOTE_ADDED',
      document: updated.title,
      documentId: id,
      purpose: 'Incident Investigation',
      result: 'ALLOWED',
      reason: `Added investigation note to incident ${id}`,
      ip: req.ip || '127.0.0.1'
    });

    res.status(201).json({
      message: 'Investigation note added successfully.',
      incident: updated
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/security/incidents/:id/status - Update incident status
router.put('/incidents/:id/status', requireInvestigatorRole, (req, res) => {
  const { id } = req.params;
  const { status, resolutionSummary, note } = req.body;

  const validStatuses = ['Open', 'Investigating', 'Resolved', 'False Positive'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      message: `Invalid incident status '${status}'. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  if ((status === 'Resolved' || status === 'False Positive') && !resolutionSummary && !note) {
    return res.status(400).json({
      message: `Resolving or closing an incident requires a resolution summary or explanation note.`
    });
  }

  try {
    const updated = detectionEngine.updateIncidentStatus(id, {
      status,
      resolutionSummary,
      note,
      author: req.user.name,
      authorRole: req.user.role
    });

    if (!updated) {
      return res.status(404).json({ message: `Incident '${id}' not found.` });
    }

    addAuditLog({
      user: req.user.name,
      userRole: req.user.role,
      action: 'INCIDENT_STATUS_CHANGE',
      document: updated.title,
      documentId: id,
      purpose: 'Incident Resolution',
      result: 'ALLOWED',
      reason: `Changed incident ${id} status to ${status}${resolutionSummary ? `: ${resolutionSummary}` : ''}`,
      ip: req.ip || '127.0.0.1'
    });

    res.json({
      message: `Incident ${id} status updated to ${status}.`,
      incident: updated
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/security/incidents/:id/assign - Assign incident to investigator
router.put('/incidents/:id/assign', requireInvestigatorRole, (req, res) => {
  const { id } = req.params;
  const { assignedTo } = req.body;

  if (!assignedTo || typeof assignedTo !== 'string' || assignedTo.trim().length === 0) {
    return res.status(400).json({ message: 'Investigator name/ID is required for assignment.' });
  }

  try {
    const updated = detectionEngine.assignIncident(id, {
      assignedTo: assignedTo.trim(),
      author: req.user.name,
      authorRole: req.user.role
    });

    if (!updated) {
      return res.status(404).json({ message: `Incident '${id}' not found.` });
    }

    addAuditLog({
      user: req.user.name,
      userRole: req.user.role,
      action: 'INCIDENT_ASSIGNED',
      document: updated.title,
      documentId: id,
      purpose: 'Incident Investigation',
      result: 'ALLOWED',
      reason: `Assigned incident ${id} to ${assignedTo.trim()}`,
      ip: req.ip || '127.0.0.1'
    });

    res.json({
      message: `Incident ${id} assigned to ${assignedTo.trim()}.`,
      incident: updated
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ==========================================
// 4. CONTROLLED SECURITY EVENT SIMULATION
// ==========================================

// POST /api/security/simulate - Controlled demo threat simulation
router.post('/simulate', requireRole('Administrator'), (req, res) => {
  // Enforce environment protection: disabled in production unless explicitly allowed
  if (config.NODE_ENV === 'production' && !config.ALLOW_DEMO_SIMULATION) {
    return res.status(403).json({
      message: 'Controlled security event simulation is disabled in production environments.'
    });
  }

  const { scenario = 'AUTH_BURST' } = req.body;
  const clientIp = req.ip || '127.0.0.1';

  let result;
  if (scenario === 'AUTH_BURST') {
    // Generate synthetic failed logins
    const syntheticUser = `simulated.attacker.${Date.now().toString().slice(-4)}@test-threat.local`;
    for (let i = 0; i < 4; i++) {
      addAuditLog({
        user: syntheticUser,
        userRole: 'Anonymous',
        action: 'AUTH_LOGIN_FAILED',
        document: 'Authentication Gateway',
        documentId: 'AUTH-GATE',
        purpose: 'Controlled Security Simulation',
        result: 'BLOCKED',
        reason: '[SIMULATION] Synthetic brute force attack burst',
        ip: '10.0.0.99',
        isSimulated: true
      });
    }
    result = detectionEngine.evaluateAuthFailure({
      user: syntheticUser,
      ip: '10.0.0.99',
      isSimulated: true
    });
  } else if (scenario === 'DOC_UNAUTH') {
    const syntheticUser = 'Simulated Unauthorized Actor';
    for (let i = 0; i < 4; i++) {
      addAuditLog({
        user: syntheticUser,
        userRole: 'Staff',
        action: 'DOCUMENT_VIEW',
        document: `Confidential Exam Paper ${i + 1}`,
        documentId: `DOC-SIM-00${i + 1}`,
        purpose: 'Controlled Security Simulation',
        result: 'BLOCKED',
        reason: '[SIMULATION] Synthetic unauthorized document access probe',
        ip: '10.0.0.88',
        isSimulated: true
      });
    }
    result = detectionEngine.evaluateUnauthorizedAccess({
      user: syntheticUser,
      userRole: 'Staff',
      document: 'Confidential Exam Paper 1',
      documentId: 'DOC-SIM-001',
      ip: '10.0.0.88',
      isSimulated: true
    });
  } else if (scenario === 'INTEGRITY_TAMPER') {
    result = detectionEngine.evaluateIntegrityTamper({
      documentId: 'DOC-SIM-CORRUPT',
      documentName: 'Simulated Corrupted Examination File',
      expectedFingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      actualFingerprint: 'deadbeef98fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      user: req.user.name,
      userRole: req.user.role,
      ip: clientIp,
      isSimulated: true
    });
  } else {
    return res.status(400).json({
      message: `Unknown simulation scenario '${scenario}'. Supported: AUTH_BURST, DOC_UNAUTH, INTEGRITY_TAMPER`
    });
  }

  addAuditLog({
    user: req.user.name,
    userRole: req.user.role,
    action: 'SECURITY_SIMULATION_EXECUTED',
    document: 'Security Monitoring Engine',
    documentId: 'SIM-ENGINE',
    purpose: 'Security Testing',
    result: 'ALLOWED',
    reason: `Administrator triggered controlled simulation scenario: ${scenario}`,
    ip: clientIp,
    isSimulated: true
  });

  res.status(201).json({
    message: `Controlled simulation '${scenario}' executed successfully.`,
    isSimulated: true,
    result
  });
});

module.exports = router;
