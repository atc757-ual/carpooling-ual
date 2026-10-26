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
- Incidencias (RF-23): cancelar durante un viaje en curso registrando una incidencia, por el conductor (cancela el viaje) o por un pasajero (abandona el viaje y libera su plaza) (#20)
- Prioridad del pasajero afectado por la cancelación de un viaje en curso (RF-24), que se pierde al aceptarse su siguiente solicitud prioritaria (#20)
- Revisión de incidencias por el administrador (CU-12): lista por estado y revisión definitiva con su resolución; migración `AddIncidentReview` (#21)
- Consulta de una incidencia (solo quien la registró o un administrador) y lista de mis incidencias (#21)
- Gestión de usuarios por el administrador (RF-25, CU-13): lista con búsqueda y activación o desactivación de perfiles, incluida la asignación y retirada del perfil de administrador; desactivar un perfil cierra las sesiones del usuario (#22)
- Eventos de usuario para el Gemelo Digital: alta y cambios de perfil (#22)
- Avisos dentro de la aplicación (RF-19, CU-11) de solicitudes, aceptaciones, rechazos, cancelaciones e incidencias nuevas para los administradores, con su lista y su marcado como leídos; migración `AddNotifications` (#23)
- Motor de rutas OSRM en local (DP-02, RNF-16) en el perfil `routing` de Docker Compose, con el mapa de Andalucía de OpenStreetMap preparado por `scripts/osrm-prepare.sh`, y variable `OSRM_URL` (#24)
- Ruta del viaje (RF-12, CU-08): se calcula con OSRM al publicar y al cambiar el origen o el destino, con una estimación en línea recta si OSRM no responde; `GET /api/trips/{id}/route` con la llegada estimada; migración `AddRouteSourceAndTripStart` (#24)
- Seguimiento real del viaje (RF-12): el conductor envía su posición durante el viaje en curso y la ven él y sus pasajeros aceptados, con lo que queda hasta el destino y la llegada estimada; cada posición genera el evento `trip.position_updated` para el Gemelo Digital y el recorrido se borra al terminar el viaje (RGPD). Variable `POSITION_MIN_INTERVAL_SECONDS`; migración `AddTripPositions` (#25)
- Esqueleto del frontend en Angular 22 + Ionic 9 (componentes standalone, sin Zone.js) con Capacitor 8, sin pantallas: estructura `core/`, `shared/` y `features/`, entornos con la API en `/api` y proxy al backend en desarrollo (#26)
- CI del frontend (lint, tests con cobertura en Vitest, `npm audit` y build), frontend en Dependabot y en SonarCloud (#26)
- Tema del frontend: paleta de colores, roles de color en modo claro y oscuro (según el sistema o forzado con `theme-dark`/`theme-light`), tokens de espaciado, esquinas, bordes, alturas y tipografía, variables de Ionic, fuentes Barlow e Inter servidas desde la app, clases de texto y utilidades básicas; contraste WCAG AA en todos los pares de texto (#31)
- Guía de estilos visual en `docs/guia-estilos.html` (#31)
- Sesión en el frontend (sin pantallas): registro, login, logout y recuperación de la sesión al abrir la app; renovación automática del token de acceso (una sola a la vez, también entre pestañas); guards de sesión, de perfil y de invitado; errores TMF630 traducidos a mensajes en español. Token de renovación guardado con Capacitor Preferences (#32)
- Elegir modo después de registrarse: `PUT /api/users/me/profiles/{profile}` activa el perfil de conductor o de pasajero del propio usuario; un perfil desactivado por un administrador no se puede reactivar (`409 PROFILE_DEACTIVATED_BY_ADMIN`) (#33)
- Columnas `phone` y `terms_accepted_at` en `users` (migración `AddUserPhoneAndTerms`) (#33)
- Verificación del correo con un código de 6 cifras enviado al registrarse (caduca a los 15 minutos, 3 intentos, un reenvío por minuto): `POST /api/auth/verify-email` (abre la sesión) y `POST /api/auth/verify-email/resend`. El código se guarda como HMAC-SHA256, nunca en claro (#35)
- Envío de correos con nodemailer por SMTP (variables `MAIL_TRANSPORT`, `MAIL_FROM`, `SMTP_*`) y buzón de pruebas Mailpit en Docker Compose para desarrollo (`http://localhost:8025`) (#35)
- Columna `email_verified_at` en `users` y tabla `email_codes` (migración `AddEmailVerification`); evento `user.email_verified` (#35)
- Pantallas de bienvenida y de inicio de sesión (RF-02) en móvil y escritorio, con su layout de acceso (ilustración y lema a la izquierda en escritorio), validación del correo de la UAL antes de llamar a la API e inicio provisional con cierre de sesión
- Tests e2e del frontend con Cypress (móvil y escritorio, API simulada) y su paso en el CI
- Clases del tema para los componentes de Ionic: botones, barras superiores y flecha atrás
- Pantalla de registro (RF-01, RF-27): nombre, teléfono (español por defecto o internacional con su prefijo), correo de la UAL, contraseña y aceptación de las condiciones de uso y la política de privacidad (#40)
- Condiciones de uso y política de privacidad (textos provisionales en `frontend/public/legal/`), que se abren en un modal desde la casilla del registro sin salir del formulario (#41)
- Pantalla para verificar el correo con el código de 6 cifras (seis casillas, admite pegarlo), con reenvío del código tras un minuto; el login lleva a ella si el correo aún no está verificado (#42)
- Pantalla para elegir el modo tras verificar el correo (pasajero, conductor o ambos, empezando como pasajero); el inicio lo ofrece si aún no se ha elegido; salir de ella sin elegir cierra la sesión (#43)
- Avisos breves (toast) para los errores de la API y las confirmaciones en las pantallas de acceso, y flechas «Volver» con destino fijo (#43)
- Recuperación de la contraseña con un código de 6 cifras enviado al correo (RF-26): `POST /api/auth/password-reset` (pedir o reenviar el código; siempre `202`), `/verify` (comprobar el código sin gastarlo) y `/confirm` (contraseña nueva, distinta de la actual; cierra todas las sesiones) (#45)
- Pantallas para recuperar la contraseña desde «¿Has olvidado tu contraseña?» del login: correo, código de 6 cifras (con reenvío y bloqueo tras 3 fallos) y contraseña nueva con confirmación, que termina con el aviso «Contraseña actualizada» y el camino al login (#46)
- Área con sesión con cinco destinos (Inicio, Mis viajes, Buscar o Publicar según el modo, Avisos y Perfil): pestañas abajo en el móvil, con cabecera con el logotipo, avisos y cerrar sesión; en escritorio, menú superior centrado y una franja fija con el saludo y el modo. Las pantallas aún sin hacer muestran «Muy pronto» (#47)
- Modo activo (pasajero o conductor) para quien tiene los dos perfiles, que se cambia desde la franja de escritorio o desde Inicio en el móvil; de momento se guarda en el dispositivo (#47)

### Changed
- **(breaking)** El nombre del registro solo admite letras (de cualquier idioma, con tildes) y, entre ellas, un espacio, un guion o un apóstrofo; se guarda sin espacios repetidos. En el formulario, el nombre no deja escribir números ni símbolos; el teléfono lleva dentro el desplegable del prefijo del país (España por defecto) y el número solo admite cifras; y el aviso de error de un campo se quita mientras se corrige (#48)
- Guía de estilos (`docs/guia-estilos.html`) rehecha con los diseños de Figma del 25/10/2026: color, tipografía, ritmo, componentes, patrones, estados, navegación, pantallas de acceso, modo oscuro, accesibilidad y textos
- **(breaking)** `POST /api/auth/register` exige el teléfono en formato internacional (`phone`) y la aceptación de las normas y la política de privacidad (`acceptedTerms`, se guarda la fecha), y ya no admite `profiles`: el usuario se crea sin perfiles y los elige después (#33)
- Los recursos `User` y `UserAdmin` incluyen el teléfono (`phone`); `User` solo se devuelve al propio usuario (#33)
- **(breaking)** La cuenta se crea al verificar el correo, no al registrarse: `POST /api/auth/register` guarda un registro pendiente (tabla `pending_registrations`, migración `AddPendingRegistrations`) y responde `202` sin cuerpo; registrarse otra vez con el mismo correo lo sustituye, y caduca a las 24 horas. La migración borra los usuarios sin verificar que quedaban de antes (#44)
- **(breaking)** Solo los usuarios con el correo verificado pueden iniciar sesión (`403 EMAIL_NOT_VERIFIED`); los usuarios existentes, los del seed y el administrador de `create-admin` quedan verificados (#35)
- Estructura del frontend como en el proyecto de referencia: servicios en subcarpetas por dominio (`core/services/auth/`…), `core/plugins/` para Capacitor y sufijos `.model.ts` y `.util.ts` (#32)
- Imagen de la base de datos actualizada a PostgreSQL 18 + PostGIS 3.6 (#1)
- Dependabot no propone saltos de versión mayor de `@types/node`: se actualizan junto con Node (#12)
- Dependabot no propone saltos de versión mayor de `typescript`: se suben a mano cuando los soporten Angular, `ts-jest` y `typescript-eslint` (#30)
- Plantilla de PR en blanco en lugar de un ejemplo rellenado (#3)
- `CHANGELOG.md` movido a la raíz del repositorio (#4)
- `package-lock.json` pasa a versionarse para fijar las versiones exactas de las dependencias (#4)
- El esquema pasa de `database/schema.sql` a la migración inicial de TypeORM; el contenedor de la base de datos arranca vacío (#7)
- `GET /api/health` responde con el recurso TMF630 `Health`, y con un `Error` `SERVICE_UNAVAILABLE` si la base de datos no responde (#13)
- `POST /api/auth/login` devuelve también el token de renovación (`refreshToken`, `refreshTokenExpiresAt`) (#14)
- El recurso `User` incluye su `href` y el registro responde con la cabecera `Location` (#15)
- Matrículas de los vehículos de prueba del seed con formato español válido (#16)
- El recurso `Incident` incluye su `href`, quién la registró y su revisión, y registrar una incidencia responde con la cabecera `Location` (#21)
- El recurso `Trip` y los eventos del viaje incluyen cuándo empezó (`startedAt`) (#24)
- Las rutas del seed se marcan como estimadas, y el segundo viaje tiene también la suya (#24)

### Security
- El backend ya no envía la cabecera `X-Powered-By: Express`, que revelaba la tecnología del servidor (#14)
- Dependencias del backend sin vulnerabilidades altas: `body-parser` 2.4.0 ([GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)) y `multer` 2.5.0 forzado con `overrides` ([GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m)) (#34)

### Removed
- Carpeta `database/` de la raíz: las migraciones y los datos de prueba viven ahora en `backend/src/database/` (#7)

### Fixed
- Tras 3 códigos incorrectos, la pantalla de verificación bloquea las casillas y avisa de que hay que pedir otro código (#44)
- Los workflows de CI se ejecutan en los PR a `dev` (antes apuntaban a `develop`) (#2)
- El check de documentación ya no exige `CLAUDE.md`, que no está versionado (#2)

## [0.1.0] - 2026-10-16

### Added
- Estructura inicial del proyecto Carpooling UAL
- README.md, CONTRIBUTING.md, .gitignore, docker-compose.yml
- Workflows de CI/CD para backend, frontend y docs
- Plantillas de PR e issues
- Branch protection rules para `main` y `dev`
