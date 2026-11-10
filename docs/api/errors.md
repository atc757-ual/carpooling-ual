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
    {
      "field": "password",
      "reason": "password must be longer than or equal to 8 characters"
    }
  ]
}
```

Todas las respuestas llevan la cabecera **`X-Request-Id`**. Si el cliente la envía (letras, números, `_`, `.` y `-`, hasta 128 caracteres), se reutiliza; si no, se genera un UUID. Ante un `INTERNAL_ERROR`, el mismo id aparece en el log del servidor junto al detalle del fallo.

## Genéricos

| `code`                   | HTTP    | Cuándo                                                                                            |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------- |
| `VALIDATION_FAILED`      | 400     | Datos de entrada no válidos o campos no permitidos (`ValidationError` con la lista `fields`)      |
| `INTERNAL_ERROR`         | 500     | Fallo inesperado. Nunca incluye detalles internos; `message` lleva la referencia (`X-Request-Id`) |
| `NOT_FOUND`              | 404     | La ruta no existe                                                                                 |
| `SERVICE_UNAVAILABLE`    | 503     | `GET /api/health`: la base de datos no responde                                                   |
| _Nombre del status HTTP_ | 4xx/5xx | Otros errores de NestJS: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`…                              |

## Autenticación (`auth`, `users`)

