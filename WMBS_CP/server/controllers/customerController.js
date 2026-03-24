const db = require('../models');
const { Op } = require('sequelize');
const { geocodeAddress } = require('../utils/geocode');

exports.dashboard = async (req, res) => {
  try {
    const [requests, payments, notifications, plans] = await Promise.all([
      db.WasteRequest.findAll({
        where: { customer_id: req.user.id },
        include: [{ model: db.Collector, as: 'Collector', include: [{ model: db.User, as: 'User', attributes: ['name', 'phone'] }] }],
        order: [['scheduled_date', 'DESC'], ['created_at', 'DESC']],
        limit: 10
      }),
      db.Payment.findAll({ where: { user_id: req.user.id }, order: [['created_at', 'DESC']], limit: 10 }),
      db.Notification.findAll({ where: { user_id: req.user.id }, order: [['created_at', 'DESC']], limit: 10 }),
      db.SubscriptionPlan.findAll({ where: { is_active: true } })
    ]);

    const nextCollection = requests.find((r) => ['pending', 'assigned', 'in_progress'].includes(r.status) && r.scheduled_date >= new Date().toISOString().split('T')[0]);
    const requestIds = requests.map((r) => r.id);
    let paymentStatusByRequest = {};
    if (requestIds.length) {
      const requestPayments = await db.Payment.findAll({
        where: { user_id: req.user.id, request_id: { [Op.in]: requestIds } },
        attributes: ['request_id', 'status', 'created_at'],
        order: [['created_at', 'DESC']]
      });
      paymentStatusByRequest = requestPayments.reduce((acc, p) => {
        if (acc[p.request_id] == null) acc[p.request_id] = p.status;
        return acc;
      }, {});
    }

    res.render('customer/dashboard', {
      title: 'Customer Dashboard',
      user: req.user,
      requests,
      payments,
      notifications,
      plans,
      nextCollection,
      paymentStatusByRequest
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { title: 'Error' });
  }
};

exports.requestPickup = async (req, res) => {
  try {
    let divisionId = req.user.division_id;
    if (divisionId == null && req.user.company_id) {
      const custCompany = await db.Company.findByPk(req.user.company_id, { attributes: ['division_id'] });
      if (custCompany) divisionId = custCompany.division_id;
    }
    if (divisionId == null) {
      const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
      if (wantsJson) return res.status(400).json({ success: false, message: 'Your account is not assigned to an area. Please contact support.' });
      return res.redirect('/customer');
    }
    const defaultSubscription = 'on_demand';
    const amount = 0;
    const scheduledDate = req.body.scheduled_date && String(req.body.scheduled_date).trim() ? req.body.scheduled_date : null;
    const scheduledTimeSlot = req.body.scheduled_time_slot && String(req.body.scheduled_time_slot).trim() ? req.body.scheduled_time_slot : null;
    const addressStr = req.body.address.trim();
    const latFromBody = req.body.latitude != null && req.body.latitude !== '' ? req.body.latitude : null;
    const lngFromBody = req.body.longitude != null && req.body.longitude !== '' ? req.body.longitude : null;
    const wasteCategory = String(req.body.waste_category || '').toLowerCase();
    const categoryNote = `Waste Category: ${wasteCategory}`;
    const extraNotes = req.body.notes && String(req.body.notes).trim() ? String(req.body.notes).trim() : '';
    const request = await db.WasteRequest.create({
      customer_id: req.user.id,
      address: addressStr,
      latitude: latFromBody,
      longitude: lngFromBody,
      subscription_type: req.body.subscription_type || defaultSubscription,
      scheduled_date: scheduledDate,
      scheduled_time_slot: scheduledTimeSlot,
      notes: extraNotes ? `${categoryNote}\n${extraNotes}` : categoryNote,
      status: 'pending',
      amount,
      division_id: divisionId
    });
    if (request.latitude == null && request.longitude == null) {
      geocodeAddress(addressStr).then(function (coords) {
        if (coords) request.update({ latitude: coords.lat, longitude: coords.lng }).catch(function () {});
      }).catch(function () {});
    }
    await db.Notification.create({ user_id: req.user.id, title: 'Request submitted', message: `Waste pickup request #${request.id} has been submitted.`, type: 'request' });
    const company = await db.Company.findOne({ where: { division_id: divisionId, is_active: true }, include: [{ model: db.User, as: 'Admin', attributes: ['id', 'email'] }] });
    if (company && company.Admin) {
      await db.Notification.create({
        user_id: company.admin_id,
        title: 'New collection request',
        message: `New waste pickup request #${request.id} from ${req.user.name} at ${request.address}. Assign a collector from Requests.`,
        type: 'request',
        link: '/admin/requests'
      }).catch(() => {});
      const emailService = require('../services/emailService');
      emailService.sendNewRequestToAdmin(company.Admin.email, request.id, request.address, req.user.name).catch(() => {});
    }
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (wantsJson) return res.json({ success: true, requestId: request.id });
    res.redirect('/customer');
  } catch (err) {
    console.error(err);
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (wantsJson) return res.status(400).json({ success: false, message: err.message });
    res.redirect('/customer');
  }
};

exports.cancelRequest = async (req, res) => {
  try {
    const r = await db.WasteRequest.findOne({ where: { id: req.params.id, customer_id: req.user.id } });
    if (!r) return res.status(404).json({ success: false });
    if (!['pending', 'assigned'].includes(r.status)) return res.status(400).json({ success: false, message: 'Cannot cancel this request' });
    await r.update({ status: 'cancelled' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.modifyRequest = async (req, res) => {
  try {
    const r = await db.WasteRequest.findOne({ where: { id: req.params.id, customer_id: req.user.id } });
    if (!r || r.status !== 'pending') return res.status(400).json({ success: false, message: 'Cannot modify' });
    await r.update(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.complaints = async (req, res) => {
  const complaints = await db.Complaint.findAll({ where: { user_id: req.user.id }, order: [['created_at', 'DESC']], include: [{ model: db.WasteRequest, as: 'WasteRequest', attributes: ['id'] }] });
  res.render('customer/complaints', { title: 'My Complaints', complaints });
};

exports.createComplaint = async (req, res) => {
  try {
    const ticketNumber = 'TKT-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    await db.Complaint.create({
      user_id: req.user.id,
      request_id: req.body.request_id || null,
      subject: req.body.subject,
      message: req.body.message,
      ticket_number: ticketNumber
    });
    if (req.xhr) return res.json({ success: true, ticketNumber });
    res.redirect('/customer/complaints');
  } catch (err) {
    if (req.xhr) return res.status(400).json({ success: false, message: err.message });
    res.redirect('/customer/complaints');
  }
};

exports.notifications = async (req, res) => {
  const notifications = await db.Notification.findAll({ where: { user_id: req.user.id }, order: [['created_at', 'DESC']], limit: 50 });
  await db.Notification.update({ read_status: true }, { where: { user_id: req.user.id } });
  res.render('customer/notifications', { title: 'Notifications', notifications });
};

exports.paymentHistory = async (req, res) => {
  const payments = await db.Payment.findAll({ where: { user_id: req.user.id }, include: [{ model: db.WasteRequest, as: 'WasteRequest' }], order: [['created_at', 'DESC']] });
  res.render('customer/payment-history', { title: 'Payment History', payments });
};

exports.downloadInvoice = async (req, res) => {
  try {
    const payment = await db.Payment.findOne({ where: { id: req.params.id, user_id: req.user.id }, include: [{ model: db.WasteRequest, as: 'WasteRequest' }] });
    if (!payment) return res.status(404).send('Not found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${payment.invoice_number || payment.id}.pdf`);
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    doc.pipe(res);
    doc.fontSize(18).text('INVOICE', 50, 50);
    doc.fontSize(10).text(`Invoice #: ${payment.invoice_number || payment.id}`, 50, 80);
    doc.text(`Date: ${payment.created_at.toISOString().split('T')[0]}`, 50, 95);
    doc.text(`Amount: ${payment.amount} ${payment.currency || 'UGX'}`, 50, 110);
    doc.text(`Status: ${payment.status}`, 50, 125);
    doc.end();
  } catch (err) {
    res.status(500).send(err.message);
  }
};
