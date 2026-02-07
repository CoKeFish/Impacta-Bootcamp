# Arquitectura — Invoice Pool Escrow Contract

---

## Modelo general

Un unico contrato WASM gestiona **N pools independientes**. Cada pool se identifica con un `pool_id` auto-incremental (
internamente `trip_id` por herencia del codigo) y tiene su propio storage aislado.

```mermaid
graph TB
    subgraph "Contrato Invoice Pool Escrow (1 deploy)"
        T0["pool 0<br/>Factura | Estado | Balances"]
        T1["pool 1<br/>Factura | Estado | Balances"]
        TN["pool N<br/>Factura | Estado | Balances"]
    end

    Frontend -->|" create_invoice<br/>contribute<br/>withdraw "| RPC["Soroban RPC"]
    RPC --> T0
    RPC --> T1
    RPC --> TN
    T0 -->|eventos| Backend
    T1 -->|eventos| Backend
    TN -->|eventos| Backend
    Backend -->|indexa| DB["PostgreSQL"]
```

---

## Concepto: Pool de pago

```mermaid
graph TB
    ORG["Organizador<br/>abre pool con factura"] --> POOL["Pool en el contrato"]
    P1["Participante 1"] -->|contribuye| POOL
    P2["Participante 2"] -->|contribuye| POOL
    P3["Participante 3"] -->|contribuye| POOL
    POOL -->|" monto alcanzado<br/>+ min personas "| PAY["Pago de factura"]
    PAY -->|" wallet A: $600 "| WA["Wallet A"]
    PAY -->|" wallet B: $300 "| WB["Wallet B"]
    PAY -->|" organizador: $100 "| WO["Wallet Organizador"]
```

---

## Tipos de datos

### Enums

```mermaid
classDiagram
    class Status {
        <<enum>>
        Funding
        Completed
        Cancelled
        Released
    }

    class TripKey {
        <<enum>>
        Config(u64)
        State(u64)
        Balances(u64)
        Participants(u64)
        Recipients(u64)
        ContribVersions(u64)
        PenaltyPool(u64)
        Confirmations(u64)
    }
```

> Nota: `TripKey` y `trip_id` son nombres internos del codigo por herencia. Conceptualmente representan pools y pool_id.

### Structs

```mermaid
classDiagram
    class Config {
        organizer: Address
        token: Address
        target_amount: i128
        min_participants: u32
        deadline: u64
        penalty_percent: u32
        auto_release: bool
    }
    note for Config "Configuracion del pool:\n- Quien lo administra\n- Token de pago\n- Monto de la factura\n- Minimo de personas\n- Deadline para contribuir\n- % penalizacion por abandono\n- Pago automatico al completar"

    class State {
        status: Status
        total_collected: i128
        participant_count: u32
        version: u32
        confirmation_count: u32
    }
    note for State "Estado mutable:\n- version se incrementa\n  cuando la factura cambia\n- confirmation_count rastreo\n  de consentimientos"

    class Recipient {
        address: Address
        amount: i128
    }
    note for Recipient "Una linea de la factura:\nwallet destino + monto\n(puede ser el organizador)"
```

---

## Storage

```mermaid
graph LR
    subgraph "Instance Storage (global)"
        NID["NEXT_ID<br/><i>u64 — contador de pools</i>"]
        TRIPS["TRIPS<br/><i>Vec — lista de pool_ids</i>"]
    end

    subgraph "Persistent Storage (por pool)"
        CFG["Config<br/><i>organizador, token, monto,<br/>min personas, deadline,<br/>penalty%, auto_release</i>"]
        ST["State<br/><i>status, total recaudado,<br/>num participantes, version</i>"]
        BAL["Balances<br/><i>Map wallet → aporte</i>"]
        PAR["Participants<br/><i>Vec de wallets</i>"]
        REC["Recipients<br/><i>Vec de Recipient<br/>(factura: wallet + monto)</i>"]
        CV["ContribVersions<br/><i>Map wallet → version<br/>al momento de aportar</i>"]
        PP["PenaltyPool<br/><i>Map wallet → penalty<br/>acumulada por retiros</i>"]
        CNF["Confirmations<br/><i>Map wallet → bool<br/>consentimiento para release</i>"]
    end
```

