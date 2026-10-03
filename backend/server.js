const express = require('express');
const cors = require('cors');

const documentsRoute = require('./routes/documents');
const policiesRoute = require('./routes/policies');
const auditRoute = require('./routes/audit');
const securityRoute = require('./routes/security');
const accessRoute = require('./routes/access');
const usersRoute = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend on port 5173
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// API Routes
app.use('/api/documents', documentsRoute);
app.use('/api/policies', policiesRoute);
app.use('/api/audit', auditRoute);
app.use('/api/security', securityRoute);
app.use('/api/access', accessRoute);
app.use('/api/users', usersRoute);

// Root health check
app.get('/', (req, res) => {
  res.json({
    name: "ExamVault Backend API",
    tagline: "Secure Examination Document Lifecycle Management",
    status: "Running",
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` ExamVault Backend Running on http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