| `code`                      | HTTP | Cuándo                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EMAIL_ALREADY_REGISTERED`  | 409  | Registro con el correo de una cuenta que ya existe (sin distinguir mayúsculas). Un registro pendiente de verificar no cuenta: registrarse otra vez lo sustituye                                                                                                                                                                                                                                                                                |
| `EMAIL_DOMAIN_NOT_ALLOWED`  | 400  | Registro con un correo que no es de un dominio permitido (`ALLOWED_EMAIL_DOMAINS`)                                                                                                                                                                                                                                                                                                                                                             |
| `INVALID_CREDENTIALS`       | 401  | Login con correo o contraseña incorrectos (el mismo error en los dos casos)                                                                                                                                                                                                                                                                                                                                                                    |
| `EMAIL_NOT_VERIFIED`        | 403  | Login con la contraseña correcta de un usuario que no ha verificado el correo. Desde que la cuenta se crea al verificarlo no debería darse (un registro pendiente no tiene cuenta y responde `INVALID_CREDENTIALS`); se mantiene como defensa. Con la contraseña incorrecta se responde `INVALID_CREDENTIALS`, para no revelar qué correos existen                                                                                             |
| `INVALID_VERIFICATION_CODE` | 400  | `POST /api/auth/verify-email` con un código incorrecto, caducado (15 minutos) o ya usado, o de un correo sin registro pendiente (inexistente, ya verificado o con el registro caducado a las 24 horas; el mismo error en todos los casos). Cada código incorrecto cuenta como intento fallido. También en la recuperación de la contraseña (`POST /api/auth/password-reset/verify` y `/confirm`), donde un correo sin cuenta da el mismo error |
| `TOO_MANY_ATTEMPTS`         | 429  | Tercer código incorrecto seguido: el código queda anulado y hay que pedir otro (`POST /api/auth/verify-email/resend`, o `POST /api/auth/password-reset` en la recuperación)                                                                                                                                                                                                                                                                    |
| `TOO_MANY_LOGIN_ATTEMPTS`   | 429  | Login con un correo que ha fallado 5 veces seguidas (con menos de 15 minutos entre fallos): queda bloqueado 5 minutos, aunque la contraseña sea correcta. Se responde igual exista o no el correo, para no revelar cuáles están registrados. Un login correcto pone el contador a cero                                                                                                                                                         |
| `PASSWORD_UNCHANGED`        | 400  | `POST /api/auth/password-reset/confirm` con un código correcto y una contraseña igual a la actual. Solo se comprueba con el código correcto (sin él responde `INVALID_VERIFICATION_CODE`), y el código no se gasta: se puede elegir otra                                                                                                                                                                                                       |
| `INVALID_ACCESS_TOKEN`      | 401  | Ruta protegida sin `Authorization: Bearer <token>`, con un token mal formado o de firma no válida, o cuyo usuario ya no existe                                                                                                                                                                                                                                                                                                                 |
| `ACCESS_TOKEN_EXPIRED`      | 401  | El token de acceso ha caducado: hay que renovarlo, no volver a pedir la contraseña                                                                                                                                                                                                                                                                                                                                                             |
| `INVALID_REFRESH_TOKEN`     | 401  | Renovación con un token de renovación inexistente, caducado, anulado (logout) o ya usado. Reutilizar uno ya usado cierra además toda la sesión. Hay que volver a iniciar sesión                                                                                                                                                                                                                                                                |

## Permisos y usuarios

| `code`                          | HTTP | Cuándo                                                                                                                                                                                                                                                                       |
| ------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROFILE_REQUIRED`              | 403  | El usuario está autenticado pero no tiene el perfil que exige la acción (p. ej. consultar otro usuario sin ser administrador). `message` indica los perfiles necesarios                                                                                                      |
| `TRAVEL_PREFERENCE_NOT_OFFERED` | 400  | Elegir en `PATCH /api/users/me` una opción de preferencia que el panel ha dejado de ofrecer. Quien ya la tenía la conserva                                                                                                                                                   |
| `USER_NOT_FOUND`                | 404  | `GET /api/users/{id}` de un administrador con un id que no existe. A quien no es administrador se le responde `PROFILE_REQUIRED`, para no revelar qué ids existen                                                                                                            |
| `PROFILE_NOT_FOUND`             | 404  | El administrador activa un perfil de conductor o pasajero que el usuario nunca tuvo (crearlo es decisión del propio usuario; el de administrador sí se asigna)                                                                                                               |
| `LAST_ADMIN`                    | 409  | Retirar el perfil del último administrador activo: nadie podría volver a gestionar la plataforma                                                                                                                                                                             |
| `CANNOT_CHANGE_OWN_ADMIN`       | 409  | Un administrador intenta retirarse su propio perfil de administrador (lo hace otro administrador)                                                                                                                                                                            |
| `PROFILE_DEACTIVATED_BY_ADMIN`  | 409  | El usuario elige un modo (`PUT /api/users/me/profiles/{profile}`) cuyo perfil le desactivó un administrador: solo un administrador puede reactivarlo                                                                                                                         |
| `AVATAR_NOT_FOUND`              | 404  | El avatar (`GET /api/avatars/{id}` o `PATCH /api/users/me`) no existe o está retirado, o se pide la imagen (`GET /api/avatars/{id}/image`) de uno que es SVG                                                                                                                 |
| `LEGAL_DOCUMENT_NOT_FOUND`      | 404  | No hay ninguna versión publicada del documento legal pedido                                                                                                                                                                                                                  |
| `LEGAL_DRAFT_NOT_FOUND`         | 404  | El panel pide o publica el borrador de un documento legal que no tiene ninguno                                                                                                                                                                                               |
| `LEGAL_DOCUMENT_OUTDATED`       | 409  | El usuario acepta una versión de un documento legal que ya no es la vigente: tiene que leer la última                                                                                                                                                                        |
| `LEGAL_SUMMARY_REQUIRED`        | 422  | El panel publica el borrador de un documento legal sin su «Qué ha cambiado» (`summary` en `PUT /api/admin/legal-documents/{type}/draft`)                                                                                                                                     |
| `INVALID_AVATAR_IMAGE`          | 422  | La imagen subida (`POST /api/admin/catalogs/avatars` o `PUT …/{key}/image`) no es PNG ni WebP por su contenido (los SVG se rechazan siempre), pesa más de 100 KB o no es cuadrada de 128 a 512 px                                                                            |
| `PHONE_REQUIRED`                | 409  | Pedir o confirmar el código de verificación del teléfono (`POST /api/users/me/phone-verification` y `/confirm`) sin tener antes un número guardado en `PATCH /api/users/me`                                                                                                  |
| `ACCOUNT_HAS_ACTIVE_TRIPS`      | 409  | Pedir el código de baja (`POST /api/users/me/account-deletion`) o confirmar la eliminación de la cuenta (`.../confirm`) teniendo viajes sin terminar como conductor (`published`, `confirmed` o `in_progress`) o plazas aceptadas como pasajero en viajes aún no finalizados |
| `USER_NOT_SUSPENDED`            | 409  | Un administrador levanta una suspensión (`POST /api/admin/users/{id}/suspensions/{role}/lift`) que no está en curso para ese papel                                                                                                                                           |

