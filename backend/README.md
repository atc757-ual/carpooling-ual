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

La configuración se lee de `backend/.env` o, si no existe, del `.env` de la raíz (ver `.env.example`). `DATABASE_URL` es obligatoria.

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
    ├── app.setup.ts       # Configuración común (prefijo /api)
    ├── config/            # Lectura y validación de variables de entorno y de la conexión
    ├── database/          # data-source.ts (CLI de TypeORM), migrations/, seeds/ y seed.ts
    ├── modules/           # Un módulo por bloque del Core
    │   ├── auth/  users/  trips/  requests/  incidents/  notifications/
    │   └── matching/  digital-twin/  simulation/  metrics/
    ├── shared/            # Código común entre módulos
    └── events/            # Eventos hacia el Gemelo Digital
    test/                  # Tests end-to-end (*.e2e-spec.ts)

Los tests unitarios van junto al fichero que prueban (`app.controller.spec.ts` al lado de `app.controller.ts`), como propone NestJS.

## Notas técnicas

- **Tests con `--experimental-vm-modules`:** los paquetes de NestJS 12 se publican solo como ESM. Jest los carga mediante `require(esm)`, que necesita ese flag de Node. Los scripts `npm test` ya lo incluyen.
- **TypeScript 6.0:** TypeScript 7 aún no es compatible con `ts-jest` ni con `typescript-eslint`.
