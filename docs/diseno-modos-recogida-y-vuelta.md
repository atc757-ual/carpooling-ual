# Diseño: modos de recogida, tiempo con varios pasajeros e ida y vuelta

> Estado: propuesta para aprobar (13/11/2026). Decisiones de la reunión con el director del 12/11/2026 y del autor el 13/11/2026.

## 1. Por qué

- **Tiempo con varios pasajeros (decidido con el director el 12/11):** hoy la duración, la llegada y la hora de recogida son las del trayecto sin recogidas, y el desvío máximo se compara por pasajero. Con tres pasajeros, el conductor puede desviarse el triple de lo que aceptó y llegar tarde. Además, la simulación usa el mismo criterio, así que hay que corregirlo **antes de calibrar** los escenarios (DP-06).
- **Modos de recogida (propuesto por el director):** el conductor elige cómo recoge. **En ruta:** se aparta un poco de su camino (p. ej. hasta 500 m) para recoger a cada pasajero donde este pida. **En puntos:** marca unos puntos que están en su ruta (Av. del Mediterráneo, Av. Cabo de Gata…) y el pasajero va andando hasta uno. Así el pasajero sabe de antemano si le recogen en su punto o si tiene que ir él.
- **Ida y vuelta (propuesto por el autor):** ahorrar tiempo al conductor. En un solo flujo de publicación deja registrados los dos tramos; después cada uno funciona por su cuenta.

## 2. Objetivos, lo que no se hace y lo que sería un fallo

**Objetivos**

- El desvío máximo es un **presupuesto total** del viaje: la suma de los desvíos y de las paradas de todos los pasajeros aceptados cabe en él.
- Cada recogida suma un **tiempo por parada** fijo.
- La **llegada** y la **hora de recogida** de cada pasajero incluyen las recogidas anteriores (ruta OSRM por todas las paradas).
- El conductor elige un **modo de recogida excluyente**: en ruta (con los metros que se aparta) o en puntos (con sus paradas).
- El conductor puede publicar **la ida y la vuelta** en un solo flujo, con hora de salida y plazas propias para la vuelta.

**No se hace aquí**

- Dónde se **baja** cada pasajero en la vuelta y el cierre del viaje por pasajero (pendiente del «modo retorno»). En la vuelta todos suben en el parking del campus.
- Paradas guardadas del conductor para reutilizarlas (opción C del análisis; se puede añadir encima de este modelo).
- Combinar los dos modos en un mismo viaje (decidido: son excluyentes).
- Enlazar la ida y la vuelta: tras publicarse son dos viajes independientes (solicitudes, cancelación y chat propios).

**Sería un fallo aunque funcione**

