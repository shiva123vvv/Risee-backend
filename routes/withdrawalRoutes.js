const express = require('express');
const router = express.Router();
const { requestWithdrawal, getUserWithdrawals } = require('../controllers/withdrawalController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware, roleMiddleware(['fundraiser', 'admin']));

router.post('/', requestWithdrawal);
router.get('/', getUserWithdrawals);

module.exports = router;
