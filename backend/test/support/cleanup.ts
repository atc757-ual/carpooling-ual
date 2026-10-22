import { DataSource } from 'typeorm';

// Borra los datos de prueba de los usuarios cuyo correo empieza por el
// prefijo, en el orden que exigen las claves foráneas:
// 1. Los eventos (la tabla events no tiene claves foráneas: no se borran en
//    cascada) de esos usuarios, sus viajes, sus solicitudes y sus incidencias
// 2. Sus viajes (sus solicitudes e incidencias caen en cascada). Antes que las
//    solicitudes: una incidencia de pasajero apunta a su solicitud
// 3. Las solicitudes que hicieron como pasajeros en viajes de otros
// 4. Los usuarios (perfiles, vehículos y sesiones caen en cascada)
export async function deleteTestUsers(
  dataSource: DataSource,
  emailPrefix: string,
): Promise<void> {
  const pattern = `${emailPrefix}%`;
  const testUsers = 'SELECT id FROM users WHERE email LIKE $1';
  const testTrips = `SELECT id FROM trips WHERE driver_id IN (${testUsers})`;

  await dataSource.query(
    `DELETE FROM events WHERE source_entity_id IN (
       ${testUsers}
       UNION ${testTrips}
       UNION SELECT id FROM requests
               WHERE trip_id IN (${testTrips})
                  OR passenger_id IN (${testUsers})
       UNION SELECT id FROM incidents WHERE trip_id IN (${testTrips})
     )`,
    [pattern],
  );
  await dataSource.query(`DELETE FROM trips WHERE id IN (${testTrips})`, [
    pattern,
  ]);
  await dataSource.query(
    `DELETE FROM requests WHERE passenger_id IN (${testUsers})`,
    [pattern],
  );
  await dataSource.query('DELETE FROM users WHERE email LIKE $1', [pattern]);
}
