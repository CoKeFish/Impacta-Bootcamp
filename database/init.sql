-- ============================================================================
-- CoTravel Database Schema
-- ============================================================================
-- Este archivo inicializa la base de datos con todas las tablas necesarias.
-- Compatible con PostgreSQL 16+ (local) y Supabase (producción).
--
-- Alineado con el contrato Soroban CotravelEscrow:
--   - invoices       -> Pool/Invoice (Config + State)
--   - invoice_items  -> Vec<Recipient>
--   - invoice_participants -> Balances + ContribVersions + PenaltyPool + Confirmations
--   - invoice_modifications -> Historial de update_recipients
-- ============================================================================

-- Limpiar tablas existentes (para desarrollo)
DROP TABLE IF EXISTS invoice_modifications CASCADE;
DROP TABLE IF EXISTS invoice_participants CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- USUARIOS
-- ============================================================================
-- Almacena perfiles de usuarios. La wallet_address vincula con on-chain.

CREATE TABLE users
(
    id             SERIAL PRIMARY KEY,
    wallet_address VARCHAR(56) UNIQUE NOT NULL, -- Stellar public key (G...)
    username       VARCHAR(100),
    avatar_url     TEXT,
    role VARCHAR(20) DEFAULT 'user',            -- user / admin
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT
ON TABLE users IS 'Perfiles de usuarios de la plataforma';
COMMENT
ON COLUMN users.wallet_address IS 'Clave pública de Stellar - vínculo con on-chain';

-- ============================================================================
-- EMPRESAS
-- ============================================================================
-- Empresas que ofrecen servicios. Cada empresa tiene una wallet para recibir pagos.

CREATE TABLE businesses
(
    id             SERIAL PRIMARY KEY,
    owner_id       INTEGER REFERENCES users (id),
    name           VARCHAR(255) NOT NULL,
    category       VARCHAR(100),
    description    TEXT,
    logo_url       TEXT,
    wallet_address VARCHAR(56),
    contact_email  VARCHAR(255),
    active         BOOLEAN   DEFAULT true,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT
ON TABLE businesses IS 'Empresas que ofrecen servicios y reciben pagos via Stellar';
COMMENT
ON COLUMN businesses.wallet_address IS 'Wallet Stellar donde recibe pagos del escrow';

-- ============================================================================
-- SERVICIOS
-- ============================================================================
-- Catálogo de servicios ofrecidos por empresas.

CREATE TABLE services
(
    id          SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses (id) ON DELETE CASCADE,
    name        VARCHAR(255)   NOT NULL,
    description TEXT,
    price       DECIMAL(20, 7) NOT NULL,
    image_url TEXT,
    active      BOOLEAN   DEFAULT true,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT
ON TABLE services IS 'Catálogo de servicios ofrecidos por empresas';

-- ============================================================================
-- FACTURAS (invoices)
-- ============================================================================
-- Una factura agrupa line items de servicios. Un grupo paga colectivamente.
-- Mapea al Pool/Invoice del contrato Soroban (create_invoice).
--
-- Contrato Config: organizer, token, target_amount, min_participants,
--                  deadline, penalty_percent, auto_release
-- Contrato State:  status, total_collected, participant_count, version,
--                  confirmation_count

CREATE TABLE invoices
(
    id                  SERIAL PRIMARY KEY,
    organizer_id        INTEGER REFERENCES users (id),
    contract_invoice_id BIGINT,

    name                VARCHAR(255)   NOT NULL,
    description         TEXT,
    icon VARCHAR(10),                                   -- Emoji/icono para identificación visual

    -- Config del contrato
    total_amount        DECIMAL(20, 7) NOT NULL,
    token_address       VARCHAR(56),                    -- Config.token
    min_participants    INTEGER        DEFAULT 1,
    penalty_percent     INTEGER        DEFAULT 10,
    deadline            TIMESTAMP,
    auto_release        BOOLEAN        DEFAULT false,   -- Config.auto_release

    -- State del contrato
    status              VARCHAR(50)    DEFAULT 'draft', -- Status enum
    total_collected     DECIMAL(20, 7) DEFAULT 0,
    participant_count   INTEGER        DEFAULT 0,
    version             INTEGER        DEFAULT 0,
    confirmation_count  INTEGER        DEFAULT 0,       -- State.confirmation_count

    created_at          TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

COMMENT
ON TABLE invoices IS 'Facturas grupales con distribución a múltiples destinatarios';
COMMENT
ON COLUMN invoices.contract_invoice_id IS 'trip_id en el contrato Soroban';
COMMENT
ON COLUMN invoices.token_address IS 'Token Stellar usado para pagos (e.g. USDC contract address)';
COMMENT
ON COLUMN invoices.auto_release IS 'Si true, fondos se liberan automáticamente al alcanzar el target';
COMMENT
ON COLUMN invoices.status IS 'draft/funding/completed/cancelled/released';
COMMENT
ON COLUMN invoices.version IS 'Se incrementa al modificar items (update_recipients), habilita opt-out';
COMMENT
ON COLUMN invoices.confirmation_count IS 'Participantes que confirmaron el release (confirm_release)';

-- ============================================================================
-- ITEMS DE FACTURA
-- ============================================================================
-- Cada line item puede venir de un servicio del catálogo o ser custom.
-- Mapea a Vec<Recipient> en el contrato (address + amount).

CREATE TABLE invoice_items
(
    id               SERIAL PRIMARY KEY,
    invoice_id       INTEGER REFERENCES invoices (id) ON DELETE CASCADE,
    service_id       INTEGER        REFERENCES services (id) ON DELETE SET NULL,
    description      VARCHAR(255)   NOT NULL,
    amount           DECIMAL(20, 7) NOT NULL,
    recipient_wallet VARCHAR(56), -- Recipient.address en el contrato
    sort_order       INTEGER   DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT
ON TABLE invoice_items IS 'Line items de una factura - mapea a Vec<Recipient> del contrato';
COMMENT
ON COLUMN invoice_items.recipient_wallet IS 'Wallet Stellar que recibe este monto al hacer release';

-- ============================================================================
-- PARTICIPANTES DE FACTURA
-- ============================================================================
-- Mapea a múltiples storages del contrato por participante:
--   Balances(trip_id)        -> contributed_amount
--   ContribVersions(trip_id) -> contributed_at_version
--   PenaltyPool(trip_id)     -> penalty_amount
--   Confirmations(trip_id)   -> confirmed_release

CREATE TABLE invoice_participants
(
    id                     SERIAL PRIMARY KEY,
    invoice_id             INTEGER REFERENCES invoices (id) ON DELETE CASCADE,
    user_id                INTEGER REFERENCES users (id),
    contributed_amount     DECIMAL(20, 7) DEFAULT 0,
    contributed_at_version INTEGER        DEFAULT 0,        -- ContribVersions
    penalty_amount         DECIMAL(20, 7) DEFAULT 0,        -- PenaltyPool
    confirmed_release      BOOLEAN        DEFAULT false,    -- Confirmations
    status                 VARCHAR(50)    DEFAULT 'active', -- active/withdrawn
    joined_at              TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (invoice_id, user_id)
);

COMMENT
ON TABLE invoice_participants IS 'Participantes que contribuyen a una factura grupal';
COMMENT
ON COLUMN invoice_participants.contributed_at_version IS 'Versión de la factura al contribuir - si < invoice.version, retiro sin penalidad';
COMMENT
ON COLUMN invoice_participants.penalty_amount IS 'Penalidad acumulada por retiro (PenaltyPool en contrato)';
COMMENT
ON COLUMN invoice_participants.confirmed_release IS 'Si confirmó el release de fondos (Confirmations en contrato)';
COMMENT
ON COLUMN invoice_participants.status IS 'active/withdrawn';

-- ============================================================================
-- MODIFICACIONES DE FACTURA
-- ============================================================================
-- Historial de cambios para auditoría y notificación.
-- Se crea cuando el organizador llama update_recipients en el contrato.
-- El contrato emite InvoiceModifiedEvent con trip_id y version.

CREATE TABLE invoice_modifications
(
    id             SERIAL PRIMARY KEY,
    invoice_id     INTEGER REFERENCES invoices (id) ON DELETE CASCADE,
    version        INTEGER NOT NULL,
    change_summary TEXT,
    items_snapshot JSONB,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT
ON TABLE invoice_modifications IS 'Historial de modificaciones de una factura (update_recipients)';

-- ============================================================================
-- TRANSACCIONES
-- ============================================================================
-- Registro off-chain de transacciones blockchain para indexación y auditoría.
-- Captura eventos del contrato: TripCreatedEvent, ContributionEvent,
-- WithdrawalEvent, ReleasedEvent, CancelledEvent, ConfirmReleaseEvent,
-- InvoiceModifiedEvent, DeadlineExpiredEvent.

CREATE TABLE transactions
(
    id              SERIAL PRIMARY KEY,
    invoice_id      INTEGER REFERENCES invoices (id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users (id),
    tx_hash         VARCHAR(64) UNIQUE NOT NULL,
    type            VARCHAR(50)        NOT NULL,
    amount          DECIMAL(20, 7)     NOT NULL,
    ledger_sequence INTEGER,
    event_data      JSONB,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT
ON TABLE transactions IS 'Registro off-chain de transacciones blockchain';
COMMENT
ON COLUMN transactions.type IS 'create/contribute/withdraw/release/cancel/confirm_release/update_recipients/claim_deadline';

-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Users
CREATE INDEX idx_users_wallet ON users (wallet_address);

-- Businesses
CREATE INDEX idx_businesses_owner ON businesses (owner_id);
CREATE INDEX idx_businesses_category ON businesses (category);
CREATE INDEX idx_businesses_wallet ON businesses (wallet_address);

-- Services
CREATE INDEX idx_services_business ON services (business_id);
CREATE INDEX idx_services_active ON services (active) WHERE active = true;

-- Invoices
CREATE INDEX idx_invoices_organizer ON invoices (organizer_id);
CREATE INDEX idx_invoices_status ON invoices (status);
CREATE INDEX idx_invoices_contract ON invoices (contract_invoice_id);

-- Invoice Items
CREATE INDEX idx_invoice_items_invoice ON invoice_items (invoice_id);
CREATE INDEX idx_invoice_items_service ON invoice_items (service_id);

-- Invoice Participants
CREATE INDEX idx_invoice_participants_invoice ON invoice_participants (invoice_id);
CREATE INDEX idx_invoice_participants_user ON invoice_participants (user_id);

-- Invoice Modifications
CREATE INDEX idx_invoice_modifications_invoice ON invoice_modifications (invoice_id);

-- Transactions
CREATE INDEX idx_tx_invoice ON transactions (invoice_id);
CREATE INDEX idx_tx_user ON transactions (user_id);
CREATE INDEX idx_tx_hash ON transactions (tx_hash);
CREATE INDEX idx_tx_type ON transactions (type);

-- ============================================================================
-- DATOS DE PRUEBA (opcional - comentar en producción)
-- ============================================================================

-- Usuario de ejemplo
INSERT INTO users (wallet_address, username)
VALUES ('GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI', 'demo_user');

-- ============================================================================
-- FIN DEL SCHEMA
-- ============================================================================
