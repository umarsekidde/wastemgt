module.exports = (sequelize, DataTypes) => {
  const TruckLocation = sequelize.define('TruckLocation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    collector_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'collectors', key: 'id' }
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false
    },
    speed: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0
    },
    heading: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    }
  }, {
    tableName: 'truck_locations',
    updatedAt: false,
    createdAt: true
  });

  TruckLocation.associate = (models) => {
    TruckLocation.belongsTo(models.Collector, { foreignKey: 'collector_id' });
  };

  return TruckLocation;
};
