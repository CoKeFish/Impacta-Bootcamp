const pino = require('pino');
const path = require('path');

const isTest = process.env.NODE_ENV === 'test';
const isDev = process.env.NODE_ENV !== 'production';
const logDir = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');

// Common options shared across all configurations
const baseOptions = {
    level: isTest ? 'silent' : (process.env.LOG_LEVEL || (isDev ? 'debug' : 'info')),
    base: {service: 'cotravel-api'},
    redact: {
        paths: ['req.headers.authorization', 'password', 'signed_xdr', 'signature'],
        censor: '[REDACTED]',
    },
};

let logger;

if (isTest) {
    // Tests: silent, no transports
    logger = pino(baseOptions);

} else {
    // Development & Production: console + daily rotated file
    const targets = [];

    // Console: pretty in dev, JSON in prod
    if (isDev) {
        targets.push({
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss.l',
                ignore: 'pid,hostname',
            },
            level: baseOptions.level,
        });
    } else {
        targets.push({
            target: 'pino/file',
            options: {destination: 1}, // stdout
            level: baseOptions.level,
        });
    }

    // File: daily rotation, keep 14 days
    targets.push({
        target: 'pino-roll',
        options: {
            file: path.join(logDir, 'app'),
            frequency: 'daily',
            dateFormat: 'yyyy-MM-dd',
            mkdir: true,
            limit: {count: 14},
        },
        level: baseOptions.level,
    });

    logger = pino({
        ...baseOptions,
        transport: {targets},
    });
}

module.exports = logger;
