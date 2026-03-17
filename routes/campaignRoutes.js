const express = require('express');
const router = express.Router();
const {
    createCampaign,
    getAllCampaigns,
    getCampaignById,
    updateCampaign,
    getUserCampaigns,
    toggleSaveCampaign,
    getSavedCampaigns,
    addCampaignUpdate,
    deleteCampaignUpdate,
    getOrganizerStats,
    getCampaignBySlug,
    extendCampaign,
    deleteCampaign
} = require('../controllers/campaignController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const upload = require('../config/multer');

router.get('/', getAllCampaigns);
router.get('/user', authMiddleware, getUserCampaigns);
router.get('/saved', authMiddleware, getSavedCampaigns);
router.get('/organizer-stats', authMiddleware, roleMiddleware(['fundraiser', 'admin']), getOrganizerStats);
router.get('/:id', getCampaignById);
router.get('/:username/:slug', getCampaignBySlug);

router.post('/', authMiddleware, roleMiddleware(['fundraiser', 'admin']), upload.single('image'), createCampaign);
router.post('/save', authMiddleware, toggleSaveCampaign);
router.post('/update/:id', authMiddleware, roleMiddleware(['fundraiser', 'admin']), upload.single('image'), addCampaignUpdate);
router.delete('/update/:updateId', authMiddleware, deleteCampaignUpdate);
router.post('/extend/:id', authMiddleware, extendCampaign);
router.delete('/:id', authMiddleware, deleteCampaign);
router.put('/:id', authMiddleware, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'documents', maxCount: 10 }]), updateCampaign);

module.exports = router;
