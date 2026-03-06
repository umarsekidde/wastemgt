const db = require('../models');
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getMonthExpr } = require('../utils/dbHelpers');

exports.dashboard = async (req, res) => {
  try {
    const { expr: monthExpr, group: monthGroup } = getMonthExpr(db.sequelize, 'created_at');
    const [userCount, companyCount, divisions, revenueResult] = await Promise.all([
      db.User.count(),
      db.Company.count(),
      db.Division.findAll({ where: { is_active: true }, order: [['name']] }),
      db.Payment.findAll({
        where: { status: 'success' },
        attributes: [[db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total'], [monthExpr, 'month']],
        group: [monthGroup],
        raw: true
      })
    ]);

    const monthlyRevenue = revenueResult.reduce((acc, r) => {
      acc[r.month] = parseFloat(r.total) || 0;
      return acc;
    }, {});

    const collectorsWithLocation = await db.Collector.findAll({
      where: { current_lat: { [Op.not]: null } },
      include: [
        { model: db.User, as: 'User', attributes: ['name', 'email'] },
        { model: db.Company, as: 'Company', include: [{ model: db.Division, as: 'Division' }] }
      ]
    });

    const trucks = collectorsWithLocation.map((c) => ({
      id: c.id,
      current_lat: c.current_lat,
      current_lng: c.current_lng,
      User: c.User ? c.User.toJSON() : null,
      truck_number: c.truck_number,
      Company: c.Company
    }));

    res.render('superadmin/dashboard', {
      title: 'Super Admin Dashboard',
      userCount,
      companyCount,
      divisions,
      monthlyRevenue,
      trucks
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { title: 'Error' });
  }
};

exports.divisions = async (req, res) => {
  const divisions = await db.Division.findAll({ order: [['name']] });
  res.render('superadmin/divisions', { title: 'Manage Divisions', divisions });
};

exports.createDivision = async (req, res) => {
  try {
    await db.Division.create(req.body);
    await db.AuditLog.create({ action: 'DIVISION_CREATE', entity_type: 'Division', performed_by: req.user.id });
    if (req.xhr) return res.json({ success: true });
    res.redirect('/superadmin/divisions');
  } catch (err) {
    if (req.xhr) return res.status(400).json({ success: false, message: err.message });
    res.redirect('/superadmin/divisions');
  }
};

exports.updateDivision = async (req, res) => {
  try {
    await db.Division.update(req.body, { where: { id: req.params.id } });
    await db.AuditLog.create({ action: 'DIVISION_UPDATE', entity_type: 'Division', entity_id: req.params.id, performed_by: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.companies = async (req, res) => {
  const companies = await db.Company.findAll({
    include: [
      { model: db.Division, as: 'Division' },
      { model: db.User, as: 'Admin', attributes: ['id', 'name', 'email'] }
    ],
    order: [['name']]
  });
  const divisions = await db.Division.findAll({ where: { is_active: true } });
  const admins = await db.User.findAll({ where: { role: 'admin' }, attributes: ['id', 'name', 'email'] });
  res.render('superadmin/companies', { title: 'Manage Companies', companies, divisions, admins });
};

exports.createCompany = async (req, res) => {
  try {
    const { name, division_id, admin_id, contact_phone, contact_email } = req.body;
    await db.Company.create({
      name,
      division_id,
      admin_id: admin_id && admin_id !== '' ? admin_id : null,
      contact_phone: contact_phone || null,
      contact_email: contact_email || null
    });
    await db.AuditLog.create({ action: 'COMPANY_CREATE', entity_type: 'Company', performed_by: req.user.id });
    res.redirect('/superadmin/companies');
  } catch (err) {
    console.error(err);
    res.redirect('/superadmin/companies');
  }
};

exports.updateCompany = async (req, res) => {
  try {
    await db.Company.update(req.body, { where: { id: req.params.id } });
    await db.AuditLog.create({ action: 'COMPANY_UPDATE', entity_type: 'Company', entity_id: req.params.id, performed_by: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.customers = async (req, res) => {
  const customers = await db.User.findAll({
    where: { role: 'customer' },
    attributes: ['id', 'name', 'email', 'phone', 'address', 'created_at'],
    include: [
      { model: db.Division, as: 'Division', attributes: ['id', 'name'] },
      { model: db.Company, as: 'CustomerDivision', attributes: ['id', 'name'] }
    ],
    order: [['name']]
  });
  res.render('superadmin/customers', { title: 'All Customers', customers });
};

exports.systemAdmins = async (req, res) => {
  const [users, divisions] = await Promise.all([
    db.User.findAll({
      where: { role: { [Op.in]: ['admin', 'collector'] } },
      include: [
        { model: db.Division, as: 'Division' },
        { model: db.Collector, as: 'Collector', include: [{ model: db.Company, as: 'Company', attributes: ['name'] }] },
        { model: db.Company, as: 'AdminOfCompany', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    }),
    db.Division.findAll({ where: { is_active: true }, order: [['name']] })
  ]);
  res.render('superadmin/admins', { title: 'Admins & Collectors', admins: users, divisions, query: req.query });
};

exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password, role, division_id, truck_number } = req.body;
    if (!role || (role !== 'admin' && role !== 'collector')) {
      return res.redirect('/superadmin/admins?error=select_role');
    }
    const allowedRole = role === 'collector' ? 'collector' : 'admin';
    const divId = division_id != null && division_id !== '' ? parseInt(division_id, 10) : NaN;
    if (!divId || isNaN(divId)) {
      return res.redirect('/superadmin/admins?error=company_required');
    }
    let company = await db.Company.findOne({ where: { division_id: divId, is_active: true } });
    if (!company) {
      const division = await db.Division.findByPk(divId);
      company = await db.Company.create({
        name: division ? division.name + ' Division' : 'Division ' + divId,
        division_id: divId,
        is_active: true
      });
    }
    const emailTrim = (email || '').toLowerCase().trim();
    if (!emailTrim) return res.redirect('/superadmin/admins?error=company_required');
    const pass = password != null ? String(password) : '';
    if (!pass || pass.length < 8) return res.redirect('/superadmin/admins?error=password_short');
    const existingUser = await db.User.findOne({ where: { email: emailTrim } });
    if (existingUser) {
      return res.redirect('/superadmin/admins?error=email_exists');
    }
    const user = await db.User.create({
      name: (name || '').trim(),
      email: emailTrim,
      password: pass,
      role: allowedRole,
      division_id: divId,
      is_active: true
    });
    if (allowedRole === 'collector') {
      await db.Collector.create({
        user_id: user.id,
        company_id: company.id,
        truck_number: (truck_number || '').trim() || null
      });
    } else {
      await db.Company.update(
        { admin_id: user.id },
        { where: { id: company.id } }
      );
    }
    await db.AuditLog.create({ action: allowedRole === 'collector' ? 'COLLECTOR_CREATE' : 'ADMIN_CREATE', entity_type: 'User', entity_id: user.id, performed_by: req.user.id });
    res.redirect('/superadmin/admins?success=1');
  } catch (err) {
    console.error('createAdmin error:', err);
    const msg = err.name === 'SequelizeUniqueConstraintError' ? 'email_exists' : 'create_failed';
    res.redirect('/superadmin/admins?error=' + msg);
  }
};

exports.broadcast = async (req, res) => {
  const divisions = await db.Division.findAll({ where: { is_active: true } });
  res.render('superadmin/broadcast', { title: 'Broadcast Notification', divisions, query: req.query });
};

exports.postBroadcast = async (req, res) => {
  try {
    const { title, message, division_id, target_roles } = req.body;
    const divId = division_id && String(division_id).trim() !== '' ? parseInt(division_id, 10) : null;
    const roles = target_roles == null ? null : Array.isArray(target_roles) ? target_roles : [target_roles];

    await db.Broadcast.create({ title, message, division_id: divId, created_by: req.user.id, target_roles: roles });

    const where = {};
    if (divId) where.division_id = divId;
    if (roles && roles.length) where.role = { [Op.in]: roles };

    const users = await db.User.findAll({ where: { is_active: true, ...where }, attributes: ['id'] });
    if (users.length) {
      await db.Notification.bulkCreate(users.map((u) => ({ user_id: u.id, title, message, type: 'broadcast' })));
    }
    await db.AuditLog.create({ action: 'BROADCAST', performed_by: req.user.id });
    if (req.xhr) return res.json({ success: true });
    res.redirect('/superadmin/broadcast?success=1');
  } catch (err) {
    console.error('postBroadcast error:', err);
    if (req.xhr) return res.status(400).json({ success: false, message: err.message });
    res.redirect('/superadmin/broadcast?error=1');
  }
};

exports.auditLogs = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;
  const dateFrom = req.query.date_from ? String(req.query.date_from).trim() : null;
  const dateTo = req.query.date_to ? String(req.query.date_to).trim() : null;
  const actionFilter = req.query.action ? String(req.query.action).trim() : null;

  const where = {};
  if (actionFilter) where.action = actionFilter;
  if (dateFrom) {
    const start = new Date(dateFrom);
    start.setHours(0, 0, 0, 0);
    where.created_at = where.created_at || {};
    where.created_at[Op.gte] = start;
  }
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    where.created_at = where.created_at || {};
    where.created_at[Op.lte] = end;
  }

  const { count, rows } = await db.AuditLog.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    include: [{ model: db.User, as: 'User', attributes: ['name', 'email', 'role'] }]
  });
  const totalPages = Math.ceil(count / limit);
  const actionRows = await db.AuditLog.findAll({ attributes: ['action'], group: ['action'], raw: true });
  const distinctActions = actionRows.map((x) => x.action).filter(Boolean).sort();
  const q = { ...req.query };
  const prevUrl = totalPages > 1 && page > 1 ? '/superadmin/audit-logs?' + new URLSearchParams({ ...q, page: String(page - 1) }).toString() : null;
  const nextUrl = totalPages > 1 && page < totalPages ? '/superadmin/audit-logs?' + new URLSearchParams({ ...q, page: String(page + 1) }).toString() : null;
  res.render('superadmin/audit-logs', {
    title: 'Audit Logs',
    logs: rows,
    total: count,
    page,
    totalPages,
    date_from: dateFrom,
    date_to: dateTo,
    action_filter: actionFilter,
    distinctActions,
    query: req.query,
    prevUrl,
    nextUrl
  });
};

exports.exportReports = async (req, res) => {
  const format = req.query.format || 'csv';
  const type = req.query.type || 'payments';

  if (type === 'payments') {
    const payments = await db.Payment.findAll({
      include: [{ model: db.User, as: 'User', attributes: ['name', 'email'] }, { model: db.WasteRequest, as: 'WasteRequest', attributes: ['id'] }],
      order: [['created_at', 'DESC']],
      limit: 5000
    });

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=payments-report.pdf');
      const doc = new PDFDocument();
      doc.pipe(res);
      doc.fontSize(18).text('Payments Report', 50, 50);
      doc.fontSize(10);
      let y = 80;
      payments.forEach((p) => {
        doc.text(`${p.created_at.toISOString().split('T')[0]} | ${p.User?.name} | ${p.amount} UGX | ${p.status}`, 50, y);
        y += 20;
      });
      doc.end();
      return;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payments-report.csv');
    const header = 'Date,User,Amount,Status,Invoice\n';
    const rows = payments.map((p) => `${p.created_at.toISOString().split('T')[0]},${p.User?.name || ''},${p.amount},${p.status},${p.invoice_number || ''}\n`).join('');
    res.send(header + rows);
    return;
  }

  res.status(400).send('Invalid report type');
};

exports.settings = async (req, res) => {
  res.render('superadmin/settings', { title: 'System Settings' });
};

exports.getTruckLocations = async (req, res) => {
  const divisionId = req.query.division_id;
  const where = { current_lat: { [Op.not]: null }, current_lng: { [Op.not]: null } };
  const collectors = await db.Collector.findAll({
    where,
    include: [
      { model: db.User, as: 'User', attributes: ['name', 'email'] },
      { model: db.Company, as: 'Company', include: [{ model: db.Division, as: 'Division' }] }
    ]
  });
  let filtered = collectors;
  if (divisionId) {
    filtered = collectors.filter((c) => c.Company?.division_id === parseInt(divisionId, 10));
  }
  res.json({
    success: true,
    trucks: filtered.map((c) => ({
      id: c.id,
      userId: c.user_id,
      name: c.User?.name,
      truckNumber: c.truck_number,
      lat: parseFloat(c.current_lat),
      lng: parseFloat(c.current_lng),
      lastUpdate: c.last_location_at,
      division: c.Company?.Division?.name,
      status: c.status
    }))
  });
};