| Clave                 | Scope    | Descripcion                                                            | Limite                 |
|-----------------------|----------|------------------------------------------------------------------------|------------------------|
| `NEXT_ID`             | Global   | Contador auto-incremental de pools                                     | MAX_TRIPS = 10,000     |
| `TRIPS`               | Global   | Lista de pool_ids creados                                              | MAX_TRIPS              |
| `Config(id)`          | Por pool | Configuracion inmutable del pool (incluye auto_release)                | —                      |
| `State(id)`           | Por pool | Status, total recaudado, version                                       | —                      |
| `Balances(id)`        | Por pool | wallet → cuanto aporto                                                 | MAX_PARTICIPANTS = 200 |
| `Participants(id)`    | Por pool | Lista de wallets que aportaron                                         | MAX_PARTICIPANTS       |
| `Recipients(id)`      | Por pool | Factura: wallets destino + montos                                      | MAX_RECIPIENTS = 50    |
| `ContribVersions(id)` | Por pool | wallet → version cuando aporto                                         | MAX_PARTICIPANTS       |
| `PenaltyPool(id)`     | Por pool | wallet → penalty acumulada (devuelta en cancel, perdida en release)    | MAX_PARTICIPANTS       |
| `Confirmations(id)`   | Por pool | wallet → bool (consentimiento para release; reset al volver a Funding) | MAX_PARTICIPANTS       |

---

## Ciclo de vida de un pool

```mermaid
stateDiagram-v2
    [*] --> Funding: create_invoice()
    Funding --> Funding: contribute()
    Funding --> Completed: contribute() total == monto AND participantes >= min
    Funding --> Released: contribute() auto_release=true (Completed transitorio)
    Funding --> Cancelled: cancel()
    Completed --> Completed: confirm_release() consentimiento parcial
    Completed --> Funding: withdraw() cae por debajo del umbral (reset confirmaciones)
    Completed --> Released: confirm_release() todos confirman (auto-pago)
    Completed --> Released: release() escape hatch (organizador)
    Completed --> Cancelled: cancel()
    Released --> [*]
    Cancelled --> [*]
```

### Transiciones

| De                | A         | Trigger                                                                              | Quien        |
|-------------------|-----------|--------------------------------------------------------------------------------------|--------------|
| Funding           | Completed | `contribute()` — total == monto AND count >= min (auto_release=false)                | Participante |
| Funding           | Released  | `contribute()` — total == monto AND count >= min (auto_release=true, pago inmediato) | Participante |
| Completed         | Completed | `confirm_release()` — consentimiento parcial (aun faltan confirmaciones)             | Participante |
| Completed         | Released  | `confirm_release()` — ultimo participante confirma → pago automatico                 | Participante |
| Completed         | Funding   | `withdraw()` — total < monto OR count < min (reset confirmaciones)                   | Participante |
| Funding/Completed | Cancelled | `cancel()` — reembolso completo + devolucion de penalties                            | Organizador  |
| Funding           | Cancelled | `claim_deadline()` — deadline paso, pool en Funding                                  | Cualquiera   |
| Completed         | Released  | `release()` — escape hatch manual del organizador                                    | Organizador  |

---

## Flujos de fondos

### Contribucion al pool

```mermaid
sequenceDiagram
    participant P as Participante
    participant C as Contrato
    participant T as Token (XLM)
    participant W as Wallets Factura
    P ->> C: contribute(pool_id, amount)
    C ->> C: require_auth(participante)
    C ->> C: validar: status=Funding, amount>0, antes del deadline
    C ->> C: rechazar si total + amount > target (no overfunding)
    C ->> T: transfer(participante → contrato, amount)
    C ->> C: registrar balance, version, actualizar total
    alt total == monto factura AND participantes >= min
        C ->> C: status = Completed
        alt auto_release = true
            C ->> T: transfer(contrato → wallet1, monto1)
            C ->> T: transfer(contrato → wallet2, monto2)
            C ->> C: status = Released
        end
    end
    C -->> P: ContributionEvent + ReleasedEvent (si auto)
```

### Consentimiento y pago (confirm_release)

