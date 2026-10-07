const path = require('path');
const fs = require('fs');
const config = require('../config/env');

let sqliteDbInstance = null;

/**
 * Initializes and returns the SQLite database connection using better-sqlite3.
 * Configured with Write-Ahead Logging (WAL) and enforced foreign keys.
 */
function getSqliteConnection() {
  if (sqliteDbInstance) return sqliteDbInstance;

  const Database = require('better-sqlite3');
  const dbPath = path.resolve(__dirname, '../../', config.databaseFile);
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  sqliteDbInstance = db;
  return sqliteDbInstance;
}

/**
 * Universal Database Interface Adapter
 * 
 * Provides an asynchronous query API (query, queryOne, execute, transaction)
 * that is 100% compatible with both SQLite and future PostgreSQL drivers.
 */
const db = {
  /**
   * Execute a query returning multiple rows.
   * @param {string} sql 
   * @param {Array} params 
   * @returns {Promise<Array>}
   */
  async query(sql, params = []) {
    const conn = getSqliteConnection();
    try {
      const stmt = conn.prepare(sql);
      return stmt.all(...params);
    } catch (err) {
      console.error('Database query error:', err.message, '\nSQL:', sql, '\nParams:', params);
      throw err;
    }
  },

  /**
   * Execute a query returning a single row or null.
   * @param {string} sql 
   * @param {Array} params 
   * @returns {Promise<Object|null>}
   */
  async queryOne(sql, params = []) {
    const conn = getSqliteConnection();
    try {
      const stmt = conn.prepare(sql);
      const row = stmt.get(...params);
      return row || null;
    } catch (err) {
      console.error('Database queryOne error:', err.message, '\nSQL:', sql, '\nParams:', params);
      throw err;
    }
  },

  /**
   * Execute an INSERT, UPDATE, or DELETE statement.
   * @param {string} sql 
   * @param {Array} params 
   * @returns {Promise<{ changes: number, lastInsertRowid: number }>}
   */
  async execute(sql, params = []) {
    const conn = getSqliteConnection();
    try {
      const stmt = conn.prepare(sql);
      const info = stmt.run(...params);
      return {
        changes: info.changes,
        lastInsertRowid: Number(info.lastInsertRowid)
      };
    } catch (err) {
      console.error('Database execute error:', err.message, '\nSQL:', sql, '\nParams:', params);
      throw err;
    }
  },

  /**
   * Execute a block of operations within a transactional boundary.
   * @param {Function} callback (trx) => Promise<any>
   */
  async transaction(callback) {
    const conn = getSqliteConnection();
    const runInTransaction = conn.transaction(() => {
      // Create synchronous wrapper matching the db interface for SQLite
      const trx = {
        query: (sql, params = []) => conn.prepare(sql).all(...params),
        queryOne: (sql, params = []) => conn.prepare(sql).get(...params) || null,
        execute: (sql, params = []) => {
          const info = conn.prepare(sql).run(...params);
          return { changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
        }
      };
      return callback(trx);
    });

    return runInTransaction();
  },

  /**
   * Expose raw native connection when needed (e.g. migration script executing raw multiline DDL).
   */
  getRawConnection() {
    return getSqliteConnection();
  },

  /**
   * Closes database connection cleanly.
   */
  close() {
    if (sqliteDbInstance) {
      sqliteDbInstance.close();
      sqliteDbInstance = null;
    }
  }
};

module.exports = db;
