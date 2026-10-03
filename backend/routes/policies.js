const express = require('express');
const router = express.Router();
const { accessPolicies, documents, addAuditLog } = require('../data/store');

// GET /api/policies
router.get('/', (req, res) => {
  res.json(accessPolicies);
});

// POST /api/policies - Create access policy
router.post('/', (req, res) => {
  const { documentId, allowedRoles, allowedActions, purpose, startTime, endTime } = req.body;

  if (!documentId || !allowedRoles || !allowedActions) {
    return res.status(400).json({ message: 'documentId, allowedRoles, and allowedActions are required' });
  }

  const doc = documents.find(d => d.id === documentId);
  const documentName = doc ? doc.name : documentId;

  const newPolicy = {
    id: `POL-00${accessPolicies.length + 1}`.replace(/00(\d{3,})/, '$1'),
    documentId,
    documentName,
    allowedRoles: Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles],
    allowedActions: Array.isArray(allowedActions) ? allowedActions : [allowedActions],
    purpose: purpose || "Exam Preparation",
    startTime: startTime || "09:00",
    endTime: endTime || "18:00",
    status: "Active",
    createdAt: new Date().toISOString()
  };

  accessPolicies.unshift(newPolicy);

  // Add Audit Log
  addAuditLog({
    user: req.body.user || "Administrator",
    userRole: req.body.userRole || "Administrator",
    action: "POLICY_CREATE",
    document: documentName,
    documentId,
    purpose: "Access Rule Creation",
    result: "ALLOWED",
    reason: `Created policy ${newPolicy.id} for roles [${newPolicy.allowedRoles.join(', ')}]`
  });

  res.status(201).json({
    message: "Access policy created successfully",
    policy: newPolicy
  });
});

// PUT /api/policies/:id - Update policy status or details
router.put('/:id', (req, res) => {
  const policyIndex = accessPolicies.findIndex(p => p.id === req.params.id);
  if (policyIndex === -1) {
    return res.status(404).json({ message: 'Policy not found' });
  }

  const existing = accessPolicies[policyIndex];
  const updated = {
    ...existing,
    ...req.body,
    id: existing.id // keep ID invariant
  };

  accessPolicies[policyIndex] = updated;

  addAuditLog({
    user: req.body.user || "Administrator",
    userRole: req.body.userRole || "Administrator",
    action: "POLICY_UPDATE",
    document: updated.documentName,
    documentId: updated.documentId,
    purpose: "Policy Modification",
    result: "ALLOWED",
    reason: `Updated policy ${updated.id} status to ${updated.status}`
  });

  res.json({
    message: "Policy updated successfully",
    policy: updated
  });
});

module.exports = router;
