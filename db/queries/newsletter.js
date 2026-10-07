/**
 * queries/newsletter.js: Telemetry Dispatch subscription and deduplication
 */

const { getDb } = require('../connection');

function subscribe(email, source = 'web', dbInstance = null) {
  const db = dbInstance || getDb();
  const cleanEmail = (email || '').toLowerCase().trim();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Valid email address is required');
  }

  const existing = db.prepare('SELECT * FROM newsletter_subscribers WHERE email = ? COLLATE NOCASE').get(cleanEmail);

  if (existing) {
    return {
      status: 'already_subscribed',
      message: 'Email is already subscribed to Telemetry Dispatch.',
      subscriber: existing
    };
  }

  const allowedSources = ['hero', 'footer', 'cta', 'web', 'other'];
  const cleanSource = allowedSources.includes(source) ? source : 'web';

  const stmt = db.prepare(`
    INSERT INTO newsletter_subscribers (email, source)
    VALUES (?, ?)
  `);

  const result = stmt.run(cleanEmail, cleanSource);
  const subscriber = db.prepare('SELECT * FROM newsletter_subscribers WHERE id = ?').get(result.lastInsertRowid);

  return {
    status: 'subscribed',
    message: 'Successfully subscribed to Telemetry Dispatch.',
    subscriber
  };
}

module.exports = {
  subscribe
};
