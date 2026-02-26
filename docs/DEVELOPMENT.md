# CoTravel - Guia de Desarrollo

Referencia rapida de comandos y flujos para trabajar con el proyecto en local.

---

## Requisitos Previos

- Docker Desktop (con Docker Compose)
- Freighter wallet extension (para usar el frontend)
- Git

---

## Docker Compose

### Levantar servicios

Todos los servicios:

```bash
docker compose up -d
```

Solo backend + dependencias (postgres, minio):

```bash
docker compose up -d postgres minio backend
```

Solo frontend (requiere backend corriendo):

```bash
docker compose up -d frontend
```

Servicios de Soroban (nodo local + CLI de desarrollo):

```bash
docker compose up -d soroban soroban-dev
```

### Detener servicios

Detener todo:

```bash
docker compose down
```

Detener todo y borrar volumenes (reset completo de datos):

```bash
docker compose down -v
```

### Reconstruir imagenes

Reconstruir un servicio especifico (despues de cambiar Dockerfile o package.json):

```bash
docker compose build backend
```

```bash
docker compose build frontend
```

```bash
docker compose build soroban-dev
```

Reconstruir y levantar:

```bash
docker compose up -d --build backend
```

### Reiniciar un servicio

```bash
docker compose restart backend
```

```bash
docker compose restart frontend
```

### Ver logs

Logs de un servicio (en vivo):

```bash
docker compose logs -f backend
```

```bash
docker compose logs -f frontend
```

```bash
docker compose logs -f postgres
```

Logs de todos:

```bash
docker compose logs -f
```

Ultimas 50 lineas:

```bash
docker compose logs --tail=50 backend
```

### Estado de contenedores

```bash
docker compose ps
```

---

## Terminales Interactivas

### Backend (Node.js)

```bash
docker exec -it impacta-backend sh
```

### Frontend (Node.js)

```bash
docker exec -it impacta-frontend sh
```

### PostgreSQL (psql)

```bash
docker exec -it impacta-postgres psql -U impacta -d impacta_db
```

### MinIO (mc CLI)

```bash
docker exec -it impacta-minio sh
```

### Soroban Dev (Rust + Stellar CLI)

```bash
docker exec -it impacta-soroban-dev bash
```

### Consultas rapidas a la base de datos

Abrir psql directamente:

```bash
docker exec -it impacta-postgres psql -U impacta -d impacta_db
```

Ejecutar una query sin entrar al contenedor:

```bash
docker exec -it impacta-postgres psql -U impacta -d impacta_db -c "SELECT * FROM users;"
```

```bash
docker exec -it impacta-postgres psql -U impacta -d impacta_db -c "\dt"
```

Tablas disponibles: `users`, `businesses`, `services`, `invoices`, `invoice_items`, `invoice_participants`,
`invoice_modifications`, `transactions`

### Consola web de MinIO

Abrir en el navegador: http://localhost:9001

- Usuario: `minioadmin`
- Password: `minioadmin123`

---

## Testing

### Backend (Jest + Supertest)

Los tests de integracion usan PostgreSQL y MinIO reales (Docker). Cada test corre dentro de `BEGIN`/`ROLLBACK` para no
contaminar datos.

Ejecutar todos los tests (88 tests, 8 suites):

```bash
docker compose exec backend npm test
```

Ejecutar una suite especifica:

```bash
docker compose exec backend npx jest tests/health.test.js --verbose
```

```bash
docker compose exec backend npx jest tests/auth.test.js --verbose
```

```bash
docker compose exec backend npx jest tests/users.test.js --verbose
```

```bash
docker compose exec backend npx jest tests/businesses.test.js --verbose
```

```bash
docker compose exec backend npx jest tests/services.test.js --verbose
```

```bash
docker compose exec backend npx jest tests/invoices.test.js --verbose
```

```bash
docker compose exec backend npx jest tests/invoiceParticipants.test.js --verbose
```

```bash
docker compose exec backend npx jest tests/images.test.js --verbose
```

| Suite                         | Tests | Cobertura                                                                             |
|-------------------------------|-------|---------------------------------------------------------------------------------------|
| `health.test.js`              | 2     | Smoke test: API + DB + storage                                                        |
| `auth.test.js`                | 12    | Challenge, login, firma SEP-0053, JWT, /me                                            |
| `users.test.js`               | 5     | CRUD usuarios                                                                         |
| `businesses.test.js`          | 10    | CRUD empresas, permisos de owner, servicios por empresa                               |
| `services.test.js`            | 9     | CRUD servicios, busqueda, permisos de owner                                           |
| `invoices.test.js`            | 28    | CRUD facturas, link-contract, update items, release, cancel, deadline, access control |
| `invoiceParticipants.test.js` | 16    | Join, contribute, withdraw, confirm release, list participantes                       |
| `images.test.js`              | 6     | Upload, auth, get, list con MinIO real                                                |

**Prerequisito**: Los contenedores `postgres`, `minio` y `backend` deben estar corriendo.

### Smart Contract (Rust)

Entrar al contenedor de desarrollo:

```bash
docker exec -it impacta-soroban-dev bash
```

Dentro del contenedor:

```bash
cd cotravel-escrow
```

```bash
cargo test
```

---

## Smart Contract (Makefile)

