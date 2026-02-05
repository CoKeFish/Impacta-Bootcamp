# CoTravel - Arquitectura Técnica

> La forma más simple de organizar viajes grupales y gestionar presupuestos compartidos con escrow en blockchain.

---

## Visión General

CoTravel es una plataforma que permite a grupos de amigos coordinar viajes, recolectar contribuciones hacia un
presupuesto compartido y aplicar reglas justas mediante smart contracts en Stellar/Soroban.

```mermaid
flowchart TB
    subgraph Platform["COTRAVEL PLATFORM"]
        FE[Frontend<br/>React + Vite]
        BE[Backend<br/>Node.js + Express]
        SC[Soroban Contract<br/>Rust]
        FE <--> BE
        BE <--> SC

        subgraph Storage["Almacenamiento"]
            DB[(PostgreSQL<br/>Datos)]
            S3[(MinIO<br/>Imágenes)]
        end

        BE --> DB
        BE --> S3
    end
```

---

## Stack Tecnológico

| Componente     | Tecnología                 | Propósito                                             |
|----------------|----------------------------|-------------------------------------------------------|
| Frontend       | React + Vite + Stellar SDK | Interfaz de usuario, conexión con wallets             |
| Backend        | Node.js + Express          | API REST, lógica de negocio, integración con partners |
| Base de datos  | PostgreSQL                 | Usuarios, grupos, viajes, transacciones               |
| Almacenamiento | MinIO (S3 compatible)      | Imágenes de perfil, fotos de viajes                   |
| Smart Contract | Soroban (Rust)             | Escrow, milestones, reembolsos automáticos            |
| Blockchain     | Stellar Network            | Transacciones, wallets grupales                       |

---

## Estructura del Proyecto

```mermaid
flowchart LR
subgraph Root["CoTravel"]
subgraph FE["frontend"]
C["components"]
H[hooks]
SV[services]
end

subgraph BK["backend"]
R[routes]
S[services]
M[models]
end

subgraph CT["contracts"]
E[escrow]
end

subgraph DB["database"]
I[init.sql]
end
end
```

---

## Servicios Docker

```mermaid
flowchart LR
    subgraph Docker["Docker Compose"]
        F[Frontend<br/>:5173]
        B[Backend<br/>:3000]
        P[(PostgreSQL<br/>:5432)]
        M[(MinIO<br/>:9000/:9001)]
        S[Soroban<br/>:8000/:8080]
    end

    F --> B
    B --> P
    B --> M
    B --> S
```

| Servicio   | Puerto      | Descripción               |
|------------|-------------|---------------------------|
| Frontend   | 5173        | Aplicación React          |
| Backend    | 3000        | API REST                  |
| PostgreSQL | 5432        | Base de datos relacional  |
| MinIO      | 9000 / 9001 | Almacenamiento de objetos |
| Soroban    | 8000 / 8080 | Red local Stellar + RPC   |

---

## Flujos Principales

### 1. Creación de Viaje Grupal

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant SC as Soroban
    U ->> FE: Crear viaje
    FE ->> BE: POST /trips
    BE ->> SC: Deploy contract
    SC -->> BE: Contract ID
    BE -->> FE: Trip + Contract ID
    FE -->> U: Link para compartir
```

### 2. Contribución al Presupuesto

```mermaid
sequenceDiagram
    actor P as Participante
    participant FE as Frontend
    participant W as Freighter Wallet
    participant SC as Soroban Contract
    P ->> FE: Contribuir XLM
    FE ->> W: Solicitar firma
    W -->> FE: Transacción firmada
    FE ->> SC: Enviar transacción
    Note over SC: Validar monto<br/>Actualizar balance<br/>Emitir evento
    SC -->> FE: Confirmación
    FE -->> P: Balance actualizado
```

### 3. Abandono y Reembolso

```mermaid
sequenceDiagram
    actor P as Participante
    participant SC as Soroban Contract
    participant G as Resto del Grupo
    P ->> SC: Solicitar retiro
    Note over SC: 1. Calcular penalización<br/>2. Retener % para grupo<br/>3. Redistribuir a miembros
    SC -->> P: Reembolso (- penalización)
    SC -->> G: Fondos redistribuidos
```

---

## Ciclo de Vida del Viaje

```mermaid
stateDiagram-v2
    [*] --> Creado: Organizador crea viaje
    Creado --> Financiando: Participantes se unen
    Financiando --> Financiando: Contribuciones
    Financiando --> Cancelado: No alcanza mínimo
    Financiando --> Completado: Meta alcanzada
    Completado --> EnCurso: Fondos liberados
    EnCurso --> Finalizado: Viaje terminado
    Cancelado --> [*]: Reembolso total
    Finalizado --> [*]
