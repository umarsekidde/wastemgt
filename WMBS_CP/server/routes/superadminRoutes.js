const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadminController');
const { authenticate } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/roleCheck');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate, requireSuperAdmin);

router.get('/', superadminController.dashboard);
router.get('/divisions', superadminController.divisions);
router.post('/divisions', validate(schemas.division), superadminController.createDivision);
router.put('/divisions/:id', validate(schemas.division), superadminController.updateDivision);
router.get('/companies', superadminController.companies);
router.post('/companies', validate(schemas.company), superadminController.createCompany);
router.put('/companies/:id', superadminController.updateCompany);
router.get('/admins', superadminController.systemAdmins);
router.post('/admins', superadminController.createAdmin);
router.get('/customers', superadminController.customers);
router.get('/broadcast', superadminController.broadcast);
router.post('/broadcast', validate(schemas.broadcast), superadminController.postBroadcast);
router.get('/audit-logs', superadminController.auditLogs);
router.get('/export', superadminController.exportReports);
router.get('/settings', superadminController.settings);
router.get('/api/truck-locations', superadminController.getTruckLocations);

module.exports = router;
