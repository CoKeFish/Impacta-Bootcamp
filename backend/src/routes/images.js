const router = require('express').Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/imagesController');
const {requireAuth} = require('../middleware/auth');

const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: {error: 'Too many uploads, please try again later'},
});

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
router.post('/upload', uploadLimiter, requireAuth, upload.single('image'), ctrl.upload);

// Retrieval is public (images are referenced by URL)
router.get('/:filename', ctrl.get);
router.get('/', ctrl.list);

module.exports = router;