```

---

## Modelo de Datos

```mermaid
erDiagram
    USERS ||--o{ TRIPS: organiza
    USERS ||--o{ TRIP_PARTICIPANTS: participa
    TRIPS ||--o{ TRIP_PARTICIPANTS: tiene
    TRIPS ||--o{ TRIP_OFFERS: tiene
    TRIPS ||--o{ TRANSACTIONS: registra
    PARTNERS ||--o{ TRIP_OFFERS: ofrece
    TRIP_PARTICIPANTS ||--o{ TRANSACTIONS: genera

    USERS {
        int id PK
        string wallet_address UK
        string username
        string avatar_url
        timestamp created_at
    }

    TRIPS {
        int id PK
        int organizer_id FK
        string name
        string description
        decimal target_amount
        int min_participants
        timestamp deadline
        string contract_id
        string status
        timestamp created_at
    }

    TRIP_PARTICIPANTS {
        int trip_id FK
        int user_id FK
        decimal contributed_amount
        timestamp joined_at
        string status
    }

    TRANSACTIONS {
        int id PK
        int trip_id FK
        int user_id FK
        string type
        decimal amount
        string tx_hash
        timestamp created_at
    }

    PARTNERS {
        int id PK
        string name
        string category
        decimal discount_percent
        string logo_url
    }

    TRIP_OFFERS {
        int trip_id FK
        int partner_id FK
        string description
        decimal price
        boolean available
    }
```

---

## Smart Contract - Funcionalidades

```mermaid
flowchart TB
    subgraph Contract["Soroban Escrow Contract"]
        I[Inicialización]
        C[Contribución]
        W[Retiro/Abandono]
        R[Liberación]
        Q[Consultas]
    end

    I -->|" Monto objetivo<br/>Min. participantes<br/>Deadline<br/>% penalización "| Contract
    C -->|" Recibir fondos<br/>Actualizar balance "| Contract
    W -->|" Calcular penalización<br/>Redistribuir<br/>Reembolsar "| Contract
    R -->|" Verificar meta<br/>Liberar a organizador "| Contract
    Q -->|" Balance<br/>Total recaudado<br/>Lista miembros "| Contract
```

| Función             | Descripción                                                                           |
|---------------------|---------------------------------------------------------------------------------------|
| **Inicialización**  | Crear viaje con monto objetivo, mínimo de participantes, deadline y % de penalización |
| **Contribución**    | Recibir fondos de participantes y actualizar balances                                 |
| **Retiro/Abandono** | Calcular penalización, redistribuir al grupo, reembolsar                              |
| **Liberación**      | Liberar fondos al organizador cuando se cumple la meta                                |
| **Consultas**       | Balance por participante, total recaudado, lista de miembros                          |

---

## Integraciones Externas

```mermaid
flowchart TB
    APP[CoTravel App]
    APP --> FW[Freighter Wallet]
    APP --> SN[Stellar Network]
    APP --> PA[Partners API]

    subgraph FW[Freighter Wallet]
        A1[Autenticación]
        A2[Firma de TX]
        A3[Gestión keys]
    end

    subgraph SN[Stellar Network]
        B1[Testnet]
        B2[Mainnet]
        B3[Horizon API]
        B4[Soroban RPC]
    end

    subgraph PA[Partners API]
        C1[Hoteles]
        C2[Transporte]
        C3[Restaurantes]
        C4[Experiencias]
    end
```

---

## Seguridad

| Aspecto         | Implementación                            |
|-----------------|-------------------------------------------|
| Autenticación   | Wallet-based (Freighter)                  |
| Autorización    | Verificación de firma en cada transacción |
| Fondos          | Custodia en smart contract, no en backend |
| Datos sensibles | Encriptación en tránsito (HTTPS) y reposo |
| Contratos       | Auditoría antes de mainnet                |

---

## Ambientes

```mermaid
flowchart LR
    subgraph Local
        L1[Standalone Docker]
        L2[PostgreSQL local]
    end

    subgraph Testnet
        T1[Stellar Testnet]
        T2[PostgreSQL cloud]
    end

    subgraph Produccion
        P1[Stellar Mainnet]
        P2[PostgreSQL managed]
    end

    Local -->|Deploy| Testnet
    Testnet -->|Release| Produccion
```

| Ambiente   | Red Stellar         | Base de datos      | Uso             |
|------------|---------------------|--------------------|-----------------|
| Local      | Standalone (Docker) | PostgreSQL local   | Desarrollo      |
| Testnet    | Stellar Testnet     | PostgreSQL cloud   | QA / Staging    |
| Producción | Stellar Mainnet     | PostgreSQL managed | Usuarios reales |

---

## Próximos Pasos

- [ ] Inicializar frontend con Stellar Scaffold
- [ ] Crear contrato de escrow básico en Soroban
- [ ] Implementar API de viajes y participantes
- [ ] Integrar Freighter Wallet
- [ ] Diseñar flujo de invitaciones por link
- [ ] Desarrollar módulo de partners y ofertas
- [ ] Testing en testnet con usuarios reales
