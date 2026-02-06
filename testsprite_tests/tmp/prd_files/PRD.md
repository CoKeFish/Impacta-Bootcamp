# CoTravel - Product Requirements Document

## 1. Overview

CoTravel is a group travel budgeting platform that combines off-chain coordination with on-chain escrow via
Stellar/Soroban smart contracts. Users organize trips, collect contributions into a shared budget, and enforce fair
rules (penalties for dropouts, automatic refunds on cancellation) through blockchain-based escrow.

### 1.1 Problem Statement

Organizing group travel budgets is fragmented and trust-dependent. Money is typically held by one person, there's no
transparency on contributions, and dropouts leave the group financially impacted with no recourse.

### 1.2 Solution

A web platform where:

- Trip organizers create budgets with clear rules (target amount, minimum participants, penalty for withdrawal,
  deadline)
- Contributions are held in a Soroban smart contract (not by any individual)
- Withdrawal penalties are automatically redistributed to remaining participants
- Organizers can release funds when the trip is confirmed or cancel for full refunds

## 2. User Personas

### 2.1 Trip Organizer

- Creates trips with budget parameters
- Links trips to the on-chain escrow contract
- Releases funds when ready or cancels if needed
- Needs: simple trip creation, clear status dashboard, organizer-only controls

### 2.2 Trip Participant

- Browses available trips
- Joins and contributes funds via wallet
- Can withdraw (with penalty) if plans change
- Needs: transparent budget tracking, easy contribution flow, fair penalty visibility

## 3. Functional Requirements

### 3.1 Authentication

| ID     | Requirement                                                                                            | Priority |
|--------|--------------------------------------------------------------------------------------------------------|----------|
| AUTH-1 | Users authenticate by connecting a Stellar wallet (Freighter extension)                                | P0       |
| AUTH-2 | Backend issues challenge string, user signs with wallet, backend verifies and returns JWT (24h expiry) | P0       |
| AUTH-3 | JWT is persisted in localStorage and sent as Bearer token on protected requests                        | P0       |
| AUTH-4 | Users can disconnect wallet to log out                                                                 | P0       |
| AUTH-5 | New users are auto-created on first login                                                              | P1       |

### 3.2 Trip Management

| ID     | Requirement                                                                                                                          | Priority |
|--------|--------------------------------------------------------------------------------------------------------------------------------------|----------|
| TRIP-1 | Authenticated users can create trip drafts with: name, description, target amount (XLM), min participants, penalty percent, deadline | P0       |
| TRIP-2 | Anyone can browse all trips in a dashboard view                                                                                      | P0       |
| TRIP-3 | Anyone can view trip details including: budget progress, participant list, status, deadline                                          | P0       |
| TRIP-4 | Organizer can link trip to Soroban contract by submitting signed create_trip XDR                                                     | P0       |
| TRIP-5 | Organizer can release funds (Completed status) by submitting signed release XDR                                                      | P0       |
| TRIP-6 | Organizer can cancel trip (any status) by submitting signed cancel XDR, triggering full refunds                                      | P0       |
| TRIP-7 | Trip detail page shows on-chain state when contract is linked                                                                        | P1       |

### 3.3 Participation

| ID     | Requirement                                                                            | Priority |
|--------|----------------------------------------------------------------------------------------|----------|
| PART-1 | Authenticated users can join a trip                                                    | P0       |
| PART-2 | Participants can contribute funds by submitting signed contribute XDR with amount      | P0       |
| PART-3 | Participants can withdraw by submitting signed withdraw XDR (penalty applied on-chain) | P0       |
| PART-4 | Non-participants are auto-joined on first contribution                                 | P1       |
| PART-5 | Participant list shows wallet/username and contributed amount                          | P0       |

### 3.4 Image Management

| ID    | Requirement                               | Priority |
|-------|-------------------------------------------|----------|
| IMG-1 | Users can upload images (stored in MinIO) | P2       |
| IMG-2 | Images can be associated with trips       | P2       |
| IMG-3 | Images can be retrieved by filename       | P2       |
| IMG-4 | All images can be listed                  | P2       |

### 3.5 User Profile

| ID     | Requirement                                                              | Priority |
|--------|--------------------------------------------------------------------------|----------|
| PROF-1 | Authenticated users can view their profile (wallet, username, join date) | P1       |
| PROF-2 | Profile shows trips organized by the user                                | P1       |
| PROF-3 | Profile shows trips the user participates in                             | P1       |

## 4. Non-Functional Requirements

### 4.1 Performance

- Frontend loads in under 3 seconds on broadband
- API responses under 500ms for database operations
- Soroban transaction confirmation within 30 seconds

### 4.2 Security

- Funds held in smart contract, never in backend
- Frontend signs all transactions; backend only relays signed XDR
- JWT with 24h expiry; challenge nonces expire in 5 minutes
- No private keys stored server-side

### 4.3 Reliability

- Health endpoint monitors both database and storage connectivity
- Backend gracefully handles Soroban RPC failures (on-chain sync is best-effort)
- Transaction rollback-based test isolation ensures database integrity

