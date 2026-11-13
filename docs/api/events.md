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
- El consumidor es `DigitalTwinSyncService` (`modules/digital-twin/sync/`): al arrancar reproduce todo desde el principio y después lee cada 250 ms. Un hueco se da por perdido (p. ej. una transacción deshecha, que también gasta su número) cuando lleva 2 s abierto o cuando el evento de después tiene más de 2 s. Los tipos y versiones que lee están en `SUPPORTED_EVENT_VERSIONS` (`model/system-twin.ts`); un test falla si sube la versión de uno de ellos y el gemelo no la acepta.

## Tipos (en la versión 1 salvo donde se indica)

El `payload` de cada tipo lo construye el fichero indicado.

| Tipo                       | Cuándo                                                                                             | `payload` en                           |
| -------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `user.registered`          | Se crea la cuenta (tras verificar el correo)                                                       | `users/users.service.ts`               |
| `user.email_verified`      | Reservado: aún no se registra (el correo se verifica antes de crear la cuenta)                     | —                                      |
| `user.phone_verified`      | Verifica su teléfono con el código                                                                 | `users/users.service.ts`               |
| `user.deactivated`         | Elimina su cuenta                                                                                  | `users/users.service.ts`               |
| `user.profile_activated`   | Se activa un perfil (por el usuario o por un administrador)                                        | `users/user-profiles.service.ts`       |
| `user.profile_deactivated` | Un administrador desactiva un perfil                                                               | `users/user-profiles.service.ts`       |
| `user.updated`             | Cambia los datos de su cuenta                                                                      | `users/users.service.ts`               |
| `user.active_mode_changed` | Cambia el modo con el que viaja                                                                    | `users/user-profiles.service.ts`       |
| `consent.granted`          | Da un consentimiento (condiciones, privacidad, ubicación)                                          | `users/consents.service.ts`            |
| `consent.revoked`          | Lo retira                                                                                          | `users/consents.service.ts`            |
| `trip.published` (v3)      | Publica un viaje                                                                                   | `trips/trips.service.ts`               |
| `trip.updated` (v3)        | Cambia un viaje publicado                                                                          | `trips/trip-status.service.ts`         |
| `trip.confirmed` (v3)      | Se acepta la primera solicitud                                                                     | `trips/trip-status.service.ts`         |
| `trip.reopened` (v3)       | Vuelve a publicado al cancelarse todas las aceptadas                                               | `trips/trip-status.service.ts`         |
| `trip.started` (v4)        | Empieza el viaje                                                                                   | `trips/trip-status.service.ts`         |
| `trip.finished` (v4)       | Termina el viaje                                                                                   | `trips/trip-status.service.ts`         |
| `trip.cancelled` (v3)      | Se cancela el viaje                                                                                | `trips/trip-status.service.ts`         |
| `trip.expired` (v3)        | Llega el corte (10 min antes de la salida) sin pasajeros aceptados: se cierra como «Sin pasajeros» | `trips/trip-expiry.service.ts`         |
| `trip.cancelled_late`      | Cancelación tardía del conductor o de un pasajero (fiabilidad, S5)                                 | `trips/late-cancellations.service.ts`  |
| `late_cancellation.waived` | Un administrador perdona las cancelaciones tardías de un papel                                     | `trips/late-cancellations.service.ts`  |
| `trip.position_updated`    | Nueva posición del conductor durante el viaje (RF-12, RNF-07)                                      | `tracking/trip-positions.service.ts`   |
| `request.created` (v2)     | Un pasajero pide plaza                                                                             | `requests/request-changes.ts`          |
| `request.accepted` (v2)    | El conductor la acepta                                                                             | `requests/request-changes.ts`          |
| `request.rejected` (v2)    | La rechaza                                                                                         | `requests/request-changes.ts`          |
| `request.cancelled` (v2)   | Se cancela la solicitud                                                                            | `requests/request-changes.ts`          |
| `request.expired` (v2)     | Caduca automáticamente al faltar 30 min para la salida                                             | `requests/request-changes.ts`          |
| `request.boarded` (v3)     | El conductor valida la subida del pasajero con el código de 4 cifras                               | `requests/requests.service.ts`         |
| `chat_message.sent`        | Se envía un mensaje al chat del viaje (sin el texto: minimización)                                 | `chat/chat.service.ts`                 |
| `incident.reported`        | Se registra una incidencia (sin su descripción)                                                    | `incidents/incidents.service.ts`       |
| `incident.review_started`  | Un administrador empieza a revisarla                                                               | `incidents/incident-review.service.ts` |
| `incident.review_released` | Quien la revisa la deja: vuelve a registrada                                                       | `incidents/incident-review.service.ts` |
| `incident.reviewed`        | Quien la revisa la atiende: definitiva (sin la resolución)                                         | `incidents/incident-review.service.ts` |
| `coverage.gap_reported`    | Una búsqueda cae fuera de la zona de servicio                                                      | `places/places.service.ts`             |
| `review.created`           | Se escribe una reseña                                                                              | `reputation/reputation.service.ts`     |
| `review.published`         | Se publica (doble ciego)                                                                           | `reputation/reputation.service.ts`     |
| `simulation.requested`     | Un administrador lanza una simulación                                                              | `simulation/simulations.service.ts`    |
| `simulation.finished`      | Termina con sus resultados                                                                         | `simulation/simulations.service.ts`    |
| `simulation.failed`        | Falla                                                                                              | `simulation/simulations.service.ts`    |
| `simulation.cancelled`     | Se cancela                                                                                         | `simulation/simulations.service.ts`    |
| `catalog.item_created`     | Un administrador da de alta un elemento de un catálogo (p. ej. una marca)                          | `catalogs/catalog-items.service.ts`    |
| `catalog.item_updated`     | Cambia su nombre, su orden o lo vuelve a activar                                                   | `catalogs/catalog-items.service.ts`    |
| `catalog.item_deactivated` | Lo desactiva (deja de ofrecerse; no se borra)                                                      | `catalogs/catalog-items.service.ts`    |
| `legal_document.published` | Un administrador publica una versión nueva de las condiciones o de la política                     | `users/legal-documents.service.ts`     |

