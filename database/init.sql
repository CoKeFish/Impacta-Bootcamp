-- Inicialización de la base de datos

-- Tabla para guardar referencias de imágenes
CREATE TABLE IF NOT EXISTS images
(
    id
    SERIAL
    PRIMARY
    KEY,
    filename
    VARCHAR
(
    255
) NOT NULL,
    mimetype VARCHAR
(
    100
) NOT NULL,
    size INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Tabla de ejemplo para usuarios (puedes expandirla)
CREATE TABLE IF NOT EXISTS users
(
    id
    SERIAL
    PRIMARY
    KEY,
    wallet_address
    VARCHAR
(
    100
) UNIQUE,
    username VARCHAR
(
    100
),
    avatar_url VARCHAR
(
    255
),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Índices
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