## Vehículos (`users`)

| `code`                       | HTTP | Cuándo                                                                                                                                                  |
| ---------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VEHICLE_COLOR_NOT_OFFERED`  | 400  | El color no está en el catálogo (`GET /api/catalogs/vehicle-colors`) o está desactivado. Un vehículo conserva el suyo aunque después se desactive       |
| `VEHICLE_ALREADY_REGISTERED` | 409  | La matrícula ya está registrada por otro conductor, o activa por el mismo. Si el mismo conductor la había dado de baja, se reactiva en vez de dar error |
| `VEHICLE_LIMIT_REACHED`      | 409  | El conductor ya tiene 3 vehículos activos: para registrar otro, debe dar de baja uno                                                                    |
| `VEHICLE_NOT_FOUND`          | 404  | El vehículo no existe, está dado de baja o es de otro conductor (no se distingue, para no revelar qué ids existen)                                      |
| `VEHICLE_IN_USE`             | 409  | El vehículo está en un viaje en curso: no se puede dar de baja ni iniciar otro viaje con él hasta que termine                                           |

## Viajes (`trips`)

| `code`                         | HTTP | Cuándo                                                                                                                                                                                                                                  |
| ------------------------------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DRIVER_NOT_READY`             | 403  | Publicar sin cumplir RF-21: falta la declaración responsable o un vehículo activo (`message` indica qué falta)                                                                                                                          |
| `SEATS_EXCEED_CAPACITY`        | 400  | Las plazas ofertadas superan la capacidad del vehículo (plazas para pasajeros)                                                                                                                                                          |
| `VEHICLE_DECLARATION_REQUIRED` | 409  | Se publica, modifica o inicia un viaje con un vehículo sin su declaración (seguro e ITV) al día: nunca se aceptó, se aceptó hace más de un año o cambió de forma importante después. Se acepta con `PUT /api/vehicles/{id}/declaration` |
| `DRIVER_DECLARATION_REQUIRED`  | 409  | Se inicia un viaje sin la declaración responsable del conductor al día: se aceptó hace más de un año o cambió de forma importante después. Se acepta con `PUT /api/users/me/driver-declaration`                                         |
| `DEPARTURE_IN_THE_PAST`        | 400  | La hora de salida no es futura                                                                                                                                                                                                          |
| `DEPARTURE_TOO_SOON`           | 400  | La salida está a menos de una hora: se publica (o se mueve) con al menos una hora de antelación, para que quede margen de cancelar sin penalización                                                                                     |
| `TRIP_NOT_FOUND`               | 404  | No existe un viaje con ese id                                                                                                                                                                                                           |
| `NOT_TRIP_DRIVER`              | 403  | Modificar o cancelar un viaje de otro conductor                                                                                                                                                                                         |
| `TRIP_NOT_EDITABLE`            | 409  | Modificar un viaje que ya no está publicado (con pasajeros aceptados solo se puede cancelar)                                                                                                                                            |
| `TRIP_ALREADY_STARTED`         | 409  | Cancelar un viaje en curso: requiere registrar una incidencia (RF-23)                                                                                                                                                                   |
| `PUBLISHING_SUSPENDED`         | 409  | El conductor tiene 3 cancelaciones tardías (con pasajeros aceptados y a menos de 30 minutos de la salida) en 30 días: no puede publicar en 7 días desde la última. La fecha de fin está en `GET /api/users/me/publishing-status`        |
| `TRIP_OVERLAPS`                | 409  | Publicar o modificar un viaje que se cruza con otro viaje activo (publicado, confirmado o en curso) del mismo conductor. Cada viaje ocupa desde la salida hasta la llegada más el desvío máximo                                         |
| `DAILY_TRIP_LIMIT`             | 409  | Publicar o mover un viaje a un día (hora de Madrid) en el que el conductor ya tiene 4 viajes no cancelados                                                                                                                              |
| `INVALID_TRIP_TRANSITION`      | 409  | Cambio de estado que el diagrama de estados del viaje no permite (p. ej. cancelar un viaje ya cancelado o finalizado)                                                                                                                   |
| `TRIP_FULL`                    | 409  | No quedan plazas: al solicitar plaza o al aceptar una solicitud (dos aceptaciones simultáneas nunca venden la misma plaza)                                                                                                              |
| `TRIP_NOT_OPEN`                | 409  | El viaje ya no admite solicitudes: está en curso, finalizado o cancelado, o faltan menos de 10 min para la salida (corte)                                                                                                               |
| `TRIP_NOT_STARTABLE_YET`       | 409  | Iniciar un viaje más de 10 minutos antes de su hora de salida (RF-11)                                                                                                                                                                   |
| `TRIP_NOT_IN_PROGRESS`         | 409  | Registrar una incidencia (cancelar durante el viaje, RF-23) en un viaje que no está en curso                                                                                                                                            |
| `ROUTE_NOT_FOUND`              | 404  | Pedir o aceptar una plaza en un viaje sin ruta (viajes anteriores al cálculo de rutas). `GET /api/trips/{id}/route` ya no lo devuelve: calcula la ruta que falte                                                                        |

