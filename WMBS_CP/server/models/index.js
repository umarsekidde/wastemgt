const { Sequelize } = require('sequelize');
const config = require('../config');
const path = require('path');

const env = process.env.NODE_ENV || 'development';

let sequelize;

// If we are on Render, use the DATABASE_URL environment variable
if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // This is required for Render's free tier
      }
    },
    define: {
      timestamps: true,
      underscored: true
    }
  });
} else {
  // Otherwise, use your local MySQL settings
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
      host: config.host,
      port: config.port || 3306,
      dialect: config.dialect || 'mysql',
      logging: config.logging,
      pool: config.pool,
      define: {
        timestamps: true,
        underscored: true,
        ...config.define
      }
    }
  );
}

const db = {};

const modelFiles = [
  'User',
  'Division',
  'Company',
  'Collector',
  'WasteRequest',
  'Payment',
  'TruckLocation',
  'Notification',
  'PushSubscription',
  'AuditLog',
  'SubscriptionPlan',
  'Complaint',
  'Broadcast'
];

modelFiles.forEach((file) => {
  const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
  db[model.name] = model;
});

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
