# Arquitectura del Backend

## Estructura del proyecto

```
backend/
  src/
    index.js                  # Bootstrap: verifica DB/MinIO, levanta servidor
    app.js                    # Express app: helmet, cors, rate-limit, rutas
    config/
      db.js                   # Pool de conexiones PostgreSQL (pg)
      minio.js                # Cliente MinIO + inicializacion de buckets
      soroban.js              # Cliente Soroban RPC + contract ID + passphrase
    middleware/
      auth.js                 # JWT auth, roles, carga de recursos, autorizacion
      errorHandler.js         # Handler global de errores (seguro en produccion)
    routes/
      admin.js                # /api/admin (panel de super administrador)
      auth.js                 # /api/auth (challenge, login, me)
      businesses.js           # /api/businesses (CRUD + servicios + dashboard)
      health.js               # /health (estado de DB y MinIO)
      images.js               # /images (upload autenticado, get/list publico)
      invoices.js             # /api/invoices (ciclo de vida + acceso por scope)
      services.js             # /api/services (CRUD con busqueda)
      users.js                # /api/users (crear, buscar por wallet)
    controllers/
      adminController.js      # Stats, listados globales, gestion de roles
      authController.js       # Challenge-response Stellar + JWT
      businessesController.js # CRUD negocios + dashboard de propietario
      imagesController.js     # Upload/download directo a MinIO
      invoicesController.js   # Ciclo de vida de facturas + interaccion on-chain
      invoiceParticipantsController.js  # Join, contribucion, retiro, confirmacion
      servicesController.js   # CRUD servicios con control de acceso por negocio
      usersController.js      # Registro y consulta de usuarios
    models/
      businessModel.js        # Tabla businesses (paginacion, findByOwner)
      invoiceItemModel.js     # Tabla invoice_items (bulk insert, replace all)
      invoiceModel.js         # Tabla invoices (findByUser, paginacion, estado)
      invoiceModificationModel.js  # Tabla invoice_modifications (auditoria)
      invoiceParticipantModel.js   # Tabla invoice_participants (estado participante)
      serviceModel.js         # Tabla services (JOIN con businesses)
      transactionModel.js     # Tabla transactions (log blockchain)
      userModel.js            # Tabla users (role, findAll paginado)
    services/
      sorobanService.js       # Queries read-only y submit de XDR al contrato
  tests/
    setup.js                  # Variables de entorno para tests
    dbHelper.js               # Aislamiento transaccional (BEGIN/ROLLBACK)
    helpers.js                # Factories: loginWithNewWallet, createTestInvoice, etc.
    auth.test.js              # 12 tests
    businesses.test.js        # 10 tests
    health.test.js            # 2 tests
    images.test.js            # 6 tests
    invoiceParticipants.test.js  # 16 tests
    invoices.test.js          # 28 tests
    services.test.js          # 9 tests
    users.test.js             # 5 tests
```

## Capas

El backend sigue un patron MVC adaptado con 5 capas:

```
Request
  |
  v
Middleware      Helmet, CORS, rate limiting, body parsing, request ID
  |
  v
Routes          Define endpoints HTTP, aplica middleware de auth/autorizacion
  |
  v
Controllers     Logica de negocio: validacion, orquestacion, respuesta HTTP
  |
  v
Models          Acceso a datos: queries SQL parametrizados contra PostgreSQL
  |
  v
Services        Integracion externa: Soroban RPC (submit XDR, queries read-only)
  |
  v
Config          Conexiones: PostgreSQL pool, MinIO client, Soroban RPC client
```

### Middleware de seguridad (app.js)

Cada request pasa por esta cadena antes de llegar a las rutas:

1. **Helmet**: Inyecta headers de seguridad (X-Content-Type-Options, X-Frame-Options, CSP, HSTS)
2. **CORS**: Solo acepta origenes en `ALLOWED_ORIGINS` (whitelist)
3. **Body parser**: JSON con limite de 16KB
4. **Request ID**: UUID unico por request para trazabilidad
5. **Rate limiter global**: 100 req/min por IP
6. **Rate limiter auth**: 15 req/min en `/api/auth`
7. **Rate limiter uploads**: 10 req/min en `/images`

### Routes

Cada archivo de ruta registra endpoints en un `Router` de Express y aplica middleware en cadena:

- **Publicos**: Sin middleware adicional (ej: catalogo de negocios/servicios)
- **Autenticados**: `requireAuth` (verifica JWT con issuer/audience, adjunta `req.user` con role)
- **Admin**: `requireAuth` -> `requireAdmin` (verifica `role === 'admin'`)
- **Organizador**: `requireAuth` -> `loadInvoice` -> `requireInvoiceOrganizer`
- **Org/Participante**: `requireAuth` -> `loadInvoice` -> `requireInvoiceAccess`
- **Propietario**: `requireAuth` -> `loadBusiness` -> `requireBusinessOwner`
- **ID validado**: `validateId` rechaza IDs no numericos antes de queries

