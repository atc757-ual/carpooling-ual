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
| `EMAIL_ALREADY_REGISTERED` | 409 | Registro con un correo que ya existe (sin distinguir mayúsculas) |
| `EMAIL_DOMAIN_NOT_ALLOWED` | 400 | Registro con un correo que no es de un dominio permitido (`ALLOWED_EMAIL_DOMAINS`) |
| `INVALID_CREDENTIALS` | 401 | Login con correo o contraseña incorrectos (el mismo error en los dos casos) |
| `INVALID_ACCESS_TOKEN` | 401 | Ruta protegida sin `Authorization: Bearer <token>`, con un token mal formado o de firma no válida, o cuyo usuario ya no existe |
| `ACCESS_TOKEN_EXPIRED` | 401 | El token de acceso ha caducado: hay que renovarlo, no volver a pedir la contraseña |
| `INVALID_REFRESH_TOKEN` | 401 | Renovación con un token de renovación inexistente, caducado, anulado (logout) o ya usado. Reutilizar uno ya usado cierra además toda la sesión. Hay que volver a iniciar sesión |

## Permisos y usuarios

| `code` | HTTP | Cuándo |
|---|---|---|
| `PROFILE_REQUIRED` | 403 | El usuario está autenticado pero no tiene el perfil que exige la acción (p. ej. consultar otro usuario sin ser administrador). `message` indica los perfiles necesarios |
| `USER_NOT_FOUND` | 404 | `GET /api/users/{id}` de un administrador con un id que no existe. A quien no es administrador se le responde `PROFILE_REQUIRED`, para no revelar qué ids existen |

## Vehículos (`users`)

| `code` | HTTP | Cuándo |
|---|---|---|
| `VEHICLE_ALREADY_REGISTERED` | 409 | La matrícula ya está registrada por otro conductor, o activa por el mismo. Si el mismo conductor la había dado de baja, se reactiva en vez de dar error |
| `VEHICLE_NOT_FOUND` | 404 | El vehículo no existe, está dado de baja o es de otro conductor (no se distingue, para no revelar qué ids existen) |
| `VEHICLE_IN_USE` | 409 | El vehículo está en un viaje en curso: no se puede dar de baja ni iniciar otro viaje con él hasta que termine |

## Viajes (`trips`)

| `code` | HTTP | Cuándo |
|---|---|---|
| `DRIVER_NOT_READY` | 403 | Publicar sin cumplir RF-21: falta la declaración responsable o un vehículo activo (`message` indica qué falta) |
| `SEATS_EXCEED_CAPACITY` | 400 | Las plazas ofertadas superan la capacidad del vehículo (plazas para pasajeros) |
| `DEPARTURE_IN_THE_PAST` | 400 | La hora de salida no es futura |
| `TRIP_NOT_FOUND` | 404 | No existe un viaje con ese id |
| `NOT_TRIP_DRIVER` | 403 | Modificar o cancelar un viaje de otro conductor |
| `TRIP_NOT_EDITABLE` | 409 | Modificar un viaje que ya no está publicado (con pasajeros aceptados solo se puede cancelar) |
| `TRIP_ALREADY_STARTED` | 409 | Cancelar un viaje en curso: requiere registrar una incidencia (RF-23) |
| `INVALID_TRIP_TRANSITION` | 409 | Cambio de estado que el diagrama de estados del viaje no permite (p. ej. cancelar un viaje ya cancelado o finalizado) |
| `TRIP_FULL` | 409 | No quedan plazas: al solicitar plaza o al aceptar una solicitud (dos aceptaciones simultáneas nunca venden la misma plaza) |
| `TRIP_NOT_OPEN` | 409 | El viaje ya no admite solicitudes: está en curso, finalizado o cancelado, o su hora de salida ya ha pasado |
| `TRIP_NOT_STARTABLE_YET` | 409 | Iniciar un viaje más de 30 minutos antes de su hora de salida (RF-11) |
| `TRIP_NOT_IN_PROGRESS` | 409 | Registrar una incidencia (cancelar durante el viaje, RF-23) en un viaje que no está en curso |

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

## Cómo añadir un código

1. Crea el error de negocio extendiendo `BusinessError` (`backend/src/shared/errors/business-error.ts`) con su `code` y su tipo de fallo: `invalid` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404) o `conflict` (409).
2. Añádelo a la tabla de su módulo en este documento.
