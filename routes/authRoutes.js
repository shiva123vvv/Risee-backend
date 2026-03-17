const express = require('express');
const router = express.Router();
const { register, login, syncWithFirebase, getMe, updateBankDetails, switchRole } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/sync', syncWithFirebase);
router.get('/me', authMiddleware, getMe);
router.put('/bank-details', authMiddleware, updateBankDetails);
router.post('/switch-role', authMiddleware, switchRole);

module.exports = router;
