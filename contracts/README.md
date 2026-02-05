# Contracts - Smart Contracts Soroban

## Qué hace

Contrato de escrow en Soroban que maneja la lógica financiera verificable on-chain para CoTravel:

- **Custodia de fondos**: Los fondos del grupo viven en el contrato, no en el backend
- **Contribuciones**: Recibir y registrar aportes de participantes
- **Penalizaciones**: Cálculo automático por abandono y redistribución al grupo
- **Liberación**: Transferir fondos al organizador cuando se cumple la meta
- **Reembolsos**: Devolución automática si el viaje se cancela

---

## Qué va ON-CHAIN (y por qué)

> **Principio**: Solo va on-chain lo que requiere **confianza sin intermediarios** o **verificación pública**.

### Storage del contrato

| Dato                 | Tipo Storage | Justificación                                                      |
|----------------------|--------------|--------------------------------------------------------------------|
| `organizer`          | Instance     | Inmutable, quien recibe fondos al final                            |
| `target_amount`      | Instance     | Meta financiera, verificable públicamente                          |
| `min_participants`   | Instance     | Regla de negocio, no puede cambiar                                 |
| `deadline`           | Instance     | Límite temporal, ejecutable automáticamente                        |
| `penalty_percent`    | Instance     | Regla de penalización, transparente para todos                     |
| `status`             | Persistent   | Estado actual del escrow (Creado/Financiando/Completado/Cancelado) |
| `total_collected`    | Persistent   | Suma total de contribuciones                                       |
| `balances` (Map)     | Persistent   | Balance por participante (wallet → amount)                         |
| `participants` (Vec) | Persistent   | Lista de wallets que han contribuido                               |

### Funciones del contrato

```rust
// Inicialización (deploy)
fn initialize(
    organizer: Address,
    target_amount: i128,
    min_participants: u32,
    deadline: u64,
    penalty_percent: u32
)

// Contribuir fondos
fn contribute(participant: Address, amount: i128)
// - Requiere auth del participante
// - Actualiza balance y total
// - Emite evento: Contribution { participant, amount, new_balance }

// Abandonar viaje
fn withdraw(participant: Address)
// - Calcula penalización
// - Redistribuye al resto del grupo
// - Reembolsa (monto - penalización)
// - Emite evento: Withdrawal { participant, refund, penalty, redistributed }

// Liberar fondos (organizador)
fn release()
// - Verifica: status == Completado, caller == organizer
// - Transfiere total al organizador
// - Emite evento: Released { organizer, amount }

// Cancelar y reembolsar todo
fn cancel()
// - Solo si no se alcanzó meta antes del deadline
// - Reembolso total a cada participante
// - Emite evento: Cancelled { refunds: Map<Address, i128> }

// Consultas (view)
fn get_balance(participant: Address) -> i128
fn get_total() -> i128
fn get_status() -> Status
fn get_participants() -> Vec<Address>
```

### Eventos (para indexación)

```rust
// El backend escucha estos eventos para sincronizar estado off-chain
enum Event {
    Contribution { participant: Address, amount: i128, total: i128 },
    Withdrawal { participant: Address, refund: i128, penalty: i128 },
    Released { organizer: Address, amount: i128 },
    Cancelled { timestamp: u64 },
    StatusChanged { old: Status, new: Status }
}
```

---

## Qué NO va on-chain

| Dato                | Razón                                     | Dónde va   |
|---------------------|-------------------------------------------|------------|
| Nombre del viaje    | Solo UX, no afecta lógica financiera      | PostgreSQL |
| Descripción         | Contenido, no verificable                 | PostgreSQL |
| Imágenes            | Pesado, no pertenece en blockchain        | MinIO      |
| Usernames/avatares  | Preferencias de usuario                   | PostgreSQL |
| Ofertas de partners | Datos de terceros, cambian frecuentemente | PostgreSQL |
| Notificaciones      | Lógica de aplicación                      | Backend    |
| Analytics           | Métricas de producto                      | PostgreSQL |

---

## Ciclo de vida del escrow

```
[Creado]
    │ initialize()
    ▼
[Financiando] ◄──── contribute()
    │                    │
    │ (deadline sin meta)│ (meta alcanzada)
    ▼                    ▼
[Cancelado]        [Completado]
    │                    │
    │ cancel()           │ release()
    ▼                    ▼
[Reembolsado]      [Liberado]
```

---

## Cómo lo hace

### Stack

- **Lenguaje**: Rust
- **Plataforma**: Soroban (Stellar)
- **Compilación**: WASM (target: wasm32v1-none)
- **Red**: Testnet pública de Stellar

### Desarrollo con Docker

