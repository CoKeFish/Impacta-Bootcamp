# Security Audit — CoTravel Escrow Contract

Registro de hallazgos del auditor (`soroban-auditor`) y medidas aplicadas.

---

## Resumen

| Severidad   | Hallazgos | Resueltos | Aceptados con mitigacion                        |
|-------------|-----------|-----------|-------------------------------------------------|
| CRITICAL    | 14        | 14        | 0                                               |
| MEDIUM      | 38        | 14        | 24 (22 dynamic_storage + 2 avoid_vec_map_input) |
| ENHANCEMENT | 9         | 0         | 9 (falsos positivos)                            |

---

## CRITICAL — Aritmetica sin proteccion (14 hallazgos)

**Problema**: Operaciones `+`, `-`, `*` pueden hacer overflow/underflow silencioso, corrompiendo el estado.

**Solucion**: Reemplazar toda aritmetica con variantes `checked_*`:

| Operacion                    | Funcion                               | Fix                      |
|------------------------------|---------------------------------------|--------------------------|
| `sum += r.amount`            | `create_invoice`, `update_recipients` | `sum.checked_add(...)`   |
| `trip_id + 1`                | `create_invoice`                      | `trip_id.checked_add(1)` |
| `current_balance + amount`   | `contribute`                          | `.checked_add(amount)`   |
| `participant_count += 1`     | `contribute`                          | `.checked_add(1)`        |
| `total_collected += amount`  | `contribute`                          | `.checked_add(amount)`   |
| `balance * penalty / 100`    | `withdraw`                            | `.checked_mul(...)`      |
| `balance - penalty`          | `withdraw`                            | `.checked_sub(penalty)`  |
| `participant_count - 1`      | `withdraw` (x2)                       | `.checked_sub(1)`        |
| `p_balance + share`          | `withdraw`                            | `.checked_add(share)`    |
| `total_collected -= balance` | `withdraw`                            | `.checked_sub(balance)`  |
| `amount - target_amount`     | `release`                             | `.checked_sub(...)`      |
| `version += 1`               | `update_recipients`                   | `.checked_add(1)`        |

Si alguna operacion desborda, el contrato hace panic con mensaje descriptivo (la TX se revierte).

---

## MEDIUM — Unsafe unwrap (6 hallazgos)

**Problema**: `.unwrap()` en lecturas de storage puede hacer panic sin contexto si el dato no existe.

**Solucion**: Reemplazar `.unwrap()` por `.unwrap_or_else(|| panic!("mensaje descriptivo"))` en todas las lecturas de
Balances y Participants.

---

## MEDIUM — Unsafe Map get (6 hallazgos)

**Problema**: `Map::get()` puede hacer panic internamente si la conversion de tipos falla.

**Solucion**: Reemplazar `balances.get(key).unwrap_or(0)` por `balances.try_get(key).unwrap_or_default().unwrap_or(0)`
en todas las lecturas de mapas. `try_get` retorna `Result<Option<V>>`, manejando tanto la ausencia como errores de
conversion sin panic.

---

## MEDIUM — Dynamic storage (22 hallazgos)

**Problema**: Almacenar `Map<Address, i128>`, `Map<Address, bool>`, `Vec<Address>`, `Vec<Recipient>` en
persistent/instance storage permite crecimiento no acotado, riesgo de DoS por storage cost.

**Mitigacion**: Se añadieron constantes de limites duros:

```rust
const MAX_TRIPS: u64 = 10_000;       // Maximo de pools en el contrato
const MAX_PARTICIPANTS: u32 = 200;    // Maximo de participantes por pool
const MAX_RECIPIENTS: u32 = 50;       // Maximo de destinatarios por factura
```

Colecciones afectadas y su cota:

- `Balances(id)`: `Map<Address, i128>` — acotado por MAX_PARTICIPANTS
- `Participants(id)`: `Vec<Address>` — acotado por MAX_PARTICIPANTS
- `Recipients(id)`: `Vec<Recipient>` — acotado por MAX_RECIPIENTS
- `ContribVersions(id)`: `Map<Address, u32>` — acotado por MAX_PARTICIPANTS
- `PenaltyPool(id)`: `Map<Address, i128>` — acotado por MAX_PARTICIPANTS
- `Confirmations(id)`: `Map<Address, bool>` — acotado por MAX_PARTICIPANTS
- `TRIPS`: `Vec<u64>` — acotado por MAX_TRIPS

