const express = require('express');
const cors = require('cors');
const {Client} = require('pg');
const Minio = require('minio');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de PostgreSQL
const pgClient = new Client({
    connectionString: process.env.DATABASE_URL
});

// Configuración de MinIO
const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'minio',
    port: parseInt(process.env.MINIO_PORT) || 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123'
});

// Configuración de Multer para subir archivos
const upload = multer({storage: multer.memoryStorage()});

// Nombre del bucket para imágenes
const BUCKET_NAME = 'images';

// Inicializar conexiones
async function init() {
    try {
        // Conectar a PostgreSQL
        await pgClient.connect();
        console.log('Conectado a PostgreSQL');

        // Crear bucket en MinIO si no existe
        const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
        if (!bucketExists) {
            await minioClient.makeBucket(BUCKET_NAME);
            console.log(`Bucket "${BUCKET_NAME}" creado`);
        }
        console.log('Conectado a MinIO');
    } catch (error) {
        console.error('Error inicializando:', error);
        process.exit(1);
    }
}

// Rutas
app.get('/', (req, res) => {
    res.json({message: 'API Impacta Bootcamp funcionando'});
});

// Health check
app.get('/health', async (req, res) => {
    try {
        await pgClient.query('SELECT 1');
        res.json({status: 'ok', database: 'connected', storage: 'connected'});
    } catch (error) {
        res.status(500).json({status: 'error', message: error.message});
    }
});

// Subir imagen
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({error: 'No se proporcionó ninguna imagen'});
        }

        const fileName = `${Date.now()}-${req.file.originalname}`;

        // Subir a MinIO
        await minioClient.putObject(
            BUCKET_NAME,
            fileName,
            req.file.buffer,
            req.file.size,
            {'Content-Type': req.file.mimetype}
        );

        // Guardar referencia en PostgreSQL
        const result = await pgClient.query(
            'INSERT INTO images (filename, mimetype, size) VALUES ($1, $2, $3) RETURNING *',
            [fileName, req.file.mimetype, req.file.size]
        );

        res.json({
            message: 'Imagen subida exitosamente',
            image: result.rows[0],
            url: `/images/${fileName}`
        });
    } catch (error) {
        console.error('Error subiendo imagen:', error);
        res.status(500).json({error: error.message});
    }
});

// Obtener imagen
app.get('/images/:filename', async (req, res) => {
    try {
        const stream = await minioClient.getObject(BUCKET_NAME, req.params.filename);
        stream.pipe(res);
    } catch (error) {
        res.status(404).json({error: 'Imagen no encontrada'});
    }
});

// Listar imágenes
app.get('/images', async (req, res) => {
    try {
        const result = await pgClient.query('SELECT * FROM images ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// Iniciar servidor
init().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
});