```bash
# Acceder al contenedor de desarrollo
docker exec -it impacta-soroban-dev bash
cd /workspace/escrow

# Ver todos los comandos disponibles
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

# Inicializar escrow
make init

# Operaciones
make contribute-p1 AMOUNT=5000000000  # Participante 1 contribuye
make contribute-p2 AMOUNT=6000000000  # Participante 2 contribuye
make withdraw PARTICIPANT=participant1  # Retiro con penalización
make release                            # Liberar fondos al organizador
make cancel                             # Cancelar y reembolsar

# Consultas
make state         # Ver estado del escrow
make config        # Ver configuración
make participants  # Ver lista de participantes
make balance-p1    # Ver balance de participante 1
make ids           # Ver IDs de contrato y token
make addresses     # Ver direcciones de identidades

# Demo completo
make demo-full     # Setup + deploy + init + contribuciones + release
```

### URLs del entorno

- **Testnet RPC**: https://soroban-testnet.stellar.org
- **Friendbot**: https://friendbot.stellar.org
- **Explorer**: https://stellar.expert/explorer/testnet

---

## Persistencia de datos

### Se PIERDE al reiniciar el contenedor

| Dato                 | Ubicación                         | Consecuencia                     |
|----------------------|-----------------------------------|----------------------------------|
| Configuración de red | `/root/.config/stellar/network/`  | Ejecutar `make setup-network`    |
| Identidades (keys)   | `/root/.config/stellar/identity/` | Ejecutar `make setup-identities` |

### Se MANTIENE (volumen montado o testnet)

| Dato                    | Ubicación                        | Notas                    |
|-------------------------|----------------------------------|--------------------------|
| Código fuente           | `/workspace/` → `./contracts/`   | Volumen montado          |
| WASM compilado          | `/workspace/escrow/target/`      | Volumen montado          |
| Contract ID             | `/workspace/escrow/.contract_id` | Volumen montado          |
| Token ID                | `/workspace/escrow/.token_id`    | Volumen montado          |
| Cargo cache             | Volumen Docker `cargo_cache`     | Acelera compilaciones    |
| **Contrato desplegado** | Testnet                          | Permanente en blockchain |
| **Transacciones**       | Testnet                          | Permanente en blockchain |

### Después de reiniciar el contenedor

```bash
# 1. Reconfigurar red e identidades
make setup-network
make setup-identities

# 2. El contrato ya está desplegado en testnet
#    Los archivos .contract_id y .token_id se conservan
make state  # Verificar que funciona

# 3. Si necesitas redesplegar (nuevo contrato)
make clean   # Limpia .contract_id y .token_id
make setup   # Setup completo
make deploy  # Nuevo despliegue
make init    # Inicializar
```

### Notas importantes

- **Las identidades son nuevas** cada vez que se reinicia el contenedor
- **El contrato en testnet persiste** pero las nuevas identidades no tienen acceso como organizer/participants
- **Para continuar con el mismo contrato**: Necesitarías exportar/importar las claves privadas (no recomendado para
  desarrollo)
- **Mejor práctica**: Redesplegar el contrato con `make demo` después de reiniciar

---

## Interacción con otros componentes

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│  1. Construye TX  2. Usuario firma con Freighter        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   SOROBAN RPC                           │
│  Ejecuta transacción, actualiza estado del contrato     │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌──────────────────┐          ┌──────────────────┐
│    CONTRATO      │          │     BACKEND      │
│  - Balances      │  eventos │  - Indexa eventos│
│  - Total         │ ───────► │  - Actualiza DB  │
│  - Status        │          │  - Notifica      │
└──────────────────┘          └──────────────────┘
```

---

## Consideraciones técnicas

### Diseño

- **Auth explícita**: `require_auth()` en contribute, withdraw, release
- **Eventos estables**: Schema fijo para que el backend pueda indexar
- **Validaciones primero**: Verificar antes de ejecutar operaciones costosas

### Storage y costos

- **Instance**: Config inmutable (organizer, target, rules)
- **Persistent**: Estado mutable crítico (balances, total, status)
- **Evitar Temporary**: No hay datos efímeros en este caso de uso
- **Minimizar escrituras**: Actualizar solo lo necesario

### Seguridad

- Solo el organizador puede llamar `release()`
- Solo participantes con balance > 0 pueden llamar `withdraw()`
- Validar montos positivos en `contribute()`
- Verificar deadline antes de cambios de estado

### Testing

```bash
# Ejecutar tests unitarios
make test

# Tests incluidos:
# - test_initialize: Configuración inicial del escrow
# - test_contribute: Contribuciones de participantes
# - test_withdraw_with_penalty: Retiro con cálculo de penalización
# - test_release: Liberación de fondos al organizador
# - test_cancel: Cancelación y reembolso
```

---

## Despliegue actual (Testnet)

```
Contract ID: CBLKXA5V23S5WCZMEXZXBZG444XSPVX4WLLHJ75Y344HFRBZ4E2MGCAH
Token (XLM): CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
Network:     Test SDF Network ; September 2015
```

Ver en
explorer: https://stellar.expert/explorer/testnet/contract/CBLKXA5V23S5WCZMEXZXBZG444XSPVX4WLLHJ75Y344HFRBZ4E2MGCAH
