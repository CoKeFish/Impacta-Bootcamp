# Invoice Pool Escrow — Smart Contract Soroban

Un organizador abre un pool para pagar una factura. Los participantes contribuyen fondos. Cuando se alcanza el monto, el
contrato paga a cada wallet de la factura.

| Concepto                    | Descripcion                                                                                                                                   |
|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| **Pool de pago**            | Los fondos viven en el contrato hasta que se paga la factura                                                                                  |
| **Factura multi-wallet**    | La factura define wallets con montos (pueden incluir al organizador). Al completarse, cada wallet recibe su pago                              |
| **Sin overfunding**         | Las contribuciones que excedan el monto de la factura se rechazan                                                                             |
| **Consentimiento**          | Si la factura cambia, los participantes deciden si se quedan o se van — sin costo                                                             |
| **Penalizacion**            | Configurable (0-100%). La penalizacion queda en el pool: se usa para pagar la factura en release, o se devuelve al penalizado en cancel       |
| **Auto-release**            | Configurable por pool: pago automatico al alcanzar monto + minimo, o esperar a que todos los participantes confirmen (consentimiento unanime) |
| **Minimo de participantes** | El pool puede requerir un numero minimo de personas                                                                                           |
| **Deadline**                | Si no se alcanza el monto antes del deadline, los fondos se retornan a los participantes                                                      |
| **Cancelacion**             | El organizador puede cancelar con reembolso completo (incluye penalizaciones acumuladas)                                                      |

## Como funciona

```
1. Organizador crea un pool con una factura (monto total, wallets destino, deadline, minimo de personas, auto-release)
2. Participantes contribuyen fondos al pool (no se permite exceder el monto de la factura)
3. Si la factura cambia → los participantes pueden salir gratis o quedarse (consentimiento)
4. Si un participante se retira sin cambio de factura → penalizacion queda en el pool
5. Cuando total == monto factura AND participantes >= minimo → pool listo
6. Si auto_release: pago inmediato. Si no: cada participante confirma (confirm_release) → pago automatico al confirmar todos
7. En release → cada wallet de la factura recibe su monto, penalizaciones se pierden
8. En cancel → reembolso completo a todos + penalizaciones devueltas a quienes se retiraron
9. Si no se alcanza el monto antes del deadline → reembolso a todos
```

## Stack

| Componente  | Tecnologia                       |
|-------------|----------------------------------|
| Lenguaje    | Rust (`#![no_std]`)              |
| Plataforma  | Soroban (Stellar)                |
| Compilacion | WASM (`wasm32v1-none`)           |
| SDK         | `soroban-sdk` v25                |
| Red         | Stellar Testnet                  |
| Eventos     | `#[contractevent]` (Protocol 23) |

## Estructura

```
contracts/
├── cotravel-escrow/
│   └── src/
│       ├── lib.rs              # Contrato (~870 lineas)
│       └── test.rs             # 23 tests unitarios
├── Makefile                    # Build, test, deploy, demos
├── test-integration.sh         # 64 assertions en testnet
├── ARCHITECTURE.md             # Arquitectura detallada + diagramas
├── SECURITY_AUDIT.md           # Hallazgos del auditor y medidas
├── Dockerfile.dev              # Contenedor de desarrollo
└── Cargo.toml                  # Workspace config
```

## API

### Escritura (9 funciones)

