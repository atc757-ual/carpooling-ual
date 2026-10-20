# Base de datos

PostgreSQL 18 + PostGIS 3.6 en Docker (`carpooling-db`).

- `schema.sql`: esquema provisional, traducido del modelo entidad-relación de la memoria (Figura B.4). Cuando se elija el ORM, sus migraciones (`migrations/`) pasarán a ser la fuente del esquema.
- `seeds/dev-seed.sql`: datos ficticios de desarrollo. Todos los usuarios tienen la contraseña `carpooling`.

## Uso

Desde la raíz del repositorio:

    docker compose up -d                  # Levantar la base de datos
    docker compose down                   # Detenerla (conserva los datos)
    docker compose down -v                # Detenerla y BORRAR los datos

Los scripts `schema.sql` y `dev-seed.sql` solo se ejecutan cuando el volumen está vacío. Para aplicar cambios en ellos hay que recrear la base:

    docker compose down -v && docker compose up -d

Para abrir una consola SQL:

    docker exec -it carpooling-db psql -U carpooling -d carpooling

Las credenciales se leen de `.env` (ver `.env.example`); si no existe, se usan las de desarrollo.

## Correspondencia con la memoria

| Memoria (ER)          | Tabla                 |
| --------------------- | --------------------- |
| USUARIO               | `users`               |
| PERFIL_ADMINISTRADOR  | `admin_profiles`      |
| PERFIL_CONDUCTOR      | `driver_profiles`     |
| PERFIL_PASAJERO       | `passenger_profiles`  |
| VEHÍCULO              | `vehicles`            |
| VIAJE                 | `trips`               |
| RUTA                  | `routes`              |
| SOLICITUD             | `requests`            |
| INCIDENCIA            | `incidents`           |
| EVENTO                | `events`              |
| ESCENARIO             | `scenarios`           |
| AGENTE_SIMULADO       | `simulated_agents`    |
| RESULTADO             | `simulation_results`  |

Los estados de las enumeraciones siguen los diagramas de estados del viaje y de la solicitud (p. ej. `EN_CURSO` → `in_progress`).
