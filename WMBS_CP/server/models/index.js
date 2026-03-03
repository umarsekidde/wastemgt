const { Sequelize } = require('sequelize');
const config = require('../config');
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config;

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port || 3306,
    dialect: dbConfig.dialect || 'mysql',
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    define: {
      timestamps: true,
      underscored: true,
      ...dbConfig.define
    }
  }
);

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
