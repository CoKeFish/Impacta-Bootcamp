# Contracts - Smart Contracts Soroban

## Estructura del proyecto

```
contracts/
├── Dockerfile.dev          # Imagen Docker para desarrollo
├── Makefile                # Comandos para build, test, deploy
├── Cargo.toml              # Workspace configuration
├── Cargo.lock              # Dependencias bloqueadas
├── .gitignore
├── .contract_id            # ID del contrato desplegado (generado)
├── .token_id               # ID del token nativo (generado)
├── .trip_id                # ID del ultimo viaje creado (generado)
├── README.md
├── cotravel-escrow/        # Contrato de escrow
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs          # Codigo del contrato
│       └── test.rs         # Tests unitarios
└── target/                 # Build artifacts (generado)
```

---

## Que hace

Contrato **multi-escrow** en Soroban que maneja multiples viajes en un solo contrato desplegado:

- **Multiples viajes**: Un solo contrato gestiona N viajes independientes via `trip_id`
- **Custodia de fondos**: Los fondos de cada viaje viven en el contrato, no en el backend
- **Contribuciones**: Recibir y registrar aportes de participantes por viaje
- **Penalizaciones**: Calculo automatico por abandono y redistribucion al grupo
- **Liberacion**: Transferir fondos al organizador cuando se cumple la meta
- **Reembolsos**: Devolucion automatica si el viaje se cancela

---

## Arquitectura Multi-Trip

### Por que un contrato, multiples viajes?

| Aspecto       | Factory (1 contrato/viaje)  | Multi-Escrow (1 contrato, N viajes) |
|---------------|-----------------------------|-------------------------------------|
| Deploy        | Despliega WASM cada vez     | Un solo deploy                      |
| Costo         | ~100k stroops/viaje         | Solo costo de storage               |
| Complejidad   | Requiere factory + tracking | Logica simple con trip_id           |
| Aislamiento   | Total (contratos separados) | Por storage key (TripKey enum)      |
| Escalabilidad | Ilimitada pero cara         | Eficiente hasta miles de viajes     |

**Decision**: Multi-escrow es mas simple y economico para el caso de uso de CoTravel.

### Storage del contrato

| Dato                             | Tipo Storage | Scope     | Descripcion                         |
|----------------------------------|--------------|-----------|-------------------------------------|
| `NEXT_TRIP_ID`                   | Instance     | Global    | Contador auto-incremental de viajes |
| `TRIPS`                          | Instance     | Global    | Lista de todos los trip_id creados  |
| `TripKey::Config(trip_id)`       | Persistent   | Por viaje | Configuracion inmutable             |
| `TripKey::State(trip_id)`        | Persistent   | Por viaje | Estado mutable (status, totales)    |
| `TripKey::Balances(trip_id)`     | Persistent   | Por viaje | Map de wallet → balance             |
| `TripKey::Participants(trip_id)` | Persistent   | Por viaje | Vec de wallets participantes        |

---

## API del Contrato

### Gestion de viajes

```rust
/// Crear un nuevo viaje, retorna trip_id
fn create_trip(
    organizer: Address,      // Quien puede liberar fondos
    token: Address,          // Token de pago (ej: XLM nativo)
    target_amount: i128,     // Meta en stroops
    min_participants: u32,   // Minimo para completar
    deadline: u64,           // Timestamp limite
    penalty_percent: u32     // % penalizacion por abandono (0-100)
) -> u64
// - Requiere auth del organizador
```

### Operaciones (requieren trip_id)

```rust
/// Contribuir fondos a un viaje
fn contribute(trip_id: u64, participant: Address, amount: i128)
// - Requiere auth del participante
// - Actualiza balance y total
// - Auto-completa si alcanza meta + min_participants

/// Retirarse de un viaje (con penalizacion)
fn withdraw(trip_id: u64, participant: Address)
// - Requiere auth del participante
// - Calcula penalizacion segun penalty_percent
// - Redistribuye penalizacion a participantes restantes
// - Reembolsa (monto - penalizacion)

/// Liberar fondos al organizador (solo si Completed)
fn release(trip_id: u64)
// - Solo el organizador puede llamar
// - Transfiere total al organizador
// - Estado -> Released

/// Cancelar viaje y reembolsar todo (sin penalizacion)
fn cancel(trip_id: u64)
// - Solo el organizador puede llamar
// - Reembolso completo a todos los participantes
// - Estado -> Cancelled
```

### Consultas globales

```rust
/// Total de viajes creados
fn get_trip_count() -> u64

/// Lista de todos los trip_id
fn get_trips() -> Vec<u64>
```

### Consultas por viaje

