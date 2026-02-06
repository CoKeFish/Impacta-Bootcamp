const router = require('express').Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const ctrl = require('../controllers/imagesController');

router.post('/upload', upload.single('image'), ctrl.upload);
router.get('/:filename', ctrl.get);
router.get('/', ctrl.list);

module.exports = router;
