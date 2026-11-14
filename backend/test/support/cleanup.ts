import { DataSource } from 'typeorm';

// Borra los datos de prueba de los usuarios cuyo correo empieza por el
// prefijo, en el orden que exigen las claves foráneas:
// 1. Los eventos (la tabla events no tiene claves foráneas: no se borran en
//    cascada) de esos usuarios, sus viajes, sus solicitudes, sus incidencias
//    los mensajes del chat de sus viajes y los enlaces de viaje compartido
//    (los enlaces caen en cascada con el viaje o el usuario)
// 2. Sus viajes (sus solicitudes e incidencias caen en cascada). Antes que las
//    solicitudes: una incidencia de pasajero apunta a su solicitud
// 3. Las solicitudes que hicieron como pasajeros en viajes de otros
// 4. Los usuarios (perfiles, vehículos y sesiones caen en cascada) y los
//    registros pendientes de verificar
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
       UNION SELECT id FROM chat_messages WHERE trip_id IN (${testTrips})
       UNION SELECT id FROM trip_shares
               WHERE trip_id IN (${testTrips})
                  OR passenger_id IN (${testUsers})
       UNION SELECT id FROM simulation_runs
               WHERE requested_by IN (${testUsers})
     )`,
    [pattern],
  );
  await dataSource.query(
    `DELETE FROM simulation_runs WHERE requested_by IN (${testUsers})`,
    [pattern],
  );
  await dataSource.query(
    `DELETE FROM admin_actions
      WHERE admin_id IN (${testUsers}) OR target_user_id IN (${testUsers})`,
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
  await dataSource.query(
    'DELETE FROM pending_registrations WHERE email LIKE $1',
    [pattern],
  );
}