## Solicitudes de plaza (`requests`)

| `code`                       | HTTP | Cuándo                                                                                                                                                                                                                                                                              |
| ---------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CANNOT_REQUEST_OWN_TRIP`    | 409  | Pedir plaza en un viaje propio (usuario con perfil de conductor y de pasajero)                                                                                                                                                                                                      |
| `REQUEST_ALREADY_EXISTS`     | 409  | El pasajero ya tiene una solicitud pendiente o aceptada en ese viaje                                                                                                                                                                                                                |
| `TOO_MANY_PENDING_REQUESTS`  | 409  | El pasajero ya tiene tres solicitudes pendientes de viajes que se solapan en horario                                                                                                                                                                                                |
| `REQUESTING_SUSPENDED`       | 409  | El pasajero tiene 3 cancelaciones tardías (una plaza aceptada que suelta a menos de 30 minutos de la salida) en 30 días: no puede pedir plaza en 7 días desde la última, la misma regla que el conductor al publicar. La fecha de fin está en `GET /api/users/me/requesting-status` |
| `INVALID_REQUEST_PICKUP`     | 400  | Una solicitud de ida al campus requiere el punto y el nombre de recogida                                                                                                                                                                                                            |
| `TRIP_CHANGED_RETRY`         | 409  | El viaje cambió mientras se calculaba el contexto de recogida; hay que volver a solicitar                                                                                                                                                                                           |
| `REQUEST_NOT_FOUND`          | 404  | La solicitud no existe o el usuario no es ni su pasajero ni el conductor del viaje (es privada: no se revela que existe)                                                                                                                                                            |
| `NOT_REQUEST_PASSENGER`      | 403  | Cancelar una solicitud sin ser su pasajero (el conductor la rechaza o cancela el viaje)                                                                                                                                                                                             |
| `INVALID_REQUEST_TRANSITION` | 409  | Cambio de estado que el diagrama de estados de la solicitud no permite (p. ej. aceptar una solicitud rechazada)                                                                                                                                                                     |
| `INVALID_BOARD_CODE`         | 400  | El conductor valida la subida (`POST /api/requests/{id}/board`) con un código de 4 cifras que no es el del pasajero                                                                                                                                                                 |
| `ALREADY_BOARDED`            | 409  | El conductor valida la subida de un pasajero que ya estaba validado                                                                                                                                                                                                                 |
| `PICKUP_GRACE_PERIOD_ACTIVE` | 400  | El conductor marca «No se presentó» (`POST /api/requests/{id}/no-show`) antes de que pasen 5 minutos desde la hora de recogida. `message` dice cuántos minutos faltan                                                                                                               |
| `NOT_TRIP_PASSENGER`         | 403  | Registrar una incidencia en un viaje sin ser su conductor ni un pasajero aceptado                                                                                                                                                                                                   |

Además, aceptar o cancelar pueden responder `TRIP_FULL`, `TRIP_NOT_OPEN`, `TRIP_ALREADY_STARTED` o `NOT_TRIP_DRIVER` (ver _Viajes_).

## Incidencias (`incidents`)

| `code`                        | HTTP | Cuándo                                                                                                                                                                 |
| ----------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INCIDENT_NOT_FOUND`          | 404  | La incidencia no existe, o el usuario no es ni quien la registró ni administrador (es privada: protege a quien informa de un problema con otra persona)                |
| `INCIDENT_ALREADY_REVIEWED`   | 409  | Mover una incidencia ya atendida: la revisión es definitiva (CU-12)                                                                                                    |
| `INCIDENT_INVOLVED_ADMIN`     | 403  | Empezar, dejar o atender la revisión de una incidencia en cuyo viaje está implicado el administrador (la registró, lo conduce o pidió plaza): la gestiona otro (CU-12) |
| `INCIDENT_REVIEW_TAKEN`       | 409  | Empezar, dejar o atender una incidencia que está revisando otro administrador                                                                                          |
| `INCIDENT_INVALID_TRANSITION` | 409  | Atender o dejar una incidencia sin haber empezado a revisarla (registrada → en revisión → atendida)                                                                    |

