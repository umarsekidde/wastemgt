const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('superadmin', 'admin', 'collector', 'customer'),
      allowNull: false,
      defaultValue: 'customer'
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    division_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'divisions', key: 'id' }
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'companies', key: 'id' },
      comment: 'Division (company) this customer is assigned to'
    },
    reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    reset_token_expires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'users',
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      }
    }
  });

  User.associate = (models) => {
    User.belongsTo(models.Division, { foreignKey: 'division_id' });
    User.belongsTo(models.Company, { foreignKey: 'company_id', as: 'CustomerDivision' });
    User.hasOne(models.Collector, { foreignKey: 'user_id' });
    User.hasOne(models.Company, { foreignKey: 'admin_id', as: 'AdminOfCompany' });
    User.hasMany(models.WasteRequest, { foreignKey: 'customer_id' });
    User.hasMany(models.Payment, { foreignKey: 'user_id' });
    User.hasMany(models.Notification, { foreignKey: 'user_id' });
    User.hasMany(models.PushSubscription, { foreignKey: 'user_id' });
    User.hasMany(models.AuditLog, { foreignKey: 'performed_by' });
    User.hasMany(models.Complaint, { foreignKey: 'user_id' });
  };

  User.prototype.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  };

  User.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.password;
    delete values.reset_token;
    delete values.reset_token_expires;
    return values;
  };

  return User;
};
