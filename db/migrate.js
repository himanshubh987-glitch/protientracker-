/**
 * migrate.js: Executes pending SQL migrations in sequential order
 * Tracks applied migrations in the schema_migrations table
 */

const fs = require('fs');
const path = require('path');
const { getDb } = require('./connection');

function runMigrations(dbInstance = null) {
  const db = dbInstance || getDb();
  const migrationsDir = path.resolve(__dirname, 'migrations');

  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const getAppliedStmt = db.prepare('SELECT version FROM schema_migrations WHERE version = ?');
  const insertMigrationStmt = db.prepare('INSERT INTO schema_migrations (version) VALUES (?)');

  let appliedCount = 0;

  for (const file of files) {
    const isApplied = getAppliedStmt.get(file);
    if (!isApplied) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Execute migration within an atomic transaction
      const applyMigration = db.transaction(() => {
        db.exec(sql);
        insertMigrationStmt.run(file);
      });

      applyMigration();
      console.log(`✓ Migration applied: ${file}`);
      appliedCount++;
    } else {
      console.log(`- Migration already applied: ${file}`);
    }
  }

  if (appliedCount === 0) {
    console.log('Database is up to date. No pending migrations.');
  } else {
    console.log(`Successfully applied ${appliedCount} migration(s).`);
  }

  return appliedCount;
}

// Allow direct CLI execution
if (require.main === module) {
  try {
    runMigrations();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

module.exports = { runMigrations };
