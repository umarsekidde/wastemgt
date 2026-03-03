module.exports = (sequelize, DataTypes) => {
  const Company = sequelize.define('Company', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    division_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'divisions', key: 'id' }
    },
    admin_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    contact_phone: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    contact_email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'companies'
  });

  Company.associate = (models) => {
    Company.belongsTo(models.Division, { foreignKey: 'division_id' });
    Company.belongsTo(models.User, { foreignKey: 'admin_id', as: 'Admin' });
    Company.hasMany(models.Collector, { foreignKey: 'company_id' });
    Company.hasMany(models.User, { foreignKey: 'company_id' });
  };

  return Company;
};
