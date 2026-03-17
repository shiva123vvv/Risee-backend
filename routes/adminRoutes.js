const express = require('express');
const router = express.Router();
const { getAdminDashboard, getWithdrawals, approveWithdrawal, getDonationLogs, getFraudReports, getAdminUsers, getAdminCampaigns, toggleUserVerification, toggleUserStatus } = require('../controllers/adminController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const { updateCampaign } = require('../controllers/campaignController');

// Rename roleMiddleware to checkAdminAuth for user logic requests mentally, though we'll keep the system naming structure
const checkAdminAuth = roleMiddleware(['admin']);

router.use(authMiddleware, checkAdminAuth);

router.get('/dashboard', getAdminDashboard);
router.get('/campaigns', getAdminCampaigns);
router.get('/users', getAdminUsers);
router.put('/users/:id/verify', toggleUserVerification);
router.put('/users/:id/status', toggleUserStatus);
router.get('/donations', getDonationLogs);
router.get('/withdrawals', getWithdrawals);
router.get('/fraud-reports', getFraudReports);
router.put('/withdrawals/:id', approveWithdrawal);
router.put('/verify-campaign/:id', updateCampaign);

module.exports = router;
