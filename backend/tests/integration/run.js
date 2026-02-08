#!/usr/bin/env node
'use strict';

/**
 * CoTravel E2E Integration Tests — Orchestrator
 *
 * Deploys a fresh Soroban contract on testnet, creates an isolated PostgreSQL
 * database, boots the Express app in-process, and runs every test scenario
 * with real on-chain transactions.
 *
 * Usage:
 *   npm run test:integration          (from backend/)
 *   node tests/integration/run.js     (direct)
 *
 * Pre-requisites:
 *   - Docker containers running (postgres, minio)
 *   - Contract WASM built:  docker exec -it impacta-soroban-dev make build
 */

// ─── Environment (MUST be set before any backend module is required) ─────────

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
process.env.SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
process.env.SOROBAN_NETWORK_PASSPHRASE = process.env.SOROBAN_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
process.env.MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
process.env.MINIO_PORT = process.env.MINIO_PORT || '9000';
process.env.MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
process.env.MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin123';

// ─── Imports (safe — no backend modules yet) ────────────────────────────────

const path = require('path');
const fs = require('fs');
const {Pool} = require('pg');
const {generateKeypair, fundAccount, deployContract} = require('./stellar');
const {ApiClient} = require('./api');
const scenarios = require('./scenarios');

// ─── Config ──────────────────────────────────────────────────────────────────
// Parse DB connection from DATABASE_URL (Docker) or individual env vars (local)

let DB_HOST, DB_PORT, DB_USER, DB_PASS, MAIN_DB;
if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    DB_HOST = u.hostname;
    DB_PORT = u.port || '5432';
    DB_USER = decodeURIComponent(u.username);
    DB_PASS = decodeURIComponent(u.password);
    MAIN_DB = u.pathname.slice(1); // strip leading /
} else {
    DB_HOST = process.env.DB_HOST || 'localhost';
    DB_PORT = process.env.DB_PORT || '5432';
    DB_USER = process.env.DB_USER || 'impacta';
    DB_PASS = process.env.DB_PASS || 'impacta123';
    MAIN_DB = process.env.DB_NAME || 'impacta_db';
}
const INTEGRATION_DB = 'impacta_integration';

const WASM_PATH = process.env.WASM_PATH
    || path.resolve(__dirname, '../../../contracts/target/wasm32v1-none/release/cotravel_escrow.wasm');
const INIT_SQL_PATH = process.env.INIT_SQL_PATH
    || path.resolve(__dirname, '../../../database/init.sql');

// ─── Colors ──────────────────────────────────────────────────────────────────

const G = '\x1b[32m';   // green
const R = '\x1b[31m';   // red
const Y = '\x1b[33m';   // yellow
const C = '\x1b[36m';   // cyan
const B = '\x1b[1m';    // bold
const X = '\x1b[0m';    // reset

// ─── Database helpers ────────────────────────────────────────────────────────

function mainConnStr() {
    return `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${MAIN_DB}`;
}

function integrationConnStr() {
    return `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${INTEGRATION_DB}`;
}

async function createIntegrationDb() {
    const pool = new Pool({connectionString: mainConnStr()});
    try {
        // Kill lingering connections
        await pool.query(
            `SELECT pg_terminate_backend(pid)
             FROM pg_stat_activity
             WHERE datname = $1
               AND pid <> pg_backend_pid()`, [INTEGRATION_DB],
        );
        await pool.query(`DROP DATABASE IF EXISTS ${INTEGRATION_DB}`);
        await pool.query(`CREATE DATABASE ${INTEGRATION_DB}`);
    } finally {
        await pool.end();
    }

    // Run schema
    const schemaPool = new Pool({connectionString: integrationConnStr()});
    try {
        const sql = fs.readFileSync(INIT_SQL_PATH, 'utf-8');
        await schemaPool.query(sql);
    } finally {
        await schemaPool.end();
    }
}