## 5. Technical Architecture

### 5.1 Stack

| Layer          | Technology                                     |
|----------------|------------------------------------------------|
| Frontend       | React 19 + Vite 6 + TypeScript                 |
| UI             | shadcn/ui + Tailwind CSS 3                     |
| State          | Zustand 5 (client) + TanStack Query 5 (server) |
| Routing        | React Router 7 (SPA mode)                      |
| Wallet         | @stellar/freighter-api                         |
| Backend        | Node.js + Express.js                           |
| Database       | PostgreSQL 16                                  |
| Storage        | MinIO (S3-compatible)                          |
| Blockchain     | Soroban (Stellar) via @stellar/stellar-sdk     |
| Auth           | JWT (jsonwebtoken) + Stellar wallet signatures |
| Testing        | Jest + Supertest (48 integration tests)        |
| Infrastructure | Docker Compose                                 |

### 5.2 Frontend Pages

| Route        | Page                                 | Auth Required             |
|--------------|--------------------------------------|---------------------------|
| `/`          | Landing (hero + features + CTAs)     | No                        |
| `/trips`     | Dashboard (trip cards with progress) | No                        |
| `/trips/new` | Create Trip (form)                   | Yes                       |
| `/trips/:id` | Trip Detail (stats + participants)   | No (actions require auth) |
| `/profile`   | User Profile                         | Yes                       |

### 5.3 Backend Endpoints (18 total)

| Method | Route                          | Auth      | Purpose                      |
|--------|--------------------------------|-----------|------------------------------|
| GET    | `/`                            | -         | API version info             |
| GET    | `/health`                      | -         | DB + storage health check    |
| GET    | `/api/auth/challenge`          | -         | Get challenge for wallet     |
| POST   | `/api/auth/login`              | -         | Verify signature, return JWT |
| GET    | `/api/auth/me`                 | JWT       | Current user                 |
| POST   | `/api/users`                   | -         | Create user                  |
| GET    | `/api/users/:wallet`           | -         | Lookup by wallet             |
| GET    | `/api/trips`                   | -         | List trips                   |
| POST   | `/api/trips`                   | JWT       | Create trip draft            |
| GET    | `/api/trips/:id`               | -         | Trip detail + on-chain state |
| GET    | `/api/trips/:id/participants`  | -         | List participants            |
| POST   | `/api/trips/:id/join`          | JWT       | Join trip                    |
| POST   | `/api/trips/:id/contribute`    | JWT       | Submit contribution XDR      |
| POST   | `/api/trips/:id/withdraw`      | JWT       | Submit withdrawal XDR        |
| POST   | `/api/trips/:id/link-contract` | Organizer | Link to Soroban contract     |
| POST   | `/api/trips/:id/release`       | Organizer | Release funds                |
| POST   | `/api/trips/:id/cancel`        | Organizer | Cancel and refund            |
| POST   | `/images/upload`               | -         | Upload image to MinIO        |
| GET    | `/images/:filename`            | -         | Retrieve image               |
| GET    | `/images`                      | -         | List images                  |

### 5.4 Database Schema (7 tables)

- **users**: wallet_address (UK), username, avatar_url
- **trips**: organizer_id (FK), contract_trip_id, name, target_amount, status, etc.
- **trip_participants**: trip_id + user_id (UK), contributed_amount, status
- **transactions**: tx_hash (UK), type, amount, ledger_sequence, event_data
- **partners**: name, category, discount_percent (future feature)
- **trip_offers**: trip_id + partner_id (UK), pricing (future feature)
- **images**: filename, mimetype, size, trip_id, uploaded_by

### 5.5 Smart Contract (Multi-Escrow)

Single Soroban contract managing N trips via trip_id. Functions:

- `create_trip(organizer, token, target, min_participants, deadline, penalty)` -> trip_id
- `contribute(trip_id, participant, amount)`
- `withdraw(trip_id, participant)` (with penalty redistribution)
- `release(trip_id)` (organizer only, Completed status)
- `cancel(trip_id)` (organizer only, full refund)
- Read-only: `get_trip_count`, `get_trips`, `get_trip`, `get_state`, `get_balance`, `get_participants`

## 6. Trip Lifecycle

```
[Draft] --link-contract--> [Funding] --target+min met--> [Completed]
                              |                               |
                              +---cancel--> [Cancelled]       +---release--> [Released]
                                                              +---cancel---> [Cancelled]
                              [Completed] --withdraw below threshold--> [Funding]
```

## 7. Success Metrics

- Users can complete full flow: connect wallet -> create trip -> link contract -> contribute -> release
- 48 backend integration tests passing
- Frontend compiles with zero TypeScript errors
- Production build under 600KB gzipped
- All Docker services start and pass health checks

## 8. Out of Scope (Future)

- Partners and trip offers module (DB schema exists, no backend/frontend code)
- OAuth providers (Google, Facebook) - backend has placeholders
- Mobile wallet support (WalletConnect)
- Real-time notifications
- Soroban event indexer
- Invitation links
