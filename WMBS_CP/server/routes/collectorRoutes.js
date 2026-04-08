const express = require('express');
const router = express.Router();
const collectorController = require('../controllers/collectorController');
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { requireCollector } = require('../middleware/roleCheck');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate, requireCollector);

router.get('/', collectorController.dashboard);
router.get('/finished', collectorController.finishedJobs);
router.post('/api/update-location', validate(schemas.updateLocation), collectorController.updateLocation);
router.post('/api/start-route', collectorController.startRoute);
router.post('/api/end-route', collectorController.endRoute);
router.post('/api/complete-job/:id', collectorController.uploadProof, collectorController.completeJob);
router.post('/api/confirm-complete/:id', collectorController.uploadProof, collectorController.confirmCompletion);
router.post('/api/emergency', collectorController.reportEmergency);
router.get('/api/location-history', collectorController.getMyLocationHistory);
router.get('/api/notifications/latest', notificationController.latestForCurrentUser);

module.exports = router;
