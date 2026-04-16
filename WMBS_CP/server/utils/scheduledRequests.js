const db = require('../models');
const { Op } = require('sequelize');

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

async function ensureScheduleReadyNotification(userId, requestId, title, message, link) {
  const exists = await db.Notification.findOne({
    where: {
      user_id: userId,
      type: 'schedule_ready',
      message: { [Op.like]: `%#${requestId}%` }
    },
    attributes: ['id']
  });
  if (exists) return false;
  await db.Notification.create({
    user_id: userId,
    title,
    message,
    type: 'schedule_ready',
    link
  });
  return true;
}

async function notifyDueScheduledRequests(scope) {
  const where = {
    status: 'pending',
    scheduled_date: { [Op.ne]: null, [Op.lte]: todayIso() }
  };
  if (scope && scope.customerId) where.customer_id = scope.customerId;
  if (scope && scope.divisionId) where.division_id = scope.divisionId;

  const requests = await db.WasteRequest.findAll({
    where,
    attributes: ['id', 'customer_id', 'division_id']
  });
  if (!requests.length) return 0;

  const divisionIds = [...new Set(requests.map((r) => r.division_id).filter(Boolean))];
  const companies = divisionIds.length
    ? await db.Company.findAll({
        where: { division_id: { [Op.in]: divisionIds }, is_active: true },
        attributes: ['division_id', 'admin_id']
      })
    : [];
  const adminByDivision = companies.reduce((acc, c) => {
    if (c.admin_id && acc[c.division_id] == null) acc[c.division_id] = c.admin_id;
    return acc;
  }, {});

  let created = 0;
  for (const req of requests) {
    const customerCreated = await ensureScheduleReadyNotification(
      req.customer_id,
      req.id,
      'Request is now active',
      `Your scheduled request #${req.id} is now active and ready for assignment.`,
      '/customer/my-requests'
    );
    if (customerCreated) created += 1;

    const adminId = adminByDivision[req.division_id];
    if (adminId) {
      const adminCreated = await ensureScheduleReadyNotification(
        adminId,
        req.id,
        'Scheduled request now active',
        `Scheduled request #${req.id} has reached its date and is now ready for collector assignment.`,
        '/admin/requests'
      );
      if (adminCreated) created += 1;
    }
  }
  return created;
}

module.exports = { notifyDueScheduledRequests };
const db = require('../models');
const { Op } = require('sequelize');

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

async function ensureScheduleReadyNotification(userId, requestId, title, message, link) {
  const exists = await db.Notification.findOne({
    where: {
      user_id: userId,
      type: 'schedule_ready',
      message: { [Op.like]: `%#${requestId}%` }
    },
    attributes: ['id']
  });
  if (exists) return false;
  await db.Notification.create({
    user_id: userId,
    title,
    message,
    type: 'schedule_ready',
    link
  });
  return true;
}

async function notifyDueScheduledRequests(scope) {
  const where = {
    status: 'pending',
    scheduled_date: { [Op.ne]: null, [Op.lte]: todayIso() }
  };
  if (scope && scope.customerId) where.customer_id = scope.customerId;
  if (scope && scope.divisionId) where.division_id = scope.divisionId;

  const requests = await db.WasteRequest.findAll({
    where,
    attributes: ['id', 'customer_id', 'division_id']
  });
  if (!requests.length) return 0;

  const divisionIds = [...new Set(requests.map((r) => r.division_id).filter(Boolean))];
  const companies = divisionIds.length
    ? await db.Company.findAll({
        where: { division_id: { [Op.in]: divisionIds }, is_active: true },
        attributes: ['division_id', 'admin_id']
      })
    : [];
  const adminByDivision = companies.reduce((acc, c) => {
    if (c.admin_id && acc[c.division_id] == null) acc[c.division_id] = c.admin_id;
    return acc;
  }, {});

  let created = 0;
  for (const req of requests) {
    const customerCreated = await ensureScheduleReadyNotification(
      req.customer_id,
      req.id,
      'Request is now active',
      `Your scheduled request #${req.id} is now active and ready for assignment.`,
      '/customer/my-requests'
    );
    if (customerCreated) created += 1;

    const adminId = adminByDivision[req.division_id];
    if (adminId) {
      const adminCreated = await ensureScheduleReadyNotification(
        adminId,
        req.id,
        'Scheduled request now active',
        `Scheduled request #${req.id} has reached its date and is now ready for collector assignment.`,
        '/admin/requests'
      );
      if (adminCreated) created += 1;
    }
  }
  return created;
}

module.exports = { notifyDueScheduledRequests };
