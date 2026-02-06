# Backend - CoTravel API

## Qué hace

API REST centralizada que maneja la lógica de negocio, persistencia de datos y almacenamiento de archivos para la plataforma CoTravel.

### Funcionalidades actuales
- **Health check**: Verificación de conectividad con PostgreSQL y MinIO
- **Gestión de imágenes**: Upload, almacenamiento y recuperación de archivos
- **Datos off-chain**: Almacena información que no necesita estar en blockchain

## Cómo lo hace

### Stack tecnológico
- **Runtime**: Node.js con Express.js
- **Base de datos**: PostgreSQL (datos relacionales)
- **Almacenamiento**: MinIO (S3-compatible para archivos)

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado de DB y storage |
| POST | `/upload` | Subir imagen a MinIO + metadata a PostgreSQL |
| GET | `/images/:filename` | Obtener imagen específica |
| GET | `/images` | Listar todas las imágenes |

### Ejecución
```bash
npm run dev   # Desarrollo con auto-reload
npm start     # Producción
```

**Puerto**: 3000

## Interacción con otros componentes

```
Frontend (React) ──HTTP──► Backend API
                              │
                              ├──► PostgreSQL (usuarios, trips, metadata)
                              ├──► MinIO (imágenes, archivos)
                              └──► Soroban RPC (futuro: eventos, indexación)
```

- **Frontend**: Consume los endpoints REST para operaciones CRUD
- **PostgreSQL**: Persiste datos de usuarios, viajes y metadata
- **MinIO**: Almacena archivos multimedia
- **Contratos**: Futuro - indexar eventos y sincronizar estado on-chain/off-chain

## Consideraciones técnicas

### Por qué backend + datos off-chain
- **Indexación de eventos/operaciones**: La blockchain tiene retención limitada
- **Notificaciones**: Lógica que no pertenece on-chain
- **Colas y reintentos**: Manejo de fallos y consistencia eventual
- **Estado de producto**: Perfiles, analytics, contenido que no requiere verificación pública

### Para producción
- Implementar rate limiting y reintentos con idempotencia
- Agregar observabilidad (logs estructurados, trazas)
- Validación estricta de inputs (seguridad backend)
- Considerar indexador para eventos de contratos Soroban

### Indexación futura
Si se necesita historial completo de operaciones blockchain:
- Escanear ledgers y guardar eventos para consultas rápidas
- Go es recomendado por Stellar para indexadores por eficiencia
- Alternativa: Node.js con el SDK JavaScript de Stellar
