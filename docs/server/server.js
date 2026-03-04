require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const app = require('./app');
const db = require('./models');

const PORT = process.env.PORT || 3000;

db.sequelize.authenticate()
  .then(() => {
    console.log('Database connected.');
    return app.listen(PORT);
  })
  .then(() => console.log(`WMBS server running on port ${PORT}`))
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
