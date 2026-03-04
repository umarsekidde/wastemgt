const config = require('./database');
const env = process.env.NODE_ENV || 'development';
module.exports = config[env];
