# Database - PostgreSQL + Supabase

## Qué hace

Base de datos relacional que almacena toda la información off-chain de CoTravel:

- Perfiles de usuarios y preferencias
- Empresas proveedoras de servicios y su catálogo
- Facturas grupales (invoices) con items y participantes
- Historial de modificaciones de facturas
- Cache/índice de transacciones blockchain

---

## Entornos

| Entorno        | Servicio               | Storage          |
|----------------|------------------------|------------------|
| **Local**      | PostgreSQL 16 (Docker) | MinIO (Docker)   |
| **Producción** | Supabase PostgreSQL    | Supabase Storage |

---

## Separación On-Chain vs Off-Chain

> **Principio**: Va off-chain todo lo que es **UX/producto**, **consultas frecuentes**, o **datos que no requieren
verificación pública**.

| Dato             | Off-chain (PostgreSQL)                | On-chain (Contrato)                            |
|------------------|---------------------------------------|------------------------------------------------|
| **Usuario**      | username, avatar, preferencias        | wallet_address (identidad)                     |
| **Factura**      | nombre, descripción, imágenes         | target_amount, deadline, penalty, auto_release |
| **Participante** | joined_at, status UX, notificaciones  | balance real, contribuciones, confirmaciones   |
| **Transacción**  | tx_hash (referencia), cache de montos | la transacción misma en el ledger              |
| **Empresa**      | info, catálogo de servicios, logos    | wallet_address (recipient en release)          |

---

## Schema

### Diagrama de Relaciones

```mermaid
erDiagram
   users {
      SERIAL id PK
      VARCHAR wallet_address UK "Stellar public key (G...)"
      VARCHAR username
      TEXT avatar_url
      TIMESTAMP created_at
   }

   businesses {
      SERIAL id PK
      INTEGER owner_id FK "users.id"
      VARCHAR name
      VARCHAR category
      TEXT description
      TEXT logo_url
      VARCHAR wallet_address "Wallet Stellar (recipient)"
      VARCHAR contact_email
      BOOLEAN active
      TIMESTAMP created_at
      TIMESTAMP updated_at
   }

   services {
      SERIAL id PK
      INTEGER business_id FK "businesses.id"
      VARCHAR name
      TEXT description
      DECIMAL price "DECIMAL(20,7) - 7 decimales Stellar"
      TEXT image_url
      BOOLEAN active
      TIMESTAMP created_at
      TIMESTAMP updated_at
   }

   invoices {
      SERIAL id PK
      INTEGER organizer_id FK "users.id"
      BIGINT contract_invoice_id "trip_id en contrato Soroban"
      VARCHAR name
      TEXT description
      VARCHAR icon "Emoji identificador"
      DECIMAL total_amount "Config.target_amount"
      VARCHAR token_address "Config.token (e.g. USDC)"
      INTEGER min_participants "Config.min_participants"
      INTEGER penalty_percent "Config.penalty_percent"
      TIMESTAMP deadline "Config.deadline"
      BOOLEAN auto_release "Config.auto_release"
      VARCHAR status "draft/funding/completed/cancelled/released"
      DECIMAL total_collected "State.total_collected"
      INTEGER participant_count "State.participant_count"
      INTEGER version "State.version"
      INTEGER confirmation_count "State.confirmation_count"
      TIMESTAMP created_at
      TIMESTAMP updated_at
   }

   invoice_items {
      SERIAL id PK
      INTEGER invoice_id FK "invoices.id"
      INTEGER service_id FK "services.id (nullable)"
      VARCHAR description
      DECIMAL amount "Recipient.amount"
      VARCHAR recipient_wallet "Recipient.address"
      INTEGER sort_order
      TIMESTAMP created_at
   }

   invoice_participants {
      SERIAL id PK
      INTEGER invoice_id FK "invoices.id"
      INTEGER user_id FK "users.id"
      DECIMAL contributed_amount "Balances"
      INTEGER contributed_at_version "ContribVersions"
      DECIMAL penalty_amount "PenaltyPool"
      BOOLEAN confirmed_release "Confirmations"
      VARCHAR status "active/withdrawn"
      TIMESTAMP joined_at
   }

   invoice_modifications {
      SERIAL id PK
      INTEGER invoice_id FK "invoices.id"
      INTEGER version
      TEXT change_summary
      JSONB items_snapshot
      TIMESTAMP created_at
   }

   transactions {
      SERIAL id PK
      INTEGER invoice_id FK "invoices.id"
      INTEGER user_id FK "users.id"
      VARCHAR tx_hash UK
      VARCHAR type "create/contribute/withdraw/..."
      DECIMAL amount
      INTEGER ledger_sequence
      JSONB event_data
      TIMESTAMP created_at
   }

   users ||--o{ businesses: "owns"
   businesses ||--o{ services: "offers"
   users ||--o{ invoices: "organizes"
   invoices ||--o{ invoice_items: "contains"
   services ||--o{ invoice_items: "referenced_by"
   invoices ||--o{ invoice_participants: "has"
   users ||--o{ invoice_participants: "participates_in"
   invoices ||--o{ invoice_modifications: "history"
   invoices ||--o{ transactions: "tracked_by"
   users ||--o{ transactions: "performed_by"
```

