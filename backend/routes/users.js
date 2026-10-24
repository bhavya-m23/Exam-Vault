const express = require('express');
const router = express.Router();
const { getUsers } = require('../data/store');
const { authenticateToken } = require('../middleware/auth');

// All user routes require authentication
router.use(authenticateToken);

// GET /api/users
router.get('/', (req, res) => {
  res.json(getUsers());
});

module.exports = router;