Registrar una incidencia puede responder además `TRIP_NOT_IN_PROGRESS` (ver _Viajes_) o `NOT_TRIP_PASSENGER` (ver _Solicitudes de plaza_).

## Reseñas y reputación (`reputation`)

| `code`                  | HTTP | Cuándo                                                                                                                                                                          |
| ----------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REVIEW_NOT_ALLOWED`    | 403  | `POST /api/trips/{tripId}/reviews` en un viaje que no ha terminado (`finished`), valorándose a sí mismo o sin que autor y destinatario sean el conductor y un pasajero aceptado |
| `REVIEW_WINDOW_CLOSED`  | 409  | Han pasado más de 7 días desde que finalizó el viaje (`finished_at`)                                                                                                            |
| `REVIEW_ALREADY_EXISTS` | 409  | El autor ya valoró a ese destinatario en el viaje (una reseña no se edita ni se borra)                                                                                          |

Crear una reseña puede responder además `TRIP_NOT_FOUND` (ver _Viajes_).

## Seguimiento del viaje (`tracking`)

| `code`                  | HTTP | Cuándo                                                                                                                                                                |
| ----------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSITION_TOO_FREQUENT` | 409  | El conductor envía una posición antes de que pasen `POSITION_MIN_INTERVAL_SECONDS` (10 por defecto) desde la anterior: el móvil puede ignorarlo y enviar la siguiente |
| `POSITION_NOT_FOUND`    | 404  | El viaje no tiene posición: aún no ha empezado, el conductor no ha enviado ninguna o ya terminó (al terminar se borra el recorrido)                                   |

Enviar una posición puede responder además `NOT_TRIP_DRIVER` o `TRIP_NOT_IN_PROGRESS` (ver _Viajes_); consultarla, `NOT_TRIP_PASSENGER` a quien no es su conductor ni un pasajero aceptado (ver _Solicitudes de plaza_).

## Chat del viaje (`chat`)

| `code`                    | HTTP | Cuándo                                                                                                       |
| ------------------------- | ---- | ------------------------------------------------------------------------------------------------------------ |
| `CHAT_NOT_ALLOWED`        | 403  | Leer o escribir en el chat de un viaje sin ser su conductor ni un pasajero con la solicitud aceptada         |
| `CHAT_CLOSED`             | 409  | Escribir cuando el chat no admite mensajes: viaje publicado (sin pasajeros), cancelado o terminado hace 24 h |
| `CHAT_QUICK_REPLIES_ONLY` | 409  | El conductor escribe texto con el viaje en curso: solo puede enviar respuestas rápidas (seguridad vial)      |
| `CHAT_RATE_LIMITED`       | 429  | Más de 20 mensajes en un minuto                                                                              |

