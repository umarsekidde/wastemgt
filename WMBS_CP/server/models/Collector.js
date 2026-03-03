module.exports = (sequelize, DataTypes) => {
  const Collector = sequelize.define('Collector', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: 'users', key: 'id' }
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'id' }
    },
    truck_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('available', 'on_route', 'offline', 'on_break'),
      defaultValue: 'available'
    },
    current_lat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    current_lng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    last_location_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'collectors'
  });

  Collector.associate = (models) => {
    Collector.belongsTo(models.User, { foreignKey: 'user_id' });
    Collector.belongsTo(models.Company, { foreignKey: 'company_id' });
    Collector.hasMany(models.WasteRequest, { foreignKey: 'assigned_collector_id' });
    Collector.hasMany(models.TruckLocation, { foreignKey: 'collector_id' });
  };

  return Collector;
};
