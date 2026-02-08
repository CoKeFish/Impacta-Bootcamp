# Backend - CoTravel API

API REST que gestiona autenticacion, negocios, servicios, facturas grupales con escrow on-chain,
almacenamiento de archivos e interaccion con contratos Soroban en la red Stellar.

## Funcionalidades

- **Autenticacion wallet**: Challenge-response con firma Stellar (SEP-0053) + JWT de 24h con issuer/audience
- **Roles**: Sistema de roles (user/admin) con middleware de autorizacion por nivel de acceso
- **Negocios**: CRUD de perfiles de negocios con verificacion de propietario
- **Servicios**: Catalogo de servicios vinculados a negocios, con busqueda y control de acceso
- **Facturas grupales**: Creacion, items detallados, vinculacion a contrato escrow, versionado, liberacion y cancelacion
- **Participantes**: Join, contribucion, retiro, confirmacion de liberacion con penalizaciones
- **Imagenes**: Upload autenticado y descarga publica via MinIO (S3-compatible)
- **Blockchain**: Submit de transacciones firmadas (XDR) y queries read-only al contrato Soroban
- **Panel admin**: Endpoints de administracion para gestionar usuarios, negocios y facturas
- **Seguridad**: Helmet, CORS whitelist, rate limiting, validacion de inputs, body size limit

## Stack

| Componente     | Tecnologia                             |
|----------------|----------------------------------------|
| Runtime        | Node.js + Express                      |
| Base de datos  | PostgreSQL                             |
| Almacenamiento | MinIO (S3-compatible)                  |
| Blockchain     | Stellar SDK + Soroban RPC              |
| Autenticacion  | JWT (jsonwebtoken) con issuer/audience |
| Seguridad      | helmet + express-rate-limit + CORS     |
| Uploads        | multer (multipart/form-data)           |
| Testing        | Jest + Supertest                       |

## Endpoints

### Health & Root

| Metodo | Ruta      | Auth | Descripcion            |
|--------|-----------|------|------------------------|
| GET    | `/`       | No   | Version de la API      |
| GET    | `/health` | No   | Estado de DB y storage |

### Autenticacion (`/api/auth`)

| Metodo | Ruta                          | Auth | Descripcion                           |
|--------|-------------------------------|------|---------------------------------------|
| GET    | `/api/auth/challenge?wallet=` | No   | Obtener challenge para firmar         |
| POST   | `/api/auth/login`             | No   | Login con wallet + firma, retorna JWT |
| GET    | `/api/auth/me`                | JWT  | Usuario autenticado actual            |

### Usuarios (`/api/users`)

| Metodo | Ruta                 | Auth | Descripcion               |
|--------|----------------------|------|---------------------------|
| POST   | `/api/users`         | No   | Crear usuario             |
| GET    | `/api/users/:wallet` | No   | Buscar usuario por wallet |

### Negocios (`/api/businesses`)

| Metodo | Ruta                           | Auth        | Descripcion                        |
|--------|--------------------------------|-------------|------------------------------------|
| GET    | `/api/businesses`              | No          | Listar negocios activos (paginado) |
| GET    | `/api/businesses/:id`          | No          | Detalle de negocio                 |
| GET    | `/api/businesses/:id/services` | No          | Servicios del negocio              |
| GET    | `/api/businesses/my/list`      | JWT         | Mis negocios (dashboard)           |
| POST   | `/api/businesses`              | JWT         | Crear negocio                      |
| PUT    | `/api/businesses/:id`          | Propietario | Actualizar negocio                 |

### Servicios (`/api/services`)

| Metodo | Ruta                | Auth | Descripcion                     |
|--------|---------------------|------|---------------------------------|
| GET    | `/api/services`     | No   | Listar (soporta `?q=` busqueda) |
| GET    | `/api/services/:id` | No   | Detalle de servicio             |
| POST   | `/api/services`     | JWT  | Crear servicio                  |
| PUT    | `/api/services/:id` | JWT  | Actualizar servicio             |

### Facturas (`/api/invoices`) -- Requiere autenticacion

| Metodo | Ruta                               | Auth             | Descripcion                               |
|--------|------------------------------------|------------------|-------------------------------------------|
| GET    | `/api/invoices/my`                 | JWT              | Mis facturas (organizador o participante) |
| GET    | `/api/invoices/:id`                | Org/Participante | Detalle + items + estado on-chain         |
| POST   | `/api/invoices`                    | JWT              | Crear factura con items                   |
| POST   | `/api/invoices/:id/link-contract`  | Organizador      | Vincular a contrato Soroban               |
| PUT    | `/api/invoices/:id/items`          | Organizador      | Actualizar items (+ XDR si vinculada)     |
| POST   | `/api/invoices/:id/release`        | Organizador      | Liberar fondos (requiere status funding)  |
| POST   | `/api/invoices/:id/cancel`         | Organizador      | Cancelar (requiere draft o funding)       |
| POST   | `/api/invoices/:id/claim-deadline` | JWT              | Reclamar por deadline vencido             |
| GET    | `/api/invoices/:id/participants`   | Org/Participante | Listar participantes                      |
| POST   | `/api/invoices/:id/join`           | JWT              | Unirse a factura                          |
| POST   | `/api/invoices/:id/contribute`     | JWT              | Contribuir (submit XDR)                   |
| POST   | `/api/invoices/:id/withdraw`       | JWT              | Retirar contribucion (submit XDR)         |
| POST   | `/api/invoices/:id/confirm`        | JWT              | Confirmar liberacion                      |