Las rutas son relativas a `backend/src/modules/`. Un test (`events-contract.spec.ts`) comprueba que todo tipo de `domain-event-type.ts` tiene versión y aparece en esta tabla.

### Cambios de versión

- `trip.published`, `trip.updated`, `trip.confirmed`, `trip.reopened`, `trip.cancelled` y `trip.expired` **v3**, y `trip.started` y `trip.finished` **v4**: el `payload` añade `stops`, las paradas del viaje con recogida en puntos (`id`, `position`, `name`, `location` y `etaOffsetMin`, los minutos desde la salida por la ruta sin el tiempo de las paradas anteriores); vacío en ruta. La versión anterior llevaba el mismo estado sin las paradas.
- `request.created`, `request.accepted`, `request.rejected`, `request.cancelled` y `request.expired` **v2**, y `request.boarded` **v3**: el `payload` añade `stopId`, la parada en la que sube el pasajero (`null` si no recoge en puntos). La versión anterior llevaba el mismo estado sin ese campo.
- `trip.published`, `trip.updated`, `trip.confirmed`, `trip.reopened`, `trip.cancelled` y `trip.expired` **v2**, y `trip.started` y `trip.finished` **v3**: el `payload` añade `pickupMode` (`on_route` o `stops`, cómo recoge el conductor) y `maxDetourM` (los metros que se aparta de su ruta en modo `on_route`; `null` con paradas). `maxDetourMin` pasa a ser el presupuesto total de desvío del viaje, no por pasajero. La versión anterior llevaba el mismo estado sin esos dos campos.

- `trip.started` **v2**: el `payload` añade `driverDeclarationVersion` y `vehicleDeclarationVersion` (las versiones de la declaración del conductor y de la del vehículo que confirma al iniciar, RF-21). La v1 llevaba el mismo estado del viaje sin esos dos campos.
- `request.boarded` **v2**: el `payload` lleva el estado completo de la solicitud, como el resto de eventos de la solicitud (`status`, `seats`, `isPriority`…, además de `requestId`). La v1 solo llevaba `tripId`, `requestId`, `passengerId` y `boardedAt`, y el gemelo, sin el estado, no contaba al pasajero a bordo; ahora conserva el estado anterior de la solicitud cuando un evento no lo trae.
- `trip.finished` **v2**: el `payload` añade `finishedAt` y `finishDistanceM` (metros entre el conductor y el destino al terminar, calculados con PostGIS con la posición que envía la app; `null` si no la envió). La v1 llevaba el mismo estado del viaje sin esos dos campos.
- `consent.granted` y `consent.revoked` **v2**: el `payload` añade `vehicleId` (el vehículo de una declaración de vehículo, `vehicle_declaration`; `null` en los demás). La v1 llevaba `consentId`, `type`, `documentVersion`, `source` y `fingerprint`.
- `legal_document.published` **v2**: el `payload` añade `changeType` (`major` o `minor`) y `summary` («Qué ha cambiado», el texto que escribe quien publica; no tiene datos personales). La v1 llevaba `type`, `version`, `publishedAt` y `adminId`.
