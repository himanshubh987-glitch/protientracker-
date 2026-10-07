/**
 * connection.js: SQLite database connection management via better-sqlite3
 * Enforces PRAGMA foreign_keys = ON and PRAGMA journal_mode = WAL
 */

const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

let defaultInstance = null;

function createConnection(dbPath = process.env.DB_PATH || 'proteintrack.db') {
  const isMemory = dbPath === ':memory:';
  const resolvedPath = isMemory ? dbPath : path.resolve(process.cwd(), dbPath);

  const db = new Database(resolvedPath, {
    verbose: process.env.DB_LOGS === 'true' ? console.log : null
  });

  // Enforce foreign key constraints
  db.pragma('foreign_keys = ON');

  // Enforce Write-Ahead Logging (WAL) for concurrency & durability (file DBs only)
  if (!isMemory) {
    db.pragma('journal_mode = WAL');
  }

  return db;
}

function getDb(customPath = null) {
  if (customPath) {
    return createConnection(customPath);
  }
  if (!defaultInstance) {
    defaultInstance = createConnection();
  }
  return defaultInstance;
}

function closeDb(instance = null) {
  const target = instance || defaultInstance;
  if (target && target.open) {
    target.close();
  }
  if (!instance) {
    defaultInstance = null;
  }
}

module.exports = {
  createConnection,
  getDb,
  closeDb
};