Validaciones aplicadas:

- `create_invoice`: rechaza si `trip_id >= MAX_TRIPS` o `recipients.len() > MAX_RECIPIENTS`
- `contribute`: rechaza si `participant_count >= MAX_PARTICIPANTS` al agregar nuevo participante
- `update_recipients`: rechaza si `new_recipients.len() > MAX_RECIPIENTS`

**Nota**: El auditor seguira reportando estos 22 warnings porque detecta el **tipo** (`Map`/`Vec`) en `.set()`. Los
warnings son inherentes al uso de colecciones dinamicas en Soroban storage; los caps mitigan el riesgo real de
crecimiento no acotado.

---

## MEDIUM — Vec/Map input sin validar (2 hallazgos)

**Problema**: `Vec<Recipient>` como parametro de entrada podria contener datos maliciosos o excesivos.

**Mitigacion**: Ambas funciones (`create_invoice`, `update_recipients`) validan completamente el input **antes** de
almacenarlo:

1. **Longitud**: `recipients.len() > MAX_RECIPIENTS` → panic
2. **Montos positivos**: cada `r.amount > 0` → panic si no
3. **Suma correcta**: `sum(amounts) == target_amount` → panic si no

No hay datos sin validar que lleguen a storage.

---

## ENHANCEMENT — Storage change events (9 hallazgos)

**Problema reportado**: El auditor sugiere emitir eventos cuando se modifica storage.

**Realidad**: Todas las 9 funciones publicas mutantes **ya emiten eventos** via `#[contractevent]`:

| Funcion             | Evento                                                  |
|---------------------|---------------------------------------------------------|
| `create_invoice`    | `TripCreatedEvent`                                      |
| `create_trip`       | Delega a `create_invoice` → `TripCreatedEvent`          |
| `contribute`        | `ContributionEvent` (+ `ReleasedEvent` si auto-release) |
| `withdraw`          | `WithdrawalEvent`                                       |
| `confirm_release`   | `ConfirmReleaseEvent` (+ `ReleasedEvent` si ultimo)     |
| `release`           | `ReleasedEvent` (via `release_internal`)                |
| `cancel`            | `CancelledEvent`                                        |
| `claim_deadline`    | `DeadlineExpiredEvent`                                  |
| `update_recipients` | `InvoiceModifiedEvent`                                  |

El auditor no detecta el patron `.publish(&env)` de `#[contractevent]` (SDK v25 / Protocol 23) y reporta falsos
positivos.

---

## MEDIUM — Eventos deprecados (resuelto previamente)

**Problema**: 6 llamadas a `env.events().publish()` estaban deprecadas en SDK v25.

**Solucion**: Migrado a la macro `#[contractevent]` con `Struct { ... }.publish(&env)`. Los topics se mantienen para
compatibilidad con indexadores existentes.

---

## Cronologia de cambios

1. **Checked arithmetic**: 14 operaciones migradas a `checked_add/sub/mul`
2. **Safe unwrap**: 6 `.unwrap()` → `.unwrap_or_else(|| panic!("..."))`
3. **Safe Map access**: 6 `.get()` → `.try_get().unwrap_or_default()`
4. **Size bounds**: 3 constantes (`MAX_TRIPS`, `MAX_PARTICIPANTS`, `MAX_RECIPIENTS`) + 4 validaciones
5. **Input validation**: `Vec<Recipient>` longitud + contenido validado
6. **Event migration**: 6 `env.events().publish()` → `#[contractevent]` `.publish(&env)`
7. **Documentation**: Comentarios en `lib.rs` explicando warnings aceptados
8. **Nuevas funciones**: `confirm_release`, `claim_deadline` con checked arithmetic y eventos
9. **Nuevo storage**: `PenaltyPool`, `Confirmations` acotados por MAX_PARTICIPANTS
