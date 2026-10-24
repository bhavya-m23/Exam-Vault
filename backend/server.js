const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDb } = require('./db');
const { PORT } = require('./config');

// Initialize persistent SQLite database
initDb();

const authRoute = require('./routes/auth');
const documentsRoute = require('./routes/documents');
const policiesRoute = require('./routes/policies');
const auditRoute = require('./routes/audit');
const securityRoute = require('./routes/security');
const incidentsRoute = require('./routes/incidents');
const accessRoute = require('./routes/access');
const usersRoute = require('./routes/users');

const app = express();

// Configure trusted reverse proxies safely (defaults to 1 hop for Vite dev server / local reverse proxy)
const trustProxyConfig = process.env.TRUST_PROXY !== undefined
  ? (process.env.TRUST_PROXY === 'true' ? true : (process.env.TRUST_PROXY === 'false' ? false : (isNaN(process.env.TRUST_PROXY) ? process.env.TRUST_PROXY : Number(process.env.TRUST_PROXY))))
  : 1;
app.set('trust proxy', trustProxyConfig);

const { csrfProtection } = require('./middleware/csrf');

// Enable CORS for frontend on port 5173 with credentials support
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(csrfProtection);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Authentication Routes (Public)
app.use('/api/auth', authRoute);

// Protected API Routes
app.use('/api/documents', documentsRoute);
app.use('/api/policies', policiesRoute);
app.use('/api/audit', auditRoute);
app.use('/api/security', securityRoute);
app.use('/api/incidents', incidentsRoute);
app.use('/api/access', accessRoute);
app.use('/api/users', usersRoute);

// Root health check (Public)
app.get('/', (req, res) => {
  res.json({
    name: "ExamVault Backend API",
    tagline: "Secure Examination Document Lifecycle Management",
    status: "Running",
    timestamp: new Date().toISOString()
  });
});

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` ExamVault Backend Running on http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;

