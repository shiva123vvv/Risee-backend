const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

const upload = require('../config/multer');

router.get('/dashboard/:uid', userController.getDashboardData);
router.put('/profile/:uid', upload.single('profilePicture'), userController.updateProfile);

module.exports = router;
