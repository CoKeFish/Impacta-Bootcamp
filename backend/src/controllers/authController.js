const {Keypair} = require('@stellar/stellar-sdk');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const {generateToken} = require('../middleware/auth');

// In-memory challenge store (simple for bootcamp, use Redis in production)
const challenges = new Map();
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

module.exports = {
    // GET /api/auth/challenge?wallet=GABCD...
    // Returns a random challenge string for the wallet to sign
    async getChallenge(req, res, next) {
        try {
            const {wallet} = req.query;
            if (!wallet) {
                return res.status(400).json({error: 'wallet query parameter required'});
            }

            const challenge = crypto.randomBytes(32).toString('hex');
            const message = `CoTravel Login: ${challenge}`;

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

            res.json({challenge: message});
        } catch (err) {
            next(err);
        }
    },

    // POST /api/auth/login
    // Verifies the signed challenge and returns a JWT
    //
    // For wallet auth: { wallet, signature }
    // Future Google:   { provider: "google", token: "..." }
    // Future Facebook: { provider: "facebook", token: "..." }
    async login(req, res, next) {
        try {
            const {wallet, signature, provider} = req.body;

            // --- Wallet authentication (default) ---
            if (!provider || provider === 'wallet') {
                if (!wallet || !signature) {
                    return res.status(400).json({error: 'wallet and signature required'});
                }

                // Verify challenge exists
                const stored = challenges.get(wallet);
                if (!stored) {
                    return res.status(400).json({error: 'No challenge found. Request one first.'});
                }

                // Check expiry
                if (Date.now() - stored.createdAt > CHALLENGE_EXPIRY_MS) {
                    challenges.delete(wallet);
                    return res.status(400).json({error: 'Challenge expired. Request a new one.'});
                }

                // Verify signature
                try {
                    const keypair = Keypair.fromPublicKey(wallet);
                    const messageBuffer = Buffer.from(stored.message, 'utf-8');
                    const signatureBuffer = Buffer.from(signature, 'base64');
                    const valid = keypair.verify(messageBuffer, signatureBuffer);

                    if (!valid) {
                        return res.status(401).json({error: 'Invalid signature'});
                    }
                } catch (e) {
                    return res.status(401).json({error: 'Signature verification failed: ' + e.message});
                }

                // Consume challenge
                challenges.delete(wallet);

                // Find or create user
                let user = await userModel.findByWallet(wallet);
                if (!user) {
                    user = await userModel.create(wallet, null);
                }

                const token = generateToken(user, 'wallet');
                return res.json({token, user});
            }

            // --- Future: Google OAuth ---
            // if (provider === 'google') {
            //     const { token: googleToken } = req.body;
            //     // 1. Verify googleToken with Google API
            //     // 2. Get email/name from Google profile
            //     // 3. Find or create user (link wallet later)
            //     // 4. return res.json({ token: generateToken(user, 'google'), user });
            // }

            // --- Future: Facebook OAuth ---
            // if (provider === 'facebook') {
            //     const { token: fbToken } = req.body;
            //     // 1. Verify fbToken with Facebook Graph API
            //     // 2. Get profile info
            //     // 3. Find or create user
            //     // 4. return res.json({ token: generateToken(user, 'facebook'), user });
            // }

            return res.status(400).json({error: `Unsupported provider: ${provider}`});
        } catch (err) {
            next(err);
        }
    },

    // GET /api/auth/me - Get current authenticated user
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
