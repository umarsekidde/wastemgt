const db = require('../models');
const { Op } = require('sequelize');
const { getMonthExpr } = require('../utils/dbHelpers');
const { notifyDueScheduledRequests } = require('../utils/scheduledRequests');

function parseComplaintThread(resolutionNotes) {
  if (!resolutionNotes) return [];
  try {
    const parsed = JSON.parse(resolutionNotes);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.message && item.by);
  } catch (_) {
    return [];
  }
}

function serializeComplaintThread(thread) {
  return JSON.stringify(thread || []);
}

exports.dashboard = async (req, res) => {
  try {
    const company = await db.Company.findOne({ where: { admin_id: req.user.id }, include: [{ model: db.Division, as: 'Division' }] });
    if (!company) return res.status(403).render('errors/403', { title: 'No company assigned' });
    await notifyDueScheduledRequests({ divisionId: company.division_id });

    const [collectors, requests, revenueResult, collectorsWithLocation, customers] = await Promise.all([
      db.Collector.findAll({
        where: { company_id: company.id },
        include: [{ model: db.User, as: 'User', attributes: ['id', 'name', 'email', 'phone'] }]
      }),
      db.WasteRequest.findAll({
        where: { assigned_collector_id: { [Op.in]: (await db.Collector.findAll({ where: { company_id: company.id }, attributes: ['id'] })).map((c) => c.id) } },
        include: [{ model: db.User, as: 'User', attributes: ['name', 'email'] }],
        order: [['scheduled_date', 'DESC']],
        limit: 20
      }),
      (async () => {
        const cIds = (await db.Collector.findAll({ where: { company_id: company.id }, attributes: ['id'] })).map((c) => c.id);
        const reqIds = (await db.WasteRequest.findAll({ where: { assigned_collector_id: { [Op.in]: cIds } }, attributes: ['id'] })).map((r) => r.id);
        if (reqIds.length === 0) return [];
        const { expr: monthExpr, group: monthGroup } = getMonthExpr(db.sequelize, 'Payment.created_at');
        return db.Payment.findAll({
          where: { status: 'success', request_id: { [Op.in]: reqIds } },
          attributes: [[db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total'], [monthExpr, 'month']],
          group: [monthGroup],
          raw: true
        });
      })(),
      db.Collector.findAll({
        where: { company_id: company.id, current_lat: { [Op.not]: null } },
        include: [{ model: db.User, as: 'User', attributes: ['name'] }]
      }),
      db.User.findAll({
        where: { role: 'customer', division_id: company.division_id },
        attributes: ['id']
      })
    ]);

    const monthlyRevenue = revenueResult.reduce((acc, r) => { acc[r.month] = parseFloat(r.total) || 0; return acc; }, {});

    res.render('admin/dashboard', {
      title: 'Company Admin Dashboard',
      company,
      collectors,
      requests,
      monthlyRevenue,
      trucks: collectorsWithLocation,
      customers
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { title: 'Error' });
  }
};

exports.collectors = async (req, res) => {
  const company = await db.Company.findOne({ where: { admin_id: req.user.id } });
  if (!company) return res.redirect('/admin');
  const collectors = await db.Collector.findAll({
    where: { company_id: company.id },
    include: [{ model: db.User, as: 'User', attributes: ['id', 'name', 'email', 'phone'] }]
  });
  res.render('admin/collectors', { title: 'Manage Collectors', collectors, company });
};

exports.addCollector = async (req, res) => {
  try {
    const company = await db.Company.findOne({ where: { admin_id: req.user.id } });
    if (!company) return res.status(403).json({ success: false, message: 'No company' });
    const { name, email, password, truck_number } = req.body;
    const existing = await db.User.findOne({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(400).json({ success: false, message: 'Email already exists' });
    const user = await db.User.create({ name, email: email.toLowerCase(), password, role: 'collector' });
    await db.Collector.create({ user_id: user.id, company_id: company.id, truck_number: truck_number || null });
    res.redirect('/admin/collectors');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/collectors');
  }
};

exports.assignCollector = async (req, res) => {
  try {
    const { requestId, collectorId } = req.body;
    const company = await db.Company.findOne({ where: { admin_id: req.user.id } });
    if (!company) return res.status(403).json({ success: false, message: 'No company assigned' });
    const collector = await db.Collector.findOne({ where: { id: collectorId, company_id: company.id } });
    if (!collector) return res.status(403).json({ success: false, message: 'Collector not in your company' });
    const wasteRequest = await db.WasteRequest.findByPk(requestId, { attributes: ['address', 'scheduled_date', 'status'] });
    if (!wasteRequest) return res.status(404).json({ success: false, message: 'Request not found' });
    const today = new Date().toISOString().split('T')[0];
    if (wasteRequest.scheduled_date && wasteRequest.scheduled_date > today) {
      return res.status(400).json({ success: false, message: `This request is scheduled for ${wasteRequest.scheduled_date} and cannot be assigned yet.` });
    }
    await db.WasteRequest.update(
      { status: 'assigned', assigned_collector_id: collectorId },
      { where: { id: requestId } }
    );
    await db.Notification.create({
      user_id: collector.user_id,
      title: 'New assignment',
      message: `You have been assigned waste request #${requestId}${wasteRequest?.address ? ': ' + wasteRequest.address : ''}. Check your dashboard.`,
      type: 'assignment',
      link: '/collector'
    });
    const emailService = require('../services/emailService');
    const collectorUser = await db.User.findByPk(collector.user_id, { attributes: ['email'] });
    if (collectorUser?.email) {
      emailService.sendAssignmentToCollector(collectorUser.email, requestId, wasteRequest?.address).catch(() => {});
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.requests = async (req, res) => {
  const company = await db.Company.findOne({ where: { admin_id: req.user.id } });
  if (!company) {
    return res.render('admin/requests', { title: 'Collection Requests', requests: [], collectors: [] });
  }
  await notifyDueScheduledRequests({ divisionId: company.division_id });
  const collectorIds = (await db.Collector.findAll({ where: { company_id: company.id }, attributes: ['id'] })).map((c) => c.id);
  const requests = await db.WasteRequest.findAll({
    where: {
      division_id: company.division_id,
      [Op.or]: [
        { assigned_collector_id: { [Op.in]: collectorIds } },
        { status: 'pending' }
      ]
    },
    include: [
      { model: db.User, as: 'User', attributes: ['id', 'name', 'email', 'phone', 'address'] },
      { model: db.Collector, as: 'Collector', include: [{ model: db.User, as: 'User', attributes: ['name'] }] },
      { model: db.Division, as: 'Division' }
    ],
    order: [['scheduled_date', 'DESC'], ['created_at', 'DESC']]
  });
  const collectors = await db.Collector.findAll({ where: { company_id: company.id }, include: [{ model: db.User, as: 'User', attributes: ['name'] }] });
  res.render('admin/requests', { title: 'Collection Requests', requests, collectors });
};

exports.approveRequest = async (req, res) => {
  try {
    const company = await db.Company.findOne({ where: { admin_id: req.user.id } });
    const collectorIds = (await db.Collector.findAll({ where: { company_id: company.id }, attributes: ['id'] })).map((c) => c.id);
    const reqRecord = await db.WasteRequest.findByPk(req.params.id);
    if (!reqRecord || !collectorIds.includes(reqRecord.assigned_collector_id)) return res.status(403).json({ success: false });
    const today = new Date().toISOString().split('T')[0];
    if (reqRecord.scheduled_date && reqRecord.scheduled_date > today) {
      return res.status(400).json({ success: false, message: `This request is scheduled for ${reqRecord.scheduled_date} and cannot be activated yet.` });
    }
    await reqRecord.update({ status: 'assigned' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getTruckLocations = async (req, res) => {
  const company = await db.Company.findOne({ where: { admin_id: req.user.id } });
  if (!company) return res.json({ success: true, trucks: [], pickups: [] });

  const collectorIds = (await db.Collector.findAll({ where: { company_id: company.id }, attributes: ['id'] })).map((c) => c.id);

  const today = new Date().toISOString().split('T')[0];
  const [collectors, pickups] = await Promise.all([
    db.Collector.findAll({
      where: { company_id: company.id, current_lat: { [Op.not]: null } },
      include: [{ model: db.User, as: 'User', attributes: ['name'] }]
    }),
    db.WasteRequest.findAll({
      where: {
        division_id: company.division_id,
        [Op.or]: [
          { status: { [Op.in]: ['assigned', 'in_progress'] } },
          { status: 'pending', [Op.or]: [{ scheduled_date: null }, { scheduled_date: { [Op.lte]: today } }] }
        ],
        latitude: { [Op.not]: null },
        longitude: { [Op.not]: null }
      },
      include: [{ model: db.User, as: 'User', attributes: ['name'] }],
      order: [['scheduled_date', 'DESC']],
      limit: 200
    })
  ]);

  res.json({
    success: true,
    trucks: collectors.map((c) => ({
      id: c.id,
      name: c.User?.name,
      truckNumber: c.truck_number,
      lat: parseFloat(c.current_lat),
      lng: parseFloat(c.current_lng),
      lastUpdate: c.last_location_at,
      status: c.status
    })),
    pickups: pickups.map((p) => ({
      id: p.id,
      lat: parseFloat(p.latitude),
      lng: parseFloat(p.longitude),
      address: p.address,
      customerName: p.User?.name || 'Customer',
      status: p.status
    }))
  });
};

exports.revenue = async (req, res) => {
  const company = await db.Company.findOne({ where: { admin_id: req.user.id } });
  const collectorIds = (await db.Collector.findAll({ where: { company_id: company?.id }, attributes: ['id'] })).map((c) => c.id);
  const requestIds = (await db.WasteRequest.findAll({ where: { assigned_collector_id: { [Op.in]: collectorIds } }, attributes: ['id'] })).map((r) => r.id);
  const payments = await db.Payment.findAll({
    where: { status: 'success', request_id: { [Op.in]: requestIds } },
    include: [{ model: db.WasteRequest, as: 'WasteRequest' }, { model: db.User, as: 'User', attributes: ['name'] }],
    order: [['created_at', 'DESC']]
  });
  res.render('admin/revenue', { title: 'Revenue & Reconciliation', payments });
};

exports.customers = async (req, res) => {
  const company = await db.Company.findOne({ where: { admin_id: req.user.id } });
  if (!company) return res.redirect('/admin');
  const customers = await db.User.findAll({
    where: { role: 'customer', division_id: company.division_id },
    attributes: ['id', 'name', 'email', 'phone', 'address', 'created_at'],
    include: [
      { model: db.Division, as: 'Division', attributes: ['name'] },
      { model: db.Company, as: 'CustomerDivision', attributes: ['id', 'name'] }
    ],
    order: [['name']]
  });
  res.render('admin/customers', { title: 'Customers', customers });
};

exports.complaints = async (req, res) => {
  const company = await db.Company.findOne({ where: { admin_id: req.user.id } });
  if (!company) return res.render('admin/complaints', { title: 'Customer Complaints', complaints: [] });

  const customers = await db.User.findAll({
    where: { role: 'customer', division_id: company.division_id },
    attributes: ['id']
  });
  const customerIds = customers.map((c) => c.id);
  const complaints = customerIds.length
    ? await db.Complaint.findAll({
        where: { user_id: customerIds },
        include: [
          { model: db.User, as: 'User', attributes: ['id', 'name', 'email'] },
          { model: db.WasteRequest, as: 'WasteRequest', attributes: ['id', 'address'] }
        ],
        order: [['created_at', 'DESC']]
      })
    : [];

  const normalized = complaints.map((co) => {
    const json = co.toJSON();
    return {
      ...json,
      thread: parseComplaintThread(json.resolution_notes)
    };
  });

  res.render('admin/complaints', { title: 'Customer Complaints', complaints: normalized });
};

exports.replyComplaint = async (req, res) => {
  try {
    const company = await db.Company.findOne({ where: { admin_id: req.user.id } });
    if (!company) return res.status(403).json({ success: false, message: 'No company assigned' });

    const complaint = await db.Complaint.findByPk(req.params.id, {
      include: [{ model: db.User, as: 'User', attributes: ['id', 'division_id'] }]
    });
    if (!complaint || !complaint.User || complaint.User.division_id !== company.division_id) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const message = String(req.body.message || '').trim();
    const status = String(req.body.status || '').trim();
    const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!message) return res.status(400).json({ success: false, message: 'Reply message is required' });
    if (status && !allowedStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid complaint status' });

    const thread = parseComplaintThread(complaint.resolution_notes);
    thread.push({
      by: 'admin',
      name: req.user.name || 'Admin',
      message,
      createdAt: new Date().toISOString()
    });

    await complaint.update({
      resolution_notes: serializeComplaintThread(thread),
      ...(status ? { status } : {})
    });

    await db.Notification.create({
      user_id: complaint.user_id,
      title: 'Complaint response',
      message: `Admin replied to your complaint #${complaint.ticket_number || complaint.id}: ${message}`,
      type: 'complaint',
      link: '/customer/complaints'
    }).catch(() => {});

    return res.json({ success: true, message: 'Reply sent' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Unable to send reply' });
  }
};

exports.performance = async (req, res) => {
  const company = await db.Company.findOne({ where: { admin_id: req.user.id } });
  const collectors = await db.Collector.findAll({
    where: { company_id: company?.id },
    include: [{ model: db.User, as: 'User', attributes: ['name'] }]
  });
  const stats = await Promise.all(collectors.map(async (c) => {
    const completed = await db.WasteRequest.count({ where: { assigned_collector_id: c.id, status: 'completed' } });
    const total = await db.WasteRequest.count({ where: { assigned_collector_id: c.id } });
    return { collector: c, completed, total, rate: total ? (completed / total * 100).toFixed(1) : 0 };
  }));
  res.render('admin/performance', { title: 'Collector Performance', stats });
};

exports.generateInvoice = async (req, res) => {
  try {
    const payment = await db.Payment.findByPk(req.params.id, { include: [{ model: db.User, as: 'User' }, { model: db.WasteRequest, as: 'WasteRequest' }] });
    if (!payment) return res.status(404).json({ success: false });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${payment.invoice_number || payment.id}.pdf`);
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    doc.pipe(res);
    doc.fontSize(18).text('INVOICE', 50, 50);
    doc.fontSize(10).text(`Invoice #: ${payment.invoice_number || payment.id}`, 50, 80);
    doc.text(`Date: ${payment.created_at.toISOString().split('T')[0]}`, 50, 95);
    doc.text(`Customer: ${payment.User?.name}`, 50, 110);
    doc.text(`Amount: ${payment.amount} ${payment.currency || 'UGX'}`, 50, 125);
    doc.text(`Status: ${payment.status}`, 50, 140);
    doc.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
