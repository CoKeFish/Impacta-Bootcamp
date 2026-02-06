# CoTravel - Arquitectura Técnica

> La forma más simple de organizar viajes grupales y gestionar presupuestos compartidos con escrow en blockchain.

---

## Visión General

CoTravel es una plataforma que permite a grupos de amigos coordinar viajes, recolectar contribuciones hacia un
presupuesto compartido y aplicar reglas justas mediante smart contracts en Stellar/Soroban.

```mermaid
flowchart TB
    subgraph Platform["COTRAVEL PLATFORM"]
        BE[Backend<br/>Node.js + Express]
        SC[Soroban Contract<br/>Rust]
        BE <--> SC

        subgraph Storage["Almacenamiento"]
            DB[(PostgreSQL<br/>Datos)]
            S3[(MinIO<br/>Imágenes)]
        end

        BE --> DB
        BE --> S3
    end
```

---

## Stack Tecnológico

| Componente     | Tecnología                 | Propósito                                             |
|----------------|----------------------------|-------------------------------------------------------|
| Backend        | Node.js + Express          | API REST, lógica de negocio, integración con partners |
| Base de datos  | PostgreSQL                 | Usuarios, grupos, viajes, transacciones               |
| Almacenamiento | MinIO (S3 compatible)      | Imágenes de perfil, fotos de viajes                   |
| Smart Contract | Soroban (Rust)             | Escrow, milestones, reembolsos automáticos            |
| Blockchain     | Stellar Network            | Transacciones, wallets grupales                       |

---

## Estructura del Proyecto

```mermaid
flowchart LR
    subgraph Root["CoTravel"]
        subgraph BK["backend"]
            R[routes]
            CT2[controllers]
            M[models]
            S[services]
            MW[middleware]
            CF[config]
            T[tests]
        end

        subgraph CT["contracts"]
            E[escrow]
        end

        subgraph DB["database"]
            I[init.sql]
        end
    end
```

---

## Servicios Docker

```mermaid
flowchart LR
    subgraph Docker["Docker Compose"]
        B[Backend<br/>:3000]
        P[(PostgreSQL<br/>:5432)]
        M[(MinIO<br/>:9000-9001)]
        S[Soroban<br/>:8000-8080]
    end

    B --> P
    B --> M
    B --> S
```

| Servicio   | Puerto      | Descripción               |
|------------|-------------|---------------------------|
| Backend    | 3000        | API REST                  |
| PostgreSQL | 5432        | Base de datos relacional  |
| MinIO      | 9000 / 9001 | Almacenamiento de objetos |
| Soroban    | 8000 / 8080 | Red local Stellar + RPC   |

---

## Backend API

### Arquitectura

El backend sigue un patrón **MVC** con separación clara de responsabilidades:

```
backend/
├── src/
│   ├── app.js              ← Express app exportable (sin listen)
│   ├── index.js             ← Punto de entrada: init DB/MinIO + listen
│   ├── config/
│   │   ├── db.js            ← Pool de PostgreSQL (singleton)
│   │   ├── minio.js         ← Cliente MinIO + inicialización de buckets
│   │   └── soroban.js       ← Soroban RPC Server + config de red
│   ├── middleware/
│   │   ├── auth.js          ← JWT: requireAuth, requireOrganizer, loadTrip
│   │   └── errorHandler.js  ← Manejo centralizado de errores
│   ├── routes/
│   │   ├── auth.js          ← /api/auth (challenge, login, me)
│   │   ├── health.js        ← /health (status DB + storage)
│   │   ├── images.js        ← /images (upload, get, list)
│   │   ├── trips.js         ← /api/trips (CRUD + contract ops)
│   │   └── users.js         ← /api/users (create, get)
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── imagesController.js
│   │   ├── participantsController.js
│   │   ├── tripsController.js
│   │   └── usersController.js
│   ├── models/
│   │   ├── imageModel.js
│   │   ├── participantModel.js
│   │   ├── transactionModel.js
│   │   ├── tripModel.js
│   │   └── userModel.js
│   └── services/
│       └── sorobanService.js ← Read-only queries + submitTx
├── tests/                    ← Integration tests (Jest + Supertest)
├── jest.config.js
└── package.json
```