| Funcion             | Quien                 | Que hace                                                                                  |
|---------------------|-----------------------|-------------------------------------------------------------------------------------------|
| `create_invoice`    | Organizador           | Abre un pool con factura: monto, wallets destino, deadline, penalizacion, auto_release    |
| `create_trip`       | Organizador           | Atajo legacy: pool sin destinatarios, manual release                                      |
| `contribute`        | Participante          | Aporta fondos al pool (rechaza si excede monto); auto-completa y auto-paga si configurado |
| `withdraw`          | Participante          | Se retira del pool (sin costo si la factura cambio; penalizacion queda en pool si no)     |
| `confirm_release`   | Participante          | Da consentimiento para pagar. Cuando todos confirman, el contrato paga automaticamente    |
| `release`           | Organizador           | Escape hatch: pago manual (organizer-only) para casos excepcionales                       |
| `update_recipients` | Organizador           | Modifica la factura; incrementa version (requiere re-consentimiento)                      |
| `cancel`            | Organizador           | Cancela el pool y reembolsa a todos + devuelve penalizaciones acumuladas                  |
| `claim_deadline`    | Cualquiera (sin auth) | Si paso el deadline y el pool sigue en Funding, reembolsa a todos + penalizaciones        |

### Lectura (10 funciones)

`get_trip_count`, `get_trips`, `get_trip`, `get_config`, `get_state`, `get_balance`, `get_participants`,
`get_recipients`, `get_penalty`, `get_confirmation`

### Eventos (8)

`TripCreatedEvent`, `ContributionEvent`, `WithdrawalEvent`, `ReleasedEvent`, `CancelledEvent`, `InvoiceModifiedEvent`,
`ConfirmReleaseEvent`, `DeadlineExpiredEvent`

## Mecanismo de consentimiento

Cuando la factura cambia (`update_recipients`), el contrato incrementa una version interna. Cada participante tiene
registrada la version en la que contribuyo.

- **Factura cambio despues de mi aporte** → puedo salir **gratis** (opt-out sin penalizacion)
- **Factura no cambio** → si me retiro, se aplica la penalizacion configurada

Esto garantiza que nadie pague algo que no acepto.

## Limites de seguridad

| Limite             | Valor          | Protege contra                     |
|--------------------|----------------|------------------------------------|
| `MAX_TRIPS`        | 10,000         | Crecimiento ilimitado del contrato |
| `MAX_PARTICIPANTS` | 200 por pool   | DoS en redistribucion/cancelacion  |
| `MAX_RECIPIENTS`   | 50 por factura | Storage excesivo                   |

Toda la aritmetica usa `checked_add/sub/mul`. Lecturas de Map usan `try_get`. Ver `SECURITY_AUDIT.md` para el informe
completo.

## Testing

| Tipo        | Comando                 | Cobertura                                                                                                                                                           |
|-------------|-------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Unitarios   | `make test`             | 23 tests: pools, contribuciones, retiros, pagos, cancelacion, recipients, consentimiento, overfunding, auto-release, penalty pool, confirm_release, deadline        |
| Integracion | `make test-integration` | 64 assertions en testnet: happy path, withdraw, cancel, aislamiento, multi-wallet + confirm_release, overfunding, auto-release, consent, cancel+penalties, deadline |

## Quick Start

```bash
# Entrar al contenedor
docker exec -it impacta-soroban-dev bash

# Setup + deploy + crear primer pool
make demo

# Flujo completo (contribuciones + pago)
make demo-full

# Ver todos los comandos
make help
```

## Despliegue

```
Network:  Stellar Testnet
Token:    CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC (XLM native)
Contract: ejecutar `make ids` para ver el ID actual
Explorer: https://stellar.expert/explorer/testnet/contract/{CONTRACT_ID}
```

## Documentacion relacionada

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Arquitectura, storage, estados, diagramas Mermaid

## TODO

- [ ] Agregar tests de flujos negativos (operaciones invalidas, permisos, limites)
- [ ] Revisar patrones de [Trustless Work (EaaS en Soroban)](https://docs.trustlesswork.com/) para considerar:
    - [ ] Milestones: release parcial por hitos (no todo-o-nada)
    - [ ] Dispute resolution: mecanismo de disputa entre participantes
    - [ ] Partial releases: liberar fondos parcialmente a recipients individuales
    - [ ] Roles y permisos: signer roles mas granulares (approver, receiver, arbitro)
    - [ ] Trustlines: manejo de trustlines para tokens custom (no solo XLM nativo)
