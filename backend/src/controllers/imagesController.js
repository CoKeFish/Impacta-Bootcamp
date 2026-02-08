const {minioClient, BUCKETS} = require('../config/minio');

module.exports = {
    async upload(req, res, next) {
        try {
            if (!req.file) {
                return res.status(400).json({error: 'No image provided'});
            }

            const fileName = `${Date.now()}-${req.file.originalname}`;

            await minioClient.putObject(
                BUCKETS.IMAGES, fileName,
                req.file.buffer, req.file.size,
                {'Content-Type': req.file.mimetype}
            );

            res.status(201).json({
                message: 'Image uploaded',
                filename: fileName,
                mimetype: req.file.mimetype,
                size: req.file.size,
                url: `/images/${fileName}`,
            });
        } catch (err) {
            next(err);
        }
    },

    async get(req, res, next) {
        try {
            const stream = await minioClient.getObject(BUCKETS.IMAGES, req.params.filename);
            stream.pipe(res);
        } catch (err) {
            res.status(404).json({error: 'Image not found'});
        }
    },

    async list(req, res, next) {
        try {
            const images = [];
            const stream = minioClient.listObjects(BUCKETS.IMAGES, '', true);
            await new Promise((resolve, reject) => {
                stream.on('data', (obj) => images.push({
                    filename: obj.name,
                    size: obj.size,
                    lastModified: obj.lastModified,
                    url: `/images/${obj.name}`,
                }));
                stream.on('end', resolve);
                stream.on('error', reject);
            });
            res.json(images);
        } catch (err) {
            next(err);
        }
    },
};