### Autenticación

Challenge-response con firma de wallet Stellar + JWT:

```mermaid
sequenceDiagram
    actor U as Usuario
    participant Client as Client
    participant BE as Backend
    participant W as Wallet
    U ->> Client: Conectar wallet
    Client ->> BE: GET /api/auth/challenge?wallet=GABCD...
    BE -->> Client: challenge (string aleatorio)
    Client ->> W: Firmar challenge
    W -->> Client: signature (base64)
    Client ->> BE: POST /api/auth/login {wallet, signature}
    Note over BE: Verificar firma con Stellar SDK<br/>Crear usuario si no existe<br/>Generar JWT (24h)
    BE -->> Client: {token, user}
```

### Endpoints

| Método | Ruta                           | Auth            | Descripción                          |
|--------|--------------------------------|-----------------|--------------------------------------|
| `GET`  | `/`                            | -               | Health check (API running)           |
| `GET`  | `/health`                      | -               | Health check (DB + storage)          |
| `GET`  | `/api/auth/challenge`          | -               | Obtener challenge para wallet        |
| `POST` | `/api/auth/login`              | -               | Login con firma → JWT                |
| `GET`  | `/api/auth/me`                 | JWT             | Usuario autenticado                  |
| `POST` | `/api/users`                   | -               | Crear usuario                        |
| `GET`  | `/api/users/:wallet`           | -               | Buscar usuario por wallet            |
| `GET`  | `/api/trips`                   | -               | Listar viajes                        |
| `POST` | `/api/trips`                   | JWT             | Crear viaje (draft)                  |
| `GET`  | `/api/trips/:id`               | -               | Detalle de viaje (+ estado on-chain) |
| `GET`  | `/api/trips/:id/participants`  | -               | Listar participantes                 |
| `POST` | `/api/trips/:id/join`          | JWT             | Unirse a viaje                       |
| `POST` | `/api/trips/:id/contribute`    | JWT             | Contribuir (submit XDR)              |
| `POST` | `/api/trips/:id/withdraw`      | JWT             | Retirarse (submit XDR)               |
| `POST` | `/api/trips/:id/link-contract` | JWT + Organizer | Vincular contrato Soroban            |
| `POST` | `/api/trips/:id/release`       | JWT + Organizer | Liberar fondos                       |
| `POST` | `/api/trips/:id/cancel`        | JWT + Organizer | Cancelar viaje                       |
| `POST` | `/images/upload`               | -               | Subir imagen (MinIO)                 |
| `GET`  | `/images/:filename`            | -               | Obtener imagen (stream)              |
| `GET`  | `/images`                      | -               | Listar imágenes                      |

### Arquitectura Híbrida (Off-chain + On-chain)

El backend actúa como **intermediario** entre el cliente y la blockchain:

```mermaid
flowchart LR
    Client[Client] -->|signed XDR| BE[Backend]
    BE -->|submitTx| SR[Soroban RPC]
    SR -->|result| BE
    BE -->|cache state| DB[(PostgreSQL)]
    BE -->|response| Client
```

- **Off-chain (PostgreSQL)**: Usuarios, metadata de viajes, historial de transacciones, estado cacheado
- **On-chain (Soroban)**: Escrow real, balances, reglas de negocio (penalización, release, cancel)
- **Source of truth**: El contrato Soroban es la fuente de verdad para fondos y estado financiero

---

## Testing

### Stack de Testing

| Herramienta | Propósito                                            |
|-------------|------------------------------------------------------|
| Jest        | Framework de testing (assertions, mocks, lifecycle)  |
| Supertest   | Peticiones HTTP al Express app sin levantar servidor |

### Arquitectura de Tests

```
Real (Docker)              Mockeado
─────────────              ────────
PostgreSQL ✓               sorobanService.submitTx
MinIO ✓                    sorobanService.getTripState
Express routing ✓
JWT auth ✓
Stellar SDK (firma) ✓
```

**Aislamiento de DB**: Cada test corre dentro de `BEGIN` / `ROLLBACK`. La base de datos nunca se contamina entre tests.

