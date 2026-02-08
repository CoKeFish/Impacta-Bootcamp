const logger = require('../config/logger');

module.exports = (err, req, res, _next) => {
    const status = err.status || 500;
    const requestId = req.id || 'unknown';

    if (status >= 500) {
        logger.error({
            err,
            reqId: requestId,
            method: req.method,
            url: req.url,
            userId: req.user?.id,
        }, 'Server error');
    } else {
        logger.warn({
            reqId: requestId,
            method: req.method,
            url: req.url,
            status,
            message: err.message,
            userId: req.user?.id,
        }, 'Client error');
    }

    // Client-facing errors (4xx) can show their message
    if (status < 500) {
        return res.status(status).json({error: err.message});
    }

    // Server errors: never expose internals
    res.status(500).json({error: 'Internal server error'});
};
