# Auditoria de Seguridad del Backend

Documento generado a partir de una revision exhaustiva del codigo fuente contra las
mejores practicas de la industria: OWASP API Security Top 10 (2023), OWASP REST Security
Cheat Sheet, Express.js Production Security Guidelines, y recomendaciones de seguridad
para aplicaciones Web3/wallet.

**Ultima actualizacion**: Febrero 2026

---

## Resumen ejecutivo

Se implementaron controles de seguridad que remedian la mayoria de los hallazgos criticos
y de alta severidad identificados en la auditoria original.

### Estado de remediacion

| Severidad | Total | Remediados | Pendientes | Descripcion                           |
|-----------|-------|------------|------------|---------------------------------------|
| Critica   | 5     | 4          | 1          | CORS, auth en facturas, rate limiting |
| Alta      | 9     | 7          | 2          | Validacion, state machine, JWT        |
| Media     | 8     | 6          | 2          | Helmet, error handler, body limit     |
| Baja      | 5     | 2          | 3          | Mejoras de defensa en profundidad     |

---

## OWASP API Security Top 10 (2023) vs Estado Actual

| #  | Riesgo OWASP                                    | Estado    | Implementado                             |
|----|-------------------------------------------------|-----------|------------------------------------------|
| 1  | Broken Object Level Authorization (BOLA)        | REMEDIADO | Facturas con scope, upload con auth      |
| 2  | Broken Authentication                           | REMEDIADO | JWT issuer/audience, JWT_SECRET forzado  |
| 3  | Broken Object Property Level Authorization      | PARCIAL   | Admin role, pero falta DTO pattern       |
| 4  | Unrestricted Resource Consumption               | REMEDIADO | Rate limiting, body limit, pagination    |
| 5  | Broken Function Level Authorization             | REMEDIADO | requireAdmin, requireInvoiceAccess       |
| 6  | Unrestricted Access to Sensitive Business Flows | PARCIAL   | Upload con auth, pero falta idempotencia |
| 7  | Server Side Request Forgery (SSRF)              | N/A       | --                                       |
| 8  | Security Misconfiguration                       | REMEDIADO | Helmet, CORS whitelist, error handler    |
| 9  | Improper Inventory Management                   | OK        | Rutas documentadas en README             |
| 10 | Unsafe Consumption of APIs                      | PARCIAL   | Soroban RPC timeout, falta retry         |

---

## Controles implementados

### 1. Security Headers (Helmet)

**Archivo**: `src/app.js`

```javascript
app.use(helmet());
```

