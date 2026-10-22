// ¿Puede el conductor publicar viajes? (RF-21: antes del primer viaje debe
// haber registrado al menos un vehículo y aceptado la declaración responsable)
export interface DriverReadiness {
  hasLicenseDeclared: boolean;
  // Fecha de la PRIMERA declaración: es la que tiene valor legal
  licenseDeclaredAt: Date | null;
  activeVehicles: number;
  isReady: boolean;
}
