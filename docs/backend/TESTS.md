# Pruebas del Backend

## Resumen

| Suite                         |  Tests | Modulo                                      |
|-------------------------------|-------:|---------------------------------------------|
| `health.test.js`              |      2 | Health check y version de API               |
| `auth.test.js`                |     12 | Autenticacion Stellar + JWT                 |
| `users.test.js`               |      5 | Registro y consulta de usuarios             |
| `businesses.test.js`          |     10 | CRUD de negocios + control de acceso        |
| `services.test.js`            |      9 | CRUD de servicios + busqueda                |
| `images.test.js`              |      6 | Upload autenticado y descarga de imagenes   |
| `invoices.test.js`            |     28 | Ciclo de vida, acceso por scope, validacion |
| `invoiceParticipants.test.js` |     16 | Operaciones de participantes en facturas    |
| **Total**                     | **88** |                                             |

## Infraestructura de tests

### Framework

- **Jest** como test runner y assertion library
- **Supertest** para realizar requests HTTP directamente contra la app Express (sin levantar servidor)
- Todas las suites corren en serie (`maxWorkers: 1`) para evitar conflictos de base de datos

### Aislamiento transaccional

Cada test corre dentro de una transaccion que se revierte al final:

```
beforeEach -> BEGIN (parcha pool.query para usar el mismo client)
  |-> test ejecuta requests HTTP
  |-> requests usan pool.query parcheado (misma transaccion)
afterEach  -> ROLLBACK (deshace todo, DB queda limpia)
```

Implementado en `tests/dbHelper.js`. Parcha `pool.query` para redirigir todas las queries
al client transaccional, garantizando aislamiento total entre tests.

### Mocks

- **sorobanService**: Completamente mockeado via `jest.mock()`. Los tests no interactuan con
  la blockchain real. Cada test configura respuestas especificas (hash, ledger, returnValue).
- **MinIO**: Usa la instancia real del docker compose. Los archivos subidos se eliminan manualmente
  en `afterEach` para limpiar el object storage.

### Rate Limiting

Los rate limiters se desactivan automaticamente durante tests (`skip: () => NODE_ENV === 'test'`)
para evitar que la acumulacion de requests entre suites cause falsos 429.

### Factories (helpers.js)

| Helper               | Descripcion                                             |
|----------------------|---------------------------------------------------------|
| `loginWithNewWallet` | Genera wallet, completa challenge-response, retorna JWT |
| `createTestBusiness` | Crea negocio vinculado al usuario autenticado           |
| `createTestService`  | Crea servicio para un negocio                           |
| `createTestInvoice`  | Crea factura con items y deadline futuro                |

## Suites detalladas

### health.test.js (2 tests)

| Test                              | Endpoint      | Expectativa                                                   |
|-----------------------------------|---------------|---------------------------------------------------------------|
| GET / returns API running message | `GET /`       | 200, message contiene "CoTravel API running", version "2.0.0" |
| GET /health returns DB connected  | `GET /health` | 200, status "ok", database "connected"                        |

### auth.test.js (12 tests)

| Test                                           | Endpoint                          | Expectativa                 |
|------------------------------------------------|-----------------------------------|-----------------------------|
| Challenge with wallet returns challenge string | `GET /api/auth/challenge?wallet=` | 200, challenge string       |
| Challenge without wallet returns 400           | `GET /api/auth/challenge`         | 400                         |
| Login with valid signature returns JWT         | `POST /api/auth/login`            | 200, token + user           |
| Login creates new user on first login          | `POST /api/auth/login`            | user.id definido            |
| Login same wallet returns same user            | `POST /api/auth/login` x2         | Mismo user.id               |
| Login without wallet/signature returns 400     | `POST /api/auth/login`            | 400                         |
| Login without prior challenge returns 400      | `POST /api/auth/login`            | 400                         |
| Login with invalid signature returns 401       | `POST /api/auth/login`            | 401                         |
| Login with tampered signature returns 401      | `POST /api/auth/login`            | 401                         |
| Login unsupported provider returns 400         | `POST /api/auth/login`            | 400, "Unsupported provider" |
| Me with valid JWT returns user                 | `GET /api/auth/me`                | 200, user object            |
| Me without token returns 401                   | `GET /api/auth/me`                | 401                         |

### users.test.js (5 tests)

| Test                              | Endpoint                 | Expectativa          |
|-----------------------------------|--------------------------|----------------------|
| POST creates new user             | `POST /api/users`        | 201, user con wallet |
| POST duplicate wallet returns 409 | `POST /api/users`        | 409                  |
| POST without wallet returns 400   | `POST /api/users`        | 400                  |
| GET by wallet returns user        | `GET /api/users/:wallet` | 200, user            |
| GET non-existent returns 404      | `GET /api/users/:wallet` | 404                  |

### businesses.test.js (10 tests)

| Test                            | Endpoint                           | Expectativa                    |
|---------------------------------|------------------------------------|--------------------------------|
| GET returns array               | `GET /api/businesses`              | 200, array                     |
| GET includes created business   | `GET /api/businesses`              | Business presente en lista     |
| GET by ID returns business      | `GET /api/businesses/:id`          | 200, business con owner_wallet |
| GET non-existent returns 404    | `GET /api/businesses/:id`          | 404                            |
| POST with auth creates business | `POST /api/businesses`             | 201, business                  |
| POST without auth returns 401   | `POST /api/businesses`             | 401                            |
| POST missing name returns 400   | `POST /api/businesses`             | 400                            |
| PUT as owner succeeds           | `PUT /api/businesses/:id`          | 200                            |
| PUT as non-owner returns 403    | `PUT /api/businesses/:id`          | 403                            |
| GET services by business        | `GET /api/businesses/:id/services` | 200, array con servicio        |

