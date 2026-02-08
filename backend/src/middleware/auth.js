const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
}
const SECRET = JWT_SECRET || 'cotravel-dev-secret-change-in-production';

const JWT_ISSUER = 'cotravel-api';
const JWT_AUDIENCE = 'cotravel-client';

// ─── Validate :id param as positive integer ─────────────────────────────────
function validateId(req, res, next) {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({error: 'Invalid ID parameter'});
    }
    req.params.id = id;
    next();
}

// ─── Verify JWT token and attach user to request ────────────────────────────
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({error: 'Authorization token required'});
    }

    const token = header.split(' ')[1];
    try {
        const payload = jwt.verify(token, SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });
        req.user = {
            id: payload.id,
            wallet_address: payload.wallet_address,
            role: payload.role || 'user',
            provider: payload.provider,
        };
        next();
    } catch (err) {
        return res.status(401).json({error: 'Invalid or expired token'});
    }
}

// ─── Optional auth: attach user if token present, otherwise continue ────────
function optionalAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return next();
    }

    const token = header.split(' ')[1];
    try {
        const payload = jwt.verify(token, SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });
        req.user = {
            id: payload.id,
            wallet_address: payload.wallet_address,
            role: payload.role || 'user',
            provider: payload.provider,
        };
    } catch (_) {
        // Invalid token, continue without user
    }
    next();
}

// ─── Require admin role ─────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({error: 'Admin access required'});
    }
    next();
}

// ─── Load invoice by :id param ──────────────────────────────────────────────
const invoiceModel = require('../models/invoiceModel');

async function loadInvoice(req, res, next) {
    try {
        const invoice = await invoiceModel.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({error: 'Invoice not found'});
        }
        req.invoice = invoice;
        next();
    } catch (err) {
        next(err);
    }
}

// ─── Check if user is organizer of loaded invoice ───────────────────────────
function requireInvoiceOrganizer(req, res, next) {
    if (!req.invoice) {
        return res.status(500).json({error: 'Invoice not loaded'});
    }
    if (req.invoice.organizer_id !== req.user.id) {
        return res.status(403).json({error: 'Only the invoice organizer can do this'});
    }
    next();
}

// ─── Check if user is organizer OR participant of loaded invoice ─────────────
const invoiceParticipantModel = require('../models/invoiceParticipantModel');

async function requireInvoiceAccess(req, res, next) {
    if (!req.invoice) {
        return res.status(500).json({error: 'Invoice not loaded'});
    }
    // Admin can always access
    if (req.user.role === 'admin') return next();
    // Organizer can access
    if (req.invoice.organizer_id === req.user.id) return next();
    // Participant can access
    try {
        const participant = await invoiceParticipantModel.findByInvoiceAndUser(
            req.invoice.id, req.user.id
        );
        if (participant) return next();
    } catch (_) {
        // fall through to 403
    }
    return res.status(403).json({error: 'Access denied: not organizer or participant'});
}

// ─── Load business by :id param ─────────────────────────────────────────────
const businessModel = require('../models/businessModel');

async function loadBusiness(req, res, next) {
    try {
        const business = await businessModel.findById(req.params.id);
        if (!business) {
            return res.status(404).json({error: 'Business not found'});
        }
        req.business = business;
        next();
    } catch (err) {
        next(err);
    }
}

// ─── Check if user owns the loaded business ─────────────────────────────────
function requireBusinessOwner(req, res, next) {
    if (!req.business) {
        return res.status(500).json({error: 'Business not loaded'});
    }
    if (req.business.owner_id !== req.user.id) {
        return res.status(403).json({error: 'Only the business owner can do this'});
    }
    next();
}

// ─── Generate JWT for a user ────────────────────────────────────────────────
function generateToken(user, provider = 'wallet') {
    return jwt.sign(
        {
            id: user.id,
            wallet_address: user.wallet_address,
            role: user.role || 'user',
            provider,
        },
        SECRET,
        {
            expiresIn: '24h',
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        }
    );
}

module.exports = {
    validateId,
    requireAuth,
    optionalAuth,
    requireAdmin,
    loadInvoice, requireInvoiceOrganizer, requireInvoiceAccess,
    loadBusiness, requireBusinessOwner,
    generateToken,
    JWT_SECRET: SECRET,
};
