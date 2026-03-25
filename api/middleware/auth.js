const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

function isAdminUser(userId) {
  return ADMIN_USER_IDS.includes(String(userId || '').trim());
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ success: false, message: 'login required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { userId: payload.userId, isAdmin: isAdminUser(payload.userId) };
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'invalid or expired session' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, message: 'admin access required' });
  }
  return next();
}

module.exports = { requireAuth, requireAdmin, isAdminUser };
