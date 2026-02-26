# CoTravel - Demo Script

> Video sin audio. Solo navegar y mostrar.

---

## 1. Landing

`http://localhost:5173/`

- Scroll lento hasta features

## 2. Services (sin login)

`http://localhost:5173/services`

- Buscar: `trekking` → limpiar
- Click en "Glacier Adventure" → ver perfil del negocio → volver

## 3. Conectar Wallet

- Click **"Connect wallet"** en el header
- Firmar en Freighter
- Cambiar idioma EN/ES con el globo

## 4. Registrar Negocio

`http://localhost:5173/businesses/new`

| Campo       | Copiar                                                                              |
|-------------|-------------------------------------------------------------------------------------|
| Nombre      | `Mendoza Wineries`                                                                  |
| Categoria   | Experience                                                                          |
| Descripcion | `Premium wine tours and tastings in Mendoza's best vineyards`                       |
| Email       | `info@mendozawineries.com`                                                          |
| Logo URL    | `https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=200&h=200&fit=crop` |

Click **"Register"**

## 5. Agregar Servicio

Desde el negocio creado → click **"Add service"**

| Campo       | Copiar                                                                              |
|-------------|-------------------------------------------------------------------------------------|
| Nombre      | `Full Day Wine Tour`                                                                |
| Descripcion | `Visit 3 premium wineries with gourmet lunch and wine tasting`                      |
| Precio      | `120`                                                                               |
| Imagen URL  | `https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=300&fit=crop` |

Click **"Create"**

## 6. Crear Invoice

`http://localhost:5173/invoices/new`

| Campo             | Copiar                               |
|-------------------|--------------------------------------|
| Emoji             | `🍷`                                 |
| Nombre            | `Mendoza Wine Tour - April 2026`     |
| Descripcion       | `3-day wine tasting trip in Mendoza` |
| Min participantes | `4`                                  |
| Penalidad         | `10`                                 |
| Deadline          | 2026-04-15                           |
| Auto-release      | Activar                              |

**Item del catalogo:** "Add from catalog" → seleccionar "Full Day Wine Tour" (el que acabas de crear)

**Item custom:** "Add custom item"

| Campo       | Copiar                                          |
|-------------|-------------------------------------------------|
| Descripcion | `Private vineyard tour`                         |
| Monto       | `150`                                           |
| Wallet      | *(pegar tu propia wallet address de Freighter)* |

Click **"Create invoice"**

## 7. Invite Link

- Desde el invoice creado → click **"Copy invite link"**
- Abrir nueva tab con el link copiado

## 8. Dashboard Invoices

`http://localhost:5173/invoices`

- Click filtros: **Funding** → **Released** → **All**

## 9. Invoice Funding

`http://localhost:5173/invoices/1`

- Scroll lento mostrando stats, acciones, items, participantes

## 10. Invoice Released

`http://localhost:5173/invoices/2`

- Mostrar mensaje de fondos liberados

## 11. Invoice Draft

`http://localhost:5173/invoices/3`

- Mostrar botones "Link to blockchain" y "Cancel"

## 12. Invoice Cancelled

`http://localhost:5173/invoices/4`

## 13. Invoice Completed

`http://localhost:5173/invoices/5`

## 14. Mis Negocios

`http://localhost:5173/businesses`

## 15. Perfil

`http://localhost:5173/profile`

## 16. Admin

`http://localhost:5173/admin` → Users → Businesses → Invoices