### Administracion (`/api/admin`) -- Requiere rol admin

| Metodo | Ruta                        | Auth  | Descripcion               |
|--------|-----------------------------|-------|---------------------------|
| GET    | `/api/admin/stats`          | Admin | Contadores globales       |
| GET    | `/api/admin/users`          | Admin | Listar todos los usuarios |
| PUT    | `/api/admin/users/:id/role` | Admin | Cambiar rol de usuario    |
| GET    | `/api/admin/businesses`     | Admin | Listar todos los negocios |
| GET    | `/api/admin/invoices`       | Admin | Listar todas las facturas |

### Imagenes (`/images`)

| Metodo | Ruta                | Auth | Descripcion                               |
|--------|---------------------|------|-------------------------------------------|
| POST   | `/images/upload`    | JWT  | Subir imagen (JPEG/PNG/WebP/GIF, max 5MB) |
| GET    | `/images/:filename` | No   | Obtener imagen                            |
| GET    | `/images`           | No   | Listar imagenes                           |

## Variables de entorno

| Variable                     | Default                                       | Descripcion                     |
|------------------------------|-----------------------------------------------|---------------------------------|
| `PORT`                       | `3000`                                        | Puerto del servidor             |
| `DATABASE_URL`               | -                                             | Connection string de PostgreSQL |
| `MINIO_ENDPOINT`             | `minio`                                       | Host de MinIO                   |
| `MINIO_PORT`                 | `9000`                                        | Puerto de MinIO                 |
| `MINIO_ACCESS_KEY`           | `minioadmin`                                  | Access key de MinIO             |
| `MINIO_SECRET_KEY`           | `minioadmin123`                               | Secret key de MinIO             |
| `JWT_SECRET`                 | Requerido en produccion                       | Secreto para firmar JWT         |
| `ALLOWED_ORIGINS`            | `http://localhost:5173,http://localhost:3000` | Origenes CORS permitidos        |
| `SOROBAN_RPC_URL`            | `https://soroban-testnet.stellar.org`         | Endpoint RPC de Soroban         |
| `SOROBAN_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015`           | Network passphrase de Stellar   |
| `CONTRACT_ID`                | -                                             | ID del contrato escrow          |

## Seguridad implementada

- **Helmet**: Security headers automaticos (X-Content-Type-Options, X-Frame-Options, CSP, etc.)
- **CORS whitelist**: Solo origenes configurados en `ALLOWED_ORIGINS`
- **Rate limiting**: 100 req/min global, 15 req/min auth, 10 req/min uploads
- **Body size limit**: 16KB max para JSON payloads
- **JWT con issuer/audience**: Tokens firmados con claims estandar
- **JWT_SECRET obligatorio**: Falla al iniciar si no esta definido en produccion
- **Validacion de IDs**: Middleware `validateId` rechaza IDs no numericos
- **Validacion de inputs**: Montos, deadlines, formatos de archivos
- **Estado de maquina de estados**: Release solo desde funding, cancel desde draft/funding
- **Acceso por scope**: Facturas solo accesibles por organizador o participante
- **Upload seguro**: Auth obligatoria, validacion MIME type, limite de 5MB
- **Error handler seguro**: No expone internals en errores 500

## Ejecucion

El backend corre dentro de Docker. Desde la raiz del proyecto:

```bash
docker compose up -d                      # Levantar todos los servicios
docker compose up -d --build backend      # Reconstruir tras cambios
docker compose exec backend npm test      # Ejecutar tests
docker logs impacta-backend --tail 20     # Ver logs
```

Dentro del contenedor:

```bash
npm run dev   # Desarrollo con auto-reload (node --watch)
npm start     # Produccion
npm test      # Tests con Jest
```

## Tests

88 tests de integracion en 8 suites. Aislamiento por transacciones `BEGIN`/`ROLLBACK`.
Soroban es mockeado; PostgreSQL y MinIO usan instancias reales del docker compose.

Ver [TESTS.md](TESTS.md) para detalle completo.

## Arquitectura

Ver [ARCHITECTURE.md](ARCHITECTURE.md) para estructura de capas, flujos de datos y decisiones tecnicas.