```mermaid
sequenceDiagram
    participant P1 as Participante 1
    participant P2 as Participante 2
    participant C as Contrato
    participant T as Token (XLM)
    participant W1 as Wallet Factura 1
    participant W2 as Wallet Factura 2
    Note over C: Pool en Completed, auto_release=false
    P1 ->> C: confirm_release(pool_id)
    C ->> C: require_auth(P1)
    C ->> C: validar: status=Completed, P1 tiene balance > 0
    C ->> C: registrar confirmacion, count = 1/2
    C -->> P1: ConfirmReleaseEvent{count=1, required=2}
    P2 ->> C: confirm_release(pool_id)
    C ->> C: require_auth(P2)
    C ->> C: registrar confirmacion, count = 2/2
    C -->> P2: ConfirmReleaseEvent{count=2, required=2}
    Note over C: Todos confirmaron → pago automatico
    C ->> T: transfer(contrato → wallet1, monto1)
    C ->> T: transfer(contrato → wallet2, monto2)
    C ->> C: status = Released, limpiar balances + PenaltyPool
    C -->> P2: ReleasedEvent
```

### Pago manual (release — escape hatch)

```mermaid
sequenceDiagram
    participant O as Organizador
    participant C as Contrato
    participant T as Token (XLM)
    participant W1 as Wallet Factura 1
    participant W2 as Wallet Factura 2
    O ->> C: release(pool_id)
    C ->> C: require_auth(organizador)
    C ->> C: validar: status=Completed

    alt Factura con destinatarios
        C ->> T: transfer(contrato → wallet1, monto1)
        C ->> T: transfer(contrato → wallet2, monto2)
    else Sin destinatarios (legacy)
        C ->> T: transfer(contrato → organizador, todo)
    end

    C ->> C: status = Released, limpiar balances
    C ->> C: limpiar PenaltyPool (penalties se pierden)
    C -->> O: ReleasedEvent
```

### Retiro de un participante (withdraw)

```mermaid
sequenceDiagram
    participant P as Participante
    participant C as Contrato
    participant T as Token (XLM)
    P ->> C: withdraw(pool_id)
    C ->> C: require_auth(participante)
    C ->> C: obtener balance y version de contribucion

    alt La factura cambio despues de mi aporte
        Note over C: version_pool > version_contribucion
        C ->> T: transfer(contrato → participante, 100% del aporte)
        Note over C: Sin penalizacion (opt-out libre)
    else La factura NO cambio
        C ->> C: penalty = aporte * penalty% / 100
        C ->> T: transfer(contrato → participante, aporte - penalty)
        C ->> C: guardar penalty en PenaltyPool
        Note over C: Penalty queda en el pool:<br/>- release → se pierde (paga factura)<br/>- cancel → se devuelve
    end

    C -->> P: WithdrawalEvent{refund, penalty}
```

### Cancelacion (reembolso completo)

```mermaid
sequenceDiagram
    participant O as Organizador
    participant C as Contrato
    participant T as Token (XLM)
    participant P1 as Participante activo
    participant P2 as Participante retirado
    O ->> C: cancel(pool_id)
    C ->> C: require_auth(organizador)

    loop Para cada participante activo
        C ->> T: transfer(contrato → participante, su aporte completo)
    end

    loop Para cada entrada en PenaltyPool
        C ->> T: transfer(contrato → participante retirado, su penalty)
    end

    C ->> C: status = Cancelled, limpiar balances + PenaltyPool
    C -->> O: CancelledEvent
```

---

## Sistema de consentimiento (versionado)

La factura puede cambiar despues de que los participantes ya aportaron. El contrato garantiza que **nadie pague algo que
no acepto**:

```mermaid
graph TD
    subgraph "1. Pool creado (version 0)"
        A1["Factura: Wallet_A=$600, Wallet_B=$400"]
    end

    subgraph "2. Participantes aportan"
        A2["P1 contribuye → registra version 0"]
        A3["P2 contribuye → registra version 0"]
    end

    subgraph "3. Factura cambia (version 1)"
        A4["Organizador llama update_recipients<br/>Nueva factura: Wallet_A=$300, Wallet_C=$700"]
    end

    subgraph "4. Participantes deciden"
        A5["P1: no estoy de acuerdo<br/>→ withdraw() → reembolso 100%<br/>(version 1 > version 0 = gratis)"]
        A6["P2: estoy de acuerdo<br/>→ contribute() de nuevo<br/>registra version 1"]
    end

    A1 --> A2
    A1 --> A3
    A2 --> A4
    A3 --> A4
    A4 --> A5
    A4 --> A6
```

**Regla**: Si `state.version > contributed_at_version`, el participante puede retirarse **sin penalizacion**. Si
contribuye de nuevo, acepta la nueva version.

---

## Eventos

Todos emitidos via `#[contractevent]` (SDK v25 / Protocol 23):

