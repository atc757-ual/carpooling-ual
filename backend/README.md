# Backend - Carpooling UAL

API REST en **NestJS 12** sobre Node.js 24 y TypeScript 6.

## Requisitos

- Node.js 24 (LTS)
- Base de datos levantada: `docker compose up -d` desde la raíz (ver `database/README.md`)

## Uso

    npm install           # Instalar dependencias
    npm run dev           # Desarrollo con recarga automática (http://localhost:3000/api)
    npm run build         # Compilar a dist/
    npm run start:prod    # Ejecutar la versión compilada
    npm test              # Tests (Jest)
    npm run test:cov      # Tests con cobertura (mínimo 80 % de líneas)
    npm run lint          # ESLint (sin any, sin imports sin usar, sin console.log)
    npm run format        # Formatear con Prettier

La configuración se lee de `backend/.env` o, si no existe, del `.env` de la raíz (ver `.env.example`).

## Estructura

    src/
    ├── main.ts            # Punto de entrada
    ├── app.module.ts      # Módulo raíz
    ├── app.controller.ts  # GET /api/health
    ├── app.setup.ts       # Configuración común (prefijo /api)
    ├── config/            # Lectura y validación de variables de entorno
    ├── modules/           # Un módulo por bloque del Core
    │   ├── auth/  users/  trips/  requests/
    │   └── matching/  digital-twin/  simulation/  metrics/
    ├── shared/            # Código común entre módulos
    └── events/            # Eventos hacia el Gemelo Digital
    test/                  # Tests end-to-end (*.e2e-spec.ts)

Los tests unitarios van junto al fichero que prueban (`app.controller.spec.ts` al lado de `app.controller.ts`), como propone NestJS.

## Notas técnicas

- **Tests con `--experimental-vm-modules`:** los paquetes de NestJS 12 se publican solo como ESM. Jest los carga mediante `require(esm)`, que necesita ese flag de Node. Los scripts `npm test` ya lo incluyen.
- **TypeScript 6.0:** TypeScript 7 aún no es compatible con `ts-jest` ni con `typescript-eslint`.
