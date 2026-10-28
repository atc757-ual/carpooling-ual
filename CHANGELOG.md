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
- Sugerencias del correo de la UAL (@inlumine.ual.es para estudiantes y @ual.es para el personal) mientras se escribe, en el login, el registro y la recuperación de la contraseña (#49)
- Bandera del país junto al prefijo del teléfono (también en cada fila de la lista de prefijos) y el número español en grupos de tres (612 345 678) mientras se escribe; nueva dependencia `flag-icons` (MIT), solo con las banderas de la lista de prefijos (#49)
- Modo activo (pasajero o conductor) para quien tiene los dos perfiles, que se cambia desde la franja de escritorio o desde Inicio en el móvil; de momento se guarda en el dispositivo (#47)
- Inicio del pasajero: en dos columnas en escritorio (8 y 4) y una en el móvil, con la búsqueda de viajes («Tu camino al campus.»: trayecto entre un lugar y una entrada del campus (norte, sur o este), en los dos sentidos; fecha, de hoy a dentro de un mes; hora de llegada al campus o, al volver, de salida, por defecto dentro de media hora; margen; plazas con − y +, y qué viajes se verán), el modo activo como selector Pasajero | Conductor (sale de la franja del saludo, que ahora dice «¿Vamos al campus hoy?»), «Tu impacto» (con datos de ejemplo, marcados como tales) y «¿Cómo funciona?». La búsqueda lleva a la pestaña Buscar con los datos; los resultados llegarán con el *matching*. Las tarjetas pasan a ser `ion-card` con el aspecto del tema (#52)
- Pantalla Buscar del pasajero. La última búsqueda se comparte entre Inicio y Buscar (sin ir en la URL, guardada solo en la pestaña del navegador): Inicio sale relleno con ella y Buscar la muestra al volver, con «Nueva búsqueda» para empezar de cero. Arriba en el móvil y en la columna de 4 en escritorio, «Tu búsqueda»: el trayecto como línea de ruta, «27 oct · llegada 08:00 ±20 min · 1 plaza» con el margen, y «Editar», que abre el formulario ya relleno; sin búsqueda, el formulario. Al lado, un viaje de ejemplo (marcado como tal) con el diseño de los resultados y «Ver viaje de …», que lleva al detalle (aún «Muy pronto»). La cabecera es propia de cada pantalla: en el móvil, la flecha de volver y el título; en escritorio, la franja fija con el título y los breadcrumbs (la casa › Buscar viaje › Detalle del viaje) (#53)
- Detalle del viaje desde los resultados de Buscar: el recorrido con la hora de cada parada, quién conduce y su coche, y cómo se pide plaza (el botón, desactivado hasta las solicitudes). Es el viaje de ejemplo con los datos de la búsqueda; sin ella, «No encontramos este viaje». La línea de ruta y la persona que conduce pasan a ser componentes compartidos con Buscar, y el aviso (notice) pasa al tema. En Inicio, «Limpiar» junto al consejo vacía el formulario y olvida la búsqueda (#54)
- Parkings del campus (P1–P5) como destinos de los viajes al campus, con su ubicación, y la zona de servicio: 30 km alrededor del campus. Nuevo `GET /api/campus-parkings` (y `/{id}`) (#55)
- Búsqueda de direcciones con CartoCiudad (IGN): sugerencias de la provincia mientras se escribe (`GET /api/places`), la dirección elegida con su punto (`GET /api/places/{id}`) y la dirección de un punto, p. ej. la ubicación del dispositivo (`GET /api/places/reverse`), cada una con si está en la zona de servicio. Fuera de ella se registra el evento anónimo `coverage.gap_reported` (municipio y celda de ~1 km). Nuevos códigos `PLACE_NOT_FOUND` y `GEOCODER_UNAVAILABLE` (503) (#56)
- El formulario de búsqueda sugiere direcciones mientras se escribe (con la atribución de CartoCiudad) y guarda la elegida con su punto; fuera de la zona avisa «Aún no llegamos a…». El destino del campus es uno de sus parkings (P1–P5, desde la API) en vez de los ingresos norte, sur y este (#57)
- «Usar mi ubicación» en el campo de dirección: explica para qué se usa, pide el permiso (plugin `@capacitor/geolocation`: el navegador o el móvil), muestra la ubicación en un mapa de OpenStreetMap (Leaflet, cargado solo al abrirlo) con un pin que se puede arrastrar y la traduce a la dirección más cercana; fuera de la zona no deja usarla (#58)
- Ventanas con esquinas de 8px, el título a la izquierda y la X de cerrar más grande. Campos del trayecto con su etiqueta flotante («Origen» y «Destino») y, en el móvil, «Cambiar sentido» como enlace junto a «Trayecto». «Usar mi ubicación» solo en el origen y con tooltip (solo con ratón o teclado): con el permiso ya dado rellena la dirección directamente (la ventana que explica para qué y lo pide, solo la primera vez), y «Ajustar en el mapa» (en el origen y en el destino) abre el mapa para mover el punto; fuera de la zona, un solo aviso. «Ver en el mapa» bajo el parking muestra dónde está (solo lectura); la ventana de la ubicación mide lo que su contenido (como mucho, el 90 % de la pantalla) y en el móvil va pegada abajo. En Inicio, «Limpiar» pasa a ser «Nueva búsqueda» (como en Buscar), en la cabecera de la tarjeta y solo cuando hay algo que borrar (#59)
- Ubicaciones exactas de los parkings del campus (en la entrada de cada uno) y un sexto, P6; el centro de la zona de servicio se recalcula con ellos (#60)
- Pantalla «Publicar viaje» para el conductor (la pestaña Publicar): sin vehículos, primero registra uno (matrícula y plazas); después, trayecto hacia o desde el campus, fecha y hora de salida, vehículo, plazas ofrecidas (hasta su capacidad), desvío máximo y, la primera vez, la declaración responsable. Al publicar muestra el resumen del viaje y «Publicar otro viaje» (#61)
- Búsqueda de viajes (*matching*) `POST /api/trips/search`: viajes publicados del mismo sentido cuyo extremo del campus está a menos de 1 km del parking elegido y cuya ruta pasa a menos de 2 km de la dirección del pasajero (PostGIS), con plazas suficientes; para los 10 más cercanos calcula el desvío de recogerle con OSRM (o estimado) y los puntúa de 0 a 1 (60 % desvío, 40 % diferencia con la hora deseada), descartando los que superan el desvío del conductor o el margen horario (#62)
- Marca y modelo del vehículo (opcional al registrarlo) y `PATCH /api/vehicles/{id}` para editar el modelo y las plazas; la matrícula no cambia y las plazas no se cambian con el vehículo en un viaje en curso. La declaración responsable (RF-21) cubre el permiso de conducir, el seguro obligatorio y la ITV (#66)
- Buscar muestra los viajes compatibles de la API (*matching*), del más compatible al menos, con los estados de carga, «Aún no hay viajes para esa hora» (con «Modificar hora» y «Ampliar margen») y error con «Reintentar»; el detalle sale del viaje elegido. Se quitan los datos de ejemplo (#68)
- Una solicitud de plaza puede pedir de 1 a 4 plazas (el pasajero y sus compañeros, `{ "seats": N }`): al aceptarla se restan todas, al cancelarla se devuelven, y si no caben responde `TRIP_FULL` (#72)
- Pedir plaza desde el detalle del viaje («Solicitar N plazas», las de la búsqueda) y ver el estado de la solicitud tal como lo da el backend: pendiente, aceptada (con la matrícula), no aceptada o cancelada; cancelarla pide confirmación (#73)
- El viaje guarda el nombre de su origen y su destino tal como se eligieron al publicar (`originName`, `destinationName`), para mostrarlos en Mis viajes y en los avisos sin volver a calcularlos (#74)
- Mis viajes para el conductor: sus viajes próximos y anteriores, con su estado y plazas libres y, en los abiertos, las solicitudes (las prioritarias primero) con «Aceptar» y «Rechazar» (#75)
- Mis viajes para el pasajero: sus solicitudes de plaza con su viaje (cuándo, de dónde a dónde, quién conduce y la matrícula al confirmarla) y su estado; las pendientes o confirmadas de viajes que aún no han salido se pueden cancelar (#76)
- Número de avisos sin leer en la campana y en la pestaña Avisos («9+» a partir de 10), contado al entrar y en cada cambio de pantalla (#77)
- Pantalla Avisos: los más recientes primero, cada uno con su frase, su viaje y cuándo llegó; los no leídos, marcados. Al tocar uno se marca como leído y abre Mis viajes en el modo que le toca; «Marcar todo como leído» (#78)
- El modo con el que se viaja (pasajero o conductor) se guarda en el servidor para que sea el mismo en todos los dispositivos: `activeMode` en el usuario (login y `/me`), `PUT /api/users/me/active-mode` y el evento `user.active_mode_changed` para el Gemelo Digital (#79)
- El frontend usa el modo guardado en el servidor: al entrar se empieza con el último elegido, en cualquier dispositivo; cambiarlo se ve al momento y, si el servidor no lo guarda, vuelve al anterior con un aviso de error (#80)
- Pantalla Perfil: la cuenta (iniciales, nombre, correo y teléfono), los perfiles (activar el que falta), la privacidad y cerrar sesión con confirmación (#81)
- Mis vehículos en el Perfil (solo con el perfil de conductor): matrícula, marca y modelo y plazas, con «Editar» y «Registrar vehículo» en la ventana del vehículo (#82)
- Cambiar los datos de la propia cuenta con `PATCH /api/users/me`: nombre, teléfono y tolerancia horaria (± 5, 10, 15 o 20 min, el margen por defecto de las búsquedas, que sale en el usuario como `timeToleranceMin`); el correo no se cambia. Evento `user.updated` con los campos cambiados, sin datos personales (#83)

### Changed
- Las plazas se eligen en un campo como los demás, a todo el ancho, con − y + dentro y el número centrado (antes, dos botones sueltos a la izquierda) (#84)
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
- Buscar y Publicar comparten el selector de fecha y hora (`app-datetime-field`) y el contador de plazas de la guía (`app-seat-stepper`: «−», el número y «+»), que en Buscar sustituye al campo numérico con los botones dentro (#64)
- Los parkings del campus llevan su zona en el nombre: P1 y P2 (Sur), P3 (Este), P4 y P5 (Norte) y P6 (Oeste) (#65)
- Publicar: la declaración es un solo texto con el enlace a la declaración completa dentro, y el desvío se llama «Tiempo máximo de desvío», con la flecha del desplegable a la derecha (#69)
- Las sugerencias del correo UAL (acceso, registro y recuperar la contraseña) se despliegan pegadas al campo, por encima del formulario; elegir una ya no dispara el error del campo, y mientras sugieren no se marca en rojo (#70)
- Los botones de Buscar, Publicar y del vehículo se activan al completar los campos y, mientras, dicen qué falta; las fechas se leen «Hoy», «Mañana» o «jue, 30 oct»; el mapa de las ventanas es cuadrado (#71)
- El vehículo se registra con marca y modelo, matrícula y capacidad total contando al conductor («4 asientos = 1 conductor + hasta 3 pasajeros»), y en Publicar se muestra con su modelo y se puede editar en una ventana (#67)

### Security
- El backend ya no envía la cabecera `X-Powered-By: Express`, que revelaba la tecnología del servidor (#14)
- Dependencias del backend sin vulnerabilidades altas: `body-parser` 2.4.0 ([GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)) y `multer` 2.5.0 forzado con `overrides` ([GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m)) (#34)

### Removed
- Carpeta `database/` de la raíz: las migraciones y los datos de prueba viven ahora en `backend/src/database/` (#7)

### Fixed
- Área con sesión: el saludo va sobre blanco (en escritorio, en la franja fija, sin línea bajo el menú; en el móvil, al principio de Inicio) y el contenido de las pestañas sobre fondo gris claro; la cabecera, la franja y el contenido miden como mucho 1400px y quedan alineados con el logotipo (16px de margen en el móvil, 24px en escritorio) (#50)
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