```mermaid
graph TB
    subgraph "Acciones del contrato"
        CI["create_invoice<br/>(abrir pool)"]
        CO["contribute<br/>(aportar al pool)"]
        WI["withdraw<br/>(retirarse)"]
        CR["confirm_release<br/>(consentimiento)"]
        RE["release<br/>(escape hatch)"]
        CA["cancel<br/>(cancelar pool)"]
        UR["update_recipients<br/>(modificar factura)"]
        CD["claim_deadline<br/>(deadline expirado)"]
    end

    CI -->|" topic: trip_new "| E1["TripCreatedEvent<br/>{pool_id, organizer, target_amount}"]
    CO -->|" topic: contrib "| E2["ContributionEvent<br/>{pool_id, participant, amount, new_balance, total}"]
    WI -->|" topic: withdraw "| E3["WithdrawalEvent<br/>{pool_id, participant, refund, penalty}"]
    CR -->|" topic: confirm "| E7["ConfirmReleaseEvent<br/>{pool_id, participant, confirmations, required}"]
    RE -->|" topic: released "| E4["ReleasedEvent<br/>{pool_id, organizer, amount}"]
    CA -->|" topic: cancel "| E5["CancelledEvent<br/>{pool_id, timestamp}"]
    UR -->|" topic: inv_mod "| E6["InvoiceModifiedEvent<br/>{pool_id, version}"]
    CD -->|" topic: deadline "| E8["DeadlineExpiredEvent<br/>{pool_id, timestamp, refunded_participants}"]
    E1 --> IDX["Backend Indexer"]
    E2 --> IDX
    E3 --> IDX
    E4 --> IDX
    E5 --> IDX
    E6 --> IDX
    E7 --> IDX
    E8 --> IDX
```

---

## Integracion con el sistema

```mermaid
graph TB
    subgraph "Frontend (React + Vite)"
        UI["UI de pools / facturas"]
        FR["Freighter Wallet"]
    end

    subgraph "Stellar Network"
        RPC["Soroban RPC<br/>soroban-testnet.stellar.org"]
        SC["Invoice Pool Contract"]
    end

    subgraph "Backend (Node.js + Express)"
        API["REST API"]
        SVC["sorobanService.js"]
    end

    subgraph "Infraestructura"
        PG["PostgreSQL"]
        MN["MinIO"]
    end

    UI -->|" 1. Construye TX "| SVC
    SVC -->|" 2. Simula + prepara "| RPC
    RPC -->|" 3. TX para firmar "| FR
    FR -->|" 4. TX firmada "| RPC
    RPC -->|" 5. Ejecuta "| SC
    SC -->|" 6. Eventos "| API
    API -->|" 7. Indexa "| PG
    UI -->|" 8. Polling estado "| API
```

---

## Permisos

```mermaid
graph LR
    subgraph "Organizador (require_auth)"
        F1["create_invoice — abrir pool"]
        F2["release — escape hatch (pago manual)"]
        F3["cancel — cancelar pool"]
        F4["update_recipients — modificar factura"]
    end

    subgraph "Participante (require_auth)"
        F5["contribute — aportar fondos"]
        F6["withdraw — retirarse"]
        F7["confirm_release — dar consentimiento"]
    end

    subgraph "Sin auth"
        F8["claim_deadline — refund si paso deadline"]
        F9["get_trip_count / get_trips"]
        F10["get_trip / get_config / get_state"]
        F11["get_balance / get_participants / get_recipients"]
        F12["get_penalty / get_confirmation"]
    end
```

---

## Cobertura de tests

### Unitarios (23)

