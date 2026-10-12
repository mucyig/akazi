const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    const unread = await query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = false', [req.user.id]);
    res.json({ notifications: result.rows, unreadCount: unread.rows[0].n });
  } catch (err) {
    console.error('Fetch notifications error:', err.message);
    res.status(500).json({ message: 'Failed to retrieve notifications.' });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Mark all read error:', err.message);
    res.status(500).json({ message: 'Failed to update notifications.' });
  }
});

// Only your own notifications can be changed
router.patch('/:id/read', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid notification.' });
    await query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Mark read error:', err.message);
    res.status(500).json({ message: 'Failed to update notification.' });
  }
});

module.exports = router;
