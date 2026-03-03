module.exports = (sequelize, DataTypes) => {
  const Division = sequelize.define('Division', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'divisions'
  });

  Division.associate = (models) => {
    Division.hasMany(models.User, { foreignKey: 'division_id' });
    Division.hasMany(models.Company, { foreignKey: 'division_id' });
  };

  return Division;
};