- Que un conductor acepte pasajeros y llegue más tarde de lo que dijo («como muy tarde» de publicar por llegada, #284).
- Que el pasajero no sepa si debe ir a un punto o si le recogen en el suyo.
- Que la búsqueda deje de responder en menos de 2 s (RNF-01).
- Que quede publicada la ida sin la vuelta (o al revés) por un error a mitad.

## 3. Enfoques considerados

| Enfoque                                                                                          | Ventajas                                                                                                                                              | Inconvenientes                                                                                                          |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **A. Tabla de paradas por viaje** (`trip_stops`) y la solicitud apunta a su parada **(elegido)** | Búsqueda espacial directa con PostGIS; la hora de cada parada sale de la ruta OSRM; integridad con clave ajena; limpio para la simulación y el gemelo | Una tabla y una migración nuevas                                                                                        |
| B. Paradas como lista JSON en el viaje                                                           | Rápido de hacer                                                                                                                                       | Búsquedas espaciales torpes; la solicitud no puede apuntar a la parada; choca con las reglas de integridad del proyecto |
| C. Paradas favoritas del conductor, además de A                                                  | Ahorra tiempo al que repite trayecto                                                                                                                  | Más trabajo; se puede añadir después sin rehacer A                                                                      |

El autor eligió **A** el 13/11/2026.

## 4. Diseño

### 4.1 Modelo de datos (migración)

**`trips`**

- `pickup_mode` (enum `trip_pickup_mode`: `on_route`, `stops`), por defecto `on_route` (los viajes que ya existen siguen igual).
- `max_detour_m` (entero, nulo en modo `stops`): cuánto se aparta el conductor de su ruta en modo en ruta. Valores permitidos: **150, 300 o 500 m**; por defecto 300 (el 14/11 se quitó 1 km: es demasiado para recoger en un punto).
- `max_detour_min` se mantiene, pero pasa a ser el **presupuesto total** del viaje (antes, por pasajero).

**`trip_stops`** (nueva, del módulo `trips`)

- `id`, `trip_id` (FK, borrado en cascada), `position` (orden en la ruta, único por viaje), `name` (varchar 160), `location` (geography Point), `eta_offset_min` (minutos desde la salida hasta la parada, calculados con la ruta OSRM).
- Entre **1 y 5 paradas** (`MAX_TRIP_STOPS = 5`) en modo `stops`; ninguna en modo `on_route`.
- Índice espacial en `location`.

**`seat_requests`**

- `stop_id` (FK a `trip_stops`, nulo): la parada elegida en modo `stops`. En ese caso, `pickup_location` y `pickup_name` copian los de la parada (lo demás del sistema sigue leyendo `pickup_location`).

**Constantes compartidas (backend, `trips/trip-timing.ts`)**

- `STOP_TIME_MIN = 2`: tiempo de cada parada con alguien que sube.
- `MAX_TRIP_STOPS = 5`.
- `ALLOWED_MAX_DETOUR_M = [150, 300, 500]`.
- `WALK_RADIUS_M = 800`: distancia máxima a pie hasta una parada (la misma que el `PICKUP_RADIUS_M` actual).

### 4.2 Publicar un viaje

- **En ruta:** el conductor elige los metros (150, 300 o 500) y su presupuesto de minutos (como hoy).
- **En puntos:** el conductor añade entre 1 y 5 paradas con el buscador de direcciones (CartoCiudad, como el origen y el destino). Al publicar, el backend:
  1. ordena las paradas por su posición a lo largo de la ruta directa (`ST_LineLocatePoint`);
  2. pide a OSRM la ruta que pasa por todas ellas y guarda su geometría y duración (`trip_routes`) y la hora estimada de cada parada (`eta_offset_min`);
  3. comprueba que el desvío de pasar por las paradas (ruta por las paradas − ruta directa) cabe en el presupuesto; si no, `400 STOPS_EXCEED_DETOUR`.
- **Publicar por llegada (#284):** salida = llegada − duración de la ruta (en puntos, la que pasa por las paradas) − presupuesto de desvío. Así la llegada «como muy tarde» se cumple siempre.
- Las paradas son lugares públicos que elige el conductor: se muestran exactas a todos (a diferencia del origen, que se redondea para quien no tiene plaza).

### 4.3 Buscar viaje y pedir plaza

**Modo en ruta**

- Candidato si el punto del pasajero está a menos de `max_detour_m` de la ruta del viaje (hoy es un radio fijo de 800 m para todos).
- Desvío del pasajero = duración de la ruta por todas las recogidas aceptadas más la suya, en orden a lo largo de la ruta − duración de la ruta actual + `STOP_TIME_MIN`.
- Encaja si el desvío acumulado del viaje (aceptados + este) cabe en `max_detour_min`.
- El resultado da la **hora estimada de recogida** (salida + tramo hasta su punto, contando las recogidas anteriores).

**Modo en puntos**

- Candidato si alguna parada está a menos de `WALK_RADIUS_M` del punto del pasajero.
- El resultado da la parada más cercana (nombre, punto, distancia a pie y hora estimada). El desvío es solo el tiempo de parada (`STOP_TIME_MIN`) si aún no sube nadie en esa parada.
- La puntuación (`compatibility.ts`) sigue con el 60 % desvío y el 40 % hora; en modo en puntos, el «desvío» es el tiempo de parada.
- Al pedir plaza, el pasajero manda `stopId` (obligatorio en este modo); en modo en ruta, su punto, como hoy.

**Rendimiento (RNF-01):** como hoy, una ruta OSRM por candidato (`MAX_CANDIDATES = 10`). En modo en puntos no hace falta OSRM al buscar (las horas de las paradas ya están guardadas).

### 4.4 Aceptar una solicitud

- Con el viaje bloqueado (`FOR UPDATE`, primero el viaje y luego la solicitud), se vuelve a comprobar el presupuesto con los aceptados de ese momento; si ya no cabe, `409 DETOUR_BUDGET_EXCEEDED`.
- En modo en ruta se recalcula la ruta por todas las recogidas aceptadas y se guarda (`trip_routes`), y con ella la hora de recogida de **cada** pasajero aceptado (`seat_requests.pickup_at`) y la llegada estimada.
- En modo en puntos la ruta no cambia; la hora de recogida es la de su parada (+ el tiempo de las paradas anteriores con pasajeros).
- El módulo `requests` no toca las tablas de `trips`: `trips` expone un método que recibe el `manager` (como `TripsService.lockTrip`) y devuelve la ruta y las horas.

### 4.5 La vuelta (from-campus)

- Los viajes de vuelta salen del parking del campus: todos suben allí. El modo de recogida y las paradas **solo se aplican a la ida**; en la vuelta se guarda `on_route` y el pasajero indica, como hoy, el punto cerca de la ruta donde quiere bajar (el «modo retorno» lo concretará).

### 4.6 Ida y vuelta en un solo flujo (PR 4)

- En el paso de la hora, una casilla «Publicar también la vuelta» con la **hora de salida** de la vuelta y sus **plazas** (rellenas con las de la ida y modificables).
- La vuelta es otro viaje: origen y destino al revés (el parking del campus como origen), mismo vehículo y declaración.
- El backend recibe los dos tramos en **una sola petición** y los crea en **la misma transacción**: pasan los dos las reglas (no solaparse, máximo 4 viajes al día) o no se publica ninguno, con el error que diga qué tramo falla.
- Después son independientes. En el resumen y en Tus viajes se ven los dos.

### 4.7 API (TMF630; OpenAPI y `docs/api/errors.md` en el mismo PR)

- `POST /trips` gana `pickupMode`, `maxDetourM` y `stops` (`[{ name, location }]`). En el PR 4, un campo opcional `returnTrip` (`{ departureAt, offeredSeats }`); la respuesta `201` es la ida con el `id` y el `href` de la vuelta.
- El recurso del viaje gana `pickupMode`, `maxDetourM`, `stops` (`[{ id, position, name, location, estimatedAt }]`) y `estimatedArrivalAt`.
- Los resultados de búsqueda ganan `pickupAt` (hora estimada) y, en modo en puntos, `stop` (`{ id, name, location, walkingDistanceM }`).
- `POST /trips/:id/requests` acepta `stopId`.
- Códigos de error nuevos: `STOPS_EXCEED_DETOUR`, `INVALID_STOPS` (número, orden o ninguna en modo en ruta), `STOP_REQUIRED`, `STOP_NOT_IN_TRIP`, `DETOUR_BUDGET_EXCEEDED`, `RETURN_TRIP_REJECTED` (con el motivo del tramo de vuelta).

### 4.8 Eventos y Gemelo Digital

- El `payload` de `trip.published` y de los cambios del viaje lleva `pickupMode`, `maxDetourM` y las paradas (estado completo).
- `request.accepted` lleva `stopId` y `pickupAt`.
- Sin eventos nuevos.

### 4.9 Simulación

- El motor (`simulation/engine/ride-matcher.ts`) aplica las mismas reglas: presupuesto total y `STOP_TIME_MIN`. Los modos de recogida y la vuelta entran como parámetros de escenario en el PR de calibración, no aquí.

## 5. Reparto en PR (cada uno en su rama, probado)

1. **PR 1 · backend, presupuesto y modo en ruta:** migración (`pickup_mode`, `max_detour_m`, recogidas del viaje), presupuesto total, tiempo por parada, ruta por las recogidas, hora de recogida y llegada, búsqueda con los metros del conductor, eventos, simulación (presupuesto y parada), OpenAPI, errores y `docs/reglas-de-negocio.md`. Incluye este documento.
   1b. **PR 2 · backend, modo en puntos:** `trip_stops`, publicar con paradas, buscar y pedir plaza con `stopId`.
2. **PR 3 · frontend:** publicar (paso «Cómo recoges»: en ruta con los metros o en puntos con las paradas en el mapa), detalle del viaje con el modo y las paradas, buscar y pedir plaza (parada elegida o punto propio, hora estimada), detalle del conductor con el punto o la parada de cada solicitud. Guía de estilos y Cypress en el mismo PR.
3. **PR 4 · ida y vuelta:** `returnTrip` en la API y la casilla en publicar.

## 6. Decisiones del constructor (revisables)

- Valores por defecto: 500 m, 2 min por parada, máximo 5 paradas, 800 m a pie.
- Las paradas se ordenan solas a lo largo de la ruta; el conductor no las reordena.
- En la vuelta no hay paradas (hasta el «modo retorno»).
- La vuelta toma el parking de destino de la ida como origen.

## 7. Documentación a actualizar

- `docs/reglas-de-negocio.md` (§1, §2, §3 y §9), `docs/api/openapi.json`, `docs/api/errors.md`, `CHANGELOG.md`.
- `pendientes-memoria.md`: modelo de datos (`trip_stops`, `pickup_mode`), casos de uso de publicar y pedir plaza, matching (presupuesto total), supuestos de la simulación y limitaciones.
