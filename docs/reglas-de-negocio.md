# Reglas de negocio

Todas las reglas que aplica la plataforma, con su valor y dónde viven en el código. El valor manda el código: si cambia una constante, se actualiza esta tabla en el mismo PR.

Las horas son de Madrid. «Salida» es la hora a la que sale el conductor (`trips.departure_at`).

## 1. Publicar un viaje (conductor)

| Regla                                                                                                                                                            | Valor               | Código                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| El conductor debe estar listo (RF-21): declaración responsable aceptada y un vehículo activo con su declaración al día                                           | —                   | `UsersService.getDriverReadiness`                                       |
| Las declaraciones (conductor y vehículo) se renuevan cada año                                                                                                    | 12 meses            | `DECLARATION_VALIDITY_MONTHS` (`users/consents.service.ts`)             |
| Antelación mínima para publicar o mover la salida                                                                                                                | 60 min              | `MIN_DEPARTURE_LEAD_MIN` (`trips/trip-timing.ts`)                       |
| La hora se da como salida o, hacia el campus, como llegada «como muy tarde»: salida = llegada − duración de la ruta (OSRM) − desvío máximo                       | —                   | `departureForArrival` (`trips/trip-timing.ts`)                          |
| Un viaje no puede solaparse con otro activo del conductor (de su salida a su llegada más el desvío máximo)                                                       | —                   | `PublishingLimitsService` (`TRIP_OVERLAPS`)                             |
| Viajes no cancelados por conductor y día                                                                                                                         | 4                   | `MAX_TRIPS_PER_DAY`                                                     |
| Plazas ofrecidas: de 1 a la capacidad del vehículo (máximo 8)                                                                                                    | 1–8                 | `PublishTripDto`, `SEATS_EXCEED_CAPACITY`                               |
| Desvío máximo del viaje (por defecto 10): es un presupuesto **total**, con los desvíos y las paradas de todos los pasajeros aceptados                            | 0–60 min            | `PublishTripDto.maxDetourMin`, `DEFAULT_MAX_DETOUR_MIN`                 |
| Cómo recoge: en ruta (se aparta de su camino hasta los metros elegidos) o en puntos (en sus paradas, solo hacia el campus); no se cambia después                 | `on_route`, `stops` | `Trip.pickupMode`, `InvalidStopsError`                                  |
| Metros que se aparta de su ruta para recoger (por defecto 300)                                                                                                   | 150, 300 o 500 m    | `ALLOWED_MAX_DETOUR_M`, `DEFAULT_MAX_DETOUR_M` (`trips/trip-timing.ts`) |
| En puntos: de 1 a 5 paradas, ordenadas solas a lo largo de la ruta; la ruta pasa por todas y su desvío (ruta por las paradas − directa) cabe en el desvío máximo | 1–5                 | `MAX_TRIP_STOPS`, `TripStopsService`, `STOPS_EXCEED_DETOUR`             |
| Un viaje con paradas no se mueve (origen o destino) ni lleva metros: se cancela y se vuelve a publicar; el desvío nuevo tiene que cubrir el que ya se gasta      | —                   | `TripStopsService.assertChangesFit`                                     |
| Vehículos activos a la vez por conductor                                                                                                                         | 3                   | `MAX_VEHICLES_PER_DRIVER`                                               |
| Suspensión de publicar tras cancelaciones tardías (ver §5)                                                                                                       | 7 días              | `PUBLISHING_SUSPENSION_DAYS`                                            |

## 2. Buscar y pedir plaza (pasajero)