```mermaid
graph TB
    subgraph "Pools basicos (6)"
        T1["test_create_trip<br/>Crear multiples pools, verificar IDs"]
        T2["test_contribute<br/>Aportes y auto-complete"]
        T3["test_withdraw_with_penalty<br/>Retiro con 10% penalty, queda en pool"]
        T4["test_release<br/>Pago al organizador"]
        T5["test_cancel<br/>Cancelar y reembolsar"]
        T6["test_multiple_trips_isolation<br/>Aislamiento entre pools"]
    end

    subgraph "Facturas con destinatarios (5)"
        T7["test_create_invoice_with_recipients<br/>Crear pool con factura multi-wallet"]
        T8["test_release_multi_recipient<br/>Pagar a cada wallet (sin excedente)"]
        T9["test_release_fallback_organizer<br/>Sin recipients → organizador"]
        T10["test_update_recipients<br/>Modificar factura, verificar version"]
        T11["test_update_recipients_invalid_total<br/>Rechazo si monto no cuadra"]
    end

    subgraph "Consentimiento factura (2)"
        T12["test_withdraw_penalty_free_after_modification<br/>Opt-out gratis tras cambio"]
        T13["test_withdraw_with_penalty_before_modification<br/>Penalizacion si no hubo cambio"]
    end

    subgraph "Overfunding + Auto-release + Penalties (3)"
        T14["test_overfunding_rejected<br/>Rechaza contribucion que excede target"]
        T15["test_auto_release<br/>Pago automatico al completar"]
        T16["test_cancel_returns_penalties<br/>Cancel devuelve penalties acumuladas"]
    end

    subgraph "Confirm release (4)"
        T17["test_confirm_release<br/>Todos confirman → pago automatico"]
        T18["test_confirm_release_resets_on_withdraw<br/>Withdraw revierte → reset confirmaciones"]
        T19["test_confirm_release_not_completed<br/>Rechaza si pool no esta Completed"]
        T20["test_confirm_release_double_confirm<br/>Rechaza doble confirmacion"]
    end

    subgraph "Deadline (3)"
        T21["test_claim_deadline<br/>Refund completo tras deadline"]
        T22["test_claim_deadline_with_penalties<br/>Devuelve penalties en deadline"]
        T23["test_claim_deadline_too_early<br/>Rechaza antes de deadline"]
    end
```

### Integracion (testnet, 64 assertions)

1. **Happy path**: crear pool → aportes → auto-complete → release (organizer escape hatch)
2. **Withdraw**: penalizacion 10%, penalty queda en PenaltyPool (no redistribuye)
3. **Cancel**: reembolso completo a participantes activos
4. **Aislamiento**: multiples pools independientes, verificacion cruzada de estados
5. **Multi-wallet + confirm_release**: create_invoice con recipients → contribuir → confirmar → auto-pago unanime
6. **Overfunding**: contribucion que excede target rechazada, estado no cambia
7. **Auto-release**: create_invoice auto_release=true → contribuir → pago inmediato sin confirm
8. **Consent**: contribute → update_recipients → withdraw sin penalty (opt-out gratis)
9. **Cancel + penalties**: withdraw con penalty → cancel → penalty devuelta al retirado
10. **Deadline**: pool en Funding → esperar deadline → claim_deadline → refund completo

---

## Decision de arquitectura: Multi-pool vs Factory

```mermaid
graph LR
    subgraph "Opcion A: Factory"
        F["Factory Contract"]
        F -->|deploy WASM| C1["Pool 1"]
        F -->|deploy WASM| C2["Pool 2"]
        F -->|deploy WASM| CN["Pool N"]
    end

    subgraph "Opcion B: Multi-Pool ✓"
        M["Invoice Pool Contract"]
        M -->|storage key| S1["pool 0"]
        M -->|storage key| S2["pool 1"]
        M -->|storage key| SN["pool N"]
    end
```

| Aspecto       | Factory                       | Multi-Pool                |
|---------------|-------------------------------|---------------------------|
| Deploy        | WASM por pool (~100k stroops) | Un solo deploy            |
| Costo         | Alto (deploy repetido)        | Bajo (solo storage)       |
| Complejidad   | Factory + tracking            | Logica simple con pool_id |
| Aislamiento   | Total (contratos separados)   | Por storage key           |
| Escalabilidad | Ilimitada pero cara           | Hasta 10,000 pools        |

**Decision**: Multi-pool. Mas simple, mas economico, suficiente para el caso de uso.

---

## Persistencia

```mermaid
graph TB
    subgraph "Se pierde al reiniciar contenedor"
        N1["Config de red Stellar"]
        N2["Identidades (keys)"]
    end

    subgraph "Se mantiene (volumen montado)"
        Y1["Codigo fuente"]
        Y2["WASM compilado"]
        Y3["IDs (contract, token, pool)"]
    end

    subgraph "Permanente (blockchain)"
        B1["Contrato desplegado"]
        B2["Transacciones"]
        B3["Estado de todos los pools"]
    end
```

Despues de reiniciar:

```bash
make setup-network       # Reconfigurar red
make setup-identities    # Recrear identidades
make trip-count          # Verificar que el contrato responde
```
