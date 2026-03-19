const db = require('../models');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `proof-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname) || '.jpg'}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

exports.dashboard = async (req, res) => {
  try {
    const collector = await db.Collector.findOne({
      where: { user_id: req.user.id },
      include: [{ model: db.Company, as: 'Company', include: [{ model: db.Division, as: 'Division' }] }]
    });
    if (!collector) return res.status(403).render('errors/403', { title: 'Collector profile not found' });

    const [assignedJobs, completedToday, earningsResult] = await Promise.all([
      db.WasteRequest.findAll({
        where: { assigned_collector_id: collector.id, status: { [Op.in]: ['assigned', 'in_progress'] } },
        include: [{ model: db.User, as: 'User', attributes: ['name', 'phone', 'address'] }],
        order: [['scheduled_date'], ['scheduled_time_slot']]
      }),
      db.WasteRequest.count({ where: { assigned_collector_id: collector.id, status: 'completed', completed_at: { [Op.gte]: new Date().setHours(0, 0, 0, 0) } } }),
      db.WasteRequest.findAll({
        where: { assigned_collector_id: collector.id, status: 'completed' },
        attributes: [[db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total']],
        raw: true
      })
    ]);

    const totalEarnings = earningsResult[0]?.total ? parseFloat(earningsResult[0].total) : 0;

    res.render('collector/dashboard', {
      title: 'Collector Dashboard',
      collector,
      assignedJobs,
      completedToday,
      totalEarnings
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('errors/500', { title: 'Error' });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const collector = await db.Collector.findOne({ where: { user_id: req.user.id } });
    if (!collector) return res.status(403).json({ success: false, message: 'Collector not found' });

    const { latitude, longitude, speed, heading } = req.body;
    await db.TruckLocation.create({ collector_id: collector.id, latitude, longitude, speed: speed || 0, heading: heading || null });
    await collector.update({
      current_lat: latitude,
      current_lng: longitude,
      last_location_at: new Date(),
      status: collector.status === 'available' ? 'on_route' : collector.status
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.startRoute = async (req, res) => {
  try {
    const collector = await db.Collector.findOne({ where: { user_id: req.user.id } });
    if (!collector) return res.status(403).json({ success: false });
    await collector.update({ status: 'on_route' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.endRoute = async (req, res) => {
  try {
    const collector = await db.Collector.findOne({ where: { user_id: req.user.id } });
    if (!collector) return res.status(403).json({ success: false });
    await collector.update({ status: 'available' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.completeJob = async (req, res) => {
  try {
    const collector = await db.Collector.findOne({ where: { user_id: req.user.id } });
    if (!collector) return res.status(403).json({ success: false });
    const requestId = req.params.id;
    const wasteRequest = await db.WasteRequest.findOne({ where: { id: requestId, assigned_collector_id: collector.id } });
    if (!wasteRequest) return res.status(404).json({ success: false, message: 'Job not found' });

    const wasteCategory = req.body.waste_category ? String(req.body.waste_category).toLowerCase() : null;
    const allowedCategories = ['industrial', 'commercial', 'household', 'agricultural'];
    if (!wasteCategory || !allowedCategories.includes(wasteCategory)) {
      return res.status(400).json({ success: false, message: 'Please select a valid waste category.' });
    }
    const weight = parseFloat(req.body.collected_weight_kg);
    if (!Number.isFinite(weight) || weight <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid waste weight in KG.' });
    }

    const proofUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const categoryLabel = wasteCategory.charAt(0).toUpperCase() + wasteCategory.slice(1);
    const weightNote = `Category: ${categoryLabel} Waste | Weight: ${weight.toFixed(2)} KG`;
    const mergedNotes = wasteRequest.notes && String(wasteRequest.notes).trim()
      ? `${wasteRequest.notes}\n${weightNote}`
      : weightNote;
    await wasteRequest.update({
      status: 'completed',
      completed_at: new Date(),
      proof_image_url: proofUrl,
      notes: mergedNotes
    });
    await db.Notification.create({ user_id: wasteRequest.customer_id, title: 'Collection completed', message: `Your waste collection #${requestId} has been completed.`, type: 'completion' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.uploadProof = upload.single('proof_image');

exports.reportEmergency = async (req, res) => {
  try {
    const collector = await db.Collector.findOne({ where: { user_id: req.user.id }, include: [{ model: db.Company, as: 'Company' }] });
    if (!collector) return res.status(403).json({ success: false });
    await db.Notification.create({
      user_id: collector.Company.admin_id,
      title: 'Emergency Report',
      message: `Collector ${req.user.name} (Truck ${collector.truck_number}) reported an emergency: ${req.body.message || 'No details'}`,
      type: 'emergency'
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getMyLocationHistory = async (req, res) => {
  try {
    const collector = await db.Collector.findOne({ where: { user_id: req.user.id } });
    if (!collector) return res.json({ success: true, locations: [] });
    const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const locations = await db.TruckLocation.findAll({
      where: { collector_id: collector.id, created_at: { [Op.gte]: since } },
      order: [['created_at', 'ASC']],
      limit: 1000
    });
    res.json({
      success: true,
      locations: locations.map((l) => ({ lat: parseFloat(l.latitude), lng: parseFloat(l.longitude), createdAt: l.created_at }))
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
