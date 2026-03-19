module.exports = (sequelize, DataTypes) => {
  const WasteRequest = sequelize.define('WasteRequest', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    status: {
      type: DataTypes.ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },
    subscription_type: {
      type: DataTypes.ENUM('monthly', 'weekly', 'on_demand'),
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    scheduled_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    scheduled_time_slot: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    assigned_collector_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'collectors', key: 'id' }
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    proof_image_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    },
    waste_category: {
      type: DataTypes.ENUM('industrial', 'commercial', 'household', 'agricultural'),
      allowNull: true
    },
    collected_weight_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    division_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'divisions', key: 'id' }
    }
  }, {
    tableName: 'waste_requests'
  });

  WasteRequest.associate = (models) => {
    WasteRequest.belongsTo(models.User, { foreignKey: 'customer_id' });
    WasteRequest.belongsTo(models.Collector, { foreignKey: 'assigned_collector_id' });
    WasteRequest.belongsTo(models.Division, { foreignKey: 'division_id' });
    WasteRequest.hasMany(models.Payment, { foreignKey: 'request_id' });
  };

  return WasteRequest;
};