Inyecta automaticamente: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Strict-Transport-Security`, `Content-Security-Policy`, `X-XSS-Protection`.

**Estado**: IMPLEMENTADO

---

### 2. CORS Whitelist

**Archivo**: `src/app.js`

```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
```

**Antes**: `app.use(cors())` -- aceptaba cualquier origen
**Estado**: IMPLEMENTADO

---

### 3. Rate Limiting

**Archivo**: `src/app.js`

| Scope  | Limite      | Ruta        |
|--------|-------------|-------------|
| Global | 100 req/min | Todas       |
| Auth   | 15 req/min  | `/api/auth` |
| Upload | 10 req/min  | `/images`   |

Se desactiva automaticamente en NODE_ENV=test para no interferir con test suites.

**Estado**: IMPLEMENTADO

---

### 4. Body Size Limit

**Archivo**: `src/app.js`

```javascript
app.use(express.json({limit: '16kb'}));
```

Previene payloads grandes que puedan causar DoS.

**Estado**: IMPLEMENTADO

---

### 5. Request ID para Trazabilidad

**Archivo**: `src/app.js`

Cada request recibe un UUID unico (`req.id`) para correlacionar logs y errores.

**Estado**: IMPLEMENTADO

---

### 6. JWT con Issuer y Audience

**Archivo**: `src/middleware/auth.js`

```javascript
jwt.sign(payload, SECRET, { issuer: 'cotravel-api', audience: 'cotravel-client' });
jwt.verify(token, SECRET, { issuer: 'cotravel-api', audience: 'cotravel-client' });
```

Previene reutilizacion de tokens entre servicios.

**Estado**: IMPLEMENTADO

---

### 7. JWT_SECRET Obligatorio en Produccion

**Archivo**: `src/middleware/auth.js`

```javascript
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
}
```

**Estado**: IMPLEMENTADO

---

### 8. Facturas Protegidas por Scope (BOLA fix)

**Archivo**: `src/routes/invoices.js`, `src/middleware/auth.js`

- `GET /api/invoices` eliminado -- reemplazado por `GET /api/invoices/my`
- `GET /api/invoices/:id` requiere auth + ser organizador, participante o admin
- `GET /api/invoices/:id/participants` mismo scope
- Middleware `requireInvoiceAccess` verifica acceso antes de entregar datos

**Antes**: Todos los endpoints de facturas eran publicos
**Estado**: IMPLEMENTADO

---

### 9. Upload de Imagenes Protegido

**Archivo**: `src/routes/images.js`

- `POST /images/upload` requiere auth (`requireAuth`)
- File type validation: solo JPEG, PNG, WebP, GIF
- Limite de 5MB por archivo
- Rate limiting de 10/min

**Antes**: Upload sin autenticacion ni validacion de tipo
**Estado**: IMPLEMENTADO

---

### 10. Validacion de IDs (validateId middleware)

**Archivo**: `src/middleware/auth.js`

```javascript
function validateId(req, res, next) {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({error: 'Invalid ID parameter'});
    }
    req.params.id = id;
    next();
}
```

Previene inyeccion SQL via parametros de ruta y errores de parseo.

**Estado**: IMPLEMENTADO

---

### 11. Validacion de Inputs en Controllers

**Archivo**: `src/controllers/invoicesController.js`

- Montos validados como numeros finitos positivos (`parseAmount`)
- Deadlines validados como fechas futuras
- Items validados por descripcion y monto
- Total calculado server-side (no confianza en el cliente)

**Estado**: IMPLEMENTADO

---

### 12. Validacion de Transiciones de Estado

**Archivo**: `src/controllers/invoicesController.js`

- `release`: solo desde status `funding`
- `cancel`: solo desde `draft` o `funding`
- `link-contract`: solo si `contract_invoice_id` es null (409 si ya vinculado)

**Antes**: Cualquier transicion era posible
**Estado**: IMPLEMENTADO

---

### 13. Error Handler Seguro

**Archivo**: `src/middleware/errorHandler.js`

- Errores 4xx: muestra mensaje al cliente
- Errores 5xx: responde "Internal server error", logs completos internamente
- Incluye request ID en logs para trazabilidad

**Antes**: Stack traces y mensajes internos expuestos al cliente
**Estado**: IMPLEMENTADO

---

### 14. Paginacion en Listados

- `invoiceModel.findAll({page, limit})` - max 100 por pagina
- `invoiceModel.findByUser({page, limit})`
- `businessModel.findAll({page, limit})`
- `userModel.findAll({page, limit})`
- Respuesta incluye `{data, total, page, limit}`

**Antes**: Listados sin limite devolvian todos los registros
**Estado**: IMPLEMENTADO

---

### 15. Sistema de Roles

**Archivo**: `database/init.sql`, `src/middleware/auth.js`

- Columna `role` en tabla `users` (default: 'user')
- Roles: `user`, `admin`
- JWT incluye role en payload
- Middleware `requireAdmin` para endpoints de administracion
- `requireInvoiceAccess` da acceso bypass a admins

**Estado**: IMPLEMENTADO

---

### 16. Panel de Administracion

**Archivo**: `src/routes/admin.js`, `src/controllers/adminController.js`

Endpoints protegidos con `requireAuth` + `requireAdmin`:

| Endpoint                      | Funcion                                 |
|-------------------------------|-----------------------------------------|
| GET /api/admin/stats          | Contadores globales                     |
| GET /api/admin/users          | Listado paginado de usuarios            |
| PUT /api/admin/users/:id/role | Cambiar rol (no puede removerse propio) |
| GET /api/admin/businesses     | Listado paginado de negocios            |
| GET /api/admin/invoices       | Listado paginado de facturas            |

**Estado**: IMPLEMENTADO

---

## Hallazgos pendientes (menor prioridad)

### P-01: DTO Pattern para Responses

**Severidad**: Media
**Descripcion**: Los modelos retornan `SELECT *`, exponiendo todos los campos de BD al cliente.
Implementar DTOs (Data Transfer Objects) para filtrar campos sensibles.

### P-02: Challenge Store In-Memory

**Severidad**: Media
**Descripcion**: El challenge store para auth es un `Map` en memoria. No persiste entre
reinicios y no escala a multiples instancias. Migrar a Redis.

### P-03: Idempotencia en Transacciones Blockchain

**Severidad**: Alta
**Descripcion**: Si un `submitTx` falla despues de que la transaccion fue aceptada por la red
pero antes de registrarla en la BD, se pierde la referencia. Implementar claves de idempotencia.

### P-04: Input Sanitization en Busqueda

**Severidad**: Baja
**Descripcion**: `serviceModel.search` usa `ILIKE` con input del usuario sin sanitizacion
especifica de caracteres SQL wildcard (%, _).

### P-05: Refresh Token Rotation

**Severidad**: Baja
**Descripcion**: JWT de 24h sin refresh token. Implementar refresh token rotation para
reducir ventana de exposicion si un token es comprometido.

### P-06: X-Content-Type-Options en MinIO responses

**Severidad**: Baja
**Descripcion**: Las respuestas de imagenes desde MinIO no incluyen
`X-Content-Type-Options: nosniff`. Agregar header en el proxy.

---

## Resumen de archivos modificados

| Archivo                                 | Cambio                                                                             |
|-----------------------------------------|------------------------------------------------------------------------------------|
| `database/init.sql`                     | Columna `role` en tabla users                                                      |
| `src/app.js`                            | Helmet, CORS whitelist, rate limiting, body limit, request ID                      |
| `src/middleware/auth.js`                | JWT issuer/audience, validateId, requireAdmin, requireInvoiceAccess, generateToken |
| `src/middleware/errorHandler.js`        | No expone internals en 500                                                         |
| `src/routes/invoices.js`                | Auth obligatoria, scope por organizador/participante                               |
| `src/routes/businesses.js`              | Endpoint /my/list para dashboard                                                   |
| `src/routes/images.js`                  | Auth en upload, file type filter, size limit                                       |
| `src/routes/admin.js`                   | NUEVO: Panel de administracion                                                     |
| `src/controllers/adminController.js`    | NUEVO: Stats, users, businesses, invoices                                          |
| `src/controllers/invoicesController.js` | Validacion inputs, state machine, /my                                              |
| `src/models/userModel.js`               | findAll paginado, count, updateRole                                                |
| `src/models/invoiceModel.js`            | findByUser, countByUser, paginacion                                                |
| `src/models/businessModel.js`           | findAll paginado, count                                                            |
