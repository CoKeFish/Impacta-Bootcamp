# Contratos Soroban

Este directorio contendrá los contratos inteligentes de Stellar/Soroban.

## Crear un contrato

Accede al contenedor de Soroban:

```bash
docker exec -it impacta-soroban bash
```

Dentro del contenedor, en `/workspace`:

```bash
soroban contract init mi-contrato
cd mi-contrato
soroban contract build
```

## Desplegar en la red local

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/mi_contrato.wasm \
  --source alice \
  --network local
```

## URLs útiles

- Horizon API: http://localhost:8000
- Soroban RPC: http://localhost:8080