```rust
/// Info resumida del viaje
fn get_trip(trip_id: u64) -> TripInfo

/// Configuracion del viaje
fn get_config(trip_id: u64) -> Config

/// Estado actual del viaje
fn get_state(trip_id: u64) -> State

/// Balance de un participante en un viaje
fn get_balance(trip_id: u64, participant: Address) -> i128

/// Lista de participantes de un viaje
fn get_participants(trip_id: u64) -> Vec<Address>
```

### Eventos

```rust
// Emitidos para indexacion off-chain
TripCreatedEvent { trip_id, organizer, target_amount }
ContributionEvent { trip_id, participant, amount, new_balance, total }
WithdrawalEvent { trip_id, participant, refund, penalty }
ReleasedEvent { trip_id, organizer, amount }
CancelledEvent { trip_id, timestamp }
```

---

## Ciclo de vida de un viaje

```
create_trip()
      │
      ▼
[Funding] ◄──── contribute()
      │              │
      │              │ (meta + min_participants)
      │              ▼
      │        [Completed]
      │              │
      │ cancel()     │ release()
      ▼              ▼
[Cancelled]    [Released]
```

**Transiciones de estado:**

- `Funding` → `Completed`: Cuando `total >= target` Y `participants >= min`
- `Completed` → `Funding`: Si un withdraw reduce por debajo del umbral
- `Funding/Completed` → `Cancelled`: Organizador cancela
- `Completed` → `Released`: Organizador libera fondos

---

## Desarrollo

### Stack

- **Lenguaje**: Rust
- **Plataforma**: Soroban (Stellar)
- **Compilacion**: WASM (target: wasm32v1-none)
- **Red**: Testnet publica de Stellar

### Desarrollo con Docker

```bash
# Acceder al contenedor de desarrollo
docker exec -it impacta-soroban-dev bash

# Ver todos los comandos disponibles (ya estas en /workspace)
make help
```

### Comandos del Makefile

```bash
# Setup completo (red + identidades + token)
make setup

# Compilar contrato
make build

# Ejecutar tests
make test

# Desplegar contrato
make deploy

# Crear un viaje
make create-trip
make create-trip TARGET_AMOUNT=20000000000 MIN_PARTICIPANTS=3

# Operaciones (usan TRIP_ID del archivo .trip_id por defecto)
make contribute-p1 AMOUNT=5000000000
make contribute-p2 AMOUNT=6000000000
make withdraw PARTICIPANT=participant1
make release
make cancel

# Consultas globales
make trip-count    # Total de viajes
make trips         # Lista de IDs

# Consultas por viaje
make trip          # Info completa
make state         # Estado
make config        # Configuracion
make participants  # Lista de participantes
make balance-p1    # Balance de participante 1

# Trabajar con viaje especifico
make state TRIP_ID=0
make contribute-p1 TRIP_ID=1 AMOUNT=1000000000

# Tests de integracion en testnet (automatizado)
make test-integration  # Setup + deploy + 4 flujos con 30 assertions

# Demos
make demo          # Setup + deploy + crear viaje
make demo-full     # Demo + contribuciones + release
make demo-multi    # Demo con multiples viajes

# Info
make ids           # Contract ID, Token ID, Trip ID
make addresses     # Direcciones de identidades
```

### URLs del entorno

- **Testnet RPC**: https://soroban-testnet.stellar.org
- **Friendbot**: https://friendbot.stellar.org
- **Explorer**: https://stellar.expert/explorer/testnet

---

## Persistencia de datos

### Se PIERDE al reiniciar el contenedor

| Dato                 | Ubicacion                         | Consecuencia                     |
|----------------------|-----------------------------------|----------------------------------|
| Configuracion de red | `/root/.config/stellar/network/`  | Ejecutar `make setup-network`    |
| Identidades (keys)   | `/root/.config/stellar/identity/` | Ejecutar `make setup-identities` |

### Se MANTIENE (volumen montado o testnet)

| Dato                    | Ubicacion                      | Notas                    |
|-------------------------|--------------------------------|--------------------------|
| Codigo fuente           | `/workspace/` → `./contracts/` | Volumen montado          |
| WASM compilado          | `/workspace/target/`           | Volumen montado          |
| Contract ID             | `/workspace/.contract_id`      | Volumen montado          |
| Token ID                | `/workspace/.token_id`         | Volumen montado          |
| Trip ID                 | `/workspace/.trip_id`          | Volumen montado          |
| Cargo cache             | Volumen Docker `cargo_cache`   | Acelera compilaciones    |
| **Contrato desplegado** | Testnet                        | Permanente en blockchain |
| **Transacciones**       | Testnet                        | Permanente en blockchain |