### Tablas

| Tabla                   | Propósito                          | Campos clave                                          |
|-------------------------|------------------------------------|-------------------------------------------------------|
| `users`                 | Perfiles de usuarios               | wallet_address, username, avatar                      |
| `businesses`            | Empresas proveedoras               | owner_id, wallet_address, category                    |
| `services`              | Catálogo de servicios              | business_id, price, image_url, active                 |
| `invoices`              | Facturas grupales                  | contract_invoice_id, total_amount, icon, auto_release |
| `invoice_items`         | Line items de factura (recipients) | recipient_wallet, amount, service_id                  |
| `invoice_participants`  | Participantes y su estado          | contributed_amount, penalty_amount, confirmed_release |
| `invoice_modifications` | Historial de cambios               | version, items_snapshot                               |
| `transactions`          | Índice de eventos on-chain         | tx_hash, type, amount, event_data                     |

### Mapeo con el Contrato Soroban

Las tablas reflejan los storages del contrato `CotravelEscrow`:

| Storage del contrato       | Tabla/Campo en PostgreSQL                                                                           |
|----------------------------|-----------------------------------------------------------------------------------------------------|
| `Config(trip_id)`          | `invoices` (total_amount, token_address, deadline, penalty_percent, min_participants, auto_release) |
| `State(trip_id)`           | `invoices` (status, total_collected, participant_count, version, confirmation_count)                |
| `Recipients(trip_id)`      | `invoice_items` (recipient_wallet + amount)                                                         |
| `Balances(trip_id)`        | `invoice_participants.contributed_amount`                                                           |
| `ContribVersions(trip_id)` | `invoice_participants.contributed_at_version`                                                       |
| `PenaltyPool(trip_id)`     | `invoice_participants.penalty_amount`                                                               |
| `Confirmations(trip_id)`   | `invoice_participants.confirmed_release`                                                            |

### Campo Clave: `contract_invoice_id`

```sql
-- Vincula la factura en PostgreSQL con el pool en el contrato Soroban
invoices
.
contract_invoice_id
BIGINT  -- Corresponde al trip_id del contrato multi-escrow
```

El contrato multi-escrow maneja N pools. Cada pool tiene un `trip_id` (0, 1, 2...).
Este campo vincula los datos off-chain con los datos on-chain.

---

## Desarrollo Local

### Levantar PostgreSQL

```bash
# Levantar solo la base de datos
docker compose up postgres -d

# Ver logs
docker compose logs -f postgres

# Verificar que está corriendo
docker exec -it impacta-postgres psql -U impacta -d impacta_db -c "\dt"
```

### Reiniciar con schema limpio

```bash
# Eliminar volumen y recrear
docker compose down -v
docker compose up postgres -d

# El init.sql se ejecuta automáticamente
```

### Conectar manualmente

```bash
# Desde terminal
docker exec -it impacta-postgres psql -U impacta -d impacta_db

# Desde cualquier cliente SQL
Host: localhost
Puerto: 5432
Base de datos: impacta_db
Usuario: impacta
Password: impacta123
```

---

## Producción con Supabase

### Paso 1: Crear Proyecto

