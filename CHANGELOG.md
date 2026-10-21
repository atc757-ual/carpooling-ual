# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Added
- Esquema provisional de la base de datos (PostgreSQL + PostGIS) traducido del modelo entidad-relación, con datos de desarrollo (#1)
- Plantilla de variables de entorno `.env.example` (#1)
- Esqueleto del backend en NestJS 12 con los 8 módulos del sistema, configuración desde `.env` y endpoint `GET /api/health` (#5)
- Módulos de incidencias y notificaciones en el backend, según el diagrama de componentes (#6)
- Conexión del backend con PostgreSQL mediante TypeORM y migraciones versionadas (`npm run migrate`, `migration:revert`, `migration:show`, `migration:create`) (#7)
- Carga de datos de prueba con `npm run seed` (#7)
- `GET /api/health` comprueba la base de datos y responde 503 si no está disponible (#7)
- El CI aplica, revierte y vuelve a aplicar las migraciones en cada PR (#7)
- Control de calidad y seguridad en cada PR: CodeQL, SonarCloud (Quality Gate), `npm audit` de dependencias de producción y cobertura mínima del 80 % en el CI (#8)
- Dependabot: revisión semanal de dependencias npm y de GitHub Actions (#8)

### Changed
- Imagen de la base de datos actualizada a PostgreSQL 18 + PostGIS 3.6 (#1)
- Plantilla de PR en blanco en lugar de un ejemplo rellenado (#3)
- `CHANGELOG.md` movido a la raíz del repositorio (#4)
- `package-lock.json` pasa a versionarse para fijar las versiones exactas de las dependencias (#4)
- El esquema pasa de `database/schema.sql` a la migración inicial de TypeORM; el contenedor de la base de datos arranca vacío (#7)

### Removed
- Carpeta `database/` de la raíz: las migraciones y los datos de prueba viven ahora en `backend/src/database/` (#7)

### Fixed
- Los workflows de CI se ejecutan en los PR a `dev` (antes apuntaban a `develop`) (#2)
- El check de documentación ya no exige `CLAUDE.md`, que no está versionado (#2)

## [0.1.0] - 2026-10-16

### Added
- Estructura inicial del proyecto Carpooling UAL
- README.md, CONTRIBUTING.md, .gitignore, docker-compose.yml
- Workflows de CI/CD para backend, frontend y docs
- Plantillas de PR e issues
- Branch protection rules para `main` y `dev`