### Controllers

Cada controlador exporta funciones `(req, res, next)` que:

1. Validan inputs del request body/params/query (montos, fechas, formatos)
2. Verifican transiciones de estado validas (ej: release solo desde funding)
3. Invocan modelos para operaciones de base de datos
4. Invocan `sorobanService` cuando hay interaccion on-chain
5. Registran transacciones blockchain en la tabla `transactions`
6. Retornan respuesta JSON con el estado HTTP apropiado

### Models

Cada modelo es un objeto con metodos async que ejecutan queries SQL parametrizados via `pool.query`.
Patrones comunes:

- **JOINs de lectura**: Enrichecen datos con tablas relacionadas (ej: `invoiceModel.findAll` incluye organizer via JOIN)
- **Paginacion**: `findAll({page, limit})` con `LIMIT/OFFSET`, max 100 resultados
- **Queries por scope**: `invoiceModel.findByUser` devuelve facturas donde el usuario es organizador O participante
- **Bulk operations**: `invoiceItemModel.createMany` usa placeholders dinamicos para INSERT multiple
- **Replace pattern**: `invoiceItemModel.replaceAll` hace DELETE + INSERT para reemplazar items
- **Dynamic UPDATE**: `businessModel.update` y `serviceModel.update` construyen SET clauses dinamicos

### Services

`sorobanService.js` abstrae la interaccion con el contrato Soroban:

- **Read-only** (`callReadOnly`): Construye transaccion con source account dummy, ejecuta `simulateTransaction`
- **Write** (`submitTx`): Recibe XDR pre-firmado por el frontend, envia con `sendTransaction`, hace polling 30s
- **Sanitize**: Convierte `BigInt` a strings para serializacion JSON

## Sistema de roles y dashboards

### Roles

| Rol     | Descripcion                                                           |
|---------|-----------------------------------------------------------------------|
| `user`  | Rol por defecto. Puede crear negocios, organizar facturas, participar |
| `admin` | Super administrador. Acceso a todos los endpoints + panel admin       |

El rol se almacena en `users.role` y se incluye en el JWT. Los middleware verifican:

- `requireAuth`: Extrae `role` del JWT payload
- `requireAdmin`: Verifica `req.user.role === 'admin'`
- `requireInvoiceAccess`: Admin siempre tiene acceso; otros deben ser organizer/participant

### Endpoints por dashboard

```
Dashboard Super Admin (/api/admin)     Dashboard Empresas (/api/businesses)     Dashboard Usuario (/api/invoices)
├── GET /admin/stats                   ├── GET /businesses/my/list              ├── GET /invoices/my
├── GET /admin/users                   ├── GET /businesses/:id/services         ├── GET /invoices/:id
├── PUT /admin/users/:id/role          └── PUT /businesses/:id                  ├── POST /invoices
├── GET /admin/businesses                                                       ├── POST /invoices/:id/join
└── GET /admin/invoices                                                         ├── POST /invoices/:id/contribute
                                                                                └── POST /invoices/:id/confirm
```

## Middleware de autenticacion

### Flujo challenge-response (SEP-0053)

```
Frontend                          Backend
   |                                |
   |-- GET /api/auth/challenge ---->|  Genera nonce aleatorio
   |<--- { challenge } ------------|  Almacena en Map (5min TTL)
   |                                |
   | [Usuario firma con wallet]     |
   |                                |
   |-- POST /api/auth/login ------->|  Verifica firma Ed25519
   |    { wallet, signature }       |  SHA-256("Stellar Signed Message:\n" + challenge)
   |<--- { token, user } ----------|  JWT 24h con id, wallet, role, issuer, audience
   |                                |
   |-- GET /api/auth/me ----------->|  Verifica JWT (issuer + audience)
   |    Authorization: Bearer token |
   |<--- { user } -----------------|  Retorna perfil con role
```

### Cadenas de autorizacion

```
Endpoint publico:
  router.get('/', controller.getAll)

Endpoint autenticado:
  router.post('/', requireAuth, controller.create)

Endpoint admin:
  router.use(requireAuth, requireAdmin)
  router.get('/stats', controller.getStats)

Endpoint con scope de factura:
  router.get('/:id', validateId, requireAuth, loadInvoice, requireInvoiceAccess, controller.getById)

Endpoint de organizador:
  router.post('/:id/release', validateId, requireAuth, loadInvoice, requireInvoiceOrganizer, controller.release)

Endpoint de propietario:
  router.put('/:id', validateId, requireAuth, loadBusiness, requireBusinessOwner, controller.update)
```

## Flujo de facturas

### Ciclo de vida con validacion de estado

