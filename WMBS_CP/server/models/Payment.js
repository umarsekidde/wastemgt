module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('Payment', {
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
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: 'UGX'
    },
    status: {
      type: DataTypes.ENUM('pending', 'success', 'failed', 'expired', 'cancelled'),
      defaultValue: 'pending'
    },
    flutterwave_tx_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    invoice_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'payments'
  });

  Payment.associate = (models) => {
    Payment.belongsTo(models.User, { foreignKey: 'user_id' });
    Payment.belongsTo(models.WasteRequest, { foreignKey: 'request_id' });
  };

  return Payment;
};
