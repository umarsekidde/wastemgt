require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('../models');

const divisions = [
  { name: 'Makindye', code: 'MAK', is_active: true },
  { name: 'Nakawa', code: 'NAK', is_active: true },
  { name: 'Rubaga', code: 'RUB', is_active: true },
  { name: 'Kawempe', code: 'KAW', is_active: true },
  { name: 'Central', code: 'CEN', is_active: true }
];

const subscriptionPlans = [
  { name: 'Monthly Plan', type: 'monthly', amount: 50000, collections_per_period: 4, is_active: true },
  { name: 'Weekly Plan', type: 'weekly', amount: 15000, collections_per_period: 1, is_active: true },
  { name: 'On-Demand', type: 'on_demand', amount: 20000, collections_per_period: 1, is_active: true }
];

async function seed() {
  try {
    await db.sequelize.authenticate();

    for (const d of divisions) {
      const [record] = await db.Division.findOrCreate({
        where: { code: d.code },
        defaults: { name: d.name, is_active: d.is_active }
      });
      if (record.name !== d.name || record.is_active !== d.is_active) {
        await record.update({ name: d.name, is_active: d.is_active });
      }
    }
    console.log('Divisions seeded: Makindye, Nakawa, Rubaga, Kawempe, Central.');

    const existingPlans = await db.SubscriptionPlan.count();
    if (existingPlans === 0) {
      await db.SubscriptionPlan.bulkCreate(subscriptionPlans);
      console.log('Subscription plans seeded.');
    }

    const existingSuperAdmin = await db.User.findOne({ where: { role: 'superadmin' } });
    if (!existingSuperAdmin) {
      await db.User.create({
        name: 'Super Admin',
        email: 'superadmin@wmbs.com',
        password: 'SuperAdmin@123',
        role: 'superadmin',
        phone: '+256700000000',
        is_active: true
      });
      console.log('Super Admin user created (email: superadmin@wmbs.com, password: SuperAdmin@123)');
    }

    // No default company or Fred Admin created by seed. Create admins/companies via Super Admin UI.

    const superAdminUser = await db.User.findOne({ where: { role: 'superadmin' } });
    if (superAdminUser) {
      await superAdminUser.update({ password: 'SuperAdmin@123', is_active: true });
      console.log('Super Admin password reset (email: superadmin@wmbs.com, password: SuperAdmin@123)');
    }

    console.log('Seed completed.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
