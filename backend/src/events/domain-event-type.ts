// Tipos de evento que la plataforma registra para el Gemelo Digital (RNF-08).
// Formato "entidad.acción", en pasado: cuentan algo que YA ha ocurrido
export type DomainEventType =
  // Usuarios (tabla de entidades del Gemelo Digital: registro y perfiles)
  | 'user.registered'
  | 'user.email_verified'
  | 'user.profile_activated'
  | 'user.profile_deactivated'
  // Cambia los datos de su cuenta (nombre, teléfono o tolerancia horaria)
  | 'user.updated'
  // Cambia el modo con el que viaja (pasajero o conductor)
  | 'user.active_mode_changed'
  // Consentimientos (RGPD: condiciones, privacidad y ubicación)
  | 'consent.granted'
  | 'consent.revoked'
  // Viajes. confirmed: primera solicitud aceptada; reopened: vuelve a
  // publicado porque se han cancelado todas las aceptadas
  | 'trip.published'
  | 'trip.updated'
  | 'trip.confirmed'
  | 'trip.reopened'
  | 'trip.started'
  | 'trip.finished'
  | 'trip.cancelled'
  // Cancelación tardía (con pasajeros, a menos de 30 min de la salida): para
  // medir la fiabilidad de los conductores (escenario S5)
  | 'trip.cancelled_late'
  // Posición del conductor durante el viaje (seguimiento real, RF-12): el
  // "cambio de posición" con el que se sincroniza el Gemelo Digital (RNF-07)
  | 'trip.position_updated'
  // Solicitudes de plaza
  | 'request.created'
  | 'request.accepted'
  | 'request.rejected'
  | 'request.cancelled'
  // Incidencias (RF-23, CU-12)
  | 'incident.reported'
  | 'incident.reviewed'
  | 'coverage.gap_reported';
