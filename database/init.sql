-- ============================================================================
-- CoTravel Database Schema
-- ============================================================================
-- Este archivo inicializa la base de datos con todas las tablas necesarias.
-- Compatible con PostgreSQL 16+ (local) y Supabase (producción).
-- ============================================================================

-- Limpiar tablas existentes (para desarrollo)
DROP TABLE IF EXISTS images CASCADE;
DROP TABLE IF EXISTS trip_offers CASCADE;
DROP TABLE IF EXISTS partners CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS trip_participants CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
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
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT
ON TABLE users IS 'Perfiles de usuarios de la plataforma';
COMMENT
ON COLUMN users.wallet_address IS 'Clave pública de Stellar - vínculo con on-chain';

-- ============================================================================
-- VIAJES
-- ============================================================================
-- Metadata de viajes. Los datos financieros reales están en el contrato.
-- contract_trip_id vincula con el contrato multi-escrow de Soroban.

CREATE TABLE trips
(
    id                SERIAL PRIMARY KEY,
    organizer_id      INTEGER REFERENCES users (id),
    contract_trip_id  BIGINT,                         -- trip_id del contrato Soroban
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    cover_image_url   TEXT,

    -- Cache del contrato (source of truth = on-chain)
    target_amount     DECIMAL(20, 7),                 -- En XLM (no stroops)
    min_participants  INTEGER,
    penalty_percent   INTEGER        DEFAULT 10,
    deadline          TIMESTAMP,
    status            VARCHAR(50)    DEFAULT 'draft', -- draft/funding/completed/cancelled/released
    total_collected   DECIMAL(20, 7) DEFAULT 0,
    participant_count INTEGER        DEFAULT 0,

    created_at        TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

COMMENT
ON TABLE trips IS 'Metadata de viajes grupales';
COMMENT
ON COLUMN trips.contract_trip_id IS 'ID del viaje en el contrato multi-escrow de Soroban';
COMMENT
ON COLUMN trips.status IS 'Cache del estado on-chain: draft/funding/completed/cancelled/released';

-- ============================================================================
-- PARTICIPANTES
-- ============================================================================
-- Relación usuarios-viajes. contributed_amount es cache del balance on-chain.

CREATE TABLE trip_participants
(
    id                 SERIAL PRIMARY KEY,
    trip_id            INTEGER REFERENCES trips (id) ON DELETE CASCADE,
    user_id            INTEGER REFERENCES users (id),

    -- Cache del contrato
    contributed_amount DECIMAL(20, 7) DEFAULT 0,

    -- Datos de UX (solo off-chain)
    joined_at          TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    status             VARCHAR(50)    DEFAULT 'active', -- active/withdrawn
    invitation_code    VARCHAR(50),

    UNIQUE (trip_id, user_id)
);

COMMENT
ON TABLE trip_participants IS 'Participantes de cada viaje';
COMMENT
ON COLUMN trip_participants.contributed_amount IS 'Cache del balance on-chain en XLM';

-- ============================================================================
-- TRANSACCIONES
-- ============================================================================
-- Índice de eventos on-chain para queries rápidas y historial.

CREATE TABLE transactions
(
    id              SERIAL PRIMARY KEY,
    trip_id         INTEGER REFERENCES trips (id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users (id),
    tx_hash         VARCHAR(64) UNIQUE NOT NULL, -- Hash de la transacción Stellar
    type            VARCHAR(50)        NOT NULL, -- contribution/withdrawal/release/cancel
    amount          DECIMAL(20, 7)     NOT NULL, -- En XLM

    -- Datos del evento indexado
    ledger_sequence INTEGER,
    event_data      JSONB,                       -- Payload completo del evento Soroban

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT
ON TABLE transactions IS 'Índice de transacciones on-chain para historial y queries';
COMMENT
ON COLUMN transactions.event_data IS 'Payload JSON del evento Soroban indexado';

-- ============================================================================
-- PARTNERS
-- ============================================================================
-- Empresas asociadas que ofrecen descuentos (hoteles, restaurantes, etc.)

CREATE TABLE partners
(
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    category         VARCHAR(100), -- hotel/transport/restaurant/experience
    description      TEXT,
    logo_url         TEXT,
    discount_percent DECIMAL(5, 2),
    contact_email    VARCHAR(255),
    active           BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT
ON TABLE partners IS 'Empresas asociadas que ofrecen descuentos';

-- ============================================================================
-- OFERTAS POR VIAJE
-- ============================================================================
-- Ofertas específicas de partners para cada viaje.

CREATE TABLE trip_offers
(
    id               SERIAL PRIMARY KEY,
    trip_id          INTEGER REFERENCES trips (id) ON DELETE CASCADE,
    partner_id       INTEGER REFERENCES partners (id),
    description      TEXT,
    original_price   DECIMAL(20, 7),
    discounted_price DECIMAL(20, 7),
    available        BOOLEAN DEFAULT true,
    valid_until      TIMESTAMP,

    UNIQUE (trip_id, partner_id)
);

COMMENT
ON TABLE trip_offers IS 'Ofertas de partners específicas para cada viaje';

-- ============================================================================
-- IMÁGENES
-- ============================================================================
-- Metadata de imágenes. Los archivos están en MinIO (local) o Supabase Storage (prod).

CREATE TABLE images
(
    id          SERIAL PRIMARY KEY,
    filename    VARCHAR(255) NOT NULL,
    mimetype    VARCHAR(100) NOT NULL,
    size        INTEGER      NOT NULL, -- Tamaño en bytes
    trip_id     INTEGER      REFERENCES trips (id) ON DELETE SET NULL,
    uploaded_by INTEGER REFERENCES users (id),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT
ON TABLE images IS 'Metadata de imágenes - archivos en MinIO/Supabase Storage';

-- ============================================================================
-- ÍNDICES
-- ============================================================================
-- Optimizados para queries frecuentes de la aplicación.

-- Users
CREATE INDEX idx_users_wallet ON users (wallet_address);

-- Trips
CREATE INDEX idx_trips_organizer ON trips (organizer_id);
CREATE INDEX idx_trips_status ON trips (status);
CREATE INDEX idx_trips_contract ON trips (contract_trip_id);

-- Participants
CREATE INDEX idx_participants_trip ON trip_participants (trip_id);
CREATE INDEX idx_participants_user ON trip_participants (user_id);

-- Transactions
CREATE INDEX idx_tx_trip ON transactions (trip_id);
CREATE INDEX idx_tx_user ON transactions (user_id);
CREATE INDEX idx_tx_hash ON transactions (tx_hash);
CREATE INDEX idx_tx_type ON transactions (type);

-- Partners & Offers
CREATE INDEX idx_partners_category ON partners (category);
CREATE INDEX idx_offers_trip ON trip_offers (trip_id);

-- Images
CREATE INDEX idx_images_trip ON images (trip_id);

-- ============================================================================
-- DATOS DE PRUEBA (opcional - comentar en producción)
-- ============================================================================

-- Usuario de ejemplo
INSERT INTO users (wallet_address, username)
VALUES ('GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI', 'demo_user');

-- Partner de ejemplo
INSERT INTO partners (name, category, discount_percent, description)
VALUES ('Hotel Demo', 'hotel', 15.00, 'Hotel de prueba para desarrollo');

-- ============================================================================
-- FIN DEL SCHEMA
-- ============================================================================