1. Ir a [supabase.com](https://supabase.com)
2. Click **New Project**
3. Elegir nombre: `cotravel` (o similar)
4. Elegir región: **South America (São Paulo)** si disponible
5. Crear contraseña segura para la base de datos
6. Click **Create new project**

### Paso 2: Ejecutar Schema

1. En el dashboard, ir a **SQL Editor**
2. Click **New query**
3. Pegar el contenido de `database/init.sql`
4. Click **Run** (o Ctrl+Enter)
5. Verificar que dice "Success. No rows returned"

### Paso 3: Configurar Storage

1. Ir a **Storage** en el menú lateral
2. Click **New bucket**
3. Crear bucket `avatars`:
    - Name: `avatars`
   - Public: Yes
4. Crear bucket `invoice-images`:
   - Name: `invoice-images`
   - Public: Yes

### Paso 4: Obtener Credenciales

1. Ir a **Settings → API**
2. Copiar:
    - **Project URL** → `SUPABASE_URL`
    - **anon public** → `SUPABASE_ANON_KEY`
    - **service_role** → `SUPABASE_SERVICE_KEY` (secreto!)

3. Ir a **Settings → Database**
4. En **Connection string**, copiar URI → `DATABASE_URL`

### Variables de Entorno (Producción)

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres
```

---

## Sincronización On-Chain ↔ Off-Chain

### Flujo de Escritura (contribución)

```
1. Usuario contribuye via Frontend
2. Transacción va al contrato (on-chain)
3. Contrato emite evento ContributionEvent
4. Backend escucha evento (indexador)
5. Backend actualiza PostgreSQL:
   - INSERT en transactions
   - UPDATE invoice_participants.contributed_amount (cache)
   - UPDATE invoices.total_collected (cache)
```

### Flujo de Lectura (dashboard)

```
1. Frontend pide datos al Backend
2. Backend consulta PostgreSQL (rápido)
3. Para datos críticos (balance real):
   - Backend llama al contrato via Soroban RPC
   - O confía en cache si es reciente
```

### Source of Truth

| Dato                    | Fuente de Verdad | Cache en                                |
|-------------------------|------------------|-----------------------------------------|
| Balance de participante | Contrato         | invoice_participants.contributed_amount |
| Total recaudado         | Contrato         | invoices.total_collected                |
| Estado del escrow       | Contrato         | invoices.status                         |
| Confirmaciones release  | Contrato         | invoice_participants.confirmed_release  |
| Penalidades acumuladas  | Contrato         | invoice_participants.penalty_amount     |
| Versión de factura      | Contrato         | invoices.version                        |
| Perfil de usuario       | PostgreSQL       | -                                       |
| Info de factura         | PostgreSQL       | -                                       |
| Empresas/servicios      | PostgreSQL       | -                                       |

---

## Queries Útiles

### Ver todas las facturas con participantes

```sql
SELECT i.name,
       i.status,
       i.contract_invoice_id,
       i.auto_release,
       COUNT(ip.id)               as participants,
       SUM(ip.contributed_amount) as total
FROM invoices i
        LEFT JOIN invoice_participants ip ON i.id = ip.invoice_id
GROUP BY i.id;
```

### Historial de un usuario

```sql
SELECT
    tx.type,
    tx.amount,
    tx.tx_hash,
    i.name as invoice_name,
    tx.created_at
FROM transactions tx
        JOIN invoices i ON tx.invoice_id = i.id
WHERE tx.user_id = 1
ORDER BY tx.created_at DESC;
```

### Facturas activas con espacio

```sql
SELECT i.*,
       i.min_participants - i.participant_count as spots_needed
FROM invoices i
WHERE i.status = 'funding'
  AND i.deadline > NOW();
```

### Recipients de una factura (lo que se paga al hacer release)

```sql
SELECT ii.description,
       ii.amount,
       ii.recipient_wallet,
       b.name as business_name
FROM invoice_items ii
        LEFT JOIN services s ON ii.service_id = s.id
        LEFT JOIN businesses b ON s.business_id = b.id
WHERE ii.invoice_id = 1;
```

---

## Arquitectura

```mermaid
graph TD
   FE[Frontend<br/>React + Vite + Tailwind]
   BE[Backend API<br/>Node.js + Express]
   DB[(PostgreSQL<br/>Supabase)]
   ST[(Object Storage<br/>MinIO / Supabase)]
   BC[Stellar / Soroban<br/>On-chain]
   FE -->|REST API| BE
   BE -->|Queries + Cache| DB
   BE -->|avatar_url, logo_url,<br/>image_url| ST
   BE -->|Soroban RPC<br/>wallet_address /<br/>contract_invoice_id| BC

   subgraph DB_Tables[PostgreSQL Tables]
      direction LR
      T1[users]
      T2[businesses]
      T3[services]
      T4[invoices]
      T5[invoice_items]
      T6[invoice_participants]
      T7[invoice_modifications]
      T8[transactions]
   end

   subgraph On_Chain[Contrato Soroban]
      direction LR
      C1[Config + State]
      C2[Balances]
      C3[Confirmations]
      C4[PenaltyPool]
      C5[Recipients]
   end

   DB --- DB_Tables
   BC --- On_Chain
```

---

## Consideraciones

### Consistencia Eventual

- Los datos de cache (balances, totales, confirmaciones) pueden estar desactualizados
- Para operaciones críticas, siempre consultar el contrato
- El indexador debe procesar eventos en orden

### Costos Supabase Pro ($25/mes)

- 8GB RAM para PostgreSQL
- 100GB Storage incluido
- Backups diarios automáticos
- SSL/HTTPS incluido
- Suficiente para miles de usuarios

### Migraciones

- Por ahora, migraciones manuales (ejecutar SQL)
- Futuro: usar herramientas como Prisma o Drizzle
