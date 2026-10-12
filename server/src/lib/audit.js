const { query } = require('../db');

// Records security-relevant actions. Never throws: auditing must not break the request.
async function audit(req, action, targetType = null, targetId = null, meta = {}) {
  try {
    await query(
      'INSERT INTO audit_log (actor_id, action, target_type, target_id, meta, ip) VALUES ($1,$2,$3,$4,$5,$6)',
      [req?.user?.id || null, action, targetType, targetId === null ? null : String(targetId), JSON.stringify(meta || {}), req?.clientIp || req?.ip || null]
    );
  } catch (e) {
    console.warn('[Audit] could not write entry:', e.message);
  }
}
module.exports = { audit };
