const db = require('../db/database');

/**
 * Subscribe to Telemetry Dispatch newsletter.
 * Validates, de-duplicates, and returns a friendly message if already subscribed.
 */
async function subscribe(req, res, next) {
  try {
    const { email, source = 'footer' } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db.queryOne('SELECT id, subscribed_at FROM newsletter_subscribers WHERE email = ?', [normalizedEmail]);

    if (existing) {
      return res.status(200).json({
        success: true,
        already_subscribed: true,
        message: 'You are already subscribed to the Telemetry Dispatch! You will continue receiving our weekly clinical macro digests.',
        subscribed_at: existing.subscribed_at
      });
    }

    const now = new Date().toISOString();
    await db.execute(
      'INSERT INTO newsletter_subscribers (email, source, subscribed_at) VALUES (?, ?, ?)',
      [normalizedEmail, source, now]
    );

    res.status(201).json({
      success: true,
      already_subscribed: false,
      message: 'Subscription confirmed! Welcome to the ProteinTrack Telemetry Dispatch.',
      subscribed_at: now
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  subscribe
};