| Regla                                                                                                                                                                                                                                          | Valor              | Código                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| Margen horario de la búsqueda (por defecto 20)                                                                                                                                                                                                 | 0–60 min           | `SearchTripsDto`, `DEFAULT_MARGIN_MIN`                                    |
| Al ir al campus se compara la llegada; la salida puede ser hasta 2 h antes                                                                                                                                                                     | 120 min            | `MAX_TRAVEL_MIN` (`matching/matching.service.ts`)                         |
| Al ir al campus, la ruta del conductor pasa a menos de los metros que eligió de la dirección del pasajero; al volver, a menos de 800 m                                                                                                         | 300–1000 m / 800 m | `Trip.maxDetourM`, `PICKUP_RADIUS_M` (`trips/trip-candidates.service.ts`) |
| Su extremo del campus, a menos de 1 km del parking elegido                                                                                                                                                                                     | 1 km               | `CAMPUS_RADIUS_M`                                                         |
| Candidatos a los que se calcula el desvío con OSRM                                                                                                                                                                                             | 10                 | `MAX_CANDIDATES`                                                          |
| Al ir al campus, el desvío de **todo el viaje** con las recogidas ya aceptadas y la del pasajero (ruta OSRM por todas, en orden) más 2 min por parada cabe en el desvío máximo                                                                 | 2 min/parada       | `STOP_TIME_MIN`, `trips/pickup-plan.ts`, `matching/compatibility.ts`      |
| Una recogida en la misma salida del conductor (a menos de 50 m) no es una parada                                                                                                                                                               | 50 m               | `stopCount` (`trips/pickup-plan.ts`)                                      |
| En un viaje con paradas, el pasajero las encuentra si una está a menos de 800 m de su dirección (la más cercana) y pide plaza en ella (`stopId`, obligatorio); la ruta no cambia                                                               | 800 m              | `WALK_RADIUS_M`, `STOP_REQUIRED`, `STOP_NOT_IN_TRIP`                      |
| En un viaje con paradas, recoger a alguien solo gasta los 2 min de su parada si aún no sube nadie en ella; la hora de cada parada suma los 2 min de las anteriores con alguien                                                                 | 2 min/parada       | `planStopPickups` (`trips/stop-pickups.ts`)                               |
| La búsqueda y la solicitud dan la hora estimada de recogida, contando las recogidas anteriores y sus paradas                                                                                                                                   | —                  | `TripMatchResource.pickupAt`, `RequestPickupsService.estimatePickupAt`    |
| Al aceptar, se vuelve a comprobar el presupuesto con las recogidas de ese momento y se recalculan la ruta y la hora de recogida de todos; si ya no cabe, `DETOUR_BUDGET_EXCEEDED`, y si otra plaza cambió mientras tanto, `TRIP_CHANGED_RETRY` | —                  | `TripPickupsService.apply`                                                |
| Al cancelar una plaza antes del viaje se quita su recogida y se recalculan las horas de los demás con la ruta estimada (se vuelve a pedir a OSRM después)                                                                                      | —                  | `TripPickupsService.remove`                                               |
| Al volver del campus todos suben en el parking: sin recogidas por pasajero (las bajadas llegarán con el «modo retorno»)                                                                                                                        | —                  | `RequestPickupsService`                                                   |
| Plazas por solicitud                                                                                                                                                                                                                           | 1–4                | `MAX_REQUESTED_SEATS`                                                     |
| Solicitudes pendientes a la vez en viajes que se solapan                                                                                                                                                                                       | 3                  | `MAX_OVERLAPPING_PENDING_REQUESTS` (`TOO_MANY_PENDING_REQUESTS`)          |
| Los pasajeros con prioridad (perfil `hasHighPriority`) salen primero en las solicitudes del conductor                                                                                                                                          | —                  | `RequestStatsService`                                                     |
| Suspensión de pedir plaza tras cancelaciones tardías (ver §5)                                                                                                                                                                                  | 7 días             | `PUBLISHING_SUSPENSION_DAYS`                                              |
| Los viajes en que el pasajero ya tiene una solicitud activa no se repiten en los resultados (frontend)                                                                                                                                         | —                  | `SearchResultsPage.trips`                                                 |

## 3. Antes de la salida

