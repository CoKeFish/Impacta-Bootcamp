const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/imagesController');
const {requireAuth} = require('../middleware/auth');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {fileSize: 5 * 1024 * 1024}, // 5MB max
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
        }
    },
});

// Upload requires auth
router.post('/upload', requireAuth, upload.single('image'), ctrl.upload);

// Retrieval is public (images are referenced by URL)
router.get('/:filename', ctrl.get);
router.get('/', ctrl.list);

module.exports = router;
