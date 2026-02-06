# Backend - CoTravel API

## Que hace

API REST centralizada que maneja autenticacion, logica de negocio, persistencia de datos, almacenamiento de archivos
e interaccion con contratos Soroban para la plataforma CoTravel.

### Funcionalidades actuales

- **Autenticacion wallet**: Challenge-response con firma Stellar + JWT (24h)
- **Gestion de usuarios**: Registro y consulta por wallet address
- **Gestion de viajes**: CRUD completo con estados (draft/funding/completed/cancelled/released)
- **Participantes**: Join, contribucion y retiro con sincronizacion on-chain
- **Integracion Soroban**: Submit de transacciones firmadas (XDR) y queries read-only al contrato
- **Gestion de imagenes**: Upload a MinIO + metadata en PostgreSQL
- **Health check**: Verificacion de conectividad con PostgreSQL y MinIO
- **Registro de transacciones**: Historial de operaciones blockchain indexadas

## Como lo hace

### Stack tecnologico

- **Runtime**: Node.js con Express.js
- **Base de datos**: PostgreSQL (datos relacionales, cache off-chain)
- **Almacenamiento**: MinIO (S3-compatible para archivos)
- **Blockchain**: @stellar/stellar-sdk (Soroban RPC)
- **Autenticacion**: jsonwebtoken (JWT) + firma Stellar
- **Uploads**: multer (multipart/form-data)
- **Testing**: Jest + Supertest

### Endpoints

#### Health & Root

| Metodo | Ruta      | Auth | Descripcion                    |
|--------|-----------|------|--------------------------------|
| GET    | `/`       | No   | Info de version de la API      |
| GET    | `/health` | No   | Estado de DB y storage (MinIO) |

#### Autenticacion (`/api/auth`)

| Metodo | Ruta                          | Auth | Descripcion                           |
|--------|-------------------------------|------|---------------------------------------|
| GET    | `/api/auth/challenge?wallet=` | No   | Obtener challenge para firmar         |
| POST   | `/api/auth/login`             | No   | Login con wallet + firma, retorna JWT |
| GET    | `/api/auth/me`                | JWT  | Obtener usuario autenticado actual    |

#### Usuarios (`/api/users`)

| Metodo | Ruta                 | Auth | Descripcion               |
|--------|----------------------|------|---------------------------|
| POST   | `/api/users`         | No   | Crear usuario             |
| GET    | `/api/users/:wallet` | No   | Buscar usuario por wallet |

#### Viajes (`/api/trips`)

| Metodo | Ruta                           | Auth      | Descripcion                          |
|--------|--------------------------------|-----------|--------------------------------------|
| GET    | `/api/trips`                   | No        | Listar todos los viajes              |
| GET    | `/api/trips/:id`               | No        | Detalle de viaje (+ estado on-chain) |
| POST   | `/api/trips`                   | JWT       | Crear borrador de viaje              |
| GET    | `/api/trips/:id/participants`  | No        | Listar participantes del viaje       |
| POST   | `/api/trips/:id/join`          | JWT       | Unirse a un viaje                    |
| POST   | `/api/trips/:id/contribute`    | JWT       | Registrar contribucion (submit XDR)  |
| POST   | `/api/trips/:id/withdraw`      | JWT       | Registrar retiro (submit XDR)        |
| POST   | `/api/trips/:id/link-contract` | Organizer | Vincular viaje a contrato Soroban    |
| POST   | `/api/trips/:id/release`       | Organizer | Liberar fondos al organizador        |
| POST   | `/api/trips/:id/cancel`        | Organizer | Cancelar viaje y reembolsar          |

#### Imagenes (`/images`)

| Metodo | Ruta                | Auth | Descripcion                                  |
|--------|---------------------|------|----------------------------------------------|
| POST   | `/images/upload`    | No   | Subir imagen a MinIO + metadata a PostgreSQL |
| GET    | `/images/:filename` | No   | Obtener imagen especifica                    |
| GET    | `/images`           | No   | Listar todas las imagenes                    |

### Variables de entorno

