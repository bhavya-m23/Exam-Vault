const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  STORAGE_DIR,
  MAX_UPLOAD_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES
} = require('../config');
const { generateFingerprint } = require('./fingerprint');

/**
 * Ensures the persistent storage directory exists on disk.
 */
function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  return STORAGE_DIR;
}

/**
 * Strips dangerous path traversal tokens and non-standard characters from filenames.
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'document.bin';
  // Remove path traversal and directory separators
  const base = path.basename(filename).replace(/[\/\\]/g, '');
  // Sanitize to safe characters
  const clean = base.replace(/[^a-zA-Z0-9._\- ]/g, '_').trim();
  return clean || 'document.bin';
}

/**
 * Human-readable file size formatter.
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validates actual binary content headers (magic numbers) to prevent file extension spoofing.
 */
function validateMagicBytes(buffer, ext) {
  if (!buffer || buffer.length < 4) return false;

  switch (ext.toLowerCase()) {
    case '.pdf':
      // PDF header: "%PDF-" (25 50 44 46 2d)
      return buffer.slice(0, 5).toString('ascii') === '%PDF-';

    case '.png':
      // PNG header: 89 50 4E 47
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;

    case '.jpg':
    case '.jpeg':
      // JPEG header: FF D8 FF
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

    case '.docx':
    case '.xlsx':
      // OpenXML / Zip archive header: PK\x03\x04 (50 4b 03 04)
      return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;

    case '.txt':
      // Text files should not contain null bytes in printable range
      for (let i = 0; i < Math.min(buffer.length, 512); i++) {
        if (buffer[i] === 0) return false; // Binary null byte detected
      }
      return true;

    default:
      return true;
  }
}

/**
 * Validates file constraints: size, extension, MIME type, and content magic bytes.
 */
function validateFile({ buffer, originalName, mimeType }) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { valid: false, error: 'No file content received.' };
  }

  // 1. File size limit
  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the maximum allowed limit of ${formatFileSize(MAX_UPLOAD_SIZE_BYTES)}.`
    };
  }

  if (buffer.length === 0) {
    return { valid: false, error: 'Cannot upload an empty file.' };
  }

  // 2. Extension check
  const ext = path.extname(originalName || '').toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Disallowed file extension '${ext || 'none'}'. Permitted extensions: [${ALLOWED_EXTENSIONS.join(', ')}]`
    };
  }

  // 3. MIME type check
  if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return {
      valid: false,
      error: `Disallowed MIME type '${mimeType}'. Permitted types: [${ALLOWED_MIME_TYPES.join(', ')}]`
    };
  }

  // 4. Magic bytes validation (verifies real file signature)
  const isSignatureValid = validateMagicBytes(buffer, ext);
  if (!isSignatureValid) {
    return {
      valid: false,
      error: `File content does not match the claimed file format for extension '${ext}'.`
    };
  }

  return { valid: true, ext };
}

/**
 * Resolves a safe storage path, strictly preventing directory traversal.
 */
function getSafeStoragePath(storageKey) {
  if (!storageKey || typeof storageKey !== 'string') return null;
  // Ensure basename only (no slashes, no ../)
  const safeName = path.basename(storageKey);
  if (safeName !== storageKey || storageKey.includes('..')) {
    return null;
  }
  const resolved = path.resolve(STORAGE_DIR, safeName);
  if (!resolved.startsWith(path.resolve(STORAGE_DIR))) {
    return null;
  }
  return resolved;
}

/**
 * Stores a verified binary file on disk using a server-controlled safe identifier.
 */
function saveFile({ buffer, originalName, mimeType }) {
  ensureStorageDir();

  const validation = validateFile({ buffer, originalName, mimeType });
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.status = 400;
    throw err;
  }

  const safeOriginalName = sanitizeFilename(originalName);
  const ext = validation.ext;
  const storageKey = `doc_${crypto.randomUUID()}${ext}`;
  const targetPath = getSafeStoragePath(storageKey);

  fs.writeFileSync(targetPath, buffer);

  const fingerprint = generateFingerprint(buffer);
  const fileSize = formatFileSize(buffer.length);

  return {
    storageKey,
    fingerprint,
    fileSize,
    mimeType: mimeType || 'application/octet-stream',
    originalFileName: safeOriginalName,
    byteLength: buffer.length
  };
}

/**
 * Reads binary file from storage.
 */
function readFile(storageKey) {
  const filePath = getSafeStoragePath(storageKey);
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath);
}

/**
 * Deletes a stored file safely (e.g. during rollback or document purge).
 */
function deleteFile(storageKey) {
  const filePath = getSafeStoragePath(storageKey);
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

/**
 * Simulates tampering on a stored binary file by modifying its content on disk.
 */
function tamperStoredFile(storageKey) {
  const filePath = getSafeStoragePath(storageKey);
  if (!filePath || !fs.existsSync(filePath)) return null;

  const currentBuffer = fs.readFileSync(filePath);
  const tamperPayload = Buffer.from("\n[UNAUTHORIZED ALTERATION ADDED BY TAMPER SIMULATION]");
  const tamperedBuffer = Buffer.concat([currentBuffer, tamperPayload]);

  fs.writeFileSync(filePath, tamperedBuffer);
  return generateFingerprint(tamperedBuffer);
}

/**
 * Restores a tampered binary file to a pristine buffer.
 */
function restoreStoredFile(storageKey, cleanBuffer) {
  const filePath = getSafeStoragePath(storageKey);
  if (!filePath) return false;
  fs.writeFileSync(filePath, cleanBuffer);
  return true;
}

module.exports = {
  ensureStorageDir,
  sanitizeFilename,
  formatFileSize,
  validateFile,
  getSafeStoragePath,
  saveFile,
  readFile,
  deleteFile,
  tamperStoredFile,
  restoreStoredFile
};
