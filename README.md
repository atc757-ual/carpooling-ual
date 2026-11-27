# Carpooling UAL - TFM

Plataforma de carpooling universitario P2P basada en Gemelos Digitales, matching y simulación.

**Autor:** Alex César Taquila Camasca
**Director:** Javier Criado Rodríguez
**Curso:** 2026/2027

## Arquitectura

```
 Navegador / app Android                    Panel de administración
 (Angular + Ionic + Capacitor)              (la misma app, sección /admin)
              │  HTTPS + JSON (API REST)            │
              └──────────────┬──────────────────────┘
                             ▼
              Backend NestJS (un solo proceso, «monolito modular»)
   auth · users · trips · requests · matching · notifications · chat
   incidents · places · digital-twin · simulation · metrics · admin
        │              │                │                 │
        ▼              ▼                ▼                 ▼
  PostgreSQL +      OSRM (rutas,    CartoCiudad        Firebase (push)
  PostGIS           en local)       (direcciones)      y correo (SMTP)
        │
        └── tabla «events» ──► Gemelo digital (en memoria)
                                   └── Simulación (hilo aparte, worker_threads)
```

**Monolito modular + worker:** una sola aplicación NestJS dividida en módulos con fronteras estrictas (un módulo no toca las tablas de otro). Solo la simulación corre en un hilo aparte, para no bloquear la API.

- **Gemelo digital** (`backend/src/modules/digital-twin/`): copia en memoria del estado del sistema, formada por gemelos de viaje, vehículo y usuario. Se actualiza leyendo en orden, y sin repetir, los eventos que cada cambio de estado guarda en la misma transacción (patrón outbox).
- **Simulación** (`backend/src/modules/simulation/`): motor propio basado en agentes. Genera una población con semilla, aplica el mismo matching que la plataforma y crea un gemelo por réplica. Ejecuta los escenarios S0–S5 (`simulation/scenarios/`) con 30 réplicas, con contraste estadístico y análisis de sensibilidad. Se lanza desde el panel.

## Tecnologías

| Parte                       | Tecnologías                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend (`frontend/`)      | Angular 22 (standalone, sin Zone.js, _signals_), Ionic 9, Capacitor 8 (Android), Transloco (español e inglés), Leaflet + OpenStreetMap                       |
| Backend (`backend/`)        | Node.js 26 LTS (`.nvmrc`), NestJS 12, TypeScript 6, TypeORM (migraciones), class-validator, JWT + bcrypt, `@nestjs/schedule`, `worker_threads`               |
| Datos y servicios           | PostgreSQL 18 + PostGIS 3.6, OSRM (rutas, en local), CartoCiudad (direcciones, IGN), Firebase Cloud Messaging (push, opcional), SMTP (Mailpit en desarrollo) |
| API                         | REST según TMF630, documentada con OpenAPI (`docs/api/openapi.json`, interactiva en `/api/docs`)                                                             |
| Tests                       | Jest (backend, unitarios y e2e), Vitest (frontend), Cypress (e2e, en el CI), k6 (carga)                                                                      |
| Calidad y CI/CD             | GitHub Actions, ESLint + Prettier, SonarCloud (Quality Gate), CodeQL, Dependabot, `npm audit`                                                                |
| Despliegue y observabilidad | Docker Compose, Nginx (HTTPS y cabeceras de seguridad), Grafana + Loki + Alloy                                                                               |

## Puesta en marcha (desarrollo)

Requisitos: Node.js (la versión de `.nvmrc`) y Docker. Todo se ejecuta desde la raíz del repositorio.

**1. Base de datos y correo**

    docker compose up -d

**2. Backend** (API en http://localhost:3000/api, documentación en http://localhost:3000/api/docs)

    cd backend
    npm install
    npm run migrate        # crea o actualiza las tablas
    npm run seed           # datos de prueba (en una base vacía o para reiniciarlos)
    npm run dev            # arranca y se recarga al cambiar el código

**3. Frontend** (http://localhost:4200; `ng serve` reenvía `/api` al backend)

    cd frontend
    npm install
    npm start
    npx ng serve --host 0.0.0.0   # para abrirlo desde un móvil en la misma red

**Usuarios del seed** (solo en desarrollo; contraseña `carpooling` para todos): `mario@ual.es` (pasajero), `lucia@ual.es` (conductora, pasajera y administradora) y `admin@ual.es`.

**Opcional:**

- **Rutas con OSRM** (sin él, las distancias se estiman en línea recta × 1,3):

      bash scripts/osrm-prepare.sh         # solo la primera vez: prepara el mapa
      docker compose --profile routing up -d

- **Correos de desarrollo:** http://localhost:8025 (Mailpit).
- **Observabilidad** (Grafana en http://localhost:3001): el backend tiene que escribir su log en JSON.

      docker compose --profile observabilidad up -d
      mkdir -p logs
      cd backend && npm run build
      LOG_FORMAT=json npm run start:prod >> ../logs/backend.log 2>&1

- **Simulación:** en la app, como administrador, **Administración → Simulación**, elegir el escenario y lanzarlo.
- **App Android** (con Android Studio y el móvil por USB):

      cd frontend
      npm run build:android
      adb reverse tcp:3000 tcp:3000

**Tests**

    cd backend && npm test        # en local, mejor: npm test -- --maxWorkers=2
    cd frontend && npm test

**Parar:** `docker compose down` (con `-v` se borran los datos).

### Si algo falla

| Síntoma                                                            | Causa probable                                        | Arreglo                                                              |
| ------------------------------------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------- |
| El login da 500 y el log dice «Connection terminated unexpectedly» | Docker se reinició y el reenvío de puertos quedó roto | `docker compose down`, `docker compose up -d` y reiniciar el backend |
| «Port 4200 / 3000 is already in use»                               | Quedó otro servidor abierto                           | Cerrar la otra terminal o terminar el proceso que usa el puerto      |
| La app dice «No hemos podido…» en todas partes                     | El backend no está arrancado                          | `http://localhost:3000/api/health` debe responder                    |
| Faltan tablas o columnas                                           | Hay migraciones sin aplicar                           | `cd backend && npm run migrate`                                      |
| Las rutas salen en línea recta                                     | OSRM no está levantado                                | Ver «Rutas con OSRM»                                                 |

## Estructura del proyecto

- `backend/` - API REST (NestJS); incluye las migraciones y los datos de prueba (`backend/src/database/`)
- `frontend/` - App web y Android (Angular + Ionic + Capacitor), con el panel de administración
- `simulation/` - Escenarios S0-S5
- `docs/` - Documentación técnica
- `scripts/` - Utilidades (OSRM, copias de seguridad, pruebas de carga)
- `deploy/` - Configuración de Nginx para el servidor

## Documentación

- [Despliegue](docs/despliegue.md)
- [Reglas de negocio](docs/reglas-de-negocio.md)
- API: [OpenAPI](docs/api/openapi.json), [códigos de error](docs/api/errors.md) y [eventos](docs/api/events.md)
- [Guía de estilos](docs/guia-estilos.html)
- [Pruebas de carga](docs/pruebas-carga.md)
- [Cómo contribuir](CONTRIBUTING.md) y [registro de cambios](CHANGELOG.md)
