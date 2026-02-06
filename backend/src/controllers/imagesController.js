const imageModel = require('../models/imageModel');
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

            const image = await imageModel.create(
                fileName, req.file.mimetype, req.file.size,
                req.body.trip_id || null,
                req.body.uploaded_by || null
            );

            res.status(201).json({
                message: 'Image uploaded',
                image,
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
            const images = await imageModel.findAll();
            res.json(images);
        } catch (err) {
            next(err);
        }
    },
};
