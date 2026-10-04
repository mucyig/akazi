const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// 1. GET /api/notifications - User's notifications
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );

    const unreadCount = (result.rows || []).filter(n => !n.is_read).length;

    res.json({
      notifications: result.rows || [],
      unreadCount
    });
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ message: 'Failed to retrieve notifications.' });
  }
});

// 2. PATCH /api/notifications/:id/read - Mark one as read
router.patch('/:id/read', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ message: 'Failed to update notification.' });
  }
});

// 3. PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ message: 'Failed to update notifications.' });
  }
});

module.exports = router;
