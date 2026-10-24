const express = require('express');
const router = express.Router();
const detectionEngine = require('../services/detectionEngine');
const { addAuditLog } = require('../data/store');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All incident routes require authentication and investigator roles
router.use(authenticateToken);
const requireInvestigator = requireRole(['Administrator', 'Exam Coordinator']);
router.use(requireInvestigator);

// GET /api/incidents - List incidents
router.get('/', (req, res) => {
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

// GET /api/incidents/:id - Incident details
router.get('/:id', (req, res) => {
  const incident = detectionEngine.getIncidentById(req.params.id);
  if (!incident) {
    return res.status(404).json({ message: `Incident '${req.params.id}' not found.` });
  }
  res.json(incident);
});

// POST /api/incidents/:id/notes - Add note
router.post('/:id/notes', (req, res) => {
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

// PUT /api/incidents/:id/status - Update status
router.put('/:id/status', (req, res) => {
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

// PUT /api/incidents/:id/assign - Assign incident
router.put('/:id/assign', (req, res) => {
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

module.exports = router;
