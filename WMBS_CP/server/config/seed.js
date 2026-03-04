require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { runSeed } = require('./seedLogic');

runSeed()
  .then(() => {
    console.log('Super Admin: superadmin@wmbs.com / SuperAdmin@123');
    console.log('Seed completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
