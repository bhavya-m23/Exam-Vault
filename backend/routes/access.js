const express = require('express');
const router = express.Router();
const { checkAccess } = require('../data/store');
const { authenticateToken } = require('../middleware/auth');
const { isDemoSwitchEnabled } = require('../config');

// Pre-approved list of seeded demo user IDs permitted for simulation
const PERMITTED_DEMO_IDS = ['USR-001', 'USR-002', 'USR-003', 'USR-004', 'USR-005'];

// Authorized simulation operators
const SIMULATION_OPERATOR_ROLES = ['Administrator', 'Exam Coordinator'];

// Access evaluation engine requires authentication
router.use(authenticateToken);

// POST /api/access/check
router.post('/check', (req, res) => {
  const { userId, documentId, action, purpose } = req.body;

  if (!documentId) {
    return res.status(400).json({
      allowed: false,
      reason: 'documentId is required'
    });
  }

  // Check if simulation is requested for a persona different from authenticated user
  const isSimulationRequested = userId && userId !== req.user.id;

  if (isSimulationRequested) {
    // 1. Verify simulation feature is enabled in environment
    if (!isDemoSwitchEnabled()) {
      return res.status(403).json({
        allowed: false,
        message: 'Access scenario simulation is disabled in this environment.'
      });
    }

    // 2. Restrict scenario simulation to authorized operators (Administrator, Exam Coordinator)
    if (!SIMULATION_OPERATOR_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        allowed: false,
        message: `Access forbidden: Role '${req.user.role}' is not permitted to execute access simulations.`
      });
    }

    // 3. Validate target persona against seeded demo accounts
    if (!PERMITTED_DEMO_IDS.includes(userId)) {
      return res.status(400).json({
        allowed: false,
        message: 'Invalid simulation persona. Only registered demo personas may be simulated.'
      });
    }

    // Execute authorized simulation
    const result = checkAccess({
      userId,
      documentId,
      action: action || "VIEW",
      purpose: purpose || "Exam Preparation",
      isSimulation: true,
      operator: req.user
    });

    return res.json(result);
  }

  // Genuine access check: strictly derive actor from authenticated req.user
  const result = checkAccess({
    userId: req.user.id,
    documentId,
    action: action || "VIEW",
    purpose: purpose || "Exam Preparation",
    isSimulation: false,
    operator: null
  });

  res.json(result);
});

module.exports = router;
