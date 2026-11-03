# Contrato de eventos

La plataforma registra cada cambio de estado de sus entidades en la tabla `events` (patrón outbox, RNF-08), en la misma transacción que el cambio. El Gemelo Digital es su **único consumidor** (DP-05, DP-10): los lee en orden de secuencia, descarta los repetidos por su `id` (RNF-11) y reparte cada uno a los gemelos de entidad afectados.

## Sobre común (DP-05)

| Campo              | Tipo         | Qué es                                                                                       |
| ------------------ | ------------ | -------------------------------------------------------------------------------------------- |
| `id`               | uuid         | Identificador del evento. Lo genera la aplicación; sirve para descartar duplicados (RNF-11). |
| `sequence`         | bigint       | Número creciente y único que pone la base de datos al guardarlo. Orden de consumo.           |
| `type`             | texto        | `entidad.acción` en pasado (`trip.published`). Lista completa abajo.                         |
| `version`          | entero       | Versión del contrato de su tipo (`src/events/event-versions.ts`).                            |
| `source_entity_id` | uuid         | Entidad que lo origina (sin clave foránea: referencia lógica).                               |
| `payload`          | JSON         | Estado de la entidad tras el cambio, sin texto libre con datos personales (minimización).    |
| `occurred_at`      | fecha y hora | Cuándo se guardó.                                                                            |

### Cómo se consume

- `EventsService.readAfter(secuencia, límite)` devuelve los eventos posteriores a la última secuencia procesada, en orden (500 como mucho por lectura).
- La secuencia se asigna **al guardar**, no al confirmar la transacción: dos transacciones simultáneas pueden confirmarse en orden distinto y dejar un hueco momentáneo (la 11 visible antes que la 10). El consumidor no da un hueco por perdido a la primera: vuelve a leer desde antes del hueco pasado un instante y procesa lo que aparezca, descartando por `id` lo ya visto.
- Al cambiar la forma del `payload` de un tipo, se sube su versión en `event-versions.ts` y se documenta aquí; el consumidor lee cada evento según su `version`.

## Tipos (en la versión 1 salvo donde se indica)

El `payload` de cada tipo lo construye el fichero indicado.

| Tipo                       | Cuándo                                                                         | `payload` en                          |
| -------------------------- | ------------------------------------------------------------------------------ | ------------------------------------- |
| `user.registered`          | Se crea la cuenta (tras verificar el correo)                                   | `users/users.service.ts`              |
| `user.email_verified`      | Reservado: aún no se registra (el correo se verifica antes de crear la cuenta) | —                                     |
| `user.phone_verified`      | Verifica su teléfono con el código                                             | `users/users.service.ts`              |
| `user.deactivated`         | Elimina su cuenta                                                              | `users/users.service.ts`              |
| `user.profile_activated`   | Se activa un perfil (por el usuario o por un administrador)                    | `users/user-profiles.service.ts`      |
| `user.profile_deactivated` | Un administrador desactiva un perfil                                           | `users/user-profiles.service.ts`      |
| `user.updated`             | Cambia los datos de su cuenta                                                  | `users/users.service.ts`              |
| `user.active_mode_changed` | Cambia el modo con el que viaja                                                | `users/user-profiles.service.ts`      |
| `consent.granted`          | Da un consentimiento (condiciones, privacidad, ubicación)                      | `users/consents.service.ts`           |
| `consent.revoked`          | Lo retira                                                                      | `users/consents.service.ts`           |
| `trip.published`           | Publica un viaje                                                               | `trips/trips.service.ts`              |
| `trip.updated`             | Cambia un viaje publicado                                                      | `trips/trip-status.service.ts`        |
| `trip.confirmed`           | Se acepta la primera solicitud                                                 | `trips/trip-status.service.ts`        |
| `trip.reopened`            | Vuelve a publicado al cancelarse todas las aceptadas                           | `trips/trip-status.service.ts`        |
| `trip.started`             | Empieza el viaje                                                               | `trips/trip-status.service.ts`        |
| `trip.finished` (v2)       | Termina el viaje                                                               | `trips/trip-status.service.ts`        |
| `trip.cancelled`           | Se cancela el viaje                                                            | `trips/trip-status.service.ts`        |
| `trip.cancelled_late`      | Cancelación tardía del conductor o de un pasajero (fiabilidad, S5)             | `trips/late-cancellations.service.ts` |
| `late_cancellation.waived` | Un administrador perdona las cancelaciones tardías de un papel                 | `trips/late-cancellations.service.ts` |
| `trip.position_updated`    | Nueva posición del conductor durante el viaje (RF-12, RNF-07)                  | `tracking/trip-positions.service.ts`  |
| `request.created`          | Un pasajero pide plaza                                                         | `requests/request-changes.ts`         |
| `request.accepted`         | El conductor la acepta                                                         | `requests/request-changes.ts`         |
| `request.rejected`         | La rechaza                                                                     | `requests/request-changes.ts`         |
| `request.cancelled`        | Se cancela la solicitud                                                        | `requests/request-changes.ts`         |
| `request.expired`          | Caduca automáticamente al faltar 30 min para la salida                         | `requests/request-changes.ts`         |
| `request.boarded`          | El conductor valida la subida del pasajero con el código de 4 cifras           | `requests/requests.service.ts`        |
| `incident.reported`        | Se registra una incidencia (sin su descripción)                                | `incidents/incidents.service.ts`      |
| `incident.reviewed`        | Un administrador la revisa (sin la resolución)                                 | `incidents/incidents.service.ts`      |
| `coverage.gap_reported`    | Una búsqueda cae fuera de la zona de servicio                                  | `places/places.service.ts`            |
| `review.created`           | Se escribe una reseña                                                          | `reputation/reputation.service.ts`    |
| `review.published`         | Se publica (doble ciego)                                                       | `reputation/reputation.service.ts`    |
| `simulation.requested`     | Un administrador lanza una simulación                                          | `simulation/simulations.service.ts`   |
| `simulation.finished`      | Termina con sus resultados                                                     | `simulation/simulations.service.ts`   |
| `simulation.failed`        | Falla                                                                          | `simulation/simulations.service.ts`   |
| `simulation.cancelled`     | Se cancela                                                                     | `simulation/simulations.service.ts`   |
| `catalog.item_created`     | Un administrador da de alta un elemento de un catálogo (p. ej. una marca)      | `catalogs/catalog-items.service.ts`   |
| `catalog.item_updated`     | Cambia su nombre, su orden o lo vuelve a activar                               | `catalogs/catalog-items.service.ts`   |
| `catalog.item_deactivated` | Lo desactiva (deja de ofrecerse; no se borra)                                  | `catalogs/catalog-items.service.ts`   |
| `legal_document.published` | Un administrador publica una versión nueva de las condiciones o de la política | `users/legal-documents.service.ts`    |

Las rutas son relativas a `backend/src/modules/`. Un test (`events-contract.spec.ts`) comprueba que todo tipo de `domain-event-type.ts` tiene versión y aparece en esta tabla.

### Cambios de versión

- `trip.finished` **v2**: el `payload` añade `finishedAt` y `finishDistanceM` (metros entre el conductor y el destino al terminar, calculados con PostGIS con la posición que envía la app; `null` si no la envió). La v1 llevaba el mismo estado del viaje sin esos dos campos.
- `legal_document.published` **v2**: el `payload` añade `changeType` (`major` o `minor`) y `summary` («Qué ha cambiado», el texto que escribe quien publica; no tiene datos personales). La v1 llevaba `type`, `version`, `publishedAt` y `adminId`.
