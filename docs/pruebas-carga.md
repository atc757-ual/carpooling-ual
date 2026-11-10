# Pruebas de carga (RNF-01 y RNF-07)

Medición de los dos requisitos de rendimiento con la carga de RNF-01, con [k6](https://grafana.com/docs/k6/) desde su imagen Docker (`grafana/k6:2.3.0`, sin dependencias npm). El guion es [`scripts/load/search-load.js`](../scripts/load/search-load.js) y los datos, [`scripts/load/load-data.sql`](../scripts/load/load-data.sql).

## Qué se mide

| Requisito  | Carga                                                                                                                                        | Criterio (umbral de k6)                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **RNF-01** | 50 usuarios virtuales buscan viaje al campus (`POST /api/trips/search`) durante 5 min, cada uno con su cuenta y 1 s de pausa entre búsquedas | p95 < 2 s y menos de un 1 % de errores                                                                                                        |
| **RNF-07** | A la vez, 10 conductores cambian de modo cada 2 s (unos 5 eventos/s) para que el Gemelo Digital tenga eventos que sincronizar                | p95 del retraso evento → gemelo ≤ 1 s: se lee `lag.p95Ms` de `GET /api/admin/digital-twin` cada 10 s y ninguna lectura puede pasar de 1000 ms |

La búsqueda filtra los candidatos con PostGIS y los ordena con la puntuación pura del matching; no llama a OSRM.

## Datos

Sobre el seed de desarrollo, `load-data.sql` añade con una semilla fija (`setseed(0.42)`, repetible):

- **120 conductores**, cada uno con un vehículo y **un viaje publicado** para mañana entre las 07:30 y las 09:30 hacia el Parking P1, desde un punto al azar de la zona de Almería (unos 30 km alrededor). En total, 121 viajes publicados.
- **50 pasajeros**, uno por usuario virtual.

Cada búsqueda parte de un punto al azar de esa misma zona, hacia las 08:30.

## Cómo repetirla

En una base de datos **propia para la prueba** (nunca la de desarrollo ni la de producción):

    cd backend
    npm run migrate && npm run seed
    psql "$DATABASE_URL" -f ../scripts/load/load-data.sql
    npm run build && npm run start:prod

Y en otra consola, desde la raíz del repositorio (en Windows con Git Bash, anteponer `MSYS_NO_PATHCONV=1` y usar `$(pwd -W)`):

    docker run --rm -v "$(pwd)/scripts/load:/scripts:ro" \
      -e BASE_URL=http://host.docker.internal:3000/api \
      grafana/k6:2.3.0 run /scripts/search-load.js

`DURATION` (por defecto `5m`) y `VUS` (por defecto `50`) se cambian con `-e`. k6 termina con error si no se cumple algún umbral. Con el perfil `observabilidad` de `docker compose` (`docs/despliegue.md`, sección 8) y `LOG_FORMAT=json`, el panel «API del backend» de Grafana muestra la prueba en directo.

## Resultados (10/11/2026)

**Entorno:** un portátil con Windows 11, Intel Core Ultra 7 155H y 32 GB de RAM; backend compilado (`npm run start:prod`, Node.js 26) y PostgreSQL 18 + PostGIS 3.6 en Docker Desktop, en la misma máquina que k6. Es un entorno de desarrollo, no el servidor final.

| Medida                                           | Resultado                                     | Criterio  | ¿Cumple? |
| ------------------------------------------------ | --------------------------------------------- | --------- | -------- |
| Búsquedas                                        | 14 301 en 5 min (unas 48/s)                   | —         | —        |
| p95 de la búsqueda                               | **118,7 ms** (mediana 36,1 ms, máximo 912 ms) | < 2000 ms | **Sí**   |
| Errores en la búsqueda                           | **0 %**                                       | < 1 %     | **Sí**   |
| Retraso del gemelo, p95 (máximo de las lecturas) | **349 ms** (lecturas entre 283 y 349 ms)      | ≤ 1000 ms | **Sí**   |
| Comprobaciones de k6                             | 15 732 de 15 732 correctas                    | —         | —        |

Se generaron unos 1 230 eventos durante la prueba.

**Una medición descartada:** la primera pasada corta (30 s) dio un retraso del gemelo de unos 1,9 s, pero respondía un backend antiguo que seguía en marcha en el mismo puerto, de otra prueba y con una base de datos en otro estado. Un valor tan cercano a los 2 s que el consumidor espera ante un hueco en la secuencia apunta a eso; no se investigó más. Con el backend de la prueba, una pasada corta dio 0,39 s sin huecos en la secuencia, y la de 5 min, la de la tabla.

## Limitaciones

- **Una sola máquina:** k6, el backend y la base de datos comparten CPU; en el servidor real, con k6 fuera, los tiempos serían iguales o mejores, pero hay que repetir la prueba allí antes de darla por definitiva.
- **Carga sintética:** las búsquedas y los cambios de modo son una aproximación del uso real; los eventos de la prueba son de un solo tipo (`user.active_mode_changed`).
- **121 viajes publicados:** el tamaño del seed de carga; con muchos más viajes, la búsqueda depende de los índices de PostGIS (repetirla con más datos si el director lo pide).
- **El retraso p95 del gemelo** es el que calcula el propio backend sobre los últimos 500 eventos; k6 lo lee cada 10 s.
