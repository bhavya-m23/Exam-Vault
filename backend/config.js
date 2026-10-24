const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 5000;

const KNOWN_PLACEHOLDERS = [
  'examvault-dev-secret-do-not-use-in-production-32chars-min',
  'examvault-dev-secret-key-change-in-production-min32chars',
  'your-production-jwt-secret-minimum-32-characters',
  'replace-with-a-secure-random-secret-key-minimum-32-chars',
  'secret',
  'changeme',
  'password',
  '12345678901234567890123456789012'
];

const MIN_SECRET_LENGTH = 32;

/**
 * Validates JWT secret according to environment policy.
 * In production:
 *  - Must be present and non-empty.
 *  - Must not match known development placeholders or insecure defaults.
 *  - Must meet minimum required strength (>= 32 characters).
 *  - Never falls back silently to a known secret.
 * In development / test:
 *  - Allows a development fallback only in an explicitly identified development/test environment.
 * In any other environment:
 *  - Enforces strict secret configuration without development fallback.
 */
function validateJwtSecret({ secret, nodeEnv = 'development' }) {
  const isExplicitDevOrTest = nodeEnv === 'development' || nodeEnv === 'test';
  const isProduction = nodeEnv === 'production';

  if (isProduction) {
    if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
      return {
        valid: false,
        error: 'JWT_SECRET environment variable is missing or empty in production.'
      };
    }
    if (secret.length < MIN_SECRET_LENGTH) {
      return {
        valid: false,
        error: `JWT_SECRET does not meet the minimum required strength in production (must be at least ${MIN_SECRET_LENGTH} characters).`
      };
    }
    if (KNOWN_PLACEHOLDERS.includes(secret.trim())) {
      return {
        valid: false,
        error: 'JWT_SECRET cannot use a known development placeholder or insecure default value in production.'
      };
    }
    return { valid: true, secret };
  }

  // Non-production: allow development fallback only in explicitly identified development/test environment
  if (isExplicitDevOrTest) {
    const activeSecret = (secret && typeof secret === 'string' && secret.trim().length > 0)
      ? secret
      : 'examvault-dev-secret-do-not-use-in-production-32chars-min';
    return { valid: true, secret: activeSecret, isFallback: !secret };
  }

  // Any other environment (e.g. staging or unidentified) requires a secure secret
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    return {
      valid: false,
      error: `JWT_SECRET must be explicitly set when running in environment '${nodeEnv}'.`
    };
  }
  if (secret.length < MIN_SECRET_LENGTH || KNOWN_PLACEHOLDERS.includes(secret.trim())) {
    return {
      valid: false,
      error: `JWT_SECRET does not meet security requirements in environment '${nodeEnv}'.`
    };
  }

  return { valid: true, secret };
}

const secretValidation = validateJwtSecret({
  secret: process.env.JWT_SECRET,
  nodeEnv: NODE_ENV
});

if (!secretValidation.valid) {
  // CRITICAL: Terminate startup in production or non-dev environments with invalid secret.
  // NEVER print the secret itself in the logs!
  console.error(`\n[FATAL CONFIGURATION ERROR] ${secretValidation.error}`);
  console.error('Server startup aborted. Please provide a secure JWT_SECRET (at least 32 characters).\n');
  process.exit(1);
}

const ACTIVE_JWT_SECRET = secretValidation.secret;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const isDemoSwitchEnabled = () => {
  if (process.env.ENABLE_DEMO_SWITCH !== undefined) {
    return process.env.ENABLE_DEMO_SWITCH === 'true';
  }
  return NODE_ENV !== 'production';
};

const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.resolve(__dirname, 'data/storage');

const MAX_UPLOAD_SIZE_BYTES = process.env.MAX_UPLOAD_SIZE_BYTES
  ? Number(process.env.MAX_UPLOAD_SIZE_BYTES)
  : 10 * 1024 * 1024; // 10 MB default

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.txt', '.png', '.jpg', '.jpeg'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/png',
  'image/jpeg'
];

// Threat Detection Configuration
const DETECTION_AUTH_FAIL_THRESHOLD = process.env.DETECTION_AUTH_FAIL_THRESHOLD
  ? Math.max(1, Number(process.env.DETECTION_AUTH_FAIL_THRESHOLD))
  : 3;

const DETECTION_AUTH_FAIL_WINDOW_MS = process.env.DETECTION_AUTH_FAIL_WINDOW_MS
  ? Math.max(1000, Number(process.env.DETECTION_AUTH_FAIL_WINDOW_MS))
  : 15 * 60 * 1000; // 15 minutes

const DETECTION_DOC_UNAUTH_THRESHOLD = process.env.DETECTION_DOC_UNAUTH_THRESHOLD
  ? Math.max(1, Number(process.env.DETECTION_DOC_UNAUTH_THRESHOLD))
  : 3;

const DETECTION_DOC_UNAUTH_WINDOW_MS = process.env.DETECTION_DOC_UNAUTH_WINDOW_MS
  ? Math.max(1000, Number(process.env.DETECTION_DOC_UNAUTH_WINDOW_MS))
  : 10 * 60 * 1000; // 10 minutes

const DETECTION_BURST_THRESHOLD = process.env.DETECTION_BURST_THRESHOLD
  ? Math.max(2, Number(process.env.DETECTION_BURST_THRESHOLD))
  : 8;

const DETECTION_BURST_WINDOW_MS = process.env.DETECTION_BURST_WINDOW_MS
  ? Math.max(1000, Number(process.env.DETECTION_BURST_WINDOW_MS))
  : 30 * 1000; // 30 seconds

const ALLOW_DEMO_SIMULATION = process.env.ALLOW_DEMO_SIMULATION !== undefined
  ? process.env.ALLOW_DEMO_SIMULATION === 'true'
  : NODE_ENV !== 'production';

module.exports = {
  NODE_ENV,
  PORT,
  JWT_SECRET: ACTIVE_JWT_SECRET,
  JWT_EXPIRES_IN,
  isDemoSwitchEnabled,
  get ENABLE_DEMO_SWITCH() {
    return isDemoSwitchEnabled();
  },
  validateJwtSecret,
  KNOWN_PLACEHOLDERS,
  MIN_SECRET_LENGTH,
  STORAGE_DIR,
  MAX_UPLOAD_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  DETECTION_AUTH_FAIL_THRESHOLD,
  DETECTION_AUTH_FAIL_WINDOW_MS,
  DETECTION_DOC_UNAUTH_THRESHOLD,
  DETECTION_DOC_UNAUTH_WINDOW_MS,
  DETECTION_BURST_THRESHOLD,
  DETECTION_BURST_WINDOW_MS,
  ALLOW_DEMO_SIMULATION
};

