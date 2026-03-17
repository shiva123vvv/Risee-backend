const express = require('express');
const router = express.Router();
const { donate, getUserDonations, createOrder, getDonorStats } = require('../controllers/donationController');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/authMiddleware');

router.post('/create-order', optionalAuthMiddleware, createOrder);
router.post('/', optionalAuthMiddleware, donate);

router.get('/user', authMiddleware, getUserDonations);
router.get('/stats', authMiddleware, getDonorStats);

module.exports = router;
