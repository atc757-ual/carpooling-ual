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

### Changed
- Imagen de la base de datos actualizada a PostgreSQL 18 + PostGIS 3.6 (#1)
- Plantilla de PR en blanco en lugar de un ejemplo rellenado (#3)
- `CHANGELOG.md` movido a la raíz del repositorio (#4)
- `package-lock.json` pasa a versionarse para fijar las versiones exactas de las dependencias (#4)

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