**Aislamiento de MinIO**: Los tests de imágenes limpian objetos subidos en `afterEach`.

### Test Suites (48 tests)

| Suite                  | Tests | Cobertura                                                     |
|------------------------|-------|---------------------------------------------------------------|
| `health.test.js`       | 2     | Smoke test: API + DB + storage                                |
| `auth.test.js`         | 11    | Challenge, login, firma, JWT, /me                             |
| `users.test.js`        | 5     | CRUD usuarios                                                 |
| `trips.test.js`        | 15    | CRUD viajes + link-contract + release/cancel + auth organizer |
| `participants.test.js` | 10    | Join, contribute, withdraw + auto-join                        |
| `images.test.js`       | 5     | Upload/get/list con MinIO real                                |

### Ejecución

```bash
# Requisito: containers Docker corriendo
docker compose up -d postgres minio backend

# Ejecutar tests dentro del container
docker compose exec backend npm test
```

---

## Flujos Principales

### 1. Creación de Viaje Grupal

```mermaid
sequenceDiagram
    actor U as Usuario
    participant BE as Backend
    participant SC as Soroban Contract
    U ->> BE: POST trips
    BE ->> SC: create_trip(organizer, token, target, min, deadline, penalty)
    SC -->> BE: trip_id
    BE -->> U: Trip + trip_id
```

> **Nota**: Se usa un único contrato multi-escrow. No se despliega un contrato nuevo por viaje, solo se invoca
`create_trip()` que retorna un `trip_id`.

### 2. Contribución al Presupuesto

```mermaid
sequenceDiagram
    actor P as Participante
    participant W as Wallet
    participant SC as Soroban Contract
    P ->> W: Solicitar firma para contribute(trip_id, amount)
    W -->> P: Transacción firmada
    P ->> SC: contribute(trip_id, participant, amount)
    Note over SC: Validar estado Funding<br/>Transferir tokens<br/>Actualizar balance<br/>Auto-completar si meta alcanzada
    SC -->> P: Evento ContributionEvent
```

### 3. Abandono con Penalización

```mermaid
sequenceDiagram
    actor P as Participante
    participant W as Wallet
    participant SC as Soroban Contract
    participant G as Resto del Grupo
    P ->> W: Solicitar firma para withdraw(trip_id)
    W -->> P: Transacción firmada
    P ->> SC: withdraw(trip_id, participant)
    Note over SC: 1. Calcular penalización (% configurado)<br/>2. Redistribuir penalización a restantes<br/>3. Reembolsar (monto - penalización)
    SC -->> P: Reembolso parcial
    SC -->> G: Balances incrementados
    SC -->> P: Evento WithdrawalEvent
```

### 4. Cancelación por Organizador

```mermaid
sequenceDiagram
    actor O as Organizador
    participant SC as Soroban Contract
    participant P as Participantes
    O ->> SC: cancel(trip_id)
    Note over SC: Reembolso completo<br/>a todos los participantes<br/>(sin penalización)
    SC -->> P: Reembolso 100%
    SC -->> O: Evento CancelledEvent
```

---

## Ciclo de Vida del Viaje

```mermaid
stateDiagram-v2
    [*] --> Funding: create_trip()
    Funding --> Funding: contribute()
    Funding --> Completed: Meta + Min participantes
    Completed --> Funding: withdraw() (bajo umbral)
    Funding --> Cancelled: cancel()
    Completed --> Cancelled: cancel()
    Completed --> Released: release()
    Cancelled --> [*]: Reembolso total
    Released --> [*]: Fondos al organizador
```

**Transiciones de estado en el contrato:**

- `Funding` → `Completed`: Cuando `total >= target` Y `participants >= min_participants`
- `Completed` → `Funding`: Si un withdraw reduce por debajo del umbral
- `Funding/Completed` → `Cancelled`: Solo el organizador puede cancelar
- `Completed` → `Released`: Solo el organizador puede liberar

---

## Modelo de Datos

