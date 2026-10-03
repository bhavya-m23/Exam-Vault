const crypto = require('crypto');

/**
 * Generates a SHA-256 fingerprint for document content/metadata.
 * @param {string|object} content 
 * @returns {string} SHA-256 hex string
 */
function generateFingerprint(content) {
  const data = typeof content === 'object' ? JSON.stringify(content) : String(content);
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Returns a shortened string for display (e.g. "a8f91c2d...72e91a")
 * @param {string} hash 
 * @returns {string}
 */
function formatShortFingerprint(hash) {
  if (!hash || hash.length < 16) return hash || '';
  return `${hash.substring(0, 8)}...${hash.substring(hash.length - 6)}`;
}

module.exports = {
  generateFingerprint,
  formatShortFingerprint
};
