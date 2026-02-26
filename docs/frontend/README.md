# Frontend - CoTravel

Aplicacion web SPA que permite a usuarios conectar su wallet Stellar, crear facturas grupales,
contribuir fondos a un escrow on-chain, y gestionar negocios y servicios del catálogo.

## Stack

| Componente     | Tecnología                    | Propósito                                    |
|----------------|-------------------------------|----------------------------------------------|
| Framework      | React 19 + TypeScript         | UI componentes reactivos con tipado estricto |
| Build          | Vite 6                        | Bundler, dev server, HMR, proxy al backend   |
| Estilos        | Tailwind CSS 3                | Utility-first CSS con dark mode              |
| Componentes UI | Radix UI + shadcn/ui patterns | Botones, cards, badges accesibles            |
| Routing        | React Router 7                | SPA con 16 rutas                             |
| Server State   | TanStack React Query 5        | Cache, refetch, invalidación automática      |
| Client State   | Zustand 5                     | Wallet + auth state persistido               |
| Blockchain     | Stellar SDK 13 + Freighter 5  | Construir/firmar transacciones Soroban       |
| Iconos         | Lucide React                  | Iconografía consistente                      |

## Vistas

### Públicas

| Ruta              | Vista            | Descripción                            |
|-------------------|------------------|----------------------------------------|
| `/`               | Landing          | Hero, features, CTAs                   |
| `/services`       | Service Catalog  | Buscar servicios de todos los negocios |
| `/businesses/:id` | Business Profile | Perfil público + lista de servicios    |

### Autenticadas (wallet conectada)

| Ruta                           | Vista             | Descripción                                     |
|--------------------------------|-------------------|-------------------------------------------------|
| `/invoices`                    | Invoice Dashboard | Mis facturas (organizadas + participando)       |
| `/invoices/new`                | Create Invoice    | Crear factura con service picker + items custom |
| `/invoices/:id`                | Invoice Detail    | Ciclo de vida completo con acciones blockchain  |
| `/businesses`                  | My Businesses     | Dashboard de mis negocios                       |
| `/businesses/new`              | Register Business | Registrar nuevo negocio                         |
| `/businesses/:id/edit`         | Edit Business     | Editar negocio existente                        |
| `/businesses/:id/services/new` | Add Service       | Agregar servicio a un negocio                   |
| `/services/:id/edit`           | Edit Service      | Editar servicio existente                       |
| `/profile`                     | Profile           | Perfil, facturas, rol                           |

### Admin (URL oculta, rol `admin`)

| Ruta                | Vista            | Descripción                 |
|---------------------|------------------|-----------------------------|
| `/admin`            | Admin Dashboard  | Stats globales              |
| `/admin/users`      | Admin Users      | Gestión de usuarios y roles |
| `/admin/businesses` | Admin Businesses | Todos los negocios          |
| `/admin/invoices`   | Admin Invoices   | Todas las facturas          |

## Acciones Blockchain (Invoice Detail)

La vista `/invoices/:id` implementa el ciclo de vida completo del escrow:

| Acción             | Quién        | Estado requerido      | Transacción Soroban |
|--------------------|--------------|-----------------------|---------------------|
| Link to blockchain | Organizador  | `draft`               | `create_invoice`    |
| Join               | Cualquiera   | `funding`             | — (solo backend)    |
| Contribute         | Participante | `funding`             | `contribute`        |
| Withdraw           | Participante | `funding`/`completed` | `withdraw`          |
| Confirm release    | Participante | `completed`           | `confirm_release`   |
| Release funds      | Organizador  | `completed`           | `release`           |
| Cancel & refund    | Organizador  | `draft`/`funding`     | `cancel`            |
| Claim deadline     | Cualquiera   | `funding` + expirado  | `claim_deadline`    |

## Variables de Entorno

| Variable                  | Default                               | Descripción                        |
|---------------------------|---------------------------------------|------------------------------------|
| `VITE_CONTRACT_ID`        | —                                     | ID del contrato Soroban desplegado |
| `VITE_SOROBAN_RPC_URL`    | `https://soroban-testnet.stellar.org` | Endpoint RPC de Soroban            |
| `VITE_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015`   | Network passphrase de Stellar      |
| `VITE_XLM_SAC_ADDRESS`    | —                                     | SAC address del token XLM nativo   |

Valores de testnet en el proyecto:

```
VITE_CONTRACT_ID=CBZJNP3KVSWCTRQJNF6Y5P55WDIGZ5JSABKDZ4RBGLFUMFZQK5BKFBIC
VITE_XLM_SAC_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

## Estructura

```
src/
├── pages/                  # 13 vistas principales
│   ├── Landing.tsx
│   ├── InvoiceDashboard.tsx
│   ├── CreateInvoice.tsx
│   ├── InvoiceDetail.tsx      ← Ciclo de vida completo
│   ├── ServiceCatalog.tsx
│   ├── MyBusinesses.tsx
│   ├── RegisterBusiness.tsx
│   ├── BusinessProfile.tsx
│   ├── EditBusiness.tsx
│   ├── AddService.tsx
│   ├── EditService.tsx
│   ├── Profile.tsx
│   └── admin/              # 4 vistas admin (URL oculta)
│       ├── AdminDashboard.tsx
│       ├── AdminUsers.tsx
│       ├── AdminBusinesses.tsx
│       └── AdminInvoices.tsx
├── components/
│   ├── layout/             # Layout, Header (con mobile nav), Footer
│   ├── invoice/            # ProgressBar, InvoiceItemsList, ServicePicker, ModificationBanner
│   ├── wallet/             # ConnectButton (Freighter)
│   └── ui/                 # Button, Card, Badge (shadcn-style)
├── lib/
│   ├── soroban.ts          # Transaction builders para 8 operaciones del contrato
│   └── utils.ts            # cn(), truncateAddress(), formatXLM()
├── services/
│   └── api.ts              # 35+ funciones API tipadas (auth, invoices, businesses, admin)
├── stores/
│   └── walletStore.ts      # Zustand: wallet address, JWT, user (persistido)
├── hooks/
│   └── useAuth.ts          # Freighter connect + challenge-response auth
├── types/
│   └── index.ts            # 15 interfaces TypeScript alineadas con el backend
└── App.tsx                 # Router con 16 rutas
```

## Ejecución

El frontend corre dentro de Docker con proxy al backend:

```bash
docker compose up -d                       # Levantar todo
docker compose up -d --build frontend      # Reconstruir tras cambios
docker logs impacta-frontend --tail 20     # Ver logs
```

Desarrollo local (sin Docker):

```bash
cd frontend
npm install
npm run dev                                # http://localhost:5173
```

## Flujo de Transacciones

```
Usuario → Freighter (firma) → Frontend (XDR firmado) → Backend (submit) → Soroban RPC → Contrato
```

1. Frontend construye la transacción con `@stellar/stellar-sdk`
2. Frontend simula contra Soroban RPC (obtiene fees y auth entries)
3. Usuario firma con Freighter wallet
4. Frontend envía el XDR firmado al backend via API REST
5. Backend retransmite a Soroban RPC y sincroniza estado en PostgreSQL

## Arquitectura

Ver [ARCHITECTURE.md](../ARCHITECTURE.md) para diseño completo del sistema.