```mermaid
erDiagram
    USERS ||--o{ TRIPS: organiza
    USERS ||--o{ TRIP_PARTICIPANTS: participa
    TRIPS ||--o{ TRIP_PARTICIPANTS: tiene
    TRIPS ||--o{ TRIP_OFFERS: tiene
    TRIPS ||--o{ TRANSACTIONS: registra
    PARTNERS ||--o{ TRIP_OFFERS: ofrece
    TRIP_PARTICIPANTS ||--o{ TRANSACTIONS: genera

    USERS {
        int id PK
        string wallet_address UK
        string username
        string avatar_url
        timestamp created_at
    }

    TRIPS {
        int id PK
        int organizer_id FK
        string name
        string description
        decimal target_amount
        int min_participants
        timestamp deadline
        int penalty_percent
        bigint contract_trip_id "trip_id del contrato"
        string status
        decimal total_collected
        timestamp created_at
    }

    TRIP_PARTICIPANTS {
        int trip_id FK
        int user_id FK
        decimal contributed_amount
        timestamp joined_at
        string status
    }

    TRANSACTIONS {
        int id PK
        int trip_id FK
        int user_id FK
        string type
        decimal amount
        string tx_hash
        timestamp created_at
    }

    PARTNERS {
        int id PK
        string name
        string category
        decimal discount_percent
        string logo_url
    }

    TRIP_OFFERS {
        int trip_id FK
        int partner_id FK
        string description
        decimal price
        boolean available
    }
```

---

## Smart Contract - Arquitectura Multi-Escrow

El contrato utiliza un patrón **multi-escrow**: un único contrato desplegado gestiona N viajes independientes mediante
`trip_id`.

### ¿Por qué Multi-Escrow?

| Aspecto     | Factory (1 contrato/viaje)  | Multi-Escrow (1 contrato, N viajes) |
|-------------|-----------------------------|-------------------------------------|
| Deploy      | Despliega WASM cada vez     | Un solo deploy                      |
| Costo       | ~100k stroops/viaje         | Solo costo de storage               |
| Complejidad | Requiere factory + tracking | Lógica simple con trip_id           |
| Aislamiento | Total (contratos separados) | Por storage key (TripKey enum)      |

### Storage del Contrato

```mermaid
flowchart TB
    subgraph Instance["Instance Storage (Global)"]
        NID[NEXT_TRIP_ID<br/>Contador auto-incremental]
        TL[TRIPS<br/>Lista de trip_ids]
    end

    subgraph Persistent["Persistent Storage (Por Viaje)"]
        TC[TripKey::Config<br/>organizer, token, target, deadline, penalty]
        TS[TripKey::State<br/>status, total_collected, participant_count]
        TB[TripKey::Balances<br/>Map wallet → balance]
        TP[TripKey::Participants<br/>Vec de wallets]
    end
```

### API del Contrato

```mermaid
flowchart TB
    subgraph Contract["Soroban Multi-Escrow Contract"]
        subgraph Mgmt["Gestión de Viajes"]
            CT[create_trip]
        end
        subgraph Ops["Operaciones"]
            C[contribute]
            W[withdraw]
            R[release]
            X[cancel]
        end
        subgraph Query["Consultas"]
            GTC[get_trip_count]
            GT[get_trips]
            GTI[get_trip]
            GS[get_state]
            GB[get_balance]
            GP[get_participants]
        end
    end
```

| Función            | Parámetros                                                    | Descripción                                    |
|--------------------|---------------------------------------------------------------|------------------------------------------------|
| `create_trip`      | organizer, token, target, min_participants, deadline, penalty | Crear viaje, retorna `trip_id`                 |
| `contribute`       | trip_id, participant, amount                                  | Aportar fondos (auto-completa si alcanza meta) |
| `withdraw`         | trip_id, participant                                          | Retirarse con penalización redistribuida       |
| `release`          | trip_id                                                       | Liberar fondos al organizador (solo Completed) |
| `cancel`           | trip_id                                                       | Cancelar y reembolsar todo (sin penalización)  |
| `get_trip_count`   | -                                                             | Total de viajes creados                        |
| `get_trips`        | -                                                             | Lista de todos los trip_id                     |
| `get_trip`         | trip_id                                                       | Info resumida del viaje                        |
| `get_state`        | trip_id                                                       | Estado actual (status, totales)                |
| `get_balance`      | trip_id, participant                                          | Balance de un participante                     |
| `get_participants` | trip_id                                                       | Lista de participantes del viaje               |

