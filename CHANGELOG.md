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
- `.nvmrc` como única fuente de la versión de Node, leída por todos los workflows (#12)
- Aviso mensual automático (issue) cuando a la versión de Node le quedan menos de 6 meses de soporte (#12)
- Registro de usuarios con correo de la UAL (`POST /api/auth/register`) eligiendo los perfiles de conductor y/o pasajero (#13)
- Inicio de sesión con token de acceso JWT de 15 minutos (`POST /api/auth/login`) y consulta del usuario autenticado (`GET /api/auth/me`) (#13)
- Formato de respuesta TMF630 en todas las APIs: errores con el objeto `Error`, validación con `ValidationError` y cabecera `X-Request-Id`; catálogo de códigos en `docs/api/errors.md` (#13)
- Variables de entorno `JWT_SECRET`, `JWT_ACCESS_TTL_MINUTES` y `ALLOWED_EMAIL_DOMAINS` (#13)
- Sesiones con token de renovación: `POST /api/auth/refresh` (rotación con detección de reutilización) y `POST /api/auth/logout`; duración de 7 días deslizantes con un máximo de 30 desde el login (#14)
- Tabla `refresh_tokens` (migración `AddRefreshTokens`) (#14)
- Documentación OpenAPI de la API: Swagger UI en `/api/docs` y especificación en `docs/api/openapi.json` (`npm run openapi`) (#14)
- Variables de entorno `JWT_REFRESH_TTL_DAYS`, `JWT_SESSION_MAX_DAYS` y `API_DOCS_ENABLED` (#14)
- Permisos por perfil: toda la API exige token salvo las rutas marcadas como públicas, y `@Profiles(...)` restringe una ruta a ciertos perfiles (`403 PROFILE_REQUIRED`) (#15)
- `GET /api/users/{id}`: datos del propio usuario, o de cualquiera para un administrador (#15)
- Comando `npm run create-admin` para crear el primer administrador en el despliegue, y guía de despliegue en `docs/despliegue.md` (#15)
- Vehículos de los conductores (RF-21): alta, consulta, lista paginada y baja en `/api/vehicles` (#16)
- Declaración responsable del conductor y su estado para publicar viajes: `PUT /api/users/me/driver-declaration` y `GET /api/users/me/driver-status` (#16)
- Paginación TMF630 de listas (`offset`, `limit`, `X-Total-Count`, `X-Result-Count`) (#16)
- Viajes (RF-04, RF-05): publicar, consultar, listar los propios, modificar mientras están publicados y cancelar antes del inicio, con ubicaciones en GeoJSON (#17)
- Máquina de estados del viaje según el diagrama de estados (RNF-10) (#17)
- Registro de eventos para el Gemelo Digital en la misma transacción que cada cambio (patrón outbox, RNF-08) (#17)
- Solicitudes de plaza (RF-08 a RF-10): solicitar, aceptar, rechazar y cancelar, con actualización automática de plazas, confirmación y reapertura del viaje y prioridad del pasajero (RF-24) (#18)
- Máquina de estados de la solicitud según el diagrama de estados (RNF-10) (#18)
- Al cancelar un viaje se cancelan sus solicitudes en la misma transacción (#18)
- Inicio y fin del viaje (RF-11): el vehículo pasa a en viaje y vuelve a disponible, y las solicitudes pendientes se rechazan al iniciar (#19)

### Changed
- Imagen de la base de datos actualizada a PostgreSQL 18 + PostGIS 3.6 (#1)
- Dependabot no propone saltos de versión mayor de `@types/node`: se actualizan junto con Node (#12)
- Plantilla de PR en blanco en lugar de un ejemplo rellenado (#3)
- `CHANGELOG.md` movido a la raíz del repositorio (#4)
- `package-lock.json` pasa a versionarse para fijar las versiones exactas de las dependencias (#4)
- El esquema pasa de `database/schema.sql` a la migración inicial de TypeORM; el contenedor de la base de datos arranca vacío (#7)
- `GET /api/health` responde con el recurso TMF630 `Health`, y con un `Error` `SERVICE_UNAVAILABLE` si la base de datos no responde (#13)
- `POST /api/auth/login` devuelve también el token de renovación (`refreshToken`, `refreshTokenExpiresAt`) (#14)
- El recurso `User` incluye su `href` y el registro responde con la cabecera `Location` (#15)
- Matrículas de los vehículos de prueba del seed con formato español válido (#16)

### Security
- El backend ya no envía la cabecera `X-Powered-By: Express`, que revelaba la tecnología del servidor (#14)

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
