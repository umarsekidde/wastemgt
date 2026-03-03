module.exports = (sequelize, DataTypes) => {
  const Broadcast = sequelize.define('Broadcast', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    division_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'divisions', key: 'id' }
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    target_roles: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of role names e.g. ["customer","collector"]'
    }
  }, {
    tableName: 'broadcasts'
  });

  Broadcast.associate = (models) => {
    Broadcast.belongsTo(models.Division, { foreignKey: 'division_id' });
    Broadcast.belongsTo(models.User, { foreignKey: 'created_by' });
  };

  return Broadcast;
};
