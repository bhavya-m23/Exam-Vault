const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DEFAULT_DB_PATH = path.resolve(__dirname, '../data/examvault.db');

let dbInstance = null;
let currentPath = null;

/**
 * Returns or initializes the SQLite database connection.
 * @param {string} [dbPath] - Optional custom path for the database file (e.g. for testing).
 * @returns {DatabaseSync}
 */
function getDb(dbPath = process.env.DATABASE_PATH || DEFAULT_DB_PATH) {
  // If instance exists for the same path, return it
  if (dbInstance && currentPath === dbPath) {
    return dbInstance;
  }

  // Close existing instance if path changes
  if (dbInstance) {
    closeDb();
  }

  // Ensure target directory exists if writing to disk
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new DatabaseSync(dbPath);
  currentPath = dbPath;

  // Configure SQLite settings for reliability & safety
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA busy_timeout = 5000;');

  // WAL mode is optimal for file-based databases
  if (dbPath !== ':memory:') {
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA synchronous = NORMAL;');
  }

  return dbInstance;
}

/**
 * Closes the active database connection.
 */
function closeDb() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (err) {
      // Ignore if already closed
    }
    dbInstance = null;
    currentPath = null;
  }
}

module.exports = {
  getDb,
  closeDb,
  DEFAULT_DB_PATH
};
