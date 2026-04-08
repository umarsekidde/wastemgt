const db = require('../models');
const { Op } = require('sequelize');

exports.latestForCurrentUser = async (req, res) => {
  try {
    const afterId = parseInt(req.query.afterId, 10) || 0;
    const notifications = await db.Notification.findAll({
      where: {
        user_id: req.user.id,
        id: { [Op.gt]: afterId }
      },
      attributes: ['id', 'title', 'message', 'type', 'link', 'created_at'],
      order: [['id', 'ASC']],
      limit: 20
    });

    return res.json({
      success: true,
      notifications
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Unable to load notifications' });
  }
};
