const app = require('./app');
const config = require('./config/env');
const db = require('./db/database');
const runMigrations = require('./db/migrate');
const seedDatabase = require('./db/seed');

async function startServer() {
  try {
    console.log('🚀 Initializing ProteinTrack Precision Telemetry Backend...');

    // Auto-migrate and seed if running first time
    runMigrations();
    await seedDatabase();

    const server = app.listen(config.port, () => {
      console.log(`\n======================================================`);
      console.log(`⚡ ProteinTrack Backend listening on port ${config.port}`);
      console.log(`🌐 Base API URL: http://localhost:${config.port}/api`);
      console.log(`🩺 Health Check: http://localhost:${config.port}/health`);
      console.log(`======================================================\n`);
    });

    // Graceful Shutdown
    const shutdown = () => {
      console.log('\n🛑 Gracefully shutting down server...');
      server.close(() => {
        db.close();
        console.log('💤 Database connection closed. Server exited cleanly.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    console.error('❌ Failed to start ProteinTrack server:', err);
    process.exit(1);
  }
}

startServer();
