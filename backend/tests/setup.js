// Ensure NODE_ENV is set before any modules load
process.env.NODE_ENV = 'test';

// Set environment variables BEFORE any modules are loaded.
// Preserve existing env vars (e.g. from Docker) — only set fallbacks for local dev.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://impacta:impacta123@localhost:5432/impacta_db';
process.env.MINIO_ENDPOINT = process.env.TEST_MINIO_ENDPOINT || process.env.MINIO_ENDPOINT || 'localhost';
process.env.MINIO_PORT = process.env.TEST_MINIO_PORT || process.env.MINIO_PORT || '9000';
process.env.MINIO_ACCESS_KEY = process.env.TEST_MINIO_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || 'minioadmin';
process.env.MINIO_SECRET_KEY = process.env.TEST_MINIO_SECRET_KEY || process.env.MINIO_SECRET_KEY || 'minioadmin123';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
process.env.SOROBAN_NETWORK_PASSPHRASE = process.env.SOROBAN_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
process.env.CONTRACT_ID = process.env.CONTRACT_ID || 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCT4';
process.env.NATIVE_TOKEN_ID = process.env.NATIVE_TOKEN_ID || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
