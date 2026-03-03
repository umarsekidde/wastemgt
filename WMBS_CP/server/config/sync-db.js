require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const db = require('../models');

const env = process.env.NODE_ENV || 'development';
const config = require('./database')[env] || require('./database').development;
const dbName = config.database || process.env.DB_NAME || 'wmbs_db';

async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: config.host || '127.0.0.1',
    port: config.port || 3306,
    user: config.username || process.env.DB_USER || 'root',
    password: config.password || process.env.DB_PASSWORD || ''
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();
  console.log(`Database '${dbName}' ready.`);
}

async function sync() {
  try {
    await ensureDatabase();
    await db.sequelize.authenticate();
    console.log('Database connection established.');
    await db.sequelize.sync({ alter: process.env.DB_ALTER === 'true' });
    console.log('Database synced successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Unable to sync database:', err.message);
    process.exit(1);
  }
}

sync();