| Momento                                   | Qué pasa                                                                                                                                          | Código                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **30 min antes**                          | Con solicitudes por responder, aviso al conductor (y push): «Tienes solicitudes por responder» (una vez por viaje)                                | `PENDING_REQUESTS_REMINDER_MIN`, `RequestLifecycleScheduler` |
| Hasta 10 min antes                        | Se puede pedir plaza y el conductor puede aceptar o rechazar                                                                                      | `REQUEST_CUTOFF_MIN`                                         |
| **10 min antes (corte)**                  | El viaje deja de salir en la búsqueda, no admite solicitudes ni respuestas, y las pendientes **caducan**                                          | `REQUEST_CUTOFF_MIN`, `RequestLifecycleScheduler`            |
| **10 min antes, sin pasajeros aceptados** | El viaje se cierra como **«Sin pasajeros»** (`expired`), que no es una cancelación ni cuenta para la suspensión, y se avisa al conductor (y push) | `TripExpiryService`, evento `trip.expired`                   |
| Desde 10 min antes                        | El conductor puede iniciar el viaje (con pasajeros aceptados)                                                                                     | `START_WINDOW_MIN`                                           |
| Desde 10 min antes                        | El pasajero con plaza ve su código de recogida (o en cuanto el conductor inicia), para tenerlo aunque al subir no haya conexión (frontend)        | `BOARD_CODE_LEAD_MS` (`PassengerRequestDetailPage`)          |
| **A la hora de salida**                   | Con pasajeros y sin iniciar, recordatorio al conductor (y push): «Es la hora de tu viaje: inícialo» (una vez)                                     | `TripRemindersService`                                       |
| **10 min después**                        | Un viaje no iniciado (publicado o confirmado) se **cancela** solo; si estaba confirmado, cuenta como cancelación tardía del conductor             | `UNSTARTED_TRIP_CANCEL_WINDOW_MIN`, `TripLifecycleScheduler` |

## 4. Durante el viaje

| Regla                                                                                                                         | Valor | Código                                                   |
| ----------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------- |
| El pasajero sube con el código de recogida que le muestra la app                                                              | —     | `INVALID_BOARD_CODE`                                     |
| Espera en el punto de recogida antes de poder marcar «No se presentó»                                                         | 5 min | `PICKUP_NO_SHOW_WAIT_MIN` (`PICKUP_GRACE_PERIOD_ACTIVE`) |
| La ubicación del conductor se comparte con sus pasajeros aceptados mientras dura el viaje y se borra al terminar o cancelarlo | —     | `tracking/trip-positions.service.ts`                     |
| Con el viaje en curso, conductor y pasajeros escriben en el chat; al conductor la app le sugiere las respuestas rápidas       | —     | `chat/chat-rules.ts`, `ConversationPage.isDriverOnTrip`  |
| «Terminar viaje» avisa (sin impedirlo) si el conductor está a más de 300 m del destino                                        | 300 m | `FINISH_GEOFENCE_METERS` (`trips/finish-trip.util.ts`)   |
| En la ida al campus, la etapa «Llegada» pasa a ser la actual a menos de 300 m del destino (frontend)                          | 300 m | `ARRIVING_METERS` (`trips/live-trip-hero.util.ts`)       |

## 5. Cancelaciones

| Regla                                                                                                | Valor                 | Código                                                                                         |
| ---------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| Cancelar con la plaza aceptada a menos de 30 min de la salida es tardío (conductor o pasajero)       | 30 min                | `LATE_CANCELLATION_LEAD_MIN`                                                                   |
| Con 3 cancelaciones tardías en 30 días, 7 días sin publicar (conductor) o sin pedir plaza (pasajero) | 3 en 30 días → 7 días | `LATE_CANCELLATIONS_TO_SUSPEND`, `LATE_CANCELLATION_WINDOW_DAYS`, `PUBLISHING_SUSPENSION_DAYS` |
| Al cancelar el viaje se cancelan sus solicitudes (pendientes y aceptadas)                            | —                     | `requests/trip-changes.listener.ts`                                                            |
| Con el viaje iniciado, cancelar exige una incidencia (RF-23)                                         | —                     | `TripsService.cancel`                                                                          |

## 6. Después del viaje

| Regla                                                                                                                    | Valor   | Código                                             |
| ------------------------------------------------------------------------------------------------------------------------ | ------- | -------------------------------------------------- |
| El chat admite mensajes hasta 24 h después de terminar; luego, solo lectura                                              | 24 h    | `CHAT_OPEN_AFTER_FINISH_MS` (`chat/chat-rules.ts`) |
| Los mensajes de un viaje terminado o cancelado se borran a los 30 días                                                   | 30 días | `CHAT_RETENTION_MS`                                |
| Las reseñas se escriben hasta 7 días después; son de doble ciego: se publican cuando valoran los dos o al pasar el plazo | 7 días  | `REVIEW_WINDOW_DAYS`                               |
| La media de valoración se muestra desde 3 reseñas; antes, «Nuevo conductor» o «Nuevo pasajero»                           | 3       | `MIN_RATINGS_FOR_AVERAGE`                          |
| La app valora con 👍 «Buen viaje» (se guarda 5) o 👎 «Mejorable» (se guarda 1); una valoración no se edita               | 5 / 1   | `THUMB_UP_RATING`, `THUMB_DOWN_RATING`             |