### Contrato Desplegado (Testnet)

| Dato        | Valor                                                      |
|-------------|------------------------------------------------------------|
| Contract ID | `CBZJNP3KVSWCTRQJNF6Y5P55WDIGZ5JSABKDZ4RBGLFUMFZQK5BKFBIC` |
| Token (XLM) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Network     | Test SDF Network ; September 2015                          |

---

## Integraciones Externas

```mermaid
flowchart TB
    APP[CoTravel Backend]
    APP --> SN[Stellar Network]
    APP --> PA[Partners API]

    subgraph SN[Stellar Network]
        B1[Testnet]
        B2[Mainnet]
        B3[Horizon API]
        B4[Soroban RPC]
    end

    subgraph PA[Partners API]
        C1[Hoteles]
        C2[Transporte]
        C3[Restaurantes]
        C4[Experiencias]
    end
```

---

## Seguridad

| Aspecto         | Implementación                                         |
|-----------------|--------------------------------------------------------|
| Autenticación   | Challenge-response con firma Stellar + JWT (24h)       |
| Autorización    | Middleware `requireAuth` + `requireOrganizer` por ruta |
| Fondos          | Custodia en smart contract, no en backend              |
| Firma de TX     | Cliente firma con wallet, backend solo retransmite XDR |
| Datos sensibles | JWT_SECRET configurable, HTTPS en producción           |
| Contratos       | Auditoría antes de mainnet                             |

---

## Ambientes

```mermaid
flowchart LR
    subgraph Local
        L1[Standalone Docker]
        L2[PostgreSQL local]
    end

    subgraph Testnet
        T1[Stellar Testnet]
        T2[PostgreSQL cloud]
    end

    subgraph Produccion
        P1[Stellar Mainnet]
        P2[PostgreSQL managed]
    end

    Local -->|Deploy| Testnet
    Testnet -->|Release| Produccion
```

| Ambiente   | Red Stellar         | Base de datos      | Uso             |
|------------|---------------------|--------------------|-----------------|
| Local      | Standalone (Docker) | PostgreSQL local   | Desarrollo      |
| Testnet    | Stellar Testnet     | PostgreSQL cloud   | QA / Staging    |
| Producción | Stellar Mainnet     | PostgreSQL managed | Usuarios reales |

---

## Próximos Pasos

### Completado ✅

- [x] Crear contrato multi-escrow en Soroban (Rust)
- [x] Desplegar contrato en testnet
- [x] Tests unitarios del contrato (6 tests)
- [x] Makefile con comandos de desarrollo
- [x] Documentación del contrato (README.md)
- [x] Base de datos PostgreSQL (schema completo, 7 tablas, verificada)
- [x] Documentación de base de datos (README.md + Supabase)
- [x] Variables de entorno documentadas en README
- [x] Backend API REST completa (Express + 5 rutas, 5 controllers, 5 models)
- [x] Autenticación challenge-response con Stellar wallet + JWT
- [x] Integración con Soroban (submitTx, read-only queries)
- [x] Almacenamiento de imágenes con MinIO (upload, stream, list)
- [x] Middleware de autorización (requireAuth, requireOrganizer, loadTrip)
- [x] Tests de integración con Jest + Supertest (48 tests, 6 suites)
- [x] Aislamiento de tests con transaction rollback (BEGIN/ROLLBACK)
- [x] Docker Compose completo (PostgreSQL, MinIO, Backend, Soroban)

### Pendiente 📋

- [ ] Inicializar frontend (desde cero)
- [ ] Integrar wallet Stellar
- [ ] Conectar frontend con backend API + contrato
- [ ] Indexar eventos del contrato para sincronizar con DB
- [ ] Diseñar flujo de invitaciones por link
- [ ] Desarrollar módulo de partners y ofertas
- [ ] Testing en testnet con usuarios reales
