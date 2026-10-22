# Backend - Carpooling UAL

API REST en **NestJS 12** sobre Node.js 24 y TypeScript 6.

## Requisitos

- Node.js en la versión indicada en `.nvmrc` (raíz del repositorio), la misma que usa el CI
- Base de datos levantada y migrada (ver [Base de datos](#base-de-datos))

## Uso

    npm install           # Instalar dependencias
    npm run dev           # Desarrollo con recarga automática (http://localhost:3000/api)
    npm run build         # Compilar a dist/
    npm run start:prod    # Ejecutar la versión compilada
    npm test              # Tests (Jest)
    npm run test:cov      # Tests con cobertura (mínimo 80 % de líneas)
    npm run lint          # ESLint (sin any, sin imports sin usar, sin console.log)
    npm run format        # Formatear con Prettier
    npm run openapi       # Regenerar docs/api/openapi.json (obligatorio al cambiar la API)
    npm run create-admin -- --email=ana@ual.es --name="Ana García"   # Primer administrador (despliegue)

Para poner en marcha un entorno nuevo (variables, migraciones y primer administrador), seguir [`docs/despliegue.md`](../docs/despliegue.md).

La configuración se lee de `backend/.env` o, si no existe, del `.env` de la raíz (ver `.env.example`):

| Variable | Obligatoria | Por defecto | Uso |
| --- | --- | --- | --- |
| `DATABASE_URL` | Sí | | Conexión con PostgreSQL |
| `JWT_SECRET` | Sí | | Firma de los tokens de acceso (mínimo 32 caracteres; distinto en cada entorno y nunca en el repositorio) |
| `JWT_ACCESS_TTL_MINUTES` | No | `15` | Duración del token de acceso (1-1440) |
| `JWT_REFRESH_TTL_DAYS` | No | `7` | Cada renovación de la sesión da estos días más (1-90) |
| `JWT_SESSION_MAX_DAYS` | No | `30` | Duración máxima de una sesión desde el login (1-365; no menor que `JWT_REFRESH_TTL_DAYS`) |
| `API_DOCS_ENABLED` | No | `true` | Publica Swagger UI en `/api/docs` (`false` para apagarlo en producción) |
| `ALLOWED_EMAIL_DOMAINS` | No | `ual.es,inlumine.ual.es` | Dominios de correo que pueden registrarse |
| `PORT` | No | `3000` | Puerto HTTP |

## API

Todas las rutas cuelgan de `/api` y siguen la guía **TMF630**: los recursos llevan `@type`, los errores usan el objeto `Error` (catálogo de códigos en [`docs/api/errors.md`](../docs/api/errors.md)) y todas las respuestas llevan la cabecera `X-Request-Id`.

| Método y ruta | Autenticación | Respuesta |
| --- | --- | --- |
| `GET /api/health` | No | `200` `Health` / `503` si la base de datos no responde |
| `POST /api/auth/register` | No | `201` `User`. Solo correos de los dominios permitidos; perfiles `driver` y/o `passenger` |
| `POST /api/auth/login` | No | `200` `AccessToken` (`accessToken`, `tokenType`, `expiresIn` en segundos, `refreshToken`, `refreshTokenExpiresAt`, `user`) |
| `POST /api/auth/refresh` | `refreshToken` en el cuerpo | `200` `AccessToken` con los dos tokens nuevos (cada `refreshToken` sirve una sola vez) |
| `POST /api/auth/logout` | `refreshToken` en el cuerpo | `204`: cierra la sesión de ese dispositivo |
| `GET /api/auth/me` | `Authorization: Bearer <token>` | `200` `User` |
| `GET /api/users/{id}` | `Authorization: Bearer <token>` | `200` `User`: el propio usuario, o cualquiera si se tiene el perfil de administrador (`403` si no) |

| `POST /api/vehicles` | Perfil conductor | `201` `Vehicle` + `Location`. Matrícula española (se normaliza: `1234 bcd` → `1234BCD`) y capacidad de 1 a 8 |
| `GET /api/vehicles?offset=&limit=` | Perfil conductor | `200` lista de mis vehículos activos, con `X-Total-Count` y `X-Result-Count` |
| `GET /api/vehicles/{id}` | Perfil conductor | `200` `Vehicle` (solo uno de los míos; si no, `404`) |
| `DELETE /api/vehicles/{id}` | Perfil conductor | `204`: baja del vehículo (pasa a `inactive`; los viajes pasados lo conservan) |
| `GET /api/users/me/driver-status` | Perfil conductor | `200` `DriverStatus`: si puede publicar viajes (RF-21: declaración responsable y al menos un vehículo) |
| `PUT /api/users/me/driver-declaration` | Perfil conductor | `200` `DriverStatus`: acepta la declaración responsable (idempotente; se conserva la fecha de la primera) |

| `POST /api/trips` | Perfil conductor, listo (RF-21) | `201` `Trip` + `Location`: publica un viaje con uno de mis vehículos activos, salida futura y plazas ≤ capacidad |
| `GET /api/trips/{id}` | `Authorization: Bearer <token>` | `200` `Trip` (con el nombre del conductor, sin la matrícula) |
| `GET /api/users/me/trips?offset=&limit=` | Perfil conductor | `200` lista paginada de mis viajes, por fecha de salida |
| `PATCH /api/trips/{id}` | Su conductor | `200` `Trip`: modifica los campos enviados, solo mientras está publicado |
| `POST /api/trips/{id}/cancel` | Su conductor | `200` `Trip` cancelado (antes del inicio); sus solicitudes vivas se cancelan con él |
| `POST /api/trips/{id}/start` | Su conductor | `200` `Trip` en curso (RF-11): solo confirmado y desde 30 minutos antes de la salida; el vehículo pasa a `on_trip` y las solicitudes pendientes se rechazan |
| `POST /api/trips/{id}/finish` | Su conductor | `200` `Trip` finalizado (RF-11); el vehículo vuelve a `available` |
| `POST /api/trips/{tripId}/incidents` | Su conductor o un pasajero aceptado | `201` `Incident` (RF-23): cancela durante un viaje en curso. Si la registra el conductor, se cancela el viaje y sus pasajeros aceptados reciben prioridad (RF-24); si la registra un pasajero, solo se cancela su solicitud y se libera su plaza |
| `POST /api/trips/{tripId}/requests` | Perfil pasajero | `201` `SeatRequest` + `Location`: pide plaza en un viaje abierto, con plazas y que no sea el suyo |
| `GET /api/trips/{tripId}/requests` | Su conductor | `200` lista paginada de las solicitudes del viaje (prioritarias primero, RF-24) |
| `GET /api/users/me/requests` | Perfil pasajero | `200` lista paginada de mis solicitudes |
| `GET /api/requests/{id}` | Su pasajero o el conductor | `200` `SeatRequest` (la matrícula del vehículo solo si está aceptada); a cualquier otro, `404` |
| `POST /api/requests/{id}/accept` | Su conductor | `200`: resta una plaza; la primera aceptación confirma el viaje |
| `POST /api/requests/{id}/reject` | Su conductor | `200`: rechaza una solicitud pendiente |
| `POST /api/requests/{id}/cancel` | Su pasajero | `200`: cancela antes del inicio; si estaba aceptada devuelve la plaza y, si era la última, el viaje vuelve a publicado |

**Ubicaciones:** puntos GeoJSON (RFC 7946), `{ "type": "Point", "coordinates": [longitud, latitud] }`.

**Eventos para el Gemelo Digital:** cada cambio de estado de un viaje (`trip.published`, `trip.updated`, `trip.confirmed`, `trip.reopened`, `trip.started`, `trip.finished`, `trip.cancelled`) o de una solicitud (`request.created`, `request.accepted`, `request.rejected`, `request.cancelled`), y cada incidencia (`incident.reported`, sin la descripción libre), se guarda en la tabla `events` en la misma transacción que el cambio (patrón *outbox*), con el estado completo de la entidad.

**Concurrencia:** aceptar solicitudes bloquea la fila del viaje, así que dos aceptaciones simultáneas nunca venden la misma plaza. Todas las operaciones bloquean en el mismo orden (primero el viaje y después la solicitud) para evitar bloqueos mutuos.

**Listas (TMF630):** `?offset=` (por defecto 0) y `?limit=` (por defecto 20, máximo 100); el cuerpo es el array de recursos y las cabeceras `X-Total-Count` y `X-Result-Count` indican el total y cuántos van en la respuesta.

**Protección por defecto:** toda la API exige `Authorization: Bearer <token>`; las rutas abiertas se marcan con `@Public()`. Los permisos por perfil se declaran con `@Profiles('admin')` (basta con uno de los perfiles indicados) y se comprueban con los perfiles del token. El registro (`POST /api/auth/register`) responde con la cabecera `Location` del usuario creado.

**Documentación interactiva (Swagger UI):** http://localhost:3000/api/docs, con el botón *Authorize* para pegar el `accessToken`. La especificación OpenAPI está en [`docs/api/openapi.json`](../docs/api/openapi.json); se genera a partir del código con `npm run openapi` y un test comprueba que está al día. Todo endpoint nuevo se documenta con los decoradores de `@nestjs/swagger` y `@ApiErrorResponses`.

**Sesiones:** el token de acceso dura 15 minutos; el de renovación, 7 días deslizantes (cada renovación da 7 más) con un máximo de 30 días desde el login. Cada dispositivo tiene su propia sesión. El cliente debe hacer **una sola renovación a la vez**: si llegan dos con el mismo `refreshToken`, la segunda se trata como un robo y cierra la sesión.

Ejemplo con un usuario del seed:

    curl -X POST http://localhost:3000/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"lucia@ual.es","password":"carpooling"}'

## Base de datos

PostgreSQL 18 + PostGIS 3.6 en Docker (`carpooling-db`). El esquema se crea con **migraciones de TypeORM** (`src/database/migrations/`); el contenedor arranca vacío.

Primera vez (o tras borrar los datos):

    docker compose up -d                  # Desde la raíz: levantar PostgreSQL
    npm run migrate                       # Crear el esquema (migraciones pendientes)
    npm run seed                          # Cargar los datos de prueba

Comandos de migraciones:

    npm run migration:show                # Listar migraciones ([X] = aplicada)
    npm run migrate                       # Aplicar las pendientes
    npm run migration:revert              # Deshacer la última
    npm run migration:create -- src/database/migrations/NombreDelCambio

Datos de prueba (`src/database/seeds/dev-seed.sql`): 4 usuarios, todos con la contraseña `carpooling`, vehículos, viajes hacia la UAL, solicitudes, eventos y los escenarios S0-S5. Solo se cargan sobre una base de datos sin usuarios; para recargarlos:

    npm run migration:revert && npm run migrate && npm run seed

Otros comandos útiles (desde la raíz):

    docker compose down                   # Detener la base de datos (conserva los datos)
    docker compose down -v                # Detenerla y BORRAR los datos
    docker exec -it carpooling-db psql -U carpooling -d carpooling   # Consola SQL

### Correspondencia con la memoria

| Memoria (ER)          | Tabla                 |
| --------------------- | --------------------- |
| USUARIO               | `users`               |
| PERFIL_ADMINISTRADOR  | `admin_profiles`      |
| PERFIL_CONDUCTOR      | `driver_profiles`     |
| PERFIL_PASAJERO       | `passenger_profiles`  |
| VEHÍCULO              | `vehicles`            |
| VIAJE                 | `trips`               |
| RUTA                  | `routes`              |
| SOLICITUD             | `requests`            |
| INCIDENCIA            | `incidents`           |
| EVENTO                | `events`              |
| ESCENARIO             | `scenarios`           |
| AGENTE_SIMULADO       | `simulated_agents`    |
| RESULTADO             | `simulation_results`  |

Los estados de las enumeraciones siguen los diagramas de estados del viaje y de la solicitud (p. ej. `EN_CURSO` → `in_progress`).

## Estructura

    src/
    ├── main.ts            # Punto de entrada
    ├── app.module.ts      # Módulo raíz
    ├── app.controller.ts  # GET /api/health
    ├── app.setup.ts       # Configuración común (prefijo /api, X-Request-Id, errores TMF630, validación)
    ├── config/            # Lectura y validación de variables de entorno y de la conexión
    ├── database/          # data-source.ts (CLI de TypeORM), migrations/, seeds/ y seed.ts
    ├── modules/           # Un módulo por bloque del Core
    │   ├── auth/  users/  trips/  requests/  incidents/  notifications/
    │   └── matching/  digital-twin/  simulation/  metrics/
    ├── shared/            # Código común: errores de negocio, filtro TMF630, validación, utilidades de TypeORM
    └── events/            # Eventos hacia el Gemelo Digital
    test/                  # Tests end-to-end (*.e2e-spec.ts)

Cada módulo se organiza en capas: **controller** (HTTP y DTOs) → **service** (reglas de negocio) → **entidades** (TypeORM). Un módulo solo usa lo que otro exporta (p. ej. `auth` usa `UsersService`, nunca las tablas de `users`). Los services lanzan errores de negocio (`BusinessError`) y nunca errores HTTP.

Los tests unitarios van junto al fichero que prueban (`app.controller.spec.ts` al lado de `app.controller.ts`), como propone NestJS. Los e2e usan la base de datos real (requiere `npm run migrate`) y borran los datos que crean.

## Notas técnicas

- **Tests con `--experimental-vm-modules`:** los paquetes de NestJS 12 se publican solo como ESM. Jest los carga mediante `require(esm)`, que necesita ese flag de Node. Los scripts `npm test` ya lo incluyen.
- **TypeScript 6.0:** TypeScript 7 aún no es compatible con `ts-jest` ni con `typescript-eslint`.
