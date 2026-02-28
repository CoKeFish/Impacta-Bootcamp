<p align="center">
  <img src="frontend/public/logo.png" alt="CoTravel Logo" width="120" />
</p>

<h1 align="center">CoTravel</h1>

<h3 align="center">Viajes grupales con pagos compartidos en blockchain</h3>

<p align="center">
  <a href="https://stellar.org"><img src="https://img.shields.io/badge/Built%20on-Stellar-blue?style=flat-square" alt="Built on Stellar" /></a>
  <a href="https://soroban.stellar.org"><img src="https://img.shields.io/badge/Smart%20Contracts-Soroban-blueviolet?style=flat-square" alt="Soroban" /></a>
  <img src="https://img.shields.io/badge/Status-Prototype-orange?style=flat-square" alt="Status: Prototype" />
</p>

<p align="center">
  <a href="https://cotravel.up.railway.app">Ver demo en vivo</a>
</p>

---

> **Stellar Give x Stellar Impacta Bootcamp** — Proyecto desarrollado como parte de la iniciativa **Stellar Give**
> dentro del **Stellar Impacta Bootcamp**, un programa del Stellar Community Fund enfocado en construir
> soluciones blockchain con impacto real sobre la red Stellar.

---

## El problema

Organizar viajes en grupo es complicado. Recolectar dinero, coordinar presupuestos y manejar cancelaciones termina en
chats interminables, hojas de cálculo y problemas de confianza. Cuando alguien se retira, el viaje entero se complica y
todos pierden tiempo y dinero.

## La solución

CoTravel es una plataforma donde los grupos financian viajes de forma colectiva usando un contrato inteligente en
Stellar. Cada participante contribuye a un fondo compartido con reglas claras: monto objetivo, fecha límite, penalidades
por retiro y distribución automática de pagos a los proveedores (hoteles, tours, restaurantes).

**Sin intermediarios. Sin confianza ciega. Todo transparente en blockchain.**

---

## Cómo funciona

### 1. Explora servicios de viaje

Busca hoteles, tours, restaurantes y experiencias registradas en la plataforma. Filtra por categoría, precio o
ubicación.

<p align="center">
  <img src="assets/screenshots/catalog.png" alt="Catálogo de servicios" width="800" />
</p>

### 2. Crea una factura grupal

Selecciona servicios del catálogo o agrega ítems personalizados. Define el número mínimo de participantes, fecha límite
y reglas de penalidad.

<p align="center">
  <img src="assets/screenshots/create-invoice.png" alt="Crear factura" width="800" />
</p>

### 3. El grupo contribuye

Comparte el enlace de invitación. Cada participante se une y aporta su parte. El progreso se muestra en tiempo real con
el porcentaje financiado.

<p align="center">
  <img src="assets/screenshots/invoice-funding.png" alt="Factura en financiamiento" width="800" />
</p>

### 4. Fondos liberados automáticamente

Cuando se alcanza la meta y todos confirman, el contrato inteligente distribuye los fondos directamente a las wallets de
los proveedores. Sin intermediarios.

<p align="center">
  <img src="assets/screenshots/invoice-released.png" alt="Factura liberada" width="800" />
</p>

---

## Características principales

| Característica                 | Descripción                                                                                     |
|--------------------------------|-------------------------------------------------------------------------------------------------|
| **Pagos en grupo**             | Los participantes contribuyen al fondo compartido desde sus wallets                             |
| **Reglas automáticas**         | Penalidades por retiro, fechas límite y montos mínimos gestionados por el contrato              |
| **Pago directo a proveedores** | Los fondos van directamente a las wallets de hoteles, tours y restaurantes                      |
| **Confirmación colectiva**     | Todos los participantes deben aprobar la liberación de fondos (o el organizador puede forzarla) |
| **Reembolso automático**       | Si el grupo no alcanza la meta antes de la fecha límite, todos reciben su dinero de vuelta      |
| **Login flexible**             | Conecta con wallet Freighter o inicia sesión con Google                                         |

---

## Gestión de negocios

Los proveedores de servicios de viaje pueden registrar su negocio, agregar servicios con precios en XLM, horarios de
atención e información de contacto.

<p align="center">
  <img src="assets/screenshots/my-businesses.png" alt="Mis negocios" width="800" />
</p>

<p align="center">
  <img src="assets/screenshots/business-profile.png" alt="Perfil de negocio" width="800" />
</p>

## Panel de facturas

Visualiza todas tus facturas organizadas por estado: borrador, financiando, completada, liberada o cancelada.

<p align="center">
  <img src="assets/screenshots/invoices-list.png" alt="Lista de facturas" width="800" />
</p>

---

## Flujo de una factura

```mermaid
stateDiagram-v2
    [*] --> Borrador : Crear factura
    Borrador --> Financiando : Vincular a blockchain
    Financiando --> Completada : Meta alcanzada
    Financiando --> Cancelada : Organizador cancela
    Completada --> Liberada : Participantes confirman
    Completada --> Liberada : Organizador libera
    Financiando --> Cancelada : Fecha límite vencida
```

---

## Audiencia

| Segmento                     | Descripción                                                                          |
|------------------------------|--------------------------------------------------------------------------------------|
| **Grupos de amigos (18-35)** | Planean viajes juntos y necesitan una forma fácil de recolectar y administrar dinero |
| **Organizadores de viaje**   | Coordinan presupuestos y reglas con total transparencia                              |
| **Viajeros frecuentes**      | Viajes de graduación, festivales, escapadas — múltiples viajes por año               |
| **Negocios asociados**       | Hoteles, restaurantes, tours — reciben pagos directos y atraen grupos                |

## Modelo de negocio

1. **Comisiones por transacción** en viajes de alto presupuesto
2. **Comisiones de socios** (B2B2C) por reservas a través de la plataforma
3. **Posicionamiento premium** para negocios que quieran destacar sus ofertas

---

## Perfil

|               |                                      |
|---------------|--------------------------------------|
| **Ubicación** | Bogotá, Colombia                     |
| **Red**       | Stellar (Testnet)                    |
| **Etapa**     | Prototipo                            |
| **Sector**    | Web3 / Travel                        |
| **LinkedIn**  | https://www.linkedin.com/in/cotravel |
| **X**         | https://x.com/CoTraveel              |

---

<p align="center">
  Construido con Stellar &bull; Soroban &bull; Freighter<br/>
  <strong>Stellar Give x Stellar Impacta Bootcamp 2026</strong>
</p>
