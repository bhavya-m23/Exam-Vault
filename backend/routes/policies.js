const express = require('express');
const router = express.Router();
const { getPolicies, addPolicy, updatePolicy } = require('../data/store');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All policy routes require authentication
router.use(authenticateToken);

// GET /api/policies
router.get('/', (req, res) => {
  res.json(getPolicies());
});

// POST /api/policies - Create access policy (Administrator, Exam Coordinator only)
router.post('/', requireRole('Administrator', 'Exam Coordinator'), (req, res) => {
  const { documentId, allowedRoles, allowedActions, purpose, startTime, endTime } = req.body;

  if (!documentId || !allowedRoles || !allowedActions) {
    return res.status(400).json({ message: 'documentId, allowedRoles, and allowedActions are required' });
  }

  // Server-enforced identity from authenticated token
  const newPolicy = addPolicy({
    documentId,
    allowedRoles,
    allowedActions,
    purpose,
    startTime,
    endTime,
    user: req.user.name,
    userRole: req.user.role
  });

  res.status(201).json({
    message: "Access policy created successfully",
    policy: newPolicy
  });
});

// PUT /api/policies/:id - Update policy status or details (Administrator, Exam Coordinator only)
router.put('/:id', requireRole('Administrator', 'Exam Coordinator'), (req, res) => {
  const updated = updatePolicy(
    req.params.id,
    req.body,
    req.user.name,
    req.user.role
  );

  if (!updated) {
    return res.status(404).json({ message: 'Policy not found' });
  }

  res.json({
    message: "Policy updated successfully",
    policy: updated
  });
});

module.exports = router;