Denunciar el chat (`POST /api/trips/{id}/chat/report`) solo da los errores de arriba (`CHAT_NOT_ALLOWED`) y `VALIDATION_FAILED` si el motivo no tiene entre 10 y 500 caracteres.

Si el viaje no existe, `TRIP_NOT_FOUND` (ver _Viajes_).

## Avisos (`notifications`)

| `code`                   | HTTP | Cuándo                                                                                                       |
| ------------------------ | ---- | ------------------------------------------------------------------------------------------------------------ |
| `NOTIFICATION_NOT_FOUND` | 404  | Marcar como leído un aviso que no existe o que es de otro usuario (no se distingue: no se revela que existe) |

## Lugares (`places`)

| `code`                         | HTTP | Cuándo                                                                                                                                         |
| ------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `CAMPUS_PARKING_NOT_FOUND`     | 404  | El parking del campus no existe o está cerrado (en el panel, solo si no existe)                                                                |
| `PARKING_OUTSIDE_SERVICE_AREA` | 400  | El punto de un parking que da de alta o mueve el panel queda fuera de la zona de servicio                                                      |
| `PARKING_IN_USE`               | 409  | Cerrar o mover un parking con viajes publicados, confirmados o en curso que empiezan o terminan a menos de 75 m; el nombre sí se puede cambiar |
| `PLACE_NOT_FOUND`              | 404  | La dirección pedida no existe (id que no es nuestro o que ya no lleva a nada) o no hay ninguna cerca del punto                                 |
| `GEOCODER_UNAVAILABLE`         | 503  | El servicio de direcciones (CartoCiudad) no responde a tiempo o falla; se puede reintentar                                                     |

## Eventos (`events`)

| `code`            | HTTP | Cuándo                                             |
| ----------------- | ---- | -------------------------------------------------- |
| `EVENT_NOT_FOUND` | 404  | El evento (`GET /api/admin/events/{id}`) no existe |

## Simulación (`simulations`)

| `code`                          | HTTP | Cuándo                                                                                        |
| ------------------------------- | ---- | --------------------------------------------------------------------------------------------- |
| `SCENARIO_NOT_FOUND`            | 404  | No hay ningún escenario con el código pedido (S0-S5)                                          |
| `SIMULATION_NOT_FOUND`          | 404  | La ejecución de simulación no existe                                                          |
| `SIMULATION_SWEEP_NOT_FOUND`    | 404  | El análisis de sensibilidad no existe                                                         |
| `SIMULATION_ALREADY_RUNNING`    | 409  | Lanzar una ejecución con otra en cola o en curso: el simulador atiende una a la vez           |
| `SIMULATION_NOT_FINISHED`       | 409  | Pedir los resultados o el CSV de una ejecución que no ha terminado (o que falló o se canceló) |
| `INVALID_SIMULATION_TRANSITION` | 409  | Cambio de estado no permitido, p. ej. cancelar una ejecución ya terminada                     |

Una ejecución que falla guarda en `errorCode` el motivo: `RUNNER_ERROR` (error del motor) o `RUNNER_LOST` (el motor no informó del progreso durante más de un minuto).

## Catálogos (`catalogs`)

| `code`                   | HTTP | Cuándo                                                                                         |
| ------------------------ | ---- | ---------------------------------------------------------------------------------------------- |
| `CATALOG_ITEM_NOT_FOUND` | 404  | No hay ningún elemento con esa clave en el catálogo                                            |
| `CATALOG_ITEM_EXISTS`    | 409  | Dar de alta un elemento cuya clave (el nombre sin tildes ni mayúsculas) ya existe, activo o no |

## Cómo añadir un código

1. Crea el error de negocio extendiendo `BusinessError` (`backend/src/shared/errors/business-error.ts`) con su `code` y su tipo de fallo: `invalid` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404) o `conflict` (409).
2. Añádelo a la tabla de su módulo en este documento.
