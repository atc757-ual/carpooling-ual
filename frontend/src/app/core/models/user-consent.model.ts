export type ConsentType =
  'terms' | 'privacy' | 'location' | 'driver_declaration' | 'vehicle_declaration';
export type ConsentAction = 'granted' | 'revoked';
// location_prompt: la ventana que explica para qué se usa la ubicación;
// device: el usuario quitó el permiso del sistema y la app lo detectó;
// document_update: acepta una versión nueva de las condiciones o la política;
// driver_setup: acepta la declaración responsable del conductor;
// vehicle_setup: acepta la declaración de uno de sus vehículos (seguro e ITV)
export type ConsentSource =
  | 'registration'
  | 'settings'
  | 'account_deletion'
  | 'location_prompt'
  | 'device'
  | 'document_update'
  | 'driver_setup'
  | 'vehicle_setup';

// Los que puede enviar la app al registrar el consentimiento de ubicación
export type LocationConsentSource = Extract<
  ConsentSource,
  'settings' | 'location_prompt' | 'device'
>;

export interface ConsentRecord {
  id: string;
  type: ConsentType;
  documentVersion: string;
  action: ConsentAction;
  source: ConsentSource;
  recordedAt: string;
  fingerprint: string;
  // Solo en la declaración del vehículo: a qué vehículo se refiere
  vehicleId: string | null;
}

export interface UserConsents {
  '@type'?: 'UserConsents';
  current: {
    terms: ConsentRecord | null;
    privacy: ConsentRecord | null;
    location: ConsentRecord | null;
    // La declaración responsable del conductor (RF-21)
    driverDeclaration: ConsentRecord | null;
  };
  // Los concedidos anteriores al último cambio importante de su documento:
  // hay que volver a aceptarlos y, mientras, no cuentan
  outdated: Exclude<ConsentType, 'vehicle_declaration'>[];
  history: ConsentRecord[];
}
