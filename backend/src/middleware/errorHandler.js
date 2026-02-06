module.exports = (err, req, res, _next) => {
    console.error(`[ERROR] ${req.method} ${req.url}:`, err.message);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
    });
};