El contrato tiene un Makefile con comandos para compilar, desplegar y operar. Todos se ejecutan **dentro del contenedor
**
`soroban-dev`:

```bash
docker exec -it impacta-soroban-dev bash
```

Ver todos los comandos disponibles:

```bash
make help
```

### Comandos principales

Compilar contrato (.rs -> .wasm):

```bash
make build
```

Tests unitarios:

```bash
make test
```

Setup completo (red + identidades + token):

```bash
make setup
```

Desplegar contrato en testnet:

```bash
make deploy
```

Demo: setup + deploy + crear viaje:

```bash
make demo
```

Demo completo: setup + deploy + contribuciones + release:

```bash
make demo-full
```

### Operaciones sobre viajes

Crear viaje:

```bash
make create-trip TARGET_AMOUNT=10000000000 MIN_PARTICIPANTS=2 PENALTY_PERCENT=10
```

Contribuir (participante 1):

```bash
make contribute-p1 AMOUNT=5000000000
```

Contribuir (participante 2):

```bash
make contribute-p2 AMOUNT=6000000000
```

Ver estado del viaje:

```bash
make state TRIP_ID=0
```

Ver participantes:

```bash
make participants TRIP_ID=0
```

Liberar fondos (solo organizador, cuando esta Completed):

```bash
make release TRIP_ID=0
```

Cancelar viaje (reembolso total):

```bash
make cancel TRIP_ID=0
```

> Los montos estan en **stroops** (1 XLM = 10,000,000 stroops). Ejemplo: 5 XLM = 5000000000.

---

## Frontend

### Desarrollo

El frontend corre en Vite con hot-reload. Los cambios en archivos `.tsx`/`.ts`/`.css` se reflejan automaticamente.

Levantar:

```bash
docker compose up -d frontend
```

Ver logs:

```bash
docker compose logs -f frontend
```

Abrir en el navegador: http://localhost:5173

### Proxy de API

Vite esta configurado con proxy hacia el backend. Las rutas `/api/*`, `/health` e `/images/*` se redirigen
automaticamente a `http://backend:3000`.

### Problemas comunes

**HMR no actualiza cambios (Windows + Docker)**:

```bash
docker compose restart frontend
```

Luego `Ctrl+Shift+R` en el navegador (hard refresh).

**Error de modulos despues de instalar dependencias**:

```bash
docker compose build frontend
```

```bash
docker compose up -d frontend
```

---

## Variables de Entorno

Las variables estan definidas directamente en `docker-compose.yml` para desarrollo. Ver `.env.example` como referencia.

| Variable                     | Valor (dev)                                                | Servicio |
|------------------------------|------------------------------------------------------------|----------|
| `DATABASE_URL`               | `postgresql://impacta:impacta123@postgres:5432/impacta_db` | Backend  |
| `MINIO_ENDPOINT`             | `minio`                                                    | Backend  |
| `MINIO_PORT`                 | `9000`                                                     | Backend  |
| `MINIO_ACCESS_KEY`           | `minioadmin`                                               | Backend  |
| `MINIO_SECRET_KEY`           | `minioadmin123`                                            | Backend  |
| `SOROBAN_RPC_URL`            | `https://soroban-testnet.stellar.org`                      | Backend  |
| `SOROBAN_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015`                        | Backend  |
| `CONTRACT_ID`                | `CBZJNP3...K5BKFBIC`                                       | Backend  |
| `JWT_SECRET`                 | `cotravel-dev-secret-change-in-production`                 | Backend  |

> El backend apunta a la **testnet publica** de Stellar, no al nodo local de Docker. Para usar el nodo local, cambiar
`SOROBAN_RPC_URL` a `http://soroban:8000/soroban/rpc`.

---

## Base de Datos

### Resetear schema

El schema se carga automaticamente al crear el contenedor de PostgreSQL desde `database/init.sql`. Para forzar un reset:

```bash
docker compose down -v
```

```bash
docker compose up -d postgres
```

### Reinicializar sin perder otros volumenes

```bash
docker compose stop postgres
```

```bash
docker volume rm impacta-bootcamp_postgres_data
```

```bash
docker compose up -d postgres
```

---

## Puertos

| Puerto | Servicio                 | URL                         |
|--------|--------------------------|-----------------------------|
| 3000   | Backend API              | http://localhost:3000       |
| 5173   | Frontend (Vite)          | http://localhost:5173       |
| 5432   | PostgreSQL               | `psql -h localhost -p 5432` |
| 9000   | MinIO API (S3)           | http://localhost:9000       |
| 9001   | MinIO Console            | http://localhost:9001       |
| 8000   | Horizon API (nodo local) | http://localhost:8000       |
| 8080   | Soroban RPC (nodo local) | http://localhost:8080       |

---

## Tips

- El backend tiene **hot-reload** con `node --watch` -- los cambios en archivos `.js` se aplican automaticamente.
- Los tests corren con `maxWorkers: 1` (secuencial) para evitar conflictos de DB.
- Los contenedores montan los directorios locales como volumenes (`./backend:/app`, `./frontend:/app`), asi que los
  cambios en tu editor se reflejan dentro del contenedor sin rebuild.
- `node_modules` se excluye del mount (`/app/node_modules`) -- si agregas una dependencia nueva, necesitas hacer
  `docker compose build <servicio>`.