### services.test.js (9 tests)

| Test                            | Endpoint                   | Expectativa             |
|---------------------------------|----------------------------|-------------------------|
| GET returns array               | `GET /api/services`        | 200, array              |
| GET includes created service    | `GET /api/services`        | Servicio presente       |
| Search returns matching         | `GET /api/services?q=test` | 200, resultados         |
| GET by ID returns service       | `GET /api/services/:id`    | 200, servicio           |
| GET non-existent returns 404    | `GET /api/services/:id`    | 404                     |
| POST creates service            | `POST /api/services`       | 201                     |
| POST missing fields returns 400 | `POST /api/services`       | 400                     |
| POST by non-owner returns 403   | `POST /api/services`       | 403                     |
| PUT updates service             | `PUT /api/services/:id`    | 200, nombre actualizado |

### images.test.js (6 tests)

| Test                                 | Endpoint                     | Expectativa         |
|--------------------------------------|------------------------------|---------------------|
| POST upload with auth succeeds       | `POST /images/upload` + auth | 201, filename + url |
| POST upload without auth returns 401 | `POST /images/upload`        | 401                 |
| POST upload without file returns 400 | `POST /images/upload` + auth | 400                 |
| GET returns image stream             | `GET /images/:filename`      | 200                 |
| GET non-existent returns 404         | `GET /images/:filename`      | 404                 |
| GET list returns array               | `GET /images`                | 200, array          |

### invoices.test.js (28 tests)

| Grupo                | Test                                          | Expectativa                                   |
|----------------------|-----------------------------------------------|-----------------------------------------------|
| **My Invoices**      | GET /my returns paginated invoices            | 200, data array, total, user_role "organizer" |
|                      | GET /my includes participant invoices         | user_role "participant"                       |
|                      | GET /my without auth returns 401              | 401                                           |
| **Detail**           | GET /:id as organizer returns invoice + items | 200, 2 items                                  |
|                      | GET /:id as participant returns invoice       | 200                                           |
|                      | GET /:id as non-participant returns 403       | 403                                           |
|                      | GET /:id non-existent returns 404             | 404                                           |
|                      | GET /:id without auth returns 401             | 401                                           |
|                      | GET /abc invalid ID returns 400               | 400                                           |
| **Create**           | POST creates invoice with items               | 201, status "draft", total_amount, items      |
|                      | POST calculates total from items              | total = sum of items                          |
|                      | POST validates deadline in future             | 400, "future"                                 |
|                      | POST missing items returns 400                | 400                                           |
|                      | POST without auth returns 401                 | 401                                           |
| **Link Contract**    | Link as organizer succeeds                    | 200, contract_invoice_id, status "funding"    |
|                      | Already linked returns 409                    | 409                                           |
|                      | Non-organizer returns 403                     | 403                                           |
| **Update Items**     | Draft update (no XDR)                         | 200, version 1, items replaced                |
|                      | Linked invoice requires XDR                   | 400, "signed_xdr required"                    |
|                      | Linked invoice with XDR succeeds              | 200, tx_hash                                  |
|                      | Non-organizer returns 403                     | 403                                           |
|                      | Empty items returns 400                       | 400                                           |
| **Release & Cancel** | Release funding invoice succeeds              | 200, status "released"                        |
|                      | Release draft returns 400                     | 400, "funding"                                |
|                      | Cancel succeeds                               | 200, status "cancelled"                       |
|                      | Release non-organizer returns 403             | 403                                           |
| **Claim Deadline**   | Linked invoice succeeds                       | 200, status "cancelled", tx_hash              |
|                      | Unlinked returns 400                          | 400                                           |

### invoiceParticipants.test.js (16 tests)

| Grupo               | Test                             | Expectativa                          |
|---------------------|----------------------------------|--------------------------------------|
| **Join**            | Adds participant                 | 201, invoice_id + user_id            |
|                     | Duplicate returns 409            | 409                                  |
|                     | Without auth returns 401         | 401                                  |
| **Contribute**      | Records contribution             | 200, tx_hash, contributed amount     |
|                     | Auto-joins participant           | Participante visible en lista        |
|                     | Missing fields returns 400       | 400                                  |
| **Withdraw**        | Records withdrawal               | 200, tx_hash                         |
|                     | Non-participant returns 404      | 404                                  |
| **Confirm Release** | Records confirmation             | 200, confirmed_release true, count 1 |
|                     | With XDR submits on-chain        | submitTx llamado                     |
|                     | Duplicate returns 409            | 409                                  |
|                     | Non-participant returns 404      | 404                                  |
|                     | Count increments per participant | count 1 -> 2                         |
| **List**            | Organizer sees participants      | 200, array con wallet_address        |
|                     | Non-existent invoice returns 404 | 404                                  |
|                     | Without auth returns 401         | 401                                  |

## Ejecucion

```bash
# Desde la raiz del proyecto
docker compose exec backend npm test

# Solo una suite
docker compose exec backend npx jest tests/invoices.test.js --verbose

# Con coverage
docker compose exec backend npx jest --coverage
```