```
draft --> funding --> released
  |         |
  |         +--> cancelled (por organizador, o claim-deadline por cualquiera)
  |
  +-- cancel --> cancelled
  +-- updateItems (sin contrato, solo off-chain)
```

Transiciones validadas:

- `release`: solo desde `funding`
- `cancel`: solo desde `draft` o `funding`
- `link-contract`: solo si `contract_invoice_id` es null

### Creacion (draft)

1. `POST /api/invoices` con `name`, `items[]`, `deadline`
2. Valida: deadline en el futuro, items con descripciones y montos validos
3. Controller calcula `total_amount` sumando `item.amount`
4. `invoiceModel.create` inserta factura con status `'draft'`
5. `invoiceItemModel.createMany` inserta items en bulk
6. Retorna factura + items

### Vinculacion a contrato (draft -> funding)

1. Frontend construye transaccion `create_trip` en Soroban, usuario firma
2. `POST /api/invoices/:id/link-contract` con `signed_xdr`
3. Backend envia XDR a Soroban RPC via `submitTx`
4. `invoiceModel.linkContract` guarda `contract_invoice_id` y cambia status a `'funding'`
5. `transactionModel.create` registra la transaccion blockchain

### Contribucion, Retiro, Confirmacion, Liberacion, Cancelacion

(Ver README.md para la tabla completa de endpoints)

## Interaccion con otros componentes

```
Frontend ──HTTP──> Backend API
                      |
                      |---> PostgreSQL (users, businesses, services, invoices, transactions)
                      |---> MinIO (imagenes multimedia)
                      |---> Soroban RPC (submit XDR firmados, queries read-only)
```

- **Frontend**: Construye y firma transacciones Soroban con la wallet del usuario, envia XDR al backend
- **PostgreSQL**: Persiste datos off-chain, cache de estado financiero on-chain, historial de transacciones
- **MinIO**: Almacena archivos multimedia (max 5MB, solo JPEG/PNG/WebP/GIF)
- **Soroban**: Contrato escrow multi-pool que maneja fondos, penalizaciones y liberacion

## Modelo de datos

```
users (id, wallet_address, username, avatar_url, role, created_at)
  |
  |--- businesses (owner_id)
  |       |
  |       +--- services (business_id)
  |
  |--- invoices (organizer_id)
  |       |
  |       +--- invoice_items (invoice_id, service_id?)
  |       +--- invoice_participants (invoice_id, user_id)
  |       +--- invoice_modifications (invoice_id)
  |       +--- transactions (invoice_id, user_id)
  |
  +--- transactions (user_id)
```

## Seguridad implementada

| Capa         | Medida                                             | Implementacion           |
|--------------|----------------------------------------------------|--------------------------|
| Headers      | Security headers                                   | Helmet middleware        |
| Red          | CORS whitelist                                     | `ALLOWED_ORIGINS` env    |
| Red          | Rate limiting (global 100, auth 15, upload 10/min) | express-rate-limit       |
| Payload      | Body size limit 16KB                               | express.json({limit})    |
| Auth         | JWT con issuer + audience                          | jsonwebtoken verify opts |
| Auth         | JWT_SECRET obligatorio en produccion               | Fail-fast en startup     |
| Auth         | Facturas solo accesibles por scope                 | requireInvoiceAccess     |
| Auth         | Panel admin solo con rol admin                     | requireAdmin middleware  |
| Validacion   | IDs numericos positivos                            | validateId middleware    |
| Validacion   | Montos finitos positivos                           | parseAmount helper       |
| Validacion   | Deadlines en el futuro                             | Controller validation    |
| Validacion   | Transiciones de estado validas                     | Controller checks        |
| Upload       | Auth requerida + file type filter + 5MB limit      | multer + requireAuth     |
| Errores      | No expone stack traces en produccion               | errorHandler middleware  |
| Trazabilidad | Request ID (UUID) en cada request                  | Custom middleware        |

## Decisiones tecnicas

### Arquitectura hibrida on-chain/off-chain

- El **contrato Soroban** es la fuente de verdad para el estado financiero
- **PostgreSQL** cachea el estado on-chain para queries rapidas y almacena metadata
- El backend **no firma transacciones**: el frontend construye y firma, el backend solo envia al RPC

### Patron de sincronizacion

Despues de cada operacion on-chain exitosa (contribute, withdraw), el backend:

1. Registra la transaccion en la tabla `transactions`
2. Consulta el estado actualizado del contrato (`getTripState`, `getPenalty`)
3. Actualiza las tablas off-chain con los valores on-chain

### Para produccion

- Configurar `JWT_SECRET` con un secreto seguro de alta entropia
- Reemplazar challenge store in-memory por Redis
- Agregar observabilidad (logs estructurados, metricas, trazas)
- Validacion estricta de inputs con esquemas JSON (joi/zod)
- Considerar indexador dedicado para eventos Soroban
- Implementar refresh tokens y rotacion de JWT
