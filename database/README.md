# Database - PostgreSQL + Supabase

## Qué hace

Base de datos relacional que almacena toda la información off-chain de CoTravel:

- Perfiles de usuarios y preferencias
- Metadata de viajes (nombre, descripción, imágenes)
- Registro de participantes y su estado en la app
- Cache/índice de transacciones blockchain
- Partners y ofertas disponibles

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

| Dato             | Off-chain (PostgreSQL)                | On-chain (Contrato)               |
|------------------|---------------------------------------|-----------------------------------|
| **Usuario**      | username, avatar, preferencias        | wallet_address (identidad)        |
| **Viaje**        | nombre, descripción, imágenes         | target_amount, deadline, rules    |
| **Participante** | joined_at, status UX, notificaciones  | balance real, contribuciones      |
| **Transacción**  | tx_hash (referencia), cache de montos | la transacción misma en el ledger |
| **Partners**     | info, descuentos, logos               | - (no aplica)                     |

---

## Schema

### Diagrama de Relaciones

```
users ──────┬──► trips ◄────── partners
            │      │              │
            │      ▼              │
            └──► trip_participants│
                   │              │
                   ▼              ▼
               transactions    trip_offers

               images (refs a Storage)
```

### Tablas

| Tabla               | Propósito                  | Registros típicos                     |
|---------------------|----------------------------|---------------------------------------|
| `users`             | Perfiles de usuarios       | wallet_address, username, avatar      |
| `trips`             | Metadata de viajes         | nombre, descripción, contract_trip_id |
| `trip_participants` | Quién participa en qué     | usuario + viaje + balance cache       |
| `transactions`      | Índice de eventos on-chain | tx_hash, tipo, monto                  |
| `partners`          | Empresas asociadas         | nombre, categoría, descuento          |
| `trip_offers`       | Ofertas por viaje          | partner + viaje + precio              |
| `images`            | Metadata de archivos       | filename, size, trip_id               |

### Campo Clave: `contract_trip_id`

```sql
-- Vincula el viaje en PostgreSQL con el viaje en el contrato Soroban
trips.contract_trip_id BIGINT  -- Corresponde al trip_id del contrato multi-escrow
```

El contrato multi-escrow maneja N viajes. Cada viaje tiene un `trip_id` (0, 1, 2...).
Este campo vincula los datos off-chain con los datos on-chain.

---

## Desarrollo Local

### Levantar PostgreSQL

```bash
# Levantar solo la base de datos
docker-compose up postgres -d

# Ver logs
docker-compose logs -f postgres

# Verificar que está corriendo
docker exec -it impacta-postgres psql -U impacta -d impacta_db -c "\dt"
```

### Reiniciar con schema limpio

```bash
# Eliminar volumen y recrear
docker-compose down -v
docker-compose up postgres -d

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
    - Public: ✅ Sí
4. Crear bucket `trip-images`:
    - Name: `trip-images`
    - Public: ✅ Sí

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
   - UPDATE trip_participants.contributed_amount (cache)
   - UPDATE trips.total_collected (cache)
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

| Dato                    | Fuente de Verdad | Cache en                             |
|-------------------------|------------------|--------------------------------------|
| Balance de participante | Contrato         | trip_participants.contributed_amount |
| Total recaudado         | Contrato         | trips.total_collected                |
| Estado del escrow       | Contrato         | trips.status                         |
| Perfil de usuario       | PostgreSQL       | -                                    |
| Info del viaje          | PostgreSQL       | -                                    |
| Partners/ofertas        | PostgreSQL       | -                                    |

---

## Queries Útiles

### Ver todos los viajes con participantes

```sql
SELECT
    t.name,
    t.status,
    t.contract_trip_id,
    COUNT(tp.id) as participants,
    SUM(tp.contributed_amount) as total
FROM trips t
LEFT JOIN trip_participants tp ON t.id = tp.trip_id
GROUP BY t.id;
```

### Historial de un usuario

```sql
SELECT
    tx.type,
    tx.amount,
    tx.tx_hash,
    t.name as trip_name,
    tx.created_at
FROM transactions tx
JOIN trips t ON tx.trip_id = t.id
WHERE tx.user_id = 1
ORDER BY tx.created_at DESC;
```

### Viajes activos con espacio

```sql
SELECT
    t.*,
    t.min_participants - t.participant_count as spots_needed
FROM trips t
WHERE t.status = 'funding'
AND t.deadline > NOW();
```

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND API                             │
└──────────┬─────────────────────────────┬────────────────────┘
           │                             │
           ▼                             ▼
┌──────────────────┐          ┌──────────────────┐
│   PostgreSQL     │          │     Storage      │
│   (Supabase)     │          │   (Supabase)     │
│                  │          │                  │
│ - users          │          │ - avatars/       │
│ - trips          │          │ - trip-images/   │
│ - participants   │          │                  │
│ - transactions   │          │                  │
│ - partners       │          │                  │
│ - offers         │          │                  │
└──────────────────┘          └──────────────────┘
           │
           │ wallet_address / contract_trip_id
           ▼
┌──────────────────┐
│  Stellar/Soroban │
│  (on-chain)      │
│                  │
│ - balances       │
│ - escrow state   │
│ - transactions   │
└──────────────────┘
```

---

## Consideraciones

### Consistencia Eventual

- Los datos de cache (balances, totales) pueden estar desactualizados
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