### Despues de reiniciar el contenedor

```bash
# 1. Reconfigurar red e identidades
make setup-network
make setup-identities

# 2. El contrato ya esta desplegado en testnet
#    Los archivos .contract_id, .token_id y .trip_id se conservan
make trip-count  # Verificar que funciona

# 3. Si necesitas redesplegar (nuevo contrato)
make clean   # Limpia .contract_id, .token_id, .trip_id
make setup   # Setup completo
make deploy  # Nuevo despliegue
make create-trip  # Crear primer viaje
```

---

## Interaccion con otros componentes

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│  1. Construye TX  2. Usuario firma con Freighter        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   SOROBAN RPC                           │
│  Ejecuta transaccion, actualiza estado del contrato     │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌──────────────────┐          ┌──────────────────┐
│    CONTRATO      │          │     BACKEND      │
│  - trip_id 0     │  eventos │  - Indexa eventos│
│  - trip_id 1     │ ───────► │  - Actualiza DB  │
│  - trip_id N     │          │  - Notifica      │
└──────────────────┘          └──────────────────┘
```

---

## Consideraciones tecnicas

### Diseno

- **Multi-trip via TripKey enum**: Cada viaje tiene storage aislado por trip_id
- **Auth explicita**: `require_auth()` en contribute, withdraw, release, cancel
- **Eventos estables**: Schema fijo para que el backend pueda indexar
- **Validaciones primero**: Verificar antes de ejecutar operaciones costosas

### Storage y costos

- **Instance**: Datos globales (NEXT_TRIP_ID, lista de TRIPS)
- **Persistent**: Datos por viaje (Config, State, Balances, Participants)
- **Evitar Temporary**: No hay datos efimeros en este caso de uso
- **Minimizar escrituras**: Actualizar solo lo necesario

### Seguridad

- Solo el organizador puede llamar `release()` y `cancel()`
- Solo participantes con balance > 0 pueden llamar `withdraw()`
- Validar montos positivos en `contribute()`
- Verificar deadline antes de contribuciones
- Validar penalty_percent <= 100

### Testing

```bash
# Tests unitarios (cargo test, rapido, sin red)
make test

# Tests incluidos (6 total):
# - test_create_trip: Crear multiples viajes, verificar IDs
# - test_contribute: Contribuciones y auto-complete
# - test_withdraw_with_penalty: Retiro con calculo de penalizacion
# - test_release: Liberacion de fondos al organizador
# - test_cancel: Cancelacion y reembolso
# - test_multiple_trips_isolation: Verificar aislamiento entre viajes

# Tests de integracion en testnet (setup + deploy + flujos reales)
make test-integration

# Flujos cubiertos (30 assertions):
# 1. Happy path:   create → contribute x2 → auto-complete → release
# 2. Withdraw:     penalizacion 10%, redistribucion al grupo
# 3. Cancel:       reembolso completo sin penalizacion
# 4. Aislamiento:  multiples viajes independientes, queries globales
#
# Sale con exit code 0 si todo pasa, o N (num de fallos).
```

---

## Despliegue actual (Testnet)

```
Contract ID: (ejecutar make ids para ver)
Token (XLM): CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
Network:     Test SDF Network ; September 2015
```

Ver en explorer: https://stellar.expert/explorer/testnet/contract/{CONTRACT_ID}

---

## TODO

- [ ] **Migrar eventos a `#[contractevent]`**: Las 5 llamadas a `env.events().publish()` estan deprecadas en SDK v25.
  Migrar a la macro `#[contractevent]` en los structs `TripCreatedEvent`, `ContributionEvent`, `WithdrawalEvent`,
  `ReleasedEvent`, `CancelledEvent`.
- [ ] **Instalar herramienta de auditoria en el contenedor**: Agregar al `Dockerfile.dev` una herramienta para auditar
  contratos Soroban (ej: `cargo-audit` para dependencias, `clippy` con lints de seguridad, o herramientas especificas de
  auditoria WASM).
- [ ] **Agregar tests de flujos negativos**: Tests unitarios y de integracion que verifiquen que el contrato rechaza
  operaciones invalidas:
  - Contribuir a un viaje que no esta en Funding (Released, Cancelled)
  - Contribuir monto <= 0
  - Contribuir despues del deadline
  - Withdraw sin balance (participante que no contribuyo)
  - Withdraw en estado Released o Cancelled
  - Release cuando el viaje no esta Completed (Funding, Cancelled)
  - Release por alguien que no es el organizador
  - Cancel por alguien que no es el organizador
  - Cancel de un viaje ya Released o ya Cancelled
  - Crear viaje con target_amount <= 0, min_participants = 0, penalty_percent > 100