async function dropIntegrationDb() {
    // Close the app's pool first (it was loaded with our DATABASE_URL)
    try {
        const appPool = require('../../src/config/db');
        await appPool.end();
    } catch { /* may not be loaded */
    }

    const pool = new Pool({connectionString: mainConnStr()});
    try {
        await pool.query(
            `SELECT pg_terminate_backend(pid)
             FROM pg_stat_activity
             WHERE datname = $1
               AND pid <> pg_backend_pid()`, [INTEGRATION_DB],
        );
        await pool.query(`DROP DATABASE IF EXISTS ${INTEGRATION_DB}`);
    } finally {
        await pool.end();
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const t0 = Date.now();
    let totalPass = 0;
    let totalFail = 0;

    console.log('');
    console.log(`${C}══════════════════════════════════════════════════════${X}`);
    console.log(`${C}  CoTravel E2E Integration Tests (Real Contract)${X}`);
    console.log(`${C}══════════════════════════════════════════════════════${X}`);
    console.log('');

    try {
        // ── 1. Database ──────────────────────────────────────────────────
        console.log(`${Y}[Setup]${X} Creating integration database…`);
        await createIntegrationDb();
        process.env.DATABASE_URL = integrationConnStr();
        console.log(`${Y}[Setup]${X} Database ${B}${INTEGRATION_DB}${X} ready`);

        // ── 2. Stellar accounts ──────────────────────────────────────────
        console.log(`${Y}[Setup]${X} Generating 7 Stellar keypairs…`);
        const accounts = {
            hotelOwner: {keypair: generateKeypair()},
            tourOwner: {keypair: generateKeypair()},
            organizer: {keypair: generateKeypair()},
            participant1: {keypair: generateKeypair()},
            participant2: {keypair: generateKeypair()},
            participant3: {keypair: generateKeypair()},
            participant4: {keypair: generateKeypair()},
        };

        console.log(`${Y}[Setup]${X} Funding accounts via Friendbot…`);
        await Promise.all(
            Object.entries(accounts).map(async ([name, acc]) => {
                await fundAccount(acc.keypair.publicKey());
                console.log(`  ${G}✓${X} ${name}: ${acc.keypair.publicKey().slice(0, 16)}…`);
            }),
        );

        // ── 3. Deploy contract ───────────────────────────────────────────
        let contractId;
        if (process.env.CONTRACT_ID) {
            // Use a pre-deployed contract (e.g. deployed via soroban CLI)
            contractId = process.env.CONTRACT_ID;
            console.log(`${Y}[Setup]${X} Using pre-deployed contract: ${B}${contractId}${X}`);
        } else {
            console.log(`${Y}[Setup]${X} Deploying fresh contract to testnet via SDK…`);
            if (!fs.existsSync(WASM_PATH)) {
                throw new Error(
                    `WASM not found at ${WASM_PATH}\n` +
                    `  Build it first:\n` +
                    `    docker exec -it impacta-soroban-dev make build`,
                );
            }
            contractId = await deployContract(accounts.organizer.keypair, WASM_PATH);
            process.env.CONTRACT_ID = contractId;
            console.log(`${Y}[Setup]${X} Contract ID: ${B}${contractId}${X}`);
        }

        // ── 4. Express app (loaded AFTER env vars are set) ───────────────
        console.log(`${Y}[Setup]${X} Loading Express app in-process…`);
        const app = require('../../src/app');
        const api = new ApiClient(app);

        // ── 5. Authenticate all users ────────────────────────────────────
        console.log(`${Y}[Setup]${X} Authenticating users…`);
        for (const [name, acc] of Object.entries(accounts)) {
            const {token, user} = await api.authenticate(acc.keypair);
            acc.token = token;
            acc.user = user;
            console.log(`  ${G}✓${X} ${name} (user.id=${user.id})`);
        }

        // ── 6. Businesses & services ─────────────────────────────────────
        console.log(`${Y}[Setup]${X} Creating businesses & services…`);

        const hotelBusiness = await api.createBusiness(accounts.hotelOwner.token, {
            name: 'Andean Summit Hotel',
            category: 'hotel',
            description: 'Luxury mountain hotel in the Colombian Andes',
            wallet_address: accounts.hotelOwner.keypair.publicKey(),
            contact_email: 'reservas@andeansummit.co',
        });

        const tourBusiness = await api.createBusiness(accounts.tourOwner.token, {
            name: 'Colombia Adventure Tours',
            category: 'tourism',
            description: 'Eco-tourism and adventure experiences',
            wallet_address: accounts.tourOwner.keypair.publicKey(),
            contact_email: 'info@colombiaadventure.co',
        });

        const hotelRoom = await api.createService(accounts.hotelOwner.token, {
            business_id: hotelBusiness.id,
            name: 'Mountain View Room',
            description: 'Double room with mountain views',
            price: 3,
        });

        const hotelConference = await api.createService(accounts.hotelOwner.token, {
            business_id: hotelBusiness.id,
            name: 'Conference Room',
            description: 'Meeting room for 20 people',
            price: 2,
        });

        const tourDayTrip = await api.createService(accounts.tourOwner.token, {
            business_id: tourBusiness.id,
            name: 'Cocora Valley Day Trip',
            description: 'Full-day guided tour to Cocora Valley',
            price: 2,
        });

        const tourFarmVisit = await api.createService(accounts.tourOwner.token, {
            business_id: tourBusiness.id,
            name: 'Coffee Farm Experience',
            description: 'Half-day coffee farm visit with tasting',
            price: 1.5,
        });

        console.log(`  ${G}✓${X} Hotel: id=${hotelBusiness.id} (Room=${hotelRoom.id}, Conference=${hotelConference.id})`);
        console.log(`  ${G}✓${X} Tour:  id=${tourBusiness.id} (DayTrip=${tourDayTrip.id}, Farm=${tourFarmVisit.id})`);
        console.log('');

        // ── Context passed to every scenario ─────────────────────────────
        const context = {
            api,
            contractId,
            accounts,
            businesses: {hotel: hotelBusiness, tour: tourBusiness},
            services: {hotelRoom, hotelConference, tourDayTrip, tourFarmVisit},
        };

        // ── 7. Run scenarios ─────────────────────────────────────────────
        const scenarioList = [
            {name: 'Happy Path (Release)', fn: scenarios.happyPathRelease},
            {name: 'Withdrawal with Penalty', fn: scenarios.withdrawalWithPenalty},
            {name: 'Cancel with Refund', fn: scenarios.cancelWithRefund},
            {name: 'Auto-Release', fn: scenarios.autoRelease},
            {name: 'Confirm Release (Unanimous)', fn: scenarios.confirmRelease},
            {name: 'Update Recipients + Free Opt-Out', fn: scenarios.updateRecipientsOptOut},
            {name: 'Overfunding Rejection', fn: scenarios.overfundingRejection},
        ];

        for (let i = 0; i < scenarioList.length; i++) {
            const {name, fn} = scenarioList[i];
            console.log(`${C}[Scenario ${i + 1}/${scenarioList.length}]${X} ${name}`);
            try {
                const result = await fn(context);
                totalPass += result.pass;
                totalFail += result.fail;
                const color = result.fail === 0 ? G : R;
                console.log(`  ${color}→ ${result.pass} passed, ${result.fail} failed${X}`);
            } catch (err) {
                totalFail++;
                console.log(`  ${R}✗ SCENARIO CRASHED: ${err.message}${X}`);
                if (err.stack) {
                    const frames = err.stack.split('\n').slice(1, 4).join('\n');
                    console.log(`    ${frames}`);
                }
            }
            console.log('');
        }

    } catch (err) {
        console.error(`\n${R}[FATAL]${X} ${err.message}`);
        if (err.stack) console.error(err.stack);
        totalFail++;
    } finally {
        // ── Cleanup ──────────────────────────────────────────────────────
        console.log(`${Y}[Cleanup]${X} Dropping integration database…`);
        try {
            await dropIntegrationDb();
            console.log(`${Y}[Cleanup]${X} Done`);
        } catch (err) {
            console.error(`${Y}[Cleanup]${X} Warning: ${err.message}`);
        }
    }

    // ── Summary ──────────────────────────────────────────────────────────
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`${C}══════════════════════════════════════════════════════${X}`);
    console.log(`  ${B}Total assertions: ${totalPass + totalFail}${X}`);
    console.log(`  ${G}Passed: ${totalPass}${X}`);
    console.log(`  ${totalFail > 0 ? R : G}Failed: ${totalFail}${X}`);
    console.log(`  Time: ${elapsed}s`);
    console.log(`${C}══════════════════════════════════════════════════════${X}`);
    console.log('');

    process.exit(totalFail > 0 ? 1 : 0);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

main();
