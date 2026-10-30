# Catálogo de códigos de error

Todas las APIs responden a los errores con el objeto `Error` de **TMF630** (TM Forum REST API Design Guidelines):

```json
{
  "@type": "Error",
  "code": "EMAIL_ALREADY_REGISTERED",
  "reason": "Email already registered",
  "message": "The email ana@ual.es is already registered",
  "status": "409"
}
```

- **`code`:** identificador estable del error. El frontend decide qué hacer a partir de él, nunca a partir del texto.
- **`reason`:** explicación breve del código.
- **`message`:** detalle del caso concreto.
- **`status`:** código HTTP, como texto.

Si los datos de entrada no son válidos, se responde con el tipo derivado **`ValidationError`**, que lista **todos** los campos que fallan (un elemento por regla incumplida):

```json
{
  "@type": "ValidationError",
  "@baseType": "Error",
  "code": "VALIDATION_FAILED",
  "reason": "Validation failed",
  "message": "The request has invalid fields",
  "status": "400",
  "fields": [
    { "field": "email", "reason": "email must be an email" },
    { "field": "password", "reason": "password must be longer than or equal to 8 characters" }
  ]
}
```

Todas las respuestas llevan la cabecera **`X-Request-Id`**. Si el cliente la envía (letras, números, `_`, `.` y `-`, hasta 128 caracteres), se reutiliza; si no, se genera un UUID. Ante un `INTERNAL_ERROR`, el mismo id aparece en el log del servidor junto al detalle del fallo.

## Genéricos

