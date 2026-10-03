const express = require('express');
const router = express.Router();
const { checkAccess } = require('../data/store');

// POST /api/access/check
router.post('/check', (req, res) => {
  const { userId, documentId, action, purpose } = req.body;

  if (!userId || !documentId) {
    return res.status(400).json({
      allowed: false,
      reason: 'Both userId and documentId are required'
    });
  }

  const result = checkAccess({
    userId,
    documentId,
    action: action || "VIEW",
    purpose: purpose || "Exam Preparation"
  });

  res.json(result);
});

module.exports = router;