| Variable                     | Default                                    | Descripcion                     |
|------------------------------|--------------------------------------------|---------------------------------|
| `PORT`                       | `3000`                                     | Puerto del servidor             |
| `DATABASE_URL`               | -                                          | Connection string de PostgreSQL |
| `MINIO_ENDPOINT`             | `minio`                                    | Host de MinIO                   |
| `MINIO_PORT`                 | `9000`                                     | Puerto de MinIO                 |
| `MINIO_ACCESS_KEY`           | `minioadmin`                               | Access key de MinIO             |
| `MINIO_SECRET_KEY`           | `minioadmin123`                            | Secret key de MinIO             |
| `JWT_SECRET`                 | `cotravel-dev-secret-change-in-production` | Secreto para firmar JWT         |
| `SOROBAN_RPC_URL`            | `https://soroban-testnet.stellar.org`      | Endpoint RPC de Soroban         |
| `SOROBAN_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015`        | Network passphrase de Stellar   |
| `CONTRACT_ID`                | -                                          | ID del contrato escrow          |

### Ejecucion

El backend corre dentro de Docker. Desde la raiz del proyecto:

```bash
docker compose up -d              # Levantar todos los servicios
docker compose up -d --build backend  # Reconstruir tras cambios de codigo
docker exec impacta-backend npm test  # Ejecutar tests
docker logs impacta-backend --tail 20 # Ver logs
```

Dentro del contenedor:

```bash
npm run dev   # Desarrollo con auto-reload (node --watch)
npm start     # Produccion
npm test      # Tests con Jest
```

**Puerto**: 3000

### Tests

48 tests de integracion con aislamiento por transacciones (BEGIN/ROLLBACK):

| Suite                  | Tests | Cobertura                                  |
|------------------------|-------|--------------------------------------------|
| `health.test.js`       | 2     | Root y health check (DB + storage)         |
| `auth.test.js`         | 8     | Challenge, login, firma, JWT, /me          |
| `users.test.js`        | 5     | Crear, duplicado, buscar por wallet        |
| `trips.test.js`        | 15    | CRUD, link-contract, release, cancel, auth |
| `participants.test.js` | 9     | Join, contribute, withdraw, auto-join      |
| `images.test.js`       | 5     | Upload, get, list, validaciones            |

Los tests usan la DB y MinIO reales (del docker compose), con rollback automatico para no contaminar datos.

## Interaccion con otros componentes

```
Frontend ──HTTP──> Backend API
                      |
                      |---> PostgreSQL (usuarios, trips, participantes, transacciones, imagenes)
                      |---> MinIO (archivos multimedia)
                      |---> Soroban RPC (submit XDR, queries read-only al contrato)
```

- **Frontend**: Consume endpoints REST, firma transacciones con wallet del usuario
- **PostgreSQL**: Persiste datos off-chain y cache de estado on-chain
- **MinIO**: Almacena archivos multimedia (imagenes)
- **Soroban**: El frontend construye y firma las transacciones (XDR), el backend las envia al RPC y registra resultados

### Flujo de autenticacion

1. Frontend solicita challenge: `GET /api/auth/challenge?wallet=GABCD...`
2. Usuario firma el challenge con su wallet Stellar
3. Frontend envia firma: `POST /api/auth/login { wallet, signature }`
4. Backend verifica firma, crea/encuentra usuario, retorna JWT (24h)
5. Frontend usa JWT en header `Authorization: Bearer <token>` para endpoints protegidos

### Flujo de transacciones blockchain

1. Frontend construye la transaccion Soroban (ej: contribute)
2. Usuario firma con su wallet
3. Frontend envia XDR firmado al backend (ej: `POST /api/trips/:id/contribute`)
4. Backend envia a Soroban RPC, espera confirmacion (polling 30s)
5. Backend registra resultado en tabla `transactions` y actualiza cache off-chain

## Consideraciones tecnicas

### Por que backend + datos off-chain

- **Indexacion de eventos/operaciones**: La blockchain tiene retencion limitada
- **Cache de estado on-chain**: Queries rapidas sin depender del RPC
- **Notificaciones**: Logica que no pertenece on-chain
- **Colas y reintentos**: Manejo de fallos y consistencia eventual
- **Estado de producto**: Perfiles, analytics, contenido que no requiere verificacion publica

### Para produccion

- Cambiar `JWT_SECRET` a un secreto seguro
- Implementar rate limiting y reintentos con idempotencia
- Reemplazar challenge store in-memory por Redis
- Agregar observabilidad (logs estructurados, trazas)
- Validacion estricta de inputs
- Considerar indexador dedicado para eventos Soroban