| `code` | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Datos de entrada no válidos o campos no permitidos (`ValidationError` con la lista `fields`) |
| `INTERNAL_ERROR` | 500 | Fallo inesperado. Nunca incluye detalles internos; `message` lleva la referencia (`X-Request-Id`) |
| `NOT_FOUND` | 404 | La ruta no existe |
| `SERVICE_UNAVAILABLE` | 503 | `GET /api/health`: la base de datos no responde |
| *Nombre del status HTTP* | 4xx/5xx | Otros errores de NestJS: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`… |

## Autenticación (`auth`, `users`)

| `code` | HTTP | Cuándo |
|---|---|---|
| `EMAIL_ALREADY_REGISTERED` | 409 | Registro con el correo de una cuenta que ya existe (sin distinguir mayúsculas). Un registro pendiente de verificar no cuenta: registrarse otra vez lo sustituye |
| `EMAIL_DOMAIN_NOT_ALLOWED` | 400 | Registro con un correo que no es de un dominio permitido (`ALLOWED_EMAIL_DOMAINS`) |
| `INVALID_CREDENTIALS` | 401 | Login con correo o contraseña incorrectos (el mismo error en los dos casos) |
| `EMAIL_NOT_VERIFIED` | 403 | Login con la contraseña correcta de un usuario que no ha verificado el correo. Desde que la cuenta se crea al verificarlo no debería darse (un registro pendiente no tiene cuenta y responde `INVALID_CREDENTIALS`); se mantiene como defensa. Con la contraseña incorrecta se responde `INVALID_CREDENTIALS`, para no revelar qué correos existen |
| `INVALID_VERIFICATION_CODE` | 400 | `POST /api/auth/verify-email` con un código incorrecto, caducado (15 minutos) o ya usado, o de un correo sin registro pendiente (inexistente, ya verificado o con el registro caducado a las 24 horas; el mismo error en todos los casos). Cada código incorrecto cuenta como intento fallido. También en la recuperación de la contraseña (`POST /api/auth/password-reset/verify` y `/confirm`), donde un correo sin cuenta da el mismo error |
| `TOO_MANY_ATTEMPTS` | 429 | Tercer código incorrecto seguido: el código queda anulado y hay que pedir otro (`POST /api/auth/verify-email/resend`, o `POST /api/auth/password-reset` en la recuperación) |
| `PASSWORD_UNCHANGED` | 400 | `POST /api/auth/password-reset/confirm` con un código correcto y una contraseña igual a la actual. Solo se comprueba con el código correcto (sin él responde `INVALID_VERIFICATION_CODE`), y el código no se gasta: se puede elegir otra |
| `INVALID_ACCESS_TOKEN` | 401 | Ruta protegida sin `Authorization: Bearer <token>`, con un token mal formado o de firma no válida, o cuyo usuario ya no existe |
| `ACCESS_TOKEN_EXPIRED` | 401 | El token de acceso ha caducado: hay que renovarlo, no volver a pedir la contraseña |
| `INVALID_REFRESH_TOKEN` | 401 | Renovación con un token de renovación inexistente, caducado, anulado (logout) o ya usado. Reutilizar uno ya usado cierra además toda la sesión. Hay que volver a iniciar sesión |

## Permisos y usuarios

| `code` | HTTP | Cuándo |
|---|---|---|
| `PROFILE_REQUIRED` | 403 | El usuario está autenticado pero no tiene el perfil que exige la acción (p. ej. consultar otro usuario sin ser administrador). `message` indica los perfiles necesarios |
| `USER_NOT_FOUND` | 404 | `GET /api/users/{id}` de un administrador con un id que no existe. A quien no es administrador se le responde `PROFILE_REQUIRED`, para no revelar qué ids existen |
| `PROFILE_NOT_FOUND` | 404 | El administrador activa un perfil de conductor o pasajero que el usuario nunca tuvo (crearlo es decisión del propio usuario; el de administrador sí se asigna) |
| `LAST_ADMIN` | 409 | Retirar el perfil del último administrador activo: nadie podría volver a gestionar la plataforma |
| `CANNOT_CHANGE_OWN_ADMIN` | 409 | Un administrador intenta retirarse su propio perfil de administrador (lo hace otro administrador) |
| `PROFILE_DEACTIVATED_BY_ADMIN` | 409 | El usuario elige un modo (`PUT /api/users/me/profiles/{profile}`) cuyo perfil le desactivó un administrador: solo un administrador puede reactivarlo |

## Vehículos (`users`)

| `code` | HTTP | Cuándo |
|---|---|---|
| `VEHICLE_ALREADY_REGISTERED` | 409 | La matrícula ya está registrada por otro conductor, o activa por el mismo. Si el mismo conductor la había dado de baja, se reactiva en vez de dar error |
| `VEHICLE_LIMIT_REACHED` | 409 | El conductor ya tiene 3 vehículos activos: para registrar otro, debe dar de baja uno |
| `VEHICLE_NOT_FOUND` | 404 | El vehículo no existe, está dado de baja o es de otro conductor (no se distingue, para no revelar qué ids existen) |
| `VEHICLE_IN_USE` | 409 | El vehículo está en un viaje en curso: no se puede dar de baja ni iniciar otro viaje con él hasta que termine |

## Viajes (`trips`)

| `code` | HTTP | Cuándo |
|---|---|---|
| `DRIVER_NOT_READY` | 403 | Publicar sin cumplir RF-21: falta la declaración responsable o un vehículo activo (`message` indica qué falta) |
| `SEATS_EXCEED_CAPACITY` | 400 | Las plazas ofertadas superan la capacidad del vehículo (plazas para pasajeros) |
| `DEPARTURE_IN_THE_PAST` | 400 | La hora de salida no es futura |
| `DEPARTURE_TOO_SOON` | 400 | La salida está a menos de una hora: se publica (o se mueve) con al menos una hora de antelación, para que quede margen de cancelar sin penalización |
| `TRIP_NOT_FOUND` | 404 | No existe un viaje con ese id |
| `NOT_TRIP_DRIVER` | 403 | Modificar o cancelar un viaje de otro conductor |
| `TRIP_NOT_EDITABLE` | 409 | Modificar un viaje que ya no está publicado (con pasajeros aceptados solo se puede cancelar) |
| `TRIP_ALREADY_STARTED` | 409 | Cancelar un viaje en curso: requiere registrar una incidencia (RF-23) |
| `PUBLISHING_SUSPENDED` | 409 | El conductor tiene 3 cancelaciones tardías (con pasajeros aceptados y a menos de 30 minutos de la salida) en 30 días: no puede publicar en 7 días desde la última. La fecha de fin está en `GET /api/users/me/publishing-status` |
| `INVALID_TRIP_TRANSITION` | 409 | Cambio de estado que el diagrama de estados del viaje no permite (p. ej. cancelar un viaje ya cancelado o finalizado) |
| `TRIP_FULL` | 409 | No quedan plazas: al solicitar plaza o al aceptar una solicitud (dos aceptaciones simultáneas nunca venden la misma plaza) |
| `TRIP_NOT_OPEN` | 409 | El viaje ya no admite solicitudes: está en curso, finalizado o cancelado, o su hora de salida ya ha pasado |
| `TRIP_NOT_STARTABLE_YET` | 409 | Iniciar un viaje más de 30 minutos antes de su hora de salida (RF-11) |
| `TRIP_NOT_IN_PROGRESS` | 409 | Registrar una incidencia (cancelar durante el viaje, RF-23) en un viaje que no está en curso |
| `ROUTE_NOT_FOUND` | 404 | `GET /api/trips/{id}/route` de un viaje sin ruta (solo viajes anteriores al cálculo de rutas: hoy cada viaje la calcula al publicarse, con OSRM o estimada) |

## Solicitudes de plaza (`requests`)

| `code` | HTTP | Cuándo |
|---|---|---|
| `CANNOT_REQUEST_OWN_TRIP` | 409 | Pedir plaza en un viaje propio (usuario con perfil de conductor y de pasajero) |
| `REQUEST_ALREADY_EXISTS` | 409 | El pasajero ya tiene una solicitud pendiente o aceptada en ese viaje |
| `REQUEST_NOT_FOUND` | 404 | La solicitud no existe o el usuario no es ni su pasajero ni el conductor del viaje (es privada: no se revela que existe) |
| `NOT_REQUEST_PASSENGER` | 403 | Cancelar una solicitud sin ser su pasajero (el conductor la rechaza o cancela el viaje) |
| `INVALID_REQUEST_TRANSITION` | 409 | Cambio de estado que el diagrama de estados de la solicitud no permite (p. ej. aceptar una solicitud rechazada) |

| `NOT_TRIP_PASSENGER` | 403 | Registrar una incidencia en un viaje sin ser su conductor ni un pasajero aceptado |

Además, aceptar o cancelar pueden responder `TRIP_FULL`, `TRIP_NOT_OPEN`, `TRIP_ALREADY_STARTED` o `NOT_TRIP_DRIVER` (ver *Viajes*).

## Incidencias (`incidents`)

| `code` | HTTP | Cuándo |
|---|---|---|
| `INCIDENT_NOT_FOUND` | 404 | La incidencia no existe, o el usuario no es ni quien la registró ni administrador (es privada: protege a quien informa de un problema con otra persona) |
| `INCIDENT_ALREADY_REVIEWED` | 409 | Revisar una incidencia ya revisada: la revisión es definitiva (CU-12) |

Registrar una incidencia puede responder además `TRIP_NOT_IN_PROGRESS` (ver *Viajes*) o `NOT_TRIP_PASSENGER` (ver *Solicitudes de plaza*).

## Seguimiento del viaje (`tracking`)

| `code` | HTTP | Cuándo |
|---|---|---|
| `POSITION_TOO_FREQUENT` | 409 | El conductor envía una posición antes de que pasen `POSITION_MIN_INTERVAL_SECONDS` (10 por defecto) desde la anterior: el móvil puede ignorarlo y enviar la siguiente |
| `POSITION_NOT_FOUND` | 404 | El viaje no tiene posición: aún no ha empezado, el conductor no ha enviado ninguna o ya terminó (al terminar se borra el recorrido) |

Enviar una posición puede responder además `NOT_TRIP_DRIVER` o `TRIP_NOT_IN_PROGRESS` (ver *Viajes*); consultarla, `NOT_TRIP_PASSENGER` a quien no es su conductor ni un pasajero aceptado (ver *Solicitudes de plaza*).

## Avisos (`notifications`)

| `code` | HTTP | Cuándo |
|---|---|---|
| `NOTIFICATION_NOT_FOUND` | 404 | Marcar como leído un aviso que no existe o que es de otro usuario (no se distingue: no se revela que existe) |

## Lugares (`places`)

| `code` | HTTP | Cuándo |
|---|---|---|
| `CAMPUS_PARKING_NOT_FOUND` | 404 | El parking del campus no existe o está cerrado |
| `PLACE_NOT_FOUND` | 404 | La dirección pedida no existe (id que no es nuestro o que ya no lleva a nada) o no hay ninguna cerca del punto |
| `GEOCODER_UNAVAILABLE` | 503 | El servicio de direcciones (CartoCiudad) no responde a tiempo o falla; se puede reintentar |

## Cómo añadir un código

1. Crea el error de negocio extendiendo `BusinessError` (`backend/src/shared/errors/business-error.ts`) con su `code` y su tipo de fallo: `invalid` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404) o `conflict` (409).
2. Añádelo a la tabla de su módulo en este documento.