## 7. Privacidad de la ubicación

| Regla                                                                                                                                                                                                                | Código                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Quien no tiene plaza en el viaje ve el origen y el destino redondeados a una cuadrícula de unos 500 m, sin el trazado de la ruta                                                                                     | `approximatePoint` (`trips/trip-location-privacy.ts`), `TripViewerAccessService` |
| …y el nombre sin el número de portal («Calle Profesor Mulian, 29» → «Calle Profesor Mulian»)                                                                                                                         | `withoutStreetNumber`                                                            |
| Los parkings del campus van siempre exactos (a menos de 75 m de uno)                                                                                                                                                 | `CAMPUS_PARKING_RADIUS_METERS`                                                   |
| Ven los datos exactos el conductor y los pasajeros aceptados. Ser administrador no cuenta en la app: los datos exactos, en el panel                                                                                  | `TripViewerAccessService.canSeeExactLocation`                                    |
| «Usar mi ubicación» (rellenar direcciones, volver a casa, verte en el mapa del viaje) es un consentimiento que se retira en Perfil; la del conductor con el viaje en curso no depende de él (ejecución del servicio) | `LocationService`, `LocationConsentService`                                      |
| La posición del pasajero durante el viaje solo se muestra en su móvil: no se envía al servidor                                                                                                                       | `LocationService`                                                                |

## 8. Cuentas y acceso

| Regla                                                                            | Valor           | Código                                                               |
| -------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------- |
| Solo correos de la UAL (`ual.es`, `inlumine.ual.es`)                             | —               | `ALLOWED_EMAIL_DOMAINS` (variable de entorno)                        |
| Un registro pendiente caduca a las 24 h                                          | 24 h            | `PENDING_REGISTRATION_TTL_HOURS`                                     |
| El código del correo caduca a los 15 min, admite 3 fallos y se reenvía cada 60 s | 15 min, 3, 60 s | `CODE_TTL_MINUTES`, `MAX_FAILED_ATTEMPTS`, `RESEND_COOLDOWN_SECONDS` |
| Tras 5 fallos seguidos de login con el mismo correo, 5 min bloqueado             | 5 → 5 min       | `MAX_FAILED_LOGINS`, `LOCK_MINUTES` (`TOO_MANY_LOGIN_ATTEMPTS`)      |
| Los intentos de login sin fallos se borran a las 24 h                            | 24 h            | `RETENTION_HOURS` (`auth/login-attempts.service.ts`)                 |
| Mensajes de chat por minuto y usuario                                            | 20              | `CHAT_MAX_MESSAGES_PER_MINUTE`                                       |

## 9. Limitaciones conocidas (por decidir)

- **Hora de recogida en pantalla:** el backend ya la calcula con las recogidas anteriores y sus paradas (decidido con el director el 12/11/2026), pero las pantallas aún no la muestran (llega con el cambio de pantallas de publicar y pedir plaza); en el viaje en curso se muestran los minutos con la posición real del coche.
- **Paradas en pantalla y bajadas en la vuelta:** el backend ya admite la recogida en puntos, pero las pantallas de publicar y pedir plaza aún no la ofrecen; dónde se baja cada pasajero al volver llega con el «modo retorno» (`docs/diseno-modos-recogida-y-vuelta.md`).
- **Viaje en curso que nadie termina:** sigue `in_progress` sin límite si el conductor no pulsa «Terminar viaje». Propuesta: recordatorio a la hora estimada de llegada y cierre automático pasado un plazo.
- **CO₂ ahorrado:** estimación de ejemplo en el frontend (`matching/trip-impact.ts`: línea recta por un factor y 0,12 kg/km). Por mejorar con la ruta real y calcularlo en el backend o el Gemelo Digital.
- **Valoración con manitas:** RF-22 habla de 1 a 5 estrellas; decidir si se cambia el modelo.
