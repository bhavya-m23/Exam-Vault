const { getDb, closeDb, DEFAULT_DB_PATH } = require('./connection');
const { runMigrations } = require('./migrations');
const { seedDatabase } = require('./seed');

/**
 * Initializes the database: establishes connection, runs pending migrations,
 * and executes idempotent seed data population.
 * @param {string} [dbPath]
 * @returns {import('node:sqlite').DatabaseSync}
 */
function initDb(dbPath) {
  const db = getDb(dbPath);
  runMigrations(db);
  seedDatabase(db);
  return db;
}

module.exports = {
  getDb,
  closeDb,
  initDb,
  DEFAULT_DB_PATH
};
