const {Keypair} = require('@stellar/stellar-sdk');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const {generateToken} = require('../middleware/auth');
const logger = require('../config/logger');

// In-memory challenge store (simple for bootcamp, use Redis in production)
const challenges = new Map();
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify a message signed with Freighter's signMessage (SEP-0053).
 * Freighter prepends "Stellar Signed Message:\n" and SHA-256 hashes before signing.
 */
function verifySignedMessage(publicKey, message, signatureBase64) {
    const prefix = Buffer.from('Stellar Signed Message:\n', 'utf-8');
    const messageBytes = Buffer.from(message, 'utf-8');
    const encodedMessage = Buffer.concat([prefix, messageBytes]);
    const messageHash = crypto.createHash('sha256').update(encodedMessage).digest();
    const signatureBuffer = Buffer.from(signatureBase64, 'base64');

    const keypair = Keypair.fromPublicKey(publicKey);
    return keypair.verify(messageHash, signatureBuffer);
}

module.exports = {
    // GET /api/auth/challenge?wallet=GABCD...
    async getChallenge(req, res, next) {
        try {
            const {wallet} = req.query;
            if (!wallet) {
                return res.status(400).json({error: 'wallet query parameter required'});
            }

            const nonce = crypto.randomBytes(32).toString('hex');
            const message = `CoTravel Login: ${nonce}`;

            challenges.set(wallet, {
                message,
                createdAt: Date.now(),
            });

            // Cleanup expired challenges
            for (const [key, val] of challenges) {
                if (Date.now() - val.createdAt > CHALLENGE_EXPIRY_MS) {
                    challenges.delete(key);
                }
            }

            logger.debug({wallet: wallet.slice(0, 8) + '...'}, 'Challenge issued');
            res.json({challenge: message});
        } catch (err) {
            next(err);
        }
    },

    // POST /api/auth/login
    async login(req, res, next) {
        try {
            const {wallet, signature, provider} = req.body;

            // --- Wallet authentication (default) ---
            if (!provider || provider === 'wallet') {
                if (!wallet || !signature) {
                    return res.status(400).json({error: 'wallet and signature required'});
                }

                const stored = challenges.get(wallet);
                if (!stored) {
                    return res.status(400).json({error: 'No challenge found. Request one first.'});
                }

                if (Date.now() - stored.createdAt > CHALLENGE_EXPIRY_MS) {
                    challenges.delete(wallet);
                    return res.status(400).json({error: 'Challenge expired. Request a new one.'});
                }

                try {
                    const valid = verifySignedMessage(wallet, stored.message, signature);
                    if (!valid) {
                        logger.warn({wallet: wallet.slice(0, 8) + '...'}, 'Login failed: invalid signature');
                        return res.status(401).json({error: 'Invalid signature'});
                    }
                } catch (e) {
                    logger.warn({
                        wallet: wallet.slice(0, 8) + '...',
                        err: e.message
                    }, 'Login failed: verification error');
                    return res.status(401).json({error: 'Signature verification failed: ' + e.message});
                }

                challenges.delete(wallet);

                let user = await userModel.findByWallet(wallet);
                const isNew = !user;
                if (!user) {
                    user = await userModel.create(wallet, null);
                }

                const token = generateToken(user, 'wallet');
                logger.info({userId: user.id, isNew, role: user.role}, 'User logged in');
                return res.json({token, user});
            }

            return res.status(400).json({error: `Unsupported provider: ${provider}`});
        } catch (err) {
            next(err);
        }
    },

    // GET /api/auth/me
    async me(req, res, next) {
        try {
            const user = await userModel.findById(req.user.id);
            if (!user) {
                return res.status(404).json({error: 'User not found'});
            }
            res.json(user);
        } catch (err) {
            next(err);
        }
    },
};
