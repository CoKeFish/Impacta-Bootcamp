const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cotravel-dev-secret-change-in-production';

// Verify JWT token and attach user to request
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({error: 'Authorization token required'});
    }

    const token = header.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: payload.id,
            wallet_address: payload.wallet_address,
            provider: payload.provider,       // 'wallet', 'google', 'facebook' (future)
        };
        next();
    } catch (err) {
        return res.status(401).json({error: 'Invalid or expired token'});
    }
}

// Check if authenticated user is the organizer of a trip
function requireOrganizer(req, res, next) {
    // Must be used AFTER requireAuth and AFTER loading trip into req.trip
    if (!req.trip) {
        return res.status(500).json({error: 'Trip not loaded'});
    }
    if (req.trip.organizer_id !== req.user.id) {
        return res.status(403).json({error: 'Only the trip organizer can do this'});
    }
    next();
}

// Load trip by :id param and attach to req.trip
const tripModel = require('../models/tripModel');

async function loadTrip(req, res, next) {
    try {
        const trip = await tripModel.findById(req.params.id);
        if (!trip) {
            return res.status(404).json({error: 'Trip not found'});
        }
        req.trip = trip;
        next();
    } catch (err) {
        next(err);
    }
}

// Generate JWT for a user
function generateToken(user, provider = 'wallet') {
    return jwt.sign(
        {
            id: user.id,
            wallet_address: user.wallet_address,
            provider,
        },
        JWT_SECRET,
        {expiresIn: '24h'}
    );
}

module.exports = {requireAuth, requireOrganizer, loadTrip, generateToken, JWT_SECRET};
