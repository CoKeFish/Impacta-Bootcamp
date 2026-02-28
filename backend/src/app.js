require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const {randomUUID} = require('crypto');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Security headers ───────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS whitelist ─────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body parsing with size limit ───────────────────────────────────────────
app.use(express.json({limit: '16kb'}));

// ─── Request ID ─────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
    req.id = randomUUID();
    next();
});

// ─── HTTP request logging ───────────────────────────────────────────────────
app.use(pinoHttp({
    logger,
    genReqId: (req) => req.id,
    // Don't log health checks to reduce noise
    autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/',
    },
    customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },
    serializers: {
        req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            userId: req.raw?.user?.id,
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
    },
}));

// ─── Rate limiting (disabled during tests) ──────────────────────────────────
const skipInTest = () => process.env.NODE_ENV === 'test';

const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => skipInTest() || (req.method === 'GET' && req.path.startsWith('/images')),
    message: {error: 'Too many requests, please try again later'},
});
app.use(globalLimiter);

const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    message: {error: 'Too many auth attempts, please try again later'},
});

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/health', require('./routes/health'));
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/businesses', require('./routes/businesses'));
app.use('/api/services', require('./routes/services'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/admin', require('./routes/admin'));
app.use('/images', require('./routes/images'));

// Root
app.get('/', (req, res) => {
    res.json({message: 'CoTravel API running', version: '2.0.0'});
});

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
