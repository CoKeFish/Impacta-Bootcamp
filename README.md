<p align="center">
  <img src="assets/logo-placeholder.svg" alt="CoTravel Logo" width="400" />
</p>

<h3 align="center">The simplest way to organize group trips and manage shared budgets with blockchain escrow</h3>

<p align="center">
  <a href="https://stellar.org"><img src="https://img.shields.io/badge/Built%20on-Stellar-blue?style=flat-square" alt="Built on Stellar" /></a>
  <a href="https://soroban.stellar.org"><img src="https://img.shields.io/badge/Smart%20Contracts-Soroban-blueviolet?style=flat-square" alt="Soroban" /></a>
  <img src="https://img.shields.io/badge/Status-Prototype-orange?style=flat-square" alt="Status: Prototype" />
</p>

---

> **Stellar Give x Stellar Impacta Bootcamp** -- This project is developed as part of the **Stellar Give** initiative
> within the **Stellar Impacta Bootcamp**, a program by the Stellar Community Fund focused on building real-world
> blockchain solutions on the Stellar network.

---

## Problem

When we plan trips with friends, coordinating budgets, collecting money, and enforcing payment deadlines is messy and
stressful. We end up using chats and spreadsheets, which creates trust issues, late payments, disputes, and complicated
cancellations/refunds -- when someone drops out it often causes the whole trip to fail and everyone loses time, money,
and good booking deals.

## Solution

CoTravel is a group trip planning platform that uses a **Soroban smart contract** to collect everyone's contributions
toward a shared budget, track payment milestones transparently, and enforce fair rules if someone drops out. Once the
group reaches the target amount and minimum participants, funds are held in escrow and can be used to pay travel
services through partner discounts or withdrawn to external wallets.

## Unique Value Proposition

We make group trips easy and trustworthy by automating shared payments with a smart contract: everyone sees progress in
real time, rules are enforced fairly if someone drops out, and the group unlocks partner travel discounts once the
budget is reached.

## Audience

| Segment                         | Description                                                                                 |
|---------------------------------|---------------------------------------------------------------------------------------------|
| Friend groups (18-35)           | Planning trips together, need a drama-free way to collect and manage contributions          |
| Trip organizers / group leaders | Coordinate budgets, deadlines, and rules -- want full transparency                          |
| Repeat group travelers          | Graduation trips, festivals, weekend getaways -- multiple trips per year                    |
| Partner businesses              | Hotels, restaurants, transport, tours -- pay for exposure and commissions to attract groups |

## Architecture

```
CoTravel/
├── contracts/escrow/     # Soroban smart contract (Rust) - Multi-escrow
├── backend/              # Node.js + Express API
├── frontend/             # React + Vite + TailwindCSS
├── database/             # PostgreSQL schema
└── docker-compose.yml    # Full local environment
```

| Component      | Technology              | Purpose                                       |
|----------------|-------------------------|-----------------------------------------------|
| Backend        | Node.js + Express       | REST API, business logic, partner integration |
| Database       | PostgreSQL              | Users, groups, trips, transactions            |
| Storage        | MinIO (S3 compatible)   | Profile images, trip photos                   |
| Smart Contract | Soroban (Rust)          | Escrow, milestones, automated refunds         |
| Blockchain     | Stellar Network         | Transactions, group wallets                   |
| Frontend       | React + Vite + Tailwind | User interface, wallet integration            |
| Auth           | Freighter (SEP-0053)    | Challenge-response wallet authentication      |

### Authentication Flow

Challenge-response with Stellar wallet signature (SEP-0053) + JWT:

1. Frontend requests challenge from backend
2. User signs message with Freighter wallet (`signMessage`)
3. Backend verifies signature using SEP-0053 (prefix + SHA-256 + Ed25519)
4. Backend returns JWT (24h) + user data

### Smart Contract - Multi-Escrow

A single deployed contract manages N independent trips via `trip_id`:

| Function      | Description                                      |
|---------------|--------------------------------------------------|
| `create_trip` | Create trip, returns `trip_id`                   |
| `contribute`  | Add funds (auto-completes if target reached)     |
| `withdraw`    | Leave with penalty redistributed to group        |
| `release`     | Release funds to organizer (only when Completed) |
| `cancel`      | Cancel and refund all (no penalty)               |

**Deployed on Testnet:**

- Contract: `CBZJNP3KVSWCTRQJNF6Y5P55WDIGZ5JSABKDZ4RBGLFUMFZQK5BKFBIC`
- Token (XLM SAC): `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Freighter wallet extension (for frontend)

### Run Locally

```bash
# Start all services
docker compose up -d

# Run backend tests (49 tests, 6 suites)
docker compose exec backend npm test
```

| Service    | Port        | Description         |
|------------|-------------|---------------------|
| Backend    | 3000        | REST API            |
| Frontend   | 5173        | Vite dev server     |
| PostgreSQL | 5432        | Relational database |
| MinIO      | 9000 / 9001 | Object storage      |

## Business Model

1. **Transaction fees** (large trips only): small fee on trips with high total budget or many participants
2. **Partner commissions** (B2B2C): earn commission when groups book hotels, transport, restaurants through the platform
3. **Premium partner placement** (optional): businesses pay for featured offers inside trip recommendations

## Market & Timing

Group travel is a massive, recurring market driven by friends and family planning trips together. Wallets and smart
contracts have matured enough to automate group commitments, milestones, refunds, and penalties without needing everyone
to "trust the organizer." Travel businesses are actively looking for new distribution channels and are willing to offer
discounts to platforms that bring verified group demand.

## Key Metrics

- Active groups created per week and % that reach minimum group size
- Total value locked (TVL) in group trip wallets
- Contribution completion rate
- Trip completion rate (groups that book after hitting the goal)
- Partner traction: active partners, offers live, conversion rate
- Retention: users who start a second trip within 60-90 days

## Quick Profile

|              |                                      |
|--------------|--------------------------------------|
| **Location** | Bogota, Colombia                     |
| **Network**  | Stellar                              |
| **Stage**    | Prototype / Idea                     |
| **Sector**   | Web3                                 |
| **Type**     | SaaS                                 |
| **LinkedIn** | https://www.linkedin.com/in/cotravel |
| **X**        | https://x.com/CoTraveel              |

## Documentation

- [Technical Architecture](ARCHITECTURE.md) - Detailed system design, flows, and data model
- [Backend API](backend/README.md) - API endpoints, setup, and testing
- [Smart Contract](contracts/escrow/README.md) - Soroban contract documentation

---

<p align="center">
  Built with Stellar &bull; Soroban &bull; Freighter<br/>
  <strong>Stellar Give x Stellar Impacta Bootcamp</strong>
</p>
