module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    read_status: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'info'
    },
    link: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  }, {
    tableName: 'notifications',
    hooks: {
      afterCreate: async (notification) => {
        try {
          const pushService = require('../services/pushService');
          await pushService.sendPushForNotification(notification, sequelize.models);
        } catch (_) {}
      }
    }
  });

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return Notification;
};
