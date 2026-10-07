const fs = require('fs');
const path = require('path');
const db = require('./database');

function runMigrations() {
  console.log('⚡ Starting database migration...');
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const rawConn = db.getRawConnection();
  rawConn.exec(schemaSql);

  console.log('✅ All tables, constraints, and indexes migrated successfully.');
}

if (require.main === module) {
  try {
    runMigrations();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

module.exports = runMigrations;
