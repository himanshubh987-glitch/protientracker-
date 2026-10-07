/**
 * queries/index.js: Unified exports for ProteinTrack database data-access modules
 */

const users = require('./users');
const foods = require('./foods');
const logs = require('./logs');
const supplements = require('./supplements');
const dashboard = require('./dashboard');
const newsletter = require('./newsletter');
const home = require('./home');

module.exports = {
  users,
  foods,
  logs,
  supplements,
  dashboard,
  newsletter,
  home
};
