module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    entity_type: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    performed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'audit_logs',
    updatedAt: false
  });

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.User, { foreignKey: 'performed_by' });
  };

  return AuditLog;
};
