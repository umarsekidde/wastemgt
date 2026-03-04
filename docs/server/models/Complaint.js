module.exports = (sequelize, DataTypes) => {
  const Complaint = sequelize.define('Complaint', {
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
    request_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'waste_requests', key: 'id' }
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('open', 'in_progress', 'resolved', 'closed'),
      defaultValue: 'open'
    },
    ticket_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true
    },
    resolution_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'complaints'
  });

  Complaint.associate = (models) => {
    Complaint.belongsTo(models.User, { foreignKey: 'user_id' });
    Complaint.belongsTo(models.WasteRequest, { foreignKey: 'request_id' });
  };

  return Complaint;
};
